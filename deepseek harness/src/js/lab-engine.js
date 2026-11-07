/* ===== 执行实验室：播放引擎（场景 → 步骤 → 状态） ===== */
(function () {
  'use strict';

  const DEFAULT_MS = 1900;

  function deepText(value, task) {
    if (typeof value === 'string') return value.split('{{task}}').join(task || '');
    if (Array.isArray(value)) return value.map(v => deepText(v, task));
    if (value && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) out[k] = deepText(v, task);
      return out;
    }
    return value;
  }

  class LabEngine {
    constructor(data) {
      this.data = data;
      this.stations = new Map(data.stations.map(s => [s.id, s]));
      this.scenario = null;
      this.index = -1;
      this.status = 'idle'; // idle | playing | paused | done
      this.task = '';
      this.speed = 1;
      this._timer = 0;
      this._handlers = new Map();
    }

    on(type, fn) {
      if (!this._handlers.has(type)) this._handlers.set(type, new Set());
      this._handlers.get(type).add(fn);
      return () => this._handlers.get(type).delete(fn);
    }

    emit(type, payload) {
      const set = this._handlers.get(type);
      if (set) set.forEach(fn => { try { fn(payload); } catch (error) { console.error(error); } });
    }

    load(id, task) {
      const scenario = this.data.scenarios.find(s => s.id === id) || this.data.scenarios[0];
      this.clearTimer();
      this.scenario = scenario;
      this.index = -1;
      this.status = 'idle';
      this.task = task || scenario.example;
      this.emit('load', { scenario });
      this.emit('state', this.state());
      return scenario;
    }

    beats() { return this.scenario ? this.scenario.beats : []; }
    current() { return this.beats()[this.index] || null; }
    stationOf(beat) { return beat ? this.stations.get(beat.s) : null; }
    total() { return this.beats().length; }

    setTask(task) {
      this.task = task;
      this.emit('state', this.state());
    }

    setSpeed(speed) {
      const next = Number(speed) || 1;
      this.speed = Math.max(0.25, Math.min(4, next));
      this.emit('speed', this.speed);
      if (this.status === 'playing') this.schedule();
    }

    effectiveMs(beat) {
      const raw = Number(beat && beat.ms) || DEFAULT_MS;
      return Math.max(420, raw / this.speed);
    }

    start() {
      if (!this.scenario) return;
      this.clearTimer();
      this.index = -1;
      this.status = 'playing';
      this.go(0);
      this.schedule();
    }

    play() {
      if (!this.scenario) return;
      if (this.status === 'playing') return;
      if (this.status === 'done' || this.index < 0) { this.start(); return; }
      this.status = 'playing';
      this.schedule();
      this.emit('state', this.state());
    }

    pause() {
      if (this.status !== 'playing') return;
      this.clearTimer();
      this.status = 'paused';
      this.emit('state', this.state());
    }

    toggle() {
      if (this.status === 'playing') this.pause();
      else this.play();
    }

    reset() {
      this.clearTimer();
      this.index = -1;
      this.status = 'idle';
      this.emit('state', this.state());
    }

    next() {
      if (!this.scenario) return;
      this.clearTimer();
      if (this.index >= this.total() - 1) { this.status = 'done'; this.emit('state', this.state()); return; }
      this.status = 'paused';
      this.go(this.index + 1);
    }

    prev() {
      if (!this.scenario || this.index <= 0) return;
      this.clearTimer();
      this.status = 'paused';
      this.go(this.index - 1);
    }

    go(index) {
      const beats = this.beats();
      if (!beats.length) return;
      const next = Math.max(0, Math.min(beats.length - 1, index));
      this.index = next;
      this.emit('beat', { beat: beats[next], index: next, state: this.state() });
      this.emit('state', this.state());
    }

    schedule() {
      this.clearTimer();
      if (this.status !== 'playing') return;
      const beat = this.current();
      if (!beat) return;
      this._timer = setTimeout(() => {
        if (this.status !== 'playing') return;
        if (this.index >= this.total() - 1) {
          this.status = 'done';
          this.emit('state', this.state());
          return;
        }
        this.go(this.index + 1);
        this.schedule();
      }, this.effectiveMs(beat));
    }

    clearTimer() {
      if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
    }

    clearTimerOnly() { this.clearTimer(); }

    state() {
      const beats = this.beats();
      const index = this.index;
      const statuses = {};
      const completed = [];
      const trail = [];
      const seen = new Set();
      for (let i = 0; i <= index; i++) {
        const id = beats[i].s;
        if (i < index && id !== beats[index].s && !seen.has(id)) { seen.add(id); completed.push(id); }
        statuses[id] = i === index
          ? ({ error: 'error', approval: 'approval', branch: 'branch' }[beats[i].status] || 'active')
          : 'done';
      }
      if (index >= 0 && statuses[beats[index].s] === 'done') statuses[beats[index].s] = 'active';
      for (let i = 0; i < index; i++) {
        if (beats[i].s !== beats[i + 1].s) trail.push([beats[i].s, beats[i + 1].s]);
      }
      return {
        scenario: this.scenario,
        index,
        status: this.status,
        total: beats.length,
        beat: index >= 0 ? beats[index] : null,
        active: index >= 0 ? beats[index].s : null,
        statuses,
        completed,
        trail,
        cycle: index >= 0 ? (beats[index].cycle || '') : '',
        task: this.task,
        speed: this.speed,
      };
    }

    resolve(value) { return deepText(value, this.task); }

    dataFor(beat) {
      if (!beat) return null;
      return deepText(beat.data !== undefined ? beat.data : this.stationOf(beat).sample, this.task);
    }

    textFor(beat) {
      if (!beat) return { title: '', detail: '', input: '', output: '' };
      const station = this.stationOf(beat);
      const io = beat.io || [station.input, station.output];
      return {
        title: deepText(beat.t, this.task),
        detail: deepText(beat.d, this.task),
        input: deepText(io[0], this.task),
        output: deepText(io[1], this.task),
      };
    }

    destroy() {
      this.clearTimer();
      this._handlers.clear();
    }
  }

  window.LabEngine = LabEngine;
})();
