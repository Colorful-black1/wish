// Fetch a URL and dump readable text (rough HTML strip) for fact checking.
const url = process.argv[2];
const limit = Number(process.argv[3] || 6000);
if (!url) { console.error('usage: node fetch-text.mjs <url> [limit]'); process.exit(1); }

const res = await fetch(url, {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'accept-language': 'ja,en;q=0.8,zh-CN;q=0.6',
  },
});
const buf = Buffer.from(await res.arrayBuffer());
let html = new TextDecoder('utf-8').decode(buf);
if (/charset=["']?(shift_jis|euc-jp)/i.test(html.slice(0, 2000))) {
  html = new TextDecoder('shift_jis').decode(buf);
}
html = html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<\/(p|div|li|h[1-6]|tr|section|article|br)>/gi, '\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ');

const ents = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&copy;': '(c)' };
html = html.replace(/&[a-z#0-9]+;/gi, (m) => ents[m] ?? m);

const text = html.split('\n').map((l) => l.replace(/[ \t\u3000]+/g, ' ').trim()).filter(Boolean).join('\n');
console.log(`STATUS ${res.status}  ${url}\n`);
console.log(text.slice(0, limit));
