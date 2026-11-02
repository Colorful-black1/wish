/* ============================================================================
 * components.js —— 页面里复用的小部件（卡片、开关、滑杆、指标…）
 * ========================================================================== */

(function (global) {
  "use strict";

  const UI = global.UI;
  const h = UI.h;
  const fmt = UI.fmt;

  const C = {};
  global.RAG_COMP = C;

  /**
   * 带标题栏的卡片。body 可以是节点或数组。
   * 允许把额外的正文节点直接跟在 body 后面（第 4、5… 个参数），
   * 最后一个对象参数才当作 opts —— 这样可以少写一层数组，也不容易传错位置。
   */
  C.card = function (title, hint, body, opts) {
    const rest = Array.prototype.slice.call(arguments, 3);
    let o = {};
    if (rest.length && rest[0] && typeof rest[0] === "object" && !rest[0].nodeType && !Array.isArray(rest[0])) {
      o = rest.shift();
    }
    const content = [body].concat(rest);
    const head =
      title == null
        ? null
        : h(
            "div",
            { class: "card-head" },
            h("h3", { text: title }),
            o.right || null,
            hint ? h("span", { class: "hint", text: hint }) : null
          );
    return h(
      "div",
      { class: "card" + (o.class ? " " + o.class : ""), style: o.style },
      head,
      h("div", { class: "card-body" + (o.flush ? " flush" : "") + (o.tight ? " tight" : "") }, content),
      o.foot ? h("div", { class: "card-foot" }, o.foot) : null
    );
  };

  /** 解释性富文本（支持少量内联标签，调用方自己保证内容可信）。 */
  C.prose = function (html) {
    return h("div", { class: "prose", html });
  };

  C.sectionTitle = function (text) {
    return h("h4", { class: "section-title", text });
  };

  /** 左侧色条的提示块。 */
  C.note = function (text, color) {
    return h("div", { class: "note", style: color ? { "--note-color": color } : null, html: text });
  };

  /** 键值行。 */
  C.kv = function (k, v, cls) {
    return h("div", { class: "kv" }, h("span", { class: "k", text: k }), h("span", { class: "v" + (cls ? " " + cls : ""), text: v }));
  };

  /** 单个指标块。 */
  C.metric = function (value, label, accent, unit) {
    return h(
      "div",
      { class: "metric" + (accent ? " accent" : "") },
      h("div", { class: "m-val" }, String(value), unit ? h("small", { text: unit }) : null),
      h("div", { class: "m-lab", text: label })
    );
  };

  C.metrics = function (items) {
    return h("div", { class: "metric-grid" }, items.map((x) => C.metric(x[0], x[1], x[2], x[3])));
  };

  /** 开关行。 */
  C.toggle = function (label, desc, on, onChange) {
    return h(
      "div",
      { class: "switch" },
      h("div", {}, h("div", { class: "s-label", text: label }), desc ? h("span", { class: "s-desc", text: desc }) : null),
      h("button", {
        class: "toggle" + (on ? " on" : ""),
        role: "switch",
        "aria-checked": on ? "true" : "false",
        "aria-label": label,
        on: {
          click: () => onChange(!on)
        }
      })
    );
  };

  /** 带数值显示的滑杆。 */
  C.range = function (label, value, min, max, step, onInput, display) {
    const out = h("b", { text: display ? display(value) : value });
    return h(
      "div",
      { class: "control" },
      h("div", { class: "control-head" }, h("span", { text: label }), out),
      h("input", {
        type: "range",
        min,
        max,
        step,
        value,
        "aria-label": label,
        on: {
          input: (e) => {
            const v = Number(e.target.value);
            out.textContent = display ? display(v) : v;
            onInput(v);
          }
        }
      })
    );
  };

  /** 分段选择器。 */
  C.seg = function (options, value, onChange) {
    const wrap = h("div", { class: "seg" });
    options.forEach((o) => {
      wrap.appendChild(
        h("button", {
          class: o.value === value ? "on" : "",
          text: o.label,
          "aria-pressed": o.value === value ? "true" : "false",
          on: { click: () => onChange(o.value) }
        })
      );
    });
    return wrap;
  };

  C.select = function (label, value, options, onChange) {
    const sel = h(
      "select",
      { "aria-label": label, on: { change: (e) => onChange(e.target.value) } },
      options.map((o) => h("option", { value: o.value, text: o.label, selected: o.value === value ? "selected" : null }))
    );
    return h("div", { class: "control" }, h("div", { class: "control-head" }, h("span", { text: label })), sel);
  };

  C.badge = function (text, kind) {
    return h("span", { class: "badge " + (kind || "") }, h("span", { class: "dot" }), text);
  };

  C.tag = function (text, kind) {
    return h("span", { class: "tag " + (kind || ""), text });
  };

  /** 源文档小块（颜色 + 简称）。 */
  C.docChip = function (docId, extra) {
    const d = UI.docById(docId);
    return h(
      "span",
      { class: "tag", style: { color: d.color, borderColor: d.color + "55" } },
      h("i", { class: "source-dot", style: { background: d.color } }),
      d.short + (extra ? " · " + extra : "")
    );
  };

  /** 文档过滤 chips（多选）。 */
  C.docFilter = function (view) {
    const f = UI.state.search.filters;
    const wrap = h("div", { class: "chips" });
    global.RAG_DATA.DOCS.forEach((d) => {
      const on = !f.docs.length || f.docs.includes(d.id);
      wrap.appendChild(
        h(
          "button",
          {
            class: "chip" + (on ? " on" : ""),
            "aria-pressed": on ? "true" : "false",
            on: {
              click: () => {
                let docs = f.docs.length ? f.docs.slice() : global.RAG_DATA.DOCS.map((x) => x.id);
                if (docs.includes(d.id)) docs = docs.filter((x) => x !== d.id);
                else docs.push(d.id);
                if (docs.length === global.RAG_DATA.DOCS.length) docs = [];
                f.docs = docs;
                UI.rerender();
              }
            }
          },
          h("i", { class: "source-dot", style: { background: d.color } }),
          d.short
        )
      );
    });
    wrap.appendChild(
      h(
        "button",
        {
          class: "chip" + (f.freshOnly ? " on" : ""),
          "aria-pressed": f.freshOnly ? "true" : "false",
          title: "只保留 2026-07-01 之后更新的文档（年假办法会被过滤掉）",
          on: {
            click: () => {
              f.freshOnly = !f.freshOnly;
              UI.rerender();
            }
          }
        },
        "仅 2026 下半年更新"
      )
    );
    return wrap;
  };

  /** 说明栏：这一站在做什么。 */
  C.explain = function (stage) {
    return C.card("这一站在做什么", null, C.prose(stage.why));
  };

  /** 企业实践清单。 */
  C.notes = function (stage) {
    return C.card(
      "企业实践要点",
      null,
      h("ul", { class: "prose", style: { paddingLeft: "16px", margin: "0" } }, stage.notes.map((n) => h("li", { html: n }))),
      { tight: false }
    );
  };

  C.pitfall = function (text) {
    return h(
      "div",
      { class: "note", style: { "--note-color": "var(--warn)" } },
      h("b", { text: "动手试试：" }),
      text
    );
  };

  /** 横向分数条：label + 比例 + 数值。 */
  C.scoreLine = function (label, ratio, value, color) {
    return h(
      "div",
      { class: "score-line" },
      h("span", { text: label }),
      h("div", { class: "bar" }, h("i", { style: { width: Math.max(2, Math.min(100, ratio * 100)) + "%", "--bar-color": color || "var(--accent)" } })),
      h("b", { text: value })
    );
  };

  /** 空状态。 */
  C.empty = function (text) {
    return h("div", { class: "lane-empty", text });
  };
})(window);
