/* ==========================================================================
   motion.js — 太阳的三层位移与参考系换算
   纯函数，不碰 DOM。所有返回值单位都是 AU，方向在 J2000 黄道系里。
   模型：太阳绕银心走匀速圆轨道；本动 19.4 km/s 指向武仙座；CMB 方向单独给出。
   ========================================================================== */
(function () {
  'use strict';

  var A = window.HELIOS_ASTRO;
  var M = window.HELIOS_MOTION;

  var AU_PER_YEAR_PER_KMS = M.units.auPerYearPerKms;

  /* 银道系在黄道系里的三个基向量（列） */
  var xGal = A.raDecToEclipticUnit(266.4051, -28.936175); // 指向银心
  var zGal = A.raDecToEclipticUnit(192.85948, 27.12825); // 指向北银极
  var yGal = A.normalize(A.cross(zGal, xGal)); // 银经 90°，即太阳公转方向

  var apexPec = A.raDecToEclipticUnit(M.sun.peculiar.apexRaDeg, M.sun.peculiar.apexDecDeg);
  var apexCmb = A.raDecToEclipticUnit(M.sun.cmb.apexRaDeg, M.sun.cmb.apexDecDeg);

  var R_GC_AU = M.sun.galactic.radiusKpc * M.units.auPerKpc;
  var OMEGA = (2 * Math.PI) / M.sun.galactic.periodYr; // rad / yr
  var V_CIRC = M.sun.galactic.speedKms;

  function scale3(v, k) {
    return [v.x * k, v.y * k, v.z * k];
  }
  function add3(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }
  function len3(a) {
    return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  }

  /* 绕银心的位移（圆轨道的弦） */
  function galacticOffset(years) {
    var th = OMEGA * years;
    var c = 1 - Math.cos(th);
    var s = Math.sin(th);
    return [
      R_GC_AU * (c * xGal.x + s * yGal.x),
      R_GC_AU * (c * xGal.y + s * yGal.y),
      R_GC_AU * (c * xGal.z + s * yGal.z),
    ];
  }

  /* 本动位移 */
  function peculiarOffset(years) {
    var d = M.sun.peculiar.speedKms * AU_PER_YEAR_PER_KMS * years;
    return scale3(apexPec, d);
  }

  /* 相对 CMB 的总位移（已包含上面两项，不再叠加） */
  function cmbOffset(years) {
    var d = M.sun.cmb.speedKms * AU_PER_YEAR_PER_KMS * years;
    return scale3(apexCmb, d);
  }

  /**
   * 当前参考系下要减去的太阳位移。
   * gain：「轨迹放大因子」。太阳真实漂移 46.4 AU/年 是地球轨道半径的 46 倍，
   *        直接画出来就是一条斜线、看不出螺旋；gain 把漂移按 1/gain 显示，
   *        让「轨道直径 : 螺距」回到能看出螺旋的比例。它只影响展示，不改任何天文量。
   */
  function frameOffset(frameId, years, gain) {
    var g = 1 / (gain && gain > 0 ? gain : 1);
    var v;
    if (frameId === 'galactic') v = galacticOffset(years);
    else if (frameId === 'cmb') v = cmbOffset(years);
    else return [0, 0, 0];
    return [v[0] * g, v[1] * g, v[2] * g];
  }

  /* 瞬时速度矢量（km/s）：绕银心的圆速度 + 本动 */
  function velocityKms(years) {
    var th = OMEGA * years;
    // 圆速度方向 = yGal 转到 θ 之后
    var vx = yGal.x * Math.cos(th) - xGal.x * Math.sin(th);
    var vy = yGal.y * Math.cos(th) - xGal.y * Math.sin(th);
    var vz = yGal.z * Math.cos(th) - xGal.z * Math.sin(th);
    var circ = [vx * V_CIRC, vy * V_CIRC, vz * V_CIRC];
    var pec = scale3(apexPec, M.sun.peculiar.speedKms);
    var tot = add3(circ, pec);
    return {
      circ: V_CIRC,
      gcSpeed: len3(tot), // 相对银心的瞬时速度（220 ± 19.4）
      cmbSpeed: M.sun.cmb.speedKms,
      vector: tot,
    };
  }

  /* 里程表：相对 J2000 走过的银河弧长 */
  function odometer(years) {
    var th = OMEGA * years;
    var deg = (th * 180) / Math.PI;
    return {
      rad: th,
      degAbs: Math.abs(deg),
      turns: th / (2 * Math.PI),
      // 弧长 = 半径 × 弧度
      arcLy: Math.abs(th) * M.sun.galactic.radiusLy,
      arcAu: Math.abs(th) * R_GC_AU,
      // 弦长（直线位移）
      chordAu: R_GC_AU * 2 * Math.abs(Math.sin(th / 2)),
    };
  }

  /* 太阳向点在星空里的方向（用于 L2 自查：应在武仙座，靠近织女星） */
  function apexDirection() {
    return { x: apexPec.x, y: apexPec.y, z: apexPec.z };
  }

  /**
   * 从 epoch 到 now 之间太阳位移的增量（除以放大因子）。
   * 用增量而不是绝对位移，是为了让渲染坐标始终是「小数字」：
   * 偏移累积到几万 AU 时把 epoch 挪到当前时刻即可，画面不需要跳。
   */
  function frameOffsetDelta(frameId, epochYears, nowYears, gain) {
    var g = 1 / (gain && gain > 0 ? gain : 1);
    var v;
    if (frameId === 'galactic') {
      var a = galacticOffset(nowYears);
      var b = galacticOffset(epochYears);
      v = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    } else if (frameId === 'cmb') {
      var c = cmbOffset(nowYears);
      var d = cmbOffset(epochYears);
      v = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    } else {
      return [0, 0, 0];
    }
    return [v[0] * g, v[1] * g, v[2] * g];
  }

  window.HELIOS_MOTION_MATH = {
    xGal: xGal,
    yGal: yGal,
    zGal: zGal,
    apexPec: apexPec,
    apexCmb: apexCmb,
    radiusGcAu: R_GC_AU,
    auPerYearPerKms: AU_PER_YEAR_PER_KMS,
    galacticOffset: galacticOffset,
    peculiarOffset: peculiarOffset,
    cmbOffset: cmbOffset,
    frameOffset: frameOffset,
    frameOffsetDelta: frameOffsetDelta,
    velocityKms: velocityKms,
    odometer: odometer,
    apexDirection: apexDirection,
  };
})();
