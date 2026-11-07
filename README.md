# 许愿 · AI 许愿编程记录

> 一个娱乐性质的实验仓库：把想要的东西写成一个「愿望」，交给 AI 从零实现，然后看看愿望能兑现到什么程度。

仓库里每个一级目录就是**一个许愿**。每个许愿都保留完整的许愿原文、源码、构建脚本和验收记录，因此既能直接打开成品，也能顺着目录复盘「一句话是怎么变成一个网站/工具/文档的」。

---

## 许愿清单

| 许愿 | 成品 | 说明 |
| --- | --- | --- |
| [奥特曼发展史](奥特曼发展史/) | [index.html](奥特曼发展史/index.html) | 以「奥特曼宇宙数字博物馆」为主题的单文件交互式网站，收录 54 部作品、38 位奥特战士、31 条宇宙事件、16 个文明势力与 18 场经典战役，并原创 SVG 生成缺失的角色视觉 |
| [rag-viz](rag-viz/) | [index.html](rag-viz/index.html) | 「RAG 全链路」交互式拆解：从解析到引用校验共 9 站，分块、BM25、HNSW、RRF、重排与校验都是页面里真算的；零依赖、无构建步骤、可离线打开 |
| [LLM执行流程](LLM执行流程/) | [index.html](LLM执行流程/index.html) | 「LLM 推理实验室」：13 站 3D 推理流水线、Transformer 八层拆解、可交互的 Q/K/V 注意力网络、采样沙盒与推理基础设施岛；Three.js 全内联、零外部请求、无 API |
| [milvus](milvus/) | [index.html](milvus/index.html) | 「Milvus × RAG 执行链路」：写入五站 + 查询五站，每站四段式，HNSW/IVF、BM25、三级归并、pre/post 过滤与融合都在页面里真算；事实来自 7 篇官方文档，示意与真算分栏标注 |
| [solar-system](solar-system/) | [index.html](solar-system/index.html) | 「HELIOS 太阳系观测台」：WebGL2 逐像素光线求解的太阳系，行星位置由 JPL 根数 + 开普勒方程实时算出，太阳与八大行星都能点进特写；星空来自 HYG 星表 8,920 颗真实恒星，银河贴着真实银道面，三种尺度模式并标注失真。v2 加了四层运动（本动 19.4 km/s / 绕银心 220 km/s / 相对 CMB 369.82 km/s）与三档参考系，按 F 看椭圆变螺旋；滚轮可从行星表面连续拉到银河，六档时间倍率与里程表同步 |
| [supercar](supercar/) | [index.html](supercar/index.html) | 「SUPERCAR 3D Showroom」：Ferrari 458 Italia 的实时 3D 展厅，7 个预设视角、5 套程序化 IBL 环境（不用 HDRI 文件）、12 色车漆 × 5 档漆面工艺、卡钳 / 轮辋 / 内饰 / 碳纤维饰板配置、7 种灯光与程序化仪表中控屏、第一人称驾驶舱、WebAudio 合成引擎声；three.js + Draco 解码器 + GLB 全部内联成 3.25 MB 单文件，50 项 GPU-only 验收全绿 |
| [deepseek harness](deepseek%20harness/) | [index.html](deepseek%20harness/index.html) | 「DeepSeek Harness 源码架构可视化实验室」：以本地源码 commit fcc0ad4 为准，37 个模块 / 46 条带 `file:line` 的调用边、23 步 Agent Loop 播放、20 步端到端链路（三条轨道）、A–H 场景、90 个事件、63 个 Session 事件、375 个包索引；16 篇分析文档 + 33 段真实代码；新增 3D Agent 动态执行实验室（19 站台 + 中央核心、10 个场景、粒子/审批/回边、双向跳转），单文件 0.76 MB、零外部请求、64 项 GPU-only 验收全绿 |

---

## 怎么用

1. **许愿**：新建 `愿望名/` 目录，写一份 `提示词.md`，讲清目标、受众、结构、视觉、数据口径、禁止项与验收标准。
2. **兑现**：让 AI 实现，产出 `src/`（源码）、`tools/`（构建与 QA）、`index.html`（成品）。
3. **验收**：跑一遍构建与 QA，截图和 `qa/report.json` 一并留下作为证据。
4. **存档**：在每个愿望目录里写 `README.md` 说明成品，然后提交。

### 直接打开成品

无需安装任何东西，双击即可：

- `奥特曼发展史/index.html` —— 单文件自包含，离线可用，样式、脚本、角色图片全部内联。
- `rag-viz/index.html` —— 纯静态页面，无构建步骤，外链同目录 `assets/` 下的样式与脚本，离线可用。
- `LLM执行流程/index.html` —— 单文件自包含的 3D 推理实验室，Three.js / GSAP / 样式全部内联，离线可用。
- `milvus/index.html` —— 单文件自包含的 Milvus × RAG 十站执行追踪，样式、数据与引擎全部内联，离线可用。
- `supercar/index.html` —— 单文件自包含的 Ferrari 458 Italia 实时 3D 展厅，three.js、Draco 解码器、GLB 模型与样式全部内联，离线可用。
- `deepseek harness/index.html` —— 单文件自包含的源码知识库 + 3D Agent 动态执行实验室，样式、数据与自研 3D 引擎全部内联，离线可用。

### 重新构建 / 回归测试

```powershell
cd 奥特曼发展史
node tools/build.mjs   # dev.html + src/* → index.html
node tools/qa.mjs      # 无头 Chrome 冒烟测试 + 截图 + qa/report.json

cd ..\LLM执行流程
node tools/build.mjs   # 内联 Three.js / GSAP / src/* → index.html
node tools/qa.mjs      # 13 站遍历 + 交互 + 移动端 + 截图

cd ..\milvus
node tools/build.mjs   # dev.html + src/* → index.html
node tools/selftest.mjs # 42 项引擎断言（切分 / 距离 / BM25 / 索引 / 融合 / 过滤 / 拒答）
node tools/qa.mjs      # 十站遍历 + 参数联动 + hash 还原 + 移动端 + 截图

cd ..\supercar
npm install            # 构建期依赖：three + esbuild
node tools/build.mjs   # dev.html + src/* + GLB + Draco → index.html
node tools/qa.mjs      # 50 项 GPU-only 验收 + 截图 + qa/report.json
```

环境要求：Node.js 18+（构建与 QA 用到 `fetch` / `WebSocket`），本机装有 Chrome 或 Edge 且能拿到硬件 GPU（QA 命中 SwiftShader / llvmpipe 会直接失败）；处理角色图片另需 Python 3 + Pillow + numpy（可选，仅在重新生成图片时需要）。

---

## 仓库约定

完整规则见 [agent.md](agent.md)，要点：

- 一个愿望一个目录，目录内自成体系（许愿原文 / 源码 / 素材 / 脚本 / 验收）。
- 成品必须**零外部请求**、可离线打开；数据与渲染分离；统计数字由数据实时计算。
- 不虚构事实：日期、数量、设定没有可靠依据时写明「年代未明确」或标注来源。
- 不进版本库的东西：`*.zip` 打包快照、`qa/` 下的截图、临时 Chrome 配置（见 [.gitignore](.gitignore)）——它们都能重新生成。

---

## 版权与免责

- 各许愿成品中涉及的第三方名称、角色与作品，权利归各自权利人所有。例如「奥特曼」系列著作权属于圆谷制作株式会社，`奥特曼发展史` 是非官方粉丝项目，与圆谷制作无隶属关系，仅作个人学习与非商业展示。
- 仓库内的界面图形、徽记、场景版画等为脚本原创生成，代码可用于学习参考，不构成对任何第三方素材的授权。
