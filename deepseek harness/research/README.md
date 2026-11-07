# research · 抽取口径与快照

这个目录记录「事实是怎么来的」，方便复核。

## 文件

- [`source-facts.md`](source-facts.md)：抽取时间、源码 commit、来源生成文档的 SHA-1 指纹、抽取结果计数。
- `data/generated.json`（不在本目录，因页面直接消费）：完整抽取结果，包括包清单、90 个事件、35 个工具包、63 个 Session 事件、33 段代码。

## 抽取脚本

`tools/extract-source-facts.mjs` 只读本地源码，做机械抽取：

| 数据 | 来源 |
| --- | --- |
| 包清单 / 版本 / description | `packages/*/*/package.json`、`apps/*/package.json` |
| 事件矩阵 | `docs/event-producer-consumer.md`（生成物） |
| 模块 peer 边 | `docs/module-graph.md`（生成物） |
| base 插件行 | `apps/cli/composition.md`（生成物） |
| profile 模板 | `packages/util/official-bundles/src/bundles.ts` |
| 工具目录 | `docs/tool-catalog.md`（生成物） |
| Session 事件 | `packages/core/session/src/types.ts` + 各插件 `declare module` 合并 |
| 代码片段 | `tools/source-excerpts.json` 指定的行区间，原样切片 |

## 复核顺序

```powershell
node tools/extract-source-facts.mjs
node tools/verify-data.mjs
node tools/build.mjs
node tools/qa.mjs
```

`verify-data.mjs` 会检查 `data/*.json` 里每一个 `path` 与每一条边的 `ref` 是否真实存在；它不判断语义，只防路径漂移。

## 边界

- 抽取脚本不会修改源码仓库。
- 生成文档本身可能滞后于源码；页面上的版本号与 commit 来自实际 checkout，不来自文档。
- 未逐行分析的模块列在 `data/coverage.json`，不要用本目录的结果替代源码阅读。
