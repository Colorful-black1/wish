// 程序化引擎声：WebAudio 现场合成，不用任何音频文件（零外部素材、不吃体积）。
// 默认静音，必须用户显式点击才会创建 AudioContext 并出声。
import { clamp } from './util.js';

const IDLE_RPM = 900;
const REDLINE_RPM = 9000;

export class EngineAudio {
  constructor() {
    this.ctx = null;
    this.running = false;
    this.muted = true;
    this.rpm = 0;
    this.targetRpm = 0;
    this.nodes = null;
    this.lastFilter = 0;
  }

  get supported() {
    return typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined';
  }

  /** 必须在用户手势里调用。 */
  async ensureContext() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) throw new Error('WebAudio 不可用');
    this.ctx = new Ctor();
    await this.ctx.resume();
    return this.ctx;
  }

  /** 点火：底噪 + 三个谐波振荡器 + 低通。 */
  async start() {
    const ctx = await this.ensureContext();
    if (this.running) return;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 2.4;
    filter.connect(master);

    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 1.8);
    }
    shaper.curve = curve;
    shaper.connect(filter);

    const mk = (type, ratio, gain, detune = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = 60 * ratio;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(shaper);
      osc.start();
      return { osc, gain: g };
    };

    const oscs = [
      mk('sawtooth', 1, 0.5),
      mk('sawtooth', 2.02, 0.28, 6),
      mk('square', 0.5, 0.22, -4),
      mk('triangle', 4.01, 0.1, 3)
    ];

    // 进气噪声
    const noiseLen = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < noiseLen; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.35) * 0.82;
      data[i] = last;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.06;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 700;
    noiseFilter.Q.value = 0.9;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();

    this.nodes = { master, filter, oscs, noiseGain, noiseFilter, shaper };
    this.running = true;
    this.rpm = IDLE_RPM * 0.6;
    this.targetRpm = IDLE_RPM;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : 0.16, t + 0.45);
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.nodes) return;
    const t = this.ctx.currentTime;
    const target = muted ? 0.0001 : 0.16;
    this.nodes.master.gain.cancelScheduledValues(t);
    this.nodes.master.gain.setTargetAtTime(target, t, 0.08);
  }

  rev() {
    if (!this.running) return;
    this.targetRpm = REDLINE_RPM * 0.86;
    clearTimeout(this._revTimer);
    this._revTimer = setTimeout(() => {
      this.targetRpm = IDLE_RPM;
    }, 900);
  }

  stop() {
    if (!this.nodes) return;
    const t = this.ctx.currentTime;
    this.nodes.master.gain.cancelScheduledValues(t);
    this.nodes.master.gain.setTargetAtTime(0.0001, t, 0.12);
    this.targetRpm = 0;
    setTimeout(() => this.dispose(), 500);
  }

  dispose() {
    if (!this.nodes) return;
    for (const { osc } of this.nodes.oscs) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.nodes.master.disconnect();
    this.nodes = null;
    this.running = false;
  }

  /** 每帧：按转速更新频率与滤波，形成「轰油门」的听感。 */
  update(dt) {
    if (!this.running || !this.nodes) return;
    this.rpm += (this.targetRpm - this.rpm) * clamp(dt * 3.4, 0, 1);
    const f = (this.rpm / 60) * 4; // V8 四冲程点火频率
    const t = this.ctx.currentTime;
    // 谐波比例固定，基频统一更新
    const ratios = [1, 2.02, 0.5, 4.01];
    const gains = [1, 0.6, 0.45, 0.2];
    const load = clamp(this.rpm / REDLINE_RPM, 0, 1);
    this.nodes.oscs.forEach(({ osc, gain }, i) => {
      osc.frequency.setTargetAtTime(Math.max(8, f * ratios[i]), t, 0.04);
      gain.gain.setTargetAtTime((0.32 + load * 0.4) * gains[i], t, 0.06);
    });
    const cutoff = 260 + load * 2600;
    this.nodes.filter.frequency.setTargetAtTime(cutoff, t, 0.08);
    this.nodes.noiseFilter.frequency.setTargetAtTime(500 + cutoff * 0.5, t, 0.1);
    this.nodes.noiseGain.gain.setTargetAtTime(0.03 + load * 0.12, t, 0.1);
  }
}
