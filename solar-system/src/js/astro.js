/* ==========================================================================
   astro.js — 儒略日、开普勒方程、坐标旋转
   纯函数，不碰 DOM。所有角量为度，长度为 AU，坐标为 J2000 黄道直角坐标。
   算法严格按 research/jpl-approx-positions.md 的 6 步实现。
   ========================================================================== */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;
  var J2000 = 2451545.0;
  var OBLIQUITY_J2000 = 23.43928; // 度，JPL 原文 ε

  /* ---------------------------------------------------------------- 时间 */

  // 公历（格里高利）年月日 → 儒略日。day 可带小数；hour 为 UTC 小时。
  function julianDay(y, m, d, hour) {
    hour = hour || 0;
    var day = d + hour / 24;
    var yy = y;
    var mm = m;
    if (mm <= 2) {
      yy -= 1;
      mm += 12;
    }
    var A = Math.floor(yy / 100);
    var B = 2 - A + Math.floor(A / 4);
    return (
      Math.floor(365.25 * (yy + 4716)) +
      Math.floor(30.6001 * (mm + 1)) +
      day +
      B -
      1524.5
    );
  }

  // 儒略日 → {y,m,d,hour}（UTC）
  function calendarFromJulianDay(jd) {
    var z = Math.floor(jd + 0.5);
    var f = jd + 0.5 - z;
    var a = z;
    if (z >= 2299161) {
      var alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    var b = a + 1524;
    var c = Math.floor((b - 122.1) / 365.25);
    var d = Math.floor(365.25 * c);
    var e = Math.floor((b - d) / 30.6001);
    var day = b - d - Math.floor(30.6001 * e) + f;
    var month = e < 14 ? e - 1 : e - 13;
    var year = month > 2 ? c - 4716 : c - 4715;
    var dayInt = Math.floor(day);
    var hour = (day - dayInt) * 24;
    return { y: year, m: month, d: dayInt, hour: hour };
  }

  // Date(UTC) → JD
  function jdFromDate(date) {
    return (
      julianDay(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours() +
          date.getUTCMinutes() / 60 +
          date.getUTCSeconds() / 3600 +
          date.getUTCMilliseconds() / 3600000
      )
    );
  }

  function dateFromJd(jd) {
    var c = calendarFromJulianDay(jd);
    var dayInt = Math.floor(c.d + c.hour / 24);
    var ms = Math.round(((c.hour / 24) % 1) * 86400000); // 秒级精度足够
    return new Date(Date.UTC(c.y, c.m - 1, dayInt, 0, 0, 0, 0) + ms);
  }

  // T = 儒略世纪（J2000 起算）
  function centuriesSinceJ2000(jd) {
    return (jd - J2000) / 36525;
  }

  /* ------------------------------------------------------ 轨道根数与位置 */

  function mod180(x) {
    x = x % 360;
    if (x > 180) x -= 360;
    if (x < -180) x += 360;
    return x;
  }

  function mod360(x) {
    x = x % 360;
    return x < 0 ? x + 360 : x;
  }

  // 线性外推根数，返回 {a,e,I,L,peri,node,w,M}
  function elementsAt(el, T) {
    var a = el.a[0] + el.a[1] * T;
    var e = el.e[0] + el.e[1] * T;
    var I = el.i[0] + el.i[1] * T;
    var L = el.L[0] + el.L[1] * T;
    var peri = el.peri[0] + el.peri[1] * T;
    var node = el.node[0] + el.node[1] * T;
    return {
      a: a,
      e: e,
      I: I,
      L: L,
      peri: peri,
      node: node,
      w: peri - node,
      M: mod180(L - peri),
    };
  }

  // 牛顿迭代解 M = E − e*·sin E（角度制），tol 1e-6°
  function solveKepler(M, e) {
    var eStar = RAD * e;
    var E = M + eStar * Math.sin(M * DEG);
    for (var n = 0; n < 60; n++) {
      var dM = M - (E - eStar * Math.sin(E * DEG));
      var dE = dM / (1 - e * Math.cos(E * DEG));
      E += dE;
      if (Math.abs(dE) <= 1e-6) break;
    }
    return E;
  }

  // 轨道平面内坐标 → 黄道坐标（JPL 原文展开式，第 327–333 行）
  function orbitPlaneToEcliptic(xp, yp, wDeg, nodeDeg, iDeg) {
    var w = wDeg * DEG;
    var O = nodeDeg * DEG;
    var I = iDeg * DEG;
    var cw = Math.cos(w),
      sw = Math.sin(w);
    var cO = Math.cos(O),
      sO = Math.sin(O);
    var cI = Math.cos(I),
      sI = Math.sin(I);
    var x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
    var y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
    var z = sw * sI * xp + cw * sI * yp;
    return { x: x, y: y, z: z };
  }

  // 某一时刻的日心黄道坐标（AU）
  function heliocentric(el, jd) {
    var T = centuriesSinceJ2000(jd);
    var k = elementsAt(el, T);
    var E = solveKepler(k.M, k.e);
    var xp = k.a * (Math.cos(E * DEG) - k.e);
    var yp = k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E * DEG);
    var p = orbitPlaneToEcliptic(xp, yp, k.w, k.node, k.I);
    p.r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    p.lon = mod360(Math.atan2(p.y, p.x) * RAD);
    p.lat = Math.atan2(p.z, Math.sqrt(p.x * p.x + p.y * p.y)) * RAD;
    p.E = E;
    p.elements = k;
    return p;
  }

  // 采样真实椭圆（不是圆），返回 n+1 个黄道坐标点（闭合）
  function orbitPath(el, jd, n) {
    n = n || 512;
    var T = centuriesSinceJ2000(jd);
    var k = elementsAt(el, T);
    var pts = [];
    for (var s = 0; s <= n; s++) {
      var E = (s / n) * 360;
      var xp = k.a * (Math.cos(E * DEG) - k.e);
      var yp = k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E * DEG);
      pts.push(orbitPlaneToEcliptic(xp, yp, k.w, k.node, k.I));
    }
    return pts;
  }

  /* ------------------------------------------------------------ 坐标旋转 */

  // 赤道（J2000）→ 黄道（J2000）：绕 X 轴转 +ε
  function equatorialToEcliptic(v) {
    var c = Math.cos(OBLIQUITY_J2000 * DEG);
    var s = Math.sin(OBLIQUITY_J2000 * DEG);
    return {
      x: v.x,
      y: v.y * c + v.z * s,
      z: -v.y * s + v.z * c,
    };
  }

  // 黄道 → 赤道
  function eclipticToEquatorial(v) {
    var c = Math.cos(OBLIQUITY_J2000 * DEG);
    var s = Math.sin(OBLIQUITY_J2000 * DEG);
    return {
      x: v.x,
      y: v.y * c - v.z * s,
      z: v.y * s + v.z * c,
    };
  }

  // 赤道（J2000）→ 银道（IAU 1958 / J2000 矩阵）
  var EQ_TO_GAL = [
    [-0.0548755604, -0.8734370902, -0.4838350155],
    [0.4941094279, -0.44482963, 0.7469822445],
    [-0.867666149, -0.1980763734, 0.4559837762],
  ];

  function equatorialToGalactic(v) {
    var m = EQ_TO_GAL;
    return {
      x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
      y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
      z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z,
    };
  }

  // 赤经赤纬（度）→ 单位向量（赤道）
  function raDecToUnit(raDeg, decDeg) {
    var ra = raDeg * DEG;
    var dec = decDeg * DEG;
    return {
      x: Math.cos(dec) * Math.cos(ra),
      y: Math.cos(dec) * Math.sin(ra),
      z: Math.sin(dec),
    };
  }

  // 赤经赤纬 → 黄道单位向量
  function raDecToEclipticUnit(raDeg, decDeg) {
    return equatorialToEcliptic(raDecToUnit(raDeg, decDeg));
  }

  function normalize(v) {
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }

  function dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function cross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  window.HELIOS_ASTRO = {
    DEG: DEG,
    RAD: RAD,
    J2000: J2000,
    OBLIQUITY_J2000: OBLIQUITY_J2000,
    julianDay: julianDay,
    calendarFromJulianDay: calendarFromJulianDay,
    jdFromDate: jdFromDate,
    dateFromJd: dateFromJd,
    centuriesSinceJ2000: centuriesSinceJ2000,
    mod180: mod180,
    mod360: mod360,
    elementsAt: elementsAt,
    solveKepler: solveKepler,
    orbitPlaneToEcliptic: orbitPlaneToEcliptic,
    heliocentric: heliocentric,
    orbitPath: orbitPath,
    equatorialToEcliptic: equatorialToEcliptic,
    eclipticToEquatorial: eclipticToEquatorial,
    equatorialToGalactic: equatorialToGalactic,
    raDecToUnit: raDecToUnit,
    raDecToEclipticUnit: raDecToEclipticUnit,
    normalize: normalize,
    dot: dot,
    cross: cross,
  };
})();
