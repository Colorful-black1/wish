/* ==========================================================================
   stages.answer.js — 站 10 · 重排、上下文与生成
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[9];
  var L = S.ui;

  function mount(body, ctx) {
    var statsHost = UI.el('div');
    var answerHost = UI.el('div');
    var budgetHost = UI.el('div');
    var rerankHost = UI.el('div');
    var thresholdHost = UI.el('div');

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
      answerHost,
      budgetHost,
      rerankHost
    ]));

    var picker = C.questionPicker(ctx);
    var ctlRerank = UI.control({
      type: 'toggle',
      label: L.controls.rerank,
      value: ctx.params.rerank,
      onChange: function (v) { ctx.set('rerank', v); },
      hint: L.controls.rerankHint
    });
    var ctlTopN = UI.control({
      type: 'range',
      id: 'topN',
      label: L.controls.topN,
      min: 1,
      max: 5,
      step: 1,
      value: ctx.params.topN,
      format: function (v) { return 'Top-' + v; },
      onInput: function (v) { ctx.set('topN', v); }
    });
    var ctlBudget = UI.control({
      type: 'range',
      id: 'budget',
      label: L.controls.budget,
      min: 200,
      max: 1400,
      step: 50,
      value: ctx.params.budget,
      format: function (v) { return M.UI.num(v) + ' token'; },
      onInput: function (v) { ctx.set('budget', v); }
    });
    var ctlThreshold = UI.control({
      type: 'range',
      id: 'threshold',
      label: L.controls.threshold,
      min: 0,
      max: 0.9,
      step: 0.01,
      value: ctx.params.threshold,
      format: function (v) { return Number(v).toFixed(2); },
      onInput: function (v) { ctx.set('threshold', v); }
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      picker.root,
      UI.controlsGrid([ctlRerank, ctlTopN, ctlBudget, ctlThreshold]),
      UI.el('div', { class: 'threshold-note' }, thresholdHost),
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    function reasonText(item) {
      var parts = [];
      if (item.reasons) {
        if (item.reasons.heading) parts.push(L.reasons.heading);
        if (item.reasons.lexical > 0) parts.push(L.reasons.lexical + ' ' + item.reasons.lexical.toFixed(2));
        if (item.reasons.cosine > 0) parts.push(L.reasons.cosine + ' ' + item.reasons.cosine.toFixed(2));
      }
      return parts.length ? parts.join(' · ') : '—';
    }

    function update() {
      var p = ctx.params;
      picker.update();
      var out = M.Pipe.answerOf(p);
      var answer = out.answer;
      var context = out.context;
      var ranked = out.ranked;
      var q = out.question;

      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.ranking, value: ranked.rows.length, unit: '条' },
        {
          label: L.stats.tokens,
          value: context.used,
          unit: ' token',
          tip: D.COPY.marks.modelToken,
          note: L.copy.budgetNote.replace('{budget}', p.budget)
        },
        { label: L.stats.budget, value: p.budget, unit: ' token' },
        {
          label: L.stats.confidence,
          value: answer.best.toFixed(3),
          unit: '',
          note: L.copy.thresholdNote.replace('{threshold}', Number(p.threshold).toFixed(2))
        },
        {
          label: L.stats.citation,
          value: UI.pct(answer.citationRate),
          unit: '',
          note: L.copy.citationNote
            .replace('{hits}', answer.citationHits)
            .replace('{lines}', answer.lines.length)
        }
      ]));

      UI.clear(answerHost);
      if (answer.refused) {
        answerHost.appendChild(UI.el('div', { class: 'answer answer--refuse', role: 'status' }, [
          UI.el('div', { class: 'answer__head' }, [
            UI.el('b', { class: 'answer__title', text: L.answer.refuseTitle }),
            UI.el('span', { class: 'answer__score', text: 'best ' + answer.best.toFixed(3) + ' < ' + Number(p.threshold).toFixed(2) })
          ]),
          UI.el('p', {
            class: 'answer__body',
            text: L.answer.refuseBody
              .replace('{score}', answer.best.toFixed(3))
              .replace('{threshold}', Number(p.threshold).toFixed(2))
          }),
          UI.el('p', {
            class: 'answer__hint',
            text: L.copy.thresholdHint.replace('{t}', (answer.best - 0.02).toFixed(2))
          })
        ]));
      } else if (!answer.lines.length) {
        answerHost.appendChild(C.empty(L.answer.empty));
      } else {
        answerHost.appendChild(UI.el('div', { class: 'answer' }, [
          UI.el('div', { class: 'answer__head' }, [
            UI.el('b', { class: 'answer__title', text: L.answer.title }),
            UI.el('span', { class: 'answer__score', text: 'best ' + answer.best.toFixed(3) })
          ]),
          UI.el('ol', { class: 'answer__lines' }, answer.lines.map(function (line) {
            return UI.el('li', {
              class: 'answer__line' + (line.supported ? '' : ' is-weak')
            }, [
              UI.el('span', { class: 'answer__text', text: line.text }),
              UI.el('span', { class: 'answer__meta' }, [
                C.chunkRef(line.chunk, {
                  compact: true,
                  button: true,
                  onClick: function () { ctx.go(1, { focusChunkId: line.chunk.id }); }
                }),
                UI.el('span', { class: 'answer__conf', text: 'conf ' + line.confidence.toFixed(2) }),
                line.supported ? null : UI.el('span', { class: 'answer__flag', text: L.answer.unsupported })
              ])
            ]);
          })),
          UI.el('p', { class: 'answer__hint', text: L.answer.citeHint })
        ]));
      }

      /* 上下文预算条 */
      UI.clear(budgetHost);
      var bar = UI.el('div', { class: 'cbar', role: 'img', 'aria-label': L.budget.title + ' ' + context.used + ' / ' + context.budget + ' token' });
      context.segments.forEach(function (seg, i) {
        var w = (seg.tokens / context.budget) * 100;
        bar.appendChild(UI.el('span', {
          class: 'cbar__seg' + (seg.truncated ? ' is-cut' : ''),
          style: { width: w.toFixed(2) + '%' },
          title: seg.chunk.id + ' · ' + seg.tokens + ' token'
        }, UI.el('span', { class: 'cbar__id', text: seg.chunk.id })));
      });
      budgetHost.appendChild(UI.el('div', { class: 'tablebox budgetbox' }, [
        UI.el('p', { class: 'tablebox__cap' }, [
          UI.el('b', { text: L.budget.title + ' ' }),
          UI.mark(D.COPY.marks.modelToken)
        ]),
        bar,
        UI.el('div', { class: 'budgetbox__meta' }, [
          UI.el('span', { text: L.budget.used + ' ' + context.used + ' / ' + context.budget + ' token' }),
          UI.el('span', {
            class: context.truncated ? 'is-warn' : 'is-ok',
            text: context.truncated ? L.budget.truncated : L.budget.fit
          })
        ]),
        UI.el('details', { class: 'promptbox' }, [
          UI.el('summary', { text: L.answer.promptTitle }),
          UI.el('pre', { class: 'resultbox__pre', tabindex: '0' },
            UI.el('code', {
              text: context.segments.map(function (seg) {
                return '[' + seg.chunk.id + '] ' + seg.text;
              }).join('\n\n').slice(0, 900) + (context.segments.length ? '…' : '')
            }))
        ])
      ]));

      /* 重排前后 */
      UI.clear(rerankHost);
      var before = ranked.rows.slice(0, p.topN);
      var after = ranked.items.slice(0, p.topN);
      var byId = Object.create(null);
      after.forEach(function (it, i) { byId[it.chunk.id] = i; });
      rerankHost.appendChild(UI.el('div', { class: 'tablebox' }, [
        UI.el('p', {
          class: 'tablebox__cap',
          text: L.rerank.title + (p.rerank ? '' : L.copy.rerankOffTitle)
        }),
        UI.table({
          head: ['#', L.rerank.before, L.rerank.after, L.copy.confHead, L.rerank.reason],
          rows: before.map(function (row, i) {
            var afterIdx = byId[row.chunk.id];
            var afterItem = after.filter(function (it) { return it.chunk.id === row.chunk.id; })[0];
            return {
              cells: [
                String(i + 1),
                row.chunk.id + ' · ' + row.chunk.docTitle,
                afterIdx == null ? '—' : '#' + (afterIdx + 1),
                afterItem ? afterItem.confidence.toFixed(3) : '—',
                afterItem ? reasonText(afterItem) : '—'
              ]
            };
          })
        }),
        UI.note(p.rerank ? L.copy.rerankFormula : L.copy.rerankOffNote)
      ]));

      UI.clear(thresholdHost);
      if (answer.hard) {
        thresholdHost.appendChild(UI.callout(L.answer.title, L.threshold.hard, 'warn'));
      } else {
        thresholdHost.appendChild(UI.note(L.threshold.normal));
      }

      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, p, {}));
    }

    update();
    return { update: update };
  }

  M.Stages.answer = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
