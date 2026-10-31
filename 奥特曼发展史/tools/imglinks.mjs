const r = await fetch("https://m-78.jp/character/ultraman-omega/", { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
const h = await r.text();
const links = [...h.matchAll(/href="([^"]*character[^"]*)"/gi)].map(m => m[1]);
const uniq = [...new Set(links)];
console.log(uniq.slice(0, 60).join("\n"));
