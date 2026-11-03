// Headless Chrome QA: boot, console errors, counts, interaction paths, screenshots.
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

const PORT = 9333 + Math.floor(Math.random() * 200);
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
        (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || JSON.stringify(msg.params.exceptionDetails))
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

async function shot(name, opts = {}) {
  const params = { format: 'png' };
  if (opts.clip) {
    params.clip = opts.clip;
    params.captureBeyondViewport = true;
  }
  const r = await send('Page.captureScreenshot', params);
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.data, 'base64'));
  console.log('shot', name);
}

async function waitReady(timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const state = await evaluate(`({
        ready: !!window.LLM_READY,
        error: document.querySelector('.boot__text.is-error')?.textContent || '',
        readyState: document.readyState
      })`);
      if (state.error) throw new Error(state.error);
      if (state.ready) return true;
    } catch (e) {
      if (String(e.message).includes('WebGL') || String(e.message).includes('3D')) throw e;
    }
    await sleep(300);
  }
  const bootText = await evaluate(`document.getElementById('bootText')?.textContent`);
  throw new Error('LLM_READY timeout; boot=' + bootText);
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
await sleep(1600);
await evaluate(`document.documentElement.style.scrollBehavior='auto'`);

const report = {};
report.title = await evaluate('document.title');
report.url = url;
report.boot = await evaluate(`({
  ready: !!window.LLM_READY,
  stage: LLM.app.stage,
  mode: LLM.app.mode,
  webgl: !!(LLM.app.scene && LLM.app.scene.ok),
  renderer: LLM.app.scene ? LLM.app.scene.renderer.getContext().getParameter(LLM.app.scene.renderer.getContext().VERSION) : null,
  drawCalls: LLM.app.scene ? LLM.app.scene.renderer.info.render.calls : null,
  triangles: LLM.app.scene ? LLM.app.scene.renderer.info.render.triangles : null,
  bloom: !!(LLM.app.scene && LLM.app.scene.composer)
})`);
report.counts = await evaluate(`({
  stages: document.querySelectorAll('.rail__item').length,
  labels: document.querySelectorAll('.lbl3d').length,
  knowledge: LLM.KNOWLEDGE.length,
  knowledgeGroups: LLM.KNOWLEDGE_GROUPS.length,
  stations: LLM.app.pipeline.stations.length,
  tokens: LLM.app.tokens.length,
  stageTitle: document.getElementById('cardTitle')?.textContent || document.querySelector('.sp-head h2')?.textContent || '',
  panelSections: document.querySelectorAll('.sp-sec').length,
  notes: document.querySelectorAll('.sp-note').length,
  canvas: (() => { const c = document.getElementById('view'); return { w: c.clientWidth, h: c.clientHeight }; })()
})`);
report.metrics = await evaluate(`({ w: innerWidth, h: innerHeight, scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight })`);
report.hasHorizontalOverflow = report.metrics.scrollW > report.metrics.w + 2;
report.tokenStats = await evaluate(`LLM.Mech.stats(LLM.Mech.tokenize(LLM.DEMO.question))`);

await shot('01-overview.png');

// 13 站逐个进入，捕获渲染异常
report.stageSweep = await evaluate(`(async()=>{
  const out=[];
  LLM.app.playing=false; LLM.app.ui.setPlaying(false);
  for (let n=1;n<=13;n++){
    LLM.app.selectStage(n,{focus:true});
    await new Promise(r=>setTimeout(r,340));
    const stage = LLM.getStage(n);
    out.push({
      n,
      title: document.querySelector('.sp-head h2')?.textContent.replace(/\\s+/g,' ').trim(),
      dyn: !!document.getElementById('spDyn'),
      labelsVisible: [...document.querySelectorAll('.lbl3d')].filter(e=>e.style.display!=='none' && !e.classList.contains('is-hidden')).length,
      stationVisible: !!LLM.app.pipeline.stations[n-1].group.visible,
      towerVisible: LLM.app.transformer.group.visible,
      mode: LLM.app.mode
    });
  }
  return out;
})()`);

// 播放推进与暂停
report.playback = await evaluate(`(async()=>{
  LLM.app.ui.setMode('flow');
  LLM.app.selectStage(1,{focus:true});
  LLM.app.togglePlay();
  await new Promise(r=>setTimeout(r,800));
  const playing=LLM.app.playing;
  LLM.app.stageProgress=0.999;
  await new Promise(r=>setTimeout(r,1200));
  LLM.app.playing=false; LLM.app.ui.setPlaying(false);
  return {started:playing, stage:LLM.app.stage, progress:LLM.app.stageProgress,
    now:document.getElementById('nowStage').textContent};
})()`);

report.stage1 = await evaluate(`(async()=>{
  LLM.app.selectStage(1,{focus:true});
  await new Promise(r=>setTimeout(r,1800));
  return {stage:LLM.app.stage, camera: LLM.app.scene.camera.position.toArray().map(n=>+n.toFixed(2)),
    panelTitle: document.querySelector('.sp-head h2')?.textContent,
    contextChips: LLM.app.pipeline.stations[0].props.contextChips.length,
    stationVisible: LLM.app.pipeline.stations[0].group.visible,
    otherStationsVisible: LLM.app.pipeline.stations.filter(s=>s.group.visible).length};
})()`);
await shot('02-stage1.png');

// attention
report.attention = await evaluate(`(async()=>{
  LLM.app.playing=false; LLM.app.ui.setPlaying(false);
  LLM.app.selectStage(6,{focus:true});
  await new Promise(r=>setTimeout(r,1900));
  LLM.app.setAttentionToken(3);
  await new Promise(r=>setTimeout(r,500));
  const att = LLM.app.attention.attention;
  return {rows: att.weights.length, cols: att.weights[0].length,
    rowSum: +att.weights[3].reduce((a,b)=>a+b,0).toFixed(4),
    active: LLM.app.activeToken,
    topPair: att.pairs[0],
    matrixCells: document.querySelectorAll('.heat i').length,
    queryChips: document.querySelectorAll('[data-attn]').length,
    panelTitle: document.querySelector('.sp-head h2')?.textContent};
})()`);
await shot('03-attention.png');

// sampling
report.sampling = await evaluate(`(async()=>{
  LLM.app.selectStage(10,{focus:true});
  await new Promise(r=>setTimeout(r,1600));
  LLM.app.previewSampling({temperature:1.4, topK:3, topP:0.8});
  await new Promise(r=>setTimeout(r,500));
  const d = LLM.app.distribution;
  return {temperature:d.temperature, topK:d.topK, topP:d.topP,
    kept:d.kept.filter(Boolean).length, sum:+d.final.reduce((a,b)=>a+b,0).toFixed(4),
    probsSum:+d.probs.reduce((a,b)=>a+b,0).toFixed(4),
    pick: LLM.DEMO.vocab[d.pick].token,
    sampleToken: (()=>{ const g=LLM.app.pipeline.stations[9].props.sampleToken; return g.children.length; })(),
    slider: document.getElementById('tempRange')?.value};
})()`);
await shot('04-sampling.png');

// transformer
report.transformer = await evaluate(`(async()=>{
  LLM.app.selectStage(5,{focus:true});
  await new Promise(r=>setTimeout(r,1900));
  const visible = [...document.querySelectorAll('.lbl3d')].filter(e=>e.style.display!=='none' && !e.classList.contains('is-hidden')).length;
  return {exploded: LLM.app.transformer.exploded, layers: LLM.app.transformer.layers.length,
    labelsVisible: visible, camera: LLM.app.scene.camera.position.toArray().map(n=>+n.toFixed(2)),
    activeLayer: LLM.app.transformer.activeIndex};
})()`);
await shot('05-transformer.png');

// knowledge
report.knowledge = await evaluate(`(async()=>{
  LLM.app.setMode('knowledge');
  await new Promise(r=>setTimeout(r,1200));
  const items = document.querySelectorAll('.kb-item').length;
  const inp = document.getElementById('kbSearch');
  inp.value='注意力'; inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,350));
  const filtered = document.querySelectorAll('.kb-item').length;
  document.querySelector('.kb-item')?.click();
  await new Promise(r=>setTimeout(r,350));
  return {items, filtered, detailTitle: document.querySelector('.kc-head h2')?.textContent,
    detailSections: document.querySelectorAll('.kc-sec').length,
    panelTab: LLM.app.ui.state.panelTab};
})()`);
await shot('06-knowledge.png');

// infra
report.infra = await evaluate(`(async()=>{
  LLM.app.setMode('infra');
  await new Promise(r=>setTimeout(r,1900));
  const before={mode: LLM.app.mode, nodes: LLM.app.infra.nodes.length,
    panel: document.querySelector('.kc-head h2')?.textContent,
    camera: LLM.app.scene.camera.position.toArray().map(n=>+n.toFixed(2)),
    labelsVisible: LLM.app.infra.labelEls.filter(e=>e.style.display!=='none').length,
    pipelineHidden: !LLM.app.pipeline.group.visible};
  LLM.app.focusInfra('gpu-cuda');
  await new Promise(r=>setTimeout(r,700));
  return Object.assign(before, {detailTitle: document.querySelector('.kc-head h2')?.textContent,
    active: LLM.app.infra.active, activeLabel: document.querySelector('.lbl3d.is-infra.is-active')?.textContent.slice(0,8)});
})()`);
await shot('07-infra.png');

// custom
report.custom = await evaluate(`(async()=>{
  LLM.app.setMode('flow');
  LLM.app.runCustom('为什么注意力需要 Q、K、V？');
  await new Promise(r=>setTimeout(r,1600));
  const t = LLM.app.tokens;
  return {stage: LLM.app.stage, playing: LLM.app.playing, tokens: t.length,
    tokenTexts: t.slice(0,8).map(x=>x.text), question: LLM.app.question,
    attentionRows: LLM.app.attention.attention.weights.length,
    answerStart: LLM.app.customAnswer.slice(0,24),
    otherStationsVisible: LLM.app.pipeline.stations.filter(s=>s.group.visible).length,
    barVisible: !document.getElementById('pad').classList.contains('is-closed')};
})()`);
await shot('08-custom.png');

// finish + pad streaming
report.finish = await evaluate(`(async()=>{
  LLM.app.playing=false; LLM.app.ui.setPlaying(false);
  LLM.app.enterStage(13,{focus:true, progress:0.92});
  LLM.app.finish();
  await new Promise(r=>setTimeout(r,2200));
  return {finished: LLM.app.finished, message: document.querySelectorAll('.msg').length,
    aiText: document.querySelector('.msg--ai .msg__bubble')?.textContent.slice(0,30),
    padOpen: !document.getElementById('pad').classList.contains('is-closed')};
})()`);
await shot('09-finish.png');

// console / network after desktop flows
report.externalResources = await evaluate(`performance.getEntriesByType('resource').map(e=>e.name).filter(n=>!n.startsWith('file:') && !n.startsWith('data:'))`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.reload', { ignoreCache: true });
await waitReady();
await sleep(2400);
report.mobile = await evaluate(`({
  scrollW: document.documentElement.scrollWidth,
  scrollH: document.documentElement.scrollHeight,
  innerW: innerWidth, innerH: innerHeight,
  hasHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
  railVisible: getComputedStyle(document.querySelector('.rail')).display,
  panelClosed: document.getElementById('panel').classList.contains('is-closed'),
  stage: LLM.app.stage, webgl: LLM.app.scene && LLM.app.scene.ok
})`);
await shot('10-mobile.png');
await evaluate(`document.getElementById('btnPanelOpen').click()`);
await sleep(500);
report.mobilePanel = await evaluate(`({
  open: !document.getElementById('panel').classList.contains('is-closed'),
  h: Math.round(document.getElementById('panel').getBoundingClientRect().height),
  overflow: document.documentElement.scrollWidth > innerWidth + 2
})`);
await shot('11-mobile-panel.png');
await evaluate(`LLM.app.ui.closePanel(); LLM.app.selectStage(6,{focus:true})`);
await sleep(1600);
await shot('12-mobile-attention.png');

report.consoleErrors = consoleErrors;
report.failedRequests = failedRequests;
report.pageErrors = pageErrors;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

console.log(JSON.stringify(report, null, 2));
console.log('\nscreenshots in qa/');

await send('Browser.close').catch(() => {});
ws.close();
chrome.kill();
process.exit(0);
