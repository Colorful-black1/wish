/* ===== 页面渲染：13 个视图 ===== */
(function () {
  'use strict';
  const { esc, icon, codeBlock, fileRef, inspect, fmt } = window.UI;
  const D = window.LAB_DATA;
  const A = D.architecture;
  const NODES = new Map(A.nodes.map(n => [n.id, n]));
  const EX = new Map(D.generated.excerpts.map(e => [e.id, e]));
  const EXLIST = D.generated.excerpts;

  const NAV_PAGES = [
    { id: 'home', label: '学习首页', hint: '从这里开始' },
    { id: 'stack', label: '技术栈全景', hint: '它用了什么' },
    { id: 'architecture', label: '项目架构图', hint: '模块与连线' },
    { id: 'agent', label: 'Agent 核心机制', hint: 'Agent 是什么' },
    { id: 'loop', label: 'Agent Loop', hint: '轮次与步骤' },
    { id: 'request', label: '用户请求链路', hint: '一条消息的旅程' },
    { id: 'scenarios', label: '场景实验室', hint: '八个典型任务' },
    { id: 'plugins', label: '插件系统', hint: 'Profile / Bundle / Patch' },
    { id: 'events', label: '事件系统', hint: '三域四模式' },
    { id: 'models', label: '数据结构', hint: '事件日志与状态' },
    { id: 'modes', label: '运行模式', hint: 'Web / Desktop / SDK…' },
    { id: 'sources', label: '源码索引', hint: '路径与行号' },
    { id: 'progress', label: '学习进度', hint: '清单与覆盖率' },
  ];

  const LAB_PAGE = (window.LabPage && window.LabPage.meta) || { id: 'execution-lab', label: 'Agent 动态执行', hint: '3D Agent Execution Lab', lab: true };
  const META = [...NAV_PAGES, LAB_PAGE];
  const LAB_SCENARIO = { A: 'ask', B: 'coding', C: 'file-read', D: 'office', E: 'web-search', F: 'subagent', H: 'exception' };

  /* ---------- 小工具 ---------- */
  const mdInline = (text) => esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const basename = (p) => String(p).split('/').pop();

  function pageHead(eyebrow, title, sub, aside = '') {
    return `<div class="page-head">
      <div class="page-head__main">
        <div class="page-eyebrow">${esc(eyebrow)}</div>
        <h1 class="page-title">${title}</h1>
        <p class="page-sub">${mdInline(sub)}</p>
      </div>
      ${aside ? `<div class="page-head__aside">${aside}</div>` : ''}
    </div>`;
  }

  function section(title, hint, body, extra = '') {
    return `<section class="section">
      <div class="section-head"><h2 class="section-title">${esc(title)}</h2>${hint ? `<span class="section-hint">${mdInline(hint)}</span>` : ''}${extra}</div>
      ${body}
    </section>`;
  }

  function statusBadge(status) {
    if (/完全支持/.test(status)) return `<span class="badge badge--green">${esc(status)}</span>`;
    if (/需|部分/.test(status)) return `<span class="badge badge--amber">${esc(status)}</span>`;
    if (/不存在/.test(status)) return `<span class="badge">${esc(status)}</span>`;
    return `<span class="badge badge--accent">${esc(status)}</span>`;
  }

  function filesHtml(files, max = 6) {
    if (!files || !files.length) return '';
    return `<div class="file-list">${files.slice(0, max).map(fileRef).join('')}</div>`;
  }

  function chips(items, attr = 'data-chip') {
    return items.map(x => `<span class="chip" ${attr}>${esc(x)}</span>`).join('');
  }

  /* ---------- 检查器 ---------- */
  function edgeLine(edge, dir) {
    const otherId = dir === 'out' ? edge.to : edge.from;
    const other = NODES.get(otherId);
    return `<button class="file-ref" data-node="${esc(otherId)}">
      ${icon(dir === 'out' ? 'arrow' : 'back')}
      <span>${esc(other ? other.label : otherId)}</span>
      <span class="file-ref__sym">${esc(edge.label || edge.kind)}</span>
    </button>`;
  }

  function inspectNode(id) {
    const n = NODES.get(id);
    if (!n) return;
    const outs = A.edges.filter(e => e.from === id);
    const ins = A.edges.filter(e => e.to === id);
    const ex = n.excerpt ? EX.get(n.excerpt) : EXLIST.find(e => e.file === n.files?.[0]?.path);
    const body = `
      <div class="eyebrow" style="margin-bottom:4px">一句话理解</div>
      <p class="small" style="color:var(--text)">${esc(n.sub)}：${mdInline(n.duty.split('；')[0])}</p>
      <div class="eyebrow" style="margin:14px 0 4px">架构职责</div>
      <p class="small" style="color:var(--text-2)">${mdInline(n.duty)}</p>
      <div class="divider"></div>
      <div class="defs">
        <div class="defs__k">API</div><div class="defs__v mono">${esc(n.api || '—')}</div>
        <div class="defs__k">输入</div><div class="defs__v">${esc(n.input || '—')}</div>
        <div class="defs__k">输出</div><div class="defs__v">${esc(n.output || '—')}</div>
        <div class="defs__k">包</div><div class="defs__v mono">${esc(n.pkg || '—')}</div>
      </div>
      ${n.facts && n.facts.length ? `<h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">要点</h4>
        <ul class="small" style="color:var(--text-2);display:flex;flex-direction:column;gap:6px">
          ${n.facts.map(f => `<li>· ${mdInline(f)}</li>`).join('')}
        </ul>` : ''}
      <h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">源码位置</h4>
      ${filesHtml(n.files)}
      <div class="row" style="margin-top:10px">
        <button class="btn btn--sm" data-isolate="${esc(id)}">${icon('grid', 13)} 只看它的上下游</button>
      </div>
      ${outs.length ? `<h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">调用 / 事件发往（${outs.length}）</h4>
        <div class="file-list">${outs.map(e => edgeLine(e, 'out')).join('')}</div>` : ''}
      ${ins.length ? `<h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">上游来源（${ins.length}）</h4>
        <div class="file-list">${ins.map(e => edgeLine(e, 'in')).join('')}</div>` : ''}
      ${ex ? `<div class="eyebrow" style="margin:16px 0 6px">源码实现</div>${codeBlock(ex, { max: 300 })}` : ''}`;
    inspect({ kind: 'module', title: esc(n.label), sub: esc(`${n.sub} · ${n.layer}`), body });
  }

  function inspectEdge(edge) {
    const from = NODES.get(edge.from);
    const to = NODES.get(edge.to);
    const body = `
      <p class="small" style="color:var(--text-2)">${mdInline(edge.label || '')}</p>
      <div class="divider"></div>
      <div class="defs">
        <div class="defs__k">起点</div><div class="defs__v">${esc(from ? from.label : edge.from)}</div>
        <div class="defs__k">终点</div><div class="defs__v">${esc(to ? to.label : edge.to)}</div>
        <div class="defs__k">类型</div><div class="defs__v"><span class="badge badge--mono">${esc(edge.kind)}</span></div>
        <div class="defs__k">依据</div><div class="defs__v mono">${esc(edge.ref || '—')}</div>
      </div>
      <div class="row" style="margin-top:12px">
        <button class="btn btn--sm" data-node="${esc(edge.from)}">看起点</button>
        <button class="btn btn--sm" data-node="${esc(edge.to)}">看终点</button>
      </div>
      ${edge.ref ? `<button class="btn btn--ghost btn--sm" style="margin-top:8px" data-copy="${esc(edge.ref)}">${icon('copy', 12)} 复制源码位置</button>` : ''}`;
    inspect({ kind: `edge · ${edge.kind}`, title: `${esc(from ? from.label : edge.from)} → ${esc(to ? to.label : edge.to)}`, sub: '', body });
  }

  function inspectEventChain(chain) {
    const body = `
      <p class="small" style="color:var(--text-2)">${mdInline(chain.desc)}</p>
      <div class="defs" style="margin-top:12px">
        <div class="defs__k">域</div><div class="defs__v">${esc(chain.domain)}</div>
        <div class="defs__k">模式</div><div class="defs__v"><span class="badge badge--violet">${esc(chain.mode)}</span></div>
        <div class="defs__k">载荷</div><div class="defs__v mono">${esc(chain.payload)}</div>
        <div class="defs__k">声明于</div><div class="defs__v mono">${esc(chain.ref)}</div>
      </div>
      <h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">生产者</h4>
      <div class="row"><span class="chip">${esc(chain.producer)}</span></div>
      <h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">监听者（${chain.listeners.length}）</h4>
      <div class="row">${chain.listeners.map(l => `<span class="chip">${esc(l)}</span>`).join('')}</div>
      <button class="btn btn--ghost btn--sm" style="margin-top:14px" data-copy="${esc(chain.ref)}">${icon('copy', 12)} 复制声明位置</button>`;
    inspect({ kind: 'event', title: esc(chain.event), sub: esc(chain.mode + ' · ' + chain.domain), body });
  }

  function inspectGeneratedEvent(ev) {
    const body = `
      <div class="defs">
        <div class="defs__k">模式</div><div class="defs__v"><span class="badge badge--violet">${esc(ev.mode)}</span></div>
        <div class="defs__k">声明于</div><div class="defs__v mono">${esc(ev.declared)}</div>
        <div class="defs__k">分发方</div><div class="defs__v">${(ev.dispatchers || []).map(x => `<span class="chip">${esc(x)}</span>`).join(' ') || '—'}</div>
      </div>
      <h4 style="margin:16px 0 6px;font-size:12px;color:var(--muted)">监听者（${(ev.listeners || []).length}）</h4>
      <div class="row">${(ev.listeners || []).map(l => `<span class="chip">${esc(l)}</span>`).join('') || '<span class="muted small">生成文档中未记录监听者</span>'}</div>
      <button class="btn btn--ghost btn--sm" style="margin-top:14px" data-copy="${esc(ev.declared)}">${icon('copy', 12)} 复制声明位置</button>`;
    inspect({ kind: 'event', title: esc(ev.name), sub: esc(ev.mode), body });
  }

  function inspectTech(item) {
    const body = `
      <p class="small" style="color:var(--text-2)">${mdInline(item.role)}</p>
      <h4 style="margin:14px 0 6px;font-size:12px;color:var(--muted)">在 DeepSeek Harness 里做什么</h4>
      <p class="small" style="color:var(--text-2)">${mdInline(item.usage)}</p>
      <h4 style="margin:14px 0 6px;font-size:12px;color:var(--muted)">为什么对 Agent 有价值</h4>
      <p class="small" style="color:var(--text-2)">${mdInline(item.why)}</p>
      <div class="divider"></div>
      <div class="defs">
        <div class="defs__k">依据</div><div class="defs__v">${statusBadge(item.status)}</div>
        <div class="defs__k">包</div><div class="defs__v mono">${esc((item.packages || []).join(', ') || '—')}</div>
      </div>
      ${filesHtml(item.files)}`;
    inspect({ kind: 'tech', title: esc(item.name), sub: esc(item.layer), body });
  }

  function inspectPackage(pkg) {
    const body = `
      <p class="small" style="color:var(--text-2)">${esc(pkg.description || '（该包 package.json 未提供 description）')}</p>
      <div class="defs" style="margin-top:12px">
        <div class="defs__k">包名</div><div class="defs__v mono">${esc(pkg.name)}</div>
        <div class="defs__k">目录</div><div class="defs__v mono">${esc(pkg.dir)}</div>
        <div class="defs__k">版本</div><div class="defs__v mono">${esc(pkg.version || '—')}</div>
        <div class="defs__k">分组</div><div class="defs__v">${esc(pkg.group)}</div>
      </div>
      <button class="btn btn--ghost btn--sm" style="margin-top:12px" data-copy="${esc(pkg.dir)}">${icon('copy', 12)} 复制目录</button>`;
    inspect({ kind: 'package', title: esc(pkg.short || pkg.name), sub: esc(pkg.dir), body });
  }

  function inspectExcerpt(ex) {
    const body = `${ex.note ? `<p class="small" style="color:var(--text-2);margin-bottom:10px">${mdInline(ex.note)}</p>` : ''}
      ${codeBlock(ex, { max: 560 })}
      <button class="btn btn--ghost btn--sm" style="margin-top:10px" data-copy="${esc(ex.file + ':' + ex.start)}">${icon('copy', 12)} 复制 file:line</button>`;
    inspect({ kind: 'source', title: esc(ex.label || basename(ex.file)), sub: esc(`${ex.file}:${ex.start}`), body });
  }

  function inspectModel(model) {
    const ex = EXLIST.find(x => x.file === model.file);
    const body = `
      <p class="small" style="color:var(--text-2)">${mdInline(model.summary)}</p>
      <div class="defs" style="margin-top:12px">
        <div class="defs__k">位置</div><div class="defs__v mono">${esc(model.file)}:${model.line}</div>
        <div class="defs__k">创建</div><div class="defs__v">${esc(model.createdBy)}</div>
        <div class="defs__k">更新</div><div class="defs__v">${esc(model.updatedBy)}</div>
        <div class="defs__k">消费</div><div class="defs__v">${esc(model.consumedBy)}</div>
      </div>
      <h4 style="margin:14px 0 6px;font-size:12px;color:var(--muted)">字段</h4>
      <div class="stack">${model.fields.map(f => `<div><span class="mono small" style="color:var(--accent-2)">${esc(f.name)}</span> <span class="tiny muted">${esc(f.type)}</span><div class="tiny" style="color:var(--text-2)">${esc(f.desc)}</div></div>`).join('')}</div>
      ${ex ? `<h4 style="margin:14px 0 6px;font-size:12px;color:var(--muted)">相关代码</h4>${codeBlock(ex, { max: 260 })}` : ''}`;
    inspect({ kind: 'data', title: esc(model.name), sub: esc(model.kind), body });
  }

  function inspectTerm(term) {
    const body = `<p class="small" style="color:var(--text-2)">${esc(term.plain)}</p>
      <div class="callout" style="margin-top:12px"><div class="callout__t">打个比方</div>${esc(term.analogy)}</div>
      <button class="btn btn--ghost btn--sm" style="margin-top:12px" data-copy="${esc(term.ref)}">${icon('copy', 12)} 复制源码位置</button>`;
    inspect({ kind: 'term', title: esc(term.term), sub: '', body });
  }

  /* ---------- 首页 ---------- */
  function renderHome(root) {
    const meta = D.generated.meta;
    const h = D.home;
    const stats = [
      { n: fmt(meta.stats.packages), l: '包 / workspace 包', h: '含 apps 与桌面宿主' },
      { n: fmt(meta.stats.sourceFiles), l: 'TypeScript 源文件', h: `约 ${(meta.stats.lines / 10000).toFixed(1)} 万行（不含测试）` },
      { n: fmt(A.nodes.length), l: '架构图模块', h: `${A.edges.length} 条有源码依据的连线` },
      { n: fmt(meta.stats.events), l: '事件', h: `${meta.stats.sessionEvents} 个 Session 事件` },
      { n: fmt(meta.stats.tools), l: '模型可见工具', h: `${D.generated.tools.length} 个工具包` },
      { n: fmt(meta.stats.basePlugins), l: 'dsh-base 插件行', h: 'Web 再叠 97 行' },
    ];
    root.innerHTML = `<div class="page page--wide">
      <section class="hero">
        <div class="hero__inner">
          <div class="eyebrow">${esc(h.hero.eyebrow)}</div>
          <h1 class="hero__title">${esc(h.hero.title)}</h1>
          <p class="hero__lead">${mdInline(h.hero.lead)}</p>
          <div class="hero__actions">
            ${h.hero.cta.map(c => `<button class="btn ${c.route === 'architecture' ? 'btn--primary' : ''}" data-go="${c.route}">${esc(c.label)} ${icon('arrow', 14)}</button>`).join('')}
          </div>
          <div class="hero__meta">
            ${h.hero.meta.map(m => `<span class="badge badge--mono">${esc(m)}</span>`).join('')}
            <span class="badge badge--green"><span class="badge__dot"></span>源码为准</span>
          </div>
        </div>
      </section>

      ${h.lab ? `<section class="lab-entry">
        <div class="lab-entry__glow" aria-hidden="true"></div>
        <div class="lab-entry__main">
          <div class="lab-entry__k">${esc(h.lab.eyebrow)}</div>
          <h2 class="lab-entry__t">${esc(h.lab.title)}</h2>
          <p class="lab-entry__p">${mdInline(h.lab.text)}</p>
          <div class="row">${h.lab.points.map(p => `<span class="badge badge--mono">${esc(p)}</span>`).join('')}<span class="badge badge--amber">SIMULATED</span></div>
        </div>
        <button class="lab-entry__btn" data-lab="${esc(h.lab.scenario)}">${icon('play', 14)} ${esc(h.lab.cta)} ${icon('arrow', 14)}</button>
      </section>` : ''}

      ${section('一眼看懂', '数字来自 data/generated.json，页面运行时计算', `<div class="grid grid--3">${stats.map(s => `<div class="stat"><div class="stat__num">${s.n}</div><div class="stat__label">${esc(s.l)}</div><div class="stat__hint">${esc(s.h)}</div></div>`).join('')}</div>`)}

      ${section('四个问题', '首页不写结论，点进去自己验证', `<div class="grid grid--4">${h.questions.map(q => `<button class="card card--hover qcard" data-go="${q.route}">
        <div class="qcard__q">${esc(q.q)}</div><div class="qcard__a">${mdInline(q.short)}</div><div class="qcard__route">→ ${esc(q.route)}</div>
      </button>`).join('')}</div>`)}

      <div class="grid grid--2" style="margin-top:26px">
        <div class="card card--pad">
          <div class="spread" style="margin-bottom:6px"><h2 class="section-title">推荐路线</h2><span class="section-hint">约 45 分钟</span></div>
          ${h.path.map(p => `<div class="path__item">
            <div class="path__n">${p.step}</div>
            <div><div class="path__t"><button class="btn btn--ghost btn--sm" data-go="${p.route}" style="height:auto;padding:0">${esc(p.title)}</button></div>
            <div class="path__d">${esc(p.desc)}</div></div>
          </div>`).join('')}
        </div>
        <div class="card card--pad">
          <div class="spread" style="margin-bottom:10px"><h2 class="section-title">架构缩略图</h2><span class="section-hint">点节点进全局图</span></div>
          <div class="mini-graph" id="homeGraph"></div>
          <div class="row" style="margin-top:10px">
            <span class="badge">6 层</span><span class="badge">${A.nodes.length} 模块</span><span class="badge">${A.edges.length} 连线</span>
            <button class="btn btn--ghost btn--sm" style="margin-left:auto" data-go="architecture">打开全局图 ${icon('arrow', 12)}</button>
          </div>
        </div>
      </div>

      ${section('这个实验室的原则', '', `<div class="grid grid--3">${h.principles.map(p => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(p.title)}</div><div class="small muted">${mdInline(p.text)}</div></div>`).join('')}</div>`)}

      <div class="callout callout--warn" style="margin-top:24px">
        <div class="callout__t">源码版本与范围</div>
        ${esc(meta.product)} ${esc(meta.version)} · commit ${esc(meta.commit.slice(0, 7))} · 抽取于 ${esc(meta.extractedAt.slice(0, 10))}。
        未覆盖的部分列在「学习进度 → 覆盖率」中；源码里不存在的机制会明确写「不存在」，不补流程。
      </div>
    </div>`;

    const g = new window.GraphView(root.querySelector('#homeGraph'), {
      nodes: A.nodes, edges: A.edges, layerOrder: A.layers.map(l => l.id), legend: false,
      onNode: (n) => { window.App.go('architecture', { node: n.id }); },
    });
    window.App.addGraph(g);
  }

  /* ---------- 技术栈 ---------- */
  function renderStack(root) {
    const data = D.techstack;
    const state = { layer: 'all' };
    const draw = () => {
      const items = data.items.filter(i => state.layer === 'all' || i.layer === state.layer);
      root.innerHTML = `<div class="page">
        ${pageHead('MODULE 01 · TECH STACK', '技术栈全景', data.subtitle,
          `<span class="badge badge--green">${data.items.filter(i => i.status === '源码确认').length} 项源码确认</span>
           <span class="badge badge--amber">${data.items.filter(i => i.status === '文档确认').length} 项文档确认</span>`)}
        <div class="row" style="margin-bottom:14px">
          <button class="chip ${state.layer === 'all' ? 'is-active' : ''}" data-layer="all">全部 <span class="chip__count">${data.items.length}</span></button>
          ${data.layers.map(l => `<button class="chip ${state.layer === l.id ? 'is-active' : ''}" data-layer="${l.id}">${esc(l.label)} <span class="chip__count">${data.items.filter(i => i.layer === l.id).length}</span></button>`).join('')}
        </div>
        ${data.layers.filter(l => state.layer === 'all' || l.id === state.layer).map(layer => `
          <div class="stack-layer" style="margin-bottom:14px">
            <div class="stack-layer__head"><span class="stack-layer__label">${esc(layer.label)}</span><span class="stack-layer__hint">${esc(layer.hint)}</span>
              <span class="badge badge--mono" style="margin-left:auto">${items.filter(i => i.layer === layer.id).length}</span></div>
            <div class="stack-layer__body">
              ${items.filter(i => i.layer === layer.id).map(item => `<button class="tech-pill" data-tech="${item.id}">
                <span class="tech-pill__dot ${item.status === '文档确认' ? 'tech-pill__dot--doc' : ''}"></span>${esc(item.name)}
              </button>`).join('')}
            </div>
          </div>`).join('')}
        <div class="callout" style="margin-top:6px">
          <div class="callout__t">怎么读状态</div>
          <span class="status status--ok"><i></i>源码确认</span>：读过实现或 package.json；
          <span class="status status--warn"><i></i>文档确认</span>：来自仓库文档，未逐行核对实现。
          页面里没有「源码中不存在」的技术项；不存在的机制在场景与覆盖率页单独标注。
        </div>
      </div>`;
      root.querySelectorAll('[data-layer]').forEach(btn => btn.addEventListener('click', () => { state.layer = btn.dataset.layer; draw(); }));
      root.querySelectorAll('[data-tech]').forEach(btn => btn.addEventListener('click', () => {
        const item = data.items.find(i => i.id === btn.dataset.tech);
        if (item) inspectTech(item);
      }));
    };
    draw();
  }

  /* ---------- 架构图 + 启动流程 ---------- */
  function renderArchitecture(root, params) {
    const tab = params.tab === 'startup' ? 'startup' : 'global';
    const state = { tab, layers: new Set(A.layers.map(l => l.id)) };
    const draw = () => {
      root.innerHTML = `<div class="page page--wide">
        ${pageHead('MODULE 02 · ARCHITECTURE', '项目架构图谱', A.subtitle,
          `<button class="btn btn--sm" data-tab="global">全局模块图</button><button class="btn btn--sm" data-tab="startup">启动流程</button>`)}
        ${state.tab === 'global' ? `<div id="archBody"></div>` : `<div id="startupBody"></div>`}
      </div>`;
      root.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
        window.App.go('architecture', { tab: btn.dataset.tab });
      }));
      if (state.tab === 'global') drawGlobal(root.querySelector('#archBody'), state, params);
      else drawStartup(root.querySelector('#startupBody'), params);
    };
    draw();
  }

  function drawGlobal(host, state, params) {
    const kinds = [...new Set(A.nodes.map(n => n.kind))];
    const kindLabel = { entry: '入口', service: '服务', store: '存储', config: '配置', transport: '传输', ui: '界面', adapter: '适配器', runtime: '运行时' };
    host.innerHTML = `
      <div class="row" style="margin-bottom:10px">
        ${A.layers.map(l => `<button class="chip is-active" data-flayer="${l.id}">${esc(l.label)} <span class="chip__count">${A.nodes.filter(n => n.layer === l.id).length}</span></button>`).join('')}
        <select class="btn btn--sm" data-fkind style="padding:0 8px" aria-label="按模块类型过滤">
          <option value="all">全部类型</option>
          ${kinds.map(k => `<option value="${esc(k)}">${esc(kindLabel[k] || k)}</option>`).join('')}
        </select>
        <button class="chip" data-freset>${icon('reset', 12)} 重置筛选</button>
        <span class="section-hint" style="margin-left:auto">点击节点看详情 · 点击连线看依据 · 可拖动/缩放/全屏</span>
      </div>
      <div class="card" style="overflow:hidden">
        <div id="archGraph" style="height:620px"></div>
      </div>
      <div class="grid grid--3" style="margin-top:14px">
        <div class="card card--pad"><div class="eyebrow">怎么读</div><div class="small muted" style="margin-top:6px">左侧是入口与装配，中间是 Agent 与能力，右侧是数据与界面。连线颜色：<span class="mono">call</span> 调用、<span class="mono">event</span> 事件、<span class="mono">data</span> 数据、<span class="mono">service</span> 服务依赖。</div></div>
        <div class="card card--pad"><div class="eyebrow">连线从哪来</div><div class="small muted" style="margin-top:6px">每条边都附 <span class="mono">file:line</span>；点连线可在右侧看到依据。没有凭名称相似的连线。</div></div>
        <div class="card card--pad"><div class="eyebrow">想深入</div><div class="small muted" style="margin-top:6px">选中节点后可「只看它的上下游」；按层过滤用来剥离 UI 或能力层。</div></div>
      </div>`;

    const g = new window.GraphView(host.querySelector('#archGraph'), {
      nodes: A.nodes, edges: A.edges, layerOrder: A.layers.map(l => l.id),
      onNode: (n) => inspectNode(n.id),
      onEdge: (e) => inspectEdge(e),
    });
    window.App.addGraph(g);
    window.App.currentGraph = g;
    if (params.node && NODES.has(params.node)) {
      g.select(params.node);
      inspectNode(params.node);
      setTimeout(() => g.centerOn(params.node), 60);
    }

    state.kind = 'all';
    const applyFilters = () => {
      g.setVisible(n => state.layers.has(n.layer) && (state.kind === 'all' || n.kind === state.kind));
    };
    host.querySelectorAll('[data-flayer]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.flayer;
        if (state.layers.has(id)) state.layers.delete(id); else state.layers.add(id);
        btn.classList.toggle('is-active', state.layers.has(id));
        applyFilters();
      });
    });
    host.querySelector('[data-fkind]').addEventListener('change', (e) => {
      state.kind = e.target.value;
      applyFilters();
    });
    host.querySelector('[data-freset]').addEventListener('click', () => {
      A.layers.forEach(l => state.layers.add(l.id));
      state.kind = 'all';
      host.querySelectorAll('[data-flayer]').forEach(b => b.classList.add('is-active'));
      host.querySelector('[data-fkind]').value = 'all';
      g.setVisible(null);
      g.clearSelection();
      g.fit();
    });
  }

  function drawStartup(host) {
    const S = D.startup;
    host.innerHTML = `
      <div class="callout" style="margin-bottom:12px"><div class="callout__t">一句话</div>${mdInline('先组合配置，再挂载插件树；没有「按顺序 new 一串服务」的 main 函数。')}</div>
      <div class="card" style="overflow:hidden"><div class="flow__graph" id="startupGraph" style="height:330px"></div></div>
      <div class="flow" id="startupFlow" style="margin-top:12px"></div>
      <div class="grid grid--2" style="margin-top:16px">
        <div class="card card--pad"><div class="eyebrow">随附 profile 的层数</div>
          <div class="stack" style="margin-top:10px">
            ${D.generated.profiles.map(p => `<div class="spread"><span class="mono small">${esc(p.name)}</span><span class="small muted">${p.bundles.map(b => b.replace('@deepseek-ai/', '')).join(' + ')}</span></div>`).join('')}
          </div>
        </div>
        <div class="card card--pad"><div class="eyebrow">启动期容易踩的坑</div>
          <ul class="small muted" style="margin-top:8px;display:flex;flex-direction:column;gap:6px">
            <li>· 行顺序不决定加载顺序：Loader 并发挂载，服务就绪才激活。</li>
            <li>· patch 替换整份 config，不合并字段；写漏一个 key 就会回落默认值。</li>
            <li>· 根 cordis.yml 每次启动被重写为空数组，避免组合行被固化。</li>
          </ul>
        </div>
      </div>`;

    const g = new window.GraphView(host.querySelector('#startupGraph'), {
      nodes: S.graph.nodes, edges: S.graph.edges,
      onNode: () => {},
      legend: false,
      hint: '命令行 → 组装 → 挂载 → 就绪',
    });
    window.App.addGraph(g);
    const mount = host.querySelector('#startupFlow');
    const player = new window.FlowPlayer({
      steps: S.steps, graph: g, mount,
      render: (step) => {
        const ex = EX.get(step.code);
        return `<div class="flow__phase">${esc(step.phase)}</div>
          <h3 class="flow__title">${esc(step.title)}</h3>
          <p class="flow__text">${mdInline(step.detail)}</p>
          <div class="flow__io">
            <div class="flow__io-cell"><div class="flow__io-k">输入</div><div class="flow__io-v">${esc(step.input)}</div></div>
            <div class="flow__io-cell"><div class="flow__io-k">输出</div><div class="flow__io-v">${esc(step.output)}</div></div>
          </div>
          <div class="flow__foot">${step.event ? `<span class="badge badge--violet">${esc(step.event)}</span>` : ''}${filesHtml(step.files, 3)}</div>
          ${ex ? `<div style="margin-top:12px">${codeBlock(ex, { max: 240 })}</div>` : ''}`;
      },
    });
    window.App.addCleanup(() => player.destroy());
  }

  /* ---------- Agent ---------- */
  function renderAgent(root) {
    const d = D.agent;
    root.innerHTML = `<div class="page">
      ${pageHead('MODULE 03 · AGENT', 'Agent 核心机制', d.subtitle,
        `<span class="badge badge--mono">packages/core/agent</span><span class="badge badge--mono">packages/core/agent-loop</span>
         <button class="btn btn--primary btn--sm" data-lab="loop">${icon('play', 12)} 看它执行一轮</button>`)}
      <div class="callout">
        <div class="callout__t">一句话定义</div>
        ${mdInline(d.definition.text)}
      </div>

      ${section('生命周期', '创建 / 恢复 / setup / 注册 / 运行 / 取消 / 销毁', `<div class="timeline">
        ${d.lifecycle.map((s, i) => `<div class="tl-item"><div class="tl-item__title">${i + 1}. ${esc(s.title)}</div>
          <div class="tl-item__body">${mdInline(s.detail)}</div>
          <button class="tl-item__meta" data-copy="${esc(s.ref)}" style="margin-top:4px">${esc(s.ref)}</button></div>`).join('')}
      </div>`)}

      ${section('Agent 对象里有什么', '接口字段来自 runtime-types.ts 的声明合并块', `<div class="table-wrap"><table class="data"><thead><tr><th style="width:150px">字段</th><th>说明</th></tr></thead><tbody>
        ${d.fields.map(f => `<tr><td><code>${esc(f.name)}</code></td><td>${mdInline(f.desc)}</td></tr>`).join('')}
      </tbody></table></div>`)}

      ${section('Agent 之间如何通信', '不是共享内存，而是工具 + 收件箱 + 任务板', `<div class="grid grid--2">
        ${d.communication.map(c => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:5px">${esc(c.title)}</div>
          <div class="small muted">${mdInline(c.text)}</div>
          <button class="btn btn--ghost btn--sm" style="margin-top:10px" data-copy="${esc(c.ref)}">${icon('copy', 12)} ${esc(c.ref)}</button></div>`).join('')}
      </div>`)}

      ${section('三个容易误解的点', '', `<div class="grid grid--3">
        ${d.facts.map(f => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:5px">${esc(f.title)}</div><div class="small muted">${mdInline(f.text)}</div></div>`).join('')}
      </div>`)}
    </div>`;
  }

  /* ---------- Agent Loop ---------- */
  function renderLoop(root, params) {
    const L = D.agentloop;
    root.innerHTML = `<div class="page page--wide">
      ${pageHead('MODULE 04 · AGENT LOOP', 'Agent Loop', L.subtitle,
        `<span class="badge badge--accent">${L.steps.length} 步播放</span><span class="badge badge--mono">turn / step</span>
         <button class="btn btn--primary btn--sm" data-lab="loop">${icon('play', 12)} 进入动态执行实验室</button>`)}
      <div class="grid grid--4" style="margin-bottom:14px">
        ${L.definitions.map(d => `<div class="card card--pad"><div class="eyebrow">${esc(d.term)}</div>
          <div class="small" style="color:var(--text-2);margin-top:6px">${mdInline(d.text)}</div>
          <button class="tiny mono muted" style="margin-top:8px;text-align:left" data-copy="${esc(d.ref)}">${esc(d.ref)}</button></div>`).join('')}
      </div>
      <div class="card" style="overflow:hidden">
        <div class="flow__graph flow__graph--tall" id="loopGraph"></div>
        <div class="flow" id="loopFlow" style="border:0;border-radius:0"></div>
      </div>
      ${section('这页想让你记住的事', '', `<div class="grid grid--2">${L.notes.map(n => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(n.title)}</div><div class="small muted">${mdInline(n.text)}</div></div>`).join('')}</div>`)}
    </div>`;

    const g = new window.GraphView(root.querySelector('#loopGraph'), {
      nodes: L.graph.nodes, edges: L.graph.edges, legend: false,
      layerOrder: (L.graph.layers || []).map(l => l.id),
      hint: '蛇形阅读：第 1 行向右 → 折返向下 → 第 2 行向左 → 第 3 行向右；橙色虚线是回边',
      onNode: (n) => {
        const step = L.steps.find(s => s.node === n.id);
        if (step) player.go(L.steps.indexOf(step));
      },
    });
    window.App.addGraph(g);

    const mount = root.querySelector('#loopFlow');
    const player = new window.FlowPlayer({
      steps: L.steps, graph: g, mount,
      render: (step) => {
        const ex = EX.get(step.code);
        return `<div class="flow__phase">${esc(step.phase)}</div>
          <h3 class="flow__title">${esc(step.title)}</h3>
          <p class="flow__text">${mdInline(step.detail)}</p>
          <div class="flow__io">
            <div class="flow__io-cell"><div class="flow__io-k">输入</div><div class="flow__io-v">${esc(step.input)}</div></div>
            <div class="flow__io-cell"><div class="flow__io-k">输出</div><div class="flow__io-v">${esc(step.output)}</div></div>
          </div>
          <div class="flow__foot">${step.event ? `<span class="badge badge--violet">${esc(step.event)}</span>` : ''}${filesHtml(step.files, 3)}</div>
          ${ex ? `<div style="margin-top:12px">${codeBlock(ex, { max: 300 })}</div>` : ''}`;
      },
    });
    window.App.addCleanup(() => player.destroy());
    if (params.step) {
      const i = Number(params.step);
      if (Number.isFinite(i)) player.go(i);
    }
  }

  /* ---------- 请求链路 ---------- */
  function renderRequest(root, params) {
    const R = D.request;
    const track = params.track || 'all';
    const steps = R.steps.filter(s => track === 'all' || s.track === track);
    const lanes = new Map(R.lanes.map(l => [l.id, l]));

    root.innerHTML = `<div class="page page--wide">
      ${pageHead('MODULE 05 · END TO END', '用户请求完整链路', R.subtitle,
        `<span class="badge badge--mono">${R.steps.length} 步</span><span class="badge badge--accent">3 条轨道</span>
         <button class="btn btn--primary btn--sm" data-lab="ask">${icon('play', 12)} 动态执行实验室</button>`)}
      <div class="track-tabs" style="margin-bottom:14px">
        <button class="track-pill ${track === 'all' ? 'is-active' : ''}" data-track="all"><span class="track-pill__l">全部</span><span class="track-pill__d">按时间顺序混排</span></button>
        ${R.tracks.map(t => `<button class="track-pill ${track === t.id ? 'is-active' : ''}" data-track="${t.id}"><span class="track-pill__l">${esc(t.label)}</span><span class="track-pill__d">${esc(t.detail.slice(0, 34))}…</span></button>`).join('')}
      </div>
      <div class="grid" style="grid-template-columns:minmax(0,0.95fr) minmax(0,1.05fr);align-items:start">
        <div class="card" style="padding:8px 10px;max-height:640px;overflow:auto" id="traceList"></div>
        <div class="flow" id="requestFlow"></div>
      </div>
      ${section('三条过程必须分开看', '', `<div class="grid grid--3">${R.tracks.map(t => `<div class="card card--pad"><div class="eyebrow">${esc(t.label)}</div><div class="small muted" style="margin-top:6px">${mdInline(t.detail)}</div></div>`).join('')}</div>`)}
      ${section('几个关键事实', '', `<div class="grid grid--3">${R.facts.map(f => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(f.title)}</div><div class="small muted">${mdInline(f.text)}</div></div>`).join('')}</div>`)}
    </div>`;

    const list = root.querySelector('#traceList');
    list.innerHTML = steps.map((s, i) => `<div class="trace__item" data-trace="${i}">
      <div class="trace__lane" title="${esc((lanes.get(s.lane) || {}).label || s.lane)}">${esc((lanes.get(s.lane) || {}).short || s.lane)}</div>
      <div class="trace__dot"></div>
      <div><div class="trace__title">${esc(s.title)}<span class="trace__phase">${esc(s.phase)}</span></div>
      <div class="trace__meta">${esc(s.event || s.code || '')}</div></div>
    </div>`).join('');

    const items = Array.from(list.querySelectorAll('[data-trace]'));
    const focus = (i) => {
      items.forEach((el, j) => el.classList.toggle('is-active', j === i));
      const el = items[i];
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const mount = root.querySelector('#requestFlow');
    const player = new window.FlowPlayer({
      steps, mount,
      onStep: (step, i) => focus(i),
      render: (step) => {
        const lane = lanes.get(step.lane) || { label: step.lane };
        const excerpt = step.code ? EX.get(step.code) : null;
        return `<div class="flow__phase">${esc(step.phase)} · ${esc(lane.label)}</div>
          <h3 class="flow__title">${esc(step.title)}</h3>
          <p class="flow__text">${mdInline(step.detail)}</p>
          <div class="flow__io">
            <div class="flow__io-cell"><div class="flow__io-k">输入</div><div class="flow__io-v">${esc(step.input)}</div></div>
            <div class="flow__io-cell"><div class="flow__io-k">输出</div><div class="flow__io-v">${esc(step.output)}</div></div>
          </div>
          <div class="flow__foot">${step.event ? `<span class="badge badge--violet">${esc(step.event)}</span>` : ''}</div>
          <div class="file-list" style="margin-top:10px">${step.refs.map(fileRef).join('')}</div>
          ${excerpt ? `<div style="margin-top:10px">${codeBlock(excerpt, { max: 260 })}</div>` : ''}`;
      },
    });
    window.App.addCleanup(() => player.destroy());
    items.forEach((el, i) => el.addEventListener('click', () => { player.pause(); player.go(i); }));
    focus(0);

    root.querySelectorAll('[data-track]').forEach(btn => btn.addEventListener('click', () => {
      window.App.go('request', { track: btn.dataset.track });
    }));
  }

  /* ---------- 场景 ---------- */
  function renderScenarios(root, params) {
    const S = D.scenarios;
    const current = S.scenarios.find(s => s.id === (params.s || 'A')) || S.scenarios[0];

    root.innerHTML = `<div class="page">
      ${pageHead('MODULE 06 · SCENARIOS', '场景实验室', S.subtitle,
        `<span class="badge badge--mono">A–H</span><span class="badge badge--amber">能力存在性单独标注</span>`)}
      <div class="scenario-list" style="margin-bottom:16px">
        ${S.scenarios.map(s => `<button class="scenario-btn ${s.id === current.id ? 'is-active' : ''}" data-scenario="${s.id}">
          <div class="scenario-btn__k">场景 ${esc(s.id)} · ${esc(s.key)}</div><div class="scenario-btn__t">${esc(s.title)}</div>
        </button>`).join('')}
      </div>
      <div class="card card--pad" id="scenarioDetail"></div>
    </div>`;

    root.querySelectorAll('[data-scenario]').forEach(btn => btn.addEventListener('click', () => {
      window.App.go('scenarios', { s: btn.dataset.scenario });
    }));

    const host = root.querySelector('#scenarioDetail');
    host.innerHTML = `
      <div class="spread" style="align-items:flex-start;gap:16px">
        <div style="min-width:0">
          <div class="eyebrow">场景 ${esc(current.id)} · ${esc(current.key)}</div>
          <h3 style="font-size:18px;margin:6px 0 6px">${esc(current.title)}</h3>
          <div class="callout" style="margin-bottom:10px"><div class="callout__t">用户输入示例</div>${esc(current.example)}</div>
          <p class="small muted">${mdInline(current.summary)}</p>
          ${LAB_SCENARIO[current.id]
            ? `<div class="row" style="margin-top:10px"><button class="btn btn--primary btn--sm" data-lab="${LAB_SCENARIO[current.id]}">${icon('play', 12)} 在 3D 实验室走一遍</button></div>`
            : '<div class="tiny muted" style="margin-top:10px">后台任务场景暂未制作 3D 版本；其余场景都有。</div>'}
        </div>
        <div class="stack" style="align-items:flex-end;min-width:190px">
          ${statusBadge(current.support)}
          <div class="tiny muted" style="text-align:right;max-width:260px">${mdInline(current.supportNote)}</div>
        </div>
      </div>
      <div class="row" style="margin-top:14px">
        <span class="tiny muted">工具</span>${current.tools.length ? current.tools.map(t => `<span class="chip mono">${esc(t)}</span>`).join('') : '<span class="tiny muted">无</span>'}
        <span class="tiny muted" style="margin-left:8px">事件</span>${current.events.map(e => `<span class="chip mono">${esc(e)}</span>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start">
        <div class="timeline" style="margin-top:4px">
          ${current.steps.map((s, i) => `<div class="tl-item is-clickable" data-scstep="${i}">
            <div class="tl-item__title">${i + 1}. ${esc(s.title)}</div>
            <div class="tl-item__body">${mdInline(s.detail)}</div>
            <button class="tl-item__meta" data-copy="${esc(s.ref)}">${esc(s.ref)}</button>
          </div>`).join('')}
        </div>
        <div>
          <div class="flow" id="scenarioFlow"></div>
          ${current.branches.length ? `<h4 style="margin:16px 0 8px;font-size:12px;color:var(--muted)">分支与异常</h4>
            <div class="stack">${current.branches.map(b => `<div class="callout callout--warn"><div class="callout__t">${esc(b.title)}</div>${mdInline(b.detail)}</div>`).join('')}</div>` : ''}
          <h4 style="margin:16px 0 8px;font-size:12px;color:var(--muted)">最终输出</h4>
          <p class="small muted">${mdInline(current.output)}</p>
        </div>
      </div>`;

    const mount = host.querySelector('#scenarioFlow');
    const player = new window.FlowPlayer({
      steps: current.steps.map((s, i) => ({ ...s, phase: `步骤 ${i + 1}` })), mount,
      onStep: (step, i) => {
        host.querySelectorAll('[data-scstep]').forEach((el, j) => el.classList.toggle('is-active', j === i));
      },
      render: (step) => `<div class="flow__phase">${esc(step.phase)}</div>
        <h3 class="flow__title">${esc(step.title)}</h3>
        <p class="flow__text">${mdInline(step.detail)}</p>
        <div class="flow__foot"><button class="btn btn--ghost btn--sm" data-copy="${esc(step.ref)}">${icon('copy', 12)} ${esc(step.ref)}</button></div>`,
    });
    window.App.addCleanup(() => player.destroy());
  }

  /* ---------- 插件 ---------- */
  function renderPlugins(root) {
    const P = D.plugins;
    root.innerHTML = `<div class="page">
      ${pageHead('MODULE 07 · PLUGINS', '插件系统', P.subtitle,
        `<span class="badge badge--mono">${D.generated.meta.stats.basePlugins} 行 base</span><span class="badge badge--mono">${D.generated.meta.stats.packages} 包</span>`)}
      <div class="callout" style="margin-bottom:16px"><div class="callout__t">组装关系</div>${mdInline(P.intro)}</div>

      ${section('五层组装', '从外到内：profile → bundle → patch → preset → 运行时启停', `<div class="stack">
        ${P.layers.map(l => `<div class="card card--pad" style="display:grid;grid-template-columns:44px 150px minmax(0,1fr) 300px;gap:12px;align-items:center">
          <div class="mono" style="color:var(--accent);font-size:18px">0${l.order}</div>
          <div><div style="font-weight:600">${esc(l.name)}</div><div class="tiny muted mono">${esc(l.where)}</div></div>
          <div class="small muted">${mdInline(l.what)}</div>
          <button class="btn btn--ghost btn--sm" data-copy="${esc(l.ref)}">${icon('copy', 12)} ${esc(l.ref)}</button>
        </div>`).join('')}
      </div>`)}

      ${section('每个 bundle 有多少行', '行数来自 patch 文件里 `- id:` 的计数', `<div class="table-wrap"><table class="data"><thead><tr><th>Bundle</th><th>行数</th><th>被哪些 profile 使用</th><th>职责</th></tr></thead><tbody>
        ${P.bundleCounts.map(b => `<tr><td><code>${esc(b.short)}</code><div class="tiny muted mono">${esc(b.bundle)}</div></td><td class="mono">${b.rows}</td><td>${b.profiles.map(p => `<span class="badge">${esc(p)}</span>`).join(' ')}</td><td class="small muted">${esc(b.role)}</td></tr>`).join('')}
      </tbody></table></div>`)}

      ${section('插件生命周期', '', `<div class="timeline">${P.lifecycle.map((s, i) => `<div class="tl-item"><div class="tl-item__title">${i + 1}. ${esc(s.title)}</div>
        <div class="tl-item__body">${mdInline(s.detail)}</div>
        <button class="tl-item__meta" data-copy="${esc(s.ref)}">${esc(s.ref)}</button></div>`).join('')}</div>`)}

      ${section('base 里都装了什么', '按用途分组的代表行；完整 99 行在源码 patch 文件里', `<div class="grid grid--3">
        ${P.highlights.map(h => `<div class="card card--pad"><div class="eyebrow">${esc(h.group)}</div>
          <div class="row" style="margin-top:8px">${h.rows.map(r => `<span class="chip mono">${esc(r)}</span>`).join('')}</div></div>`).join('')}
      </div>`)}

      ${section('四个设计取舍', '', `<div class="grid grid--2">${P.facts.map(f => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(f.title)}</div><div class="small muted">${mdInline(f.text)}</div></div>`).join('')}</div>`)}
    </div>`;
  }

  /* ---------- 事件 ---------- */
  function renderEvents(root, params) {
    const E = D.events;
    const all = D.generated.events;
    const state = { q: params.q || '', mode: 'all', domain: 'all' };

    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const chains = E.chains.filter(c =>
        (state.domain === 'all' || c.domain === state.domain)
        && (state.mode === 'all' || c.mode === state.mode)
        && (!q || (c.event + c.producer + c.listeners.join(' ')).toLowerCase().includes(q)));
      const rows = all.filter(e =>
        (state.mode === 'all' || e.mode === state.mode)
        && (!q || (e.name + e.listeners.join(' ') + e.declared).toLowerCase().includes(q)));

      root.innerHTML = `<div class="page page--wide">
        ${pageHead('MODULE 08 · EVENTS', '事件系统', E.subtitle,
          `<span class="badge badge--violet">${all.length} 个事件</span><span class="badge badge--mono">${D.generated.meta.stats.sessionEvents} 个 Session 事件</span>
           <button class="btn btn--primary btn--sm" data-lab="loop">${icon('play', 12)} 看事件如何流动</button>`)}
        <div class="grid grid--3" style="margin-bottom:16px">
          ${E.domains.map(d => `<div class="card card--pad"><div class="eyebrow">${esc(d.label)}</div>
            <p class="small muted" style="margin-top:6px">${mdInline(d.text)}</p>
            <div class="row" style="margin-top:8px">${d.examples.map(x => `<span class="chip mono">${esc(x)}</span>`).join('')}</div>
          </div>`).join('')}
        </div>

        <div class="card card--pad" style="margin-bottom:14px">
          <div class="spread" style="align-items:flex-start">
            <div><div class="eyebrow">分发模式</div>
              <div class="row" style="margin-top:8px">${E.modes.map(m => `<span class="chip"><b class="mono" style="color:var(--accent-2)">${esc(m.label)}</b> ${esc(m.text)}</span>`).join('')}</div>
            </div>
          </div>
        </div>

        <div class="row" style="margin-bottom:10px">
          <label class="global-search" style="width:min(380px,50vw)">${icon('search', 14)}<input type="search" placeholder="搜事件、生产者、监听者" value="${esc(state.q)}" data-eq></label>
          <select class="btn btn--sm" data-mode style="padding:0 8px">
            <option value="all">全部模式</option>${E.modes.map(m => `<option value="${m.id}" ${state.mode === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
          <select class="btn btn--sm" data-domain style="padding:0 8px">
            <option value="all">全部域</option>${E.domains.map(d => `<option value="${d.id}" ${state.domain === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}
          </select>
          <span class="section-hint" style="margin-left:auto">事件矩阵取自 docs/event-producer-consumer.md（生成物）</span>
        </div>

        ${section('核心事件链', `${chains.length} 条匹配`, `<div class="card card--pad">${chains.length ? chains.map(c => `<div class="chain">
          <div class="chain__prod">${esc(c.producer)}</div>
          <button class="chain__event" data-chain="${esc(c.event)}">${esc(c.event)} <span class="badge badge--mono">${esc(c.mode)}</span></button>
          <div class="chain__listeners">${c.listeners.slice(0, 8).map(l => `<span class="chain__pill">${esc(l)}</span>`).join('')}${c.listeners.length > 8 ? `<span class="chain__pill">+${c.listeners.length - 8}</span>` : ''}</div>
        </div>`).join('') : '<div class="empty">没有匹配的事件链</div>'}</div>`)}

        ${section('完整事件矩阵', `${rows.length} / ${all.length}`, `<div class="table-wrap table-scroll"><table class="data"><thead><tr><th>事件</th><th>模式</th><th>声明位置</th><th>监听者</th></tr></thead><tbody>
          ${rows.map(e => `<tr data-ev="${esc(e.name)}" style="cursor:pointer"><td><code>${esc(e.name)}</code></td><td><span class="badge">${esc(e.mode)}</span></td><td class="mono tiny">${esc(e.declared)}</td><td class="tiny muted">${esc(e.listeners.slice(0, 6).join(', '))}${e.listeners.length > 6 ? ` +${e.listeners.length - 6}` : ''}</td></tr>`).join('')}
        </tbody></table></div>`)}

        ${section('怎么区分', '', `<div class="grid grid--3">${E.facts.map(f => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(f.title)}</div><div class="small muted">${mdInline(f.text)}</div></div>`).join('')}</div>`)}
      </div>`;

      const input = root.querySelector('[data-eq]');
      input.addEventListener('input', window.UI.debounce(() => {
        state.q = input.value;
        draw();
        const next = root.querySelector('[data-eq]');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      }, 180));
      root.querySelector('[data-mode]').addEventListener('change', (e) => { state.mode = e.target.value; draw(); });
      root.querySelector('[data-domain]').addEventListener('change', (e) => { state.domain = e.target.value; draw(); });
      root.querySelectorAll('[data-chain]').forEach(btn => btn.addEventListener('click', () => {
        const c = E.chains.find(x => x.event === btn.dataset.chain);
        if (c) inspectEventChain(c);
      }));
      root.querySelectorAll('[data-ev]').forEach(tr => tr.addEventListener('click', () => {
        const ev = all.find(x => x.name === tr.dataset.ev);
        if (ev) inspectGeneratedEvent(ev);
      }));
    };
    draw();
  }

  /* ---------- 数据结构 ---------- */
  function renderModels(root) {
    const M = D.models;
    root.innerHTML = `<div class="page">
      ${pageHead('MODULE 09 · DATA', '数据结构与状态流转', M.subtitle,
        `<span class="badge badge--mono">${M.models.length} 个结构</span><span class="badge badge--violet">${M.timeline.events.length} 条事件时间轴</span>`)}
      <div class="grid grid--4">
        ${M.models.map(m => `<button class="card card--hover card--pad" data-model="${m.id}" style="text-align:left">
          <div class="eyebrow">${esc(m.kind)}</div>
          <div style="font-weight:650;font-size:14px;margin:6px 0 4px">${esc(m.name)}</div>
          <div class="tiny muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(m.summary)}</div>
          <div class="tiny mono" style="margin-top:8px;color:var(--faint)">${esc(m.file.split('/').slice(-1)[0])}:${m.line}</div>
        </button>`).join('')}
      </div>

      <div id="modelDetail" style="margin-top:18px"></div>

      ${section('Session 事件时间轴', M.timeline.note, `<div class="card" style="padding:14px 16px">
        <div class="timeline">${M.timeline.events.map((e, i) => `<div class="tl-item is-clickable" data-tlev="${i}">
          <div class="tl-item__title"><span class="mono" style="color:var(--accent-2)">${esc(e.type)}</span>
            <span class="badge badge--mono" style="margin-left:8px">seq ${e.seq}</span>
            <span class="badge" style="margin-left:4px">${esc(e.tag)}</span></div>
          <div class="tl-item__meta">${esc(e.data)}</div>
          ${e.note ? `<div class="tl-item__body">${esc(e.note)}</div>` : ''}
        </div>`).join('')}</div>
      </div>`)}

      ${section('事件日志的三条结论', '', `<div class="grid grid--3">${M.facts.map(f => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(f.title)}</div><div class="small muted">${mdInline(f.text)}</div></div>`).join('')}</div>`)}
    </div>`;

    const detail = root.querySelector('#modelDetail');
    const show = (m) => {
      detail.innerHTML = `<div class="card card--pad">
        <div class="spread"><div><div class="eyebrow">${esc(m.kind)}</div><h3 style="font-size:18px;margin:4px 0">${esc(m.name)}</h3></div>
          <span class="badge badge--mono">${esc(m.file)}:${m.line}</span></div>
        <p class="small muted" style="margin-top:8px">${mdInline(m.summary)}</p>
        <div class="divider"></div>
        <div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(0,0.85fr)">
          <div>
            <div class="eyebrow" style="margin-bottom:6px">字段</div>
            <div class="table-wrap"><table class="data"><thead><tr><th>字段</th><th>类型</th><th>说明</th></tr></thead><tbody>
              ${m.fields.map(f => `<tr><td><code>${esc(f.name)}</code></td><td class="tiny mono">${esc(f.type)}</td><td class="small muted">${esc(f.desc)}</td></tr>`).join('')}
            </tbody></table></div>
            ${m.methods && m.methods.length ? `<div class="eyebrow" style="margin:14px 0 6px">方法 / 行为</div><div class="stack">${m.methods.map(x => `<div><span class="mono small" style="color:var(--accent-2)">${esc(x.name)}</span><div class="tiny muted">${esc(x.desc)}</div></div>`).join('')}</div>` : ''}
          </div>
          <div>
            <div class="eyebrow" style="margin-bottom:6px">生命周期</div>
            <div class="stack small">
              <div><span class="muted">创建：</span>${esc(m.createdBy)}</div>
              <div><span class="muted">更新：</span>${esc(m.updatedBy)}</div>
              <div><span class="muted">消费：</span>${esc(m.consumedBy)}</div>
              <div><span class="muted">生命周期：</span>${esc(m.lifecycle)}</div>
            </div>
            <button class="btn btn--ghost btn--sm" style="margin-top:12px" data-copy="${esc(m.file + ':' + m.line)}">${icon('copy', 12)} 复制 file:line</button>
            <div class="file-list" style="margin-top:10px">${fileRef({ path: m.file, line: m.line })}</div>
          </div>
        </div>
      </div>`;
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    root.querySelectorAll('[data-model]').forEach(btn => btn.addEventListener('click', () => {
      const m = M.models.find(x => x.id === btn.dataset.model);
      if (m) { show(m); inspectModel(m); }
    }));
    root.querySelectorAll('[data-tlev]').forEach(el => el.addEventListener('click', () => {
      const e = M.timeline.events[Number(el.dataset.tlev)];
      inspect({ kind: 'session event', title: esc(e.type), sub: `seq ${e.seq} · ${e.tag}`, body: `<div class="defs"><div class="defs__k">payload</div><div class="defs__v mono">${esc(e.data)}</div></div><p class="small muted" style="margin-top:10px">${esc(e.note || '')}</p>` });
    }));
  }

  /* ---------- 运行模式 ---------- */
  function renderModes(root) {
    const M = D.modes;
    root.innerHTML = `<div class="page page--wide">
      ${pageHead('MODULE 10 · RUNTIME MODES', '运行模式对比', M.subtitle,
        `<span class="badge badge--mono">5 个随附 profile</span><span class="badge badge--mono">+ Desktop</span>`)}
      <div class="callout callout--green" style="margin-bottom:16px"><div class="callout__t">${esc(M.answer.question)}</div>${mdInline(M.answer.text)}</div>
      <div class="grid grid--3">
        ${M.modes.map(m => `<div class="card card--pad">
          <div class="spread"><div style="font-weight:650;font-size:15px">${esc(m.name)}</div><span class="badge badge--mono">${esc(m.profile)}</span></div>
          <div class="tiny mono muted" style="margin-top:6px">${esc(m.rows)}</div>
          <div class="small" style="color:var(--text-2);margin-top:8px">${esc(m.best)}</div>
          <div class="row" style="margin-top:10px">${m.bundles.map(b => `<span class="chip mono">${esc(b.replace('@deepseek-ai/', ''))}</span>`).join('')}</div>
        </div>`).join('')}
      </div>

      ${section('横向对比', '同一份 Agent Loop，不同的插件组合', `<div class="table-wrap"><table class="data">
        <thead><tr><th>维度</th>${M.modes.map(m => `<th>${esc(m.name)}</th>`).join('')}</tr></thead>
        <tbody>${M.matrix.map(row => `<tr><td class="small" style="color:var(--muted)">${esc(row.label)}</td>${row.values.map(v => `<td class="small">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`)}

      ${section('每个模式多出什么', '', `<div class="table-wrap"><table class="data"><thead><tr><th>模式</th><th>专属行 / 服务</th><th>共用</th></tr></thead><tbody>
        ${M.modes.map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${m.special.map(s => `<span class="chip mono" style="margin:2px">${esc(s)}</span>`).join('')}</td><td class="tiny muted">${esc(m.shared.join(' · '))}</td></tr>`).join('')}
      </tbody></table></div>`)}

      ${section('三句话', '', `<div class="grid grid--3">${M.facts.map(f => `<div class="card card--pad"><div style="font-weight:600;font-size:13px;margin-bottom:4px">${esc(f.title)}</div><div class="small muted">${mdInline(f.text)}</div></div>`).join('')}</div>`)}
    </div>`;
  }

  /* ---------- 源码索引 ---------- */
  function renderSources(root, params) {
    const state = { tab: params.pkg ? 'packages' : 'files', q: params.q || '', pkg: params.pkg || '' };
    const coreFiles = [];
    const seen = new Set();
    A.nodes.forEach(n => (n.files || []).forEach(f => {
      const key = f.path + ':' + (f.line || '');
      if (seen.has(key)) return;
      seen.add(key);
      coreFiles.push({ ...f, node: n.id, nodeLabel: n.label });
    }));

    const draw = () => {
      const q = state.q.trim().toLowerCase();
      const files = coreFiles.filter(f => !q || (f.path + ' ' + (f.symbol || '') + ' ' + f.nodeLabel).toLowerCase().includes(q));
      const exs = EXLIST.filter(e => !q || (e.file + ' ' + e.label + ' ' + e.code.slice(0, 400)).toLowerCase().includes(q));
      const pkgs = D.generated.packages.filter(p => !q || (p.name + ' ' + p.dir + ' ' + p.description).toLowerCase().includes(q));

      root.innerHTML = `<div class="page">
        ${pageHead('MODULE 11 · SOURCE INDEX', '源码索引', '所有条目都指向本地源码的真实路径与行号；点击可看已抽取的代码片段，或复制位置回 IDE。',
          `<span class="badge badge--mono">${coreFiles.length} 个核心位置</span><span class="badge badge--mono">${EXLIST.length} 段代码</span><span class="badge badge--mono">${D.generated.packages.length} 个包</span>`)}
        <div class="row" style="margin-bottom:12px">
          <label class="global-search" style="width:min(460px,60vw)">${icon('search', 14)}<input type="search" data-sq placeholder="搜文件、符号、包名…" value="${esc(state.q)}"></label>
          <div class="row">
            <button class="chip ${state.tab === 'files' ? 'is-active' : ''}" data-stab="files">核心位置 <span class="chip__count">${coreFiles.length}</span></button>
            <button class="chip ${state.tab === 'snippets' ? 'is-active' : ''}" data-stab="snippets">代码片段 <span class="chip__count">${EXLIST.length}</span></button>
            <button class="chip ${state.tab === 'packages' ? 'is-active' : ''}" data-stab="packages">全部包 <span class="chip__count">${D.generated.packages.length}</span></button>
          </div>
        </div>
        <div id="srcBody"></div>
      </div>`;

      const input = root.querySelector('[data-sq]');
      input.addEventListener('input', window.UI.debounce(() => {
        state.q = input.value;
        draw();
        const next = root.querySelector('[data-sq]');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      }, 160));
      root.querySelectorAll('[data-stab]').forEach(btn => btn.addEventListener('click', () => { state.tab = btn.dataset.stab; draw(); }));

      const body = root.querySelector('#srcBody');
      if (state.tab === 'files') {
        body.innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>文件</th><th>符号</th><th>所属模块</th><th></th></tr></thead><tbody>
          ${files.slice(0, 300).map(f => `<tr><td><code>${esc(f.path)}${f.line ? ':' + f.line : ''}</code></td><td class="small muted">${esc(f.symbol || '—')}</td>
            <td><button class="chip" data-node="${esc(f.node)}">${esc(f.nodeLabel)}</button></td>
            <td style="text-align:right"><button class="btn btn--ghost btn--sm" data-file="${esc(f.path)}" data-line="${f.line || ''}">查看</button></td></tr>`).join('')}
        </tbody></table></div>`;
      } else if (state.tab === 'snippets') {
        body.innerHTML = `<div class="grid grid--2">${exs.map(ex => `<button class="card card--hover card--pad" data-ex="${esc(ex.id)}" style="text-align:left">
          <div class="eyebrow">${esc(ex.label)}</div>
          <div class="mono tiny muted" style="margin-top:6px">${esc(ex.file)}:${ex.start}–${ex.end}</div>
          <div class="tiny" style="color:var(--text-2);margin-top:8px">${esc((ex.note || '').slice(0, 90))}</div>
        </button>`).join('')}</div>`;
      } else {
        body.innerHTML = `<div class="table-wrap table-scroll"><table class="data"><thead><tr><th>包</th><th>分组</th><th>版本</th><th>说明</th></tr></thead><tbody>
          ${pkgs.slice(0, 400).map(p => `<tr data-pkg="${esc(p.name)}" style="cursor:pointer"><td><code>${esc(p.name)}</code><div class="tiny muted mono">${esc(p.dir)}</div></td>
            <td class="small">${esc(p.group)}</td><td class="mono tiny">${esc(p.version)}</td><td class="small muted">${esc((p.description || '').slice(0, 120))}</td></tr>`).join('')}
        </tbody></table></div>`;
      }

      body.querySelectorAll('[data-ex]').forEach(btn => btn.addEventListener('click', () => {
        const ex = EXLIST.find(e => e.id === btn.dataset.ex);
        if (ex) inspectExcerpt(ex);
      }));
      body.querySelectorAll('[data-pkg]').forEach(tr => tr.addEventListener('click', () => {
        const p = D.generated.packages.find(x => x.name === tr.dataset.pkg);
        if (p) inspectPackage(p);
      }));
    };
    draw();
  }

  /* ---------- 学习进度 ---------- */
  function renderProgress(root) {
    const progress = window.UI.store.get('progress', { visited: [], checks: {} });
    const visited = new Set(progress.visited || []);
    const checks = progress.checks || {};
    const C = D.coverage;
    const toneMap = { ok: 'green', warn: 'amber', muted: '' };
    const doneCount = NAV_PAGES.filter(p => visited.has(p.id)).length;
    const pct = Math.round((doneCount / NAV_PAGES.length) * 100);

    root.innerHTML = `<div class="page">
      ${pageHead('MODULE 12 · PROGRESS', '学习进度', '进度只存在本机 localStorage；清空浏览器数据即重置。',
        `<span class="badge badge--accent">${pct}% 已浏览</span>`)}
      <div class="card card--pad" style="margin-bottom:16px">
        <div class="spread"><span class="small muted">${doneCount} / ${NAV_PAGES.length} 个页面已打开</span><button class="btn btn--ghost btn--sm" id="resetProgress">${icon('reset', 12)} 重置进度</button></div>
        <div class="nav__bar" style="margin-top:10px;height:8px"><i style="width:${pct}%"></i></div>
      </div>

      ${section('页面清单', '点击直接跳转', `<div class="card" style="padding:6px 16px">
        ${NAV_PAGES.map((p, i) => `<div class="progress-item">
          <input type="checkbox" id="chk-${p.id}" data-page-check="${p.id}" ${checks[p.id] ? 'checked' : ''}>
          <label for="chk-${p.id}" style="flex:1;cursor:pointer" data-go="${p.id}">
            <div class="progress-item__t">${String(i + 1).padStart(2, '0')} · ${esc(p.label)} ${visited.has(p.id) ? '<span class="badge badge--green">已浏览</span>' : ''}</div>
            <div class="progress-item__d">${esc(p.hint)}</div>
          </label>
          <button class="btn btn--ghost btn--sm" data-go="${p.id}">打开</button>
        </div>`).join('')}
      </div>`)}

      ${section('覆盖率清单', '来自 data/coverage.json；源码中不存在的能力不会被补造', `<div class="table-wrap"><table class="data"><thead><tr><th>范围</th><th>状态</th><th>说明</th></tr></thead><tbody>
        ${C.items.map(it => `<tr><td class="small">${esc(it.area)}</td><td><span class="badge ${toneMap[(C.statuses.find(s => s.id === it.status) || {}).tone] ? 'badge--' + toneMap[(C.statuses.find(s => s.id === it.status) || {}).tone] : ''}">${esc((C.statuses.find(s => s.id === it.status) || {}).label || it.status)}</span></td><td class="small muted">${esc(it.note)}</td></tr>`).join('')}
      </tbody></table></div>`)}

      ${section('术语表', '第一次出现的词', `<div class="grid grid--3">${D.glossary.terms.map(t => `<button class="card card--hover card--pad" data-term="${esc(t.term)}" style="text-align:left">
        <div style="font-weight:600;font-size:13px">${esc(t.term)}</div>
        <div class="tiny muted" style="margin-top:5px">${esc(t.plain)}</div>
      </button>`).join('')}</div>`)}
    </div>`;

    root.querySelectorAll('[data-page-check]').forEach(input => input.addEventListener('change', () => {
      const next = window.UI.store.get('progress', { visited: [], checks: {} });
      next.checks = next.checks || {};
      next.checks[input.dataset.pageCheck] = input.checked;
      window.UI.store.set('progress', next);
    }));
    root.querySelector('#resetProgress').addEventListener('click', () => {
      window.UI.store.del('progress');
      renderProgress(root);
      window.App.updateNavProgress();
      window.UI.toast('进度已重置');
    });
    root.querySelectorAll('[data-term]').forEach(btn => btn.addEventListener('click', () => {
      const t = D.glossary.terms.find(x => x.term === btn.dataset.term);
      if (t) inspectTerm(t);
    }));
  }

  const RENDERERS = {
    home: renderHome,
    stack: renderStack,
    architecture: renderArchitecture,
    agent: renderAgent,
    loop: renderLoop,
    request: renderRequest,
    scenarios: renderScenarios,
    plugins: renderPlugins,
    events: renderEvents,
    models: renderModels,
    modes: renderModes,
    sources: renderSources,
    progress: renderProgress,
    'execution-lab': (root, params) => window.LabPage.mount(root, params),
  };

  window.Pages = {
    NAV_PAGES,
    META,
    RENDERERS,
    helpers: { inspectNode, inspectEdge, inspectEventChain, inspectGeneratedEvent, inspectTech, inspectPackage, inspectExcerpt, inspectModel, inspectTerm, mdInline },
  };
})();
