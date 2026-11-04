/* ==========================================================================
   stages.write.js — 站 5 · 写入与可见性（时间线为示意，可见性逻辑真算）
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[4];
  var L = S.ui;

  function mount(body, ctx) {
    var resultHost = UI.el('div');
    var statsHost = UI.el('div');
    var tlHost = UI.el('div');
    var tableHost = UI.el('div');
    var timeline = null;
    var tlData = null;
    var lastBatch = null;

    body.appendChild(UI.block(1, D.COPY.blocks.app, [
      UI.prose(S.app),
      C.sourceLinks(S.sources)
    ]));
    body.appendChild(UI.block(2, D.COPY.blocks.path, [
      UI.lanes(S.lane.active, { trace: S.lane.trace }),
      tlHost,
      UI.note(S.lane.note)
    ]));
    body.appendChild(UI.block(3, D.COPY.blocks.result, [
      UI.el('p', { class: 'lead', text: S.result.lead }),
      resultHost,
      UI.note(S.result.note)
    ]));

    var ctlConsistency = UI.control({
      type: 'segmented',
      label: L.controls.consistency,
      value: ctx.params.consistency,
      options: D.CONSISTENCY.levels.map(function (lv) {
        return { value: lv, label: lv };
      }),
      onChange: function (v) { ctx.set('consistency', v); }
    });
    var ctlBatch = UI.control({
      type: 'range',
      id: 'batch',
      label: L.controls.batch,
      min: 100,
      max: 2000,
      step: 100,
      value: ctx.params.batch,
      format: function (v) { return M.UI.num(v) + ' 行'; },
      onInput: function (v) { ctx.set('batch', v); }
    });
    var ctlT = UI.control({
      type: 'range',
      id: 't',
      label: L.controls.t,
      min: 0,
      max: 20,
      step: 0.1,
      value: ctx.params.t,
      format: function (v) { return 't = ' + Number(v).toFixed(1) + ' s'; },
      onInput: function (v) {
        ctx.params.t = v;
        if (timeline) timeline.setTime(v);
        renderTable(v);
        ctx.commit();
      }
    });
    var ctlInsert = UI.control({
      type: 'button',
      label: D.COPY.actions.insert,
      variant: 'solid',
      onClick: function () {
        if (!timeline) return;
        ctx.params.t = 0;
        if (ctlT._set) ctlT._set(0);
        ctx.commit();
        timeline.setTime(0);
        timeline.play();
      }
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      UI.controlsGrid([ctlInsert, ctlConsistency, ctlBatch, ctlT]),
      statsHost,
      tableHost,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    function renderTable(time) {
      if (!tlData) return;
      var levels = tlData.levels;
      var rows = [
        {
          cells: [
            D.CONSISTENCY.currentRow.replace('{t}', Number(time).toFixed(1)),
            time >= levels.Strong ? D.CONSISTENCY.yes : D.CONSISTENCY.no,
            time >= levels.Session ? D.CONSISTENCY.yes : D.CONSISTENCY.no,
            time >= levels.Bounded ? D.CONSISTENCY.yes : D.CONSISTENCY.no,
            time >= levels.Eventually ? D.CONSISTENCY.yes : D.CONSISTENCY.no
          ],
          className: 'is-current'
        }
      ];
      tlData.table.forEach(function (row) {
        rows.push({
          cells: [
            't = ' + row.t + ' s',
            row.Strong ? D.CONSISTENCY.yes : D.CONSISTENCY.no,
            row.Session ? D.CONSISTENCY.yes : D.CONSISTENCY.no,
            row.Bounded ? D.CONSISTENCY.yes : D.CONSISTENCY.no,
            row.Eventually ? D.CONSISTENCY.yes : D.CONSISTENCY.no
          ]
        });
      });
      UI.clear(tableHost);
      tableHost.appendChild(UI.el('div', { class: 'tablebox' }, [
        UI.el('p', { class: 'tablebox__cap' }, [
          UI.el('b', { text: L.table.title + ' ' }),
          UI.mark(D.COPY.marks.modelTime)
        ]),
        UI.table({
          head: D.CONSISTENCY.head,
          rows: rows
        }),
        UI.el('div', { class: 'legendline' }, D.CONSISTENCY.legend.map(function (tpl) {
          return UI.el('span', {
            text: tpl
              .replace('{bounded}', tlData.levels.Bounded.toFixed(2))
              .replace('{eventual}', tlData.levels.Eventually.toFixed(2))
          });
        })),
        UI.note(D.CONSISTENCY.note)
      ]));
    }

    function buildTimeline() {
      tlData = M.Pipe.writeTimeline(ctx.params);
      UI.clear(tlHost);
      timeline = UI.timeline({
        labels: L.timeline,
        phases: tlData.phases,
        total: tlData.total,
        time: ctx.params.t,
        onFrame: function (t) {
          renderTable(t);
        },
        onTime: function (t) {
          ctx.params.t = Math.min(20, Number(t.toFixed(1)));
          if (ctlT._set) ctlT._set(ctx.params.t);
          ctx.commit();
          renderTable(ctx.params.t);
        }
      });
      tlHost.appendChild(timeline.root);
    }

    function update() {
      var p = ctx.params;
      if (ctlConsistency._set) ctlConsistency._set(p.consistency);
      if (lastBatch !== p.batch || !timeline) {
        lastBatch = p.batch;
        buildTimeline();
      } else {
        timeline.setTime(p.t);
      }
      if (!tlData) return;

      UI.clear(statsHost);
      var ph = tlData.phases;
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.count, value: M.UI.num(p.batch), unit: '行' },
        { label: L.stats.visibleAt, value: M.UI.ms(ph[2].t), unit: '', tip: D.COPY.marks.modelTime },
        { label: L.stats.sealedAt, value: M.UI.ms(ph[3].t), unit: '', tip: D.COPY.marks.modelTime },
        { label: L.stats.indexedAt, value: M.UI.ms(ph[4].t), unit: '', tip: D.COPY.marks.modelTime }
      ]));

      UI.clear(resultHost);
      resultHost.appendChild(C.resultPre(C.json({
        insert_count: p.batch,
        ids: [1000, 1001, 1002, 1003, 1004, 1005, '…'],
        cost: 0,
        consistency_level: p.consistency
      })));

      renderTable(p.t);
      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, p, { offset: 0 }));
    }

    update();
    return { update: update };
  }

  M.Stages.write = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
