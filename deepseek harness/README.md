# DeepSeek Harness · 源码架构可视化实验室

以 **本地源码为准** 的 DeepSeek Harness 学习平台：从「用户在聊天框按下回车」一路追到「回复出现在屏幕上」，每个节点都能点开看职责、调用方、被调用方与真实 `file:line`。

产品分两个入口：**源码知识库**（13 页静态架构与源码索引）与 **Agent 动态执行实验室**（3D 执行流水线、10 个场景、粒子/审批/回边）。前者回答「它有什么、怎么设计」，后者回答「执行时内部发生了什么」。

- 成品：[index.html](index.html)（单文件，双击可开，零外部请求）
- 开发入口：[dev.html](dev.html)
- 分析文档：[docs/](docs/README.md)
- 结构化数据：[data/](data/)
- 源码事实抽取：[research/source-facts.md](research/source-facts.md)

> 这不是官方文档，也不修改原项目。项目名称与代码版权归 DeepSeek Harness 作者；本项目是非官方学习材料。

---

## 它回答什么

| 问题 | 页面 |
| --- | --- |
| 用了什么技术栈、为什么 | 技术栈全景 |
| 整体架构与模块关系是什么 | 项目架构图 |
| 程序从哪个文件开始执行 | 项目架构图 → 启动流程 |
| Agent 如何初始化、有哪些属性 | Agent 核心机制 |
| Turn 与 Step 有什么区别、一次请求怎么走 | Agent Loop（23 步播放） |
| 用户消息到回复的完整链路 | 用户请求链路（三条并行轨道） |
| Coding / 文件 / 办公 / 搜索 / 子 Agent / 后台任务怎么实现 | 场景实验室（A–H） |
| Cordis、Profile、Bundle、Patch 如何协作 | 插件系统 |
| Session Event / Agent Event / 能力事件怎么区分 | 事件系统（90 个事件可搜索） |
| 核心数据结构与状态流转 | 数据结构（含事件时间轴） |
| Web / Desktop / Headless / SDK / ACP 差异 | 运行模式 |
| 某个类/方法/文件在哪 | 源码索引（59 个核心位置 + 33 段代码 + 375 个包） |
| 执行时站台如何依次激活、工具如何回到循环 | Agent 动态执行（3D 实验室，19 站台 + 中央核心 / 10 场景） |
| 哪些还没看、哪些源码里没有 | 学习进度 → 覆盖率 |

## 两个模式

| 模式 | 入口 | 内容 |
| --- | --- | --- |
| A · 源码知识库 | 左侧导航的 13 个页面；路由 `#/home` … `#/progress` | 静态架构图、启动流程、Agent Loop 播放、请求链路、场景 A–H、插件/事件/数据/模式、源码索引、学习进度 |
| B · Agent 动态执行实验室 | 左侧导航顶部 **Agent 动态执行**，或 `#/execution-lab` | 3D 站台、粒子数据流、工具分支、审批门、Loop 回边、输入台、单步/暂停/倍速、数据观察器、源码追踪 |

- 实验室支持 `#/execution-lab?scenario=loop` 之类的场景深链；`scenario` 可取 `ask / coding / bugfix / file-read / file-edit / web-search / office / subagent / exception / loop`。
- 知识库的 Agent Loop、请求链路、Agent、事件、场景详情都有「进入动态实验室」按钮；实验室里的站台、事件、源码与架构节点可以跳回知识库。
- 实验室顶部有「返回源码知识库」，进入实验室时会隐藏知识库导航与全局顶栏，保持沉浸式独立布局（`Esc` 退出剧场模式）。
- 3D 部分没有引入 Three.js / React：现有平台是零依赖 vanilla JS，实验室沿用同一约束，用自研的透视投影 + 深度排序 + Canvas 2D 渲染，保持单文件与离线可开。

---

## 打开与构建

```powershell
# 直接双击 index.html 即可；无需后端、无需联网。
# 若修改了 src/、dev.html 或 data/，重新构建：
cd "deepseek harness"
node tools/build.mjs        # data/*.json → src/js/data.generated.js → index.html

# 回归验收（需要本机 Chrome 或 Edge，且必须拿到硬件 GPU）
node tools/qa.mjs           # 13 个知识库页 + 3D 实验室 + 交互 + 390px + 截图 + qa/report.json
```

构建产物约 **0.76 MB**，含 5 份 CSS、10 份 JS（含 516 KB 内联数据），无任何外链资源。

### 从源码重新抽取事实

```powershell
node tools/extract-source-facts.mjs                 # 默认读取 E:\Codeing\WebStorm 2025.3.3\work\deepseek-harness
node tools/extract-source-facts.mjs --src "D:\path\to\deepseek-harness"
node tools/verify-data.mjs                          # 校验所有 file:line 引用是否存在
node tools/generate-docs.mjs                        # 重新生成 SOURCE_INDEX / GLOSSARY / EXECUTION_LAB
```

抽取脚本只读源码，不修改原仓库。它会读取：包清单、`docs/event-producer-consumer.md`、`docs/module-graph.md`、`docs/tool-catalog.md`、`apps/cli/composition.md`、`packages/util/official-bundles/src/bundles.ts`、`SessionEventMap` 与 33 段精选代码。

---

## 目录

```text
deepseek harness/
├── prompt/
│   ├── prompt.md             # 第一版许愿原文（保持原样）
│   └── 二次改造.md            # 3D 实验室的增量需求
├── README.md                 # 本文件
├── index.html                # 构建产物（不手改）
├── dev.html                  # 开发入口
├── src/
│   ├── css/                  # base / layout / components / graph / lab
│   └── js/
│       ├── data.generated.js # 由 data/*.json 生成（不手改）
│       ├── ui.js             # DOM、图标、代码高亮、检查器
│       ├── graph.js          # SVG 架构图：布局/拖拽/缩放/搜索/过滤
│       ├── player.js         # 流程播放器
│       ├── lab-engine.js     # 实验室播放引擎（beat / 状态 / 倍速）
│       ├── lab-scene.js      # 轻量 3D：透视投影、深度排序、粒子、标签
│       ├── lab-panel.js      # 实验室右侧四页签
│       ├── lab.js            # 实验室页面装配与交互
│       ├── pages.js          # 13 个知识库页面
│       └── app.js            # 路由、导航、主题、全局搜索、双模式切换
├── data/                     # 16 份结构化数据（架构、事件、场景、实验室、模式…）
├── docs/                     # 16 篇分析文档
├── research/                 # 抽取口径与来源文档指纹
├── tools/                    # 抽取、校验、同步、构建、文档生成、QA
└── qa/                       # report.json 与验收截图（截图不入库）
```

### 关于 `learning-lab/`

许愿原文建议把平台放在源码仓库的 `learning-lab/` 下。本实现把 **愿望目录** 当作隔离边界：不改原仓库、不安装原项目依赖，成品放在本仓库（`deepseek harness/`）里，符合本仓库「一个愿望一个目录、成品零请求可离线打开」的约定。`docs/`、`data/`、`tools/` 与建议结构一一对应。

3D 实验室同样没有注入或修改原 Harness 进程；它只消费已抽取的源码事实，因此「真实运行追踪」明确标为未接入，而不是伪装成实时数据。

---

## 数据与视图分离

- `data/*.json` 是唯一内容源：架构节点/边、技术栈、启动步骤、Loop 步骤、请求链路、场景、插件、事件、数据模型、运行模式、覆盖清单、术语、实验室站台/场景。
- `tools/sync-data.mjs` 合并成 `src/js/data.generated.js`（`window.LAB_DATA`）。
- 组件只消费数据，不硬编码文案；改一张图只改 JSON。
- 所有图边都带 `ref`（`file:line`），`tools/verify-data.mjs` 会校验其存在性。

### 新增一张流程图

1. 在 `data/` 新建或扩展 JSON，形如：

```json
{
  "graph": { "nodes": [{ "id": "a", "label": "A", "sub": "…", "kind": "step", "x": 40, "y": 30 }],
             "edges": [{ "from": "a", "to": "b", "kind": "call", "label": "…", "ref": "path:line" }] },
  "steps": [{ "id": "s1", "phase": "…", "title": "…", "node": "a", "code": "excerpt-id",
              "detail": "…", "input": "…", "output": "…", "files": [{ "path": "…", "line": 1 }] }]
}
```

2. 在 `src/js/pages.js` 增加一个 renderer，注册到 `RENDERERS` 与 `NAV_PAGES`。
3. `node tools/verify-data.mjs && node tools/build.mjs && node tools/qa.mjs`。

### 更新源码分析

源码升级后：跑 `extract-source-facts.mjs` → `verify-data.mjs` → 更新手写 JSON 中变化的部分 → `generate-docs.mjs` → `build.mjs` → `qa.mjs`。页面顶部的版本号来自抽取结果，不会手写。

---

## 验收记录

`node tools/qa.mjs` 的 64 项检查（最近一次全绿）：

- GPU：ANGLE / D3D11（`NVIDIA GeForce RTX 3060`），命中 SwiftShader / llvmpipe 直接失败；
- 13 个知识库页面全部渲染，无横向溢出；
- 3D 实验室：20 个标签 / 10 个场景渲染、画布非空、开始执行推进、暂停、单步前后、场景切换、任意任务文本、倍速、空格键、审批状态、Loop 回边、全屏、站台详情、数据 JSON、源码片段、双向跳转；
- 控制台 0 错误、0 异常、0 失败请求、运行时 0 外部资源；
- 交互：节点详情、连线依据、图内搜索、Loop 自动播放/暂停、请求链路点选、轨道过滤、场景切换、事件搜索、全局搜索、主题切换、源码片段、进度持久化；
- 390px 移动端无横向滚动，实验室舞台可用。

截图与 `qa/report.json` 在 `qa/`（截图被 `.gitignore` 排除，可随时重跑生成）。

---

## 事实口径

- 版本、commit、包数、事件数、工具数、行数都由 `tools/extract-source-facts.mjs` 机械抽取；
- 调用关系来自源码调用点/事件订阅，不按名称相似推断；
- 「源码中不存在」会明确写：例如没有独立的「任务完成判定器」、没有内置 Python 数据分析工具、没有浏览器任意文件读取接口；
- 未逐行分析的模块（Desktop 打包、Office 渲染实现、Agent Teams 状态机等）列在「学习进度 → 覆盖率」的「尚未分析」中，不假装覆盖。

---

## 非官方声明

DeepSeek Harness 的代码、名称与相关标识归其作者所有。本项目仅用于个人学习与非商业展示，不构成官方文档或背书。分析基于 2026-11-04 的本地源码快照，后续版本可能变化。
