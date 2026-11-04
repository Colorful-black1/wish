/* ==========================================================================
   engine.fuse.js — 融合、重排、token 估算、上下文预算与答案拼接
   WeightedRanker 在这里实现为「每路 min-max 归一化后加权求和」；
   RRF 使用常见的 1/(k + rank)。两者都是页面里的真实计算。
   ========================================================================== */
(function (root) {
  'use strict';

  var Text = root.MILVUS.Text;

  function minmax(items, key) {
    var vals = items.map(function (it) { return it[key]; });
    var lo = Math.min.apply(null, vals);
    var hi = Math.max.apply(null, vals);
    var span = hi - lo;
    var map = Object.create(null);
    items.forEach(function (it) {
      map[it.chunk.id] = span ? (it[key] - lo) / span : 1;
    });
    return { min: lo, max: hi, map: map };
  }

  function weighted(dense, sparse, wDense, wSparse) {
    var nd = minmax(dense, 'score');
    var ns = minmax(sparse, 'score');
    var byId = Object.create(null);
    dense.forEach(function (it, i) {
      byId[it.chunk.id] = {
        chunk: it.chunk,
        denseScore: it.score,
        denseRank: i + 1,
        denseNorm: nd.map[it.chunk.id],
        sparseScore: null,
        sparseRank: null,
        sparseNorm: 0,
        score: wDense * nd.map[it.chunk.id]
      };
    });
    sparse.forEach(function (it, i) {
      var row = byId[it.chunk.id];
      if (!row) {
        row = {
          chunk: it.chunk,
          denseScore: null,
          denseRank: null,
          denseNorm: 0,
          score: 0
        };
        byId[it.chunk.id] = row;
      }
      row.sparseScore = it.score;
      row.sparseRank = i + 1;
      row.sparseNorm = ns.map[it.chunk.id];
      row.score += wSparse * ns.map[it.chunk.id];
    });
    var out = Object.keys(byId).map(function (k) { return byId[k]; });
    out.sort(function (a, b) {
      return b.score - a.score || a.chunk.id.localeCompare(b.chunk.id);
    });
    return out;
  }

  function rrf(lists, k) {
    k = k || 60;
    var byId = Object.create(null);
    lists.forEach(function (list, li) {
      list.forEach(function (it, rank) {
        var row = byId[it.chunk.id];
        if (!row) {
          row = byId[it.chunk.id] = {
            chunk: it.chunk,
            score: 0,
            parts: [],
            denseScore: null,
            denseRank: null,
            sparseScore: null,
            sparseRank: null
          };
        }
        var inc = 1 / (k + rank + 1);
        row.score += inc;
        row.parts.push({ list: li, rank: rank + 1, inc: inc });
        if (li === 0) {
          row.denseScore = it.score;
          row.denseRank = rank + 1;
        } else {
          row.sparseScore = it.score;
          row.sparseRank = rank + 1;
        }
      });
    });
    var out = Object.keys(byId).map(function (key) { return byId[key]; });
    out.sort(function (a, b) {
      return b.score - a.score || a.chunk.id.localeCompare(b.chunk.id);
    });
    return out;
  }

  function lexicalCoverage(queryTokens, chunkText) {
    if (!queryTokens.length) return 0;
    var toks = Object.create(null);
    Text.tokenize(chunkText).forEach(function (t) { toks[t] = 1; });
    var hit = queryTokens.filter(function (t) { return toks[t]; }).length;
    return hit / queryTokens.length;
  }

  function headingHit(queryTokens, heading) {
    var t = String(heading || '').toLowerCase();
    return queryTokens.some(function (tok) {
      return tok.length > 1 && t.indexOf(tok) !== -1;
    });
  }

  /* 置信度 / 重排分数：页面自建的可解释公式，不是真实 reranker。 */
  function rerank(items, query, opts) {
    opts = opts || {};
    var embedder = opts.embedder;
    var queryVector = opts.queryVector;
    var tokens = Text.uniqueTokens(query);
    var out = items.map(function (it) {
      var lexical = lexicalCoverage(tokens, it.chunk.text + ' ' + it.chunk.headingPath);
      var cos = 0;
      if (embedder && queryVector) {
        var vec = opts.vectorOf ? opts.vectorOf(it.chunk) : null;
        if (vec) cos = embedder.cosine(queryVector, vec);
      }
      var heading = headingHit(tokens, it.chunk.headingPath) ? 1 : 0;
      var score = 0.6 * cos + 0.25 * lexical + 0.15 * heading;
      return {
        chunk: it.chunk,
        score: score,
        confidence: score,
        baseScore: it.score,
        lexical: lexical,
        cosine: cos,
        heading: heading,
        reasons: {
          lexical: lexical,
          cosine: cos,
          heading: heading
        }
      };
    });
    out.sort(function (a, b) {
      return b.score - a.score || a.chunk.id.localeCompare(b.chunk.id);
    });
    return out;
  }

  function estimateTokens(text) {
    var s = String(text || '');
    var cjk = (s.match(/[\u3400-\u9fff]/g) || []).length;
    var ascii = (s.match(/[A-Za-z0-9]+(?:[-_.][A-Za-z0-9]+)*/g) || []).length;
    var rest = s.length - cjk;
    ascii = Math.min(ascii, rest);
    var other = Math.max(0, rest - ascii);
    return Math.max(1, Math.ceil(cjk * 1.05 + ascii * 1.3 + other / 4));
  }

  function buildContext(items, opts) {
    var budget = opts.budget;
    var topN = opts.topN;
    var segments = [];
    var used = 0;
    var truncated = false;
    var chosen = items.slice(0, topN);
    for (var i = 0; i < chosen.length; i++) {
      var it = chosen[i];
      var prefix = '[' + it.chunk.id + '] ';
      var full = estimateTokens(prefix + it.chunk.text) + 4;
      if (used + full <= budget) {
        segments.push({
          chunk: it.chunk,
          text: it.chunk.text,
          tokens: full,
          truncated: false,
          confidence: it.confidence == null ? null : it.confidence
        });
        used += full;
        continue;
      }
      var remaining = budget - used;
      if (remaining > 30) {
        var charsFit = Math.max(
          20,
          Math.floor(
            (it.chunk.text.length * (remaining - 4)) /
              Math.max(1, estimateTokens(prefix + it.chunk.text))
          )
        );
        var cut = it.chunk.text.slice(0, charsFit);
        var cutTokens = estimateTokens(prefix + cut) + 4;
        segments.push({
          chunk: it.chunk,
          text: cut + '…',
          tokens: Math.min(remaining, cutTokens),
          truncated: true,
          confidence: it.confidence == null ? null : it.confidence
        });
        used += Math.min(remaining, cutTokens);
        truncated = true;
      }
      break;
    }
    return {
      segments: segments,
      used: used,
      budget: budget,
      truncated: truncated,
      remaining: Math.max(0, budget - used)
    };
  }

  function sentenceCandidates(chunk, question, probe) {
    var sentences = Text.splitSentences(chunk.text);
    if (!sentences.length) sentences = [Text.truncate(chunk.text, 80)];
    var tokens = Text.uniqueTokens(question);
    return sentences
      .map(function (s) {
        var probeHits = (probe || []).reduce(function (n, p) {
          return n + (s.indexOf(p) !== -1 ? 1 : 0);
        }, 0);
        var tokenHits = tokens.filter(function (t) {
          return s.toLowerCase().indexOf(t) !== -1;
        }).length;
        return { text: s, score: probeHits * 2 + tokenHits / Math.max(1, tokens.length) };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function assembleAnswer(input) {
    var question = input.question;
    var items = input.items || [];
    var threshold = input.threshold;
    var probe = input.probe || [];
    var defaultThreshold = input.defaultThreshold;
    var best = items.length ? Math.max.apply(null, items.map(function (it) {
      return it.confidence == null ? 0 : it.confidence;
    })) : 0;
    var refused = !items.length || best < threshold;
    var lines = [];
    if (!refused) {
      items.forEach(function (it) {
        var cands = sentenceCandidates(it.chunk, question, probe);
        var pick = cands[0] || { text: Text.truncate(it.chunk.text, 90) };
        var probeHit = probe.some(function (p) { return it.chunk.text.indexOf(p) !== -1; });
        lines.push({
          text: pick.text,
          chunk: it.chunk,
          confidence: it.confidence,
          supported: it.confidence >= defaultThreshold || probeHit
        });
      });
    }
    var citationHits = lines.filter(function (l) {
      return probe.some(function (p) { return l.chunk.text.indexOf(p) !== -1; });
    }).length;
    return {
      refused: refused,
      best: best,
      threshold: threshold,
      defaultThreshold: defaultThreshold,
      lines: lines,
      citationHits: citationHits,
      citationRate: lines.length ? citationHits / lines.length : 0,
      hard: !refused && threshold < defaultThreshold
    };
  }

  var api = {
    weighted: weighted,
    rrf: rrf,
    rerank: rerank,
    lexicalCoverage: lexicalCoverage,
    headingHit: headingHit,
    estimateTokens: estimateTokens,
    buildContext: buildContext,
    assembleAnswer: assembleAnswer,
    sentenceCandidates: sentenceCandidates
  };
  root.MILVUS = root.MILVUS || {};
  root.MILVUS.Fuse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
