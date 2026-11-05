// 装配层：把 scene / car / camera / lights / audio / ui 串起来，管状态、渲染循环与拾取。
import * as THREE from 'three';
import { Showroom } from './scene.js';
import { Car } from './car.js';
import { CameraRig } from './camera.js';
import { LightState } from './lights.js';
import { EngineAudio } from './audio.js';
import { UI } from './ui.js';
import { buildInteriorScreens } from './interior.js';
import { CARS } from './data.car.js';
import { DEFAULT_STATE, SCENES, VIEWS, PAINTS, FINISHES, CALIPERS, RIMS, INTERIORS, LIGHTS, QUALITY } from './data.config.js';
import { clamp, damp } from './util.js';

const HASH_KEYS = ['paint', 'finish', 'caliper', 'rim', 'interior', 'scene', 'view', 'trim', 'lights', 'quality'];
const LS_KEY = 'supercar:state';

function detectQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || innerWidth < 760;
  if (mobile && cores <= 6) return 'mid';
  if (mobile) return 'mid';
  if (cores <= 2) return 'low';
  if (cores <= 4) return 'mid';
  return 'high';
}

class App {
  constructor() {
    this.state = structuredClone(DEFAULT_STATE);
    this.cars = CARS;
    // 配置数据也挂到实例上，便于 UI 与 QA 共用同一份来源
    this.paintList = PAINTS;
    this.finishList = FINISHES;
    this.caliperList = CALIPERS;
    this.rimList = RIMS;
    this.interiors = INTERIORS;
    this.sceneList = SCENES;
    this.viewList = VIEWS;
    this.lightList = LIGHTS;
    this.qualityList = QUALITY;
    this.qualityId = 'high';
    this.fps = 0;
    this._frames = 0;
    this._fpsT = performance.now();
    this.lastHover = 0;
    this.pointer = { x: 0, y: 0, inside: false };
    this.clock = new THREE.Clock();
  }

  async boot() {
    const canvas = document.getElementById('view');
    this.qualityId = detectQuality();
    this.tier = QUALITY[this.qualityId];
    this.setBootText('正在建立渲染器…');
    this.showroom = new Showroom(canvas, this.tier);
    this.car = null;
    this.rig = new CameraRig({ camera: this.showroom.camera, domElement: canvas });
    this.rig.bindCockpitDrag();
    this.audio = new EngineAudio();
    this.ui = new UI(this);

    this.setBootText('正在解码车辆模型（Draco）…');
    const gltf = await Car.load({ onProgress: (m) => this.setBootText(m) });
    this.setBootText('正在生成程序化材质…');
    const normalized = Car.normalize(gltf);
    this.car = new Car(normalized.root, { tier: this.tier }).build(this.tier);
    this.showroom.scene.add(this.car.group);
    this.car.group.traverse((o) => {
      if (o.isMesh) o.castShadow = !!this.tier.shadow;
    });

    this.lights = new LightState(this.car);

    this.loadState();
    this.ui.mount();
    this.applyAll({ instantCamera: true });
    this.bindPointer();
    this.bindResize();

    // 驾驶舱补建：仪表 + 中控屏（模型里没有这两块网格）
    const anchor = this.cockpitAnchor();
    this.screens = buildInteriorScreens(this.car, { eye: anchor.eye });
    this.placeCabinLight(anchor.eye);

    this.resize();
    this.showroom.applyScene(this.state.scene, true);
    this.rig.setView(this.state.view, { instant: true });

    this.setBootText('就绪');
    document.getElementById('boot')?.classList.add('is-done');
    document.body.classList.add('is-ready');
    this.clock.start();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    window.SUPERCAR_READY = true;
    window.SC = this;
  }

  setBootText(text) {
    const node = document.getElementById('bootText');
    if (node) node.textContent = text;
  }

  // ---------- 状态 ----------

  currentCar() {
    return this.cars.find((c) => c.id === this.state.car) || this.cars[0];
  }

  loadState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (saved) Object.assign(this.state, this.prune(saved));
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    for (const key of HASH_KEYS) {
      if (!hash.has(key)) continue;
      const v = hash.get(key);
      if (key === 'trim') this.state.trim = v === '1' ? 'carbon' : 'none';
      else if (key === 'lights') {
        const on = new Set(v.split(',').filter(Boolean));
        for (const k of Object.keys(this.state.lights)) this.state.lights[k] = on.has(k);
      } else if (HASH_KEYS.includes(key)) {
        this.state[key] = v;
      }
    }
    this.state.quality = this.state.quality || 'auto';
    // 说明条目不是真车，不能作为当前车型恢复
    if (this.cars.find((c) => c.id === this.state.car)?.info) this.state.car = this.cars[0].id;
  }

  prune(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (k === 'lights' && v && typeof v === 'object') out.lights = { ...DEFAULT_STATE.lights, ...v };
      else if (k in DEFAULT_STATE) out[k] = v;
    }
    return out;
  }

  writeState() {
    const st = this.state;
    const params = new URLSearchParams();
    params.set('paint', st.paint);
    if (st.paint === 'custom') params.set('hex', st.custom.replace('#', ''));
    params.set('finish', st.finish);
    params.set('caliper', st.caliper);
    params.set('rim', st.rim);
    params.set('interior', st.interior);
    params.set('scene', st.scene);
    params.set('view', this.rig.isCockpit ? 'interior' : st.view);
    params.set('trim', st.trim === 'carbon' ? '1' : '0');
    params.set('lights', Object.entries(st.lights).filter(([, v]) => v).map(([k]) => k).join(','));
    const hash = params.toString();
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}#${hash}`);
    } catch {
      /* file:// 某些环境下 replaceState 受限 */
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.state));
    } catch {
      /* 隐私模式忽略 */
    }
  }

  // ---------- 应用配置 ----------

  paintColor() {
    const p = PAINTS.find((x) => x.id === this.state.paint) || PAINTS[0];
    return p.custom ? this.state.custom : p.hex;
  }

  finishDef() {
    return FINISHES.find((f) => f.id === this.state.finish) || FINISHES[0];
  }

  applyPaint({ silent = false } = {}) {
    if (!this.car) return;
    const finish = this.finishDef();
    this.car.setPaint(this.paintColor(), finish);
    if (!silent) {
      this.ui?.renderPanel();
      this.ui?.sync();
    }
    this.writeState();
  }

  applyAll({ instantCamera = false } = {}) {
    if (!this.car) return;
    this.applyPaint();
    this.setCaliper(this.state.caliper, { silent: true });
    this.setRim(this.state.rim, { silent: true });
    this.setInterior(this.state.interior, { silent: true });
    this.car.applyCarbonTrim(this.state.trim === 'carbon');
    this.showroom.applyScene(this.state.scene, true);
    this.lights.restore(this.state.lights);
    if (instantCamera) this.rig.setView(this.state.view, { instant: true });
    this.ui?.sync();
  }

  setPaint(id) {
    this.state.paint = id;
    if (id !== 'custom') this.state.custom = this.state.custom || DEFAULT_STATE.custom;
    this.applyPaint();
  }

  setCustomColor(hex, { silent = false } = {}) {
    this.state.custom = hex;
    this.state.paint = 'custom';
    this.applyPaint({ silent });
  }

  setFinish(id) {
    this.state.finish = id;
    this.applyPaint();
  }

  setCaliper(id, { silent = false } = {}) {
    this.state.caliper = id;
    const def = CALIPERS.find((c) => c.id === id) || CALIPERS[0];
    this.car?.setCaliper(def);
    if (!silent) {
      this.ui?.renderPanel();
      this.writeState();
    }
  }

  setRim(id, { silent = false } = {}) {
    this.state.rim = id;
    const def = RIMS.find((r) => r.id === id) || RIMS[0];
    this.car?.setRim(def);
    if (!silent) {
      this.ui?.renderPanel();
      this.writeState();
    }
  }

  setInterior(id, { silent = false } = {}) {
    this.state.interior = id;
    const def = INTERIORS.find((i) => i.id === id) || INTERIORS[0];
    this.car?.setInterior(def);
    if (!silent) {
      this.ui?.renderPanel();
      this.writeState();
    }
  }

  setTrim(on) {
    this.state.trim = on ? 'carbon' : 'none';
    this.car?.applyCarbonTrim(on);
    this.ui?.renderPanel();
    this.ui?.sync();
    this.writeState();
  }

  resetConfig() {
    const d = DEFAULT_STATE;
    this.state.paint = d.paint;
    this.state.custom = d.custom;
    this.state.finish = d.finish;
    this.state.caliper = d.caliper;
    this.state.rim = d.rim;
    this.state.interior = d.interior;
    this.state.trim = 'carbon';
    this.applyAll();
    this.ui?.toast('已恢复原厂配置');
  }

  setScene(id) {
    if (!SCENES.some((s) => s.id === id)) return;
    this.state.scene = id;
    this.showroom.applyScene(id);
    this.ui?.sync();
    this.ui?.toast(`环境：${SCENES.find((s) => s.id === id).cn}`);
    this.writeState();
  }

  cycleScene() {
    const i = SCENES.findIndex((s) => s.id === this.state.scene);
    this.setScene(SCENES[(i + 1) % SCENES.length].id);
  }

  setQuality(id) {
    this.state.quality = id;
    this.qualityId = id === 'auto' ? detectQuality() : id;
    this.tier = QUALITY[this.qualityId];
    this.showroom.setQuality(this.tier);
    // 画质档会改变玻璃实现（transmission ↔ 半透明），需要整组换材质
    if (this.car) {
      this.car.tier = this.tier;
      this.car.setGlassMode(this.tier.glass);
      this.car.meshes.forEach((mesh) => {
        mesh.castShadow = !!this.tier.shadow;
      });
    }
    this.resize();
    this.ui?.sync();
    this.writeState();
  }

  setView(id) {
    if (!VIEWS.some((v) => v.id === id)) return;
    if (id === 'interior') return this.enterCockpit();
    if (this.rig.isCockpit) this.rig.exitCockpit();
    this.state.view = id;
    this.rig.setView(id);
    this.ui.mode = 'exterior';
    this.ui.sync();
    this.writeState();
  }

  resetView() {
    this.setView('front45');
  }

  toggleCockpit() {
    if (this.rig.isCockpit) this.exitCockpit();
    else this.enterCockpit();
  }

  cockpitAnchor() {
    const box = this.car?.steeringBox;
    if (!box) return null;
    const c = box.getCenter(new THREE.Vector3());
    const eye = c.clone().add(new THREE.Vector3(0.01, 0.31, 0.62));
    const look = eye.clone().add(new THREE.Vector3(-0.05, -0.13, -6));
    return { eye, look };
  }

  placeCabinLight(eye) {
    const light = this.showroom.cabinLight;
    if (!light) return;
    light.position.copy(eye).add(new THREE.Vector3(0.02, 0.22, 0.12));
  }

  enterCockpit() {
    if (this.rig.isCockpit) return;
    document.body.classList.add('is-cockpit');
    this.rig.enterCockpit(this.cockpitAnchor());
    if (this.showroom.cabinLight) this.showroom.cabinLight.intensity = 0.9;
    this.state.view = 'interior';
    this.ui.mode = 'interior';
    this.ui.sync();
    this.ui.toast('拖动环视 · 滚轮缩放 · Esc 退出');
    this.writeState();
  }

  exitCockpit() {
    if (!this.rig.isCockpit) return;
    document.body.classList.remove('is-cockpit');
    this.rig.exitCockpit();
    if (this.showroom.cabinLight) this.showroom.cabinLight.intensity = 0;
    this.state.view = this.rig.viewId;
    this.ui.mode = 'exterior';
    this.ui.sync();
    this.writeState();
  }

  setMode(mode) {
    this.ui.mode = mode;
    if (mode === 'interior') {
      this.enterCockpit();
      return;
    }
    if (this.rig.isCockpit) this.exitCockpit();
    if (mode === 'customize') {
      this.ui.setTab('config');
      this.setView('side');
    } else if (mode === 'details') {
      this.ui.setTab('spec');
      this.setView('front45');
    } else {
      this.ui.setTab('spec');
      this.setView('front');
    }
    this.ui.sync();
  }

  // ---------- 灯光 / 声音 ----------

  toggleLight(id) {
    const on = this.lights.toggle(id);
    this.state.lights = this.lights.serialize();
    this.ui?.renderPanel();
    this.writeState();
    return on;
  }

  allLights(on) {
    this.lights.all(on);
    this.state.lights = this.lights.serialize();
    this.ui?.renderPanel();
    this.writeState();
  }

  toggleAllLights() {
    const any = Object.values(this.state.lights).some(Boolean);
    this.allLights(!any);
  }

  async toggleSound() {
    if (!this.audio.supported) {
      this.ui.toast('当前浏览器不支持 WebAudio');
      return;
    }
    if (!this.state.sound) {
      this.state.sound = true;
      await this.audio.start();
      this.audio.setMuted(false);
      this.audio.rev();
      this.ui.toast('引擎声已开启（程序化合成，非录音采样）');
    } else {
      this.state.sound = false;
      this.audio.setMuted(true);
      this.audio.stop();
      this.ui.toast('已静音');
    }
    this.ui.sync();
    this.writeState();
  }

  // ---------- 选车 / 部件 ----------

  selectCar(id) {
    const car = this.cars.find((c) => c.id === id);
    if (!car) return;
    if (car.info) {
      this.state.car = id;
      this.ui.setTab('spec');
      this.ui.render();
      this.ui.toast('这是一个说明条目：换掉 assets/models 里的 GLB 即可接入新车型');
      return;
    }
    this.state.car = id;
    this.ui.render();
    this.ui.toast('当前版本内置 1 辆真车模型');
  }

  focusPart(partId) {
    const info = this.car?.partInfo(partId);
    if (!info) return;
    this.rig.focusPart(info);
    this.ui.setPart(partId);
    this.ui.sync();
  }

  clearPart() {
    this.car?.clearHighlight();
    this.ui.setPart(null);
  }

  // ---------- 输入 ----------

  bindPointer() {
    const canvas = this.showroom.canvas;
    let pointerDown = null;
    canvas.addEventListener('pointerdown', (e) => {
      pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointermove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.inside = true;
      const now = performance.now();
      if (now - this.lastHover < 70) return;
      this.lastHover = now;
      this.hoverAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
      this.car?.clearHighlight();
      document.getElementById('partLabel')?.classList.remove('is-on');
    });
    canvas.addEventListener('click', (e) => {
      // 拖动视角也会触发 click，位移超过阈值就不当成点选
      if (pointerDown && Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) > 6) return;
      // 驾驶舱里点中控屏就给一句说明，其余情况不做拾取
      if (this.screens) {
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this._screenRay = this._screenRay || new THREE.Raycaster();
        this._screenRay.setFromCamera(ndc, this.showroom.camera);
        const hits = this._screenRay.intersectObjects([this.screens.center, this.screens.cluster], false);
        if (hits.length) {
          this.ui.toast('仪表与中控屏为程序化 Canvas 补建，非原厂内饰网格');
          return;
        }
      }
      if (this.rig.isCockpit) return;
      const hit = this.rig.raycast(this.car, e.clientX, e.clientY);
      if (!hit) {
        this.clearPart();
        return;
      }
      const partId = hit.object.userData.part;
      if (partId) this.focusPart(partId);
    });
    canvas.addEventListener('dblclick', (e) => {
      // 双击会先触发两次 click，这里只做「推进到点击点」的二次动作
      if (this.rig.isCockpit) return;
      const hit = this.rig.raycast(this.car, e.clientX, e.clientY);
      if (!hit) return;
      const partId = hit.object.userData.part;
      if (!partId) return;
      const point = hit.point;
      const dir = this.showroom.camera.position.clone().sub(point).normalize();
      const dist = Math.max(1.8, Math.min(3.4, this.car.length * 0.42));
      this.rig.tweenTo(point.clone().add(dir.multiplyScalar(dist)), point.clone(), 760);
      this.ui.setPart(partId);
      this.ui.toast('重点观察模式 · 再次双击另一处或按 Esc 退出');
    });
  }

  hoverAt(x, y) {
    if (!this.car || this.rig.isCockpit) return;
    const hit = this.rig.raycast(this.car, x, y);
    const label = document.getElementById('partLabel');
    const partId = hit?.object?.userData?.part || null;
    if (partId) {
      const part = this.car.partInfo(partId);
      this.car.clearHighlight();
      this.car.highlight(partId, true);
      if (label) {
        label.textContent = part ? part.cn : partId;
        label.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
        label.classList.add('is-on');
      }
      this.showroom.canvas.style.cursor = 'pointer';
    } else {
      this.car.clearHighlight();
      label?.classList.remove('is-on');
      this.showroom.canvas.style.cursor = 'grab';
    }
  }

  bindResize() {
    let raf = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        this.resize();
        this.ui?.sync();
      });
    });
  }

  resize() {
    const w = document.getElementById('view').clientWidth || innerWidth;
    const h = document.getElementById('view').clientHeight || innerHeight;
    this.showroom.resize(w, h);
    this.width = w;
    this.height = h;
    this.rig?.refit();
  }

  // ---------- 渲染循环 ----------

  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.state.dynamics) {
      this.car.spinWheels(dt, 0.5);
      // 车身极轻微的姿态浮动，避免像静帧
      this.car.group.position.y = Math.sin(t * 1.1) * 0.004;
      this.car.group.rotation.y = Math.sin(t * 0.42) * 0.012;
    }
    // 方向盘随视角轻微联动
    if (this.car.steeringGroup) {
      const az = Math.atan2(this.showroom.camera.position.x, this.showroom.camera.position.z);
      const target = clamp(az * 0.16, -0.3, 0.3);
      this.car.turnSteeringAngle = damp(this.car.turnSteeringAngle || 0, target, 3.2, dt);
      this.car.turnSteering(this.car.turnSteeringAngle);
    }

    this.lights.update(dt);
    this.audio.update(dt);
    this.rig.update(dt);
    this.showroom.render(dt);

    this._frames++;
    const now = performance.now();
    if (now - this._fpsT >= 500) {
      this.fps = Math.round((this._frames * 1000) / (now - this._fpsT));
      this._frames = 0;
      this._fpsT = now;
      const fpsEl = document.getElementById('fps');
      if (fpsEl) fpsEl.textContent = `${this.fps} FPS`;
    }
    requestAnimationFrame(this.loop);
  }

  // ---------- QA 接口 ----------

  debug() {
    const info = this.showroom.stats;
    return {
      ready: !!window.SUPERCAR_READY,
      quality: this.qualityId,
      fps: this.fps,
      drawCalls: info.calls,
      triangles: info.triangles,
      scene: this.state.scene,
      view: this.state.view,
      cockpit: this.rig.isCockpit,
      camera: this.rig.snapshot(),
      carSize: this.car.size.toArray().map((n) => +n.toFixed(3)),
      parts: [...this.car.partsInfo.keys()],
      materials: this.car.roles.paint ? this.car.roles.paint.color.getHexString() : null,
      wheelAngle: this.car.wheelAngle || 0
    };
  }
}

const app = new App();
window.SC_APP = app;

app
  .boot()
  .catch((err) => {
    console.error(err);
    const boot = document.getElementById('boot');
    if (boot) {
      boot.classList.add('is-error');
      const t = document.getElementById('bootText');
      if (t) t.textContent = '启动失败：' + (err?.message || err);
    }
  });

export default app;
