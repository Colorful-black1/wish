# RUNTIME_MODES · 运行模式对比

> 依据：`packages/util/official-bundles/src/bundles.ts:10`、`packages/bundle/*/cordis.patch.yml`、`apps/cli`、`apps/desktop`、`apps/desktop-host`、`docs/architecture.zh.md`。

## 为什么同一个 Agent 能跑在不同模式

Agent Loop、Session、Tools、LLM 都是 Cordis 服务，不依赖具体 UI。Profile 只决定把哪些插件行插进同一棵 Context：

- Web 多了 webserver、gateway、session-controller 与浏览器 UI；
- Headless 只留一次性 runner；
- SDK 换成 JSON-RPC 服务器；
- ACP 换成协议服务器；
- Desktop 是 Electron 壳 + 私有 Host，加载同一套 Web 资源。

## 五种随附 profile

| Profile | Bundle | 额外行 | 入口 | UI | 典型用途 |
| --- | --- | --- | --- | --- | --- |
| `web` | base + web-app | 97 | CLI → profile | React 浏览器应用 | 日常使用 |
| `headless` | base + headless | 2 | CLI → runner | 无 | 脚本 / CI |
| `sdk` | base + sdk-app | 14 | JSON-RPC | 无 | 嵌入其他程序 |
| `sdk-minimal` | sdk-minimal（独立） | 37 | JSON-RPC | 无 | 教学 / 最小内核 |
| `acp` | base + acp-app | 2 | ACP | 客户端提供 | 编辑器 / 自动化 |

外加 **Desktop**：`$DSH_HOME/profiles/desktop`，Electron 44.7，RunAsNode 启动私有 Desktop Host，窗口加载打包 Web 资源；与 npm CLI 共享产品数据，但包、启用选择与锁文件独立。

## 对比矩阵

| 维度 | Web | Desktop | Headless | SDK | SDK Minimal | ACP |
| --- | --- | --- | --- | --- | --- | --- |
| 启动入口 | CLI → profile | Electron Host | CLI → runner | JSON-RPC | JSON-RPC | ACP |
| 浏览器 UI | 有 | 打包 Web | 无 | 无 | 无 | 客户端提供 |
| Agent Loop | 同一实现 | 同一实现 | 同一实现 | 同一实现 | 同一实现 | 同一实现 |
| 工具集合 | base + Web | base + Web + 桌面 | base | base + SDK | 显式最小集 | base |
| 持久化 | JSONL | JSONL | JSONL | JSONL | JSONL | JSONL |
| 通信 | HTTP + WS | IPC + 本地 HTTP/WS | stdout/stderr | JSON-RPC | JSON-RPC | ACP |

## 共用与替换

**共用**：`agent-loop`、`session`、`system-prompt`、`tools`、`llm`、`fs`、`shell`、`sandbox`、`jobs`、`session-persistence-jsonl`。

**替换**：

- 入口插件：`web-startup` / `headless-startup` / `sdk-app-startup` / `acp-app-startup`；
- 传输：webserver+gateway / stdout / JSON-RPC / ACP；
- UI 行：全部 `client-ui-*` 只在 web-app 里；
- 工具增量：sdk-app 额外有 `skill-office`、`schedule`、`present` 等；
- sdk-minimal 自己列出 37 行，不应用 base。

## 三种模式的启动差异

- **Web**：webserver 先监听，浏览器连上后通过 gateway 发 RPC；`appReady` 提交后才对外。
- **Headless**：`run()` 通过 `ctx.agents.create()` 建 Agent，`followup` 投递任务，`whenIdle()` 等待收敛，把最终 assistant 文本打到 stdout；`--json` 改投影为事件流。
- **SDK**：JSON-RPC 服务器暴露 prompt 等命令；SDK 解析同版本 dsh 依赖并选择 sdk profile。

## 为什么这样设计

1. **模式不是分支**：没有 `if (mode === 'web')` 的核心代码；差异全在配置层。
2. **可裁剪**：去掉 UI/服务器插件就是 Headless；换传输就是 SDK/ACP。
3. **可嵌入**：SDK 让别的程序把 dsh 当作 Agent 进程，而不是复刻实现。
4. **可教学**：sdk-minimal 用 37 行说明一个可运行 Agent 最少需要什么。

## 当前源码中未发现

- 没有「自动检测运行环境切换模式」的逻辑；模式由 launcher 参数/profile 显式选择。
- Desktop 的打包签名细节不在本次分析范围内（见覆盖率清单的「尚未分析」）。

## 源码位置

- `packages/util/official-bundles/src/bundles.ts:10`
- `packages/bundle/{base,web-app,headless,sdk-app,sdk-minimal,acp-app}/cordis.patch.yml`
- `packages/bundle/headless/src/index.ts:322`
- `packages/sdk/server/src/server.ts:262`
- `packages/acp/acp/src/index.ts:361`
- `apps/desktop/src/*`、`apps/desktop-host/src/index.ts`
