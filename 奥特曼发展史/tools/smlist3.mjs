const r = await fetch("https://m-78.jp/character-sitemap1.xml", { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
const t = await r.text();
const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).map(u => u.replace("https://m-78.jp/character/","").replace(/\/$/,""));
const pats = ["80","joneus","great","powered","zearth","neos","_x","/x","ultraman-x","ultraman_x","jonias","usa","nice"];
for (const p of pats) console.log(p, "=>", locs.filter(u => u.toLowerCase().includes(p)).slice(0,12).join(", "));
