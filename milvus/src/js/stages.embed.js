/* ==========================================================================
   stages.embed.js — 站 2 · 向量化（距离真算，向量示意）
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[1];
  var L = S.ui;

  function mount(body, ctx) {
    var p = ctx.params;

    body.appendChild(UI.block(1, D.COPY.blocks.app, [
      UI.prose(S.app),
      C.sourceLinks(S.sources)
    ]));
    body.appendChild(UI.block(2, D.COPY.blocks.path, [
      UI.lanes(S.lane.active, { trace: S.lane.trace }),
      UI.note(S.lane.note)
    ]));

    var resultHost = UI.el('div');
    var rankHost = UI.el('div');
    body.appendChild(UI.block(3, D.COPY.blocks.result, [
      UI.el('p', { class: 'lead', text: S.result.lead }),
      resultHost,
      rankHost,
      UI.note(S.result.note)
    ]));

    var statsHost = UI.el('div');
    var figHost = UI.el('div');
    var ctlNorm = UI.control({
      type: 'toggle',
      label: L.controls.normalize,
      value: p.normalize,
      onChange: function (v) { ctx.set('normalize', v); },
      hint: L.controls.normalizeHint
    });
    var ctlDim = UI.control({
      type: 'select',
      id: 'dim',
      label: L.controls.dim,
      value: String(p.dim),
      options: L.controls.dimOptions,
      onChange: function (v) { ctx.set('dim', Number(v)); },
      hint: L.controls.dimHint
    });
    var snippetHost = UI.el('div');

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      UI.controlsGrid([ctlNorm, ctlDim]),
      statsHost,
      figHost,
      UI.callout(S.boundary, S.ui.conclusion, 'ink')
    ]));
    body.appendChild(snippetHost);

    var fig = UI.figure({
      title: L.figure.title,
      hint: L.figure.hint,
      aria: L.figure.aria,
      height: 320,
      legend: [],
      table: UI.el('div'),
      tableLabel: L.figure.table
    });
    figHost.appendChild(fig.root);

    var points = [];
    var chart = null;

    function drawScatter(model) {
      var proj = model.embedder.project(model.vectors);
      points = proj.points.map(function (pt, i) {
        var chunk = model.chunks[i];
        return {
          x: pt.x,
          y: pt.y,
          chunk: chunk
        };
      });
      var axes = proj.axes;
      var xs = points.map(function (p) { return p.x; });
      var ys = points.map(function (p) { return p.y; });
      var minX = Math.min.apply(null, xs);
      var maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys);
      var maxY = Math.max.apply(null, ys);
      var span = Math.max(maxX - minX, maxY - minY) || 1;
      var midX = (minX + maxX) / 2;
      var midY = (minY + maxY) / 2;
      fig.draw(function (c, w, h) {
        var pad = 28;
        var cx = w / 2;
        var cy = h / 2;
        var scale = Math.min(w - pad * 2, h - pad * 2) / 2;
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.fillRect(0, 0, w, h);
        c.strokeStyle = '#cfd8e0';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(pad, cy);
        c.lineTo(w - pad, cy);
        c.moveTo(cx, pad);
        c.lineTo(cx, h - pad);
        c.stroke();
        c.strokeStyle = 'rgba(169,183,196,0.35)';
        c.setLineDash([2, 4]);
        for (var g = -2; g <= 2; g++) {
          if (!g) continue;
          var gx = cx + (g * scale) / 2;
          var gy = cy + (g * scale) / 2;
          c.beginPath();
          c.moveTo(gx, pad);
          c.lineTo(gx, h - pad);
          c.moveTo(pad, gy);
          c.lineTo(w - pad, gy);
          c.stroke();
        }
        c.setLineDash([]);
        c.fillStyle = '#6f7c88';
        c.font = '11px ui-monospace, Consolas, monospace';
        c.textAlign = 'right';
        c.fillText(axes[0].label, w - pad, cy - 8);
        c.save();
        c.translate(cx + 10, pad + 4);
        c.rotate(Math.PI / 2);
        c.textAlign = 'left';
        c.fillText(axes[1].label, 0, 0);
        c.restore();
        points.forEach(function (pt) {
          var x = cx + ((pt.x - midX) / span) * scale * 1.72;
          var y = cy - ((pt.y - midY) / span) * scale * 1.72;
          pt.px = x;
          pt.py = y;
          c.beginPath();
          c.arc(x, y, 4.2, 0, Math.PI * 2);
          c.fillStyle = pt.chunk.color;
          c.globalAlpha = 0.82;
          c.fill();
          c.globalAlpha = 1;
          c.lineWidth = 1;
          c.strokeStyle = 'rgba(28,36,44,0.35)';
          c.stroke();
        });
        c.fillStyle = '#47535f';
        c.textAlign = 'left';
        c.font = '11px ui-sans-serif, system-ui, sans-serif';
        c.fillText(L.figure.axisNote, pad, h - 8);
      });
      renderChartTable(model, axes);
      renderLegend(model);
      fig.canvas.onmousemove = function (e) {
        var r = fig.canvas.getBoundingClientRect();
        var mx = e.clientX - r.left;
        var my = e.clientY - r.top;
        var best = null;
        var bestD = 12;
        points.forEach(function (pt) {
          var d = Math.hypot(pt.px - mx, pt.py - my);
          if (d < bestD) {
            bestD = d;
            best = pt;
          }
        });
        if (best) {
          fig.tip.hidden = false;
          fig.tip.innerHTML = '';
          fig.tip.appendChild(UI.el('b', { text: best.chunk.id }));
          fig.tip.appendChild(UI.el('span', { text: best.chunk.docTitle + ' · ' + best.chunk.headingPath }));
          fig.tip.appendChild(UI.el('span', { text: best.chunk.text.slice(0, 42) + '…' }));
          fig.tip.style.left = Math.min(mx + 14, r.width - 220) + 'px';
          fig.tip.style.top = Math.max(8, my - 10) + 'px';
        } else {
          fig.tip.hidden = true;
        }
      };
      fig.canvas.onmouseleave = function () { fig.tip.hidden = true; };
    }

    function renderLegend(model) {
      var legendHost = fig.root.querySelector('.figure__legend');
      if (!legendHost) return;
      UI.clear(legendHost);
      model.docs.forEach(function (d) {
        legendHost.appendChild(UI.el('span', { class: 'lg' }, [
          UI.el('i', { style: { background: d.color } }),
          UI.el('span', { text: d.title })
        ]));
      });
    }

    function renderChartTable(model, axes) {
      var holder = fig.root.querySelector('.figure__data > div');
      if (!holder) return;
      UI.clear(holder);
      holder.appendChild(UI.table({
        head: [L.table.chartHead[0], L.table.chartHead[1], axes[0].label, axes[1].label],
        rows: model.chunks.map(function (c, i) {
          var pt = points[i] || { x: 0, y: 0 };
          return {
            cells: [
              c.id,
              c.docTitle,
              pt.x.toFixed(3),
              pt.y.toFixed(3)
            ]
          };
        })
      }));
    }

    function update() {
      var model = M.Pipe.getModel(ctx.params);
      var embedder = model.embedder;
      var qv = M.Pipe.queryVectorOf(ctx.params);
      var dense = M.Pipe.denseSearch(ctx.params);
      var top = dense.items[0];
      var topVec = top ? model.vectors[model.byId[top.chunk.id]] : null;
      var cos = top ? embedder.cosine(qv, topVec) : 0;
      var ip = top ? embedder.dot(qv, topVec) : 0;
      var qNorm = embedder.norm(qv);

      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.dim, value: ctx.params.dim, unit: '维' },
        { label: L.stats.norm, value: qNorm.toFixed(3), unit: '' },
        { label: L.stats.cosine, value: cos.toFixed(4), unit: '' },
        { label: L.stats.ip, value: ip.toFixed(4), unit: '' }
      ]));

      UI.clear(resultHost);
      resultHost.appendChild(C.resultPre(C.json({
        question: M.Pipe.questionOf(ctx.params).text,
        dim: ctx.params.dim,
        normalize: ctx.params.normalize,
        query_norm: +qNorm.toFixed(4),
        top1: top
          ? {
              id: top.chunk.id,
              source: top.chunk.source,
              heading: top.chunk.headingPath,
              cosine: +cos.toFixed(4),
              inner_product: +ip.toFixed(4)
            }
          : null
      })));

      /* cosine vs IP 排序对照 */
      var rankedCos = model.chunks.map(function (chunk, i) {
        return { chunk: chunk, score: embedder.cosine(qv, model.vectors[i]) };
      }).sort(function (a, b) { return b.score - a.score; });
      var rankedIp = model.chunks.map(function (chunk, i) {
        return { chunk: chunk, score: embedder.dot(qv, model.vectors[i]) };
      }).sort(function (a, b) { return b.score - a.score; });
      var same = rankedCos.slice(0, 5).every(function (it, i) {
        return rankedIp[i] && it.chunk.id === rankedIp[i].chunk.id;
      });
      UI.clear(rankHost);
      rankHost.appendChild(UI.el('h4', { class: 'subhead', text: L.table.rankTitle }));
      rankHost.appendChild(UI.table({
        head: L.table.head,
        rows: rankedCos.slice(0, 5).map(function (it, i) {
          var other = rankedIp[i];
          return {
            cells: [
              String(i + 1),
              it.chunk.id + ' · ' + it.chunk.docTitle,
              it.score.toFixed(4),
              other ? other.score.toFixed(4) + (other.chunk.id === it.chunk.id ? ' ✓' : ' ✗ ' + other.chunk.id) : '—'
            ]
          };
        })
      }));
      rankHost.appendChild(UI.el('p', {
        class: 'note ' + (same ? 'note--ok' : 'note--warn'),
        text: same ? L.table.same : L.table.diff
      }));

      drawScatter(model);
      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, ctx.params, { count: model.chunks.length }));
    }

    update();
    return { update: update };
  }

  M.Stages.embed = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
