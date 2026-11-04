/* ==========================================================================
   ui.cards.js — DOM 小工具、控件、表格、泳道图、代码块、Canvas 外壳
   这里只做渲染与交互，不写内容；文案来自 data.milvus.js。
   ========================================================================== */
(function (root) {
  'use strict';

  var UI = {};

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k === 'props' && typeof v === 'object') Object.assign(node, v);
        else if (/^on[A-Z]/.test(k) && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    append(node, children);
    return node;
  }

  function append(parent, children) {
    if (children == null) return parent;
    if (Array.isArray(children)) {
      children.forEach(function (c) { append(parent, c); });
    } else if (children instanceof Node) {
      parent.appendChild(children);
    } else {
      parent.appendChild(document.createTextNode(String(children)));
    }
    return parent;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function frag(children) {
    var f = document.createDocumentFragment();
    append(f, children);
    return f;
  }

  function num(n, digits) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('zh-CN', {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits == null ? 0 : digits
    });
  }

  function pct(x, digits) {
    if (x == null || isNaN(x)) return '—';
    return (x * 100).toFixed(digits == null ? 0 : digits) + '%';
  }

  function bytes(n) {
    if (n == null || isNaN(n)) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function ms(n) {
    if (n == null) return '—';
    return n < 1 ? (n * 1000).toFixed(0) + ' ms' : n.toFixed(2) + ' s';
  }

  function block(no, labels, children, opts) {
    opts = opts || {};
    return el('section', { class: 'blk ' + (opts.className || '') }, [
      el('header', { class: 'blk__head' }, [
        el('span', { class: 'blk__no', text: String(no).padStart(2, '0') }),
        el('h3', { class: 'blk__title', text: labels[0] }),
        el('span', { class: 'blk__en', text: labels[1] })
      ]),
      el('div', { class: 'blk__body' }, children)
    ]);
  }

  function prose(paragraphs) {
    return el('div', { class: 'prose' }, paragraphs.map(function (p) {
      return el('p', { text: p });
    }));
  }

  function badge(text, kind) {
    return el('span', { class: 'badge badge--' + (kind || 'real'), text: text });
  }

  function mark(tip) {
    return el('button', {
      type: 'button',
      class: 'mark',
      'aria-label': root.MILVUS.data.milvus.COPY.ui.markAria,
      'data-tip': tip,
      text: 'ⓘ'
    });
  }

  function note(text, opts) {
    opts = opts || {};
    return el('p', { class: 'note ' + (opts.className || '') }, [
      opts.tip ? mark(opts.tip) : null,
      el('span', { text: text })
    ]);
  }

  function callout(title, body, kind) {
    var bodyNodes = [];
    if (Array.isArray(body)) bodyNodes = body;
    else if (body instanceof Node) bodyNodes = [body];
    else if (body) bodyNodes = [el('p', { class: 'callout__body', text: body })];
    return el('div', { class: 'callout callout--' + (kind || 'ink') }, [
      title ? el('b', { class: 'callout__title', text: title }) : null
    ].concat(bodyNodes));
  }

  function stat(label, value, unit, opts) {
    opts = opts || {};
    return el('div', { class: 'stat ' + (opts.className || '') }, [
      el('span', { class: 'stat__label' }, [
        opts.tip ? mark(opts.tip) : null,
        el('span', { text: label })
      ]),
      el('span', { class: 'stat__value' }, [
        el('b', { text: value }),
        unit ? el('i', { text: unit }) : null
      ]),
      opts.note ? el('span', { class: 'stat__note', text: opts.note }) : null
    ]);
  }

  function statsGrid(items, opts) {
    opts = opts || {};
    return el('div', { class: 'stats ' + (opts.className || '') }, items.map(function (it) {
      return stat(it.label, it.value, it.unit, it);
    }));
  }

  function table(spec) {
    var head = spec.head || [];
    var rows = spec.rows || [];
    var t = el('table', { class: 'table ' + (spec.className || '') }, [
      head.length
        ? el('thead', null, el('tr', null, head.map(function (h) {
            return el('th', { scope: 'col' }, h instanceof Node ? h : el('span', { text: h }));
          })))
        : null,
      el('tbody', null, rows.map(function (row) {
        return el('tr', { class: row.className || '' }, row.cells.map(function (cell, ci) {
          var tag = ci === 0 && spec.rowHead !== false ? 'th' : 'td';
          var attrs = tag === 'th' ? { scope: 'row' } : {};
          if (cell instanceof Node) return el(tag, attrs, cell);
          return el(tag, attrs, String(cell));
        }));
      }))
    ]);
    var wrap = el('div', { class: 'tablewrap' }, t);
    if (spec.caption || spec.note) {
      return el('div', { class: 'tablebox' }, [
        spec.caption ? el('p', { class: 'tablebox__cap', text: spec.caption }) : null,
        wrap,
        spec.note ? note(spec.note) : null
      ]);
    }
    return wrap;
  }

  function control(spec) {
    var type = spec.type || 'range';
    var id = 'ctl-' + (spec.id || Math.random().toString(36).slice(2, 8));
    var labelTag = type === 'segmented' || type === 'toggle' || type === 'button' ? 'span' : 'label';
    var label = el(labelTag, { class: 'ctl__label', for: labelTag === 'label' ? id : null }, [
      spec.tip ? mark(spec.tip) : null,
      el('span', { text: spec.label })
    ]);
    var wrap = el('div', { class: 'ctl ctl--' + type + (spec.wide ? ' ctl--wide' : '') });

    if (type === 'range') {
      var out = el('output', { class: 'ctl__out', for: id });
      var input = el('input', {
        id: id,
        type: 'range',
        min: spec.min,
        max: spec.max,
        step: spec.step || 1,
        value: spec.value,
        'aria-describedby': spec.hint ? id + '-hint' : null
      });
      var fmt = spec.format || function (v) { return v; };
      out.textContent = fmt(spec.value);
      input.addEventListener('input', function () {
        out.textContent = fmt(Number(input.value));
        if (spec.onInput) spec.onInput(Number(input.value));
      });
      wrap.appendChild(el('div', { class: 'ctl__top' }, [label, out]));
      wrap.appendChild(input);
      wrap._set = function (v) {
        input.value = v;
        out.textContent = fmt(Number(v));
      };
    } else if (type === 'select') {
      var sel = el('select', { id: id, 'aria-describedby': spec.hint ? id + '-hint' : null });
      spec.options.forEach(function (o) {
        var op = el('option', { value: o.value, text: o.label });
        if (String(o.value) === String(spec.value)) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () { if (spec.onChange) spec.onChange(sel.value); });
      wrap.appendChild(label);
      wrap.appendChild(sel);
    } else if (type === 'segmented') {
      var group = el('div', { class: 'seg', role: 'group', 'aria-label': spec.label });
      spec.options.forEach(function (o) {
        var b = el('button', {
          type: 'button',
          class: 'seg__btn' + (String(o.value) === String(spec.value) ? ' is-on' : ''),
          'aria-pressed': String(o.value) === String(spec.value) ? 'true' : 'false',
          text: o.label
        });
        b.addEventListener('click', function () {
          group.querySelectorAll('.seg__btn').forEach(function (x) {
            var on = x === b;
            x.classList.toggle('is-on', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          if (spec.onChange) spec.onChange(o.value);
        });
        group.appendChild(b);
      });
      wrap.appendChild(label);
      wrap.appendChild(group);
      wrap._set = function (v) {
        group.querySelectorAll('.seg__btn').forEach(function (btn, i) {
          var on = String(spec.options[i].value) === String(v);
          btn.classList.toggle('is-on', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      };
    } else if (type === 'toggle') {
      var btn = el('button', {
        type: 'button',
        class: 'switch' + (spec.value ? ' is-on' : ''),
        role: 'switch',
        'aria-label': spec.label,
        'aria-checked': spec.value ? 'true' : 'false'
      }, el('span', { class: 'switch__knob' }));
      btn.addEventListener('click', function () {
        var next = !btn.classList.contains('is-on');
        btn.classList.toggle('is-on', next);
        btn.setAttribute('aria-checked', String(next));
        if (spec.onChange) spec.onChange(next);
      });
      wrap.appendChild(label);
      wrap.appendChild(el('div', { class: 'ctl__row' }, [btn, el('span', {
        class: 'switch__state',
        text: spec.value
          ? spec.onLabel || root.MILVUS.data.milvus.COPY.ui.switchOn
          : spec.offLabel || root.MILVUS.data.milvus.COPY.ui.switchOff
      })]));
      wrap._sync = function (v) {
        btn.classList.toggle('is-on', !!v);
        btn.setAttribute('aria-checked', String(!!v));
        wrap.querySelector('.switch__state').textContent = v
          ? spec.onLabel || root.MILVUS.data.milvus.COPY.ui.switchOn
          : spec.offLabel || root.MILVUS.data.milvus.COPY.ui.switchOff;
      };
    } else if (type === 'text') {
      var inp = el('input', {
        id: id,
        type: 'text',
        value: spec.value || '',
        maxlength: spec.maxlength || 120,
        placeholder: spec.placeholder || ''
      });
      var fire = function () { if (spec.onChange) spec.onChange(inp.value); };
      inp.addEventListener('change', fire);
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          fire();
        }
      });
      wrap.appendChild(label);
      wrap.appendChild(inp);
    } else if (type === 'date') {
      var date = el('input', { id: id, type: 'date', value: spec.value || '' });
      date.addEventListener('change', function () { if (spec.onChange) spec.onChange(date.value); });
      wrap.appendChild(label);
      wrap.appendChild(date);
    } else if (type === 'button') {
      var btn2 = el('button', {
        type: 'button',
        class: 'btn ' + (spec.variant ? 'btn--' + spec.variant : 'btn--ghost'),
        text: spec.label
      });
      btn2.addEventListener('click', function () { if (spec.onClick) spec.onClick(); });
      wrap.classList.add('ctl--button');
      wrap.appendChild(btn2);
      if (spec.hint) wrap.appendChild(el('p', { class: 'ctl__hint', text: spec.hint }));
      return wrap;
    }

    if (spec.hint) {
      wrap.appendChild(el('p', { class: 'ctl__hint', id: id + '-hint', text: spec.hint }));
    }
    return wrap;
  }

  function controlsGrid(items) {
    return el('div', { class: 'ctls' }, items);
  }

  function lanes(activeIds, opts) {
    opts = opts || {};
    var data = root.MILVUS.data.milvus;
    var active = activeIds || [];
    var rootEl = el('div', {
      class: 'lanes',
      role: 'group',
      'aria-label': root.MILVUS.data.milvus.COPY.ui.pathAria
    });
    data.LANES.forEach(function (lane) {
      var isLive = lane.nodes.some(function (n) { return active.indexOf(n.id) !== -1; });
      var row = el('div', {
        class: 'lane lane--' + lane.tone + (isLive ? ' is-live' : ''),
        dataset: { lane: lane.id }
      }, [
        el('div', { class: 'lane__head' }, [
          el('span', { class: 'lane__title', text: lane.title }),
          el('span', { class: 'lane__sub', text: lane.sub })
        ]),
        el('div', { class: 'lane__nodes' }, lane.nodes.map(function (n) {
          var on = active.indexOf(n.id) !== -1;
          return el('div', {
            class: 'node' + (on ? ' is-on' : ''),
            dataset: { node: n.id }
          }, [
            el('b', { text: n.label }),
            el('span', { text: n.detail })
          ]);
        }))
      ]);
      rootEl.appendChild(row);
    });
    rootEl._setActive = function (ids) {
      var set = ids || [];
      rootEl.querySelectorAll('.node').forEach(function (n) {
        n.classList.toggle('is-on', set.indexOf(n.dataset.node) !== -1);
      });
      rootEl.querySelectorAll('.lane').forEach(function (l) {
        var live = Array.prototype.some.call(l.querySelectorAll('.node'), function (n) {
          return set.indexOf(n.dataset.node) !== -1;
        });
        l.classList.toggle('is-live', live);
      });
    };
    if (opts.trace) {
      rootEl.appendChild(el('p', { class: 'lanes__trace' }, [
        el('span', { class: 'lanes__trace-k', text: 'PATH' }),
        el('span', { text: opts.trace })
      ]));
    }
    return rootEl;
  }

  function codeBlock(title, code, opts) {
    opts = opts || {};
    var pre = el('pre', { class: 'code__pre', tabindex: '0' }, el('code', { text: code }));
    var copyBtn = el('button', {
      type: 'button',
      class: 'btn btn--mini',
      text: root.MILVUS.data.milvus.COPY.actions.copy
    });
    copyBtn.addEventListener('click', function () {
      copyText(code).then(function () {
        copyBtn.textContent = root.MILVUS.data.milvus.COPY.actions.copied;
        toast(root.MILVUS.data.milvus.COPY.actions.copied);
        setTimeout(function () {
          copyBtn.textContent = root.MILVUS.data.milvus.COPY.actions.copy;
        }, 1800);
      }).catch(function () {
        toast(root.MILVUS.data.milvus.COPY.actions.copyFail);
      });
    });
    return el('div', { class: 'code' }, [
      el('div', { class: 'code__head' }, [
        el('span', { class: 'code__title', text: title }),
        copyBtn
      ]),
      pre,
      opts.note ? note(opts.note) : null
    ]);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
    });
  }

  function toast(message) {
    var box = document.getElementById('toast');
    if (!box) return;
    box.textContent = message;
    box.classList.add('is-on');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.classList.remove('is-on'); }, 2200);
  }

  function figure(spec) {
    var canvas = el('canvas', {
      class: 'figure__canvas',
      role: 'img',
      'aria-label': spec.aria || spec.title
    });
    var hint = spec.hint ? el('p', { class: 'figure__hint', text: spec.hint }) : null;
    var tip = el('div', { class: 'figure__tip', hidden: true });
    var legend = spec.legend ? el('div', { class: 'figure__legend' }, spec.legend) : null;
    var wrap = el('figure', { class: 'figure' }, [
      el('figcaption', { class: 'figure__cap' }, [
        el('span', { class: 'figure__title' }, spec.titleNodes || el('span', { text: spec.title })),
        spec.badge || null
      ]),
      el('div', { class: 'figure__plot' }, [canvas, tip]),
      hint,
      legend,
      spec.table
        ? el('details', { class: 'figure__data' }, [
            el('summary', { text: spec.tableLabel || root.MILVUS.data.milvus.COPY.ui.tableFallback }),
            spec.table
          ])
        : null
    ]);
    return {
      root: wrap,
      canvas: canvas,
      tip: tip,
      draw: function (fn) {
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var w = canvas.parentElement.clientWidth || 640;
        var h = spec.height || 300;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.height = h + 'px';
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        fn(ctx, w, h);
      }
    };
  }

  function initTooltip() {
    var tip = document.getElementById('tooltip');
    if (!tip) return;
    var current = null;
    function hide() {
      tip.hidden = true;
      current = null;
    }
    function show(target) {
      var text = target.getAttribute('data-tip');
      if (!text) return;
      current = target;
      tip.textContent = text;
      tip.hidden = false;
      var r = target.getBoundingClientRect();
      var tr = tip.getBoundingClientRect();
      var left = Math.min(
        Math.max(12, r.left + r.width / 2 - tr.width / 2),
        window.innerWidth - tr.width - 12
      );
      var top = r.bottom + 8;
      if (top + tr.height > window.innerHeight - 12) top = r.top - tr.height - 8;
      tip.style.left = left + 'px';
      tip.style.top = Math.max(12, top) + 'px';
    }
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('.mark');
      if (t && t !== current) show(t);
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest && e.target.closest('.mark');
      if (t && !t.contains(e.relatedTarget)) hide();
    });
    document.addEventListener('focusin', function (e) {
      var t = e.target.closest && e.target.closest('.mark');
      if (t) show(t);
    });
    document.addEventListener('focusout', function (e) {
      var t = e.target.closest && e.target.closest('.mark');
      if (t) hide();
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.mark');
      if (t) {
        e.preventDefault();
        show(t);
      } else if (!tip.contains(e.target)) {
        hide();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }

  Object.assign(UI, {
    el: el,
    append: append,
    clear: clear,
    frag: frag,
    num: num,
    pct: pct,
    bytes: bytes,
    ms: ms,
    block: block,
    prose: prose,
    badge: badge,
    mark: mark,
    note: note,
    callout: callout,
    stat: stat,
    statsGrid: statsGrid,
    table: table,
    control: control,
    controlsGrid: controlsGrid,
    lanes: lanes,
    codeBlock: codeBlock,
    copyText: copyText,
    toast: toast,
    figure: figure,
    initTooltip: initTooltip
  });

  root.MILVUS = root.MILVUS || {};
  root.MILVUS.UI = UI;
})(typeof globalThis !== 'undefined' ? globalThis : this);
