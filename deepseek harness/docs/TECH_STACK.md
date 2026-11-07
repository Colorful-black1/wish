# TECH_STACK · 技术栈全景

> 分析对象：本地源码 `E:\Codeing\WebStorm 2025.3.3\work\deepseek-harness`
> 版本 `0.2.2-rc.1` · commit `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（2026-11-04）
> 依据级别：**源码确认** = 读过实现或 package.json；**文档确认** = 来自仓库文档，未逐行核对实现；**未发现** = 当前源码中不存在。

## 结论先行

1. 这是一个 **TypeScript 全栈 + Cordis 插件框架** 的 Agent 产品：Host 与服务端全部是 Node 插件，浏览器端也是插件式 UI。
2. 没有「内核 + 扩展」的分层，而是 **Profile / Bundle / Patch 叠出来的插件树**；换模型、换沙箱、换存储都是换插件行。
3. Agent 循环只认识两个协议：`SessionEvent`（持久日志）与 `StreamChunk`（模型流）；provider、工具、UI 都在它们两侧。
4. 前端不是独立后端 API 架构：浏览器通过 **Typert RPC over WebSocket** 调用 Host 上的 `@Remote()` 方法。
5. 数据面是 **事件日志优先**：JSONL（默认 zstd 帧）+ 投影快照；会话检索用 SQLite FTS5，但默认不建索引。

## 按层拆解

### 语言与构建

| 技术 | 在仓库里的用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| TypeScript 6.0.3 | 全仓实现；类型即契约 | `package.json` devDependencies、`tsconfig.base.json` | 源码确认 |
| Node.js ≥ 24.9 | Host 运行时；使用 `node:http`、`node:sqlite`、`node:zlib` | `package.json` 的 `engines.node` | 源码确认 |
| pnpm 11.28.5 workspace | 单仓多包；`packages/*/*`、`apps/*`、`vendor/*` | `pnpm-workspace.yaml` | 源码确认 |
| tsdown / tsc project references | Host 与 Client 两套构建面 | `tsconfig.host.json` / `tsconfig.client.json`、`scripts/build.ts` | 源码确认 |
| Vite 6.4 + @vitejs/plugin-react | Web 前端开发与打包 | `apps/web/vite.config.ts`、`apps/web/package.json` | 源码确认 |
| Vitest 4.1（多套 config） | 单测 / 快照 / e2e / Web 压测 | `vitest.*.config.ts` | 源码确认 |
| oxlint 1.81 | lint 与规则门禁 | `.oxlintrc.json`、`scripts/run-oxlint.ts` | 源码确认 |

### 运行时框架

| 技术 | 用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| Cordis | Context / Service / 类型化事件 / 可逆副作用 | `vendor/cordis/src/index.ts`，`docs/cordis-primer.zh.md` | 源码确认 |
| Schemastery | 插件配置 schema 与默认值 | 每个插件 `static Config = z.object(...)`；`vendor/schemastery` | 源码确认 |
| Cordis Loader | 把 YAML 条目树挂成运行中的插件树 | `packages/boot/app-boot/src/index.ts:1224` | 源码确认 |
| HMR | 仅配置监视的热重载；Headless/SDK/ACP 关闭 | `docs/architecture.zh.md`、`packages/bundle/*/cordis.patch.yml` | 文档确认 |

### 前端

| 技术 | 用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| React 18.2 | 浏览器与桌面共用 UI | `apps/web/package.json`、`packages/client/ui-*/package.json` | 源码确认 |
| CSS Modules + `--dsw-*` 主题 token | 组件样式与明暗主题；明确不使用 Tailwind | `docs/web-styling.zh.md`、`packages/client/ui-theme` | 源码确认 |
| @tanstack/react-virtual 3.14 | 长会话虚拟滚动 | `packages/client/ui-chat/package.json` | 源码确认 |
| ConversationNodeDefinition | 消息节点按类型注册渲染器 | `packages/client/ui-chat/src/client/chat/register-node-renderers.ts` | 源码确认 |
| Electron 44.7 | 桌面壳；同版本私有 Host | `apps/desktop/package.json` | 源码确认 |

### 通信

| 技术 | 用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| Typert RPC | 类型化 Host ↔ Client 调用与流 | `packages/api/gateway/src/index.ts`、`@Remote('prompt')` | 源码确认 |
| WebSocket（ws 8.21） | RPC 与实时流的多路复用载体 | `packages/api/gateway/src/stream-server.ts:54` | 源码确认 |
| node:http / https | 页面与 RPC 的 HTTP 入口；无框架 | `packages/host/webserver/src/index.ts` | 源码确认 |
| JSON-RPC | SDK 进程协议 | `packages/sdk/server/src/server.ts:262` | 源码确认 |
| ACP | 编辑器/自动化协议 | `packages/acp/acp/src/index.ts:361` | 源码确认 |

### AI 能力

| 技术 | 用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| LLM 适配器 seam | provider 差异关在适配器里 | `LlmAdapter` `packages/llm/llm/src/index.ts:208` | 源码确认 |
| DeepSeek Messages API | 默认 provider | `packages/llm/llm-deepseek/src/adapter.ts:22` | 源码确认 |
| pi-ai | 多 provider 适配器库 | `packages/llm/llm-pi-ai/package.json`（`@earendil-works/pi-ai`） | 源码确认 |
| 流式 chunk 协议 | 文本/推理/工具参数/usage/finish | `packages/llm/llm/src/types.ts:496` | 源码确认 |
| Compaction | 旧历史摘要化，surface replace | `packages/compaction/compaction-basic`、`compaction/*` 事件 | 源码确认 |
| Subagent / Agent Teams | 子 Agent 与共享任务板 | `packages/subagent/*`、`packages/team/agent-team` | 源码确认 |
| Skills | 按需加载的任务说明 | `packages/skill/skill`、`tool-skill` | 源码确认 |
| MCP | 外部工具/资源服务器桥接 | `packages/mcp/mcp-client` 等 | 源码确认 |
| PTC / Code Mode | `run_code` 编排工具调用 | `packages/core/tool-executor-ptc`、`ptc-runtime-node` | 源码确认 |

### 执行世界

| 技术 | 用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| Shell（bash / pwsh） | 命令执行 | `packages/shell/*`、`tool-bash`、`tool-pwsh` | 源码确认 |
| PTY | 持久终端 | `packages/subprocess/subprocess-local`（node-pty）、`packages/terminal/*` | 源码确认 |
| Filesystem seam | 读写/编辑/补丁/观察 | `packages/fs/fs/src/index.ts`、`tool-fs` | 源码确认 |
| ripgrep | glob/grep | `packages/fs/tool-fs-search`（`@vscode/ripgrep`） | 源码确认 |
| LSP | 语言服务器查询 | `packages/lsp/*`、`tool-lsp` | 源码确认 |
| Sandbox | 本地 / Windows ACL / SSH 后端 | `packages/sandbox/*` | 源码确认 |
| Jobs | 后台任务 | `packages/jobs/*`、`job/*` Session 事件 | 源码确认 |
| Browser / Computer Use | 浏览器与桌面自动化 | `packages/browser-use/*`、`packages/computer-use/*` | 文档确认 |
| LibreOffice Kit | 文档创建/渲染/重算/导出 | `packages/skill/skill-office/package.json` | 源码确认 |

### 数据与可观测

| 技术 | 用途 | 证据 | 级别 |
| --- | --- | --- | --- |
| JSONL + zstd | 会话日志默认格式 | `packages/session/session-persistence-jsonl/src/index.ts:69` | 源码确认 |
| node:sqlite FTS5 | 会话检索 | `packages/session-query/session-query-sqlite/src/index.ts:9` | 源码确认 |
| Storage domains | 非会话状态（JSON/SQLite） | `packages/storage/*`、`domain/changed` | 源码确认 |
| OpenTelemetry | 遥测导出 | `packages/telemetry/otel`、`session-telemetry-otel` | 文档确认 |

## 三个值得注意的取舍

1. **不用前端框架全家桶**：没有 Redux/Zustand、没有 Tailwind、没有组件库；客户端状态由各 UI 包自己的 service + 投影快照承担，样式靠主题 token 统一。
2. **不用 HTTP 框架**：webserver 直接在 `node:http` 上注册路由和 WebSocket 升级，减少宿主依赖，也让 Desktop 能绕开 HTTP 用 IPC。
3. **数据库不是唯一事实来源**：会话日志是 JSONL 事件流；SQLite 只是可选的检索索引，投影是内存折叠结果。

## 未发现 / 需要确认

- 当前源码未发现统一的「浏览器任意文件读取」接口；文件访问走受控的 workspace/fs 服务。
- Python 仅出现在实验性 PTC 运行时与 SDK 运行时打包中，**没有**面向 DataFrame 的专用工具；办公数据处理的 Python 依赖来自技能说明与宿主环境（文档确认 + 环境依赖，需进一步确认）。
- Landlock 之类的 Linux 沙箱启动器在当前 checkout 中未见独立包；仅确认 `sandbox-local` / `sandbox-windows-acl` / `sandbox-ssh`。
