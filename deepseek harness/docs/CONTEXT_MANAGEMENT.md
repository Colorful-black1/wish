# CONTEXT_MANAGEMENT · 提示词与上下文机制

> 依据：`packages/core/system-prompt/src/index.ts`、`packages/core/agent-loop/src/agent.ts`、`packages/compaction/*`、`packages/context/*`、`docs/subsystems/system-prompt.zh.md`、`compaction.zh.md`。

## 1. 系统提示词不是一段字符串

`ctx.systemPrompt` 维护四类注册：

| 注册 | 作用 | 读取时机 |
| --- | --- | --- |
| `section()` | 命名提示词片段，可函数化、可排序、可声明 complete | 每次 `assemble()` |
| `context()` | 运行时上下文条目（工作目录、时间、会话引用…） | 每次 assemble / refresh |
| `variable()` | 模板变量（provider、model 等） | 渲染时 |
| `tools()` | 工具 schema provider | 每步按 Agent 作用域收集 |

`assemble(context)`（`packages/core/system-prompt/src/index.ts:620`）：

1. 合并全局与作用域变量（近作用域覆盖远作用域）；
2. 合并 section/context，按顺序排序；
3. 收集工具 schema 并排序；
4. 跑 `system-prompt/assemble` waterfall；
5. 最多允许一个 `complete` section，它会成为唯一提示词；
6. 返回 `PromptAssembly { sections, contexts, variables, tools }`。

## 2. 提示词如何进入请求

循环渲染 `PromptAssembly` 后调用 `systemPrompt.project(renderedPrompt, intent)`，产生 `system/message` 事件（`agent.ts:453`）。

规则（README 的实现说明 + `SessionEventMap['system/message']` 注释）：

- 最新非空 `system/message` 是有效提示词；空文本会清空所有提示词节点；
- 支持 `systemPromptUpdate: 'in-history'` 的路由可以追加非空变更；
- 不具备该能力的路由、或有效文本不同的新请求序列，会把文本归并到首个系统节点；
- 归并通过「逐节点空内容替换」完成，保留中间历史，不删日志。

模型请求本身**不带 `system` 字段**：提示词已经在派生历史里。

## 3. 工具 schema 注入

- 工具 schema 由 `ctx.tools.resolve()` 按 Agent 作用域与模型能力求可见集合；
- 通过 system-prompt 的 tool provider 进入 `assembly.tools`；
- 变化时写 `request/header.tools`，必要时写 `developer/message` 告知模型工具增删；
- 不支持 `toolUpdate` 的路由会因工具变化强制开启新请求序列。

## 4. 运行时上下文

- `preStep` 的 fallback 把运行时 section 投影成一条额外 user 消息（`agent.ts:300-304`）；
- `agent.inject()` 把上下文放进 `next-step`，不打断当前流；
- `context/*` 包（agent-instructions、time-context、session-reference、tmux-context…）通过 `agent/pre-step` 或 inject 参与；
- 工作目录由 `working-directory` 服务提供，不改原始项目标识与沙箱写根。

## 5. 历史消息

- 每次请求都 `session.deriveMessages()`；
- 只包含 surface 节点（消息事件），原始 chunk、边界事件、attempt 被排除；
- 消息对象深冻结，循环复用冻结证据；
- `request/header` 与 `request/context` 是 log-only，不进入 messages。

## 6. 压缩与裁剪

`compaction-basic` 监听 `agent/pre-step`，在需要时：

1. 生成摘要；
2. 写 `compaction/start`、`compaction/summary`、`compaction/end`；
3. 用 `surfaceOp: { op: 'replace', startSeq, endSeq }` 遮蔽旧节点。

相关策略包：

- `compaction-image-offload`：移除/替换旧图片，监听 `agent/request-error` 处理上下文溢出；
- `compaction-tool-result-pruner`：裁剪旧工具结果；
- `session-checkpoint-policy`：在请求边界写耐久检查点。

## 7. Token 与上下文窗口

- `contextWindow` 来自 `preparedCall.context`，写进 `request/context`；
- `maxTokens` 是逐请求输出上限；`finish: max-tokens` 是粘性结束原因；
- 没有「按 token 数自动裁历史」的通用逻辑；裁剪由压缩插件决定，循环只负责把结果写进 surface；
- `token-meter` 旁路统计 usage（`assistant/message.usage`）。

## 8. 不同 Session 的隔离

- 每个 Agent 有独立 Session 与独立日志；
- Agent 作用域的 section/context/tool 注册只对该 Agent 生效；
- 子 Agent 不共享父 Agent 的上下文；父 Agent 只拿到子 Agent 的最终文本（tool/result）；
- session 恢复不会串上下文：恢复的是同一个 Session 日志。

## 9. 上下文与持久化的关系

- 注入的上下文也是 `user/message`（source 区分），因此可回放；
- 提示词是 `system/message`，压缩后旧节点仍在日志；
- 实时流帧不持久，刷新后靠 `assistant/message` 内嵌 stream 恢复。

## 10. 未发现 / 注意

- 没有固定文案的「系统人设」：base 与各 mode bundle 通过 `system-prompt` 配置注入 persona 前缀（web-app patch 里有具体值）。
- 没有「自动摘要所有历史」的默认行为，压缩是插件策略。

## 源码位置

- `packages/core/system-prompt/src/index.ts:31` assemble waterfall、`:484` section、`:519` context、`:551` tools、`:588` refreshContext、`:620` assemble
- `packages/core/agent-loop/src/agent.ts:294,446,453,460`
- `packages/core/session/src/types.ts:338` system/message 语义
- `packages/compaction/compaction/src/types.ts:18`
- `packages/session/session-checkpoint-policy`
