/* ===== src/js/lab.js ===== */
/* ===== 执行实验室：页面装配（场景 / 3D / 控制台 / 面板） ===== */
(function () {
  'use strict';

  const { $, $$, esc, icon, store, toast } = window.UI;
  const D = window.LAB_DATA;
  const L = D.executionLab;
  const STATIONS = L.stations;
  const SMAP = new Map(STATIONS.map(s => [s.id, s]));
  const SCENARIOS = L.scenarios;
  const SCENARIO_ALIAS = {
    request: 'ask', agent: 'loop', events: 'loop', tools: 'coding', tool: 'coding',
    session: 'ask', context: 'loop', 'file-ops': 'file-read', file: 'file-read',
  };
  const meta = { id: 'execution-lab', label: 'Agent 动态执行', hint: '3D Agent Execution Lab', lab: true };

  function findScenario(id) {
    const key = SCENARIO_ALIAS[id] || id;
    return SCENARIOS.find(s => s.id === key) || SCENARIOS[0];
  }

  function mount(root, params) {
    const scenario = findScenario(params.scenario || params.s || 'ask');
    const state = {
      tab: 'overview',
      viewStationId: null,
      viewBeatIndex: -1,
      expanded: false,
      follow: true,
    };

    root.innerHTML = `
      <div class="lab" id="lab">
        <header class="lab-top">
          <div class="lab-brand">
            <div class="lab-brand__mark">◈</div>
            <div class="lab-brand__text">
              <div class="lab-brand__t">DeepSeek Agent Execution Lab</div>
              <div class="lab-brand__s">3D AGENT EXECUTION · 教学模拟</div>
            </div>
          </div>
          <span class="lab-badge lab-badge--sim" title="流程、模块、事件与源码位置来自真实源码；数值与模型回复为教学模拟">SIMULATED / 教学模拟</span>
          <span class="lab-badge lab-badge--real" title="${esc(L.meta.realTrace.text)}">真实追踪未接入</span>
          <div class="lab-top__grow"></div>
          <label class="lab-pick"><span>场景</span>
            <select id="labScenario" aria-label="选择执行场景">
              ${SCENARIOS.map(s => `<option value="${esc(s.id)}" ${s.id === scenario.id ? 'selected' : ''}>${esc(s.title)} · ${esc(s.tag)}</option>`).join('')}
            </select>
          </label>
          <button class="lab-topbtn" id="labFull" title="全屏 / 剧场模式">${icon('expand', 13)} 全屏</button>
          <button class="lab-topbtn lab-topbtn--back" id="labBack">${icon('back', 13)} 返回源码知识库</button>
        </header>

        <div class="lab-body">
          <section class="lab-stage" id="labStage" aria-label="3D Agent 执行场景">
            <canvas id="labCanvas" tabindex="0" aria-label="可拖动旋转的三维执行流水线"></canvas>
            <div class="lab-tags" id="labTags"></div>
            <div class="lab-hud">
              <div class="lab-hud__k">NOW EXECUTING</div>
              <div class="lab-hud__t" id="hudTitle">${esc(scenario.title)}</div>
              <div class="lab-hud__m"><span id="hudCycle">待开始</span><i></i><span id="hudCount">0 / ${scenario.beats.length}</span></div>
              <div class="lab-hud__support" id="hudSupport"></div>
            </div>
            <div class="lab-view">
              <button class="lab-viewbtn is-on" data-lab-view="follow" aria-pressed="true">${icon('route', 11)} 跟随</button>
              <button class="lab-viewbtn" data-lab-view="reset">${icon('fit', 11)} 重置视角</button>
            </div>
            <div class="lab-legend" aria-hidden="true">
              <span><i class="lg lg--idle"></i>待命</span>
              <span><i class="lg lg--live"></i>执行中</span>
              <span><i class="lg lg--done"></i>完成</span>
              <span><i class="lg lg--approval"></i>审批</span>
              <span><i class="lg lg--error"></i>异常</span>
              <span><i class="lg lg--branch"></i>分支</span>
            </div>
            <div class="lab-caption" id="labCaption" aria-live="polite"><b>准备</b><span>拖动旋转视角，滚轮缩放，点击站台看详情</span></div>
          </section>

          <aside class="lab-side" id="labSide" aria-label="站台详情">
            <div id="labPanel" class="lab-panel"></div>
          </aside>
        </div>

        <footer class="lab-deck">
          <div class="lab-deck__input">
            <div class="lab-task">
              <span class="lab-task__k">任务</span>
              <textarea id="labTask" rows="1" placeholder="输入任意自然语言任务…">${esc(scenario.example)}</textarea>
              <button class="lab-ghost" id="labExample" title="填入当前场景的示例">示例</button>
              <button class="lab-run" id="labRun">${icon('play', 12)} 开始执行</button>
            </div>
            <div class="lab-scenes" id="labScenes" role="tablist" aria-label="预设场景">
              ${SCENARIOS.map(s => `<button class="lab-scene ${s.id === scenario.id ? 'is-active' : ''}" data-scenario="${esc(s.id)}" title="${esc(s.example)}">
                <span class="lab-scene__tag">${esc(s.tag)}</span><span class="lab-scene__t">${esc(s.title)}</span>
              </button>`).join('')}
            </div>
          </div>
          <div class="lab-deck__control">
            <div class="lab-transport">
              <button class="lab-ctl" data-ctl="prev" title="上一步（←）">${icon('prev', 13)}</button>
              <button class="lab-ctl lab-ctl--play" data-ctl="play" title="播放 / 暂停（空格）" aria-label="播放或暂停">${icon('play', 13)}</button>
              <button class="lab-ctl" data-ctl="next" title="下一步（→）">${icon('next', 13)}</button>
              <button class="lab-ctl" data-ctl="reset" title="重置（R）">${icon('reset', 13)}</button>
              <label class="lab-speed"><span>速度</span>
                <select id="labSpeed" aria-label="播放速度">
                  ${[0.5, 1, 1.5, 2, 3, 4].map(v => `<option value="${v}" ${v === 1 ? 'selected' : ''}>${v}×</option>`).join('')}
                </select>
              </label>
              <span class="lab-step" id="labStep">0 / ${scenario.beats.length}</span>
            </div>
            <div class="lab-progress" id="labProgress" aria-label="执行进度"></div>
          </div>
        </footer>
      </div>`;

    const lab = root.querySelector('#lab');
    const stage = root.querySelector('#labStage');
    const taskEl = root.querySelector('#labTask');
    const panelHost = root.querySelector('#labPanel');
    const progressHost = root.querySelector('#labProgress');
    const playBtn = root.querySelector('[data-ctl="play"]');
    const runBtn = root.querySelector('#labRun');

    const engine = new window.LabEngine(L);
    engine.load(scenario.id, scenario.example);

    const scene = new window.LabScene(root.querySelector('#labCanvas'), root.querySelector('#labTags'), {
      stations: STATIONS,
      onSelect: (id) => selectStation(id),
      onHover: (type, value) => { if (type === 'follow') setFollowButton(value); },
    });
    scene.setScenario(scenario);
    scene.setState(engine.state());

    window.App.addCleanup(() => {
      if (window.__lab && window.__lab.engine === engine) window.__lab = null;
      engine.destroy();
      scene.destroy();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    });

    /* ---------- 状态与控制 ---------- */
    function currentStation() {
      const beat = engine.current();
      if (beat && state.viewStationId === beat.s) return SMAP.get(beat.s);
      return SMAP.get(state.viewStationId) || (beat ? SMAP.get(beat.s) : SMAP.get(engine.beats()[0].s));
    }

    function syncControls() {
      const st = engine.state();
      const pos = st.index >= 0 ? st.index + 1 : 0;
      root.querySelector('#hudTitle').textContent = st.scenario.title;
      const support = st.scenario.support + (st.scenario.supportNote ? ' · ' + st.scenario.supportNote : '');
      const supportEl = root.querySelector('#hudSupport');
      if (supportEl.textContent !== support) supportEl.textContent = support;
      supportEl.title = support;
      root.querySelector('#hudCycle').textContent = st.cycle || (st.status === 'done' ? '已完成' : st.index >= 0 ? `第 ${st.index + 1} 步` : '待开始');
      root.querySelector('#hudCount').textContent = `${pos} / ${st.total}`;
      root.querySelector('#labStep').textContent = `${pos} / ${st.total}`;
      const iconEl = playBtn;
      iconEl.innerHTML = st.status === 'playing' ? icon('pause', 13) : icon('play', 13);
      iconEl.classList.toggle('is-playing', st.status === 'playing');
      runBtn.classList.toggle('is-playing', st.status === 'playing');
      runBtn.innerHTML = st.status === 'playing' ? `${icon('pause', 12)} 暂停` : `${icon('play', 12)} 开始执行`;

      const beat = st.beat;
      const cap = root.querySelector('#labCaption');
      if (beat) {
        const station = SMAP.get(beat.s);
        cap.innerHTML = `<b>${esc(station.no)} · ${esc(station.name)}</b><span>${esc(engine.textFor(beat).title)}</span>`;
      } else {
        cap.innerHTML = `<b>准备</b><span>选择场景，点击开始执行</span>`;
      }

      $$('[data-seg]', progressHost).forEach((el, i) => {
        el.classList.toggle('is-done', i < st.index);
        el.classList.toggle('is-active', i === st.index);
        const b = st.scenario.beats[i];
        el.classList.toggle('is-error', b && b.status === 'error');
        el.classList.toggle('is-approval', b && b.status === 'approval');
      });

      root.querySelector('#labScenes').querySelectorAll('[data-scenario]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.scenario === st.scenario.id);
      });
      const sel = root.querySelector('#labScenario');
      if (sel.value !== st.scenario.id) sel.value = st.scenario.id;
    }

    function renderProgress() {
      const beats = engine.beats();
      progressHost.innerHTML = beats.map((b, i) => {
        const s = SMAP.get(b.s);
        return `<button class="lab-seg ${b.status === 'error' ? 'is-error' : ''} ${b.status === 'approval' ? 'is-approval' : ''}" data-seg="${i}" title="${esc(`${i + 1}. ${s.no} ${s.name} — ${b.t}`)}" aria-label="跳到第 ${i + 1} 步：${esc(b.t)}"></button>`;
      }).join('');
      progressHost.querySelectorAll('[data-seg]').forEach(btn => btn.addEventListener('click', () => {
        engine.pause();
        state.viewStationId = null;
        state.viewBeatIndex = Number(btn.dataset.seg);
        engine.go(state.viewBeatIndex);
        scene.setSelected(null);
      }));
    }

    function renderPanel() {
      const station = currentStation();
      const beat = state.viewBeatIndex >= 0 ? engine.beats()[state.viewBeatIndex] : null;
      const data = beat ? engine.dataFor(beat) : engine.resolve(station.sample);
      const text = beat ? engine.textFor(beat) : {
        title: station.summary,
        detail: station.what,
        input: station.input,
        output: station.output,
      };
      window.LabPanel.render(panelHost, {
        station,
        beat,
        beatIndex: state.viewBeatIndex,
        scenario: engine.scenario,
        state: engine.state(),
        task: engine.task,
        tab: state.tab,
        data,
        text,
        onTab: (tab) => { state.tab = tab; renderPanel(); },
        onSelect: (id) => selectStation(id),
        go: (page, p) => window.App.go(page, p),
        source: (file, line) => openSource(file, line),
      });
    }

    function selectStation(id) {
      const beats = engine.beats();
      const idx = engine.index;
      let found = -1;
      for (let i = 0; i < beats.length; i++) {
        if (beats[i].s === id) { found = i; if (i >= idx) break; }
      }
      state.viewStationId = id;
      state.viewBeatIndex = found;
      state.tab = 'overview';
      scene.setSelected(id);
      renderPanel();
      scene.selectStation(id);
    }

    function openSource(file, line) {
      const beats = engine.beats();
      const current = beats[state.viewBeatIndex];
      const station = current ? SMAP.get(current.s) : null;
      if (station && station.source.file === file) {
        state.tab = 'source';
        renderPanel();
        return;
      }
      window.App.openFile(file, line);
    }

    function loadScenario(id, task) {
      const sc = findScenario(id);
      const next = task == null ? sc.example : task;
      engine.load(sc.id, next);
      scene.setScenario(sc);
      scene.setState(engine.state());
      scene.setSelected(null);
      state.viewStationId = null;
      state.viewBeatIndex = -1;
      state.tab = 'overview';
      taskEl.value = next;
      renderProgress();
      renderPanel();
      syncControls();
      scene.setFollow(state.follow);
    }

    function startRun() {
      const text = taskEl.value.trim() || engine.scenario.example;
      if (engine.scenario.id !== root.querySelector('#labScenario').value) {
        loadScenario(root.querySelector('#labScenario').value, text);
      } else {
        engine.load(engine.scenario.id, text);
        scene.setScenario(engine.scenario);
        renderProgress();
      }
      engine.start();
      renderPanel();
      syncControls();
    }

    /* ---------- 事件 ---------- */
    engine.on('load', () => { renderProgress(); syncControls(); });
    engine.on('beat', ({ beat, index, state: st }) => {
      state.viewStationId = beat.s;
      state.viewBeatIndex = index;
      scene.setSelected(beat.s);
      scene.setState(st, true);
      renderPanel();
      syncControls();
    });
    engine.on('state', (st) => {
      scene.setState(st);
      syncControls();
      if (st.index < 0 && state.viewBeatIndex < 0) renderPanel();
    });

    root.querySelector('#labRun').addEventListener('click', () => {
      if (engine.status === 'playing') { engine.pause(); return; }
      startRun();
    });
    root.querySelector('[data-ctl="prev"]').addEventListener('click', () => { engine.prev(); scene.setSelected(null); });
    root.querySelector('[data-ctl="next"]').addEventListener('click', () => { engine.next(); scene.setSelected(null); });
    root.querySelector('[data-ctl="reset"]').addEventListener('click', () => {
      engine.reset();
      state.viewStationId = null;
      state.viewBeatIndex = -1;
      scene.setSelected(null);
      renderPanel();
    });
    playBtn.addEventListener('click', () => {
      if (engine.status === 'idle' || engine.status === 'done') startRun();
      else engine.toggle();
    });
    root.querySelector('#labExample').addEventListener('click', () => { taskEl.value = engine.scenario.example; });
    root.querySelector('#labScenario').addEventListener('change', (e) => loadScenario(e.target.value));
    root.querySelector('#labSpeed').addEventListener('change', (e) => engine.setSpeed(e.target.value));
    root.querySelectorAll('[data-scenario]').forEach(btn => btn.addEventListener('click', () => loadScenario(btn.dataset.scenario)));
    root.querySelectorAll('[data-lab-view]').forEach(btn => btn.addEventListener('click', () => {
      if (btn.dataset.labView === 'follow') {
        state.follow = !state.follow;
        setFollowButton(state.follow);
        scene.setFollow(state.follow);
      } else {
        scene.resetView();
        state.follow = true;
        setFollowButton(true);
      }
    }));

    function setFollowButton(on) {
      state.follow = Boolean(on);
      const btn = root.querySelector('[data-lab-view="follow"]');
      if (btn) {
        btn.classList.toggle('is-on', state.follow);
        btn.setAttribute('aria-pressed', String(state.follow));
      }
    }

    function toggleFull() {
      state.expanded = !state.expanded;
      lab.classList.toggle('is-expanded', state.expanded);
      if (state.expanded && lab.requestFullscreen) {
        lab.requestFullscreen().catch(() => { lab.classList.add('is-expanded'); });
      } else if (!state.expanded && document.fullscreenElement) {
        document.exitFullscreen().catch(() => { lab.classList.remove('is-expanded'); });
      }
      setTimeout(() => scene.resize(), 80);
    }

    function onFullscreen() {
      if (!document.fullscreenElement && state.expanded) {
        state.expanded = false;
        lab.classList.remove('is-expanded');
        setTimeout(() => scene.resize(), 80);
      }
    }

    function onKey(e) {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      if (e.key === ' ') {
        if (tag === 'button') return;
        e.preventDefault();
        if (engine.status === 'idle' || engine.status === 'done') startRun();
        else engine.toggle();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        engine.next();
        scene.setSelected(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        engine.prev();
        scene.setSelected(null);
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        engine.reset();
        state.viewStationId = null;
        state.viewBeatIndex = -1;
        renderPanel();
      } else if (e.key === 'Escape' && state.expanded) {
        state.expanded = false;
        lab.classList.remove('is-expanded');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { lab.classList.remove('is-expanded'); });
        setTimeout(() => scene.resize(), 80);
      }
    }

    root.querySelector('#labFull').addEventListener('click', toggleFull);
    root.querySelector('#labBack').addEventListener('click', () => window.App.go('home'));
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);

    // 初始视图
    renderProgress();
    renderPanel();
    syncControls();
    scene.setFollow(true);
    if (params.task) taskEl.value = params.task;
    if (params.station && SMAP.has(params.station)) selectStation(params.station);

    window.__lab = {
      engine, scene, state,
      selectStation, loadScenario, startRun, renderPanel, syncControls,
      meta,
    };
  }

  window.LabPage = { meta, mount };
})();
