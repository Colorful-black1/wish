/* ==========================================================================
   stages.query.js — 站 6 · 查询向量化
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[5];
  var L = S.ui;

  function mount(body, ctx) {
    var resultHost = UI.el('div');
    var statsHost = UI.el('div');
    var tableHost = UI.el('div');

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
      resultHost,
      UI.note(S.result.note, { tip: D.COPY.marks.modelVector })
    ]));

    var picker = C.questionPicker(ctx);
    var ctlCustom = UI.control({
      type: 'text',
      id: 'customQuestion',
      label: L.controls.custom,
      value: ctx.params.question === 'custom' ? ctx.params.customQuestion : '',
      placeholder: L.controls.customPlaceholder,
      maxlength: 80,
      onChange: function (v) {
        if (!v.trim()) return;
        ctx.patch({ question: 'custom', customQuestion: v.trim(), dimMismatch: false });
      }
    });
    var ctlLimit = UI.control({
      type: 'range',
      id: 'limit',
      label: L.controls.limit,
      min: 1,
      max: 10,
      step: 1,
      value: ctx.params.limit,
      format: function (v) { return 'Top-' + v; },
      onInput: function (v) { ctx.set('limit', v); }
    });
    var ctlEf = UI.control({
      type: 'range',
      id: 'ef',
      label: L.controls.ef,
      min: 4,
      max: 256,
      step: 4,
      value: ctx.params.ef,
      format: function (v) { return 'ef = ' + v; },
      onInput: function (v) { ctx.set('ef', v); }
    });
    var ctlNprobe = UI.control({
      type: 'range',
      id: 'nprobe',
      label: L.controls.nprobe,
      min: 1,
      max: 16,
      step: 1,
      value: ctx.params.nprobe,
      format: function (v) { return 'nprobe = ' + v; },
      onInput: function (v) { ctx.set('nprobe', v); }
    });
    var ctlMismatch = UI.control({
      type: 'button',
      label: L.controls.mismatch,
      variant: 'warn',
      hint: L.controls.mismatchHint,
      onClick: function () {
        ctx.set('dimMismatch', !ctx.params.dimMismatch);
      }
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      picker.root,
      UI.controlsGrid([ctlCustom, ctlLimit, ctlEf, ctlNprobe, ctlMismatch]),
      statsHost,
      tableHost,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    var customInput = ctlCustom.querySelector('input');

    function update() {
      var p = ctx.params;
      picker.update();
      if (document.activeElement !== customInput) {
        customInput.value = p.question === 'custom' ? p.customQuestion : '';
      }
      ctlEf.hidden = p.indexType !== 'HNSW' && p.indexType !== 'DISKANN';
      ctlNprobe.hidden = p.indexType !== 'IVF_FLAT';
      ctlMismatch.querySelector('button').textContent = p.dimMismatch
        ? D.COPY.actions.mismatchBack
        : D.COPY.actions.mismatch;

      var model = M.Pipe.getModel(p);
      var embedder = model.embedder;
      var qv = M.Pipe.queryVectorOf(p);
      var dense = M.Pipe.denseSearch(p);
      var mismatch = !!p.dimMismatch;

      UI.clear(resultHost);
      UI.clear(statsHost);
      UI.clear(tableHost);

      if (mismatch) {
        resultHost.appendChild(UI.el('div', { class: 'errorbox', role: 'alert' }, [
          UI.el('b', { class: 'errorbox__title', text: L.error.title }),
          UI.el('p', {
            class: 'errorbox__body',
            text: L.error.body.replace('{dim}', p.dim)
          }),
          UI.el('code', { class: 'errorbox__code', text: 'dimension mismatch: expected ' + p.dim + ', got 768' })
        ]));
        statsHost.appendChild(UI.statsGrid([
          { label: L.stats.dim, value: 768, unit: '维（错误）' },
          { label: L.stats.norm, value: '—', unit: '' },
          { label: L.stats.top1, value: '—', unit: '' },
          { label: L.stats.candidates, value: 0, unit: '块' }
        ]));
        tableHost.appendChild(UI.callout(
          null,
          L.error.noSearch,
          'warn'
        ));
      } else {
        var top = dense.items[0];
        var topValue = top ? top.distance : 0;
        resultHost.appendChild(C.resultPre(C.json(dense.items.slice(0, 3).map(function (it) {
          return {
            id: it.chunk.id,
            distance: +it.distance.toFixed(4),
            entity: {
              text: it.chunk.text.slice(0, 56) + '…',
              source: it.chunk.source,
              dept: it.chunk.dept
            }
          };
        }))));

        statsHost.appendChild(UI.statsGrid([
          { label: L.stats.dim, value: p.dim, unit: '维' },
          { label: L.stats.norm, value: embedder.norm(qv).toFixed(3), unit: '' },
          {
            label: p.metric === 'L2' ? L.stats.top1Distance : L.stats.top1,
            value: top ? topValue.toFixed(4) : '—',
            unit: ''
          },
          {
            label: L.stats.candidates,
            value: dense.visited,
            unit: '点',
            note: L.table.candidatesNote.replace('{total}', model.chunks.length)
          }
        ]));

        tableHost.appendChild(UI.el('div', { class: 'tablebox' }, [
          UI.el('p', {
            class: 'tablebox__cap',
            text: L.table.caption.replace('{n}', Math.min(p.limit, dense.items.length))
          }),
          UI.table({
            head: L.table.head,
            rows: dense.items.map(function (it, i) {
              return {
                cells: [
                  String(i + 1),
                  it.chunk.id,
                  it.chunk.docTitle,
                  it.distance.toFixed(4),
                  it.chunk.text.slice(0, 44) + '…'
                ]
              };
            })
          }),
          UI.note(
            L.table.note
              .replace('{type}', p.indexType)
              .replace('{metric}', p.metric)
          )
        ]));
      }

      UI.clear(snippetHost);
      var snippetParams = mismatch ? Object.assign({}, p, { dim: 768 }) : p;
      snippetHost.appendChild(C.snippet(S, snippetParams, {}));
    }

    update();
    return { update: update };
  }

  M.Stages.query = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
