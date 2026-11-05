# SUPER CAR 3D SHOWROOM · Ferrari 458 Italia 实时展厅

> 一辆真车、一套做满的展厅系统、一个可替换模型的接口。
> 打开 [index.html](index.html) 即可双击运行：单文件、零外部请求、实时 WebGL 渲染。

---

## 成品

| | |
| --- | --- |
| 成品 | [index.html](index.html) · 3.25 MB 单文件，双击打开 |
| 车型 | Ferrari 458 Italia（three.js 官方示例模型，详见 [research/SOURCES.md](research/SOURCES.md)） |
| 规模 | 358,788 三角面 / 337,068 顶点 / 51 个网格 / 17 个材质 / 0 张贴图 / 0 段动画 |
| 场景 | 5 套程序化环境（豪华摄影棚 / 现代车库 / 夜色城市 / 山间公路 / 赛道维修区） |
| 视角 | 7 个预设位（正前 / 正后 / 侧面 / 前 45° / 后 45° / 顶部 / 驾驶舱） |
| 配置 | 12 种车漆 × 5 档漆面工艺 / 5 种卡钳色 / 5 种轮辋色 / 6 套内饰 / 碳纤维饰板开关 |
| 灯光 | 7 种灯组状态（日行灯 / 近光 / 远光 / 尾灯 / 刹车 / 转向 / 双闪） |
| 声音 | WebAudio 现场合成的 V8 引擎声，默认静音，需点击才发声 |

---

## 怎么用

**直接打开**：双击 `index.html`。不需要服务器、不需要联网、不需要安装任何东西。

**操作**

| 操作 | 效果 |
| --- | --- |
| 拖动 | 环绕整车；滚轮对数步进缩放 |
| 单击部件 | 镜头飞向该材质组，右栏出现部件说明 |
| 双击部件 | 重点观察模式（推近），`Esc` 退出 |
| `1`–`7` | 切换 7 个预设视角（`7` = 驾驶舱） |
| `C` | 进出驾驶舱 |
| `R` | 复位视角 |
| `M` | 切换展示环境 |
| `L` | 灯光全开 / 全关 |
| `S` | 引擎声开关 |
| `Esc` | 退出驾驶舱 / 关闭部件信息 / 关帮助 |

驾驶舱内：拖动环视（左右 ±70°、上下 ±35°），滚轮缩放（FOV 44–80），`Esc` 回到车外。
顶栏 `◐` 循环切换画质（自动 / 高 / 中 / 低）。

---

## 构建与验收

```powershell
cd supercar
npm install          # 只装构建期依赖：three 0.180.0 + esbuild（node_modules 不入库）
node tools/build.mjs # dev.html + src/ → index.html（内联 GLB / Draco / 样式）
node tools/qa.mjs    # 无头 Chrome 验收：50 项检查 + 截图 + qa/report.json
```

开发时（改 `src/` 后想立刻看效果）：

```powershell
node tools/serve.mjs   # http://127.0.0.1:5178/ ，每次刷新重新打包
```

`tools/` 里还有：`cdp.mjs`（GPU-only 的 CDP 外壳）、`png.mjs`（截图差分）、`probe.mjs`（开页面打日志+截图）、`inspect-glb.mjs`（换模型时查节点结构）。

构建脚本会打印体积预算，并把结果写进 `qa/build-report.json`：

| 组成 | 实测 | 预算 | 占比 |
| --- | --- | --- | --- |
| three + addons（产物内） | 602.4 KB | ≤ 600 KB | 100% |
| Draco wrapper + wasm（base64） | 326.7 KB | ≤ 320 KB | 102% |
| ferrari.glb（base64） | 2,189.5 KB | ≤ 2.3 MB | 93% |
| 应用代码 + 样式 + AO | 98.0 KB | ≤ 400 KB | 24% |
| **单文件合计** | **3,251.9 KB** | **≤ 4 MB** | **79%** |

两个分项分别超预算 2.4 KB 与 6.7 KB（three 官方包的下限、Draco 解码器的固定体积），总体积仍只有上限的 79%。

---

## 验收结果

`node tools/qa.mjs` → **50 / 50 通过**（[qa/report.json](qa/report.json)）。要点：

- GPU：`ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)`，命中软件渲染直接失败；
- 1440×900 与 390×844 两档都 `hasHorizontalOverflow: false`；`consoleErrors` / `failedRequests` / `pageErrors` 全为空；
- 1920×1080 帧率：**最佳 180 fps / 中位 180 fps**（3 次 2 秒采样；无头 Chrome 不锁垂直同步，这是上限值；同一台机器在桌面 GPU 被占用时会掉到 60–110 fps，报告里三次取样都留着），单帧 126 draw call / 702,858 三角面；
- 7 个预设视角逐帧采样：单帧最大位移占全程 2%–11%，没有跳变；
- 5 套 IBL 互不相同，studio ↔ night 像素变化 82.4%，地面均值 `133,100,98` → `50,25,30`；
- 卡钳改色只影响卡钳：车身 `d40000→d40000`、轮辋 `c9ccd0→c9ccd0`、卡钳 `c4161c→e8b21a`，整屏像素变化仅 1.4%；
- 转向灯实测在 `4.4 / 0.2` 之间按节拍闪烁；
- 引擎声默认静音：进入页面时 `AudioContext` 尚未创建；
- 拖动回归：切视角 / 聚焦部件两次缓动结束后 `controls.enabled` 都回到 `true`，真实鼠标连续 3 次拖动各产生 7.13 m 位移，且不会误触发部件选择。

---

## 这一版做了什么（v2 收敛后的范围）

许愿 v1 想要「8 品牌 27 款车 + 3A 画质」。在仓库三条硬规矩（零外部请求 / 单文件 < 10 MB / 不虚构）下无法成立，[提示词](supercar_提示词.md) 的「追加需求 v2」因此把范围收敛成：

**一辆真车 + 一套做满的展厅系统 + 可替换的模型接口。**

因此：

- **不做开门**：整片车身是一块钣金网格（80,566 面），车门与引擎盖不是独立节点。驾驶舱改为「一键穿入」第一人称视角。
- **不做拆解**：没有分件，拆开只会是碎壳。v1 的 Exploded View 已删除。
- **不做轮毂样式切换**：模型只有一套轮毂几何，只换颜色与表面。
- **不做改装套件**（尾翼 / 前唇 / 扩散器 / 侧裙）：没有对应独立零件。
- **部件交互按材质组做**，不假装是独立零件；部件卡里也写明「这是按材质聚合的分组」。
- **不宣称 3A**：全站口径为「实时展厅级渲染」，不写对标 GT7 / Forza。

---

## 技术实现

**单文件是怎么来的**

`dev.html` 里只写 `<script type="module" src="src/js/app.js">`，构建时用 esbuild 把 `three`、addons（OrbitControls / GLTFLoader / DRACOLoader / EffectComposer / UnrealBloomPass / OutputPass）与 `src/` 打成一个 IIFE，资源用虚拟模块 `virtual:assets` 在构建期读成 base64 注入：

- GLB 2.19 MB（base64）→ 运行时 base64 解码成 ArrayBuffer，直接 `GLTFLoader.parse`，不发任何请求；
- Draco 解码器的 `draco_wasm_wrapper.js` 与 `draco_decoder.wasm` 同样内联，并**覆写 `DRACOLoader._loadLibrary`** 直接返回内存里的内容 —— `file://` 下按路径取 wasm 会 404；
- 解码器 worker 用 `Blob` URL 创建，`file://` 可用（已实测）。

**环境光不用 HDRI 文件**

5 套环境都是自建小场景（灯箱 / 玻璃幕墙 / 霓虹楼群 / 山脊 / 维修区），由 `PMREMGenerator.fromScene()` 烘成 IBL，切换场景时环境贴图、地面材质、主光方向、曝光与 Bloom 阈值一起换。远景布景（城市天际线、山脊、看台、维修区）是独立的低模剪影，按需跟随相机方位旋转，**不参与 IBL**。

**程序化材质（模型零贴图，这是本期技术核心）**

- 车漆 5 档：金属漆 / 珠光漆 / 哑光 / 高亮清漆 / 碳纤维外观。清漆用 `MeshPhysicalMaterial.clearcoat`，金属颗粒与橘皮纹是运行时生成的噪声法线贴图（固定种子，可复现）；
- 碳纤维：Canvas 现画 4×4 斜纹编织 + 同源 bump，不引入贴图文件；
- 皮革 / Alcantara / 地毯 / 橡胶：粒度噪声法线，翻毛皮走 sheen + 高粗糙度；
- 玻璃：`transmission + ior 1.5`，低画质档退回半透明（省掉透射 pass）。

**驾驶舱补建**

模型没有仪表与中控屏网格。这两块屏用 Canvas 画好贴到自建平面上，位置以方向盘包围盒为锚点，朝向驾驶员。**页面、帮助弹窗与 README 均标注「屏幕为程序化补建」，不冒充原厂内饰。**

**性能**

- 阴影贴图按需重烘（`shadowMap.autoUpdate = false`），省掉每帧一遍 35 万面的深度渲染：单帧 draw call 178 → 126，三角面 1.06 M → 703 K；
- 三档画质：高（MSAA 4× / Bloom / 阴影 2048 / 透射玻璃）、中（MSAA 2× / 阴影 1024）、低（无 Bloom / 无阴影 / 半透明玻璃 / DPR 1）；
- 环境贴图按场景懒加载并缓存，切换车辆与场景不重建解码器。

**分享与持久化**

每次改配置都会写 `location.hash`（`#paint=nardo-grey&finish=metallic&caliper=red&rim=silver&interior=nero&scene=studio&view=front45&trim=1&lights=drl,tail`），刷新或分享链接即可还原；同一份状态也存进 `localStorage`。

---

## 数据口径

车辆参数全部来自 [research/SOURCES.md](research/SOURCES.md) 记录的公开资料，界面不改写口径：

- 基准车型是 **458 Italia**（2009 年 9 月法兰克福车展发布）；Spider / Speciale 只在资料里作差异对照，不与 Italia 的数字混用；
- 官方口径冲突处两个值都保留并注明，例如排量 `4497 cc`（现行官网）与 `4499 cc`（2009 新闻稿），功率 `419 kW`（官网）与 `425 kW`（新闻稿）；
- `0–200 km/h = 10.4 s` 只存在于 2009 官方新闻稿，官网现行页已删除，界面注明「仅见 2009 官方新闻稿」；
- 投产年份、官方规格 PDF 未核实，**没有补**。

**模型来源与版权**：模型是 three.js 官方示例 `webgl_materials_car` 用的 `ferrari.glb`，示例页署名 `Ferrari 458 Italia model by vicent091036`（Sketchfab）。three.js 仓库内 `examples/models/gltf/` 目录**没有**模型单独的 LICENSE 文件，模型本身也不带版权字段 —— 所以这里不写「模型为 MIT」，只沿用示例页的署名，并声明**仅作个人学习与非商业展示**。

---

## 目录

```
supercar/
├── dev.html                 开发入口（<script type="module"> 引 src/）
├── index.html               构建产物，请勿手改
├── src/
│   ├── css/  base.css hud.css panels.css
│   └── js/   app.js scene.js car.js materials.js camera.js lights.js
│             interior.js audio.js ui.js data.car.js data.config.js util.js
├── assets/models/           ferrari.glb（1.64 MB）· ferrari_ao.png（21 KB 烘焙 AO）
├── tools/                   build.mjs bundle.mjs qa.mjs cdp.mjs png.mjs serve.mjs probe.mjs inspect-glb.mjs
├── research/SOURCES.md      逐条带链接的参数底稿（原始 HTML 存档在 research/raw/，不入库）
└── qa/                      report.json · build-report.json · 验收截图（截图不入库）
```

---

## 已知限制

1. **只有一辆车**。要加车型：换 `assets/models/` 里的 GLB，在 `src/js/car.js` 的 `roleOf()` 里补节点名映射，再重新构建；车型参数写进 `src/js/data.car.js`。没有第二个高质量模型之前，车型列表保留「接入你自己的模型」这一条说明项，不用低模凑数。
2. **车身不可开合**，车门、引擎盖、后备箱都不是独立节点。
3. **仪表 / 中控屏是补建的**，不是原厂网格。
4. 地面反射来自 IBL，**不会映出车本身**（没有做实时平面反射）。
5. 音效是 WebAudio 合成，不是法拉利的录音采样。
6. 无头验收的帧率会随桌面 GPU 占用波动，`qa/report.json` 里同时记录三次取样的最佳 / 中位 / 最差。

---

## 版权与免责

- 车型、品牌与外观设计权利归 Ferrari S.p.A. 所有；本项目是非官方粉丝项目，与法拉利无隶属关系。
- 3D 模型来自 three.js 官方示例（作者 vicent091036，最初发布于 Sketchfab），仅作个人学习与非商业展示，不构成任何授权。
- 页面内的环境、材质、仪表与中控屏画面均为本项目的程序化生成结果。
