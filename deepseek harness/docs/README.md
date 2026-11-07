# 分析文档索引

> 分析对象：DeepSeek Harness `0.2.2-rc.1`，本地源码 commit `fcc0ad4`（2026-11-04）。
> 级别约定：**源码确认**（读过实现） / **推导**（由类型与调用点推得） / **文档确认** / **未发现**（当前源码不存在）。

| 文档 | 回答的问题 |
| --- | --- |
| [TECH_STACK.md](TECH_STACK.md) | 用了哪些技术，各自解决什么 |
| [PROJECT_ARCHITECTURE.md](PROJECT_ARCHITECTURE.md) | 包与分层、模块如何协作 |
| [STARTUP_FLOW.md](STARTUP_FLOW.md) | `dsh web` 从哪一行开始执行 |
| [AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md) | Agent 是什么、生命周期与通信 |
| [AGENT_LOOP.md](AGENT_LOOP.md) | Turn / Step 与完整循环 |
| [LLM_FLOW.md](LLM_FLOW.md) | 模型适配器、流协议、重试 |
| [TOOL_EXECUTION.md](TOOL_EXECUTION.md) | 工具注册、流水线、审批 |
| [SESSION_AND_EVENT.md](SESSION_AND_EVENT.md) | 事件日志、surface、持久化 |
| [PLUGIN_SYSTEM.md](PLUGIN_SYSTEM.md) | Cordis 与 Profile/Bundle/Patch |
| [CONTEXT_MANAGEMENT.md](CONTEXT_MANAGEMENT.md) | Prompt 与上下文如何组装、压缩 |
| [SUBAGENT.md](SUBAGENT.md) | 子 Agent、控制工具、Agent Teams |
| [RUNTIME_MODES.md](RUNTIME_MODES.md) | Web / Desktop / Headless / SDK / ACP |
| [SCENARIOS.md](SCENARIOS.md) | A–H 八个场景的真实路径 |
| [EXECUTION_LAB.md](EXECUTION_LAB.md) | 3D 实验室的 20 个站台、10 个场景与播放口径 |
| [SOURCE_INDEX.md](SOURCE_INDEX.md) | 59 个核心位置与 33 段代码 |
| [GLOSSARY.md](GLOSSARY.md) | 22 个术语的人话解释 |

生成物：`SOURCE_INDEX.md`、`GLOSSARY.md` 与 `EXECUTION_LAB.md` 由 `node tools/generate-docs.mjs` 从 `data/*.json` 生成；其余为手写正文。
