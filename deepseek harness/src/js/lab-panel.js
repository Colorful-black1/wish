/* ===== 执行实验室：右侧详情面板（概览 / 数据 / 源码 / 关联） ===== */
(function () {
  'use strict';

  const { esc, icon, codeBlock } = window.UI;
  const D = window.LAB_DATA;
  const A = D.architecture;
  const NODES = new Map(A.nodes.map(n => [n.id, n]));
  const EX = new Map(D.generated.excerpts.map(e => [e.id, e]));
  const CAP_EVENTS = new Map(D.generated.events.map(e => [e.name, e]));
  const SESSION_EVENTS = new Set(D.generated.sessionEvents.map(e => e.name));
  const STATUS = {
    idle: { label: '待命', cls: '' },
    done: { label: '已完成', cls: 'is-done' },
    active: { label: '执行中', cls: 'is-live' },
    error: { label: '异常', cls: 'is-error' },
    approval: { label: '等待审批', cls: 'is-approval' },
    branch: { label: '分支判定', cls: 'is-branch' },
  };

  function jsonHtml(value) {
    const text = JSON.stringify(value, null, 2) || 'null';
    return text.split('\n').map(line => {
      let out = '';
      let last = 0;
      const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g;
      let m;
      while ((m = re.exec(line))) {
        out += esc(line.slice(last, m.index));
        if (m[1]) {
          out += `<span class="${m[2] ? 'tok-key' : 'tok-str'}">${esc(m[1])}</span>${m[2] ? esc(m[2]) : ''}`;
        } else if (m[3]) {
          out += `<span class="tok-k">${esc(m[3])}</span>`;
        } else if (m[4]) {
          out += `<span class="tok-n">${esc(m[4])}</span>`;
        }
        last = m.index + m[0].length;
      }
      return out + esc(line.slice(last));
    }).join('\n');
  }

  function eventChip(name, ctx) {
    const cap = CAP_EVENTS.get(name);
    const kind = SESSION_EVENTS.has(name) ? 'session' : cap ? 'capability' : 'hook';
    const mode = cap ? cap.mode : kind === 'session' ? 'persist' : 'waterfall';
    return `<button class="lab-ev ${kind === 'session' ? 'lab-ev--s' : ''}" data-lp-event="${esc(name)}" title="点击查看事件">
      <span class="lab-ev__name">${esc(name)}</span>
      <span class="lab-ev__mode">${esc(mode)}</span>
    </button>`;
  }

  function statusOf(state, station) {
    const key = state && state.statuses[station.id] ? state.statuses[station.id] : 'idle';
    return STATUS[key] || STATUS.idle;
  }

  function neighbors(scenario, beatIndex) {
    if (!scenario || beatIndex < 0) return { prev: null, next: null };
    return {
      prev: scenario.beats[beatIndex - 1] || null,
      next: scenario.beats[beatIndex + 1] || null,
    };
  }

  function render(host, ctx) {
    const { station, beat, scenario, state, task, tab } = ctx;
    const st = statusOf(state, station);
    const pathIndex = typeof ctx.beatIndex === 'number' && ctx.beatIndex >= 0
      ? ctx.beatIndex
      : scenario ? scenario.beats.findIndex(b => b.s === station.id) : -1;
    const nb = neighbors(scenario, pathIndex);
    const data = ctx.data;
    const text = ctx.text;
    const links = station.links || [];
    const source = beat && beat.src ? (typeof beat.src === 'string' ? EX.get(beat.src) : beat.src) : null;
    const ex = source || EX.get(station.source.excerpt);
    const node = NODES.get(station.node);
    const inEdges = A.edges.filter(e => e.to === station.node).slice(0, 6);
    const outEdges = A.edges.filter(e => e.from === station.node).slice(0, 6);
    const events = [...(station.events || []).map(e => e.name)];
    if (beat && beat.ev) beat.ev.forEach(name => { if (!events.includes(name)) events.push(name); });

    host.innerHTML = `
      <div class="lab-panel__head">
        <div class="lab-panel__no">${esc(station.no)}</div>
        <div class="lab-panel__id">
          <div class="lab-panel__name">${esc(station.name)} <span>${esc(station.en)}</span></div>
          <div class="lab-panel__mod">${esc(station.module)}${beat && beat.cycle ? ` · ${esc(beat.cycle)}` : ''}</div>
        </div>
        <span class="lab-status ${st.cls}">${esc(st.label)}</span>
      </div>
      <div class="lab-tabs" role="tablist" aria-label="站台详情">
        ${[['overview', '概览'], ['data', '数据'], ['source', '源码'], ['links', '关联']].map(([id, label]) =>
          `<button class="lab-tab ${tab === id ? 'is-active' : ''}" data-lp-tab="${id}" role="tab" aria-selected="${tab === id}">${label}</button>`).join('')}
      </div>
      <div class="lab-panel__body">
        ${tab === 'overview' ? `
          ${beat ? `<div class="lab-block">
            <div class="lab-block__k">${state.index === ctx.beatIndex ? '此刻' : '路径上的这一步'} · ${esc(beat.p)}</div>
            <div class="lab-block__t">${esc(text.title)}</div>
            <p>${esc(text.detail)}</p>
          </div>` : `<div class="lab-block"><div class="lab-block__k">站台说明</div><div class="lab-block__t">${esc(station.name)}</div><p>${esc(station.summary)}</p></div>`}
          <div class="lab-io">
            <div><div class="lab-io__k">输入</div><div class="lab-io__v">${esc(text.input)}</div></div>
            <div><div class="lab-io__k">输出</div><div class="lab-io__v">${esc(text.output)}</div></div>
          </div>
          <div class="lab-taskline"><span>当前任务</span><b>${esc(task || scenario.example)}</b></div>
          <div class="lab-sec"><h4>这一站做什么</h4><p>${esc(station.what)}</p></div>
          <div class="lab-sec"><h4>为什么需要它</h4><p>${esc(station.why)}</p></div>
          <div class="lab-sec"><h4>它在流程里的位置</h4>
            ${pathIndex >= 0 ? `<div class="lab-flowline">
              ${nb.prev ? `<button class="lab-mini" data-lp-station="${esc(nb.prev.s)}">← ${esc(stationName(nb.prev.s))}</button>` : '<span class="lab-mini is-muted">起点</span>'}
              <span class="lab-flowline__now">${esc(station.name)}</span>
              ${nb.next ? `<button class="lab-mini" data-lp-station="${esc(nb.next.s)}">${esc(stationName(nb.next.s))} →</button>` : '<span class="lab-mini is-muted">终点</span>'}
            </div>` : `<p class="lab-note">这个站台不在当前场景的路径上。换一个场景，或从「关联」进入事件与源码。</p>`}
          </div>
          <div class="lab-meta">
            <div><span>源码</span><button class="lab-src" data-lp-file="${esc(station.source.file)}" data-line="${station.source.line}">${esc(station.source.file)}:${station.source.line}</button></div>
            <div><span>架构节点</span>${node ? `<button class="lab-mini" data-lp-node="${esc(node.id)}">${esc(node.label)}</button>` : '—'}</div>
            <div><span>数据类型</span><span class="lab-types">${(station.types || []).map(t => `<code>${esc(t)}</code>`).join('')}</span></div>
          </div>
        ` : ''}

        ${tab === 'data' ? `
          <div class="lab-sim"><b>SIMULATED</b> 教学模拟数据</div>
          <p class="lab-note">字段名参考源码类型定义；值、耗时、token 与模型回复不是真实运行结果。事件与源码位置是真实核对过的。</p>
          <div class="lab-datahead">
            <span>${esc(beat ? `${beat.p} · ${beat.t}` : '站台默认样本')}</span>
            <button class="lab-mini" data-lp-copy-json>${icon('copy', 11)} 复制 JSON</button>
          </div>
          <pre class="lab-json">${jsonHtml(data)}</pre>
          <div class="lab-types" style="margin-top:10px">${(station.types || []).map(t => `<code>${esc(t)}</code>`).join('')}</div>
        ` : ''}

        ${tab === 'source' ? `
          <div class="lab-sec">
            <h4>源码位置</h4>
            <div class="lab-filecard">
              <button class="lab-src" data-lp-file="${esc(ex.file)}" data-line="${ex.start}">${esc(ex.file)}</button>
              <div class="lab-filecard__meta">
                <span>${esc(station.source.symbol)}</span>
                <span>L${ex.start}–${ex.end}</span>
                <button class="lab-mini" data-lp-copy="${esc(ex.file + ':' + station.source.line)}">${icon('copy', 11)} 复制位置</button>
              </div>
            </div>
          </div>
          ${codeBlock(ex, { max: 420 })}
          <div class="lab-sec">
            <h4>调用 / 依赖（架构图依据）</h4>
            ${inEdges.length ? `<div class="lab-edges"><div class="lab-edges__k">上游</div>${inEdges.map(e => `<button class="lab-edge" data-lp-node="${esc(e.from)}"><b>${esc(NODES.get(e.from)?.label || e.from)}</b><span>${esc(e.label || e.kind)}</span></button>`).join('')}</div>` : ''}
            ${outEdges.length ? `<div class="lab-edges"><div class="lab-edges__k">下游</div>${outEdges.map(e => `<button class="lab-edge" data-lp-node="${esc(e.to)}"><b>${esc(NODES.get(e.to)?.label || e.to)}</b><span>${esc(e.label || e.kind)}</span></button>`).join('')}</div>` : ''}
            ${!inEdges.length && !outEdges.length ? '<p class="lab-note">这个站台没有登记架构边；它的真实关系写在上面的符号与事件里。</p>' : ''}
          </div>
          ${(station.hooks || []).length ? `<div class="lab-sec"><h4>瀑布钩子</h4>${station.hooks.map(h => `<div class="lab-hook"><code>${esc(h.name)}</code><span>${esc(h.mode)}</span><button class="lab-src" data-lp-copy="${esc(h.ref)}">${esc(h.ref)}</button></div>`).join('')}</div>` : ''}
          <div class="lab-sec">
            <button class="lab-wide" data-lp-go="sources" data-q="${esc(station.source.file)}">${icon('code', 13)} 在源码索引中查看</button>
          </div>
        ` : ''}

        ${tab === 'links' ? `
          <div class="lab-sec">
            <h4>关联事件 <span class="lab-count">${events.length}</span></h4>
            ${events.length ? `<div class="lab-events">${events.map(n => eventChip(n, ctx)).join('')}</div>` : '<p class="lab-note">这个站台本身不广播事件；它的结果体现在上游/下游的事件里。</p>'}
          </div>
          <div class="lab-sec">
            <h4>关联包 <span class="lab-count">${(station.packages || []).length}</span></h4>
            <div class="lab-pkgs">${(station.packages || []).map(p => `<button class="lab-pkg" data-lp-pkg="${esc(p)}">${esc(p.replace('@deepseek-ai/', ''))}</button>`).join('')}</div>
          </div>
          <div class="lab-sec">
            <h4>进入源码知识库</h4>
            <div class="lab-links">
              ${links.map(l => `<button class="lab-link" data-lp-go="${esc(l.page)}" data-params="${esc(JSON.stringify(l.params || {}))}">
                <span>${esc(l.label)}</span><span class="lab-link__arrow">→</span>
              </button>`).join('')}
            </div>
          </div>
          <div class="lab-sec">
            <h4>真实运行追踪</h4>
            <p class="lab-note"><b>${esc(D.executionLab.meta.realTrace.label)}</b>：${esc(D.executionLab.meta.realTrace.text)}</p>
          </div>
          <div class="lab-sec">
            <h4>模拟口径与渲染</h4>
            <p class="lab-note">${esc(D.executionLab.meta.disclaimer)}</p>
            <p class="lab-note" style="margin-top:6px">${esc(D.executionLab.meta.rendering)}</p>
          </div>
        ` : ''}
      </div>`;

    // 事件绑定
    host.querySelectorAll('[data-lp-tab]').forEach(btn => btn.addEventListener('click', () => ctx.onTab(btn.dataset.lpTab)));
    host.querySelectorAll('[data-lp-station]').forEach(btn => btn.addEventListener('click', () => ctx.onSelect(btn.dataset.lpStation)));
    host.querySelectorAll('[data-lp-node]').forEach(btn => btn.addEventListener('click', () => ctx.go('architecture', { node: btn.dataset.lpNode })));
    host.querySelectorAll('[data-lp-go]').forEach(btn => {
      btn.addEventListener('click', () => ctx.go(btn.dataset.lpGo, btn.dataset.params ? JSON.parse(btn.dataset.params) : btn.dataset.q ? { q: btn.dataset.q } : {}));
    });
    host.querySelectorAll('[data-lp-file]').forEach(btn => btn.addEventListener('click', () => ctx.source(btn.dataset.lpFile, Number(btn.dataset.line) || 0)));
    host.querySelectorAll('[data-lp-copy]').forEach(btn => btn.addEventListener('click', () => window.UI.copy(btn.dataset.lpCopy, '位置')));
    host.querySelectorAll('[data-lp-copy-json]').forEach(btn => btn.addEventListener('click', () => window.UI.copy(JSON.stringify(data, null, 2), 'JSON')));
    host.querySelectorAll('[data-lp-event]').forEach(btn => btn.addEventListener('click', () => {
      const name = btn.dataset.lpEvent;
      if (SESSION_EVENTS.has(name)) ctx.go('models');
      else ctx.go('events', { q: name });
    }));
    host.querySelectorAll('[data-lp-pkg]').forEach(btn => btn.addEventListener('click', () => ctx.go('sources', { pkg: btn.dataset.lpPkg, q: btn.dataset.lpPkg })));
  }

  function stationName(id) {
    const s = D.executionLab.stations.find(x => x.id === id);
    return s ? s.name : id;
  }

  window.LabPanel = { render, jsonHtml };
})();
