/* ==========================================================================
   data.motion.js — 四层运动与参考系
   数据出处：research/motion-sources.md
   1) 行星绕太阳   JPL 根数（data.orbits.js）
   2) 太阳本动     19.4 km/s，向点 RA 18h28m / Dec +30°   — NASA Sun Fact Sheet + Wikipedia: Solar apex
   3) 太阳绕银心   约 220 km/s，约 2.4 亿年，8.3 kpc（≈27,000 ly） — Wikipedia: Milky Way
   4) 相对 CMB     369.82 ± 0.11 km/s，朝巨爵座 / 狮子座边界 — Planck 2018
   --------------------------------------------------------------------------
   所有运动都是「近似模型」：银河尺度用匀速圆轨道，行星用 1800–2050 的拟合根数。
   ========================================================================== */
(function () {
  'use strict';

  var AU_PER_PC = 206264.806;
  var AU_PER_KPC = AU_PER_PC * 1000;

  window.HELIOS_MOTION = {
    meta: {
      retrieved: '2026-11-04',
      sources: 'research/motion-sources.md',
      note:
        '银河尺度运动为圆轨道近似，只用于展示「太阳在动」；行星定位仍用 JPL 根数，且只在其有效的 1800–2050 区间内使用。',
    },

    units: {
      auPerPc: AU_PER_PC,
      auPerKpc: AU_PER_KPC,
      // 1 km/s 持续 1 儒略年 = 0.210945 AU
      auPerYearPerKms: 0.210945,
    },

    sun: {
      /* 2) 相对邻近恒星的本动 —— 局部静止标准 LSR */
      peculiar: {
        speedKms: 19.4,
        apexRaDeg: 277.0, // 18h28m00s
        apexDecDeg: 30.0,
        source: 'NASA Sun Fact Sheet — Speed relative to nearby stars = 19.4 km/s；向点 RA 18h28m / Dec +30°（Wikipedia: Solar apex）',
        note: '武仙座方向，靠近织女星。',
      },

      /* 3) 绕银心 —— 匀速圆轨道近似 */
      galactic: {
        speedKms: 220,
        periodYr: 2.4e8,
        radiusKpc: 8.3,
        radiusLy: 27000,
        range: '银心距 7.9–8.6 kpc；速度 200–240 km/s；周期 212–240 Myr（不同文献）',
        source: 'Wikipedia: Milky Way（inner edge of the Orion Arm, 27,000 ly / 8.3 kpc；≈220 km/s；≈240 Myr）',
        note: '银河系内侧猎户臂上。真实轨道有径向振荡、会穿旋臂，本页不模拟。',
      },

      /* 4) 相对 CMB —— 总速度，已经包含上面两项，不再叠加 */
      cmb: {
        speedKms: 369.82,
        uncertaintyKms: 0.11,
        apexRaDeg: 168.0,
        apexDecDeg: -7.2,
        source: 'Planck 2018（Wikipedia: Cosmic microwave background）—— 朝巨爵座与狮子座边界',
        note:
          '369.82 km/s 是绕银心与本动合成的总速度，三者不在一条直线上，所以 CMB 参考系不再把 220 与 19.4 另加一次。' +
          '方向取 RA 168.0° / Dec −7.2° 作为「巨爵座—狮子座边界」的代表值，只决定位移朝向。',
      },
    },

    /* 三个参考系：键 F 循环 */
    frames: [
      { id: 'sun', label: '太阳静止', short: 'SUN', desc: '以太阳为原点：行星走闭合椭圆' },
      { id: 'galactic', label: '银河静止', short: 'GAL', desc: '减去太阳绕银心的位移：行星走螺旋' },
      { id: 'cmb', label: 'CMB 静止', short: 'CMB', desc: '减去太阳相对 CMB 的总位移：螺旋整体漂移' },
    ],

    /* 六档时间倍率：1 秒 = ? */
    timeSteps: [
      { id: 'hour', label: '1 小时', yearsPerSecond: 1 / (24 * 365.25), glyph: '1 h/s', lod: 0 },
      { id: 'day', label: '1 天', yearsPerSecond: 1 / 365.25, glyph: '1 d/s', lod: 1 },
      { id: 'year', label: '1 年', yearsPerSecond: 1, glyph: '1 yr/s', lod: 1 },
      { id: 'kyr', label: '1000 年', yearsPerSecond: 1000, glyph: '1 kyr/s', lod: 2 },
      { id: 'myr', label: '100 万年', yearsPerSecond: 1e6, glyph: '1 Myr/s', lod: 3 },
      { id: 'gyr', label: '1 亿年', yearsPerSecond: 1e8, glyph: '100 Myr/s', lod: 3 },
    ],

    /* 轨迹放大因子：太阳漂移按 1/因子 显示，让「轨道直径 : 螺距」回到看得出螺旋的比例。
       默认 20：真实 46.4 AU/年 → 显示 2.3 AU/年，与地球 2 AU 的轨道直径可比。 */
    trailGains: [1, 20, 100, 1000],
    trailGainDefault: 20,

    /* LOD 四档 */
    levels: [
      { id: 0, key: 'L0', label: '天体特写', range: '表面细节' },
      { id: 1, key: 'L1', label: '太阳系', range: '九颗天体 + 轨道' },
      { id: 2, key: 'L2', label: '恒星邻域', range: '约 10 pc / 2×10⁶ AU' },
      { id: 3, key: 'L3', label: '银河', range: '约 30 kpc' },
    ],
  };
})();
