const url = "https://m-78.jp/character/ultrahero/";
const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
const h = await r.text();
console.log("status", r.status, "len", h.length);
const items = [...h.matchAll(/<a[^>]+href="([^"]*\/character\/[^"]+)"[^>]*>([\s\S]{0,400}?)<\/a>/gi)];
console.log("anchors", items.length);
const seen = new Set();
for (const m of items) {
  const href = m[1];
  const img = (m[2].match(/<img[^>]+src="([^"]+)"/) || [])[1] || "";
  const alt = (m[2].match(/alt="([^"]*)"/) || [])[1] || "";
  const key = href + img;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(href, "|", alt, "|", img);
}
