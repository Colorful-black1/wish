/* ============================================================================
 * mechanics.js — 本地演示计算：近似分词、伪嵌入、注意力、softmax、Top-K/P、采样
 * 说明：所有数值仅用于解释数学关系，不代表任何真实模型。
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  var CJK_DICT = [
    '人工智能', '大语言模型', '语言模型', '大模型', '注意力', '人类语言', '上下文', '自注意力',
    '多头', '向量', '词向量', '位置编码', '分词器', '分词', '概率', '采样', '温度', '机制',
    '理解', '如何', '为什么', '什么', '语言', '人类', '智能', '人工', '模型', '生成', '预测',
    '回答', '问题', '原理', '流程', '计算', '处理', '输入', '输出', '文本', '训练', '推理',
    '关系', '语义', '抽象', '统计', '规律', '语料', '海量', '并不', '那样', '而是', '变成',
    '找出', '最后', '逐个', '下一个', '工作', '一个', '我们', '可以', '因为', '所以', '如果',
    '就是', '不是', '没有', '已经', '进行', '通过', '使用', '需要', '得到', '形成', '影响'
  ];
  CJK_DICT.sort(function (a, b) {
    return b.length - a.length;
  });

  var KNOWN_IDS = {
    人工智能: 18734,
    智能: 21106,
    人工: 30412,
    是: 19024,
    如何: 1739,
    理解: 15001,
    人类: 12568,
    语言: 17451,
    的: 6006,
    '？': 112,
    它: 1120,
    模型: 25366,
    注意力: 20816,
    机制: 9123,
    温度: 15873,
    token: 15339,
    attention: 4887,
    transformer: 4701,
    ai: 9552,
    llm: 37070,
    大语言模型: 10810,
    q: 871,
    k: 985
  };

  var COLORS = ['#4fe3ff', '#5a8dff', '#a57bff', '#6dffc0', '#ffc46b', '#ff7bd5'];

  function knownId(text) {
    if (Object.prototype.hasOwnProperty.call(KNOWN_IDS, text)) return KNOWN_IDS[text];
    return 1000 + (U.hashString(text) % 49000);
  }

  function cjkTokens(run) {
    var out = [];
    var i = 0;
    while (i < run.length) {
      var matched = '';
      for (var j = 0; j < CJK_DICT.length; j++) {
        var word = CJK_DICT[j];
        if (run.substr(i, word.length) === word) {
          matched = word;
          break;
        }
      }
      if (!matched) matched = run.charAt(i);
      out.push(matched);
      i += matched.length;
    }
    return out;
  }

  function latinTokens(word) {
    if (word.length <= 8) return [word];
    var pieces = [];
    var step = Math.ceil(word.length / Math.ceil(word.length / 5));
    for (var i = 0; i < word.length; i += step) pieces.push(word.slice(i, i + step));
    return pieces;
  }

  /**
   * 近似分词。返回 [{ text, id, kind, color, index }]
   * 不是 GPT/LLaMA 的真实词表；中文按常见词贪心合并，英文长词按 5 字符切分。
   */
  function tokenize(text) {
    var clean = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    var tokens = [];
    if (!clean) return tokens;

    var re = /[\u3400-\u9FFF\uF900-\uFAFF]+|[A-Za-z]+(?:['’][A-Za-z]+)?|\d+(?:\.\d+)?|[^\sA-Za-z0-9\u3400-\u9FFF\uF900-\uFAFF]+/g;
    var m;
    while ((m = re.exec(clean)) !== null) {
      var piece = m[0];
      var kind;
      if (/^[\u3400-\u9FFF\uF900-\uFAFF]+$/.test(piece)) {
        kind = 'cjk';
        cjkTokens(piece).forEach(function (t) {
          tokens.push(t);
        });
      } else if (/^[A-Za-z]/.test(piece)) {
        kind = 'latin';
        latinTokens(piece).forEach(function (t) {
          tokens.push(t);
        });
      } else if (/^\d/.test(piece)) {
        tokens.push(piece);
      } else {
        var chars = piece.match(/./g) || [piece];
        chars.forEach(function (ch) {
          tokens.push(ch);
        });
      }
    }

    return tokens.map(function (t, i) {
      return {
        text: t,
        id: knownId(t),
        kind: /^[\u3400-\u9FFF]$/.test(t) ? 'cjk' : 'sub',
        color: COLORS[i % COLORS.length],
        index: i
      };
    });
  }

  function stats(tokens) {
    var chars = tokens.reduce(function (sum, t) {
      return sum + t.text.length;
    }, 0);
    return {
      tokens: tokens.length,
      chars: chars,
      avg: tokens.length ? chars / tokens.length : 0
    };
  }

  /* ------------------------------------------------------------ 伪嵌入 */

  function vectorFor(token, dim) {
    dim = dim || 16;
    var rnd = U.rng((token.id * 2654435761) ^ 0x9e3779b9);
    var v = new Array(dim);
    var norm = 0;
    for (var i = 0; i < dim; i++) {
      v[i] = rnd() * 2 - 1;
      norm += v[i] * v[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (var j = 0; j < dim; j++) v[j] /= norm;
    return v;
  }

  function project(vec, seed, dim) {
    var rnd = U.rng(seed);
    var out = new Array(dim);
    var scale = 1 / Math.sqrt(dim);
    for (var i = 0; i < dim; i++) {
      var sum = 0;
      for (var j = 0; j < vec.length; j++) {
        sum += vec[j] * (rnd() * 2 - 1);
      }
      out[i] = sum * scale;
    }
    return out;
  }

  function dot(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function softmaxArr(arr) {
    var max = -Infinity;
    var i;
    for (i = 0; i < arr.length; i++) max = Math.max(max, arr[i]);
    var out = new Array(arr.length);
    var sum = 0;
    for (i = 0; i < arr.length; i++) {
      var e = Math.exp(arr[i] - max);
      out[i] = e;
      sum += e;
    }
    for (i = 0; i < out.length; i++) out[i] = out[i] / (sum || 1);
    return out;
  }

  /**
   * 真实可算的小规模因果自注意力。
   * 返回：Q/K/V（每 token 一组）、scores、weights、每个 token 的 top 关系。
   */
  function attention(tokens, opts) {
    opts = opts || {};
    var dim = opts.dim || 16;
    var headDim = 8;
    var n = Math.min(tokens.length, opts.limit || 8);
    var list = tokens.slice(0, n);
    var vectors = list.map(function (t) {
      return vectorFor(t, dim);
    });
    var Q = vectors.map(function (v) {
      return project(v, 101, headDim);
    });
    var K = vectors.map(function (v) {
      return project(v, 211, headDim);
    });
    var V = vectors;
    var scores = [];
    var weights = [];
    var scale = 1 / Math.sqrt(headDim);

    for (var i = 0; i < n; i++) {
      var row = new Array(n);
      var visible = [];
      for (var j = 0; j < n; j++) {
        if (opts.causal !== false && j > i) {
          row[j] = -Infinity;
        } else {
          // 轻微的位置衰减，让演示矩阵不只靠随机噪声
          row[j] = dot(Q[i], K[j]) * scale - (opts.positionBias === false ? 0 : Math.abs(i - j) * 0.06);
          visible.push(j);
        }
      }
      scores.push(row);
      var masked = row.map(function (x) {
        return isFinite(x) ? x : -1e9;
      });
      var probs = softmaxArr(masked);
      weights.push(probs);
    }

    var pairs = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (weights[r][c] > 0.01) {
          pairs.push({ from: r, to: c, weight: weights[r][c] });
        }
      }
    }
    pairs.sort(function (a, b) {
      return b.weight - a.weight;
    });

    return {
      tokens: list,
      Q: Q,
      K: K,
      V: V,
      scores: scores,
      weights: weights,
      pairs: pairs,
      dim: headDim
    };
  }

  /* ------------------------------------------------------------ 采样 */

  function softmax(z, temperature) {
    var t = Math.max(0.05, temperature == null ? 1 : temperature);
    return softmaxArr(
      z.map(function (v) {
        return v / t;
      })
    );
  }

  /**
   * 对候选词执行 temperature → top-k → top-p → 重归一化。
   * 返回每一阶段的结果，供 UI 同时展示“截断前/后”。
   */
  function distribution(cands, opts) {
    opts = opts || {};
    var temperature = opts.temperature == null ? 0.9 : opts.temperature;
    var topK = Math.max(1, Math.min(cands.length, opts.topK || 5));
    var topP = Math.max(0.05, Math.min(1, opts.topP == null ? 0.9 : opts.topP));

    var logits = cands.map(function (c) {
      return c.logit;
    });
    var base = softmax(logits, temperature);

    var order = cands
      .map(function (c, i) {
        return { i: i, p: base[i] };
      })
      .sort(function (a, b) {
        return b.p - a.p;
      });

    // Top-K
    var keep = {};
    order.slice(0, topK).forEach(function (o) {
      keep[o.i] = true;
    });

    // Top-P：在 Top-K 保留集合上继续按累计概率截断
    var cum = 0;
    var pKeep = {};
    var stopped = false;
    order.forEach(function (o) {
      if (!keep[o.i] || stopped) return;
      pKeep[o.i] = true;
      cum += o.p;
      if (cum >= topP) stopped = true;
    });

    var keptIdx = cands.map(function (_, i) {
      return i;
    }).filter(function (i) {
      return pKeep[i];
    });
    if (!keptIdx.length) keptIdx = [order[0].i];

    var sum = keptIdx.reduce(function (s, i) {
      return s + base[i];
    }, 0);
    var final = cands.map(function (c, i) {
      return pKeep[i] ? base[i] / (sum || 1) : 0;
    });

    var pick = opts.pick;
    if (pick == null) {
      if (opts.greedy) {
        pick = order[0].i;
      } else {
        var r = typeof opts.random === 'function' ? opts.random() : Math.random();
        var acc = 0;
        pick = keptIdx[0];
        for (var k = 0; k < keptIdx.length; k++) {
          var idx = keptIdx[k];
          acc += final[idx];
          if (r <= acc) {
            pick = idx;
            break;
          }
        }
      }
    }

    return {
      temperature: temperature,
      topK: topK,
      topP: topP,
      probs: base,
      final: final,
      kept: cands.map(function (_, i) {
        return !!pKeep[i];
      }),
      keptIdx: keptIdx,
      order: order.map(function (o) {
        return o.i;
      }),
      pick: pick,
      cum: keptIdx.reduce(function (s, i) {
        return s + base[i];
      }, 0)
    };
  }

  /** 供 3D / DOM 同时使用的候选列表 */
  function candidateList() {
    return LLM.DEMO.vocab.map(function (c) {
      return { token: c.token, logit: c.logit };
    });
  }

  LLM.Mech = {
    tokenize: tokenize,
    stats: stats,
    knownId: knownId,
    vectorFor: vectorFor,
    attention: attention,
    softmax: softmax,
    distribution: distribution,
    candidateList: candidateList,
    COLORS: COLORS
  };
})();
