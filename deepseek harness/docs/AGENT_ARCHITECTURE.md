# AGENT_ARCHITECTURE · Agent 核心机制

> 依据：`packages/core/agent/src/runtime-types.ts`、`packages/core/agent-loop/src/index.ts`、`agent.ts`、`docs/subsystems/core.zh.md`。

## 1. Agent 是接口，不是类

`docs/subsystems/core.zh.md` 与源码一致：`@deepseek-ai/dsh-agent` 只声明 `Agent` 契约、活跃 Agent 注册表（`ctx.agents`）与 `agent/*` 事件；唯一默认实现是 `agent-loop` 的 `ReactLoopAgent`，它在 `ctx.agents` 上注册为 `AgentFactory`。

`packages/core/agent/src/runtime-types.ts:190` 的声明合并给出 Agent 的公开面：

| 成员 | 含义 |
| --- | --- |
| `options` | 路由与输出控制的回退值；Session 记录选择后以日志为准 |
| `session` | 它驱动的 Session；日志是唯一持久事实来源 |
| `model` | 读取/选择后续步骤的 provider、model、reasoningEffort |
| `inbox` | 待处理输入的持久投影（`next-turn` / `next-step`） |
| `status` | `'idle'` / `'running'`，镜像每次 `agent/status` |
| `ctx` | Agent 作用域上下文，注册随 Agent 销毁撤销 |
| `send / followup / steer / inject` | 输入入口（见下） |
| `cancel / whenIdle / runMaintenance` | 生命周期控制 |

## 2. 四个输入入口

```ts
send(message, target, wakeup)   // 唯一底层入口
followup(message)               // = send(message, 'next-turn', true)
steer(message)                  // = send(message, 'next-step', true)
inject(message)                 // = send(message, 'next-step', false)
```

（`packages/core/agent-loop/src/agent.ts:170-189`）

- `next-turn`：等当前轮次结束后再开新一轮；
- `next-step`：当前 Step 结束后插进下一次模型请求；
- `wakeup` 决定是否启动/唤醒驱动器。若当前活动已被 abort，唤醒输入会被改投到 `next-turn`（`:173`）。

## 3. 创建与恢复

`ctx.agents.create(options)` / `ctx.agents.resume(options)`（`packages/core/agent-loop/src/index.ts:716,752`）都返回 `AgentHandle`。初始化流程（`index.ts` 的实现说明）：

1. 取得或创建 Session（resume 先 `persistence.open(id, 'write')`，排除并发恢复，读取物理有效日志）；
2. 构造 Agent 与带作用域的 `agent.ctx`；
3. 存储构造历史、进入 SessionStore、完成 `session/created`；
4. 运行可选 `setup(agentCtx, agent)` 与 commit；
5. 进入 AgentRegistry；
6. 等待串行 `agent/created` 监听器；
7. 释放已排队输入。

任一步失败都会回滚已准备资源，并发出 `session/disposed`；已送达的 `agent/created` 会有配对的 `agent/disposed`。

## 4. 运行状态

`phase` 是驱动器的内部状态（`agent.ts:53`）：

- `idle`：没有活动；
- `running`：正占用一次 Turn/Step 驱动；
- `maintenance`：正在跑非轮次任务（如压缩），**公开 `status` 仍可能是 idle**。

`runMaintenance()` 从真正空闲的 phase 启动，期间到达的唤醒输入留在 inbox，任务结束后再释放。

## 5. Agent 与 Session 的关系

- 一对一：一个 Agent 驱动一个 Session；子 Agent 有独立 Session。
- Agent 不持有第二份「消息数组」：每次请求都由 `session.deriveMessages()` 投影。
- 恢复 = 重新打开同一 Session 再建 Agent，而不是反序列化 Agent 对象。

## 6. Agent 如何拿到工具、模型、上下文

| 依赖 | 获取方式 | 作用域 |
| --- | --- | --- |
| 模型 | 启动时 `agent.model.current()` 固定，后续可 `select()` | Session 记录选择，下一 Step 生效 |
| 工具 | `ctx.tools.resolve({ agent, modelSelection, signal })` | Agent 作用域优先，沿 scope chain 回退 |
| 提示词 | `ctx.systemPrompt.assemble(...)` | 全局 + Agent 作用域 section/context/variable |
| 运行时上下文 | `preStep` fallback 投影 + `agent.inject()` | 作为 user/message 或 Step 输入 |

## 7. 取消与销毁

- `cancel(cause, options?)`：默认清空 inbox 并 abort 当前活动；`keepInbox` 保留待处理输入。
- 取消原因会复制进 `turn/end`（`TurnEndCancelCause`），实时 `AbortSignal.reason` 仍是调用方对象。
- dispose：停止并排空驱动器 → 撤销作用域 → 关闭 Session 写路径 → detach agent/session。

## 8. Agent 之间如何通信

不是共享内存：

1. **父 → 子**：`subagent` 工具 → `ctx.subagents` → 子 Session / 子 Agent；
2. **子 → 父**：子 Agent 的最终文本变成父 Agent 的 `tool/result`；
3. **异步**：`send_message` / `wait_agent` / `interrupt_agent` 操作子 Agent 的收件箱与生命周期；
4. **Agent Teams**：根 Session 的共享任务板（`team_task_*`），身份与通信仍由普通 subagent 控制工具负责。

详见 `SUBAGENT.md`。

## 9. 常见误解

| 误解 | 源码事实 |
| --- | --- |
| Agent 是一个长驻对象，自己保存对话 | Agent 每次启动都从 Session 日志恢复上下文 |
| `agent.cancel()` 会丢弃已生成文本 | 已流出的前缀会以 `interrupted: true` 的 assistant/message 结算 |
| 一个进程只有一个 Agent | 子 Agent 在同一进程（或外部提供方）里可以有多个 |
| Agent 自己判断任务完成 | 循环只按「无 tool-call 且无新输入」结束 |

## 源码位置

- `packages/core/agent/src/runtime-types.ts:190-260`（Agent 接口与 `agent/*` 事件声明）
- `packages/core/agent/src/index.ts`（AgentRegistry）
- `packages/core/agent-loop/src/agent.ts:112`（`ReactLoopAgent`）、`:161`（phase/status）、`:191`（cancel）
- `packages/core/agent-loop/src/index.ts:290`（AgentLoop 服务）、`:716`（createAgent）、`:752`（resume）
