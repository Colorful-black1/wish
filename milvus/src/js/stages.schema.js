/* ==========================================================================
   stages.schema.js — 站 3 · 建模 Schema
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[2];
  var L = S.ui;

  function mount(body, ctx) {
    body.appendChild(UI.block(1, D.COPY.blocks.app, [
      UI.prose(S.app),
      C.sourceLinks(S.sources)
    ]));
    body.appendChild(UI.block(2, D.COPY.blocks.path, [
      UI.lanes(S.lane.active, { trace: S.lane.trace }),
      UI.note(S.lane.note)
    ]));

    var tableHost = UI.el('div');
    body.appendChild(UI.block(3, D.COPY.blocks.result, [
      UI.el('p', { class: 'lead', text: S.result.lead }),
      tableHost,
      UI.note(S.result.note)
    ]));

    var statsHost = UI.el('div');
    var effectsHost = UI.el('div');
    var ctlBm25 = UI.control({
      type: 'toggle',
      label: L.controls.bm25,
      value: ctx.params.bm25,
      onChange: function (v) { ctx.set('bm25', v); },
      hint: L.controls.bm25Hint
    });
    var ctlDynamic = UI.control({
      type: 'toggle',
      label: L.controls.dynamic,
      value: ctx.params.dynamic,
      onChange: function (v) { ctx.set('dynamic', v); },
      hint: L.controls.dynamicHint
    });
    var ctlPk = UI.control({
      type: 'segmented',
      label: L.controls.pk,
      value: ctx.params.pk,
      options: [
        { value: 'int64', label: 'INT64' },
        { value: 'varchar', label: 'VARCHAR + auto_id' }
      ],
      onChange: function (v) { ctx.set('pk', v); },
      hint: L.controls.pkHint
    });
    var snippetHost = UI.el('div');
    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      UI.controlsGrid([ctlBm25, ctlDynamic, ctlPk]),
      statsHost,
      effectsHost,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    function fieldRows(p) {
      var rows = [
        {
          cells: [
            'id',
            p.pk === 'varchar' ? 'VARCHAR' : 'INT64',
            p.pk === 'varchar' ? 'is_primary, auto_id=True, max_length=64' : 'is_primary',
            L.fieldNotes.id
          ]
        },
        {
          cells: ['dense', 'FLOAT_VECTOR', 'dim=' + p.dim, L.fieldNotes.dense]
        },
        {
          cells: ['text', 'VARCHAR', 'max_length=2000, enable_analyzer=True', L.fieldNotes.text]
        }
      ];
      if (p.bm25) {
        rows.push({
          cells: ['sparse', 'SPARSE_FLOAT_VECTOR', '由 BM25 Function 产出', L.fieldNotes.sparse]
        });
      }
      ['source', 'dept', 'version', 'acl'].forEach(function (name) {
        rows.push({
          cells: [name, 'VARCHAR', 'max_length=128', L.fieldNotes[name]]
        });
      });
      rows.push({ cells: ['updated', 'INT64', 'epoch 秒', L.fieldNotes.updated] });
      if (p.dynamic) {
        rows.push({ cells: ['$meta', 'JSON（保留动态字段）', 'enable_dynamic_field=True', L.fieldNotes.meta] });
      }
      return rows;
    }

    function update() {
      var p = ctx.params;
      if (ctlPk._set) ctlPk._set(p.pk);
      UI.clear(tableHost);
      tableHost.appendChild(UI.table({
        head: L.table.head,
        rows: fieldRows(p)
      }));
      tableHost.appendChild(UI.note(L.sparseIndexNote));

      var fieldCount = 8 + (p.bm25 ? 1 : 0) + (p.dynamic ? 1 : 0);
      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.fields, value: fieldCount, unit: '个' },
        { label: L.stats.vectorFields, value: p.bm25 ? 2 : 1, unit: '个' },
        { label: L.stats.scalarFields, value: 5, unit: '个' },
        { label: L.stats.analyzable, value: 1, unit: '个' }
      ]));

      UI.clear(effectsHost);
      effectsHost.appendChild(UI.el('div', { class: 'effects' }, [
        UI.el('h4', { class: 'subhead', text: L.effects.title }),
        UI.el('ul', { class: 'ticks' }, [
          UI.el('li', { text: p.bm25 ? L.effects.hybridOn : L.effects.hybridOff }),
          UI.el('li', { text: L.effects.aclOn }),
          p.dynamic ? UI.el('li', { text: L.effects.dynamicNote }) : null
        ])
      ]));

      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, p, {}));
    }

    update();
    return { update: update };
  }

  M.Stages.schema = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
