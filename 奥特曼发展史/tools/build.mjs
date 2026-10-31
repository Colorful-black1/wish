// Build the single-file deliverable from dev.html + src assets.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '');

let html = read('dev.html');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => {
  const css = read(href);
  if (!fs.existsSync(path.join(root, href))) throw new Error('missing css: ' + href);
  return `<style>\n/* ===== ${href} ===== */\n${css}\n</style>`;
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  if (!fs.existsSync(path.join(root, src))) throw new Error('missing js: ' + src);
  const js = read(src).replace(/<\/script>/gi, '<\\/script>');
  return `<script>\n/* ===== ${src} ===== */\n${js}\n</script>`;
});

const stamp = `<!--\n  ULTRAMAN UNIVERSE ARCHIVE — 奥特曼宇宙编年史\n  Single-file build. Source of record: dev.html + src/.\n  All artwork is original inline SVG. No external requests.\n  Built ${new Date().toISOString()}\n-->`;
html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + stamp);

fs.writeFileSync(path.join(root, 'index.html'), html, 'utf8');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log(`built index.html — ${kb} KB, ${html.split('\n').length} lines`);
console.log(`external refs left: ${(html.match(/(src|href)="(?!data:|#)[^"]+"/g) || []).length}`);
