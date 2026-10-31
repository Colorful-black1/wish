/* ============================================================
   APP CORE — indexes, utilities, shell behaviour
   ============================================================ */
(function () {
  'use strict';

  const App = window.App = {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* private mode */ }
    }
  };

  const TYPE_LABEL = { TV: 'TV', '剧场版': '剧场版', OVA: 'OVA', '网络': '网络', '特别篇': '特别篇' };
  const ERA_BY_YEAR = (y) => (y <= 1981 ? '昭和' : y <= 2008 ? '平成' : y <= 2019 ? '新生代' : '令和');
  const ALIGN_LABEL = { friendly: '友好文明 / 组织', neutral: '中立势力', hostile: '敌对势力', ambiguous: '多重立场' };
  const ALIGN_COLOR = { friendly: '#f0c775', neutral: '#7fc7ff', hostile: '#ff5a5a', ambiguous: '#b18cff' };
  const TYPE_CLASS = { '剧场版': 'movie', OVA: 'ova', '网络': 'net', '特别篇': 'net' };

  /* ---------------- index ---------------- */
  const works = DATA_WORKS.slice().sort((a, b) => a.year - b.year || String(a.date).localeCompare(String(b.date)));
  const heroes = DATA_HEROES.slice().sort((a, b) => a.year - b.year);
  const events = DATA_EVENTS.slice().sort((a, b) => a.era - b.era);
  const factions = DATA_FACTIONS.slice();
  const battles = DATA_BATTLES.slice().sort((a, b) => a.year - b.year);

  const byId = (arr) => new Map(arr.map((x) => [x.id, x]));
  const workById = byId(works), heroById = byId(heroes), eventById = byId(events),
    factionById = byId(factions), battleById = byId(battles);

  works.forEach((w) => { w._heroes = (w.heroes || []).map((id) => heroById.get(id)).filter(Boolean); w._era = ERA_BY_YEAR(w.year); });
  heroes.forEach((h) => { h._debut = workById.get(h.debut); });
  events.forEach((e) => { e._works = (e.works || []).map((id) => workById.get(id)).filter(Boolean); });
  battles.forEach((b) => { b._works = (b.works || []).map((id) => workById.get(id)).filter(Boolean); b._heroes = (b.heroes || []).map((id) => heroById.get(id)).filter(Boolean); });

  const indexRelated = () => {
    works.forEach((w) => {
      w._events = events.filter((e) => (e.works || []).includes(w.id));
      w._battles = battles.filter((b) => (b.works || []).includes(w.id));
      w._related = (w.related || []).map((id) => workById.get(id)).filter(Boolean);
    });
    heroes.forEach((h) => {
      h._works = works.filter((w) => w.id === h.debut || (w.heroes || []).includes(h.id) || (h.works || []).includes(w.id));
      h._battles = battles.filter((b) => (b.heroes || []).includes(h.id));
      h._events = events.filter((e) => (e.figures || []).some((f) => String(f).includes(h.name)));
    });
    factions.forEach((f) => { f._works = (f.works || []).map((id) => workById.get(id)).filter(Boolean); });
    battles.forEach((b) => {
      b._events = (b.events || []).map((id) => eventById.get(id)).filter(Boolean);
    });
  };
  indexRelated();

  const stats = {
    works: works.length,
    events: events.length,
    heroes: heroes.length,
    factions: factions.length,
    battles: battles.length,
    years: works.length ? (Math.max(...works.map((w) => w.year)) - 1966) : 0,
    latest: works.length ? Math.max(...works.map((w) => w.year)) : 2026,
    first: 1966
  };

  App.$ = $;
  App.$$ = $$;
  App.esc = esc;
  App.store = store;
  App.db = { works, heroes, events, factions, battles, workById, heroById, eventById, factionById, battleById };
  App.stats = stats;
  App.labels = { TYPE_LABEL, ERA_BY_YEAR, ALIGN_LABEL, ALIGN_COLOR, TYPE_CLASS };
  App.state = {
    fav: store.get('ua_fav', []),
    recent: store.get('ua_recent', []),
    filters: { phase: 'all', type: 'all', era: 'all', q: '' },
    heroFilters: { era: 'all', uw: 'all', q: '' },
    factionFilters: { align: 'all' },
    chronicleEra: 1,
    stage: 0,
    relTab: 'work',
    relId: 'ultraman',
    relQuery: ''
  };
  App.heroImg = (h) => (h && window.HERO_IMG && window.HERO_IMG[h.id]) || '';
  App.heroImgById = (id) => (window.HERO_IMG && window.HERO_IMG[id]) || '';
  App.posters = (w, size) => {
    if (w.id === 'ultra-q') return Art.qMark();
    const h = w._heroes && w._heroes[0];
    return Art.poster(w, h || null);
  };
  App.heroArtFor = (w) => (w.id === 'ultra-q' ? Art.qMark() : Art.poster(w, (w._heroes && w._heroes[0]) || null));
  App.firstHeroOfWork = (id) => {
    const w = workById.get(id);
    return w && w._heroes.length ? w._heroes[0] : null;
  };

  /* ---------------- toast ---------------- */
  let toastTimer = null;
  App.toast = (msg) => {
    const el = $('#toast'), tx = $('#toastText');
    if (!el) return;
    tx.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  };

  /* ---------------- starfield ---------------- */
  (function starfield() {
    const cv = $('#starfield');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, dpr = 1, stars = [], raf = null, t = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(220, Math.round((w * h) / 12000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.5 + 0.12,
        s: Math.random() * 0.12 + 0.02,
        p: Math.random() * Math.PI * 2
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      t += 0.016;
      for (const s of stars) {
        if (!reduce) { s.y += s.s; if (s.y > h + 2) { s.y = -2; s.x = Math.random() * w; } }
        const tw = reduce ? 1 : 0.72 + Math.sin(t * 1.6 + s.p) * 0.28;
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.r > 1 ? '#dfeaff' : '#9fb6d8';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });
    draw();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) draw();
    });
  })();

  /* ---------------- boot ---------------- */
  const finishBoot = () => { const b = $('#boot'); if (b) b.classList.add('done'); document.body.classList.remove('booting'); };
  window.addEventListener('load', () => setTimeout(finishBoot, 900));
  setTimeout(finishBoot, 2600);

  /* ---------------- scroll shell ---------------- */
  const hdr = $('#hdr'), progress = $('#progress'), totop = $('#totop'), arc = $('#totopArc');
  const navLinks = $$('#nav a');
  const sections = ['home', 'history', 'chronicle', 'heroes', 'factions', 'battles', 'index']
    .map((id) => document.getElementById(id)).filter(Boolean);

  function onScroll() {
    const y = window.scrollY || 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(1, y / max) : 0;
    if (hdr) hdr.classList.toggle('scrolled', y > 24);
    if (progress) progress.style.width = (pct * 100).toFixed(2) + '%';
    if (totop) totop.classList.toggle('show', y > 640);
    if (arc) arc.style.strokeDashoffset = String(138 - 138 * pct);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }

  const revealIO = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    : null;
  App.observeReveals = (root) => {
    const els = $$('.reveal:not(.in)', root || document);
    if (!revealIO) { els.forEach((el) => el.classList.add('in')); return; }
    els.forEach((el) => revealIO.observe(el));
  };

  setTimeout(() => { document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in")); }, 6000);

  /* ---------------- smooth nav ---------------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      try { history.replaceState(null, '', '#' + id); } catch (err) { /* file:// may refuse */ }
      const mm = $('#mmenu');
      if (mm && mm.classList.contains('open')) App.closeMenu();
    });
  });

  /* ---------------- mobile menu ---------------- */
  const mmenu = $('#mmenu');
  App.openMenu = () => {
    if (!mmenu) return;
    mmenu.classList.add('open'); mmenu.setAttribute('aria-hidden', 'false');
    $('#btnMenu').setAttribute('aria-expanded', 'true');
    document.body.classList.add('locked');
  };
  App.closeMenu = () => {
    if (!mmenu) return;
    mmenu.classList.remove('open'); mmenu.setAttribute('aria-hidden', 'true');
    const b = $('#btnMenu'); if (b) b.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('locked');
  };
  const bm = $('#btnMenu'), bmc = $('#btnMenuClose');
  if (bm) bm.addEventListener('click', App.openMenu);
  if (bmc) bmc.addEventListener('click', App.closeMenu);

  /* ---------------- count up ---------------- */
  App.countUp = (el, target, dur) => {
    if (!el) return;
    const start = performance.now();
    const d = dur || 1400;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = String(target); return; }
    const step = (now) => {
      const p = Math.min(1, (now - start) / d);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
})();
