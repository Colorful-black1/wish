/* ==========================================================================
   stages.route.js — 站 7 · 检索路由与三级归并
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[6];
  var L = S.ui;

  function mount(body, ctx) {
    var lane = UI.lanes(S.lane.active, { trace: S.lane.trace });
    var walkBtn = UI.el('button', { type: 'button', class: 'btn btn--ghost btn--walk' }, [
      UI.el('span', { class: 'btn__glyph', text: '↦' }),
      UI.el('span', { class: 'btn__text', text: D.COPY.actions.walk })
    ]);
    var walking = false;
    walkBtn.addEventListener('click', function () {
      if (walking) return;
      walking = true;
      walkBtn.disabled = true;
      var seq = ['app', 'proxy', 'stream', 'query', 'object', 'query', 'stream', 'proxy'];
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        lane._setActive(seq);
        walking = false;
        walkBtn.disabled = false;
        return;
      }
      var i = 0;
      var timer = setInterval(function () {
        if (i === 0) lane._setActive([]);
        if (i >= seq.length) {
          clearInterval(timer);
          lane._setActive(S.lane.active);
          walking = false;
          walkBtn.disabled = false;
          return;
        }
        var acc = [];
        for (var j = 0; j <= i; j++) {
          if (acc.indexOf(seq[j]) === -1) acc.push(seq[j]);
        }
        lane._setActive(acc);
        i += 1;
      }, 420);
    });

    body.appendChild(UI.block(1, D.COPY.blocks.app, [
      UI.prose(S.app),
      C.sourceLinks(S.sources)
    ]));
    body.appendChild(UI.block(2, D.COPY.blocks.path, [
      lane,
      UI.el('div', { class: 'stage__actions' }, [walkBtn]),
      UI.note(S.lane.note)
    ]));

    var statsHost = UI.el('div');
    var compareHost = UI.el('div');
    body.appendChild(UI.block(3, D.COPY.blocks.result, [
      UI.el('p', { class: 'lead', text: S.result.lead }),
      statsHost,
      compareHost,
      UI.note(S.result.note),
      UI.note(S.result.filterNote)
    ]));

    var ladderHost = UI.el('div');
    var picker = C.questionPicker(ctx);
    var ctlGrowing = UI.control({
      type: 'range',
      id: 'growing',
      label: L.controls.growing,
      min: 0,
      max: 60,
      step: 5,
      value: ctx.params.growing,
      format: function (v) { return v + '%'; },
      onInput: function (v) { ctx.set('growing', v); }
    });
    var ctlNodes = UI.control({
      type: 'range',
      id: 'nodes',
      label: L.controls.nodes,
      min: 1,
      max: 6,
      step: 1,
      value: ctx.params.nodes,
      format: function (v) { return v + ' 个'; },
      onInput: function (v) { ctx.set('nodes', v); }
    });
    var ctlShards = UI.control({
      type: 'range',
      id: 'shards',
      label: L.controls.shards,
      min: 1,
      max: 4,
      step: 1,
      value: ctx.params.shards,
      format: function (v) { return v + ' 个'; },
      onInput: function (v) { ctx.set('shards', v); }
    });
    var ctlCand = UI.control({
      type: 'range',
      id: 'cand',
      label: L.controls.cand,
      min: 1,
      max: 20,
      step: 1,
      value: ctx.params.cand,
      format: function (v) { return v + ' 条'; },
      onInput: function (v) { ctx.set('cand', v); },
      hint: L.controls.candHint
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      picker.root,
      UI.controlsGrid([ctlGrowing, ctlNodes, ctlShards, ctlCand]),
      ladderHost,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    function topLine(items) {
      if (!items.length) return '—';
      return items.map(function (it) {
        return it.chunk.id + ' ' + it.score.toFixed(3);
      }).join(' · ');
    }

    function update() {
      var p = ctx.params;
      picker.update();
      var sim = M.Pipe.routeSimulation(p);

      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.shards, value: sim.shardCount, unit: '个' },
        { label: L.stats.nodes, value: sim.nodes, unit: '个/分片' },
        {
          label: L.stats.growing,
          value: sim.growingCount,
          unit: '块',
          note: L.table.sealedNote.replace('{n}', sim.sealedCount),
          tip: D.COPY.marks.modelDistribution
        },
        {
          label: L.stats.recall,
          value: UI.pct(sim.recall),
          unit: '',
          note: L.table.recallNote.replace('{k}', sim.limit).replace('{cand}', sim.cand)
        }
      ]));

      UI.clear(compareHost);
      var match = sim.global.every(function (it, i) {
        return sim.exact[i] && sim.exact[i].chunk.id === it.chunk.id;
      });
      compareHost.appendChild(UI.table({
        head: ['名次', '归并结果', '分数', '精确 Top-k（FLAT）', '一致'],
        rows: sim.global.map(function (it, i) {
          var ex = sim.exact[i];
          return {
            cells: [
              String(i + 1),
              it.chunk.id + ' · ' + it.chunk.docTitle,
              it.score.toFixed(4),
              ex ? ex.chunk.id + ' · ' + ex.chunk.docTitle : '—',
              ex && ex.chunk.id === it.chunk.id ? '✓' : '✗'
            ],
            className: ex && ex.chunk.id === it.chunk.id ? '' : 'is-diff'
          };
        })
      }));
      compareHost.appendChild(UI.el('p', {
        class: 'note ' + (match ? 'note--ok' : 'note--warn'),
        text: match ? L.table.consistent : L.table.inconsistent
      }));
      compareHost.appendChild(UI.callout(
        L.table.concat,
        L.table.concatCurrent.replace('{ids}', sim.naive.map(function (it) { return it.chunk.id; }).join(' · ')),
        'warn'
      ));

      UI.clear(ladderHost);
      var rows = [];
      sim.shards.forEach(function (shard) {
        rows.push({
          cells: [
            L.table.shardStreaming.replace('{id}', shard.id),
            shard.growing.chunkCount + ' 块',
            topLine(shard.growing.top)
          ],
          className: 'is-leaf'
        });
        shard.queryNodes.forEach(function (node) {
          rows.push({
            cells: [
              L.table.shardQuery
                .replace('{id}', shard.id)
                .replace('{node}', node.id)
                .replace('{segments}', node.segments.length),
              node.chunkCount + ' 块',
              topLine(node.top)
            ],
            className: 'is-leaf'
          });
        });
        rows.push({
          cells: [
            L.table.shardMerge.replace('{id}', shard.id),
            '→ ' + shard.merged.length + ' 条',
            topLine(shard.merged)
          ],
          className: 'is-merge'
        });
      });
      rows.push({
        cells: [L.table.proxyMerge, '→ ' + sim.global.length + ' 条', topLine(sim.global)],
        className: 'is-merge is-final'
      });
      ladderHost.appendChild(UI.el('div', { class: 'tablebox' }, [
        UI.el('p', { class: 'tablebox__cap', text: L.table.ladderCaption.replace('{cand}', sim.cand) }),
        UI.table({
          head: L.table.head,
          rows: rows
        }),
        UI.note(L.table.ladderNote)
      ]));

      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, p, {}));
    }

    update();
    return { update: update };
  }

  M.Stages.route = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
