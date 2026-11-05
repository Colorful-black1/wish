// Minimal Chrome DevTools Protocol harness shared by tools/probe.mjs and tools/qa.mjs.
// GPU only: SwiftShader / llvmpipe never allowed (repo rule, AGENTS.md §8).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// AGENTS.md §8 — headless=new + ANGLE/D3D11. Never --disable-gpu, never SwiftShader.
export const GPU_ARGS = [
  '--headless=new',
  '--enable-gpu',
  '--use-gl=angle',
  '--use-angle=d3d11',
  '--disable-gpu-sandbox',
  '--ignore-gpu-blocklist',
  '--disable-software-rasterizer'
];

export const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find((p) => fs.existsSync(p));

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SOFTWARE_RE = /swiftshader|llvmpipe|software rasterizer|microsoft basic render/i;

/** Read the unmasked GL renderer + vendor strings for the current context. */
export const RENDERER_PROBE = `(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return { ok: false, error: 'no webgl context' };
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    ok: true,
    version: gl.getParameter(gl.VERSION),
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '',
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
  };
})()`;

export function isSoftwareRenderer(name) {
  return SOFTWARE_RE.test(String(name || ''));
}

/**
 * Start a GPU-enabled headless Chrome and attach to its page domain.
 * Returns a session object with send/evaluate/shot/close plus error collectors.
 */
export async function launch({ root, profileName = '.chrome-qa', width = 1440, height = 900, port }) {
  if (!CHROME) throw new Error('no chrome: expected C:/Program Files/Google/Chrome/Application/chrome.exe');
  const profile = path.join(root, profileName);
  fs.rmSync(profile, { recursive: true, force: true });
  const dbgPort = port || 9400 + Math.floor(Math.random() * 300);

  const chrome = spawn(
    CHROME,
    [
      ...GPU_ARGS,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--mute-audio',
      '--allow-file-access-from-files',
      '--force-device-scale-factor=1',
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${dbgPort}`,
      `--window-size=${width},${height}`,
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  const version = await (async () => {
    for (let i = 0; i < 160; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${dbgPort}/json/version`);
        if (r.ok) return r.json();
      } catch {
        /* retry */
      }
      await sleep(150);
    }
    throw new Error('chrome did not start');
  })();

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  let nextId = 1;
  const pending = new Map();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  let sessionId = null;

  ws.addEventListener('message', (ev) => {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
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
      const d = msg.params.exceptionDetails;
      pageErrors.push('EXCEPTION: ' + (d.exception?.description || d.text || JSON.stringify(d)));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleErrors.push('LOG: ' + msg.params.entry.text);
    }
    if (msg.method === 'Network.loadingFailed' && !msg.params.errorText?.includes('net::ERR_ABORTED')) {
      failedRequests.push(msg.params.errorText);
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

  async function evaluate(expression, opts = {}) {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
      ...opts
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    }
    return r.result.value;
  }

  async function attachPage() {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    sessionId = attached.sessionId;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    return sessionId;
  }

  async function shot(outDir, name) {
    fs.mkdirSync(outDir, { recursive: true });
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(r.data, 'base64'));
    console.log('shot', name);
  }

  async function close() {
    try {
      await send('Browser.close');
    } catch {
      /* ignore */
    }
    ws.close();
    chrome.kill();
  }

  return {
    chrome,
    send,
    evaluate,
    attachPage,
    shot,
    close,
    sleep,
    consoleErrors,
    pageErrors,
    failedRequests,
    profile,
    dbgPort
  };
}
