/* ==========================================================================
   engine.pipeline.js — 把切分、embedding、索引、检索、融合、重排串起来
   所有结果按参数缓存；参数变化后才重建对应的那一层。
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var Text = M.Text;
  var Embed = M.Embed;
  var BM25 = M.BM25;
  var Index = M.Index;
  var Fuse = M.Fuse;
  var CORPUS = M.data.corpus.CORPUS;
  var QUESTIONS = M.data.questions.QUESTIONS;
  var DEFAULT_THRESHOLD = M.data.questions.DEFAULT_THRESHOLD;

  var cache = {};

  function chunkKey(p) {
    return [p.chunkSize, p.chunkOverlap, p.byHeading ? 1 : 0].join('|');
  }

  function modelKey(p) {
    return chunkKey(p) + '|' + p.dim + '|' + (p.normalize ? 1 : 0);
  }

  function indexKey(p) {
    return modelKey(p) + '|' + p.indexType + '|' + p.M + '|' + p.efConstruction + '|' + p.nlist + '|' + p.metric;
  }

  function getChunks(p) {
    var key = chunkKey(p);
    if (!cache.chunks || cache.chunks.key !== key) {
      cache.chunks = {
        key: key,
        value: Text.chunkDocs(CORPUS.docs, {
          size: p.chunkSize,
          overlap: p.chunkOverlap,
          byHeading: p.byHeading
        })
      };
    }
    return cache.chunks.value;
  }

  function getModel(p) {
    var key = modelKey(p);
    if (!cache.model || cache.model.key !== key) {
      var built = getChunks(p);
      var embedder = Embed.create(p.dim);
      var raw = built.chunks.map(function (c) {
        return embedder.embed(c.headingPath + '。' + c.text);
      });
      var vectors = p.normalize
        ? raw.map(function (v) { return embedder.normalize(v); })
        : raw;
      cache.model = {
        key: key,
        value: {
          chunks: built.chunks,
          docs: built.docs,
          stats: built.stats,
          embedder: embedder,
          raw: raw,
          vectors: vectors,
          byId: built.chunks.reduce(function (map, c, i) {
            map[c.id] = i;
            return map;
          }, Object.create(null))
        }
      };
    }
    return cache.model.value;
  }

  function getBM25(p) {
    var model = getModel(p);
    var key = model.key + '|bm25';
    if (!cache.bm25 || cache.bm25.key !== key) {
      cache.bm25 = { key: key, value: BM25.create(model.chunks) };
    }
    return cache.bm25.value;
  }

  function getIndex(p) {
    var model = getModel(p);
    var key = indexKey(p);
    if (!cache.index || cache.index.key !== key) {
      cache.index = {
        key: key,
        value: Index.create({
          chunks: model.chunks,
          vectors: model.vectors,
          type: p.indexType,
          metric: p.metric,
          M: p.M,
          efConstruction: p.efConstruction,
          nlist: p.nlist
        })
      };
    }
    return cache.index.value;
  }

  function questionOf(p) {
    if (p.question === 'custom' && p.customQuestion && p.customQuestion.trim()) {
      return {
        id: 'custom',
        no: 0,
        label: '自定义',
        text: p.customQuestion.trim(),
        kind: 'custom',
        probe: [],
        answerDoc: null,
        why: '这是你输入的问题；页面用同一套检索链路计算。'
      };
    }
    return QUESTIONS.filter(function (q) { return q.id === p.question; })[0] || QUESTIONS[0];
  }

  function epochFromIso(iso) {
    return Math.floor(Date.parse(iso + 'T00:00:00+08:00') / 1000);
  }

  function expressionOf(p) {
    var parts = [];
    if (p.filter.dept && p.filter.dept !== 'all') parts.push('dept == "' + p.filter.dept + '"');
    if (p.filter.updatedFrom) {
      parts.push('updated >= ' + epochFromIso(p.filter.updatedFrom));
    }
    if (p.filter.acl && p.filter.acl !== 'all') parts.push('acl == "' + p.filter.acl + '"');
    return parts.join(' and ');
  }

  function allowedOf(p) {
    var expr = expressionOf(p);
    if (!expr) return null;
    var model = getModel(p);
    var set = new Set();
    model.chunks.forEach(function (c) {
      if (p.filter.dept && p.filter.dept !== 'all' && c.dept !== p.filter.dept) return;
      if (p.filter.acl && p.filter.acl !== 'all' && c.acl !== p.filter.acl) return;
      if (p.filter.updatedFrom && c.updated < epochFromIso(p.filter.updatedFrom)) return;
      set.add(c.id);
    });
    return set;
  }

  function queryVectorOf(p) {
    var model = getModel(p);
    var q = getModel(p).embedder.embed(questionOf(p).text);
    return p.normalize ? model.embedder.normalize(q) : q;
  }

  function denseSearch(p, opts) {
    opts = opts || {};
    var model = getModel(p);
    var index = getIndex(p);
    var qv = queryVectorOf(p);
    var allowed = opts.allowed !== undefined ? opts.allowed : allowedOf(p);
    var limit = opts.limit == null ? p.limit : opts.limit;
    var res = index.search(qv, {
      limit: limit,
      ef: p.ef,
      nprobe: p.nprobe,
      allowed: allowed,
      mode: opts.mode || p.filterMode || 'pre'
    });
    res.queryVector = qv;
    res.allowed = allowed;
    return res;
  }

  function sparseSearch(p, opts) {
    opts = opts || {};
    var bm25 = getBM25(p);
    var allowed = opts.allowed !== undefined ? opts.allowed : allowedOf(p);
    var res = bm25.search(questionOf(p).text, {
      limit: opts.limit == null ? p.limit : opts.limit,
      allowed: allowed,
      k1: p.k1,
      b: p.b
    });
    return res;
  }

  function fused(p, opts) {
    opts = opts || {};
    var limit = opts.limit == null ? p.limit : opts.limit;
    var dense = denseSearch(p, { limit: limit }).items;
    var bm25On = !!p.bm25;
    var sparse = bm25On ? sparseSearch(p, { limit: limit }).top : [];
    var rows;
    if (bm25On && sparse.length) {
      rows =
        p.ranker === 'rrf'
          ? Fuse.rrf([dense, sparse], 60)
          : Fuse.weighted(dense, sparse, p.wDense, p.wSparse);
    } else {
      rows = dense.map(function (it, i) {
        return {
          chunk: it.chunk,
          score: it.score,
          denseScore: it.score,
          denseRank: i + 1,
          sparseScore: null,
          sparseRank: null
        };
      });
    }
    return { dense: dense, sparse: sparse, rows: rows, bm25On: bm25On };
  }

  function ranked(p, opts) {
    opts = opts || {};
    var limit = opts.limit == null ? p.limit : opts.limit;
    var model = getModel(p);
    var q = questionOf(p);
    var qv = queryVectorOf(p);
    var bundle = fused(p, { limit: limit });
    var scored = Fuse.rerank(bundle.rows, q.text, {
      embedder: model.embedder,
      queryVector: qv,
      vectorOf: function (chunk) {
        var i = model.byId[chunk.id];
        return i == null ? null : model.vectors[i];
      }
    });
    var byId = Object.create(null);
    scored.forEach(function (s) { byId[s.chunk.id] = s; });
    var items;
    if (p.rerank) {
      items = scored.slice(0, limit);
    } else {
      items = bundle.rows.slice(0, limit).map(function (row) {
        var s = byId[row.chunk.id];
        return Object.assign({}, row, {
          confidence: s.confidence,
          cosine: s.cosine,
          lexical: s.lexical,
          heading: s.heading,
          reasons: s.reasons
        });
      });
    }
    return Object.assign({}, bundle, { items: items, scored: scored });
  }

  function contextOf(p, items) {
    var ctx = Fuse.buildContext(items, { budget: p.budget, topN: p.topN });
    ctx.segments = ctx.segments.map(function (seg) {
      var src = items.filter(function (it) { return it.chunk.id === seg.chunk.id; })[0];
      return Object.assign({}, seg, {
        confidence: src ? src.confidence : null,
        rerankScore: src ? src.score : null
      });
    });
    return ctx;
  }

  function answerOf(p) {
    var q = questionOf(p);
    var r = ranked(p);
    var ctx = contextOf(p, r.items);
    var answer = Fuse.assembleAnswer({
      question: q.text,
      items: ctx.segments.map(function (seg) {
        return { chunk: seg.chunk, confidence: seg.confidence };
      }),
      threshold: p.threshold,
      defaultThreshold: DEFAULT_THRESHOLD,
      probe: q.probe
    });
    return { ranked: r, context: ctx, answer: answer, question: q };
  }

  /* ----------------------------- 站 5 时间线（模型） ----------------------------- */
  function writeTimeline(p) {
    var rows = Math.max(1, p.batch);
    var ingest = 0.004 + rows * 0.00002;
    var wal = 0.008 + rows * 0.00003;
    var growing = ingest + wal;
    var fill = Math.min(1, rows / 2000);
    var seal = growing + 1.2 + (1 - fill) * 6;
    var indexAt = seal + 2.2 + rows * 0.00002;
    var load = indexAt + 0.9;
    var boundedLag = 0.9 + rows * 0.00002;
    var eventualLag = 3.2 + rows * 0.00006;
    var levels = {
      Strong: 0,
      Session: 0,
      Bounded: boundedLag,
      Eventually: eventualLag
    };
    var tValues = [0, 0.2, 0.5, 1, 2, 5, 10, 20];
    return {
      rows: rows,
      phases: [
        { id: 'submitted', t: 0 },
        { id: 'wal', t: ingest + wal },
        { id: 'growing', t: growing },
        { id: 'sealed', t: seal },
        { id: 'indexed', t: indexAt },
        { id: 'loaded', t: load }
      ],
      total: load * 1.15,
      levels: levels,
      tValues: tValues,
      table: tValues.map(function (t) {
        return {
          t: t,
          Strong: t >= levels.Strong,
          Session: t >= levels.Session,
          Bounded: t >= levels.Bounded,
          Eventually: t >= levels.Eventually
        };
      }),
      noteModel: true
    };
  }

  /* --------------------------- 站 7 三级归并与分布 --------------------------- */
  function routeSimulation(p) {
    var model = getModel(p);
    var chunks = model.chunks;
    var shards = Math.max(1, Math.min(4, p.shards));
    var nodes = Math.max(1, Math.min(6, p.nodes));
    var limit = p.limit;
    var cand = Math.max(1, Math.min(40, p.cand));
    var qv = queryVectorOf(p);
    var growingCount = Math.round((chunks.length * p.growing) / 100);
    var growingSet = new Set(chunks.slice(0, growingCount).map(function (c) { return c.id; }));

    function sliceChunks(list, max) {
      var out = [];
      for (var i = 0; i < list.length; i += max) out.push(list.slice(i, i + max));
      return out;
    }

    function searchSubset(list, k) {
      var allowed = new Set(list.map(function (c) { return c.id; }));
      return getIndex(p).exact(qv, { limit: k, allowed: allowed }).items.map(function (it) {
        return { chunk: it.chunk, score: it.score };
      });
    }

    function merge(lists, k) {
      var all = [];
      lists.forEach(function (list) {
        list.forEach(function (it) { all.push(it); });
      });
      all.sort(function (a, b) {
        return b.score - a.score || a.chunk.id.localeCompare(b.chunk.id);
      });
      return all.slice(0, k);
    }

    var shardBuckets = [];
    for (var s = 0; s < shards; s++) shardBuckets.push({ id: s + 1, growing: [], sealed: [] });
    chunks.forEach(function (c, i) {
      var shard = shardBuckets[i % shards];
      if (growingSet.has(c.id)) shard.growing.push(c);
      else shard.sealed.push(c);
    });

    var shardResults = shardBuckets.map(function (bucket) {
      var streamTop = searchSubset(bucket.growing, Math.min(cand, Math.max(limit, cand)));
      var queryNodes = [];
      var nodeBuckets = [];
      for (var n = 0; n < nodes; n++) nodeBuckets.push([]);
      bucket.sealed.forEach(function (c, i) {
        nodeBuckets[i % nodes].push(c);
      });
      nodeBuckets.forEach(function (nodeChunks, ni) {
        var segments = sliceChunks(nodeChunks, 6);
        var segTops = segments.map(function (seg) {
          return { size: seg.length, top: searchSubset(seg, cand) };
        });
        var nodeMerged = merge(
          segTops.map(function (st) { return st.top; }),
          cand
        );
        queryNodes.push({
          id: (bucket.id - 1) * nodes + ni + 1,
          chunkCount: nodeChunks.length,
          segments: segTops,
          top: nodeMerged
        });
      });
      var streamMerged = merge([streamTop].concat(queryNodes.map(function (n) { return n.top; })), cand);
      return {
        id: bucket.id,
        growing: { chunkCount: bucket.growing.length, top: streamTop },
        queryNodes: queryNodes,
        merged: streamMerged
      };
    });

    var globalMerged = merge(shardResults.map(function (s) { return s.merged; }), limit);
    var exactTop = getIndex(p).exact(qv, { limit: limit }).items.map(function (it) {
      return { chunk: it.chunk, score: it.score };
    });
    var naive = [];
    shardResults.forEach(function (s) {
      s.merged.forEach(function (it) { if (naive.length < limit) naive.push(it); });
    });
    var exactIds = new Set(exactTop.map(function (it) { return it.chunk.id; }));
    var hit = globalMerged.filter(function (it) { return exactIds.has(it.chunk.id); }).length;
    return {
      shards: shardResults,
      global: globalMerged,
      exact: exactTop,
      naive: naive,
      recall: exactTop.length ? hit / exactTop.length : 1,
      growingCount: growingCount,
      sealedCount: chunks.length - growingCount,
      cand: cand,
      limit: limit,
      nodes: nodes,
      shardCount: shards
    };
  }

  /* ------------------------------ 站 8 过滤对照 ------------------------------ */
  function filterSimulation(p) {
    var q = questionOf(p);
    var expression = expressionOf(p);
    var allowed = allowedOf(p);
    var model = getModel(p);
    var qv = queryVectorOf(p);
    var index = getIndex(p);
    var denseLimit = p.filterLimit == null ? p.limit : p.filterLimit;
    var allowedCount = allowed ? allowed.size : model.chunks.length;
    var pre = index.search(qv, { limit: denseLimit, allowed: allowed, mode: 'pre' });
    var post = index.search(qv, { limit: denseLimit, allowed: allowed, mode: 'post' });
    var noFilter = index.search(qv, { limit: denseLimit, allowed: null, mode: 'none' });
    function hitRate(items) {
      if (!q.probe.length) return null;
      if (!items.length) return 0;
      var hit = items.filter(function (it) {
        return q.probe.some(function (ph) { return it.chunk.text.indexOf(ph) !== -1; });
      }).length;
      return hit > 0 ? 1 : 0;
    }
    return {
      expression: expression,
      allowedCount: allowedCount,
      filtered: !!allowed,
      pre: pre,
      post: post,
      noFilter: noFilter,
      preHit: hitRate(pre.items),
      postHit: hitRate(post.items),
      mode: p.filterMode
    };
  }

  function stats(p) {
    var model = getModel(p);
    return {
      docs: CORPUS.docs.length,
      chunks: model.chunks.length,
      dim: p.dim,
      stations: M.data.milvus.STAGES.length,
      tokenChunks: model.chunks.reduce(function (s, c) { return s + Fuse.estimateTokens(c.text); }, 0),
      bm25Terms: getBM25(p).termStats(questionOf(p).text).length
    };
  }

  function graphStats(p) {
    var index = getIndex(p);
    var edges = 0;
    if (index.graph && index.graph.neighbors) {
      index.graph.neighbors.forEach(function (levels) {
        edges += ((levels[0] || []).length);
      });
    }
    var buildMsModel = Math.round(
      (getModel(p).chunks.length * p.M * (1 + p.efConstruction / 80)) / 12
    );
    return {
      edges: edges,
      avgDegree: index.graph ? edges / Math.max(1, index.graph.neighbors.length) : 0,
      buildMsModel: buildMsModel
    };
  }

  function clear() {
    cache = {};
  }

  var api = {
    getChunks: getChunks,
    getModel: getModel,
    getBM25: getBM25,
    getIndex: getIndex,
    questionOf: questionOf,
    queryVectorOf: queryVectorOf,
    expressionOf: expressionOf,
    allowedOf: allowedOf,
    denseSearch: denseSearch,
    sparseSearch: sparseSearch,
    fused: fused,
    ranked: ranked,
    contextOf: contextOf,
    answerOf: answerOf,
    writeTimeline: writeTimeline,
    routeSimulation: routeSimulation,
    filterSimulation: filterSimulation,
    stats: stats,
    graphStats: graphStats,
    clear: clear,
    DEFAULT_THRESHOLD: DEFAULT_THRESHOLD
  };

  root.MILVUS = root.MILVUS || {};
  root.MILVUS.Pipe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
