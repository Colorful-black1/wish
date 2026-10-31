/* ============================================================
   ART — original vector artwork for the archive
   Every portrait / poster / emblem is generated here.
   No external image requests, no copyrighted stills.
   ============================================================ */
(function () {
  'use strict';

  let UID = 0;
  const uid = () => 'a' + (++UID).toString(36);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const HEAD = 'M200 46c42 0 72 32 78 84 3 34-4 62-18 86-14 26-34 44-60 44s-46-18-60-44c-14-24-21-52-18-86 6-52 36-84 78-84Z';
  const HEAD_SLIM = 'M200 120c28 0 49 20 52 52 2 22-2 40-11 57-9 18-23 30-41 30s-32-12-41-30c-9-17-13-35-11-57 3-32 24-52 52-52Z';

  const CRESTS = {
    fin: (a) => `<path d="M193 130 200 96 207 130Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 98 200 128" stroke="${a.accent}" stroke-width="1.2" opacity=".8"/>`,
    crest: (a) => `<path d="M186 128c4-18 8-27 14-34 6 7 10 16 14 34Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 100v28" stroke="${a.accent}" stroke-width="1.1" opacity=".7"/>`,
    seven: (a) => `<path d="M202 132c-16-20-14-49 8-68 1 26 8 48 22 62Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.2"/>
      <path d="M208 128c-9-16-8-38 3-53" stroke="${a.accent}" stroke-width="1.4" opacity=".75" fill="none"/>
      <path d="M154 176c-8 2-14 6-16 12 6 3 14 2 20-2" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M246 176c8 2 14 6 16 12-6 3-14 2-20-2" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>`,
    ace: (a) => `<path d="M197 128 200 88 205 128Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 92v34" stroke="${a.accent}" stroke-width="1.2"/>`,
    taro: (a) => `<path d="M198 128c-5-28-12-45-22-58 18 6 30 24 34 58Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M252 166c10-6 19-6 24-1-5 8-14 12-23 10" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M148 166c-10-6-19-6-24-1 5 8 14 12 23 10" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>`,
    leo: (a) => `<path d="M176 142c-16-16-24-34-22-54 16 12 28 28 36 48Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M224 142c16-16 24-34 22-54-16 12-28 28-36 48Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M190 132c-6-10-10-20-11-30M210 132c6-10 10-20 11-30" stroke="${a.accent}" stroke-width="1.2" opacity=".65"/>`,
    tiga: (a) => `<path d="M160 160c-20-14-30-34-24-56 16 12 30 30 38 50Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M240 160c20-14 30-34 24-56-16 12-30 30-38 50Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M200 126v70" stroke="${a.line}" stroke-width="1.2" opacity=".55"/>
      <path d="M200 126 186 148 200 170 214 148Z" fill="${a.accent}" opacity=".55"/>
      <path d="M200 126 186 148 200 170 214 148Z" fill="none" stroke="${a.line}" stroke-width=".9"/>`,
    dyna: (a) => `<path d="M200 108 214 136 200 164 186 136Z" fill="${a.accent}" opacity=".75" stroke="${a.line}" stroke-width="1"/>
      <path d="M162 158c-18-14-26-32-20-52 14 12 26 28 34 48Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M238 158c18-14 26-32 20-52-14 12-26 28-34 48Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>`,
    gaia: (a) => `<path d="M168 150 200 116 232 150" fill="none" stroke="${a.silver}" stroke-width="9" stroke-linecap="round"/>
      <path d="M168 150 200 116 232 150" fill="none" stroke="${a.accent}" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      <path d="M200 116v34" stroke="${a.line}" stroke-width="1"/>`,
    agul: (a) => `<path d="M166 150c-22-10-34-28-30-50 18 8 32 24 42 44Z" fill="${a.accent}" opacity=".55" stroke="${a.line}" stroke-width="1"/>
      <path d="M234 150c22-10 34-28 30-50-18 8-32 24-42 44Z" fill="${a.accent}" opacity=".55" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 124v76" stroke="${a.accent}" stroke-width="2" opacity=".45"/>`,
    cosmos: (a) => `<path d="M200 106c15 12 21 31 14 48-8-12-13-30-14-48Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M214 154c9 4 14 12 14 21-9-2-16-8-21-16Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 110c-8 10-11 22-9 34" stroke="${a.accent}" stroke-width="1.3" fill="none" opacity=".7"/>`,
    nexus: (a) => `<path d="M200 116 176 148 200 180 224 148Z" fill="none" stroke="${a.silver}" stroke-width="3"/>
      <path d="M200 116v64M176 148h48" stroke="${a.accent}" stroke-width="1" opacity=".7"/>
      <path d="M160 156c-16-8-24-22-22-38 14 8 25 20 32 34Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>`,
    mebius: (a) => `<path d="M174 142c-16-18-20-40-12-58 14 16 24 36 28 58Z" fill="${a.gold}" opacity=".85" stroke="${a.line}" stroke-width="1"/>
      <path d="M226 142c16-18 20-40 12-58-14 16-24 36-28 58Z" fill="${a.gold}" opacity=".85" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 126v52" stroke="${a.line}" stroke-width="1.2"/>`,
    zero: (a) => `<path d="M180 136c-14-18-18-42-10-62 16 16 27 38 30 62Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M220 136c14-18 18-42 10-62-16 16-27 38-30 62Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1.1"/>
      <path d="M148 168 128 146c-3 14 3 25 14 30Z" fill="${a.gold}" opacity=".9"/>
      <path d="M252 168 272 146c3 14-3 25-14 30Z" fill="${a.gold}" opacity=".9"/>
      <path d="M200 126 188 146 200 166 212 146Z" fill="${a.accent}" opacity=".6"/>`,
    ginga: (a) => `<path d="M200 118 208 78 218 112 232 96 230 126 242 122 228 142 172 142 158 122 170 126 168 96 182 112 192 78Z" fill="${a.silver}" opacity=".9" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 84v54" stroke="${a.accent}" stroke-width="1.6"/>`,
    victory: (a) => `<path d="M158 150 200 112 242 150 224 142 200 124 176 142Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 118v56" stroke="${a.accent}" stroke-width="1.4" opacity=".7"/>`,
    x: (a) => `<path d="M168 140 232 172M232 140 168 172" stroke="${a.silver}" stroke-width="8" stroke-linecap="round"/>
      <path d="M168 140 232 172M232 140 168 172" stroke="${a.accent}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
      <path d="M200 122v22" stroke="${a.line}" stroke-width="1"/>`,
    orb: (a) => `<circle cx="200" cy="128" r="19" fill="none" stroke="${a.gold}" stroke-width="4"/>
      <circle cx="200" cy="128" r="19" fill="none" stroke="${a.accent}" stroke-width="1.2" opacity=".8"/>
      <path d="M186 148h28" stroke="${a.silver}" stroke-width="2" opacity=".7"/>`,
    geed: (a) => `<path d="M200 118 190 88 200 74 210 88Z" fill="${a.accent}" opacity=".9"/>
      <path d="M172 142c-14-14-18-32-12-48 12 12 22 28 26 44Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M228 142c14-14 18-32 12-48-12 12-22 28-26 44Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 74v44" stroke="${a.line}" stroke-width="1.4"/>`,
    taiga: (a) => `<path d="M200 118c-6-22-12-34-22-44 18 4 28 20 30 44Z" fill="${a.accent}" opacity=".85" stroke="${a.line}" stroke-width="1"/>
      <path d="M170 144c-16-18-20-38-12-56 14 14 24 34 28 54Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M230 144c16-18 20-38 12-56-14 14-24 34-28 54Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 122v48" stroke="${a.line}" stroke-width="1.1"/>`,
    z: (a) => `<path d="M200 126 160 140 186 148 172 170 200 154 228 170 214 148 240 140Z" fill="${a.silver}" opacity=".9" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 128v42" stroke="${a.accent}" stroke-width="1.3"/>`,
    trigger: (a) => `<path d="M162 156c-20-16-28-38-20-58 16 14 28 34 34 52Z" fill="${a.gold}" opacity=".9" stroke="${a.line}" stroke-width="1"/>
      <path d="M238 156c20-16 28-38 20-58-16 14-28 34-34 52Z" fill="${a.gold}" opacity=".9" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 118 188 142 200 166 212 142Z" fill="${a.accent}" opacity=".7"/>
      <path d="M200 118v48" stroke="${a.line}" stroke-width="1.1"/>`,
    decker: (a) => `<path d="M200 120c-4-24 2-44 16-58 2 24-2 44-10 58Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>
      <path d="M174 148c-14-16-18-34-12-50 12 14 22 32 26 50Z" fill="${a.accent}" opacity=".55"/>
      <path d="M200 120v52" stroke="${a.line}" stroke-width="1.2"/>`,
    blazar: (a) => `<path d="M200 122 190 82 202 96 210 68 214 104 228 92 216 126Z" fill="${a.accent}" opacity=".8" stroke="${a.line}" stroke-width="1"/>
      <path d="M166 150c-14-14-18-30-12-46 12 12 22 28 26 44Z" fill="${a.silver}" stroke="${a.line}" stroke-width="1"/>`,
    arc: (a) => `<path d="M158 150c8-34 24-52 44-56" fill="none" stroke="${a.silver}" stroke-width="8" stroke-linecap="round"/>
      <path d="M158 150c8-34 24-52 44-56" fill="none" stroke="${a.accent}" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
      <path d="M242 152c-6-28-18-44-34-50" fill="none" stroke="${a.silver}" stroke-width="5" stroke-linecap="round" opacity=".8"/>`,
    omega: (a) => `<path d="M198 128c-18-8-32-22-40-40 22 2 40 12 52 28Z" fill="${a.accent}" opacity=".92" stroke="${a.line}" stroke-width="1"/>
      <path d="M158 88c14 2 26 10 34 22" fill="none" stroke="${a.line}" stroke-width="1.2" opacity=".7"/>
      <path d="M204 128c14-4 26-2 36 6-10 8-24 10-38 4Z" fill="${a.silver}" opacity=".85" stroke="${a.line}" stroke-width="1"/>`,
    teo: (a) => `<path d="M198 126c-10-24-26-38-46-46 20-4 40 6 54 26Z" fill="${a.accent}" opacity=".8" stroke="${a.line}" stroke-width="1"/>
      <path d="M206 124c10-22 26-34 44-40-18-4-36 6-48 24Z" fill="${a.accent}" opacity=".55" stroke="${a.line}" stroke-width="1"/>
      <path d="M200 120v54" stroke="${a.line}" stroke-width="1.1"/>`
  };

  const TIMERS = {
    circle: (c, glow) => `<circle cx="200" cy="432" r="15" fill="${c}" opacity=".92"/><circle cx="200" cy="432" r="15" fill="none" stroke="${glow}" stroke-width="1.4"/><circle cx="200" cy="432" r="24" fill="${c}" opacity=".14"/>`,
    diamond: (c, glow) => `<path d="M200 414 216 432 200 450 184 432Z" fill="${c}" opacity=".92"/><path d="M200 414 216 432 200 450 184 432Z" fill="none" stroke="${glow}" stroke-width="1.3"/><circle cx="200" cy="432" r="26" fill="${c}" opacity=".1"/>`,
    hex: (c, glow) => `<path d="M200 415 215 423 215 441 200 449 185 441 185 423Z" fill="${c}" opacity=".92" stroke="${glow}" stroke-width="1.3"/><circle cx="200" cy="432" r="25" fill="${c}" opacity=".12"/>`,
    star: (c, glow) => `<path d="M200 414 206 426 220 428 210 437 213 451 200 444 187 451 190 437 180 428 194 426Z" fill="${c}" opacity=".92" stroke="${glow}" stroke-width="1"/><circle cx="200" cy="432" r="26" fill="${c}" opacity=".12"/>`,
    bar: (c, glow) => `<rect x="188" y="425" width="24" height="14" rx="3" fill="${c}" opacity=".92" stroke="${glow}" stroke-width="1.2"/><circle cx="200" cy="432" r="25" fill="${c}" opacity=".1"/>`
  };

  function bodyPattern(kind, a) {
    const c2 = a.c2, c1 = a.c1;
    switch (kind) {
      case 'stripe':
        return `<path d="M40 500c8-58 32-98 70-122l26 26c-30 30-46 62-52 96Z" fill="${c2}" opacity=".92"/>
          <path d="M360 500c-8-58-32-98-70-122l-26 26c30 30 46 62 52 96Z" fill="${c2}" opacity=".92"/>
          <path d="M128 500c2-44 8-74 18-96l20 8c-10 26-16 54-16 88Z" fill="${c2}" opacity=".5"/>`;
      case 'panel':
        return `<path d="M20 500c14-64 46-106 92-128l18 30c-34 26-56 62-64 98Z" fill="${c2}" opacity=".9"/>
          <path d="M380 500c-14-64-46-106-92-128l-18 30c34 26 56 62 64 98Z" fill="${c2}" opacity=".9"/>
          <path d="M200 352c-40 0-70 20-84 54l84 34 84-34c-14-34-44-54-84-54Z" fill="${c2}" opacity=".35"/>`;
      case 'ring':
        return `<path d="M56 440c26-44 78-72 144-72s118 28 144 72" fill="none" stroke="${c2}" stroke-width="14" opacity=".85"/>
          <path d="M92 486c22-32 62-52 108-52s86 20 108 52" fill="none" stroke="${c1}" stroke-width="8" opacity=".5"/>`;
      case 'flame':
        return `<path d="M60 500c10-46 30-80 62-104l14 22-22 26 18 6-14 30Z" fill="${c2}" opacity=".9"/>
          <path d="M340 500c-10-46-30-80-62-104l-14 22 22 26-18 6 14 30Z" fill="${c2}" opacity=".9"/>
          <path d="M168 500c4-40 14-70 32-92 18 22 28 52 32 92Z" fill="${c2}" opacity=".35"/>`;
      case 'split':
        return `<path d="M0 500V360c60 10 112 46 140 96l-10 44Z" fill="${c2}" opacity=".9"/>
          <path d="M400 500V360c-60 10-112 46-140 96l10 44Z" fill="${a.gold}" opacity=".55"/>`;
      case 'core':
        return `<path d="M200 352c-46 0-82 26-96 74l40 20 56-40 56 40 40-20c-14-48-50-74-96-74Z" fill="${c2}" opacity=".82"/>
          <path d="M200 396v104" stroke="${a.accent}" stroke-width="2" opacity=".5"/>`;
      default:
        return '';
    }
  }

  function stars(seed, w, h, n) {
    const r = rng(seed);
    let out = '';
    for (let i = 0; i < n; i++) {
      const x = (r() * w).toFixed(1), y = (r() * h).toFixed(1);
      const rad = (r() * 1.2 + .3).toFixed(2), o = (r() * .5 + .15).toFixed(2);
      out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="#dfe9ff" opacity="${o}"/>`;
    }
    return out;
  }

  function normalize(hero) {
    const c = (hero && hero.art) || {};
    return {
      h: c.h || 'classic',
      pattern: c.pattern || 'stripe',
      c1: c.c1 || '#cfdcf1',
      c2: c.c2 || '#d8323c',
      eye: c.eye || '#ffe07a',
      timer: c.timer || '#8ef2ff',
      accent: c.accent || c.c2 || '#d8323c',
      gold: c.gold || '#f0c775',
      dark: c.dark || '#0d1626',
      silver: c.silver || '#dbe6f8',
      line: c.line || 'rgba(10,20,34,.55)'
    };
  }

  /* ---------------------------------------------------------- portrait */
  function content(hero, opts) {
    opts = opts || {};
    const a = normalize(hero);
    const id = uid();
    const seed = hash((hero && hero.id) || 'x');
    const crest = (CRESTS[a.h] || CRESTS.fin)({ ...a, silver: '#c9d8ee', gold: '#f0c775', line: a.accent });
    const timer = (TIMERS[(hero && hero.art && hero.art.timerShape) || 'circle'] || TIMERS.circle)(a.timer, a.timer);
    const eyeFill = `url(#${id}e)`;
    const bg = opts.bg === false ? '' : `
      <rect width="400" height="500" fill="url(#${id}bg)"/>
      <circle cx="200" cy="206" r="196" fill="url(#${id}halo)"/>
      <g opacity=".55">
        <circle cx="200" cy="206" r="168" fill="none" stroke="rgba(180,210,255,.18)" stroke-width=".8" stroke-dasharray="2 9"/>
        <circle cx="200" cy="206" r="140" fill="none" stroke="rgba(180,210,255,.1)" stroke-width=".8"/>
        <path d="M200 22v52M200 338v40M16 206h44M340 206h44" stroke="rgba(180,210,255,.22)" stroke-width=".7"/>
      </g>
      ${stars(seed, 400, 500, 26)}
      <path d="M0 0h400L0 300Z" fill="url(#${id}sheen)" opacity=".35"/>
    `;
    const body = `
      <g>
        <path d="M-40 500c8-74 52-128 122-152l118-30 118 30c70 24 114 78 122 152Z" fill="url(#${id}suit)"/>
        <path d="M-40 500c8-74 52-128 122-152l118-30 118 30c70 24 114 78 122 152Z" fill="none" stroke="url(#${id}rim)" stroke-width="2"/>
        <g clip-path="url(#${id}clip)">
          ${bodyPattern(a.pattern, a)}
          <path d="M-40 500c8-74 52-128 122-152l118-30 118 30c70 24 114 78 122 152Z" fill="url(#${id}bodyShade)"/>
          <path d="M200 330c-34 0-58 10-72 30 20 20 44 32 72 32s52-12 72-32c-14-20-38-30-72-30Z" fill="${a.dark}" opacity=".58"/>
        </g>
        <path d="M160 232h80l14 88c-30 18-72 18-108 0Z" fill="url(#${id}suit)"/>
        <path d="M170 240h60l10 70c-24 12-52 12-80 0Z" fill="#08111f" opacity=".3"/><path d="M158 296c22 8 64 8 86 0" fill="none" stroke="rgba(220,235,255,.35)" stroke-width="2"/>
        <path d="M160 356c12-12 26-18 40-18s28 6 40 18l-8 144h-64Z" fill="${a.c1}" opacity=".18"/>
        <path d="M118 352c26-18 54-28 82-28s56 10 82 28" fill="none" stroke="rgba(255,255,255,.34)" stroke-width="2"/>
        <path d="M150 344c14 24 30 38 50 38s36-14 50-38" fill="none" stroke="rgba(8,16,28,.5)" stroke-width="1.4"/>
        <path d="M52 500c2-58 20-98 52-122l22 34-26 88Z" fill="${a.c2}" opacity=".88"/>
        <path d="M348 500c-2-58-20-98-52-122l-22 34 26 88Z" fill="${a.c2}" opacity=".88"/>
        <path d="M92 500c2-38 12-70 30-94M308 500c-2-38-12-70-30-94" fill="none" stroke="rgba(8,16,28,.4)" stroke-width="2.4"/>
        <path d="M200 346v90" stroke="rgba(10,20,34,.22)" stroke-width="1.2"/>
        <g transform="translate(0,-6)">${timer}</g>
        <rect y="462" width="400" height="38" fill="url(#${id}bfade)"/>
      </g>
    `;
    const head = `
      <ellipse cx="200" cy="262" rx="48" ry="11" fill="#03070e" opacity=".5"/>
      <path d="${HEAD}" fill="url(#${id}head)"/>
      <path d="${HEAD}" fill="url(#${id}shade)" opacity=".55"/>
      <path d="M124 152c-10 5-12 18-4 27 7 1 12-4 14-11Z" fill="url(#${id}head)" stroke="rgba(10,20,34,.3)" stroke-width="1"/>
      <path d="M276 152c10 5 12 18 4 27-7 1-12-4-14-11Z" fill="url(#${id}head)" stroke="rgba(10,20,34,.3)" stroke-width="1"/>
      <path d="M132 116c14-28 38-44 68-44s54 16 68 44" fill="none" stroke="rgba(210,230,255,.22)" stroke-width="2.4"/>
      <path d="M104 136c10-10 24-14 34-10" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.4" opacity=".7"/>
      <g>
        <ellipse cx="164" cy="168" rx="36" ry="22" fill="${a.eye}" opacity=".16"/>
        <path d="M136 154c18-14 44-8 56 20-20 12-42 10-52 0-6-6-6-14-4-20Z" fill="${eyeFill}" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
        <path d="M140 158c14-10 32-7 46 14" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
        <ellipse cx="156" cy="160" rx="5" ry="2.4" fill="#fff" opacity=".9" transform="rotate(-24 156 160)"/>
        <g transform="translate(400,0) scale(-1,1)">
          <ellipse cx="164" cy="168" rx="36" ry="22" fill="${a.eye}" opacity=".16"/>
          <path d="M136 154c18-14 44-8 56 20-20 12-42 10-52 0-6-6-6-14-4-20Z" fill="${eyeFill}" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/>
          <path d="M140 158c14-10 32-7 46 14" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
          <ellipse cx="156" cy="160" rx="5" ry="2.4" fill="#fff" opacity=".9" transform="rotate(-24 156 160)"/>
        </g>
      </g>
      <path d="M200 182v34" stroke="rgba(12,22,36,.18)" stroke-width="1.3"/>
      <path d="M186 238h28" fill="none" stroke="rgba(10,20,34,.7)" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M164 248c10 12 23 19 36 19s26-7 36-19" fill="none" stroke="rgba(150,180,220,.12)" stroke-width="3"/>
      <g transform="translate(0,-70)">${crest}</g>
      <path d="${HEAD}" fill="none" stroke="url(#${id}rim)" stroke-width="2.4" opacity=".9"/>
      <path d="${HEAD}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1" opacity=".6"/>
      <path d="M126 108c-9 38-2 78 18 106" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2.2" opacity=".4"/>
      <ellipse cx="200" cy="78" rx="50" ry="16" fill="${a.accent}" opacity=".18"/>
    `;
    const wrap = opts.mirror ? '<g transform="translate(400 0) scale(-1 1)">' : '';
    return `${wrap}<defs>
        <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07101f"/><stop offset=".55" stop-color="#050b16"/><stop offset="1" stop-color="#03070e"/></linearGradient>
        <radialGradient id="${id}halo" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="${a.accent}" stop-opacity=".30"/><stop offset=".55" stop-color="${a.accent}" stop-opacity=".06"/><stop offset="1" stop-color="${a.accent}" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fc6ff" stop-opacity=".16"/><stop offset="1" stop-color="#9fc6ff" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}suit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#334764"/><stop offset=".4" stop-color="#1a2740"/><stop offset=".8" stop-color="#0b1422"/><stop offset="1" stop-color="#04080f"/></linearGradient>
        <linearGradient id="${id}head" x1=".2" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#41587b"/><stop offset=".34" stop-color="#22324c"/><stop offset=".72" stop-color="#111c2e"/><stop offset="1" stop-color="#050a12"/></linearGradient>
        <linearGradient id="${id}shade" x1="0" y1="0" x2="1" y2=".4"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
        <linearGradient id="${id}bodyShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
        <linearGradient id="${id}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".4" stop-color="${a.accent}" stop-opacity=".8"/><stop offset="1" stop-color="${a.accent}" stop-opacity="0"/></linearGradient>
        <radialGradient id="${id}e" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#fffdf2"/><stop offset=".45" stop-color="${a.eye}"/><stop offset="1" stop-color="${a.eye}" stop-opacity=".55"/></radialGradient>
        <linearGradient id="${id}bfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050a13" stop-opacity="0"/><stop offset="1" stop-color="#03060d" stop-opacity=".92"/></linearGradient>
        <clipPath id="${id}clip"><path d="M-40 500c8-74 52-128 122-152l118-30 118 30c70 24 114 78 122 152Z"/></clipPath>
      </defs>
      ${bg}
      ${body}
      ${head}
      ${wrap ? '</g>' : ''}`;
  }

  function portrait(hero, opts) {
    opts = opts || {};
    const vb = opts.viewBox || '0 0 400 500';
    return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc((hero && hero.name) || 'Ultra hero')}">${content(hero, opts)}</svg>`;
  }

  function nested(hero, opts) {
    opts = opts || {};
    return `<svg x="${opts.x || 0}" y="${opts.y || 0}" width="${opts.w || 400}" height="${opts.h || 500}" viewBox="0 0 400 500" preserveAspectRatio="${opts.preserve || 'xMidYMid meet'}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${content(hero, { bg: opts.bg, mirror: opts.mirror })}</svg>`;
  }

  /* ---------------------------------------------------------- work poster */
  function poster(work, hero) {
    const id = uid();
    const seed = hash((work && work.id) || 'p');
    const a = normalize(hero);
    const year = esc(work && work.year ? work.year : '');
    const inner = hero ? nested(hero, { bg: false, x: 268, y: -42, w: 396, h: 495 }) : '';
    return `<svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc((work && work.title) || 'work')}">
      <defs>
        <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#081120"/><stop offset=".5" stop-color="#050b16"/><stop offset="1" stop-color="#0a0f1b"/></linearGradient>
        <radialGradient id="${id}glow" cx=".72" cy=".4" r=".6"><stop offset="0" stop-color="${a.accent}" stop-opacity=".34"/><stop offset=".55" stop-color="${a.accent}" stop-opacity=".07"/><stop offset="1" stop-color="${a.accent}" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe4ff" stop-opacity="0"/><stop offset=".5" stop-color="#cfe4ff" stop-opacity=".22"/><stop offset="1" stop-color="#cfe4ff" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#050b16" stop-opacity="0"/><stop offset="1" stop-color="#050b16" stop-opacity=".96"/></linearGradient>
        <linearGradient id="${id}left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050b16" stop-opacity=".9"/><stop offset=".55" stop-color="#050b16" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="640" height="420" fill="url(#${id}bg)"/>
      <circle cx="450" cy="200" r="300" fill="url(#${id}glow)"/>
      <g opacity=".5">
        <circle cx="450" cy="210" r="190" fill="none" stroke="rgba(180,210,255,.16)" stroke-width=".8" stroke-dasharray="3 10"/>
        <circle cx="450" cy="210" r="240" fill="none" stroke="rgba(180,210,255,.08)" stroke-width=".8"/>
      </g>
      ${stars(seed, 640, 420, 34)}
      <path d="M0 0h640L0 420Z" fill="url(#${id}beam)" opacity=".5"/>
      <text x="34" y="330" font-family="Bahnschrift, DIN Alternate, sans-serif" font-size="188" font-weight="700" fill="none" stroke="rgba(180,210,255,.15)" stroke-width="1.2" letter-spacing="-6">${year}</text>
      <g>${inner}</g>
      <rect width="640" height="420" fill="url(#${id}left)"/>
      <rect y="230" width="640" height="190" fill="url(#${id}fade)"/>
      <g opacity=".55" stroke="rgba(180,210,255,.35)" stroke-width="1">
        <path d="M24 24h34M24 24v34M616 24h-34M616 24v34"/>
      </g>
      <text x="34" y="54" font-family="Consolas, monospace" font-size="8.5" letter-spacing="3.4" fill="rgba(190,215,255,.45)">ARCHIVE · ${esc((work && work.type) || 'TV')} · ${year}</text>
    </svg>`;
  }

  /* ---------------------------------------------------------- kaiju silhouette */
  function monsterFigure(id) {
    return `<g>
      <path d="M540 560c6-112 44-194 108-236 48-32 108-34 148-2 38 30 58 80 62 138l4 100Z" fill="url(#${id}mon)"/>
      <path d="M540 560c6-112 44-194 108-236 48-32 108-34 148-2 38 30 58 80 62 138l4 100Z" fill="none" stroke="rgba(255,90,90,.22)" stroke-width="1.2"/>
      <path d="M626 300 590 236l46 26M666 250l-22-62 38 44M704 236l-8-66 28 56M742 258l14-52 8 58" fill="none" stroke="rgba(210,225,250,.35)" stroke-width="3" stroke-linejoin="round"/>
      <path d="M654 268c10-46 40-76 82-80 38-4 72 16 90 50l-18 34-44 10 14 36-46 24-56-10-26-28Z" fill="url(#${id}mon)"/>
      <path d="M654 268c10-46 40-76 82-80 38-4 72 16 90 50" fill="none" stroke="rgba(255,120,120,.35)" stroke-width="1.6"/>
      <path d="M700 300c14 8 26 10 40 8" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
      <path d="M716 306 722 322 730 306M736 310 742 326 750 310M756 308 762 322 770 306" fill="none" stroke="rgba(230,240,255,.55)" stroke-width="2"/>
      <ellipse cx="672" cy="250" rx="18" ry="10" transform="rotate(-14 672 250)" fill="url(#${id}eye)"/>
      <ellipse cx="672" cy="250" rx="7" ry="4" transform="rotate(-14 672 250)" fill="#fff6dc" opacity=".8"/>
      <path d="M604 360c-18 36-26 76-26 122M700 420c-10 42-12 84-8 140" fill="none" stroke="rgba(180,205,245,.14)" stroke-width="8"/>
      <g opacity=".5">
        <circle cx="690" cy="270" r="120" fill="none" stroke="rgba(255,77,77,.18)" stroke-width="1" stroke-dasharray="2 8"/>
      </g>
    </g>`;
  }

  /* ---------------------------------------------------------- versus poster */
  function versus(leftHero, rightHero, battle) {
    const id = uid();
    const L = normalize(leftHero), R = normalize(rightHero);
    const seed = hash((battle && battle.id) || 'v');
    const leftInner = leftHero ? nested(leftHero, { bg: false, x: 20, y: 26, w: 400, h: 500 }) : '';
    const rightInner = rightHero ? nested(rightHero, { bg: false, x: 480, y: 26, w: 400, h: 500, mirror: true }) : '';
    return `<svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc((battle && battle.title) || 'battle')}">
      <defs>
        <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0d16"/><stop offset=".5" stop-color="#04070e"/><stop offset="1" stop-color="#0d0a14"/></linearGradient>
        <radialGradient id="${id}gl" cx=".22" cy=".42" r=".55"><stop offset="0" stop-color="${L.accent}" stop-opacity=".38"/><stop offset="1" stop-color="${L.accent}" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}gr" cx=".78" cy=".42" r=".55"><stop offset="0" stop-color="${R.accent}" stop-opacity=".38"/><stop offset="1" stop-color="${R.accent}" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}slash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#eaf4ff" stop-opacity=".85"/><stop offset=".55" stop-color="#ffe9b8" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".4" stop-color="#04070e" stop-opacity="0"/><stop offset="1" stop-color="#04070e" stop-opacity=".92"/></linearGradient>
        <linearGradient id="${id}mon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141a26"/><stop offset=".5" stop-color="#0a0e16"/><stop offset="1" stop-color="#05070c"/></linearGradient>
        <radialGradient id="${id}eye" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#fff3d6"/><stop offset=".45" stop-color="#ff9a5a"/><stop offset="1" stop-color="#d02a2a" stop-opacity=".2"/></radialGradient>
      </defs>
      <rect width="900" height="560" fill="url(#${id}bg)"/>
      <rect width="470" height="560" fill="url(#${id}gl)"/>
      <rect x="430" width="470" height="560" fill="url(#${id}gr)"/>
      ${stars(seed, 900, 560, 48)}
      <g opacity=".65" stroke="rgba(190,215,255,.2)" stroke-width="1" fill="none">
        <circle cx="450" cy="280" r="210" stroke-dasharray="2 10"/>
        <circle cx="450" cy="280" r="260"/>
      </g>
      ${leftInner}
      ${rightInner || monsterFigure(id)}
      <g opacity=".9">
        <path d="M450 40 470 280 450 520 430 280Z" fill="url(#${id}slash)"/>
        <path d="M120 480 450 280 780 480" fill="none" stroke="rgba(200,225,255,.16)" stroke-width="1"/>
      </g>
      <rect y="300" width="900" height="260" fill="url(#${id}fade)"/>
    </svg>`;
  }

  /* ---------------------------------------------------------- modal banner */
  function banner(work, hero) {
    const id = uid();
    const a = normalize(hero);
    const seed = hash((work && work.id) || 'b');
    const year = esc((work && work.year) || '');
    const label = esc((work && work.type) || 'ARCHIVE');
    return `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071120"/><stop offset=".55" stop-color="#050a14"/><stop offset="1" stop-color="#0a0f1c"/></linearGradient>
        <radialGradient id="${id}g" cx=".76" cy=".4" r=".55"><stop offset="0" stop-color="${a.accent}" stop-opacity=".42"/><stop offset=".6" stop-color="${a.accent}" stop-opacity=".08"/><stop offset="1" stop-color="${a.accent}" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050a14" stop-opacity=".96"/><stop offset=".46" stop-color="#050a14" stop-opacity=".55"/><stop offset=".78" stop-color="#050a14" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#050a14" stop-opacity="0"/><stop offset="1" stop-color="#080e1a" stop-opacity=".98"/></linearGradient>
        <linearGradient id="${id}beam" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe4ff" stop-opacity="0"/><stop offset=".5" stop-color="#cfe4ff" stop-opacity=".2"/><stop offset="1" stop-color="#cfe4ff" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="1200" height="360" fill="url(#${id}bg)"/>
      <circle cx="880" cy="150" r="380" fill="url(#${id}g)"/>
      <g opacity=".4">
        <circle cx="880" cy="170" r="240" fill="none" stroke="rgba(190,215,255,.18)" stroke-width="1" stroke-dasharray="3 12"/>
        <circle cx="880" cy="170" r="300" fill="none" stroke="rgba(190,215,255,.09)" stroke-width="1"/>
      </g>
      ${stars(seed, 1200, 360, 46)}
      <path d="M0 0h1200L0 360Z" fill="url(#${id}beam)" opacity=".4"/>
      <text x="42" y="296" font-family="Bahnschrift, DIN Alternate, sans-serif" font-size="232" font-weight="700" fill="none" stroke="rgba(180,210,255,.16)" stroke-width="1.4" letter-spacing="-8">${year}</text>
      <text x="46" y="54" font-family="Consolas, monospace" font-size="11" letter-spacing="5" fill="rgba(200,220,255,.5)">ULTRA ARCHIVE / ${label}</text>
      <path d="M46 68h180" stroke="rgba(240,199,117,.55)" stroke-width="1"/>
      <g>${hero ? nested(hero, { bg: false, x: 770, y: -62, w: 430, h: 537, preserve: 'xMidYMid meet' }) : ''}</g>
      <rect width="1200" height="360" fill="url(#${id}left)"/>
      <rect y="150" width="1200" height="210" fill="url(#${id}fade)"/>
      <g opacity=".5" stroke="rgba(190,215,255,.35)" stroke-width="1" fill="none">
        <path d="M1148 30h-28M1148 30v28M1132 330h-28M1132 330v-24"/>
      </g>
    </svg>`;
  }

  function emblemBanner(faction) {
    const id = uid();
    const c = ALIGN_COLOR[(faction && faction.align) || 'neutral'] || '#7fc7ff';
    const seed = hash((faction && faction.id) || 'f');
    return `<svg viewBox="0 0 1200 360" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#081120"/><stop offset="1" stop-color="#050a14"/></linearGradient>
        <radialGradient id="${id}g" cx=".76" cy=".45" r=".5"><stop offset="0" stop-color="${c}" stop-opacity=".34"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id}left" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050a14" stop-opacity=".96"/><stop offset=".55" stop-color="#050a14" stop-opacity=".3"/><stop offset=".8" stop-color="#050a14" stop-opacity="0"/></linearGradient>
      </defs>
      <rect width="1200" height="360" fill="url(#${id}bg)"/>
      <circle cx="930" cy="180" r="340" fill="url(#${id}g)"/>
      ${stars(seed, 1200, 360, 40)}
      <g opacity=".6" fill="none" stroke="${c}" stroke-width="1">
        <circle cx="930" cy="180" r="150" stroke-dasharray="2 10"/>
        <circle cx="930" cy="180" r="190" stroke-opacity=".35"/>
        <path d="M930 20v34M930 306v34M770 180h34M1056 180h34" stroke-opacity=".4"/>
      </g>
      ${emblem(faction).replace('<svg ', '<svg x="800" y="40" width="280" height="280" ')}
      <rect width="1200" height="360" fill="url(#${id}left)"/>
      <text x="46" y="54" font-family="Consolas, monospace" font-size="11" letter-spacing="5" fill="rgba(200,220,255,.5)">FACTION ARCHIVE / ${esc((faction && faction.category) || '')}</text>
      <path d="M46 68h180" stroke="${c}" stroke-opacity=".6" stroke-width="1"/>
    </svg>`;
  }

  /* ---------------------------------------------------------- emblem */
  const ALIGN_COLOR = { friendly: '#f0c775', neutral: '#7fc7ff', hostile: '#ff5a5a', ambiguous: '#b18cff' };
  function emblem(faction) {
    const id = uid();
    const c = ALIGN_COLOR[(faction && faction.align) || 'neutral'] || '#7fc7ff';
    const kind = (faction && faction.emblem) || 'diamond';
    let motif = '';
    if (kind === 'm78') motif = `<path d="M60 30 82 60 60 90 38 60Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 44 70 60 60 76 50 60Z" fill="${c}" opacity=".8"/><path d="M60 18v10M60 92v10" stroke="${c}" stroke-width="1.4"/>`;
    else if (kind === 'eye') motif = `<path d="M28 60c10-16 22-24 32-24s22 8 32 24c-10 16-22 24-32 24s-22-8-32-24Z" fill="none" stroke="${c}" stroke-width="2"/><circle cx="60" cy="60" r="8" fill="${c}"/>`;
    else if (kind === 'fang') motif = `<path d="M32 44h56l-8 34-20-16-20 16Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M44 44v-10M60 44V28M76 44V34" stroke="${c}" stroke-width="2"/>`;
    else if (kind === 'crown') motif = `<path d="M30 74V44l14 12 16-24 16 24 14-12v30Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M38 82h44" stroke="${c}" stroke-width="2"/>`;
    else if (kind === 'spiral') motif = `<path d="M60 60c0-10 8-18 18-18s18 8 18 18-8 18-18 18-18-8-18-18" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 60c0 10-8 18-18 18S24 70 24 60s8-18 18-18" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/>`;
    else if (kind === 'shard') motif = `<path d="M60 24 76 54 60 96 44 54Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 40v40M28 60h14M78 60h14" stroke="${c}" stroke-width="1.2" opacity=".7"/>`;
    else if (kind === 'ray') motif = `<circle cx="60" cy="60" r="14" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 26v10M60 84v10M26 60h10M84 60h10M36 36l8 8M76 76l8 8M84 36l-8 8M44 76l-8 8" stroke="${c}" stroke-width="1.6"/>`;
    else if (kind === 'skull') motif = `<path d="M42 72c-8-6-12-14-12-22 0-14 13-24 30-24s30 10 30 24c0 8-4 16-12 22l-2 12H44Z" fill="none" stroke="${c}" stroke-width="2"/><circle cx="50" cy="50" r="4" fill="${c}"/><circle cx="70" cy="50" r="4" fill="${c}"/>`;
    else motif = `<path d="M60 24 88 60 60 96 32 60Z" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 40 74 60 60 80 46 60Z" fill="${c}" opacity=".55"/>`;
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="${id}g" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${c}" stop-opacity=".3"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="url(#${id}g)"/>
      <circle cx="60" cy="60" r="50" fill="none" stroke="${c}" stroke-width=".7" stroke-opacity=".45" stroke-dasharray="3 6"/>
      <path d="M60 4 66 12H54Z" fill="${c}" opacity=".7"/>
      <path d="M60 116 66 108H54Z" fill="${c}" opacity=".35"/>
      ${motif}
    </svg>`;
  }

  /* ---------------------------------------------------------- ultra Q mark */
  function qMark() {
    const id = uid();
    return `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ultra Q">
      <defs>
        <linearGradient id="${id}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1120"/><stop offset="1" stop-color="#03070e"/></linearGradient>
        <radialGradient id="${id}g" cx=".5" cy=".44" r=".5"><stop offset="0" stop-color="#8fb6e8" stop-opacity=".28"/><stop offset="1" stop-color="#8fb6e8" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#${id}bg)"/>
      <circle cx="200" cy="220" r="180" fill="url(#${id}g)"/>
      ${stars(hash('ultra-q'), 400, 500, 40)}
      <circle cx="200" cy="220" r="110" fill="none" stroke="rgba(200,220,255,.35)" stroke-width="1.4" stroke-dasharray="4 8"/>
      <text x="200" y="286" text-anchor="middle" font-family="Bahnschrift, DIN Alternate, sans-serif" font-size="220" font-weight="700" fill="none" stroke="rgba(220,235,255,.5)" stroke-width="1.6">Q</text>
      <path d="M262 300 330 380" stroke="rgba(240,199,117,.8)" stroke-width="7" stroke-linecap="round"/>
      <path d="M100 380h200" stroke="rgba(180,210,255,.2)" stroke-width="1"/>
      <text x="100" y="402" font-family="Consolas, monospace" font-size="9" letter-spacing="4" fill="rgba(190,215,255,.45)">MYSTERY · 1966</text>
    </svg>`;
  }

  window.Art = { portrait, poster, versus, emblem, qMark, banner, emblemBanner, normalize, hash };
})();
