/* ==========================================================================
   data.sky.js — 背景天球：星表元信息、银河方向、河外星系与深空天体
   --------------------------------------------------------------------------
   坐标一律 J2000 赤道系（赤经 / 赤纬，度）。运行时由 astro.js 转到黄道系。
   星表数据本身在 data.stars.js（由 tools/fetch-stars.mjs 生成，勿手改）。
   河外星系与深空天体的数值来自 Wikipedia 各条目 infobox（2026-11-04 抓取，
   见 research/SOURCES.md 第六节）；位置 / 角径 / 星等是真的，形态是艺术化的。
   ========================================================================== */
(function () {
  'use strict';

  window.HELIOS_SKY = {
    meta: {
      epoch: 'J2000',
      note:
        '背景天体位于天球无穷远：相机平移不产生视差，只有朝向改变才移动，也不随模拟日期变化。',
      extraGalacticNote:
        '河外星系的单颗恒星在本页不可分辨 —— 仙女座里最亮的单颗恒星也在 15 等以外，肉眼极限约 6.5 等。屏幕上看到的是星系整体。',
    },

    /* 星表（数据在 data.stars.js） */
    catalog: {
      source: 'HYG Database v4.0',
      version: '4.0',
      url: 'https://github.com/astronexus/HYG-Database',
      license: 'CC BY-SA 4.0',
      epoch: 'J2000 赤道',
      magLimit: 6.5,
      count: 8920,
      fields: 'RA / Dec / Vmag / B−V（只内联这四个字段）',
      brightnessModel: 'I ∝ 10^(−0.4·m)',
      colorModel: 'B−V → 近似色温 → 黑体色（近似，不做光谱还原）',
      note: '星点位置来自真实星表；星芒、衍射十字是艺术化处理。',
    },

    /* 银道坐标系（IAU，J2000） */
    galactic: {
      northPole: { ra: 192.85948, dec: 27.12825, source: 'IAU J2000 北银极' },
      center: { ra: 266.4051, dec: -28.936175, source: 'IAU J2000 银心（l=0°, b=0°）' },
      bandWidthDeg: 9.5,
      note:
        '银河带贴着真实银道面铺开：最亮处在人马座—天蝎座方向（银心），反银心方向更暗，尘埃带把它切成两半。',
      artNote: '云气形态、尘埃带细节是 fBm 艺术化生成，方向是真的。',
    },

    /* 河外星系与深空天体
       ra/dec: 度；aDeg/bDeg: 长轴 / 短轴角径（度）；pa: 长轴位置角（度，从北向东）
       kind: galaxy | dwarf | nebula | cluster | globular
       位置、角径、星等为真；形态（旋臂、团块、伴星系光点）为艺术化。 */
    objects: [
      {
        id: 'm31',
        name: 'M31 仙女座星系',
        nameEn: 'Andromeda Galaxy',
        ra: 10.6846,
        dec: 41.2692,
        mag: 3.44,
        aDeg: 3.167,
        bDeg: 1.0,
        pa: 35,
        kind: 'galaxy',
        distance: '2.54 Mly',
        source: 'Wikipedia M31 infobox（2026-11-04）',
        note: '本星系群最大的成员。真实曝光下是一团淡淡的椭圆核球加盘面，不该是亮斑。',
      },
      {
        id: 'm33',
        name: 'M33 三角座星系',
        nameEn: 'Triangulum Galaxy',
        ra: 23.4584,
        dec: 30.6602,
        mag: 5.72,
        aDeg: 70.8 / 60,
        bDeg: 41.7 / 60,
        pa: 23,
        kind: 'galaxy',
        distance: '2.73 Mly',
        source: 'Wikipedia M33 infobox（2026-11-04）',
        note: '面亮度极低，肉眼要在极暗天空下才勉强看见，本页按低对比度绘制。',
      },
      {
        id: 'lmc',
        name: '大麦哲伦云',
        nameEn: 'Large Magellanic Cloud',
        ra: 80.8917,
        dec: -69.7567,
        mag: 0.13,
        aDeg: 10.75,
        bDeg: 9.17,
        pa: 170,
        kind: 'dwarf',
        distance: '163 kly',
        source: 'Wikipedia LMC infobox（2026-11-04）；星等在不同文献差异较大',
        note: '银河系的卫星星系，南天可见。形态是不规则团块加亮区（艺术化）。',
      },
      {
        id: 'smc',
        name: '小麦哲伦云',
        nameEn: 'Small Magellanic Cloud',
        ra: 13.1867,
        dec: -72.8286,
        mag: 2.7,
        aDeg: 5 + 20 / 60,
        bDeg: 3 + 5 / 60,
        pa: 45,
        kind: 'dwarf',
        distance: '200 kly',
        source: 'Wikipedia SMC infobox（2026-11-04）',
        note: '与 LMC 同属南天，靠近南银极方向。',
      },
      {
        id: 'm42',
        name: 'M42 猎户座大星云',
        nameEn: 'Orion Nebula',
        ra: 83.82,
        dec: -5.3875,
        mag: 4.0,
        aDeg: 65 / 60,
        bDeg: 60 / 60,
        pa: 0,
        kind: 'nebula',
        distance: '1,344 ly',
        source: 'Wikipedia M42 infobox（2026-11-04）',
        note: '银河系内的恒星形成区，就在猎户座腰带下方，是判断星图方向的锚点之一。',
      },
      {
        id: 'm45',
        name: 'M45 昴星团',
        nameEn: 'Pleiades',
        ra: 56.6583,
        dec: 24.1781,
        mag: 1.6,
        aDeg: 2.0,
        bDeg: 2.0,
        pa: 0,
        kind: 'cluster',
        distance: '444 ly',
        source: 'Wikipedia M45 infobox（2026-11-04）',
        note: '银河系内的疏散星团，金牛座方向。',
      },
      {
        id: 'm13',
        name: 'M13 武仙座球状星团',
        nameEn: 'Hercules Cluster',
        ra: 250.4218,
        dec: 36.4599,
        mag: 5.8,
        aDeg: 20 / 60,
        bDeg: 20 / 60,
        pa: 0,
        kind: 'globular',
        distance: '22.2 kly',
        source: 'Wikipedia M13 infobox（2026-11-04）',
        note: '银河系内的球状星团。',
      },
    ],

    /* 星座连线：只用来核对星表方向，不画星座边界，不做任何占星内容。
       星点位置在运行时从 data.stars.js 的名字表里查，避免再抄一遍坐标。 */
    constellations: [
      {
        id: 'orion',
        name: '猎户座',
        nameEn: 'Orion',
        note: '腰带三星 Alnitak / Alnilam / Mintaka 几乎等距共线，是冬季星空最好认的一组。',
        segments: [
          ['Betelgeuse', 'Alnitak'],
          ['Bellatrix', 'Mintaka'],
          ['Betelgeuse', 'Bellatrix'],
          ['Mintaka', 'Alnilam'],
          ['Alnilam', 'Alnitak'],
          ['Alnitak', 'Saiph'],
          ['Mintaka', 'Rigel'],
          ['Saiph', 'Rigel'],
        ],
      },
      {
        id: 'uma',
        name: '北斗七星',
        nameEn: 'Big Dipper (Ursa Major)',
        note: '勺口两星 Dubhe / Merak 连线延长约五倍指向北极星。',
        segments: [
          ['Dubhe', 'Merak'],
          ['Merak', 'Phecda'],
          ['Phecda', 'Megrez'],
          ['Megrez', 'Dubhe'],
          ['Megrez', 'Alioth'],
          ['Alioth', 'Mizar'],
          ['Mizar', 'Alkaid'],
        ],
      },
    ],
  };
})();
