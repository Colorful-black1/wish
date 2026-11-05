// 车灯状态机：7 个开关 → 灯组 emissive + 双闪/转向节拍 + 两盏聚光灯。
import { LIGHTS } from './data.config.js';

const BLINK_PERIOD = 0.78;

export class LightState {
  constructor(car) {
    this.car = car;
    this.state = { drl: true, low: false, high: false, tail: false, brake: false, turn: false, hazard: false };
    this.phase = 0;
    this.dirty = true;
  }

  get active() {
    return Object.values(this.state).filter(Boolean).length;
  }

  set(id, on) {
    if (!(id in this.state)) return;
    if (this.state[id] === on) return;
    this.state[id] = on;
    if (id === 'high' && on) this.state.low = true;
    if (id === 'low' && !on) this.state.high = false;
    if (id === 'hazard' && on) this.state.turn = false;
    this.dirty = true;
    this.apply();
  }

  toggle(id) {
    this.set(id, !this.state[id]);
    return this.state[id];
  }

  all(on) {
    for (const l of LIGHTS) this.state[l.id] = on;
    this.dirty = true;
    this.apply();
  }

  apply() {
    this.car.setLightState(this.state);
  }

  update(dt) {
    this.phase = (this.phase + dt / BLINK_PERIOD) % 1;
    if (this.dirty) {
      this.apply();
      this.dirty = false;
    }
    if (this.state.turn || this.state.hazard) this.car.setBlink(this.phase, this.state);
  }

  serialize() {
    return { ...this.state };
  }

  restore(obj) {
    if (!obj) return;
    for (const k of Object.keys(this.state)) if (k in obj) this.state[k] = !!obj[k];
    this.dirty = true;
    this.apply();
  }
}
