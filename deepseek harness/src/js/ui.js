/* ===== UI 基础：DOM、图标、检查器、代码块、存储 ===== */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    file: '<path d="M14 3v5h5"/><path d="M6 3h8l5 5v13H6z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    prev: '<path d="M15 5 8 12l7 7"/>',
    next: '<path d="m9 5 7 7-7 7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    book: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-3a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h4z"/>',
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    route: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h1"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    check2: '<path d="M9 11l3 3 8-8"/><path d="M21 12a9 9 0 1 1-9-9"/>',
  };

  function icon(name, size = 16) {
    const path = ICONS[name] || ICONS.grid;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  /* ---------- 存储 ---------- */
  const NS = 'dsh-lab:';
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(NS + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* 隐私模式下忽略 */ }
    },
    del(key) { try { localStorage.removeItem(NS + key); } catch { /* ignore */ } },
  };

  /* ---------- 提示 ---------- */
  let toastTimer = 0;
  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(label ? `${label} 已复制` : '已复制');
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); toast(label ? `${label} 已复制` : '已复制'); }
      catch { toast('复制失败，请手动选择'); }
      area.remove();
    }
  }

  /* ---------- 代码高亮 ---------- */
  const KEYWORDS = new Set(('const let var function class interface type extends implements import export from return await async if else for while do switch case break continue new throw try catch finally private public protected readonly static override abstract declare module namespace as satisfies never void unknown undefined null true false this super default enum get set of in instanceof typeof yield').split(' '));

  function highlightLine(line) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|([A-Za-z_$][\w$]*)|(\d+(?:\.\d+)?)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = re.exec(line))) {
      out += esc(line.slice(last, m.index));
      const text = m[0];
      let cls = '';
      if (m[1]) cls = 'tok-c';
      else if (m[2]) cls = 'tok-s';
      else if (m[3]) cls = KEYWORDS.has(text) ? 'tok-k' : (/^[A-Z]/.test(text) ? 'tok-t' : '');
      else if (m[4]) cls = 'tok-n';
      out += cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
      last = m.index + text.length;
    }
    out += esc(line.slice(last));
    return out;
  }

  function ideHref(file, line) {
    const root = ((window.LAB_DATA && window.LAB_DATA.generated && window.LAB_DATA.generated.meta.source) || '')
      .replace(/\\/g, '/').replace(/\/+$/, '');
    if (!root || !file) return '';
    return 'vscode://file/' + encodeURI(root + '/' + file) + (line ? ':' + line : '');
  }

  function codeBlock(excerpt, opts = {}) {
    if (!excerpt) return '';
    const max = opts.max || 440;
    const lines = String(excerpt.code || '').split('\n');
    const ide = ideHref(excerpt.file, excerpt.start);
    const rows = lines.map((line, i) => {
      const n = (excerpt.start || 1) + i;
      return `<div class="code__row"><span class="code__n">${n}</span><span class="code__c">${highlightLine(line) || ' '}</span></div>`;
    }).join('');
    return `<div class="code">
      <div class="code__head">
        ${icon('file', 13)}
        <span class="code__path" title="${esc(excerpt.file)}">${esc(excerpt.file)}</span>
        <span class="code__lines">${excerpt.start}–${excerpt.end}</span>
        ${ide ? `<a class="btn btn--ghost btn--sm" href="${esc(ide)}" title="在 VS Code 中打开">${icon('link', 12)}</a>` : ''}
        <button class="btn btn--ghost btn--sm" data-copy="${esc(excerpt.file + ':' + excerpt.start)}" title="复制路径:行号">${icon('copy', 12)}</button>
      </div>
      <div class="code__body" style="max-height:${max}px"><pre>${rows}</pre></div>
    </div>`;
  }

  function fileRef(file) {
    const loc = file.line ? `${file.path}:${file.line}` : file.path;
    return `<button class="file-ref" data-file="${esc(file.path)}" data-line="${file.line || ''}" title="${esc(loc)}">
      ${icon('file')}<span>${esc(file.path)}${file.line ? `<span class="file-ref__line">:${file.line}</span>` : ''}</span>
      ${file.symbol ? `<span class="file-ref__sym">${esc(file.symbol)}</span>` : ''}
    </button>`;
  }

  /* ---------- 检查器 ---------- */
  function ensureInspector() {
    return document.getElementById('inspector');
  }

  function openInspector() {
    const app = document.querySelector('.app');
    const shell = document.querySelector('.shell');
    shell.classList.add('has-inspector');
    app.classList.add('inspector-open');
    const insp = ensureInspector();
    insp.setAttribute('aria-hidden', 'false');
  }

  function closeInspector() {
    const app = document.querySelector('.app');
    const shell = document.querySelector('.shell');
    shell.classList.remove('has-inspector');
    app.classList.remove('inspector-open');
    ensureInspector().setAttribute('aria-hidden', 'true');
  }

  function inspect({ kind = 'info', title, sub, body, foot = '' }) {
    const insp = ensureInspector();
    insp.innerHTML = `<div class="inspector__head">
      <div class="inspector__main" style="flex:1;min-width:0">
        <div class="row" style="gap:6px;margin-bottom:4px">
          <span class="badge badge--mono">${esc(kind)}</span>
        </div>
        <div class="inspector__title">${title}</div>
        ${sub ? `<div class="inspector__sub">${sub}</div>` : ''}
      </div>
      <button class="icon-btn" data-close-inspector aria-label="关闭详情">${icon('close', 15)}</button>
    </div>
    <div class="inspector__body">${body}</div>`;
    openInspector();
    insp.scrollTop = 0;
    insp.querySelector('[data-close-inspector]').addEventListener('click', closeInspector);
  }

  function emptyInspector() {
    return `<div class="empty"><div class="empty__t">还没有选中任何对象</div>点击架构图节点、事件、文件或技术卡片，这里会显示职责、关系与源码位置。</div>`;
  }

  /* ---------- 杂项 ---------- */
  const fmt = (n) => new Intl.NumberFormat('zh-CN').format(n);
  const pad = (n) => String(n).padStart(2, '0');

  function debounce(fn, wait = 120) {
    let t = 0;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  function on(el, type, handler, opts) {
    if (el) el.addEventListener(type, handler, opts);
  }

  window.UI = {
    $, $$, esc, icon, store, toast, copy, codeBlock, fileRef, ideHref,
    inspect, openInspector, closeInspector, emptyInspector,
    highlightLine, fmt, pad, debounce, on,
  };
})();
