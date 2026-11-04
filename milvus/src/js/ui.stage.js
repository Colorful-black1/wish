/* ==========================================================================
   ui.stage.js — 十站共用的小组件：问题选择器、块引用、代码片段、出处
   ========================================================================== */
(function (root) {
  'use strict';

  var UI = root.MILVUS.UI;
  var D = root.MILVUS.data.milvus;
  var QS = root.MILVUS.data.questions.QUESTIONS;

  function json(value) {
    return JSON.stringify(value, null, 2);
  }

  function badges(S) {
    var wrap = UI.el('div', { class: 'stage__badges' });
    if (S.badges.real) wrap.appendChild(UI.el('span', { class: 'badge badge--real' }, [
      UI.el('b', { text: D.COPY.chrome.mkReal }),
      UI.el('span', { text: S.badges.real })
    ]));
    if (S.badges.model) wrap.appendChild(UI.el('span', { class: 'badge badge--model' }, [
      UI.el('b', { text: D.COPY.chrome.mkModel }),
      UI.el('span', { text: S.badges.model }),
      UI.mark(S.badges.tip || D.COPY.marks.modelTime)
    ]));
    return wrap;
  }

  function sourceLinks(sources) {
    return UI.el('div', { class: 'sources' }, [
      UI.el('span', { class: 'sources__k', text: 'DOC' })
    ].concat(
      (sources || []).map(function (s) {
        return UI.el('a', {
          href: s.url,
          target: '_blank',
          rel: 'noopener',
          class: 'sources__link',
          text: s.label + ' ↗'
        });
      })
    ));
  }

  function chunkRef(chunk, opts) {
    opts = opts || {};
    var label = [
      root.MILVUS.data.corpus.META.depts[chunk.dept] || chunk.dept,
      chunk.headingPath
    ].filter(Boolean).join(' · ');
    var node = UI.el(opts.button ? 'button' : 'span', {
      class: 'chunkref' + (opts.compact ? ' chunkref--compact' : ''),
      type: opts.button ? 'button' : null,
      title: label,
      dataset: { id: chunk.id }
    }, [
      UI.el('b', { text: chunk.id }),
      opts.showText
        ? UI.el('span', { class: 'chunkref__text', text: root.MILVUS.Text.truncate(chunk.text, opts.showText) })
        : UI.el('span', { class: 'chunkref__meta', text: label })
    ]);
    if (opts.button && opts.onClick) node.addEventListener('click', opts.onClick);
    return node;
  }

  function questionPicker(ctx, opts) {
    opts = opts || {};
    var wrap = UI.el('div', { class: 'qpick' });
    function update() {
      UI.clear(wrap);
      QS.forEach(function (q) {
        var on = ctx.params.question === q.id;
        var b = UI.el('button', {
          type: 'button',
          class: 'qpick__btn' + (on ? ' is-on' : ''),
          'aria-pressed': on ? 'true' : 'false'
        }, [
          UI.el('span', { class: 'qpick__no', text: String(q.no).padStart(2, '0') }),
          UI.el('span', { class: 'qpick__body' }, [
            UI.el('b', { text: q.label }),
            UI.el('span', { text: q.short })
          ])
        ]);
        b.addEventListener('click', function () {
          var patch = {
            question: q.id,
            customQuestion: '',
            dimMismatch: false
          };
          if (q.filter) patch.filter = Object.assign({ dept: 'all', updatedFrom: '', acl: 'all' }, q.filter);
          ctx.patch(patch);
        });
        wrap.appendChild(b);
        if (on) wrap.appendChild(UI.el('p', { class: 'qpick__why', text: q.why }));
      });
      if (ctx.params.question === 'custom') {
        wrap.appendChild(UI.el('p', {
          class: 'qpick__why',
          text: D.COPY.ui.customQuestion.replace('{q}', ctx.params.customQuestion)
        }));
      }
    }
    update();
    return { root: wrap, update: update };
  }

  function snippet(S, p, extra) {
    var code = D.snippet(S, p, extra);
    return UI.codeBlock(
      D.COPY.ui.snippetTitle.replace('{name}', S.name),
      code,
      { note: D.COPY.ui.snippetNote }
    );
  }

  function resultPre(value, opts) {
    opts = opts || {};
    return UI.el('div', { class: 'resultbox ' + (opts.className || '') }, [
      opts.title ? UI.el('p', { class: 'resultbox__cap', text: opts.title }) : null,
      UI.el('pre', { class: 'resultbox__pre', tabindex: '0' }, UI.el('code', { text: value }))
    ]);
  }

  function rankList(items, opts) {
    opts = opts || {};
    return UI.el('ol', { class: 'ranks' }, items.map(function (it, i) {
      var chunk = it.chunk || it;
      return UI.el('li', { class: 'rank' }, [
        UI.el('span', { class: 'rank__no', text: String(i + 1).padStart(2, '0') }),
        UI.el('span', { class: 'rank__id', text: chunk.id }),
        UI.el('span', { class: 'rank__text', text: root.MILVUS.Text.truncate(chunk.text, opts.text || 52) }),
        opts.score
          ? UI.el('span', { class: 'rank__score', text: opts.score(it) })
          : null
      ]);
    }));
  }

  function ownerChip(owner) {
    return UI.el('span', {
      class: 'owner owner--' + owner,
      text: owner === 'app' ? D.COPY.ui.ownerApp : D.COPY.ui.ownerMilvus
    });
  }

  function empty(text) {
    return UI.el('p', { class: 'empty', text: text });
  }

  root.MILVUS.Stages = root.MILVUS.Stages || {};
  root.MILVUS.Stages.common = {
    json: json,
    badges: badges,
    sourceLinks: sourceLinks,
    chunkRef: chunkRef,
    questionPicker: questionPicker,
    snippet: snippet,
    resultPre: resultPre,
    rankList: rankList,
    ownerChip: ownerChip,
    empty: empty
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
