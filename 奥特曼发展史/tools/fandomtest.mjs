const titles = ["Ultraman","Ultraseven","Ultraman_Tiga","Ultraman_Zero","Ultraman_Omega","Ultraman_TEO","Zoffy"];
for (const t of titles) {
  const url = "https://ultra.fandom.com/wiki/" + t;
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36" }, redirect: "follow" });
    const h = await r.text();
    const og = (h.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || (h.match(/content="([^"]+)"\s+property="og:image"/) || [])[1] || "";
    console.log(r.status, t, "|", og.slice(0, 160), "| len", h.length);
  } catch (e) { console.log("ERR", t, e.message); }
}
