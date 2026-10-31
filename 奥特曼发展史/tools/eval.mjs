// Evaluate an expression in the built page: node tools/eval.mjs "<js>" [w] [h]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const expr = process.argv[2] || 'document.title';
const W = Number(process.argv[3] || 1440);
const H = Number(process.argv[4] || 900);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const PORT = 9900 + Math.floor(Math.random() * 90);
const profile = path.join(ROOT, '.chrome-eval');
const url = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--allow-file-access-from-files', `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 80; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; } } catch (e) {}
  await sleep(150);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 1; const pending = new Map(); let sid = null;
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params = {}, s) => new Promise((res) => { const i = id++; pending.set(i, res); const msg = { id: i, method, params }; if (s) msg.sessionId = s; ws.send(JSON.stringify(msg)); });
const t = await send('Target.createTarget', { url: 'about:blank' });
sid = (await send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
await send('Page.enable', {}, sid); await send('Runtime.enable', {}, sid);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sid);
await send('Page.navigate', { url }, sid);
for (let i = 0; i < 80; i++) { const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sid); if (r.result.value === 'complete') break; await sleep(150); }
await sleep(2200);
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
if (r.exceptionDetails) console.log('EXCEPTION', JSON.stringify(r.exceptionDetails, null, 2));
else console.log(JSON.stringify(r.result.value, null, 2));
await send('Browser.close'); ws.close(); chrome.kill(); process.exit(0);
