# SCENARIOS · 典型场景全流程

> 场景是学习案例，不代表每种能力都有对应实现。每个场景标注「完全支持 / 需组合 / 源码未内置」。
> 页面「场景实验室」有逐步播放与分支说明；本文件是文字版摘要。

## 总览

| 场景 | 示例 | 支持度 | 关键工具 |
| --- | --- | --- | --- |
| A 普通问答 | 「什么是 HashMap？」 | 完全支持 | 无 |
| B Coding | 「找出登录实现并修 Bug、跑测试」 | 完全支持 | grep/glob、read、edit、apply_patch、bash |
| C 文件操作 | 「读取目录并整理」 | 完全支持 | glob、read、write、read_image |
| D 办公 | 「分析 Excel，出报告与 PPT」 | 需组合（技能 + LibreOffice Kit + 环境） | skill、bash、read/write、present |
| E 网页搜索 | 「搜最新进展并整理报告」 | 需 provider | web_search、web_fetch |
| F Subagent | 「前端/后端/数据库分别分析再汇总」 | 完全支持 | subagent、list_agents、wait_agent |
| G 后台任务 | 「跑批处理，完成后告诉我」 | 完全支持 | bash(run_in_background)、job_* |
| H 异常与中断 | 失败、拒绝、取消、恢复 | 完全支持（分支） | 无 |

## A · 普通问答

路径最短：`followup → turn/start → claim → assemble → pre-step → step/start → llm.stream → assistant/message → turn/end`。

- 没有工具调用时 `step()` 返回 `{ kind: 'completed' }`（`agent.ts:587`）。
- 仍会写 `system/message`、`user/message`、`request/header`、`request/context`。
- UI 先收到 `agent/assistant-stream` 帧，刷新后靠 `assistant/message` 内嵌 stream 恢复。

## B · Coding

典型多 Step 循环：

1. 模型先搜索（`grep` / `glob`）或列目录；
2. `read` 读取候选文件（可带行范围）；
3. 模型基于 `tool/result` 开下一 Step；
4. `edit` / `apply_patch` 修改（触发 `fs/edit-intent` 或 `fs/write-intent`）；
5. `bash` 跑测试（经 `ctx.shell` 与沙箱；必要时审批）；
6. 测试失败输出是普通 `isError` 结果，模型继续修；
7. 模型不再调用工具 → Turn 结束。

注意：Coding 能力来自通用 fs/shell/search，**没有**领域专用的「登录功能工具」。

## C · 文件操作

- `glob` 找文件；结果超限时由 spill 后端保存完整列表；
- 相对路径基于会话工作目录；写根由 sandbox policy 决定；
- `read` 按行范围返回，避免灌爆上下文；成功后发 `fs/observed`；
- 写入经过 `fs/write-intent`；`fs-observation-policy` 可要求「先读后写」（随附配置默认关闭）；
- 越界/不存在 → `isError` 结果，模型可换方案。

## D · 办公

`skill-office` 提供 docx / xlsx / pptx / render / recalculate / export-pdf 六个技能：

- 创建技能使用 Python 库（python-docx、openpyxl、python-pptx 等）；
- 操作技能使用 Node 与 LibreOffice Kit CLI；
- 技能加载时校验解释器与 CLI 路径，缺失会阻止注册或让步骤不可用；
- `present` 把成品登记为交付物，Web 侧显示文件卡片。

**源码没有内置 Excel 分析器**：数据计算由模型写脚本（bash + python）或直接算，依赖宿主环境是否具备 Python 与对应库。这一条属于「需组合」，不要在成品中写成默认能力。

## E · 网页搜索与研究

- `web_search` / `web_fetch` 只依赖 `ctx.web` 抽象；
- DeepSeek 搜索与 HTTP 抓取是随附 provider，需要凭据/网络；
- 没有可用 provider 时返回结构化 `WebError`，模型可以改抓取或告知用户；
- 没有内置「研究状态机」：多轮搜索由模型决定；
- 引用链接来自抓取结果，源码不额外生成引用索引。

## F · Subagent

- 父 Agent 调 `subagent` 工具委派；子 Agent 有独立 Session、独立工具与模型；
- 父 Agent 通过 `tool/result` 拿回子 Agent 最终文本；
- `send_message` / `wait_agent` / `interrupt_agent` 支持异步协作；
- Agent Teams 额外提供共享任务板（`team_task_*`）；
- 子 Agent 的完整过程不复制进父会话。

## G · 后台任务

- `bash` 的 `run_in_background` 把命令交给 `ctx.jobs`，立即返回 job id；
- `job/registered` 写日志；运行期视图在内存；
- 模型可继续别的步骤或结束 Turn；
- `job_output` 按游标读增量，`job_kill` 请求终止；
- 完成可通过 `agent.inject()` 通知模型。

进程硬退出可能缺 `job/settled`，文档明确要求消费方不要虚构结束时间。

## H · 异常与中断

| 分支 | 行为 |
| --- | --- |
| 模型请求失败 | `assistant/attempt` → `agent/request-error`；监听器 retry 才重试 |
| 网络中断 | 同上，是否重试由 retryPolicy / llm-retry 决定 |
| 工具执行异常 | pipeline 捕获为 `isError` 结果，不是进程崩溃 |
| 参数错误 | schema 校验在调用前拒绝 |
| 权限拒绝 | pre-execute deny / 审批拒绝 → `isError` |
| 用户取消 | 清空 inbox、abort；已流出文本以 `interrupted: true` 结算 |
| Agent 中断 | 子 Agent 由 `interrupt_agent` 中断，作用域限于自己的后代 |
| Session 恢复 | 打开 JSONL、补中断轮次、从日志继续 |
| 插件初始化失败 | 回滚已准备资源，发 `session/disposed` |
| 插件卸载 | 注册随 fiber 撤销；进行中批次仍由选中执行器结算 |
| 输出不完整 | `max-tokens` 粘性；被取消的流保留前缀 |

## 源码位置

- `packages/core/agent-loop/src/agent.ts:435,548,584`
- `packages/core/tools/src/pipeline.ts:190,280,436`
- `packages/fs/fs/src/index.ts:66,74,92`
- `packages/jobs/jobs/src/types.ts:179`
- `packages/subagent/subagent/src/index.ts:451`
- `packages/skill/skill-office/README.zh.md`
- `packages/web/web/src/index.ts`
