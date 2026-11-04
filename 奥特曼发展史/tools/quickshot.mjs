// Quick screenshot helper: node tools/quickshot.mjs <name> [selector|scrollY] [w] [h]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const name = process.argv[2] || 'shot';
const target = process.argv[3] || '0';
const W = Number(process.argv[4] || 1440);
const H = Number(process.argv[5] || 900);
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const PORT = 9700 + Math.floor(Math.random() * 200);
const profile = path.join(ROOT, '.chrome-quick-' + PORT);
const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const chrome = spawn(CHROME, ['--headless=new', '--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--disable-software-rasterizer', '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl = null;
for (let i = 0; i < 80; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; }
  } catch (e) { /* retry */ }
  await sleep(150);
}
if (!wsUrl) { console.error('chrome not up'); process.exit(1); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 1;
const pending = new Map();
let sid = null;
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    if (m.error) console.error('CDP ERR', JSON.stringify(m.error));
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (method, params = {}, s) => new Promise((res) => {
  const i = id++;
  pending.set(i, res);
  const msg = { id: i, method, params };
  if (s) msg.sessionId = s;
  ws.send(JSON.stringify(msg));
});

const t = await send('Target.createTarget', { url: 'about:blank' });
if (!t || !t.targetId) { console.error('no target'); process.exit(2); }
sid = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 }, sid);
await send('Page.navigate', { url }, sid);
for (let i = 0; i < 80; i++) {
  const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sid);
  if (r.result.value === 'complete') break;
  await sleep(150);
}
await sleep(2400);
await send('Runtime.evaluate', { expression: "document.documentElement.style.scrollBehavior='auto'" }, sid);
if (/^\d+$/.test(target)) await send('Runtime.evaluate', { expression: `window.scrollTo(0,${target})` }, sid);
else await send('Runtime.evaluate', { expression: `(()=>{const el=document.querySelector(${JSON.stringify(target)});if(el){window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90);}})()` }, sid);
if (process.argv[6]) { await send('Runtime.evaluate', { expression: process.argv[6] }, sid); await sleep(500); }
await sleep(900);
const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
fs.writeFileSync(path.join(ROOT, 'qa', name + '.png'), Buffer.from(shot.data, 'base64'));
console.log('saved qa/' + name + '.png');
await send('Browser.close');
ws.close();
chrome.kill();
process.exit(0);
