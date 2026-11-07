# LLM_FLOW · 模型调用机制

> 依据：`packages/llm/llm/src/index.ts`、`types.ts`、`packages/llm/llm-deepseek/src/*`、`packages/llm/llm-retry`、`docs/subsystems/llm-streaming.zh.md`。

## 1. 边界：循环不认识任何 provider

Agent Loop 只构造 `GenerateOptions` 并消费 `AsyncIterable<StreamChunk>`。provider 的鉴权、SSE、错误码、图片上传都在适配器里。

```text
Agent Loop ──prepareCall(provider, model)──▶ ctx.llm
                                              ├── adapter.prepareCall()  // 绑定代际
                                              └── config + retryPolicy
Agent Loop ──preparedCall.stream(request)──▶ ctx.llm.stream()
                                              └── llm/stream waterfall
                                                  └── adapter.stream()
                                                      └── StreamChunk*
```

## 2. 适配器注册

- 抽象类 `LlmAdapter`（`packages/llm/llm/src/index.ts:208`）只要求实现 `stream(options)`。
- 可选覆盖：`providerInfo`、`providerRetryPolicy`、`listModels`、`resolveModel`、`prepareCall`、图片定价与目标。
- `ctx.llm.registerAdapter(providers, adapter)` 返回 disposer 与 `replace(providers)`；同一 provider 不能被两个适配器注册。
- 随附实现：`DeepSeekAdapter`（直连 Messages API，`llm-deepseek/src/adapter.ts:22`）与 pi-ai 适配器（多 provider，`llm-pi-ai`）。

## 3. 一次调用的准备

`ctx.llm.prepareCall(config, signal)`（`index.ts:960`）：

1. 按 provider 找到注册项；
2. `adapter.prepareCall(provider, model)` 绑定模型元数据与该代际的流入口（HMR 期间不会混淆两代适配器）；
3. 解析推理强度、输出 token 默认值、上下文窗口；
4. 深冻结 config；
5. 返回的 `stream()` **只能派发一次**，且传入 config 必须与准备时一致，否则 `INVALID_PREPARED_CALL`。

循环在 `agent/pre-step` 之前固定 provider/model/reasoningEffort；`agent/request` 只能改采样等控制参数，改了 provider/model 会直接抛错。

## 4. 请求结构（GenerateOptions）

`packages/llm/llm/src/types.ts:564`：

| 字段 | 说明 |
| --- | --- |
| `provider` / `model` | 路由 |
| `messages` | 从 Session 日志派生的历史；循环构建的请求**不带** `system` 字段 |
| `tools` | 本步可见工具 schema |
| `toolHistory` | 工具增删历史，供 provider 投影 |
| `temperature` / `maxTokens` / `stop` | 采样控制 |
| `signal` | 取消贯穿到适配器与流迭代 |
| `sessionId` / `purpose` | 路由与辅助调用分类 |

## 5. 流协议

`StreamChunk`（`types.ts:496`）：

```ts
| { type: 'block-start'; index; blockType }
| { type: 'text-delta'; index; text }
| { type: 'reasoning-delta'; index; text }
| { type: 'tool-call-delta'; index; id; name?; argumentsDelta }
| { type: 'block-end'; index; block }        // 组装好的内容块
| { type: 'usage'; usage }                   // 终止 finish 之前
| { type: 'finish'; reason; replayState? }   // completed / error / max-tokens / aborted
```

`block-start` / `block-end` 的 index 关联交错的增量；工具参数在 block-end 前保持原始 JSON 字符串。

## 6. 归一化与错误

- `ctx.llm.stream()` 统一经过 `llm/stream` 瀑布（`index.ts:1170`），监听器可以包装/替换流（录放、检查点、标题生成）。
- 适配器 throw 会被转成终止的 `finish { reason: { kind: 'error' | 'aborted' } }`，而不是把异常抛给循环。
- 重试：`llm-retry` 监听 `agent/request-error`；返回 `{ kind: 'retry' }` 且不调用 `next()` 才重试。重试复用同一份组装结果，不重复 `agent/pre-step` 与用户消息准入。
- 取消：`AbortSignal` 同时传给适配器与流迭代。

## 7. 从 chunk 到 assistant/message

`AssistantStreamAttempt`（agent-loop）在循环中累积块：

- 文本/推理/工具参数按 index 累积；
- 成功：`assistant/message` 内嵌紧凑 stream 与 usage；
- 失败/取消：`assistant/attempt` 保留 stream，不产生可见历史；
- 取消但已有文本：`assistant/message` + `interrupted: true`。

实时展示走 `agent/assistant-stream`（进程本地事件），不写日志。

## 8. 模型选择与上下文窗口

- 选择记录在 Session（`model/selection`），`agent.model.current()` 在步骤准备前读取；
- `request/context` 只在 provider/model/contextWindow/systemPromptUpdate 变化时写；
- 压缩（compaction）在 `agent/pre-step` 介入，用 surface replace 遮蔽旧历史，不删日志。

## 9. 未发现 / 边界

- 循环没有内置「自动换模型重试」：路由在 pre-step 固定，换模型需要先 `agent.model.select()`。
- 适配器不负责会话持久化；它只产生 chunk，循环负责把结果写进日志。

## 源码位置

- `packages/llm/llm/src/index.ts:169` PreparedLlmCall、`:208` LlmAdapter、`:960` prepareCall、`:1170` stream
- `packages/llm/llm/src/types.ts:496` StreamChunk、`:564` GenerateOptions
- `packages/llm/llm-deepseek/src/adapter.ts:22`
- `packages/llm/llm-retry/src/types.ts:7`
- `packages/core/agent-loop/src/agent.ts:490`、`:548`、`:566`
