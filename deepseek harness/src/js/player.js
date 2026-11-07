/* ===== 流程图播放器：上一步 / 下一步 / 自动播放 / 速度 / 进度 ===== */
(function () {
  'use strict';
  const { esc, icon } = window.UI;

  class FlowPlayer {
    constructor(options) {
      this.steps = options.steps || [];
      this.graph = options.graph || null;
      this.mount = options.mount;
      this.render = options.render || (() => '');
      this.onStep = options.onStep || (() => {});
      this.index = -1;
      this.playing = false;
      this.speed = 1;
      this.timer = 0;
      this._build();
      if (this.steps.length) this.go(0);
    }

    _build() {
      const ticks = this.steps.map((s, i) => `<button class="flow__tick" data-goto="${i}" title="${esc(s.title)}" aria-label="第 ${i + 1} 步：${esc(s.title)}"></button>`).join('');
      this.mount.innerHTML = `
        <div class="flow__controls">
          <button class="btn btn--sm" data-prev title="上一步（←）">${icon('prev', 13)} 上一步</button>
          <button class="btn btn--sm btn--primary" data-play>${icon('play', 13)} 播放</button>
          <button class="btn btn--sm" data-next title="下一步（→）">下一步 ${icon('next', 13)}</button>
          <button class="btn btn--sm" data-restart title="重新播放">${icon('reset', 13)} 重播</button>
          <div class="flow__progress">${ticks}</div>
          <span class="flow__count" data-count>1 / ${this.steps.length}</span>
          <label class="speed">速度
            <select data-speed aria-label="播放速度">
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </label>
        </div>
        <div class="flow__detail" data-detail></div>`;
      this.mount.tabIndex = 0;
      this.mount.setAttribute('aria-label', '流程播放器：方向键切换步骤，空格播放或暂停');
      this.controls = this.mount.querySelector('.flow__controls');
      this.detail = this.mount.querySelector('[data-detail]');
      this.count = this.mount.querySelector('[data-count]');
      this.ticks = Array.from(this.mount.querySelectorAll('[data-goto]'));

      this.mount.querySelector('[data-prev]').addEventListener('click', () => { this.pause(); this.prev(); });
      this.mount.querySelector('[data-next]').addEventListener('click', () => { this.pause(); this.next(); });
      this.mount.querySelector('[data-play]').addEventListener('click', () => this.toggle());
      this.mount.querySelector('[data-restart]').addEventListener('click', () => { this.pause(); this.go(0); });
      this.mount.querySelector('[data-speed]').addEventListener('change', (e) => {
        this.speed = Number(e.target.value) || 1;
        if (this.playing) { this.pause(); this.play(); }
      });
      this.ticks.forEach((btn, i) => btn.addEventListener('click', () => { this.pause(); this.go(i); }));

      this.mount.addEventListener('keydown', (e) => {
        if (e.target.closest('select, input, textarea')) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.pause(); this.next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.pause(); this.prev(); }
        if (e.code === 'Space' && e.target === this.mount) { e.preventDefault(); this.toggle(); }
      });
    }

    go(index) {
      if (!this.steps.length) return;
      const i = Math.max(0, Math.min(this.steps.length - 1, index));
      this.index = i;
      const step = this.steps[i];
      this.detail.innerHTML = this.render(step, i);
      this.count.textContent = `${i + 1} / ${this.steps.length}`;
      this.ticks.forEach((t, ti) => {
        t.classList.toggle('is-done', ti < i);
        t.classList.toggle('is-active', ti === i);
      });
      if (this.graph && step.node) this.graph.setActive(step.node);
      if (typeof this.onStep === 'function') this.onStep(step, i);
      this.mount.querySelector('[data-prev]').disabled = i === 0;
      this.mount.querySelector('[data-next]').disabled = i === this.steps.length - 1;
      const playBtn = this.mount.querySelector('[data-play]');
      playBtn.innerHTML = this.playing ? `${icon('pause', 13)} 暂停` : `${icon('play', 13)} 播放`;
    }

    next() {
      if (this.index >= this.steps.length - 1) { this.pause(); return; }
      this.go(this.index + 1);
    }

    prev() { if (this.index > 0) this.go(this.index - 1); }

    play() {
      if (this.playing) return;
      if (this.index >= this.steps.length - 1) this.go(0);
      this.playing = true;
      const tick = () => {
        if (!this.playing) return;
        if (this.index >= this.steps.length - 1) { this.pause(); return; }
        this.go(this.index + 1);
        this.timer = setTimeout(tick, 1700 / this.speed);
      };
      this.timer = setTimeout(tick, 1700 / this.speed);
      const playBtn = this.mount.querySelector('[data-play]');
      playBtn.innerHTML = `${icon('pause', 13)} 暂停`;
    }

    pause() {
      this.playing = false;
      clearTimeout(this.timer);
      this.timer = 0;
      const playBtn = this.mount.querySelector('[data-play]');
      if (playBtn) playBtn.innerHTML = `${icon('play', 13)} 播放`;
    }

    toggle() { this.playing ? this.pause() : this.play(); }

    destroy() {
      this.pause();
      this.mount.innerHTML = '';
      if (this.graph) this.graph.setActive(null);
    }
  }

  window.FlowPlayer = FlowPlayer;
})();
