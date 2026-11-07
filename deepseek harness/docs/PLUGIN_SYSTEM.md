# PLUGIN_SYSTEM · 插件、Profile、Bundle 与 Patch

> 依据：`docs/architecture.zh.md`、`docs/cordis-primer.zh.md`、`packages/boot/app-boot`、`packages/bundle/*/cordis.patch.yml`、`packages/util/official-bundles/src/bundles.ts`。

## 1. Cordis 的三个概念

- **Context**：服务容器 + 事件总线 + 生命周期作用域；
- **Service**：`ctx.<key>` 形式的共享能力（`ctx.sessions`、`ctx.tools`、`ctx.llm`…）；
- **副作用**：`ctx.plugin()`、`ctx.on()`、`ctx.effect()` 注册的一切都绑定到插件 fiber，卸载时自动撤销。

因此产品没有「必须打补丁的内核」：任何能力都可以被另一个插件替换。

## 2. 五层组装

| 层 | 是什么 | 位置 |
| --- | --- | --- |
| Profile | 具名组装：bundle 列表 + 用户 patch + 树外插件 | `$DSH_HOME/profiles/<name>/` |
| Bundle | 一组带 id 的配置行；可被上层覆盖 | `packages/bundle/*/cordis.patch.yml` |
| Patch | 按 id 替换整份 config，或 insert 新行 | profile/home/`--patch` |
| Preset | Agent 级组合，在 `config.plugins` 内应用同样的 patch | `packages/preset/agent-preset-registry` |
| Plugin Manager | 运行时启停/安装/卸载，改动立即生效 | `packages/boot/plugin-manager` |

## 3. 叠层顺序

`composeProfile()`（`apps/cli/src/profile-boot.ts:224`）：

```text
bundle 列表（按 dsh.profile.bundles 顺序）
  → profile/cordis.patch.yml
  → $DSH_HOME/cordis.patch.yml
  → --patch overlay（argv 顺序）
  → 遥测开关
```

优先级：后者覆盖前者。`preset` patch 在目标行声明的 `config.plugins` 里再走一遍同样的优先级。

## 4. Patch 语义

```yaml
- id: tool-fs            # 找到这一行
  config: {...}          # 整份替换（不是合并）
- insert:
    - id: my-plugin
      name: '@scope/pkg'
```

- 行顺序**没有加载语义**：Loader 并发挂载，按服务依赖激活；
- `disabled:` 支持 `!!js` 表达式，在挂载时求值；
- 根 `cordis.yml` 每次启动被重写为空数组，组合只来自 patch。

## 5. 随附 Bundle 规模

| Bundle | 行数 | 作用 |
| --- | --- | --- |
| `dsh-base` | 99 | 模型、工具、持久化、沙箱、审批、设置、凭据、遥测 |
| `dsh-web-app` | 97 | webserver、gateway、session-controller、全部 client-ui-* |
| `dsh-headless` | 2 | headless-startup + headless-runner |
| `dsh-sdk-app` | 14 | JSON-RPC 服务器与 SDK 专用行 |
| `dsh-acp-app` | 2 | ACP 服务器 |
| `dsh-sdk-minimal` | 37 | 独立显式配置树，不叠 base |
| **合计** | — | base-backed profile = 99（含被覆盖行）+ 模式行；sdk-minimal = 37 行 |

> 行数来自 patch 文件里 `- id:` 的计数；同一行可能被上层覆盖，实际激活数还取决于 `disabled` 表达式。

## 6. 生命周期

1. **Profile 解析**：读取 profile 目录与 `dsh.profile.bundles`；
2. **Patch 叠层**：组合有序 patch 列表；
3. **Loader 挂载**：条目并发加载，插件 `inject` 的服务就绪后 apply；
4. **插件 apply**：注册服务、工具、事件监听、UI 槽位；
5. **HMR**：对比新旧配置树，只重载变化条目；
6. **运行时启停**：plugin_manager 可启停/安装/卸载。

## 7. 插件能扩展什么

| 目标 | 机制 |
| --- | --- |
| 模型 provider | 在 `ctx.llm` 注册适配器 |
| 面向模型的能力 | 在 `ctx.tools` 注册工具；schema 自动进入提示词 |
| 某个会话的独立能力集 | Agent preset + `isolate` realm |
| Shell 后端 | 注册 `ctx.shell` |
| 文件系统/策略 | 注册 `ctx.fs` 或监听 `fs/*` |
| 进程限制 | `ctx.sandbox` 后端，消费方在 spawn 前包装 argv |
| 拦截请求/工具/轮次 | `agent/*` / `tools/*` 事件 |
| UI 扩展 | 客户端插件注册 slot / 渲染器 |
| 持久会话状态 | 扩展 `SessionEventMap`，从日志渲染与回放 |

## 8. 设计取舍

- **注册即副作用**：卸载插件 = 撤销它做过的一切；不需要手工清理表。
- **path 不合并 config**：每一行的最终值只有一个来源，避免多层 merge 的不可推理。
- **行顺序无意义**：把「加载顺序」从配置文件里拿掉，交给服务依赖图。
- **Agent 也能有独立组合**：preset 在单行 config 里做同样的 patch，并用 isolate realm 隔离服务实例。

## 9. 当前源码中未发现

- 插件之间没有「优先级数字」或显式依赖排序；依赖通过服务注入表达。
- 没有全局的插件沙箱：插件在同一个 Node 进程里，权限边界靠 sandbox/approval seam 而非插件隔离。

## 源码位置

- `packages/boot/app-boot/src/index.ts:1200` boot、`:1224` Loader
- `apps/cli/src/profile-boot.ts:194,224,323`
- `packages/util/official-bundles/src/bundles.ts:10`
- `packages/boot/plugin-manager/src/types.ts:424`
- `packages/preset/agent-preset-registry/src/types.ts:66`
- `packages/boot/hmr/src/index.ts:35`
