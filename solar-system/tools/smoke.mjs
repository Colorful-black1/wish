// 快速冒烟：开无头 Chrome 加载一帧，把控制台、着色器编译日志和状态打出来。
// 用法：cd solar-system && node tools/smoke.mjs [query]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'qa');
fs.mkdirSync(OUT, { recursive: true });
const QUERIES =
  process.argv.length > 2
    ? process.argv.slice(2)
    : ['?shot=1&focus=jupiter&date=2026-11-04&scale=orrery&ui=1&dpr=1'];

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('no chrome');
  process.exit(1);
}

const PORT = 9400 + Math.floor(Math.random() * 300);
const profile = path.join(ROOT, '.chrome-qa');
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch (e) {
  /* 上一次的 Chrome 还没退干净，换一个目录名继续 */
  console.warn('profile cleanup skipped:', e.code);
}

/* 只允许 GPU：不再提供 SwiftShader 回退。 */
const GPU_ARGS = ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--disable-software-rasterizer'];

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
    ...GPU_ARGS,
    '--force-device-scale-factor=1',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 160; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) {
      wsUrl = (await r.json()).webSocketDebuggerUrl;
      break;
    }
  } catch (e) {}
  await sleep(150);
}
if (!wsUrl) {
  console.error('chrome did not start');
  chrome.kill();
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  ws.addEventListener('open', res);
  ws.addEventListener('error', rej);
});

let nextId = 1;
const pending = new Map();
let sessionId = null;
const logs = [];

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
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push('[' + msg.params.type + '] ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push('[exception] ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  }
  if (msg.method === 'Log.entryAdded') {
    logs.push('[' + msg.params.entry.level + '] ' + msg.params.entry.text);
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
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) return { __error: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result.value;
}

const t = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: sid } = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
sessionId = sid;
await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(process.env.SMOKE_W || 1440),
  height: Number(process.env.SMOKE_H || 900),
  deviceScaleFactor: Number(process.env.SMOKE_DPR || 1),
  mobile: false,
});

const base = pathToFileURL(path.join(ROOT, 'index.html')).href;
let idx = 0;
for (const QUERY of QUERIES) {
  const url = base + QUERY;
  await send('Page.navigate', { url });
  await sleep(260);

  const status = await evaluate(`new Promise((resolve) => {
    const t0 = Date.now();
    (function poll() {
      if (window.__HELIOS_READY) return resolve('ready');
      const fb = document.getElementById('fallback');
      if (fb && !fb.hasAttribute('hidden')) return resolve('FALLBACK: ' + fb.textContent.slice(0, 1200));
      if (Date.now() - t0 > 45000) return resolve('timeout');
      setTimeout(poll, 100);
    })();
  })`);
  console.log(`[${idx}] ${QUERY}\n    status: ${status}`);

  if (idx === 0 || QUERY.includes('overview')) {
    const probe = await evaluate(`(() => {
      const c = document.getElementById('gl');
      const gl = c.getContext('webgl2');
      return {
        canvas: c ? [c.width, c.height] : null,
        floatColor: gl ? !!gl.getExtension('EXT_color_buffer_float') : null,
        stars: window.HELIOS_APP ? window.HELIOS_APP.starCount : 0,
        app: window.HELIOS_APP ? { focus: window.HELIOS_APP.state.focus, scale: window.HELIOS_APP.state.scale, dist: window.HELIOS_APP.cam.dist } : null,
      };
    })()`);
    console.log('    probe:', JSON.stringify(probe));
  }
  const dbg = await evaluate(`window.HELIOS_DEBUG || null`);
  if (dbg) console.log('    debug:', JSON.stringify(dbg));
  if (process.env.SMOKE_EVAL) {
    const val = await evaluate(process.env.SMOKE_EVAL);
    console.log('    eval:', JSON.stringify(val));
  }
  if (process.env.SMOKE_DOM) {
    const dom = await evaluate(`(() => {
      const out = [];
      const pts = [[0.62,0.62],[0.8,0.7],[0.9,0.8],[0.5,0.5],[0.75,0.9]];
      for (const [fx, fy] of pts) {
        const x = Math.round(innerWidth * fx), y = Math.round(innerHeight * fy);
        const els = document.elementsFromPoint(x, y).map((e) => e.id || e.className || e.tagName).slice(0, 4);
        out.push({ at: [x, y], els });
      }
      const rects = {};
      for (const id of ['gl','stage','panel','hud','trailInset','console','readout','trueWarning','hint','odometer']) {
        const e = document.getElementById(id);
        if (!e) continue;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        rects[id] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
          hidden: e.hasAttribute('hidden'), display: cs.display, bg: cs.backgroundColor, op: cs.opacity, bf: cs.backdropFilter || cs.webkitBackdropFilter };
      }
      return { vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, canvasCss: [document.getElementById('gl').clientWidth, document.getElementById('gl').clientHeight], canvasBuf: [document.getElementById('gl').width, document.getElementById('gl').height], pts: out, rects };
    })()`);
    console.log('    dom:', JSON.stringify(dom));
  }

  await sleep(420);
  const png = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, `smoke-${idx}.png`), Buffer.from(png.data, 'base64'));
  console.log(`    shot: qa/smoke-${idx}.png`);
  idx++;
}

console.log('\n--- console ---');
logs.slice(0, 60).forEach((l) => console.log(l));

ws.close();
chrome.kill();
await sleep(200);
try {
  fs.rmSync(profile, { recursive: true, force: true });
} catch (e) {
  /* Chrome 还占着目录，下次运行会先删 */
}
process.exit(0);
