/* ===== 应用外壳：路由、导航、主题、全局搜索、检查器委派 ===== */
(function () {
  'use strict';
  const { $, $$, esc, icon, store, toast, copy, inspect, codeBlock, emptyInspector, debounce, ideHref } = window.UI;
  const D = window.LAB_DATA;
  const A = D.architecture;
  const NODES = new Map(A.nodes.map(n => [n.id, n]));
  const EX = D.generated.excerpts;

  const App = {
    graphs: [],
    cleanups: [],
    currentGraph: null,
    currentPage: 'home',
    params: {},
  };

  /* ---------- 主题 ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    const btn = $('#themeBtn');
    if (btn) btn.innerHTML = theme === 'light' ? icon('moon', 16) : icon('sun', 16);
    store.set('theme', theme);
  }

  function toggleTheme() {
    const now = document.documentElement.getAttribute('data-theme');
    applyTheme(now === 'light' ? 'dark' : 'light');
  }

  /* ---------- 路由 ---------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { page: 'home', params: {} };
    const [page, qs] = raw.split('?');
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => { params[k] = v; });
    const valid = window.Pages.RENDERERS[page] ? page : 'home';
    return { page: valid, params };
  }

  function go(page, params = {}) {
    const qs = new URLSearchParams(params).toString();
    location.hash = '#/' + page + (qs ? '?' + qs : '');
  }

  function route() {
    const { page, params } = parseHash();
    App.currentPage = page;
    App.params = params;
    App.graphs.forEach(g => g.destroy());
    App.graphs = [];
    App.cleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
    App.cleanups = [];
    App.currentGraph = null;
    window.UI.closeInspector();

    const root = $('#workspace');
    root.innerHTML = '';
    const isLab = page === 'execution-lab';
    document.querySelector('.app').classList.toggle('app--lab', isLab);
    // 先把本页计入访问，页面内部（如学习进度）读到的就是最新值
    markVisited(page);
    const renderer = window.Pages.RENDERERS[page] || window.Pages.RENDERERS.home;
    renderer(root, params);
    root.scrollTop = 0;

    $$('[data-page]').forEach(el => el.classList.toggle('is-active', el.dataset.page === page));
    const meta = window.Pages.META.find(p => p.id === page);
    $('#crumbNow').textContent = meta ? meta.label : page;
    document.title = `${meta ? meta.label : page} · DeepSeek Harness 架构实验室`;
    closeMobileNav();
    const inspector = $('#inspector');
    if (inspector && !inspector.innerHTML.trim()) inspector.innerHTML = emptyInspector();
  }

  function markVisited(page) {
    if (page === 'execution-lab') { updateNavProgress(); return; }
    const progress = store.get('progress', { visited: [], checks: {} });
    const visited = new Set(progress.visited || []);
    visited.add(page);
    progress.visited = [...visited];
    store.set('progress', progress);
    updateNavProgress();
  }

  function updateNavProgress() {
    const progress = store.get('progress', { visited: [] });
    const visited = new Set(progress.visited || []);
    const total = window.Pages.NAV_PAGES.length;
    const done = window.Pages.NAV_PAGES.filter(p => visited.has(p.id)).length;
    const pct = Math.round(done / total * 100);
    const bar = $('#navBar');
    if (bar) bar.style.width = pct + '%';
    const label = $('#navPct');
    if (label) label.textContent = pct + '%（' + done + '/' + total + '）';
    $$('.nav__item').forEach(el => {
      el.classList.toggle('is-done', visited.has(el.dataset.page));
    });
  }

  /* ---------- 导航 ---------- */
  function renderNav() {
    const groups = [
      { label: '开始', ids: ['home'] },
      { label: '读懂架构', ids: ['stack', 'architecture', 'agent'] },
      { label: '运行机制', ids: ['loop', 'request', 'scenarios'] },
      { label: '横向机制', ids: ['plugins', 'events', 'models'] },
      { label: '查阅', ids: ['modes', 'sources', 'progress'] },
    ];
    const byId = new Map(window.Pages.NAV_PAGES.map((p, i) => [p.id, { ...p, n: i + 1 }]));
    $('#navItems').innerHTML = `<button class="nav__lab" data-page="execution-lab" data-go="execution-lab" title="3D Agent Execution Lab">
        <span class="nav__lab-mark">◈</span>
        <span class="nav__lab-text"><span class="nav__lab-t">Agent 动态执行</span><span class="nav__lab-s">3D EXECUTION LAB</span></span>
        <span class="nav__lab-new">NEW</span>
      </button>` + groups.map(g => `<div class="nav__group">
      <div class="nav__label">${esc(g.label)}</div>
      ${g.ids.map(id => {
        const p = byId.get(id);
        return `<button class="nav__item" data-page="${p.id}" data-go="${p.id}">
          <span class="nav__idx">${String(p.n).padStart(2, '0')}</span>
          <span class="nav__dot"></span>
          <span>${esc(p.label)}</span>
          <span class="nav__done">✓</span>
        </button>`;
      }).join('')}
    </div>`).join('');
    updateNavProgress();
  }

  function closeMobileNav() {
    document.querySelector('.app').classList.remove('nav-open');
  }

  /* ---------- 源码定位 ---------- */
  function openFile(path, line) {
    const n = Number(line) || 0;
    let ex = EX.find(e => e.file === path && n >= e.start && n <= e.end);
    if (!ex) ex = EX.find(e => e.file === path);
    if (ex) {
      inspect({
        kind: 'source',
        title: path.split('/').pop(),
        sub: `${path}${line ? ':' + line : ''}`,
        body: `${ex.note ? `<p class="small muted" style="margin-bottom:10px">${esc(ex.note)}</p>` : ''}
          ${codeBlock(ex, { max: 560 })}
          <div class="row" style="margin-top:10px">
            <button class="btn btn--ghost btn--sm" data-copy="${esc(path + (line ? ':' + line : ''))}">${icon('copy', 12)} 复制 file:line</button>
            <span class="tiny muted">该文件已抽取 ${ex.start}–${ex.end} 行</span>
          </div>`,
      });
      return;
    }
    const ide = ideHref(path, line);
    inspect({
      kind: 'file',
      title: path.split('/').pop(),
      sub: path,
      body: `<p class="small muted">这个位置还没有抽取代码片段。路径可以直接复制到 IDE 中打开。</p>
        <div class="row" style="margin-top:12px">
          <button class="btn btn--sm" data-copy="${esc(path + (line ? ':' + line : ''))}">${icon('copy', 12)} 复制 ${esc(path + (line ? ':' + line : ''))}</button>
          ${ide ? `<a class="btn btn--sm" href="${esc(ide)}">${icon('link', 12)} 在 VS Code 打开</a>` : ''}
        </div>`,
    });
  }

  function openNode(id) {
    const n = NODES.get(id);
    if (!n) return;
    if (App.currentPage === 'architecture' && App.currentGraph) {
      App.currentGraph.select(id);
      App.currentGraph.centerOn(id);
      window.Pages.helpers.inspectNode(id);
    } else {
      go('architecture', { node: id });
    }
  }

  /* ---------- 全局搜索 ---------- */
  let searchIndex = null;
  function buildSearchIndex() {
    const items = [];
    window.Pages.NAV_PAGES.forEach(p => items.push({ kind: '页面', label: p.label, route: p.id, params: {}, meta: p.hint }));
    A.nodes.forEach(n => items.push({ kind: '模块', label: n.label, route: 'architecture', params: { node: n.id }, meta: n.sub }));
    D.generated.events.forEach(e => items.push({ kind: '事件', label: e.name, route: 'events', params: { q: e.name }, meta: e.mode }));
    D.techstack.items.forEach(t => items.push({ kind: '技术', label: t.name, route: 'stack', params: {}, meta: t.status, action: () => window.Pages.helpers.inspectTech(t) }));
    D.models.models.forEach(m => items.push({ kind: '数据', label: m.name, route: 'models', params: {}, meta: m.kind }));
    D.scenarios.scenarios.forEach(s => items.push({ kind: '场景', label: `${s.id} · ${s.title}`, route: 'scenarios', params: { s: s.id }, meta: s.support }));
    D.glossary.terms.forEach(t => items.push({ kind: '术语', label: t.term, route: 'progress', params: {}, meta: '术语表', action: () => window.Pages.helpers.inspectTerm(t) }));
    D.generated.packages.forEach(p => items.push({ kind: '包', label: p.name.replace('@deepseek-ai/', ''), route: 'sources', params: { q: p.name }, meta: p.dir }));
    D.executionLab.scenarios.forEach(s => items.push({ kind: '实验室', label: `${s.title} · ${s.tag}`, route: 'execution-lab', params: { scenario: s.id }, meta: s.support }));
    D.executionLab.stations.filter(s => s.id !== 'core').forEach(s => items.push({ kind: '站台', label: `${s.no} ${s.name}`, route: 'execution-lab', params: { scenario: 'ask', station: s.id }, meta: s.module }));
    return items;
  }

  function renderSearchResults(query) {
    const pop = $('#searchPop');
    const q = query.trim().toLowerCase();
    if (!q) { pop.classList.add('hidden'); pop.innerHTML = ''; return; }
    searchIndex = searchIndex || buildSearchIndex();
    const scored = [];
    for (const item of searchIndex) {
      const label = item.label.toLowerCase();
      const meta = (item.meta || '').toLowerCase();
      let score = -1;
      if (label === q) score = 0;
      else if (label.startsWith(q)) score = 1;
      else if (label.includes(q)) score = 2;
      else if (meta.includes(q)) score = 3;
      if (score >= 0) scored.push({ item, score });
    }
    scored.sort((a, b) => a.score - b.score || a.item.label.length - b.item.label.length);
    const rows = scored.slice(0, 12);
    pop.classList.remove('hidden');
    pop.innerHTML = rows.length ? rows.map((r, i) => `<div class="search-pop__row ${i === 0 ? 'is-active' : ''}" data-idx="${i}">
      <span class="search-pop__kind">${esc(r.item.kind)}</span>
      <span class="search-pop__label">${esc(r.item.label)}</span>
      <span class="search-pop__meta">${esc((r.item.meta || '').slice(0, 40))}</span>
    </div>`).join('') : `<div class="search-pop__empty">没有匹配项。试试 turn、assistant、Cordis 或 subagent。</div>`;
    pop._rows = rows;
    pop.querySelectorAll('[data-idx]').forEach(row => {
      row.addEventListener('mousedown', (e) => { e.preventDefault(); pickSearch(Number(row.dataset.idx)); });
    });
  }

  function pickSearch(index) {
    const pop = $('#searchPop');
    const item = (pop._rows || [])[index];
    if (!item) return;
    $('#globalSearch').value = '';
    pop.classList.add('hidden');
    if (item.item.action) item.item.action();
    else go(item.item.route, item.item.params);
  }

  function initSearch() {
    const input = $('#globalSearch');
    const pop = $('#searchPop');
    input.addEventListener('input', debounce(() => renderSearchResults(input.value), 110));
    input.addEventListener('focus', () => { if (input.value.trim()) renderSearchResults(input.value); });
    input.addEventListener('keydown', (e) => {
      const rows = pop.querySelectorAll('.search-pop__row');
      let active = Array.from(rows).findIndex(r => r.classList.contains('is-active'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!rows.length) return;
        active = Math.min(rows.length - 1, active + 1);
        rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!rows.length) return;
        active = Math.max(0, active - 1);
        rows.forEach((r, i) => r.classList.toggle('is-active', i === active));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        pickSearch(Math.max(0, active));
      } else if (e.key === 'Escape') {
        input.value = '';
        pop.classList.add('hidden');
        input.blur();
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-search') && !e.target.closest('.search-pop')) pop.classList.add('hidden');
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
      if (e.key === 'Escape') {
        window.UI.closeInspector();
        closeMobileNav();
      }
    });
  }

  /* ---------- 事件委派 ---------- */
  function initDelegation() {
    document.addEventListener('click', (e) => {
      const goEl = e.target.closest('[data-go]');
      if (goEl) {
        e.preventDefault();
        go(goEl.dataset.go);
        return;
      }
      const labEl = e.target.closest('[data-lab]');
      if (labEl) {
        e.preventDefault();
        go('execution-lab', labEl.dataset.lab ? { scenario: labEl.dataset.lab } : {});
        return;
      }
      const nodeEl = e.target.closest('[data-node]');
      if (nodeEl) {
        e.preventDefault();
        openNode(nodeEl.dataset.node);
        return;
      }
      const fileEl = e.target.closest('[data-file]');
      if (fileEl) {
        e.preventDefault();
        openFile(fileEl.dataset.file, fileEl.dataset.line);
        return;
      }
      const copyEl = e.target.closest('[data-copy]');
      if (copyEl) {
        e.preventDefault();
        copy(copyEl.dataset.copy, '路径');
        return;
      }
      const isolateEl = e.target.closest('[data-isolate]');
      if (isolateEl && App.currentGraph) {
        e.preventDefault();
        const id = isolateEl.dataset.isolate;
        const near = new Set([id]);
        A.edges.forEach(edge => {
          if (edge.from === id) near.add(edge.to);
          if (edge.to === id) near.add(edge.from);
        });
        App.currentGraph.setVisible(n => near.has(n.id));
        toast('只看上下游；点页面上方「重置筛选」恢复全部');
        return;
      }
    });

    $('#themeBtn').addEventListener('click', toggleTheme);
    $('#menuBtn').addEventListener('click', () => document.querySelector('.app').classList.toggle('nav-open'));

    const scrim = $('#scrim');
    scrim.addEventListener('click', () => {
      window.UI.closeInspector();
      closeMobileNav();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileNav();
      }
    });
    window.addEventListener('hashchange', route);
  }

  /* ---------- 启动 ---------- */
  function init() {
    applyTheme(store.get('theme', 'dark'));
    renderNav();
    initDelegation();
    initSearch();
    route();
  }

  App.go = go;
  App.addGraph = (g) => { App.graphs.push(g); };
  App.addCleanup = (fn) => { App.cleanups.push(fn); };
  App.openNode = openNode;
  App.openFile = openFile;
  App.updateNavProgress = updateNavProgress;
  App.init = init;
  window.App = App;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
