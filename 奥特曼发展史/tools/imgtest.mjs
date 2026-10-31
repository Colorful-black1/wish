const url = "https://m-78.jp/character/ultraman-omega/";
const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" } });
const html = await res.text();
const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map(m => m[1]).filter(s => !s.includes("common")).slice(0, 25);
const og = [...html.matchAll(/property="og:image"\s+content="([^"]+)"/gi)].map(m => m[1]);
console.log("STATUS", res.status);
console.log("OG", og);
console.log("IMGS", imgs);
