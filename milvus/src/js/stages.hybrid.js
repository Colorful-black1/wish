/* ==========================================================================
   stages.hybrid.js — 站 9 · 混合检索
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[8];
  var L = S.ui;

  function mount(body, ctx) {
    var statsHost = UI.el('div');
    var pathsHost = UI.el('div');
    var fusionHost = UI.el('div');
    var fusedHost = UI.el('div');
    var noticeHost = UI.el('div');

    body.appendChild(UI.block(1, D.COPY.blocks.app, [
      UI.prose(S.app),
      C.sourceLinks(S.sources)
    ]));
    body.appendChild(UI.block(2, D.COPY.blocks.path, [
      UI.lanes(S.lane.active, { trace: S.lane.trace }),
      UI.note(S.lane.note)
    ]));
    body.appendChild(UI.block(3, D.COPY.blocks.result, [
      UI.el('p', { class: 'lead', text: S.result.lead }),
      statsHost,
      pathsHost,
      fusionHost,
      fusedHost,
      UI.callout(L.exact.title, L.exact.body, 'ink')
    ]));

    var picker = C.questionPicker(ctx);
    var ctlRanker = UI.control({
      type: 'segmented',
      label: L.controls.ranker,
      value: ctx.params.ranker,
      options: [
        { value: 'weighted', label: L.controls.weighted },
        { value: 'rrf', label: L.controls.rrf }
      ],
      onChange: function (v) { ctx.set('ranker', v); }
    });
    var ctlDense = UI.control({
      type: 'range',
      id: 'wDense',
      label: L.controls.wDense,
      min: 0,
      max: 2,
      step: 0.1,
      value: ctx.params.wDense,
      format: function (v) { return Number(v).toFixed(1); },
      onInput: function (v) { ctx.set('wDense', v); }
    });
    var ctlSparse = UI.control({
      type: 'range',
      id: 'wSparse',
      label: L.controls.wSparse,
      min: 0,
      max: 2,
      step: 0.1,
      value: ctx.params.wSparse,
      format: function (v) { return Number(v).toFixed(1); },
      onInput: function (v) { ctx.set('wSparse', v); }
    });
    var ctlK1 = UI.control({
      type: 'range',
      id: 'k1',
      label: L.controls.k1,
      min: 0.5,
      max: 2.5,
      step: 0.1,
      value: ctx.params.k1,
      format: function (v) { return Number(v).toFixed(1); },
      onInput: function (v) { ctx.set('k1', v); }
    });
    var ctlB = UI.control({
      type: 'range',
      id: 'bm25b',
      label: L.controls.b,
      min: 0,
      max: 1,
      step: 0.05,
      value: ctx.params.b,
      format: function (v) { return Number(v).toFixed(2); },
      onInput: function (v) { ctx.set('b', v); }
    });
    var ctlLimit = UI.control({
      type: 'range',
      id: 'hybridLimit',
      label: L.controls.limit,
      min: 1,
      max: 10,
      step: 1,
      value: ctx.params.limit,
      format: function (v) { return 'Top-' + v; },
      onInput: function (v) { ctx.set('limit', v); }
    });
    var snippetHost = UI.el('div');
    var bm25Note = UI.note(L.copy.bm25Defaults);

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      picker.root,
      UI.controlsGrid([ctlRanker, ctlDense, ctlSparse, ctlK1, ctlB, ctlLimit]),
      noticeHost,
      bm25Note,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    function update() {
      var p = ctx.params;
      picker.update();
      if (ctlRanker._set) ctlRanker._set(p.ranker);
      ctlDense.hidden = p.ranker === 'rrf';
      ctlSparse.hidden = p.ranker === 'rrf';
      ctlK1.hidden = !p.bm25;
      ctlB.hidden = !p.bm25;
      bm25Note.hidden = !p.bm25;

      var bundle = M.Pipe.fused(p);
      var dense = bundle.dense;
      var sparse = bundle.sparse;
      var rows = bundle.rows;
      var q = M.Pipe.questionOf(p);

      UI.clear(noticeHost);
      if (!p.bm25) {
        noticeHost.appendChild(UI.callout(L.controls.disabled, null, 'warn'));
      }

      var answerRank = '—';
      for (var i = 0; i < rows.length; i++) {
        if (q.probe.some(function (ph) { return rows[i].chunk.text.indexOf(ph) !== -1; })) {
          answerRank = '#' + (i + 1);
          break;
        }
      }

      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.dense, value: dense.length, unit: '条' },
        { label: L.stats.sparse, value: sparse.length, unit: '条' },
        { label: L.stats.fused, value: rows.length, unit: '条' },
        {
          label: L.stats.answerRank,
          value: answerRank,
          unit: '',
          note: q.probe.length ? L.copy.rankNoteOn : L.copy.rankNoteOff
        }
      ]));

      UI.clear(pathsHost);
      pathsHost.appendChild(UI.el('div', { class: 'pathgrid' }, [
        UI.el('div', { class: 'pathcard pathcard--dense' }, [
          UI.el('h4', { text: L.copy.denseHeader.replace('{metric}', p.metric) }),
          UI.table({
            head: L.copy.denseHead,
            rows: dense.map(function (it, idx) {
              return {
                cells: [String(idx + 1), it.chunk.id + ' · ' + it.chunk.docTitle, it.distance.toFixed(4)]
              };
            })
          })
        ]),
        UI.el('div', { class: 'pathcard pathcard--sparse' }, [
          UI.el('h4', { text: p.bm25 ? L.copy.bm25Header : L.copy.bm25OffHeader }),
          p.bm25
            ? UI.table({
                head: L.copy.sparseHead,
                rows: sparse.map(function (it, idx) {
                  return {
                    cells: [String(idx + 1), it.chunk.id + ' · ' + it.chunk.docTitle, it.score.toFixed(3)]
                  };
                })
              })
            : C.empty(L.copy.bm25Empty)
        ])
      ]));

      UI.clear(fusionHost);
      var rankerText =
        p.ranker === 'rrf'
          ? 'RRFRanker(k=60)'
          : 'WeightedRanker(' + p.wSparse.toFixed(1) + ', ' + p.wDense.toFixed(1) + ')';
      fusionHost.appendChild(UI.el('div', { class: 'fusioncall' }, [
        UI.el('span', { class: 'fusioncall__k', text: 'FUSION' }),
        UI.el('code', {
          text: L.copy.fusionCall
            .replace('{ranker}', rankerText)
            .replace('{limit}', p.limit)
        })
      ]));

      UI.clear(fusedHost);
      fusedHost.appendChild(UI.el('div', { class: 'tablebox' }, [
        UI.el('p', {
          class: 'tablebox__cap',
          text: L.copy.fusedCap.replace('{ranker}', p.ranker === 'rrf' ? 'RRF' : 'WeightedRanker')
        }),
        UI.table({
          head: L.copy.fusedHead,
          rows: rows.slice(0, Math.max(p.limit, 5)).map(function (row, idx) {
            var before = Math.min(
              row.denseRank == null ? 999 : row.denseRank,
              row.sparseRank == null ? 999 : row.sparseRank
            );
            var moved = before === 999 ? '—' : (before > idx + 1 ? '↑' : before < idx + 1 ? '↓' : '=');
            return {
              cells: [
                String(idx + 1),
                row.chunk.id + ' · ' + row.chunk.docTitle,
                row.denseRank == null ? '—' : '#' + row.denseRank,
                row.sparseRank == null ? '—' : '#' + row.sparseRank,
                row.score.toFixed(4),
                moved
              ]
            };
          })
        }),
        UI.note(
          p.ranker === 'rrf'
            ? L.copy.rrfNote
            : L.copy.weightedNote
                .replace('{dense}', p.wDense.toFixed(1))
                .replace('{sparse}', p.wSparse.toFixed(1))
        )
      ]));

      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, p, {}));
    }

    update();
    return { update: update };
  }

  M.Stages.hybrid = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
