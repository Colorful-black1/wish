/* ==========================================================================
   app.js — 启动、十站导航、URL hash、键盘、自动演示、页脚口径
   ========================================================================== */
(function (root) {
  'use strict';

  var M = root.MILVUS;
  var UI = M.UI;
  var D = M.data.milvus;
  var COPY = D.COPY;
  var STAGES = D.STAGES;

  var DEFAULTS = {
    chunkSize: 120,
    chunkOverlap: 40,
    byHeading: true,
    normalize: true,
    dim: 1024,
    bm25: true,
    dynamic: false,
    pk: 'int64',
    indexType: 'HNSW',
    M: 8,
    efConstruction: 200,
    nlist: 8,
    metric: 'COSINE',
    consistency: 'Bounded',
    batch: 500,
    t: 1,
    question: 'q1',
    customQuestion: '',
    limit: 5,
    ef: 64,
    nprobe: 3,
    growing: 20,
    nodes: 3,
    shards: 2,
    cand: 5,
    filterMode: 'pre',
    filterLimit: 1,
    filter: { dept: 'all', updatedFrom: '', acl: 'all' },
    ranker: 'weighted',
    wDense: 0.8,
    wSparse: 1,
    k1: 1.2,
    b: 0.75,
    rerank: true,
    topN: 5,
    budget: 700,
    threshold: M.data.questions.DEFAULT_THRESHOLD,
    dimMismatch: false
  };

  var MAP = [
    ['q', 'question', 'string'],
    ['ask', 'customQuestion', 'string'],
    ['size', 'chunkSize', 'number'],
    ['ov', 'chunkOverlap', 'number'],
    ['head', 'byHeading', 'bool'],
    ['norm', 'normalize', 'bool'],
    ['dim', 'dim', 'number'],
    ['bm', 'bm25', 'bool'],
    ['dyn', 'dynamic', 'bool'],
    ['pk', 'pk', 'string'],
    ['it', 'indexType', 'string'],
    ['M', 'M', 'number'],
    ['efc', 'efConstruction', 'number'],
    ['nl', 'nlist', 'number'],
    ['metric', 'metric', 'string'],
    ['cl', 'consistency', 'string'],
    ['batch', 'batch', 'number'],
    ['t', 't', 'number'],
    ['limit', 'limit', 'number'],
    ['ef', 'ef', 'number'],
    ['np', 'nprobe', 'number'],
    ['grow', 'growing', 'number'],
    ['nodes', 'nodes', 'number'],
    ['shards', 'shards', 'number'],
    ['cand', 'cand', 'number'],
    ['fm', 'filterMode', 'string'],
    ['fl', 'filterLimit', 'number'],
    ['dept', 'filter.dept', 'string'],
    ['from', 'filter.updatedFrom', 'string'],
    ['acl', 'filter.acl', 'string'],
    ['rk', 'ranker', 'string'],
    ['wd', 'wDense', 'number'],
    ['ws', 'wSparse', 'number'],
    ['k1', 'k1', 'number'],
    ['b', 'b', 'number'],
    ['rerank', 'rerank', 'bool'],
    ['topn', 'topN', 'number'],
    ['budget', 'budget', 'number'],
    ['th', 'threshold', 'number'],
    ['mm', 'dimMismatch', 'bool']
  ];

  var state = {
    stage: 1,
    visited: {},
    focusChunk: null,
    params: JSON.parse(JSON.stringify(DEFAULTS))
  };

  var current = null;
  var autoTimer = null;
  var writingHash = false;

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) {
      return o == null ? undefined : o[k];
    }, obj);
  }

  function setPath(obj, path, value) {
    var parts = path.split('.');
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = value;
  }

  function coerce(type, raw) {
    if (type === 'number') {
      var n = Number(raw);
      return isNaN(n) ? null : n;
    }
    if (type === 'bool') return raw === '1' || raw === 'true';
    return raw;
  }

  function serialize() {
    var slug = STAGES[state.stage - 1].slug;
    var parts = [];
    MAP.forEach(function (entry) {
      var value = getPath(state.params, entry[1]);
      if (entry[1] === 'customQuestion' && state.params.question !== 'custom') return;
      if (typeof value === 'boolean') value = value ? 1 : 0;
      if (value === '' || value == null) {
        if (entry[1] !== 'filter.updatedFrom') return;
      }
      parts.push(entry[0] + '=' + encodeURIComponent(String(value)));
    });
    return '#' + slug + (parts.length ? '?' + parts.join('&') : '');
  }

  var hashRaf = 0;
  function commit() {
    cancelAnimationFrame(hashRaf);
    hashRaf = requestAnimationFrame(function () {
      try {
        writingHash = true;
        history.replaceState(null, '', serialize());
      } catch (e) {
        /* file:// 下极少数环境不允许 replaceState，静默降级 */
      }
      writingHash = false;
      updateHeroStats();
    });
  }

  function parseHash() {
    var raw = location.hash.replace(/^#/, '');
    if (!raw) return false;
    var qi = raw.indexOf('?');
    var slug = qi === -1 ? raw : raw.slice(0, qi);
    var query = qi === -1 ? '' : raw.slice(qi + 1);
    var stage = STAGES.filter(function (s) { return s.slug === slug; })[0];
    if (!stage) return false;
    state.stage = stage.n;
    var params = new URLSearchParams(query);
    MAP.forEach(function (entry) {
      if (!params.has(entry[0])) return;
      var val = coerce(entry[2], params.get(entry[0]));
      if (val != null) setPath(state.params, entry[1], val);
    });
    if (state.params.question !== 'custom') state.params.customQuestion = '';
    return true;
  }

  function set(key, value) {
    state.params[key] = value;
    commit();
    if (current && current.update) current.update();
    updateChrome();
  }

  function patch(obj) {
    Object.keys(obj).forEach(function (k) {
      state.params[k] = obj[k];
    });
    commit();
    if (current && current.update) current.update();
    updateChrome();
  }

  function stageBySlug(slug) {
    return STAGES.filter(function (s) { return s.slug === slug; })[0];
  }

  function go(n, opts) {
    opts = opts || {};
    n = Math.max(1, Math.min(STAGES.length, n));
    state.stage = n;
    state.visited[n] = true;
    if (opts.focusChunkId) {
      var model = M.Pipe.getModel(state.params);
      state.focusChunk = model.chunks.filter(function (c) {
        return c.id === opts.focusChunkId;
      })[0] || null;
    } else if (!opts.keepFocus) {
      state.focusChunk = null;
    }
    renderStage();
    updateChrome();
    updateStageFoot();
    commit();
    if (opts.scroll && !opts.silent) {
      var ws = document.getElementById('workspace');
      if (ws) ws.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function stageHead(S) {
    var phase = S.phase === 'A' ? COPY.phase.write : COPY.phase.read;
    var ownerText = S.owner === 'app' ? COPY.ui.ownerAppShort : COPY.ui.ownerMilvusShort;
    var head = document.getElementById('stageHead');
    UI.clear(head);
    head.appendChild(UI.el('div', { class: 'stage__no' }, [
      UI.el('b', { text: String(S.n).padStart(2, '0') }),
      UI.el('span', { text: '/10' })
    ]));
    head.appendChild(UI.el('div', { class: 'stage__titles' }, [
      UI.el('span', { class: 'stage__eyebrow', text: 'STATION ' + String(S.n).padStart(2, '0') + ' · ' + phase + ' · ' + ownerText }),
      UI.el('h2', { id: 'stageTitle', tabindex: '-1', class: 'stage__title' }, [
        UI.el('span', { text: S.name }),
        UI.el('span', { class: 'stage__en', text: S.en })
      ]),
      UI.el('p', { class: 'stage__one', text: S.oneLiner })
    ]));
    head.appendChild(UI.el('div', { class: 'stage__side' }, [
      M.Stages.common.ownerChip(S.owner),
      M.Stages.common.badges(S)
    ]));
  }

  function renderStage() {
    var S = STAGES[state.stage - 1];
    stageHead(S);
    var body = document.getElementById('stageBody');
    UI.clear(body);
    var ctx = {
      params: state.params,
      focusChunk: state.focusChunk,
      set: set,
      patch: patch,
      commit: commit,
      go: go,
      toast: UI.toast
    };
    try {
      current = M.Stages[S.slug].mount(body, ctx);
    } catch (e) {
      current = null;
      body.appendChild(UI.el('div', { class: 'errorbox', role: 'alert' }, [
        UI.el('b', { class: 'errorbox__title', text: COPY.ui.renderError }),
        UI.el('code', { class: 'errorbox__code', text: String(e && e.message || e) })
      ]));
    }
    var stage = document.getElementById('stage');
    if (stage) {
      stage.setAttribute('aria-label', COPY.ui.stationAria.replace('{n}', S.n).replace('{name}', S.name));
    }
  }

  function updateChrome() {
    var items = document.querySelectorAll('[data-stage-btn]');
    items.forEach(function (btn) {
      var n = Number(btn.dataset.stageBtn);
      btn.classList.toggle('is-current', n === state.stage);
      btn.classList.toggle('is-visited', !!state.visited[n] && n !== state.stage);
      if (n === state.stage) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    var autoBtn = document.getElementById('btnAuto');
    if (autoBtn) {
      autoBtn.setAttribute('aria-pressed', autoTimer ? 'true' : 'false');
      autoBtn.classList.toggle('is-on', !!autoTimer);
      autoBtn.querySelector('span').textContent = autoTimer ? COPY.chrome.autoOn : COPY.chrome.auto;
    }
    var rail = document.getElementById('rail');
    var cur = rail && rail.querySelector('.rail__item.is-current');
    if (rail && cur && rail.scrollWidth > rail.clientWidth + 2) {
      var rr = rail.getBoundingClientRect();
      var cr = cur.getBoundingClientRect();
      rail.scrollLeft += cr.left - rr.left - (rr.width - cr.width) / 2;
    }
  }

  function buildTrack() {
    var track = document.getElementById('track');
    UI.clear(track);
    var groups = [
      { phase: 'A', label: COPY.phase.write, sub: COPY.phase.writeSub },
      { phase: 'B', label: COPY.phase.read, sub: COPY.phase.readSub }
    ];
    groups.forEach(function (g) {
      var group = UI.el('div', { class: 'track__group track__group--' + g.phase }, [
        UI.el('div', { class: 'track__label' }, [
          UI.el('b', { text: g.label }),
          UI.el('span', { text: g.sub })
        ])
      ]);
      var row = UI.el('div', { class: 'track__row' });
      STAGES.filter(function (s) { return s.phase === g.phase; }).forEach(function (s) {
        var btn = UI.el('button', {
          type: 'button',
          class: 'track__item',
          dataset: { stageBtn: s.n },
          'aria-label': COPY.ui.stationAria.replace('{n}', s.n).replace('{name}', s.name)
        }, [
          UI.el('span', { class: 'track__no', text: String(s.n).padStart(2, '0') }),
          UI.el('span', { class: 'track__name', text: s.name.replace(/\s.*$/, '') }),
          UI.el('span', { class: 'track__dot' })
        ]);
        btn.addEventListener('click', function () { stopAuto(); go(s.n); });
        row.appendChild(btn);
      });
      group.appendChild(row);
      track.appendChild(group);
    });
  }

  function buildRail() {
    var rail = document.getElementById('rail');
    UI.clear(rail);
    [['A', COPY.phase.write], ['B', COPY.phase.read]].forEach(function (pair) {
      var group = STAGES.filter(function (s) { return s.phase === pair[0]; });
      rail.appendChild(UI.el('div', { class: 'rail__group' }, [
        UI.el('div', { class: 'rail__cap' }, [
          UI.el('span', { text: pair[1] }),
          UI.el('b', { text: String(group.length) })
        ]),
        UI.el('ol', { class: 'rail__list' }, group.map(function (s) {
          var btn = UI.el('button', {
            type: 'button',
            class: 'rail__item rail__item--' + s.owner,
            dataset: { stageBtn: s.n },
            'aria-label': COPY.ui.stationAria.replace('{n}', s.n).replace('{name}', s.name)
          }, [
            UI.el('span', { class: 'rail__no', text: String(s.n).padStart(2, '0') }),
            UI.el('span', { class: 'rail__body' }, [
              UI.el('b', { text: s.name }),
              UI.el('span', { text: s.oneLiner })
            ]),
            UI.el('i', { class: 'rail__owner', 'aria-hidden': 'true' })
          ]);
          btn.addEventListener('click', function () { stopAuto(); go(s.n); });
          return UI.el('li', null, btn);
        }))
      ]));
    });
  }

  function updateHeroStats() {
    var host = document.getElementById('heroStats');
    if (!host) return;
    var s = M.Pipe.stats(state.params);
    UI.clear(host);
    COPY.hero.stats.forEach(function (item) {
      var value =
        item.key === 'docs' ? s.docs :
        item.key === 'chunks' ? s.chunks :
        item.key === 'dim' ? s.dim : s.stations;
      host.appendChild(UI.el('div', { class: 'hstat' }, [
        UI.el('span', { class: 'hstat__label', text: item.label }),
        UI.el('span', { class: 'hstat__value' }, [
          UI.el('b', { text: String(value) }),
          UI.el('span', { text: item.unit })
        ])
      ]));
    });
  }

  function buildHero() {
    document.getElementById('heroEyebrow').textContent = COPY.hero.eyebrow;
    UI.clear(document.getElementById('heroTitle'));
    document.getElementById('heroTitle').appendChild(UI.el('span', { text: COPY.hero.titleA }));
    document.getElementById('heroTitle').appendChild(UI.el('em', { text: COPY.hero.titleB }));
    document.getElementById('heroSub').textContent = COPY.hero.sub;
    document.getElementById('btnStart').textContent = COPY.hero.primary;
    document.getElementById('btnConclusion').textContent = COPY.hero.secondary;
    document.getElementById('heroHint').textContent = COPY.hero.hint;
    document.getElementById('heroStatus').textContent = COPY.chrome.status;
    document.getElementById('brandCn').textContent = COPY.chrome.brandCn;
    document.getElementById('brandEn').textContent = COPY.chrome.brandEn;
    document.getElementById('btnAbout').textContent = COPY.chrome.about;
    document.getElementById('btnAutoLabel').textContent = COPY.chrome.auto;
    document.title = COPY.meta.title;

    var conclusion = document.getElementById('conclusion');
    UI.clear(conclusion);
    conclusion.appendChild(UI.el('div', { class: 'conclusion__head' }, [
      UI.el('span', { class: 'eyebrow', text: COPY.conclusion.eyebrow }),
      UI.el('h2', { text: COPY.conclusion.title })
    ]));
    conclusion.appendChild(UI.el('div', { class: 'conclusion__grid' }, COPY.conclusion.items.map(function (item) {
      return UI.el('article', { class: 'ccard' }, [
        UI.el('span', { class: 'ccard__no', text: item.no }),
        UI.el('h3', { text: item.title }),
        UI.el('p', { text: item.body })
      ]);
    })));
  }

  function buildAppendix() {
    var host = document.getElementById('appendix');
    UI.clear(host);
    host.appendChild(UI.el('div', { class: 'appendix__head' }, [
      UI.el('span', { class: 'eyebrow', text: COPY.ui.appendixEyebrow }),
      UI.el('h2', { text: COPY.footer.title })
    ]));
    host.appendChild(UI.el('div', { class: 'appendix__grid' }, [
      UI.el('section', { class: 'acard acard--real' }, [
        UI.el('h3', { text: COPY.footer.realTitle }),
        UI.el('ul', { class: 'ticks' }, COPY.footer.real.map(function (t) {
          return UI.el('li', { text: t });
        }))
      ]),
      UI.el('section', { class: 'acard acard--model' }, [
        UI.el('h3', { text: COPY.footer.modelTitle }),
        UI.el('ul', { class: 'ticks ticks--warn' }, COPY.footer.model.map(function (t) {
          return UI.el('li', { text: t });
        }))
      ])
    ]));
    host.appendChild(UI.el('section', { class: 'acard acard--wide' }, [
      UI.el('h3', { text: COPY.footer.sourcesTitle }),
      UI.el('div', { class: 'sources sources--grid' }, Object.keys(D.LINKS).map(function (k) {
        var l = D.LINKS[k];
        return UI.el('a', {
          href: l.url,
          target: '_blank',
          rel: 'noopener',
          class: 'sources__link',
          text: l.label + ' ↗'
        });
      }))
    ]));
    host.appendChild(UI.el('section', { class: 'acard acard--wide' }, [
      UI.el('h3', { text: COPY.footer.codeTitle }),
      UI.el('ul', { class: 'ticks' }, COPY.footer.code.map(function (t) {
        return UI.el('li', { text: t });
      }))
    ]));
    host.appendChild(UI.el('details', { class: 'glossary' }, [
      UI.el('summary', { text: COPY.ui.glossarySummary }),
      UI.el('dl', null, D.GLOSSARY.map(function (pair) {
        return [
          UI.el('dt', { text: pair[0] }),
          UI.el('dd', { text: pair[1] })
        ];
      }))
    ]));
    host.appendChild(UI.el('p', { class: 'appendix__note' }, [
      UI.el('span', { text: COPY.footer.version.note + ' ' }),
      UI.el('span', { text: COPY.footer.disclaimer })
    ]));
  }

  function buildAbout() {
    var modal = document.getElementById('about');
    var box = modal.querySelector('.modal__box');
    UI.clear(box);
    var close = UI.el('button', { type: 'button', class: 'icon-btn modal__close', 'aria-label': COPY.actions.close, text: '×' });
    close.addEventListener('click', closeAbout);
    box.appendChild(close);
    box.appendChild(UI.el('span', { class: 'eyebrow', text: COPY.ui.aboutEyebrow }));
    box.appendChild(UI.el('h2', { id: 'aboutTitle', text: COPY.about.title }));
    box.appendChild(UI.el('p', { class: 'modal__lead', text: COPY.about.lead }));
    box.appendChild(UI.el('div', { class: 'modal__grid' }, COPY.about.sections.map(function (sec) {
      return UI.el('section', null, [
        UI.el('h3', { text: sec.title }),
        UI.el('ul', null, sec.items.map(function (t) { return UI.el('li', { text: t }); }))
      ]);
    })));
    box.appendChild(UI.el('div', { class: 'modal__foot' }, [
      UI.el('span', { text: 'Milvus ' + D.VERSION.doc + ' · 抓取 ' + D.VERSION.crawled }),
      UI.el('span', { text: COPY.ui.localSim })
    ]));
  }

  var lastFocus = null;

  function openAbout() {
    lastFocus = document.activeElement;
    var modal = document.getElementById('about');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    var close = modal.querySelector('.modal__close');
    if (close) close.focus();
  }

  function closeAbout() {
    var modal = document.getElementById('about');
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function trapFocus(e) {
    var modal = document.getElementById('about');
    if (!modal.classList.contains('is-open')) return;
    if (e.key !== 'Tab') return;
    var focusables = modal.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function toggleAuto() {
    if (autoTimer) stopAuto();
    else {
      startAuto();
    }
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(function () {
      if (state.stage >= STAGES.length) {
        stopAuto();
        return;
      }
      go(state.stage + 1);
    }, 7000);
    updateChrome();
  }

  function stopAuto() {
    if (!autoTimer) return;
    clearInterval(autoTimer);
    autoTimer = null;
    updateChrome();
  }

  function onKey(e) {
    if (e.defaultPrevented) return;
    var t = e.target;
    var inField = t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
    if (inField) {
      if (e.key === 'Escape') {
        closeAbout();
        var tip = document.getElementById('tooltip');
        if (tip) tip.hidden = true;
      }
      return;
    }
    var onAction = t && t.closest && t.closest('button, a');
    if (onAction && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === 'Escape') {
      closeAbout();
      var tp = document.getElementById('tooltip');
      if (tp) tp.hidden = true;
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stopAuto();
      go(state.stage + 1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stopAuto();
      go(state.stage - 1);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      stopAuto();
      go(e.key === '0' ? 10 : Number(e.key));
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      toggleAuto();
    }
  }

  function bind() {
    document.getElementById('btnStart').addEventListener('click', function () {
      stopAuto();
      go(1, { scroll: true });
    });
    document.getElementById('btnConclusion').addEventListener('click', function () {
      var c = document.getElementById('conclusion');
      if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('btnAbout').addEventListener('click', openAbout);
    var about = document.getElementById('about');
    about.addEventListener('click', function (e) {
      if (e.target === about) closeAbout();
    });
    document.getElementById('btnPrev').addEventListener('click', function () {
      stopAuto();
      go(state.stage - 1);
    });
    document.getElementById('btnNext').addEventListener('click', function () {
      stopAuto();
      go(state.stage + 1);
    });
    document.getElementById('btnAuto').addEventListener('click', toggleAuto);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keydown', trapFocus);
    window.addEventListener('hashchange', function () {
      if (writingHash) return;
      if (parseHash()) {
        stopAuto();
        renderStage();
        updateChrome();
        updateStageFoot();
        updateHeroStats();
      }
    });
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (current && current.update) current.update();
      }, 160);
    });
  }

  function updateStageFoot() {
    var prev = document.getElementById('btnPrev');
    var next = document.getElementById('btnNext');
    prev.disabled = state.stage <= 1;
    next.disabled = state.stage >= STAGES.length;
    var now = document.getElementById('nowLabel');
    if (now) now.textContent = String(state.stage).padStart(2, '0') + ' / ' + String(STAGES.length).padStart(2, '0');
  }

  function boot() {
    buildHero();
    buildTrack();
    buildRail();
    buildAbout();
    buildAppendix();
    UI.initTooltip();
    bind();
    updateHeroStats();
    var hadHash = parseHash();
    if (!hadHash) state.visited[1] = true;
    else state.visited[state.stage] = true;
    renderStage();
    updateChrome();
    updateStageFoot();
    commit();
    window.MILVUS_READY = true;
    window.MILVUS.app = {
      state: state,
      go: go,
      set: set,
      patch: patch,
      commit: commit,
      stopAuto: stopAuto,
      updateStageFoot: updateStageFoot
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
