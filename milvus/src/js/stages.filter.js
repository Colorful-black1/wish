/* ==========================================================================
   stages.filter.js — 站 8 · 过滤与分区
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var META = M.data.corpus.META;
  var S = D.STAGES[7];
  var L = S.ui;

  function mount(body, ctx) {
    var resultHost = UI.el('div');
    var statsHost = UI.el('div');
    var tableHost = UI.el('div');
    var incidentHost = UI.el('div');

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
      tableHost,
      incidentHost,
      UI.note(S.result.note)
    ]));

    var picker = C.questionPicker(ctx);
    var ctlDept = UI.control({
      type: 'select',
      id: 'dept',
      label: L.controls.dept,
      value: ctx.params.filter.dept,
      options: Object.keys(META.depts).map(function (k) {
        return { value: k, label: META.depts[k] + (k === 'all' ? '' : ' · ' + k) };
      }),
      onChange: function (v) {
        ctx.patch({ filter: Object.assign({}, ctx.params.filter, { dept: v }) });
      }
    });
    var ctlUpdated = UI.control({
      type: 'date',
      id: 'updatedFrom',
      label: L.controls.updated,
      value: ctx.params.filter.updatedFrom,
      onChange: function (v) {
        ctx.patch({ filter: Object.assign({}, ctx.params.filter, { updatedFrom: v }) });
      }
    });
    var clearTime = UI.control({
      type: 'button',
      label: L.controls.clearTime,
      onClick: function () {
        ctx.patch({ filter: Object.assign({}, ctx.params.filter, { updatedFrom: '' }) });
      }
    });
    var ctlAcl = UI.control({
      type: 'select',
      id: 'acl',
      label: L.controls.acl,
      value: ctx.params.filter.acl,
      options: Object.keys(META.acl).map(function (k) {
        return { value: k, label: META.acl[k] + (k === 'all' ? '' : '') };
      }),
      onChange: function (v) {
        ctx.patch({ filter: Object.assign({}, ctx.params.filter, { acl: v }) });
      }
    });
    var ctlMode = UI.control({
      type: 'segmented',
      label: L.controls.mode,
      value: ctx.params.filterMode,
      options: [
        { value: 'pre', label: L.controls.pre },
        { value: 'post', label: L.controls.post }
      ],
      onChange: function (v) { ctx.set('filterMode', v); },
      hint: L.controls.modeHint
    });
    var ctlLimit = UI.control({
      type: 'range',
      id: 'filterLimit',
      label: L.controls.limit,
      min: 1,
      max: 10,
      step: 1,
      value: ctx.params.filterLimit,
      format: function (v) { return 'Top-' + v; },
      onInput: function (v) { ctx.set('filterLimit', v); }
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      picker.root,
      UI.controlsGrid([ctlDept, ctlUpdated, clearTime, ctlAcl, ctlMode, ctlLimit]),
      statsHost,
      UI.el('div', { class: 'tablebox' }, [
        UI.el('p', { class: 'tablebox__cap', text: L.table.title }),
        UI.table({
          head: D.ISOLATION.head,
          rows: D.ISOLATION.rows.map(function (r) { return { cells: r }; })
        }),
        UI.note(D.ISOLATION.note)
      ]),
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    function update() {
      var p = ctx.params;
      picker.update();
      var deptSel = ctlDept.querySelector('select');
      var aclSel = ctlAcl.querySelector('select');
      var dateInput = ctlUpdated.querySelector('input');
      if (deptSel) deptSel.value = p.filter.dept;
      if (aclSel) aclSel.value = p.filter.acl;
      if (dateInput && document.activeElement !== dateInput) dateInput.value = p.filter.updatedFrom;
      if (ctlMode._set) ctlMode._set(p.filterMode);
      var sim = M.Pipe.filterSimulation(p);
      var active = p.filterMode === 'post' ? sim.post : sim.pre;
      var activeHit = p.filterMode === 'post' ? sim.postHit : sim.preHit;

      UI.clear(resultHost);
      resultHost.appendChild(UI.el('div', { class: 'exprbox' }, [
        UI.el('span', { class: 'exprbox__k', text: L.controls.expression }),
        UI.el('code', { class: 'exprbox__code', text: sim.expression || L.copy.noFilter })
      ]));
      resultHost.appendChild(UI.note(S.aclNote));
      resultHost.appendChild(UI.note(S.preNote));

      if (!sim.filtered) {
        var presetBtn = UI.el('button', {
          type: 'button',
          class: 'btn btn--mini btn--warn',
          text: L.controls.preset
        });
        presetBtn.addEventListener('click', function () {
          var q = M.data.questions.QUESTIONS.filter(function (item) {
            return item.id === 'q4';
          })[0];
          ctx.patch({
            question: 'q4',
            filter: Object.assign({ dept: 'all', updatedFrom: '', acl: 'all' }, q.filter),
            filterMode: 'post',
            filterLimit: 1
          });
        });
        resultHost.appendChild(UI.callout(null, [
          UI.el('p', { class: 'callout__body', text: L.copy.presetPrompt }),
          presetBtn
        ], 'ink'));
      }

      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        {
          label: L.stats.candidates,
          value: sim.allowedCount,
          unit: '块',
          note: sim.filtered
            ? L.copy.allLibrary.replace('{n}', M.Pipe.getModel(p).chunks.length)
            : L.copy.unfiltered
        },
        {
          label: L.stats.results,
          value: active.items.length,
          unit: '条',
          note: L.copy.resultsNote.replace('{n}', p.filterLimit)
        },
        {
          label: L.stats.hit,
          value: activeHit == null ? '—' : UI.pct(activeHit),
          unit: '',
          note: L.copy.hitNote
        },
        {
          label: L.stats.empty,
          value: active.items.length ? L.copy.no : L.copy.yes,
          unit: '',
          note: L.copy.emptyNote,
          className: active.items.length ? '' : 'stat--bad'
        }
      ]));

      UI.clear(tableHost);
      var compareRows = [
        {
          cells: [
            L.controls.pre,
            sim.allowedCount,
            sim.pre.items.length,
            sim.preHit == null ? '—' : UI.pct(sim.preHit),
            p.filterMode === 'pre' ? L.copy.current : ''
          ],
          className: p.filterMode === 'pre' ? 'is-current' : ''
        },
        {
          cells: [
            L.controls.post,
            M.Pipe.getModel(p).chunks.length,
            sim.post.items.length,
            sim.postHit == null ? '—' : UI.pct(sim.postHit),
            p.filterMode === 'post' ? L.copy.current : ''
          ],
          className: p.filterMode === 'post' ? 'is-current' : ''
        }
      ];
      tableHost.appendChild(UI.el('div', { class: 'tablebox' }, [
        UI.el('p', { class: 'tablebox__cap', text: L.copy.compareTitle }),
        UI.table({
          head: L.copy.compareHead,
          rows: compareRows
        }),
        UI.table({
          head: L.copy.resultHead,
          rows: active.items.map(function (it) {
            var hit = M.Pipe.questionOf(p).probe.some(function (ph) {
              return it.chunk.text.indexOf(ph) !== -1;
            });
            return {
              cells: [
                it.chunk.id,
                it.chunk.docTitle,
                it.chunk.acl,
                it.distance.toFixed(4),
                hit ? L.copy.yes : L.copy.no
              ]
            };
          })
        })
      ]));

      UI.clear(incidentHost);
      if (p.filterMode === 'post' && active.items.length === 0 && sim.filtered) {
        incidentHost.appendChild(UI.callout(
          L.incident.title,
          L.incident.body.replace('{k}', String(p.filterLimit)),
          'warn'
        ));
      } else if (p.filterMode === 'post' && sim.filtered && sim.pre.items.length > active.items.length) {
        incidentHost.appendChild(UI.callout(
          null,
          L.copy.postWarning
            .replace('{pre}', sim.pre.items.length)
            .replace('{post}', active.items.length)
            .replace('{what}', sim.preHit && !sim.postHit ? L.copy.whatAnswer : L.copy.whatCandidate),
          'warn'
        ));
      }

      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(
        S,
        Object.assign({}, p, { limit: p.filterLimit }),
        { expression: sim.expression, results: active.items.length }
      ));
    }

    update();
    return { update: update };
  }

  M.Stages.filter = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
