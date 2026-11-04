/* ==========================================================================
   data.milvus.js — 十站文案、Milvus 参数口径、出处与 PyMilvus 片段
   事实来源：research/ 下的 7 篇官方文档（Milvus 3.0.x，2026-11-03 抓取）。
   找不到出处的参数一律写「以官方文档为准」，页面默认值标为「本页示例」。
   ========================================================================== */
(function (root) {
  'use strict';

  var LINKS = {
    overview: { label: 'Milvus Overview', url: 'https://milvus.io/docs/overview.md' },
    architecture: {
      label: 'Architecture Overview',
      url: 'https://milvus.io/docs/architecture_overview.md'
    },
    rag: { label: 'Build RAG with Milvus', url: 'https://milvus.io/docs/build-rag-with-milvus.md' },
    create: { label: 'Create Collection', url: 'https://milvus.io/docs/create-collection.md' },
    index: { label: 'Index Explained', url: 'https://milvus.io/docs/index-explained.md' },
    fulltext: { label: 'Full Text Search', url: 'https://milvus.io/docs/full-text-search.md' },
    hybrid: { label: 'Hybrid Search', url: 'https://milvus.io/docs/hybrid-search.md' },
    consistency: {
      label: 'Consistency Level（文档外链，未收入 research/）',
      url: 'https://milvus.io/docs/tune_consistency.md'
    }
  };

  var VERSION = {
    doc: 'Milvus 3.0.x',
    crawled: '2026-11-03',
    note: '文档版本 3.0.x（2026-11-03 抓取）；参数默认值与取值范围以官方文档为准。'
  };

  var LANES = [
    {
      id: 'app',
      title: '应用侧',
      sub: 'APPLICATION',
      tone: 'app',
      nodes: [{ id: 'app', label: '应用进程', detail: '切分 · embedding · 重排 · 生成' }]
    },
    {
      id: 'access',
      title: 'Milvus 接入层',
      sub: 'ACCESS LAYER',
      tone: 'milvus',
      nodes: [{ id: 'proxy', label: 'Proxy', detail: '无状态 · 校验 · 最终归并' }]
    },
    {
      id: 'exec',
      title: '执行节点',
      sub: 'WORKER NODES',
      tone: 'milvus',
      nodes: [
        { id: 'coord', label: 'Coordinator', detail: 'DDL · 调度 · 路由视图' },
        { id: 'stream', label: 'Streaming Node', detail: 'growing 数据 · 分片一致性' },
        { id: 'query', label: 'Query Node', detail: 'sealed 段 · 段内检索' },
        { id: 'data', label: 'Data Node', detail: 'compaction · 建索引' }
      ]
    },
    {
      id: 'store',
      title: '存储与索引文件',
      sub: 'STORAGE',
      tone: 'milvus',
      nodes: [
        { id: 'wal', label: 'WAL', detail: 'Kafka / Pulsar / Woodpecker' },
        { id: 'object', label: 'Object Storage', detail: '段文件 · 索引文件' },
        { id: 'meta', label: 'Meta Storage', detail: 'etcd · schema · 检查点' }
      ]
    }
  ];

  var INDEX_TABLE = {
    head: ['索引', '适用规模', '是否占内存', '召回特点', '可调参数'],
    rows: [
      [
        'FLAT',
        '小数据量，或过滤后候选很少（官方建议过滤比例 > 95%）',
        '原始向量全量在内存',
        '暴力扫描，精确；没有近似损失',
        '无主要调参'
      ],
      [
        'HNSW',
        '数据能放进内存，要求低延迟、高召回',
        '图结构 + 原始向量，内存开销最大',
        '图越稠密召回越高；可用查询期 ef 调延迟与召回的平衡',
        'M、efConstruction；查询期 ef（页面示例值，官方范围以文档为准）'
      ],
      [
        'IVF_FLAT',
        '大规模数据、较大的 top-k；过滤比例高的场景也常用',
        '聚类中心 + 倒排表 + 原始向量，较省',
        '只扫描 nprobe 个聚类桶，召回随 nprobe 上升',
        'nlist（建索引）、nprobe（查询期）'
      ],
      [
        'DISKANN',
        '内存放不下、数据在 SSD 的超大规模场景',
        '图与压缩向量可在磁盘，内存占用低',
        '受图与量化影响；读盘带来 IOPS 压力',
        '官方页给出参数说明；本页未覆盖取值范围，以官方文档为准'
      ]
    ],
    note:
      '选型口径来自 Index Explained：内存、过滤比例、top-k 三者共同决定推荐项；「官方 benchmark」的倍数不是本页实测。'
  };

  var CONSISTENCY = {
    levels: ['Strong', 'Session', 'Bounded', 'Eventually'],
    head: ['t = 插入返回后', 'Strong', 'Session', 'Bounded', 'Eventually'],
    currentRow: '当前 t = {t} s',
    yes: '能看到',
    no: '可能看不到',
    legend: [
      'Strong / Session：插入返回后即可见（Session 限同一会话）',
      'Bounded：滞后 {bounded} s（模型值）',
      'Eventually：滞后 {eventual} s（模型值）'
    ],
    note:
      '四档取值的名称来自官方 RAG 教程与 Create Collection 文档；「多久能看见」的秒数是本页模型值，不是 Milvus 实测。四档精确定义以 Consistency Level 官方页为准。',
    explain: {
      Strong: '最新写入必须可见，代价是等待更久。',
      Session: '同一会话能读到自己刚确认的写入。',
      Bounded: '允许有界延迟，在窗口内读到旧快照是可接受的。',
      Eventually: '不保证何时可见，只保证最终会到。'
    }
  };

  var ISOLATION = {
    head: ['隔离粒度', '怎么隔离', '安全与成本'],
    rows: [
      ['database', '每个租户一个 database，权限与资源分开管理', '隔离最强；资源利用最低，运维对象最多'],
      ['collection', '每租户一个 collection，共享 database', '较强；schema 与索引需要逐租户维护'],
      ['partition', '同一 collection 内按租户分区', '中等；共享 schema，分区内仍需过滤'],
      ['partition key', '同一 collection 内按 key 散列分区', '最轻量；租户数很大时常用，隔离最弱']
    ],
    note:
      '粒度名称来自 Milvus Overview 的 multi-tenancy 说明：database / collection / partition / partition key。选择依据是租户数量、访问控制强度与成本。'
  };

  var GLOSSARY = [
    ['embedding', '文本/图片经模型得到的定长浮点向量；由应用侧生成，Milvus 只存与检索。'],
    ['consistency_level', '一致性级别，取值 Strong / Session / Bounded / Eventually，调的是新写入多久可见。'],
    ['HNSW', '多层图索引；M 控制每个节点的邻居数，efConstruction 控建图候选池，ef 控查询候选池。'],
    ['IVF', '先用聚类把向量分桶；nlist 是桶数，nprobe 是查询时扫描几个桶。'],
    ['DISKANN', 'Vamana 图 + 量化，图可放磁盘，适合内存放不下的数据。'],
    ['SPARSE_INVERTED_INDEX', '稀疏向量的倒排索引，BM25 全文检索使用它。'],
    ['MetricType.BM25', 'BM25 全文检索的度量类型，与 SPARSE_INVERTED_INDEX 一起出现。'],
    ['enable_analyzer', 'VARCHAR / TEXT 字段选项；开启后 Milvus 用 analyzer 切词，BM25 Function 才有输入。'],
    ['AnnSearchRequest', '混合检索里描述单路 ANN 请求的对象，包含 data、anns_field、param 与 limit。'],
    ['WeightedRanker', '按权重融合多路检索结果的 ranker；页面也提供 RRF 作为对照。'],
    ['growing / sealed', '段（segment）的两种状态：growing 可实时查，sealed 是历史段，由 Data Node 建索引后放对象存储。'],
    ['WAL', 'Write-Ahead Log；写入先记日志再服务，保证不丢与可恢复。']
  ];

  var COPY = {
    meta: {
      title: '一条查询，穿过 Milvus 的十站 · Milvus × RAG 执行链路',
      description:
        '交互式拆解 RAG 里的 Milvus：从切分、向量化、Schema、索引，到写入可见性、检索路由、过滤、混合检索与重排生成。十站、两泳道、参数一改数字就变；零外部请求，可离线打开。'
    },
    chrome: {
      brandCn: 'Milvus × RAG',
      brandEn: 'EXECUTION TRACE · 10 STATIONS',
      back: '返回许愿清单',
      status: '本地模拟 · 零外部请求',
      about: '关于与口径',
      auto: '自动演示',
      autoOn: '自动演示中',
      skip: '跳到正文',
      trackLabel: '十站进度轨道',
      railLabel: '站点列表',
      stageLabel: '当前站点',
      prev: '上一站',
      next: '下一站',
      mkReal: '真算',
      mkModel: '示意'
    },
    hero: {
      eyebrow: 'MILVUS × RAG · EXECUTION TRACE',
      titleA: '一条查询，',
      titleB: '穿过 Milvus 的十站',
      sub:
        '从一句提问，到 LLM 手里那段带引用的上下文 —— 中间哪一段是 Milvus 干的，哪一段不是。',
      primary: '开始追踪',
      secondary: '直接看结论',
      hint: '← → 换站 · 1–9 / 0 直达 · 空格 自动演示',
      stats: [
        { key: 'docs', label: '虚构文档', unit: '篇' },
        { key: 'chunks', label: '当前块数', unit: '块' },
        { key: 'dim', label: '向量维度', unit: '维' },
        { key: 'stations', label: '追踪站点', unit: '站' }
      ]
    },
    conclusion: {
      eyebrow: 'CONCLUSION · 先把边界说清楚',
      title: '三句话，说清 Milvus 管到哪',
      items: [
        {
          no: '01',
          title: 'Milvus 存向量、建索引、做检索与融合，不生成 embedding，也不写答案。',
          body:
            '切分、embedding、重排与生成都在应用侧；Milvus 收到的是向量、标量字段与过滤表达式，交回的是候选实体与分数。'
        },
        {
          no: '02',
          title: '写入走 Streaming Node 与 WAL，查询走 Query Node 与对象存储，两条路在 Proxy 汇合。',
          body:
            '写入先落 WAL 再进 growing 段；sealed 段由 Data Node 建索引后进对象存储。查询时 Proxy 做最终归并，中间还有两层段级归并。'
        },
        {
          no: '03',
          title: '过滤、混合检索、重排是三种不同的能力，别把它们当成一件事。',
          body:
            '过滤把条件压进检索链路；混合检索是两路 ANN 加一次 ranker 融合，发生在 Milvus 内；重排是应用侧独立模型，不是检索内核。'
        }
      ]
    },
    phase: {
      write: '阶段 A · 写入链路',
      writeSub: '文档 → 可检索数据',
      read: '阶段 B · 查询链路',
      readSub: '提问 → 带引用的上下文'
    },
    blocks: {
      app: ['应用侧做了什么', 'APPLICATION'],
      path: ['请求走到了哪', 'REQUEST PATH'],
      result: ['返回了什么', 'RETURN SHAPE'],
      adjust: ['动手改', 'ADJUST & RECOMPUTE']
    },
    lanes: {
      title: '两条泳道：应用侧 / Milvus 侧',
      legendApp: '应用侧',
      legendMilvus: 'Milvus 侧',
      trace: '路径',
      detail: '节点'
    },
    marks: {
      modelTime: '示意：耗时与跳数是模型化的数值，不是实测。',
      modelVector: '示意：这里的向量由本页按概念词表构造，同主题靠近、带可复现噪声，不是真实 embedding 模型输出；图上距离不代表语义真值。',
      modelDistribution: '示意：growing 与 sealed 的分布、查询节点数是页面参数，不代表真实集群拓扑。',
      modelRerank: '示意：重排打分是页面自建的可解释公式，真实 reranker 是独立的交叉编码器模型。',
      modelToken: '估算：1 个汉字约 1 token、1 个英文词约 1.3 token；不是真实 tokenizer 的输出。',
      modelGeneration: '示意：答案由检索片段按模板拼接，不是生成模型输出；页面不联网、不调用任何 API。',
      realCalc: '真算：该数字由页面内的算法实时计算，构建与 QA 都有校验。'
    },
    actions: {
      play: '播放',
      pause: '暂停',
      replay: '重播',
      walk: '走一遍',
      reset: '重置参数',
      copy: '复制片段',
      copied: '已复制到剪贴板',
      copyFail: '复制失败，请手动选中代码',
      close: '关闭',
      mismatch: '故意改维度 → 检索报错',
      mismatchBack: '恢复 1024 维',
      insert: '插入 1 批数据',
      citation: '查看来源块'
    },
    ui: {
      markAria: '查看口径说明',
      switchOn: '开',
      switchOff: '关',
      tableFallback: '等价数据表',
      pathAria: '应用侧与 Milvus 侧的执行路径',
      stationAria: '第 {n} 站：{name}',
      renderError: '这一站渲染失败',
      glossarySummary: '术语表 · API 名与中文解释',
      appendixEyebrow: 'CALIBRATION · 口径',
      aboutEyebrow: 'ABOUT · 口径',
      localSim: '零外部请求 · 本地模拟',
      noFilter: '(无过滤条件：检索全库)',
      customQuestion: '当前是自定义问题：{q}',
      snippetTitle: 'PyMilvus · {name} · 参数随控件生成',
      snippetNote: '代码仅作展示：不联网、不执行，不含真实端点或密钥。',
      modelMark: '（示意）',
      ownerApp: '应用侧负责',
      ownerMilvus: 'Milvus 负责',
      ownerAppShort: '应用侧',
      ownerMilvusShort: 'Milvus 侧',
      topPrefix: 'Top-'
    },
    footer: {
      title: '口径汇总：哪些是真算，哪些只是示意',
      realTitle: '必须真算（页面内有实现与测试）',
      modelTitle: '只能示意（均带 ⓘ 标注）',
      real: [
        '切分：块数、长度分布、实测重叠、元数据覆盖',
        '余弦 / 内积，归一化前后的排序对照',
        'BM25：词元、df、IDF、单条得分',
        '向量检索：真实构建的 HNSW 图与 IVF 倒排，输出访问点数与 recall@k',
        '三级归并：分片 Top-k → Streaming Node → Proxy',
        '过滤：pre-filter 与 post-filter 的结果差异',
        '融合：WeightedRanker 的 min-max 加权与 RRF 名次计算',
        '重排打分、token 估算、引用命中'
      ],
      model: [
        '分布式调度、网络跳数、WAL 落盘与 compaction 的耗时',
        '真实 QPS、延迟、内存占用曲线（只给量级模型的假设）',
        '示意向量与真实 embedding 的差距',
        '官方 benchmark 的倍数（2–5x、30%–70%），引用时必须写明「官方 benchmark，非本页实测」',
        '答案文本与重排分数的具体模型行为'
      ],
      version: VERSION,
      sourcesTitle: '事实出处',
      codeTitle: '工程与内容口径',
      code: [
        '语料为虚构的《VectorOps 向量库产品知识库》，不是 Milvus 官方文档。',
        '页面所有「运行」都在浏览器内模拟，不连接真实 Milvus，也不发任何外部请求。',
        '文档版本 3.0.x（2026-11-03 抓取）；参数默认值与范围以官方文档为准。',
        '构建：node tools/build.mjs；验收：node tools/qa.mjs（无头 Chrome）。'
      ],
      disclaimer:
        'Milvus 与 Zilliz 是各自权利人的商标；本页为个人学习用途的非官方演示，与 Milvus / Zilliz 无隶属关系。'
    },
    about: {
      title: '这是一次执行追踪，不是 Milvus 控制台',
      lead:
        '十站从写入到生成，每一站都按「应用侧做了什么 / 请求走到了哪 / 返回了什么 / 动手改」展开。默认值是页面示例，不是官方默认值。',
      sections: [
        {
          title: '边界',
          items: [
            '页面不连接任何 Milvus 实例，所有结果都在浏览器里算出来。',
            '示意向量不是真实 embedding；示意耗时不是实测。',
            '答案由检索片段按模板拼接，不是 LLM 生成。'
          ]
        },
        {
          title: '操作',
          items: [
            '← → 切换站点；1–9 / 0 直达十站；空格 播放或暂停自动演示。',
            'Esc 关闭浮层；URL hash 记录站点与关键参数。',
            '参数改动后，站内数字与排名立即重算。'
          ]
        },
        {
          title: '怎么核对',
          items: [
            '每站右下角的片段可复制，参数与页面控件同步。',
            '页脚列出真算 / 示意清单与官方文档链接。',
            'research/ 目录保存了 7 篇官方文档原文与抓取时间。'
          ]
        }
      ]
    }
  };

  var STAGES = [
    {
      n: 1,
      slug: 'chunk',
      phase: 'A',
      name: '切分 Chunk',
      en: 'CHUNK',
      owner: 'app',
      oneLiner: '把文档切成能被检索的最小单元',
      badges: { real: '切分统计', model: null },
      app: [
        '应用侧先决定块大小、块间重叠，以及是否按标题切。Milvus 不参与切分：它收到的是已经切好的块和向量，并不知道原文长什么样。',
        '块在写入前就带上 source / dept / version / updated / acl。它们会变成集合里的标量字段，站 8 的过滤表达式直接在这些字段上生效。'
      ],
      lane: {
        active: ['app'],
        trace: '应用进程 → 切分函数 → 块数组（尚未进入 Milvus）',
        note: '切分发生在应用进程内，这一步没有任何请求发给 Milvus。'
      },
      result: {
        lead: '切分产物是应用侧的数据结构，不是 Milvus 的返回值。下面取自当前参数下真实切出来的第 1 块：',
        note: '块被写入集合后，除 text 与向量外的字段都会变成可过滤的标量字段。'
      },
      boundary: '切分是应用侧的事，Milvus 不管切分；但切坏了，后面所有指标都会跟着坏。',
      sources: [LINKS.rag],
      ui: {
        figure: {
          doc: '原始文档',
          chunks: '切出来的块',
          docHint: '右侧点击任意块，这里会高亮它在原文中的区间。',
          chunkHint: '点击块，左侧高亮原文区间；颜色 = 来源文档。',
          chars: '字',
          pick: '选择文档'
        },
        stats: {
          count: '块数',
          median: '中位长度',
          overlap: '实测重叠',
          coverage: '元数据覆盖',
          overlapNote: '配置 {config} 字 · {pairs} 对相邻块',
          coverageNote: '{n} 个字段全部非空'
        },
        controls: {
          size: '块大小（字符）',
          overlap: '重叠（字符）',
          byHeading: '按标题切',
          byHeadingHint: '关闭后按整篇文档滑窗，重叠才会真正跨标题生效。'
        },
        conclusion: '切分决定「检索的最小语义单元」：块越小，命中越精确但上下文越碎。'
      }
    },
    {
      n: 2,
      slug: 'embed',
      phase: 'A',
      name: '向量化 Embed',
      en: 'EMBED',
      owner: 'app',
      oneLiner: '文本变成定长向量，维度从这里定型',
      badges: { real: '余弦 / 内积 / 排序', model: '示意向量', tip: COPY.marks.modelVector },
      app: [
        '应用侧调用 embedding 模型，把每个块变成定长向量。维度由模型决定，之后集合 schema 的 dim 必须与它一致 —— 这一步也不在 Milvus 里发生。',
        '本页不联网，用确定性示意向量代替真实模型输出：同主题靠近、带可复现噪声。它只用于演示距离、排序与失手场景，不代表真实语义。'
      ],
      lane: {
        active: ['app'],
        trace: '应用进程 → embedding 模型（本页为本地示意向量）→ 向量数组',
        note: '模型可以是 OpenAI、BGE、自建服务；Milvus 只接收生成的向量。'
      },
      result: {
        lead: '向量是定长浮点数组；下面给出当前问题向量与 Top-1 块向量的真实余弦与内积：',
        note: '归一化之后，COSINE 与 IP 的排序完全一致 —— 这是数学结果，不是巧合。'
      },
      boundary:
        'Embedding 不在 Milvus 里发生；BM25 全文检索是例外（站 9），文字进、稀疏向量由 Milvus 内置 Function 生成。',
      sources: [LINKS.rag, LINKS.overview],
      ui: {
        figure: {
          title: '二维概念投影（示意）',
          hint: '每个点是一个块；悬停查看块与所属文档。点越靠近某个概念轴，示意向量在该主题上的激活越强。',
          axis: '概念轴',
          axisNote: '轴 = 概念激活强度（示意投影）',
          aria: '示意向量的二维概念投影：每个点是一个文本块，颜色表示来源文档',
          table: '等价数据表',
          legend: '来源文档'
        },
        stats: {
          dim: '维度',
          norm: '问题向量范数',
          cosine: '余弦',
          ip: '内积'
        },
        controls: {
          normalize: '写入前归一化',
          normalizeHint: '打开后所有向量除以自身长度，COSINE 与 IP 应当给出同一排序。',
          dim: '维度截断',
          dimHint: '模拟把 1024 维截断到更少维度；真实系统里维度由模型决定，不能随意截断。',
          dimOptions: [
            { value: '1024', label: '1024 维（原始）' },
            { value: '256', label: '256 维（截断）' },
            { value: '64', label: '64 维（截断）' }
          ]
        },
        table: {
          head: ['名次', '块', 'COSINE', 'IP'],
          chartHead: ['块', '文档'],
          rankTitle: 'Top-5：COSINE 与 IP 对照',
          same: '两种度量排序一致',
          diff: '两种度量排序不同：未归一化时 IP 受向量长度影响。'
        },
        conclusion: '归一化是相似度可比性的前提；换模型或换维度，集合就必须重建。'
      }
    },
    {
      n: 3,
      slug: 'schema',
      phase: 'A',
      name: '建模 Schema',
      en: 'SCHEMA',
      owner: 'app',
      oneLiner: '决定哪些字段能过滤、哪些能全文检索',
      badges: { real: '开关影响', model: null },
      app: [
        '应用侧用 create_schema / add_field 定义字段：id 主键、dense 向量、text（enable_analyzer=True）、sparse（由 BM25 Function 产出），以及 5 个标量字段。',
        '提交 create_collection 是 DDL：请求经 Access Layer 到 Coordinator，Coordinator 维护 schema 并把元数据写进 etcd（Meta Storage）。'
      ],
      lane: {
        active: ['app', 'proxy', 'coord', 'meta'],
        trace: '应用 → Proxy（Access Layer）→ Coordinator → Meta Storage',
        note: '创建集合属于 DDL；检索请求不会走这条路，除非 Proxy 的元数据缓存失效。'
      },
      result: {
        lead: 'create_collection 没有业务返回值；真正要看的是 schema 与 load state。当前 schema 如下：',
        note: '索引参数没有一起提交时，集合创建后处于未加载状态；加载与建索引是后续步骤（站 4）。'
      },
      boundary: 'Schema 决定「能过滤什么、能全文搜什么」；改 Schema 是唯一需要重建集合的步骤。',
      sources: [LINKS.create, LINKS.fulltext],
      ui: {
        table: { head: ['字段', '类型', '关键参数', '作用'] },
        sparseIndexNote:
          'sparse 字段的索引使用 SPARSE_INVERTED_INDEX，度量使用 MetricType.BM25；两者是 BM25 全文检索的固定搭配。',
        fieldNotes: {
          id: '主键；auto_id 时由 Milvus 生成',
          dense: '稠密向量，维度来自站 2',
          text: '原文；BM25 Function 的输入',
          sparse: 'BM25 稀疏向量，不要求 dim',
          source: '可过滤的标量字段',
          dept: '可过滤的标量字段',
          version: '可过滤的标量字段',
          acl: '可见范围，站 8 用它过滤',
          updated: '更新时间，站 8 的时间条件',
          meta: '兜住未在 schema 中定义的字段'
        },
        stats: {
          fields: '字段数',
          vectorFields: '向量字段',
          scalarFields: '标量字段',
          analyzable: '可全文检索字段'
        },
        controls: {
          bm25: '启用 BM25 字段（text + sparse + Function）',
          bm25Hint: '关闭后站 9 只剩 dense 一路，站 3 的字段表也会少掉 sparse。',
          dynamic: '开启动态字段（$meta）',
          dynamicHint: '未在 schema 中定义的字段会写进保留 JSON 字段 $meta；它不是过滤能力的替代品。',
          pk: '主键类型',
          pkHint: 'INT64 主键由应用侧给 id；VARCHAR + auto_id 由 Milvus 生成字符串主键。'
        },
        effects: {
          title: '这些开关在下游真的会改变结果',
          hybridOn: '站 9：dense + BM25 两路可选，也是默认展示。',
          hybridOff: '站 9：BM25 字段未启用，hybrid_search 只剩 dense 一路（页面会提示）。',
          aclOn: '站 8：acl 是普通标量字段，过滤表达式仍能使用 acl == "…"。',
          dynamicNote: '动态字段只兜住未定义字段，不会让任意键都变成可过滤的标量。'
        },
        conclusion: 'Schema 是最贵的一次决定：字段、维度、是否全文检索，改任何一项都要重建集合。'
      }
    },
    {
      n: 4,
      slug: 'index',
      phase: 'A',
      name: '建索引 Index',
      en: 'INDEX',
      owner: 'milvus',
      oneLiner: '选索引类型与距离度量，决定「快」和「准」怎么换',
      badges: { real: '图 / 簇 / 访问点 / recall / 内存估算', model: '构建耗时', tip: COPY.marks.modelTime },
      app: [
        '应用侧 prepare_index_params 并给 dense 字段指定 index_type 与 metric_type。建索引本身是 Milvus 的活：Coordinator 下发任务，Data Node 在 sealed segment 上构建，文件写进 Object Storage，Query Node 加载后用于检索。',
        '下面的图与数字是页面里真实构建的索引：节点、邻居边、访问点数与 recall@k 都由当前参数算出；只有耗时与分布式调度是示意。'
      ],
      lane: {
        active: ['app', 'proxy', 'coord', 'data', 'object', 'query'],
        trace: '应用 → Proxy → Coordinator → Data Node → Object Storage → Query Node',
        note: '建索引是 DDL + 后台任务；索引文件落地后，Query Node 按需加载。'
      },
      result: {
        lead:
          '建索引完成后，describe_index 能看到 index_type / metric_type / params；检索时 Query Node 用它决定访问哪些点。当前构建结果：',
        note: '访问点数与 recall@k 以当前问题为查询、以 FLAT 全量扫描为基准计算。'
      },
      boundary: '索引只影响「多快找到」和「找得准不准」，不改变向量本身。',
      sources: [LINKS.index, LINKS.create],
      ui: {
        table: { title: '四类索引对照', note: '参数默认值与取值范围以官方 Index 文档为准。' },
        stats: {
          visited: '访问点数',
          recall: 'recall@k',
          edges: '邻居边',
          memory: '内存估算',
          build: '构建耗时（示意）',
          clusters: '聚类桶',
          visitedNote: '距离计算次数',
          recallNote: '以 FLAT 全量为基准，k={k}'
        },
        paramNote: 'M / efConstruction / nlist 的取值范围与默认值以官方 Index 文档为准；页面数值是示例，不是官方默认值。',
        paramTip: '页面把这三个参数当作演示旋钮。官方文档给出参数定义与调优建议，但本文档集没有逐项核对默认值，因此不在这里写死。',
        scaleNote: '本页语料只有 {n} 个块，图相对稠密；把 M 调小或把 ef 调低，才容易看到 recall 下降。',
        diskannNote: 'DISKANN 在本页是简化模型：用 HNSW 图 + 8 位标量量化距离遍历，再对候选做全精度重排；真实 DiskANN 使用 Vamana 图与 PQ，图数据在磁盘，具体以官方文档为准。',
        figureAria: '索引结构图：节点、邻居边或聚类桶，节点带编号',
        legendCluster: '菱形 = 聚类中心；颜色 = 簇',
        legendEdges: '连线 = 建图层的邻居边',
        tableHead: ['节点', '文档', '所属簇', '邻居数', '邻居'],
        controls: {
          type: '索引类型',
          M: 'M（每个节点邻居数）',
          efC: 'efConstruction（建图候选池）',
          nlist: 'nlist（聚类桶数）',
          metric: 'metric_type',
          metricHint: '归一化向量上，COSINE 与 IP 排序一致；L2 的数值方向相反。'
        },
        figure: {
          title: '索引结构（真实构建）',
          hint: 'HNSW 显示建图层 0 的邻居边；IVF 显示聚类与桶；点击节点查看邻居 / 所属簇。',
          table: '等价数据表',
          node: '节点',
          neighbors: '邻居',
          cluster: '簇'
        },
        memory: {
          formula:
            '简化公式：图内存 = N × M × 4 B；原始向量 = N × dim × 4 B。不含对齐、元数据与索引框架开销。',
          source: '公式口径来自 Index Explained 的内存估算章节。'
        },
        conclusion: '索引是性能与召回的交易，不是「有没有」的开关。'
      }
    },
    {
      n: 5,
      slug: 'write',
      phase: 'A',
      name: '写入与可见性',
      en: 'WRITE',
      owner: 'milvus',
      oneLiner: '数据从 WAL 到 growing 再到 sealed，什么时候查得到',
      badges: { real: '一致性可见性逻辑与对照表', model: '全部耗时', tip: COPY.marks.modelTime },
      app: [
        '应用侧 client.insert 一批数据，插入返回 insert_count / ids / cost。写请求走 DML 路径：Proxy → Streaming Node → WAL，之后数据在 growing segment 里可查。',
        '段满了会转 sealed，Data Node 做 compaction 与建索引，Query Node 再加载新索引。下面这条时间线把这几步摆在一起；耗时是模型值，不是实测。'
      ],
      lane: {
        active: ['app', 'proxy', 'stream', 'wal', 'data', 'object', 'query'],
        trace: '应用 → Proxy → Streaming Node → WAL → growing → sealed → Data Node → Object Storage → Query Node',
        note: '写入与查询在 Proxy 汇合；growing 数据由 Streaming Node 直接查，sealed 数据由 Query Node 查。'
      },
      result: {
        lead: 'insert 的返回结构很简单，真正的复杂度在「什么时候能被查到」：',
        note: 'ids 很长，页面只展示前 6 个；cost 字段在官方教程里是 0。'
      },
      boundary:
        'WAL 保证的是不丢与可恢复，growing/sealed 保证的是实时与吞吐；一致性级别调的是「能不能马上看到」，不是「数据对不对」。',
      sources: [LINKS.architecture, LINKS.rag, LINKS.consistency],
      ui: {
        stats: {
          count: 'insert_count',
          visibleAt: 'growing 可查（示意）',
          sealedAt: 'sealed（示意）',
          indexedAt: '索引就绪（示意）'
        },
        controls: {
          consistency: '一致性级别',
          batch: '批量大小（行）',
          t: '插入返回后经过'
        },
        timeline: {
          title: '这批数据走到哪了（时间线为示意）',
          phases: ['已提交', 'WAL 已落盘', 'growing 可查', 'sealed', '索引就绪', 'Query Node 加载'],
          axis: '模拟时间',
          play: '播放这批数据的旅程',
          current: '当前时刻',
          legendReal: '可查状态',
          legendModel: '耗时模型'
        },
        table: {
          title: '四档一致性：给定 t 秒，查询能否看到这批数据',
          note: '秒数与是否可见由页面模型计算；四档语义见官方 Consistency Level 页。',
          yes: '能看到',
          no: '可能看不到',
          self: '本会话'
        },
        conclusion: '可见性不是「写成功没有」，而是「你要求看到哪个时间点的快照」。'
      }
    },
    {
      n: 6,
      slug: 'query',
      phase: 'B',
      name: '查询向量化',
      en: 'QUERY',
      owner: 'app',
      oneLiner: '用同一个模型把问题变成同一空间里的向量',
      badges: { real: 'Top-k 与分数', model: '查询向量', tip: COPY.marks.modelVector },
      app: [
        '应用侧用同一个模型、同一个维度把问题向量化，然后调用 search(data=[query_vector], limit=..., search_params=...)。',
        '维度一旦对不上，Milvus 会直接拒绝：集合的 dim 是 schema 的一部分，换模型就必须重建集合。下面的「故意改维度」按钮演示这个拒绝。'
      ],
      lane: {
        active: ['app', 'proxy', 'stream', 'query', 'object'],
        trace: '应用 → Proxy（Access Layer）→ Streaming Node / Query Node（路由细节见站 7）',
        note: '查询是 DQL；Proxy 用路由缓存决定目标节点，缓存不可用才联系 Coordinator。'
      },
      result: {
        lead: 'search 返回按距离排序的列表，每项包含 id、distance 与 entity：',
        note: '官方教程的写法是 res["entity"]["text"] 与 res["distance"]；页面按同样结构展示。'
      },
      boundary: '同一个模型、同一个维度不是建议，是硬约束；跨模型混用向量，相似度没有可比性。',
      sources: [LINKS.rag, LINKS.architecture],
      ui: {
        stats: {
          dim: '查询向量维度',
          norm: '向量范数',
          top1: 'Top-1 相似度',
          top1Distance: 'Top-1 距离',
          candidates: '候选块'
        },
        controls: {
          question: '预设问题',
          custom: '或者直接输入问题',
          customPlaceholder: '输入一句问题，回车重算（不联网）',
          limit: 'limit',
          ef: 'ef（HNSW 查询候选池）',
          nprobe: 'nprobe（IVF 扫描桶数）',
          mismatch: '故意改维度',
          mismatchHint: '把查询向量改成 768 维，观察检索被拒绝。'
        },
        error: {
          title: '检索被拒绝：维度不匹配',
          body: '集合的 dense 字段是 {dim} 维，而查询向量是 768 维。Milvus 不会自动截断或补齐，必须用同一模型重新生成查询向量。',
          noSearch:
            '检索没有发生：查询向量在进入 Milvus 之前就被维度检查拦下。换模型必须重建集合，或者用原模型重新生成查询向量。',
          fix: '恢复 1024 维'
        },
        table: {
          head: ['名次', '块', '来源', '分数 / 距离', '文本'],
          caption: 'search 返回的 Top-{n}',
          candidatesNote: '索引访问点数 · 全库 {total} 块',
          note: '数值来自当前索引（{type}）与度量（{metric}）；L2 下显示距离，COSINE / IP 下显示相似度。'
        },
        conclusion: '查询向量化在应用侧；Milvus 只负责在它已有的向量里找最近邻。'
      }
    },
    {
      n: 7,
      slug: 'route',
      phase: 'B',
      name: '检索路由',
      en: 'ROUTE',
      owner: 'milvus',
      oneLiner: '请求经过 Proxy，落到 Streaming 与 Query Node，再逐级归并',
      badges: { real: '三级归并与 recall', model: '数据分布', tip: COPY.marks.modelDistribution },
      app: [
        '应用侧仍然只发一次 search，它看不见 Proxy、Streaming Node 与 Query Node 的分工。请求先到 Proxy；Proxy 用路由缓存找目标节点，缓存不可用才联系 Coordinator。',
        'Streaming Node 查 growing 数据，Query Nodes 从对象存储加载 sealed 段并做段内检索。结果要经过三级归并才回到客户端。'
      ],
      lane: {
        active: ['app', 'proxy', 'stream', 'query', 'object'],
        trace: 'SDK → Proxy → Streaming Node → Query Nodes → Streaming Node 归并 → Proxy 最终归并 → SDK',
        note: '三个归并层级：Query Node 归并段内结果，Streaming Node 归并 Query Nodes，Proxy 归并所有 Streaming Nodes。'
      },
      result: {
        lead: '返回的还是 Top-k，但中间每一级都只保留 Top-k。下面的表把各分片结果与全局结果摊开：',
        note: '段内检索在这里用精确扫描，是为了把注意力放在归并上；真实段内检索同样受索引近似影响。',
        filterNote: '站 7 用全量块演示归并，不叠加站 8 的过滤；过滤对流量的影响在站 8 单独展示。'
      },
      boundary: '归并发生在三个层级，每一层都只保留 Top-k，所以 k 与各层候选数会共同决定最终召回。',
      sources: [LINKS.architecture, LINKS.overview],
      ui: {
        stats: {
          shards: '分片 / Streaming Node',
          nodes: 'Query Node',
          growing: 'growing 块',
          recall: '归并 recall@k'
        },
        controls: {
          growing: 'growing 数据占比',
          nodes: '每个分片的 Query Node 数',
          shards: '分片数',
          cand: '每层候选数',
          candHint: '小于 limit 时，中间层会提前丢掉可能进入全局 Top-k 的候选。'
        },
        table: {
          shard: '分片',
          growingTitle: 'Streaming Node · growing',
          query: 'Query Node',
          merge: '归并后',
          global: '全局 Top-k',
          concat: '简单拼接',
          concatHint: '把所有节点结果按顺序拼起来直接取前 k 条 —— 名次与全局归并不同。',
          concatCurrent: '把各节点结果按顺序拼起来取前 k 条。当前拼接结果：{ids}',
          exact: '精确 Top-k（FLAT 基准）',
          consistent: '归并结果与精确 Top-k 一致：每一层都保留了足够的候选。',
          inconsistent: '归并结果与精确 Top-k 不一致：把某一层的候选数压到低于 k，就会丢掉可能进入全局 Top-k 的块。',
          shardStreaming: '分片 {id} · Streaming Node（growing）',
          shardQuery: '分片 {id} · Query Node {node}（{segments} 段）',
          shardMerge: '分片 {id} · Streaming Node 归并',
          proxyMerge: 'Proxy 最终归并',
          ladderCaption: '三级归并的中间结果（每层只保留 Top-{cand}）',
          ladderNote: '段内检索在这里用精确扫描，以便把注意力放在归并上；真实段内检索同样受索引近似影响。',
          head: ['层级 / 节点', '规模', 'Top-k（块 · 分数）'],
          sealedNote: 'sealed {n} 块',
          recallNote: 'k={k} · 每层候选 {cand}'
        },
        conclusion: '中间结果不能简单拼接：每一层都要按分数归并，并且保留足够的候选。'
      }
    },
    {
      n: 8,
      slug: 'filter',
      phase: 'B',
      name: '过滤与分区',
      en: 'FILTER',
      owner: 'milvus',
      oneLiner: '元数据条件在检索里生效，而不是查完再筛',
      badges: { real: '过滤结果与命中率', model: null },
      app: [
        '应用侧把条件写进 search 的 filter 参数，例如 filter=\'dept == "finance" and updated >= 1767196800\'（2026-01-01 的 epoch 秒）。过滤发生在检索链路里，不是拿到结果之后再筛。',
        '页面把「先过滤」与「后过滤」做成对照：同一条查询、同一个 limit，后过滤会先把 Top-k 取回来再筛，筛完可能一条不剩。'
      ],
      lane: {
        active: ['app', 'proxy', 'stream', 'query'],
        trace: '应用 → Proxy → Streaming / Query Node → filtering search → 归并',
        note: '过滤条件下推到检索里执行；标量字段的索引（例如 INVERTED）可以帮助定位候选。'
      },
      result: {
        lead: '过滤后的返回结构与普通 search 相同，只是候选集变了；下面是当前表达式的真实结果：',
        note: '「命中率」按问题预设的答案词计算：结果里只要有块包含答案词，就算命中。'
      },
      boundary: '隔离粒度是 database / collection / partition / partition key；隔离级别越高越安全，也越贵。',
      aclNote:
        '演示把 acl 存成单值 VARCHAR，因此表达式是 acl == "finance"；真实多值授权通常用 ARRAY 字段并配合相应数组操作符（具体写法以官方文档为准）。',
      preNote:
        'pre-filter 在本页实现为「在过滤后的子集上做精确扫描」，便于与 post-filter 对照；真实 Milvus 会把条件下推到检索链路里，具体执行策略以官方文档为准。',
      sources: [LINKS.overview, LINKS.create],
      ui: {
        stats: {
          candidates: '参与检索的块',
          results: '返回条数',
          hit: '命中率',
          empty: '空结果'
        },
        controls: {
          dept: 'dept 条件',
          updated: 'updated 起点',
          acl: 'acl 条件',
          mode: '过滤时机',
          modeHint: '先过滤把条件压进检索；后过滤先取 Top-k 再筛。',
          pre: '先过滤',
          post: '后过滤',
          limit: 'limit',
          expression: '过滤表达式',
          clearTime: '清除时间条件',
          preset: '套用 04 权限预设（acl=finance）'
        },
        copy: {
          noFilter: '(无过滤条件：检索全库)',
          current: '当前',
          allLibrary: '全库 {n} 块',
          unfiltered: '未过滤',
          candidatesNote: '参与检索的块',
          resultsNote: 'Top-{n}',
          hitNote: '结果里是否含答案词',
          emptyNote: '是否返回空结果',
          yes: '是',
          no: '否',
          compareTitle: '两种过滤时机的结果对照',
          compareHead: ['时机', '参与检索的块', '返回条数', '命中率', ''],
          resultHead: ['块', '文档', 'acl', '分数', '命中答案词'],
          postWarning: '后过滤把返回条数从 {pre} 压到 {post}：筛掉的块里，有 {what}。',
          whatAnswer: '答案块',
          whatCandidate: '可能相关的候选',
          presetPrompt:
            '当前没有过滤条件。套用 04 权限预设（acl=finance），再把过滤时机切到后过滤，就能看到「一条不剩」。'
        },
        table: {
          title: '多租户隔离粒度',
          note: '隔离级别越高越安全，也越贵；按租户数量与访问控制强度选择。'
        },
        incident: {
          title: '事故现场：后过滤把结果筛空了',
          body: '先取全库 Top-{k}，再用 acl 条件筛。命中的答案块如果不在 Top-{k} 里，筛完就是 0 条 —— 检索本身没有错，错在过滤时机。'
        },
        conclusion: '过滤是检索的一部分；把它挪到应用侧，就等于放弃了候选集控制。'
      }
    },
    {
      n: 9,
      slug: 'hybrid',
      phase: 'B',
      name: '混合检索',
      en: 'HYBRID',
      owner: 'milvus',
      oneLiner: 'dense 与 BM25 两路结果融合成一份候选',
      badges: { real: 'BM25 / 融合名次', model: null },
      app: [
        '应用侧构造两个 AnnSearchRequest：dense 一路用向量，sparse 一路交给 text 字段上的 BM25 Function。再由 hybrid_search 配 ranker 融合。',
        'BM25 这一路不需要应用侧再调 embedding：VARCHAR + enable_analyzer=True 的字段，经 Milvus 内置 Function 变成稀疏向量，索引类型是 SPARSE_INVERTED_INDEX，度量是 MetricType.BM25。'
      ],
      lane: {
        active: ['app', 'proxy', 'stream', 'query'],
        trace: '应用 → Proxy → Streaming / Query Node → 两路 ANN → ranker 融合 → 归并',
        note: '一次 hybrid_search 在 Milvus 内拆成两路 ANN，再由 ranker 合并；应用侧只看到一份结果。'
      },
      result: {
        lead:
          '融合后的列表仍然按分数排序，但 dense 的 distance 与 BM25 的相关性分数不是同一种量纲，不能直接比大小。',
        note: 'WeightedRanker 的归一化公式以官方文档为准；本页实现为 min-max 归一化后加权求和。'
      },
      boundary: '融合不是重排：融合发生在 Milvus 检索链路里，重排是应用侧的独立模型。',
      sources: [LINKS.hybrid, LINKS.fulltext],
      ui: {
        stats: {
          dense: 'dense 候选',
          sparse: 'BM25 候选',
          fused: '融合结果',
          answerRank: '含答案词的位置'
        },
        controls: {
          ranker: '融合方式',
          weighted: 'WeightedRanker',
          rrf: 'RRF',
          wDense: 'dense 权重',
          wSparse: 'BM25 权重',
          k1: 'BM25 k1',
          b: 'BM25 b',
          limit: 'limit',
          disabled: 'BM25 字段未启用（站 3 关闭），这一站只能展示 dense 一路。'
        },
        table: {
          title: '两路名次 → 融合名次',
          denseScore: 'dense 距离',
          sparseScore: 'BM25 分数',
          rank: '名次',
          fused: '融合分数',
          moved: '名次变化',
          source: '块'
        },
        exact: {
          title: '为什么需要 BM25：一个编号类问题',
          body: 'VX-2048 这种精确编号，语义向量只认得「故障」这个话题，分不清 2041 / 2048 / 2049；BM25 的词元可以直接命中。切换上面的问题，肉眼就能看到。'
        },
        copy: {
          denseHeader: 'dense（语义） · {metric}',
          bm25Header: 'BM25（字面）',
          bm25OffHeader: 'BM25 · 未启用',
          bm25Empty: '站 3 关闭了 BM25 字段，这一路不存在。',
          denseHead: ['#', '块', '分数 / 距离'],
          sparseHead: ['#', '块', '相关性分数'],
          fusedHead: ['名次', '块', 'dense #', 'BM25 #', '融合分数', '名次变化'],
          fusedCap: '两路名次 → 融合名次 · {ranker}',
          rankNoteOn: '含答案词的块在融合结果中的位置',
          rankNoteOff: '自定义问题没有答案词',
          rrfNote: 'RRF 只使用名次：score = Σ 1/(k + rank)，页面取 k=60（常见取值，非官方默认）。',
          weightedNote: 'WeightedRanker：本页对每一路分数做 min-max 归一化后加权求和；dense 权重 {dense}，BM25 权重 {sparse}。官方归一化公式以文档为准。',
          bm25Defaults: 'k1 = 1.2、b = 0.75 是官方 Full Text Search 文档给出的默认值；调大 k1 会放大词频的影响，b 控制文档长度归一化。',
          fusionCall: 'hybrid_search(reqs=[sparse_req, dense_req], ranker={ranker}, limit={limit})'
        },
        conclusion: '混合检索不是「更高级的向量检索」，而是两套互补的召回信号加一次融合。'
      }
    },
    {
      n: 10,
      slug: 'answer',
      phase: 'B',
      name: '重排与生成',
      en: 'ANSWER',
      owner: 'app',
      oneLiner: '重排、塞进 token 预算、带上引用，交给 LLM',
      badges: { real: '重排 / token 估算 / 引用', model: '重排模型与生成', tip: COPY.marks.modelRerank },
      app: [
        '应用侧先重排（可选），再把 Top-n 拼进 prompt：带引用、控 token 预算、分数不够就拒答。Milvus 在这里已经返回完毕。',
        'PyMilvus 提供 reranker 集成，但重排与生成仍然是应用侧能力，不是 Milvus 内核的检索能力。'
      ],
      lane: {
        active: ['app'],
        trace: '应用 → 重排模型 → prompt 组装 → LLM → 带引用的答案',
        note: '这一站已经离开 Milvus；页面里没有真实模型调用，答案由片段按模板拼接。'
      },
      result: {
        lead: '这一站的「返回」是 prompt 与答案，不再是检索结果；引用编号指回站 1 的块。',
        note: '点击引用编号会跳回站 1 并高亮对应的块。'
      },
      boundary: 'Milvus 不生成 embedding，也不写答案；它只把候选交回应用。',
      sources: [LINKS.overview, LINKS.rag],
      ui: {
        stats: {
          ranking: '候选条数',
          tokens: '上下文 token',
          budget: '预算',
          confidence: '最高置信度',
          citation: '引用命中率'
        },
        controls: {
          rerank: '启用重排',
          rerankHint: '关闭时按融合顺序；打开后按页面重排分数重排。',
          topN: 'Top-n',
          budget: '上下文预算（token）',
          threshold: '拒答阈值'
        },
        answer: {
          title: '拼出来的回答（模板拼接，不是生成模型）',
          refuseTitle: '拒答',
          refuseBody: '最高置信度 {score} 低于阈值 {threshold}。资料里没有足够依据，页面选择不回答。',
          unsupported: '低于默认阈值，依据不足',
          citation: '引用',
          empty: '没有可用的上下文。',
          promptTitle: '交给 LLM 的上下文（截断展示）',
          citeHint: '点击引用编号跳回站 1 的块'
        },
        reasons: {
          lexical: '词元命中',
          cosine: '语义相似',
          heading: '标题命中'
        },
        budget: {
          title: '上下文预算',
          used: '已用',
          total: '预算',
          truncated: '超出预算，最后一块被截断',
          fit: '全部装得下'
        },
        rerank: {
          title: '重排前后',
          before: '融合顺序',
          after: '重排后',
          reason: '提上来的原因'
        },
        copy: {
          budgetNote: '预算 {budget}',
          thresholdNote: '阈值 {threshold}',
          citationNote: '{hits}/{lines} 句带答案词',
          thresholdHint: '把阈值滑到 {t} 以下，页面就会「硬答」。',
          rerankOffTitle: '（重排已关闭，沿用融合顺序）',
          rerankFormula: '重排分数 = 0.60 × 语义相似 + 0.25 × 词元覆盖 + 0.15 × 标题命中。这是页面公式，不是真实 reranker。',
          rerankOffNote: '关闭重排后，答案按融合名次取前 n 条；置信度仍按同一公式计算，只用于拒答判断。',
          confHead: '置信度'
        },
        threshold: {
          hard: '阈值被调低，页面开始「硬答」：低置信度的句子会被标出来。',
          normal: '默认阈值下，低置信度问题会被拒绝。'
        },
        conclusion: '重排、拼上下文、拒答都是应用侧的工程决策；Milvus 的职责在站 9 已经结束。'
      }
    }
  ];

  /* --------------------------------------------------------------------------
     PyMilvus 片段。参数从页面控件拼进来；只作展示，不执行、不联网、无密钥。
     -------------------------------------------------------------------------- */
  function snippet(stage, p, extra) {
    var x = extra || {};
    var s = '';
    if (stage.slug === 'chunk') {
      s =
        '# 应用侧：切分（这一步与 Milvus 无关）\n' +
        'from pymilvus import MilvusClient\n\n' +
        'client = MilvusClient(uri="./vectorops_demo.db")\n\n' +
        'def chunk_docs(docs, size=' + p.chunkSize + ', overlap=' + p.chunkOverlap + ', by_heading=' +
        String(p.byHeading) + '):\n' +
        '    # 本页实现：按标题切，再对超长段做定长滑窗\n' +
        '    chunks = []\n' +
        '    for doc in docs:\n' +
        '        units = split_by_heading(doc) if by_heading else [doc.text]\n' +
        '        chunks += window(units, size, overlap)\n' +
        '    return chunks\n\n' +
        'chunks = chunk_docs(docs, ' + p.chunkSize + ', ' + p.chunkOverlap + ', ' + String(p.byHeading) + ')\n' +
        'print(len(chunks))            # ' + (x.count || 0) + ' 个块\n' +
        'print(chunks[0]["source"])    # ' + (x.source || 'vectorops-*.md') + '\n' +
        'print(chunks[0]["acl"])       # 过滤要用的标量字段';
    } else if (stage.slug === 'embed') {
      s =
        '# 应用侧：向量化（Milvus 不生成 embedding）\n' +
        'import numpy as np\n\n' +
        'def embed_texts(texts, dim=' + p.dim + '):\n' +
        '    # 真实项目在这里调用 OpenAI / BGE / 自建服务\n' +
        '    vectors = model.encode(texts, dim=dim)\n' +
        '    return vectors\n\n' +
        'vectors = embed_texts([c["text"] for c in chunks], dim=' + p.dim + ')\n' +
        (p.normalize
          ? 'vectors = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)\n'
          : '# 未归一化：COSINE 与 IP 的排序可能不同\n') +
        'print(vectors.shape)          # (' + (x.count || 0) + ', ' + p.dim + ')\n\n' +
        '# 维度一旦确定，集合 schema 的 dim 必须与它一致';
    } else if (stage.slug === 'schema') {
      s =
        '# DDL：应用侧定义 schema，Coordinator 执行\n' +
        'from pymilvus import MilvusClient, DataType, Function, FunctionType\n\n' +
        'schema = MilvusClient.create_schema(\n' +
        '    auto_id=' + (p.pk === 'varchar' ? 'True' : 'False') + ',\n' +
        '    enable_dynamic_field=' + String(p.dynamic) + ',\n' +
        ')\n' +
        'schema.add_field(field_name="id", datatype=DataType.' + (p.pk === 'varchar' ? 'VARCHAR' : 'INT64') +
        (p.pk === 'varchar' ? ', max_length=64' : '') + ', is_primary=True)\n' +
        'schema.add_field(field_name="dense", datatype=DataType.FLOAT_VECTOR, dim=' + p.dim + ')\n' +
        'schema.add_field(field_name="text", datatype=DataType.VARCHAR, max_length=2000, enable_analyzer=True)\n' +
        (p.bm25
          ? 'schema.add_field(field_name="sparse", datatype=DataType.SPARSE_FLOAT_VECTOR)\n\n' +
            'bm25 = Function(\n' +
            '    name="text_bm25_emb",\n' +
            '    input_field_names=["text"],\n' +
            '    output_field_names=["sparse"],\n' +
            '    function_type=FunctionType.BM25,\n' +
            ')\n' +
            'schema.add_function(bm25)\n'
          : '# BM25 未启用：没有 sparse 字段，站 9 只剩 dense 一路\n') +
        '\nfor name in ["source", "dept", "version", "acl"]:\n' +
        '    schema.add_field(field_name=name, datatype=DataType.VARCHAR, max_length=128)\n' +
        'schema.add_field(field_name="updated", datatype=DataType.INT64)\n\n' +
        '# 不提交 index_params 时，集合创建后未加载；建索引与 load 是后续步骤';
    } else if (stage.slug === 'index') {
      var params =
        p.indexType === 'HNSW'
          ? '{"M": ' + p.M + ', "efConstruction": ' + p.efConstruction + '}'
          : p.indexType === 'IVF_FLAT'
            ? '{"nlist": ' + p.nlist + '}'
            : '{}  # 参数以官方文档为准';
      s =
        '# DDL：应用侧给出索引参数，Data Node 负责构建\n' +
        'index_params = client.prepare_index_params()\n\n' +
        'index_params.add_index(\n' +
        '    field_name="dense",\n' +
        '    index_type="' + p.indexType + '",\n' +
        '    metric_type="' + p.metric + '",\n' +
        '    params=' + params + ',\n' +
        ')\n\n' +
        'client.create_collection(\n' +
        '    collection_name="vectorops_chunks",\n' +
        '    schema=schema,\n' +
        '    index_params=index_params,\n' +
        ')\n\n' +
        '# 索引文件由 Data Node 写入 Object Storage，Query Node 按需加载\n' +
        '# 访问点 ' + (x.visited || 0) + ' / recall@' + (x.k || 5) + ' ' + (x.recall == null ? '—' : (x.recall * 100).toFixed(0) + '%');
    } else if (stage.slug === 'write') {
      s =
        '# DML：一批数据从 Proxy 到 Streaming Node 与 WAL\n' +
        'batch = [\n' +
        '    {"id": i, "dense": vectors[i], "text": chunks[i]["text"],\n' +
        '     "source": chunks[i]["source"], "dept": chunks[i]["dept"],\n' +
        '     "version": chunks[i]["version"], "updated": chunks[i]["updated"],\n' +
        '     "acl": chunks[i]["acl"]}\n' +
        '    for i in range(' + (x.offset || 0) + ', ' + ((x.offset || 0) + p.batch) + ')\n' +
        ']\n\n' +
        'res = client.insert(\n' +
        '    collection_name="vectorops_chunks",\n' +
        '    data=batch,\n' +
        ')\n' +
        'print(res)\n' +
        '# {"insert_count": ' + p.batch + ', "ids": [...], "cost": 0}\n\n' +
        '# consistency_level 在集合或查询层设置：' + p.consistency + '\n' +
        '# 可见时间取决于段状态与一致性级别，不是 insert 返回即全集群可见';
    } else if (stage.slug === 'query') {
      var qef =
        p.indexType === 'IVF_FLAT'
          ? '"nprobe": ' + p.nprobe
          : '"ef": ' + p.ef;
      s =
        '# DQL：同一个模型把问题变成同一空间的向量\n' +
        'query_vector = embed_texts([question], dim=' + p.dim + ')[0]\n\n' +
        'res = client.search(\n' +
        '    collection_name="vectorops_chunks",\n' +
        '    data=[query_vector],\n' +
        '    limit=' + p.limit + ',\n' +
        '    search_params={"metric_type": "' + p.metric + '", "params": {' + qef + '}},\n' +
        '    output_fields=["text", "source", "dept"],\n' +
        ')\n\n' +
        'print(res[0][0]["distance"])\n' +
        'print(res[0][0]["entity"]["text"])';
    } else if (stage.slug === 'route') {
      s =
        '# 应用侧只发一次 search；路由与三级归并对应用透明\n' +
        'res = client.search(\n' +
        '    collection_name="vectorops_chunks",\n' +
        '    data=[query_vector],\n' +
        '    limit=' + p.limit + ',\n' +
        '    search_params={"metric_type": "' + p.metric + '", "params": {' +
        (p.indexType === 'IVF_FLAT' ? '"nprobe": ' + p.nprobe : '"ef": ' + p.ef) + '}},\n' +
        '    consistency_level="' + p.consistency + '",\n' +
        '    output_fields=["text"],\n' +
        ')\n\n' +
        '# Proxy 归并各 Streaming Node；Streaming Node 归并各 Query Node；\n' +
        '# Query Node 归并各 segment。中间层只保留 Top-k。';
    } else if (stage.slug === 'filter') {
      s =
        '# 过滤条件写进 search，而不是拿到结果后再筛\n' +
        'res = client.search(\n' +
        '    collection_name="vectorops_chunks",\n' +
        '    data=[query_vector],\n' +
        '    filter=\'' + (x.expression || '') + '\',\n' +
        '    limit=' + p.limit + ',\n' +
        '    output_fields=["text", "source", "dept", "acl"],\n' +
        ')\n\n' +
        'print(len(res[0]))  # ' + (x.results == null ? '…' : x.results) + ' 条\n' +
        '# 多租户隔离还可选 database / collection / partition / partition key';
    } else if (stage.slug === 'hybrid') {
      var rerank =
        p.ranker === 'rrf'
          ? 'RRFRanker(k=60)'
          : 'WeightedRanker(' + p.wSparse + ', ' + p.wDense + ')';
      if (p.bm25) {
        s =
          '# 混合检索：两路 ANN + 一次融合，发生在 Milvus 内\n' +
          'from pymilvus import AnnSearchRequest, WeightedRanker\n\n' +
          'dense_req = AnnSearchRequest(\n' +
          '    [query_vector], "dense",\n' +
          '    {"metric_type": "' + p.metric + '"}, limit=' + p.limit + ',\n' +
          ')\n' +
          'sparse_req = AnnSearchRequest(\n' +
          '    [question], "sparse",\n' +
          '    {"metric_type": "BM25"}, limit=' + p.limit + ',\n' +
          ')                         # BM25 Function 接收原文，无需 embedding\n\n' +
          'res = client.hybrid_search(\n' +
          '    collection_name="vectorops_chunks",\n' +
          '    reqs=[sparse_req, dense_req],\n' +
          '    ranker=' + rerank + ',\n' +
          '    limit=' + p.limit + ',\n' +
          '    output_fields=["text", "source"],\n' +
          ')\n\n' +
          '# sparse 路索引：SPARSE_INVERTED_INDEX + MetricType.BM25';
      } else {
        s =
          '# BM25 字段未启用，这一站只能走 dense 单路\n' +
          'res = client.search(\n' +
          '    collection_name="vectorops_chunks",\n' +
          '    data=[query_vector],\n' +
          '    anns_field="dense",\n' +
          '    limit=' + p.limit + ',\n' +
          '    output_fields=["text", "source"],\n' +
          ')\n\n' +
          '# 若需要混合检索：回到站 3 打开 text + sparse + BM25 Function';
      }
    } else if (stage.slug === 'answer') {
      s =
        '# 应用侧：重排 → 拼上下文 → 生成（页面不联网、不执行）\n' +
        'candidates = res[0]  # Milvus 已经把候选交回应用\n\n' +
        (p.rerank ? 'top = rerank(question, candidates)  # 可选：PyMilvus 的 reranker 集成\n' : 'top = candidates  # 未启用重排，沿用融合顺序\n') +
        'top = top[:' + p.topN + ']\n\n' +
        'context = "\\n\\n".join(f"[{c.id}] {c.text}" for c in top)\n' +
        'prompt = f"只依据下面的资料回答，并标注引用：\\n{context}\\n\\n问题：{question}"\n' +
        '# token 预算：' + p.budget + '（页面估算），超出时截断最后一段\n\n' +
        'if top[0].score < ' + p.threshold + ':\n' +
        '    answer = "资料中没有足够依据，无法确认。"\n' +
        'else:\n' +
        '    answer = llm.chat(prompt)  # 任意 LLM 客户端；不出现真实密钥或端点';
    }
    return s;
  }

  var api = {
    LINKS: LINKS,
    VERSION: VERSION,
    LANES: LANES,
    INDEX_TABLE: INDEX_TABLE,
    CONSISTENCY: CONSISTENCY,
    ISOLATION: ISOLATION,
    GLOSSARY: GLOSSARY,
    COPY: COPY,
    STAGES: STAGES,
    snippet: snippet
  };
  root.MILVUS = root.MILVUS || {};
  root.MILVUS.data = root.MILVUS.data || {};
  root.MILVUS.data.milvus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
