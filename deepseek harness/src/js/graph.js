/* ===== 轻量 SVG 架构图：布局、拖拽、缩放、搜索、过滤、全屏 ===== */
(function () {
  'use strict';
  const { esc, icon } = window.UI;

  const LAYER_COLORS = {
    entry: '#5aa2ff',
    boot: '#a78bfa',
    agent: '#4fc48a',
    capability: '#56c8d8',
    data: '#e3b25f',
    surface: '#e8737d',
  };
  const KIND_COLORS = {
    step: '#5aa2ff',
    event: '#a78bfa',
    decision: '#e3b25f',
    error: '#e8737d',
    entry: '#5aa2ff',
    service: '#4fc48a',
    store: '#e3b25f',
    config: '#a78bfa',
    transport: '#56c8d8',
    ui: '#e8737d',
    adapter: '#56c8d8',
    runtime: '#a78bfa',
  };

  const NODE_W = 168;
  const NODE_H = 58;
  const MAX_ROWS = 7;

  const truncate = (s, n) => (String(s || '').length > n ? String(s).slice(0, n - 1) + '…' : String(s || ''));

  function layoutLayered(nodes, layerOrder) {
    const order = layerOrder && layerOrder.length ? layerOrder : [...new Set(nodes.map(n => n.layer))];
    const byLayer = new Map(order.map(l => [l, []]));
    nodes.forEach(n => {
      if (!byLayer.has(n.layer)) byLayer.set(n.layer, []);
      byLayer.get(n.layer).push(n);
    });
    const positions = new Map();
    let x = 70;
    let maxY = 0;
    for (const layer of order) {
      const list = byLayer.get(layer) || [];
      const columns = Math.ceil(list.length / MAX_ROWS) || 1;
      list.forEach((node, i) => {
        const col = Math.floor(i / MAX_ROWS);
        const row = i % MAX_ROWS;
        const px = x + col * (NODE_W + 26);
        const py = 54 + row * (NODE_H + 26);
        positions.set(node.id, { x: px, y: py });
        maxY = Math.max(maxY, py + NODE_H);
      });
      x += columns * (NODE_W + 26) + 18;
    }
    return { positions, width: x, height: maxY + 60 };
  }

  function layoutManual(nodes) {
    const positions = new Map();
    let maxX = 0;
    let maxY = 0;
    nodes.forEach(node => {
      const pos = { x: Number(node.x) || 0, y: Number(node.y) || 0 };
      positions.set(node.id, pos);
      maxX = Math.max(maxX, pos.x + NODE_W);
      maxY = Math.max(maxY, pos.y + NODE_H);
    });
    return { positions, width: maxX + 80, height: maxY + 120 };
  }

  class GraphView {
    constructor(container, options = {}) {
      this.el = container;
      this.nodes = (options.nodes || []).map(n => ({ ...n }));
      this.edges = (options.edges || []).map((e, i) => ({ ...e, _i: i }));
      this.nodeById = new Map(this.nodes.map(n => [n.id, n]));
      this.onNode = options.onNode || (() => {});
      this.onEdge = options.onEdge || (() => {});
      this.layerOrder = options.layerOrder || [];
      this.legend = options.legend !== false;
      this.hint = options.hint || '滚轮缩放 · 拖拽平移';
      this.activeId = null;
      this.selectedId = null;
      this.hoverId = null;
      this.visible = null;
      this.search = '';
      this.tx = 0; this.ty = 0; this.scale = 1;
      this.minScale = 0.25; this.maxScale = 2.6;
      this.dragNode = null;
      this.panning = null;
      this.moved = false;
      this._build();
      this.fit();
      this._observe();
    }

    _build() {
      const layout = this.nodes.some(n => Number.isFinite(n.x))
        ? layoutManual(this.nodes)
        : layoutLayered(this.nodes, this.layerOrder);
      this.width = layout.width;
      this.height = layout.height;
      layout.positions.forEach((pos, id) => {
        const node = this.nodeById.get(id);
        if (node) { node.x = pos.x; node.y = pos.y; }
      });

      const wrap = document.createElement('div');
      wrap.className = 'graph';
      wrap.innerHTML = `
        <svg role="img" aria-label="${esc(this.el.dataset.label || '架构图')}">
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#3b526a"/></marker>
            <marker id="arr-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#5aa2ff"/></marker>
            <marker id="arr-w" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#e3b25f"/></marker>
            <marker id="arr-e" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#e8737d"/></marker>
          </defs>
          <g class="viewport">
            <g class="edges"></g>
            <g class="nodes"></g>
          </g>
        </svg>
        <div class="graph__toolbar"></div>
        <div class="graph__zoom">
          <button data-zoom="-1" aria-label="缩小">${icon('minus', 14)}</button>
          <span data-zoom-label>100%</span>
          <button data-zoom="1" aria-label="放大">${icon('plus', 14)}</button>
          <button data-fit aria-label="适配画布">${icon('fit', 14)}</button>
          <button data-fs aria-label="全屏查看">${icon('expand', 14)}</button>
        </div>
        ${this.legend ? '<div class="graph__legend"></div>' : ''}
        <div class="graph__hint">${esc(this.hint)}</div>`;
      this.el.innerHTML = '';
      this.el.appendChild(wrap);
      this.wrap = wrap;
      this.svg = wrap.querySelector('svg');
      this.viewport = wrap.querySelector('.viewport');
      this.edgeLayer = wrap.querySelector('.edges');
      this.nodeLayer = wrap.querySelector('.nodes');
      this.zoomLabel = wrap.querySelector('[data-zoom-label]');
      this._renderToolbar();
      this._renderLegend();
      this._renderNodes();
      this._renderEdges();
      this._bind();
      this._applyTransform();
    }

    _renderToolbar() {
      const bar = this.wrap.querySelector('.graph__toolbar');
      bar.innerHTML = `
        <label class="searchbox">${icon('search', 13)}
          <input type="search" placeholder="搜索节点 / 方法 / 文件" aria-label="搜索节点、方法或文件">
        </label>
        <button class="chip" data-fit-view>${icon('fit', 12)} 适配</button>
        <button class="chip" data-toggle-labels>${icon('layers', 12)} 标签</button>`;
      const input = bar.querySelector('input');
      input.addEventListener('input', () => this.setSearch(input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; this.setSearch(''); input.blur(); } });
      bar.querySelector('[data-fit-view]').addEventListener('click', () => { this.clearSelection(); this.fit(); });
      bar.querySelector('[data-toggle-labels]').addEventListener('click', (e) => {
        this.wrap.classList.toggle('show-labels');
        e.currentTarget.classList.toggle('is-active');
      });
    }

    _renderLegend() {
      const legend = this.wrap.querySelector('.graph__legend');
      if (!legend) return;
      const layers = this.layerOrder.length
        ? this.layerOrder.map(id => ({ id, label: ({ entry: '入口', boot: '装配', agent: 'Agent', capability: '能力', data: '数据', surface: '界面/通信' })[id] || id }))
        : [];
      const loop = this.edges.some(e => e.kind === 'loop')
        ? `<span><i style="background:transparent;border-top:2px dashed #e3b25f"></i>回边/循环</span>`
        : '';
      legend.innerHTML = layers.map(l => `<span><i style="background:${LAYER_COLORS[l.id] || '#7b8da3'}"></i>${esc(l.label)}</span>`).join('') + loop;
    }

    _renderNodes() {
      const frag = [];
      for (const node of this.nodes) {
        const color = LAYER_COLORS[node.layer] || KIND_COLORS[node.kind] || '#7b8da3';
        const badge = node.kind === 'event' ? 'EVENT' : node.kind === 'decision' ? 'DECISION' : node.kind === 'error' ? 'ERROR' : '';
        frag.push(`<g class="g-node g-node--${esc(node.kind || 'step')}" data-id="${esc(node.id)}" transform="translate(${node.x},${node.y})" tabindex="0" role="button" aria-label="${esc(node.label)}">
          <title>${esc(node.label)}${node.sub ? ' · ' + esc(node.sub) : ''}</title>
          <rect class="g-node__box" width="${NODE_W}" height="${NODE_H}" rx="9"></rect>
          <rect class="g-node__accent" x="0" y="10" width="3.5" height="${NODE_H - 20}" rx="2" fill="${color}"></rect>
          <text class="g-node__label" x="14" y="${node.sub ? 24 : 33}">${esc(truncate(node.label, 22))}</text>
          ${node.sub ? `<text class="g-node__sub" x="14" y="40">${esc(truncate(node.sub, 26))}</text>` : ''}
          ${badge ? `<text class="g-node__badge" x="${NODE_W - 10}" y="13" text-anchor="end">${esc(truncate(badge, 9))}</text>` : ''}
        </g>`);
      }
      this.nodeLayer.innerHTML = frag.join('');
      this.nodeEls = new Map();
      this.nodeLayer.querySelectorAll('.g-node').forEach(el => {
        const id = el.getAttribute('data-id');
        this.nodeEls.set(id, el);
        el.addEventListener('pointerdown', (e) => this._nodePointerDown(e, id));
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.moved) return;
          this.select(id);
          this.onNode(this.nodeById.get(id));
        });
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select(id); this.onNode(this.nodeById.get(id)); }
        });
        el.addEventListener('mouseenter', () => this._highlight(id, true));
        el.addEventListener('mouseleave', () => this._highlight(null, true));
      });
    }

    _edgeGeometry(edge) {
      const a = this.nodeById.get(edge.from);
      const b = this.nodeById.get(edge.to);
      if (!a || !b) return null;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      let sx; let sy; let tx; let ty; let c1x; let c1y; let c2x; let c2y;

      if (Math.abs(dx) < 40 && dy >= 0) {
        // 同列向下：短竖线
        sx = a.x + NODE_W / 2; sy = a.y + NODE_H;
        tx = b.x + NODE_W / 2; ty = b.y;
        c1x = sx; c1y = sy + 26; c2x = tx; c2y = ty - 26;
      } else if (Math.abs(dx) < 40 && dy < 0) {
        // 同列向上：从右侧绕回（少见）
        sx = a.x + NODE_W; sy = a.y + NODE_H / 2;
        tx = b.x + NODE_W; ty = b.y + NODE_H / 2;
        c1x = sx + 46; c1y = sy; c2x = tx + 46; c2y = ty;
      } else if (dx > 40) {
        // 向右：右中 → 左中
        sx = a.x + NODE_W; sy = a.y + NODE_H / 2;
        tx = b.x; ty = b.y + NODE_H / 2;
        const mid = (sx + tx) / 2;
        c1x = mid; c1y = sy; c2x = mid; c2y = ty;
      } else if (edge.kind === 'loop') {
        // 回边：从底部绕回
        sx = a.x + NODE_W / 2; sy = a.y + NODE_H;
        tx = b.x + NODE_W / 2; ty = b.y + NODE_H;
        const drop = 60 + Math.abs(dy) * 0.12;
        c1x = sx; c1y = sy + drop; c2x = tx; c2y = ty + drop;
      } else {
        // 向左：左中 → 右中（同一行的反向流动）
        sx = a.x; sy = a.y + NODE_H / 2;
        tx = b.x + NODE_W; ty = b.y + NODE_H / 2;
        const mid = (sx + tx) / 2;
        c1x = mid; c1y = sy; c2x = mid; c2y = ty;
      }
      const d = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
      return { d, mx: (sx + tx) / 2, my: (sy + ty) / 2, sx, sy, tx, ty };
    }

    _renderEdges() {
      const frag = [];
      for (const edge of this.edges) {
        const geo = this._edgeGeometry(edge);
        if (!geo) continue;
        const kindCls = edge.kind === 'loop' ? ' g-edge--loop' : edge.kind === 'error' ? ' g-edge--error' : edge.kind === 'event' ? ' g-edge--event' : '';
        const marker = edge.kind === 'loop' ? 'arr-w' : edge.kind === 'error' ? 'arr-e' : 'arr';
        frag.push(`<g class="g-edge${kindCls}" data-i="${edge._i}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}">
          <path d="${geo.d}" marker-end="url(#${marker})"></path>
          <path class="g-edge__hit" d="${geo.d}" stroke="transparent" stroke-width="14" fill="none"></path>
          <text class="g-edge__label" x="${geo.mx}" y="${geo.my - 5}" text-anchor="middle">${esc(truncate(edge.label || '', 30))}</text>
        </g>`);
      }
      this.edgeLayer.innerHTML = frag.join('');
      this.edgeEls = Array.from(this.edgeLayer.querySelectorAll('.g-edge'));
      this.edgeEls.forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const edge = this.edges[Number(el.getAttribute('data-i'))];
          this._activateEdge(edge, el);
          this.onEdge(edge, { x: e.clientX, y: e.clientY });
        });
      });
    }

    _activateEdge(edge, el) {
      this.edgeEls.forEach(e => e.classList.remove('is-active'));
      el.classList.add('is-active');
    }

    _bind() {
      this.svg.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.g-node')) return;
        this.panning = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty };
        this.moved = false;
        this.wrap.classList.add('is-panning');
        this.svg.setPointerCapture(e.pointerId);
      });
      this.svg.addEventListener('pointermove', (e) => {
        if (this.dragNode) {
          const dx = (e.clientX - this.dragNode.px) / this.scale;
          const dy = (e.clientY - this.dragNode.py) / this.scale;
          if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;
          const node = this.nodeById.get(this.dragNode.id);
          node.x = this.dragNode.nx + dx;
          node.y = this.dragNode.ny + dy;
          this._renderEdges();
          this.nodeEls.get(node.id).setAttribute('transform', `translate(${node.x},${node.y})`);
          return;
        }
        if (!this.panning) return;
        const dx = e.clientX - this.panning.x;
        const dy = e.clientY - this.panning.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
        this.tx = this.panning.tx + dx;
        this.ty = this.panning.ty + dy;
        this._applyTransform();
      });
      const end = () => {
        this.panning = null;
        this.dragNode = null;
        this.wrap.classList.remove('is-panning');
        setTimeout(() => { this.moved = false; }, 30);
      };
      this.svg.addEventListener('pointerup', end);
      this.svg.addEventListener('pointercancel', end);
      this.svg.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = this.svg.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        this._zoomAt(px, py, factor);
      }, { passive: false });

      this.wrap.querySelector('[data-zoom]')?.parentElement.querySelectorAll('[data-zoom]').forEach(btn => {
        btn.addEventListener('click', () => {
          const dir = Number(btn.getAttribute('data-zoom'));
          const rect = this.svg.getBoundingClientRect();
          this._zoomAt(rect.width / 2, rect.height / 2, dir > 0 ? 1.2 : 1 / 1.2);
        });
      });
      this.wrap.querySelector('[data-fit]')?.addEventListener('click', () => this.fit());
      this.wrap.querySelector('[data-fs]')?.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else this.wrap.requestFullscreen?.().then(() => setTimeout(() => this.fit(), 80)).catch(() => {});
      });
    }

    _nodePointerDown(e, id) {
      if (e.button !== 0) return;
      const node = this.nodeById.get(id);
      this.dragNode = { id, px: e.clientX, py: e.clientY, nx: node.x, ny: node.y };
      this.moved = false;
      this.svg.setPointerCapture(e.pointerId);
      e.stopPropagation();
    }

    _zoomAt(px, py, factor) {
      const next = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
      const k = next / this.scale;
      this.tx = px - (px - this.tx) * k;
      this.ty = py - (py - this.ty) * k;
      this.scale = next;
      this._applyTransform();
    }

    _applyTransform() {
      this.viewport.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.scale})`);
      if (this.zoomLabel) this.zoomLabel.textContent = Math.round(this.scale * 100) + '%';
    }

    fit() {
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width || !rect.height) { requestAnimationFrame(() => this.fit()); return; }
      const pad = 24;
      const scale = Math.min((rect.width - pad * 2) / this.width, (rect.height - pad * 2) / this.height, 1.1);
      this.scale = Math.max(0.22, scale);
      this.tx = (rect.width - this.width * this.scale) / 2;
      this.ty = (rect.height - this.height * this.scale) / 2;
      this._applyTransform();
    }

    centerOn(id) {
      const node = this.nodeById.get(id);
      if (!node) return;
      const rect = this.svg.getBoundingClientRect();
      this.tx = rect.width / 2 - (node.x + NODE_W / 2) * this.scale;
      this.ty = rect.height / 2 - (node.y + NODE_H / 2) * this.scale;
      this._applyTransform();
    }

    select(id) {
      this.selectedId = id;
      this.nodeEls.forEach((el, nid) => el.classList.toggle('is-selected', nid === id));
      this._highlight(id, false);
    }

    clearSelection() {
      this.selectedId = null;
      this.nodeEls.forEach(el => el.classList.remove('is-selected'));
      this._highlight(null, false);
    }

    _neighbors(id) {
      const set = new Set([id]);
      this.edges.forEach(e => {
        if (e.from === id) set.add(e.to);
        if (e.to === id) set.add(e.from);
      });
      return set;
    }

    _highlight(id, hover) {
      if (!id) {
        this.nodeEls.forEach(el => el.classList.remove('is-dim', 'is-neighbor'));
        this.edgeEls.forEach(el => el.classList.remove('is-dim', 'is-active'));
        if (this.selectedId) this._highlight(this.selectedId, false);
        return;
      }
      const near = this._neighbors(id);
      this.nodeEls.forEach((el, nid) => {
        el.classList.toggle('is-dim', !near.has(nid));
        el.classList.toggle('is-neighbor', near.has(nid) && nid !== id);
      });
      this.edgeEls.forEach(el => {
        const active = el.getAttribute('data-from') === id || el.getAttribute('data-to') === id;
        el.classList.toggle('is-active', active);
        el.classList.toggle('is-dim', !active);
      });
    }

    setActive(id) {
      this.activeId = id;
      this.nodeEls.forEach((el, nid) => el.classList.toggle('g-node--active', nid === id));
      this.nodeEls.forEach(el => el.classList.remove('is-dim'));
      this.edgeEls.forEach(el => el.classList.remove('is-dim', 'is-active'));
    }

    setSearch(query) {
      this.search = String(query || '').trim().toLowerCase();
      if (!this.search) {
        this.nodeEls.forEach(el => el.classList.remove('is-dim', 'is-hit'));
        this.edgeEls.forEach(el => el.classList.remove('is-dim'));
        if (this.selectedId) this._highlight(this.selectedId, false);
        return;
      }
      const hits = new Set();
      this.nodes.forEach(n => {
        const hay = [n.label, n.sub, n.id, n.api, n.duty, (n.files || []).map(f => f.path).join(' ')].join(' ').toLowerCase();
        if (hay.includes(this.search)) hits.add(n.id);
      });
      this.nodeEls.forEach((el, id) => {
        el.classList.toggle('is-hit', hits.has(id));
        el.classList.toggle('is-dim', !hits.has(id));
      });
      this.edgeEls.forEach(el => el.classList.add('is-dim'));
      if (hits.size === 1) this.centerOn([...hits][0]);
    }

    setVisible(predicate) {
      this.visible = predicate;
      this.nodeEls.forEach((el, id) => {
        const show = !predicate || predicate(this.nodeById.get(id));
        el.style.opacity = show ? '' : '0';
        el.style.pointerEvents = show ? '' : 'none';
      });
      this.edgeEls.forEach(el => {
        const from = this.nodeById.get(el.getAttribute('data-from'));
        const to = this.nodeById.get(el.getAttribute('data-to'));
        const show = !predicate || (predicate(from) && predicate(to));
        el.style.opacity = show ? '' : '0';
        el.style.pointerEvents = show ? '' : 'none';
      });
    }

    _observe() {
      let raf = 0;
      const ro = new ResizeObserver(() => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => this.fit());
      });
      ro.observe(this.el);
      this._ro = ro;
      document.addEventListener('fullscreenchange', () => setTimeout(() => this.fit(), 80));
    }

    destroy() {
      if (this._ro) this._ro.disconnect();
      this.el.innerHTML = '';
    }
  }

  window.GraphView = GraphView;
  window.GRAPH_LAYER_COLORS = LAYER_COLORS;
})();
