# TOOL_EXECUTION · 工具注册、调用与执行

> 依据：`packages/core/tools/src/index.ts`、`pipeline.ts`、`contracts.ts`、`events.ts`、`docs/tool-catalog.md`（生成物）、`docs/tool-execution-pipeline.md`。

## 1. 工具是什么

`ToolDefinition`（`packages/core/tools/src/contracts.ts:26`）在 `ToolSchema` 之上增加执行面：

- `name` / `description` / `parameters`（给模型）；
- `execute(args, exec)`（给运行时）；
- 并发分类（`safe` / `exclusive`）；
- 可选的结果呈现、合法化、超时/后台能力。

工具由插件在 `ctx.tools.register()` 注册，属于该插件 fiber；插件卸载即撤销。工具 schema 通过 `system-prompt` 的 tool provider 进入模型请求，而不是写死在循环里。

## 2. 注册、可见性与作用域

- `ctx.tools.resolve({ agent, modelSelection, signal })` 沿 scope chain 找工具集合；
- Agent 作用域注册的工具只对该 Agent 可见；
- 工具可见性变化会反映到 `request/header.tools`，必要时写 `developer/message` 告知模型工具增删。

## 3. 批次执行

`ctx.tools.execute(input)`（`packages/core/tools/src/index.ts:375`）按 Agent 所在作用域选择执行器：

- **原生执行器**（`tool-executor-native`）：并发安全调用走有界滚动池，独占调用形成屏障；结果按模型顺序返回；每个批次的并发上限来自 `maxParallelToolCalls`（默认 10，1 表示串行）。
- **PTC 执行器**（`tool-executor-ptc`）：只向模型暴露 `run_code`，子调用通过生成 SDK 进入同一条受守卫流水线。

原始调用批次整体交给执行器；执行器保留模型顺序与独占屏障语义。

## 4. 三段式流水线

`packages/core/tools/src/pipeline.ts`：

### 4.1 pre-execute（`prepare()`，:190）

1. 创建执行快照（参数只读、分配 callId）；
2. 调用方已取消 → `ABORTED_BEFORE_DISPATCH`；
3. `tools/pre-execute` waterfall → `allow / ask / deny / cancel`；
4. `ask` → `approval.request()`：
   - `allowed-once` → allow；
   - `denied` / `cancelled` / 无通道 → deny；
5. 全局与继承 guard 检查；
6. 拒绝/取消 → 直接转成 `isError` 结果，不进入工具体。

### 4.2 execute（`dispatch()`，:295）

- `tools/execute` waterfall 可包裹执行（超时策略、PTY、PTC 桥接、检查点）；
- 解析工具名 → 找不到抛 `ToolNotFoundError`；
- 调用 `tool.execute(args, exec)`；
- 任何 throw 都转成 `isError` 结果（`toolErrorResult`）；
- 已启动的工具体在取消后仍会先收敛，再标记 `ABORTED`。

### 4.3 post-execute（:486）

- `tools/post-execute` waterfall → `accept` 或 `block`；
- 可替换 `content` / `value`，可附加 `additionalContexts`；
- `block` 把结果变为 `isError` 并携带纠正反馈；
- 失败结果不能被替换成成功 value。

## 5. 结果如何回到模型

- 执行器把每次调用结算成 `tool/call`（模型请求时）与 `tool/result`（执行后）事件；
- `tool/result` 的 `message` 是 `ToolResultMessage`，与 `toolCallId` 配对；
- `additionalContexts` 被循环 splice 进 `next-step`，成为下一 Step 的输入；
- 结果里的 `meta` 是工具私有展示数据，不进入模型内容。

## 6. 审批与权限

- `tools/pre-execute` 返回 `ask` 时，`approval` seam 负责把问题送到用户；
- 没有审批通道 → 拒绝（绝不默认放行）；
- 权限模式（permission presets）与单次审批是两套机制：前者决定默认策略，后者只决定这一次调用；
- sandbox 是另一层：它限制执行世界（文件写根、进程 argv），不是「是否允许调用工具」。

## 7. 工具目录

`docs/tool-catalog.md` 是生成物：每个 `packages/*/tool-*` 包在真实上下文里启动，读取 `ctx.tools.schemas()`，因此工具名与 schema 是运行时真实值。

本仓库随附的抽取结果：**35 个工具包 / 72 个模型可见工具名**（含别名）。常见分组：

| 分组 | 例子 |
| --- | --- |
| 文件 | `read`、`write`、`edit`、`apply_patch`、`read_image`、`glob`、`grep` |
| 进程 | `bash`、`pwsh`、`terminal_*`、`job_*` |
| 网络 | `web_search`、`web_fetch` |
| 协作 | `subagent`、`list_agents`、`send_message`、`wait_agent`、`interrupt_agent`、`team_task_*` |
| 规划 | `todo_write`、`create_goal`、`update_goal`、`exit_plan_mode` |
| 交付 | `present`、`skill`、`plugin_manager`、`workflow` |

## 8. 失败与恢复

- 工具失败是数据，不是崩溃：模型看到 `isError` 文本后可换参数或换工具。
- Step 失败时，循环给尚无结果的调用补错误结果（`TOOL_OUTCOME_UNKNOWN` / `TOOL_NOT_STARTED`），保证下一次请求的工具历史配对完整。
- 取消后未分发的调用会得到 `ABORTED_BEFORE_DISPATCH` 的合成结果。

## 9. 边界

- 工具 schema 校验失败发生在调用前；不会进入工具体。
- `tools/post-execute` 不能把失败结果改成成功。
- 工具结果必须可 JSON 序列化（Session 会拒绝不可序列化的 data）。

## 源码位置

- `packages/core/tools/src/index.ts:375` execute、`:357` selectExecutor
- `packages/core/tools/src/pipeline.ts:190` prepare、`:295` dispatch、`:486` postExecute
- `packages/core/tools/src/events.ts:18,29,41,49,56`
- `packages/core/tools/src/contracts.ts:26,152,219,346`
- `packages/interaction/user-approval/src/types.ts:87`
- `packages/core/agent-loop/src/agent.ts:590`
