# PROJECT_ARCHITECTURE · 项目整体架构

> 依据：`pnpm-workspace.yaml`、`packages/*/*`、`apps/*`、`docs/architecture.zh.md`、`docs/module-graph.md`（生成物）与源码调用点。版本 `0.2.2-rc.1`。

## 一句话

`dsh` 不是「一个主程序 + 若干库」，而是 **一棵按 profile 组装的 Cordis 插件树**：模型适配器、工具注册表、会话日志、Agent Loop、Web 服务器、浏览器 UI 都是树上的插件。

## 规模

| 指标 | 数值 | 口径 |
| --- | --- | --- |
| workspace 包 | 375 | `packages/*/*` + `apps/*`（含 5 个 app） |
| 包分组 | 54 | `packages/<group>` + `apps` |
| TypeScript 源文件 | 3,410 | 不含 `tests/` |
| 源码行数 | 568,804 | 上述文件总行数 |
| dsh-base 插件行 | 99 | `packages/bundle/base/cordis.patch.yml` |
| web-app 追加行 | 97 | `packages/bundle/web-app/cordis.patch.yml` |
| 包间 peer 边 | 1,027 | `docs/module-graph.md` 生成结果 |
| 事件 | 90 | `docs/event-producer-consumer.md` |
| Session 事件 | 63 | 核心 14 + 插件声明合并 49 |

> 数字由 `tools/extract-source-facts.mjs` 机械抽取，不只来自文档。

## 六个层次

| 层 | 代表包 | 职责 |
| --- | --- | --- |
| 入口 | `apps/cli`、`apps/desktop`、`apps/desktop-host`、`bundle/headless`、`bundle/sdk-app`、`bundle/acp-app` | 选择 profile、提供运行载体 |
| 装配 | `boot/app-boot`、`boot/plugin-manager`、`util/official-bundles` | profile、bundle、patch、Loader |
| 框架 | `vendor/cordis`、`vendor/loader`、`vendor/schemastery`、`vendor/hmr` | Context、服务、事件、配置 |
| Agent | `core/agent`、`core/agent-loop`、`core/system-prompt`、`core/session`、`core/tools` | 循环、提示词、日志、工具 |
| 能力 | `llm/*`、`fs/*`、`shell/*`、`sandbox/*`、`skill/*`、`subagent/*`、`jobs/*`、`web/*`、`mcp/*` | 模型与执行世界 |
| 界面/通信 | `api/gateway`、`api/session-controller`、`host/webserver`、`client/*` | RPC、会话 API、浏览器 UI |

## 关键关系（都有源码依据）

```text
CLI ──runProfile()──▶ App Boot ──boot()──▶ Cordis Context
                                   └──plugin(Loader)──▶ 根 cordis.yml + patch 层
                                                        └── 插件行（按服务依赖并发激活）

Web Client ──remote.session.prompt()──▶ API Gateway ──@Remote──▶ Session Controller
                                                                  └──agent.followup()──▶ Agent Loop
                                                                                           ├── Session.append()
                                                                                           ├── System Prompt.assemble()
                                                                                           ├── Tool Registry.execute()
                                                                                           └── LLM.prepareCall().stream()
```

- 连线不是按名字猜的：每条都在 `data/architecture.json` 的 `ref` 里带 `file:line`。
- 生成文档 `docs/module-graph.md` 只表达 **peer dependency**（共享实例约束）；本页的运行时关系来自调用点与事件订阅。

## 包分组地图（部分）

| 分组 | 主要内容 |
| --- | --- |
| `core` | agent、agent-loop、session、system-prompt、tools、tool-executor-native/ptc、scope |
| `llm` | llm（seam）、llm-deepseek、llm-pi-ai、llm-retry、token-meter |
| `boot` | app-boot、plugin-manager、hmr、cmdline、config-editor |
| `bundle` | base、web-app、headless、sdk-app、sdk-minimal、acp-app |
| `api` | gateway、session-controller、remote-access、workspace-controller |
| `client` | 60+ UI 插件（ui-chat、ui-conversation、ui-layout、ui-settings…） |
| `fs` / `shell` / `sandbox` | 文件、进程、权限边界 |
| `session` | 投影、持久化、查询、标题、遥测、格式迁移 |
| `subagent` / `team` / `skill` / `mcp` / `jobs` | 扩展与执行能力 |

完整列表见 `data/generated.json` 的 `packages`，页面「源码索引 → 全部包」可搜索。

## 为什么这样组织

1. **可替换性**：模式差异（Web/Headless/SDK/ACP）只体现在 profile 的 bundle 列表，Agent Loop 不分支。
2. **可逆性**：注册都是 Cordis 副作用，插件卸载即撤销，所以 HMR 与运行时启停是安全的。
3. **可测试性**：Session 日志是唯一事实来源，请求能由日志重建，快照/e2e 可以做确定性断言。
4. **边界清晰**：Host 与 Client 通过 Typert 契约通信，UI 不导入服务端实现。

## 读图建议

1. 先看 `data/architecture.json` 的 37 个节点，按 layer 过滤。
2. 点任意节点看「上游来源 / 调用发往」，再点文件位置读代码。
3. 想理解启动，去「启动流程」标签；想看运行期，去 Agent Loop 与请求链路。
