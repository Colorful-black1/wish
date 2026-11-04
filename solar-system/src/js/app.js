/* ==========================================================================
   app.js — 状态机、世界装配、输入、URL、渲染循环
   四种状态：全景 Orrery / 特写 Close-up / 时间（任何状态可用）/ 帮助浮层
   ========================================================================== */
(function () {
  'use strict';

  var A = window.HELIOS_ASTRO;
  var DATA = window.HELIOS_BODIES;
  var SKY = window.HELIOS_SKY;
  var ORBITS = window.HELIOS_ORBITS;

  var AU_KM = 149597870.7;
  var TAU = Math.PI * 2;

  /* ---- 尺度模式 ---------------------------------------------------------
     k / p：r_world = k · r_au^p；radiusScale：1 AU 半径对应多少世界单位
     minPx：最小像素保护（0 = 不保护，完全真实） */
  var SCALES = {
    orrery: { k: 1.15, p: 0.55, radiusScale: 36, minPx: 3.2, label: '比例压缩' },
    distance: { k: 1.0, p: 1.0, radiusScale: 30, minPx: 2.6, label: '真实距离' },
    true: { k: 1.0, p: 1.0, radiusScale: 1.0, minPx: 0, label: '完全真实' },
  };

  var QUALITY = {
    standard: { maxPx: 1.15e6, dprCap: 1.5, bloomPasses: 2, detailScale: 0.62, grain: 0.016 },
    high: { maxPx: 2.2e6, dprCap: 2.0, bloomPasses: 4, detailScale: 0.85, grain: 0.012 },
    cinematic: { maxPx: 3.6e6, dprCap: 2.0, bloomPasses: 6, detailScale: 1.0, grain: 0.009 },
  };

  // 移动端 / 小屏 / 少核自动降档
  function defaultQuality() {
    var w = window.innerWidth;
    var cores = navigator.hardwareConcurrency || 4;
    var touch = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
    if (w < 760 || touch || cores <= 4) return 'standard';
    return 'high';
  }

  var SKY_GAIN = 8.7e-5;
  var FLIGHT_MS = 1000;
  var JD_MIN = A.julianDay(1800, 1, 1, 0);
  var JD_MAX = A.julianDay(2050, 12, 31, 0);

  /* ---- 启动参数 --------------------------------------------------------- */
  var QS = new URLSearchParams(location.search);
  var SHOT = QS.get('shot') === '1';
  var SHOT_UI = QS.get('ui') !== '0';
  var DPR_OVERRIDE = QS.get('dpr') ? Math.max(0.5, Math.min(3, Number(QS.get('dpr')))) : null;

  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    var out = {};
    if (!h) return out;
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0) return;
      out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    return out;
  }

  function dateStringToJd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var jd = A.julianDay(Number(m[1]), Number(m[2]), Number(m[3]), 0);
    if (jd < JD_MIN || jd > JD_MAX) return null;
    return jd;
  }

  function jdToDateString(jd) {
    var c = A.calendarFromJulianDay(jd);
    return (
      String(c.y).padStart(4, '0') + '-' + String(c.m).padStart(2, '0') + '-' + String(Math.floor(c.d)).padStart(2, '0')
    );
  }

  /* ---- 状态 ------------------------------------------------------------- */
  var hash = parseHash();
  var initScale = SCALES[QS.get('scale')] ? QS.get('scale') : SCALES[hash.scale] ? hash.scale : 'orrery';
  var initJd = dateStringToJd(QS.get('date') || '') || dateStringToJd(hash.date) || A.julianDay(2026, 11, 4, 0);
  var initFocusName = QS.get('focus') || hash.body || '';
  var initFocus = -1;
  DATA.bodies.forEach(function (b, i) {
    if (b.id === initFocusName) initFocus = i;
  });

  var STATE = {
    scale: initScale,
    jd: initJd,
    playing: !SHOT,
    speedDays: SHOT ? 0 : 1,
    // 地址栏里的 #body=… 一律还原（交互与 shot 模式都一样）
    focus: initFocus,
    hover: -1,
    bgOn: true,
    constellations: false,
    starBright: 0.55,
    hudVisible: SHOT ? SHOT_UI : true,
    quality: defaultQuality(),
    helpOpen: false,
    lastFocusEl: null,
    overviewCam: null,
  };

  var bodies = DATA.bodies;
  var moons = DATA.moons || [];

  /* ---- 依赖 ---- */
  var canvas = document.getElementById('gl');
  var renderer = window.HELIOS_RENDERER.create(canvas);
  if (!renderer || renderer.failed) {
    var fb = document.getElementById('fallback');
    if (!renderer) {
      fb.querySelector('h2').textContent = '这台设备上的浏览器没有 WebGL2';
    } else {
      fb.querySelector('h2').textContent = '这台设备上的 WebGL2 驱动无法编译本页的着色器';
      var pre = document.createElement('pre');
      pre.style.cssText =
        'font-size:10px;color:#6FA8B8;white-space:pre-wrap;max-height:180px;overflow:auto;max-width:100%;';
      pre.textContent = String(renderer.error || '').slice(0, 2500);
      fb.appendChild(pre);
    }
    fb.removeAttribute('hidden');
    document.getElementById('loader').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    return;
  }

  var cam = window.HELIOS_CAMERA.createCamera();
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  cam.reducedMotion = !!reduced;
  if (reduced) {
    STATE.playing = false;
    STATE.speedDays = 0;
  }

  /* ---- UI ---- */
  var app = { bodies: bodies };
  var ui = window.HELIOS_UI.createUI(app);

  /* ---- 预计算：星体静态参数 -------------------------------------------- */
  function hash01(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
  }

  var meta = bodies.map(function (b) {
    return {
      id: b.id,
      typeId: b.typeId,
      // 极轴：倾角与方位角都来自真实极轴（research/pole-directions.md）
      tilt: b.pole ? b.pole.tilt : b.obliquityDeg || 0,
      node: b.pole ? b.pole.node : hash01(b.id) * TAU,
      hero: b.hero || null,
      rotHours: Math.abs(b.rotationHours || 24),
      radiusAU: b.radiusKm / AU_KM,
      colorA: b.visual.colorA,
      colorB: b.visual.colorB,
      colorC: b.visual.colorC,
      atmoStrength: b.atmosphere ? b.atmosphere.strength : 0,
      atmoScale: b.atmosphere ? b.atmosphere.scale : 0,
      atmoColor: b.atmosphere ? b.atmosphere.color : [0, 0, 0],
      ringSlot: b.rings ? (b.id === 'saturn' ? 1 : 2) : 0,
      orbitId: b.orbitId || null,
    };
  });

  var moonMeta = moons.map(function (m) {
    var parentIdx = 0;
    bodies.forEach(function (b, i) {
      if (b.id === m.parent) parentIdx = i;
    });
    var compress = m.id === 'moon' ? 0.2 : 1.0;
    return {
      id: m.id,
      parent: parentIdx,
      orbitRatios: (m.orbitRadiusKm / bodies[parentIdx].radiusKm) * compress,
      periodDays: m.orbitalPeriodDays,
      phase: hash01(m.id) * TAU,
      radiusAU: m.radiusKm / AU_KM,
      colorA: m.visual.colorA[0] ? m.visual.colorA : [0.45, 0.44, 0.42],
      colorB: m.visual.colorB,
      colorC: m.visual.colorC,
      node: hash01(m.id + 'n') * TAU,
      tilt: 3 + hash01(m.id + 't') * 8,
      rotHours: 24,
    };
  });

  /* ---- 环 ---- */
  var ringDefs = [];
  bodies.forEach(function (b) {
    if (!b.rings) return;
    var r = b.rings;
    ringDefs.push({
      bodyId: b.id,
      inner: r.inner,
      cOuter: r.cOuter,
      bOuter: r.bOuter,
      cassiniInner: r.cassiniInner,
      cassiniOuter: r.cassiniOuter,
      aOuter: r.aOuter,
      fRing: r.fRing,
      opacity: r.opacity,
      color: r.color,
      style: b.id === 'saturn' ? 0 : 1,
    });
  });

  /* ---- 深空天体 ---- */
  var skyList = SKY.objects.map(function (o) {
    var dir = A.raDecToEclipticUnit(o.ra, o.dec);
    var ra = (o.ra * Math.PI) / 180;
    var dec = (o.dec * Math.PI) / 180;
    var north = {
      x: -Math.sin(dec) * Math.cos(ra),
      y: -Math.sin(dec) * Math.sin(ra),
      z: Math.cos(dec),
    };
    var east = { x: -Math.sin(ra), y: Math.cos(ra), z: 0 };
    var pa = ((o.pa || 0) * Math.PI) / 180;
    var axisEq = {
      x: north.x * Math.cos(pa) + east.x * Math.sin(pa),
      y: north.y * Math.cos(pa) + east.y * Math.sin(pa),
      z: north.z * Math.cos(pa) + east.z * Math.sin(pa),
    };
    var axis = A.equatorialToEcliptic(axisEq);
    var aRad = (o.aDeg * Math.PI) / 180;
    var bRad = (o.bDeg * Math.PI) / 180;
    var flux = Math.pow(10, -0.4 * (o.mag - 3.0));
    var area = Math.max(aRad * bRad, 1e-7);
    var kindMap = { galaxy: 0, dwarf: 1, nebula: 2, cluster: 3, globular: 4 };
    return {
      id: o.id,
      dir: dir,
      axis: A.normalize(axis),
      size: { x: aRad, y: bRad },
      pa: 0,
      bright: Math.min(flux / area * SKY_GAIN, 3.0),
      kind: kindMap[o.kind] === undefined ? 0 : kindMap[o.kind],
    };
  });
  renderer.uploadSky(skyList);
  renderer.uploadRings(ringDefs);

  /* ---- 银河矩阵：黄道 → 银道 ------------------------------------------- */
  var eclToGal = (function () {
    var e = (A.OBLIQUITY_J2000 * Math.PI) / 180;
    var c = Math.cos(e),
      s = Math.sin(e);
    // 黄道 → 赤道
    var R = [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c],
    ];
    var M = [
      [-0.0548755604, -0.8734370902, -0.4838350155],
      [0.4941094279, -0.44482963, 0.7469822445],
      [-0.867666149, -0.1980763734, 0.4559837762],
    ];
    var out = new Float32Array(9);
    for (var col = 0; col < 3; col++) {
      for (var row = 0; row < 3; row++) {
        var v = 0;
        for (var k = 0; k < 3; k++) v += M[row][k] * R[k][col];
        out[col * 3 + row] = v;
      }
    }
    return out;
  })();

  /* ---- 常量空间计算 ----------------------------------------------------- */
  function scaleDef() {
    return SCALES[STATE.scale];
  }

  function distWorld(rAU) {
    var d = scaleDef();
    return d.k * Math.pow(Math.max(rAU, 1e-6), d.p);
  }

  function radiusWorld(radiusAU) {
    return radiusAU * scaleDef().radiusScale;
  }

  function overviewDistance() {
    var d = scaleDef();
    var outer = distWorld(30.07);
    return (outer / Math.tan((cam.fovDeg * Math.PI) / 360)) * 1.12;
  }

  function spinAngle(rotHours, jd) {
    var days = jd - A.J2000;
    var a = (days * 24) / rotHours * TAU;
    a = a % TAU;
    return a < 0 ? a + TAU : a;
  }

  /* ---- 每帧世界装配 ----------------------------------------------------- */
  var world = {
    planetPos: [],
    planetR: [],
    auPos: [],
    focusPos: [0, 0, 0],
    focusR: 0.1,
    sunPos: [0, 0, 0],
    sunR: 0.1,
  };

  function assembleWorld(jd) {
    var positions = [];
    var au = [];
    for (var i = 1; i < bodies.length; i++) {
      var el = ORBITS.elements[meta[i].orbitId];
      var p = A.heliocentric(el, jd);
      var f = distWorld(p.r) / p.r;
      positions[i] = [p.x * f, p.y * f, p.z * f, p.r];
      au[i] = [p.x, p.y, p.z];
    }
    positions[0] = [0, 0, 0, 0];
    au[0] = [0, 0, 0];
    world.planetPos = positions;
    world.auPos = au;
    world.planetR = positions.map(function (p, i) {
      return radiusWorld(meta[i].radiusAU);
    });
    world.sunR = radiusWorld(meta[0].radiusAU);
    return positions;
  }

  function buildRenderList(jd, W, H) {
    var list = [];
    var positions = world.planetPos;

    for (var i = 0; i < bodies.length; i++) {
      var pos = positions[i];
      var R = world.planetR[i];
      var pxR = cam.screenRadius(pos, R, H);
      var draw = R;
      var minPx = scaleDef().minPx;
      if (minPx > 0 && pxR > 0 && pxR < minPx) draw = R * (minPx / pxR);
      if (minPx === 0 && pxR < 0.4) draw = 0;
      list.push({
        pos: pos,
        radius: draw,
        geomRadius: R,
        type: meta[i].typeId,
        tilt: meta[i].tilt,
        node: meta[i].node,
        spin: spinAngle(meta[i].rotHours, jd),
        colorA: meta[i].colorA,
        atmoStrength: meta[i].atmoStrength,
        colorB: meta[i].colorB,
        atmoScale: meta[i].atmoScale,
        colorC: meta[i].colorC,
        atmoColor: meta[i].atmoColor,
        ringSlot: meta[i].ringSlot,
        pxRadius: pxR,
      });
    }

    // 卫星
    for (var m = 0; m < moonMeta.length; m++) {
      var mm = moonMeta[m];
      var pIdx = mm.parent;
      var ppos = positions[pIdx];
      var pr = world.planetR[pIdx];
      var orbitR = pr * mm.orbitRatios;
      var phi = mm.phase + (TAU * (jd - A.J2000)) / mm.periodDays;
      // 在母体赤道面内绕行
      var tiltR = (meta[pIdx].tilt * Math.PI) / 180;
      var cT = Math.cos(tiltR),
        sT = Math.sin(tiltR);
      var e1 = [1, 0, 0];
      var e2 = [0, cT, sT];
      var px = ppos[0] + orbitR * (Math.cos(phi) * e1[0] + Math.sin(phi) * e2[0]);
      var py = ppos[1] + orbitR * (Math.cos(phi) * e1[1] + Math.sin(phi) * e2[1]);
      var pz = ppos[2] + orbitR * (Math.cos(phi) * e1[2] + Math.sin(phi) * e2[2]);
      var mpos = [px, py, pz];
      var mr = radiusWorld(mm.radiusAU);
      var mpx = cam.screenRadius(mpos, mr, H);
      var mdraw = mr;
      var mp = scaleDef().minPx;
      if (mp > 0 && mpx > 0 && mpx < mp) mdraw = mr * (mp / mpx);
      if (mp === 0 && mpx < 0.4) mdraw = 0;
      list.push({
        pos: mpos,
        radius: mdraw,
        geomRadius: mr,
        type: 9,
        tilt: mm.tilt,
        node: mm.node,
        spin: spinAngle(mm.rotHours, jd),
        colorA: mm.colorA,
        atmoStrength: 0,
        colorB: mm.colorB,
        atmoScale: 0,
        colorC: mm.colorC,
        atmoColor: [0, 0, 0],
        ringSlot: 0,
        pxRadius: mpx,
      });
    }
    return list;
  }

  /* ---- 线段投影（CPU 侧近平面裁剪） ------------------------------------ */
  var lineScratch = new Float32Array(7 * 2 * 4096);
  var lineCount = 0;

  function pushLine(p0, p1, c0, depthShift) {
    if (lineCount + 2 > lineScratch.length / 7) return;
    var b = cam.basis();
    var pos = cam.position();
    var th = cam.tanHalf();
    var asp = core.w / core.h;
    var NEAR = 1e-7;

    function toView(p) {
      var dx = p[0] - pos[0],
        dy = p[1] - pos[1],
        dz = p[2] - pos[2];
      return {
        x: dx * b[0] + dy * b[1] + dz * b[2],
        y: dx * b[3] + dy * b[4] + dz * b[5],
        z: dx * b[6] + dy * b[7] + dz * b[8],
      };
    }

    var a = toView(p0);
    var q = toView(p1);
    if (a.z <= NEAR && q.z <= NEAR) return;
    if (a.z <= NEAR) {
      var t1 = (NEAR - a.z) / (q.z - a.z);
      a = { x: a.x + (q.x - a.x) * t1, y: a.y + (q.y - a.y) * t1, z: NEAR };
    } else if (q.z <= NEAR) {
      var t2 = (NEAR - q.z) / (a.z - q.z);
      q = { x: q.x + (a.x - q.x) * t2, y: q.y + (a.y - q.y) * t2, z: NEAR };
    }

    var base = lineCount * 7;
    var arr = lineScratch;
    arr[base + 0] = a.x / (a.z * th * asp);
    arr[base + 1] = a.y / (a.z * th);
    arr[base + 2] = core.depthOf(a.z);
    arr[base + 3] = c0[0];
    arr[base + 4] = c0[1];
    arr[base + 5] = c0[2];
    arr[base + 6] = c0[3];

    arr[base + 7] = q.x / (q.z * th * asp);
    arr[base + 8] = q.y / (q.z * th);
    arr[base + 9] = core.depthOf(q.z);
    arr[base + 10] = c0[0];
    arr[base + 11] = c0[1];
    arr[base + 12] = c0[2];
    arr[base + 13] = c0[3];
    lineCount += 2;
  }

  /* ---- 轨道线缓存 ------------------------------------------------------- */
  var orbitCache = { jd: -1, scale: '', pts: [] };
  var ORBIT_SEGMENTS = 220;

  function orbitWorldPoints() {
    if (Math.abs(orbitCache.jd - STATE.jd) < 0.4 && orbitCache.scale === STATE.scale) return orbitCache.pts;
    var out = [];
    for (var i = 1; i < bodies.length; i++) {
      var el = ORBITS.elements[meta[i].orbitId];
      var path = A.orbitPath(el, STATE.jd, ORBIT_SEGMENTS);
      var pts = new Float32Array(path.length * 3);
      for (var k = 0; k < path.length; k++) {
        var p = path[k];
        var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z) || 1e-9;
        var f = distWorld(r) / r;
        pts[k * 3] = p.x * f;
        pts[k * 3 + 1] = p.y * f;
        pts[k * 3 + 2] = p.z * f;
      }
      out.push(pts);
    }
    orbitCache = { jd: STATE.jd, scale: STATE.scale, pts: out };
    return out;
  }

  /* ---- 星座连线 --------------------------------------------------------- */
  var constWorld = null;
  function constellationSegments() {
    if (constWorld !== null) return constWorld;
    constWorld = [];
    var dec = window.HELIOS_RENDERER.decodeStars();
    if (!dec) return constWorld;
    var u16 = dec.u16;
    var idx = new Map();
    dec.names.forEach(function (pair) {
      idx.set(pair[1], pair[0]);
    });
    function dirOf(name) {
      var i = idx.get(name);
      if (i === undefined) return null;
      var ra = u16[i * 4] / 100;
      var dc = (u16[i * 4 + 1] - 9000) / 100;
      return A.raDecToEclipticUnit(ra, dc);
    }
    SKY.constellations.forEach(function (c) {
      c.segments.forEach(function (seg) {
        var d0 = dirOf(seg[0]);
        var d1 = dirOf(seg[1]);
        if (d0 && d1) constWorld.push([d0, d1]);
      });
    });
    return constWorld;
  }

  function projectSkyPair(d0, d1, out, color) {
    // 天球方向 → 屏幕；分成 12 段并逐段裁剪
    var b = cam.basis();
    var th = cam.tanHalf();
    var asp = core.w / core.h;
    var N = 12;
    var prev = null;
    for (var k = 0; k <= N; k++) {
      var t = k / N;
      var v = {
        x: d0.x + (d1.x - d0.x) * t,
        y: d0.y + (d1.y - d0.y) * t,
        z: d0.z + (d1.z - d0.z) * t,
      };
      var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
      v.x /= l;
      v.y /= l;
      v.z /= l;
      var vz = v.x * b[6] + v.y * b[7] + v.z * b[8];
      var cur = vz > 0.02 ? { x: v.x / (vz * th * asp), y: v.y / (vz * th) } : null;
      if (prev && cur) {
        var base = lineCount * 7;
        if (lineCount + 2 > lineScratch.length / 7) return;
        lineScratch[base] = prev.x;
        lineScratch[base + 1] = prev.y;
        lineScratch[base + 2] = 1.0;
        lineScratch[base + 3] = color[0];
        lineScratch[base + 4] = color[1];
        lineScratch[base + 5] = color[2];
        lineScratch[base + 6] = color[3];
        lineScratch[base + 7] = cur.x;
        lineScratch[base + 8] = cur.y;
        lineScratch[base + 9] = 1.0;
        lineScratch[base + 10] = color[0];
        lineScratch[base + 11] = color[1];
        lineScratch[base + 12] = color[2];
        lineScratch[base + 13] = color[3];
        lineCount += 2;
      }
      prev = cur;
    }
  }

  /* ---- 主循环 ----------------------------------------------------------- */
  var core = {
    w: 1,
    h: 1,
    pxW: 1,
    pxH: 1,
    dpr: 1,
    lastDate: '',
    depthOf: function (t) {
      return Math.min(1 - Math.exp(-t * 0.9), 0.9995);
    },
  };

  function computePixelSize() {
    var q = QUALITY[STATE.quality];
    var dpr = DPR_OVERRIDE !== null ? DPR_OVERRIDE : Math.min(window.devicePixelRatio || 1, q.dprCap);
    var cw = Math.max(1, canvas.clientWidth || window.innerWidth);
    var ch = Math.max(1, canvas.clientHeight || window.innerHeight);
    var w = Math.round(cw * dpr);
    var h = Math.round(ch * dpr);
    var px = w * h;
    if (px > q.maxPx) {
      var s = Math.sqrt(q.maxPx / px);
      w = Math.max(1, Math.round(w * s));
      h = Math.max(1, Math.round(h * s));
    }
    core.w = cw;
    core.h = ch;
    core.pxW = w;
    core.pxH = h;
    core.dpr = w / cw;
    renderer.resize(w, h);
  }

  function resize() {
    computePixelSize();
  }

  var lastT = 0;
  var frames = 0;
  var elapsed = 0;
  var readyFrames = SHOT ? 6 : 1;

  function render(now) {
    var dt = lastT ? Math.min(now - lastT, 120) : 16;
    lastT = now;
    frames++;
    if (!SHOT) elapsed += dt / 1000;

    if (STATE.playing && STATE.speedDays > 0 && !SHOT) {
      STATE.jd += (STATE.speedDays * dt) / 1000;
      if (STATE.jd > JD_MAX) {
        STATE.jd = JD_MAX;
        STATE.playing = false;
        STATE.speedDays = 0;
        ui.setSpeed('pause');
      }
      var ds = jdToDateString(STATE.jd);
      if (ds !== core.lastDate) {
        core.lastDate = ds;
        ui.setDate(A.dateFromJd(STATE.jd));
        ui.setDateNote('JD ' + STATE.jd.toFixed(2));
        updateReadout();
      }
    }

    cam.update(dt);
    cam.compute();

    assembleWorld(STATE.jd);

    // 特写时相机跟随天体（飞行途中交给缓动，避免镜头瞬移）
    if (STATE.focus >= 0 && !cam.isFlying()) {
      var fp = world.planetPos[STATE.focus];
      if (fp) {
        cam.target[0] = fp[0];
        cam.target[1] = fp[1];
        cam.target[2] = fp[2];
      }
    }

    var list = buildRenderList(STATE.jd, core.w, core.h);
    renderer.uploadBodies(list);

    // 线段（轨道线只在全景里画：特写时相机贴着轨道，线会从镜头里穿过去）
    lineCount = 0;
    if (STATE.focus < 0) {
      var orbits = orbitWorldPoints();
      for (var i = 0; i < orbits.length; i++) {
        var pts = orbits[i];
        var col = [0.43, 0.66, 0.72, 0.17];
        for (var k = 0; k + 1 < pts.length / 3; k++) {
          pushLine(
            [pts[k * 3], pts[k * 3 + 1], pts[k * 3 + 2]],
            [pts[k * 3 + 3], pts[k * 3 + 4], pts[k * 3 + 5]],
            col
          );
        }
      }
    }
    if (STATE.constellations && STATE.bgOn) {
      var segs = constellationSegments();
      for (var s = 0; s < segs.length; s++) {
        projectSkyPair(segs[s][0], segs[s][1], null, [0.42, 0.6, 0.68, 0.22]);
      }
    }
    renderer.setLines(lineCount > 0 ? lineScratch.subarray(0, lineCount * 7) : null);

    // 细节层级
    var detail = 0;
    var focusIdx = STATE.focus >= 0 ? STATE.focus : -1;
    var refBody = focusIdx >= 0 ? list[focusIdx] : null;
    if (!refBody) {
      var bestD = 1e18;
      for (var bi = 0; bi < 9; bi++) {
        var d2 = dist2(list[bi].pos);
        if (d2 < bestD) {
          bestD = d2;
          refBody = list[bi];
        }
      }
    }
    if (refBody && refBody.geomRadius > 0) {
      var ratio = Math.sqrt(dist2(refBody.pos)) / Math.max(refBody.geomRadius, 1e-9);
      detail = 1 - (Math.log(Math.max(ratio, 1.15)) - Math.log(1.15)) / (Math.log(28) - Math.log(1.15));
      detail = Math.max(0, Math.min(1, detail));
    }
    detail *= QUALITY[STATE.quality].detailScale;

    renderer.render({
      pixelWidth: core.pxW,
      pixelHeight: core.pxH,
      pxScale: core.dpr,
      camPos: cam.position(),
      camBasis: cam.basis(),
      tanHalf: cam.tanHalf(),
      detail: detail,
      time: SHOT ? 0.37 : elapsed,
      bgOn: STATE.bgOn,
      hover: STATE.hover,
      bodyCount: list.length,
      starBright: STATE.starBright,
      milkyGain: 0.075,
      starGain: 36 + STATE.starBright * 180,
      exposure: 0.95,
      bloomGain: 0.5,
      bloomThreshold: 0.95,
      bloomPasses: QUALITY[STATE.quality].bloomPasses,
      grain: QUALITY[STATE.quality].grain,
      vignette: 0.32,
      frameIndex: SHOT ? 0 : frames,
      linesOn: true,
      eclToGal: eclToGal,
      skyObjCount: skyList.length,
    });

    if (!window.__HELIOS_READY && frames >= (SHOT ? 6 : 2)) {
      document.documentElement.setAttribute('data-ready', 'true');
      document.body.setAttribute('data-ready', 'true');
      window.__HELIOS_READY = true;
    }

    if (frames === 2 && !SHOT) ui.hideLoader();
    requestAnimationFrame(render);
  }

  function dist2(p) {
    var c = cam.position();
    var dx = p[0] - c[0],
      dy = p[1] - c[1],
      dz = p[2] - c[2];
    return dx * dx + dy * dy + dz * dz;
  }

  /* ---- 状态切换 --------------------------------------------------------- */
  function applyScaleNote() {
    var d = scaleDef();
    var outerRatio = distWorld(30.07) / 30.07;
    var note;
    if (STATE.scale === 'orrery') {
      note = '距离 r^0.55 压缩 ×' + outerRatio.toFixed(2) + ' · 半径 ×' + d.radiusScale + ' · 最小 ' + d.minPx + ' px';
    } else if (STATE.scale === 'distance') {
      note = '距离线性 ×1.00 · 半径 ×' + d.radiusScale + ' · 最小 ' + d.minPx + ' px';
    } else {
      note = '距离与半径均为线性真实值 · 无最小像素保护';
    }
    ui.setScale(STATE.scale, note);

    // true 档给一条明确的提示：这一档是真的什么都没放大
    var warn = document.getElementById('trueWarning');
    if (warn) {
      if (STATE.scale === 'true') {
        var H = core.h || 900;
        var dist = overviewDistance();
        var pxPerRad = (0.5 * H) / cam.tanHalf();
        var sunPx = (radiusWorld(meta[0].radiusAU) / dist) * pxPerRad;
        var earthPx = (radiusWorld(meta[3].radiusAU) / dist) * pxPerRad;
        var el = document.getElementById('truePixels');
        if (el) {
          el.textContent =
            '这一机位下：太阳半径 ' + sunPx.toFixed(3) + ' 像素，地球半径 ' + earthPx.toFixed(4) + ' 像素';
        }
        warn.removeAttribute('hidden');
      } else {
        warn.setAttribute('hidden', '');
      }
    }
  }

  function overviewState() {
    return {
      target: [0, 0, 0],
      dist: overviewDistance(),
      yaw: cam.yaw,
      pitch: cam.pitch,
    };
  }

  app.focusBody = function (i, opts) {
    if (i < 0 || i >= bodies.length) return;
    var wasOverview = STATE.focus < 0;
    var entering = STATE.focus !== i;
    if (entering) STATE.lastFocusEl = document.activeElement;
    if (wasOverview) {
      // 记住全景的机位，退出特写时原样还回去
      STATE.overviewCam = { yaw: cam.yaw, pitch: cam.pitch, target: [0, 0, 0] };
    }
    STATE.focus = i;
    STATE.hover = -1;
    ui.setHover(-1);
    ui.setActive(i);
    ui.showPanel(bodies[i]);
    ui.setBackVisible(true);
    ui.setMastheadTucked(true);
    ui.setHint('拖拽环绕 · 滚轮继续放大 · Esc 返回全景 · ← → 切换天体');

    var R = world.planetR[i] || world.sunR;
    var pos = (world.planetPos[i] || [0, 0, 0]).slice(0, 3);
    if (STATE.focus === 0) pos = [0, 0, 0];
    var dist = R * (opts && opts.close ? 1.35 : closeUpDistance(i));
    var ang = focusCameraAngles(i, pos);

    cam.flyTo(
      { target: pos, dist: dist, yaw: ang.yaw, pitch: ang.pitch },
      opts && opts.instant ? 0 : FLIGHT_MS
    );
    syncUrl();
    ui.setSrLine('已进入' + bodies[i].nameZh + '特写。按 Esc 返回全景。');
  };

  // 取景距离：有环的天体要把环也装进去
  function closeUpDistance(i) {
    var R = world.planetR[i] || world.sunR;
    if (i === 0) return R * 4.2;
    var b = bodies[i];
    if (b.rings) return R * Math.max(3.6, b.rings.outer * 2.95);
    return R * 4.1;
  }

  /* 镜头方位：既让主面被太阳照亮，又把这块天体的「招牌特征」转过来。
     例如木星会把大红斑所在的经度摆到画面中间，而不会一直背对着人。 */
  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm3(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function axialNorthVec(tiltDeg, node) {
    var t = (tiltDeg * Math.PI) / 180;
    return [Math.sin(t) * Math.cos(node), Math.sin(t) * Math.sin(node), Math.cos(t)];
  }

  function heroWorldDir(i, m) {
    var b = bodies[i];
    if (!b.hero) return null;
    var spin = spinAngle(m.rotHours, STATE.jd);
    var lon = b.hero.lon,
      lat = b.hero.lat;
    var v = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    // 世界→本地是 rotZ(spin)·frameᵀ·d，反过来就是 frame·rotZ(−spin)·l
    var c = Math.cos(-spin),
      s = Math.sin(-spin);
    var l0 = [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
    var up = axialNorthVec(m.tilt, m.node);
    var helper = Math.abs(up[2]) > 0.94 ? [1, 0, 0] : [0, 0, 1];
    var ex = norm3(cross3(helper, up));
    var ey = cross3(up, ex);
    return [
      ex[0] * l0[0] + ey[0] * l0[1] + up[0] * l0[2],
      ex[1] * l0[0] + ey[1] * l0[1] + up[1] * l0[2],
      ex[2] * l0[0] + ey[2] * l0[1] + up[2] * l0[2],
    ];
  }

  function focusCameraAngles(i, pos) {
    if (i === 0) return { yaw: cam.yaw, pitch: cam.pitch };
    var rr = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1]) || 1e-9;
    var rig = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]) || 1e-9;
    var sunYaw = Math.atan2(-pos[1] / rr, -pos[0] / rr);
    var sunPitch = Math.asin(-pos[2] / rig);
    // 偏 30° 左右：既看得见晨昏线，主面又是亮的
    var yaw = sunYaw + 0.55;
    var pitch = sunPitch + 0.2;
    var m = meta[i];
    var hd = heroWorldDir(i, m);
    if (hd) {
      var hy = Math.atan2(hd[1], hd[0]);
      var dy = hy - sunYaw;
      dy = ((((dy + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      dy = Math.max(-1.3, Math.min(1.3, dy));
      yaw = sunYaw + dy * 0.85;
      var hp = Math.asin(Math.max(-1, Math.min(1, hd[2])));
      pitch = Math.max(-0.85, Math.min(0.85, hp * 0.72 + 0.14));
    }
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    return { yaw: yaw, pitch: pitch };
  }

  app.exitFocus = function (opts) {
    if (STATE.focus < 0) return;
    STATE.focus = -1;
    STATE.hover = -1;
    ui.setHover(-1);
    ui.setActive(-1);
    ui.hidePanel();
    ui.setBackVisible(false);
    ui.setMastheadTucked(false);
    ui.setHint('点击天体进入特写 · 拖拽旋转 · 滚轮缩放 · Esc 返回');
    var saved = STATE.overviewCam;
    var s = overviewState();
    if (saved) {
      s.yaw = saved.yaw;
      s.pitch = saved.pitch;
    }
    STATE.overviewCam = null;
    cam.flyTo({ target: s.target, dist: s.dist }, opts && opts.instant ? 0 : FLIGHT_MS);
    if (STATE.lastFocusEl && STATE.lastFocusEl.focus) STATE.lastFocusEl.focus();
    else canvas.focus();
    syncUrl();
    ui.setSrLine('已返回全景。');
  };

  app.setHover = function (i) {
    if (STATE.hover === i) return;
    STATE.hover = i;
    ui.setHover(i);
    canvas.classList.toggle('is-hot', i >= 0);
    updateReadout();
  };

  app.setScale = function (id) {
    if (!SCALES[id] || STATE.scale === id) return;
    STATE.scale = id;
    applyScaleNote();
    orbitCache.jd = -1;
    assembleWorld(STATE.jd);
    if (STATE.focus >= 0) {
      var R = world.planetR[STATE.focus] || world.sunR;
      var pos = STATE.focus === 0 ? [0, 0, 0] : world.planetPos[STATE.focus].slice(0, 3);
      var ang = focusCameraAngles(STATE.focus, pos);
      cam.flyTo({ target: pos, dist: closeUpDistance(STATE.focus), yaw: ang.yaw, pitch: ang.pitch }, FLIGHT_MS);
    } else {
      cam.flyTo(overviewState(), FLIGHT_MS);
    }
    syncUrl();
  };

  app.setSpeed = function (id) {
    var found = null;
    window.HELIOS_UI.SPEEDS.forEach(function (s) {
      if (s.id === id) found = s;
    });
    if (!found) return;
    STATE.speedDays = found.days;
    STATE.playing = found.days > 0;
    ui.setSpeed(id);
    syncUrl();
  };

  app.setQuality = function (id) {
    if (!QUALITY[id]) return;
    STATE.quality = id;
    ui.setQuality(id);
    computePixelSize();
  };

  app.setStarBrightness = function (v) {
    STATE.starBright = Math.max(0, Math.min(1, v));
    ui.setStarBrightness(STATE.starBright);
  };

  app.toggleBackground = function () {
    STATE.bgOn = !STATE.bgOn;
    ui.setBackground(STATE.bgOn);
    syncUrl();
  };

  app.toggleConstellations = function () {
    STATE.constellations = !STATE.constellations;
    ui.setConstellations(STATE.constellations);
    syncUrl();
  };

  app.openHelp = function () {
    if (STATE.helpOpen) return;
    STATE.helpOpen = true;
    ui.openHelp();
  };

  app.closeHelp = function () {
    if (!STATE.helpOpen) return;
    STATE.helpOpen = false;
    ui.closeHelp();
  };

  app.setDateString = function (s) {
    var jd = dateStringToJd(s);
    if (jd === null) {
      ui.setDate(A.dateFromJd(STATE.jd));
      return;
    }
    STATE.jd = jd;
    orbitCache.jd = -1;
    ui.setDate(A.dateFromJd(jd));
    ui.setDateNote('JD ' + jd.toFixed(2));
    assembleWorld(STATE.jd);
    if (STATE.focus >= 0) {
      var pos = STATE.focus === 0 ? [0, 0, 0] : world.planetPos[STATE.focus];
      cam.target = pos.slice();
    }
    syncUrl();
    updateReadout();
  };

  app.setPlaying = function (on) {
    STATE.playing = on;
    if (!on) {
      STATE.speedDays = 0;
      ui.setSpeed('pause');
    } else if (STATE.speedDays === 0) {
      STATE.speedDays = 1;
      ui.setSpeed('day');
    }
  };

  app.stepBody = function (dir) {
    var cur = STATE.focus >= 0 ? STATE.focus : -1;
    var next = cur + dir;
    if (next < 0) next = bodies.length - 1;
    if (next >= bodies.length) next = 0;
    if (cur < 0) next = dir > 0 ? 0 : bodies.length - 1;
    app.focusBody(next);
  };

  function updateReadout() {
    var target = STATE.hover >= 0 ? STATE.hover : STATE.focus;
    if (target < 0) {
      ui.setReadout('');
      return;
    }
    var b = bodies[target];
    var p = world.auPos ? world.auPos[target] : null;
    var earth = world.auPos ? world.auPos[3] : null;
    var parts = [b.nameZh + ' · ' + b.nameEn];
    if (p && earth) {
      var r = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
      parts.push('距日 ' + (b.typeId === 0 ? '—' : r.toFixed(3) + ' AU'));
      if (b.typeId !== 0) {
        var dx = p[0] - earth[0],
          dy = p[1] - earth[1],
          dz = p[2] - earth[2];
        parts.push('距地 ' + Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(3) + ' AU');
      }
    }
    ui.setReadout(parts.join('  ·  '));
  }

  /* ---- URL -------------------------------------------------------------- */
  var urlTimer = 0;
  function syncUrl() {
    if (SHOT) return;
    if (urlTimer) return;
    urlTimer = window.setTimeout(function () {
      urlTimer = 0;
      var parts = [];
      if (STATE.focus >= 0) parts.push('body=' + bodies[STATE.focus].id);
      parts.push('date=' + jdToDateString(STATE.jd));
      parts.push('scale=' + STATE.scale);
      try {
        history.replaceState(null, '', location.pathname + location.search + '#' + parts.join('&'));
      } catch (e) {
        /* file:// 下某些浏览器会拒绝，无所谓 */
      }
    }, 220);
  }

  /* ---- 输入 ------------------------------------------------------------- */
  var drag = null;

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* 合成事件或已释放的指针，忽略 */
    }
    drag = {
      x: e.clientX,
      y: e.clientY,
      lx: e.clientX,
      ly: e.clientY,
      moved: 0,
      t: performance.now(),
    };
    canvas.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left;
    var py = e.clientY - rect.top;
    if (e.pointerType === 'mouse' || drag) {
      var hit = pickAt(px, py);
      app.setHover(hit);
    }
    if (!drag) return;
    var dx = e.clientX - drag.lx;
    var dy = e.clientY - drag.ly;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    cam.yaw -= dx * 0.005;
    cam.pitch = Math.max(-80 * (Math.PI / 180), Math.min(80 * (Math.PI / 180), cam.pitch + dy * 0.004));
    cam.flight = null;
  });

  function endDrag(e) {
    if (!drag) return;
    var moved = drag.moved;
    var dt = performance.now() - drag.t;
    drag = null;
    canvas.classList.remove('is-dragging');
    if (moved < 6 && dt < 700) {
      var rect = canvas.getBoundingClientRect();
      handleClick(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', function () {
    drag = null;
    canvas.classList.remove('is-dragging');
  });
  canvas.addEventListener('pointerleave', function () {
    if (!drag) app.setHover(-1);
  });

  function handleClick(px, py) {
    var hit = pickAt(px, py);
    if (hit >= 0) {
      if (STATE.focus === hit) return;
      app.focusBody(hit);
    } else if (STATE.focus >= 0) {
      app.exitFocus();
    }
  }

  canvas.addEventListener('dblclick', function (e) {
    var rect = canvas.getBoundingClientRect();
    var hit = pickAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit >= 0) {
      app.focusBody(hit, { close: true });
    }
  });

  function pickAt(px, py) {
    var items = [];
    for (var i = 0; i < 9; i++) {
      var p = world.planetPos[i];
      if (!p) continue;
      items.push({ id: i, pos: p, radius: world.planetR[i] });
    }
    var got = cam.pick(items, px, py, core.w, core.h, 12);
    return got ? got.id : -1;
  }

  canvas.addEventListener(
    'wheel',
    function (e) {
      e.preventDefault();
      var k = Math.exp(e.deltaY * 0.0012);
      var before = cam.dist;
      var lo = STATE.focus >= 0 ? (world.planetR[STATE.focus] || world.sunR) * 1.06 : overviewDistance() * 0.02;
      var hi = STATE.focus >= 0 ? (world.planetR[STATE.focus] || world.sunR) * 46 : overviewDistance() * 2.4;
      cam.dist = Math.max(lo, Math.min(hi, cam.dist * k));
      if (cam.dist !== before) cam.flight = null;
    },
    { passive: false }
  );

  // 双指捏合
  var pinch = null;
  canvas.addEventListener(
    'touchstart',
    function (e) {
      if (e.touches.length === 2) {
        pinch = {
          d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
          dist: cam.dist,
        };
        drag = null;
      }
    },
    { passive: true }
  );
  canvas.addEventListener(
    'touchmove',
    function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        cam.dist = pinch.dist * (pinch.d / Math.max(d, 1));
        cam.flight = null;
      }
    },
    { passive: false }
  );
  canvas.addEventListener('touchend', function () {
    pinch = null;
  });

  window.addEventListener('resize', resize);

  // 标签页隐藏时 requestAnimationFrame 本来就会停；这里额外把时间基准归零，
  // 免得切回来时第一帧 dt 过大把镜头飞行动画跳过去。（不要再调一次 rAF，
  // 否则会出现两条循环，每帧跑两遍。）
  document.addEventListener('visibilitychange', function () {
    lastT = document.hidden ? 0 : performance.now();
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (STATE.helpOpen) {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        app.closeHelp();
      }
      return;
    }
    var handled = true;
    if (e.key >= '1' && e.key <= '9') {
      app.focusBody(Number(e.key) - 1);
    } else if (e.key === 'ArrowRight') {
      app.stepBody(1);
    } else if (e.key === 'ArrowLeft') {
      app.stepBody(-1);
    } else if (e.key === 'Escape') {
      app.exitFocus();
    } else if (e.key === ' ') {
      app.setPlaying(!STATE.playing);
    } else if (e.key === 's' || e.key === 'S') {
      var order = ['orrery', 'distance', 'true'];
      app.setScale(order[(order.indexOf(STATE.scale) + 1) % 3]);
    } else if (e.key === 'b' || e.key === 'B') {
      app.toggleBackground();
    } else if (e.key === 'h' || e.key === 'H') {
      STATE.hudVisible = !STATE.hudVisible;
      ui.setHudVisible(STATE.hudVisible);
    } else if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      app.openHelp();
    } else {
      handled = false;
    }
    if (handled) e.preventDefault();
  });

  /* ---- 启动 ------------------------------------------------------------- */
  computePixelSize();
  applyScaleNote();
  if (SHOT) {
    var ld = document.getElementById('loader');
    if (ld) ld.style.display = 'none';
  }
  ui.setDate(A.dateFromJd(STATE.jd));
  ui.setDateNote('JD ' + STATE.jd.toFixed(2));
  ui.setStarBrightness(STATE.starBright);
  ui.setBackground(STATE.bgOn);
  ui.setConstellations(STATE.constellations);
  ui.setQuality(STATE.quality);
  ui.setHudVisible(STATE.hudVisible);

  if (SHOT) {
    ui.setSpeed('pause');
  } else {
    ui.setSpeed('pause');
    STATE.playing = false;
    STATE.speedDays = 0;
  }

  assembleWorld(STATE.jd);

  if (STATE.focus >= 0) {
    var fr = world.planetR[STATE.focus] || world.sunR;
    var fpos = STATE.focus === 0 ? [0, 0, 0] : world.planetPos[STATE.focus].slice(0, 3);
    var fang = focusCameraAngles(STATE.focus, fpos);
    cam.setImmediate({
      target: fpos,
      dist: closeUpDistance(STATE.focus),
      yaw: fang.yaw,
      pitch: fang.pitch,
    });
    ui.setActive(STATE.focus);
    ui.showPanel(bodies[STATE.focus]);
    ui.setBackVisible(true);
    ui.setMastheadTucked(true);
    ui.setHint('拖拽环绕 · 滚轮继续放大 · Esc 返回全景 · ← → 切换天体');
    var panelEl = document.getElementById('panel');
    panelEl.classList.add('is-open');
    panelEl.classList.add('no-anim');
  } else {
    var ov = overviewState();
    cam.setImmediate(ov);
  }

  ui.setLoader('正在解算轨道…');
  updateReadout();

  // 给 QA 与调试用的只读入口（不参与渲染逻辑）
  window.HELIOS_APP = {
    state: STATE,
    cam: cam,
    world: world,
    bodies: bodies,
    meta: meta,
    focusBody: app.focusBody,
    exitFocus: app.exitFocus,
    setScale: app.setScale,
    setSpeed: app.setSpeed,
    setDateString: app.setDateString,
    setHover: app.setHover,
    openHelp: app.openHelp,
    closeHelp: app.closeHelp,
    demo: function (jd) {
      var out = {};
      for (var i = 1; i < bodies.length; i++) {
        var p = A.heliocentric(ORBITS.elements[meta[i].orbitId], jd);
        out[bodies[i].id] = { lon: +p.lon.toFixed(4), lat: +p.lat.toFixed(4), r: +p.r.toFixed(6) };
      }
      return out;
    },
    starCount: renderer.starCount,
    floatTargets: renderer.floatOK,
  };

  requestAnimationFrame(render);
})();
