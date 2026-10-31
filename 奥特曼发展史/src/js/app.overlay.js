/* ============================================================
   APP OVERLAY — dossiers, favourites, drawer, command palette
   ============================================================ */
(function () {
  'use strict';

  const App = window.App;
  const { $, $$, esc, db, state, labels, store } = App;
  const { workById, heroById, eventById, factionById, battleById, works, heroes, events, battles, factions } = db;
  const { ALIGN_LABEL, ALIGN_COLOR, ERA_BY_YEAR } = labels;
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '');

  const modal = $('#modal'), mdlScroll = $('#mdlScroll'), mdlFoot = $('#mdlFoot');
  const drawer = $('#drawer'), palette = $('#palette');
  const modalStack = [];
  let lastFocus = null;
  let current = null;

  const lock = () => {
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty('--sbw', sw + 'px');
    document.body.classList.add('locked');
  };
  const unlock = () => {
    if (!modal.classList.contains('open') && !drawer.classList.contains('open') && !palette.classList.contains('open') && !$('#mmenu').classList.contains('open')) {
      document.body.classList.remove('locked');
    }
  };

  /* ---------------- favourites & recent ---------------- */
  const key = (t, id) => t + ':' + id;
  const isFav = (t, id) => state.fav.some((x) => x.type === t && x.id === id);
  const updateFavBadge = () => {
    const b = $('#favCount');
    if (!b) return;
    b.textContent = String(state.fav.length);
    b.hidden = state.fav.length === 0;
  };
  const toggleFav = (t, id) => {
    const i = state.fav.findIndex((x) => x.type === t && x.id === id);
    if (i >= 0) { state.fav.splice(i, 1); App.toast('已从收藏中移除'); }
    else { state.fav.unshift({ type: t, id }); App.toast('已加入我的档案'); }
    store.set('ua_fav', state.fav);
    updateFavBadge();
    const btn = $('.mdl-actions [data-fav]');
    if (btn) {
      const on = isFav(btn.dataset.type, btn.dataset.id);
      btn.classList.toggle('saved', on);
      btn.querySelector('span').textContent = on ? '已收藏' : '收藏';
    }
    if (drawer.classList.contains('open')) renderDrawer(drawerTab);
  };
  const addRecent = (t, id) => {
    state.recent = state.recent.filter((x) => !(x.type === t && x.id === id));
    state.recent.unshift({ type: t, id });
    state.recent = state.recent.slice(0, 12);
    store.set('ua_recent', state.recent);
  };

  /* ---------------- entity helpers ---------------- */
  const TYPE_LABEL = { work: '作品', hero: '奥特战士', event: '宇宙事件', faction: '文明 / 势力', battle: '经典战役' };
  const getEntity = (t, id) => (t === 'work' ? workById.get(id) : t === 'hero' ? heroById.get(id) : t === 'event' ? eventById.get(id) : t === 'faction' ? factionById.get(id) : battleById.get(id));
  const entityTitle = (t, o) => (t === 'work' ? o.title : t === 'hero' ? o.name : t === 'faction' ? o.name : o.title);
  const phaseName = (id) => (DATA_PHASES.find((p) => p.id === id) || {}).name || '';

  const thumbFor = (t, o) => {
    if (t === 'hero') return App.heroImg(o) ? `<img src="${App.heroImg(o)}" alt="">` : Art.portrait(o);
    if (t === 'work') { const h = o._heroes && o._heroes[0]; return App.heroImg(h) ? `<img src="${App.heroImg(h)}" alt="">` : App.heroArtFor(o); }
    if (t === 'battle') { const h = heroById.get(o.left); return App.heroImg(h) ? `<img src="${App.heroImg(h)}" alt="">` : Art.versus(h || null, o.right ? heroById.get(o.right) : null, o); }
    if (t === 'faction') return Art.emblem(o);
    const w = o._works && o._works[0];
    const h = w && w._heroes && w._heroes[0];
    return App.heroImg(h) ? `<img src="${App.heroImg(h)}" alt="">` : (w ? App.heroArtFor(w) : Art.emblem({ align: 'neutral', emblem: 'diamond' }));
  };

  /* ---------------- modal builders ---------------- */
  const tag = (text, cls) => `<span class="tag ${cls || ''}">${esc(text)}</span>`;
  const chips = (items) => `<div class="mdl-related">${items.join('')}</div>`;
  const relBtn = (t, o, label, meta) => `<button data-open="${t}" data-id="${esc(o.id)}">${esc(label || entityTitle(t, o))}${meta ? `<i>${esc(meta)}</i>` : ''}</button>`;
  const rows = (pairs) => `<dl class="mdl-meta">${pairs.filter(Boolean).map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const photoArt = (hero, year) => {
    const src = App.heroImg(hero);
    if (!src) return null;
    return { html: `<span class="mh-year">${esc(year || '')}</span><img class="mh-photo" src="${src}" alt="${esc(hero.name)}">`, photo: true };
  };

  function heroChips(list) {
    return list.map((h) => relBtn('hero', h, h.name, h.en));
  }
  function workChips(list) {
    return list.map((w) => relBtn('work', w, w.title, w.year));
  }

  function buildWork(w) {
    const hero = w._heroes[0] || null;
    const d = w.detail || {};
    const btns = (w._battles || []).map((b) => relBtn('battle', b, b.title, b.year));
    const evs = (w._events || []).map((e) => relBtn('event', e, e.title, e.time));
    const related = (w._related || []).map((x) => relBtn('work', x, x.title, x.year));
    const pa = photoArt(hero, w.year);
    return {
      type: 'work', id: w.id,
      banner: pa ? pa.html : Art.banner(w, hero),
      photo: !!pa,
      kicker: [tag(w.type, w.type === '剧场版' ? 'gold' : 'blue'), tag(w.year + ' 年'), tag(phaseName(w.phase)), tag(w._era + '年代')].join(''),
      title: w.title, sub: [w.jp, w.en].filter(Boolean).join(' / '),
      body: `
        <div class="mdl-sec"><h3>档案摘要</h3><p class="lead">${esc(w.synopsis)}</p></div>
        ${d.world ? `<div class="mdl-sec"><h3>世界观设定</h3><p>${esc(d.world)}</p></div>` : ''}
        <div class="mdl-sec"><h3>系列历史地位</h3><p>${esc(w.significance)}</p></div>
        <div class="mdl-sec"><h3>创新与影响</h3><p>${esc(w.innovation)}</p></div>
        ${d.chars ? `<div class="mdl-sec"><h3>主要角色</h3><p>${esc(d.chars)}</p></div>` : ''}
        ${d.foes ? `<div class="mdl-sec"><h3>重要敌人</h3><p>${esc(d.foes)}</p></div>` : ''}
        ${d.impact ? `<div class="mdl-sec"><h3>对后续作品的影响</h3><p>${esc(d.impact)}</p></div>` : ''}
        ${btns.length ? `<div class="mdl-sec"><h3>代表性战役</h3>${chips(btns)}</div>` : ''}
        ${related.length ? `<div class="mdl-sec"><h3>关联作品</h3>${chips(related)}</div>` : ''}`,
      aside: `
        ${rows([
          ['首播 / 上映', esc(w.date)],
          ['作品类型', esc(w.type)],
          ['系列阶段', `${esc(phaseName(w.phase))} · ${esc((DATA_PHASES.find((p) => p.id === w.phase) || {}).years || '')}`],
          ['主要战士', w._heroes.length ? w._heroes.map((h) => esc(h.name)).join(' / ') : '—'],
          ['关联事件', evs.length ? `<div class="mdl-related" style="margin-top:4px">${evs.join('')}</div>` : '—'],
          ['世界观关系', esc(d.links || '—')],
          ['资料来源', '圆谷官方作品信息 / 作品本篇 / 官方设定资料']
        ])}
        <div class="mdl-quote">${esc(w.note || '本页依据圆谷官方作品信息与作品本篇整理；涉及多版本设定的部分以「世界观关系」注明。')}</div>`
    };
  }

  function buildHero(h) {
    const debut = h._debut;
    const pa = photoArt(h, h.year);
    return {
      type: 'hero', id: h.id,
      banner: pa ? pa.html : Art.banner(debut || { year: h.year, type: 'HERO' }, h),
      photo: !!pa,
      kicker: [tag(h.era + '年代', 'gold'), tag(h.uw === 'm78' ? 'M78 光之国' : '其他宇宙', 'blue'), tag(h.en)].join(''),
      title: h.name, sub: [h.jp, h.en].join(' / '),
      body: `
        <div class="mdl-sec"><h3>身份与背景</h3><p class="lead">${esc(h.identity)}</p></div>
        <div class="mdl-sec"><h3>主要能力</h3><ul class="mdl-list">${h.abilities.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="mdl-sec"><h3>代表性技能</h3><ul class="mdl-list">${h.skills.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="mdl-sec"><h3>档案补充</h3><p>${esc(h.note)}</p></div>
        ${h._battles.length ? `<div class="mdl-sec"><h3>经典战役</h3>${chips(h._battles.map((b) => relBtn('battle', b, b.title, b.year)))}</div>` : ''}
        <div class="mdl-sec"><h3>关联作品</h3>${chips(h._works.map((w) => relBtn('work', w, w.title, w.year)))}</div>
        ${h._events.length ? `<div class="mdl-sec"><h3>相关宇宙事件</h3>${chips(h._events.map((e) => relBtn('event', e, e.title, e.time)))}</div>` : ''}`,
      aside: `
        ${rows([
          ['日文名称', esc(h.jp)],
          ['首次登场', debut ? `<button class="rel-chip" data-open="work" data-id="${debut.id}" style="padding:2px 7px">${esc(debut.title)}</button>` : '—'],
          ['登场年份', `<b>${h.year}</b> 年`],
          ['所属宇宙', esc(h.universe)],
          ['人间体 / 变身者', esc(h.host)],
          ['重要伙伴', esc(h.partners.join(' / '))],
          ['主要敌人', esc(h.enemies.join(' / '))],
          ['系列阶段', esc(h.era)]
        ])}`
    };
  }

  function buildEvent(e) {
    const w = e._works[0];
    const hero = w && w._heroes[0];
    const linked = battles.filter((b) => (b.events || []).includes(e.id));
    const pa = photoArt(hero, w && w.year);
    return {
      type: 'event', id: e.id,
      banner: pa ? pa.html : Art.banner(w || { year: '—', type: 'EVENT' }, hero || null),
      photo: !!pa,
      kicker: [tag('第' + '一二三四五'[e.era - 1] + '纪元', 'gold'), tag(e.time), tag(e.certainty, e.certainty === '官方设定' ? 'gold' : 'blue')].join(''),
      title: e.title, sub: e.universe,
      body: `
        <div class="mdl-sec"><h3>事件背景</h3><p class="lead">${esc(e.bg)}</p></div>
        <div class="mdl-sec"><h3>事件经过</h3><p>${esc(e.course)}</p></div>
        <div class="mdl-sec"><h3>事件结果</h3><p>${esc(e.result)}</p></div>
        <div class="mdl-sec"><h3>对宇宙格局的影响</h3><p>${esc(e.impact)}</p></div>
        <div class="mdl-sec"><h3>后续影响</h3><p>${esc(e.after)}</p></div>
        <div class="mdl-sec"><h3>关联作品</h3>${chips(workChips(e._works))}</div>
        ${linked.length ? `<div class="mdl-sec"><h3>关联战役</h3>${chips(linked.map((b) => relBtn('battle', b, b.title, b.year)))}</div>` : ''}`,
      aside: `
        ${rows([
          ['所属纪元', `${'一二三四五'[e.era - 1]} · ${esc((DATA_ERAS.find((x) => x.id === e.era) || {}).name || '')}`],
          ['发生年代', esc(e.time)],
          ['所属宇宙', esc(e.universe)],
          ['可信度', `<span class="tag ${e.certainty === '官方设定' ? 'gold' : 'blue'}">${esc(e.certainty)}</span>`],
          ['主要人物', esc(e.figures.join(' / '))],
          ['关联作品', esc(e._works.map((x) => x.title).join(' / '))],
          ['设定依据', esc(e.source)]
        ])}
        <div class="mdl-quote">本站将「官方设定」「作品描述」「推定」严格区分。若作品未给出精确年代，此处不会补写年份。</div>`
    };
  }

  function buildFaction(f) {
    return {
      type: 'faction', id: f.id,
      banner: Art.emblemBanner(f),
      kicker: [tag(ALIGN_LABEL[f.align], f.align === 'friendly' ? 'gold' : f.align === 'hostile' ? 'red' : f.align === 'ambiguous' ? 'violet' : 'blue'), tag(f.category), tag(f.universe)].join(''),
      title: f.name, sub: f.jp,
      body: `
        <div class="mdl-sec"><h3>文明 / 组织背景</h3><p class="lead">${esc(f.desc)}</p></div>
        <div class="mdl-sec"><h3>主要目标</h3><p>${esc(f.goal)}</p></div>
        <div class="mdl-sec"><h3>与光之国的关系</h3><p>${esc(f.relation)}</p></div>
        <div class="mdl-sec"><h3>重要冲突</h3><p>${esc(f.conflicts)}</p></div>
        <div class="mdl-sec"><h3>关联作品</h3>${chips(workChips(f._works))}</div>`,
      aside: `
        ${rows([
          ['分类', esc(f.category)],
          ['立场', `<span style="color:${ALIGN_COLOR[f.align]}">${esc(ALIGN_LABEL[f.align])}</span>`],
          ['所属宇宙', esc(f.universe)],
          ['代表人物', esc(f.leaders)],
          ['当前状态', esc(f.status)],
          ['关联作品', esc(f._works.map((w) => w.title).join(' / '))]
        ])}
        <div class="mdl-quote">立场标识仅用于档案分类，不代表作品中的道德判断；同一反派在不同作品中的版本可能并非连续经历。</div>`
    };
  }

  function buildBattle(b) {
    const left = heroById.get(b.left) || b._heroes[0] || null;
    const right = b.right ? heroById.get(b.right) : null;
    const w = b._works[0];
    return {
      type: 'battle', id: b.id,
      banner: App.heroImg(left) ? `<span class="mh-year">${esc(b.year)}</span><img class="mh-photo" src="${App.heroImg(left)}" alt="${esc(left.name)}">` : Art.banner(w || { year: b.year, type: 'BATTLE' }, left),
      photo: !!App.heroImg(left),
      kicker: [tag('BATTLE ' + b.year, 'gold'), ...b._works.map((x) => tag(x.title)), tag(b.enemy, 'red')].join(''),
      title: b.title, sub: b.sub,
      body: `
        <div class="mdl-sec"><div class="mdl-plate">${Art.versus(left, right, b)}</div></div>
        <div class="mdl-sec"><h3>冲突背景</h3><p class="lead">${esc(b.bg)}</p></div>
        <div class="mdl-sec"><h3>战斗经过</h3><p>${esc(b.course)}</p></div>
        <div class="mdl-sec"><h3>战役结果</h3><p>${esc(b.result)}</p></div>
        <div class="mdl-sec"><h3>对后续剧情的影响</h3><p>${esc(b.impact)}</p></div>
        <div class="mdl-sec"><h3>策展注解</h3><div class="mdl-quote">${esc(b.quote)}</div></div>
        ${b._events.length ? `<div class="mdl-sec"><h3>相关历史事件</h3>${chips(b._events.map((e) => relBtn('event', e, e.title, e.time)))}</div>` : ''}
        <div class="mdl-sec"><h3>相关作品</h3>${chips(workChips(b._works))}</div>`,
      aside: `
        ${rows([
          ['战役年份', `<b>${b.year}</b>`],
          ['关联作品', esc(b._works.map((x) => x.title).join(' / '))],
          ['主要参战者', esc(b.participants.join(' / '))],
          ['敌对一方', esc(b.enemy)],
          ['相关战士', b._heroes.map((h) => esc(h.name)).join(' / ') || '—']
        ])}
        <div class="mdl-quote">战役过程依据作品本篇；策展注解为本站撰写，不是角色台词。</div>`
    };
  }

  function buildAbout() {
    return {
      type: 'about', id: 'about',
      banner: Art.emblemBanner({ category: 'ARCHIVE', align: 'neutral', id: 'about', emblem: 'm78' }),
      kicker: [tag('METHODOLOGY', 'gold'), tag('DATA V1.0')].join(''),
      title: '资料与图像说明', sub: 'HOW THIS ARCHIVE IS BUILT',
      body: `
        <div class="mdl-sec"><h3>三层资料口径</h3><ul class="mdl-list">
          <li><b>官方设定</b>：作品本篇或官方资料明确交代的内容，标注为「官方设定」。</li>
          <li><b>作品描述</b>：由具体剧集、电影、剧场版情节直接支持的内容。</li>
          <li><b>推定 / 待核实</b>：缺少官方依据的部分不作补写；年代不明则写「年代未明确」。</li>
        </ul></div>
        <div class="mdl-sec"><h3>现实史与虚构史分离</h3><p>「系列发展史」只记录日本首播、上映与制作背景；「宇宙编年史」只记录作品内部的虚构事件。两者在导航、数据与视觉上完全分开。</p></div>
        <div class="mdl-sec"><h3>多元宇宙处理</h3><p>M78 主宇宙、迪迦·戴拿宇宙、盖亚地球、新生代各平行世界与独立电影不视为同一连续性。跨世界共演以「平行世界 / 多元宇宙」标注，不把不同版本的反派合并为同一段经历。</p></div>
        <div class="mdl-sec"><h3>图像说明</h3><p>奥特战士全身视觉取自圆谷制作官方角色页面（m-78.jp），经本地压缩后用于本非商业粉丝档案，版权归圆谷制作所有；作品海报版式、战役版画、势力徽记与界面图形由本站以 SVG / CSS 原创绘制。全站不引用任何不存在的图片地址，所有图像均随页面本地提供。</p></div>
        <div class="mdl-sec"><h3>数据依据</h3><p>圆谷制作官方作品页与新闻稿（m-78.jp / tsuburaya-prod.com）、各作品本篇、官方出版物及公开年表。作品数量、事件数量与关联数量均由页面内实际数据动态统计。</p></div>
        <div class="mdl-sec"><h3>免责声明</h3><p>本站为非官方粉丝档案，与圆谷制作无隶属关系。「奥特曼」及相关名称的著作权归权利人所有。</p></div>`,
      aside: rows([
        ['收录作品', String(works.length) + ' 部'],
        ['宇宙事件', String(events.length) + ' 条'],
        ['奥特战士', String(heroes.length) + ' 位'],
        ['文明势力', String(factions.length) + ' 项'],
        ['经典战役', String(battles.length) + ' 场'],
        ['时间跨度', '1966 — 2026']
      ])
    };
  }

  const BUILDERS = { work: buildWork, hero: buildHero, event: buildEvent, faction: buildFaction, battle: buildBattle, about: buildAbout };

  /* ---------------- modal core ---------------- */
  function renderModal(data) {
    mdlScroll.innerHTML = `
      <div class="mdl-hero${data.photo ? ' photo' : ''}">
        <div class="art">${data.banner}</div>
        <div class="ttl">
          <div class="kicker">${data.kicker}</div>
          <h2 id="mdlTitle">${esc(data.title)}</h2>
          <div class="sub">${esc(data.sub || '')}</div>
        </div>
      </div>
      <div class="mdl-body">
        <div class="mdl-main">${data.body}</div>
        <aside class="mdl-aside">${data.aside || ''}</aside>
      </div>`;
    const src = data.type === 'work'
      ? `ARCHIVE / ${esc(data.id)} · 资料依据：圆谷官方作品信息与作品本篇`
      : data.type === 'hero'
        ? `DOSSIER / ${esc(data.id)} · 角色视觉 © 圆谷制作 · 非商业档案使用`
        : data.type === 'event'
          ? `EVENT / ${esc(data.id)} · 事件依据作品本篇，年代未明者不作补写`
          : data.type === 'faction'
            ? `FACTION / ${esc(data.id)} · 立场分类仅为档案标注`
            : data.type === 'battle'
              ? `BATTLE / ${esc(data.id)} · 战役依据作品本篇，注解为本站策展文字`
              : 'METHODOLOGY · 见「资料与图像说明」';
    const favable = data.type !== 'about';
    mdlFoot.innerHTML = `
      <div class="src">${src}${modalStack.length ? ' · 可继续点击关联条目跳转' : ''}</div>
      <div class="mdl-actions">
        ${modalStack.length ? `<button data-back="1" aria-label="返回上一份档案">← 返回</button>` : ''}
        ${favable ? `<button data-fav="1" data-type="${data.type}" data-id="${esc(data.id)}" class="${isFav(data.type, data.id) ? 'saved' : ''}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6 14.6 9l5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.8 9.4 9Z"/></svg>
          <span>${isFav(data.type, data.id) ? '已收藏' : '收藏'}</span></button>` : ''}
        ${favable ? `<button data-relgo="1" data-type="${data.type}" data-id="${esc(data.id)}">关系索引</button>` : ''}
      </div>`;
    mdlScroll.scrollTop = 0;
  }

  function openEntity(type, id, opts) {
    opts = opts || {};
    let data;
    if (type === 'about') data = buildAbout();
    else {
      const obj = getEntity(type, id);
      if (!obj) return;
      data = (BUILDERS[type] || buildWork)(obj);
    }
    if (!modal.classList.contains('open')) {
      lastFocus = document.activeElement;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      lock();
    } else if (current && !opts.back) {
      modalStack.push(current);
      if (modalStack.length > 12) modalStack.shift();
    }
    current = { type, id };
    renderModal(data);
    if (type !== 'about') addRecent(type, id);
    if (!opts.silent) {
      const close = $('.mdl-close', modal);
      if (close) setTimeout(() => close.focus({ preventScroll: true }), 60);
    }
  }

  function closeModal() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    modalStack.length = 0;
    current = null;
    unlock();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  function modalBack() {
    const prev = modalStack.pop();
    if (!prev) return;
    openEntity(prev.type, prev.id, { back: true, silent: true });
  }

  /* ---------------- drawer ---------------- */
  let drawerTab = 'fav';
  function renderDrawer(tab) {
    drawerTab = tab;
    $$('#drawerTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    const body = $('#drawerBody');
    const list = tab === 'fav' ? state.fav : state.recent;
    if (!list.length) {
      body.innerHTML = `<div class="drawer-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v14H4zM8 7V4h8v3"/></svg>
        <b>${tab === 'fav' ? '还没有收藏任何档案' : '还没有浏览记录'}</b>
        <span>${tab === 'fav' ? '在任意作品、战士、事件或战役详情中点击「收藏」。' : '打开任意档案后，这里会自动记录你的探索路径。'}</span>
      </div>`;
    } else {
      body.innerHTML = list.map((it) => {
        const obj = getEntity(it.type, it.id);
        if (!obj) return '';
        const title = entityTitle(it.type, obj);
        const meta = it.type === 'work' ? `${obj.year} · ${obj.type}` : it.type === 'hero' ? `${obj.year} · ${obj.era}` : it.type === 'event' ? obj.time : it.type === 'battle' ? obj.year : obj.category;
        return `<div class="d-item" style="cursor:pointer">
          <span class="th" data-open="${it.type}" data-id="${esc(it.id)}">${thumbFor(it.type, obj)}</span>
          <span class="tx" data-open="${it.type}" data-id="${esc(it.id)}"><b>${esc(title)}</b><span>${esc(TYPE_LABEL[it.type] || '')} · ${esc(meta)}</span></span>
          ${tab === 'fav' ? `<button class="rm" data-rmfav="${it.type}:${esc(it.id)}" aria-label="移除收藏"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 5 14 14M19 5 5 19"/></svg></button>` : ''}
        </div>`;
      }).join('');
    }
    const stat = $('#drawerStat');
    if (stat) stat.textContent = list.length + ' ITEMS';
  }
  function openDrawer(tab) {
    renderDrawer(tab || 'fav');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    lock();
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    unlock();
  }

  /* ---------------- palette ---------------- */
  const P_ICON = { work: 'WK', hero: 'HR', event: 'EV', battle: 'BT', faction: 'FC' };
  const paletteIndex = []
    .concat(works.map((w) => ({ type: 'work', id: w.id, label: w.title, sub: [w.jp, w.en].join(' · '), meta: String(w.year) })))
    .concat(heroes.map((h) => ({ type: 'hero', id: h.id, label: h.name, sub: h.en + ' · ' + h.universe, meta: String(h.year) })))
    .concat(events.map((e) => ({ type: 'event', id: e.id, label: e.title, sub: e.time + ' · ' + e.universe, meta: 'EV' })))
    .concat(battles.map((b) => ({ type: 'battle', id: b.id, label: b.title, sub: b.sub + ' · ' + b.enemy, meta: String(b.year) })))
    .concat(factions.map((f) => ({ type: 'faction', id: f.id, label: f.name, sub: f.category + ' · ' + f.universe, meta: 'FC' })));

  let palResults = [], palSel = 0;

  function paletteRender(q) {
    const box = $('#paletteRes');
    const query = norm(q);
    let list;
    if (!query) {
      const rec = state.recent.slice(0, 6).map((x) => paletteIndex.find((p) => p.type === x.type && p.id === x.id)).filter(Boolean);
      list = rec.length ? rec : paletteIndex.filter((p) => ['ultraman', 'tiga', 'zero', 'teo', 'e-super-ancient', 'b-gatanothor'].includes(p.id));
    } else {
      list = paletteIndex.map((p) => {
        const label = norm(p.label), sub = norm(p.sub), id = norm(p.id);
        let score = 0;
        if (label === query) score = 6;
        else if (label.startsWith(query)) score = 5;
        else if (label.includes(query)) score = 4;
        else if (sub.includes(query)) score = 2;
        else if (id.includes(query)) score = 1;
        return { p, score };
      }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 24).map((x) => x.p);
    }
    palResults = list;
    palSel = Math.min(palSel, Math.max(0, list.length - 1));
    if (!list.length) {
      box.innerHTML = `<div class="palette-empty">没有找到「${esc(q)}」。试试作品名、奥特曼名、事件名或年份。</div>`;
      return;
    }
    const groups = {};
    list.forEach((p, i) => { (groups[p.type] = groups[p.type] || []).push({ p, i }); });
    box.innerHTML = Object.keys(groups).map((t) =>
      `<div class="pgroup"><h5>${TYPE_LABEL[t]} · ${groups[t].length}</h5>${groups[t].map(({ p, i }) =>
        `<button class="pitem ${i === palSel ? 'sel' : ''}" data-pal="${i}">
          <span class="ic">${P_ICON[t]}</span>
          <span class="tx"><b>${esc(p.label)}</b><span>${esc(p.sub)}</span></span>
          <span class="yr">${esc(p.meta)}</span>
        </button>`).join('')}</div>`
    ).join('');
    const sel = $('.pitem.sel', box);
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    palette.classList.add('open');
    palette.setAttribute('aria-hidden', 'false');
    lock();
    const inp = $('#paletteInput');
    inp.value = '';
    palSel = 0;
    paletteRender('');
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  }
  function closePalette() {
    palette.classList.remove('open');
    palette.setAttribute('aria-hidden', 'true');
    unlock();
  }

  /* ---------------- wiring ---------------- */
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) {
      e.preventDefault();
      openEntity(open.dataset.open, open.dataset.id);
      return;
    }
    if (e.target.closest('[data-close]')) { closeModal(); return; }
    if (e.target.closest('[data-dclose]')) { closeDrawer(); return; }
    if (e.target.closest('[data-pclose]')) { closePalette(); return; }
    const fav = e.target.closest('[data-fav]');
    if (fav) { toggleFav(fav.dataset.type, fav.dataset.id); return; }
    const back = e.target.closest('[data-back]');
    if (back) { modalBack(); return; }
    const relgo = e.target.closest('[data-relgo]');
    if (relgo) {
      const t = relgo.dataset.type, id = relgo.dataset.id;
      closeModal();
      state.relTab = t === 'about' ? 'work' : t;
      state.relId = id;
      if (App.views && App.views.renderRelationList) {
        App.views.renderRelationList();
        App.views.renderRelationPanel();
      }
      const sec = $('#index');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const rm = e.target.closest('[data-rmfav]');
    if (rm) {
      const [t, id] = rm.dataset.rmfav.split(':');
      toggleFav(t, id);
      return;
    }
    const pal = e.target.closest('[data-pal]');
    if (pal) {
      const p = palResults[Number(pal.dataset.pal)];
      if (p) { closePalette(); openEntity(p.type, p.id); }
      return;
    }
    const drawerTabBtn = e.target.closest('#drawerTabs button');
    if (drawerTabBtn) { renderDrawer(drawerTabBtn.dataset.tab); return; }
    const about = e.target.closest('[data-about]');
    if (about) { openEntity('about', 'about'); return; }
    const rand = e.target.closest('[data-random]');
    if (rand) { App.openRandomEvent(); return; }
    if (e.target.closest('#btnSearch')) { openPalette(); return; }
    if (e.target.closest('#btnDrawer') || e.target.closest('#btnDrawer2')) { openDrawer('fav'); return; }
    if (e.target.closest('#btnTop') || e.target.closest('#totop')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (e.target.closest('#btnRandomEvent')) { App.openRandomEvent(); return; }
    // backdrop clicks on modal
    if (modal.classList.contains('open') && e.target.classList.contains('mdl') === false && e.target === modal) closeModal();
  });

  // keyboard activation for role=button cards
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('[role="button"][data-open]');
      if (card && e.target === card) {
        e.preventDefault();
        openEntity(card.dataset.open, card.dataset.id);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 'k' || k === 'K')) {
      e.preventDefault();
      palette.classList.contains('open') ? closePalette() : openPalette();
      return;
    }
    if (k === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      e.preventDefault(); openPalette(); return;
    }
    if (k === 'Escape') {
      if (palette.classList.contains('open')) { closePalette(); return; }
      if (drawer.classList.contains('open')) { closeDrawer(); return; }
      if ($('#mmenu').classList.contains('open')) { App.closeMenu(); return; }
      if (modal.classList.contains('open')) { closeModal(); return; }
    }
    if (palette.classList.contains('open')) {
      if (k === 'ArrowDown' || k === 'ArrowUp') {
        e.preventDefault();
        if (!palResults.length) return;
        palSel = (palSel + (k === 'ArrowDown' ? 1 : -1) + palResults.length) % palResults.length;
        paletteRender($('#paletteInput').value);
      } else if (k === 'Enter') {
        e.preventDefault();
        const p = palResults[palSel];
        if (p) { closePalette(); openEntity(p.type, p.id); }
      }
      return;
    }
    // focus trap in modal
    if (k === 'Tab' && modal.classList.contains('open')) {
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  const pin = $('#paletteInput');
  if (pin) {
    pin.addEventListener('input', () => { palSel = 0; paletteRender(pin.value); });
  }

  App.openEntity = openEntity;
  App.closeModal = closeModal;
  App.openRandomEvent = () => {
    const pool = events.slice();
    const pick = pool[Math.floor(Math.random() * pool.length)];
    openEntity('event', pick.id);
  };
  App.openEntity = openEntity;
  App.openAbout = () => openEntity('about', 'about');

  /* ---------------- init ---------------- */
  App.views.init();
  App.observeReveals(document);
  updateFavBadge();

  // make sure hidden filters don't block reveal animations
  document.querySelectorAll('.reveal').forEach((el) => {
    setTimeout(() => { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in'); }, 700);
  });

  window.addEventListener('resize', () => { if (palette.classList.contains('open')) paletteRender($('#paletteInput').value); });
})();
