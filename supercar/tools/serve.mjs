// 本地开发服务器：dev.html 里的 <script type="module" src="src/js/app.js"> 不能直接在 file:// 跑，
// 这里用 esbuild 现场打包成单文件脚本再喂给浏览器。
// 用法：node tools/serve.mjs [--port 5178]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from './bundle.mjs';

const root = process.cwd();
const portArg = process.argv.indexOf('--port');
const PORT = portArg > 0 ? Number(process.argv[portArg + 1]) : 5178;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml'
};

let cached = null;
let cacheTime = 0;

async function devBundle() {
  const now = Date.now();
  if (cached && now - cacheTime < 800) return cached;
  const { code } = await bundle({ root, minify: false });
  cached = code;
  cacheTime = now;
  return code;
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '/dev.html') {
      const html = fs.readFileSync(path.join(root, 'dev.html'), 'utf8');
      const code = await devBundle();
      const out = html.replace(
        /<script\s+type="module"\s+src="src\/js\/app\.js"\s*><\/script>/,
        `<script>\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>`
      );
      res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
      res.end(out);
      return;
    }
    const file = path.join(root, urlPath);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('dev server error: ' + err.message);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev server → http://127.0.0.1:${PORT}/  （改 src/ 后刷新即可，每次请求重新打包）`);
});
