# AGENT_LOOP · 轮次、步骤与循环

> 依据：`packages/core/agent-loop/src/agent.ts`（`turn()` 327、`step()` 435）、`README.zh.md`、`docs/architecture.zh.md` 的轮次流程。

## 1. 三个词

| 概念 | 定义 | 边界事件 |
| --- | --- | --- |
| Turn（轮次） | 从领取首条输入到不再欠任何工作 | `turn/start` → `turn/end` |
| Step（步骤） | 一次模型请求 + 它请求的工具 | `step/start` → `step/end` |
| Attempt（尝试） | 同一次 Steps 内的一次模型调用；重试不重复组装 | 流成功则 `assistant/message`，否则 `assistant/attempt` |

一个 Turn 有 **零个或多个 Step**：没有可领取输入、pre-step 拒绝、或首条进入被改写为空时，可以没有 Step。

## 2. 循环骨架（`turn()`）

```text
turn/start
while (true):
  preStep(target)                      // claim + model.current + tools.resolve + assemble + agent/pre-step
  if reject / 首次为空: break or return
  step/start
  step(decision)                       // 见下
  step/end                             // finally 必写
  if 有欠账（tool 或 next-step 输入）: continue
  agent/turn-stopping（serial）
  break
turn/end(reason)
```

- `target` 首次是 `next-turn`，后续 Step 是 `next-step`（`agent.ts:342,400`）。
- `turnEnds` 记录结束原因；`max-tokens` 是粘性结果，后续正常 Step 不会把它降级为 completed（`:373,584`）。
- 出错时先把尚无结果的工具调用补成错误结果（`toolRecovery.results()`），再关闭轮次。

## 3. 一个 Step 的顺序（`step()`）

1. `prepareRequest()`：跑 `agent/request` 瀑布，再 `ctx.llm.prepareCall()` 绑定适配器（`:613`）。
2. `systemPrompt.refreshContext()` + `systemPrompt.project()`：把渲染后的提示词协调成 `system/message`（`:446,453`）。
3. 首次尝试才把已接纳消息写成 `user/message`（`:463-477`）。
4. `buildRequest()`：按需写 `request/header`、`request/context`，用 `deriveMessages()` 派生历史并冻结（`:656`）。
5. `live.start()` → 消费 `AsyncIterable<StreamChunk>`（`:492-497`）。
6. 流成功 → `assistant/message`；有 `tool-call` → `ctx.tools.execute()`；否则返回 completed。
7. 工具结果由执行器写 `tool/result`，额外上下文 splice 进 `next-step`。

## 4. 为什么会有多个 Step

模型返回 tool-call 时，Step 以 `null` 结束（还有欠账）。`turn()` 的 while 循环回到领取阶段，`step + 1`，把工具结果作为历史的一部分再请求模型。用户看到的一次「回答」可能是第 1、3、5 个 Step。

这也是「Agent 如何判断任务完成」的答案：**它不判断**。模型不再返回 tool-call，且 inbox 没有新输入，循环就结束；是否真的完成由模型决定。

## 5. 用户中途输入

| 入口 | 目标 | 语义 |
| --- | --- | --- |
| `followup` | `next-turn` | 当前 Turn 结束后开启新 Turn |
| `steer` | `next-step` | 当前 Step 结束后插进下一次模型请求 |
| `inject` | `next-step`，不唤醒 | 上下文注入（技能、文件变化、job 通知） |

`send()` 会把消息 splice 进持久化 inbox，并写 `agent/inbox/spliced`；领取时写 claimed 通知，删除时写 discarded。

## 6. 取消

`cancel()`（`:191`）：

- 默认清空 inbox（`next-step` 先于 `next-turn`），并 abort 当前活动；
- 流中已经产生的文本会以 `interrupted: true` 的 `assistant/message` 结算，长度前缀不丢；
- 未分发的工具调用会得到 `ABORTED_BEFORE_DISPATCH` 的合成结果（README 的实现说明）；
- `turn/end` 记录 `{ kind: 'aborted', reason }`。

## 7. 失败与重试

- 模型流失败 → `assistant/attempt`（无可见消息）→ `agent/request-error` 瀑布。监听器返回 `{ kind: 'retry' }` 且不调用 `next()` 才重试；否则抛 `LlmError` 结束轮次。
- 工具失败 → pipeline 捕获成 `isError` 结果，**不是**异常，模型可以看到并重试。
- 插件失败 → 直接结束轮次；插件失败结束的是轮次，不是循环进程。
- 失败 Step 关闭前会给每个无结果的 tool-call 补错误结果（`TOOL_OUTCOME_UNKNOWN` / `TOOL_NOT_STARTED`）。

## 8. 提示词与请求序列（容易忽略）

- 系统提示词不是每次重发：它是历史里的 `system/message` 节点，最新非空节点是有效提示词。
- 支持 `systemPromptUpdate: 'in-history'` 的路由可以追加变更；不支持的或新序列会归并到首个系统节点。
- 工具 schema 变化可能强制开启新请求序列；请求头 `header.tools` 记录当次可见工具。
- 请求对象深冻结、且 `preparedCall.stream()` 只能派发一次。

## 9. 关键源码

- `agent.ts:326-433` turn
- `agent.ts:435-609` step
- `agent.ts:613-653` prepareRequest
- `agent.ts:656-744` buildRequest
- `agent.ts:268-281` kick（驱动器边界）
- `agent.ts:283-317` preStep
- `packages/core/session/src/index.ts:999` deriveMessages
- `packages/llm/llm/src/types.ts:496` StreamChunk
