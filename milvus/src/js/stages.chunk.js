/* ==========================================================================
   stages.chunk.js — 站 1 · 切分
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var C = M.Stages.common;
  var D = M.data.milvus;
  var S = D.STAGES[0];
  var L = S.ui;

  function mount(body, ctx) {
    var p = ctx.params;
    var selectedDoc = ctx.focusChunk ? ctx.focusChunk.docId : null;
    var selectedChunk = ctx.focusChunk ? ctx.focusChunk.id : null;
    var scrollPending = !!ctx.focusChunk;

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
    var figureHost = UI.el('div', { class: 'figuregrid' });
    var ctlSize = UI.control({
      type: 'range',
      id: 'chunkSize',
      label: L.controls.size,
      min: 80,
      max: 320,
      step: 10,
      value: p.chunkSize,
      format: function (v) { return v + ' 字'; },
      onInput: function (v) { ctx.set('chunkSize', v); }
    });
    var ctlOverlap = UI.control({
      type: 'range',
      id: 'chunkOverlap',
      label: L.controls.overlap,
      min: 0,
      max: 120,
      step: 10,
      value: p.chunkOverlap,
      format: function (v) { return v + ' 字'; },
      onInput: function (v) { ctx.set('chunkOverlap', v); }
    });
    var ctlHeading = UI.control({
      type: 'toggle',
      label: L.controls.byHeading,
      value: p.byHeading,
      onChange: function (v) { ctx.set('byHeading', v); },
      hint: L.controls.byHeadingHint
    });

    body.appendChild(UI.block(4, D.COPY.blocks.adjust, [
      UI.controlsGrid([ctlSize, ctlOverlap, ctlHeading]),
      statsHost,
      figureHost,
      UI.callout(
        S.boundary,
        S.ui.conclusion,
        'ink'
      )
    ]));

    var snippetHost = UI.el('div', { class: 'snippetHost' });
    body.appendChild(snippetHost);

    /* ---- 图形：原文 + 块 ---- */
    var docSelect = UI.el('select', { class: 'figselect' });
    var docPanel = UI.el('div', { class: 'docpanel' });
    var chunkLegend = UI.el('div', { class: 'chunklegend' });
    var chunkList = UI.el('div', { class: 'chunklist' });
    figureHost.appendChild(UI.el('section', { class: 'figcard figcard--doc' }, [
      UI.el('header', { class: 'figcard__head' }, [
        UI.el('div', null, [
          UI.el('b', { text: L.figure.doc }),
          UI.el('span', { class: 'figcard__hint', text: L.figure.docHint })
        ]),
        UI.el('label', { class: 'figselect__wrap' }, [
          UI.el('span', { class: 'sr-only', text: L.figure.pick }),
          docSelect
        ])
      ]),
      docPanel
    ]));
    figureHost.appendChild(UI.el('section', { class: 'figcard figcard--chunks' }, [
      UI.el('header', { class: 'figcard__head' }, [
        UI.el('b', { text: L.figure.chunks }),
        UI.el('span', { class: 'figcard__hint', text: L.figure.chunkHint })
      ]),
      chunkLegend,
      chunkList
    ]));

    docSelect.addEventListener('change', function () {
      selectedDoc = docSelect.value;
      selectedChunk = null;
      scrollPending = true;
      renderFigure();
    });

    function syncSelect(docs) {
      var current = selectedDoc;
      UI.clear(docSelect);
      docs.forEach(function (d) {
        var op = UI.el('option', { value: d.id, text: d.title + ' · ' + d.version });
        if (d.id === current) op.selected = true;
        docSelect.appendChild(op);
      });
      if (!selectedDoc) {
        selectedDoc = docs[0].id;
        docSelect.value = selectedDoc;
      }
    }

    function renderFigure() {
      var model = M.Pipe.getModel(ctx.params);
      if (!selectedDoc) selectedDoc = model.docs[0].id;
      if (!selectedChunk) {
        var firstOfDoc = model.chunks.filter(function (c) { return c.docId === selectedDoc; })[0];
        if (firstOfDoc) selectedChunk = firstOfDoc.id;
      }
      if (selectedChunk) {
        var sc = model.chunks.filter(function (c) { return c.id === selectedChunk; })[0];
        if (!sc) selectedChunk = null;
        else selectedDoc = sc.docId;
      }
      syncSelect(model.docs);
      docSelect.value = selectedDoc;
      UI.clear(chunkLegend);
      model.docs.forEach(function (d) {
        chunkLegend.appendChild(UI.el('span', { class: 'lg' }, [
          UI.el('i', { style: { background: d.color } }),
          UI.el('span', { text: d.title })
        ]));
      });
      var doc = model.docs.filter(function (d) { return d.id === selectedDoc; })[0];
      var active = selectedChunk
        ? model.chunks.filter(function (c) { return c.id === selectedChunk; })[0]
        : null;
      UI.clear(docPanel);
      docPanel.appendChild(UI.el('div', { class: 'docpanel__head' }, [
        UI.el('h3', { text: doc.title }),
        UI.el('p', {
          class: 'docpanel__meta',
          text: [doc.file, doc.version, doc.updatedIso, 'acl=' + doc.acl].join(' · ')
        })
      ]));
      doc.sections.forEach(function (sec) {
        var pre = null;
        var hit = null;
        var post = null;
        if (active && active.docId === doc.id) {
          var a = Math.max(sec.textStart, active.start);
          var b = Math.min(sec.textEnd, active.end);
          if (b > a) {
            pre = sec.text.slice(0, a - sec.textStart);
            hit = sec.text.slice(a - sec.textStart, b - sec.textStart);
            post = sec.text.slice(b - sec.textStart);
          }
        }
        var pEl = UI.el('p', { class: 'docpanel__text' });
        if (hit) {
          if (pre) pEl.appendChild(document.createTextNode(pre));
          pEl.appendChild(UI.el('mark', { class: 'dochit', text: hit }));
          if (post) pEl.appendChild(document.createTextNode(post));
        } else {
          pEl.textContent = sec.text;
        }
        docPanel.appendChild(UI.el('div', { class: 'docsec' }, [
          UI.el('h4', { class: 'docsec__head', text: sec.heading }),
          pEl
        ]));
      });
      if (active && scrollPending) {
        var hitEl = docPanel.querySelector('.dochit');
        if (hitEl) hitEl.scrollIntoView({ block: 'nearest' });
      }
      scrollPending = false;

      UI.clear(chunkList);
      model.chunks.forEach(function (c) {
        var on = c.id === selectedChunk;
        var btn = UI.el('button', {
          type: 'button',
          class: 'chunk' + (on ? ' is-on' : ''),
          style: { '--chunk-color': c.color },
          'aria-pressed': on ? 'true' : 'false'
        }, [
          UI.el('span', { class: 'chunk__top' }, [
            UI.el('b', { class: 'chunk__id', text: c.id }),
            UI.el('span', { class: 'chunk__chars', text: c.chars + ' ' + L.figure.chars }),
            UI.el('span', { class: 'chunk__acl', text: 'acl=' + c.acl })
          ]),
          UI.el('span', { class: 'chunk__text', text: c.text }),
          UI.el('span', {
            class: 'chunk__meta',
            text: [c.source, M.data.corpus.META.depts[c.dept], c.version, c.updatedIso].join(' · ')
          }),
          UI.el('span', { class: 'chunk__path', text: c.headingPath })
        ]);
        btn.addEventListener('click', function () {
          selectedChunk = c.id;
          selectedDoc = c.docId;
          scrollPending = true;
          renderFigure();
        });
        chunkList.appendChild(btn);
      });
    }

    function update() {
      var model = M.Pipe.getModel(ctx.params);
      var st = model.stats;
      UI.clear(statsHost);
      statsHost.appendChild(UI.statsGrid([
        { label: L.stats.count, value: st.count, unit: '块' },
        { label: L.stats.median, value: Math.round(st.median), unit: '字' },
        {
          label: L.stats.overlap,
          value: st.measuredOverlap,
          unit: '字',
          note: L.stats.overlapNote
            .replace('{config}', st.configOverlap)
            .replace('{pairs}', st.overlapPairs)
        },
        {
          label: L.stats.coverage,
          value: UI.pct(st.coveragePct),
          unit: '',
          note: L.stats.coverageNote.replace('{n}', st.coverage.length)
        }
      ]));

      var first = model.chunks[0];
      UI.clear(resultHost);
      resultHost.appendChild(C.resultPre(C.json({
        id: first.id,
        text: first.text.slice(0, 64) + (first.text.length > 64 ? '…' : ''),
        chars: first.chars,
        headingPath: first.headingPath,
        source: first.source,
        dept: first.dept,
        version: first.version,
        updated: first.updated,
        acl: first.acl
      })));

      renderFigure();
      UI.clear(snippetHost);
      snippetHost.appendChild(C.snippet(S, ctx.params, {
        count: model.chunks.length,
        source: first.source
      }));
    }

    update();
    return { update: update };
  }

  M.Stages.chunk = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
