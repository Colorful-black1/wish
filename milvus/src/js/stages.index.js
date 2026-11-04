/* ==========================================================================
   stages.index.js — 站 4 · 建索引（真实构建 + 访问点数 + recall + 内存估算）
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[3];
  var L = S.ui;
  var PALETTE = ['#1f6fb2', '#0e7f86', '#8a6d3b', '#a85b3f', '#5b6b7a', '#6a7f3f', '#3f5f8f', '#7a4f6f'];

  function mount(body, ctx) {
    body.appendChild(UI.block(1, D.COPY.blocks.app, [
      UI.prose(S.app),
      C.sourceLinks(S.sources)
    ]));
    body.appendChild(UI.block(2, D.COPY.blocks.path, [
      UI.lanes(S.lane.active, { trace: S.lane.trace }),
      UI.note(S.lane.note)
    ]));

    var resultHost = UI.el('div');
    body.appendChild(UI.block(3, D.COPY.blocks.result, [
      UI.el('p', { class: 'lead', text: S.result.lead }),
      resultHost,
      UI.note(S.result.note)
    ]));

    var statsHost = UI.el('div');
    var figHost = UI.el('div');
    var tableHost = UI.el('div');
    var ctlType = UI.control({
      type: 'select',
      id: 'indexType',
      label: L.controls.type,
      value: ctx.params.indexType,
      options: [
        { value: 'HNSW', label: 'HNSW' },
        { value: 'IVF_FLAT', label: 'IVF_FLAT' },
        { value: 'FLAT', label: 'FLAT（暴力）' },
        { value: 'DISKANN', label: 'DISKANN（页面简化）' }
      ],
      onChange: function (v) { ctx.set('indexType', v); }
    });
    var ctlM = UI.control({
      type: 'range',
      id: 'M',
      label: L.controls.M,
      min: 2,
      max: 32,
      step: 2,
      value: ctx.params.M,
      format: function (v) { return 'M = ' + v; },
      onInput: function (v) { ctx.set('M', v); }
    });
    var ctlEfC = UI.control({
      type: 'range',
      id: 'efConstruction',
      label: L.controls.efC,
      min: 10,
      max: 400,
      step: 10,
      value: ctx.params.efConstruction,
      format: function (v) { return String(v); },
      onInput: function (v) { ctx.set('efConstruction', v); }
    });
    var ctlNlist = UI.control({
      type: 'range',
      id: 'nlist',
      label: L.controls.nlist,
      min: 1,
      max: 24,
      step: 1,
      value: ctx.params.nlist,
      format: function (v) { return String(v); },
      onInput: function (v) { ctx.set('nlist', v); }
    });
    var ctlMetric = UI.control({
      type: 'segmented',
      label: L.controls.metric,
      value: ctx.params.metric,
      wide: true,
      options: [
        { value: 'COSINE', label: 'COSINE' },
        { value: 'IP', label: 'IP' },
        { value: 'L2', label: 'L2' }
      ],
      onChange: function (v) { ctx.set('metric', v); },
      hint: L.controls.metricHint
    });
    var paramNote = UI.note(L.paramNote, {
      tip: L.paramTip
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      UI.controlsGrid([ctlType, ctlM, ctlEfC, ctlNlist, ctlMetric]),
      paramNote,
      statsHost,
      figHost,
      tableHost,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    var fig = UI.figure({
      title: L.figure.title,
      hint: L.figure.hint,
      aria: L.figureAria,
      height: 380,
      legend: [],
      table: UI.el('div'),
      tableLabel: L.figure.table
    });
    figHost.appendChild(fig.root);

    var points = [];

    function drawIndex(p, index, model) {
      var proj = model.embedder.project(model.vectors);
      points = proj.points.map(function (pt, i) {
        return { x: pt.x, y: pt.y, chunk: model.chunks[i], node: i };
      });
      var clusters = index.clusters;
      var graph = index.graph;
      var type = p.indexType;
      var xs = points.map(function (pt) { return pt.x; });
      var ys = points.map(function (pt) { return pt.y; });
      var minX = Math.min.apply(null, xs);
      var maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys);
      var maxY = Math.max.apply(null, ys);
      var span = Math.max(maxX - minX, maxY - minY) || 1;
      var midX = (minX + maxX) / 2;
      var midY = (minY + maxY) / 2;
      fig.draw(function (c, w, h) {
        var pad = 26;
        var cx = w / 2;
        var cy = h / 2;
        var scale = Math.min(w - pad * 2, h - pad * 2) / 2;
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(0, 0, w, h);

        function map(pt) {
          return {
            x: cx + ((pt.x - midX) / span) * scale * 1.68,
            y: cy - ((pt.y - midY) / span) * scale * 1.68
          };
        }

        if (graph && (type === 'HNSW' || type === 'DISKANN')) {
          c.lineWidth = 0.6;
          c.strokeStyle = type === 'DISKANN' ? 'rgba(31,111,178,0.16)' : 'rgba(14,127,134,0.24)';
          if (type === 'DISKANN') c.setLineDash([3, 3]);
          graph.neighbors.forEach(function (levels, i) {
            var a = map(points[i]);
            (levels[0] || []).forEach(function (j) {
              if (j <= i) return;
              var b = map(points[j]);
              c.beginPath();
              c.moveTo(a.x, a.y);
              c.lineTo(b.x, b.y);
              c.stroke();
            });
          });
          c.setLineDash([]);
        }

        if (clusters) {
          c.strokeStyle = 'rgba(168,91,63,0.14)';
          c.lineWidth = 1;
        }

        var assn = clusters ? clusters.assignment : null;
        points.forEach(function (pt, i) {
          var m = map(pt);
          pt.px = m.x;
          pt.py = m.y;
          var color = clusters ? PALETTE[assn[i] % PALETTE.length] : pt.chunk.color;
          c.beginPath();
          c.arc(m.x, m.y, 4.4, 0, Math.PI * 2);
          c.fillStyle = color;
          c.globalAlpha = 0.85;
          c.fill();
          c.globalAlpha = 1;
          c.strokeStyle = 'rgba(28,36,44,0.4)';
          c.lineWidth = 1;
          c.stroke();
        });

        if (clusters) {
          clusters.centroids.forEach(function (cen, ci) {
            var px = 0;
            var py = 0;
            var list = clusters.lists[ci];
            if (list.length) {
              list.forEach(function (i) { px += points[i].px; py += points[i].py; });
              px /= list.length;
              py /= list.length;
            } else {
              px = cx;
              py = cy;
            }
            c.beginPath();
            c.moveTo(px, py - 9);
            c.lineTo(px + 9, py);
            c.lineTo(px, py + 9);
            c.lineTo(px - 9, py);
            c.closePath();
            c.fillStyle = '#f2f4f6';
            c.strokeStyle = '#1c242c';
            c.lineWidth = 1.2;
            c.fill();
            c.stroke();
            c.fillStyle = '#1c242c';
            c.font = '10px ui-monospace, Consolas, monospace';
            c.textAlign = 'center';
            c.fillText(String(ci), px, py + 3);
          });
        }

        c.fillStyle = '#6f7c88';
        c.font = '11px ui-monospace, Consolas, monospace';
        c.textAlign = 'left';
        c.fillText(
          type + ' · ' + points.length + ' 点 · ' + (graph ? graph.maxLevel + 1 : 0) + ' 层',
          pad,
          h - 10
        );
      });

      fig.canvas.onmousemove = function (e) {
        var r = fig.canvas.getBoundingClientRect();
        var mx = e.clientX - r.left;
        var my = e.clientY - r.top;
        var best = null;
        var bestD = 11;
        points.forEach(function (pt) {
          var d = Math.hypot(pt.px - mx, pt.py - my);
          if (d < bestD) { bestD = d; best = pt; }
        });
        if (best) {
          var idx = best.node;
          var nbs = index.neighborsOf(idx);
          fig.tip.hidden = false;
          fig.tip.innerHTML = '';
          fig.tip.appendChild(UI.el('b', { text: best.chunk.id }));
          fig.tip.appendChild(UI.el('span', { text: best.chunk.headingPath }));
          fig.tip.appendChild(UI.el('span', {
            text: clusters
              ? L.figure.cluster + ' ' + clusters.assignment[idx] + ' · 桶内 ' + clusters.lists[clusters.assignment[idx]].length + ' 点'
              : L.figure.neighbors + ' ' + nbs.length + '：' + nbs.slice(0, 6).map(function (n) {
                  return model.chunks[n].id;
                }).join(' ')
          }));
          fig.tip.style.left = Math.min(mx + 14, r.width - 240) + 'px';
          fig.tip.style.top = Math.max(8, my - 10) + 'px';
        } else {
          fig.tip.hidden = true;
        }
      };
      fig.canvas.onmouseleave = function () { fig.tip.hidden = true; };
    }

    function renderLegend(p, index) {
      var host = fig.root.querySelector('.figure__legend');
      if (!host) return;
      UI.clear(host);
      if (index.clusters) {
        host.appendChild(UI.el('span', { class: 'lg' }, [
          UI.el('i', { class: 'lg__diamond' }),
          UI.el('span', { text: L.legendCluster })
        ]));
      } else {
        host.appendChild(UI.el('span', { class: 'lg' }, [
          UI.el('i', { class: 'lg__line' }),
          UI.el('span', { text: L.legendEdges })
        ]));
      }
    }

    function renderTable(p, index, model) {
      var holder = fig.root.querySelector('.figure__data > div');
      UI.clear(holder);
      var rows = model.chunks.map(function (chunk, i) {
        var nbs = index.neighborsOf(i);
        return {
          cells: [
            chunk.id,
            chunk.docTitle,
            index.clusters ? String(index.clusters.assignment[i]) : '—',
            index.graph ? String(nbs.length) : '—',
            nbs.slice(0, 7).map(function (n) { return model.chunks[n].id; }).join(' ') || '—'
          ]
        };
      });
      holder.appendChild(UI.table({
        head: L.tableHead,
        rows: rows
      }));
    }

    function update() {
      var p = ctx.params;
      if (ctlMetric._set) ctlMetric._set(p.metric);
      ctlM.hidden = !(p.indexType === 'HNSW' || p.indexType === 'DISKANN');
      ctlEfC.hidden = !(p.indexType === 'HNSW' || p.indexType === 'DISKANN');
      ctlNlist.hidden = p.indexType !== 'IVF_FLAT';

      var model = M.Pipe.getModel(p);
      var index = M.Pipe.getIndex(p);
      var qv = M.Pipe.queryVectorOf(p);
      var search = index.search(qv, { limit: p.limit, ef: p.ef, nprobe: p.nprobe });
      var recall = index.recallAt(qv, p.limit, { ef: p.ef, nprobe: p.nprobe });
      var mem = index.memory();
      var gs = M.Pipe.graphStats(p);

      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        {
          label: L.stats.visited,
          value: search.visited,
          unit: '次',
          tip: D.COPY.marks.realCalc,
          note: L.stats.visitedNote
        },
        {
          label: L.stats.recall,
          value: UI.pct(recall),
          unit: '',
          note: L.stats.recallNote.replace('{k}', p.limit)
        },
        { label: L.stats.edges, value: gs.edges, unit: '条' },
        {
          label: L.stats.memory,
          value: M.UI.bytes(mem.bytes),
          unit: '',
          note: mem.formula
        },
        {
          label: L.stats.build,
          value: gs.buildMsModel,
          unit: 'ms',
          tip: D.COPY.marks.modelTime
        },
        p.indexType === 'IVF_FLAT'
          ? { label: L.stats.clusters, value: index.nlist, unit: '桶' }
          : { label: L.stats.clusters, value: '—', unit: '' }
      ]));

      UI.clear(resultHost);
      resultHost.appendChild(C.resultPre(C.json({
        index_type: p.indexType,
        metric_type: p.metric,
        params:
          p.indexType === 'HNSW' || p.indexType === 'DISKANN'
            ? { M: p.M, efConstruction: p.efConstruction }
            : p.indexType === 'IVF_FLAT'
              ? { nlist: p.nlist }
              : {},
        access_points: search.visited,
        recall_at_k: +recall.toFixed(3),
        memory_estimate_bytes: mem.bytes,
        memory_formula: mem.formula
      })));

      drawIndex(p, index, model);
      renderLegend(p, index);
      renderTable(p, index, model);

      UI.clear(tableHost);
      tableHost.appendChild(UI.el('div', { class: 'tablebox' }, [
        UI.el('p', { class: 'tablebox__cap', text: L.table.title }),
        UI.table({
          head: D.INDEX_TABLE.head,
          rows: D.INDEX_TABLE.rows.map(function (r) { return { cells: r }; })
        }),
        UI.note(D.INDEX_TABLE.note),
        UI.note(L.scaleNote.replace('{n}', model.chunks.length)),
        p.indexType === 'DISKANN' ? UI.note(L.diskannNote, { tip: D.COPY.marks.modelTime }) : null
      ]));

      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, p, { visited: search.visited, k: p.limit, recall: recall }));
    }

    update();
    return { update: update };
  }

  M.Stages.index = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
