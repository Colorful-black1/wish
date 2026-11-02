/* ============================================================================
 * viz3d.js —— 三维向量空间渲染器（Canvas 2D）
 *
 * 为什么不用 three.js：本机 CDN 全部不可达（TLS 拦截），又不想让你为了打开一个
 * 讲解页去装 node_modules。于是手写了一个足够用的「伪 3D」：
 *   · 透视投影 + 深度排序 + 深度雾化
 *   · 拖拽旋转 / 滚轮缩放 / 悬停高亮 / 点击选中
 *   · 查询点呼吸光晕、命中连线、HNSW 访问轨迹
 * 所有坐标来自 engine.js 的 PCA 投影，点的远近**真的**对应 64 维余弦相似度。
 * ========================================================================== */

(function (global) {
  "use strict";

  const TAU = Math.PI * 2;

  function hexToRgba(hex, a) {
    const h = String(hex || "#22d3ee").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /** 生成一张带径向渐变的发光点贴图，按颜色缓存，避免每帧创建渐变。 */
  function makeSprite(color) {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,0.98)");
    g.addColorStop(0.22, hexToRgba(color, 0.98));
    g.addColorStop(0.55, hexToRgba(color, 0.32));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  class VectorScene {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{onHover?:Function,onSelect?:Function}} handlers
     * @param {{yaw?:number,pitch?:number,distance?:number}} opts 相机初值（跨阶段重绘时保持视角）
     */
    constructor(canvas, handlers, opts) {
      const o = opts || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.handlers = handlers || {};
      this.points = [];
      this.query = null;
      this.links = [];
      this.linkPaths = [];
      this.visited = new Set();
      this.visitedPaths = [];
      this.path = [];
      this.selection = new Set();
      this.hovered = null;
      this.yaw = o.yaw == null ? 0.6 : o.yaw;
      this.pitch = o.pitch == null ? -0.28 : o.pitch;
      this.distance = o.distance == null ? 3.1 : o.distance;
      this.focal = 900;
      this.autoRotate = true;
      this.dragging = false;
      this.moved = 0;
      this.lastX = 0;
      this.lastY = 0;
      this.lastInteract = 0;
      this.sprites = new Map();
      this.raf = 0;
      this.time = 0;
      this.visible = true;
      this.reduced = global.matchMedia ? global.matchMedia("(prefers-reduced-motion: reduce)").matches : false;

      this._onDown = this._onDown.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onUp = this._onUp.bind(this);
      this._onWheel = this._onWheel.bind(this);
      this._onLeave = this._onLeave.bind(this);
      this._tick = this._tick.bind(this);

      canvas.addEventListener("pointerdown", this._onDown);
      canvas.addEventListener("pointermove", this._onMove);
      canvas.addEventListener("pointerup", this._onUp);
      canvas.addEventListener("pointerleave", this._onLeave);
      canvas.addEventListener("wheel", this._onWheel, { passive: false });

      this.tooltip = document.createElement("div");
      this.tooltip.className = "scene-tip";
      this.tooltip.hidden = true;
      canvas.parentElement.appendChild(this.tooltip);

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas.parentElement);
      this.resize();
      this._tick();
    }

    /** 重新测量画布尺寸（含 DPR），父容器变化时调用。 */
    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      this.w = Math.max(80, rect.width);
      this.h = Math.max(80, rect.height);
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.canvas.style.width = this.w + "px";
      this.canvas.style.height = this.h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.focal = Math.min(this.w, this.h) * 1.45;
    }

    /** 设置点云。points: [{id,coord:[x,y,z],color,label,meta}] */
    setPoints(points) {
      this.points = (points || []).map((p) => Object.assign({}, p));
      this.sprites = new Map();
      this._rebuild();
    }

    /** 设置查询点坐标与标签。 */
    setQuery(coord, label) {
      this.query = coord ? { coord, label: label || "query" } : null;
    }

    /** 高亮命中项：links 决定连线和编号颜色。 */
    setLinks(items) {
      this.links = (items || []).map((it, i) => ({
        id: it.id,
        rank: it.rank || i + 1,
        color: it.color || "#fbbf24",
        score: it.score
      }));
      this._rebuildLinks();
    }

    /** 设置「已访问节点」与搜索轨迹（HNSW 动画用）。 */
    setTrace(visitedIds, pathEdges) {
      this.visited = new Set(visitedIds || []);
      this.path = (pathEdges || []).slice(0, 260);
      this._rebuildLinks();
    }

    /** 选中（外部联动，比如点了检索结果列表）。 */
    setSelection(ids) {
      this.selection = new Set(ids || []);
    }

    /** 用 id 找点，外部联动需要。 */
    pointById(id) {
      return this.points.find((p) => p.id === id);
    }

    _rebuild() {
      this.byId = new Map(this.points.map((p) => [p.id, p]));
    }

    _rebuildLinks() {
      this.linkPaths = this.links
        .map((l) => ({ ...l, target: this.byId.get(l.id) }))
        .filter((l) => l.target);
      this.visitedPaths = this.path
        .map((e) => ({ a: this.byId.get(e.a), b: this.byId.get(e.b), level: e.level }))
        .filter((e) => e.a && e.b);
    }

    _sprite(color) {
      if (!this.sprites.has(color)) this.sprites.set(color, makeSprite(color));
      return this.sprites.get(color);
    }

    /** 相机变换：先绕 Y 轴 yaw，再绕 X 轴 pitch，最后透视投影。 */
    _project(p) {
      const cy = Math.cos(this.yaw);
      const sy = Math.sin(this.yaw);
      const cp = Math.cos(this.pitch);
      const sp = Math.sin(this.pitch);
      let x = p[0];
      let y = p[1];
      let z = p[2];
      // yaw
      let x1 = x * cy + z * sy;
      let z1 = -x * sy + z * cy;
      // pitch
      let y1 = y * cp - z1 * sp;
      let z2 = y * sp + z1 * cp;
      const depth = this.distance - z2;
      const scale = this.focal / Math.max(0.35, depth);
      return {
        x: this.w / 2 + x1 * scale,
        y: this.h / 2 - y1 * scale,
        z: depth,
        scale
      };
    }

    _onDown(e) {
      this.dragging = true;
      this.moved = 0;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastInteract = performance.now();
      this.canvas.setPointerCapture(e.pointerId);
    }

    _onMove(e) {
      if (this.dragging) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.yaw += dx * 0.008;
        this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch + dy * 0.006));
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastInteract = performance.now();
        this._hideTip();
        return;
      }
      const hit = this._pick(e);
      if ((hit && hit.id) !== (this.hovered && this.hovered.id)) {
        this.hovered = hit;
        this.canvas.style.cursor = hit ? "pointer" : "grab";
        if (hit) this._showTip(hit, e);
        else this._hideTip();
        if (this.handlers.onHover) this.handlers.onHover(hit ? hit.id : null);
      } else if (hit) {
        this._placeTip(e);
      }
    }

    _onUp(e) {
      if (this.dragging && this.moved < 5) {
        const hit = this._pick(e);
        if (hit && this.handlers.onSelect) this.handlers.onSelect(hit.id);
      }
      this.dragging = false;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* 指针已经释放，忽略 */
      }
    }

    _onLeave() {
      this.dragging = false;
      this.hovered = null;
      this._hideTip();
    }

    _onWheel(e) {
      e.preventDefault();
      this.distance = Math.max(1.45, Math.min(6.5, this.distance + e.deltaY * 0.0016));
      this.lastInteract = performance.now();
    }

    /** 屏幕最近点命中测试（14px 内）。 */
    _pick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best = null;
      let bestD = 15;
      this.points.forEach((p) => {
        const s = this._project(p.coord);
        const d = Math.hypot(s.x - mx, s.y - my);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      });
      if (this.query) {
        const s = this._project(this.query.coord);
        if (Math.hypot(s.x - mx, s.y - my) < 12) return { id: "__query__", label: "查询向量", color: "#f0fdfa" };
      }
      return best;
    }

    _showTip(p, e) {
      if (!p) return;
      const meta = p.meta || {};
      this.tooltip.innerHTML =
        '<div class="tip-top"><span class="tip-dot" style="background:' +
        (p.color || "#22d3ee") +
        '"></span><span class="tip-sec">' +
        escapeHtml(meta.section || p.label || "") +
        '</span></div>' +
        (meta.text ? '<div class="tip-text">' + escapeHtml(meta.text.slice(0, 120)) + "</div>" : "") +
        (meta.score != null ? '<div class="tip-score">相似度 ' + Number(meta.score).toFixed(3) + "</div>" : "");
      this.tooltip.hidden = false;
      this._placeTip(e);
    }

    _placeTip(e) {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      let x = e.clientX - rect.left + 14;
      let y = e.clientY - rect.top + 14;
      if (x + 240 > rect.width) x = Math.max(8, x - 260);
      if (y + 90 > rect.height) y = Math.max(8, y - 96);
      this.tooltip.style.transform = `translate(${x}px, ${y}px)`;
    }

    _hideTip() {
      this.tooltip.hidden = true;
    }

    _tick() {
      this.raf = requestAnimationFrame(this._tick);
      if (!this.visible) return;
      const now = performance.now();
      this.time = now;
      if (this.autoRotate && !this.reduced && !this.dragging && now - this.lastInteract > 2600) {
        this.yaw += 0.0016;
      }
      this._draw();
    }

    _draw() {
      const ctx = this.ctx;
      const w = this.w;
      const h = this.h;
      ctx.clearRect(0, 0, w, h);

      // 背景：中心极淡的径向光 + 语义空间参考球
      const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.65);
      bg.addColorStop(0, "rgba(28,45,64,0.42)");
      bg.addColorStop(0.55, "rgba(10,16,24,0.5)");
      bg.addColorStop(1, "rgba(6,9,13,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      this._drawGlobe(ctx);

      // 搜索轨迹（HNSW 访问过的边）
      if (this.visitedPaths && this.visitedPaths.length) {
        ctx.lineWidth = 0.8;
        this.visitedPaths.forEach((e) => {
          const a = this._project(e.a.coord);
          const b = this._project(e.b.coord);
          ctx.strokeStyle = e.level > 0 ? "rgba(125,211,252,0.16)" : "rgba(125,211,252,0.075)";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
      }

      // 查询 → 命中 的连线
      if (this.query) {
        const q = this._project(this.query.coord);
        this.linkPaths.forEach((l) => {
          const t = this._project(l.target.coord);
          const grad = ctx.createLinearGradient(q.x, q.y, t.x, t.y);
          grad.addColorStop(0, hexToRgba(l.color, 0.5));
          grad.addColorStop(1, hexToRgba(l.color, 0.03));
          ctx.strokeStyle = grad;
          ctx.lineWidth = l.rank <= 3 ? 1.25 : 0.7;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        });
      }

      // 查询点先画（在下层），否则它会盖住语义最近的 1、2 名编号
      let qp = null;
      if (this.query) {
        qp = this._project(this.query.coord);
        const pulse = this.reduced ? 0 : (Math.sin(this.time / 520) + 1) / 2;
        ctx.strokeStyle = `rgba(240,253,250,${0.22 + pulse * 0.18})`;
        ctx.lineWidth = 1;
        [16, 24 + pulse * 10].forEach((r) => {
          ctx.beginPath();
          ctx.arc(qp.x, qp.y, r, 0, TAU);
          ctx.stroke();
        });
        const sprite = this._sprite("#f0fdfa");
        ctx.drawImage(sprite, qp.x - 13, qp.y - 13, 26, 26);
        ctx.fillStyle = "#04121a";
        ctx.beginPath();
        ctx.arc(qp.x, qp.y, 5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#f0fdfa";
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      // 按深度从远到近画点
      const projected = this.points.map((p) => ({ p, s: this._project(p.coord) }));
      projected.sort((a, b) => b.s.z - a.s.z);
      const focusRank = new Map(this.links.map((l) => [l.id, l.rank]));
      const focusColor = new Map(this.links.map((l) => [l.id, l.color]));
      const labels = [];

      projected.forEach(({ p, s }) => {
        const isVisited = this.visited && this.visited.has(p.id);
        const rank = focusRank.get(p.id);
        const selected = this.selection.has(p.id);
        const hovered = this.hovered && this.hovered.id === p.id;
        const depthFade = Math.max(0.32, Math.min(1, 3.2 / s.z));
        const base = rank ? 20 : isVisited ? 12 : 9;
        const size = Math.max(4, Math.min(34, (base * s.scale) / 180));
        const alpha = rank ? 1 : selected ? 1 : isVisited ? 0.85 : 0.55 * depthFade;
        const color = rank ? focusColor.get(p.id) : p.color;
        const sprite = this._sprite(color);
        ctx.globalAlpha = hovered ? 1 : alpha;
        ctx.drawImage(sprite, s.x - size / 2, s.y - size / 2, size, size);
        ctx.globalAlpha = 1;

        // ANN 访问过的点：加一圈青色，能和没访问过的点区分开
        if (isVisited && !rank) {
          ctx.strokeStyle = "rgba(94,234,212,.42)";
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.arc(s.x, s.y, size * 0.55 + 2, 0, TAU);
          ctx.stroke();
        }

        if (rank) {
          ctx.strokeStyle = hexToRgba(focusColor.get(p.id), 0.55);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, size * 0.55 + 3, 0, TAU);
          ctx.stroke();
          labels.push({ x: s.x, y: s.y, rank, color: focusColor.get(p.id) });
        }
        if (selected && !rank) {
          ctx.strokeStyle = "rgba(255,255,255,0.65)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(s.x, s.y, size * 0.6 + 3, 0, TAU);
          ctx.stroke();
        }
      });

      // 排名徽标：做简单的避让 —— 语义相近的点会挤在一起，编号直接叠放就没法看了
      labels.sort((a, b) => a.rank - b.rank);
      const placed = [];
      labels.forEach((l) => {
        let px = l.x;
        let py = l.y;
        let tries = 0;
        while (tries < 14 && placed.some((q) => Math.hypot(q.x - px, q.y - py) < 17)) {
          const step = Math.ceil(tries / 2) * 0.95;
          const ang = -Math.PI / 2 + (tries % 2 === 0 ? 1 : -1) * step;
          const rad = 16 + Math.floor(tries / 4) * 6;
          px = l.x + Math.cos(ang) * rad;
          py = l.y + Math.sin(ang) * rad;
          tries++;
        }
        placed.push({ x: px, y: py });
        if (Math.hypot(px - l.x, py - l.y) > 2) {
          ctx.strokeStyle = hexToRgba(l.color, 0.3);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(l.x, l.y);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
        ctx.fillStyle = "#0a0f15";
        ctx.beginPath();
        ctx.arc(px, py, 7.5, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = hexToRgba(l.color, 0.9);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#eaf4ff";
        ctx.font = "600 9px ui-monospace, Consolas, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(l.rank), px, py + 0.5);
      });

      // 说明：查询点不在画布上写文字标签 —— 顶部图例已经标了「查询」，
      // 写在点位旁边会和 Top-1/2 的编号叠在一起（实测很难看）。
    }

    /** 淡淡的三维参考球（经纬线），给出空间纵深感。 */
    _drawGlobe(ctx) {
      const R = 1.02;
      const rings = [];
      for (let i = -2; i <= 2; i++) {
        const phi = (i / 3) * (Math.PI / 2);
        const ring = [];
        for (let k = 0; k <= 48; k++) {
          const th = (k / 48) * TAU;
          ring.push([Math.cos(phi) * Math.cos(th) * R, Math.sin(phi) * R, Math.cos(phi) * Math.sin(th) * R]);
        }
        rings.push(ring);
      }
      for (let i = 0; i < 4; i++) {
        const th = (i / 4) * Math.PI;
        const ring = [];
        for (let k = 0; k <= 48; k++) {
          const phi = -Math.PI / 2 + (k / 48) * Math.PI;
          ring.push([Math.cos(phi) * Math.cos(th) * R, Math.sin(phi) * R, Math.cos(phi) * Math.sin(th) * R]);
        }
        rings.push(ring);
      }
      ctx.lineWidth = 0.6;
      rings.forEach((ring) => {
        ctx.beginPath();
        ring.forEach((p, i) => {
          const s = this._project(p);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.strokeStyle = "rgba(110,150,190,0.075)";
        ctx.stroke();
      });
    }

    setVisible(v) {
      this.visible = v;
    }

    /** 返回相机参数，供下一次重建时恢复视角。 */
    getCamera() {
      return { yaw: this.yaw, pitch: this.pitch, distance: this.distance };
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      this.ro.disconnect();
      this.canvas.removeEventListener("pointerdown", this._onDown);
      this.canvas.removeEventListener("pointermove", this._onMove);
      this.canvas.removeEventListener("pointerup", this._onUp);
      this.canvas.removeEventListener("pointerleave", this._onLeave);
      this.canvas.removeEventListener("wheel", this._onWheel);
      if (this.tooltip.parentElement) this.tooltip.remove();
    }
  }

  /** 转义 HTML，避免语料里的尖括号破坏结构。 */
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  global.VectorScene = VectorScene;
})(window);
