// Headless Chrome QA: console errors, counts, interactions, screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'qa');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no chrome'); process.exit(1); }

const PORT = 9333 + Math.floor(Math.random() * 200);
const profile = path.join(ROOT, '.chrome-qa');
const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio',
  '--allow-file-access-from-files',
  '--force-device-scale-factor=1',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${PORT}`,
  '--window-size=1440,900',
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch (e) { /* retry */ }
    await sleep(150);
  }
  throw new Error('chrome did not start');
}

const wsUrl = await waitPort();
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });

let nextId = 1;
const pending = new Map();
let sessionId = null;
const consoleErrors = [];
const failedRequests = [];

ws.addEventListener('message', (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch (e) { return; }
  if (msg.id) {
    const p = pending.get(msg.id);
    if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push('EXCEPTION: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    consoleErrors.push('LOG: ' + msg.params.entry.text);
  }
  if (msg.method === 'Network.loadingFailed') failedRequests.push(msg.params.errorText);
});

function send(method, params = {}, sid = sessionId) {
  const id = nextId++;
  const payload = { id, method, params };
  if (sid) payload.sessionId = sid;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(payload));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('timeout ' + method)); } }, 45000);
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name, opts = {}) {
  const params = { format: 'png' };
  if (opts.clip) { params.clip = opts.clip; params.captureBeyondViewport = true; }
  const r = await send('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}

const target = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: sid } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
sessionId = sid;
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
for (let i = 0; i < 100; i++) {
  const ready = await evaluate('document.readyState');
  if (ready === 'complete') break;
  await sleep(120);
}
await evaluate('document.fonts.ready.then(()=>true)');
await sleep(2200);
await evaluate("document.documentElement.style.scrollBehavior='auto'");

const report = {};
report.title = await evaluate('document.title');
report.scrollHeight = await evaluate('document.documentElement.scrollHeight');
report.counts = await evaluate(`({
  works: document.querySelectorAll('.wcard').length,
  phaseBlocks: document.querySelectorAll('.phase-block').length,
  visibleWorks: [...document.querySelectorAll('.wcard')].filter(e=>!e.hidden).length,
  heroCards: document.querySelectorAll('.hcard').length,
  eventRows: document.querySelectorAll('.ev-card').length,
  factionCards: document.querySelectorAll('.fcard').length,
  battleCards: document.querySelectorAll('.bcard').length,
  relItems: document.querySelectorAll('.rel-item').length,
  worldChips: document.querySelectorAll('.world-col .works button').length,
  sections: document.querySelectorAll('main section').length,
  svgs: document.querySelectorAll('svg').length
})`);
report.statsText = await evaluate(`[...document.querySelectorAll('#heroStats .stat b')].map(e=>e.textContent.trim()).join(' | ')`);
report.metrics = await evaluate(`({w:innerWidth,h:innerHeight,scrollW:document.documentElement.scrollWidth})`);
report.hasHorizontalOverflow = report.metrics.scrollW > report.metrics.w + 2;

/* hero viewport */
await evaluate('window.scrollTo(0,0)');
await sleep(400);
await shot('01-hero.png');

/* history */
await evaluate(`document.getElementById('history').scrollIntoView()`);
await sleep(800);
await shot('02-history.png');

/* filter interaction: search 迪迦 */
report.filterTest = await evaluate(`(async()=>{
  const inp=document.getElementById('workSearch');
  inp.value='迪迦'; inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,420));
  const visible=[...document.querySelectorAll('.wcard')].filter(e=>!e.hidden);
  return {count: visible.length, label: document.getElementById('workCount').textContent,
    titles: visible.map(e=>e.querySelector('.wcard-title').textContent)};
})()`);
await shot('03-filter.png');
report.resetTest = await evaluate(`(async()=>{
  document.getElementById('workReset').click();
  await new Promise(r=>setTimeout(r,300));
  return {visible:[...document.querySelectorAll('.wcard')].filter(e=>!e.hidden).length};
})()`);

/* year jump */
report.yearJump = await evaluate(`(async()=>{
  document.querySelector('.year[data-year="2021"]').click();
  await new Promise(r=>setTimeout(r,900));
  const c=document.querySelector('.wcard[data-year="2021"]');
  return {exists:!!c, rectTop: c?Math.round(c.getBoundingClientRect().top):null};
})()`);

/* chronicle */
await evaluate(`document.getElementById('chronicle').scrollIntoView()`);
await sleep(700);
await shot('04-chronicle.png');
report.chronicleSwitch = await evaluate(`(async()=>{
  document.querySelector('.era-tab[data-era="4"]').click();
  await new Promise(r=>setTimeout(r,350));
  return {rows:document.querySelectorAll('.ev-card').length, panel:document.getElementById('eraPanel').textContent.slice(0,60)};
})()`);

/* heroes */
await evaluate(`document.getElementById('heroes').scrollIntoView()`);
await sleep(700);
await shot('05-heroes.png');
report.heroFilter = await evaluate(`(async()=>{
  document.querySelector('[data-herera="昭和"]').click();
  await new Promise(r=>setTimeout(r,300));
  return {visible:[...document.querySelectorAll('.hcard')].filter(e=>!e.hidden).length, count:document.getElementById('heroCount').textContent};
})()`);
await evaluate(`document.querySelector('[data-herera="all"]').click()`);

/* factions + battles */
await evaluate(`document.getElementById('factions').scrollIntoView()`);
await sleep(600);
await shot('06-factions.png');
await evaluate(`document.getElementById('battles').scrollIntoView()`);
await sleep(600);
await shot('07-battles.png');
await evaluate(`document.getElementById('index').scrollIntoView()`);
await sleep(600);
await shot('08-index.png');

/* modal: work */
report.modalWork = await evaluate(`(async()=>{
  App.openEntity('work','tiga');
  await new Promise(r=>setTimeout(r,700));
  return {open:document.getElementById('modal').classList.contains('open'),
    title:document.getElementById('mdlTitle').textContent,
    sections:document.querySelectorAll('.mdl-sec').length,
    bodyLocked:document.body.classList.contains('locked'),
    h: document.querySelector('.mdl').getBoundingClientRect().height};
})()`);
await shot('09-modal-work.png');

/* related jump */
report.modalJump = await evaluate(`(async()=>{
  const chip=document.querySelector('.mdl-body [data-open="event"]');
  if(!chip) return {ok:false};
  chip.click();
  await new Promise(r=>setTimeout(r,600));
  return {ok:true,title:document.getElementById('mdlTitle').textContent, back:!!document.querySelector('[data-back]')};
})()`);
await shot('10-modal-event.png');
report.back = await evaluate(`(async()=>{
  const b=document.querySelector('[data-back]'); if(!b) return {ok:false};
  b.click(); await new Promise(r=>setTimeout(r,500));
  return {ok:true,title:document.getElementById('mdlTitle').textContent};
})()`);

/* favourite */
report.fav = await evaluate(`(async()=>{
  const f=document.querySelector('[data-fav]');
  if(!f) return {ok:false};
  f.click(); await new Promise(r=>setTimeout(r,250));
  return {ok:true, badge:document.getElementById('favCount').textContent,
   saved:document.querySelector('[data-fav]').classList.contains('saved'),
   ls: localStorage.getItem('ua_fav')};
})()`);
report.close = await evaluate(`(async()=>{
  App.closeModal(); await new Promise(r=>setTimeout(r,450));
  return {open:document.getElementById('modal').classList.contains('open'), locked:document.body.classList.contains('locked')};
})()`);

/* hero modal */
await evaluate(`App.openEntity('hero','zero')`);
await sleep(700);
await shot('11-modal-hero.png');
await evaluate(`App.closeModal()`);

/* palette */
report.palette = await evaluate(`(async()=>{
  document.getElementById('btnSearch').click();
  await new Promise(r=>setTimeout(r,250));
  const inp=document.getElementById('paletteInput');
  inp.value='迪迦'; inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  return {open:document.getElementById('palette').classList.contains('open'),
    results:document.querySelectorAll('.pitem').length};
})()`);
await shot('12-palette.png');
await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
await sleep(300);

/* drawer */
await evaluate(`document.getElementById('btnDrawer').click()`);
await sleep(500);
report.drawer = await evaluate(`({open:document.getElementById('drawer').classList.contains('open'), items:document.querySelectorAll('.d-item').length, stat:document.getElementById('drawerStat').textContent})`);
await shot('13-drawer.png');
await evaluate(`document.querySelector('[data-dclose]').click()`);
await sleep(300);

/* full page + mobile */
const layout = await send('Page.getLayoutMetrics');
const cs = layout.cssContentSize;
await shot('14-full.png', { clip: { x: 0, y: 0, width: cs.width, height: cs.height, scale: 0.42 } });

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.reload', { ignoreCache: true });
await sleep(2400);
await evaluate('window.scrollTo(0,0)');
await sleep(400);
report.mobile = await evaluate(`({scrollW:document.documentElement.scrollWidth, w:innerWidth, navHidden:getComputedStyle(document.querySelector('.nav')).display})`);
await shot('15-mobile-hero.png');
await evaluate(`document.getElementById('heroes').scrollIntoView()`);
await sleep(600);
await shot('16-mobile-heroes.png');

report.consoleErrors = consoleErrors;
report.failedRequests = failedRequests;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await send('Browser.close').catch(() => {});
ws.close();
chrome.kill();
process.exit(0);
