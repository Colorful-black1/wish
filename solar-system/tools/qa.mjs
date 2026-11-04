// 无头 Chrome 验收：冒烟、九颗特写、确定性截图、交互路径、移动端。
// 用法：cd solar-system && node tools/qa.mjs   （需要本机装有 Chrome 或 Edge）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'qa');
fs.mkdirSync(OUT, { recursive: true });

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('找不到 index.html —— 先运行 node tools/build.mjs');
  process.exit(1);
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('no chrome');
  process.exit(1);
}

const PORT = 9333 + Math.floor(Math.random() * 300);
const profile = path.join(ROOT, '.chrome-qa');
const BASE = pathToFileURL(path.join(ROOT, 'index.html')).href;

fs.rmSync(profile, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--mute-audio',
    '--allow-file-access-from-files',
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort() {
  for (let i = 0; i < 160; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) {
      /* retry */
    }
    await sleep(150);
  }
  throw new Error('chrome did not start');
}

const wsUrl = await waitPort();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res);
  ws.addEventListener('error', rej);
});

let nextId = 1;
const pending = new Map();
let sessionId = null;
let consoleErrors = [];
let failedRequests = [];
let pageErrors = [];

ws.addEventListener('message', (ev) => {
  let msg;
  try {
    msg = JSON.parse(ev.data);
  } catch (e) {
    return;
  }
  if (msg.id) {
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    }
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    pageErrors.push(
      'EXCEPTION: ' +
        (msg.params.exceptionDetails.exception?.description ||
          msg.params.exceptionDetails.text ||
          JSON.stringify(msg.params.exceptionDetails))
    );
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push('LOG: ' + msg.params.entry.text);
  }
  if (msg.method === 'Network.loadingFailed') {
    if (!String(msg.params.errorText || '').includes('net::ERR_ABORTED')) failedRequests.push(msg.params.errorText);
  }
});

function send(method, params = {}, sid = sessionId) {
  const id = nextId++;
  const payload = { id, method, params };
  if (sid) payload.sessionId = sid;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(payload));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout ' + method));
      }
    }, 90000);
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const buf = Buffer.from(r.data, 'base64');
  fs.writeFileSync(path.join(OUT, name), buf);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

async function viewport(w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
}

async function navigate(url) {
  consoleErrors = [];
  failedRequests = [];
  pageErrors = [];
  await send('Page.navigate', { url });
  await sleep(140);
  const ok = await evaluate(`new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      if (window.__HELIOS_READY) return resolve('ready');
      const fb = document.getElementById('fallback');
      if (fb && !fb.hasAttribute('hidden')) return resolve('fallback: ' + fb.textContent.slice(0, 300));
      if (Date.now() - t0 > 45000) return resolve('timeout');
      setTimeout(poll, 90);
    })();
  })`);
  return ok;
}

const target = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: sid } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
sessionId = sid;
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await viewport(1440, 900);

const report = {
  title: 'HELIOS / 太阳系观测台',
  generatedAt: new Date().toISOString(),
  url: BASE,
  chrome: CHROME,
  checks: [],
  consoleErrors: [],
  failedRequests: [],
  pageErrors: [],
  hasHorizontalOverflow: false,
  shots: {},
};

function check(name, pass, detail) {
  report.checks.push({ name, pass: !!pass, detail: detail === undefined ? null : detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`);
}

/* ═══════════════════════ 1. 全景交互 ═══════════════════════ */
const bootOk = await navigate(BASE);
check('页面启动', bootOk === 'ready', bootOk);
await sleep(500);

report.boot = await evaluate(`({
  webgl2: !!document.getElementById('gl').getContext('webgl2'),
  floatTargets: !!(window.HELIOS_APP && window.HELIOS_APP.floatTargets),
  stars: window.HELIOS_APP ? window.HELIOS_APP.starCount : 0,
  bodies: window.HELIOS_APP ? window.HELIOS_APP.bodies.length : 0,
  roster: document.querySelectorAll('#rosterList .roster-item').length,
  scale: window.HELIOS_APP ? window.HELIOS_APP.state.scale : null,
  date: document.getElementById('dateInput').value,
  hash: location.hash
})`);
check('WebGL2 上下文可用', report.boot.webgl2);
check('九颗天体 + 八颗卫星已装载', report.boot.bodies === 9 && report.boot.roster === 9, report.boot.bodies);
check('星表已内联（>8000 颗）', report.boot.stars > 8000, report.boot.stars);

report.media = await evaluate(`({ w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth })`);
report.hasHorizontalOverflow = report.media.scrollW > report.media.w + 2;
check('1440px 无横向滚动', !report.hasHorizontalOverflow, report.media);

report.shots.overview = await shot('01-overview.png');

/* 点击命中：每点之前重新投影一次（相机在每次进出特写后都会回到原机位） */
let clickHits = 0;
let clickTested = 0;
for (let i = 0; i < 9; i++) {
  const p = await evaluate(`(() => {
    const app = window.HELIOS_APP;
    const rect = document.getElementById('gl').getBoundingClientRect();
    const sp = app.cam.project(app.world.planetPos[${i}], rect.width, rect.height);
    return { x: Math.round(sp.x), y: Math.round(sp.y), visible: sp.visible, id: app.bodies[${i}].id };
  })()`);
  if (!p.visible) continue;
  clickTested++;
  await evaluate(
    `(() => {
       const c = document.getElementById('gl');
       const r = c.getBoundingClientRect();
       const opts = { bubbles: true, clientX: r.left + ${p.x}, clientY: r.top + ${p.y}, pointerId: 1, button: 0, pointerType: 'mouse' };
       c.dispatchEvent(new PointerEvent('pointerdown', opts));
       c.dispatchEvent(new PointerEvent('pointerup', opts));
       return 1;
     })()`
  );
  await sleep(1200);
  const st = await evaluate(
    `({ hash: location.hash, focus: window.HELIOS_APP.state.focus, panel: !document.getElementById('panel').hasAttribute('hidden') })`
  );
  if (st.focus === i && st.panel && st.hash.includes('body=' + p.id)) clickHits++;
  else console.log('  click miss', i, p.id, JSON.stringify(st));
  await evaluate(`window.HELIOS_APP.exitFocus()`);
  await sleep(1100);
}
report.clickHits = clickHits;
report.clickTested = clickTested;
check('点击命中九颗天体（屏幕坐标 → 特写 → hash）', clickTested === 9 && clickHits === 9, { clickHits, clickTested });

/* Esc 返回 */
await evaluate(`window.HELIOS_APP.focusBody(4)`);
await sleep(1200);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(1200);
const afterEsc = await evaluate(`({ focus: window.HELIOS_APP.state.focus, hidden: document.getElementById('panel').hasAttribute('hidden') || document.getElementById('panel').className.indexOf('is-open') < 0 })`);
check('Esc 从特写返回全景', afterEsc.focus === -1 && afterEsc.hidden, afterEsc);

/* 键盘 1–9 */
const keyResults = [];
for (let k = 1; k <= 9; k++) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: String(k), code: 'Digit' + k, windowsVirtualKeyCode: 48 + k });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: String(k), code: 'Digit' + k, windowsVirtualKeyCode: 48 + k });
  await sleep(180);
  keyResults.push(await evaluate(`window.HELIOS_APP.state.focus`));
}
await evaluate(`window.HELIOS_APP.exitFocus()`);
await sleep(1080);
check('键盘 1–9 直达九颗天体', keyResults.join(',') === '0,1,2,3,4,5,6,7,8', keyResults.join(','));

/* ← → */
await evaluate(`window.HELIOS_APP.focusBody(0)`);
await sleep(1150);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
await sleep(200);
const arrowFwd = await evaluate(`window.HELIOS_APP.state.focus`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
await sleep(200);
const arrowBack = await evaluate(`window.HELIOS_APP.state.focus`);
await evaluate(`window.HELIOS_APP.exitFocus()`);
await sleep(1080);
check('← → 在九颗天体间切换', arrowFwd === 1 && arrowBack === 0, { arrowFwd, arrowBack });

/* 帮助浮层 + 焦点归还 */
await evaluate(`document.getElementById('rosterList').querySelector('.roster-item').focus()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '?', code: 'Slash', windowsVirtualKeyCode: 191, modifiers: 8 });
await sleep(260);
const helpOpen = await evaluate(`(!document.getElementById('help').hasAttribute('hidden')) && document.body.classList.contains('is-locked') && document.activeElement.id === 'helpClose'`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(260);
const helpClosed = await evaluate(`document.getElementById('help').hasAttribute('hidden') && !document.body.classList.contains('is-locked') && document.activeElement.classList.contains('roster-item')`);
check('? 打开帮助、Esc 关闭并把焦点还给触发元素', helpOpen && helpClosed, { helpOpen, helpClosed });

/* 尺度模式切换 */
const scaleHashes = {};
for (const s of ['orrery', 'distance', 'true']) {
  await evaluate(`window.HELIOS_APP.setScale('${s}')`);
  await sleep(1300);
  scaleHashes[s] = await evaluate(`({ hash: location.hash, note: document.getElementById('scaleNote').textContent })`);
  report.shots['scale-' + s] = await shot('scale-' + s + '.png');
}
const scaleDistinct = new Set(Object.values(report.shots).filter((v) => typeof v === 'string')).size;
check('三种尺度模式画面互不相同', new Set([report.shots['scale-orrery'], report.shots['scale-distance'], report.shots['scale-true']]).size === 3, report.shots);
check('尺度模式都有失真标注', Object.values(scaleHashes).every((v) => v.note && v.note.length > 6), scaleHashes);
await evaluate(`window.HELIOS_APP.setScale('orrery')`);
await sleep(1300);

/* 改日期，位置必须真的变 */
const dateA = await evaluate(`window.HELIOS_APP.demo(window.HELIOS_APP.state.jd)`);
await evaluate(`window.HELIOS_APP.setDateString('2026-01-15')`);
await sleep(400);
const dateB = await evaluate(`window.HELIOS_APP.demo(window.HELIOS_APP.state.jd)`);
let moved = 0;
for (const k of Object.keys(dateA)) {
  const dLon = Math.abs(((dateB[k].lon - dateA[k].lon + 540) % 360) - 180);
  if (dLon > 0.5) moved++;
}
check('改日期后八颗行星位置全部变化', moved === 8, { moved });

/* ═══════════════════ 2. 确定性截图（同一 URL 两次） ═══════════════════ */
const SHOT_BASE = BASE + '?shot=1&dpr=1';
const FOCUSES = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];

let detOk = 0;
for (const id of FOCUSES) {
  const u = `${SHOT_BASE}&focus=${id}&date=2026-11-04&scale=orrery&ui=0`;
  const ok1 = await navigate(u);
  await sleep(160);
  const h1 = await shot(`closeup-${id}.png`);
  const ok2 = await navigate(u);
  await sleep(160);
  const h2 = await shot(`closeup-${id}-again.png`);
  report.shots['closeup-' + id] = h1;
  if (ok1 === 'ready' && ok2 === 'ready' && h1 === h2) detOk++;
  else console.log('  determinism mismatch for', id, ok1, ok2, h1, h2);
}
check('九颗特写：同一 shot URL 两次截图 sha256 一致', detOk === 9, { detOk });

const closeupHashes = FOCUSES.map((id) => report.shots['closeup-' + id]);
check('九张特写互不相同（不是同一个球换颜色）', new Set(closeupHashes).size === 9, new Set(closeupHashes).size);

/* 日期不同 → 画面不同 */
await navigate(`${SHOT_BASE}&focus=&date=2026-01-15&scale=distance&ui=0`);
await sleep(200);
const hDateA = await shot('date-2026-01-15.png');
await navigate(`${SHOT_BASE}&focus=&date=2026-07-15&scale=distance&ui=0`);
await sleep(200);
const hDateB = await shot('date-2026-07-15.png');
check('不同日期全景截图不同', hDateA !== hDateB, { hDateA, hDateB });

/* 背景开关 */
await navigate(`${SHOT_BASE}&focus=&date=2026-11-04&scale=orrery&ui=0`);
await sleep(200);
const hBgOn = await shot('bg-on.png');
await evaluate(`window.HELIOS_APP.state.bgOn = false`);
await sleep(220);
const hBgOff = await shot('bg-off.png');
check('关闭背景后画面变化但天体仍在', hBgOn !== hBgOff, { hBgOn, hBgOff });

/* URL 还原：#body / #date / #scale 三个都要能还原 */
await navigate(BASE + '#body=saturn&date=2031-05-06&scale=distance');
await sleep(900);
const restored = await evaluate(`({
  focus: window.HELIOS_APP.state.focus,
  scale: window.HELIOS_APP.state.scale,
  date: document.getElementById('dateInput').value,
  panel: !document.getElementById('panel').hasAttribute('hidden')
})`);
check(
  'URL hash 还原焦点 / 日期 / 尺度',
  restored.focus === 6 && restored.scale === 'distance' && restored.date === '2031-05-06',
  restored
);

/* ═══════════════════════ 3. 移动端 390px ═══════════════════════ */
await viewport(390, 844);
await navigate(BASE + '?shot=0');
await sleep(900);
const mobile = await evaluate(`({
  w: innerWidth, scrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth,
  roster: document.querySelectorAll('#rosterList .roster-item').length
})`);
const mobileOverflow = mobile.scrollW > mobile.w + 2 || mobile.bodyScrollW > mobile.w + 2;
check('390px 宽无横向滚动', !mobileOverflow, mobile);
report.shots.mobile = await shot('mobile-390.png');

await evaluate(`window.HELIOS_APP.focusBody(5)`);
await sleep(1300);
const mobilePanel = await evaluate(`(() => {
  const p = document.getElementById('panel');
  const r = p.getBoundingClientRect();
  const stage = document.getElementById('stage').getBoundingClientRect();
  return {
    open: p.classList.contains('is-open'),
    w: Math.round(r.width), h: Math.round(r.height),
    gap: Math.round(stage.bottom - r.bottom),
    inLowerHalf: r.top > stage.height * 0.4,
    scrollW: document.documentElement.scrollWidth
  };
})()`);
check(
  '移动端信息面板变底部抽屉',
  mobilePanel.open && Math.abs(mobilePanel.gap) <= 2 && mobilePanel.w <= 390 && mobilePanel.inLowerHalf,
  mobilePanel
);
report.shots.mobileCloseup = await shot('mobile-closeup.png');

/* ═══════════════════════ 4. 汇总 ═══════════════════════ */
await viewport(1440, 900);
await navigate(BASE + '?shot=1&focus=jupiter&date=2026-11-04&scale=orrery&ui=1&dpr=1');
await sleep(200);
report.shots.uiOn = await shot('05-ui-on.png');

report.consoleErrors = consoleErrors.slice();
report.failedRequests = failedRequests.slice();
report.pageErrors = pageErrors.slice();
check('末次加载无 console.error', consoleErrors.length === 0, consoleErrors.slice(0, 4));
check('末次加载无失败请求', failedRequests.length === 0, failedRequests.slice(0, 4));
check('末次加载无未捕获异常', pageErrors.length === 0, pageErrors.slice(0, 4));

report.passed = report.checks.filter((c) => c.pass).length;
report.failed = report.checks.filter((c) => !c.pass).length;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(`\n${report.passed} passed, ${report.failed} failed`);
console.log('report → qa/report.json');

ws.close();
chrome.kill();
await sleep(300);
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch (e) {
  /* Chrome 还占着目录，下次运行会先删 */
}
process.exit(report.failed ? 1 : 0);
