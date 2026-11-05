// 构建单文件成品：dev.html + src/css/* + 打包后的 JS（含内联 GLB / Draco）→ index.html
// 用法：node tools/build.mjs   （必须在 supercar/ 目录内运行）
import fs from 'node:fs';
import path from 'node:path';
import { bundle, sizeByPackage, assetSizes } from './bundle.mjs';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '');
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const MAX_TOTAL = 4 * 1024 * 1024;
const HARD_TOTAL = 10 * 1024 * 1024;

let html = read('dev.html');
const parts = [];

html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (m, href) => {
  const file = path.join(root, href);
  if (!fs.existsSync(file)) throw new Error('missing css: ' + href);
  const css = read(href);
  parts.push({ type: 'css', href, bytes: Buffer.byteLength(css) });
  return `<style>\n/* ===== ${href} ===== */\n${css}\n</style>`;
});

const entryMatch = html.match(/<script\s+type="module"\s+src="([^"]+)"\s*><\/script>/);
if (!entryMatch) throw new Error('dev.html must contain <script type="module" src="src/js/app.js"></script>');

const t0 = Date.now();
const { code, metafile } = await bundle({ root, minify: true });
const bundleMs = Date.now() - t0;
const safeCode = code.replace(/<\/script/gi, '<\\/script');
parts.push({ type: 'js', href: entryMatch[1], bytes: Buffer.byteLength(safeCode) });

html = html.replace(entryMatch[0], () => `<script>\n${safeCode}\n</script>`);

const bytes = Buffer.byteLength(html, 'utf8');
const stamp = `<!--
  SUPERCAR 3D SHOWROOM · Ferrari 458 Italia
  单文件构建产物。源码：dev.html + src/，请勿手改本文件。
  构建：node tools/build.mjs（esbuild 打包 → 内联 GLB / Draco / 样式）
  Three.js ${JSON.parse(read('node_modules/three/package.json')).version} (MIT) · 模型：three.js 示例 webgl_materials_car（作者 vicent091036）
  运行时零外部请求；页面为实时 WebGL 渲染。
  生成时间 ${new Date().toISOString()} · ${(bytes / 1024).toFixed(1)} KB
-->`;
html = html.replace('<!doctype html>', '<!doctype html>\n' + stamp);

fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');

const remoteRefs = html.match(/(?:src|href)="(?:https?:)?\/\/[^"]+"/g) || [];
const assets = assetSizes(root);
const byPkg = sizeByPackage(metafile);
const b64 = (n) => Math.ceil(n / 3) * 4;
const assetBytes = b64(assets.glb) + b64(assets.wasm) + b64(assets.wrapper);
const appBytes = Math.max(0, (byPkg.src || 0) + (byPkg.virtual || 0) - assetBytes);

const budget = [
  ['index.html 总体积', bytes, MAX_TOTAL],
  ['three + addons（产物内）', (byPkg['three/core'] || 0) + (byPkg['three/addons'] || 0), 600 * 1024],
  ['Draco wrapper + wasm（base64）', b64(assets.wasm) + b64(assets.wrapper), 320 * 1024],
  ['ferrari.glb（base64）', b64(assets.glb), 2.3 * 1024 * 1024],
  ['应用代码 + 样式 + AO', appBytes, 400 * 1024]
];

console.log('');
console.log('SUPERCAR build');
console.log('─'.repeat(58));
for (const [name, value, cap] of budget) {
  const pct = ((value / cap) * 100).toFixed(0);
  const flag = value > cap ? '  ⚠ 超预算' : '';
  console.log(`${name.padEnd(30, '·')} ${kb(value).padStart(12)}  (${pct}% of ${kb(cap)})${flag}`);
}
console.log('─'.repeat(58));
console.log(`source: glb ${kb(assets.glb)} · ao ${kb(assets.ao)} · wasm ${kb(assets.wasm)} · wrapper ${kb(assets.wrapper)}`);
console.log(`inlined: ${parts.length} 段（${parts.filter((p) => p.type === 'js').length} js / ${parts.filter((p) => p.type === 'css').length} css），esbuild ${bundleMs} ms`);
console.log(`index.html  ${kb(bytes)}  ${bytes > HARD_TOTAL ? '✗ 超过 10 MB 红线' : '✓ 在 10 MB 红线内'}  ${bytes > MAX_TOTAL ? '⚠ 超过 4 MB 预算' : '✓ 在 4 MB 预算内'}`);
console.log(`remote refs left: ${remoteRefs.length}`);
remoteRefs.forEach((r) => console.log('  ' + r));

fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'qa', 'build-report.json'),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      bytes,
      kb: +(bytes / 1024).toFixed(1),
      withinBudget: bytes <= MAX_TOTAL,
      withinHardLimit: bytes <= HARD_TOTAL,
      remoteRefs,
      budget: budget.map(([name, value, cap]) => ({ name, bytes: value, cap, ratio: +(value / cap).toFixed(3) })),
      packages: byPkg,
      assets,
      inlined: parts,
      esbuildMs: bundleMs
    },
    null,
    2
  )
);

if (remoteRefs.length) {
  console.error('✗ 产物里仍有外部引用，违反零外部请求规则');
  process.exit(1);
}
if (bytes > HARD_TOTAL) {
  console.error('✗ 产物超过 10 MB 红线');
  process.exit(1);
}
