// 内容与配置数据。所有面板文案、色板、场景参数、灯光预设都放在这里。
// 渲染逻辑不得硬编码这些值，一律按 id 查本文件。

export const BRANDS = [{ id: 'ferrari', cn: '法拉利', en: 'Ferrari', country: '意大利', mark: 'F' }];

/** 车漆预设：v1 的 12 个名字原样保留。hex 为 sRGB。 */
export const PAINTS = [
  { id: 'racing-red', cn: 'Racing Red', en: '赛车红', hex: '#c8102e' },
  { id: 'rosso-corsa', cn: 'Rosso Corsa', en: '法拉利红', hex: '#d40000' },
  { id: 'lambo-yellow', cn: 'Lamborghini Yellow', en: '兰博黄', hex: '#f2c200' },
  { id: 'pearl-white', cn: 'Pearl White', en: '珠光白', hex: '#f1efe8' },
  { id: 'matte-black', cn: 'Matte Black', en: '哑光黑', hex: '#141414' },
  { id: 'metallic-silver', cn: 'Metallic Silver', en: '金属银', hex: '#b8bec4' },
  { id: 'midnight-blue', cn: 'Midnight Blue', en: '午夜蓝', hex: '#152449' },
  { id: 'racing-green', cn: 'British Racing Green', en: '英国赛车绿', hex: '#123f2b' },
  { id: 'orange', cn: 'Orange', en: '橙', hex: '#ff6a13' },
  { id: 'nardo-grey', cn: 'Nardo Grey', en: '纳多灰', hex: '#8b9095' },
  { id: 'miami-blue', cn: 'Miami Blue', en: '迈阿密蓝', hex: '#2ba3cc' },
  { id: 'custom', cn: 'Custom Color', en: '自定义', hex: '#7a5cff', custom: true }
];

/**
 * 车漆材质档。数值直接喂给 MeshPhysicalMaterial。
 * flake = 金属颗粒法线强度；weave = 碳纤维外观（忽略车身色）。
 */
export const FINISHES = [
  {
    id: 'metallic',
    cn: '金属漆',
    en: 'Metallic',
    metalness: 0.82,
    roughness: 0.34,
    clearcoat: 0.85,
    clearcoatRoughness: 0.075,
    flake: 0.55,
    iridescence: 0
  },
  {
    id: 'pearl',
    cn: '珠光漆',
    en: 'Pearl',
    metalness: 0.4,
    roughness: 0.26,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    flake: 0.3,
    iridescence: 0.42
  },
  {
    id: 'matte',
    cn: '哑光漆',
    en: 'Matte',
    metalness: 0.62,
    roughness: 0.74,
    clearcoat: 0.12,
    clearcoatRoughness: 0.6,
    flake: 0.16,
    iridescence: 0
  },
  {
    id: 'gloss',
    cn: '高亮清漆',
    en: 'High gloss',
    metalness: 0.18,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    flake: 0.08,
    iridescence: 0
  },
  {
    id: 'carbon',
    cn: '碳纤维外观',
    en: 'Carbon',
    metalness: 0.5,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    flake: 0,
    weave: true,
    iridescence: 0
  }
];

/** 刹车卡钳色。改色只作用在四个 brake 节点上，不动轮辋。 */
export const CALIPERS = [
  { id: 'red', cn: '红', hex: '#c4161c', metalness: 0.45, roughness: 0.32 },
  { id: 'yellow', cn: '黄', hex: '#e8b21a', metalness: 0.45, roughness: 0.32 },
  { id: 'blue', cn: '蓝', hex: '#1b4fbf', metalness: 0.45, roughness: 0.32 },
  { id: 'black', cn: '黑', hex: '#1a1a1c', metalness: 0.55, roughness: 0.38 },
  { id: 'silver', cn: '银', hex: '#b9bec3', metalness: 0.85, roughness: 0.28 }
];

/** 轮辋色（模型只有一套轮毂几何，v2 只改颜色/表面，不换样式）。 */
export const RIMS = [
  { id: 'silver', cn: '银', hex: '#c9ccd0', metalness: 0.92, roughness: 0.24 },
  { id: 'graphite', cn: '石墨', hex: '#4a4e54', metalness: 0.85, roughness: 0.32 },
  { id: 'black', cn: '哑黑', hex: '#171718', metalness: 0.7, roughness: 0.42 },
  { id: 'bronze', cn: '青铜', hex: '#9a7542', metalness: 0.9, roughness: 0.3 },
  { id: 'white', cn: '白', hex: '#e6e4de', metalness: 0.55, roughness: 0.3 }
];

/** 内饰配色：leather 座椅皮革 / dark 深色饰件 / carpet 地毯 / accent 亮条。 */
export const INTERIORS = [
  {
    id: 'nero',
    cn: '黑色真皮',
    en: 'Nero',
    leather: '#1c1c1f',
    dark: '#141416',
    carpet: '#1a1a1c',
    accent: '#3a3a3f',
    roughness: 0.52,
    sheen: 0.15
  },
  {
    id: 'rosso-nero',
    cn: '红黑双色',
    en: 'Rosso / Nero',
    leather: '#7d1418',
    dark: '#131315',
    carpet: '#1b1b1d',
    accent: '#b31a1f',
    roughness: 0.5,
    sheen: 0.2
  },
  {
    id: 'cuoio',
    cn: '棕色真皮',
    en: 'Cuoio',
    leather: '#7a4a28',
    dark: '#18140f',
    carpet: '#2a2119',
    accent: '#a9713f',
    roughness: 0.54,
    sheen: 0.18
  },
  {
    id: 'bianco',
    cn: '白色真皮',
    en: 'Bianco',
    leather: '#d9d5cb',
    dark: '#242426',
    carpet: '#3a3936',
    accent: '#efece4',
    roughness: 0.5,
    sheen: 0.22
  },
  {
    id: 'alcantara',
    cn: 'Alcantara 翻毛皮',
    en: 'Alcantara',
    leather: '#26262a',
    dark: '#101012',
    carpet: '#191919',
    accent: '#6c1f22',
    roughness: 0.92,
    sheen: 0.05,
    suede: true
  },
  {
    id: 'carbon',
    cn: '碳纤维饰板',
    en: 'Carbon trim',
    leather: '#232326',
    dark: '#111113',
    carpet: '#171719',
    accent: '#2e3034',
    roughness: 0.46,
    sheen: 0.2,
    carbonAccent: true
  }
];

/**
 * 五个展示环境。env 是 scene.js 里程序化 IBL 的场景 id；
 * exposure / bloom / floor / key 光决定「换场」时整幅画面的气质。
 */
export const SCENES = [
  {
    id: 'studio',
    cn: '豪华摄影棚',
    en: 'LUXURY STUDIO',
    note: '黑色无缝背景 + 顶部柔光箱，地面半反射',
    env: 'studio',
    exposure: 1.02,
    fog: 0.028,
    bloom: { strength: 0.26, radius: 0.55, threshold: 1.0 },
    sky: { top: '#000000', mid: '#04060a', horizon: '#090d12', bottom: '#000000', glow: '#cfd8ff', glowStrength: 0.06, glowY: 0.22 },
    floor: { color: '#050607', roughness: 0.34, metalness: 0.45, envIntensity: 0.7 },
    key: { color: '#ffffff', intensity: 2.9, pos: [3.2, 6.4, 3.6], shadow: true },
    fill: { color: '#a9c4ff', intensity: 0.85, pos: [-5, 3.4, -2.4] },
    rim: { color: '#ffd9a0', intensity: 1.6, pos: [-1.8, 2.2, -6.2] },
    ambient: { color: '#1a2230', intensity: 0.5 }
  },
  {
    id: 'garage',
    cn: '现代车库',
    en: 'MODERN GARAGE',
    note: '混凝土与玻璃幕墙，工业冷光',
    env: 'garage',
    exposure: 1.06,
    fog: 0.024,
    bloom: { strength: 0.22, radius: 0.5, threshold: 1.0 },
    sky: { top: '#030508', mid: '#080c11', horizon: '#10161d', bottom: '#030508', glow: '#b9d4ff', glowStrength: 0.08, glowY: 0.1 },
    floor: { color: '#171a1e', roughness: 0.46, metalness: 0.25, envIntensity: 0.7 },
    key: { color: '#eaf1ff', intensity: 2.4, pos: [4.4, 5.2, 1.2], shadow: true },
    fill: { color: '#8fa6c8', intensity: 1.1, pos: [-4.6, 2.6, 3.4] },
    rim: { color: '#ffcf9e', intensity: 1.1, pos: [0.6, 2.4, -5.6] },
    ambient: { color: '#202a36', intensity: 0.6 }
  },
  {
    id: 'night',
    cn: '夜色城市',
    en: 'NIGHT CITY',
    note: '霓虹反射与湿地反光，灯组最出效果',
    env: 'night',
    exposure: 1.16,
    fog: 0.008,
    bloom: { strength: 0.52, radius: 0.7, threshold: 0.62 },
    sky: { top: '#010209', mid: '#050813', horizon: '#0c1327', bottom: '#010205', glow: '#7c4dff', glowStrength: 0.1, glowY: 0.08 },
    floor: { color: '#070910', roughness: 0.2, metalness: 0.72, envIntensity: 1.0 },
    key: { color: '#9fb4ff', intensity: 1.5, pos: [3.6, 4.2, -1.2], shadow: true },
    fill: { color: '#ff3f8e', intensity: 1.5, pos: [-4.8, 2.2, 2.2] },
    rim: { color: '#3ff0ff', intensity: 1.7, pos: [1.6, 2.0, -5.4] },
    ambient: { color: '#141c33', intensity: 0.55 }
  },
  {
    id: 'mountain',
    cn: '山间公路',
    en: 'MOUNTAIN ROAD',
    note: '低角度日光与远山，自然光反射',
    env: 'mountain',
    exposure: 1.0,
    fog: 0.0055,
    bloom: { strength: 0.18, radius: 0.5, threshold: 1.1 },
    sky: { top: '#3f7fd0', mid: '#9cc3e6', horizon: '#e8eef3', bottom: '#20242a', glow: '#fff4d6', glowStrength: 0.35, glowY: 0.3 },
    floor: { color: '#24262a', roughness: 0.72, metalness: 0.12, envIntensity: 0.8 },
    key: { color: '#fff0d2', intensity: 3.4, pos: [-4.6, 5.2, -3.2], shadow: true },
    fill: { color: '#bcd4f0', intensity: 0.9, pos: [4.2, 2.6, 2.0] },
    rim: { color: '#d9e8ff', intensity: 0.8, pos: [1.2, 1.8, -5.2] },
    ambient: { color: '#2b3746', intensity: 0.75 }
  },
  {
    id: 'track',
    cn: '赛道维修区',
    en: 'RACING TRACK',
    note: '阴天顶光 + 维修区白棚，高对比',
    env: 'track',
    exposure: 1.04,
    fog: 0.0045,
    bloom: { strength: 0.2, radius: 0.5, threshold: 1.05 },
    sky: { top: '#5c6a76', mid: '#9aa6ae', horizon: '#cdd4d9', bottom: '#2a2d31', glow: '#ffffff', glowStrength: 0.12, glowY: 0.42 },
    floor: { color: '#23262b', roughness: 0.56, metalness: 0.18, envIntensity: 0.7 },
    key: { color: '#f2f6ff', intensity: 2.6, pos: [2.6, 6.0, 2.2], shadow: true },
    fill: { color: '#c0cddd', intensity: 1.15, pos: [-5.0, 3.0, -1.6] },
    rim: { color: '#ffd7a8', intensity: 0.9, pos: [0.4, 2.2, -5.8] },
    ambient: { color: '#2e3a46', intensity: 0.8 }
  }
];

/**
 * 预设视角。front 方向 = 模型车头所朝方向（模型车头朝 -Z）。
 * pos / target 以车体中心为原点、米为单位。
 */
export const VIEWS = [
  { id: 'front', cn: '正前方', en: 'FRONT', pos: [0, 1.05, -6.4], target: [0, 0.62, 0] },
  { id: 'rear', cn: '正后方', en: 'REAR', pos: [0, 1.15, 6.6], target: [0, 0.62, 0] },
  { id: 'side', cn: '侧面', en: 'SIDE', pos: [-6.6, 0.95, 0], target: [0, 0.62, 0] },
  { id: 'front45', cn: '前 45°', en: 'FRONT 45°', pos: [-4.5, 1.55, -4.6], target: [0, 0.6, 0] },
  { id: 'rear45', cn: '后 45°', en: 'REAR 45°', pos: [4.6, 1.62, 4.5], target: [0, 0.6, 0] },
  { id: 'top', cn: '顶部', en: 'TOP', pos: [0.01, 8.2, 1.9], target: [0, 0.5, 0] },
  { id: 'interior', cn: '驾驶舱', en: 'INTERIOR', cockpit: true }
];

/** 七种灯光状态。模特灯罩节点见 car.js。 */
export const LIGHTS = [
  { id: 'drl', cn: '日间行车灯', en: 'DRL', node: 'leds' },
  { id: 'low', cn: '近光灯', en: 'LOW BEAM', node: 'lights', beam: true },
  { id: 'high', cn: '远光灯', en: 'HIGH BEAM', node: 'lights', beam: 'high' },
  { id: 'tail', cn: '尾灯', en: 'TAIL', node: 'lights_red' },
  { id: 'brake', cn: '刹车灯', en: 'BRAKE', node: 'lights_red' },
  { id: 'turn', cn: '转向灯', en: 'TURN', node: 'leds', blink: 'turn' },
  { id: 'hazard', cn: '双闪', en: 'HAZARD', node: 'leds', blink: 'hazard' }
];

/**
 * 拾取分组。模型是「材质聚合」的单体外壳，没有独立保险杠/车门，
 * 所以这里按材质组而不是按零件命名，part 介绍也如实写「材质组」。
 */
export const PARTS = [
  {
    id: 'shell',
    cn: '车身外壳',
    en: 'Body shell',
    nodes: ['body'],
    desc: '整片钣金网格（占全车约 22% 三角面），车门、引擎盖、前后包围都焊在这片网格上，模型里没有分件，因此不可开门、不可拆解。',
    from: 'front45'
  },
  {
    id: 'glass',
    cn: '玻璃',
    en: 'Glass',
    nodes: ['glass'],
    desc: '前风挡与侧窗合为一片玻璃网格。材质用 transmission 折射，低画质档退回半透明以省性能。',
    from: 'front45'
  },
  {
    id: 'headlight',
    cn: '前大灯组',
    en: 'Headlamps',
    nodes: ['lights'],
    desc: '投影式灯罩网格，材质 Projector_Glass。开灯时靠 emissive 发光，另有两盏真实聚光灯打在地面上。',
    from: 'front'
  },
  {
    id: 'led',
    cn: 'LED 灯带',
    en: 'LED strip',
    nodes: ['leds'],
    desc: '转向灯 / 日行灯的 LED 灯带网格，材质 Turn_Signal_LED，转向时按节拍闪烁。',
    from: 'front'
  },
  {
    id: 'taillight',
    cn: '尾灯组',
    en: 'Tail lamps',
    nodes: ['lights_red', 'brakes'],
    desc: '红色灯罩材质 Taillight_Glass，覆盖尾灯与高位刹车灯两部分网格。刹车灯状态会把 emissive 提到最亮。',
    from: 'rear'
  },
  {
    id: 'grille',
    cn: '格栅与进气',
    en: 'Grilles',
    nodes: ['grills', 'plastic_gray'],
    desc: '前脸与侧面的进气格栅、黑色塑料件。模型把它们合并成两片网格，无法分辨单个进气口。',
    from: 'front'
  },
  {
    id: 'rim',
    cn: '轮辋',
    en: 'Rims',
    nodes: ['rim_fl', 'rim_fr', 'rim_rl', 'rim_rr', 'wheel', 'centre', 'nuts'],
    desc: '四套轮组的金属部分：辐条、轮辋桶、中心盖、轮螺栓。只有一套几何，改的是颜色与表面而不是样式。',
    from: 'wheel'
  },
  {
    id: 'tire',
    cn: '轮胎',
    en: 'Tyres',
    nodes: ['tire'],
    desc: '四片橡胶胎体，材质 Tires。程序化颗粒法线，无贴图文件。',
    from: 'wheel'
  },
  {
    id: 'caliper',
    cn: '制动卡钳',
    en: 'Brakes',
    nodes: ['brake'],
    desc: '四个 brake 网格，材质已按节点克隆，改色不会连带轮辋变色。',
    from: 'wheel'
  },
  {
    id: 'chrome',
    cn: '镀铬饰件',
    en: 'Chrome trim',
    nodes: ['chrome', 'trim', 'metal'],
    desc: '镀铬与金属饰条合并成的一片网格，模型不区分具体是排气口还是后视镜骨架，因此不单独命名零件。',
    from: 'rear45'
  },
  {
    id: 'interior',
    cn: '内饰总成',
    en: 'Interior',
    nodes: ['leather', 'interior_dark', 'interior_light', 'carpet', 'carbon_fibre_trim', 'carbon fibre'],
    desc: '座椅皮革、深色饰板、浅色饰板、地毯与碳纤维饰条五组材质，可分别换色。座舱里没有屏幕网格，仪表与中控屏为程序化补建。',
    from: 'interior'
  },
  {
    id: 'wheel-group',
    cn: '方向盘组',
    en: 'Steering wheel',
    nodes: ['steering_wheel'],
    desc: '7 个节点的独立子组（碳纤维盘辐、皮革、金属、红色 LED、饰条），可整体转动，是模型里少数真正独立的结构。',
    from: 'interior'
  }
];

/** 画质档。auto 由 device 探测决定；也可在面板里手动切。 */
export const QUALITY = {
  high: {
    id: 'high',
    cn: '高',
    pixelRatio: 2,
    bloom: true,
    msaa: 4,
    shadow: true,
    shadowSize: 2048,
    glass: 'transmission',
    envSize: 512,
    anisotropy: 8
  },
  mid: {
    id: 'mid',
    cn: '中',
    pixelRatio: 1.5,
    bloom: true,
    msaa: 2,
    shadow: true,
    shadowSize: 1024,
    glass: 'transmission',
    envSize: 256,
    anisotropy: 4
  },
  low: {
    id: 'low',
    cn: '低',
    pixelRatio: 1,
    bloom: false,
    msaa: 0,
    shadow: false,
    shadowSize: 512,
    glass: 'fake',
    envSize: 128,
    anisotropy: 1
  }
};

export const DEFAULT_STATE = {
  car: 'ferrari-458',
  paint: 'rosso-corsa',
  custom: '#7a5cff',
  finish: 'metallic',
  caliper: 'red',
  rim: 'silver',
  interior: 'nero',
  trim: 'carbon',
  scene: 'studio',
  view: 'front45',
  quality: 'auto',
  lights: { drl: true, low: false, high: false, tail: true, brake: false, turn: false, hazard: false },
  dynamics: true,
  sound: false
};
