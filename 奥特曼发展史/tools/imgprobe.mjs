const slugs = ["ultraman","ultraseven","ultraman-jack","ultraman-ace","ultraman-taro","ultraman-leo","ultraman-80","ultraman-tiga","ultraman-dyna","ultraman-gaia","ultraman-cosmos","ultraman-nexus","ultraman-max","ultraman-mebius","ultraman-zero","ultraman-ginga","ultraman-victory","ultraman-x","ultraman-orb","ultraman-geed","ultraman-taiga","ultraman-z","ultraman-trigger","ultraman-decker","ultraman-blazar","ultraman-arc","ultraman-omega","ultraman-teo"];
for (const s of slugs) {
  const url = "https://m-78.jp/character/" + s + "/";
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
    const h = await r.text();
    const og = (h.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || "";
    const title = (h.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
    console.log(r.status, s, "|", title.slice(0, 40), "|", og);
  } catch (e) { console.log("ERR", s, e.message); }
}
