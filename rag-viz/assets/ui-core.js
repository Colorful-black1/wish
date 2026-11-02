/* ============================================================================
 * ui-core.js —— 状态、导航、公共组件、每次重算的「视图模型」
 * 所有阶段内容都由 computeView() 的同一份结果渲染，保证 9 个页面讲的是同一件事。
 * ========================================================================== */

(function (global) {
  "use strict";

  const E = global.RAG_ENGINE;
  const D = global.RAG_DATA;
  const UI = {};
  global.UI = UI;
  UI.stages = {};

  /* ------------------------------------------------------------ 阶段定义 */

  const GROUPS = [
    { name: "离线 · 建库", color: "#7dd3fc", ids: ["parse", "chunk", "embed", "index"] },
    { name: "在线 · 查询理解", color: "#f0abfc", ids: ["rewrite"] },
    { name: "在线 · 召回与排序", color: "#22d3ee", ids: ["retrieve", "rerank"] },
    { name: "生成与治理", color: "#fbbf24", ids: ["generate", "verify"] }
  ];

  const STAGES = [
    {
      id: "parse",
      name: "解析",
      en: "PARSE",
      color: "#7dd3fc",
      tagline: "先别急着切块：把格式、表格、权限这些「文档的壳」剥干净。",
      why:
        "企业文档是给人看的，不是给检索看的：PDF 里表格是坐标、网页里正文混着导航、扫描件是图片。" +
        "解析（Parsing）要还原阅读顺序、识别标题层级、抽出表格，并打上来源、部门、版本、密级这些元数据。",
      notes: [
        "多源接入：文件、数据库、飞书/钉钉、网页抓取。按部门与密级分区，别让财务文档被全员搜到。",
        "版式还原：双栏 PDF 的阅读顺序、页眉页脚去噪、表格转 Markdown、扫描件走 OCR（光学字符识别）。",
        "清洗与去重：SimHash/MinHash 去掉转载与模板页，否则 Top-K 会被同一段话占满。",
        "元数据是后面的「过滤器」和「引用」：source、h2、updated、dept、version、acl 缺一不可。",
        "解析错了，后面全错：表格拆成散字之后，再强的 embedding 也救不回来。"
      ],
      pitfall: "本页用 Markdown 演示，所以「解析」这一步看起来简单。真实项目里它往往是最脏、最耗时的一步。"
    },
    {
      id: "chunk",
      name: "分块",
      en: "CHUNK",
      color: "#34d399",
      tagline: "块是检索的最小单位：切多大、要不要重叠、标题算不算边界。",
      why:
        "模型和向量库都吃不下整篇文档，所以要切成块（Chunk）。块太大 → 语义被稀释、召回不精准；" +
        "块太小 → 一段话被拆散、上下文不完整。这是 RAG 里最需要「用评测集调」的参数。",
      notes: [
        "四种常见策略：固定长度、递归切分（按段落→句子）、标题感知、语义切分（按 embedding 相似度断点）。",
        "结构感知的分块会保留标题元数据；纯文本切分不保留 —— 后面按章节判定对错会全算错。",
        "overlap（块重叠）的语义是「最多带这么多字」，不是「一定带这么多字」，实测经常是 0。",
        "父子块：用小块检索（精准），命中后把父块/相邻块一起喂给模型（上下文完整）。",
        "块大小要低于 embedding 模型的单条输入上限，超了不是截断，是直接报错（rag/README 坑 1）。"
      ],
      pitfall: "把 chunk_size 从 200 拖到 500，看块数和中位长度怎么变；再切到「纯递归」，注意元数据覆盖率掉到 0。"
    },
    {
      id: "embed",
      name: "向量化",
      en: "EMBED",
      color: "#a3e635",
      tagline: "把文本压成一串数字；语义近的点，在空间里也近。",
      why:
        "Embedding（嵌入）模型把一段文本映射成一个高维向量（这里是示意 64 维，bge-large-zh 是 1024 维）。" +
        "比较两个向量夹角的余弦（cosine），就得到「语义有多像」。注意是语义，不是字面。",
      notes: [
        "双塔（bi-encoder）：问题和文档分别编码，所以文档向量可以离线算好、建索引。",
        "归一化后余弦相似度 = 点积；余弦排序和欧氏距离排序等价（rag/02 实测）。",
        "向量不擅长否定：「可以折算」和「不能折算」相似度 0.934，比三种同义问法还高。",
        "维度、语言、领域都要选：中文用 bge-m3 / bge-large-zh，多语言或代码另有专门的模型。",
        "文档向量离线算一次即可；查询向量每次都要算，所以查询侧延迟通常只有十几毫秒。"
      ],
      pitfall: "点开任意两个块，看它们的余弦；再点查询点，看「语义最近」和「真的有答案」是不是一回事。"
    },
    {
      id: "index",
      name: "建索引",
      en: "INDEX",
      color: "#60a5fa",
      tagline: "全量扫描 O(N) 顶不住百万块，所以要 ANN。",
      why:
        "向量库（Vector DB）负责存向量、存元数据、建 ANN（Approximate Nearest Neighbor，近似最近邻）索引。" +
        "精确检索要跟每个块算距离（Flat，全扫描）；ANN 用图或聚类把搜索范围收窄，用一点点召回率换数量级的延迟。",
      notes: [
        "HNSW（分层可导航小世界图）：上层稀疏、用于跨簇跳转；下层稠密、用于精细收窄。",
        "M 控制每层最多连几个邻居：越大越准、内存越多、构建越慢。",
        "IVF-PQ（倒排+乘积量化）：先聚类再只搜最近的几个簇，向量还能压缩到 1/10 内存；代价是召回。",
        "BM25 走的是倒排索引（inverted index）：词 → 出现过的块，天生适合编号、型号、人名。",
        "别忘了标量索引：按部门、时间、密级过滤，往往比向量本身更能决定「能不能搜到」。",
        "增量更新是工程难点：新文档进来要能插入图，而不是每天全量重建。"
      ],
      pitfall: "本页只有 31 个块，HNSW 的优势看不出来（甚至比全扫描更慢）。打开下面的规模估算，看 N 变大之后差距怎么拉开。"
    },
    {
      id: "rewrite",
      name: "查询理解",
      en: "QUERY",
      color: "#f0abfc",
      tagline: "用户说的话，和文档写的字，经常对不上。",
      why:
        "用户会省略、会口语、会用代词。查询理解（Query Understanding）负责补全指代、识别意图、" +
        "把问题翻译成更容易检索的形态，再决定走 FAQ 直答、检索、工具调用还是转人工。",
      notes: [
        "改写（Rewrite）：补全「它/那个」、去掉口语噪声、把「交单据」改成「提交报销单」。",
        "多查询（Multi-Query）：生成 3~5 个变体分别召回再融合，覆盖面更广，也会引入噪声。",
        "HyDE（假设性文档嵌入）：先让模型写一段「假答案」，用假答案去检索。适合问题很短、文档很长。",
        "意图路由：能直答的 FAQ 不走向量检索；需要算数的走工具；查不到的直接拒答。",
        "改写不是免费午餐：可能把关键实体改丢，必须用评测集验证（rag/README 坑 6）。"
      ],
      pitfall: "打开「LLM 改写」再对比关闭时的检索结果 —— 本页的语料上改写不一定更好，这正是重点。"
    },
    {
      id: "retrieve",
      name: "混合召回",
      en: "RETRIEVE",
      color: "#22d3ee",
      tagline: "向量管语义，BM25 管精确词，两路排名再融合。",
      why:
        "单路召回都有盲区：向量对「E1024 和 E1025」这种相似编号不敏感，BM25 对「交单据 vs 提交报销单」" +
        "这种同义改写完全失灵。企业级做法是混合检索（Hybrid Search）：两路并行召回，再用 RRF 融合排名。",
      notes: [
        "dense（稠密向量）召回：Top-K 近邻，语义泛化强，但对精确 token 弱。",
        "sparse（稀疏/关键词）召回：BM25 的 IDF 会自动压低「公司」「可以」这类到处出现的词。",
        "RRF（倒数排名融合）：score = Σ 1/(k+rank)，只看名次不看分数，所以不用调权重、不怕量纲不同。",
        "元数据过滤：权限、时效、部门。pre-filter 会缩小候选池，post-filter 可能导致召回数量不足。",
        "多路召回之后还要考虑多样性（MMR），否则 Top-5 可能全是同一段话的复制块。",
        "ANN 是近似的：用 Recall@K（召回率）和延迟一起看，别只看延迟。"
      ],
      pitfall: "把「混合检索」关掉，看 q2 的正确答案会不会掉出 Top-3；再打开 ANN 轨迹，数一数算了多少次距离。"
    },
    {
      id: "rerank",
      name: "重排序",
      en: "RERANK",
      color: "#fbbf24",
      tagline: "召回要快要全，排序要准 —— 贵的模型只处理少数候选。",
      why:
        "召回阶段为了快，用的是双塔模型：问题和文档各自编码，没见过彼此。重排（Rerank）用 cross-encoder（交叉编码器）" +
        "把 (问题, 候选块) 拼起来一起读，判断「这段话到底能不能回答问题」。它准得多，但也慢得多，所以只处理 Top-20/50。",
      notes: [
        "两阶段范式：便宜的方法负责「不漏」，贵的方法负责「排对」。",
        "打分看的是「答案覆盖度」，不是「主题相关」：讲住宿的段落，不一定有你要的 600 元。",
        "常用模型：bge-reranker-v2-m3、Cohere Rerank；也有 ColBERT 这种「迟交互」方案，把 token 向量存下来再比。",
        "延迟与成本随候选数线性增长：Top-20 常见，Top-100 要算清楚预算。",
        "重排也会出错：它只比较文本，不知道权限和时效，所以过滤要放在它前面。"
      ],
      pitfall: "对比左右两列的名字和分数：有些块排名上升，有些下跌。点一个候选，看它为什么被降权。"
    },
    {
      id: "generate",
      name: "上下文与生成",
      en: "GENERATE",
      color: "#fb923c",
      tagline: "上下文不是越多越好：去重、压缩、排序、控预算。",
      why:
        "把 Top-N 块拼成上下文（Context），再套进提示词（Prompt）让模型回答。这里有两个工程细节：" +
        "token 预算（塞太多既贵又容易让模型迷失）和顺序（关键证据放在开头/结尾，别放在中间）。",
      notes: [
        "上下文压缩：抽取式只留相关句、或用小模型先摘要，能显著降 token。",
        "去重：同一段话被切成多块、或父块和子块同时命中，会浪费预算。",
        "lost in the middle：长上下文里，模型对中间部分的利用率最低。",
        "提示词要硬约束：只依据资料回答、必须标引用编号、资料不足就拒答。",
        "流式输出：首 token 延迟比总耗时更影响体感；引用可以在流式结束后逐条校验。"
      ],
      pitfall: "打开「不加引用约束」，看裸模型会怎么编 —— 这就是 RAG 想解决的问题。"
    },
    {
      id: "verify",
      name: "校验与评测",
      en: "VERIFY",
      color: "#4ade80",
      tagline: "有出处、可核对、该拒答就拒答 —— 决定能不能上线的一站。",
      why:
        "生成完不等于结束：要逐句检查引用是否真的支持这句话（忠实度 / groundedness），" +
        "要用评测集持续衡量检索与回答的质量，还要把每一站的耗时和成本记录下来。",
      notes: [
        "引用校验：答案里的每一句，能不能在它引用的块里找到原文？找不到就是幻觉。",
        "拒答策略：最高分低于阈值、或关键事实缺失时，宁可说「资料里没有」。",
        "检索指标：Recall@K（召回率）、MRR（平均倒数排名）、nDCG；回答指标：RAGAS 的 faithfulness、answer relevancy、context precision/recall。",
        "评测集要有难例：全是简单题时，所有方法都是 1.00，指标会饱和（rag/README 坑 9）。",
        "线上要看分阶段耗时、token 成本、拒答率、用户点踩率；离线评测和线上 A/B 缺一不可。"
      ],
      pitfall: "把拒答阈值拖到最低，看那条「无答案」问题怎么从拒答变成硬答 —— 阈值就是产品策略。"
    }
  ];

  const STAGE_INDEX = {};
  STAGES.forEach((s, i) => (STAGE_INDEX[s.id] = i));

  /* ------------------------------------------------------------ 状态 */

  const S = {
    stage: 0,
    playing: false,
    queryId: "q1",
    queryText: D.QUERIES[0].text,
    chunk: { strategy: "markdown_recursive", size: 200, overlap: 40 },
    index: { type: "hnsw", M: 6 },
    search: {
      denseK: 8,
      sparseK: 8,
      efSearch: 16,
      useHybrid: true,
      useRerank: true,
      rerankN: 16,
      contextN: 4,
      rrfK: 60,
      denseWeight: 1,
      sparseWeight: 1,
      filterMode: "pre",
      filters: { docs: [], freshOnly: false }
    },
    query: { rewrite: false, multi: false, hyde: false },
    ctx: { compress: false, order: "score", budget: 900, threshold: 0.45, freeform: false },
    selectedChunkId: null,
    selectedRank: null,
    lastView: null
  };
  UI.state = S;

  let playTimer = 0;
  let queryDebounce = 0;

  /* ------------------------------------------------------------ DOM 工具 */

  /**
   * 极简 h()：h("div", {class:"x", on:{click}}, child...)
   * 属性支持 class/style/dataset/html/aria 与普通字符串。
   */
  function h(tag, attrs) {
    const node = document.createElement(tag);
    const a = attrs || {};
    Object.keys(a).forEach((k) => {
      const v = a[k];
      if (v == null || v === false) return;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k === "style" && typeof v === "object") {
        if (v.nodeType || Array.isArray(v)) return;
        // 自定义属性（--c / --lane-color…）必须走 setProperty，
        // 直接 style["--c"] = x 在浏览器里是静默失败的（踩过）。
        Object.keys(v).forEach((prop) => {
          if (prop.indexOf("--") === 0) node.style.setProperty(prop, String(v[prop]));
          else node.style[prop] = v[prop];
        });
      }
      else if (k === "on" && typeof v === "object") {
        Object.keys(v).forEach((ev) => node.addEventListener(ev, v[ev]));
      } else if (k === "dataset") {
        Object.keys(v).forEach((dk) => (node.dataset[dk] = v[dk]));
      } else if (k === "aria") {
        Object.keys(v).forEach((ak) => node.setAttribute("aria-" + ak, v[ak]));
      } else {
        node.setAttribute(k, v);
      }
    });
    for (let i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach((c) => append(node, c));
      return;
    }
    node.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }

  function frag(children) {
    const f = document.createDocumentFragment();
    (children || []).forEach((c) => append(f, c));
    return f;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const fmt = {
    ms(ms) {
      if (ms == null) return "—";
      if (ms < 1) return ms.toFixed(2) + " ms";
      if (ms < 10) return ms.toFixed(1) + " ms";
      if (ms < 1000) return Math.round(ms) + " ms";
      return (ms / 1000).toFixed(2) + " s";
    },
    msShort(ms) {
      if (ms == null) return "—";
      if (ms < 1) return ms.toFixed(1);
      if (ms < 1000) return Math.round(ms) + "ms";
      return (ms / 1000).toFixed(1) + "s";
    },
    score(x) {
      return x == null ? "—" : Number(x).toFixed(3);
    },
    pct(x) {
      return x == null ? "—" : Math.round(x * 100) + "%";
    },
    num(x) {
      return Number(x).toLocaleString("zh-CN");
    }
  };
  UI.h = h;
  UI.frag = frag;
  UI.esc = esc;
  UI.fmt = fmt;

  function docById(id) {
    return D.DOCS.find((d) => d.id === id);
  }
  UI.docById = docById;

  /* ------------------------------------------------------ 视图模型计算 */

  let memo = { key: "", view: null };

  /** 把当前状态整理成 engine 需要的检索参数。 */
  function searchState() {
    return {
      queryId: S.queryId,
      customQuery: S.queryText,
      denseK: S.search.denseK,
      sparseK: S.search.sparseK,
      efSearch: S.search.efSearch,
      indexType: S.index.type,
      useHybrid: S.search.useHybrid,
      useRerank: S.search.useRerank,
      rerankN: S.search.rerankN,
      contextN: S.search.contextN,
      rrfK: S.search.rrfK,
      denseWeight: S.search.denseWeight,
      sparseWeight: S.search.sparseWeight,
      filters: S.search.filters,
      filterMode: S.search.filterMode,
      useRewrite: S.query.rewrite,
      useMultiQuery: S.query.multi,
      useHyde: S.query.hyde
    };
  }
  UI.searchState = searchState;

  /** 分阶段耗时（模拟）：离线建库 + 在线问答，单位 ms。 */
  function buildTimings(pack, ret, ctx, answer) {
    const n = pack.chunks.length;
    const answerChars = (answer.sentences || []).reduce((a, s) => a + s.text.length, 0);
    const llm = E.TIMING.llmBase + answerChars * 0.62 * E.TIMING.llmPerToken;
    const t = {
      parse: 240 + D.DOCS.length * 34,
      chunk: E.TIMING.chunk(n),
      embed: E.TIMING.embed(n),
      index: E.TIMING.index(n) + (S.index.type === "hnsw" ? n * 0.65 : 0),
      rewrite: S.query.rewrite ? E.TIMING.rewrite : 0,
      multi: S.query.multi ? E.TIMING.multi : 0,
      hyde: ret.usedHyde ? E.TIMING.hyde : 0,
      queryEmbed: E.TIMING.queryEmbed,
      ann: ret.timings.ann || 0,
      bm25: ret.timings.bm25 || 0,
      fuse: ret.timings.fuse || 0,
      rerank: ret.timings.rerank || 0,
      context: E.TIMING.context,
      llm,
      verify: answer.refused ? 120 : E.TIMING.verify
    };
    t.online = t.rewrite + t.multi + t.hyde + t.queryEmbed + t.ann + t.bm25 + t.fuse + t.rerank + t.context + t.llm + t.verify;
    t.offline = t.parse + t.chunk + t.embed + t.index;
    t.total = t.online + (S.stage >= 3 ? t.offline : 0);
    return t;
  }

  /** 计算一次完整的视图模型（建库 → 检索 → 上下文 → 回答 → 校验）。 */
  function computeView() {
    const key = JSON.stringify([S.queryId, S.queryText, S.chunk, S.index, S.search, S.query, S.ctx.threshold, S.ctx.freeform]);
    if (memo.key === key && memo.view) return memo.view;

    const pack = E.buildPack({
      strategy: S.chunk.strategy,
      chunkSize: S.chunk.size,
      overlap: S.chunk.overlap,
      M: S.index.M,
      indexType: S.index.type
    });
    const ret = E.retrieve(pack, searchState());
    const ctx = E.assembleContext(ret.reranked, {
      topN: S.search.contextN,
      budgetTokens: S.ctx.budget,
      compress: S.ctx.compress,
      order: S.ctx.order,
      queryText: ret.query.text
    });
    const answer = E.composeAnswer(ret.query, ctx, { threshold: S.ctx.threshold, freeform: S.ctx.freeform });
    const verify = E.verifyClaims(answer, ctx, ret.query);
    const timings = buildTimings(pack, ret, ctx, answer);
    const cost = E.estimateCost(ctx.tokens, (answer.sentences || []).reduce((a, s) => a + s.text.length, 0));

    const view = { pack, ret, ctx, answer, verify, timings, cost, state: S };
    memo = { key, view };
    return view;
  }
  UI.computeView = computeView;
  UI.invalidate = function () {
    memo = { key: "", view: null };
  };

  /* ------------------------------------------------------------ 导航 */

  function stageTiming(id, view) {
    const t = view.timings;
    switch (id) {
      case "parse":
        return t.parse;
      case "chunk":
        return t.chunk;
      case "embed":
        return t.embed;
      case "index":
        return t.index;
      case "rewrite":
        return t.rewrite + t.multi + t.hyde + t.queryEmbed;
      case "retrieve":
        return t.ann + t.bm25 + t.fuse;
      case "rerank":
        return t.rerank;
      case "generate":
        return t.context + t.llm;
      case "verify":
        return t.verify;
      default:
        return 0;
    }
  }

  function renderRail(view) {
    const wrap = document.getElementById("rail-groups");
    wrap.innerHTML = "";
    GROUPS.forEach((g) => {
      const group = h("div", { class: "rail-group", style: { "--group-color": g.color } });
      group.appendChild(h("div", { class: "rail-group-title", text: g.name }));
      g.ids.forEach((id) => {
        const i = STAGE_INDEX[id];
        const st = STAGES[i];
        const active = S.stage === i;
        const done = S.stage > i;
        const btn = h(
          "button",
          {
            class: "stage-item" + (active ? " is-active" : "") + (done ? " is-done" : ""),
            "aria-current": active ? "step" : null,
            dataset: { stage: i },
            on: {
              click: () => go(i)
            }
          },
          h("span", { class: "num", text: active || done ? (done ? "✓" : String(i + 1)) : String(i + 1) }),
          h("span", { class: "names" }, h("span", { class: "cn", text: st.name }), h("span", { class: "en", text: st.en })),
          h("span", { class: "ms", text: fmt.msShort(stageTiming(id, view)) })
        );
        group.appendChild(btn);
      });
      wrap.appendChild(group);
    });
    document.getElementById("rail-progress").textContent = S.stage + 1 + " / 9";
  }

  function renderHead(view, extraBadges) {
    const st = STAGES[S.stage];
    const head = document.getElementById("stage-head");
    head.innerHTML = "";
    head.appendChild(
      h(
        "div",
        { style: { minWidth: "0" } },
        h(
          "div",
          { class: "stage-kicker", style: { "--stage-color": st.color } },
          h("span", { text: "STAGE " + String(S.stage + 1).padStart(2, "0") }),
          h("span", { class: "idx", text: "/ 09" }),
          h("span", { text: st.en })
        ),
        h("h2", {}, st.name, h("small", { text: st.en })),
        h("p", { text: st.tagline })
      )
    );
    const badges = h("div", { class: "stage-badges" });
    (extraBadges || []).forEach((b) => badges.appendChild(b));
    badges.appendChild(h("span", { class: "badge info" }, h("span", { class: "dot" }), fmt.ms(stageTiming(st.id, view))));
    head.appendChild(badges);
  }

  function renderStatus(view) {
    const log = document.getElementById("status-log");
    log.innerHTML = "";
    const q = view.ret.query;
    const msg = {
      parse: `解析 ${D.DOCS.length} 份文档 · ${fmt.num(view.pack.chunks.reduce((a, c) => a + c.chars, 0))} 字 · 元数据覆盖 ${fmt.pct(view.pack.stats.metaRate)}`,
      chunk: `切出 ${view.pack.stats.count} 块 · 中位 ${view.pack.stats.median} 字 · 平均实际重叠 ${view.pack.stats.avgOverlap.toFixed(1)} 字`,
      embed: `${view.pack.stats.count} 个块 × 1024 维（示意 64 维）· 查询向量 ${fmt.ms(view.timings.queryEmbed)}`,
      index: `${S.index.type.toUpperCase()} 索引 · M=${S.index.M} · 图规模 ${view.pack.stats.count} 点`,
      rewrite: `${S.query.rewrite ? "已改写" : "未改写"} · 多查询 ${S.query.multi ? "开" : "关"} · HyDE ${S.query.hyde ? "开" : "关"}`,
      retrieve: `候选池 ${view.ret.poolSize} · 向量 ${view.ret.dense.length} + 关键词 ${view.ret.sparse.length} → 融合 ${view.ret.fused.length} · ANN 召回 ${view.ret.recall == null ? "—" : fmt.pct(view.ret.recall)}`,
      rerank: `${view.ret.rerankN} 个候选 → Top-${view.ret.reranked.length} · ${fmt.ms(view.timings.rerank)}`,
      generate: `上下文 ${view.ctx.items.length} 块 · ${view.ctx.tokens} tokens · 首字 ${fmt.ms(view.timings.llm * 0.28)}`,
      verify: `忠实度 ${view.verify.faithfulness.toFixed(2)} · 事实覆盖 ${view.verify.factCoverage == null ? "—" : fmt.pct(view.verify.factCoverage)} · 总耗时 ${fmt.ms(view.timings.online)}`
    }[STAGES[S.stage].id];
    log.appendChild(h("span", { class: "tick" }));
    log.appendChild(h("b", { text: "q" + (S.queryId === "custom" ? "?" : S.queryId.replace("q", "")) + " · " + (q.text.length > 26 ? q.text.slice(0, 26) + "…" : q.text) }));
    log.appendChild(h("span", { text: "—" }));
    log.appendChild(h("span", { text: msg }));

    const metrics = document.getElementById("status-metrics");
    metrics.innerHTML = "";
    const items = [
      ["块", view.pack.stats.count],
      ["在线", fmt.msShort(view.timings.online)],
      ["上下文", view.ctx.tokens + " tok"],
      ["成本", "¥" + view.cost.cny.toFixed(4)]
    ];
    items.forEach(([k, v]) => {
      const span = h("span", {}, k + " ");
      span.appendChild(h("b", { text: String(v) }));
      metrics.appendChild(span);
    });
  }

  /* ------------------------------------------------------------ 渲染 */

  function render(opts) {
    const view = computeView();
    UI.lastView = view;

    const body = document.getElementById("stage-body");
    if (UI.scene) {
      UI.camera = UI.scene.getCamera ? UI.scene.getCamera() : null;
      UI.scene.destroy();
      UI.scene = null;
    }
    body.innerHTML = "";
    const def = UI.stages[STAGES[S.stage].id];
    let out = null;
    if (def) {
      out = def.render(view);
      body.appendChild(out.body || out);
    } else {
      body.appendChild(h("div", { class: "card" }, h("div", { class: "card-body", text: "这一站还没实现。" })));
    }

    renderRail(view);
    renderHead(view, out && out.badges);
    renderStatus(view);
    if (opts && opts.scroll !== false) body.scrollTop = 0;
  }
  UI.render = render;

  /** 供其它模块切换检索子标签（也可以从 URL 里指定）。 */
  UI.setRetTab = function (v) {
    if (UI.retTabSetter) UI.retTabSetter(v);
  };

  /**
   * 解析 `#stage?q=q3&hybrid=0&rerank=0` 这类链接，方便把某个状态分享给自己/同事。
   * 只做少量常用参数，不是完整的序列化。
   */
  function applyUrlState() {
    const raw = location.hash.replace(/^#/, "");
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch (e) {
      /* 非法的 % 编码就按原样处理 */
    }
    const parts = decoded.split("?");
    const stageId = parts[0];
    if (stageId && STAGE_INDEX[stageId] != null) S.stage = STAGE_INDEX[stageId];
    if (!parts[1]) return null;
    const p = new URLSearchParams(parts[1]);
    const num = (key) => (p.get(key) == null ? null : Number(p.get(key)));
    const bool = (key) => (p.get(key) == null ? null : p.get(key) === "1");

    if (p.get("q")) {
      const q = D.QUERIES.find((x) => x.id === p.get("q"));
      if (q) {
        S.queryId = q.id;
        S.queryText = q.text;
      }
    }
    if (p.get("strategy")) S.chunk.strategy = p.get("strategy");
    if (num("size") != null) S.chunk.size = num("size");
    if (num("overlap") != null) S.chunk.overlap = num("overlap");
    if (num("M") != null) S.index.M = num("M");
    if (p.get("index")) S.index.type = p.get("index");
    [
      ["k", "denseK"],
      ["sk", "sparseK"],
      ["ef", "efSearch"],
      ["ctx", "contextN"],
      ["rrn", "rerankN"]
    ].forEach(([key, field]) => {
      if (num(key) != null) S.search[field] = num(key);
    });
    [
      ["hybrid", "useHybrid"],
      ["rerank", "useRerank"]
    ].forEach(([key, field]) => {
      if (bool(key) != null) S.search[field] = bool(key);
    });
    [
      ["rewrite", "rewrite"],
      ["multi", "multi"],
      ["hyde", "hyde"]
    ].forEach(([key, field]) => {
      if (bool(key) != null) S.query[field] = bool(key);
    });
    if (num("threshold") != null) S.ctx.threshold = num("threshold");
    if (bool("freeform") != null) S.ctx.freeform = bool("freeform");
    if (bool("compress") != null) S.ctx.compress = bool("compress");
    if (p.get("order")) S.ctx.order = p.get("order");
    if (p.get("docs")) S.search.filters.docs = p.get("docs").split(",").filter(Boolean);
    if (p.get("fmode")) S.search.filterMode = p.get("fmode");
    return p;
  }

  /** 切换阶段；会自动更新 URL hash，便于分享到某一站。 */
  function go(i) {
    const next = Math.max(0, Math.min(STAGES.length - 1, i));
    if (next === S.stage) return;
    S.stage = next;
    S.selectedRank = null;
    history.replaceState(null, "", "#" + STAGES[next].id);
    render();
    if (next === STAGES.length - 1) stop();
  }
  UI.go = go;
  UI.next = function () {
    go(Math.min(STAGES.length - 1, S.stage + 1));
  };
  UI.prev = function () {
    go(Math.max(0, S.stage - 1));
  };

  /** 局部更新：只改数值、不整页重绘（滑块拖动时用）。一帧内多次调用会合并。 */
  let pendingFrame = 0;
  function rerender() {
    UI.invalidate();
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      render({ scroll: false });
    });
  }
  UI.rerender = rerender;

  function setState(patch, opts) {
    Object.assign(S, patch);
    UI.invalidate();
    if (!opts || opts.render !== false) render({ scroll: false });
  }
  UI.setState = setState;

  /* ------------------------------------------------------------ 自动播放 */

  function play() {
    if (S.playing) return;
    if (S.stage >= STAGES.length - 1) go(0);
    S.playing = true;
    updatePlayBtn();
    playTimer = setInterval(() => {
      if (S.stage >= STAGES.length - 1) {
        stop();
        return;
      }
      go(S.stage + 1);
    }, 2600);
  }

  function stop() {
    if (!S.playing && !playTimer) return;
    S.playing = false;
    clearInterval(playTimer);
    playTimer = 0;
    updatePlayBtn();
  }
  UI.play = play;
  UI.stop = stop;
  UI.togglePlay = function () {
    S.playing ? stop() : play();
  };

  function updatePlayBtn() {
    const b = document.getElementById("btn-play");
    b.textContent = S.playing ? "❚❚ 暂停" : "▶ 自动演示";
    b.classList.toggle("btn-primary", !S.playing);
  }

  /* ------------------------------------------------------------ 问题输入 */

  function renderPresets() {
    const pop = document.getElementById("preset-popover");
    pop.innerHTML = "";
    pop.appendChild(h("div", { class: "pop-head", text: "预设问题（来自 rag/ 评测集）" }));
    D.QUERIES.forEach((q) => {
      pop.appendChild(
        h(
          "button",
          {
            class: "pop-item" + (S.queryId === q.id ? " on" : ""),
            on: {
              click: () => {
                S.queryId = q.id;
                S.queryText = q.text;
                document.getElementById("query-input").value = q.text;
                pop.hidden = true;
                UI.invalidate();
                render();
              }
            }
          },
          q.label,
          h("small", { text: q.kind + " · " + q.text })
        )
      );
    });
  }

  function setupQuery() {
    const input = document.getElementById("query-input");
    input.value = S.queryText;
    input.addEventListener("input", () => {
      clearTimeout(queryDebounce);
      queryDebounce = setTimeout(() => {
        S.queryText = input.value.trim();
        S.queryId = "custom";
        UI.invalidate();
        render({ scroll: false });
      }, 380);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        clearTimeout(queryDebounce);
        S.queryText = input.value.trim();
        S.queryId = "custom";
        UI.invalidate();
        render({ scroll: false });
      }
      if (e.key === "Escape") input.blur();
    });

    const pop = document.getElementById("preset-popover");
    document.getElementById("btn-presets").addEventListener("click", (e) => {
      e.stopPropagation();
      renderPresets();
      pop.hidden = !pop.hidden;
    });
    document.addEventListener("click", (e) => {
      if (!pop.hidden && !pop.contains(e.target) && e.target.id !== "btn-presets") pop.hidden = true;
    });
  }

  /* ------------------------------------------------------------ 全景弹层 */

  let panoOpener = null;

  function openPanorama() {
    panoOpener = document.activeElement;
    const body = document.getElementById("modal-body");
    body.innerHTML = "";
    const grid = h("div", { class: "panorama" });
    D.PANORAMA.forEach((phase) => {
      const col = h("div", { class: "pano-col", style: { "--col-color": phase.color } });
      col.appendChild(h("h4", { text: phase.phase }));
      phase.items.forEach((it) => {
        col.appendChild(
          h(
            "div",
            { class: "pano-item" },
            h(
              "div",
              { class: "pi-name" },
              h("span", { text: it.name }),
              h("code", { text: it.en }),
              h("span", { class: "st" + (it.status === "demo" ? " demo" : ""), text: it.status === "demo" ? "可演示" : "说明" })
            ),
            h("div", { class: "pi-tip", text: it.tip })
          )
        );
      });
      grid.appendChild(col);
    });
    body.appendChild(grid);
    body.appendChild(
      h(
        "div",
        { class: "note", style: { "--note-color": "#22d3ee", marginTop: "16px" } },
        h("b", { text: "关于本页的简化：" }),
        "embedding 用 64 维概念向量代替（真实 bge-large-zh 是 1024 维），耗时是估算公式；" +
          "分块、BM25、RRF、HNSW 搜索、上下文组装、引用校验都是真实计算，不是画出来的。"
      )
    );
    document.getElementById("modal").hidden = false;
    document.getElementById("modal-close").focus();
  }

  function closePanorama() {
    const modal = document.getElementById("modal");
    if (modal.hidden) return;
    modal.hidden = true;
    if (panoOpener && panoOpener !== document.body && typeof panoOpener.focus === "function") {
      panoOpener.focus();
    }
    panoOpener = null;
  }

  /* ------------------------------------------------------------ 初始化 */

  function setupKeys() {
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        stop();
        UI.next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stop();
        UI.prev();
      } else if (e.key === " ") {
        e.preventDefault();
        UI.togglePlay();
      } else if (/^[1-9]$/.test(e.key)) {
        stop();
        go(parseInt(e.key, 10) - 1);
      } else if (e.key === "Escape") {
        closePanorama();
        document.getElementById("preset-popover").hidden = true;
      } else if (e.key === "?" || e.key === "/") {
        openPanorama();
      }
    });
  }

  function init() {
    setupQuery();
    setupKeys();
    document.getElementById("btn-step").addEventListener("click", () => {
      stop();
      UI.next();
    });
    document.getElementById("btn-play").addEventListener("click", UI.togglePlay);
    document.getElementById("btn-reset").addEventListener("click", () => {
      stop();
      S.stage = 0;
      history.replaceState(null, "", "#parse");
      render();
    });
    document.getElementById("btn-panorama").addEventListener("click", openPanorama);
    document.getElementById("modal-close").addEventListener("click", closePanorama);
    document.getElementById("modal").addEventListener("click", (e) => {
      if (e.target.id === "modal") closePanorama();
    });

    const p = applyUrlState();
    document.getElementById("query-input").value = S.queryText;
    if (p && p.get("tab")) UI.setRetTab(p.get("tab"));
    render();
    if (p && p.get("panel") === "panorama") openPanorama();
  }

  UI.init = init;
  UI.STAGES = STAGES;
  UI.GROUPS = GROUPS;
  UI.STAGE_INDEX = STAGE_INDEX;
})(window);
