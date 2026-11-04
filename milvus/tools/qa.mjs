// Headless Chrome QA: boot, console, network, ten stages, parameter changes,
// hash restore, keyboard, modal focus, mobile overflow. Screenshots go to qa/.
// Usage: node tools/qa.mjs   (needs local Chrome or Edge)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'qa');
fs.mkdirSync(OUT, { recursive: true });

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('no chrome');
  process.exit(1);
}

const PORT = 9333 + Math.floor(Math.random() * 300);
const profile = path.join(ROOT, '.chrome-qa');
const url = pathToFileURL(path.join(ROOT, 'index.html')).href;

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
    'about:blank'
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitPort() {
  for (let i = 0; i < 120; i++) {
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
const consoleErrors = [];
const failedRequests = [];
const pageErrors = [];

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
    if (!msg.params.errorText?.includes('net::ERR_ABORTED')) failedRequests.push(msg.params.errorText);
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
    }, 60000);
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}

async function shotElement(selector, name) {
  const rect = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: Math.ceil(r.width), height: Math.ceil(r.height) };
  })()`);
  if (!rect) return;
  const height = Math.min(rect.height, 6000);
  const r = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.width, height, scale: 1 }
  });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log('shot', name, `${rect.width}x${height}`);
}

async function waitReady() {
  const res = await evaluate(`new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      const err = document.querySelector('#stageBody .errorbox');
      if (err) return resolve({ ready: false, error: err.textContent.slice(0, 400) });
      if (window.MILVUS_READY) return resolve({ ready: true, error: '' });
      if (Date.now() - t0 > 25000) return resolve({ ready: false, error: 'timeout' });
      setTimeout(poll, 120);
    })();
  })`);
  if (!res.ready) throw new Error('boot failed: ' + res.error);
}

async function go(n) {
  await evaluate(`MILVUS.app.go(${n})`);
  await sleep(160);
  await evaluate(`document.getElementById('workspace').scrollIntoView({block:'start'})`);
  await sleep(120);
}

const target = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: sid } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
sessionId = sid;
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await waitReady();
await sleep(900);
await evaluate(`document.documentElement.style.scrollBehavior='auto'`);

const report = {};
report.title = await evaluate('document.title');
report.url = url;
report.boot = await evaluate(`({
  ready: !!window.MILVUS_READY,
  stage: MILVUS.app.state.stage,
  chunks: MILVUS.Pipe.getModel(MILVUS.app.state.params).chunks.length,
  docs: MILVUS.data.corpus.CORPUS.docs.length,
  stations: MILVUS.data.milvus.STAGES.length,
  heroStats: [...document.querySelectorAll('#heroStats .hstat')].map(e => e.textContent.replace(/\\s+/g,' ').trim()),
  track: document.querySelectorAll('#track .track__item').length,
  rail: document.querySelectorAll('#rail .rail__item').length,
  hash: location.hash
})`);
report.media = await evaluate(`({w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth})`);
report.hasHorizontalOverflow = report.media.scrollW > report.media.w + 2;

await shot('01-hero.png');

// ten-stage sweep
report.stages = [];
for (let n = 1; n <= 10; n++) {
  await go(n);
  const info = await evaluate(`(() => {
    const S = MILVUS.data.milvus.STAGES[${n}-1];
    const body = document.getElementById('stageBody');
    return {
      n: ${n},
      slug: S.slug,
      title: document.querySelector('.stage__title')?.textContent.replace(/\\s+/g,' ').trim(),
      blocks: body.querySelectorAll('.blk').length,
      lanes: body.querySelectorAll('.lanes .node').length,
      activeLanes: body.querySelectorAll('.lanes .node.is-on').length,
      canvases: body.querySelectorAll('canvas').length,
      tables: body.querySelectorAll('table').length,
      controls: body.querySelectorAll('.ctl').length,
      snippet: !!body.querySelector('.code'),
      error: body.querySelector('.errorbox')?.textContent.slice(0,160) || '',
      sourceLinks: body.querySelectorAll('.sources__link').length,
      hash: location.hash
    };
  })()`);
  report.stages.push(info);
  if (n === 1) await shot('02-chunk.png');
  if (n === 2) await shot('03-embed.png');
  if (n === 5) await shot('05-write.png');
  if ([1, 2, 4, 5, 7, 8, 9, 10].includes(n)) {
    await shotElement('#stage', `stage-${String(n).padStart(2, '0')}.png`);
  }
}

// chunk size -> real chunk count change
report.chunkParam = await evaluate(`(() => {
  MILVUS.app.go(1);
  const before = MILVUS.Pipe.getModel(MILVUS.app.state.params).chunks.length;
  MILVUS.app.set('chunkSize', 300);
  const after = MILVUS.Pipe.getModel(MILVUS.app.state.params).chunks.length;
  const overlap = MILVUS.Pipe.getModel(MILVUS.app.state.params).stats.measuredOverlap;
  MILVUS.app.set('chunkSize', 120);
  return {before, after, overlapAt300: overlap};
})()`);

// ef -> access points / recall change
report.efParam = await evaluate(`(() => {
  MILVUS.app.go(4);
  MILVUS.app.set('ef', 8);
  const a = MILVUS.Pipe.denseSearch(MILVUS.app.state.params);
  const ra = MILVUS.Pipe.getIndex(MILVUS.app.state.params).recallAt(MILVUS.Pipe.queryVectorOf(MILVUS.app.state.params), 5, {ef: 8});
  MILVUS.app.set('ef', 160);
  const b = MILVUS.Pipe.denseSearch(MILVUS.app.state.params);
  const rb = MILVUS.Pipe.getIndex(MILVUS.app.state.params).recallAt(MILVUS.Pipe.queryVectorOf(MILVUS.app.state.params), 5, {ef: 160});
  MILVUS.app.set('ef', 64);
  return {visitedLow: a.visited, visitedHigh: b.visited, recallLow: +ra.toFixed(2), recallHigh: +rb.toFixed(2)};
})()`);

// IVF recall at low nprobe
report.ivf = await evaluate(`(() => {
  MILVUS.app.set('indexType', 'IVF_FLAT');
  const idx = MILVUS.Pipe.getIndex(MILVUS.app.state.params);
  const qv = MILVUS.Pipe.queryVectorOf(MILVUS.app.state.params);
  const low = idx.recallAt(qv, 5, {nprobe: 1});
  const high = idx.recallAt(qv, 5, {nprobe: 8});
  return {recallNprobe1: +low.toFixed(2), recallNprobe8: +high.toFixed(2), buckets: idx.nlist,
    legend: document.querySelector('#stageBody .figure__legend')?.innerText.replace(/\\s+/g,' ') || ''};
})()`);
await go(4);
await shot('04-index.png');
await shotElement('#stage', 'stage-04-ivf.png');
await evaluate(`MILVUS.app.set('indexType', 'HNSW')`);

// pre/post filter
report.filter = await evaluate(`(() => {
  MILVUS.app.go(8);
  MILVUS.app.patch({question:'q1', filter:{dept:'all', updatedFrom:'', acl:'finance'}, filterMode:'post', filterLimit:1});
  const sim = MILVUS.Pipe.filterSimulation(MILVUS.app.state.params);
  return {expression: sim.expression, allowed: sim.allowedCount, pre: sim.pre.items.length, post: sim.post.items.length,
    preHit: sim.preHit, postHit: sim.postHit};
})()`);
await sleep(150);
await shot('06-filter.png');
await shotElement('#stage', 'stage-08-postfilter.png');

// hybrid weights -> fused top changes (q2)
report.hybrid = await evaluate(`(() => {
  MILVUS.app.go(9);
  MILVUS.app.patch({question:'q2', filter:{dept:'all', updatedFrom:'', acl:'all'}, filterMode:'pre'});
  MILVUS.app.set('wDense', 1.0); MILVUS.app.set('wSparse', 0.2);
  const a = MILVUS.Pipe.fused(MILVUS.app.state.params).rows[0].chunk.id;
  MILVUS.app.set('wSparse', 1.6);
  const b = MILVUS.Pipe.fused(MILVUS.app.state.params).rows[0].chunk.id;
  MILVUS.app.set('wDense', 0.8); MILVUS.app.set('wSparse', 1.0);
  return {topDenseHeavy: a, topSparseHeavy: b};
})()`);
await shot('07-hybrid.png');
await shotElement('#stage', 'stage-09-q2.png');

// routing recall with candidate budget
report.route = await evaluate(`(() => {
  MILVUS.app.go(7);
  MILVUS.app.set('cand', 1);
  const a = MILVUS.Pipe.routeSimulation(MILVUS.app.state.params);
  MILVUS.app.set('cand', 5);
  const b = MILVUS.Pipe.routeSimulation(MILVUS.app.state.params);
  return {recallCand1: +a.recall.toFixed(2), recallCand5: +b.recall.toFixed(2), naive: a.naive.map(x=>x.chunk.id)};
})()`);
await sleep(150);
await shot('08-route.png');

// refusal
report.answer = await evaluate(`(() => {
  MILVUS.app.go(10);
  MILVUS.app.patch({question:'q5', filter:{dept:'all', updatedFrom:'', acl:'all'}});
  MILVUS.app.set('threshold', 0.45);
  const a = MILVUS.Pipe.answerOf(MILVUS.app.state.params).answer;
  MILVUS.app.set('threshold', 0.05);
  const b = MILVUS.Pipe.answerOf(MILVUS.app.state.params).answer;
  const refusedCard = document.querySelector('.answer--refuse') !== null;
  MILVUS.app.set('threshold', 0.45);
  return {defaultRefused: a.refused, best: +a.best.toFixed(3), lowThresholdRefused: b.refused, hard: b.hard,
    weakLines: b.lines.filter(l=>!l.supported).length, refusedCard: refusedCard};
})()`);
await shot('09-answer.png');

// timeline visibility table changes with consistency
report.timeline = await evaluate(`(() => {
  MILVUS.app.go(5);
  MILVUS.app.set('batch', 500);
  MILVUS.app.set('consistency', 'Strong');
  const strong = MILVUS.Pipe.writeTimeline(MILVUS.app.state.params);
  MILVUS.app.set('consistency', 'Eventually');
  const eventual = MILVUS.Pipe.writeTimeline(MILVUS.app.state.params);
  const cells = [...document.querySelectorAll('#stageBody table td')].map(t => t.textContent);
  return {phases: strong.phases.length, boundedLag: +strong.levels.Bounded.toFixed(2), eventualLag: +strong.levels.Eventually.toFixed(2),
    tableRows: strong.table.length, total: +strong.total.toFixed(2),
    undefinedCells: cells.filter(t => t.includes('undefined')).length,
    visibleCells: cells.filter(t => t.includes('能看到')).length};
})()`);

// insert button drives the timeline
await evaluate(`MILVUS.app.go(5)`);
await sleep(200);
report.insertPlay = await evaluate(`(async () => {
  const btn = document.querySelector('#stageBody .ctl--button button');
  if (!btn) return {clicked: false};
  btn.click();
  await new Promise(r => setTimeout(r, 700));
  const marker = document.querySelector('.tl__marker');
  const left = marker ? marker.style.left : '';
  const playing = document.querySelector('.btn--play')?.classList.contains('is-playing');
  return {clicked: true, markerLeft: left, playing};
})()`);

// embedding normalization: COSINE vs IP ordering
report.normalize = await evaluate(`(() => {
  MILVUS.app.go(2);
  MILVUS.app.patch({normalize: true, question: 'q1', filter: {dept:'all', updatedFrom:'', acl:'all'}});
  const m = MILVUS.Pipe.getModel(MILVUS.app.state.params);
  const e = m.embedder;
  const qv = MILVUS.Pipe.queryVectorOf(MILVUS.app.state.params);
  const top = (fn) => m.chunks.map((c,i) => ({id:c.id, s:fn(qv, m.vectors[i])})).sort((a,b)=>b.s-a.s).slice(0,5).map(x=>x.id);
  const cos1 = top(e.cosine); const ip1 = top(e.dot);
  MILVUS.app.set('normalize', false);
  const m2 = MILVUS.Pipe.getModel(MILVUS.app.state.params);
  const qv2 = MILVUS.Pipe.queryVectorOf(MILVUS.app.state.params);
  const top2 = (fn) => m2.chunks.map((c,i) => ({id:c.id, s:fn(qv2, m2.vectors[i])})).sort((a,b)=>b.s-a.s).slice(0,5).map(x=>x.id);
  const cos2 = top2(m2.embedder.cosine); const ip2 = top2(m2.embedder.dot);
  MILVUS.app.set('normalize', true);
  return {normSame: cos1.join()===ip1.join(), unnormSame: cos2.join()===ip2.join(), cos2, ip2};
})()`);

// BM25 off removes the sparse path in stage 9
report.bm25Off = await evaluate(`(() => {
  MILVUS.app.go(9);
  MILVUS.app.set('bm25', false);
  const f = MILVUS.Pipe.fused(MILVUS.app.state.params);
  const notice = document.querySelector('#stageBody .callout--warn')?.textContent || '';
  MILVUS.app.set('bm25', true);
  return {sparse: f.sparse.length, rows: f.rows.length, notice: notice.slice(0, 40)};
})()`);

// dimension mismatch error card
report.mismatch = await evaluate(`(() => {
  MILVUS.app.go(6);
  MILVUS.app.set('dimMismatch', true);
  const card = document.querySelector('#stageBody .errorbox');
  const title = card?.querySelector('.errorbox__title')?.textContent || '';
  const code = card?.querySelector('.errorbox__code')?.textContent || '';
  MILVUS.app.set('dimMismatch', false);
  return {hasCard: !!card, title, code};
})()`);

// context budget truncation
report.budget = await evaluate(`(() => {
  MILVUS.app.go(10);
  MILVUS.app.patch({question:'q1', threshold: 0.45, filter:{dept:'all', updatedFrom:'', acl:'all'}});
  MILVUS.app.set('budget', 200);
  const a = MILVUS.Pipe.answerOf(MILVUS.app.state.params);
  MILVUS.app.set('budget', 1400);
  const b = MILVUS.Pipe.answerOf(MILVUS.app.state.params);
  return {usedLow: a.context.used, truncLow: a.context.truncated, usedHigh: b.context.used, truncHigh: b.context.truncated,
    bar: !!document.querySelector('.cbar')};
})()`);

// citation button jumps back to chunk 1 station and highlights
report.citation = await evaluate(`(() => {
  MILVUS.app.go(10);
  MILVUS.app.patch({question:'q1', threshold: 0.45, filter:{dept:'all', updatedFrom:'', acl:'all'}});
  const btn = document.querySelector('#stageBody .chunkref');
  if (!btn) return {hasButton: false};
  const id = btn.dataset.id;
  btn.click();
  return {hasButton: true, id, stage: MILVUS.app.state.stage,
    highlighted: !!document.querySelector('#stageBody .chunk.is-on'),
    docHit: !!document.querySelector('#stageBody .dochit')};
})()`);

// keyboard arrow
report.keyboard = await evaluate(`(() => {
  MILVUS.app.go(3);
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true}));
  return {stage: MILVUS.app.state.stage};
})()`);

// space toggles autoplay
report.autoplay = await evaluate(`(async () => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key:' ', bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  const on = document.getElementById('btnAuto').classList.contains('is-on');
  document.body.dispatchEvent(new KeyboardEvent('keydown', {key:' ', bubbles:true}));
  await new Promise(r => setTimeout(r, 120));
  const off = !document.getElementById('btnAuto').classList.contains('is-on');
  return {on, off};
})()`);

// hash restore (reload)
report.hashSet = await evaluate(`(() => {
  location.hash = '#index?M=24&size=160';
  return location.hash;
})()`);
await sleep(400);
await send('Page.reload', { ignoreCache: true });
await waitReady();
await sleep(600);
report.hashRestore = await evaluate(`({
  stage: MILVUS.app.state.stage,
  M: MILVUS.app.state.params.M,
  size: MILVUS.app.state.params.chunkSize,
  hash: location.hash
})`);

// modal Esc + focus restore
report.modal = await evaluate(`(() => {
  const btn = document.getElementById('btnAbout');
  btn.focus();
  btn.click();
  const opened = document.getElementById('about').classList.contains('is-open');
  const locked = document.body.classList.contains('is-locked');
  const focused = document.activeElement?.className;
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
  return {opened, locked, focused, closed: !document.getElementById('about').classList.contains('is-open'),
    restored: document.activeElement === btn};
})()`);

report.externalResources = await evaluate(
  `performance.getEntriesByType('resource').map(e=>e.name).filter(n=>!n.startsWith('file:') && !n.startsWith('data:'))`
);

// mobile
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.reload', { ignoreCache: true });
await waitReady();
await sleep(900);
report.mobile = await evaluate(`({
  scrollW: document.documentElement.scrollWidth,
  innerW: innerWidth,
  overflow: document.documentElement.scrollWidth > innerWidth + 2,
  stage: MILVUS.app.state.stage,
  railScroll: document.querySelector('.rail')?.scrollWidth > document.querySelector('.rail')?.clientWidth,
  heroTitle: document.querySelector('.hero__title')?.textContent.slice(0, 20)
})`);
await evaluate(`window.scrollTo(0, 0)`);
await sleep(250);
await shot('10-mobile.png');
await evaluate(`MILVUS.app.go(8); window.scrollTo(0, document.getElementById('workspace').offsetTop)`);
await sleep(500);
report.mobileStage = await evaluate(`({
  overflow: document.documentElement.scrollWidth > innerWidth + 2,
  scrollW: document.documentElement.scrollWidth,
  innerW: innerWidth,
  blocks: document.querySelectorAll('#stageBody .blk').length,
  tables: document.querySelectorAll('#stageBody table').length
})`);
await shot('11-mobile-filter.png');
await evaluate(`MILVUS.app.go(5)`);
await sleep(400);
await shot('12-mobile-write.png');

report.consoleErrors = consoleErrors;
report.failedRequests = failedRequests;
report.pageErrors = pageErrors;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

const failures = [];
if (consoleErrors.length) failures.push('consoleErrors: ' + consoleErrors.length);
if (failedRequests.length) failures.push('failedRequests: ' + failedRequests.length);
if (pageErrors.length) failures.push('pageErrors: ' + pageErrors.length);
if (report.hasHorizontalOverflow) failures.push('desktop horizontal overflow');
if (report.mobile.overflow || report.mobileStage.overflow) failures.push('mobile horizontal overflow');
if (report.stages.some((s) => s.blocks !== 4 || s.error)) failures.push('stage block/error');
if (report.stages.length !== 10) failures.push('stage count');
if (report.chunkParam.before === report.chunkParam.after) failures.push('chunk size did not change count');
if (report.efParam.visitedLow === report.efParam.visitedHigh) failures.push('ef did not change visited');
if (report.filter.pre <= report.filter.post) failures.push('post-filter did not shrink result');
if (report.timeline.undefinedCells > 0) failures.push('timeline table has undefined cells');
if (report.timeline.visibleCells === 0) failures.push('timeline visibility cells empty');
if (report.hybrid.topDenseHeavy === report.hybrid.topSparseHeavy) failures.push('weights did not change fused top');
if (!report.answer.defaultRefused || report.answer.lowThresholdRefused) failures.push('refusal threshold');
if (!report.normalize.normSame || report.normalize.unnormSame) failures.push('normalization ordering');
if (report.bm25Off.sparse !== 0) failures.push('bm25 off still has sparse path');
if (!report.mismatch.hasCard) failures.push('dimension mismatch card');
if (!report.budget.truncLow || report.budget.truncHigh) failures.push('context budget truncation');
if (!report.citation.hasButton || report.citation.stage !== 1 || !report.citation.docHit) failures.push('citation jump');
if (!report.insertPlay.playing) failures.push('insert button did not play timeline');
if (!report.autoplay.on || !report.autoplay.off) failures.push('space autoplay toggle');
if (report.hashRestore.stage !== 4 || report.hashRestore.M !== 24) failures.push('hash restore');
if (!report.modal.opened || !report.modal.closed || !report.modal.restored) failures.push('modal focus');

console.log(JSON.stringify(report, null, 2));
console.log('\nscreenshots in qa/');
if (failures.length) {
  console.error('\nQA FAILURES:\n- ' + failures.join('\n- '));
  await send('Browser.close').catch(() => {});
  ws.close();
  chrome.kill();
  process.exit(1);
}
console.log('\nQA PASS');

await send('Browser.close').catch(() => {});
ws.close();
chrome.kill();
process.exit(0);
