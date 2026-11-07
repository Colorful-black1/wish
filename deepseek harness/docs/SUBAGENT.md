# SUBAGENT · 子 Agent 与多 Agent 协作

> 依据：`packages/subagent/*`、`packages/team/agent-team`、`docs/subsystems/subagent.zh.md`、`docs/subsystems/agent-team.zh.md`、`docs/tool-catalog.md`。

## 1. 一个接口，多种提供方

`ctx.subagents` 背后是同一套委派语义，提供方决定子 Agent 跑在哪里：

| 提供方包 | 形态 |
| --- | --- |
| `subagent-spawn-in-process` | 同进程新建子 Agent + 子 Session |
| `subagent-fork-in-process` | 从父会话前缀 fork 出子 Agent |
| `subagent-codex` | 外部 Codex |
| `subagent-claude-code` | 外部 Claude Code |
| `subagent-acp` | ACP 后端 |
| `subagent-dsh-sdk` | 通过 SDK 启动的 dsh |

工具侧由 `tool-subagent` 提供 `subagent`（加载时 `toolName` 可改，另有 `subagent_fork` 别名）。模型只需要知道「委派一个任务并拿回结果」。

## 2. 委派流程

```text
父 Agent 模型调用 subagent 工具
  → tool-subagent 校验参数 / 模型路由
  → ctx.subagents.startActivation(spec)
    → 选择 provider
    → 创建子 Session（独立 id）
    → 启动子 Agent Loop
  → 返回子 Agent 名字 / id（立即）
父 Agent 继续自己的工作，或 wait_agent
子 Agent 跑自己的 Turn/Step，用自己的工具
子 Agent 收敛 → 结果作为 tool/result 回到父 Agent
```

关键点：

- **独立 Session**：子 Agent 的完整日志在自己的 Session 里，父 Agent 不复制；
- **独立工具集与模型**：可在委派时指定模型；工具按子 Agent 作用域解析；
- **上下文不共享**：父 Agent 的对话历史不会自动灌进子 Agent，委派 prompt 才是输入；
- **结果是一个工具结果**：父 Agent 看到的是子 Agent 的最终文本，而不是它的全部过程。

## 3. 控制工具

`tool-subagent-control` 提供：

| 工具 | 作用 |
| --- | --- |
| `list_agents` | 列出当前子 Agent 树 |
| `send_message` | 向子 Agent 的收件箱发消息 |
| `wait_agent` | 等待子 Agent 的输入/完成 |
| `interrupt_agent` | 中断自己拥有的后代 |

这些工具让父 Agent 能做异步协作，而不是只能同步等待一次委派。

## 4. 生命周期与事件

- `subagent/start` / `subagent/end`：一次委派的生命周期；
- `subagent/provider-added` / `provider-removed`：提供方注册变化；
- `agent/created` / `agent/disposed`：子 Agent 本身的注册表事件；
- 子 Session 的 `turn/*`、`tool/*` 与父 Session 独立记录。

子 Agent 的销毁走 `agent/disposed` + `session/disposed`；父 Agent 的 dispose 会 drain 自己的后代。

## 5. Agent Teams

`packages/team/agent-team` 在根 Session 开启任务策略与**共享任务板**：

- `team_task_create` / `team_task_get` / `team_task_list` / `team_task_update`；
- 任务板属于同一棵子 Agent 树的根 Session；
- Team 模式不替代普通 subagent 工具：身份、通信、发现、中断、收件箱等待仍由 `tool-subagent-control` 负责；
- 相关 Session 事件：`team/mode`、`team/member`、`team/task`、`team/message/queued`、`team/message/delivered`。

## 6. 适用与不适用

适合：

- 大项目的模块化探索（前端 / 后端 / 数据库各一个子 Agent）；
- 需要上下文隔离的长任务；
- 并行候选方案比较。

不适合：

- 需要频繁共享中间细节的任务（子 Agent 之间不共享内存，只能靠消息/任务板）；
- 对延迟极敏感的单步任务（多一层委派与汇总）。

## 7. 当前源码中未发现

- 没有自动的「Agent 拓扑调度器」：委派由模型显式调用工具决定；
- 没有跨进程共享上下文：外部 provider 只通过协议交互；
- 没有全局 Agent 池/负载均衡；提供方由组合决定。

## 源码位置

- `packages/subagent/subagent/src/index.ts:142,148,158,166,451`
- `packages/subagent/tool-subagent/src/index.ts`
- `packages/subagent/tool-subagent-control/src/index.ts`
- `packages/team/agent-team/src/types.ts:175`
- `packages/core/agent/src/runtime-types.ts:290`（agent/created）
- `packages/bundle/base/cordis.patch.yml`（subagent 相关行）
