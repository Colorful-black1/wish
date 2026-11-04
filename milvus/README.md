# Milvus × RAG 执行链路 · 一条查询，穿过 Milvus 的十站

> 状态：**已兑现**。`index.html` 是可直接双击打开的单文件成品（约 341 KB），零外部请求。
> 许愿原文见 [`提示词.md`](提示词.md)；事实底座见 [`research/`](research/SOURCES.md)。

## 这是什么

一张「带调试器的执行追踪图」：给一句提问，从应用侧切分、向量化、建模、建索引、写入，一路走到 Milvus 的 Proxy / Streaming Node / Query Node，再回到应用侧重排与生成。

- **两条链路**：阶段 A 写入（站 1–5）、阶段 B 查询（站 6–10）。
- **十站**，每站固定四块：应用侧做了什么 / 请求走到了哪 / 返回了什么 / 动手改。
- **两条泳道**：应用侧（蓝）与 Milvus 侧（青），Milvus 侧再分接入、执行、存储三层。
- **参数一改就重算**：块大小、维度、索引参数、一致性、limit、ef / nprobe、过滤时机、融合权重、重排、预算与拒答阈值。
- **状态可分享**：站点与参数写进 URL hash，刷新可还原。
- **零外部请求**：不引 CDN、字体、图片；官方文档链接只在点击时新开标签页。

首屏给三句边界：

1. Milvus 存向量、建索引、做检索与融合，**不生成 embedding，也不写答案**。
2. 写入走 Streaming Node 与 WAL，查询走 Query Node 与对象存储，两条路在 Proxy 汇合。
3. 过滤、混合检索、重排是三种不同的能力。

## 怎么打开

```
双击 milvus/index.html
```

`file://` 下即可运行，无需 Node、无需服务器、无需联网。键盘：`←/→` 换站，`1–9` / `0` 直达，`空格` 自动演示，`Esc` 关闭浮层。

## 数字口径：哪些真算，哪些示意

| 类别 | 项目 | 位置 |
| --- | --- | --- |
| **真算** | 块数、长度分布、实测重叠、元数据覆盖 | 站 1 |
| **真算** | 余弦 / 内积，归一化前后的排序对照 | 站 2、`engine.embed.js` |
| **真算** | BM25 的词元、df、IDF、单条得分 | 站 9、`engine.bm25.js` |
| **真算** | 真实构建的 HNSW 图 / IVF 倒排，访问点数、recall@k、内存估算 | 站 4、`engine.hnsw.js` |
| **真算** | 三级归并：段 → Query Node → Streaming Node → Proxy | 站 7、`engine.pipeline.js` |
| **真算** | pre-filter / post-filter 的结果数与命中率 | 站 8 |
| **真算** | WeightedRanker 的 min-max 加权、RRF 名次、重排置信度 | 站 9–10、`engine.fuse.js` |
| **真算** | token 估算、上下文预算截断、引用命中、拒答判断 | 站 10 |
| **示意** | 分布式调度、网络跳数、WAL 落盘 / sealed / 建索引 / 加载耗时 | 站 5 时间线；右上角「示意」徽章与 ⓘ |
| **示意** | 真实 QPS、延迟、内存曲线 | 不画曲线；只给公式与量级假设 |
| **示意** | 演示向量与真实 embedding 的差距 | 站 2 徽章、ⓘ、本文「示意向量」一节 |
| **示意** | 官方 benchmark 倍数（2–5x、30%–70%） | 仅在出处说明中出现，明确「官方 benchmark，非本页实测」 |
| **示意** | 答案文本、重排模型的真实行为 | 站 10；答案由检索片段按模板拼接 |

页脚「口径汇总」列出同一份清单；每站右上角徽章标注该站数字的性质。

## 示意向量怎么构造（不是真实 embedding）

`engine.embed.js` 生成的是**确定性示意向量**：

1. **概念轴**：`data.corpus.js` 里的 8 个概念（保留 / 计费 / 索引 / 部署 / 权限 / 故障 / 检索 / 写入）各有一个固定随机单位向量作为中心。
2. **概念激活**：文本命中概念词表时，按词权重与出现次数叠加对应概念中心。
3. **词元哈希**：每个词元（中文二元组 / 英文整词）哈希到若干维度，权重 0.30；精确编号权重压到 0.08。
4. **可复现噪声**：以文本哈希为种子，给每个维度加 ±0.0275 的确定性噪声。
5. **维度**：先生成 1024 维，再按页面维度截断；归一是可选项，COSINE / IP 都基于同一批向量计算。

因此：同主题的块会靠近，同一段文本永远得到同一个向量；但**图上的距离不代表语义真值**。站 2 的「VX-2048」演示刻意利用了示意向量只编码概念、不编码精确编号的弱点，真实 embedding 模型的行为不同，不要把它当成模型评测。

## 语料与预设问题

`data.corpus.js` 是**虚构**的《VectorOps 向量库产品知识库》（部署规格、索引选型、权限与加密、计费与配额、故障码手册），不是 Milvus 官方文档。每条语料带 `source / dept / version / updated / acl`，站 8 的过滤直接使用它们。

默认参数（120 字块 / 40 字重叠 / 按标题切）下是 **32 个块、1024 维、5 篇文档**。首屏统计、过滤计数、Top-k 数量都由数据实时计算，没有写死。

6 个预设问题分别验证：语义改写、精确编号、跨文档、权限（acl=finance）、无答案（拒答）、时间条件（updated ≥ 2026-01-01）。

## 事实底座与出处

- 来源：`https://milvus.io/docs/zh/<page>.md`，抓取于 **2026-11-03**；文档版本 **3.0.x**。抓取正文与逐条核对记录在 [`research/`](research/)。
- 抓 `/docs/zh/...` 时返回的是**英文正文**（`<html lang="en">`，正文零中文字符），所以 `research/` 是英文；界面中文文案为另写，`hybrid_search`、`SPARSE_INVERTED_INDEX`、`efConstruction`、`consistency_level` 等 API / 参数 / 枚举保留英文原文。
- 页面用到的关键事实：四层架构与三类 Worker Node、Search/Insert 两条数据流、三级归并、四档一致性、BM25 Function、`SPARSE_INVERTED_INDEX` + `MetricType.BM25`、`AnnSearchRequest` + `hybrid_search` + `WeightedRanker`、过滤发生在检索链路、多租户隔离粒度（database / collection / partition / partition key）。
- **没有出处的数字不写**：M / efConstruction / nlist 的官方默认值与范围未在本目录逐项核对，页面因此把这三项标为「页面示例值」，并链接官方 Index 文档；四档一致的秒数标为页面模型值，精确定义链接 Consistency Level 页。
- 官方 benchmark 的 2–5x、30%–70% 只在说明里作为「官方口径」提及，不当成本页实测。

## 目录与构建

```
milvus/
  index.html            构建产物，双击可开；不要手改
  dev.html              开发入口，外链 src/
  src/css/              base / layout / sections / canvas
  src/js/
    data.corpus.js      5 篇虚构语料 + 概念词表 + 元数据
    data.questions.js   6 个预设问题 + 默认拒答阈值
    data.milvus.js      十站文案、索引对照、一致性、隔离粒度、片段与出处
    engine.text.js      分词、文档拼装、切分、统计
    engine.embed.js     示意向量、余弦/内积/投影
    engine.bm25.js      BM25 打分与解释
    engine.hnsw.js      FLAT / HNSW / IVF_FLAT / DISKANN（简化）检索
    engine.fuse.js      加权 / RRF / 重排 / token 估算 / 答案拼接
    engine.pipeline.js  缓存与参数编排
    ui.*.js             控件、表格、泳道、时间线
    stages.*.js         十站各自的渲染与交互
    app.js              导航、hash、键盘、自动演示、页脚
  tools/
    build.mjs           内联 CSS/JS → index.html
    selftest.mjs        42 项引擎断言
    qa.mjs              无头 Chrome 冒烟 + 截图 + qa/report.json
  research/             官方文档抓取正文与 SOURCES.md
  qa/report.json        最近一次验收留痕（截图不入库）
```

在 `milvus/` 内执行（`build.mjs` 使用 `process.cwd()`）：

```powershell
node tools/build.mjs
node tools/selftest.mjs
node tools/qa.mjs
```

环境：Node.js 18+；QA 需要本机 Chrome 或 Edge。

## 验收记录

2026-11-04 跑通：

- `node tools/build.mjs`：0 个剩余外部引用，产物约 341 KB。
- `node tools/selftest.mjs`：42 项断言全部通过（切分统计、COSINE/IP 排序、BM25、HNSW/IVF recall、三级归并、过滤、融合、拒答、预算）。
- `node tools/qa.mjs`：十站均渲染 4 个区块；`consoleErrors` / `failedRequests` / `pageErrors` 为空；1440px 与 390px 均无横向溢出；参数联动（块大小、ef、融合权重、过滤时机、预算、阈值）、hash 还原、引用跳转、维度报错、模态框焦点归还均通过。

验收清单（对应 `提示词.md` 第十节）：

- [x] 十站齐全，每站都有「应用侧 / 请求路径 / 返回结构 / 动手改」四块。
- [x] 站 5 插入流程与站 7 查询流程的节点名与顺序和 `architecture_overview.md` 一致。
- [x] 站 3 字段表含 `enable_analyzer`、BM25 Function、`SPARSE_INVERTED_INDEX` 与 `MetricType.BM25`。
- [x] 站 9 的 `hybrid_search` + `AnnSearchRequest` + ranker 调用方式与 `hybrid-search.md` 一致。
- [x] 站 8 能演示「后过滤把结果筛空」。
- [x] 每处「示意」都有 ⓘ 与徽章，页脚有汇总表。
- [x] 抽查 `ef`（访问点 21 → 34、recall 0.4 → 1.0）、`limit`、ranker 权重，数字确实变化。
- [x] 首屏统计与数据条目一致（5 篇 / 32 块 / 1024 维 / 10 站）。
- [x] URL hash 能还原站点与关键参数。
- [x] 快捷键、浮层 Esc、焦点归还、390px 无横向滚动。
- [x] `file://` 直接打开可用，控制台无报错。

## 已知边界

1. **语料只有 32 块**，HNSW 图相对稠密；默认 `ef=64` 时 recall 容易饱和。把 `ef` 调到 8、把 `M` 调小，或切到 IVF 并把 `nprobe` 调到 1，才能看到召回下降。这是小语料的必然结果，不是 HNSW 在真实规模下的表现。
2. **DISKANN 是简化模型**：页面用 HNSW 图 + 8 位标量量化距离遍历、再对候选做全精度重排；真实 DiskANN 是 Vamana 图 + PQ，图存放在磁盘。页面与 README 都标注了这一点。
3. **ACL 是单值 VARCHAR**：演示表达式为 `acl == "finance"`；真实多值授权通常用 ARRAY 字段与数组操作符，具体写法以官方文档为准。
4. **token 数是估算**：1 个汉字约 1 token、1 个英文词约 1.3 token，不是真实 tokenizer。
5. **答案不是 LLM 生成**：由检索片段按模板拼接；拒答与硬答都是页面逻辑，不联网、不调用任何模型。默认拒答阈值 **0.45** 是按示例语料标定的页面值，不是 Milvus 默认值。
6. **耗时全是模型值**：站 5 的时间线、站 4 的构建耗时、站 7 的分布，都不是实测。
7. **hash 较长**：为可还原，所有参数都写入 URL；分享时直接复制完整 hash 即可。
8. **WeightedRanker / RRF 是页面实现**：加权为每路 min-max 归一化后求和；RRF 取 `k=60`（常见取值，非官方默认）。官方公式以文档为准。

## 版权与免责

- 语料《VectorOps 向量库产品知识库》为虚构内容，与 Milvus / Zilliz 无关，不构成任何产品说明或报价。
- `research/` 中的官方文档版权归 Milvus / Zilliz 及贡献者所有（Apache-2.0），此处仅用于事实核对与学习引用。
- 页面为个人学习用途的非官方演示，与 Milvus / Zilliz 无隶属关系；Milvus 与 Zilliz 是各自权利人的商标。



