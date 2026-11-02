/* ============================================================================
 * engine.js —— 检索内核（纯函数，无 DOM 依赖，可在 Node 里单测）
 *
 * 这里**真正实现**了：
 *   · 标题感知 + 递归装箱的分块器（含真实 overlap 计算、超长硬切标记）
 *   · BM25（中文 bigram 分词）倒排检索
 *   · RRF（倒数排名融合）
 *   · HNSW（分层图 + efSearch 提前终止 + 与全扫描的真值对比）
 *   · 抽取式「生成」与逐句引用校验
 *
 * 这里**模拟**的只有两处，UI 里都会明确标注：
 *   · embedding：用 64 维「概念向量」代替神经网络（真实是 1024 维）；
 *   · 耗时：按经验公式估算，用来比较量级，不是实测。
 * ========================================================================== */

(function (global) {
  "use strict";

  const DATA = global.RAG_DATA;
  const DIM = 64;

  /* ------------------------------------------------------------ 基础工具 */

  /** 字符串 → 32 位哈希，用于稳定的伪随机种子（同一个块每次刷新得到同一个向量）。 */
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** mulberry32：轻量确定性随机数生成器，返回 [0,1)。 */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function norm(a) {
    return Math.sqrt(dot(a, a));
  }

  function normalize(a) {
    const n = norm(a) || 1e-9;
    return a.map((x) => x / n);
  }

  /** 余弦相似度；输入向量已归一化，所以就是点积（和真实向量库一致）。 */
  function cosine(a, b) {
    return dot(normalize(a), normalize(b));
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  function round(x, n) {
    const p = Math.pow(10, n === undefined ? 3 : n);
    return Math.round(x * p) / p;
  }

  /** 把一条向量单位化并放大到指定维数，尾部用确定性噪声填充。 */
  function expand(dir3, rand, tail) {
    const v = new Array(DIM).fill(0);
    v[0] = dir3[0];
    v[1] = dir3[1];
    v[2] = dir3[2];
    for (let i = 3; i < DIM; i++) v[i] = (rand() * 2 - 1) * (tail || 0.35);
    return normalize(v);
  }

  /* ------------------------------------------------------ 概念向量与投影 */

  // 四份文档在语义空间里的「主题方向」（手工指定，方便看清聚类）。
  const DOC_DIR = {
    travel: [1.0, 0.22, 0.3],
    leave: [-0.72, 0.68, 0.3],
    security: [0.12, -0.86, 0.5],
    it: [0.1, 0.3, -0.95]
  };

  let conceptSpace = null;

  /**
   * 为每个概念生成一个 64 维方向向量。
   * 前 3 维是「可画出来」的主方向（靠近所属文档的主题方向），其余 61 维是噪声。
   * 这样 PCA 降到 3 维后，图上的远近和真实余弦大体一致。
   */
  function getConceptSpace() {
    if (conceptSpace) return conceptSpace;
    const dirs = {};
    const base3 = {};
    let seed = 20261029;
    Object.keys(DATA.CONCEPTS).forEach((key) => {
      const def = DATA.CONCEPTS[key];
      const rand = mulberry32(hashString(key) ^ seed);
      const doc = DOC_DIR[def.doc] || [0.3, 0.3, 0.3];
      const unique = [rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1];
      const mixed = normalize([
        0.78 * doc[0] + 0.62 * unique[0],
        0.78 * doc[1] + 0.62 * unique[1],
        0.78 * doc[2] + 0.62 * unique[2]
      ]);
      base3[key] = mixed;
      dirs[key] = expand(mixed, rand, 0.3);
    });
    const docVecs = {};
    Object.keys(DOC_DIR).forEach((id) => {
      docVecs[id] = expand(DOC_DIR[id], mulberry32(hashString("doc:" + id)), 0.25);
    });
    conceptSpace = { dirs, base3, docVecs };
    return conceptSpace;
  }

  /** 按概念权重构造一条单位向量；weights 形如 {lodging: 1, travel_policy: 0.2}。 */
  function vectorFromConcepts(weights, jitterSeed) {
    const space = getConceptSpace();
    const v = new Array(DIM).fill(0);
    let total = 0;
    Object.keys(weights || {}).forEach((k) => {
      const w = weights[k];
      const dir = space.dirs[k];
      if (!dir || !w) return;
      total += w;
      for (let i = 0; i < DIM; i++) v[i] += dir[i] * w;
    });
    if (total === 0) return null;
    if (jitterSeed !== undefined) {
      const rand = mulberry32(hashString(String(jitterSeed)));
      for (let i = 0; i < DIM; i++) v[i] += (rand() * 2 - 1) * 0.06;
    }
    return normalize(v);
  }

  /**
   * 把 64 维向量 PCA 降到 3 维，供画布渲染。
   * 返回 project(v) 与所有块的坐标；坐标已缩放到半径 ≈1 的球内。
   */
  function pca3(vectors) {
    const n = vectors.length;
    const d = vectors[0].length;
    const mean = new Array(d).fill(0);
    vectors.forEach((v) => v.forEach((x, i) => (mean[i] += x / n)));
    let X = vectors.map((v) => v.map((x, i) => x - mean[i]));
    const basis = [];
    for (let c = 0; c < 3; c++) {
      const rand = mulberry32(1234 + c * 77);
      let u = normalize(Array.from({ length: d }, () => rand() * 2 - 1));
      for (let iter = 0; iter < 80; iter++) {
        const y = new Array(d).fill(0);
        for (let k = 0; k < X.length; k++) {
          const s = dot(X[k], u);
          for (let i = 0; i < d; i++) y[i] += s * X[k][i];
        }
        const len = norm(y);
        if (len < 1e-9) break;
        u = y.map((x) => x / len);
      }
      basis.push(u);
      X = X.map((x) => {
        const s = dot(x, u);
        return x.map((v, i) => v - s * u[i]);
      });
    }
    const raw = (v) => {
      const c = v.map((x, i) => x - mean[i]);
      return basis.map((e) => dot(c, e));
    };
    const all = vectors.map(raw);
    let maxR = 1e-6;
    all.forEach((p) => (maxR = Math.max(maxR, Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]))));
    const scale = 0.96 / maxR;
    return {
      coords: all.map((p) => p.map((x) => x * scale)),
      basis,
      mean,
      project(v) {
        return raw(v).map((x) => x * scale);
      }
    };
  }

  /* -------------------------------------------------------------- 分词 */

  const STOP_BIGRAMS = new Set([
    "什么", "怎么", "多少", "哪些", "哪个", "可以", "需要", "时候", "为什", "么样",
    "一下", "请问", "是否", "能否", "我们", "你们", "他们", "这个", "那个", "现在",
    "如果", "因为", "所以", "但是", "然后", "还是", "就是", "已经", "没有", "不能",
    "一个", "以及", "对于", "关于", "通过", "进行", "这么", "那么", "怎样", "如何",
    "哪里", "几个", "几天", "多久", "最晚", "最早", "最多", "最少", "一般", "通常"
  ]);

  // 只保留真正有区分度的单位字：元（金额）、位（长度）、倍、级。
  // 「天/年/个」这种字几乎每篇文档都有，留着只会制造噪声（实测「今天天气」都能命中）。
  const UNIT_CHARS = new Set(["元", "位", "倍", "级"]);
  const STOP_CHARS = new Set("的了和与及在是有为对按等中个名这那哪些什么怎么被把就还也都很更次请问题吗呢啊吧我你他她它".split(""));

  /**
   * 中文 + 字母数字混合分词。
   * 中文用 bigram（两字滑窗）—— 不用 jieba，但要能复现「词面不相交 → 0 分」的现象。
   * 拉丁字母/数字（E1024、A-2024-7781、600、300%）单独成 token。
   */
  function tokenize(text) {
    const lower = String(text || "").toLowerCase();
    const out = [];
    const latin = lower.match(/[a-z]{2,}[a-z0-9-]*|\d+(?:\.\d+)?%?|[a-z]+\d+[a-z0-9-]*/g) || [];
    latin.forEach((t) => out.push(t));
    const runs = lower.match(/[\u4e00-\u9fa5]+/g) || [];
    runs.forEach((run) => {
      for (let i = 0; i < run.length - 1; i++) {
        const bg = run.slice(i, i + 2);
        if (STOP_BIGRAMS.has(bg)) continue;
        if (STOP_CHARS.has(bg[0]) && STOP_CHARS.has(bg[1])) continue;
        out.push(bg);
      }
      for (let i = 0; i < run.length; i++) {
        if (UNIT_CHARS.has(run[i])) out.push(run[i]);
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ 分块器 */

  /**
   * 把长段落拆成不超过 size 的「单元」：优先按句号/分号切，实在不行硬切。
   * 返回 { units, truncated }，truncated 表示出现过「不按语义的硬切」。
   */
  function splitLongParagraph(text, size) {
    if (text.length <= size) return { units: [text], truncated: false };
    const parts = text.split(/(?<=[。；！？])/).filter(Boolean);
    const units = [];
    let buf = "";
    let truncated = false;
    const push = (s) => {
      if (!s) return;
      units.push(s.trim());
    };
    parts.forEach((p) => {
      if ((buf + p).length <= size) {
        buf += p;
      } else {
        push(buf);
        buf = "";
        if (p.length <= size) {
          buf = p;
        } else {
          // 单句仍然超长 → 只能硬切
          truncated = true;
          for (let i = 0; i < p.length; i += size) push(p.slice(i, i + size));
        }
      }
    });
    push(buf);
    return { units: units.filter(Boolean), truncated };
  }

  /**
   * 装箱：把单元装进不超过 chunkSize 的块，并按 overlap 从上一块尾巴带内容。
   * 注意 overlap 是「最多带这么多字」：尾部单元比额度长就整段放弃 —— 和 LangChain 行为一致，
   * 所以会出现「设了 overlap=50 但实际重叠 0 字」的情况。
   */
  function packUnits(units, size, overlap, truncatedUnits) {
    const chunks = [];
    let cur = [];
    let curLen = 0;
    let overlapChars = 0;

    const joinLen = (arr) => (arr.length === 0 ? 0 : arr.join("\n\n").length);

    const flush = () => {
      const text = cur.join("\n\n");
      chunks.push({ text, overlapChars, truncated: cur.some((u) => truncatedUnits.has(u)) });
      const ov = [];
      let ovLen = 0;
      for (let i = cur.length - 1; i >= 0; i--) {
        const add = ov.length === 0 ? cur[i].length : cur[i].length + 2;
        if (ovLen + add <= overlap) {
          ov.unshift(cur[i]);
          ovLen += add;
        } else break;
      }
      cur = ov;
      curLen = joinLen(cur);
      overlapChars = curLen;
    };

    units.forEach((unit) => {
      const add = cur.length === 0 ? unit.length : unit.length + 2;
      if (curLen + add > size && cur.length > 0) flush();
      // 如果单个单元就超长（理论上已被 splitLongParagraph 处理），直接成块
      cur.push(unit);
      curLen = joinLen(cur);
    });
    if (cur.length) {
      chunks.push({ text: cur.join("\n\n"), overlapChars, truncated: cur.some((u) => truncatedUnits.has(u)) });
    }
    return chunks;
  }

  /**
   * 按指定策略切分全部文档。
   * strategy: markdown_recursive（默认，标题+递归）| markdown（只按标题）| recursive（丢元数据）| fixed（硬切）
   */
  function chunkDocuments(params) {
    const opts = Object.assign({ strategy: "markdown_recursive", chunkSize: 200, overlap: 40 }, params);
    const size = Math.max(60, opts.chunkSize);
    const overlap = clamp(opts.overlap || 0, 0, Math.floor(size * 0.6));
    const chunks = [];
    const perDoc = [];
    let truncatedTotal = 0;
    let metaChunks = 0;

    DATA.DOCS.forEach((doc) => {
      const docChunks = [];
      const add = (text, section, concepts, truncated, ov) => {
        const id = doc.id + "-" + String(chunks.length).padStart(2, "0");
        const chunk = {
          id,
          docId: doc.id,
          docName: doc.name,
          docShort: doc.short,
          dept: doc.dept,
          color: doc.color,
          updated: doc.updated,
          section: section || "（无标题）",
          hasMeta: Boolean(section),
          text: text.trim(),
          chars: text.trim().length,
          concepts: concepts || {},
          truncated: Boolean(truncated),
          overlapChars: ov || 0
        };
        chunks.push(chunk);
        docChunks.push(chunk);
        if (chunk.truncated) truncatedTotal++;
        if (chunk.hasMeta) metaChunks++;
      };

      if (opts.strategy === "fixed") {
        // 不认任何结构，直接按字符硬切 —— 用来对照「结构边界 vs 长度边界」
        const full = doc.sections.map((s) => (s.h2 ? "## " + s.h2 + "\n" : "# " + s.h1 + "\n") + s.paras.join("\n\n")).join("\n\n");
        for (let i = 0; i < full.length; i += size) {
          add(full.slice(i, i + size), null, {}, true, 0);
        }
      } else if (opts.strategy === "recursive") {
        // 所有文本拼成一条流，只有段落/句子边界，没有标题元数据
        const full = doc.sections.map((s) => (s.h2 ? "## " + s.h2 + "\n" : "# " + s.h1 + "\n") + s.paras.join("\n\n")).join("\n\n");
        const units = [];
        const truncatedUnits = new Set();
        full.split(/\n\n+/).forEach((p) => {
          const r = splitLongParagraph(p.trim(), size);
          r.units.forEach((u) => {
            units.push(u);
            if (r.truncated) truncatedUnits.add(u);
          });
        });
        packUnits(units, size, overlap, truncatedUnits).forEach((c) =>
          add(c.text, null, {}, c.truncated, c.overlapChars)
        );
      } else {
        // markdown / markdown_recursive：标题是硬边界；后者再在章节内按长度装箱
        doc.sections.forEach((sec) => {
          const title = sec.h2 ? "## " + sec.h2 : "# " + sec.h1;
          const concepts = sec.concepts || {};
          if (opts.strategy === "markdown") {
            add(title + "\n" + sec.paras.join("\n\n"), sec.h2 || sec.h1, concepts, false, 0);
            return;
          }
          const units = [];
          const truncatedUnits = new Set();
          [title].concat(sec.paras).forEach((p) => {
            const r = splitLongParagraph(p, size);
            r.units.forEach((u) => {
              units.push(u);
              if (r.truncated) truncatedUnits.add(u);
            });
          });
          packUnits(units, size, overlap, truncatedUnits).forEach((c) => {
            // 块文字里只有第一个块带标题，但**每个块都继承章节元数据** —— 这正是结构感知切分的价值
            add(c.text, sec.h2 || sec.h1, concepts, c.truncated, c.overlapChars);
          });
        });
      }
      perDoc.push({ doc, chunks: docChunks });
    });

    const lens = chunks.map((c) => c.chars).sort((a, b) => a - b);
    const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
    const stats = {
      count: chunks.length,
      docs: DATA.DOCS.length,
      median,
      max: lens.length ? lens[lens.length - 1] : 0,
      min: lens.length ? lens[0] : 0,
      truncated: truncatedTotal,
      // 「超出设定大小」和「硬切断句」是两件事：
      // 按标题切时块可以合法地超过 chunk_size（标题是结构边界，不是长度边界）。
      overSize: chunks.filter((c) => c.chars > size).length,
      metaChunks,
      metaRate: chunks.length ? metaChunks / chunks.length : 0,
      avgOverlap: chunks.length ? chunks.reduce((a, c) => a + c.overlapChars, 0) / chunks.length : 0,
      chars: chunks.reduce((a, c) => a + c.chars, 0)
    };
    return { chunks, perDoc, stats };
  }

  /* -------------------------------------------------------------- BM25 */

  /**
   * 建 BM25（Okapi）索引：k1=1.5、b=0.75。
   * 额外记录 df，方便在界面上解释「这个词太常见 → IDF 低」。
   */
  function buildBM25(chunks) {
    const tokenized = chunks.map((c) => tokenize(c.text));
    const df = Object.create(null);
    let total = 0;
    tokenized.forEach((tokens) => {
      total += tokens.length;
      new Set(tokens).forEach((t) => (df[t] = (df[t] || 0) + 1));
    });
    const N = chunks.length;
    const avgdl = total / Math.max(1, N);
    const k1 = 1.5;
    const b = 0.75;

    function score(queryTokens) {
      const qtf = Object.create(null);
      queryTokens.forEach((t) => (qtf[t] = (qtf[t] || 0) + 1));
      return chunks.map((chunk, idx) => {
        const tf = Object.create(null);
        tokenized[idx].forEach((t) => (tf[t] = (tf[t] || 0) + 1));
        const dl = tokenized[idx].length;
        let s = 0;
        Object.keys(qtf).forEach((t) => {
          const f = tf[t] || 0;
          if (!f) return;
          const n = df[t] || 0;
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
          s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl)));
        });
        return { chunk, score: s };
      });
    }

    /**
     * 检索：返回**全部**块（含 0 分）按分数降序。
     * 全 0 时顺序等于原始顺序 —— 这就是「BM25 的假 Top-1」，UI 会明确报警。
     */
    function search(queryText, k) {
      const ranked = score(tokenize(queryText)).sort((a, b2) => b2.score - a.score);
      const top = ranked.slice(0, k);
      return {
        top,
        allZero: ranked.length > 0 && ranked[0].score === 0,
        topScore: ranked.length ? ranked[0].score : 0,
        tokenCount: tokenize(queryText).length
      };
    }

    return { search, chunks, df, avgdl, tokenize };
  }

  /* -------------------------------------------------------------- HNSW */

  function distFn(a, b) {
    return 1 - cosine(a, b);
  }

  /**
   * 建 HNSW 的分层近邻图。
   * 层级按指数衰减分配；每层用「多样性启发式」选边：只有当一个候选离本节点比离已选邻居更近时，
   * 才把它收进来。这样会自然长出跨簇的长边 —— 否则 4 个主题簇会各自连成一团，
   * 检索一旦从错误的簇进入，就再也跳不出来（实测 M=6 不用启发式时 Recall 只有 0.3~0.7）。
   * 真实 HNSW 是增量插入 + 同样的启发式；这里数据量小，为了结果稳定改成一次建全图。
   */
  function buildHNSW(vectors, M, efConstruction, seed) {
    const n = vectors.length;
    const rng = mulberry32(seed || 7);
    const mL = 1 / Math.log(Math.max(3, M));
    const levelOf = new Array(n);
    let maxLevel = 0;
    for (let i = 0; i < n; i++) {
      levelOf[i] = Math.min(6, Math.floor(-Math.log(1 - rng()) * mL));
      maxLevel = Math.max(maxLevel, levelOf[i]);
    }
    const layers = [];
    for (let l = 0; l <= maxLevel; l++) layers.push(new Map());

    for (let l = 0; l <= maxLevel; l++) {
      const nodes = [];
      for (let i = 0; i < n; i++) if (levelOf[i] >= l) nodes.push(i);
      nodes.forEach((id) => {
        const cands = nodes
          .filter((x) => x !== id)
          .map((x) => ({ id: x, d: distFn(vectors[id], vectors[x]) }))
          .sort((a, b) => a.d - b.d);
        const selected = [];
        for (let ci = 0; ci < cands.length; ci++) {
          const c = cands[ci];
          let ok = true;
          for (let si = 0; si < selected.length; si++) {
            if (distFn(vectors[c.id], vectors[selected[si]]) < c.d) {
              ok = false;
              break;
            }
          }
          if (ok) selected.push(c.id);
          if (selected.length >= M) break;
        }
        layers[l].set(id, selected);
      });
      // 对称化：A 连了 B，B 也必须能走回 A（单向边会让图不可达）
      nodes.forEach((id) => {
        layers[l].get(id).forEach((nb) => {
          const arr = layers[l].get(nb);
          if (arr.indexOf(id) < 0) arr.push(id);
        });
      });
    }

    let entry = 0;
    let bestDeg = -1;
    for (let i = 0; i < n; i++) {
      if (levelOf[i] === maxLevel) {
        const deg = (layers[maxLevel].get(i) || []).length;
        if (deg > bestDeg) {
          bestDeg = deg;
          entry = i;
        }
      }
    }
    return { vectors, layers, levelOf, maxLevel, entry, M, efConstruction };
  }

  /**
   * HNSW 查询：上层贪心跳远，底层用 ef 宽度收窄。
   * 返回结果、访问序列（画动画用）、距离计算次数（衡量省了多少计算）。
   */
  function hnswSearch(index, qvec, k, ef) {
    const layers = index.layers;
    const vectors = index.vectors;
    const maxLevel = index.maxLevel;
    const eff = Math.max(k, ef || k);
    const visitedOrder = [];
    const seen = new Set();
    const edges = [];
    const cache = new Map();
    let dists = 0;

    /** 带缓存的距离计算：同一个点在一趟搜索里只算一次 —— 这才是 ANN 省计算的关键。 */
    const dq = (i) => {
      if (cache.has(i)) return cache.get(i);
      dists++;
      const v = distFn(qvec, vectors[i]);
      cache.set(i, v);
      return v;
    };

    let ep = index.entry;
    seen.add(ep);
    dq(ep);
    visitedOrder.push({ id: ep, level: maxLevel });
    const layerPath = [{ level: maxLevel, id: ep }];

    // 上层：只需要贪心地靠近查询点，不用展开
    for (let l = maxLevel; l >= 1; l--) {
      let cur = ep;
      let curD = dq(cur);
      let improved = true;
      while (improved) {
        improved = false;
        for (const nb of layers[l].get(cur) || []) {
          const dd = dq(nb);
          edges.push({ a: cur, b: nb, level: l });
          if (dd < curD) {
            curD = dd;
            cur = nb;
            improved = true;
            if (!seen.has(nb)) {
              seen.add(nb);
              visitedOrder.push({ id: nb, level: l });
            }
          }
        }
      }
      ep = cur;
      layerPath.push({ level: l - 1, id: ep });
    }

    // 第 0 层：best-first 搜索，结果集满 ef 且当前候选比最差结果还远就停
    const cand = [{ id: ep, d: dq(ep) }];
    const result = [{ id: ep, d: cand[0].d }];
    const localSeen = new Set([ep]);
    while (cand.length) {
      cand.sort((a, b) => a.d - b.d);
      const cur = cand.shift();
      const worst = result.length >= eff ? result[result.length - 1].d : Infinity;
      if (cur.d > worst && result.length >= eff) break;
      for (const nb of layers[0].get(cur.id) || []) {
        if (localSeen.has(nb)) continue;
        localSeen.add(nb);
        const dd = dq(nb);
        edges.push({ a: cur.id, b: nb, level: 0 });
        visitedOrder.push({ id: nb, level: 0 });
        if (result.length < eff || dd < result[result.length - 1].d) {
          cand.push({ id: nb, d: dd });
          result.push({ id: nb, d: dd });
          result.sort((a, b) => a.d - b.d);
          if (result.length > eff) result.pop();
        }
      }
    }

    const top = result.slice(0, k);
    return {
      results: top.map((r) => ({ index: r.id, score: 1 - r.d })),
      visitedOrder,
      edges,
      dists,
      layerPath,
      ef: eff
    };
  }


  /** 全扫描（Flat）：算完所有距离再排序 —— 精确，但计算次数 = N。 */
  function flatSearch(vectors, qvec, k) {
    const scored = vectors.map((v, i) => ({ index: i, score: cosine(qvec, v) }));
    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, k), dists: vectors.length };
  }

  /* -------------------------------------------------------------- 融合 */

  /**
   * RRF：score = Σ 1/(k + rank_i)。只看名次，所以能把量纲完全不同的两路排序融合。
   * weight 让两路可以有不同话语权（默认 1:1）。
   */
  function rrfFuse(lists, opts) {
    const k = (opts && opts.k) || 60;
    const weights = (opts && opts.weights) || lists.map(() => 1);
    const map = new Map();
    lists.forEach((list, li) => {
      list.forEach((item, rank) => {
        const key = item.chunk.id;
        const add = (1 / (k + rank + 1)) * (weights[li] || 0);
        const cur = map.get(key) || { chunk: item.chunk, score: 0, ranks: [] };
        cur.score += add;
        cur.ranks[li] = rank + 1;
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.score - a.score);
  }

  /* ------------------------------------------------------------ 重排序 */

  /** 把文本里的空白和全角空格压掉，方便做「事实是否出现」的判断。 */
  function normText(s) {
    return String(s || "").replace(/[\s\u3000]+/g, "");
  }

  /**
   * 演示用 cross-encoder 打分器。
   * 真实 rerank 模型把 (query, chunk) 拼起来过一遍 Transformer；这里用三个可解释的信号模拟
   * 它「读完两段文字后」的判断：
   *   答案覆盖度（问题里的关键事实是否真的出现）+ 语义相似 + 字面重合。
   */
  function rerankScore(query, chunk, denseScore) {
    const facts = query.facts || [];
    let coverage = 0;
    let primaryHit = false;
    let secondaryCoverage = null;
    if (facts.length) {
      const text = normText(chunk.text);
      const hits = facts.map((f) => text.indexOf(normText(f)) >= 0);
      primaryHit = hits[0];
      if (facts.length === 1) {
        coverage = hits[0] ? 1 : 0;
      } else {
        // 第一个事实是「主答案」，后几个是补充条件。主答案缺失时不该拿高分，
        // 否则「一线城市」这种到处出现的词会把无关章节顶上来。
        secondaryCoverage = hits.slice(1).filter(Boolean).length / (facts.length - 1);
        coverage = 0.72 * (hits[0] ? 1 : 0) + 0.28 * secondaryCoverage;
      }
    }
    const qt = new Set(tokenize(query.text));
    const ct = new Set(tokenize(chunk.text));
    let hit = 0;
    qt.forEach((t) => {
      if (ct.has(t)) hit++;
    });
    const lexical = qt.size ? hit / qt.size : 0;
    if (!facts.length) {
      return {
        score: clamp(0.62 * denseScore + 0.38 * lexical, 0, 1),
        coverage: null,
        primaryHit: false,
        lexical
      };
    }
    return {
      score: clamp(0.6 * coverage + 0.28 * denseScore + 0.12 * lexical, 0, 1),
      coverage,
      primaryHit,
      secondaryCoverage,
      lexical
    };
  }

  /* -------------------------------------------------------- 查询理解 */

  /** 从自由文本里按关键词认出概念（认不出就返回空对象，UI 会给提示）。 */
  function conceptsFromText(text) {
    const weights = {};
    DATA.QUERY_HINTS.forEach((hint) => {
      if (hint.re.test(text)) {
        weights[hint.concept] = weights[hint.concept] || 0.9;
      }
    });
    return weights;
  }

  /** 取当前问题：预设问题直接读标注，自由输入走关键词兜底。 */
  function resolveQuery(state) {
    let base = DATA.QUERIES.find((q) => q.id === state.queryId);
    if (!base || state.queryId === "custom") {
      const text = (state.customQuery || "").trim() || "公司账号密码最少要多少位";
      base = {
        id: "custom",
        label: "自由提问",
        text,
        concepts: conceptsFromText(text),
        facts: [],
        goldSection: null,
        goldDoc: null,
        kind: "自由输入",
        note: "自由提问没有标注的标准答案，rerank 的「答案覆盖度」维度不可用。",
        rewrite: text,
        multi: [],
        hyde: ""
      };
    }
    return base;
  }

  /* ------------------------------------------------------ 上下文与生成 */

  const TOKENS_PER_CHAR = 0.62; // 中文约 1 字 ≈ 0.6~0.7 token（粗略估算）

  function estimateTokens(text) {
    return Math.ceil(String(text).length * TOKENS_PER_CHAR);
  }

  /** 抽取式压缩：只保留含问题词元的句子，用来演示「上下文压缩」。 */
  function compressText(text, queryText) {
    const qt = new Set(tokenize(queryText));
    const sentences = String(text)
      .split(/(?<=[。；！？])|\n+/)
      .filter((s) => s.trim() && !/^#{1,6}\s/.test(s));
    const kept = sentences.filter((s) => {
      const st = new Set(tokenize(s));
      let hit = 0;
      qt.forEach((t) => {
        if (st.has(t)) hit++;
      });
      return hit >= 1;
    });
    const out = (kept.length ? kept : sentences.slice(0, 1)).join("").trim();
    return { text: out, saved: Math.max(0, text.length - out.length) };
  }

  /**
   * 组装上下文窗口：去重 → 可选压缩 → 按 token 预算截断 → 决定顺序。
   * order = "sandwich" 时把最强证据放在开头和结尾（对抗 lost-in-the-middle）。
   */
  function assembleContext(items, opts) {
    const o = Object.assign({ topN: 5, budgetTokens: 900, compress: false, order: "score" }, opts || {});
    const seen = new Set();
    const picked = [];
    for (const item of items) {
      if (picked.length >= o.topN) break;
      if (seen.has(item.chunk.section + "|" + item.chunk.text.slice(0, 24))) continue;
      seen.add(item.chunk.section + "|" + item.chunk.text.slice(0, 24));
      picked.push(item);
    }
    let used = 0;
    const out = [];
    picked.forEach((item) => {
      const compressed = o.compress ? compressText(item.chunk.text, o.queryText || "") : null;
      const text = compressed ? compressed.text : item.chunk.text;
      const tokens = estimateTokens(text);
      if (used + tokens > o.budgetTokens && out.length > 0) {
        out.push({ ...item, text, tokens: 0, skipped: true, saved: compressed ? compressed.saved : 0 });
        return;
      }
      used += tokens;
      out.push({ ...item, text, tokens, skipped: false, saved: compressed ? compressed.saved : 0 });
    });
    const real = out.filter((x) => !x.skipped);
    let ordered = real.slice();
    if (o.order === "sandwich" && real.length > 2) {
      const arr = real.slice();
      const head = arr.shift();
      const tail = arr.pop();
      ordered = [head, ...arr.reverse(), tail];
    }
    ordered = ordered.map((item, i) => ({ ...item, citation: i + 1 }));
    const totalTokens = ordered.reduce((a, x) => a + x.tokens, 0);
    return { items: ordered, tokens: totalTokens, budget: o.budgetTokens, dropped: out.filter((x) => x.skipped) };
  }

  /** 把段落切成句子；丢掉 Markdown 标题行（标题不该直接出现在答案里）。 */
  function splitSentences(text) {
    return String(text)
      .split(/(?<=[。；！？])|\n+/)
      .map((s) => s.trim())
      .filter((s) => s && !/^#{1,6}\s/.test(s) && s.length > 6);
  }

  /** 去掉列表序号 / 项目符号，让答案读起来像人话。 */
  function stripMarkers(s) {
    return String(s).replace(/^(\d+[.、)]|[-*•])\s*/, "").trim();
  }

  /**
   * 「生成」答案：演示用抽取式写法 —— 只把上下文里真实存在的事实拼成句子，并挂上引用编号。
   * 真实 LLM 会重新组织语言，但**引用与拒答的判断逻辑是一样的**。
   * opts.freeform = true 时模拟「不加引用约束的裸模型」，会产出一句看似合理但文档里没有的话（用于第 9 站对照）。
   */
  function composeAnswer(query, context, opts) {
    const o = Object.assign({ threshold: 0.45, freeform: false }, opts || {});
    const items = context.items;

    if (o.freeform) {
      return {
        refused: false,
        ungrounded: true,
        reason: "未加引用约束：模型只凭参数记忆作答",
        sentences: [{ text: query.hallucination || "根据经验，公司政策一般为 500 元/晚。", cite: null }],
        coverage: null,
        topScore: items.length ? items[0].score : 0
      };
    }

    if (!items.length) return { refused: true, reason: "上下文为空", sentences: [], coverage: 0 };
    const top = items[0];

    if (!query.facts.length) {
      if (top.score < o.threshold) {
        return { refused: true, reason: "最高分低于拒答阈值", sentences: [], coverage: 0, topScore: top.score };
      }
      const first = stripMarkers(splitSentences(top.text)[0] || top.text.slice(0, 60));
      return {
        refused: false,
        reason: "自由提问：命中相关资料，未做事实校验",
        sentences: [{ text: first, cite: top.citation, chunkId: top.chunk.id }],
        coverage: null,
        topScore: top.score
      };
    }

    const facts = query.facts;
    // 到上下文里逐句找证据：优先「包含主事实」且与问题词元重合最多的句子
    const candidates = [];
    items.forEach((item) => {
      splitSentences(item.text).forEach((raw, idx) => {
        const text = stripMarkers(raw);
        const n = normText(text);
        const hits = facts.map((f) => n.indexOf(normText(f)) >= 0);
        const qt = new Set(tokenize(query.text));
        const st = new Set(tokenize(text));
        let qhits = 0;
        qt.forEach((t) => {
          if (st.has(t)) qhits++;
        });
        candidates.push({ item, text, hits, primary: hits[0], qhits, idx, n });
      });
    });
    candidates.sort(
      (a, b) =>
        Number(b.primary) - Number(a.primary) ||
        b.hits.filter(Boolean).length - a.hits.filter(Boolean).length ||
        b.qhits - a.qhits ||
        a.idx - b.idx
    );
    const best = candidates[0];
    if (!best || !best.primary || top.score < o.threshold) {
      return {
        refused: true,
        reason: !best || !best.primary ? "上下文中没有出现主答案（关键事实）" : "最高分低于拒答阈值",
        sentences: [],
        coverage: 0,
        topScore: top.score,
        nearMiss: best ? best.text : null
      };
    }

    const supported = facts.filter((f) => best.n.indexOf(normText(f)) >= 0);
    const sentences = [{ text: best.text, cite: best.item.citation, chunkId: best.item.chunk.id }];

    // 主句里没覆盖到的补充事实，如果别的资料里有，就再补一句（并单独标引用）
    const missing = facts.filter((f) => supported.indexOf(f) < 0);
    const extra = [];
    missing.forEach((f) => {
      const cand = candidates.find((c) => c.item.chunk.id !== best.item.chunk.id && c.n.indexOf(normText(f)) >= 0);
      if (cand && !extra.some((e) => e.chunkId === cand.item.chunk.id)) {
        extra.push({ text: cand.text, cite: cand.item.citation, chunkId: cand.item.chunk.id, fact: f });
      }
    });
    extra.forEach((e) => sentences.push({ text: e.text, cite: e.cite, chunkId: e.chunkId }));

    const coveredNow = facts.filter((f) => sentences.some((s) => normText(s.text).indexOf(normText(f)) >= 0));
    const stillMissing = facts.filter((f) => coveredNow.indexOf(f) < 0);
    return {
      refused: false,
      reason: stillMissing.length ? "只覆盖了部分事实" : "全部关键事实都能在上下文中找到",
      sentences,
      coverage: coveredNow.length / facts.length,
      missing: stillMissing,
      topScore: top.score,
      partial: stillMissing.length > 0
    };
  }

  /**
   * 逐句校验：答案里的每一句能否在它引用的块里找到原文？
   * 返回 claims + faithfulness（被支持的比例）+ 上下文噪音率。
   */
  function verifyClaims(answer, context, query) {
    const items = context.items;
    const claims = (answer.sentences || []).map((s) => {
      const item = items.find((it) => it.chunk.id === s.chunkId) || items.find((it) => it.citation === s.cite);
      const supported = item ? normText(item.text).indexOf(normText(s.text)) >= 0 : false;
      const facts = query.facts || [];
      const factHits = facts.filter((f) => normText(s.text).indexOf(normText(f)) >= 0);
      return {
        text: s.text,
        cite: s.cite,
        chunkId: s.chunkId || (item && item.chunk.id),
        supported,
        facts: factHits,
        confidence: supported ? clamp(0.62 + 0.38 * (facts.length ? factHits.length / facts.length : 0.5), 0, 1) : 0.12
      };
    });
    const supportedCount = claims.filter((c) => c.supported).length;
    const factCoverage = query.facts.length
      ? query.facts.filter((f) => items.some((it) => normText(it.text).indexOf(normText(f)) >= 0)).length / query.facts.length
      : null;
    return {
      claims,
      faithfulness: claims.length ? supportedCount / claims.length : 0,
      factCoverage,
      contextChunks: items.length,
      coverageRatio: answer.coverage
    };
  }

  /* ------------------------------------------------------------ 主流程 */

  const TIMING = {
    parse: 260,
    chunk: (n) => 18 + n * 1.4,
    embed: (n) => 90 + n * 8.5,
    index: (n) => 35 + n * 2.2,
    rewrite: 380,
    multi: 620,
    hyde: 460,
    queryEmbed: 14,
    bm25: (n) => 1.4 + n * 0.02,
    hnsw: (visited) => 0.6 + visited * 0.012,
    flat: (n) => 0.4 + n * 0.006,
    fuse: 0.3,
    rerank: (n) => 11 + n * 0.9,
    context: 2.6,
    llmBase: 430,
    llmPerToken: 8.5,
    verify: 240
  };

  let packCache = null;

  /**
   * 建库：分块 + 向量 + BM25 + ANN 索引。结果按参数缓存，避免滑块每动一下就重建。
   */
  function buildPack(params) {
    const opts = Object.assign(
      { strategy: "markdown_recursive", chunkSize: 200, overlap: 40, M: 6, efConstruction: 32, indexType: "hnsw" },
      params
    );
    const key = [opts.strategy, opts.chunkSize, opts.overlap, opts.M, opts.efConstruction, opts.indexType].join("|");
    if (packCache && packCache.key === key) return packCache.pack;

    const chunked = chunkDocuments(opts);
    const space = getConceptSpace();
    const vectors = chunked.chunks.map((chunk) => {
      const v = new Array(DIM).fill(0);
      const docVec = space.docVecs[chunk.docId] || new Array(DIM).fill(0);
      for (let i = 0; i < DIM; i++) v[i] += 0.42 * docVec[i];
      Object.keys(chunk.concepts).forEach((c) => {
        const dir = space.dirs[c];
        const w = chunk.concepts[c];
        if (!dir) return;
        for (let i = 0; i < DIM; i++) v[i] += dir[i] * w;
      });
      const rand = mulberry32(hashString(chunk.id + chunk.text.slice(0, 16)));
      for (let i = 0; i < DIM; i++) v[i] += (rand() * 2 - 1) * 0.085;
      return normalize(v);
    });
    const projection = pca3(vectors);
    chunked.chunks.forEach((chunk, i) => {
      chunk.vector = vectors[i];
      chunk.coord = projection.coords[i];
    });
    const bm25 = buildBM25(chunked.chunks);
    // 即使当前选的是 Flat，也把 HNSW 建出来：第 4 站要展示索引结构，这点构建成本可以忽略
    const hnsw = buildHNSW(vectors, opts.M, opts.efConstruction, 7);
    const pack = { key, opts, ...chunked, vectors, projection, bm25, hnsw };
    packCache = { key, pack };
    return pack;
  }

  /**
   * 跑一次在线检索。返回两路召回、融合、重排、ANN 轨迹和耗时。
   * 交互面板上调 topK / efSearch / 权重 / 过滤，都会重新走这里。
   */
  function retrieve(pack, state) {
    const query = resolveQuery(state);
    const useRewrite = Boolean(state.useRewrite && query.rewrite);
    const retrievalText = useRewrite ? query.rewrite : query.text;
    const timings = {};

    // 1) 查询向量（HyDE 会把「假答案」也编码进查询向量，再和原问题加权）
    let qvec = vectorFromConcepts(query.concepts, "q:" + query.id);
    if (!qvec) {
      // 没认出概念：用「字面重合」造一个弱向量，UI 会明确提示这不是真的语义检索
      const v = new Array(DIM).fill(0);
      tokenize(retrievalText).forEach((t, i) => {
        const rand = mulberry32(hashString("tok:" + t));
        for (let k = 0; k < DIM; k++) v[k] += (rand() * 2 - 1) / Math.sqrt(i + 1);
      });
      qvec = normalize(v);
    }
    if (state.useHyde && query.hyde) {
      const hv = vectorFromConcepts(conceptsFromText(query.hyde), "hyde:" + query.id);
      if (hv) {
        qvec = normalize(qvec.map((x, i) => x * 0.68 + hv[i] * 0.32));
        timings.hyde = TIMING.hyde;
      }
    }
    timings.queryEmbed = TIMING.queryEmbed;

    // 2) 元数据过滤（真实系统里还有权限、密级、时效）
    const filters = state.filters || {};
    const allowed = pack.chunks.filter((c) => {
      if (filters.docs && filters.docs.length && !filters.docs.includes(c.docId)) return false;
      if (filters.freshOnly && c.updated < "2026-07-01") return false;
      return true;
    });
    const allowedSet = new Set(allowed.map((c) => c.id));
    const k = Math.max(1, state.denseK || 10);
    // 过滤时机：pre-filter 先按元数据收窄候选池；post-filter 先向量检索再筛。
    // 权限过滤在真实系统里**必须** pre-filter，否则可能把无权限的内容算进 Top-K。
    const filterMode = state.filterMode === "post" ? "post" : "pre";
    const prefilter = filterMode === "pre" && allowed.length < pack.chunks.length;

    /**
     * 单路向量检索：HNSW 近似或 Flat 全扫描，然后做后置元数据过滤。
     * 返回过滤后的 Top-K 和这一趟的 ANN 轨迹（只有主查询才用于画图）。
     */
    function denseRun(vec, ef, kk) {
      if (prefilter) {
        // 演示用「过滤后的精确扫描」模拟 pre-filter；
        // 生产里对应 filtered HNSW / 按部门分区的子索引，不是从全图里捞完再筛。
        const list = allowed
          .map((c) => ({ chunk: c, score: cosine(vec, c.vector) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, kk);
        return {
          list,
          ann: {
            results: [],
            visitedOrder: [],
            edges: [],
            dists: allowed.length,
            layerPath: [],
            ef: kk,
            mode: "prefilter"
          },
          time: TIMING.flat(allowed.length)
        };
      }
      if (state.indexType === "flat" || !pack.hnsw) {
        const flat = flatSearch(pack.chunks.map((c) => c.vector), vec, pack.chunks.length);
        const list = flat.results
          .filter((r) => allowedSet.has(pack.chunks[r.index].id))
          .slice(0, kk)
          .map((r) => ({ chunk: pack.chunks[r.index], score: r.score, index: r.index }));
        return {
          list,
          ann: { results: flat.results, visitedOrder: [], edges: [], dists: flat.dists, layerPath: [], ef: kk, mode: "flat" },
          time: TIMING.flat(pack.chunks.length)
        };
      }
      const h = hnswSearch(pack.hnsw, vec, kk, ef);
      const list = h.results
        .filter((r) => allowedSet.has(pack.chunks[r.index].id))
        .map((r) => ({ chunk: pack.chunks[r.index], score: r.score, index: r.index }));
      return { list, ann: Object.assign(h, { mode: "hnsw" }), time: TIMING.hnsw(h.dists) };
    }

    const ef = Math.max(k, state.efSearch || 16);
    const main = denseRun(qvec, ef, k);
    let dense = main.list;
    let ann = main.ann;
    timings.ann = main.time;

    // 3) 多查询扩展：每个变体各自召回，取并集（按命中次数、再按分数排）
    let multiInfo = null;
    if (state.useMultiQuery && query.multi && query.multi.length) {
      const variants = [retrievalText].concat(query.multi);
      const runs = [];
      let multiTime = 0;
      variants.forEach((text, vi) => {
        let vec;
        if (vi === 0) {
          vec = qvec;
        } else {
          vec = vectorFromConcepts(conceptsFromText(text), "mq:" + query.id + ":" + vi);
          if (!vec) {
            const rand = mulberry32(hashString(text));
            vec = normalize(qvec.map((x) => x + (rand() * 2 - 1) * 0.05));
          }
        }
        const run = denseRun(vec, ef, k);
        multiTime += run.time;
        runs.push({ text, vec, list: run.list });
      });
      const map = new Map();
      runs.forEach((run, ri) => {
        run.list.forEach((item, rank) => {
          const cur = map.get(item.chunk.id) || {
            chunk: item.chunk,
            score: item.score,
            hits: 0,
            bestRank: 99,
            runs: []
          };
          cur.hits += 1;
          cur.bestRank = Math.min(cur.bestRank, rank + 1);
          cur.score = Math.max(cur.score, item.score);
          cur.runs.push(ri + 1);
          map.set(item.chunk.id, cur);
        });
      });
      dense = Array.from(map.values()).sort((a, b) => b.hits - a.hits || b.score - a.score);
      multiInfo = { variants, runs, time: multiTime };
      timings.ann = multiTime;
    }

    // 4) 关键词召回（过滤在检索之后 —— 这就是 post-filter，可能召回不足）
    let bm = pack.bm25.search(retrievalText, Math.max(1, state.sparseK || 10));
    let sparse = bm.top.filter((r) => allowedSet.has(r.chunk.id)).map((r) => ({ chunk: r.chunk, score: r.score }));
    if (state.useMultiQuery && query.multi && query.multi.length) {
      const smap = new Map();
      [retrievalText].concat(query.multi).forEach((text) => {
        const run = pack.bm25.search(text, Math.max(1, state.sparseK || 10));
        run.top
          .filter((r) => allowedSet.has(r.chunk.id))
          .forEach((r) => {
            const cur = smap.get(r.chunk.id);
            if (!cur || r.score > cur.score) smap.set(r.chunk.id, { chunk: r.chunk, score: r.score });
          });
      });
      sparse = Array.from(smap.values()).sort((a, b) => b.score - a.score).slice(0, Math.max(1, state.sparseK || 10));
    }

    // 5) 融合：关掉混合时只用向量
    const fused =
      state.useHybrid === false
        ? dense.map((d, i) => ({ chunk: d.chunk, score: d.score, ranks: [i + 1] }))
        : rrfFuse([dense, sparse], {
            k: state.rrfK || 60,
            weights: [state.denseWeight == null ? 1 : state.denseWeight, state.sparseWeight == null ? 1 : state.sparseWeight]
          });

    // 6) 重排序：只对融合后的前 N 个候选做「贵的判断」
    const rerankN = Math.min(fused.length, state.rerankN || 20);
    const contextN = state.contextN || 5;
    let reranked;
    if (state.useRerank === false) {
      reranked = fused.slice(0, contextN).map((f, i) => ({
        chunk: f.chunk,
        score: f.score,
        denseScore: (dense.find((d) => d.chunk.id === f.chunk.id) || {}).score || 0,
        coverage: null,
        lexical: 0,
        beforeRank: i + 1,
        beforeScore: f.score,
        ranks: f.ranks
      }));
    } else {
      const scored = fused.slice(0, rerankN).map((f, i) => {
        const dscore = (dense.find((d) => d.chunk.id === f.chunk.id) || {}).score || 0;
        const rr = rerankScore(query, f.chunk, dscore);
        return Object.assign({}, f, rr, { denseScore: dscore, beforeRank: i + 1, beforeScore: f.score });
      });
      scored.sort((a, b) => b.score - a.score);
      reranked = scored.slice(0, contextN);
      timings.rerank = TIMING.rerank(rerankN);
    }

    // 7) 近似损失：和「全扫描 + 同样过滤」的真值比 Recall@K（k 个结果里找回了几个）
    let recall = null;
    let exactTop = [];
    let extraDists = 0;
    if (ann.mode === "hnsw") {
      const flatAll = flatSearch(pack.chunks.map((c) => c.vector), qvec, pack.chunks.length).results;
      exactTop = flatAll.filter((r) => allowedSet.has(pack.chunks[r.index].id)).slice(0, k);
      const exactSet = new Set(exactTop.map((r) => r.index));
      const got = ann.results.filter((r) => exactSet.has(r.index)).length;
      recall = exactTop.length ? got / exactTop.length : 0;
      extraDists = k; // 真值比对本身也要算距离，不计入 ANN 的耗时
    }

    timings.bm25 = TIMING.bm25(pack.chunks.length);
    timings.fuse = TIMING.fuse;
    timings.embedOffline = TIMING.embed(pack.chunks.length);

    return {
      query,
      retrievalText,
      useRewrite,
      qvec,
      qcoord: pack.projection.project(qvec),
      dense,
      sparse,
      fused,
      reranked,
      ann,
      recall,
      exactTop,
      bm25Zero: bm.allZero,
      poolSize: allowed.length,
      filters,
      filterMode,
      prefilter,
      timings,
      multi: multiInfo,
      rerankN,
      contextN,
      usedRewrite: useRewrite,
      usedHyde: Boolean(state.useHyde && query.hyde),
      extraDists
    };
  }

  /**
   * 用同一套参数跑全部有答案的问题，得到 R@1/R@3/R@5/MRR（口径和 rag/05 一致：
   * 命中标准是「块的章节 == 标注的标准章节」，落在第几位决定 MRR）。
   * opts.evalMode: "vector"（只看向量召回）| "fused"（混合召回）| "reranked"（混合+重排）
   */
  function evaluate(pack, state, opts) {
    const mode = (opts && opts.evalMode) || "reranked";
    const questions = DATA.QUERIES.filter((q) => q.goldDoc);
    const rows = [];
    questions.forEach((q) => {
      const s = Object.assign({}, state, {
        queryId: q.id,
        customQuery: "",
        filters: {},
        useRewrite: false,
        useHyde: false,
        useMultiQuery: false,
        useHybrid: mode !== "vector",
        useRerank: mode === "reranked"
      });
      const r = retrieve(pack, s);
      const list = mode === "vector" ? r.dense : mode === "fused" ? r.fused : r.reranked;
      const pos = list.findIndex((it) => it.chunk.docId === q.goldDoc && it.chunk.section === q.goldSection);
      rows.push({
        q: q.text,
        rank: pos + 1,
        r1: pos === 0 ? 1 : 0,
        r3: pos >= 0 && pos < 3 ? 1 : 0,
        r5: pos >= 0 && pos < 5 ? 1 : 0,
        rr: pos >= 0 ? 1 / (pos + 1) : 0
      });
    });
    const avg = (key) => (rows.length ? rows.reduce((a, x) => a + x[key], 0) / rows.length : 0);
    return { rows, r1: avg("r1"), r3: avg("r3"), r5: avg("r5"), mrr: avg("rr"), mode };
  }

  /* --------------------------------------------------------------- 成本 */

  /** 粗略估算一次问答的 token 与费用（人民币，按常见国产模型价格量级）。 */
  function estimateCost(contextTokens, answerChars) {
    const promptTokens = contextTokens + 260;
    const completionTokens = Math.ceil(answerChars * TOKENS_PER_CHAR);
    const inputPrice = 1.0 / 1e6; // ¥ / token
    const outputPrice = 2.0 / 1e6;
    return {
      promptTokens,
      completionTokens,
      cny: promptTokens * inputPrice + completionTokens * outputPrice
    };
  }

  global.RAG_ENGINE = {
    DIM,
    tokenize,
    chunkDocuments,
    packUnits,
    buildBM25,
    buildPack,
    retrieve,
    evaluate,
    assembleContext,
    composeAnswer,
    verifyClaims,
    estimateTokens,
    estimateCost,
    rrfFuse,
    hnswSearch,
    flatSearch,
    resolveQuery,
    conceptsFromText,
    cosine,
    normalize,
    TIMING
  };
})(typeof window !== "undefined" ? window : globalThis);
