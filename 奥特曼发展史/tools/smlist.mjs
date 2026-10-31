const r = await fetch("https://m-78.jp/sitemap_index.xml", { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
const t = await r.text();
const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
console.log(locs.join("\n"));
