/* ==========================================================================
   engine.embed.js — 确定性示意向量 + 余弦/内积/投影（真算距离，示意向量）
   构造：概念词表命中 × 概念中心 + 词元哈希 + 以文本哈希为种子的噪声。
   不是真实 embedding 模型；同一段文本永远得到同一个向量。
   ========================================================================== */
(function (root) {
  'use strict';

  var Text = root.MILVUS.Text;
  var CORPUS = root.MILVUS.data.corpus;
  var FULL_DIM = 1024;

  function normOf(v) {
    var s = 0;
    for (var i = 0; i < v.length; i++) s += v[i] * v[i];
    return Math.sqrt(s);
  }

  function dot(a, b) {
    var n = Math.min(a.length, b.length);
    var s = 0;
    for (var i = 0; i < n; i++) s += a[i] * b[i];
    return s;
  }

  function cosine(a, b) {
    var na = normOf(a);
    var nb = normOf(b);
    if (!na || !nb) return 0;
    return dot(a, b) / (na * nb);
  }

  function normalize(v) {
    var n = normOf(v);
    if (!n) return v.slice();
    var out = new Float64Array(v.length);
    for (var i = 0; i < v.length; i++) out[i] = v[i] / n;
    return out;
  }

  function l2(a, b) {
    var n = Math.min(a.length, b.length);
    var s = 0;
    for (var i = 0; i < n; i++) {
      var d = a[i] - b[i];
      s += d * d;
    }
    return Math.sqrt(s);
  }

  function countTerm(text, term) {
    if (!term) return 0;
    if (/^[A-Za-z0-9._-]+$/.test(term)) {
      var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(?<![A-Za-z0-9])' + escaped + '(?![A-Za-z0-9])', 'gi');
      var m = text.match(re);
      return m ? m.length : 0;
    }
    var count = 0;
    var idx = text.indexOf(term);
    while (idx !== -1) {
      count += 1;
      idx = text.indexOf(term, idx + term.length);
    }
    return count;
  }

  function create(dim) {
    var d = Math.max(16, Math.min(FULL_DIM, dim || FULL_DIM));
    var rand = Text.mulberry32(0x9e3779b9);
    var centroids = {};
    CORPUS.CONCEPTS.forEach(function (concept, ci) {
      var v = new Float64Array(FULL_DIM);
      for (var i = 0; i < FULL_DIM; i++) v[i] = rand() * 2 - 1;
      var n = normOf(v) || 1;
      for (var j = 0; j < FULL_DIM; j++) v[j] /= n;
      centroids[concept.id] = v;
    });

    var cache = new Map();

    function embedFull(text) {
      var key = String(text || '');
      if (cache.has(key)) return cache.get(key);
      var v = new Float64Array(FULL_DIM);
      var lower = key.toLowerCase();

      CORPUS.CONCEPTS.forEach(function (concept) {
        var activation = 0;
        Object.keys(concept.terms).forEach(function (term) {
          var hits = countTerm(lower, term.toLowerCase());
          if (hits) activation += Math.min(3, hits) * concept.terms[term];
        });
        if (activation > 0) {
          var c = centroids[concept.id];
          var w = 1.55 * Math.min(2.2, activation);
          for (var i = 0; i < FULL_DIM; i++) v[i] += c[i] * w;
        }
      });

      /* 词元哈希：保留一点字面信息；精确编号权重很低，语义向量本来就不擅长它。 */
      var toks = Text.tokenize(key);
      var seen = Object.create(null);
      toks.forEach(function (t) {
        if (seen[t]) return;
        seen[t] = 1;
        var isCode = /^[a-z]+[-_]\d+$/.test(t) || /^\d{3,}$/.test(t);
        var w = isCode ? 0.08 : 0.3;
        var h = Text.hashString(t + '|' + FULL_DIM);
        var idx = h % FULL_DIM;
        v[idx] += (h >>> 16) % 2 ? w : -w;
      });

      /* 可复现噪声：同一个文本永远同一组噪声，但不同文本不会完全重合。 */
      var nr = Text.mulberry32(Text.hashString(key) ^ 0x85ebca6b);
      for (var k = 0; k < FULL_DIM; k++) v[k] += (nr() - 0.5) * 0.055;

      var out = v.slice(0, d);
      cache.set(key, out);
      if (cache.size > 4000) cache.clear();
      return out;
    }

    function conceptScores(text) {
      var lower = String(text || '').toLowerCase();
      return CORPUS.CONCEPTS.map(function (concept) {
        var activation = 0;
        Object.keys(concept.terms).forEach(function (term) {
          var hits = countTerm(lower, term.toLowerCase());
          if (hits) activation += Math.min(3, hits) * concept.terms[term];
        });
        return { id: concept.id, label: concept.label, value: activation };
      });
    }

    function project(vectors) {
      if (!vectors.length) return { points: [], axes: [] };
      var scores = vectors.map(function (v) {
        var activations = {};
        CORPUS.CONCEPTS.forEach(function (c) {
          activations[c.id] = dot(v, centroids[c.id]);
        });
        return activations;
      });
      var stats = CORPUS.CONCEPTS.map(function (c) {
        var vals = scores.map(function (s) { return s[c.id]; });
        var mean = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        var variance =
          vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / vals.length;
        return { id: c.id, label: c.label, variance: variance, mean: mean };
      }).sort(function (a, b) { return b.variance - a.variance; });
      var axes = stats.slice(0, 2);
      var points = vectors.map(function (v, i) {
        var x = dot(normalize(v), centroids[axes[0].id]);
        var y = dot(normalize(v), centroids[axes[1].id]);
        return { index: i, x: x, y: y };
      });
      return { points: points, axes: axes };
    }

    return {
      dim: d,
      fullDim: FULL_DIM,
      embed: embedFull,
      conceptScores: conceptScores,
      project: project,
      cosine: cosine,
      dot: dot,
      l2: l2,
      norm: normOf,
      normalize: normalize
    };
  }

  var api = { create: create, cosine: cosine, dot: dot, l2: l2, norm: normOf, normalize: normalize };
  root.MILVUS = root.MILVUS || {};
  root.MILVUS.Embed = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
