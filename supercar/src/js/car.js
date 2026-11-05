// 车型装配：解析内联 GLB（Draco 解码器改成内存里取，不再按路径请求 wasm），
// 按材质角色克隆/替换成程序化材质，并建立「可操作节点索引」与「拾取分组」。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLB_B64, AO_PNG_B64, DRACO_WASM_B64, DRACO_WRAPPER_JS } from 'virtual:assets';
import { b64ToBytes } from './util.js';
import { PARTS } from './data.config.js';
import * as M from './materials.js';

let dracoText = null;
let dracoWasm = null;

/**
 * Draco 解码器在 file:// 下不能按路径取文件，这里把 _loadLibrary 覆写成
 * 直接返回构建期内联的 wrapper 文本与 wasm 字节（见 README「技术说明」）。
 */
function patchDraco(loader) {
  const draco = new DRACOLoader();
  draco._loadLibrary = (_url, responseType) => {
    if (responseType === 'arraybuffer') {
      if (!dracoWasm) dracoWasm = b64ToBytes(DRACO_WASM_B64);
      return Promise.resolve(dracoWasm.slice().buffer);
    }
    if (!dracoText) dracoText = DRACO_WRAPPER_JS;
    return Promise.resolve(dracoText);
  };
  loader.setDRACOLoader(draco);
  return draco;
}

/**
 * glTF 里同名节点会被 three 去重成 wheel / wheel_1 / wheel_2 …，
 * 查角色和拾取分组前先去掉这个后缀，否则「第 2 个轮辋」会掉进兜底材质。
 */
function stripIndex(name) {
  return name.replace(/_\d+$/, '');
}

/** 节点名 → 材质角色。角色决定这一片网格吃哪套程序化材质。 */
function roleOf(name, parentName) {
  const n = stripIndex(name);
  name = n;
  if (name === 'body') return 'paint';
  if (name === 'glass') return 'glass';
  if (name === 'lights') return 'headlamp';
  if (name === 'leds') return 'led';
  if (name === 'lights_red' || name === 'brakes') return 'taillamp';
  if (name === 'tire') return 'rubber';
  if (name === 'brake') return 'caliper';
  if (name === 'rim' || /^rim_/.test(name) || name === 'wheel') return 'rim';
  if (name === 'centre') return 'accentYellow';
  if (name === 'nuts') return 'metalDark';
  if (name === 'carpet') return 'carpet';
  if (name === 'leather') return 'leather';
  if (name === 'interior_light') return 'interiorLight';
  if (name === 'interior_dark') return 'interiorDark';
  if (name === 'carbon_fibre_trim' || name === 'carbon fibre') return 'carbonTrim';
  if (name === 'steering_leather') return 'leather';
  if (name === 'steering_carbon') return 'carbonTrim';
  if (name === 'steering_column') return 'interiorDark';
  if (name === 'steering_metal') return 'chrome';
  if (name === 'steering_trim') return 'trim';
  if (name === 'steering_red_lights') return 'steeringLed';
  if (name === 'steering_centre') return 'accentYellow';
  if (name === 'chrome') return 'chrome';
  if (name === 'metal') return 'metal';
  if (name === 'grills') return 'grille';
  if (name === 'plastic_gray') return 'plastic';
  if (name === 'trim') return 'trim';
  if (name === 'wipers') return 'plastic';
  if (name === 'blue') return 'accentBlue';
  if (name === 'yellow_trim') return 'accentYellow';
  if (parentName === 'steering_wheel') return 'interiorDark';
  return 'plastic';
}

/** 节点名归属的拾取分组（材质组级，不是独立零件）。 */
const PART_BY_NODE = (() => {
  const map = new Map();
  for (const part of PARTS) for (const n of part.nodes) map.set(n, part.id);
  return map;
})();

const partForNode = (name) => PART_BY_NODE.get(name) || PART_BY_NODE.get(stripIndex(name)) || null;

export class Car {
  constructor(root, opts) {
    this.root = root;
    this.group = new THREE.Group();
    this.group.name = 'car';
    this.group.add(root);
    this.byRole = new Map();
    this.meshes = [];
    this.nodes = new Map();
    this.roleOfMesh = new Map();
    this.tier = opts.tier;
    this.steeringGroup = null;
    this.wheels = [];
    this.headlights = [];
    this.partsInfo = new Map();
  }

  static async load({ onProgress } = {}) {
    const bytes = b64ToBytes(GLB_B64);
    const loader = new GLTFLoader();
    patchDraco(loader);
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(bytes.buffer, '', resolve, reject);
    });
    onProgress?.('模型解析完成');
    return gltf;
  }

  /** 归一化：居中、贴地、车头统一朝向 -Z。 */
  static normalize(gltf) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.material.side = THREE.FrontSide;
      }
    });
    const wheel = root.getObjectByName('wheel_fl');
    if (wheel) {
      const p = new THREE.Vector3();
      wheel.getWorldPosition(p);
      // 模型车头朝 -Z 时，前轮世界 z 为负；否则整体转 180°
      if (p.z > 0) {
        const wrapper = new THREE.Group();
        wrapper.add(root);
        wrapper.rotation.y = Math.PI;
        wrapper.updateMatrixWorld(true);
        return { root: wrapper, flipped: true };
      }
    }
    return { root, flipped: false };
  }

  /** 建立节点索引 + 可选节点 + 拾取分组 + 世界包围盒。 */
  build(tier) {
    this.tier = tier;
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // 居中并把轮胎压到 y = 0
    this.root.position.x -= center.x;
    this.root.position.z -= center.z;
    this.root.position.y -= box.min.y;
    this.root.updateMatrixWorld(true);

    this.bounds = new THREE.Box3().setFromObject(this.root);
    this.size = this.bounds.getSize(new THREE.Vector3());
    this.length = this.size.z;
    this.width = this.size.x;
    this.height = this.size.y;

    this.root.traverse((o) => {
      if (!o.isMesh) return;
      this.nodes.set(o.name, o);
      this.meshes.push(o);
    });

    this.assignMaterials(tier);
    this.buildParts();
    this.buildWheels();
    this.buildSteering();
    this.buildHeadlights();
    this.addShadowPlane();
    return this;
  }

  buildParts() {
    // 按 mesh 上已经标注的拾取分组聚合包围盒（同名节点去重后也能全覆盖）
    const boxes = new Map();
    const counts = new Map();
    for (const mesh of this.meshes) {
      const id = mesh.userData.part;
      if (!id) continue;
      const box = boxes.get(id) || new THREE.Box3();
      box.expandByObject(mesh);
      boxes.set(id, box);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    for (const part of PARTS) {
      const box = boxes.get(part.id);
      if (!box || box.isEmpty()) continue;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      this.partsInfo.set(part.id, { ...part, count: counts.get(part.id) || 0, center: sphere.center.clone(), radius: sphere.radius });
    }
  }

  assignMaterials(tier) {
    const roles = {
      paint: M.makePaint('#d40000', { id: 'metallic', metalness: 0.82, roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.075, flake: 0.55, iridescence: 0 }),
      glass: M.makeGlass(tier.glass),
      headlamp: M.makeLamp('#d8e6ff', '#eaf4ff', { opacity: 0.96 }),
      led: M.makeLamp('#f0f4ff', '#ffffff'),
      taillamp: M.makeLamp('#5a0b0e', '#ff1a26', { opacity: 0.92 }),
      steeringLed: M.makeLamp('#ff2a2a', '#ff3030'),
      rubber: M.makeRubber(),
      rim: M.makeChrome('#c9ccd0', 0.26),
      caliper: M.makePlastic('#c4161c', 0.3),
      chrome: M.makeChrome('#d3d7db', 0.1),
      metal: M.makeDarkMetal('#4a4e54', 0.34),
      metalDark: M.makeDarkMetal('#26282b', 0.5),
      plastic: M.makePlastic('#151619', 0.66),
      grille: M.makePlastic('#101113', 0.7),
      trim: M.makePlastic('#1b1c1f', 0.55),
      leather: M.makeLeather('#1c1c1f', {}),
      interiorLight: M.makeLeather('#3a3a3f', { roughness: 0.6 }),
      interiorDark: M.makePlastic('#141416', 0.62),
      carpet: M.makeCarpet('#1a1a1c'),
      carbonTrim: M.makePlastic('#26282c', 0.34),
      accentYellow: M.makeChrome('#e8b21a', 0.28),
      accentBlue: M.makeChrome('#1e90ff', 0.3)
    };
    this.roles = roles;
    for (const mat of Object.values(roles)) {
      mat.envMapIntensity = Math.max(mat.envMapIntensity || 1, 1);
      mat.userData.baseEmissive = mat.emissive ? mat.emissive.getHex() : 0x000000;
      mat.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
    }

    for (const mesh of this.meshes) {
      const role = roleOf(mesh.name, mesh.parent?.name);
      const mat = roles[role] || roles.plastic;
      mesh.material = mat;
      mesh.userData.role = role;
      mesh.userData.part = partForNode(mesh.name);
      // 方向盘子网格归到「方向盘组」这个拾取分组
      let node = mesh.parent;
      while (node && !mesh.userData.part) {
        if (node.name === 'steering_wheel') mesh.userData.part = 'wheel-group';
        node = node.parent;
      }
      this.roleOfMesh.set(mesh, role);
      if (!this.byRole.has(role)) this.byRole.set(role, []);
      this.byRole.get(role).push(mat);
    }
    // 同角色共用一份材质实例即可
    for (const [role, list] of this.byRole) {
      this.byRole.set(role, [...new Set(list)]);
    }
    this.applyCarbonTrim(true);
  }

  buildWheels() {
    for (const key of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
      const node = this.root.getObjectByName(key);
      if (!node) continue;
      this.wheels.push({ node, base: node.quaternion.clone(), side: key });
    }
  }

  buildSteering() {
    const node = this.root.getObjectByName('steering_wheel');
    if (!node) return;
    this.steeringGroup = { node, base: node.quaternion.clone() };
    node.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(node);
    this.steeringBox = box;
  }

  buildHeadlights() {
    const lamp = this.root.getObjectByName('lights');
    if (!lamp) return;
    lamp.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(lamp);
    const c = box.getCenter(new THREE.Vector3());
    for (const sx of [-1, 1]) {
      const spot = new THREE.SpotLight('#eaf2ff', 0, 26, 0.34, 0.6, 1.8);
      spot.position.set(c.x + sx * (box.max.x - box.min.x) * 0.32, c.y - 0.02, c.z + 0.05);
      spot.target.position.set(c.x + sx * 0.9, -0.1, c.z - 12);
      spot.castShadow = false;
      this.group.add(spot);
      this.group.add(spot.target);
      this.headlights.push(spot);
    }
  }

  addShadowPlane() {
    const tex = new THREE.TextureLoader().load('data:image/png;base64,' + AO_PNG_B64);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.tier.anisotropy;
    const w = this.width * 0.98;
    const l = this.length * 1.06;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      transparent: true,
      depthWrite: false,
      opacity: 0.92
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), mat);
    mesh.position.y = 0.002;
    mesh.renderOrder = 2;
    this.shadowPlane = mesh;
    this.group.add(mesh);
  }

  get shadowsOn() {
    return !!this.tier.shadow;
  }

  // ---------- 配置 ----------

  setPaint(hex, finish) {
    const mat = this.roles.paint;
    const next = M.makePaint(hex, finish);
    // 复用实例，避免重建管线
    mat.copy(next);
    mat.name = 'paint';
    this.roles.paint = mat;
    next.dispose();
    this.currentPaint = { hex, finish: finish.id };
  }

  setCaliper(def) {
    const mat = this.roles.caliper;
    mat.color.set(def.hex);
    mat.metalness = def.metalness;
    mat.roughness = def.roughness;
    mat.emissive.set('#000000');
  }

  setRim(def) {
    const mat = this.roles.rim;
    mat.color.set(def.hex);
    mat.metalness = def.metalness;
    mat.roughness = def.roughness;
  }

  setInterior(def) {
    const suede = !!def.suede;
    this.roles.leather.color.set(def.leather);
    this.roles.leather.roughness = def.roughness;
    this.roles.leather.sheen = suede ? 0.55 : def.sheen;
    this.roles.leather.clearcoat = suede ? 0 : 0.28;
    this.roles.leather.bumpMap = suede ? M.suedeGrain() : M.leatherGrain();
    this.roles.leather.bumpScale = suede ? 0.22 : 0.12;
    this.roles.leather.needsUpdate = true;

    this.roles.interiorDark.color.set(def.dark);
    this.roles.interiorLight.color.set(def.accent);
    this.roles.carpet.color.set(def.carpet);
    this.roles.steeringLed.emissive.set(def.accent);
    this.roles.trim.color.set(def.dark);
  }

  /** 碳纤维饰板开关：关闭时换成与车身同色的漆面。 */
  applyCarbonTrim(on) {
    const mat = this.roles.carbonTrim;
    if (on) {
      const weave = M.carbonWeave();
      mat.map = weave.map;
      mat.map.repeat.set(6, 6);
      mat.bumpMap = weave.bump;
      mat.bumpScale = 0.3;
      mat.color.set('#6f7378');
      mat.roughness = 0.32;
      mat.metalness = 0.45;
    } else {
      mat.map = null;
      mat.bumpMap = null;
      mat.color.set('#17181a');
      mat.roughness = 0.22;
      mat.metalness = 0.7;
    }
    mat.needsUpdate = true;
    this.carbonTrim = on;
  }

  /** 画质档切换时重建玻璃材质（transmission 与半透明是两套实现）。 */
  setGlassMode(mode) {
    const next = M.makeGlass(mode);
    this.roles.glass.copy(next);
    next.dispose();
    this.roles.glass.needsUpdate = true;
  }

  /** 灯组状态：只改 emissive，不改几何。 */
  setLightState(state) {
    const lamp = this.roles.headlamp;
    const led = this.roles.led;
    const tail = this.roles.taillamp;
    const headOn = state.low || state.high;
    lamp.emissiveIntensity = state.high ? 4.2 : state.low ? 2.4 : 0;
    lamp.color.set(headOn ? '#eef6ff' : '#c9d6e6');
    led.emissive.set(state.hazard || state.turn ? '#ffb020' : '#f2f7ff');
    led.emissiveIntensity = state.turn || state.hazard ? 0 : state.drl ? 2.6 : 0;
    tail.emissiveIntensity = state.brake ? 5.2 : state.tail ? 1.7 : 0;
    for (const spot of this.headlights) {
      spot.intensity = state.high ? 16 : state.low ? 9 : 0;
      spot.angle = state.high ? 0.3 : 0.4;
      spot.penumbra = state.high ? 0.55 : 0.7;
    }
  }

  /** 转向灯 / 双闪的节拍。phase 由 app 每帧传入，0..1。 */
  setBlink(phase, state) {
    const led = this.roles.led;
    const on = phase < 0.5;
    if (state.hazard) {
      led.emissive.set('#ffb020');
      led.emissiveIntensity = on ? 5 : 0.2;
    } else if (state.turn) {
      led.emissive.set('#ffb020');
      led.emissiveIntensity = on ? 4.4 : 0.2;
    }
  }

  // ---------- 动画 ----------

  spinWheels(dt, speed = 0.6) {
    this.wheelAngle = (this.wheelAngle || 0) + dt * speed;
    const q = new THREE.Quaternion();
    for (const w of this.wheels) {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.wheelAngle);
      w.node.quaternion.copy(w.base).multiply(q);
    }
  }

  turnSteering(angle) {
    if (!this.steeringGroup) return;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.steeringGroup.node.quaternion.copy(this.steeringGroup.base).multiply(q);
  }

  // ---------- 交互 ----------

  partAt(mesh) {
    return mesh?.userData?.part || null;
  }

  partInfo(id) {
    return this.partsInfo.get(id) || null;
  }

  highlight(partId, on) {
    const roles = new Set();
    for (const [mesh, role] of this.roleOfMesh) {
      if (mesh.userData.part === partId) roles.add(role);
    }
    for (const role of roles) {
      const mat = this.roles[role];
      if (!mat || mat.userData.lamp) continue;
      if (!mat.emissive) continue;
      mat.emissive.set(on ? '#3d8bff' : '#000000');
      mat.emissiveIntensity = on ? 0.34 : 0;
    }
  }

  clearHighlight() {
    for (const mat of Object.values(this.roles)) {
      if (!mat.emissive || mat.userData.lamp) continue;
      mat.emissive.setHex(mat.userData.baseEmissive || 0);
      mat.emissiveIntensity = mat.userData.baseEmissiveIntensity || 0;
    }
  }

  /** 调试/QA 用：从某点朝若干方向投射，返回最近命中的网格与距离（用于摆放驾驶舱补建件）。 */
  probeCabin(origin) {
    const rc = new THREE.Raycaster();
    const dirs = {
      fwd: [0, 0, -1],
      fwdDown: [0, -0.3, -1],
      fwdSlightDown: [0, -0.12, -1],
      fwdLeft: [-0.4, -0.1, -1],
      fwdRight: [0.5, -0.15, -1],
      right: [1, -0.1, -0.4],
      up: [0, 1, 0],
      down: [0, -1, 0]
    };
    const out = {};
    for (const [key, d] of Object.entries(dirs)) {
      rc.set(origin, new THREE.Vector3(...d).normalize());
      rc.far = 3;
      out[key] = rc
        .intersectObjects(this.meshes, false)
        .slice(0, 3)
        .map((h) => ({ name: h.object.name, d: +h.distance.toFixed(3), at: h.point.toArray().map((n) => +n.toFixed(3)) }));
    }
    return out;
  }

  /** 调试/QA 用：返回关键节点的世界包围盒。 */
  debugNodes() {
    const out = {};
    const box = new THREE.Box3();
    for (const name of ['body', 'glass', 'lights', 'lights_red', 'leather', 'interior_light', 'steering_wheel', 'tire', 'rim_fl', 'brake', 'carpet']) {
      const node = this.root.getObjectByName(name);
      if (!node) continue;
      box.setFromObject(node);
      out[name] = {
        min: box.min.toArray().map((n) => +n.toFixed(3)),
        max: box.max.toArray().map((n) => +n.toFixed(3))
      };
    }
    out.__car = {
      size: this.size.toArray().map((n) => +n.toFixed(3)),
      min: this.bounds.min.toArray().map((n) => +n.toFixed(3)),
      max: this.bounds.max.toArray().map((n) => +n.toFixed(3))
    };
    out.__wheels = {};
    for (const name of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
      const n = this.root.getObjectByName(name);
      if (!n) continue;
      const p = new THREE.Vector3();
      n.getWorldPosition(p);
      out.__wheels[name] = p.toArray().map((v) => +v.toFixed(3));
    }
    return out;
  }
}
