/* ==========================================================================
   engine.hnsw.js — 真实构建的 FLAT / HNSW / IVF_FLAT / DISKANN（简化）检索
   - HNSW：分层图 + 贪心下降 + ef 候选池；邻居数受 M 限制，建图候选受 efConstruction 限制
   - IVF：k-means 聚类 + nprobe 倒排扫描
   - FLAT：暴力扫描，作为 recall 的基准
   - DISKANN：HNSW 图 + 8 位标量量化距离遍历 + 全精度重排（页面对 DiskANN 的简化）
   visited 是距离计算次数，不是网络请求数；全部在浏览器里真实发生。
   ========================================================================== */
(function (root) {
  'use strict';

  var Text = root.MILVUS.Text;

  function metricScorer(metric) {
    if (metric === 'L2') {
      return {
        sim: function (a, b) {
          var s = 0;
          for (var i = 0; i < a.length; i++) {
            var d = a[i] - b[i];
            s += d * d;
          }
          return -Math.sqrt(s);
        },
        distance: function (s) { return -s; }
      };
    }
    if (metric === 'IP') {
      return {
        sim: function (a, b) {
          var s = 0;
          for (var i = 0; i < a.length; i++) s += a[i] * b[i];
          return s;
        },
        distance: function (s) { return s; }
      };
    }
    return {
      sim: function (a, b) {
        var s = 0;
        var na = 0;
        var nb = 0;
        for (var i = 0; i < a.length; i++) {
          s += a[i] * b[i];
          na += a[i] * a[i];
          nb += b[i] * b[i];
        }
        if (!na || !nb) return 0;
        return s / Math.sqrt(na * nb);
      },
      distance: function (s) { return s; }
    };
  }

  function sortDesc(a, b) {
    return b.s - a.s;
  }

  function buildHNSW(vectors, ids, opts, scorer) {
    var n = vectors.length;
    var M = Math.max(2, Math.min(64, Math.round(opts.M || 16)));
    var efC = Math.max(2, Math.min(400, Math.round(opts.efConstruction || 200)));
    var rand = Text.mulberry32(0x51ed270b);
    var mL = 1 / Math.log(M);
    var levels = new Array(n);
    var neighbors = new Array(n);
    var maxLevel = 0;
    var entry = 0;
    var distanceEvals = 0;

    for (var i = 0; i < n; i++) {
      var u = Math.max(1e-9, rand());
      levels[i] = Math.min(6, Math.floor(-Math.log(u) * mL));
      neighbors[i] = [];
      for (var l = 0; l <= levels[i]; l++) neighbors[i].push([]);
    }
    if (!n) {
      return { neighbors: [], levels: [], maxLevel: -1, entry: -1, distanceEvals: 0 };
    }

    function simTo(q, j) {
      distanceEvals += 1;
      return scorer.sim(q, vectors[j]);
    }

    function searchLayer(q, entryId, ef, level) {
      var visited = new Uint8Array(n);
      var cand = [];
      var W = [];
      var s0 = simTo(q, entryId);
      visited[entryId] = 1;
      cand.push({ node: entryId, s: s0 });
      W.push({ node: entryId, s: s0 });
      while (cand.length) {
        cand.sort(sortDesc);
        var c = cand.shift();
        W.sort(sortDesc);
        if (W.length >= ef && c.s < W[W.length - 1].s) break;
        var list = neighbors[c.node][level] || [];
        for (var k = 0; k < list.length; k++) {
          var nb = list[k];
          if (visited[nb]) continue;
          visited[nb] = 1;
          var s = simTo(q, nb);
          if (W.length < ef || s > W[W.length - 1].s) {
            cand.push({ node: nb, s: s });
            W.push({ node: nb, s: s });
            W.sort(sortDesc);
            if (W.length > ef) W.pop();
          }
        }
      }
      return W;
    }

    function greedy(q, start, level) {
      var cur = start;
      var curS = simTo(q, cur);
      var improved = true;
      while (improved) {
        improved = false;
        var list = neighbors[cur][level] || [];
        for (var k = 0; k < list.length; k++) {
          var nb = list[k];
          var s = simTo(q, nb);
          if (s > curS) {
            curS = s;
            cur = nb;
            improved = true;
          }
        }
      }
      return { node: cur, s: curS };
    }

    function prune(node, level) {
      var arr = neighbors[node][level];
      if (arr.length <= M) return;
      arr.sort(function (a, b) {
        return scorer.sim(vectors[node], vectors[b]) - scorer.sim(vectors[node], vectors[a]);
      });
      arr.length = M;
    }

    for (var idx = 1; idx < n; idx++) {
      var level = levels[idx];
      var ep = entry;
      for (var lc = maxLevel; lc > level; lc--) {
        ep = greedy(vectors[idx], ep, lc).node;
      }
      for (var lc2 = Math.min(level, maxLevel); lc2 >= 0; lc2--) {
        var W = searchLayer(vectors[idx], ep, efC, lc2);
        var sel = W.slice(0, M).map(function (w) { return w.node; });
        neighbors[idx][lc2] = sel.slice();
        for (var q = 0; q < sel.length; q++) {
          var nb = sel[q];
          if (neighbors[nb][lc2].indexOf(idx) === -1) neighbors[nb][lc2].push(idx);
          prune(nb, lc2);
        }
        if (W.length) ep = W[0].node;
      }
      if (level > maxLevel) {
        maxLevel = level;
        entry = idx;
      }
    }

    return {
      neighbors: neighbors,
      levels: levels,
      maxLevel: maxLevel,
      entry: entry,
      distanceEvals: distanceEvals
    };
  }

  function hnswSearch(graph, vectors, scorer, query, k, ef) {
    if (!graph.neighbors.length) return { items: [], visited: 0 };
    var before = graph.distanceEvals;
    var ep = graph.entry;
    var lc;
    for (lc = graph.maxLevel; lc > 0; lc--) {
      var cur = ep;
      var curS = scorer.sim(query, vectors[cur]);
      graph.distanceEvals += 1;
      var improved = true;
      while (improved) {
        improved = false;
        var list = graph.neighbors[cur][lc] || [];
        for (var j = 0; j < list.length; j++) {
          var nb = list[j];
          var s = scorer.sim(query, vectors[nb]);
          graph.distanceEvals += 1;
          if (s > curS) {
            curS = s;
            cur = nb;
            improved = true;
          }
        }
      }
      ep = cur;
    }
    var efSearch = Math.max(1, Math.min(vectors.length, Math.round(ef || 64)));
    var W = (function () {
      var visited = new Uint8Array(vectors.length);
      var cand = [];
      var res = [];
      var s0 = scorer.sim(query, vectors[ep]);
      graph.distanceEvals += 1;
      visited[ep] = 1;
      cand.push({ node: ep, s: s0 });
      res.push({ node: ep, s: s0 });
      while (cand.length) {
        cand.sort(sortDesc);
        var c = cand.shift();
        res.sort(sortDesc);
        if (res.length >= efSearch && c.s < res[res.length - 1].s) break;
        var lst = graph.neighbors[c.node][0] || [];
        for (var q = 0; q < lst.length; q++) {
          var nb2 = lst[q];
          if (visited[nb2]) continue;
          visited[nb2] = 1;
          var s2 = scorer.sim(query, vectors[nb2]);
          graph.distanceEvals += 1;
          if (res.length < efSearch || s2 > res[res.length - 1].s) {
            cand.push({ node: nb2, s: s2 });
            res.push({ node: nb2, s: s2 });
            res.sort(sortDesc);
            if (res.length > efSearch) res.pop();
          }
        }
      }
      return res;
    })();
    return {
      items: W.slice(0, Math.min(k, W.length)),
      visited: graph.distanceEvals - before
    };
  }

  function kmeans(vectors, nlist, scorer) {
    var n = vectors.length;
    var k = Math.max(1, Math.min(n, Math.round(nlist || 8)));
    var rand = Text.mulberry32(0xc0ffee01);
    var centroids = [];
    var used = Object.create(null);
    for (var i = 0; i < k; i++) {
      var pick = Math.min(n - 1, Math.floor((i * n) / k));
      if (used[pick]) pick = Math.floor(rand() * n);
      used[pick] = 1;
      centroids.push(vectors[pick].slice());
    }
    var assignment = new Int32Array(n).fill(-1);
    for (var iter = 0; iter < 14; iter++) {
      var changed = false;
      for (var v = 0; v < n; v++) {
        var best = 0;
        var bestSim = -Infinity;
        for (var c = 0; c < k; c++) {
          var s = scorer.sim(vectors[v], centroids[c]);
          if (s > bestSim) {
            bestSim = s;
            best = c;
          }
        }
        if (assignment[v] !== best) {
          assignment[v] = best;
          changed = true;
        }
      }
      var sums = centroids.map(function (c) {
        return { v: new Float64Array(c.length), n: 0 };
      });
      for (var v2 = 0; v2 < n; v2++) {
        var a = assignment[v2];
        var sv = sums[a];
        sv.n += 1;
        for (var d = 0; d < vectors[v2].length; d++) sv.v[d] += vectors[v2][d];
      }
      sums.forEach(function (s, ci) {
        if (!s.n) return;
        for (var d2 = 0; d2 < s.v.length; d2++) s.v[d2] /= s.n;
        centroids[ci] = s.v;
      });
      if (!changed && iter > 2) break;
    }
    var lists = centroids.map(function () { return []; });
    for (var v3 = 0; v3 < n; v3++) lists[assignment[v3]].push(v3);
    return { nlist: k, centroids: centroids, assignment: assignment, lists: lists };
  }

  function cosineSim(a, b) {
    var s = 0;
    var na = 0;
    var nb = 0;
    for (var i = 0; i < a.length; i++) {
      s += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return na && nb ? s / Math.sqrt(na * nb) : 0;
  }

  function quantize(vectors) {
    if (!vectors.length) return { q: [], dim: 0 };
    var dim = vectors[0].length;
    var min = new Float64Array(dim).fill(Infinity);
    var max = new Float64Array(dim).fill(-Infinity);
    vectors.forEach(function (v) {
      for (var d = 0; d < dim; d++) {
        if (v[d] < min[d]) min[d] = v[d];
        if (v[d] > max[d]) max[d] = v[d];
      }
    });
    var q = vectors.map(function (v) {
      var out = new Float64Array(dim);
      for (var d2 = 0; d2 < dim; d2++) {
        var span = max[d2] - min[d2] || 1;
        out[d2] = Math.round(((v[d2] - min[d2]) / span) * 255) / 255;
      }
      return out;
    });
    return { q: q, dim: dim };
  }

  function create(config) {
    var chunks = config.chunks;
    var vectors = config.vectors;
    var ids = chunks.map(function (c) { return c.id; });
    var indexOf = Object.create(null);
    ids.forEach(function (id, i) { indexOf[id] = i; });
    var type = config.type || 'HNSW';
    var metric = config.metric || 'COSINE';
    var scorer = metricScorer(metric);
    var M = config.M == null ? 16 : config.M;
    var efC = config.efConstruction == null ? 200 : config.efConstruction;
    var nlist = config.nlist == null ? 8 : config.nlist;
    var n = vectors.length;
    var graph = null;
    var clusters = null;
    var exactVectors = vectors;
    var searchVectors = vectors;
    var totalVisited = 0;

    if (type === 'HNSW' || type === 'DISKANN') {
      if (type === 'DISKANN') {
        var q = quantize(vectors);
        searchVectors = q.q;
      }
      graph = buildHNSW(searchVectors, ids, { M: M, efConstruction: efC }, scorer);
    } else if (type === 'IVF_FLAT') {
      clusters = kmeans(vectors, nlist, scorer);
    }

    function chunkAt(i) {
      return chunks[i];
    }

    function exactSearch(query, opts) {
      opts = opts || {};
      var allowed = opts.allowed || null;
      var limit = opts.limit == null ? 5 : opts.limit;
      var out = [];
      for (var i = 0; i < n; i++) {
        if (allowed && !allowed.has(ids[i])) continue;
        out.push({ i: i, s: scorer.sim(query, vectors[i]) });
      }
      out.sort(function (a, b) {
        return b.s - a.s || ids[a.i].localeCompare(ids[b.i]);
      });
      return {
        items: out.slice(0, limit).map(function (r) {
          return { chunk: chunkAt(r.i), index: r.i, score: r.s, distance: scorer.distance(r.s) };
        }),
        visited: out.length
      };
    }

    function search(query, opts) {
      opts = opts || {};
      var k = Math.max(1, opts.limit == null ? 5 : opts.limit);
      var allowed = opts.allowed || null;
      var mode = opts.mode || (allowed ? 'pre' : 'none');

      /* pre-filter：页面实现为「在过滤后的子集里检索」，便于与 post-filter 对照。
         post-filter：先按索引取 Top-k，再筛。 */
      if (allowed && mode === 'pre') {
        var pre = exactSearch(query, { limit: k, allowed: allowed });
        pre.mode = 'pre';
        pre.usedIndex = 'filtered-scan';
        return pre;
      }

      var res;
      if (type === 'FLAT') {
        res = exactSearch(query, { limit: k });
      } else if (type === 'IVF_FLAT') {
        var nprobe = Math.max(1, Math.min(clusters.nlist, Math.round(opts.nprobe || 3)));
        var rankedClusters = clusters.centroids
          .map(function (c, ci) {
            return { ci: ci, s: cosineSim(query, c) };
          })
          .sort(function (a, b) { return b.s - a.s; })
          .slice(0, nprobe);
        var seen = Object.create(null);
        var scan = [];
        rankedClusters.forEach(function (rc) {
          clusters.lists[rc.ci].forEach(function (i) {
            if (seen[i]) return;
            seen[i] = 1;
            scan.push(i);
          });
        });
        var out = scan.map(function (i) {
          return { i: i, s: scorer.sim(query, vectors[i]) };
        });
        out.sort(function (a, b) { return b.s - a.s || ids[a.i].localeCompare(ids[b.i]); });
        res = {
          items: out.slice(0, k).map(function (r) {
            return { chunk: chunkAt(r.i), index: r.i, score: r.s, distance: scorer.distance(r.s) };
          }),
          visited: scan.length,
          clustersScanned: rankedClusters.length
        };
      } else {
        var ef = Math.max(k, Math.round(opts.ef || 64));
        var hnsw = hnswSearch(graph, searchVectors, scorer, query, Math.max(k * 4, k), ef);
        if (type === 'DISKANN') {
          var rescored = hnsw.items.map(function (it) {
            return {
              chunk: chunkAt(it.node),
              index: it.node,
              score: scorer.sim(query, exactVectors[it.node]),
              distance: scorer.distance(scorer.sim(query, exactVectors[it.node]))
            };
          });
          rescored.sort(function (a, b) { return b.score - a.score; });
          res = { items: rescored.slice(0, k), visited: hnsw.visited + rescored.length };
        } else {
          res = {
            items: hnsw.items.slice(0, k).map(function (it) {
              return {
                chunk: chunkAt(it.node),
                index: it.node,
                score: it.s,
                distance: scorer.distance(it.s)
              };
            }),
            visited: hnsw.visited
          };
        }
      }

      res.usedIndex = type;
      if (allowed && mode === 'post') {
        res.items = res.items.filter(function (it) {
          return allowed.has(it.chunk.id);
        });
      }
      return res;
    }

    function recallAt(query, k, opts) {
      opts = opts || {};
      var allowed = opts.allowed || null;
      var gt = exactSearch(query, { limit: k, allowed: allowed }).items;
      var got = search(query, Object.assign({ limit: k }, opts)).items;
      if (!gt.length) return 1;
      var gotIds = Object.create(null);
      got.forEach(function (it) { gotIds[it.chunk.id] = 1; });
      var hit = gt.filter(function (it) { return gotIds[it.chunk.id]; }).length;
      return hit / gt.length;
    }

    function memory() {
      var dim = vectors.length ? vectors[0].length : 0;
      var bytes;
      var formula;
      var parts;
      if (type === 'HNSW') {
        var graphBytes = n * M * 4;
        var vecBytes = n * dim * 4;
        formula = 'N × M × 4 B + N × dim × 4 B';
        parts = [
          { label: '邻居表', bytes: graphBytes },
          { label: '原始向量', bytes: vecBytes }
        ];
        bytes = graphBytes + vecBytes;
      } else if (type === 'IVF_FLAT') {
        var cents = nlist * dim * 4;
        var assign = n * 2;
        var raw = n * dim * 4;
        formula = 'nlist × dim × 4 B + N × 2 B + N × dim × 4 B';
        parts = [
          { label: '聚类中心', bytes: cents },
          { label: '簇分配', bytes: assign },
          { label: '原始向量', bytes: raw }
        ];
        bytes = cents + assign + raw;
      } else if (type === 'DISKANN') {
        var pq = n * 8;
        formula = '图在磁盘；常驻压缩向量按 8 B/条估算（PQ 8 子量化器）';
        parts = [{ label: '压缩向量（内存）', bytes: pq }];
        bytes = pq;
      } else {
        bytes = n * dim * 4;
        formula = 'N × dim × 4 B（全量原始向量）';
        parts = [{ label: '原始向量', bytes: bytes }];
      }
      return { bytes: bytes, formula: formula, parts: parts, dim: dim, n: n };
    }

    function neighborsOf(i) {
      if (!graph) return [];
      return (graph.neighbors[i] && graph.neighbors[i][0]) || [];
    }

    return {
      type: type,
      metric: metric,
      chunks: chunks,
      ids: ids,
      vectors: vectors,
      M: M,
      efConstruction: efC,
      nlist: clusters ? clusters.nlist : nlist,
      graph: graph,
      clusters: clusters,
      search: search,
      exact: exactSearch,
      recallAt: recallAt,
      memory: memory,
      neighborsOf: neighborsOf,
      scorer: scorer,
      indexOf: indexOf
    };
  }

  var api = { create: create };
  root.MILVUS = root.MILVUS || {};
  root.MILVUS.Index = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
