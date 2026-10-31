const r = await fetch("https://m-78.jp/character-sitemap1.xml", { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
const t = await r.text();
const locs = [...t.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
console.log("count", locs.length);
console.log(locs.filter(u => /ultra(man|seven)|zoffy|jack|ace|taro|leo|tiga|dyna|gaia|agul|cosmos|justice|nexus|max|mebius|zero|ginga|victory|orb|geed|rosso|blu|taiga|trigger|decker|blazar|arc|omega|teo/i.test(u)).slice(0,120).join("\n"));
