# STARTUP_FLOW · 项目启动流程

> 以 `dsh web` 为例；Headless / SDK / ACP 共用同一条 launcher，只是 profile 的 bundle 不同。所有行号来自本地源码。

## 0. 入口

`apps/cli/src/bin.ts:26` `runCli()`：

1. `getDshRuntimeVersion()` 读取版本；
2. `parseDshArgs(process.argv.slice(2), version)`（`apps/cli/src/args.ts:146`）解析出 `{ mode: 'profile', profile: 'web', patches: [] }`；
3. `mode === 'profile'` 时动态导入 `profile-boot.ts`，调用 `runProfile()`。

`dsh`、`dsh web`、`dsh --profile web` 等价；`plugin`、`dump-config`、`dump-config-schema` 是另外三个 mode。

## 1. 环境与代理

`profile-boot.ts:276` 在**第一个插件挂载之前**执行 `installProxyFromEnvironment()`：Node 的 fetch 不会自己读代理环境变量，所以代理必须在 launcher 层安装。环境值来自 `loadLayeredEnv('dsh')`（`bin.ts:36`）的不可变快照。

同时注册 SIGTERM/SIGINT、`installFailLoud` 与有界关闭控制器。

## 2. Profile 解析

`prepareProfile()`（`profile-boot.ts:194`）：

- `loadProfile('dsh', name, INSTALL_ANCHOR, ...)` 读取 `$DSH_HOME/profiles/web`；
- `reportSkippedBundles()` 报告被跳过的 bundle；
- **每次启动都把根 `cordis.yml` 重写为空数组**。根配置只是 Loader 的 include 锚点；整棵树由 patch 长出来，避免 Loader 回写把组合行固化。

profile 的 bundle 列表来自 `package.json` 的 `dsh.profile.bundles`。随附模板（`packages/util/official-bundles/src/bundles.ts:10`）：

```ts
web:        [dsh-base, dsh-web-app]
headless:   [dsh-base, dsh-headless]
sdk:        [dsh-base, dsh-sdk-app]
acp:        [dsh-base, dsh-acp-app]
sdk-minimal:[dsh-sdk-minimal]      // 不叠 base
```

## 3. Patch 叠层

`composeProfile()`（`profile-boot.ts:224`）按固定顺序组合：

1. profile 中列出的 bundle 层（按列表顺序）；
2. profile 自己的 `cordis.patch.yml`；
3. `$DSH_HOME/cordis.patch.yml`（机器级偏好，优先级高于 profile 层）；
4. `--patch` overlay（argv 顺序）；
5. 遥测开关。

同一条 patch 的语义：

- `- id: X` → 找到 X 行并用新 config **整份替换**；
- `- insert:` → 新增行；
- `disabled:` 支持 `!!js` 表达式，运行时求值。

`createRuntimeResolution()`（`packages/boot/app-boot/src/profile.ts:386`）在导入任何插件之前解析安装位置，避免边导入边解析。

## 4. 创建 Cordis 根上下文

`boot()`（`packages/boot/app-boot/src/index.ts:1200`）：

1. 创建根 Context；
2. `ctx.plugin(Loader)`；
3. 执行调用方 prepare 回调（`profile-boot.ts:323`）：
   - `hostCtx.provide('profileContext', ...)`；
   - 提供不可变的 launch environment；
   - `hostCtx.plugin(PluginPackages, { resolution })`；
   - `provideCmdline(...)`；
4. `mountRootInclude()`（`:738`）把 `cordis.yml` + patches 编译成 include 条目；
5. `await ctx.loader.await()` 等整棵树收敛。

## 5. Loader 挂载

Loader 不是按行顺序挂载：条目并发加载，**由服务可用性驱动激活**。例如 `web-startup` 注入 `cmdlineArgs`，`webserver` 需要 `webStartup`，`session-controller` 需要 `connection` 与 `agents`。

这也是为什么「行顺序」在 patch 文件里没有加载语义，只是给人分组阅读的。

## 6. 就绪

`runProfile()` 在 `boot()` 返回后检查：

```ts
if (!signalShutdown.signal.aborted
  && ctx.fiber.state === FiberState.ACTIVE
  && ctx.get('loader') !== undefined) {
  appReady.commit()
}
```

此时 Web 的 webserver 已监听，浏览器可以连；Headless 的 runner 已拿到 stdin/`--task`；SDK 的 JSON-RPC 服务器开始读请求。

## 7. 失败路径

- 任一插件加载失败 → `StartupError` → `reportStartupFailure()` 打印结构化诊断，进程退出 1；
- `boot()` 失败 → 已挂载资源 dispose，`runProfile` 抛错；
- 代理安装、profile 初始化、resolve 失败都在插件挂载前失败，避免半启动状态。

## 启动期容易误读的点

| 误读 | 实际 |
| --- | --- |
| 「行顺序就是启动顺序」 | 并发挂载，服务依赖决定激活顺序 |
| 「根 cordis.yml 是配置源」 | 它每次被重写为空数组，配置来自 patch |
| 「patch 会合并 config」 | 整份替换；写漏 key 就回落默认值 |
| 「每种模式有独立 main」 | 同一个 launcher，只换 profile |

## 源码位置

- `apps/cli/src/bin.ts:26`
- `apps/cli/src/args.ts:146`
- `apps/cli/src/profile-boot.ts:194,224,271,323`
- `packages/boot/app-boot/src/index.ts:738,1200,1224,1233`
- `packages/boot/app-boot/src/profile.ts:386,728`
- `packages/util/official-bundles/src/bundles.ts:10`
