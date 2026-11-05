// 相机：轨道环绕、7 个预设位、材质组聚焦、驾驶舱第一人称。
// 所有位移都走缓动，禁止瞬移（验收要求「相邻帧位移不跳变」）。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VIEWS } from './data.config.js';
import { clamp, easeInOutCubic, damp } from './util.js';

export class CameraRig {
  constructor({ camera, domElement }) {
    this.camera = camera;
    this.dom = domElement;
    this.mode = 'exterior';
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.rotateSpeed = 0.52;
    this.controls.zoomSpeed = 0.62;
    this.controls.panSpeed = 0.5;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.4;
    this.controls.maxDistance = 15;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = 1.5;
    this.controls.target.set(0, 0.62, 0);
    this.controls.update();

    this.tween = null;
    this.cockpit = { eye: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 65, drag: null };
    this._prev = { pos: camera.position.clone(), target: this.controls.target.clone(), fov: camera.fov };
    this.viewId = 'front45';
  }

  get isCockpit() {
    return this.mode === 'cockpit';
  }

  get isMoving() {
    return !!this.tween;
  }

  /** 竖屏时水平视角很窄，需要按包围球把相机往后拉，否则车会被裁掉。 */
  minDistanceFor(radius) {
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    return radius / Math.sin(Math.min(vfov, hfov) / 2);
  }

  /** 把预设机位按包围球半径拉伸到合适距离。 */
  fitPosition(pos, target, radius = 2.95) {
    const offset = pos.clone().sub(target);
    const need = this.minDistanceFor(radius) * 1.02;
    if (offset.length() < need) offset.setLength(need);
    return target.clone().add(offset);
  }

  /** 预设视角；instant=true 时直接落位（仅初始化用）。 */
  setView(id, { instant = false } = {}) {
    const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
    if (view.cockpit) return this.enterCockpit();
    this.exitCockpit({ silent: true, instant: true });
    this.viewId = id;
    const target = new THREE.Vector3(...view.target);
    const pos = this.fitPosition(new THREE.Vector3(...view.pos), target);
    if (instant) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.camera.lookAt(target);
      this.controls.update();
      this.tween = null;
      return;
    }
    this.tweenTo(pos, target, 880);
  }

  /** 视口尺寸变化后重新适配当前机位（仅在明显变远时补一次缓动）。 */
  refit() {
    if (this.mode === 'cockpit' || this.tween) return;
    const view = VIEWS.find((v) => v.id === this.viewId);
    if (!view || view.cockpit) return;
    const target = new THREE.Vector3(...view.target);
    const want = this.fitPosition(new THREE.Vector3(...view.pos), target);
    if (want.distanceTo(this.camera.position) > 0.6) this.tweenTo(want, target, 700);
  }

  /** 聚焦到某个材质组的包围球。 */
  focusPart(part, { distanceScale = 1, direction = null } = {}) {
    if (!part) return;
    this.exitCockpit({ silent: true, instant: true });
    const center = part.center.clone();
    const dir = direction
      ? new THREE.Vector3(...direction).normalize()
      : this.camera.position.clone().sub(center).normalize();
    if (dir.lengthSq() < 1e-4) dir.set(-0.6, 0.35, -0.7).normalize();
    const dist = clamp(Math.max(part.radius * 2.5 * distanceScale + 0.8, this.minDistanceFor(part.radius * 1.5)), 2.2, 14);
    const pos = center.clone().add(dir.multiplyScalar(dist));
    pos.y = Math.max(pos.y, 0.35);
    this.tweenTo(pos, center, 820);
  }

  reset() {
    this.setView('front45');
  }

  tweenTo(pos, target, duration = 900, done) {
    this.mode = 'exterior';
    this.controls.enabled = false;
    // 位移越大给越多时间，避免长距离切机位看起来像瞬移
    const travel = pos.distanceTo(this.camera.position);
    const scaled = duration * clamp(travel / 8, 0.85, 1.75);
    this.tween = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: pos.clone(),
      t1: target.clone(),
      f0: this.camera.fov,
      f1: 38,
      t: 0,
      duration: scaled,
      done
    };
  }

  /** 驾驶舱：先飞到位，再交给第一人称拖拽。 */
  enterCockpit(anchor) {
    if (this.mode === 'cockpit') return;
    this._prev = { pos: this.camera.position.clone(), target: this.controls.target.clone(), fov: this.camera.fov };
    this._returnView = this.viewId && this.viewId !== 'interior' ? this.viewId : 'front45';
    this.mode = 'cockpit';
    this.controls.enabled = false;
    this.viewId = 'interior';
    const eye = anchor ? anchor.eye.clone() : new THREE.Vector3(-0.35, 1.1, 0.2);
    const look = anchor ? anchor.look.clone() : new THREE.Vector3(-0.3, 1.0, -3);
    this.cockpit.eye.copy(eye);
    this.cockpit.look.copy(look);
    this.cockpit.yaw = 0;
    this.cockpit.pitch = 0;
    this.cockpit.fov = 65;
    this.cockpit.drag = null;

    // 从车外飞进驾驶舱：中途略微抬高，避免穿过钣金
    const mid = this.camera.position.clone().lerp(eye, 0.55);
    mid.y = Math.max(mid.y, eye.y + 0.35);
    this.tween = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: eye.clone(),
      t1: look.clone(),
      f0: this.camera.fov,
      f1: 65,
      t: 0,
      duration: 1150,
      bezier: mid,
      done: () => {
        this.controls.enabled = false;
        this.camera.fov = 65;
        this.camera.updateProjectionMatrix();
      }
    };
  }

  exitCockpit({ silent = false, instant = false } = {}) {
    if (this.mode !== 'cockpit') return;
    this.mode = 'exterior';
    this.cockpit.drag = null;
    this.controls.enabled = true;
    this.viewId = this._returnView || 'front45';
    this.camera.fov = 38;
    this.camera.updateProjectionMatrix();
    const view = VIEWS.find((v) => v.id === this.viewId && !v.cockpit) || VIEWS[0];
    const target = new THREE.Vector3(...view.target);
    const pos = this.fitPosition(new THREE.Vector3(...view.pos), target);
    if (instant || silent) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      this.tween = null;
      return;
    }
    this.controls.enabled = false;
    this.tween = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: pos,
      t1: target,
      f0: this.camera.fov,
      f1: 38,
      t: 0,
      duration: 950,
      done: () => {
        this.controls.enabled = true;
        this.controls.update();
      }
    };
  }

  /** 驾驶舱内的拖动环视。 */
  bindCockpitDrag() {
    const onDown = (e) => {
      if (this.mode !== 'cockpit') return;
      this.cockpit.drag = { x: e.clientX, y: e.clientY, yaw: this.cockpit.yaw, pitch: this.cockpit.pitch };
      this.dom.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      const d = this.cockpit.drag;
      if (!d || this.mode !== 'cockpit') return;
      this.cockpit.yaw = clamp(d.yaw - (e.clientX - d.x) * 0.0035, -1.25, 1.25);
      this.cockpit.pitch = clamp(d.pitch - (e.clientY - d.y) * 0.0028, -0.6, 0.5);
    };
    const onUp = () => {
      this.cockpit.drag = null;
    };
    const onWheel = (e) => {
      if (this.mode !== 'cockpit') return;
      e.preventDefault();
      this.cockpit.fov = clamp(this.cockpit.fov + Math.sign(e.deltaY) * 3.2, 44, 80);
    };
    this.dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    this.dom.addEventListener('wheel', onWheel, { passive: false });
  }

  /** 屏幕坐标 → 射线；返回第一个命中的可拾取网格。 */
  raycast(car, clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(car.meshes, false);
    for (const hit of hits) {
      if (hit.object.userData.part) return hit;
    }
    return hits[0] || null;
  }

  update(dt) {
    if (this.tween) {
      const tw = this.tween;
      tw.t += dt * 1000;
      const k = clamp(tw.t / tw.duration, 0, 1);
      const e = easeInOutCubic(k);
      if (tw.bezier) {
        // 二次贝塞尔：起点 → 中途抬升点 → 终点
        const a = tw.p0;
        const b = tw.bezier;
        const c = tw.p1;
        const u = 1 - e;
        this.camera.position.set(
          u * u * a.x + 2 * u * e * b.x + e * e * c.x,
          u * u * a.y + 2 * u * e * b.y + e * e * c.y,
          u * u * a.z + 2 * u * e * b.z + e * e * c.z
        );
      } else {
        this.camera.position.lerpVectors(tw.p0, tw.p1, e);
      }
      const target = tw.t0.clone().lerp(tw.t1, e);
      this.camera.fov = tw.f0 + (tw.f1 - tw.f0) * e;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(target);
      if (this.mode !== 'cockpit') this.controls.target.copy(target);
      if (k >= 1) {
        this.tween = null;
        // 缓动结束后必须把控制器交还给用户，否则下一次拖动会「拖不动」
        if (this.mode === 'exterior') {
          this.controls.target.copy(tw.t1);
          this.controls.enabled = true;
          this.controls.update();
          this.camera.position.copy(tw.p1);
          this.camera.lookAt(this.controls.target);
        }
        tw.done?.();
      }
      return;
    }

    if (this.mode === 'cockpit') {
      const { eye, look, yaw, pitch } = this.cockpit;
      const dir = look.clone().sub(eye).normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      const rotated = dir
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
        .applyAxisAngle(right, pitch);
      const target = eye.clone().add(rotated.multiplyScalar(6)).add(up.clone().multiplyScalar(-0.25));
      this.camera.position.copy(eye);
      this.camera.lookAt(target);
      if (Math.abs(this.camera.fov - this.cockpit.fov) > 0.01) {
        this.camera.fov = damp(this.camera.fov, this.cockpit.fov, 8, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    this.controls.update();
  }

  /** QA 用：当前相机状态快照。 */
  snapshot() {
    return {
      mode: this.mode,
      view: this.viewId,
      pos: this.camera.position.toArray().map((n) => +n.toFixed(4)),
      target: this.controls.target.toArray().map((n) => +n.toFixed(4)),
      fov: +this.camera.fov.toFixed(2),
      moving: this.isMoving
    };
  }
}
