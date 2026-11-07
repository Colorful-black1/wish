# SOURCE_INDEX · 源码索引

> 生成物：由 `tools/generate-docs.mjs` 从 data/*.json 生成，请勿手改。分析对象 0.2.2-rc.1（commit fcc0ad4）。

## 怎么用

- 路径都相对于源码仓库根目录；行号是抽取时的真实位置。
- 可视化平台的「源码索引」页可以搜索文件、符号、包名，并直接打开已抽取的代码片段。
- 若要重新核对，先看 `research/source-facts.md` 的来源文档指纹，再跑 `node tools/extract-source-facts.mjs`。

## 规模

| 指标 | 数值 |
| --- | --- |
| workspace 包 | 375 |
| 包分组 | 54 |
| TypeScript 源文件（不含测试） | 3410 |
| 源码行数 | 568804 |
| 事件 | 90 |
| Session 事件 | 63（核心 14） |
| 模型可见工具名 | 72 |
| 已抽取代码片段 | 33 |

## 核心源码位置（59）

| 模块 | 位置 | 符号 |
| --- | --- | --- |
| CLI | `apps/cli/src/args.ts:1` | parseDshArgs |
| CLI | `apps/cli/src/bin.ts:26` | runCli() |
| CLI | `apps/cli/src/profile-boot.ts:271` | runProfile() |
| Desktop | `apps/desktop-host/src/index.ts:1` | Desktop Host |
| Web Client | `apps/web/src/main.ts:2` | AppWebEntry |
| Cordis | `docs/cordis-primer.zh.md:1` | Cordis 入门 |
| ACP | `packages/acp/acp/src/index.ts:361` | prompt() |
| API Gateway | `packages/api/gateway/src/index.ts:1` | TypertGatewayService |
| API Gateway | `packages/api/gateway/src/stream-server.ts:54` | WebSocket mux |
| Session Controller | `packages/api/session-controller/src/commands.ts:321` | prompt() |
| Session Controller | `packages/api/session-controller/src/history/assistant-stream.ts:17` | agent/assistant-stream 监听 |
| Session Controller | `packages/api/session-controller/src/index.ts:468` | @Remote('prompt') |
| App Boot | `packages/boot/app-boot/src/index.ts:1200` | boot() |
| Loader | `packages/boot/app-boot/src/index.ts:1224` | ctx.plugin(Loader) |
| App Boot | `packages/boot/app-boot/src/index.ts:738` | mountRootInclude() |
| Plugin Manager | `packages/boot/plugin-manager/src/types.ts:424` | plugin-manager/operation |
| Profile / Bundle | `packages/bundle/base/cordis.patch.yml:1` | dsh-base |
| Headless | `packages/bundle/headless/src/index.ts:322` | run() |
| Web Client | `packages/client/ui-conversation/src/client/service.ts:203` | conversation.send() |
| Compaction | `packages/compaction/compaction/src/types.ts:18` | compaction/start |
| Context Injection | `packages/context/agent-instructions/src/index.ts:1` | agent-instructions |
| Agent Loop | `packages/core/agent-loop/src/agent.ts:230` | wakeDriver() |
| Agent Loop | `packages/core/agent-loop/src/agent.ts:327` | ReactLoopAgent.turn() |
| Agent Loop | `packages/core/agent-loop/src/agent.ts:435` | ReactLoopAgent.step() |
| Agent Registry | `packages/core/agent/src/index.ts:1` | AgentRegistry |
| Agent Registry | `packages/core/agent/src/runtime-types.ts:399` | agent/assistant-stream |
| Session | `packages/core/session/src/index.ts:806` | Session.append() |
| Session | `packages/core/session/src/index.ts:999` | deriveMessages() |
| Session | `packages/core/session/src/types.ts:287` | SessionEventMap |
| System Prompt | `packages/core/system-prompt/src/index.ts:484` | section() |
| System Prompt | `packages/core/system-prompt/src/index.ts:620` | assemble() |
| Native Executor | `packages/core/tool-executor-native/src/index.ts:1` | NativeToolExecutor |
| Tool Registry | `packages/core/tools/src/events.ts:18` | tools/pre-execute |
| Tool Registry | `packages/core/tools/src/index.ts:375` | execute() |
| Tool Pipeline | `packages/core/tools/src/pipeline.ts:190` | prepare() |
| Tool Pipeline | `packages/core/tools/src/pipeline.ts:295` | dispatch() |
| Tool Pipeline | `packages/core/tools/src/pipeline.ts:486` | postExecute() |
| Filesystem | `packages/fs/fs/src/index.ts:66` | fs/write-intent |
| Web Server | `packages/host/webserver/src/index.ts:1` | WebServer |
| Approval | `packages/interaction/user-approval/src/types.ts:87` | approval/request |
| Jobs | `packages/jobs/jobs/src/types.ts:54` | job/registered |
| DeepSeek Adapter | `packages/llm/llm-deepseek/src/adapter.ts:22` | DeepSeekAdapter |
| DeepSeek Adapter | `packages/llm/llm-deepseek/src/credential.ts:1` | resolveDeepSeekApiKey |
| LLM Runtime | `packages/llm/llm/src/index.ts:1170` | stream() |
| LLM Runtime | `packages/llm/llm/src/index.ts:960` | prepareCall() |
| LLM Runtime | `packages/llm/llm/src/types.ts:496` | StreamChunk |
| Sandbox | `packages/sandbox/sandbox-policy/src/session-mode.ts:25` | sandbox/mode |
| SDK | `packages/sdk/server/src/server.ts:262` | prompt() |
| Session Persistence | `packages/session/session-persistence-jsonl/src/index.ts:69` | DEFAULT_COMPRESSION = 'zstd' |
| Session Projection | `packages/session/session-projection/src/index.ts:1` | SessionProjections |
| Telemetry | `packages/session/session-telemetry/src/index.ts:44` | session-telemetry/record |
| Shell | `packages/shell/bash-sandbox/src/index.ts:1` | bash-sandbox |
| Skills | `packages/skill/skill/src/index.ts:296` | skills/change |
| Storage | `packages/storage/storage-domain/src/events.ts:46` | domain/changed |
| Subagent | `packages/subagent/subagent/src/index.ts:451` | prompt() |
| Subagent | `packages/subagent/tool-subagent/src/index.ts:1` | subagent 工具 |
| Profile / Bundle | `packages/util/official-bundles/src/bundles.ts:10` | PROFILE_TEMPLATES |
| Web Tools | `packages/web/web/src/index.ts:1` | WebService |
| Cordis | `vendor/cordis/src/index.ts:1` | Context |

## 已抽取代码片段（33）

| id | 位置 | 说明 |
| --- | --- | --- |
| `cli-entry` | `apps/cli/src/bin.ts:26` | CLI 入口 · runCli() |
| `profile-boot` | `apps/cli/src/profile-boot.ts:292` | runProfile · 组合 profile 并启动 |
| `app-boot` | `packages/boot/app-boot/src/index.ts:1200` | boot() · Loader 与根 include |
| `agent-send` | `packages/core/agent-loop/src/agent.ts:170` | Agent.send / followup / steer / inject |
| `agent-wake` | `packages/core/agent-loop/src/agent.ts:230` | wakeDriver() / kick() |
| `agent-turn` | `packages/core/agent-loop/src/agent.ts:326` | turn() · 轮次循环 |
| `agent-step` | `packages/core/agent-loop/src/agent.ts:435` | step() · 准备请求并发起流式调用 |
| `agent-commit` | `packages/core/agent-loop/src/agent.ts:541` | 流结束 · assistant/message 与工具执行 |
| `agent-prepare` | `packages/core/agent-loop/src/agent.ts:613` | prepareRequest() · agent/request 与 prepareCall |
| `agent-build` | `packages/core/agent-loop/src/agent.ts:656` | buildRequest() · header / context / messages |
| `session-append` | `packages/core/session/src/index.ts:806` | Session.append() · 快照、校验、追加 |
| `session-commit` | `packages/core/session/src/index.ts:886` | commit() · 写日志并广播 session/event |
| `session-derive` | `packages/core/session/src/index.ts:999` | deriveMessages() · 从事件日志投影模型历史 |
| `session-events` | `packages/core/session/src/types.ts:287` | SessionEventMap · 持久事件词汇 |
| `tools-execute` | `packages/core/tools/src/index.ts:369` | ctx.tools.execute() · 批次委派 |
| `tools-prepare` | `packages/core/tools/src/pipeline.ts:184` | tools/pre-execute · 策略、审批与 guard |
| `tools-dispatch` | `packages/core/tools/src/pipeline.ts:288` | tools/execute · 包裹工具体 |
| `tools-post` | `packages/core/tools/src/pipeline.ts:475` | tools/post-execute · 结果策略 |
| `llm-prepare` | `packages/llm/llm/src/index.ts:960` | ctx.llm.prepareCall() · 绑定适配器代际 |
| `llm-stream` | `packages/llm/llm/src/index.ts:1159` | ctx.llm.stream() · llm/stream 瀑布 |
| `llm-chunks` | `packages/llm/llm/src/types.ts:488` | StreamChunk · 适配器流协议 |
| `llm-request` | `packages/llm/llm/src/types.ts:560` | GenerateOptions · 一次模型请求 |
| `prompt-assemble` | `packages/core/system-prompt/src/index.ts:610` | ctx.systemPrompt.assemble() · 提示词组装 |
| `rpc-prompt` | `packages/api/session-controller/src/index.ts:461` | @Remote('prompt') · RPC 入口 |
| `commands-prompt` | `packages/api/session-controller/src/commands.ts:321` | prompt 准入 → agent.followup / steer |
| `client-prompt` | `packages/api/session-controller/src/client/sessions/session.ts:245` | 客户端 session.prompt() · 发起 RPC |
| `ui-send` | `packages/client/ui-conversation/src/client/service.ts:203` | 会话输入框提交 · conversation.send() |
| `stream-bridge` | `packages/api/session-controller/src/history/assistant-stream.ts:11` | agent/assistant-stream → 远程流 |
| `headless-run` | `packages/bundle/headless/src/index.ts:379` | Headless runner · 一次性驱动 |
| `tools-resolve` | `packages/core/tools/src/index.ts:264` | ctx.tools.resolve() · 本 Step 的可见工具集 |
| `approval-request` | `packages/interaction/user-approval/src/types.ts:78` | approval/request · 审批瀑布 |
| `tool-batch` | `packages/core/tools/src/batch.ts:236` | BatchSettlement · tool/call 与 tool/result 落日志 |
| `subagent-start` | `packages/subagent/tool-subagent/src/index.ts:317` | subagent 工具 · 启动子 Agent |

## Session 事件声明位置（63）

| 事件 | 位置 |
| --- | --- |
| `turn/start` | `packages/core/session/src/types.ts:294` |
| `turn/end` | `packages/core/session/src/types.ts:303` |
| `step/start` | `packages/core/session/src/types.ts:305` |
| `step/end` | `packages/core/session/src/types.ts:307` |
| `user/message` | `packages/core/session/src/types.ts:315` |
| `developer/message` | `packages/core/session/src/types.ts:317` |
| `system/message` | `packages/core/session/src/types.ts:338` |
| `assistant/message` | `packages/core/session/src/types.ts:349` |
| `assistant/attempt` | `packages/core/session/src/types.ts:363` |
| `tool/call` | `packages/core/session/src/types.ts:369` |
| `tool/result` | `packages/core/session/src/types.ts:383` |
| `request/header` | `packages/core/session/src/types.ts:398` |
| `request/context` | `packages/core/session/src/types.ts:410` |
| `session/end-seed` | `packages/core/session/src/types.ts:435` |
| `compaction/start` | `packages/compaction/compaction/src/types.ts:24` |
| `compaction/summary` | `packages/compaction/compaction/src/types.ts:34` |
| `compaction/end` | `packages/compaction/compaction/src/types.ts:72` |
| `compaction/prune` | `packages/compaction/compaction/src/types.ts:82` |
| `image/offload` | `packages/compaction/compaction-image-offload/src/projection.ts:25` |
| `agent/inbox/spliced` | `packages/core/agent/src/types.ts:110` |
| `model/selection` | `packages/core/agent/src/types.ts:121` |
| `tool/ptc-dispatch-start` | `packages/core/tool-executor-ptc/src/types.ts:45` |
| `tool/ptc-dispatch` | `packages/core/tool-executor-ptc/src/types.ts:61` |
| `deliverables/presented` | `packages/deliverables/tool-present/src/types.ts:15` |
| `workspace/changes` | `packages/deliverables/workspace-changes/src/types.ts:106` |
| `hook/invoked` | `packages/experimental/hook-protocol/src/types.ts:19` |
| `hook/result` | `packages/experimental/hook-protocol/src/types.ts:31` |
| `feedback/record` | `packages/feedback/command-feedback/src/types.ts:40` |
| `feedback/message-put` | `packages/feedback/message-feedback/src/types.ts:56` |
| `feedback/message-delete` | `packages/feedback/message-feedback/src/types.ts:58` |
| `goal/change` | `packages/goal/goal/src/domain.ts:66` |
| `command/run` | `packages/interaction/commands/src/types.ts:105` |
| `command/done` | `packages/interaction/commands/src/types.ts:112` |
| `permission/preset` | `packages/interaction/permission-presets/src/index.ts:53` |
| `approval/policy` | `packages/interaction/user-approval/src/index.ts:41` |
| `approval/asked` | `packages/interaction/user-approval/src/types.ts:44` |
| `approval/decided` | `packages/interaction/user-approval/src/types.ts:55` |
| `job/registered` | `packages/jobs/jobs/src/types.ts:59` |
| `job/settled` | `packages/jobs/jobs/src/types.ts:64` |
| `llm/retry` | `packages/llm/llm-retry/src/types.ts:9` |
| `llm/retry-started` | `packages/llm/llm-retry/src/types.ts:11` |
| `plan/mode` | `packages/plan/plan-mode/src/index.ts:53` |
| `agent-preset/selected` | `packages/preset/agent-preset-registry/src/session.ts:30` |
| `sandbox/mode` | `packages/sandbox/sandbox-policy/src/session-mode.ts:33` |
| `schedule/change` | `packages/schedule/schedule/src/types.ts:625` |
| `session-log-deepseek/delivery-accepted` | `packages/session/session-log-deepseek/src/types.ts:96` |
| `session/title` | `packages/session/session-title/src/index.ts:77` |
| `session/title-llm-request` | `packages/session/session-title-llm/src/index.ts:63` |
| `working-directory/change` | `packages/session/working-directory/src/index.ts:36` |
| `subagent/catalog` | `packages/subagent/subagent/src/catalog.ts:52` |
| `subagent/descriptor` | `packages/subagent/subagent/src/descriptor.ts:38` |
| `subagent/model-selection-policy` | `packages/subagent/tool-subagent/src/model-selection-state.ts:17` |
| `team/mode` | `packages/team/agent-team/src/types.ts:177` |
| `team/member` | `packages/team/agent-team/src/types.ts:179` |
| `team/task` | `packages/team/agent-team/src/types.ts:181` |
| `team/message/queued` | `packages/team/agent-team/src/types.ts:183` |
| `team/message/delivered` | `packages/team/agent-team/src/types.ts:185` |
| `todo/write` | `packages/todo/tool-todo/src/types.ts:33` |
| `web/deepseek-search-llm-request` | `packages/web/web-search-deepseek/src/provider.ts:89` |
| `tool-workflow/run-start` | `packages/workflow/tool-workflow/src/types.ts:47` |
| `tool-workflow/agent-start` | `packages/workflow/tool-workflow/src/types.ts:52` |
| `tool-workflow/agent-end` | `packages/workflow/tool-workflow/src/types.ts:57` |
| `tool-workflow/run-end` | `packages/workflow/tool-workflow/src/types.ts:62` |

## 包分组

| 分组 | 包数 |
| --- | --- |
| `apps` | 5 |
| `acp` | 1 |
| `api` | 10 |
| `attachment` | 2 |
| `boot` | 6 |
| `browser-use` | 1 |
| `bundle` | 6 |
| `client` | 70 |
| `compaction` | 5 |
| `computer-use` | 1 |
| `context` | 7 |
| `core` | 10 |
| `credentials` | 5 |
| `deliverables` | 3 |
| `document` | 1 |
| `experimental` | 61 |
| `extensions` | 4 |
| `feedback` | 2 |
| `fs` | 8 |
| `goal` | 4 |
| `guard` | 2 |
| `host` | 9 |
| `identity` | 1 |
| `interaction` | 5 |
| `jobs` | 3 |
| `llm` | 9 |
| `lsp` | 3 |
| `mcp` | 3 |
| `plan` | 1 |
| `preset` | 3 |
| `ptc-runtime` | 2 |
| `sandbox` | 4 |
| `schedule` | 2 |
| `sdk` | 3 |
| `session-query` | 3 |
| `session` | 22 |
| `settings` | 1 |
| `shell` | 10 |
| `skill` | 5 |
| `spill` | 3 |
| `ssh` | 5 |
| `storage` | 4 |
| `subagent` | 9 |
| `subprocess` | 3 |
| `team` | 2 |
| `telemetry` | 1 |
| `terminal` | 2 |
| `test-support` | 8 |
| `todo` | 1 |
| `typert` | 4 |
| `util` | 21 |
| `web` | 5 |
| `workflow` | 3 |
| `workspace` | 1 |

完整包列表（375 个）见平台「源码索引 → 全部包」，或 `data/generated.json` 的 `packages`。
