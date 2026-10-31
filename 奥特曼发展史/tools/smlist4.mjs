const r = await fetch("https://m-78.jp/character-sitemap1.xml", { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
const t = await r.text();
const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).map(u => u.replace("https://m-78.jp/character/","").replace(/\/$/,""));
console.log(locs.filter(u => u.length <= 4).join(" | "));
console.log("---");
console.log(locs.filter(u => /^(u|x|z|ex|zet|ultra)/.test(u) && /^(z|x|ultraman_x|ultraman-z|ultraman_z|ultramanz|zetto)$/.test(u)).join(" | "));
console.log("--- x/z ---");
console.log(locs.filter(u => /(^|[-_])x($|[-_])|(^|[-_])z($|[-_])|ultramanx|ultramanz/i.test(u)).slice(0,20).join(" | "));
