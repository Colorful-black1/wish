// 渲染底座：渲染器、后期、程序化环境（IBL）、天空、地面。
// 不用任何 HDRI 文件：每套环境都是一个自建小场景，交给 PMREMGenerator.fromScene 烘成 IBL。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SCENES } from './data.config.js';
import { rng as mulberry } from './util.js';

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 cTop;
  uniform vec3 cMid;
  uniform vec3 cHorizon;
  uniform vec3 cBottom;
  uniform vec3 cGlow;
  uniform float glowStrength;
  uniform float glowY;
  void main() {
    float h = normalize(vDir).y;
    vec3 col;
    if (h >= 0.0) {
      col = mix(cHorizon, cMid, smoothstep(0.0, 0.34, h));
      col = mix(col, cTop, smoothstep(0.28, 0.92, h));
    } else {
      col = mix(cHorizon, cBottom, smoothstep(0.0, 0.5, -h));
    }
    float g = exp(-pow((h - glowY) * 11.0, 2.0)) * glowStrength;
    col += cGlow * g;
    // 抖动：避免大面积渐变出现色带
    float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (d - 0.5) / 220.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function skyMaterial(sky) {
  return new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      cTop: { value: new THREE.Color(sky.top) },
      cMid: { value: new THREE.Color(sky.mid) },
      cHorizon: { value: new THREE.Color(sky.horizon) },
      cBottom: { value: new THREE.Color(sky.bottom) },
      cGlow: { value: new THREE.Color(sky.glow) },
      glowStrength: { value: sky.glowStrength },
      glowY: { value: sky.glowY }
    }
  });
}

function skyDome(sky, radius = 160) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), skyMaterial(sky));
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/** 发光面板：PMREM 里就是一块面光源。intensity 可以 > 1（HDR）。 */
function panel(scene, { w, h, pos, rot = [0, 0, 0], color = '#ffffff', intensity = 1 }) {
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  mat.color = new THREE.Color(color).multiplyScalar(intensity);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  scene.add(mesh);
  return mesh;
}

function box(scene, { w, h, d, pos, rot = [0, 0, 0], color = '#101010' }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  scene.add(mesh);
  return mesh;
}

/** 城市楼体的窗格贴图：暗底 + 稀疏的暖/冷色亮窗，一张图被全部楼共用。 */
function cityWindows() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#04060b';
  ctx.fillRect(0, 0, 128, 256);
  const rand = mulberry(0x2f19);
  for (let y = 3; y < 250; y += 6) {
    for (let x = 3; x < 122; x += 5) {
      if (rand() > 0.62) continue;
      const warm = rand() > 0.45;
      ctx.fillStyle = warm
        ? `rgba(255,214,150,${(0.3 + rand() * 0.55).toFixed(2)})`
        : `rgba(150,205,255,${(0.25 + rand() * 0.5).toFixed(2)})`;
      ctx.fillRect(x, y, 2, 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 远景布景：只做剪影与少量发光件，负责「这是哪个场景」，不参与 IBL。 */
function buildBackdrop(id, def) {
  const group = new THREE.Group();
  group.name = 'backdrop';
  const flat = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: true, depthWrite: opacity >= 1 });
  const glow = (color, opacity = 1) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });

  if (id === 'studio') {
    // 极简摄影棚：地面上一圈细环，标出「展台」范围
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.35, 4.4, 128).rotateX(-Math.PI / 2), flat('#20242a', 0.85));
    ring.position.y = 0.012;
    group.add(ring);
    const inner = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.12, 96).rotateX(-Math.PI / 2), flat('#171a1e', 0.6));
    inner.position.y = 0.011;
    group.add(inner);
  } else if (id === 'garage') {
    // 后墙 + 横向窗格（背向 -Z，渲染时随相机方位旋转）
    const wall = new THREE.Mesh(new THREE.BoxGeometry(46, 10, 0.6), flat('#121519'));
    wall.position.set(0, 4.4, -22);
    group.add(wall);
    for (let i = 0; i < 7; i++) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.2), glow('#8fb6e8', 0.22));
      pane.position.set(-12 + i * 4, 4.6, -21.6);
      group.add(pane);
    }
    for (const x of [-13, 13]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8, 1.1), flat('#0e1114'));
      col.position.set(x, 3.6, -12);
      group.add(col);
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(24, 0.14, 0.5), glow('#cfe2ff', 0.5));
    strip.position.set(0, 7.4, -10);
    group.add(strip);
    group.userData.billboard = true;
  } else if (id === 'night') {
    // 环形天际线：一栋楼一个 draw call，但共用一张窗格贴图
    const windows = cityWindows();
    const bmat = new THREE.MeshBasicMaterial({ map: windows, fog: true });
    const rand = mulberry(0x51a3);
    const n = 40;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.06;
      const r = 78 + rand() * 42;
      const h = 10 + rand() * 30;
      const w = 5 + rand() * 7;
      const d = 5 + rand() * 8;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      b.position.set(Math.sin(a) * r, h / 2 - 0.5, Math.cos(a) * r);
      b.rotation.y = a + (rand() - 0.5) * 0.3;
      group.add(b);
      // 楼顶霓虹压顶，让天际线有层次
      if (i % 5 === 0) {
        const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.22, d * 0.9), glow(['#ff2f86', '#22e6ff', '#9a5bff', '#ffd166'][i % 4], 0.55));
        crown.position.set(b.position.x, h + 0.1, b.position.z);
        group.add(crown);
      }
    }
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 120).rotateX(-Math.PI / 2), flat('#070b14', 0.5));
    road.position.set(0, 0.006, -18);
    group.add(road);
  } else if (id === 'mountain') {
    // 三层山脊剪影 + 太阳
    const rand = mulberry(0x77aa);
    for (let layer = 0; layer < 3; layer++) {
      const dist = 72 + layer * 34;
      const height = 13 - layer * 3.2;
      const width = 240 + layer * 120;
      const segs = 30;
      const pos = [];
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = -width / 2 + t * width;
        const y =
          Math.sin(t * Math.PI * 3.1 + layer * 2.1) * height * 0.5 +
          Math.sin(t * Math.PI * 9.3 + layer * 1.7) * height * 0.22 +
          height * 0.42;
        pts.push([x, Math.max(0.3, y)]);
      }
      for (let i = 0; i < segs; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[i + 1];
        pos.push(x0, 0, 0, x1, 0, 0, x0, y0, 0);
        pos.push(x1, 0, 0, x1, y1, 0, x0, y0, 0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const mesh = new THREE.Mesh(geo, flat(['#26323b', '#354550', '#4a5a66'][layer]));
      mesh.position.set(0, 0, -dist);
      group.add(mesh);
    }
    const sun = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), glow('#fff6e0', 1));
    sun.position.set(-26, 17, -108);
    group.add(sun);
    group.userData.billboard = true;
  } else if (id === 'track') {
    // 维修区 + 看台 + 龙门架（单面布景，随相机方位旋转）
    for (let i = 0; i < 5; i++) {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(8.4, 6, 0.5), flat('#16191d'));
      bay.position.set(-21 + i * 10.4, 3, -52);
      group.add(bay);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.28, 0.9), glow('#eef4ff', 0.55));
      lid.position.set(-21 + i * 10.4, 5.9, -51.6);
      group.add(lid);
    }
    for (let side = -1; side <= 1; side += 2) {
      for (let row = 0; row < 4; row++) {
        const stand = new THREE.Mesh(new THREE.BoxGeometry(34, 1.5, 2.8), flat(row % 2 ? '#2a2e34' : '#20242a'));
        stand.position.set(side * 30, 0.75 + row * 1.4, -10 + row * 2.4);
        group.add(stand);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(34, 0.3, 10), flat('#1a1e23'));
      roof.position.set(side * 30, 6.6, -6);
      group.add(roof);
    }
    for (const x of [-24, 24]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.4, 13, 0.4), flat('#181c21'));
      pole.position.set(x, 6.5, -34);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), glow('#ffffff', 0.75));
      lamp.position.set(x, 13, -33.8);
      group.add(lamp);
    }
    // 赛道白线
    for (const z of [-9, 9]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(70, 0.22).rotateX(-Math.PI / 2), flat('#cfd6dc', 0.75));
      line.position.set(0, 0.008, z);
      group.add(line);
    }
    group.userData.billboard = true;
  }
  return group;
}

/**
 * 五套程序化环境。只用基础材质 + 发光面板搭「小型灯箱」，
 * PMREM 会把它们烘成带高光的 IBL —— 车漆上的亮条就是这里来的。
 */
function buildEnvironment(id) {
  const scene = new THREE.Scene();
  const def = SCENES.find((s) => s.env === id) || SCENES[0];
  scene.add(skyDome(def.sky, 90));

  if (id === 'studio') {
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#0a0b0d' })));
    // 顶部主柔光箱
    panel(scene, { w: 9, h: 5, pos: [0, 7.2, 0], rot: [Math.PI / 2, 0, 0], color: '#ffffff', intensity: 4.2 });
    panel(scene, { w: 6.4, h: 3.2, pos: [-2.6, 6.9, 2.4], rot: [Math.PI / 2, 0, 0.22], color: '#eef3ff', intensity: 3.0 });
    // 左右长条灯
    panel(scene, { w: 1.1, h: 7, pos: [-7.4, 2.4, 0], rot: [0, Math.PI / 2, 0], color: '#d6e2ff', intensity: 5.2 });
    panel(scene, { w: 1.1, h: 7, pos: [7.4, 2.4, 0.6], rot: [0, -Math.PI / 2, 0], color: '#ffe4c0', intensity: 4.0 });
    // 车尾轮廓光
    panel(scene, { w: 7, h: 1.2, pos: [0, 1.5, 9], rot: [0, Math.PI, 0], color: '#fff2dd', intensity: 2.4 });
  } else if (id === 'garage') {
    box(scene, { w: 40, h: 0.2, d: 40, pos: [0, -0.1, 0], color: '#15171a' });
    // 玻璃幕墙：整面发光
    panel(scene, { w: 12, h: 7, pos: [-9, 3.4, 0], rot: [0, Math.PI / 2, 0], color: '#cfe2ff', intensity: 5.6 });
    box(scene, { w: 0.2, h: 7, d: 12, pos: [-9.1, 3.4, 0], color: '#0d0f12' });
    // 天花灯槽
    for (let i = -1; i <= 1; i++) {
      panel(scene, { w: 0.55, h: 9, pos: [i * 3.4 - 1, 5.4, 0], rot: [Math.PI / 2, 0, 0], color: '#e6f1ff', intensity: 3.4 });
    }
    // 暖色壁灯
    panel(scene, { w: 2.4, h: 0.5, pos: [6.4, 2.6, -4], rot: [0, -Math.PI / 2, 0], color: '#ffcf9a', intensity: 3.2 });
    box(scene, { w: 30, h: 8, d: 0.4, pos: [0, 3.6, 8], color: '#1a1d21' });
  } else if (id === 'night') {
    box(scene, { w: 60, h: 0.2, d: 60, pos: [0, -0.1, 0], color: '#05060a' });
    // 两侧楼体 + 窗格
    const cityRnd = (x, z, dir) => {
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 7; col++) {
          const on = (row * 7 + col + (dir > 0 ? 3 : 0)) % 3 !== 0;
          if (!on) continue;
          const hue = (row + col) % 5;
          const color = ['#7ad7ff', '#ffd9a0', '#ff5fa2', '#9f7bff', '#8affd8'][hue];
          panel(scene, {
            w: 1.1,
            h: 0.7,
            pos: [x + dir * 0.06, 1.4 + row * 1.7, z + col * 2.4 - 7],
            rot: [0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0],
            color,
            intensity: 1.6 + ((row * col) % 4) * 0.7
          });
        }
      }
    };
    box(scene, { w: 0.6, h: 16, d: 22, pos: [-11, 8, 0], color: '#080a10' });
    box(scene, { w: 0.6, h: 16, d: 22, pos: [11, 8, 0], color: '#080a10' });
    cityRnd(-10.6, 0, -1);
    cityRnd(10.6, 0, 1);
    // 霓虹招牌
    panel(scene, { w: 3.2, h: 1.0, pos: [-10.4, 5.2, -8], rot: [0, Math.PI / 2, 0], color: '#ff2f86', intensity: 8 });
    panel(scene, { w: 2.6, h: 0.8, pos: [10.4, 3.4, 6], rot: [0, -Math.PI / 2, 0], color: '#22e6ff', intensity: 7 });
    // 远处路灯
    panel(scene, { w: 5, h: 0.3, pos: [0, 6.4, -14], rot: [0, 0, 0], color: '#ffffff', intensity: 4 });
  } else if (id === 'mountain') {
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1b2320' })));
    // 太阳
    panel(scene, { w: 2.6, h: 2.6, pos: [-16, 5.6, -22], rot: [0, 0.6, 0], color: '#fff3d0', intensity: 22 });
    // 远山剪影
    for (let i = 0; i < 3; i++) {
      const w = 34 + i * 12;
      const h = 9 - i * 2.2;
      const mesh = box(scene, { w, h, d: 1.4, pos: [-6 + i * 9, h / 2 - 1.2, -26 - i * 6], color: i % 2 ? '#2c3a35' : '#1c2723' });
      mesh.rotation.z = 0.06 * (i + 1);
    }
    // 地面反光带（沥青）
    panel(scene, { w: 26, h: 8, pos: [0, 0.02, 4], rot: [-Math.PI / 2, 0, 0], color: '#6b7076', intensity: 0.35 });
  } else if (id === 'track') {
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(140, 140).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2a2e33' })));
    // 阴天顶光
    panel(scene, { w: 30, h: 30, pos: [0, 16, 0], rot: [Math.PI / 2, 0, 0], color: '#dfe8f2', intensity: 2.2 });
    // 维修区白棚
    panel(scene, { w: 26, h: 2.2, pos: [0, 5.4, -11], rot: [0, 0, 0], color: '#f4f8ff', intensity: 5 });
    panel(scene, { w: 16, h: 0.5, pos: [-9, 4.2, -6], rot: [Math.PI / 2, 0, 0], color: '#ffffff', intensity: 3.6 });
    // 看台
    for (let i = 0; i < 4; i++) {
      box(scene, { w: 18, h: 1.2, d: 2.2, pos: [14, 1.2 + i * 1.5, -4 + i * 3.4], color: i % 2 ? '#3d4249' : '#2f353c' });
    }
    // 红白路肩
    for (let i = 0; i < 8; i++) {
      panel(scene, { w: 1.6, h: 0.5, pos: [-9 + i * 1.7, 0.05, 7.5], rot: [-Math.PI / 2, 0, 0], color: i % 2 ? '#d8242a' : '#f0f0f0', intensity: 0.9 });
    }
  }
  return scene;
}

export class Showroom {
  constructor(canvas, tier) {
    this.canvas = canvas;
    this.tier = tier;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = !!tier.shadow;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // 灯光与车体都是静止的，阴影贴图按需重烘，省掉每帧一遍 35 万面的深度渲染
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 400);
    this.camera.position.set(-4.5, 1.55, -4.6);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();
    this.envCache = new Map();

    this.scene.add(new THREE.HemisphereLight('#8fa8c8', '#0a0a0c', 0.25));

    this.keyLight = new THREE.DirectionalLight('#ffffff', 2.6);
    this.keyLight.position.set(3.2, 6.4, 3.6);
    this.keyLight.castShadow = !!tier.shadow;
    this.keyLight.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 26;
    this.keyLight.shadow.camera.left = -6;
    this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 6;
    this.keyLight.shadow.camera.bottom = -6;
    this.keyLight.shadow.bias = -0.0006;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 2;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight('#a9c4ff', 0.8);
    this.scene.add(this.fillLight);
    this.rimLight = new THREE.DirectionalLight('#ffd9a0', 1.2);
    this.scene.add(this.rimLight);
    this.ambient = new THREE.HemisphereLight('#1a2230', '#000000', 0.5);
    this.scene.add(this.ambient);

    this.setupFloor();
    // 驾驶舱补光：只在第一人称视角里亮，模拟车内氛围灯
    this.cabinLight = new THREE.PointLight('#ffd3a8', 0, 2.8, 2);
    this.scene.add(this.cabinLight);
    this.sky = null;
    this.sceneDef = SCENES[0];
    this.applyScene(SCENES[0].id);

    this.composer = null;
    this.buildComposer();
  }

  setupFloor() {
    const geo = new THREE.CircleGeometry(120, 128).rotateX(-Math.PI / 2);
    this.floorMat = new THREE.MeshStandardMaterial({
      color: '#0b0d0f',
      roughness: 0.3,
      metalness: 0.6,
      envMapIntensity: 0.9
    });
    this.floor = new THREE.Mesh(geo, this.floorMat);
    this.floor.receiveShadow = !!this.tier.shadow;
    this.floor.renderOrder = 0;
    this.scene.add(this.floor);

    // 灯池：车底一圈柔光，给「摄影棚打光」的感觉
    const pool = document.createElement('canvas');
    pool.width = pool.height = 256;
    const ctx = pool.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const poolTex = new THREE.CanvasTexture(pool);
    poolTex.colorSpace = THREE.SRGBColorSpace;
    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 8.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      })
    );
    this.pool.position.y = 0.004;
    this.pool.renderOrder = 1;
    this.scene.add(this.pool);
  }

  buildComposer() {
    if (this.composer) this.composer.dispose?.();
    const size = this.renderer.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
      type: THREE.HalfFloatType,
      samples: this.tier.msaa || 0
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x || 1, size.y || 1), 0.3, 0.6, 0.9);
    this.bloom.enabled = !!this.tier.bloom;
    this.composer.addPass(this.bloom);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.composer.setSize(Math.max(1, size.x), Math.max(1, size.y));
  }

  setQuality(tier) {
    this.tier = tier;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio));
    this.renderer.shadowMap.enabled = !!tier.shadow;
    this.renderer.shadowMap.needsUpdate = !!tier.shadow;
    this.keyLight.castShadow = !!tier.shadow;
    this.keyLight.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
    this.keyLight.shadow.map?.dispose();
    this.keyLight.shadow.map = null;
    this.floor.receiveShadow = !!tier.shadow;
    this.buildComposer();
    this.applyScene(this.sceneDef.id, true);
  }

  envFor(id) {
    if (!this.envCache.has(id)) {
      const envScene = buildEnvironment(id);
      const rt = this.pmrem.fromScene(envScene, 0.015, 0.1, 200);
      this.envCache.set(id, rt.texture);
      envScene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose?.();
      });
    }
    return this.envCache.get(id);
  }

  applyScene(id, silent = false) {
    const def = SCENES.find((s) => s.id === id) || SCENES[0];
    this.sceneDef = def;

    if (this.sky) {
      this.scene.remove(this.sky);
      this.sky.geometry.dispose();
      this.sky.material.dispose();
    }
    this.sky = skyDome(def.sky, 170);
    this.scene.add(this.sky);

    if (this.backdrop) {
      this.scene.remove(this.backdrop);
      this.backdrop.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose?.();
      });
    }
    this.backdrop = buildBackdrop(def.env, def);
    this.scene.add(this.backdrop);

    // 用指数雾把地面远端融进地平线颜色，避免「地面边缘」出现硬切线
    this.scene.fog = new THREE.FogExp2(new THREE.Color(def.sky.horizon), def.fog ?? 0.025);
    this.scene.environment = this.envFor(def.env);
    this.scene.environmentIntensity = 1;
    this.renderer.toneMappingExposure = def.exposure;

    this.floorMat.color.set(def.floor.color);
    this.floorMat.roughness = def.floor.roughness;
    this.floorMat.metalness = def.floor.metalness;
    this.floorMat.envMapIntensity = def.floor.envIntensity;

    this.keyLight.color.set(def.key.color);
    this.keyLight.intensity = def.key.intensity;
    this.keyLight.position.set(...def.key.pos);
    this.fillLight.color.set(def.fill.color);
    this.fillLight.intensity = def.fill.intensity;
    this.fillLight.position.set(...def.fill.pos);
    this.rimLight.color.set(def.rim.color);
    this.rimLight.intensity = def.rim.intensity;
    this.rimLight.position.set(...def.rim.pos);
    this.ambient.color.set(def.ambient.color);
    this.ambient.intensity = def.ambient.intensity;

    if (this.bloom) {
      this.bloom.strength = def.bloom.strength;
      this.bloom.radius = def.bloom.radius;
      this.bloom.threshold = def.bloom.threshold;
    }
    this.renderer.shadowMap.needsUpdate = true;
    if (!silent) this.sceneVersion = (this.sceneVersion || 0) + 1;
    return def;
  }

  resize(w, h) {
    const pr = Math.min(devicePixelRatio || 1, this.tier.pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom?.setSize(w, h);
  }

  render() {
    // 单面布景跟随相机方位旋转，保证从任何一个预设视角看都是「车背后有景」
    if (this.backdrop?.userData.billboard) {
      this.backdrop.rotation.y = Math.atan2(this.camera.position.x, this.camera.position.z);
    }
    this.renderer.info.reset();
    this.composer.render();
  }

  get stats() {
    const info = this.renderer.info;
    return { calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures, programs: info.programs?.length || 0 };
  }
}
