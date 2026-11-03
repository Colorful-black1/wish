// Build the single-file deliverable from dev.html + src assets.
// Usage: node tools/build.mjs   (must run inside the wish directory)
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '');

let html = read('dev.html');
const sources = [];

html = html.replace(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/?>/g, (m, href) => {
  const file = path.join(root, href);
  if (!fs.existsSync(file)) throw new Error('missing css: ' + href);
  const css = read(href);
  sources.push({ type: 'css', href, bytes: Buffer.byteLength(css) });
  return `<style>\n/* ===== ${href} ===== */\n${css}\n</style>`;
});

html = html.replace(/<script\s+src="([^"]+)"><\/script>/g, (m, src) => {
  const file = path.join(root, src);
  if (!fs.existsSync(file)) throw new Error('missing js: ' + src);
  const js = read(src).replace(/<\/script>/gi, '<\\/script>');
  sources.push({ type: 'js', src, bytes: Buffer.byteLength(js) });
  return `<script>\n/* ===== ${src} ===== */\n${js}\n</script>`;
});

const byteSize = Buffer.byteLength(html, 'utf8');
const stamp = `<!--\n  LLM INFERENCE LAB — 大语言模型推理流程 3D 实验室\n  Single-file build. Source of record: dev.html + src/.\n  Three.js r147 (MIT) + GSAP 3.13 (standard license) are vendored under src/js/vendor/.\n  No external requests at runtime. 3D values are illustrative; see README.\n  Built ${new Date().toISOString()} · ${(byteSize / 1024).toFixed(1)} KB source\n-->`;
html = html.replace('<!doctype html>', '<!doctype html>\n' + stamp);

fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');

const remoteRefs = html.match(/(?:src|href)="(?:https?:)?\/\/[^"]+"/g) || [];
console.log(`built index.html — ${(byteSize / 1024).toFixed(1)} KB, ${html.split('\n').length} lines`);
console.log(`inlined ${sources.length} assets (${sources.filter((s) => s.type === 'js').length} js, ${sources.filter((s) => s.type === 'css').length} css)`);
console.log('remote refs left: ' + remoteRefs.length);
remoteRefs.forEach((r) => console.log('  ' + r));
