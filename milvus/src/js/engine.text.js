/* ==========================================================================
   engine.text.js — 分词、文档拼装、切分与统计（全部真算）
   ========================================================================== */
(function (root) {
  'use strict';

  var CJK_RUN = /[\u3400-\u9fff]+/g;
  var ASCII_WORD = /[a-z0-9]+(?:[-_.][a-z0-9]+)*/g;

  function hashString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 中文用字符二元组，英文/编号用整词。这样 BM25 不依赖外部分词器。 */
  function tokenize(text) {
    var out = [];
    var s = String(text || '').toLowerCase();
    var m;
    ASCII_WORD.lastIndex = 0;
    while ((m = ASCII_WORD.exec(s))) out.push(m[0]);
    CJK_RUN.lastIndex = 0;
    while ((m = CJK_RUN.exec(s))) {
      var run = m[0];
      if (run.length === 1) {
        out.push(run);
      } else {
        for (var i = 0; i < run.length - 1; i++) out.push(run.slice(i, i + 2));
      }
    }
    return out;
  }

  function uniqueTokens(text) {
    var seen = Object.create(null);
    var out = [];
    tokenize(text).forEach(function (t) {
      if (!seen[t]) {
        seen[t] = 1;
        out.push(t);
      }
    });
    return out;
  }

  function epoch(iso) {
    return Math.floor(Date.parse(iso + 'T00:00:00+08:00') / 1000);
  }

  function isoFromEpoch(sec) {
    var d = new Date(sec * 1000 + 8 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  }

  /* 把 docs 拼出可定位的全文：标题、每节标题与正文都有字符区间。 */
  function buildDocs(docs) {
    return docs.map(function (doc) {
      var fullText = '';
      var sections = doc.sections.map(function (sec) {
        var head = '## ' + sec.heading + '\n';
        var headingStart = fullText.length;
        fullText += head;
        var textStart = fullText.length;
        fullText += sec.text;
        var textEnd = fullText.length;
        fullText += '\n\n';
        return {
          heading: sec.heading,
          text: sec.text,
          headingStart: headingStart,
          headingEnd: textStart,
          textStart: textStart,
          textEnd: textEnd
        };
      });
      return {
        id: doc.id,
        title: doc.title,
        file: doc.file,
        dept: doc.dept,
        version: doc.version,
        updatedIso: doc.updated,
        updated: epoch(doc.updated),
        acl: doc.acl,
        color: doc.color,
        intro: doc.intro,
        fullText: fullText,
        sections: sections
      };
    });
  }

  function windowUnit(text, base, size, overlap) {
    var spans = [];
    if (text.length <= size) {
      if (text.length > 0) spans.push({ text: text, start: base, end: base + text.length });
      return spans;
    }
    var step = Math.max(1, size - overlap);
    for (var pos = 0; pos < text.length; pos += step) {
      var end = Math.min(text.length, pos + size);
      spans.push({ text: text.slice(pos, end), start: base + pos, end: base + end });
      if (end >= text.length) break;
    }
    return spans;
  }

  function median(nums) {
    if (!nums.length) return 0;
    var a = nums.slice().sort(function (x, y) { return x - y; });
    var mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function chunkDocs(rawDocs, opts) {
    var size = Math.max(80, Math.round(opts.size || 360));
    var overlap = Math.min(
      Math.max(0, Math.round(opts.overlap || 0)),
      Math.max(0, size - 40)
    );
    var byHeading = !!opts.byHeading;
    var docs = buildDocs(rawDocs);
    var chunks = [];
    var seq = 0;

    docs.forEach(function (doc) {
      var units = byHeading
        ? doc.sections.map(function (sec) {
            return {
              text: sec.text,
              start: sec.textStart,
              headingPath: doc.title + ' › ' + sec.heading
            };
          })
        : [
            {
              text: doc.fullText,
              start: 0,
              headingPath: doc.title
            }
          ];

      units.forEach(function (unit) {
        windowUnit(unit.text, unit.start, size, overlap).forEach(function (span) {
          seq += 1;
          chunks.push({
            id: 'C' + String(seq).padStart(2, '0'),
            seq: seq,
            docId: doc.id,
            docTitle: doc.title,
            source: doc.file,
            dept: doc.dept,
            version: doc.version,
            updated: doc.updated,
            updatedIso: doc.updatedIso,
            acl: doc.acl,
            color: doc.color,
            headingPath: unit.headingPath,
            text: span.text,
            start: span.start,
            end: span.end,
            chars: span.text.length
          });
        });
      });
    });

    /* 实测重叠：同一文档相邻块的字符区间交集。 */
    var overlaps = [];
    for (var i = 1; i < chunks.length; i++) {
      var a = chunks[i - 1];
      var b = chunks[i];
      if (a.docId === b.docId && b.start < a.end) overlaps.push(a.end - b.start);
    }

    var lengths = chunks.map(function (c) { return c.chars; });
    var fields = ['source', 'dept', 'version', 'updated', 'acl', 'headingPath'];
    var coverage = fields.map(function (f) {
      var filled = chunks.filter(function (c) {
        return c[f] !== '' && c[f] != null;
      }).length;
      return { field: f, filled: filled, pct: chunks.length ? filled / chunks.length : 0 };
    });
    var byDoc = docs.map(function (doc) {
      return {
        id: doc.id,
        title: doc.title,
        color: doc.color,
        count: chunks.filter(function (c) { return c.docId === doc.id; }).length
      };
    });

    return {
      docs: docs,
      chunks: chunks,
      stats: {
        count: chunks.length,
        median: median(lengths),
        mean: lengths.reduce(function (s, n) { return s + n; }, 0) / (lengths.length || 1),
        min: lengths.length ? Math.min.apply(null, lengths) : 0,
        max: lengths.length ? Math.max.apply(null, lengths) : 0,
        configSize: size,
        configOverlap: overlap,
        measuredOverlap: overlaps.length ? median(overlaps) : 0,
        measuredOverlapMax: overlaps.length ? Math.max.apply(null, overlaps) : 0,
        overlapPairs: overlaps.length,
        coverage: coverage,
        coveragePct: coverage.reduce(function (s, c) { return s + c.pct; }, 0) / coverage.length,
        byDoc: byDoc,
        byAcl: ['public', 'finance', 'security', 'support'].map(function (acl) {
          return { acl: acl, count: chunks.filter(function (c) { return c.acl === acl; }).length };
        }),
        byDept: ['platform', 'engine', 'security', 'finance', 'support'].map(function (dept) {
          return { dept: dept, count: chunks.filter(function (c) { return c.dept === dept; }).length };
        })
      }
    };
  }

  function splitSentences(text) {
    return String(text || '')
      .split(/(?<=[。！？；])/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function truncate(text, n) {
    var s = String(text || '');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  var api = {
    tokenize: tokenize,
    uniqueTokens: uniqueTokens,
    hashString: hashString,
    mulberry32: mulberry32,
    epoch: epoch,
    isoFromEpoch: isoFromEpoch,
    buildDocs: buildDocs,
    chunkDocs: chunkDocs,
    median: median,
    splitSentences: splitSentences,
    truncate: truncate
  };

  root.MILVUS = root.MILVUS || {};
  root.MILVUS.Text = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
