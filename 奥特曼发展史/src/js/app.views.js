/* ============================================================
   APP VIEWS — rendering & filtering
   ============================================================ */
(function () {
  'use strict';

  const App = window.App;
  const { $, $$, esc, db, state, labels } = App;
  const V = App.views = {};
  const { works, heroes, events, factions, battles, workById, heroById, eventById, factionById, battleById } = db;
  const { ERA_BY_YEAR, TYPE_CLASS, ALIGN_LABEL, ALIGN_COLOR } = labels;

  const heroName = (id) => (heroById.get(id) || {}).name || '';
  const workName = (id) => (workById.get(id) || {}).title || '';
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');
  const workMedia = (w) => {
    const hero = w._heroes && w._heroes[0];
    const src = App.heroImg(hero);
    if (w.id === 'ultra-q') return Art.qMark();
    if (!src) return App.heroArtFor(w);
    return `<span class="p-glow"></span><span class="p-rings"></span><span class="p-year">${w.year}</span><img class="wcard-photo" src="${src}" alt="${esc(hero.name)}">`;
  };

  /* ================= HERO ================= */
  const FEATURED = ['ultraman', 'seven', 'tiga', 'zero', 'omega', 'teo'];

  V.renderHero = () => {
    const stage = $('#heroStage'), sw = $('#stageSwitch');
    if (!stage || !sw) return;
    const list = FEATURED.map((id) => heroById.get(id)).filter(Boolean);
    stage.innerHTML = list.map((h, i) =>
      `<div class="art-layer${i === 0 ? ' on' : ''}" data-layer="${h.id}">${App.heroImg(h) ? `<img class="stage-photo" src="${App.heroImg(h)}" alt="${esc(h.name)}">` : Art.portrait(h, { bg: false, viewBox: '0 0 400 500' })}</div>`
    ).join('');
    sw.innerHTML = list.map((h, i) =>
      `<button role="tab" aria-selected="${i === 0}" aria-label="查看${esc(h.name)}" class="${i === 0 ? 'on' : ''}" data-stage="${i}"><i></i></button>`
    ).join('');
    const setStage = (i) => {
      state.stage = i;
      const h = list[i];
      $$('.art-layer', stage).forEach((el, k) => el.classList.toggle('on', k === i));
      $$('button[data-stage]', sw).forEach((b, k) => {
        b.classList.toggle('on', k === i);
        b.setAttribute('aria-selected', String(k === i));
      });
      const nm = $('#stageName'), en = $('#stageEn');
      if (nm) nm.textContent = h.name;
      if (en) en.textContent = h.en;
    };
    sw.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-stage]');
      if (b) setStage(Number(b.dataset.stage));
    });
    setStage(0);

    // pointer parallax
    if (window.matchMedia('(pointer:fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const wrap = $('#heroStageWrap');
      let tx = 0, ty = 0, cx = 0, cy = 0;
      const loop = () => {
        cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
        stage.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
        requestAnimationFrame(loop);
      };
      wrap.addEventListener('pointermove', (e) => {
        const r = wrap.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 16;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 12;
      });
      wrap.addEventListener('pointerleave', () => { tx = 0; ty = 0; });
      loop();
    }
  };

  V.renderStats = () => {
    const box = $('#heroStats');
    if (!box) return;
    const items = [
      { v: 1966, l: '系列起点', e: 'Series Origin', suffix: '' },
      { v: App.stats.years, l: '跨越年代', e: 'Years of Light', suffix: '年' },
      { v: App.stats.works, l: '作品档案', e: 'Works Archived', suffix: '部' },
      { v: App.stats.events, l: '宇宙事件', e: 'Events Recorded', suffix: '条' },
      { v: App.stats.heroes, l: '奥特战士', e: 'Ultra Heroes', suffix: '位' },
      { v: App.stats.factions + App.stats.battles, l: '文明与战役', e: 'Factions & Battles', suffix: '项' }
    ];
    box.innerHTML = items.map((it) =>
      `<div class="stat"><b><span data-count="${it.v}">0</span>${it.suffix ? `<em>${it.suffix}</em>` : ''}</b>
        <span>${it.l}</span><small>${it.e}</small></div>`
    ).join('');
    setTimeout(() => {
      $$('[data-count]', box).forEach((el) => App.countUp(el, Number(el.dataset.count)));
    }, 700);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('metaWorks', App.stats.works);
    set('metaEvents', App.stats.events);
    set('metaHeroes', App.stats.heroes);
    set('metaFactions', App.stats.factions);
    set('metaBattles', App.stats.battles);
    const links = works.reduce((n, w) => n + (w._heroes.length + (w._events ? w._events.length : 0) + (w._battles ? w._battles.length : 0) + (w._related ? w._related.length : 0)), 0);
    set('metaLinks', links);
    set('workTotal', App.stats.works);
    set('heroCount', App.stats.heroes);
  };

  V.renderTicker = () => {
    const track = $('#tickerTrack');
    if (!track) return;
    const seq = works.map((w) => `<span><b>${w.year}</b>${esc(w.title)}<i></i></span>`).join('');
    track.innerHTML = seq + seq;
  };

  /* ================= HISTORY ================= */
  const phaseOrder = DATA_PHASES.map((p) => p.id);
  let workCards = [];

  function typeFilters() {
    const counts = { all: works.length };
    works.forEach((w) => { counts[w.type] = (counts[w.type] || 0) + 1; });
    const types = ['all'].concat(DATA_WORK_TYPES);
    return types.map((t) => ({ t, label: t === 'all' ? '全部' : t, n: counts[t] || 0 }));
  }
  function eraFilters() {
    const eras = ['昭和', '平成', '新生代', '令和'];
    const counts = {};
    works.forEach((w) => { counts[w._era] = (counts[w._era] || 0) + 1; });
    return [{ t: 'all', label: '全部', n: works.length }].concat(eras.map((e) => ({ t: e, label: e, n: counts[e] || 0 })));
  }

  V.renderHistoryControls = () => {
    const rail = $('#phaseRail');
    if (rail) {
      rail.innerHTML = DATA_PHASES.map((p) =>
        `<button data-phase="${p.id}" aria-pressed="false"><span class="p-no">${esc(p.id.toUpperCase())}</span><span class="p-name">${esc(p.name)}</span><span class="p-year">${esc(p.years)}</span></button>`
      ).join('');
      rail.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-phase]');
        if (!b) return;
        state.filters.phase = state.filters.phase === b.dataset.phase ? 'all' : b.dataset.phase;
        V.applyHistory();
      });
    }
    const ft = $('#filterTypes');
    if (ft) {
      ft.innerHTML = typeFilters().map((f) =>
        `<button class="chip${f.t === 'all' ? ' active' : ''}" data-type="${f.t}" aria-pressed="${f.t === 'all'}">${esc(f.label)}<span class="n">${f.n}</span></button>`
      ).join('');
      ft.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-type]');
        if (!b) return;
        state.filters.type = b.dataset.type;
        V.applyHistory();
      });
    }
    const fe = $('#filterEras');
    if (fe) {
      fe.innerHTML = eraFilters().map((f) =>
        `<button class="chip${f.t === 'all' ? ' active' : ''}" data-era="${f.t}" aria-pressed="${f.t === 'all'}">${esc(f.label)}<span class="n">${f.n}</span></button>`
      ).join('');
      fe.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-era]');
        if (!b) return;
        state.filters.era = b.dataset.era;
        V.applyHistory();
      });
    }

    const yr = $('#yearRail');
    if (yr) {
      const first = 1966, last = Math.max(2026, App.stats.latest);
      let html = '';
      for (let y = first; y <= last; y++) {
        const n = works.filter((w) => w.year === y).length;
        html += `<button class="year${n ? ' has' : ''}${y % 10 === 0 ? ' decade' : ''}" data-year="${y}" title="${y}${n ? ' · ' + n + ' 部作品' : ' · 无收录'}">${y}</button>`;
      }
      yr.innerHTML = html;
      yr.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-year]');
        if (b) jumpToYear(Number(b.dataset.year));
      });
    }

    const input = $('#workSearch');
    if (input) {
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.filters.q = input.value.trim(); V.applyHistory(); }, 160);
        $('#workSearchClear').classList.toggle('show', !!input.value);
      });
      $('#workSearchClear').addEventListener('click', () => {
        input.value = ''; state.filters.q = ''; $('#workSearchClear').classList.remove('show'); V.applyHistory();
      });
      $('#workReset').addEventListener('click', () => {
        state.filters = { phase: 'all', type: 'all', era: 'all', q: '' };
        input.value = ''; $('#workSearchClear').classList.remove('show');
        V.applyHistory();
        App.toast('已清除全部筛选条件');
      });
    }
  };

  function jumpToYear(y) {
    const hadFilters = state.filters.phase !== 'all' || state.filters.type !== 'all' || state.filters.era !== 'all' || state.filters.q;
    if (hadFilters) {
      state.filters = { phase: 'all', type: 'all', era: 'all', q: '' };
      const input = $('#workSearch');
      if (input) input.value = '';
      V.applyHistory();
    }
    const years = works.map((w) => w.year);
    if (!years.includes(y)) {
      const nearest = years.slice().sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
      App.toast(`${y} 年暂无收录作品，已定位到最近的 ${nearest} 年`);
      y = nearest;
    }
    const card = document.querySelector(`.wcard[data-year="${y}"]`);
    const yrBtn = document.querySelector(`.year[data-year="${y}"]`);
    if (yrBtn) {
      yrBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      yrBtn.classList.add('flash');
      setTimeout(() => yrBtn.classList.remove('flash'), 1200);
    }
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('flash');
      setTimeout(() => card.classList.remove('flash'), 1700);
    }
  }

  V.renderHistory = () => {
    const list = $('#histList');
    if (!list) return;
    workCards = [];
    list.innerHTML = '';
    phaseOrder.forEach((pid) => {
      const phase = DATA_PHASES.find((p) => p.id === pid);
      const items = works.filter((w) => w.phase === pid);
      if (!items.length) return;
      const block = document.createElement('section');
      block.className = 'phase-block on reveal';
      block.dataset.phase = pid;
      block.innerHTML = `
        <div class="phase-head">
          <h3>${esc(phase.name)}</h3>
          <span class="ph-year">${esc(phase.years)}</span>
          <span class="ph-count" data-phcount>${items.length} 部作品</span>
          <p>${esc(phase.desc)}</p>
        </div>
        <div class="wgrid"></div>`;
      const grid = $('.wgrid', block);
      items.forEach((w, i) => {
        const hero = w._heroes[0];
        const card = document.createElement('article');
        card.className = 'wcard reveal';
        card.style.setProperty('--d', (i % 6) * 55 + 'ms');
        card.dataset.open = 'work';
        card.dataset.id = w.id;
        card.dataset.year = String(w.year);
        card.dataset.type = w.type;
        card.dataset.era = w._era;
        card.dataset.phase = w.phase;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `打开《${w.title}》档案`);
        card.dataset.search = norm([w.title, w.jp, w.en, w.year, hero ? hero.name : '', w._heroes.map((h) => h.name).join('')].join(' '));
        card.innerHTML = `
          <div class="wcard-media scan">
            ${workMedia(w)}
            <span class="year-badge">${w.year}</span>
            <span class="type-badge ${TYPE_CLASS[w.type] || ''}">${esc(w.type)}</span>
            <span class="hero-ghost">${esc(hero ? hero.name : 'ARCHIVE')}</span>
          </div>
          <div class="wcard-body">
            <h3 class="wcard-title">${esc(w.title)}</h3>
            <span class="wcard-jp">${esc(w.jp)}</span>
            <p class="wcard-syn">${esc(w.synopsis)}</p>
            <div class="wcard-foot">
              <span class="era">${esc(w._era)} · ${esc(w.date.split('（')[0])}</span>
              <span class="open">档案<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h13M13 7l5 5-5 5"/></svg></span>
            </div>
          </div>`;
        grid.appendChild(card);
        workCards.push(card);
      });
      list.appendChild(block);
    });
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.id = 'histEmpty';
    empty.innerHTML = `<b>没有匹配的作品</b><span>试试清除筛选，或搜索“迪迦”“赛罗”“2021”等关键词。</span>`;
    empty.hidden = true;
    list.appendChild(empty);
    V.applyHistory();
    App.observeReveals(list);
  };

  V.applyHistory = () => {
    const f = state.filters;
    let shown = 0;
    const perPhase = {};
    workCards.forEach((card) => {
      const hay = card.dataset.search || '';
      const ok = (f.phase === 'all' || card.dataset.phase === f.phase)
        && (f.type === 'all' || card.dataset.type === f.type)
        && (f.era === 'all' || card.dataset.era === f.era)
        && (!f.q || hay.includes(norm(f.q)));
      card.hidden = !ok;
      if (ok) { shown++; perPhase[card.dataset.phase] = (perPhase[card.dataset.phase] || 0) + 1; }
    });
    $$('#histList .phase-block').forEach((block) => {
      const n = perPhase[block.dataset.phase] || 0;
      block.classList.toggle('on', n > 0);
      const c = $('[data-phcount]', block);
      if (c) c.textContent = n + ' 部作品';
    });
    const empty = $('#histEmpty');
    if (empty) empty.hidden = shown !== 0;
    const wc = $('#workCount');
    if (wc) wc.textContent = String(shown);
    $$('#phaseRail button').forEach((b) => {
      const on = b.dataset.phase === f.phase;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $$('#filterTypes .chip').forEach((b) => {
      const on = b.dataset.type === f.type;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
    $$('#filterEras .chip').forEach((b) => {
      const on = b.dataset.era === f.era;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
  };

  /* ================= CHRONICLE ================= */
  V.renderChronicleControls = () => {
    const tabs = $('#eraTabs');
    if (!tabs) return;
    tabs.innerHTML = DATA_ERAS.map((era) =>
      `<button class="era-tab${era.id === 1 ? ' active' : ''}" data-era="${era.id}" role="tab" aria-selected="${era.id === 1}">
        <span class="rn">${era.roman}</span>
        <span class="tx"><b>${esc(era.name)}</b><span>${esc(era.en)}</span></span>
      </button>`
    ).join('');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-era]');
      if (!b) return;
      state.chronicleEra = Number(b.dataset.era);
      V.renderChronicle();
    });
  };

  V.renderChronicle = () => {
    const eraId = state.chronicleEra;
    const era = DATA_ERAS.find((x) => x.id === eraId) || DATA_ERAS[0];
    $$('#eraTabs .era-tab').forEach((b) => {
      const on = Number(b.dataset.era) === eraId;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    const panel = $('#eraPanel');
    const list = events.filter((e) => e.era === eraId);
    if (panel) {
      panel.dataset.roman = era.roman;
      panel.innerHTML = `
        <div class="ep-top">
          <h3>第${'一二三四五'[era.id - 1]}纪元 · ${esc(era.name)}</h3>
          <span class="ep-years">${esc(era.years)}</span>
        </div>
        <p>${esc(era.desc)}</p>
        <div class="ep-stats">
          <div><b>${list.length}</b><span>事件记录</span></div>
          <div><b>${new Set(list.map((e) => e.universe)).size}</b><span>涉及宇宙</span></div>
          <div><b>${new Set(list.flatMap((e) => e.works || [])).size}</b><span>关联作品</span></div>
          <div><b>${list.filter((e) => e.certainty === '官方设定').length}</b><span>官方设定条目</span></div>
        </div>`;
    }
    const box = $('#evList');
    if (!box) return;
    box.innerHTML = list.map((e, i) => {
      const ws = e._works.map((w) => w.title).join(' / ');
      return `<article class="ev reveal" style="--d:${i * 45}ms">
        <button class="ev-card" data-open="event" data-id="${e.id}" aria-label="打开事件档案：${esc(e.title)}">
          <div class="ev-main">
            <div class="ev-meta">
              <span class="ev-time">${esc(e.time)}</span>
              <span class="tag ${e.certainty === '官方设定' ? 'gold' : 'blue'}">${esc(e.certainty)}</span>
              <span class="tag">${esc(e.universe)}</span>
            </div>
            <h3 class="ev-title">${esc(e.title)}</h3>
            <p class="ev-syn">${esc(e.bg)}</p>
          </div>
          <div class="ev-side">
            <span class="u">${esc(ws || '—')}</span>
            <span class="go">展开档案 →</span>
          </div>
        </button>
      </article>`;
    }).join('');
    App.observeReveals(box);
  };

  /* ================= HEROES ================= */
  let heroCards = [];

  V.renderHeroControls = () => {
    const ef = $('#heroEraFilters'), uf = $('#heroUniverseFilters');
    const eras = ['昭和', '平成', '新生代', '令和'];
    const ecounts = {}; heroes.forEach((h) => { ecounts[h.era] = (ecounts[h.era] || 0) + 1; });
    if (ef) {
      ef.innerHTML = [{ t: 'all', label: '全部', n: heroes.length }].concat(eras.map((e) => ({ t: e, label: e, n: ecounts[e] || 0 })))
        .map((f) => `<button class="chip${f.t === 'all' ? ' active' : ''}" data-herera="${f.t}" aria-pressed="${f.t === 'all'}">${f.label}<span class="n">${f.n}</span></button>`).join('');
      ef.addEventListener('click', (e) => {
        const b = e.target.closest('[data-herera]'); if (!b) return;
        state.heroFilters.era = b.dataset.herera; V.applyHeroes();
      });
    }
    if (uf) {
      const ucounts = { all: heroes.length, m78: 0, other: 0 };
      heroes.forEach((h) => { ucounts[h.uw]++; });
      const items = [{ t: 'all', label: '全部宇宙', n: ucounts.all }, { t: 'm78', label: 'M78 光之国', n: ucounts.m78 }, { t: 'other', label: '其他宇宙', n: ucounts.other }];
      uf.innerHTML = items.map((f) => `<button class="chip${f.t === 'all' ? ' active' : ''}" data-heruw="${f.t}" aria-pressed="${f.t === 'all'}">${f.label}<span class="n">${f.n}</span></button>`).join('');
      uf.addEventListener('click', (e) => {
        const b = e.target.closest('[data-heruw]'); if (!b) return;
        state.heroFilters.uw = b.dataset.heruw; V.applyHeroes();
      });
    }
    const input = $('#heroSearch');
    if (input) {
      let timer = null;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.heroFilters.q = input.value.trim(); V.applyHeroes(); }, 150);
      });
    }
  };

  V.renderHeroes = () => {
    const grid = $('#heroGrid');
    if (!grid) return;
    heroCards = [];
    heroes.forEach((h, i) => {
      const debut = h._debut;
      const card = document.createElement('article');
      card.className = 'hcard reveal';
      card.style.setProperty('--d', (i % 8) * 45 + 'ms');
      card.dataset.open = 'hero';
      card.dataset.id = h.id;
      card.dataset.era = h.era;
      card.dataset.uw = h.uw;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `打开${h.name}档案`);
      card.dataset.search = norm([h.name, h.jp, h.en, h.host, h.universe, h.era].join(' '));
      card.innerHTML = `
        <div class="hcard-art">
          ${App.heroImg(h) ? `<img class="hcard-photo" src="${App.heroImg(h)}" alt="${esc(h.name)}">` : Art.portrait(h)}
          <span class="hcard-id">NO.${String(i + 1).padStart(3, '0')}</span>
          <span class="hcard-era">${esc(h.era)}</span>
          <div class="hcard-hover"><span>OPEN DOSSIER</span></div>
          <div class="hcard-info">
            <h3>${esc(h.name)}</h3>
            <span class="en">${esc(h.en)}</span>
            <span class="debut"><b>${h.year}</b>${esc(debut ? debut.title : '')}</span>
          </div>
        </div>`;
      grid.appendChild(card);
      heroCards.push(card);
    });
    V.applyHeroes();
    App.observeReveals(grid);
  };

  V.applyHeroes = () => {
    const f = state.heroFilters;
    let n = 0;
    heroCards.forEach((card) => {
      const ok = (f.era === 'all' || card.dataset.era === f.era)
        && (f.uw === 'all' || card.dataset.uw === f.uw)
        && (!f.q || card.dataset.search.includes(norm(f.q)));
      card.hidden = !ok;
      if (ok) n++;
    });
    const c = $('#heroCount'); if (c) c.textContent = String(n);
    $$('#heroEraFilters .chip').forEach((b) => {
      const on = b.dataset.herera === f.era; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
    $$('#heroUniverseFilters .chip').forEach((b) => {
      const on = b.dataset.heruw === f.uw; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
  };

  /* ================= FACTIONS ================= */
  let factionCards = [];

  V.renderFactionControls = () => {
    const legend = $('#alignLegend');
    if (legend) {
      legend.innerHTML = Object.keys(ALIGN_LABEL).map((k) => {
        const n = factions.filter((f) => f.align === k).length;
        return `<span class="lg"><i style="background:${ALIGN_COLOR[k]}"></i>${ALIGN_LABEL[k]} · ${n}</span>`;
      }).join('');
    }
    const box = $('#factionFilters');
    if (box) {
      const counts = { all: factions.length };
      factions.forEach((f) => { counts[f.align] = (counts[f.align] || 0) + 1; });
      box.innerHTML = [{ t: 'all', label: '全部势力', n: counts.all }]
        .concat(Object.keys(ALIGN_LABEL).filter((k) => (counts[k] || 0) > 0).map((k) => ({ t: k, label: ALIGN_LABEL[k], n: counts[k] || 0 })))
        .map((f) => `<button class="chip${f.t === 'all' ? ' active' : ''}" data-align="${f.t}" aria-pressed="${f.t === 'all'}">${esc(f.label)}<span class="n">${f.n}</span></button>`).join('');
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-align]'); if (!b) return;
        state.factionFilters.align = b.dataset.align; V.applyFactions();
      });
    }
  };

  V.renderFactions = () => {
    const grid = $('#factionGrid');
    if (!grid) return;
    factionCards = [];
    factions.forEach((f, i) => {
      const card = document.createElement('article');
      card.className = 'fcard reveal';
      card.style.setProperty('--d', (i % 6) * 50 + 'ms');
      card.style.setProperty('--accent', ALIGN_COLOR[f.align]);
      card.dataset.open = 'faction';
      card.dataset.id = f.id;
      card.dataset.align = f.align;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.dataset.search = norm([f.name, f.jp, f.category, f.universe, f.desc].join(' '));
      card.innerHTML = `
        <div class="fcard-emblem">${Art.emblem(f)}</div>
        <div class="fcard-body">
          <div class="fcard-top">
            <span class="fcard-cat">${esc(f.category)}</span>
            <span class="tag" style="color:${ALIGN_COLOR[f.align]};border-color:${ALIGN_COLOR[f.align]}55;background:${ALIGN_COLOR[f.align]}14">${esc(ALIGN_LABEL[f.align])}</span>
          </div>
          <h3>${esc(f.name)}</h3>
          <span class="jp">${esc(f.jp)} · ${esc(f.universe)}</span>
          <p>${esc(f.desc)}</p>
          <div class="fcard-foot"><span>${esc(f.leaders)}</span><span class="go">档案 →</span></div>
        </div>`;
      grid.appendChild(card);
      factionCards.push(card);
    });
    V.applyFactions();
    App.observeReveals(grid);
  }; 
  V.applyFactions = () => {
    const a = state.factionFilters.align;
    factionCards.forEach((card) => { card.hidden = !(a === 'all' || card.dataset.align === a); });
    $$('#factionFilters .chip').forEach((b) => {
      const on = b.dataset.align === a; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on));
    });
  };

  /* ================= BATTLES ================= */
  V.renderBattles = () => {
    const box = $('#battleList');
    if (!box) return;
    box.innerHTML = battles.map((b, i) => {
      const left = heroById.get(b.left) || b._heroes[0] || null;
      const right = b.right ? heroById.get(b.right) : null;
      return `<article class="bcard reveal" data-open="battle" data-id="${b.id}" tabindex="0" role="button" aria-label="打开战役档案：${esc(b.title)}">
        <div class="bcard-art">
          ${App.heroImg(left) ? `<img class="bcard-photo" src="${App.heroImg(left)}" alt="${esc(left.name)}"><span class="b-vs">VS</span>` : Art.versus(left, right, b)}
          <span class="bno">BATTLE ${String(i + 1).padStart(2, '0')}</span>
        </div>
        <div class="bcard-body">
          <div class="meta">
            <span class="tag gold">${b.year}</span>
            ${b._works.map((w) => `<span class="tag">${esc(w.title)}</span>`).join('')}
          </div>
          <h3>${esc(b.title)}</h3>
          <span class="mono" style="color:var(--dim)">${esc(b.sub)}</span>
          <p class="quote">${esc(b.quote)}</p>
          <div class="parts">${b.participants.slice(0, 5).map((p) => `<span class="part">${esc(p)}</span>`).join('')}</div>
          <div class="bfoot"><span>${esc(b.enemy)}</span><span class="go">战役档案 →</span></div>
        </div>
      </article>`;
    }).join('');
    App.observeReveals(box);
  };

  /* ================= RELATIONS ================= */
  const REL_TABS = [
    { k: 'work', label: '作品' }, { k: 'hero', label: '战士' },
    { k: 'event', label: '事件' }, { k: 'battle', label: '战役' }, { k: 'faction', label: '势力' }
  ];

  function relItems(kind) {
    if (kind === 'work') return works.map((w) => ({ id: w.id, label: w.title, meta: String(w.year), search: w.title + w.jp + w.en + w.year }));
    if (kind === 'hero') return heroes.map((h) => ({ id: h.id, label: h.name, meta: String(h.year), search: h.name + h.jp + h.en + h.host }));
    if (kind === 'event') return events.map((e) => ({ id: e.id, label: e.title, meta: String(e.time), search: e.title + e.universe }));
    if (kind === 'faction') return factions.map((f) => ({ id: f.id, label: f.name, meta: f.category, search: f.name + f.jp + f.universe + f.desc }));
    return battles.map((b) => ({ id: b.id, label: b.title, meta: String(b.year), search: b.title + b.enemy }));
  }

  V.renderRelationList = () => {
    const tabs = $('#relTabs'), list = $('#relList');
    if (!tabs || !list) return;
    tabs.innerHTML = REL_TABS.map((t) => `<button data-reltab="${t.k}" class="${t.k === state.relTab ? 'active' : ''}">${t.label}</button>`).join('');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reltab]'); if (!b) return;
      state.relTab = b.dataset.reltab;
      state.relId = relItems(state.relTab)[0].id;
      V.renderRelationList();
      V.renderRelationPanel();
    });
    const q = state.relQuery;
    const items = relItems(state.relTab).filter((it) => !q || norm(it.search).includes(norm(q)));
    if (!items.some((it) => it.id === state.relId) && items.length) state.relId = items[0].id;
    list.innerHTML = items.map((it, i) =>
      `<button class="rel-item${it.id === state.relId ? ' active' : ''}" data-relid="${it.id}">
        <span class="idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="nm">${esc(it.label)}</span>
        <span class="yr">${esc(it.meta)}</span>
      </button>`).join('') || `<div class="rel-empty">没有匹配节点</div>`;
    list.onclick = (e) => {
      const b = e.target.closest('[data-relid]'); if (!b) return;
      state.relId = b.dataset.relid;
      V.renderRelationList();
      V.renderRelationPanel();
    };
    $$('button[data-reltab]', tabs).forEach((b) => b.classList.toggle('active', b.dataset.reltab === state.relTab));
    const inp = $('#relSearch');
    if (inp && inp.value !== state.relQuery) inp.value = state.relQuery;
  };

  const chip = (type, id, label, meta) =>
    `<button class="rel-chip" data-open="${type}" data-id="${id}"><span>${esc(label)}</span>${meta ? `<i>${esc(meta)}</i>` : ''}</button>`;

  function relThumb(kind, obj) {
    if (kind === 'hero') return App.heroImg(obj) ? `<img src="${App.heroImg(obj)}" alt="${esc(obj.name)}">` : Art.portrait(obj);
    if (kind === 'work') { const h = obj._heroes && obj._heroes[0]; return App.heroImg(h) ? `<img src="${App.heroImg(h)}" alt="">` : App.heroArtFor(obj); }
    if (kind === 'faction') return Art.emblem(obj);
    if (kind === 'battle') { const l = heroById.get(obj.left) || null; const r = obj.right ? heroById.get(obj.right) : null; return App.heroImg(l) ? `<img src="${App.heroImg(l)}" alt="">` : Art.versus(l, r, obj); }
    const w = obj._works && obj._works[0];
    const h = w && w._heroes && w._heroes[0];
    return App.heroImg(h) ? `<img src="${App.heroImg(h)}" alt="">` : (w ? App.heroArtFor(w) : Art.emblem({ align: 'neutral', emblem: 'diamond' }));
  }

  V.renderRelationPanel = () => {
    const panel = $('#relPanel');
    if (!panel) return;
    const kind = state.relTab;
    const obj = kind === 'work' ? workById.get(state.relId) : kind === 'hero' ? heroById.get(state.relId) : kind === 'event' ? eventById.get(state.relId) : kind === 'faction' ? factionById.get(state.relId) : battleById.get(state.relId);
    if (!obj) { panel.innerHTML = `<div class="rel-empty">请选择一个档案节点</div>`; return; }
    let kicker = '', title = '', desc = '', groups = [];
    if (kind === 'work') {
      kicker = `${obj.type} · ${obj.year} · ${obj._era}`;
      title = obj.title; desc = obj.synopsis;
      groups = [
        { h: '主要奥特战士', items: obj._heroes.map((h) => chip('hero', h.id, h.name, h.en)) },
        { h: '关联宇宙事件', items: (obj._events || []).map((e) => chip('event', e.id, e.title, e.certainty)) },
        { h: '经典战役', items: (obj._battles || []).map((b) => chip('battle', b.id, b.title, b.year)) },
        { h: '关联作品', items: (obj._related || []).map((w) => chip('work', w.id, w.title, w.year)) }
      ];
    } else if (kind === 'hero') {
      kicker = `${obj.era} · ${obj.universe}`;
      title = obj.name; desc = obj.identity;
      groups = [
        { h: '首次登场', items: obj._debut ? [chip('work', obj._debut.id, obj._debut.title, obj._debut.year)] : [] },
        { h: '关联作品', items: (obj._works || []).map((w) => chip('work', w.id, w.title, w.year)) },
        { h: '参与战役', items: (obj._battles || []).map((b) => chip('battle', b.id, b.title, b.year)) },
        { h: '相关事件', items: (obj._events || []).map((e) => chip('event', e.id, e.title, e.time)) }
      ];
    } else if (kind === 'event') {
      kicker = `第${'一二三四五'[obj.era - 1]}纪元 · ${obj.time}`;
      title = obj.title; desc = obj.bg;
      const figures = (obj.figures || []).map((name) => {
        const h = heroes.find((x) => name.includes(x.name) || x.name.includes(name));
        return h ? chip('hero', h.id, h.name, '') : `<span class="part">${esc(name)}</span>`;
      });
      const linkedBattles = battles.filter((b) => (b.events || []).includes(obj.id));
      groups = [
        { h: '关联作品', items: obj._works.map((w) => chip('work', w.id, w.title, w.year)) },
        { h: '主要人物', items: figures },
        { h: '关联战役', items: linkedBattles.map((b) => chip('battle', b.id, b.title, b.year)) },
        { h: '所属宇宙', items: [`<span class="part">${esc(obj.universe)}</span>`, `<span class="part">${esc(obj.certainty)}</span>`] }
      ];
    } else if (kind === 'faction') {
      kicker = `${obj.category} · ${obj.universe}`;
      title = obj.name; desc = obj.desc;
      groups = [
        { h: '关联作品', items: obj._works.map((w) => chip('work', w.id, w.title, w.year)) },
        { h: '代表人物', items: [obj.leaders].filter(Boolean).map((p) => `<span class="part">${esc(p)}</span>`) },
        { h: '主要目标', items: [obj.goal].map((p) => `<span class="part">${esc(p)}</span>`) },
        { h: '当前状态', items: [obj.status].map((p) => `<span class="part">${esc(p)}</span>`) }
      ];
    } else {
      kicker = `战役 · ${obj.year}`;
      title = obj.title; desc = obj.bg;
      groups = [
        { h: '关联作品', items: obj._works.map((w) => chip('work', w.id, w.title, w.year)) },
        { h: '相关战士', items: obj._heroes.map((h) => chip('hero', h.id, h.name, h.en)) },
        { h: '相关事件', items: obj._events.map((e) => chip('event', e.id, e.title, e.time)) },
        { h: '参战者', items: obj.participants.map((p) => `<span class="part">${esc(p)}</span>`) }
      ];
    }
    panel.innerHTML = `
      <div class="rel-head">
        <div class="thumb">${relThumb(kind, obj)}</div>
        <div class="rh-txt">
          <span class="k">${esc(kicker)}</span>
          <h3>${esc(title)}</h3>
          <p>${esc(desc)}</p>
        </div>
        <button class="btn btn-ghost btn-sm" data-open="${kind}" data-id="${obj.id}">打开完整档案</button>
      </div>
      <div class="rel-body">
        ${groups.filter((g) => g.items.length).map((g) => `<div class="rel-group"><h4>${esc(g.h)}</h4><div class="rel-chips">${g.items.join('')}</div></div>`).join('')}
        <div class="rel-note">关联依据：作品登场、系列设定与本站事件记录。不同世界观之间以“多元宇宙 / 平行世界”标注，不视为同一连续性。</div>
      </div>`;
  };

  V.renderWorldMap = () => {
    const box = $('#worldMap');
    if (!box) return;
    const worlds = [
      { name: 'M78 主宇宙', tag: 'SHOWA → MEBius', desc: '从初代到梦比优斯，奥特兄弟与宇宙警备队所在的连续世界观。', ids: ['ultraman', 'seven', 'return-ultraman', 'ace', 'taro', 'leo', 'eighty', 'mebius', 'ultra-galaxy-legend'] },
      { name: 'TDG 宇宙', tag: 'TIGA / DYNA / TRIGGER / DECKER', desc: '迪迦与戴拿共享的地球，以及后来的特利迦、德凯所在的 TPU 世界。', ids: ['tiga', 'dyna', 'tiga-final', 'trigger', 'decker'] },
      { name: '盖亚地球', tag: 'GAIA', desc: '地球意志赋予光之力量，与 M78 及 TDG 都不相连的独立世界。', ids: ['gaia'] },
      { name: '新生代平行宇宙', tag: 'NEW GENERATION', desc: '银河、艾克斯、欧布、捷德等各自独立的地球，通过赛罗等角色相互连接。', ids: ['ginga', 'x', 'orb', 'geed', 'r-b', 'taiga', 'z'] },
      { name: '令和多元世界', tag: 'REIWA', desc: '布莱泽、亚刻、奥美迦与提欧各自的世界，共享“怪兽共生”的时代主题。', ids: ['blazar', 'arc', 'omega', 'teo'] },
      { name: '独立世界观', tag: 'STANDALONE', desc: '新·奥特曼、奥特曼：崛起等不属于 TV 连续性的独立作品。', ids: ['shin', 'rising', 'ultra-q'] }
    ];
    box.innerHTML = worlds.map((w) =>
      `<div class="world-col">
        <h4>${esc(w.name)}<i>${esc(w.tag)}</i></h4>
        <p>${esc(w.desc)}</p>
        <div class="works">${w.ids.map((id) => { const wk = workById.get(id); return wk ? `<button data-open="work" data-id="${id}">${esc(wk.title)}</button>` : ''; }).join('')}</div>
      </div>`).join('');
  };

  V.init = () => {
    V.renderHero();
    V.renderStats();
    V.renderTicker();
    V.renderHistoryControls();
    V.renderHistory();
    V.renderChronicleControls();
    V.renderChronicle();
    V.renderHeroControls();
    V.renderHeroes();
    V.renderFactionControls();
    V.renderFactions();
    V.renderBattles();
    V.renderRelationList();
    V.renderRelationPanel();
    V.renderWorldMap();
    const relSearch = $('#relSearch');
    if (relSearch) {
      let t = null;
      relSearch.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { state.relQuery = relSearch.value.trim(); V.renderRelationList(); }, 140);
      });
    }
  };
})();
