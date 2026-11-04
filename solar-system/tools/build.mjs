// 把 dev.html + src/* 内联成单文件 index.html。
// 用法：cd solar-system && node tools/build.mjs   （必须在许愿目录内运行，脚本用 process.cwd()）
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '');

if (!fs.existsSync(path.join(root, 'dev.html'))) {
  console.error('找不到 dev.html —— 请在 solar-system/ 目录内运行：cd solar-system && node tools/build.mjs');
  process.exit(1);
}

let html = read('dev.html');
const sources = [];

html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (m, href) => {
  const file = path.join(root, href);
  if (!fs.existsSync(file)) throw new Error('missing css: ' + href);
  const css = read(href);
  sources.push({ type: 'css', file: href, bytes: Buffer.byteLength(css) });
  return `<style>\n/* ===== ${href} ===== */\n${css}\n</style>`;
});

html = html.replace(/<script\s+src="([^"]+)"><\/script>/g, (m, src) => {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) throw new Error('missing js: ' + src);
  const js = read(src).replace(/<\/script>/gi, '<\\/script>');
  sources.push({ type: 'js', file: src, bytes: Buffer.byteLength(js) });
  return `<script>\n/* ===== ${src} ===== */\n${js}\n</script>`;
});

const byteSize = Buffer.byteLength(html, 'utf8');
const stamp = `<!--
  HELIOS · 太阳系观测台
  Single-file build. Source of record: dev.html + src/.
  No external requests at runtime — no CDN, no web fonts, no remote images, no textures.
  Planet positions: JPL "Approximate Positions of the Planets" Table 1 + Kepler solver.
  Star field: HYG Database v4.0, V ≤ 6.5, 8,920 stars (CC BY-SA 4.0), inlined here.
  All surfaces, the Sun, the Milky Way and the galaxies are generated procedurally in WebGL2.
  Built ${new Date().toISOString()} · ${(byteSize / 1024).toFixed(1)} KB
-->`;
html = html.replace('<!doctype html>', '<!doctype html>\n' + stamp);

fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');

const remoteRefs = html.match(/(?:src|href)="(?:https?:)?\/\/[^"]+"/g) || [];
const extScripts = html.match(/<script[^>]+src=/g) || [];
const extLinks = html.match(/<link[^>]+href=/g) || [];

console.log(`built index.html — ${(byteSize / 1024).toFixed(1)} KB, ${html.split('\n').length} lines`);
console.log(
  `inlined ${sources.length} assets (${sources.filter((s) => s.type === 'js').length} js, ${sources.filter((s) => s.type === 'css').length} css)`
);
for (const s of sources) console.log(`  ${s.type.padEnd(3)} ${s.file.padEnd(34)} ${(s.bytes / 1024).toFixed(1)} KB`);
console.log('external <script src>: ' + extScripts.length + ', external <link href>: ' + extLinks.length);
console.log('remote refs left: ' + remoteRefs.length);
remoteRefs.forEach((r) => console.log('  ' + r));
if (remoteRefs.length || extScripts.length || extLinks.length) {
  console.error('FAIL: 产物里还有外部引用');
  process.exit(1);
}
