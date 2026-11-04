/* ==========================================================================
   engine.bm25.js — 真实的 BM25 打分（词元、df、IDF、单条得分都可解释）
   中文按字符二元组建词；公式采用常见的 BM25（k1 / b 可调）。
   ========================================================================== */
(function (root) {
  'use strict';

  var Text = root.MILVUS.Text;

  function create(chunks) {
    var docs = chunks.map(function (chunk) {
      var tokens = Text.tokenize(chunk.text);
      var tf = Object.create(null);
      tokens.forEach(function (t) {
        tf[t] = (tf[t] || 0) + 1;
      });
      return { chunk: chunk, tf: tf, len: tokens.length };
    });
    var N = docs.length;
    var avgdl = docs.reduce(function (s, d) { return s + d.len; }, 0) / (N || 1);
    var df = Object.create(null);
    docs.forEach(function (d) {
      Object.keys(d.tf).forEach(function (t) {
        df[t] = (df[t] || 0) + 1;
      });
    });

    function idf(t) {
      var d = df[t] || 0;
      return Math.log(1 + (N - d + 0.5) / (d + 0.5));
    }

    function analyze(query) {
      var terms = Text.uniqueTokens(query);
      return terms.map(function (t) {
        return { term: t, df: df[t] || 0, idf: +idf(t).toFixed(4) };
      });
    }

    function scoreDoc(doc, terms, k1, b) {
      var s = 0;
      var parts = [];
      terms.forEach(function (t) {
        var f = doc.tf[t] || 0;
        if (!f) return;
        var contribution =
          idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.len) / avgdl)));
        s += contribution;
        parts.push({ term: t, tf: f, idf: +idf(t).toFixed(4), contribution: contribution });
      });
      return { score: s, parts: parts };
    }

    function search(query, opts) {
      opts = opts || {};
      var k1 = opts.k1 == null ? 1.2 : opts.k1;
      var b = opts.b == null ? 0.75 : opts.b;
      var terms = Text.uniqueTokens(query);
      var allowed = opts.allowed || null;
      var out = [];
      docs.forEach(function (doc) {
        if (allowed && !allowed.has(doc.chunk.id)) return;
        var r = scoreDoc(doc, terms, k1, b);
        if (r.score > 0) {
          out.push({
            chunk: doc.chunk,
            id: doc.chunk.id,
            score: r.score,
            terms: r.parts
          });
        }
      });
      out.sort(function (a, b2) {
        if (b2.score !== a.score) return b2.score - a.score;
        return a.id.localeCompare(b2.id);
      });
      var limit = opts.limit == null ? out.length : opts.limit;
      return { all: out, top: out.slice(0, limit), terms: terms, N: N, avgdl: avgdl };
    }

    function explain(chunkId, query, opts) {
      var doc = docs.filter(function (d) { return d.chunk.id === chunkId; })[0];
      if (!doc) return null;
      var k1 = (opts && opts.k1) == null ? 1.2 : opts.k1;
      var b = (opts && opts.b) == null ? 0.75 : opts.b;
      var terms = Text.uniqueTokens(query);
      var r = scoreDoc(doc, terms, k1, b);
      return { chunk: doc.chunk, score: r.score, parts: r.parts, len: doc.len, avgdl: avgdl, N: N };
    }

    function termStats(query) {
      return analyze(query)
        .filter(function (t) { return t.df > 0; })
        .sort(function (a, b2) { return b2.idf - a.idf; });
    }

    return {
      N: N,
      avgdl: avgdl,
      search: search,
      explain: explain,
      analyze: analyze,
      termStats: termStats
    };
  }

  var api = { create: create };
  root.MILVUS = root.MILVUS || {};
  root.MILVUS.BM25 = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
