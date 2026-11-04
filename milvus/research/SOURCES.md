# 资料清单：Milvus 官方文档抓取

本目录保存写 `提示词.md` 时实际读过的原文，用于核对事实。界面上的每个 Milvus 行为，都应能在这些文件里找到依据；找不到依据的，页面必须写「以官方文档为准」并给出链接，不许编。

## 抓取信息

- 抓取时间：2026-11-03（Asia/Shanghai）
- 来源站点：`https://milvus.io/docs/zh/<page>.md`
- 文档版本：站点默认 **v3.0.x**（`milvus-io/milvus-docs` 仓库默认分支亦为 `v3.0.x`）
- 文档许可：`milvus-io/milvus-docs` 为 **Apache-2.0**，此处仅作事实核对与学习引用，版权归 Milvus / Zilliz 及贡献者
- 提取方式：页面为 Next.js 应用，正文在 `<script id="__NEXT_DATA__">` 的 `props.pageProps.homeData.tree` 里，提取后转成纯文本；**标题层级、表格和代码块格式有损**，引用细节以原文链接为准

## 一个必须先知道的事实

用 `/docs/zh/...` 抓下来的 7 个页面，`<html lang="en">`，正文里 **一个中文字符都没有**（CJK 计数为 0），`/docs/zh-hant/...` 同样返回英文。也就是说：**这份中文文档目前没生效，抓到的是英文原文**。

因此：

- 本目录里的文件是英文，这是抓取结果，不是漏翻；
- 页面上的中文文案需要自己组织，专有名词与 API 名保留英文原文；
- 如果之后中文版上线，应以中文版为准重新核对一遍术语。

## 文件对照

| 文件 | 原文地址 | 写提示词时用到的内容 |
| --- | --- | --- |
| `overview.md` | https://milvus.io/docs/zh/overview.md | 定位与边界：Milvus 是向量库，embedding 由应用侧提供；三种部署形态；支持的检索类型（ANN / 过滤 / 范围 / 混合 / 全文 BM25 / 重排 / Fetch / Query）；索引家族（FLAT、IVF、HNSW、DiskANN、SCANN、量化、mmap、GPU CAGRA）；Tiered Storage 2.6.4+；Text 类型 3.0+ 需要 Storage V3；多租户隔离粒度；RBAC/TLS |
| `architecture_overview.md` | https://milvus.io/docs/zh/architecture_overview.md | 四层架构（Access / Coordinator / Worker Nodes / Storage）；Streaming/Query/Data 三类节点的分工；WAL（Kafka、Pulsar、Woodpecker）；DDL/DCL→Coordinator、DML→Streaming、DQL→Query Node 的路径；**Search 与 Insert 两条完整数据流**；三级结果归并 |
| `build-rag-with-milvus.md` | https://milvus.io/docs/zh/build-rag-with-milvus.md | 官方 RAG 教程：`MilvusClient(uri=...)` 的三种连接方式、`create_collection(dimension, metric_type, consistency_level)`、`insert`、`search(limit, search_params, output_fields)`、context 拼接、LLM 生成；一致性四档取值（Strong / Session / Bounded / Eventually） |
| `create-collection.md` | https://milvus.io/docs/zh/create-collection.md | Schema 设计：主键、向量字段、标量字段、动态字段/JSON、`max_length`、默认值与 nullable 等建模取舍 |
| `index-explained.md` | https://milvus.io/docs/zh/index-explained.md | 索引解剖（数据结构 / 量化 / refiner）、容量-召回-性能三角、选型决策表、内存估算口径 |
| `full-text-search.md` | https://milvus.io/docs/zh/full-text-search.md | BM25 全文检索：`VARCHAR`/`TEXT` + `enable_analyzer=True`、BM25 Function 生成稀疏向量、`SPARSE_INVERTED_INDEX` 配 `MetricType.BM25`、插入与检索流程、稀疏字段不能直接 output 的限制 |
| `hybrid-search.md` | https://milvus.io/docs/zh/hybrid_search_with_milvus.md | 混合检索：`AnnSearchRequest` 组织多路请求、`hybrid_search`、`WeightedRanker` 加权融合、dense + sparse 结果对比 |

## 写提示词时逐条核对过的结论

1. **切分、Embedding、LLM 都不在 Milvus 里**：Milvus 只负责存储、索引、检索（全文 BM25 例外，由内置 Function 代劳）。页面必须把这条边界讲清楚。
2. **一次搜索的路径**：Client → 负载均衡 → Proxy（Access Layer，有路由缓存）→ Streaming Node（查 growing 数据）与 Query Node（从对象存储加载 sealed 数据）→ Query Node 归并各 segment → Streaming Node 再归并 → Proxy 最终归并 → 客户端。
3. **一次写入的路径**：Client → Proxy → Streaming Node → WAL 落盘 → 实时可查（growing）→ 段满后转 sealed → Data Node 做 compaction 与建索引 → 写对象存储 → Query Node 加载新索引。
4. **一致性级别影响「刚写进去的数据多久能被查到」**，不是影响正确性；四档为 Strong / Session / Bounded / Eventually。
5. **混合检索是两次 ANN + 一次融合**：`AnnSearchRequest` 分别描述 dense 与 sparse 两路，`hybrid_search` 再按 `WeightedRanker`（或 RRF）合并；RRF 的具体类名与参数以官方文档为准，本目录未覆盖到。
6. **元数据过滤发生在检索链路里**（filtering search），不是应用侧筛完再搜；写成后过滤会出「一条不剩」的事故。
7. 文档里出现的性能倍数（2-5x、30%-70%）来自官方 benchmark，页面若要引用，必须标注出处与口径，不能当成自己的实测。

## 复原方式

```powershell
# 只取正文，不做渲染；页面正文在 __NEXT_DATA__ 里
$r = Invoke-WebRequest -Uri 'https://milvus.io/docs/zh/overview.md' -UseBasicParsing
[System.IO.File]::WriteAllText("$env:TEMP\overview.html", $r.Content, [System.Text.UTF8Encoding]::new($false))
# 然后从 props.pageProps.homeData.tree 取出 HTML 正文，去标签即为本目录里的文本
```
