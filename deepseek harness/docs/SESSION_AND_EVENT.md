# SESSION_AND_EVENT · 会话日志、事件与持久化

> 依据：`packages/core/session/src/index.ts`、`types.ts`、`surface.ts`、`packages/session/session-persistence-jsonl`、`packages/session/session-projection`、`docs/subsystems/session.zh.md`。

## 1. 核心原则：模型可见即已记录

每个模型请求都必须能由 Session 日志重建。实现方式：

- 每个请求由 `session.deriveMessages()` 投影，而不是循环里的消息数组；
- 新增模型可见输入必须新增 Session 事件；
- 请求里的 `request/header` + `deriveMessages()` + `request/toolHistory` 足以重建一次调用。

## 2. 事件类型

`SessionEventMap`（`packages/core/session/src/types.ts:287`）定义核心 14 个事件：

| 事件 | 作用 |
| --- | --- |
| `turn/start` / `turn/end` | 轮次边界与结束原因 |
| `step/start` / `step/end` | 步骤边界 |
| `system/message` | 渲染后的系统提示词 |
| `developer/message` | 工具增删等增量变更 |
| `user/message` | 用户输入 / 注入上下文 / 目标续跑 |
| `assistant/message` | 模型输出 + 内嵌 stream + usage |
| `assistant/attempt` | 未产生可见消息的失败/重试/取消尝试 |
| `tool/call` / `tool/result` | 工具调用与结果 |
| `request/header` | 完整请求信封（log-only） |
| `request/context` | 路由与上下文窗口（log-only） |
| `session/end-seed` | 继承/恢复边界 |

插件通过声明合并扩展：当前共 **63 个 Session 事件**（核心 14 + 插件 49），例如 `agent/inbox/spliced`、`compaction/*`、`job/registered`、`todo/write`、`team/task`。

`SessionEvent<T>` 是判别联合（`types.ts:501`），`surfaceOp` / `sourceEventSeqs` 只出现在消息事件上；`ignorable` 标记可安全跳过的信息性记录。

## 3. 写入路径

`session.append(type, data, intent?)`（`index.ts:806`）：

1. 检查 Session 已进入 Store 且完成 `session/created`；
2. `snapshotJsonValue` 做无损 JSON 快照（函数、BigInt、循环引用等直接拒绝）；
3. 生成 `{ type, seq, time, data }` 并深冻结；
4. 校验事件数据与 surface 契约；
5. `commit()`（`:892`）：推入 log，同步通知 `session/event` 监听者（每个监听器隔离失败）。

append 返回的事件包含**已快照的 data**，调用方之后修改原对象不会影响日志。

## 4. Surface：从事件到模型历史

- 只有 5 种「消息事件」进入 surface：`system/message`、`developer/message`、`user/message`、`assistant/message`、`tool/result`。
- `surfaceOp: 'append'` 追加；`{ op: 'replace', startSeq, endSeq }` 替换区间（压缩使用）。
- `deriveMessages()`（`:999`）按 surface 节点增量投影，返回冻结消息数组。
- `contentGeneration` 在替换时变化，触发缓存重建。

**压缩不删日志**：被遮蔽的事件仍在 log 里，只是不再进入模型历史。

## 5. 请求头与工具历史

- `requestHeader()` 折叠 `request/header` 得到当前 `EpochHeader`（config + tools）。
- `request/context` 不参与重建，只是路由快照。
- `toolHistory()` 提供工具声明与增删，供 provider 投影。

## 6. 持久化：JSONL + zstd

`session-persistence-jsonl`：

- 默认 `compression: 'zstd'`（`src/index.ts:69`），文件形如 `session.vN.jsonl.zstd`；
- 一帧一个批次（header frame + 后续 batch frame）；
- generation 选择：取数值最高的规范 generation；
- 写 open 先编码、校验，再在旁边**排他发布**当前版本名；
- 已提交 generation 路径绝不重命名/替换/删除；
- 相邻迁移包负责 `vN → vN+1`，一次一步；
- 读取时只解码并组合一次构建时静态确定的迁移链。

会话消费方只了解当前逻辑格式；header 级 `stat`/`list` 不加载事件。

## 7. 崩溃恢复

- 轮次中途崩溃会留下未闭合的 `turn/start`；
- resume 打开写句柄后，把 `interruptedTurnClosers` 作为普通批次追加，补上 `turn/end`；
- 只有后续 `turn/start` 已经封住一种有限 restart 时，迁移才会插入缺失的 interrupted `turn/end`；
- 普通中断尾部仍由句柄消费方修复。

## 8. 投影

`packages/session/session-projection` 把已提交事件折叠成客户端视图（inbox、todo、goal、子 Agent 等）。投影是只读派生，不回写日志；每个投影单元带序号水位。

`AgentRegistry` 通过 `turnBoundaryOf(session)` 提供轮次/步骤状态。

## 9. fork、恢复、回放

- fork：复制到精确事件前缀，子会话带 `session/end-seed { inherited: true }`；未闭合的边界会插入合成 closer（`forked`）。
- 恢复：重新打开同一 Session，日志就是状态；Agent 不反序列化。
- 回放：`assistant/message` 内嵌紧凑 stream，能重放一次输出的过程；实时 `agent/assistant-stream` 不持久。

## 10. 内存 vs 磁盘

| 数据 | 位置 |
| --- | --- |
| turn/step、消息、tool/call/result、request/header/context | Session 日志（可持久化） |
| `agent/*` 实时事件、assistant-stream 帧 | 进程内存 |
| job 运行期视图 | 内存；`job/registered` / `job/settled` 写日志 |
| 投影快照 | 内存，可由日志重建 |
| SQLite FTS 索引 | 可选缓存，不是事实来源 |

## 源码位置

- `packages/core/session/src/index.ts:525` Session、`:806` append、`:892` commit、`:999` deriveMessages
- `packages/core/session/src/types.ts:287` SessionEventMap、`:501` SessionEvent
- `packages/core/session/src/surface.ts` surface 管理
- `packages/session/session-persistence-jsonl/src/index.ts:69`
- `packages/session/session-projection/src/index.ts`
