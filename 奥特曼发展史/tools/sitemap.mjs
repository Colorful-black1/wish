for (const u of ["https://m-78.jp/sitemap_index.xml","https://m-78.jp/sitemap.xml","https://m-78.jp/wp-sitemap.xml"]) {
  try {
    const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
    const t = await r.text();
    console.log("===", u, r.status, t.length);
    console.log(t.slice(0, 1200));
  } catch(e) { console.log("ERR", u, e.message); }
}
