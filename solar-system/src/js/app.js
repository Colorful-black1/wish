/* ==========================================================================
   app.js — 状态机、世界装配、四层运动、输入、URL、渲染循环
   状态：全景 Orrery / 特写 Close-up / 时间（任何状态可用）/ 帮助浮层
   v2 追加：三档参考系、螺旋轨迹、L0–L3 连续缩放、六档时间与里程表
   ========================================================================== */
(function () {
  'use strict';

  var A = window.HELIOS_ASTRO;
  var DATA = window.HELIOS_BODIES;
  var SKY = window.HELIOS_SKY;
  var ORBITS = window.HELIOS_ORBITS;
  var MOTION = window.HELIOS_MOTION;
  var M = window.HELIOS_MOTION_MATH;

  var AU_KM = 149597870.7;
  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  /* ---- 尺度模式 --------------------------------------------------------- */
  var SCALES = {
    orrery: { k: 1.15, p: 0.55, radiusScale: 36, minPx: 3.2, label: '比例压缩' },
    distance: { k: 1.0, p: 1.0, radiusScale: 30, minPx: 2.6, label: '真实距离' },
    true: { k: 1.0, p: 1.0, radiusScale: 1.0, minPx: 0, label: '完全真实' },
  };

  /* ss = 场景超采样倍率；maxPx = 场景缓冲的像素预算（决定 1080p 下能否跑满 ss） */
  var QUALITY = {
    standard: { maxPx: 2.2e6, dprCap: 1.5, ss: 1.0, octaves: 5, ringSamples: 32, psf: 3, bloomPasses: 2, detailScale: 0.6, grain: 0.024 },
    high: { maxPx: 3.4e6, dprCap: 2.0, ss: 1.25, octaves: 7, ringSamples: 64, psf: 5, bloomPasses: 4, detailScale: 0.85, grain: 0.016 },
    cinematic: { maxPx: 5.4e6, dprCap: 2.0, ss: 1.5, octaves: 9, ringSamples: 128, psf: 7, bloomPasses: 6, detailScale: 1.0, grain: 0.012 },
  };

  /* 后期参数：滑杆给的是倍数，1 = 默认 */
  var POST_DEFAULTS = { exposure: 1, bloom: 1, grain: 1, aberration: 1 };
  var POST = Object.assign({}, POST_DEFAULTS);

  function defaultQuality() {
    var w = window.innerWidth;
    var cores = navigator.hardwareConcurrency || 4;
    var touch = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '');
    if (w < 760 || touch || cores <= 4) return 'standard';
    return 'high';
  }

  var SKY_GAIN = 8.7e-5;
  var FLIGHT_MS = 1000;
  var SETTLE_MS = 200;
  var JD_MIN = A.julianDay(1600, 1, 1, 0);
  var JD_MAX = A.julianDay(2400, 12, 31, 0);
  var TODAY_JD = A.julianDay(2026, 11, 4, 0);

  /* ---- 启动参数 --------------------------------------------------------- */
  var QS = new URLSearchParams(location.search);
  var SHOT = QS.get('shot') === '1';
  var SHOT_UI = QS.get('ui') !== '0';
  window.__HELIOS_DEBUG_ON = QS.has('debug');
  // 截图模式下把所有 CSS 过渡和动画关掉：否则面板入场这类动画会让同一 URL 两次截图不一样
  if (SHOT) document.documentElement.classList.add('shot-mode');
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
    return String(c.y).padStart(4, '0') + '-' + String(c.m).padStart(2, '0') + '-' + String(Math.floor(c.d)).padStart(2, '0');
  }

  /** 模拟时刻的可读标签：2050 年以内显示日历，超出显示年数 */
  function simDateLabel(jd) {
    var years = (jd - A.J2000) / 365.25;
    var y = 2000 + years;
    if (jd >= JD_MIN && jd <= JD_MAX) {
      var c = A.calendarFromJulianDay(jd);
      return (
        String(c.y).padStart(4, '0') + '-' + String(c.m).padStart(2, '0') + '-' + String(Math.floor(c.d)).padStart(2, '0')
      );
    }
    var sign = y < 0 ? '公元前 ' : '公元 ';
    var ay = Math.abs(y);
    if (ay >= 1e8) return sign + (ay / 1e8).toFixed(2) + ' 亿年';
    if (ay >= 1e4) return sign + (ay / 1e4).toFixed(2) + ' 万年';
    return sign + Math.round(ay) + ' 年';
  }

  /* ---- 状态 ------------------------------------------------------------- */
  var hash = parseHash();
  var initScale = SCALES[QS.get('scale')] ? QS.get('scale') : SCALES[hash.scale] ? hash.scale : 'orrery';
  var initJd = dateStringToJd(QS.get('date') || '') || dateStringToJd(hash.date) || TODAY_JD;
  var initFocusName = QS.get('focus') || hash.body || '';
  var initFrame = ['sun', 'galactic', 'cmb'].indexOf(QS.get('frame') || hash.frame) >= 0
    ? QS.get('frame') || hash.frame
    : 'sun';
  var initZoom = Number(QS.get('zoom') || hash.zoom || 1);
  if (!isFinite(initZoom) || initZoom <= 0) initZoom = 1;
  var initFocus = -1;
  DATA.bodies.forEach(function (b, i) {
    if (b.id === initFocusName) initFocus = i;
  });

  var STATE = {
    scale: initScale,
    jd: initJd,
    frame: initFrame,
    playing: !SHOT,
    yearsPerSecond: SHOT ? 0 : 0,
    focus: initFocus,
    hover: -1,
    bgOn: true,
    constellations: false,
    starBright: 0.55,
    hudVisible: SHOT ? SHOT_UI : true,
    quality: ['standard', 'high', 'cinematic'].indexOf(QS.get('q')) >= 0 ? QS.get('q') : defaultQuality(),
    helpOpen: false,
    lastFocusEl: null,
    overviewCam: null,
    debugView: 0,
    trailGain: MOTION.trailGainDefault,
    trailSpanYears: 3,
    epochYears: 0,
    lod: 1,
    planetLocked: false,
  };

  var bodies = DATA.bodies;
  var moons = DATA.moons || [];
  var timeSteps = MOTION.timeSteps;

  function timeStepById(id) {
    for (var i = 0; i < timeSteps.length; i++) if (timeSteps[i].id === id) return timeSteps[i];
    return timeSteps[0];
  }

  /* ---- 依赖 ------------------------------------------------------------- */
  var canvas = document.getElementById('gl');
  var renderer = window.HELIOS_RENDERER.create(canvas);
  if (!renderer || renderer.failed) {
    var fb = document.getElementById('fallback');
    if (!renderer) {
      fb.querySelector('h2').textContent = '这台设备上的浏览器没有 WebGL2';
    } else {
      fb.querySelector('h2').textContent = '这台设备上的 WebGL2 驱动无法编译本页的着色器';
      var pre = document.createElement('pre');
      pre.style.cssText = 'font-size:10px;color:#6FA8B8;white-space:pre-wrap;max-height:180px;overflow:auto;max-width:100%;';
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
    STATE.yearsPerSecond = 0;
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
      tilt: b.pole ? b.pole.tilt : b.obliquityDeg || 0,
      node: b.pole ? b.pole.node : hash01(b.id) * TAU,
      hero: b.hero || null,
      rotHours: Math.abs(b.rotationHours || 24),
      radiusAU: b.radiusKm / AU_KM,
      colorA: b.visual.colorA,
      colorB: b.visual.colorB,
      colorC: b.visual.colorC,
      albedo: (DATA.meta.albedo && DATA.meta.albedo[b.id]) || 1,
      atmoStrength: b.atmosphere ? b.atmosphere.strength : 0,
      atmoScale: b.atmosphere ? b.atmosphere.scale : 0,
      atmoColor: b.atmosphere ? b.atmosphere.color : [0, 0, 0],
      // Mie 前向散射强度：与大气厚度挂钩，各天体不同（金星/地球最强）
      mie: b.atmosphere ? Math.min(0.95, 0.12 + b.atmosphere.scale * 20) : 0,
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
    var ra = o.ra * DEG;
    var dec = o.dec * DEG;
    var north = { x: -Math.sin(dec) * Math.cos(ra), y: -Math.sin(dec) * Math.sin(ra), z: Math.cos(dec) };
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
      bright: Math.min((flux / area) * SKY_GAIN, 3.0),
      kind: kindMap[o.kind] === undefined ? 0 : kindMap[o.kind],
    };
  });
  renderer.uploadSky(skyList);
  renderer.uploadRings(ringDefs);

  /* ---- 银河矩阵：黄道 → 银道 ------------------------------------------- */
  var eclToGal = (function () {
    var e = A.OBLIQUITY_J2000 * DEG;
    var c = Math.cos(e), s = Math.sin(e);
    var R = [[1, 0, 0], [0, c, -s], [0, s, c]];
    var MM = [
      [-0.0548755604, -0.8734370902, -0.4838350155],
      [0.4941094279, -0.44482963, 0.7469822445],
      [-0.867666149, -0.1980763734, 0.4559837762],
    ];
    var out = new Float32Array(9);
    for (var col = 0; col < 3; col++) {
      for (var row = 0; row < 3; row++) {
        var v = 0;
        for (var k = 0; k < 3; k++) v += MM[row][k] * R[k][col];
        out[col * 3 + row] = v;
      }
    }
    return out;
  })();

  /* ---- 尺度换算 --------------------------------------------------------- */
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
    var outer = distWorld(30.07);
    return (outer / Math.tan((cam.fovDeg * Math.PI) / 360)) * 1.12;
  }

  /** 银河/CMB 参考系下的取景：按「轨迹一圈占多大」来定，让螺旋填满画面 */
  function trailFraming() {
    var driftAu =
      (MOTION.sun.galactic.speedKms * MOTION.units.auPerYearPerKms * STATE.trailSpanYears) / STATE.trailGain;
    var driftWorld = distWorld(driftAu);
    var extent = Math.max(10, driftWorld * 1.2 + 5);
    return (extent / (2 * Math.tan((cam.fovDeg * Math.PI) / 360))) * 0.95;
  }

  function spinAngle(rotHours, jd) {
    var a = ((jd - A.J2000) * 24) / rotHours * TAU;
    a = a % TAU;
    return a < 0 ? a + TAU : a;
  }

  /* ---- 四层运动 --------------------------------------------------------- */
  function simYears() {
    return (STATE.jd - A.J2000) / 365.25;
  }

  /** 当前参考系要减掉的太阳位移（世界单位）。orrery 模式下位移也按同一套 r^0.55 压缩，
      否则「压缩过的轨道 + 没压缩的漂移」会让螺旋和轨道不成比例。 */
  function offsetAt(years) {
    var off = M.frameOffsetDelta(STATE.frame, STATE.epochYears, years, STATE.trailGain);
    var d = scaleDef();
    if (d.p === 1) return off;
    var m = Math.sqrt(off[0] * off[0] + off[1] * off[1] + off[2] * off[2]);
    if (m < 1e-9) return off;
    var f = distWorld(m) / m;
    return [off[0] * f, off[1] * f, off[2] * f];
  }

  function frameOffsetWorld() {
    return offsetAt(simYears());
  }

  /** 行星位置一直在算。JPL 根数的拟合区间是 1800–2050，越过之后是外推——
      这一点写在 README 里，界面上不再冻结、也不弹提示。 */
  function planetJd() {
    return STATE.jd;
  }

  /* ---- 每帧世界装配 ----------------------------------------------------- */
  var world = {
    planetPos: [],
    planetR: [],
    auPos: [],
    offset: [0, 0, 0],
    sunPos: [0, 0, 0],
    sunR: 0.1,
  };

  function assembleWorld(jd) {
    var pjd = planetJd();
    var off = frameOffsetWorld();
    world.offset = off;
    var positions = [];
    var au = [];
    for (var i = 1; i < bodies.length; i++) {
      var el = ORBITS.elements[meta[i].orbitId];
      var p = A.heliocentric(el, pjd);
      var f = distWorld(p.r) / p.r;
      positions[i] = [p.x * f - off[0], p.y * f - off[1], p.z * f - off[2], p.r];
      au[i] = [p.x, p.y, p.z];
    }
    positions[0] = [-off[0], -off[1], -off[2], 0];
    au[0] = [0, 0, 0];
    world.planetPos = positions;
    world.auPos = au;
    world.sunPos = positions[0];
    world.planetR = positions.map(function (p, i) {
      return radiusWorld(meta[i].radiusAU);
    });
    world.sunR = radiusWorld(meta[0].radiusAU);
    return positions;
  }

  /** 任意时刻的天体位置（给轨迹采样用，不写进 world） */
  function planetPosAt(jd, i, off) {
    if (i === 0) return [-off[0], -off[1], -off[2]];
    var el = ORBITS.elements[meta[i].orbitId];
    var p = A.heliocentric(el, Math.max(JD_MIN, Math.min(JD_MAX, jd)));
    var f = distWorld(p.r) / p.r;
    return [p.x * f - off[0], p.y * f - off[1], p.z * f - off[2]];
  }

  /* ---- 轨迹：按模拟时间等间距采样，切换参考系立刻重算 -------------------- */
  var TRAIL_SAMPLES = 96;
  var trailCache = { key: '', planets: [], sun: [], span: 0 };

  function trailKey() {
    return (
      STATE.frame + '|' + STATE.trailGain + '|' + STATE.scale + '|' +
      STATE.jd.toFixed(3) + '|' + STATE.trailSpanYears.toFixed(6)
    );
  }

  function buildTrails() {
    var key = trailKey();
    if (trailCache.key === key) return trailCache;
    var span = STATE.trailSpanYears;
    var yearsNow = simYears();
    var step = span / (TRAIL_SAMPLES - 1);
    var off = frameOffsetWorld();
    var planets = [];
    var sun = [];
    for (var s = 0; s < TRAIL_SAMPLES; s++) {
      var dt = span - s * step; // 从最早到当前
      var offAt = offsetAt(yearsNow - dt);
      sun.push([-offAt[0], -offAt[1], -offAt[2]]);
    }
    for (var i = 1; i < bodies.length; i++) {
      var arr = [];
      for (var s2 = 0; s2 < TRAIL_SAMPLES; s2++) {
        var dt2 = span - s2 * step;
        var jd2 = STATE.jd - dt2 * 365.25;
        var off2 = offsetAt(yearsNow - dt2);
        arr.push(planetPosAt(jd2, i, off2));
      }
      planets.push(arr);
    }
    trailCache = { key: key, planets: planets, sun: sun, span: span };
    return trailCache;
  }

  /* ---- 渲染列表 --------------------------------------------------------- */
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
        spin: spinAngle(meta[i].rotHours, planetJd()),
        colorA: meta[i].colorA,
        atmoStrength: meta[i].atmoStrength,
        colorB: meta[i].colorB,
        atmoScale: meta[i].atmoScale,
        colorC: meta[i].colorC,
        atmoColor: meta[i].atmoColor,
        albedo: meta[i].albedo,
        mie: meta[i].mie,
        ringSlot: meta[i].ringSlot,
        pxRadius: pxR,
      });
    }

    for (var m = 0; m < moonMeta.length; m++) {
      var mm = moonMeta[m];
      var pIdx = mm.parent;
      var ppos = positions[pIdx];
      var pr = world.planetR[pIdx];
      var orbitR = pr * mm.orbitRatios;
      var phi = mm.phase + (TAU * (planetJd() - A.J2000)) / mm.periodDays;
      var tiltR = (meta[pIdx].tilt * Math.PI) / 180;
      var cT = Math.cos(tiltR), sT = Math.sin(tiltR);
      var px = ppos[0] + orbitR * Math.cos(phi);
      var py = ppos[1] + orbitR * Math.sin(phi) * cT;
      var pz = ppos[2] + orbitR * Math.sin(phi) * sT;
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
        spin: spinAngle(mm.rotHours, planetJd()),
        colorA: mm.colorA,
        atmoStrength: 0,
        colorB: mm.colorB,
        atmoScale: 0,
        colorC: mm.colorC,
        atmoColor: [0, 0, 0],
        albedo: 0.85,
        mie: 0,
        ringSlot: 0,
        pxRadius: mpx,
      });
    }
    return list;
  }

  /* ---- 线段投影（CPU 侧近平面裁剪） ------------------------------------ */
  var lineScratch = new Float32Array(7 * 2 * 8192);
  var lineCount = 0;

  function pushLine(p0, p1, c0, c1, ox, oy) {
    if (lineCount + 2 > lineScratch.length / 7) return;
    var b = cam.basis();
    var pos = cam.position();
    var th = cam.tanHalf();
    var asp = core.w / core.h;
    var NEAR = 1e-7;
    var dx0 = ox || 0, dy0 = oy || 0;

    function toView(p) {
      var dx = p[0] - pos[0], dy = p[1] - pos[1], dz = p[2] - pos[2];
      return { x: dx * b[0] + dy * b[1] + dz * b[2], y: dx * b[3] + dy * b[4] + dz * b[5], z: dx * b[6] + dy * b[7] + dz * b[8] };
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
    arr[base + 0] = a.x / (a.z * th * asp) + dx0;
    arr[base + 1] = a.y / (a.z * th) + dy0;
    arr[base + 2] = core.depthOf(a.z);
    arr[base + 3] = c0[0];
    arr[base + 4] = c0[1];
    arr[base + 5] = c0[2];
    arr[base + 6] = c0[3];
    arr[base + 7] = q.x / (q.z * th * asp) + dx0;
    arr[base + 8] = q.y / (q.z * th) + dy0;
    arr[base + 9] = core.depthOf(q.z);
    arr[base + 10] = c1[0];
    arr[base + 11] = c1[1];
    arr[base + 12] = c1[2];
    arr[base + 13] = c1[3];
    lineCount += 2;
  }

  /* ---- 轨道线缓存 ------------------------------------------------------- */
  var orbitCache = { jd: -1, scale: '', pts: [] };
  var ORBIT_SEGMENTS = 220;

  function orbitWorldPoints() {
    if (Math.abs(orbitCache.jd - STATE.jd) < 0.4 && orbitCache.scale === STATE.scale) return orbitCache.pts;
    var out = [];
    var pjd = planetJd();
    for (var i = 1; i < bodies.length; i++) {
      var el = ORBITS.elements[meta[i].orbitId];
      var path = A.orbitPath(el, pjd, ORBIT_SEGMENTS);
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

  function projectSkyPair(d0, d1, color) {
    var b = cam.basis();
    var th = cam.tanHalf();
    var asp = core.w / core.h;
    var N = 12;
    var prev = null;
    for (var k = 0; k <= N; k++) {
      var t = k / N;
      var v = { x: d0.x + (d1.x - d0.x) * t, y: d0.y + (d1.y - d0.y) * t, z: d0.z + (d1.z - d0.z) * t };
      var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
      v.x /= l; v.y /= l; v.z /= l;
      var vz = v.x * b[6] + v.y * b[7] + v.z * b[8];
      var cur = vz > 0.02 ? { x: v.x / (vz * th * asp), y: v.y / (vz * th) } : null;
      if (prev && cur) {
        var base = lineCount * 7;
        if (lineCount + 2 > lineScratch.length / 7) return;
        lineScratch[base] = prev.x; lineScratch[base + 1] = prev.y; lineScratch[base + 2] = 1.0;
        lineScratch[base + 3] = color[0]; lineScratch[base + 4] = color[1]; lineScratch[base + 5] = color[2]; lineScratch[base + 6] = color[3];
        lineScratch[base + 7] = cur.x; lineScratch[base + 8] = cur.y; lineScratch[base + 9] = 1.0;
        lineScratch[base + 10] = color[0]; lineScratch[base + 11] = color[1]; lineScratch[base + 12] = color[2]; lineScratch[base + 13] = color[3];
        lineCount += 2;
      }
      prev = cur;
    }
  }

  /* ---- 主循环 ----------------------------------------------------------- */
  var core = {
    w: 1, h: 1, pxW: 1, pxH: 1, dpr: 1, lastDate: '',
    depthOf: function (t) { return Math.min(1 - Math.exp(-t * 0.9), 0.9995); },
  };

  function computePixelSize() {
    var q = QUALITY[STATE.quality];
    var dpr = DPR_OVERRIDE !== null ? DPR_OVERRIDE : Math.min(window.devicePixelRatio || 1, q.dprCap);
    var cw = Math.max(1, canvas.clientWidth || window.innerWidth);
    var ch = Math.max(1, canvas.clientHeight || window.innerHeight);
    var w = Math.max(1, Math.round(cw * dpr * dynScale));
    var h = Math.max(1, Math.round(ch * dpr * dynScale));
    // 场景在超采样分辨率上渲染，合成时做 4 抽样降采样：行星边缘和环的锯齿会明显少一截
    var ss = q.ss;
    var sw = Math.max(1, Math.round(w * ss));
    var sh = Math.max(1, Math.round(h * ss));
    if (sw * sh > q.maxPx) {
      var k = Math.sqrt(q.maxPx / (sw * sh));
      sw = Math.max(1, Math.round(sw * k));
      sh = Math.max(1, Math.round(sh * k));
      ss = sw / w;
    }
    core.w = cw; core.h = ch;
    core.pxW = w; core.pxH = h;
    core.sceneW = sw; core.sceneH = sh;
    core.ss = ss;
    core.dpr = sw / cw; // 场景像素 / CSS 像素：星点尺寸要用它
    renderer.resize(w, h);
  }

  /* 动态分辨率：连续掉帧就把渲染比例降一档，恢复后慢慢升回来。shot 模式下冻结。 */
  var dynScale = 1;
  var slowFrames = 0;
  var fastFrames = 0;
  function adaptResolution(dt) {
    if (SHOT) return;
    if (dt > 34) { slowFrames++; fastFrames = 0; }
    else if (dt < 20) { fastFrames++; slowFrames = 0; }
    if (slowFrames > 45 && dynScale > 0.52) {
      dynScale = Math.max(0.5, dynScale * 0.85);
      slowFrames = 0;
      computePixelSize();
    } else if (fastFrames > 240 && dynScale < 1) {
      dynScale = Math.min(1, dynScale * 1.1);
      fastFrames = 0;
      computePixelSize();
    }
  }

  function resize() {
    computePixelSize();
  }

  var lastT = 0;
  var frames = 0;
  var elapsed = 0;
  var expoSmooth = 1;
  var needReadout = false;

  /** 由相机距离决定 LOD 与银河淡入 */
  function computeLod() {
    var d = cam.dist;
    var l1 = overviewDistance();
    var mixNear = clamp01((Math.log(Math.max(d, 1)) - Math.log(l1 * 40)) / (Math.log(l1 * 900) - Math.log(l1 * 40)));
    var mixGal = clamp01((Math.log(Math.max(d, 1)) - Math.log(l1 * 900)) / (Math.log(l1 * 4000) - Math.log(l1 * 900)));
    var lod = d < l1 * 3 ? 1 : d < l1 * 900 ? 2 : 3;
    if (STATE.focus >= 0) lod = 0;
    return { nearMix: mixNear, galaxyMix: mixGal, lod: lod };
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  var trailColorFor = [
    [0.42, 0.68, 0.78],
    [0.66, 0.62, 0.54],
    [0.92, 0.85, 0.55],
    [0.44, 0.72, 1.00],
    [0.98, 0.50, 0.32],
    [1.00, 0.82, 0.52],
    [1.00, 0.92, 0.64],
    [0.60, 0.96, 1.00],
    [0.46, 0.62, 1.00],
  ];

  function render(now) {
    /* 截图模式用固定步长：同一 URL 两次截图必须逐像素一致，不能受机器快慢影响 */
    var dt = SHOT ? 16 : lastT ? Math.min(now - lastT, 120) : 16;
    lastT = now;
    frames++;
    if (!SHOT) elapsed += dt / 1000;
    adaptResolution(dt);

    if (STATE.playing && STATE.yearsPerSecond !== 0 && !SHOT) {
      STATE.jd += (STATE.yearsPerSecond * 365.25 * dt) / 1000;
      var label = simDateLabel(STATE.jd);
      if (label !== core.lastDate) {
        core.lastDate = label;
        ui.setDate(A.dateFromJd(planetJd()));
        ui.setDateNote('JD ' + planetJd().toFixed(2));
        needReadout = true;
      }
    }

    cam.update(dt);
    cam.compute();

    assembleWorld(STATE.jd);

    // 参考系下整体漂移：相机留在「银河系」里不动，让太阳自己走过去；
    // 只有太阳快走出画面时才慢慢跟一下（死区 75%），所以运动是看得见的。
    if (STATE.frame !== 'sun' && STATE.focus < 0 && !cam.isFlying()) {
      var b = cam.basis();
      var halfH = cam.dist * cam.tanHalf();
      var halfW = halfH * (core.w / core.h);
      var sp = world.sunPos;
      var ddx = sp[0] - cam.target[0];
      var ddy = sp[1] - cam.target[1];
      var ddz = sp[2] - cam.target[2];
      var rx = ddx * b[0] + ddy * b[1] + ddz * b[2];
      var uy = ddx * b[3] + ddy * b[4] + ddz * b[5];
      var limX = halfW * 0.75;
      var limY = halfH * 0.72;
      var ox = Math.abs(rx) > limX ? rx - Math.sign(rx) * limX : 0;
      var oy = Math.abs(uy) > limY ? uy - Math.sign(uy) * limY : 0;
      if (ox !== 0 || oy !== 0) {
        var kk = 1 - Math.exp(-dt / 700);
        var mx = ox * kk;
        var my = oy * kk;
        cam.target[0] += b[0] * mx + b[3] * my;
        cam.target[1] += b[1] * mx + b[4] * my;
        cam.target[2] += b[2] * mx + b[5] * my;
        cam.compute();
      }
    } else if (STATE.focus >= 0 && !cam.isFlying()) {
      var fp = world.planetPos[STATE.focus];
      if (fp) {
        var lift = focusLift();
        cam.target[0] = fp[0] - cam.basis()[3] * lift;
        cam.target[1] = fp[1] - cam.basis()[4] * lift;
        cam.target[2] = fp[2] - cam.basis()[5] * lift;
      }
    }

    // 浮动原点：位移累积到几万 AU 就把 epoch 挪到当前，并同步平移相机，画面不跳
    if (STATE.frame !== 'sun' && !cam.isFlying()) {
      var offNow = world.offset;
      var mag = Math.sqrt(offNow[0] * offNow[0] + offNow[1] * offNow[1] + offNow[2] * offNow[2]);
      if (mag > 3e4) {
        STATE.epochYears = simYears();
        cam.target[0] += offNow[0];
        cam.target[1] += offNow[1];
        cam.target[2] += offNow[2];
        trailCache.key = '';
        assembleWorld(STATE.jd);
        cam.compute();
      }
    }

    var lodInfo = computeLod();
    STATE.lod = lodInfo.lod;

    var list = buildRenderList(STATE.jd, core.w, core.h);
    renderer.uploadBodies(list);
    if (window.__HELIOS_DEBUG_ON) {
      window.HELIOS_DEBUG = {
        frame: STATE.frame,
        scale: STATE.scale,
        dist: cam.dist,
        offset: world.offset.slice(),
        sunPos: world.sunPos.slice(0, 3),
        camPos: Array.prototype.slice.call(cam.position()),
        sunR: list[0].radius,
        sunPx: cam.screenRadius(world.sunPos, list[0].radius, core.h),
        nearMix: lodInfo.nearMix,
        galaxyMix: lodInfo.galaxyMix,
        exposure: expoSmooth,
        lod: lodInfo.lod,
      };
    }

    /* 线段：轨道（L1 全景）+ 螺旋轨迹（非太阳参考系）+ 星座连线 */
    lineCount = 0;
    // 运动参考系下不画「日心椭圆」：那时行星已经不在椭圆上了，画出来是错的
    var showOrbits = STATE.frame === 'sun' && STATE.focus < 0 && lodInfo.galaxyMix < 0.6;
    if (showOrbits) {
      var orbits = orbitWorldPoints();
      var offw = world.offset;
      for (var i = 0; i < orbits.length; i++) {
        var pts = orbits[i];
        var col = [0.43, 0.66, 0.72, 0.17];
        for (var k = 0; k + 1 < pts.length / 3; k++) {
          pushLine(
            [pts[k * 3] - offw[0], pts[k * 3 + 1] - offw[1], pts[k * 3 + 2] - offw[2]],
            [pts[k * 3 + 3] - offw[0], pts[k * 3 + 4] - offw[1], pts[k * 3 + 5] - offw[2]],
            col, col
          );
        }
      }
    }

    if (STATE.frame !== 'sun' && lodInfo.galaxyMix < 0.75 && !SHOT_TRAILS_OFF) {
      // 轨迹时间窗：至少 3 年，时间倍率大时按 1.2 秒的模拟时间自动放宽
      STATE.trailSpanYears = Math.max(3, Math.abs(STATE.yearsPerSecond) * 1.2);
      var tr = buildTrails();
      // 线宽：WebGL 只有 1px，复制一条偏移线凑出 ~2.2px 的观感
      var tw = 1.1 / core.w;
      var sc = [0.98, 0.80, 0.38];
      for (var s = 0; s + 1 < tr.sun.length; s++) {
        var a0 = s / tr.sun.length;
        var a1 = (s + 1) / tr.sun.length;
        var ca = 0.12 + 0.78 * a0;
        var cb = 0.12 + 0.78 * a1;
        pushLine(tr.sun[s], tr.sun[s + 1], [sc[0], sc[1], sc[2], ca], [sc[0], sc[1], sc[2], cb], -tw, 0);
        pushLine(tr.sun[s], tr.sun[s + 1], [sc[0], sc[1], sc[2], ca], [sc[0], sc[1], sc[2], cb], tw, 0);
      }
      // 行星的螺旋
      for (var pi = 0; pi < tr.planets.length; pi++) {
        var c0 = trailColorFor[pi + 1] || [0.6, 0.6, 0.6];
        var arr = tr.planets[pi];
        for (var s2 = 0; s2 + 1 < arr.length; s2++) {
          var t0 = s2 / arr.length;
          var t1v = (s2 + 1) / arr.length;
          var pa0 = 0.06 + 0.80 * t0;
          var pa1 = 0.06 + 0.80 * t1v;
          pushLine(arr[s2], arr[s2 + 1], [c0[0], c0[1], c0[2], pa0], [c0[0], c0[1], c0[2], pa1], -tw, 0);
          pushLine(arr[s2], arr[s2 + 1], [c0[0], c0[1], c0[2], pa0], [c0[0], c0[1], c0[2], pa1], tw, 0);
        }
      }
    }

    if (STATE.constellations && STATE.bgOn) {
      var segs = constellationSegments();
      for (var sg = 0; sg < segs.length; sg++) projectSkyPair(segs[sg][0], segs[sg][1], [0.42, 0.6, 0.68, 0.22]);
    }
    renderer.setLines(lineCount > 0 ? lineScratch.subarray(0, lineCount * 7) : null);

    /* 细节层级 */
    var detail = 0;
    var refBody = STATE.focus >= 0 ? list[STATE.focus] : null;
    if (!refBody) {
      var bestD = 1e18;
      for (var bi = 0; bi < 9; bi++) {
        var d2 = dist2(list[bi].pos);
        if (d2 < bestD) { bestD = d2; refBody = list[bi]; }
      }
    }
    if (refBody && refBody.geomRadius > 0) {
      var ratio = Math.sqrt(dist2(refBody.pos)) / Math.max(refBody.geomRadius, 1e-9);
      detail = 1 - (Math.log(Math.max(ratio, 1.15)) - Math.log(1.15)) / (Math.log(28) - Math.log(1.15));
      detail = Math.max(0, Math.min(1, detail));
    }
    detail *= QUALITY[STATE.quality].detailScale;

    /* 自动曝光：进入特写时 0.6 秒过渡（shot 模式直接到位，保证两次截图一致） */
    var targetExpo = STATE.focus === 0 ? 0.80 : STATE.focus >= 0 ? 1.0 : 0.95;
    if (SHOT) expoSmooth = targetExpo;
    else expoSmooth += (targetExpo - expoSmooth) * (1 - Math.exp(-dt / 300));

    renderer.render({
      pixelWidth: core.pxW,
      pixelHeight: core.pxH,
      sceneWidth: core.sceneW,
      sceneHeight: core.sceneH,
      ss: core.ss,
      debugView: STATE.debugView,
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
      exposure: expoSmooth * POST.exposure,
      bloomGain: 0.5 * POST.bloom,
      bloomThreshold: 0.95,
      bloomPasses: QUALITY[STATE.quality].bloomPasses,
      grain: QUALITY[STATE.quality].grain * POST.grain,
      vignette: 0.32,
      aberration: 0.0016 * POST.aberration,
      frameIndex: SHOT ? 0 : frames,
      linesOn: true,
      eclToGal: eclToGal,
      skyObjCount: skyList.length,
      nearMix: lodInfo.nearMix,
      galaxyMix: lodInfo.galaxyMix,
      galaxyCam: galaxyCamera(),
      sunGalAngle: STATE.frame === 'sun' ? 0 : (-simYears() * (2 * Math.PI)) / MOTION.sun.galactic.periodYr,
      psf: QUALITY[STATE.quality].psf,
      octaveCap: QUALITY[STATE.quality].octaves,
    });

    if (!window.__HELIOS_READY && frames >= (SHOT ? 6 : 2)) {
      document.documentElement.setAttribute('data-ready', 'true');
      document.body.setAttribute('data-ready', 'true');
      window.__HELIOS_READY = true;
    }

    if (frames === 2 && !SHOT) ui.hideLoader();
    if (STATE.pendingPng) flushPng();
    if (needReadout || frames % 20 === 0) {
      needReadout = false;
      updateReadouts();
      updateTelemetry(dt);
    }
    requestAnimationFrame(render);
  }

  var SHOT_TRAILS_OFF = false;

  function dist2(p) {
    var c = cam.position();
    var dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2];
    return dx * dx + dy * dy + dz * dz;
  }

  /** 银河视图的虚拟机位：由相机 yaw/pitch 与对数距离映射 */
  function galaxyCamera() {
    var l1 = overviewDistance();
    var t = Math.log(Math.max(cam.dist, 1)) - Math.log(l1 * 900);
    var span = Math.log(l1 * 12000) - Math.log(l1 * 900);
    var z = Math.max(0, Math.min(1, t / span));
    // 距离 90 kpc → 34 kpc；仰角 34° → 12°
    var distKpc = 90 - 56 * z;
    var elev = (34 - 22 * z) * DEG;
    var azim = cam.yaw;
    return new Float32Array([distKpc, azim, elev]);
  }

  /* ---- 里程表读数 ------------------------------------------------------- */
  function readoutModel() {
    var years = simYears();
    var v = M.velocityKms(years);
    var odo = M.odometer(years);
    var g = MOTION.sun.galactic;
    return {
      date: simDateLabel(STATE.jd),
      jd: planetJd(),
      frame: STATE.frame,
      frameLabel: MOTION.frames.filter(function (f) { return f.id === STATE.frame; })[0].label,
      gcSpeed: v.gcSpeed,
      gcSpeedCirc: v.circ,
      cmbSpeed: v.cmbSpeed,
      rGcLy: g.radiusLy,
      rGcKpc: g.radiusKpc,
      arcDeg: odo.degAbs,
      arcLy: odo.arcLy,
      trailGain: STATE.trailGain,
      trailSpan: STATE.trailSpanYears,
      truePitchAu: g.speedKms * MOTION.units.auPerYearPerKms,
      lod: STATE.lod,
      yearsPerSecond: STATE.yearsPerSecond,
      planetLocked: false,
    };
  }

  var fpsAcc = 0;
  var fpsN = 0;
  var fpsVal = 0;

  function updateTelemetry(dt) {
    if (!SHOT) {
      fpsAcc += dt;
      fpsN++;
      if (fpsN >= 20) {
        fpsVal = 1000 / (fpsAcc / fpsN);
        fpsAcc = 0;
        fpsN = 0;
      }
    }
    ui.setTelemetry({
      fps: SHOT ? 0 : fpsVal,
      frame: frames,
      quality: { standard: '标准', high: '高', cinematic: '电影级' }[STATE.quality] || STATE.quality,
      render: core.sceneW + '×' + core.sceneH + (core.ss > 1.01 ? ' ×' + core.ss.toFixed(2) : ''),
      lod: STATE.lod,
      dpr: core.dpr,
    });
  }

  function updateReadouts() {
    var m = readoutModel();
    // 悬停/聚焦天体的日心距与地心距
    var target = STATE.hover >= 0 ? STATE.hover : STATE.focus;
    if (target >= 0) {
      var b = bodies[target];
      var p = world.auPos ? world.auPos[target] : null;
      var earth = world.auPos ? world.auPos[3] : null;
      var parts = [b.nameZh + ' · ' + b.nameEn];
      if (p && earth) {
        var rr = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        parts.push('距日 ' + (b.typeId === 0 ? '—' : rr.toFixed(3) + ' AU'));
        if (b.typeId !== 0) {
          var dx = p[0] - earth[0], dy = p[1] - earth[1], dz = p[2] - earth[2];
          parts.push('距地 ' + Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(3) + ' AU');
        }
      }
      m.hoverText = parts.join('  ·  ');
    } else {
      m.hoverText = '';
    }
    ui.setReadouts(m);
    ui.setPlanetLocked(m.planetLocked);
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

    var warn = document.getElementById('trueWarning');
    if (warn) {
      if (STATE.scale === 'true') {
        var H = core.h || 900;
        var dist = overviewDistance();
        var pxPerRad = (0.5 * H) / cam.tanHalf();
        var sunPx = (radiusWorld(meta[0].radiusAU) / dist) * pxPerRad;
        var earthPx = (radiusWorld(meta[3].radiusAU) / dist) * pxPerRad;
        var el = document.getElementById('truePixels');
        if (el) el.textContent = '这一机位下：太阳半径 ' + sunPx.toFixed(3) + ' 像素，地球半径 ' + earthPx.toFixed(4) + ' 像素';
        warn.removeAttribute('hidden');
      } else {
        warn.setAttribute('hidden', '');
      }
    }
  }

  function overviewState() {
    return { target: world.sunPos.slice(), dist: overviewDistance(), yaw: cam.yaw, pitch: cam.pitch };
  }

  /**
   * 让天体圆面占满视口的 coverage（0–1）：按相机 FOV 与画面长宽比算，
   * 取横竖两边里更窄的那一边做约束，所以竖屏手机上也不会把行星切掉。
   */
  function fitDistance(Rworld, coverage) {
    var halfV = (cam.fovDeg * Math.PI) / 360;
    var aspect = (core.w || 16) / (core.h || 9);
    var halfH = Math.atan(Math.tan(halfV) * aspect);
    var lim = Math.min(halfV, halfH) * Math.max(0.05, Math.min(1, coverage));
    return Rworld / Math.max(0.06, Math.sin(lim));
  }

  /** 特写里「这颗天体」的有效半径：带环的按环外缘算 */
  function framingRadius(i) {
    var R = world.planetR[i] || world.sunR;
    var b = bodies[i];
    if (b && b.rings && i !== 0) return R * Math.max(1, b.rings.outer * 1.05);
    return R;
  }

  function closeUpDistance(i) {
    var b = bodies[i];
    return fitDistance(framingRadius(i), b && b.rings && i !== 0 ? 0.74 : 0.64);
  }

  /** 最近观察距离：仍然能看到整个圆面和一圈环，不是贴到云层上 */
  function closestDistance(i) {
    return fitDistance(framingRadius(i), 0.92);
  }

  function cross3(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm3(v) {
    var l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function axialNorthVec(tiltDeg, node) {
    var t = tiltDeg * DEG;
    return [Math.sin(t) * Math.cos(node), Math.sin(t) * Math.sin(node), Math.cos(t)];
  }

  function heroWorldDir(i, m) {
    var b = bodies[i];
    if (!b.hero) return null;
    var spin = spinAngle(m.rotHours, planetJd());
    var lon = b.hero.lon, lat = b.hero.lat;
    var v = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
    var c = Math.cos(-spin), s = Math.sin(-spin);
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

  /** 竖屏手机上信息面板是底部抽屉，特写时把天体往上抬一点，别被抽屉压住 */
  function focusLift() {
    if (core.h <= core.w * 1.15) return 0;
    return 0.30 * cam.dist * cam.tanHalf();
  }

  function liftTarget(pos, dist, out) {
    var b = cam.basis();
    var k = core.h <= core.w * 1.15 ? 0 : 0.30 * dist * cam.tanHalf();
    out[0] = pos[0] - b[3] * k;
    out[1] = pos[1] - b[4] * k;
    out[2] = pos[2] - b[5] * k;
    return out;
  }

  app.focusBody = function (i, opts) {
    if (i < 0 || i >= bodies.length) return;
    var wasOverview = STATE.focus < 0;
    var entering = STATE.focus !== i;
    if (entering) STATE.lastFocusEl = document.activeElement;
    if (wasOverview) STATE.overviewCam = { yaw: cam.yaw, pitch: cam.pitch, target: cam.target.slice() };
    STATE.focus = i;
    STATE.hover = -1;
    document.body.classList.add('is-focus');
    ui.setHover(-1);
    ui.setActive(i);
    ui.showPanel(bodies[i]);
    ui.setBackVisible(true);
    ui.setMastheadTucked(true);
    ui.setHint('拖拽环绕 · 滚轮继续放大 · Esc 返回全景 · ← → 切换天体');

    var R = world.planetR[i] || world.sunR;
    var pos = (world.planetPos[i] || [0, 0, 0]).slice(0, 3);
    var dist = opts && opts.close ? closestDistance(i) : closeUpDistance(i);
    var ang = focusCameraAngles(i, pos);
    var tgt = liftTarget(pos, dist, [0, 0, 0]);
    cam.flyTo({ target: tgt, dist: dist, yaw: ang.yaw, pitch: ang.pitch }, opts && opts.instant ? 0 : FLIGHT_MS + SETTLE_MS);
    syncUrl();
    ui.setSrLine('已进入' + bodies[i].nameZh + '特写。按 Esc 返回全景。');
  };

  app.exitFocus = function (opts) {
    if (STATE.focus < 0) return;
    STATE.focus = -1;
    STATE.hover = -1;
    document.body.classList.remove('is-focus');
    ui.setHover(-1);
    ui.setActive(-1);
    ui.hidePanel();
    ui.setBackVisible(false);
    ui.setMastheadTucked(false);
    ui.setHint('点击天体进入特写 · 拖拽旋转 · 滚轮缩放 · Esc 返回');
    var saved = STATE.overviewCam;
    var s = overviewState();
    if (saved) { s.yaw = saved.yaw; s.pitch = saved.pitch; }
    STATE.overviewCam = null;
    cam.flyTo({ target: s.target, dist: s.dist }, opts && opts.instant ? 0 : FLIGHT_MS + SETTLE_MS);
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
    updateReadouts();
  };

  app.setScale = function (id) {
    if (!SCALES[id] || STATE.scale === id) return;
    STATE.scale = id;
    applyScaleNote();
    orbitCache.jd = -1;
    trailCache.key = '';
    assembleWorld(STATE.jd);
    if (STATE.focus >= 0) {
      var pos = STATE.focus === 0 ? world.sunPos.slice() : world.planetPos[STATE.focus].slice(0, 3);
      var ang = focusCameraAngles(STATE.focus, pos);
      cam.flyTo({ target: pos, dist: closeUpDistance(STATE.focus), yaw: ang.yaw, pitch: ang.pitch }, SHOT ? 0 : FLIGHT_MS);
    } else {
      cam.flyTo(overviewState(), SHOT ? 0 : FLIGHT_MS);
    }
    syncUrl();
  };

  app.setFrame = function (id) {
    if (['sun', 'galactic', 'cmb'].indexOf(id) < 0 || STATE.frame === id) return;
    STATE.frame = id;
    STATE.epochYears = simYears(); // 新参考系从当前时刻起算，渲染坐标始终是小数字
    trailCache.key = '';
    orbitCache.jd = -1;
    ui.setFrame(id, frameNote());
    assembleWorld(STATE.jd);
    if (STATE.focus < 0) {
      var l1 = overviewDistance();
      var dist = id === 'sun' ? l1 : Math.min(cam.dist, trailFraming() * 1.6);
      cam.flyTo({ target: world.sunPos.slice(0, 3), dist: dist, yaw: cam.yaw, pitch: cam.pitch }, 700);
    }
    // 切到运动参考系时把时间放到「1 秒 = 1 年」并开始播放，否则看不出在动
    if (id !== 'sun' && STATE.yearsPerSecond < 0.5) {
      STATE.yearsPerSecond = 1;
      STATE.playing = true;
      ui.setTimeStep('year');
    }
    updateReadouts();
    syncUrl();
  };

  function frameNote() {
    var f = MOTION.frames.filter(function (x) { return x.id === STATE.frame; })[0];
    if (STATE.frame === 'sun') return f.desc;
    return f.desc + ' · 轨迹已放大 ×' + STATE.trailGain + '，真实螺距见下方插图';
  }

  app.cycleFrame = function () {
    var order = ['sun', 'galactic', 'cmb'];
    app.setFrame(order[(order.indexOf(STATE.frame) + 1) % 3]);
  };

  app.setTimeStep = function (id) {
    var step = timeStepById(id);
    STATE.yearsPerSecond = step.yearsPerSecond;
    STATE.playing = true;
    ui.setTimeStep(id);
    updateReadouts();
    syncUrl();
  };

  app.togglePlay = function () {
    if (STATE.playing) {
      app.pause();
    } else {
      if (STATE.yearsPerSecond === 0) {
        STATE.yearsPerSecond = 1 / 365.25;
        ui.setTimeStep('day');
      }
      STATE.playing = true;
    }
  };

  app.pause = function () {
    STATE.playing = false;
    ui.setTimeStep('paused');
  };

  app.goToday = function () {
    STATE.jd = TODAY_JD;
    STATE.epochYears = simYears();
    trailCache.key = '';
    orbitCache.jd = -1;
    ui.setDate(A.dateFromJd(planetJd()));
    ui.setDateNote('JD ' + planetJd().toFixed(2));
    assembleWorld(STATE.jd);
    if (STATE.focus >= 0) {
      var pos = STATE.focus === 0 ? world.sunPos.slice() : world.planetPos[STATE.focus].slice(0, 3);
      cam.target = pos;
    } else {
      cam.target = world.sunPos.slice();
    }
    updateReadouts();
    syncUrl();
  };

  app.setTrailGain = function (g) {
    var before = (world.offset || [0, 0, 0]).slice();
    STATE.trailGain = g;
    STATE.epochYears = simYears(); // 放大因子变了，位移从零重新累，避免整体跳一下
    cam.target[0] += before[0];
    cam.target[1] += before[1];
    cam.target[2] += before[2];
    trailCache.key = '';
    orbitCache.jd = -1;
    ui.setTrailGain(g, trailCaptionModel());
    ui.setFrame(STATE.frame, frameNote());
    updateReadouts();
  };

  function trailCaptionModel() {
    var pitch = MOTION.sun.galactic.speedKms * MOTION.units.auPerYearPerKms;
    return {
      gain: STATE.trailGain,
      truePitchAu: pitch,
      shownPitchAu: pitch / STATE.trailGain,
      spanYears: STATE.trailSpanYears,
      orbitAu: 1,
    };
  }

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

  app.setPostParam = function (key, v) {
    if (!(key in POST)) return;
    POST[key] = Math.max(0, v);
  };

  app.setDebugView = function (n) {
    STATE.debugView = n | 0;
    ui.setDebugView(STATE.debugView);
  };

  app.resetParams = function () {
    POST = Object.assign({}, POST_DEFAULTS);
    Object.keys(POST_DEFAULTS).forEach(function (k) { ui.setPostSlider(k, POST[k]); });
    app.setStarBrightness(0.55);
    app.setDebugView(0);
    app.setQuality(defaultQuality());
  };

  /** 存图：在渲染回调里取，才能拿到当前帧（WebGL 画布不会保留缓冲） */
  app.savePng = function () {
    STATE.pendingPng = true;
  };

  function flushPng() {
    STATE.pendingPng = false;
    try {
      var url = canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url;
      a.download = 'helios-' + simDateLabel(STATE.jd).replace(/[^\d-]/g, '') + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      ui.setSrLine('已保存 PNG');
    } catch (e) {
      ui.setSrLine('这个浏览器不允许存图');
    }
  }

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
      ui.setDate(A.dateFromJd(planetJd()));
      return;
    }
    STATE.jd = jd;
    orbitCache.jd = -1;
    trailCache.key = '';
    ui.setDate(A.dateFromJd(planetJd()));
    ui.setDateNote('JD ' + planetJd().toFixed(2));
    assembleWorld(STATE.jd);
    if (STATE.focus >= 0) {
      cam.target = (STATE.focus === 0 ? world.sunPos : world.planetPos[STATE.focus]).slice(0, 3);
    } else {
      cam.target = world.sunPos.slice();
    }
    updateReadouts();
    syncUrl();
  };

  app.stepBody = function (dir) {
    var cur = STATE.focus >= 0 ? STATE.focus : -1;
    var next = cur + dir;
    if (next < 0) next = bodies.length - 1;
    if (next >= bodies.length) next = 0;
    if (cur < 0) next = dir > 0 ? 0 : bodies.length - 1;
    app.focusBody(next);
  };

  /* ---- URL -------------------------------------------------------------- */
  var urlTimer = 0;
  function syncUrl() {
    if (SHOT) return;
    if (urlTimer) return;
    urlTimer = window.setTimeout(function () {
      urlTimer = 0;
      var parts = [];
      if (STATE.focus >= 0) parts.push('body=' + bodies[STATE.focus].id);
      var label = simDateLabel(STATE.jd);
      parts.push('date=' + (label.indexOf('-') === 4 ? label : jdToDateString(planetJd())));
      parts.push('scale=' + STATE.scale);
      if (STATE.frame !== 'sun') parts.push('frame=' + STATE.frame);
      try {
        history.replaceState(null, '', location.pathname + location.search + '#' + parts.join('&'));
      } catch (e) { /* file:// 下个别浏览器会拒绝 */ }
    }, 220);
  }

  /* ---- 输入 ------------------------------------------------------------- */
  var drag = null;

  canvas.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件 */ }
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, t: performance.now() };
    canvas.classList.add('is-dragging');
  });

  canvas.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left;
    var py = e.clientY - rect.top;
    if (e.pointerType === 'mouse' || drag) app.setHover(pickAt(px, py));
    if (!drag) return;
    var dx = e.clientX - drag.lx;
    var dy = e.clientY - drag.ly;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    cam.yaw -= dx * 0.005;
    cam.pitch = Math.max(-80 * DEG, Math.min(80 * DEG, cam.pitch + dy * 0.004));
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
  canvas.addEventListener('pointercancel', function () { drag = null; canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('pointerleave', function () { if (!drag) app.setHover(-1); });

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
    if (hit >= 0) app.focusBody(hit, { close: true });
  });

  function pickAt(px, py) {
    if (STATE.lod > 1) return -1;
    var items = [];
    for (var i = 0; i < 9; i++) {
      var p = world.planetPos[i];
      if (!p) continue;
      items.push({ id: i, pos: p, radius: world.planetR[i] });
    }
    var got = cam.pick(items, px, py, core.w, core.h, 12);
    return got ? got.id : -1;
  }

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var k = Math.exp(e.deltaY * 0.0012);
    var l1 = overviewDistance();
    var lo = STATE.focus >= 0 ? fitDistance(framingRadius(STATE.focus), 0.985) : l1 * 0.02;
    var hi = STATE.focus >= 0 ? fitDistance(framingRadius(STATE.focus), 0.05) : l1 * 12000;
    cam.dist = Math.max(lo, Math.min(hi, cam.dist * k));
    cam.flight = null;
  }, { passive: false });

  var pinch = null;
  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      pinch = {
        d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY),
        dist: cam.dist,
      };
      drag = null;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function (e) {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      cam.dist = pinch.dist * (pinch.d / Math.max(d, 1));
      cam.flight = null;
    }
  }, { passive: false });
  canvas.addEventListener('touchend', function () { pinch = null; });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () {
    lastT = document.hidden ? 0 : performance.now();
  });

  document.addEventListener('keydown', function (e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (STATE.helpOpen) {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); app.closeHelp(); }
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
      app.togglePlay();
    } else if (e.key === 's' || e.key === 'S') {
      var order = ['orrery', 'distance', 'true'];
      app.setScale(order[(order.indexOf(STATE.scale) + 1) % 3]);
    } else if (e.key === 'f' || e.key === 'F') {
      app.cycleFrame();
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
  ui.setDate(A.dateFromJd(planetJd()));
  ui.setDateNote('JD ' + planetJd().toFixed(2));
  ui.setStarBrightness(STATE.starBright);
  ui.setBackground(STATE.bgOn);
  ui.setConstellations(STATE.constellations);
  ui.setQuality(STATE.quality);
  ui.setHudVisible(STATE.hudVisible);
  ui.setFrame(STATE.frame, frameNote());
  ui.setTrailGain(STATE.trailGain, trailCaptionModel());
  ui.setTimeStep('paused');
  ui.setPlaying(false);

  assembleWorld(STATE.jd);

  if (STATE.focus >= 0) {
    var fpos = STATE.focus === 0 ? world.sunPos.slice() : world.planetPos[STATE.focus].slice(0, 3);
    var fang = focusCameraAngles(STATE.focus, fpos);
    cam.setImmediate({ target: liftTarget(fpos, closeUpDistance(STATE.focus), [0, 0, 0]), dist: closeUpDistance(STATE.focus), yaw: fang.yaw, pitch: fang.pitch });
    document.body.classList.add('is-focus');
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
    ov.dist = (STATE.frame === 'sun' ? overviewDistance() : trailFraming()) * initZoom;
    cam.setImmediate(ov);
  }

  ui.setLoader('正在解算轨道…');
  updateReadouts();
  updateTelemetry(16);
  requestAnimationFrame(render);

  window.HELIOS_APP = {
    state: STATE,
    cam: cam,
    world: world,
    bodies: bodies,
    meta: meta,
    motion: MOTION,
    focusBody: app.focusBody,
    exitFocus: app.exitFocus,
    setScale: app.setScale,
    setFrame: app.setFrame,
    setTimeStep: app.setTimeStep,
    setTrailGain: app.setTrailGain,
    pause: app.pause,
    goToday: app.goToday,
    togglePlay: app.togglePlay,
    setDateString: app.setDateString,
    setHover: app.setHover,
    openHelp: app.openHelp,
    closeHelp: app.closeHelp,
    openPanel: function (i) { app.focusBody(i); },
    readouts: readoutModel,
    trails: function () { return buildTrails(); },
    demo: function (jd) {
      var out = {};
      for (var i = 1; i < bodies.length; i++) {
        var p = A.heliocentric(ORBITS.elements[meta[i].orbitId], jd);
        out[bodies[i].id] = { lon: +p.lon.toFixed(4), lat: +p.lat.toFixed(4), r: +p.r.toFixed(6) };
      }
      return out;
    },
    starCount: renderer.starCount,
    nearStarCount: renderer.nearStarCount,
    floatTargets: renderer.floatOK,
  };
})();

