/* ===== 执行实验室：轻量 3D 场景（透视投影 + 深度排序 + Canvas 2D） ===== */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const COLOR = {
    cyan: [86, 214, 255], blue: [90, 162, 255], violet: [167, 139, 250],
    teal: [80, 210, 190], green: [79, 196, 138], amber: [227, 178, 95],
    aqua: [86, 200, 224], orange: [240, 150, 90], red: [232, 115, 125],
    magenta: [214, 120, 220], accent: [120, 170, 255],
  };
  const STATUS_TEXT = { active: '执行中', done: '已完成', error: '异常', approval: '等待审批', branch: '分支判定', idle: '待命' };
  const BODY_H = {
    terminal: 1.0, gateway: 1.5, vault: 1.2, inbox: 0.8, tower: 2.0, lens: 1.5,
    grid: 1.0, prism: 1.5, engine: 1.5, waves: 1.6, doc: 1.0, split: 1.4,
    press: 1.2, gate: 1.7, tray: 0.9, loop: 1.1, log: 1.2, portal: 1.8,
    spawn: 1.3, core: 2.4,
  };

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  class LabScene {
    constructor(canvas, tagLayer, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.tagLayer = tagLayer;
      this.stations = options.stations;
      this.stationMap = new Map(this.stations.map(s => [s.id, s]));
      this.onSelect = options.onSelect || (() => {});
      this.onHover = options.onHover || (() => {});

      this.cam = {
        yaw: -0.44, pitch: 0.5, dist: 30, zoom: 1,
        target: [-1.2, 1.0, 0.4],
        goal: [-1.2, 1.0, 0.4],
      };
      this.defaultCam = JSON.parse(JSON.stringify({ yaw: this.cam.yaw, pitch: this.cam.pitch, dist: 30, target: [-1.2, 1.0, 0.4] }));
      this.focal = 720;
      this.autoFollow = true;
      this.scenario = null;
      this.state = null;
      this.pointer = null;
      this.hoverId = null;
      this.edges = [];
      this.edgeMap = new Map();
      this.tags = new Map();
      this.flowOrder = new Map(this.stations.map((s, i) => [s.id, i]));
      this.now = 0;
      this._raf = 0;
      this._destroyed = false;
      this.w = 1; this.h = 1; this.dpr = 1;
      this.center = [0, 0, 0];

      this.buildTags();
      this.bind();
      this.resize();
      this.selectedId = null;
      if (window.ResizeObserver) {
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(this.canvas.parentElement);
      }
      this._onWindowResize = () => this.resize();
      window.addEventListener('resize', this._onWindowResize);
      this.loop = this.loop.bind(this);
      this._raf = requestAnimationFrame(this.loop);
    }

    /* ---------- 尺寸与标签 ---------- */
    buildTags() {
      this.tagLayer.innerHTML = '';
      this.tags.clear();
      for (const station of this.stations) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'lab-tag';
        el.dataset.station = station.id;
        el.innerHTML = `<span class="lab-tag__no">${station.no}</span>
          <span class="lab-tag__name">${station.name}</span>
          <span class="lab-tag__dot" aria-hidden="true"></span>
          <span class="lab-tag__state">待命</span>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); this.onSelect(station.id); });

        el.addEventListener('mouseenter', () => { this.hoverId = station.id; });
        el.addEventListener('mouseleave', () => { if (this.hoverId === station.id) this.hoverId = null; });
        this.tagLayer.appendChild(el);
        this.tags.set(station.id, el);
      }
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.w = Math.max(1, Math.round(rect.width));
      this.h = Math.max(1, Math.round(rect.height));
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.compact = this.w < 620;
      this.cam.zoom = clamp(this.w / 940, this.compact ? 0.4 : 0.74, 1.25);
      if (this.scenario && !this._manual) this.fitCamera(false);
    }

    /* ---------- 场景与状态 ---------- */
    setScenario(scenario) {
      this.scenario = scenario;
      this._manual = false;
      const single = new Map();
      const beats = scenario ? scenario.beats : [];
      for (let i = 0; i < beats.length - 1; i++) {
        const a = beats[i].s;
        const b = beats[i + 1].s;
        if (a === b) continue;
        const key = a + '>' + b;
        if (!single.has(key)) single.set(key, { a, b, count: 0, loop: this.isLoopEdge(a, b) });
        single.get(key).count++;
      }
      this.edges = [...single.values()];
      this.edgeMap = single;
      this.computeCenter();
    }

    isLoopEdge(a, b) {
      const ia = this.flowOrder.get(a);
      const ib = this.flowOrder.get(b);
      return ia !== undefined && ib !== undefined && ib < ia && ia < 18 && ib < 18;
    }

    computeCenter() {
      const ids = this.scenario ? new Set(this.scenario.beats.map(b => b.s)) : new Set(this.stations.map(s => s.id));
      const pts = this.stations.filter(s => ids.has(s.id)).map(s => s.pos);
      if (!pts.length) return;
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      pts.forEach(p => {
        for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
      });
      this.center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2 + 1.1, (min[2] + max[2]) / 2];
      this.cam.goal = this.center.slice();
      this.fitCamera();
    }

    fitCamera(immediate = true) {
      if (!this.w || !this.h) return;
      const ids = this.scenario ? new Set(this.scenario.beats.map(b => b.s)) : new Set(this.stations.map(s => s.id));
      const pts = this.stations.filter(s => ids.has(s.id)).map(s => [s.pos[0], s.pos[1] + 2.4, s.pos[2]]);
      if (!pts.length) return;
      this.cam.zoom = clamp(this.w / 940, this.compact ? 0.4 : 0.74, 1.25);
      this.cam.target = this.center.slice();
      this.cam.goal = this.center.slice();
      let dist = 34;

      // 透视会把远端压小，简单居中世界坐标并不等于画面居中；
      // 这里做三轮「投影 → 量边界 → 平移目标 → 缩放到可用宽度」。
      for (let iter = 0; iter < 3; iter++) {
        this.cam.dist = dist;
        const qs = pts.map(p => this.project(p)).filter(Boolean);
        if (!qs.length) return;
        const minX = Math.min(...qs.map(q => q.x));
        const maxX = Math.max(...qs.map(q => q.x));
        const minY = Math.min(...qs.map(q => q.y));
        const maxY = Math.max(...qs.map(q => q.y));
        const avgS = qs.reduce((n, q) => n + q.s, 0) / qs.length;
        const dx = this.w / 2 - (minX + maxX) / 2;
        const dy = this.h * 0.51 - (minY + maxY) / 2;
        this.cam.target[0] -= dx / (Math.cos(this.cam.yaw) * avgS);
        this.cam.target[1] += dy / (Math.cos(this.cam.pitch) * avgS);
        const availW = this.w - (this.compact ? 92 : 200);
        const availH = this.h - (this.compact ? 90 : 210);
        const ratio = Math.max((maxX - minX) / availW, (maxY - minY) / availH);
        if (ratio > 0.15) dist = clamp(dist * ratio * 1.04, 16, 64);
        this.cam.goal = this.cam.target.slice();
      }
      this.cam.dist = dist;
      this.cam.target[2] = this.center[2];
      this.cam.goal = this.cam.target.slice();
      this.fitTarget = this.cam.target.slice();
      if (immediate) this.defaultDist = dist;
    }

    setSelected(id) {
      this.selectedId = id || null;
      this.syncTags();
    }

    setState(state, focus) {
      this.state = state;
      if (focus && this.autoFollow && state.active) {
        const s = this.stationMap.get(state.active);
        if (s) {
          // 在「构图中心」上做轻微跟随，并夹住位移，避免镜头走到边缘把两侧站台裁掉
          const base = this.fitTarget || this.center;
          this.cam.goal = [
            clamp(base[0] + (s.pos[0] - this.center[0]) * 0.18, base[0] - 0.9, base[0] + 0.9),
            clamp(base[1] + (s.pos[1] + 0.8 - this.center[1]) * 0.18, base[1] - 0.6, base[1] + 0.6),
            clamp(base[2] + (s.pos[2] - this.center[2]) * 0.18, base[2] - 1.0, base[2] + 1.0),
          ];
        }
      }
      this.syncTags();
    }

    selectStation(id) {
      const s = this.stationMap.get(id);
      if (!s) return;
      this.autoFollow = false;
      this._manual = true;
      this.cam.goal = [s.pos[0], s.pos[1] + 1.0, s.pos[2]];
      this.cam.dist = Math.min(this.cam.dist, 25);
    }

    resetView() {
      this._manual = false;
      this.cam.yaw = this.defaultCam.yaw;
      this.cam.pitch = this.defaultCam.pitch;
      this.cam.goal = (this.fitTarget || this.center).slice();
      this.fitCamera(true);
      this.autoFollow = true;
      this.onHover('follow', true);
    }

    setFollow(on) {
      this.autoFollow = Boolean(on);
      if (this.autoFollow && this.state && this.state.active) this.setState(this.state, true);
    }

    /* ---------- 交互 ---------- */
    bind() {
      const canvas = this.canvas;
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);
        this.pointer = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: 0 };
      });
      canvas.addEventListener('pointermove', (e) => {
        if (this.pointer) {
          const dx = e.clientX - this.pointer.x;
          const dy = e.clientY - this.pointer.y;
          this.pointer.moved += Math.abs(dx) + Math.abs(dy);
          this.pointer.x = e.clientX;
          this.pointer.y = e.clientY;
          if (this.pointer.moved > 3) {
            this.cam.yaw -= dx * 0.0055;
            this.cam.pitch = clamp(this.cam.pitch + dy * 0.004, 0.06, 1.12);
            this.autoFollow = false;
            this._manual = true;
            this.onHover('follow', false);
            canvas.classList.add('is-dragging');
          }
        } else {
          const id = this.hitTest(e.offsetX, e.offsetY);
          this.hoverId = id;
          this.onHover('hover', id);
          canvas.style.cursor = id ? 'pointer' : 'grab';
        }
      });
      const end = () => {
        if (this.pointer && this.pointer.moved <= 3) {
          const id = this.hitTest(this.pointer.x - canvas.getBoundingClientRect().left, this.pointer.y - canvas.getBoundingClientRect().top);
          if (id) this.onSelect(id);
        }
        this.pointer = null;
        canvas.classList.remove('is-dragging');
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', () => { this.pointer = null; canvas.classList.remove('is-dragging'); });
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.cam.dist = clamp(this.cam.dist * (1 + e.deltaY * 0.0012), 14, 52);
        this._manual = true;
      }, { passive: false });
      canvas.addEventListener('dblclick', () => this.resetView());
    }

    hitTest(x, y) {
      let best = null;
      for (const s of this.stations) {
        const p = this.project([s.pos[0], s.pos[1] + (BODY_H[s.kind] || 1) * 0.5, s.pos[2]]);
        if (!p) continue;
        const r = Math.max(16, 34 * p.s / 28);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < r && (!best || p.depth < best.depth)) best = { id: s.id, depth: p.depth };
      }
      return best ? best.id : null;
    }

    /* ---------- 投影 ---------- */
    project(p) {
      const { yaw, pitch, dist, zoom, target } = this.cam;
      let x = p[0] - target[0];
      let y = p[1] - target[1];
      let z = p[2] - target[2];
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const x1 = x * cy - z * sy;
      const z1 = x * sy + z * cy;
      const cp = Math.cos(pitch), sp = Math.sin(pitch);
      const y1 = y * cp - z1 * sp;
      const z2 = y * sp + z1 * cp;
      const depth = dist - z2;
      if (depth < 0.8) return null;
      const s = (this.focal / depth) * zoom;
      return { x: this.w / 2 + x1 * s, y: this.h * 0.55 - y1 * s, s, depth };
    }

    /* ---------- 主循环 ---------- */
    loop(t) {
      if (this._destroyed) return;
      this.now = t;
      this.frame(t);
      this._raf = requestAnimationFrame(this.loop);
    }

    frame(t) {
      const ctx = this.ctx;
      const w = this.w, h = this.h;
      ctx.clearRect(0, 0, w, h);

      // 相机缓动
      const cam = this.cam;
      for (let i = 0; i < 3; i++) cam.target[i] += (cam.goal[i] - cam.target[i]) * 0.075;
      this.drawBackdrop(ctx, w, h);
      this.drawFloor(ctx);
      this.drawEdges(ctx, t);
      this.drawStations(ctx, t);
      this.drawParticles(ctx, t);
      this.syncTags();
    }

    drawBackdrop(ctx, w, h) {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 20, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(22,48,78,0.55)');
      g.addColorStop(0.55, 'rgba(8,18,32,0.25)');
      g.addColorStop(1, 'rgba(3,8,15,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // 固定星尘
      if (!this._dust) {
        this._dust = [];
        let seed = 7;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        for (let i = 0; i < 90; i++) this._dust.push([rnd() * 44 - 22, rnd() * 9 - 1, rnd() * 26 - 16, rnd()]);
      }
      for (const [x, y, z, r] of this._dust) {
        const p = this.project([x, y, z]);
        if (!p) continue;
        ctx.fillStyle = `rgba(140,190,255,${0.06 + r * 0.18})`;
        ctx.fillRect(p.x, p.y, 1.2, 1.2);
      }
    }

    drawFloor(ctx) {
      const y = 0.02;
      ctx.lineWidth = 1;
      for (let x = -24; x <= 24; x += 4) {
        const a = this.project([x, y, -14]);
        const b = this.project([x, y, 16]);
        if (!a || !b) continue;
        const alpha = 0.035 + 0.035 * (1 - Math.min(1, Math.abs(x) / 26));
        ctx.strokeStyle = `rgba(90,140,200,${alpha})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (let z = -12; z <= 16; z += 4) {
        const a = this.project([-24, y, z]);
        const b = this.project([24, y, z]);
        if (!a || !b) continue;
        ctx.strokeStyle = 'rgba(90,140,200,0.045)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // 中央环
      const c = this.project([0, y + 0.01, 0]);
      if (c) {
        ctx.save();
        ctx.strokeStyle = 'rgba(90,170,255,0.10)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 10]);
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * TAU;
          const p = this.project([Math.cos(a) * 15, y, Math.sin(a) * 15]);
          if (!p) continue;
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    edgeCurve(a, b) {
      const sa = this.stationMap.get(a), sb = this.stationMap.get(b);
      if (!sa || !sb) return null;
      const start = [sa.pos[0], sa.pos[1] + 1.05, sa.pos[2]];
      const end = [sb.pos[0], sb.pos[1] + 1.05, sb.pos[2]];
      const loop = this.isLoopEdge(a, b);
      const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 + (loop ? 7.2 : 2.2), (start[2] + end[2]) / 2];
      if (loop) { mid[2] -= 3.4; mid[0] -= 1.2; }
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const u = 1 - t;
        pts.push([
          u * u * start[0] + 2 * u * t * mid[0] + t * t * end[0],
          u * u * start[1] + 2 * u * t * mid[1] + t * t * end[1],
          u * u * start[2] + 2 * u * t * mid[2] + t * t * end[2],
        ]);
      }
      return pts;
    }

    drawEdges(ctx, t) {
      const state = this.state;
      const trail = new Set((state ? state.trail : []).map(([a, b]) => a + '>' + b));
      const current = state && state.trail.length ? state.trail[state.trail.length - 1].join('>') : null;
      for (const edge of this.edges) {
        const pts = this.edgeCurve(edge.a, edge.b);
        if (!pts) continue;
        const isTrail = trail.has(edge.a + '>' + edge.b);
        const isCurrent = current === edge.a + '>' + edge.b;
        const loop = edge.loop;
        const proj = pts.map(p => this.project(p)).filter(Boolean);
        if (proj.length < 2) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.beginPath();
        proj.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        // 管道底影，让路线在深色地面上有实体感
        ctx.save();
        ctx.beginPath();
        proj.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.strokeStyle = 'rgba(40, 70, 105, 0.28)';
        ctx.lineWidth = isCurrent ? 7 : 5;
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.lineCap = 'round';
        ctx.beginPath();
        proj.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        if (isCurrent) {
          ctx.strokeStyle = loop ? 'rgba(255,200,110,0.98)' : 'rgba(150,240,255,0.98)';
          ctx.lineWidth = 3.2;
          ctx.shadowColor = loop ? 'rgba(227,178,95,0.9)' : 'rgba(100,220,255,0.9)';
          ctx.shadowBlur = 18;
        } else if (isTrail) {
          ctx.strokeStyle = loop ? 'rgba(227,178,95,0.58)' : 'rgba(110,195,250,0.5)';
          ctx.lineWidth = 2.2;
          ctx.shadowColor = loop ? 'rgba(227,178,95,0.35)' : 'rgba(80,180,240,0.35)';
          ctx.shadowBlur = 7;
        } else {
          ctx.strokeStyle = loop ? 'rgba(227,178,95,0.22)' : 'rgba(130,175,225,0.2)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([3, 7]);
        }
        ctx.stroke();
        ctx.restore();

        // 流动虚线
        if (isTrail || isCurrent) {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.setLineDash([2, 12]);
          ctx.lineDashOffset = -((t * 0.045) % 14);
          ctx.strokeStyle = isCurrent ? 'rgba(200,245,255,0.85)' : 'rgba(140,200,255,0.28)';
          ctx.lineWidth = isCurrent ? 2 : 1.2;
          ctx.beginPath();
          proj.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
          ctx.stroke();
          ctx.restore();
        }

        if (loop && isTrail) {
          const mid = proj[Math.floor(proj.length / 2)];
          ctx.save();
          ctx.font = '10px "Microsoft YaHei", sans-serif';
          const label = '下一 Step';
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = 'rgba(30,22,10,0.75)';
          ctx.strokeStyle = 'rgba(227,178,95,0.45)';
          ctx.lineWidth = 1;
          const rx = mid.x - tw / 2 - 6, ry = mid.y - 16;
          ctx.beginPath();
          ctx.roundRect(rx, ry, tw + 12, 17, 5);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(245,215,150,0.95)';
          ctx.fillText(label, mid.x - tw / 2, ry + 12);
          ctx.restore();
        }
      }
    }

    drawStations(ctx, t) {
      const state = this.state;
      const list = this.stations
        .map(s => ({ s, p: this.project([s.pos[0], s.pos[1], s.pos[2]]) }))
        .filter(o => o.p)
        .sort((a, b) => b.p.depth - a.p.depth);
      for (const { s, p } of list) {
        const status = state && state.statuses[s.id] ? state.statuses[s.id] : 'idle';
        this.drawStation(ctx, s, p, status, t);
      }
    }

    drawStation(ctx, s, p, status, t) {
      const color = COLOR[s.color] || COLOR.accent;
      const active = status === 'active';
      const done = status === 'done';
      const error = status === 'error';
      const approval = status === 'approval';
      const branch = status === 'branch';
      const tint = error ? COLOR.red : approval || branch ? COLOR.amber : color;
      const lit = active || error || approval || branch;
      const R = 1.0 * p.s;
      const baseY = p.y;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.004 + p.depth);

      // 地面光晕
      const halo = ctx.createRadialGradient(p.x, baseY + 1, 2, p.x, baseY + 1, R * 2.2);
      halo.addColorStop(0, rgba(tint, lit ? 0.26 : done ? 0.12 : 0.06));
      halo.addColorStop(1, rgba(tint, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(p.x, baseY + 2, R * 2.2, R * 0.8, 0, 0, TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(p.x, baseY);
      ctx.scale(1.16, 1.16);
      ctx.translate(-p.x, -baseY);

      // 平台：六棱柱
      const hex = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        hex.push(this.project([s.pos[0] + Math.cos(a) * 1.05, s.pos[1] + 0.26, s.pos[2] + Math.sin(a) * 1.05]));
      }
      const base = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        base.push(this.project([s.pos[0] + Math.cos(a) * 1.05, s.pos[1] + 0.02, s.pos[2] + Math.sin(a) * 1.05]));
      }
      if (hex.every(Boolean) && base.every(Boolean)) {
        for (let i = 0; i < 6; i++) {
          const j = (i + 1) % 6;
          ctx.beginPath();
          ctx.moveTo(hex[i].x, hex[i].y);
          ctx.lineTo(hex[j].x, hex[j].y);
          ctx.lineTo(base[j].x, base[j].y);
          ctx.lineTo(base[i].x, base[i].y);
          ctx.closePath();
          ctx.fillStyle = rgba(tint, 0.05);
          ctx.fill();
        }
        ctx.beginPath();
        hex.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
        ctx.closePath();
        ctx.fillStyle = rgba(tint, lit ? 0.20 : 0.10);
        ctx.fill();
        ctx.strokeStyle = rgba(tint, lit ? 0.8 : done ? 0.45 : 0.3);
        ctx.lineWidth = lit ? 1.6 : 1;
        ctx.stroke();
      }

      // 状态环
      ctx.save();
      ctx.setLineDash(error || approval ? [4, 5] : []);
      ctx.strokeStyle = error ? rgba(COLOR.red, 0.8)
        : approval ? rgba(COLOR.amber, 0.85)
        : branch ? rgba(COLOR.amber, 0.7)
        : active ? rgba(tint, 0.55 + pulse * 0.35)
        : done ? rgba(COLOR.green, 0.4)
        : 'rgba(110,150,200,0.16)';
      ctx.lineWidth = active ? 1.8 : 1.1;
      ctx.beginPath();
      for (let i = 0; i <= 56; i++) {
        const a = (i / 56) * TAU;
        const q = this.project([s.pos[0] + Math.cos(a) * 1.38, s.pos[1] + 0.06, s.pos[2] + Math.sin(a) * 1.38]);
        if (!q) continue;
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.restore();

      // 竖直光柱
      const beamTop = this.project([s.pos[0], s.pos[1] + 7.5, s.pos[2]]);
      if (beamTop) {
        const grad = ctx.createLinearGradient(p.x, baseY, beamTop.x, beamTop.y);
        grad.addColorStop(0, rgba(tint, lit ? 0.30 : 0.06));
        grad.addColorStop(1, rgba(tint, 0));
        ctx.strokeStyle = grad;
        ctx.lineWidth = lit ? 2.4 : 1;
        ctx.beginPath(); ctx.moveTo(p.x, baseY); ctx.lineTo(beamTop.x, beamTop.y); ctx.stroke();
      }

      // 本体
      ctx.save();
      if (lit) { ctx.shadowColor = rgba(tint, 0.9); ctx.shadowBlur = 18; }
      const h = BODY_H[s.kind] || 1.1;
      this.drawBody(ctx, s, p, h, tint, status, t, pulse);
      ctx.restore();

      // 顶点标签光点
      const top = this.project([s.pos[0], s.pos[1] + h + 0.42, s.pos[2]]);
      if (top) {
        ctx.fillStyle = rgba(tint, lit ? 0.95 : 0.5);
        ctx.beginPath();
        ctx.arc(top.x, top.y, lit ? 2.6 : 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBody(ctx, s, p, h, color, status, t, pulse) {
      const kind = s.kind;
      const x = s.pos[0], y = s.pos[1] + 0.26, z = s.pos[2];
      const P = (dx, dy, dz) => this.project([x + dx, y + dy, z + dz]);
      const lit = status === 'active' || status === 'error' || status === 'approval' || status === 'branch';
      const alpha = lit ? 1 : status === 'done' ? 0.78 : 0.5;

      const box = (cx, cy, cz, bw, bd, bh, tone = 1) => {
        const b = [P(cx - bw / 2, cy, cz - bd / 2), P(cx + bw / 2, cy, cz - bd / 2), P(cx + bw / 2, cy, cz + bd / 2), P(cx - bw / 2, cy, cz + bd / 2)];
        const tp = [P(cx - bw / 2, cy + bh, cz - bd / 2), P(cx + bw / 2, cy + bh, cz - bd / 2), P(cx + bw / 2, cy + bh, cz + bd / 2), P(cx - bw / 2, cy + bh, cz + bd / 2)];
        if (![...b, ...tp].every(Boolean)) return;
        const faces = [[0, 1], [1, 2], [3, 0], [2, 3]];
        faces.forEach((f, i) => {
          ctx.beginPath();
          ctx.moveTo(tp[f[0]].x, tp[f[0]].y);
          ctx.lineTo(tp[f[1]].x, tp[f[1]].y);
          ctx.lineTo(b[f[1]].x, b[f[1]].y);
          ctx.lineTo(b[f[0]].x, b[f[0]].y);
          ctx.closePath();
          ctx.fillStyle = rgba(color, (0.10 + i * 0.015) * tone * alpha);
          ctx.fill();
          ctx.strokeStyle = rgba(color, 0.42 * alpha);
          ctx.lineWidth = 0.9;
          ctx.stroke();
        });
        ctx.beginPath();
        tp.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
        ctx.closePath();
        ctx.fillStyle = rgba(color, 0.30 * tone * alpha);
        ctx.fill();
        ctx.strokeStyle = rgba(color, 0.75 * alpha);
        ctx.lineWidth = 1.1;
        ctx.stroke();
      };

      switch (kind) {
        case 'terminal': {
          box(0, 0, 0, 1.7, 0.9, 0.72, 1);
          const f = P(0.55, 1.1, 0.46);
          const g = P(-0.55, 0.55, 0.46);
          if (f && g) {
            ctx.strokeStyle = rgba(color, 0.9);
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(f.x, f.y); ctx.stroke();
            ctx.fillStyle = rgba(color, 0.9);
            ctx.fillRect(f.x, f.y - 1, 6, 2);
          }
          break;
        }
        case 'gateway': {
          box(-0.62, 0, 0, 0.26, 0.5, 1.5, 0.9);
          box(0.62, 0, 0, 0.26, 0.5, 1.5, 0.9);
          box(0, 1.35, 0, 1.5, 0.5, 0.24, 1.2);
          const q = P(0, 0.75, 0.27);
          if (q) {
            ctx.fillStyle = rgba(color, 0.25 + 0.25 * pulse);
            ctx.beginPath(); ctx.arc(q.x, q.y, 10, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'vault': {
          for (let i = 0; i < 3; i++) {
            const cy = 0.22 + i * 0.34;
            const c = P(0, cy, 0);
            if (!c) continue;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, 0.72 * c.s, 0.24 * c.s, 0, 0, TAU);
            ctx.fillStyle = rgba(color, (0.14 + i * 0.03) * alpha);
            ctx.fill();
            ctx.strokeStyle = rgba(color, 0.55 * alpha);
            ctx.lineWidth = 1;
            ctx.stroke();
          }
          break;
        }
        case 'inbox': {
          box(0, 0, 0, 1.5, 0.9, 0.62, 0.9);
          const a = P(-0.45, 0.4, 0.47), b = P(0.45, 0.4, 0.47);
          if (a && b) {
            ctx.strokeStyle = rgba(color, 0.95);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
          break;
        }
        case 'tower': {
          box(0, 0, 0, 0.62, 0.62, 1.7, 1);
          const a = P(0, 1.7, 0), b = P(0, h + 0.35, 0);
          if (a && b) {
            ctx.strokeStyle = rgba(color, 0.9);
            ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            ctx.fillStyle = rgba(color, 0.9);
            ctx.beginPath(); ctx.arc(b.x, b.y, 3 + pulse * 1.5, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'lens': {
          const apex = P(0, 1.45, 0);
          const rimA = P(-0.85, 0.1, 0), rimB = P(0.85, 0.1, 0);
          if (apex && rimA && rimB) {
            ctx.beginPath();
            ctx.moveTo(apex.x, apex.y); ctx.lineTo(rimB.x, rimB.y); ctx.lineTo(rimA.x, rimA.y);
            ctx.closePath();
            ctx.fillStyle = rgba(color, 0.14 * alpha);
            ctx.fill();
            ctx.strokeStyle = rgba(color, 0.7 * alpha);
            ctx.stroke();
          }
          for (let i = 1; i <= 2; i++) {
            const q = P(0, 0.1 + i * 0.38, 0);
            if (q) {
              ctx.strokeStyle = rgba(color, 0.28 * alpha);
              ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.55 * q.s * (1 - i * 0.18), 0.14 * q.s, 0, 0, TAU); ctx.stroke();
            }
          }
          break;
        }
        case 'grid': {
          for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
            const bh = 0.35 + ((ix + iz + 2) % 3) * 0.22;
            box(ix * 0.5, 0.1, iz * 0.5, 0.3, 0.3, bh, 1 - (Math.abs(ix) + Math.abs(iz)) * 0.12);
          }
          break;
        }
        case 'prism': {
          const tri = [];
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU - Math.PI / 2;
            tri.push([Math.cos(a) * 0.85, Math.sin(a) * 0.85]);
          }
          const b = tri.map(([dx, dz]) => P(dx, 0, dz));
          const tp = tri.map(([dx, dz]) => P(dx, 1.4, dz));
          if ([...b, ...tp].every(Boolean)) {
            for (let i = 0; i < 3; i++) {
              const j = (i + 1) % 3;
              ctx.beginPath();
              ctx.moveTo(tp[i].x, tp[i].y); ctx.lineTo(tp[j].x, tp[j].y);
              ctx.lineTo(b[j].x, b[j].y); ctx.lineTo(b[i].x, b[i].y);
              ctx.closePath();
              ctx.fillStyle = rgba(color, 0.10 * alpha);
              ctx.fill(); ctx.strokeStyle = rgba(color, 0.45 * alpha); ctx.stroke();
            }
            ctx.beginPath();
            tp.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
            ctx.closePath();
            ctx.fillStyle = rgba(color, 0.26 * alpha); ctx.fill();
          }
          break;
        }
        case 'engine': {
          const c = P(0, 0.8, 0);
          if (c) {
            const g = ctx.createRadialGradient(c.x - 6, c.y - 8, 2, c.x, c.y, 0.8 * c.s);
            g.addColorStop(0, rgba([235, 225, 255], 0.9 * alpha));
            g.addColorStop(0.35, rgba(color, 0.7 * alpha));
            g.addColorStop(1, rgba(color, 0.08));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(c.x, c.y, 0.8 * c.s, 0, TAU); ctx.fill();
            ctx.strokeStyle = rgba(color, 0.55 * alpha);
            ctx.beginPath(); ctx.ellipse(c.x, c.y, 1.15 * c.s, 0.28 * c.s, -0.2, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(c.x, c.y, 1.0 * c.s, 0.22 * c.s, 0.5, 0, TAU); ctx.stroke();
          }
          break;
        }
        case 'waves': {
          for (let k = -1; k <= 1; k++) {
            const pts = [];
            for (let i = 0; i <= 20; i++) {
              const yy = (i / 20) * 1.5;
              const q = P(k * 0.45 + Math.sin(i * 0.6 + t * 0.003 + k) * 0.10, yy, 0);
              if (q) pts.push(q);
            }
            if (pts.length > 1) {
              ctx.beginPath();
              pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
              ctx.strokeStyle = rgba(color, (0.45 + k * 0.12) * alpha);
              ctx.lineWidth = 1.4;
              ctx.stroke();
            }
          }
          break;
        }
        case 'doc': {
          box(0, 0, 0, 1.15, 0.34, 1.1, 1);
          for (let i = 0; i < 3; i++) {
            const a = P(-0.35, 0.75 - i * 0.22, 0.18), b = P(0.35, 0.75 - i * 0.22, 0.18);
            if (a && b) {
              ctx.strokeStyle = rgba(color, (0.55 - i * 0.12) * alpha);
              ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
          break;
        }
        case 'split': {
          const o = P(0, 0.1, 0);
          const l = P(-0.62, 1.3, 0);
          const r = P(0.62, 1.3, 0);
          if (o && l && r) {
            ctx.strokeStyle = rgba(color, 0.8 * alpha);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(o.x, o.y); ctx.lineTo(l.x, l.y);
            ctx.moveTo(o.x, o.y); ctx.lineTo(r.x, r.y);
            ctx.stroke();
            [l, r].forEach(q => {
              ctx.fillStyle = rgba(color, 0.85 * alpha);
              ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, TAU); ctx.fill();
            });
          }
          break;
        }
        case 'press': {
          box(0, 0, 0, 1.5, 1.0, 0.28, 1);
          box(0, 0.28, 0, 0.7, 0.55, 0.5, 0.8);
          const rod = P(0, 0.78, 0), top = P(0, 1.55, 0);
          if (rod && top) {
            ctx.strokeStyle = rgba(color, 0.7 * alpha);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(rod.x, rod.y); ctx.lineTo(top.x, top.y); ctx.stroke();
          }
          box(0, 1.55, 0, 1.1, 0.7, 0.22, 1.2);
          break;
        }
        case 'gate': {
          box(-0.62, 0, 0, 0.2, 0.4, 1.55, 0.9);
          box(0.62, 0, 0, 0.2, 0.4, 1.55, 0.9);
          box(0, 1.45, 0, 1.42, 0.4, 0.18, 1.2);
          const c = P(0, 0.8, 0);
          if (c) {
            ctx.strokeStyle = rgba(color, 0.3 + 0.25 * pulse);
            ctx.setLineDash([3, 6]);
            ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.45 * c.s, 1.0 * c.s, 0, 0, TAU); ctx.stroke();
            ctx.setLineDash([]);
          }
          break;
        }
        case 'tray': {
          box(0, 0, 0, 1.5, 1.0, 0.18, 1);
          box(-0.68, 0.18, 0, 0.14, 0.9, 0.32, 0.8);
          box(0.68, 0.18, 0, 0.14, 0.9, 0.32, 0.8);
          box(0, 0.18, -0.45, 1.4, 0.12, 0.32, 0.8);
          const c = P(0, 0.22, 0);
          if (c) {
            ctx.fillStyle = rgba(color, 0.25 + 0.2 * pulse);
            ctx.beginPath(); ctx.ellipse(c.x, c.y, 0.5 * c.s, 0.18 * c.s, 0, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'loop': {
          const c = P(0, 0.85, 0);
          if (c) {
            const rx = 0.85 * c.s, ry = 0.34 * c.s;
            ctx.strokeStyle = rgba(color, 0.8 * alpha);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = rgba(color, 0.35 * alpha);
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 0.55, ry * 0.55, 0, 0, TAU); ctx.stroke();
            ctx.setLineDash([5, 7]);
            ctx.lineDashOffset = -(t * 0.02) % 12;
            ctx.strokeStyle = rgba(color, 0.9);
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, -0.6, 2.2); ctx.stroke();
            ctx.setLineDash([]);
            const arrow = { x: c.x + Math.cos(2.2) * rx, y: c.y + Math.sin(2.2) * ry };
            ctx.fillStyle = rgba(color, 0.9);
            ctx.beginPath(); ctx.arc(arrow.x, arrow.y, 3.2, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'log': {
          for (let i = 0; i < 3; i++) {
            box(0, 0.12 + i * 0.36, (i - 1) * 0.12, 1.35, 0.72, 0.2, 1.1 - i * 0.15);
          }
          break;
        }
        case 'portal': {
          const c = P(0, 1.05, 0);
          if (c) {
            const rx = 0.8 * c.s, ry = 1.2 * c.s;
            const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, ry);
            g.addColorStop(0, rgba([220, 255, 240], 0.55 * alpha));
            g.addColorStop(0.5, rgba(color, 0.25 * alpha));
            g.addColorStop(1, rgba(color, 0));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = rgba(color, 0.85 * alpha);
            ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.stroke();
            ctx.strokeStyle = rgba(color, 0.4 * alpha);
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.ellipse(c.x, c.y, rx * 1.12, ry * 1.05, 0, 0, TAU); ctx.stroke();
          }
          break;
        }
        case 'spawn': {
          const c = P(0, 0.75, 0);
          if (c) {
            ctx.fillStyle = rgba(color, 0.25 * alpha);
            ctx.beginPath(); ctx.arc(c.x, c.y, 0.42 * c.s, 0, TAU); ctx.fill();
            ctx.strokeStyle = rgba(color, 0.9 * alpha);
            ctx.beginPath(); ctx.arc(c.x, c.y, 0.42 * c.s, 0, TAU); ctx.stroke();
            for (let i = 0; i < 3; i++) {
              const a = t * 0.0012 + i * (TAU / 3);
              const q = P(Math.cos(a) * 0.9, 0.75 + Math.sin(a) * 0.35, Math.sin(a) * 0.5);
              if (q) { ctx.fillStyle = rgba(color, 0.85); ctx.beginPath(); ctx.arc(q.x, q.y, 2.4, 0, TAU); ctx.fill(); }
            }
          }
          break;
        }
        case 'core': {
          const t0 = P(0, 2.4, 0), b0 = P(0, 0, 0);
          const eq = [];
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + t * 0.0003;
            eq.push(P(Math.cos(a) * 0.85, 1.2, Math.sin(a) * 0.85));
          }
          if (t0 && b0 && eq.every(Boolean)) {
            for (let i = 0; i < 4; i++) {
              const j = (i + 1) % 4;
              ctx.beginPath();
              ctx.moveTo(t0.x, t0.y); ctx.lineTo(eq[j].x, eq[j].y); ctx.lineTo(eq[i].x, eq[i].y);
              ctx.closePath();
              ctx.fillStyle = rgba(color, (0.12 + (i % 2) * 0.08) * alpha);
              ctx.fill();
              ctx.strokeStyle = rgba(color, 0.65 * alpha);
              ctx.lineWidth = 1.1;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(b0.x, b0.y); ctx.lineTo(eq[i].x, eq[i].y); ctx.lineTo(eq[j].x, eq[j].y);
              ctx.closePath();
              ctx.fillStyle = rgba(color, (0.08 + (i % 2) * 0.05) * alpha);
              ctx.fill();
              ctx.stroke();
            }
            ctx.strokeStyle = rgba(COLOR.cyan, 0.32 + pulse * 0.2);
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.ellipse(t0.x, t0.y + (b0.y - t0.y) * 0.5, 1.35 * t0.s, 0.32 * t0.s, 0, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(t0.x, t0.y + (b0.y - t0.y) * 0.5, 1.0 * t0.s, 0.22 * t0.s, 0.6, 0, TAU); ctx.stroke();
          }
          break;
        }
        default:
          box(0, 0, 0, 1.0, 1.0, h, 1);
      }
    }

    drawParticles(ctx, t) {
      const state = this.state;
      if (!state || !state.trail.length) return;
      const current = state.trail[state.trail.length - 1];
      const pts = this.edgeCurve(current[0], current[1]);
      if (pts) {
        const loop = this.isLoopEdge(current[0], current[1]);
        for (let i = 0; i < 9; i++) {
          const phase = ((t * 0.00022) + i / 9) % 1;
          this.drawParticleTrail(ctx, pts, phase, loop ? COLOR.amber : COLOR.cyan, 1);
        }
      }
      // 已完成路径的环境粒子
      for (const [a, b] of state.trail.slice(0, -1)) {
        const p = this.edgeCurve(a, b);
        if (!p) continue;
        const loop = this.isLoopEdge(a, b);
        const phase = ((t * 0.00008) + (this.flowOrder.get(a) || 0) * 0.13) % 1;
        this.drawParticleTrail(ctx, p, phase, loop ? COLOR.amber : COLOR.blue, 0.28);
      }
    }

    drawParticleTrail(ctx, pts, phase, color, alpha) {
      const n = pts.length - 1;
      const at = (u) => {
        const f = clamp(u, 0, 1) * n;
        const i = Math.min(n - 1, Math.floor(f));
        const k = f - i;
        return this.project([
          pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
          pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k,
          pts[i][2] + (pts[i + 1][2] - pts[i][2]) * k,
        ]);
      };
      for (let k = 4; k >= 0; k--) {
        const p = at(phase - k * 0.012);
        if (!p) continue;
        const a = alpha * (1 - k / 5) * 0.55;
        ctx.fillStyle = rgba(color, a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (3.0 - k * 0.42) * clamp(p.s / 26, 0.7, 1.5), 0, TAU);
        ctx.fill();
      }
      const head = at(phase);
      if (head) {
        ctx.save();
        ctx.shadowColor = rgba(color, 0.95);
        ctx.shadowBlur = 16;
        ctx.fillStyle = rgba([240, 252, 255], 0.98 * alpha);
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3.6 * clamp(head.s / 26, 0.8, 1.6), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    /* ---------- 标签同步 ---------- */
    syncTags() {
      const state = this.state;
      const items = [];
      for (const s of this.stations) {
        const el = this.tags.get(s.id);
        if (!el) continue;
        const status = state && state.statuses[s.id] ? state.statuses[s.id] : 'idle';
        const active = state && state.active === s.id;
        const h = BODY_H[s.kind] || 1;
        const p = this.project([s.pos[0], s.pos[1] + h + 0.95, s.pos[2]]);
        if (!p || p.depth > 60) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; continue; }
        if (!el._w) el._w = el.offsetWidth || 72;
        items.push({ s, el, p, status, active, w: el._w + 10, hover: this.hoverId === s.id, selected: this.selectedId === s.id });
      }

      // 屏幕空间避让：当前/选中/悬停优先占位；放不下的标签先隐藏，悬停站台时再出现
      const rank = it => (it.active ? 3 : 0) + (it.selected ? 2 : 0) + (it.hover ? 1 : 0);
      items.sort((a, b) => rank(b) - rank(a) || b.p.y - a.p.y);
      const placed = [];
      for (const it of items) {
        let y = it.p.y;
        let hidden = false;
        for (let k = 0; k < 4; k++) {
          const rect = { l: it.p.x - it.w / 2 - 2, r: it.p.x + it.w / 2 + 2, t: y - 22, b: y + 2 };
          const hit = placed.some(q => !(rect.r < q.l || rect.l > q.r || rect.b < q.t || rect.t > q.b));
          if (!hit) break;
          y -= 20;
          if (k === 3) hidden = true;
        }
        y = Math.max(98, y);
        it.y = y;
        it.hidden = (hidden || this.compact) && !(it.active || it.hover || it.selected);
        // 放不下的站台名先收起；悬停或选中站台时再展开，避免中段标签互相压字
        it.mini = false;
        if (!it.hidden) placed.push({ l: it.p.x - it.w / 2, r: it.p.x + it.w / 2, t: y - 20, b: y });
      }

      for (const it of items) {
        const { s, el, p, status, active } = it;
        el.style.opacity = it.hidden ? '0' : it.mini ? '0.82' : active || status !== 'idle' ? '1' : '0.7';
        el.style.visibility = it.hidden ? 'hidden' : 'visible';
        el.style.pointerEvents = it.hidden ? 'none' : 'auto';
        el.style.transform = `translate(-50%,-100%) translate(${p.x.toFixed(1)}px,${it.y.toFixed(1)}px)`;
        el.style.zIndex = String(Math.round(1200 - p.depth * 6) + (active ? 120 : 0) + (it.mini ? 260 : 0));
        el.classList.toggle('is-mini', it.mini);
        el.classList.toggle('is-active', Boolean(active));
        el.classList.toggle('is-done', status === 'done');
        el.classList.toggle('is-error', status === 'error');
        el.classList.toggle('is-approval', status === 'approval');
        el.classList.toggle('is-branch', status === 'branch');
        el.classList.toggle('is-hover', this.hoverId === s.id);
        el.classList.toggle('is-selected', this.selectedId === s.id);
        const stateEl = el.querySelector('.lab-tag__state');
        if (stateEl.textContent !== STATUS_TEXT[status]) stateEl.textContent = STATUS_TEXT[status];
      }
    }

    destroy() {
      this._destroyed = true;
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      window.removeEventListener('resize', this._onWindowResize);
      this.canvas.replaceWith(this.canvas.cloneNode(false));
      this.tagLayer.innerHTML = '';
    }
  }

  window.LabScene = LabScene;
})();
