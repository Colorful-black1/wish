// Download official character visuals for local use in the fan archive.
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "assets", "heroes");
fs.mkdirSync(OUT, { recursive: true });

const map = {
  zoffy: "zoffy", ultraman: "ultraman", seven: "ultraseven", jack: "jack",
  ace: "ace", taro: "taro", leo: "leo", joneus: "joneus", eighty: "80",
  great: "great", powered: "powered", zearth: "zearth", tiga: "tiga",
  dyna: "dyna", gaia: "gaia", agul: "agul", neos: "neos", cosmos: "cosmos",
  justice: "justice", nexus: "nexus", max: "max", mebius: "mebius",
  zero: "zero", ginga: "ginga", victory: "victory", x: "x", orb: "orb",
  geed: "geed", rosso: "rosso", blu: "blu", taiga: "taiga", z: "z",
  trigger: "trigger", decker: "decker", blazar: "ultraman_blazar",
  arc: "ultraman_arc", omega: "ultraman-omega", teo: "ultraman-teo"
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function get(url, referer) {
  const r = await fetch(url, { headers: { "user-agent": UA, ...(referer ? { referer } : {}) } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") || "" };
}

const report = [];
for (const [id, slug] of Object.entries(map)) {
  const page = `https://m-78.jp/character/${slug}/`;
  try {
    const html = (await get(page)).buf.toString("utf8");
    const og = (html.match(/property="og:image"\s+content="([^"]+)"/) || [])[1];
    if (!og) { report.push([id, "NO_OG"]); continue; }
    const img = await get(og, page);
    let ext = "bin";
    if (img.buf.slice(0, 3).toString("hex") === "ffd8ff") ext = "jpg";
    else if (img.buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a") ext = "png";
    else if (img.buf.slice(0, 4).toString("ascii") === "RIFF" && img.buf.slice(8, 12).toString("ascii") === "WEBP") ext = "webp";
    const file = path.join(OUT, `${id}.${ext}`);
    fs.writeFileSync(file, img.buf);
    report.push([id, ext, Math.round(img.buf.length / 1024) + "KB", og.split("/").pop()]);
  } catch (e) {
    report.push([id, "ERR", e.message]);
  }
}
console.log(report.map((r) => r.join(" | ")).join("\n"));
console.log("done", report.filter((r) => r.length > 2).length, "/", report.length);
