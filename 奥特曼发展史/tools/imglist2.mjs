for (const url of ["https://m-78.jp/character/", "https://m-78.jp/character/category/261/"]) {
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
  const h = await r.text();
  console.log("=== ", url, r.status, h.length);
  const imgs = [...h.matchAll(/<img[^>]+(?:data-src|src)="([^"]+)"[^>]*>/gi)].map(m => ({src: m[1], alt: (m[0].match(/alt="([^"]*)"/)||[])[1]||""})).filter(x => /hero|ultra|character/i.test(x.src) && !/logo|banner|common|icon/i.test(x.src));
  console.log("imgs", imgs.length);
  console.log(imgs.slice(0, 40).map(x => x.alt + " | " + x.src).join("\n"));
  const links = [...h.matchAll(/href="(\/character\/[^"#?]+)"/gi)].map(m => m[1]);
  console.log("links", [...new Set(links)].slice(0, 40).join(" "));
}
