/* fetch-near-stars.mjs — 从同一份 HYG 星表里抽出「附近恒星」子集，供 L2 恒星邻域使用。
   只保留 RA / Dec / 距离 / V 星等 / B−V，不含自行（不编自行）。
   用法：cd solar-system && node tools/fetch-near-stars.mjs */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, 'research/_raw/hygdata_v40.csv.gz');
const OUT = path.join(ROOT, 'src/js/data.stars.near.js');
const URL_ = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v40.csv.gz';

const MAX_PC = 25; // 25 pc ≈ 81 光年
const MAX_MAG = 11;

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function loadGz() {
  if (fs.existsSync(CACHE)) {
    console.log('cache      : ' + CACHE);
    return fs.readFileSync(CACHE);
  }
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  console.log('download   : ' + URL_);
  const r = await fetch(URL_, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error('download failed ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(CACHE, buf);
  return buf;
}

const gz = await loadGz();
const csv = zlib.gunzipSync(gz).toString('utf8');
const lines = csv.split('\n');
const head = parseCsvLine(lines[0]);
const col = (name) => head.indexOf(name);
const IR = col('ra'), ID = col('dec'), IDIST = col('dist'), IMAG = col('mag'), ICI = col('ci'), IPROP = col('proper'), IID = col('id');
if (IR < 0 || ID < 0 || IDIST < 0 || IMAG < 0) throw new Error('unexpected header: ' + lines[0].slice(0, 200));

const DEG = Math.PI / 180;
const OBL = 23.43928 * DEG;
const AU_PER_PC = 206264.806;

const picked = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const f = parseCsvLine(line);
  if (f.length < head.length - 2) continue;
  const id = Number(f[IID]);
  if (!Number.isFinite(id) || id === 0) continue; // 跳过太阳自己
  const dist = Number(f[IDIST]);
  const mag = Number(f[IMAG]);
  const raH = Number(f[IR]);
  const decD = Number(f[ID]);
  if (!Number.isFinite(dist) || !Number.isFinite(mag) || !Number.isFinite(raH) || !Number.isFinite(decD)) continue;
  if (dist <= 0 || dist > MAX_PC || mag > MAX_MAG) continue;
  const ci = Number(f[ICI]);
  picked.push({
    dist,
    mag,
    ci: Number.isFinite(ci) ? Math.max(-0.4, Math.min(3.0, ci)) : 0,
    ra: raH * 15 * DEG,
    dec: decD * DEG,
    proper: f[IPROP] || '',
  });
}

picked.sort((a, b) => a.dist - b.dist);

// 3D 位置：赤道单位向量 × 距离，再转到黄道系 → AU
const data = new Float32Array(picked.length * 5);
for (let i = 0; i < picked.length; i++) {
  const s = picked[i];
  const cx = Math.cos(s.dec) * Math.cos(s.ra);
  const cy = Math.cos(s.dec) * Math.sin(s.ra);
  const cz = Math.sin(s.dec);
  const dAu = s.dist * AU_PER_PC;
  const ex = cx * dAu;
  const ey = (cy * Math.cos(OBL) + cz * Math.sin(OBL)) * dAu;
  const ez = (-cy * Math.sin(OBL) + cz * Math.cos(OBL)) * dAu;
  data[i * 5] = ex;
  data[i * 5 + 1] = ey;
  data[i * 5 + 2] = ez;
  data[i * 5 + 3] = s.mag;
  data[i * 5 + 4] = s.ci;
}

const b64 = Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64');
const named = picked
  .map((s, i) => (s.proper ? `[${i}, ${JSON.stringify(s.proper)}]` : null))
  .filter(Boolean);

const js = `/* GENERATED — do not edit by hand. Regenerate with: node tools/fetch-near-stars.mjs */
// Source: HYG Database v4.0 (hygdata_v40.csv.gz) — https://github.com/astronexus/HYG-Database
// Licence: CC BY-SA 4.0
// Subset: 0 < distance <= ${MAX_PC} pc AND V <= ${MAX_MAG}; ${picked.length} stars, sorted by distance.
// Fields per star (Float32 x5): ecliptic x, y, z in AU (J2000), V magnitude, B−V.
// NO proper motions are encoded — the star positions are static; only the Sun moves.
window.HELIOS_STARS_NEAR = {
  meta: {
    source: 'HYG Database v4',
    version: '4.0',
    license: 'CC BY-SA 4.0',
    epoch: 'J2000',
    maxPc: ${MAX_PC},
    maxMag: ${MAX_MAG},
    count: ${picked.length},
    nearestPc: ${picked.length ? picked[0].dist.toFixed(3) : 'null'},
    note: '不含自行：恒星位置是 J2000 静态值，位移全部来自太阳的运动。',
  },
  n: ${picked.length},
  b64: '${b64}',
  names: [${named.join(', ')}],
};
`;
fs.writeFileSync(OUT, js, 'utf8');

console.log('rows kept  : ' + picked.length);
console.log('nearest    : ' + (picked[0] ? picked[0].dist.toFixed(3) + ' pc (' + picked[0].proper + ')' : '—'));
console.log('raw bytes  : ' + data.byteLength);
console.log('b64 bytes  : ' + b64.length);
console.log('output     : ' + OUT + '  (' + Buffer.byteLength(js) + ' bytes)');
console.log('named stars: ' + named.length);
