// UI 层：左栏车型、右栏参数/配置/灯光、底部视角与环境、顶栏模式与帮助。
// 只负责渲染与事件转发，状态与 3D 都在 app.js。
import {
  BRANDS,
  PAINTS,
  FINISHES,
  CALIPERS,
  RIMS,
  INTERIORS,
  SCENES,
  VIEWS,
  LIGHTS,
  PARTS,
  QUALITY
} from './data.config.js';
import { CARS } from './data.car.js';
import { el, luma, isValidHex, hexToRgb, rgbToHex } from './util.js';

const FAV_KEY = 'supercar:favs';
const TABS = [
  { id: 'spec', cn: '参数', en: 'SPEC' },
  { id: 'config', cn: '配置', en: 'CUSTOMIZE' },
  { id: 'lights', cn: '灯光', en: 'LIGHTS' }
];

export class UI {
  constructor(app) {
    this.app = app;
    this.tab = 'spec';
    this.partId = null;
    this.favs = new Set(this.loadFavs());
    this.filter = '';
    this.lastFocus = null;
    this.mode = 'exterior';
  }

  loadFavs() {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveFavs() {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify([...this.favs]));
    } catch {
      /* 隐私模式忽略 */
    }
  }

  mount() {
    this.buildRail();
    this.buildDock();
    this.buildPanel();
    this.bindGlobal();
    this.render();
  }

  // ---------- 左栏 ----------

  buildRail() {
    const rail = document.getElementById('rail');
    rail.innerHTML = '';
    rail.append(
      el('div', { class: 'rail__head' }, [
        el('span', { class: 'rail__cap', text: 'COLLECTION' }),
        el('span', { class: 'rail__count', id: 'carCount' })
      ]),
      el('div', { class: 'rail__search' }, [
        el('input', {
          id: 'searchCars',
          type: 'search',
          placeholder: '搜索车型 / 品牌',
          'aria-label': '搜索车型',
          autocomplete: 'off'
        })
      ]),
      el('div', { class: 'rail__brands', id: 'brandList' }),
      el('div', { class: 'rail__list', id: 'carList' }),
      el('div', { class: 'rail__favs', id: 'favList' }),
      el('div', { class: 'rail__foot' }, [
        el('p', {
          text: '模型出自 three.js 官方示例 webgl_materials_car（作者 vicent091036，Sketchfab）。车身是一整片钣金，车门与引擎盖无法单独开合；仅作个人学习与非商业展示。'
        })
      ])
    );
  }

  renderRail() {
    const q = this.filter.trim().toLowerCase();
    const list = CARS.filter((c) => {
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.brand.toLowerCase().includes(q) ||
        (c.brandCn || '').includes(q) ||
        (c.tagline || '').toLowerCase().includes(q)
      );
    });

    const count = document.getElementById('carCount');
    if (count) count.textContent = `${CARS.filter((c) => !c.info).length} 款 · ${BRANDS.length} 品牌`;

    const brands = document.getElementById('brandList');
    if (brands) {
      brands.innerHTML = '';
      for (const b of BRANDS) {
        const n = CARS.filter((c) => c.brandId === b.id && !c.info).length;
        brands.append(
          el('div', { class: 'brand-row' }, [
            el('span', { class: 'brand-row__mark', text: b.mark }),
            el('span', { class: 'brand-row__name', text: b.cn }),
            el('span', { class: 'brand-row__n', text: String(n).padStart(2, '0') })
          ])
        );
      }
    }

    const box = document.getElementById('carList');
    if (!box) return;
    box.innerHTML = '';
    if (!list.length) {
      box.append(el('p', { class: 'rail__empty', text: '没有匹配的车型' }));
    }
    for (const car of list) {
      const active = this.app.state.car === car.id;
      const fav = this.favs.has(car.id);
      const row = el(
        'button',
        {
          class: `car-row${active ? ' is-on' : ''}${car.info ? ' car-row--info' : ''}`,
          type: 'button',
          dataset: { car: car.id },
          'aria-pressed': active ? 'true' : 'false'
        },
        [
          el('span', { class: 'car-row__idx', text: car.info ? '+' : String(CARS.indexOf(car) + 1).padStart(2, '0') }),
          el('span', { class: 'car-row__body' }, [
            el('span', { class: 'car-row__name', text: car.name }),
            el('span', { class: 'car-row__brand', text: car.info ? '说明' : `${car.brandCn} · ${car.tagline || car.brand}` })
          ]),
          el(
            'span',
            {
              class: `car-row__fav${fav ? ' is-on' : ''}`,
              role: 'button',
              tabindex: '0',
              'aria-label': fav ? '取消收藏' : '收藏',
              dataset: { fav: car.id }
            },
            ['★']
          )
        ]
      );
      row.addEventListener('click', (e) => {
        if (e.target.closest('[data-fav]')) {
          e.stopPropagation();
          this.toggleFav(car.id);
          return;
        }
        this.app.selectCar(car.id);
      });
      row.addEventListener('keydown', (e) => {
        if (e.target.matches('[data-fav]') && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          this.toggleFav(car.id);
        }
      });
      box.append(row);
    }

    const favBox = document.getElementById('favList');
    if (favBox) {
      favBox.innerHTML = '';
      const favCars = CARS.filter((c) => this.favs.has(c.id));
      if (favCars.length) {
        favBox.append(el('div', { class: 'rail__cap', text: `FAVORITES · ${favCars.length}` }));
        for (const car of favCars) {
          favBox.append(
            el('button', { class: 'fav-row', type: 'button', dataset: { car: car.id } }, [
              el('span', { text: '★' }),
              el('span', { text: `${car.brand} ${car.name}` })
            ])
          );
        }
      }
    }
  }

  toggleFav(id) {
    if (this.favs.has(id)) this.favs.delete(id);
    else this.favs.add(id);
    this.saveFavs();
    this.renderRail();
    this.toast(this.favs.has(id) ? '已加入收藏' : '已取消收藏');
  }

  // ---------- 底部 dock ----------

  buildDock() {
    const dock = document.getElementById('dock');
    dock.innerHTML = '';

    const views = el('div', { class: 'dock__group dock__group--views', id: 'viewList' });
    for (const v of VIEWS) {
      views.append(
        el('button', {
          type: 'button',
          class: 'chip',
          dataset: { view: v.id },
          'aria-pressed': 'false',
          text: v.cn
        })
      );
    }

    const scenes = el('div', { class: 'dock__group dock__group--scenes', id: 'sceneList' });
    scenes.append(el('span', { class: 'dock__label', text: '环境' }));
    for (const s of SCENES) {
      scenes.append(
        el('button', {
          type: 'button',
          class: 'chip chip--scene',
          dataset: { scene: s.id },
          'aria-pressed': 'false',
          title: s.note,
          text: s.cn
        })
      );
    }

    const actions = el('div', { class: 'dock__group dock__group--actions' }, [
      el('button', { type: 'button', class: 'btn btn--accent', id: 'btnCockpit' }, [
        el('span', { class: 'btn__icon', text: '◉' }),
        el('span', { text: '进入驾驶舱' })
      ]),
      el('button', { type: 'button', class: 'btn', id: 'btnResetView' }, [
        el('span', { class: 'btn__icon', text: '⤢' }),
        el('span', { text: '复位视角' })
      ])
    ]);

    dock.append(views, scenes, actions);
    this.viewsBox = views;
    this.scenesBox = scenes;

    dock.addEventListener('click', (e) => {
      const viewBtn = e.target.closest('[data-view]');
      if (viewBtn) {
        this.app.setView(viewBtn.dataset.view);
        return;
      }
      const sceneBtn = e.target.closest('[data-scene]');
      if (sceneBtn) this.app.setScene(sceneBtn.dataset.scene);
    });
  }

  // ---------- 右栏 ----------

  buildPanel() {
    const panel = document.getElementById('panel');
    panel.innerHTML = '';
    const tabs = el('div', { class: 'panel__tabs', role: 'tablist', 'aria-label': '面板内容' });
    for (const t of TABS) {
      tabs.append(
        el('button', {
          type: 'button',
          role: 'tab',
          class: 'panel__tab',
          dataset: { tab: t.id },
          'aria-selected': 'false',
          text: t.cn
        })
      );
    }
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]');
      if (b) this.setTab(b.dataset.tab);
    });

    panel.append(
      el('div', { class: 'panel__head' }, [
        tabs,
        el('button', { type: 'button', class: 'icon-btn', id: 'btnPanelClose', 'aria-label': '收起面板', text: '›' })
      ]),
      el('div', { class: 'panel__body', id: 'panelBody', tabindex: '-1' })
    );
  }

  setTab(id) {
    this.tab = id;
    this.renderPanel();
    this.syncTabs();
  }

  syncTabs() {
    for (const b of document.querySelectorAll('[data-tab]')) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  renderPanel() {
    const body = document.getElementById('panelBody');
    if (!body) return;
    const scroll = body.scrollTop;
    body.innerHTML = '';
    if (this.tab === 'spec') body.append(this.specPanel());
    else if (this.tab === 'config') body.append(this.configPanel());
    else body.append(this.lightsPanel());
    body.scrollTop = scroll;
    this.syncTabs();
  }

  partCard() {
    if (!this.partId) return null;
    const part = PARTS.find((p) => p.id === this.partId);
    if (!part) return null;
    return el('section', { class: 'pcard' }, [
      el('div', { class: 'pcard__head' }, [
        el('div', {}, [
          el('span', { class: 'pcard__cap', text: 'FOCUS · ' + part.en.toUpperCase() }),
          el('h3', { text: part.cn })
        ]),
        el('button', { type: 'button', class: 'icon-btn', id: 'btnPartClose', 'aria-label': '关闭部件信息', text: '×' })
      ]),
      el('p', { class: 'pcard__desc', text: part.desc }),
      el('p', { class: 'pcard__note', text: '提示：这是按材质聚合的分组，不是独立零件。' })
    ]);
  }

  specPanel() {
    const car = this.app.currentCar();
    const wrap = el('div', { class: 'panel__section' });
    const card = this.partCard();
    if (card) wrap.append(card);

    wrap.append(
      el('div', { class: 'spec-head' }, [
        el('span', { class: 'spec-head__brand', text: car.brand.toUpperCase() }),
        el('h2', { class: 'spec-head__name', text: car.name }),
        el('p', { class: 'spec-head__tag', text: car.tagline || '' })
      ])
    );

    if (car.info) {
      wrap.append(el('p', { class: 'panel__p', html: car.info }));
      return wrap;
    }

    const table = el('dl', { class: 'spec' });
    for (const s of car.specs) {
      table.append(
        el('div', { class: 'spec__row' }, [
          el('dt', { text: s.label }),
          el('dd', {}, [
            el('span', { class: 'spec__value', text: s.value }),
            s.note ? el('span', { class: 'spec__note', text: s.note }) : null
          ])
        ])
      );
    }
    wrap.append(table);

    wrap.append(
      el('section', { class: 'note-card' }, [
        el('h4', { text: '关于这辆车' }),
        el('p', { text: car.model.note }),
        el('ul', { class: 'note-list' }, [
          el('li', { text: `模型：${car.model.source}` }),
          el('li', { text: '可操作：4 组车轮 + 方向盘组；其余为单片钣金' }),
          el('li', { text: '仪表与中控屏为程序化补建，非原厂网格' })
        ])
      ])
    );

    wrap.append(
      el('section', { class: 'note-card note-card--dim' }, [
        el('h4', { text: '数据口径' }),
        el('p', { text: '参数逐条来自 research/SOURCES.md 记录的公开资料；未能核实的项标注「未核实」，不做推测。' })
      ])
    );
    return wrap;
  }

  configPanel() {
    const st = this.app.state;
    const wrap = el('div', { class: 'panel__section' });

    // 车漆
    const paintGrid = el('div', { class: 'swatches' });
    for (const p of PAINTS) {
      const on = st.paint === p.id;
      paintGrid.append(
        el('button', {
          type: 'button',
          class: `swatch${on ? ' is-on' : ''}${p.custom ? ' swatch--custom' : ''}`,
          dataset: { paint: p.id },
          'aria-pressed': on ? 'true' : 'false',
          title: p.cn,
          style: p.custom ? '' : `--sw:${p.hex}`
        }, [el('span', { class: 'swatch__dot' }), el('span', { class: 'swatch__name', text: p.custom ? '自定义' : p.en })])
      );
    }
    wrap.append(
      el('section', { class: 'cfg' }, [
        el('h3', { class: 'cfg__title', text: '车身色' }),
        paintGrid,
        el('div', { class: 'custom-row' }, [
          el('label', { class: 'custom-row__label', for: 'colorInput', text: 'HEX' }),
          el('input', { id: 'colorInput', class: 'input', type: 'text', value: st.custom, maxlength: '7', spellcheck: 'false', 'aria-label': '自定义十六进制颜色' }),
          el('input', { id: 'colorPick', class: 'color-dot', type: 'color', value: st.custom, 'aria-label': '取色器' })
        ]),
        this.rgbSliders(st)
      ])
    );

    // 材质档
    const finishRow = el('div', { class: 'chips' });
    for (const f of FINISHES) {
      finishRow.append(
        el('button', {
          type: 'button',
          class: `chip${st.finish === f.id ? ' is-on' : ''}`,
          dataset: { finish: f.id },
          'aria-pressed': st.finish === f.id ? 'true' : 'false',
          text: f.cn
        })
      );
    }
    wrap.append(el('section', { class: 'cfg' }, [el('h3', { class: 'cfg__title', text: '漆面工艺' }), finishRow]));

    // 卡钳
    const calRow = el('div', { class: 'dots' });
    for (const c of CALIPERS) {
      calRow.append(
        el('button', {
          type: 'button',
          class: `dot${st.caliper === c.id ? ' is-on' : ''}`,
          dataset: { caliper: c.id },
          'aria-pressed': st.caliper === c.id ? 'true' : 'false',
          title: c.cn,
          style: `--sw:${c.hex}`,
          'aria-label': `卡钳 ${c.cn}`
        })
      );
    }
    wrap.append(
      el('section', { class: 'cfg' }, [
        el('h3', { class: 'cfg__title', text: '刹车卡钳' }),
        calRow,
        el('p', { class: 'cfg__hint', text: '卡钳材质已按节点克隆，改色不会影响轮辋与车身。' })
      ])
    );

    // 轮辋
    const rimRow = el('div', { class: 'dots' });
    for (const r of RIMS) {
      rimRow.append(
        el('button', {
          type: 'button',
          class: `dot${st.rim === r.id ? ' is-on' : ''}`,
          dataset: { rim: r.id },
          'aria-pressed': st.rim === r.id ? 'true' : 'false',
          title: r.cn,
          style: `--sw:${r.hex}`,
          'aria-label': `轮辋 ${r.cn}`
        })
      );
    }
    wrap.append(
      el('section', { class: 'cfg' }, [
        el('h3', { class: 'cfg__title', text: '轮辋' }),
        rimRow,
        el('p', { class: 'cfg__hint', text: '模型只有一套轮毂几何，本版只改颜色与表面，不换样式。' })
      ])
    );

    // 内饰
    const intList = el('div', { class: 'list' });
    for (const i of INTERIORS) {
      intList.append(
        el(
          'button',
          {
            type: 'button',
            class: `list-row${st.interior === i.id ? ' is-on' : ''}`,
            dataset: { interior: i.id },
            'aria-pressed': st.interior === i.id ? 'true' : 'false'
          },
          [
            el('span', { class: 'list-row__swatch', style: `--a:${i.leather};--b:${i.dark};--c:${i.accent}` }),
            el('span', { class: 'list-row__body' }, [
              el('span', { class: 'list-row__name', text: i.cn }),
              el('span', { class: 'list-row__sub', text: i.en })
            ])
          ]
        )
      );
    }
    wrap.append(el('section', { class: 'cfg' }, [el('h3', { class: 'cfg__title', text: '内饰配色' }), intList]));

    // 碳纤维饰板
    wrap.append(
      el('section', { class: 'cfg cfg--row' }, [
        el('div', {}, [
          el('h3', { class: 'cfg__title', text: '碳纤维饰板' }),
          el('p', { class: 'cfg__hint', text: '中控、方向盘与门板上的饰条' })
        ]),
        el('button', {
          type: 'button',
          class: `switch${st.trim === 'carbon' ? ' is-on' : ''}`,
          id: 'trimSwitch',
          role: 'switch',
          'aria-checked': st.trim === 'carbon' ? 'true' : 'false',
          'aria-label': '碳纤维饰板开关'
        }, [el('span', { class: 'switch__knob' })])
      ])
    );

    wrap.append(
      el('section', { class: 'cfg' }, [
        el('button', { type: 'button', class: 'btn btn--wide', id: 'btnResetConfig', text: '恢复原厂配置' })
      ])
    );

    wrap.addEventListener('click', (e) => {
      const t = e.target;
      const paint = t.closest('[data-paint]');
      if (paint) return this.app.setPaint(paint.dataset.paint);
      const finish = t.closest('[data-finish]');
      if (finish) return this.app.setFinish(finish.dataset.finish);
      const cal = t.closest('[data-caliper]');
      if (cal) return this.app.setCaliper(cal.dataset.caliper);
      const rim = t.closest('[data-rim]');
      if (rim) return this.app.setRim(rim.dataset.rim);
      const int = t.closest('[data-interior]');
      if (int) return this.app.setInterior(int.dataset.interior);
      if (t.closest('#trimSwitch')) return this.app.setTrim(this.app.state.trim !== 'carbon');
      if (t.closest('#btnResetConfig')) return this.app.resetConfig();
    });

    wrap.addEventListener('input', (e) => {
      if (e.target.id === 'colorInput') {
        const v = e.target.value;
        if (isValidHex(v)) this.app.setCustomColor(v.startsWith('#') ? v : '#' + v);
      }
      if (e.target.id === 'colorPick') this.app.setCustomColor(e.target.value);
    });

    return wrap;
  }

  /** RGB 三通道滑块：与 HEX 输入框联动，拖动时只改材质不重绘面板。 */
  rgbSliders(st) {
    const [r, g, b] = hexToRgb(st.custom || '#7a5cff');
    const wrap = el('div', { class: 'rgb-row' }, [
      ['R', r],
      ['G', g],
      ['B', b]
    ].map(([ch, v]) =>
      el('label', { class: 'rgb' }, [
        el('span', { class: 'rgb__ch', text: ch }),
        el('input', {
          type: 'range',
          min: '0',
          max: '255',
          step: '1',
          value: String(v),
          class: 'rgb__range',
          dataset: { ch },
          'aria-label': `${ch} 通道`
        }),
        el('span', { class: 'rgb__val', dataset: { chv: ch }, text: String(v) })
      ])
    ));
    wrap.addEventListener('input', (e) => {
      if (!e.target.matches('[data-ch]')) return;
      const vals = [...wrap.querySelectorAll('[data-ch]')].map((i) => Number(i.value));
      const hex = rgbToHex(vals[0], vals[1], vals[2]);
      wrap.querySelectorAll('[data-chv]').forEach((node, i) => {
        node.textContent = String(vals[i]);
      });
      const hexInput = document.getElementById('colorInput');
      if (hexInput) hexInput.value = hex.toUpperCase();
      const pick = document.getElementById('colorPick');
      if (pick) pick.value = hex;
      this.app.setCustomColor(hex, { silent: true });
    });
    return wrap;
  }

  lightsPanel() {
    const st = this.app.state.lights;
    const wrap = el('div', { class: 'panel__section' });
    wrap.append(
      el('h3', { class: 'cfg__title', text: '灯组开关' }),
      el('p', { class: 'panel__p', text: '灯罩发光位置与模型灯组节点一致；近 / 远光另有两盏真实聚光灯打在地面上。' })
    );
    const list = el('div', { class: 'list' });
    for (const l of LIGHTS) {
      const on = !!st[l.id];
      list.append(
        el(
          'button',
          {
            type: 'button',
            class: `list-row list-row--light${on ? ' is-on' : ''}`,
            dataset: { light: l.id },
            role: 'switch',
            'aria-checked': on ? 'true' : 'false'
          },
          [
            el('span', { class: 'lamp-glyph', dataset: { glyph: l.id } }),
            el('span', { class: 'list-row__body' }, [
              el('span', { class: 'list-row__name', text: l.cn }),
              el('span', { class: 'list-row__sub', text: l.en })
            ]),
            el('span', { class: 'list-row__state', text: on ? 'ON' : 'OFF' })
          ]
        )
      );
    }
    wrap.append(list);
    wrap.append(
      el('div', { class: 'cfg cfg--row cfg--tight' }, [
        el('button', { type: 'button', class: 'btn btn--sm', id: 'btnLightAll', text: '全部开启' }),
        el('button', { type: 'button', class: 'btn btn--sm', id: 'btnLightNone', text: '全部关闭' })
      ])
    );
    const count = Object.values(st).filter(Boolean).length;
    wrap.append(el('p', { class: 'cfg__hint', id: 'lightCount', text: `当前点亮 ${count} / ${LIGHTS.length}` }));

    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-light]');
      if (b) return this.app.toggleLight(b.dataset.light);
      if (e.target.closest('#btnLightAll')) return this.app.allLights(true);
      if (e.target.closest('#btnLightNone')) return this.app.allLights(false);
    });
    return wrap;
  }

  // ---------- 顶栏 / 全局 ----------

  bindGlobal() {
    document.getElementById('nav')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (b) this.app.setMode(b.dataset.mode);
    });
    document.getElementById('btnSound')?.addEventListener('click', () => this.app.toggleSound());
    document.getElementById('btnHelp')?.addEventListener('click', () => this.openHelp());
    document.getElementById('btnCockpit')?.addEventListener('click', () => this.app.toggleCockpit());
    document.getElementById('btnResetView')?.addEventListener('click', () => this.app.resetView());
    document.getElementById('btnQuality')?.addEventListener('click', () => this.cycleQuality());

    document.getElementById('btnRail')?.addEventListener('click', () => this.toggleDrawer('rail'));
    document.getElementById('btnPanel')?.addEventListener('click', () => this.toggleDrawer('panel'));
    document.getElementById('btnPanelClose')?.addEventListener('click', () => this.toggleDrawer('panel', false));
    document.getElementById('btnPartClose')?.addEventListener('click', () => this.app.clearPart());

    document.getElementById('searchCars')?.addEventListener('input', (e) => {
      this.filter = e.target.value;
      this.renderRail();
    });

    document.querySelectorAll('[data-close-help]').forEach((b) => b.addEventListener('click', () => this.closeHelp()));

    document.addEventListener('keydown', (e) => this.onKey(e));

    // 面板内的部件卡片每次重渲染后重新绑定
    document.getElementById('panelBody')?.addEventListener('click', (e) => {
      if (e.target.closest('#btnPartClose')) this.app.clearPart();
    });

    this.helpReturn = null;
  }

  toggleDrawer(which, force) {
    const node = document.getElementById(which);
    if (!node) return;
    const open = force === undefined ? !node.classList.contains('is-open') : force;
    node.classList.toggle('is-open', open);
    document.body.classList.toggle(`${which}-open`, open);
  }

  onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.key === 'Escape') {
      if (this.helpEl) return this.closeHelp();
      if (this.app.rig.isCockpit) return this.app.exitCockpit();
      if (this.partId) return this.app.clearPart();
      return;
    }
    const viewIdx = '1234567'.indexOf(e.key);
    if (viewIdx >= 0 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      this.app.setView(VIEWS[viewIdx].id);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'c') this.app.toggleCockpit();
    else if (k === 'r') this.app.resetView();
    else if (k === 's') this.app.toggleSound();
    else if (k === 'l') this.app.toggleAllLights();
    else if (k === 'm') this.app.cycleScene();
    else if (k === '/') {
      e.preventDefault();
      document.getElementById('searchCars')?.focus();
    }
  }

  openHelp() {
    const modal = document.getElementById('help');
    if (!modal) return;
    this.helpReturn = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('has-modal');
    modal.querySelector('.modal__close')?.focus();
    this.helpEl = modal;
  }

  closeHelp() {
    const modal = document.getElementById('help');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('has-modal');
    this.helpEl = null;
    this.helpReturn?.focus?.();
  }

  cycleQuality() {
    const order = ['auto', 'high', 'mid', 'low'];
    const i = order.indexOf(this.app.state.quality);
    this.app.setQuality(order[(i + 1) % order.length]);
    this.toast(`画质：${this.app.state.quality === 'auto' ? '自动' : QUALITY[this.app.state.quality].cn}`);
  }

  toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('is-on'), 1800);
  }

  setPart(partId) {
    this.partId = partId;
    if (partId) this.setTab('spec');
    else this.partId = null;
    this.renderPanel();
  }

  // ---------- 同步 ----------

  render() {
    this.renderRail();
    this.renderPanel();
    this.sync();
  }

  sync() {
    const st = this.app.state;
    for (const b of document.querySelectorAll('[data-view]')) {
      const on = b.dataset.view === st.view && !this.app.rig.isCockpit;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    for (const b of document.querySelectorAll('[data-scene]')) {
      const on = b.dataset.scene === st.scene;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    for (const b of document.querySelectorAll('[data-mode]')) {
      b.classList.toggle('is-on', b.dataset.mode === this.mode);
    }
    const sound = document.getElementById('btnSound');
    if (sound) {
      sound.classList.toggle('is-on', !!st.sound);
      sound.setAttribute('aria-pressed', st.sound ? 'true' : 'false');
      sound.querySelector('.icon-btn__label')?.replaceChildren(document.createTextNode(st.sound ? '声音开' : '静音'));
    }
    const cockpitBtn = document.getElementById('btnCockpit');
    if (cockpitBtn) {
      const on = this.app.rig.isCockpit;
      cockpitBtn.classList.toggle('is-on', on);
      cockpitBtn.querySelector('span:last-child').textContent = on ? '退出驾驶舱' : '进入驾驶舱';
    }
    const q = document.getElementById('btnQuality');
    if (q) q.querySelector('.icon-btn__label').textContent = st.quality === 'auto' ? '自动' : QUALITY[st.quality].cn;

    const car = this.app.currentCar();
    const nameEl = document.getElementById('carName');
    if (nameEl) nameEl.textContent = car.name;
    const brandEl = document.getElementById('carBrand');
    if (brandEl) brandEl.textContent = `${car.brand}${car.brandCn ? ' · ' + car.brandCn : ''}`;
    const sceneEl = document.getElementById('sceneName');
    if (sceneEl) sceneEl.textContent = SCENES.find((s) => s.id === st.scene)?.en || '';

    if (this.tab === 'lights') {
      const count = Object.values(st.lights).filter(Boolean).length;
      const c = document.getElementById('lightCount');
      if (c) c.textContent = `当前点亮 ${count} / ${LIGHTS.length}`;
    }
  }
}
