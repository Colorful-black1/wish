/* ============================================================================
 * _test_ui.js —— 用最小 DOM stub 跑一遍全部 9 站，捕获运行时异常。
 * 这不是像素级验证，只保证：初始化、每次重绘、交互回调不会抛错。
 * ========================================================================== */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

class ClassList {
  constructor(el) {
    this.el = el;
  }
  _list() {
    return String(this.el.className || "").split(/\s+/).filter(Boolean);
  }
  add(...cs) {
    const l = this._list();
    cs.forEach((c) => c && !l.includes(c) && l.push(c));
    this.el.className = l.join(" ");
  }
  remove(...cs) {
    this.el.className = this._list().filter((c) => !cs.includes(c)).join(" ");
  }
  contains(c) {
    return this._list().includes(c);
  }
  toggle(c, force) {
    const has = this.contains(c);
    const on = force === undefined ? !has : Boolean(force);
    if (on) this.add(c);
    else this.remove(c);
    return on;
  }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
    this.style = {
      setProperty(k, v) {
        this[k] = v;
      },
      removeProperty(k) {
        delete this[k];
      }
    };
    this.dataset = {};
    this._handlers = {};
    this._className = "";
    this._text = "";
    this._html = "";
    this.hidden = false;
    this.value = "";
    this.scrollTop = 0;
    this.width = 300;
    this.height = 150;
    this.classList = new ClassList(this);
    document._all.push(this);
  }
  get className() {
    return this._className;
  }
  set className(v) {
    this._className = String(v);
  }
  get textContent() {
    if (this.children.length) return this.children.map((c) => c.textContent || "").join("");
    return this._text;
  }
  set textContent(v) {
    this.children = [];
    this._text = String(v);
  }
  get innerHTML() {
    return this._html;
  }
  set innerHTML(v) {
    this.children = [];
    this._text = "";
    this._html = String(v);
  }
  appendChild(c) {
    if (!c) return c;
    if (c.tagName === "#FRAGMENT") {
      c.children.slice().forEach((x) => this.appendChild(x));
      return c;
    }
    if (c.parentElement) c.parentElement.removeChild(c);
    c.parentElement = this;
    this.children.push(c);
    return c;
  }
  insertBefore(c, ref) {
    const i = this.children.indexOf(ref);
    if (i < 0) return this.appendChild(c);
    c.parentElement = this;
    this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) {
      this.children.splice(i, 1);
      c.parentElement = null;
    }
    return c;
  }
  remove() {
    if (this.parentElement) this.parentElement.removeChild(this);
  }
  replaceChildren(...cs) {
    this.children = [];
    cs.forEach((c) => this.appendChild(c));
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === "id") this.id = String(v);
    if (k === "class") this.className = String(v);
    if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = String(v);
  }
  getAttribute(k) {
    return k in this.attributes ? this.attributes[k] : null;
  }
  hasAttribute(k) {
    return k in this.attributes;
  }
  removeAttribute(k) {
    delete this.attributes[k];
  }
  addEventListener(ev, fn) {
    (this._handlers[ev] = this._handlers[ev] || []).push(fn);
  }
  removeEventListener(ev, fn) {
    this._handlers[ev] = (this._handlers[ev] || []).filter((f) => f !== fn);
  }
  dispatch(ev, arg) {
    (this._handlers[ev] || []).slice().forEach((fn) => fn(Object.assign({ target: this, preventDefault() {}, stopPropagation() {}, key: "" }, arg || {})));
  }
  getBoundingClientRect() {
    return { width: 760, height: 420, left: 0, top: 0, right: 760, bottom: 420 };
  }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
  blur() {}
  scrollIntoView() {}
  getContext() {
    const grad = { addColorStop() {} };
    return {
      setTransform() {},
      clearRect() {},
      fillRect() {},
      createRadialGradient: () => grad,
      createLinearGradient: () => grad,
      beginPath() {},
      closePath() {},
      arc() {},
      fill() {},
      stroke() {},
      moveTo() {},
      lineTo() {},
      drawImage() {},
      fillText() {},
      measureText: (t) => ({ width: String(t).length * 6 }),
      roundRect() {},
      setLineDash() {},
      save() {},
      restore() {},
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      font: "",
      textAlign: "",
      textBaseline: ""
    };
  }
  querySelector(sel) {
    return queryAll(this, sel)[0] || null;
  }
  querySelectorAll(sel) {
    return queryAll(this, sel);
  }
}

function matchOne(el, sel) {
  if (sel.startsWith("#")) return el.id === sel.slice(1);
  if (sel.startsWith(".")) return el.classList.contains(sel.slice(1));
  const m = sel.match(/^\[([\w-]+)="([^"]*)"\]$/);
  if (m) {
    const key = m[1];
    const val = m[2];
    if (key.startsWith("data-")) {
      const dk = key.slice(5).replace(/-([a-z])/g, (x, c) => c.toUpperCase());
      return String(el.dataset[dk] || "") === val;
    }
    return el.getAttribute(key) === val;
  }
  if (sel.startsWith("[")) {
    const key = sel.slice(1, -1);
    return el.hasAttribute(key);
  }
  return el.tagName.toLowerCase() === sel.toLowerCase();
}

function queryAll(root, sel) {
  const out = [];
  const walk = (n) => {
    n.children.forEach((c) => {
      if (matchOne(c, sel)) out.push(c);
      walk(c);
    });
  };
  walk(root);
  return out;
}

const document = {
  _all: [],
  readyState: "complete",
  _handlers: {},
  createElement(tag) {
    return new El(tag);
  },
  createTextNode(text) {
    const n = new El("#text");
    n.textContent = text;
    return n;
  },
  createDocumentFragment() {
    return new El("#fragment");
  },
  getElementById(id) {
    return this._all.find((e) => e.id === id) || null;
  },
  querySelector(sel) {
    return queryAll(this.body, sel)[0] || null;
  },
  querySelectorAll(sel) {
    return queryAll(this.body, sel);
  },
  addEventListener(ev, fn) {
    (this._handlers[ev] = this._handlers[ev] || []).push(fn);
  }
};
document.body = new El("body");

global.document = document;
global.window = global;
global.devicePixelRatio = 1;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.performance = { now: () => Date.now() };
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
global.history = { replaceState() {} };
global.location = { hash: "" };

// 页面骨架（和 index.html 里一致，只是没有内容）
const shell = {
  "query-box": "div",
  "query-input": "input",
  "btn-presets": "button",
  "preset-popover": "div",
  "btn-step": "button",
  "btn-play": "button",
  "btn-reset": "button",
  "btn-panorama": "button",
  "rail-groups": "div",
  "rail-progress": "div",
  "stage-head": "header",
  "stage-body": "div",
  "status-log": "div",
  "status-metrics": "div",
  modal: "div",
  "modal-title": "h2",
  "modal-body": "div",
  "modal-close": "button"
};
Object.keys(shell).forEach((id) => {
  const el = new El(shell[id]);
  el.id = id;
  el.setAttribute("id", id);
  document.body.appendChild(el);
});

const dir = path.join(__dirname, "assets");
for (const f of ["data.js", "engine.js", "viz3d.js", "ui-core.js", "components.js", "stages-a.js", "stages-b.js", "app.js"]) {
  try {
    vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f });
  } catch (e) {
    console.error("加载失败:", f, e);
    process.exit(1);
  }
}

const UI = global.UI;
let failures = 0;
function guard(label, fn) {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error("✗ " + label + " -> " + e.message);
    console.error((e.stack || "").split("\n").slice(1, 5).join("\n"));
  }
}

guard("init", () => UI.init());

const allQueries = global.RAG_DATA.QUERIES;
allQueries.forEach((q) => {
  UI.state.queryId = q.id;
  UI.state.queryText = q.text;
  UI.invalidate();
  UI.STAGES.forEach((st, i) => {
    guard("render " + st.id + " / " + q.id, () => {
      UI.state.stage = i;
      UI.render();
      const body = document.getElementById("stage-body");
      if (!body.children.length) throw new Error("stage body empty");
    });
  });
});

// 自定义问题
UI.state.queryId = "custom";
UI.state.queryText = "出差住宿费能报多少";
UI.invalidate();
UI.STAGES.forEach((st, i) =>
  guard("custom " + st.id, () => {
    UI.state.stage = i;
    UI.render();
  })
);

// 交互回调：开关、滑杆、分段、预设、文档过滤
UI.state.queryId = "q2";
UI.state.queryText = allQueries[1].text;
UI.invalidate();
UI.state.stage = 5;
UI.render();
const body = document.getElementById("stage-body");
const toggles = body.querySelectorAll(".toggle");
guard("toggle click", () => toggles.forEach((t) => t.dispatch("click")));
const ranges = body.querySelectorAll("input");
guard("range input", () =>
  ranges.forEach((r, i) => {
    r.value = String(10 + i);
    r.dispatch("input");
  })
);
guard("seg click", () => body.querySelectorAll(".seg button").forEach((b) => b.dispatch("click")));
guard("doc filter", () => body.querySelectorAll(".chip").forEach((b) => b.dispatch("click")));

// 拒答题 + 裸模型 + 阈值
UI.state.queryId = "q6";
UI.state.queryText = allQueries[5].text;
UI.state.ctx.freeform = true;
UI.state.stage = 7;
UI.invalidate();
guard("freeform render", () => UI.render());
UI.state.stage = 8;
guard("freeform verify", () => UI.render());
UI.state.ctx.freeform = false;
UI.state.ctx.threshold = 0.1;
UI.invalidate();
guard("low threshold", () => UI.render());

// 预设问题下拉
guard("preset popover", () => {
  document.getElementById("btn-presets").dispatch("click");
  const items = document.getElementById("preset-popover").querySelectorAll(".pop-item");
  if (!items.length) throw new Error("preset list empty");
  items.forEach((b) => b.dispatch("click"));
});

// 导航
guard("navigation", () => {
  UI.go(2);
  UI.next();
  UI.prev();
  UI.prev();
  UI.go(0);
});

// 全景弹层
guard("panorama", () => document.getElementById("btn-panorama").dispatch("click"));
guard("modal close", () => document.getElementById("modal-close").dispatch("click"));

// 空结果保护：post-filter 把候选筛空时，后三站也不能崩
UI.state.queryId = "q1";
UI.state.search.filters.docs = ["leave"];
UI.state.search.filterMode = "post";
UI.invalidate();
[6, 7, 8, 5].forEach((i) =>
  guard("empty-context stage " + i, () => {
    UI.state.stage = i;
    UI.render();
  })
);
UI.state.search.filters.docs = [];
UI.state.search.filterMode = "pre";
UI.invalidate();

// 播放 / 停止
guard("play", () => {
  UI.play();
  UI.stop();
});

// 打印一点状态，确认不是空壳
const view = UI.computeView();
console.log("\n— 冒烟结果 —");
console.log("阶段数:", UI.STAGES.length, "· 块数:", view.pack.stats.count, "· 查询:", view.ret.query.text);
console.log("答案:", view.answer.refused ? "拒答" : view.answer.sentences.map((s) => s.text.slice(0, 24)).join(" | "));
console.log("DOM 节点数:", document._all.length);
console.log(failures ? "✗ 失败 " + failures + " 处" : "✓ 全部通过");
process.exitCode = failures ? 1 : 0;
