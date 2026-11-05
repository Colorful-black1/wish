# [法拉利 458](https://www.ferrari.com/en-EN/auto/458-italia) 静态页面：已核实资料与出处

基准车型：[458 Italia](https://www.ferrari.com/en-EN/auto/458-italia)。本文件是 `supercar` 项目的研究底稿，只记录能在来源网页上直接读到的内容，**不做换算、不做推测、不补齐**。抓取到的原始 HTML / 纯文本保存在同目录 `raw/` 下，便于复核。

---

## 口径

- 本文件的性能、尺寸、重量数据**全部指向 [458 Italia](https://www.ferrari.com/en-EN/auto/458-italia)**（2009 年发布的硬顶 berlinetta）。
-  [458 Spider](https://www.ferrari.com/en-EN/auto/458-spider) 与 [458 Speciale](https://www.ferrari.com/en-EN/auto/458-speciale) **只在第三节作为差异对照出现**，不得与 Italia 的数字混在同一组里；页面正文若引用对照数据，必须标注车型。
- 凡在本文件中找不到可靠来源的字段，一律写 `未核实`，并注明搜索过哪些页面，**绝不拿相近车型、二手媒体或记忆值补齐**。
- 型号名里的 `458` 属于车名（出处：[ferrari.com 车型页](https://www.ferrari.com/en-EN/auto/458-italia)）；除此之外，凡是带数字的行都附了 markdown 出处链接。
- 单位与写法保持来源原文（`CV` / `kW` / `Nm` / `km/h` / `mm` / `in` / `lbs`），不做单位统一换算，避免引入二次误差。
- 两个官方来源互相冲突时（排量、功率千瓦数），两个值都保留并注明各自出处，由页面自行选择口径。

---

## 一、three.js 里的 `ferrari.glb` 到底是哪台车

### 结论

1. 使用该模型的官方示例是 `examples/webgl_materials_car.html`，页面 `<title>` 为 `three.js webgl - materials - car`，通过 `loader.load( 'models/gltf/ferrari.glb', ... )` 加载模型。出处：[three.js 示例源文件](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_car.html)
2. **three.js 示例页明确写了 "Ferrari 458 Italia"**——不是笼统的 "Ferrari 458"，也没有出现 "458 Speciale"。出处：[three.js 示例源文件](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_car.html)
3. `examples/models/gltf/` 目录下**没有任何 README 或 LICENSE 文件**，模型没有任何授权说明文字。出处：[目录页](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)
4. `ferrari.glb` 文件内部也没有版权/作者元数据，`asset` 段只有 `"generator": "FBX2glTF"` 与 `"version": "2.0"`，没有 `copyright` 字段。出处：[模型文件](https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/ferrari.glb)
5. three.js 仓库根 `README.md` 全文**没有** `ferrari` / `458` 字样。出处：[three.js README](https://github.com/mrdoob/three.js/blob/dev/README.md)

### 原文摘录（逐字）

来源：<https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_car.html>（第 30 行，浏览器渲染页面对应 <https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_car.html>）

```html
Ferrari 458 Italia model by <a href="https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6" target="_blank" rel="noopener">vicent091036</a>
```

同一文件第 153 行，模型加载处（[raw 源文件](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_car.html)）：

```js
loader.load( 'models/gltf/ferrari.glb', function ( gltf ) {
```

同一文件第 145 行，配套 AO 贴图（[raw 源文件](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_car.html)）：

```js
const shadow = new THREE.TextureLoader().load( 'models/gltf/ferrari_ao.png' );
```

### 目录核查

来源：<https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf>（GitHub Contents API 列表，共 51 个条目）

- 与法拉利相关的条目只有两个：`ferrari.glb`、`ferrari_ao.png`。出处：[目录页](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)
- 全目录 51 个条目中，**没有** `README*`、**没有** `LICENSE*`，也没有任何 `.md` / `.txt` 说明文件。出处：[目录页](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf)

### 对页面文案的意义

可以写："模型出自 three.js 官方示例 `webgl_materials_car`，作者 vicent091036（Sketchfab），three.js 示例页将其标注为 **Ferrari 458 Italia**。"出处：[three.js 示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_car.html)

注意：three.js 只给了车型名与作者，**没有给年份、没有给授权协议、没有给排量功率等任何参数**。页面不要把 three.js 当作 458 参数的来源。出处：[three.js 示例](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_materials_car.html)

---

## 二、[458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) 工厂数据

主来源为法拉利官网现行车型页（服务端渲染的 "Technical Details" 表），辅以 2009 年官方新闻稿的转载全文（该稿含官网现已删除的 `0-200 km/h`、`Kerb weight` 等项目）。出处：[ferrari.com 车型页](https://www.ferrari.com/en-EN/auto/458-italia) / [2009 新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html)

### 发布与年款

| 字段 | 数值（原文） | 出处 |
|---|---|---|
| 年款标识 | `Ferrari 458 Italia (2009)`（车型页标题即含年份） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 首发场合 | `Presented at the Frankfurt Motor Show in September 2009` | [ferrari.com 历史页 2009 Benchmark Car](https://www.ferrari.com/en-EN/history/moments/2009/benchmark-car) |
| 首发新闻稿日期 | `September 15, 2009`，`debuts today at the IAA Frankfurt Motor Show` | [2009 官方新闻稿转载](https://www2025.theautochannel.com/news/2009/09/16/477796.html) |
| 新闻稿落款日期 | `15.09.2009` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 生产起始 | `未核实` | 见「未核实字段」一节 |
| 车身形式 | `8-cylinder two-seater berlinetta with a mid-rear mounted engine` | [2009 官方新闻稿转载](https://www2025.theautochannel.com/news/2009/09/16/477796.html) |

### 发动机

| 字段 | 数值（原文） | 出处 |
|---|---|---|
| 型式 | `V8 – 90°` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 进气方式 | `naturally-aspirated`（`a benchmark for a naturally-aspirated production engine`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 供油方式 | `The use of GDI with Split Injection`（汽油缸内直喷，喷射压力 `200 bar`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 排量（官网现行口径） | `274.4 cu in (4497 cc)` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 排量（2009 新闻稿口径） | `4499 cc/274.5 cu in` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 缸径 × 行程 | `94x81 mm/ 3.7x3.2 in` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 压缩比 | `12.5:1` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 最大功率（官网现行口径） | `419 kW (570 CV)** @ 9000 rpm`，脚注 `** Including 5 CV of ram effect` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 最大功率（2009 新闻稿口径） | `425kW** (570CV**) @ 9000 rpm`，脚注 `**Including 3.7 kW by ram effect` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 最大扭矩 | `398 lbs/ft (540 Nm) @ 6000 rpm`，`over 80 per cent available from 3250 rpm` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 升功率 | `127 CV/l` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 最高转速 | `9000 rpm` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 发动机位置 | `mid-rear mounted engine`（中后置） | [2009 官方新闻稿转载](https://www2025.theautochannel.com/news/2009/09/16/477796.html) |

> 口径提示：`570 CV` 两个来源一致；差异在千瓦数——[官网现行页](https://www.ferrari.com/en-EN/auto/458-italia) 写 `419 kW`，[2009 新闻稿](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) 写 `425 kW`。页面若同时给 kW 与 CV，建议照抄官网 `419 kW (570 CV)`，并在脚注说明新闻稿原文为 `425 kW`。

### 性能

| 字段 | 数值（原文） | 出处 |
|---|---|---|
| 0-100 km/h | `<3.4 s`（原文 `0-100 km/h <3.4 s`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 0-200 km/h | `10.4s`（原文 `0-200km/h (0-124mph) 10.4s`） | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 极速 | `>325 km/h`（`>202 mph (>325 km/h)`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 0-400 m | `11.3s` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 0-1000 m | `20.3s` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 100-0 km/h 制动距离 | `32.5 m/106.6ft` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 200-0 km/h 制动距离 | `128 metres`（官网正文 `200- 0 km/h in 128 metres`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| Fiorano 圈速 | `1'25"`（原文 `a lap time at Fiorano of just 1" 25 seconds`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |

> 注意：[官网现行车型页](https://www.ferrari.com/en-EN/auto/458-italia) **不再列出** `0-200 km/h`；该值只存在于 [2009 年新闻稿转载](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) 中。页面引用时请注明"2009 官方新闻稿"。

### 尺寸与重量

| 字段 | 数值（原文） | 出处 |
|---|---|---|
| 全长 | `178.2 in (4527 mm)` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 全宽 | `76.3 in (1937 mm)` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 高度 | `47.8 in (1213 mm)` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 轴距 | `104.3 in (2650 mm)` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 前轮距 | `1672 mm/65.8 in` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 后轮距 | `1606 mm/63.2 in` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 干重 | `3042 lbs (1380 kg)*`，脚注 `* With forged wheels and Racing seats` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 整备质量（Kerb weight） | `1485 kg/3274 lb`，脚注 `*with forged rims and Racing Seats` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 重量分配（前/后） | `42%/58%` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 干重推重比 | `7.16 lbs/kW (2,42 kg/CV)` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 油箱容积 | `86 l/22.7 US gall./18.9 Imp. gall.` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 行李箱容积 | `230 l/8.1cu ft` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| 轮胎（前/后） | `235/35 ZR20 8.5”` / `295/35 ZR20 10.5”` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 制动盘（前/后） | `398x223x36 mm` / `360x233x32 mm` | [italiaspeed 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |

### 传动与驱动

| 字段 | 数值（原文） | 出处 |
|---|---|---|
| 变速箱 | `Dual-clutch, 7-speed F1`（`F1 dual-clutch transmission, 7 gears`） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 变速箱结构说明 | 双输入轴分别预选偶数挡与奇数挡，换挡时扭矩不中断 | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 驱动形式 | 后轮驱动（官网原文 `The electronic differential continuously distributes torque to the rear wheels`，配合 `42% front - 58% rear` 配重） | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 电子系统 | `E-Diff3, F1-Trac, high-performance ABS` | [ferrari.com 458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) |
| 历史页表述 | `F1 dual-clutch gearbox with seven gears`，`570 horsepower`，`0-100 km/h in under 3.4 seconds`，`top speed of 325 km/h` | [ferrari.com 历史页 2009 Benchmark Car](https://www.ferrari.com/en-EN/history/moments/2009/benchmark-car) |

> 关于"后驱"的严谨说明：[官网](https://www.ferrari.com/en-EN/auto/458-italia) 没有出现 `rear-wheel drive` 这一整句，但明确写了中后置发动机、`torque to the rear wheels`、配重 `42%/58%`。页面可写"中后置后驱"，并引用上面这句原文，不要伪造英文原句。

---

## 三、与其他 458 车型的差异（避免混用，对照 [Spider](https://www.ferrari.com/en-EN/auto/458-spider) / [Speciale](https://www.ferrari.com/en-EN/auto/458-speciale)）

同一车系三个型号，参数差别很大。**页面以 Italia 为基准**，下表只用于提醒不要串用。

| 字段 | [458 Italia](https://www.ferrari.com/en-EN/auto/458-italia) | [458 Spider](https://www.ferrari.com/en-EN/auto/458-spider) | [458 Speciale](https://www.ferrari.com/en-EN/auto/458-speciale) |
|---|---|---|---|
| 最大功率 | `419 kW (570 CV) @ 9000 rpm`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `419 kW (570 CV) @ 9000 rpm`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `445 kW (605 cv) at 9000 rpm`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 最大扭矩 | `540 Nm @ 6000 rpm`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `540 Nm @ 6000 rpm`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `540 Nm @ 6000 rpm`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 压缩比 | `12.5:1`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `12.5:1`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `14:1`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 0-100 km/h | `<3.4 s`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `< 3.4 s`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `3.0 sec`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 0-200 km/h | `10.4s`（[来源](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html)） | `< 10.8 s`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `9.1 sec`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 极速 | `>325 km/h`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `320 km/h`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `>325 km/h`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 干重 | `1380 kg`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `1430 kg`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `1290 kg`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 整备质量 | `1485 kg`（[来源](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html)） | `1535 kg`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)，原文写作 `3384 lbf (1535 kgf)`） | `1395 kg`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 全长 | `4527 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `4527 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `4571 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 全宽 | `1937 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `1937 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `1951 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 高度 | `1213 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `1211 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `1203 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |
| 轴距 | `2650 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-italia)） | `2650 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-spider)） | `2650 mm`（[来源](https://www.ferrari.com/en-EN/auto/458-speciale)） |

补充要点：

- [Spider 官网](https://www.ferrari.com/en-EN/auto/458-spider) 的发动机一栏写得最全：`V8 - 90° - Direct Injection - Dry Sump`，可作为 Italia "直喷 + 干式油底壳" 的同族佐证，但不要把 Spider 的数字当 Italia 的用。
- [Speciale 官网](https://www.ferrari.com/en-EN/auto/458-speciale) 正文另给：`0 to 100 km/h acceleration in 3"`、`9"1 0 to 200 km/h`、`weight-power ratio of 2.13 kg/cv`、Fiorano `1'23"5`。
- [Spider 官网](https://www.ferrari.com/en-EN/auto/458-spider) 正文另给：Fiorano 圈速 `85.5 s`、`0-400 m 11.4 s`、`0-1000 m 20.5 s`。
- 三款车的 `458` 数字含义相同：`the number that refers to the unit cylinder capacity`（[来源](https://www.ferrari.com/en-EN/history/moments/2009/benchmark-car)）。

---

## 四、未核实字段与搜索记录

| 字段 | 状态 | 说明 |
|---|---|---|
| 投产 / 交付起始时间 | `未核实` | 查过 [ferrari.com 车型页](https://www.ferrari.com/en-EN/auto/458-italia)、[history/garage 页](https://www.ferrari.com/en-EN/history/garage/2009/458-italia)、[history/moments 页](https://www.ferrari.com/en-EN/history/moments/2009/benchmark-car) 与 media.ferrari.com，只写"2009 年 9 月法兰克福车展发布"，没有官方投产或首批交付年份。页面写"2009 年发布"即可，不要写"2009 年投产"。 |
| 官方技术规格 PDF 原件 | `未核实` | media.ferrari.com 已重定向到 [media-centre 首页](https://www.ferrari.com/en-HK/media-centre)，press.ferrari.com TLS 握手失败，未能定位 2009 年原始 PDF。现用 [官网 HTML 规格表](https://www.ferrari.com/en-EN/auto/458-italia) 加 [新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) 替代。 |
| 458 Italia 官方 `0-200 km/h` | 有值，但仅见新闻稿转载 | [官网现行页](https://www.ferrari.com/en-EN/auto/458-italia) 已删除该项；`10.4s` 来自 [2009 官方新闻稿全文](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html)，引用时须注明口径。 |
| 排量 `4497` 与 `4499` 冲突 | 两个都是官方口径 | [现行车型页](https://www.ferrari.com/en-EN/auto/458-italia) 写 `4497 cc`；[2009 新闻稿](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) 写 `4499 cc`。建议页面用 `4497 cc`，脚注说明新闻稿原文为 `4499 cc`。 |
| 功率 `419 kW` 与 `425 kW` 冲突 | 两个都是官方口径 | [现行车型页](https://www.ferrari.com/en-EN/auto/458-italia) 写 `419 kW`；[2009 新闻稿](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) 写 `425 kW`。`570 CV` 两边一致。 |

---

## 五、本地原始存档（`raw/`）

> 说明：`raw/` 合计约 10 MB（单个官网页面就接近 2.8 MB），已在仓库根 `.gitignore` 里排除、不入版本库；
> 需要复核时按下表链接重新抓取即可，事实以本文件第二至四节的逐条引用为准。

| 文件 | 内容 | 抓取地址 |
|---|---|---|
| `threejs_webgl_materials_car.html` | three.js 官方示例原始 HTML（含 Ferrari 458 Italia 署名行） | [raw](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/webgl_materials_car.html) |
| `threejs_README.md` | three.js 仓库根 README（已确认无 Ferrari 字样） | [raw](https://raw.githubusercontent.com/mrdoob/three.js/dev/README.md) |
| `gh_gltf_dir.json` | `examples/models/gltf` 目录 API 列表（无 README/LICENSE） | [API](https://api.github.com/repos/mrdoob/three.js/contents/examples/models/gltf) |
| `ferrari.glb` | 示例模型本体（`asset.generator = FBX2glTF`，无 copyright 字段） | [raw](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/ferrari.glb) |
| `ferrari_458_italia_en.html` / `full_458_italia_en.txt` | 法拉利官网 Italia 车型页原文与纯文本 | [车型页](https://www.ferrari.com/en-EN/auto/458-italia) |
| `ferrari_458_spider_en.html` / `spec_ferrari_458_spider_en.txt` | Spider 车型页与规格表 | [车型页](https://www.ferrari.com/en-EN/auto/458-spider) |
| `ferrari_458_speciale_en.html` / `spec_ferrari_458_speciale_en.txt` | Speciale 车型页与规格表 | [车型页](https://www.ferrari.com/en-EN/auto/458-speciale) |
| `ferrari_moment_2009_benchmark.html` / `lines_moment_2009.txt` | 官网历史页 Benchmark Car | [历史页](https://www.ferrari.com/en-EN/history/moments/2009/benchmark-car) |
| `ferrari_history_458_en.html` / `lines_history_458_en.txt` | 官网 history/garage 车型页 | [历史页](https://www.ferrari.com/en-EN/history/garage/2009/458-italia) |
| `italiaspeed_458_2009.html` / `lines_italiaspeed_458.txt` | 2009 官方新闻稿全文转载（含 0-200 km/h、Kerb weight） | [转载](http://italiaspeed.com/2009/cars/ferrari/09/458_new_model/1509.html) |
| `autochannel_458_pr.html` / `lines_autochannel.txt` | 另一份 2009 新闻稿转载（交叉核对日期与首发表述） | [转载](https://www2025.theautochannel.com/news/2009/09/16/477796.html) |
