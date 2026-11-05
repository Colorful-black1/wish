// 开发探针：开页面 → 等就绪 → 打印关键几何/渲染数据 → 截图。
// 用法：node tools/probe.mjs [--mobile] [--shot name.png]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, RENDERER_PROBE, isSoftwareRenderer } from './cdp.mjs';

const root = process.cwd();
const outDir = path.join(root, 'qa');
const mobile = process.argv.includes('--mobile');
const shotArg = process.argv.indexOf('--shot');
const shotName = shotArg > 0 ? process.argv[shotArg + 1] : mobile ? 'probe-mobile.png' : 'probe.png';

const s = await launch({ root, width: mobile ? 390 : 1440, height: mobile ? 844 : 900 });
await s.attachPage();
const gpu = await s.evaluate(RENDERER_PROBE);
console.log('GPU:', gpu.renderer);
if (isSoftwareRenderer(gpu.renderer)) {
  console.error('FAIL: software renderer');
  await s.close();
  process.exit(1);
}

await s.send('Page.navigate', { url: pathToFileURL(path.join(root, 'index.html')).href });

const start = Date.now();
let ready = false;
while (Date.now() - start < 60000) {
  const state = await s.evaluate(`({ ready: !!window.SUPERCAR_READY, boot: document.getElementById('bootText')?.textContent || '' })`).catch(() => ({ ready: false, boot: '?' }));
  if (state.ready) {
    ready = true;
    break;
  }
  if (state.boot.startsWith('启动失败')) {
    console.error('BOOT ERROR:', state.boot);
    break;
  }
  await new Promise((r) => setTimeout(r, 250));
}

if (ready) {
  await new Promise((r) => setTimeout(r, 1500));
  const debug = await s.evaluate(`(() => { const a = window.SC_APP; return { ...a.debug(), nodes: a.car.debugNodes(), steering: a.car.steeringBox ? { min: a.car.steeringBox.min.toArray().map(n=>+n.toFixed(3)), max: a.car.steeringBox.max.toArray().map(n=>+n.toFixed(3)) } : null }; })()`);
  console.log(JSON.stringify(debug, null, 2));
  const overflow = await s.evaluate(`({ w: innerWidth, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight })`);
  console.log('layout:', JSON.stringify(overflow));
  await s.shot(outDir, mobile ? 'probe-mobile.png' : shotName);
} else {
  await s.shot(outDir, 'probe-fail.png');
}

console.log('consoleErrors:', JSON.stringify(s.consoleErrors, null, 2));
console.log('pageErrors:', JSON.stringify(s.pageErrors, null, 2));
console.log('failedRequests:', JSON.stringify(s.failedRequests, null, 2));
await s.close();
process.exit(ready ? 0 : 1);
