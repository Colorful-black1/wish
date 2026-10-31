import fs from "node:fs";
const map = { ultraman:"ultraman", seven:"ultraseven", tiga:"tiga", zero:"zero", omega:"ultraman-omega", teo:"ultraman-teo", x:"x", z:"z", eighty:"80", joneus:"joneus" };
for (const [id, slug] of Object.entries(map)) {
  const page = "https://m-78.jp/character/" + slug + "/";
  const r = await fetch(page, { headers: { "user-agent": "Mozilla/5.0 Chrome/124" } });
  const h = await r.text();
  const og = (h.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || "";
  if (!og) { console.log("no og", id); continue; }
  const img = await fetch(og, { headers: { "user-agent": "Mozilla/5.0 Chrome/124", referer: page } });
  const buf = Buffer.from(await img.arrayBuffer());
  const ext = og.split("?")[0].split(".").pop().toLowerCase();
  fs.writeFileSync(`assets/heroes/${id}.${ext}`, buf);
  console.log(id, img.status, ext, Math.round(buf.length/1024)+"KB", og);
}
