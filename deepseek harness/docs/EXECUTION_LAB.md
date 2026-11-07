# EXECUTION_LAB · 3D Agent 动态执行实验室

> 生成物：由 `tools/generate-docs.mjs` 从 data/*.json 生成，请勿手改。分析对象 0.2.2-rc.1（commit fcc0ad4）。

## 它是什么

源码知识库回答「有什么、怎么设计」；动态实验室回答「执行时内部发生了什么」。
它把一次 Agent 执行拆成 20 个站台（含 1 个不参与路径动画的中央核心），按真实源码里的
Turn / Step / 工具流水线关系播放。站台、模块、事件与源码位置来自本地源码；模型回复、耗时、token
与字段值为**教学模拟数据**，页面顶部始终显示 `SIMULATED / 教学模拟`。

## 技术选择

现有知识库是零依赖的 vanilla JS + SVG，不是 React 工程。为了不破坏单文件、离线、零外部请求的基线，
实验室没有引入 Three.js / React Three Fiber / GSAP，而是在 `src/js/lab-scene.js` 里自研了
**透视投影 + 深度排序 + Canvas 2D** 的轻量 3D：站台、管道、粒子、标签都在同一套相机下绘制。
它没有 WebGL 依赖，截图与验收稳定；代价是没有真实光照与阴影，视觉层次靠发光、深度与标签避让实现。
`lab-engine.js` 只管 beat 播放，`lab-panel.js` 只管详情，`lab.js` 负责装配，三者不互相硬编码。

## 入口与操作

- 知识库左侧导航顶部「Agent 动态执行」，或直接打开 `#/execution-lab`；场景深链形如 `#/execution-lab?scenario=loop`。
- 底部输入台可以输入任意任务文本；它只作为本次模拟的任务标签，**不做意图识别**，流程由所选场景决定。
- 播放：空格暂停/继续，`←` / `→` 单步，`R` 重置；也支持上一步、下一步、倍速、点击进度段跳转。
- 点击 3D 站台或其标签，右侧打开「概览 / 数据 / 源码 / 关联」四个页签；站台标签在拥挤处会自动避让，悬停站台可重新显示。
- 「跟随」只做轻微镜头跟随，避免把两侧站台裁掉；「重置视角」恢复完整构图。
- 「全屏」进入剧场模式；`Esc` 退出。移动端改为上下布局，只显示当前站台标签。

## 与许愿清单的差异（以源码为准）

许愿里的 17 个站台只是初步构想，最终按源码做了四处修正：

1. **Tool Registry 在 LLM 请求之前**：每个 Step 的 preStep 都会 `tools.resolve()`，不是等到 tool-call 之后才找工具。
2. **Context 构建在 prepareCall 之后**：`deriveMessages()` 在 `buildRequest()` 里执行，不是 preStep 之前；preStep 只做 claim、解析工具、组装提示词与 `agent/pre-step`。
3. **审批门在 pipeline 内部**：`tools/pre-execute` 返回 ask 后才进入 `approval/request`，所以路径是 toolcall → pipeline → approval → pipeline → result。
4. **加入中央 Agent Core**：它不参与单步路径动画，只作为 `turn()` 循环的视觉锚点。Subagent 与审批门是独立站台。

## 站台（20）

| 编号 | 站台 | 所属模块 | 源码位置 | 关联事件 / 钩子 | 覆盖场景数 |
| --- | --- | --- | --- | --- | --- |
| 01 | **用户输入** | Web Client | `packages/client/ui-conversation/src/client/service.ts:203` | — | 10 |
| 02 | **客户端 RPC** | API Gateway / Session Controller | `packages/api/session-controller/src/client/sessions/session.ts:245` | `connection/request` | 10 |
| 03 | **Session 准入** | Session Controller | `packages/api/session-controller/src/index.ts:461` | — | 10 |
| 04 | **Agent Inbox** | Agent Loop | `packages/core/agent-loop/src/agent.ts:170` | `agent/inbox/spliced`<br>`agent/inbox/inserted` | 10 |
| 05 | **Turn 初始化** | Agent Loop | `packages/core/agent-loop/src/agent.ts:230` | `turn/start`<br>`agent/status`<br>`agent/inbox/claimed`<br>`agent/pre-step` | 10 |
| 06 | **Tool Registry** | Tool Registry | `packages/core/tools/src/index.ts:264` | — | 10 |
| 07 | **Prompt 构建** | System Prompt | `packages/core/system-prompt/src/index.ts:610` | `system-prompt/assemble` | 10 |
| 08 | **LLM 请求** | LLM Runtime | `packages/llm/llm/src/index.ts:960` | `step/start`<br>钩子 `agent/request` | 10 |
| 09 | **Context 构建** | Session / Context Injection | `packages/core/session/src/index.ts:999` | `system/message`<br>`user/message`<br>`request/header`<br>`request/context` | 10 |
| 10 | **LLM Streaming** | LLM Runtime | `packages/llm/llm/src/index.ts:1159` | `llm/stream`<br>`agent/assistant-stream` | 10 |
| 11 | **Assistant 消息** | Agent Loop | `packages/core/agent-loop/src/agent.ts:541` | `assistant/message` | 10 |
| 12 | **Tool Call 解析** | Agent Loop | `packages/core/agent-loop/src/agent.ts:541` | — | 10 |
| 13 | **Tool 执行** | Tool Pipeline | `packages/core/tools/src/pipeline.ts:184` | `tool/call`<br>`tools/pre-execute`<br>`tools/execute`<br>`tools/post-execute` | 9 |
| 14 | **审批门** | Approval | `packages/interaction/user-approval/src/types.ts:87` | `approval/request` | 3 |
| 15 | **Tool Result** | Agent Loop / Session | `packages/core/tools/src/batch.ts:236` | `tool/result` | 9 |
| 16 | **Loop 判断** | Agent Loop | `packages/core/agent-loop/src/agent.ts:326` | `step/end`<br>`agent/turn-stopping`<br>`turn/end` | 10 |
| 17 | **Session Event** | Session | `packages/core/session/src/index.ts:806` | `session/event` | 10 |
| 18 | **UI 输出** | Web Client | `packages/api/session-controller/src/history/assistant-stream.ts:11` | `agent/assistant-stream`<br>`session/event` | 10 |
| 19 | **Subagent** | Subagent | `packages/subagent/tool-subagent/src/index.ts:317` | `subagent/start`<br>`subagent/end` | 1 |
| 00 | **Agent Core** | Agent Loop | `packages/core/agent-loop/src/agent.ts:327` | — | 0 |

共关联 28 个事件/钩子。`agent/request` 在源码里是 `runtime-types.ts:373` 的 waterfall，但事件矩阵表缺这一行，页面上单列为「钩子」。

## 场景（10）

| id | 场景 | 步数 | 支持度 | 示例任务 |
| --- | --- | --- | --- | --- |
| `ask` | 普通问答 | 15 | 完全支持 | 什么是 Java 的 HashMap？ |
| `coding` | Coding 代码分析 | 24 | 完全支持 | 分析当前项目的登录功能，找出入口和关键校验。 |
| `bugfix` | Coding Bug 修复 | 45 | 完全支持 | 修复登录接口的空指针 Bug，并运行测试。 |
| `file-read` | 文件读取 | 23 | 完全支持 | 读取 docs/architecture.md，总结模块分层。 |
| `file-edit` | 文件编辑 | 27 | 完全支持 | 把 README 里的端口 3000 改成 4310。 |
| `web-search` | 网页搜索 | 31 | 需配置搜索 provider | 查一下 DeepSeek Harness 0.2.2 的发布说明，并给出处。 |
| `office` | 办公任务 | 33 | 需组合 Office 技能 + LibreOffice Kit | 分析 sales.xlsx，生成一份带图表的周报 PPT。 |
| `subagent` | Subagent 协作 | 25 | 完全支持 | 让一个子 Agent 检查 tests 目录，再把发现汇总给我。 |
| `exception` | 异常处理 | 36 | 完全支持（分支各不相同） | 把 build 目录清掉再重新构建。 |
| `loop` | Agent Loop 全景 | 24 | 完全支持 | 先读一下 README，再告诉我这个项目怎么启动。 |

## 播放模型

- 每个场景由一串 beat 组成；beat 属于某个站台，带阶段、标题、解释、输入输出、事件与数据样本。
- 播放器只做线性推进；循环感来自路径几何（工具结果回到 Context，再进入下一个 Step）。
- 上一帧、下一帧、暂停、倍速、进度跳转都是对 beat 索引的操作，不改变源码事实。
- 回边（Loop 判断 → Tool Registry）在场景里是显式 beat，画面上是橙色弧线；它不是「再开一个 Turn」，而是同一 Turn 的下一个 Step 重新 claim / 解析工具 / 组装提示词。
- 失败、审批、取消是 beat 的显示状态，不是另一种流程。

## 数据口径

- 站台 `source.file`、`source.line`、事件名、包名都由 `tools/verify-data.mjs` 校验。
- 数据观察器里的 JSON 是按源码类型定义的**示意值**；`note` 字段会说明哪些数值不可当真。
- 当前**没有接入真实运行追踪**：不修改、不注入 DeepSeek Harness 进程，也不把预设数据伪装成实时日志。

## 重新生成

```powershell
node tools/generate-docs.mjs   # 生成本文件、SOURCE_INDEX.md、GLOSSARY.md
node tools/verify-data.mjs     # 校验站台 / 场景 / 事件 / 源码引用
```
