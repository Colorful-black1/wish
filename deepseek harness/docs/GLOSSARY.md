# GLOSSARY · 术语表

> 生成物：由 `tools/generate-docs.mjs` 从 data/*.json 生成，请勿手改。分析对象 0.2.2-rc.1（commit fcc0ad4）。

| 术语 | 一句话解释 | 打个比方 | 源码位置 |
| --- | --- | --- | --- |
| **Cordis** | 插件框架：所有能力都挂在共享上下文里，卸载插件就撤销它注册的一切。 | 像乐高底板：每块积木自己声明要插在哪些凸点上，拔掉就干净了。 | `docs/cordis-primer.zh.md:1` |
| **Context / ctx** | 服务容器 + 事件总线 + 生命周期作用域。 | 一个工具箱，谁需要什么就从里面取，工具用完会放回。 | `vendor/cordis/src/index.ts:1` |
| **Profile** | 一套具名组装方案，列出要叠哪些 bundle。 | 游戏的不同「模式」预设。 | `packages/util/official-bundles/src/bundles.ts:10` |
| **Bundle** | 一组带 id 的配置行，可被上层覆盖。 | 一份可编辑的默认配置模板。 | `packages/bundle/base/cordis.patch.yml:1` |
| **Patch** | 按 id 替换整份 config，或 insert 新行。 | 改配置是「整行替换」，不是「逐字段合并」。 | `packages/boot/app-boot/src/index.ts:536` |
| **Turn（轮次）** | 从领取第一条输入到不再欠工作的一个回合。 | 一次完整的「提问—处理—回答」。 | `packages/core/agent-loop/src/agent.ts:327` |
| **Step（步骤）** | 一次模型请求加它请求的工具。 | 回合里的一个动作：想一下，做个工具，再想一下。 | `packages/core/agent-loop/src/agent.ts:435` |
| **Inbox** | Agent 的待处理消息队列，分 next-turn 与 next-step，且持久化。 | 收件箱 + 加急件两个格子。 | `packages/core/agent-loop/src/inbox.ts:21` |
| **SessionEvent** | 会话日志中的一条不可变记录，模型看到的一切都必须能由它重建。 | 只写不改的流水账。 | `packages/core/session/src/types.ts:501` |
| **Surface** | 从事件日志投影出的模型可见消息序列；压缩用 replace 遮蔽旧节点。 | 同一本流水账，对外只展示其中一页页正文。 | `packages/core/session/src/surface.ts:1` |
| **Waterfall 事件** | 洋葱式拦截：监听器必须调用 next() 才继续，可以改写参数或结果。 | 中间件。 | `packages/core/tools/src/events.ts:18` |
| **Serial 事件** | 顺序执行、没有 next()，任一监听器可以抛错终止。 | 登机前的最后检查。 | `packages/core/agent/src/runtime-types.ts:417` |
| **Seam** | 可替换能力：接口 + 提供方 + 消费方。 | 插座：换插头不影响电器。 | `docs/capability-seams.zh.md:1` |
| **Adapter** | 把某家 provider 的协议翻译成统一的 StreamChunk。 | 电源转换插头。 | `packages/llm/llm/src/index.ts:208` |
| **Tool Schema** | 给模型看的工具名、说明与参数 JSON Schema。 | 菜单上的菜名、介绍和可选配料。 | `packages/llm/llm/src/types.ts:517` |
| **Prepared Call** | 把一次模型调用的适配器代际与配置一起绑定，只能派发一次。 | 已经盖章的登机牌，不能换航班再用。 | `packages/llm/llm/src/index.ts:169` |
| **Projection** | 把已提交事件折叠成客户端/服务消费的快照视图。 | 从流水账实时算出的仪表盘。 | `packages/session/session-projection/src/index.ts:1` |
| **Subagent** | 独立 Session 上的另一个 Agent，由父 Agent 通过工具委派。 | 把子任务外包给同事，拿回一份结果。 | `packages/subagent/subagent/src/index.ts:451` |
| **Job** | 后台任务：注册、读取输出、终止；完成可通知模型。 | 洗衣机：启动后可以去干别的。 | `packages/jobs/jobs/src/types.ts:179` |
| **Sandbox** | 执行世界的权限边界，fs 与进程共享同一套策略。 | 给执行环境画的护栏。 | `packages/sandbox/sandbox-policy/src/session-mode.ts:25` |
| **PTC** | Programmatic Tool Calling：模型写代码来编排工具调用。 | 与其一步步点按钮，不如写个脚本。 | `packages/core/tool-executor-ptc/src/types.ts:31` |
| **ACP** | Agent Client Protocol，编辑器/自动化平台接入 Agent 的协议。 | Agent 世界的 USB-C。 | `packages/acp/acp/src/index.ts:361` |
