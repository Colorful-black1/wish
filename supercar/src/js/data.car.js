// 车型数据。所有数字都对应 research/SOURCES.md 里带链接的原文，口径为 458 Italia。
// 未核实的项写「未核实」，不用相近车型或记忆值补齐。

export const CARS = [
  {
    id: 'ferrari-458',
    brandId: 'ferrari',
    brand: 'Ferrari',
    brandCn: '法拉利',
    name: '458 Italia',
    tagline: '中后置 V8 · 2009',
    year: 2009,
    model: {
      file: 'ferrari.glb',
      tris: 358788,
      verts: 337068,
      meshes: 51,
      materials: 17,
      textures: 0,
      animations: 0,
      source: 'three.js 官方示例 webgl_materials_car（作者 vicent091036，Sketchfab）',
      note:
        '整片车身是一块钣金网格：没有独立车门、引擎盖或尾翼，因此不做开门与拆解。可独立操作的是 4 组车轮（轮辋 / 胎 / 卡钳 / 中心盖 / 螺栓）与方向盘组（7 个节点）。模型不带任何贴图与动画，表面质感全部由程序化材质生成；仪表与中控屏为程序化补建。'
    },
    specs: [
      { label: '车型', value: '458 Italia', note: '8 缸双座 berlinetta', src: 'ferrari.com' },
      { label: '发布', value: '2009 年 9 月', note: '法兰克福车展首发', src: 'ferrari.com' },
      { label: '发动机', value: 'V8 · 90°', note: '自然吸气 · 缸内直喷', src: 'ferrari.com' },
      { label: '排量', value: '4497 cc', note: '2009 新闻稿写 4499 cc', src: 'ferrari.com' },
      { label: '最大功率', value: '419 kW / 570 CV', note: '@ 9000 rpm', src: 'ferrari.com' },
      { label: '最大扭矩', value: '540 Nm', note: '@ 6000 rpm', src: 'ferrari.com' },
      { label: '0–100 km/h', value: '< 3.4 s', note: '官方原文 <3.4 s', src: 'ferrari.com' },
      { label: '0–200 km/h', value: '10.4 s', note: '仅见 2009 官方新闻稿', src: 'italiaspeed' },
      { label: '最高速度', value: '> 325 km/h', note: '官方原文 >325 km/h', src: 'ferrari.com' },
      { label: '变速箱', value: '7 速双离合', note: 'F1 DCT', src: 'ferrari.com' },
      { label: '驱动方式', value: '中后置后驱', note: '配重 42% : 58%', src: 'ferrari.com' },
      { label: '干重', value: '1380 kg', note: '锻造轮毂 + 赛车座椅', src: 'ferrari.com' },
      { label: '长 / 宽 / 高', value: '4527 / 1937 / 1213 mm', note: '', src: 'ferrari.com' },
      { label: '轴距', value: '2650 mm', note: '', src: 'ferrari.com' },
      { label: '压缩比', value: '12.5 : 1', note: '', src: 'ferrari.com' },
      { label: 'Fiorano 圈速', value: '1\u203225\u2033', note: '官方历史页', src: 'ferrari.com' }
    ],
    sources: [
      { label: 'ferrari.com · 458 Italia', url: 'https://www.ferrari.com/en-EN/auto/458-italia' },
      { label: '2009 官方新闻稿（转载全文）', url: 'http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html' }
    ]
  },
  {
    id: 'custom-model',
    info:
      '当前版本内置 1 辆真实车型（Ferrari 458 Italia）。要接入新车型：把 <code>assets/models/</code> 里的 GLB 换成你自己的模型，在 <code>src/js/car.js</code> 的 <code>roleOf()</code> 里补上新节点名，再 <code>node tools/build.mjs</code> 重新内联即可。<br /><br />没有可靠模型时坚持留白，不用低模或通用跑车顶替 —— 这是本仓库「不虚构事实」的硬规矩。',
    brand: 'Custom',
    brandCn: '扩展',
    name: '接入你自己的模型',
    tagline: '配置驱动',
    infoItem: true
  }
];
