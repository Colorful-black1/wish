#!/usr/bin/env node
/*
 * fetch-stars.mjs — build src/js/data.stars.js from the HYG star catalogue.
 *
 * Run from the solar-system/ directory (the script uses process.cwd()):
 *
 *   cd solar-system
 *   node tools/fetch-stars.mjs
 *
 * What it does
 *   1. Downloads HYG hyg/CURRENT/hygdata_v40.csv.gz (13.6 MB gz) into
 *      research/_raw/ and reuses that cache on every later run.
 *      Falls back to hyg/v3/hyg_v38.csv.gz only if v40 cannot be fetched.
 *   2. Gunzips with node:zlib and parses the CSV with a proper (quoted-field)
 *      splitter.
 *   3. Keeps every star with Vmag <= 6.50 and finite RA/Dec (J2000), drops
 *      rows with an empty RA/Dec, and drops the Solar row (id 0 / "Sol" —
 *      the Sun is the observer here, not a background star).
 *   4. Sorts by right ascension ascending.
 *   5. Packs RA / Dec / Vmag / (B-V) into 4 little-endian uint16 words per
 *      star and base64-encodes the buffer.
 *   6. Writes src/js/data.stars.js (window.HELIOS_STARS) and prints a report,
 *      including decoded positions for a handful of well-known stars.
 *
 * Only RA, Dec, Vmag and B-V are used. Coordinates stay in J2000 equatorial
 * form; they are never re-projected at build time — the runtime rotates them
 * into ecliptic coordinates.
 *
 * No runtime network access is required: data.stars.js is the only artefact.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, 'research', '_raw');
const OUT_DIR = path.join(ROOT, 'src', 'js');
const OUT_FILE = path.join(OUT_DIR, 'data.stars.js');

const REPO_URL = 'https://github.com/astronexus/HYG-Database';
const RAW_BASE = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/';

const MAG_LIMIT = 6.5; // naked-eye limit
const NAME_MAG_LIMIT = 3.5; // only bright stars get a proper name in the blob
const NAME_CAP = 200;
const B64_CAP_BYTES = 400 * 1024; // hard ceiling for the encoded blob

// Primary catalogue is HYG v4.0 (hyg/CURRENT/hygdata_v40.csv.gz).
// v3.8 is a fallback only, and carries its own (older) licence.
const CATALOGS = [
  {
    source: 'HYG Database v4',
    label: 'HYG Database v4.0',
    version: '4.0',
    file: 'hygdata_v40.csv.gz',
    remote: 'hyg/CURRENT/hygdata_v40.csv.gz',
    cache: path.join(RAW_DIR, 'hygdata_v40.csv.gz'),
    license: 'CC BY-SA 4.0',
    primary: true,
  },
  {
    source: 'HYG Database v3',
    label: 'HYG Database v3.8',
    version: '3.8',
    file: 'hyg_v38.csv.gz',
    remote: 'hyg/v3/hyg_v38.csv.gz',
    cache: path.join(RAW_DIR, 'hyg_v38.csv.gz'),
    license: 'CC BY-SA 2.5',
    primary: false,
  },
];

const fmt = (n) => Number(n).toLocaleString('en-US');
const fixed = (n, d) => Number(n).toFixed(d);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function die(message) {
  console.error('[fetch-stars] ERROR: ' + message);
  process.exit(1);
}

function ensureProjectRoot() {
  if (path.basename(ROOT).toLowerCase() !== 'solar-system') {
    die(
      'run this script from the solar-system/ directory ' +
        `(process.cwd() is "${ROOT}")`
    );
  }
  if (!fs.existsSync(path.join(ROOT, 'research'))) {
    die('research/ not found under ' + ROOT);
  }
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

/** Gzip magic bytes? */
function looksGzip(buf) {
  return buf.length > 18 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/**
 * Split one CSV line into fields. Handles double-quoted fields, embedded
 * commas, doubled quotes ("") and bare fields. HYG has no embedded newlines
 * in the fields we read, so line-at-a-time parsing is enough.
 */
function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

async function download(url, dest) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'helios-fetch-stars/1.0 (+solar-system build)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!looksGzip(buf)) throw new Error(`response is not gzip (${buf.length} bytes): ${url}`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

/** Load the catalogue gz, preferring the local cache; try each catalogue in turn. */
async function loadCatalogue() {
  const problems = [];

  for (const cat of CATALOGS) {
    // 1. cache
    if (fs.existsSync(cat.cache)) {
      const buf = fs.readFileSync(cat.cache);
      if (looksGzip(buf) && buf.length > 1024 * 1024) {
        return { cat, gz: buf, gzBytes: buf.length, fromCache: true };
      }
      problems.push(`${cat.file}: cache is not a usable gzip (${buf.length} bytes)`);
    }

    // 2. network
    const url = RAW_BASE + cat.remote;
    try {
      const bytes = await download(url, cat.cache);
      return { cat, gz: fs.readFileSync(cat.cache), gzBytes: bytes, fromCache: false };
    } catch (err) {
      problems.push(`${cat.file}: ${err.message}`);
    }
  }

  die('could not obtain a catalogue:\n  ' + problems.join('\n  '));
}

/** Fill the 4-word record per star. Little-endian on disk, always. */
function encode(stars) {
  const u16 = new Uint16Array(stars.length * 4);
  const clamp = (v) => (v < 0 ? 0 : v > 65535 ? 65535 : v);

  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const ci = Math.min(4, Math.max(-1, s.ci)); // B-V clamped to [-1, 4]
    u16[i * 4 + 0] = clamp(Math.round(s.raDeg * 100));
    u16[i * 4 + 1] = clamp(Math.round(s.decDeg * 100) + 9000);
    u16[i * 4 + 2] = clamp(Math.round(s.mag * 100) + 2000);
    u16[i * 4 + 3] = clamp(Math.round(ci * 100) + 5000);
  }

  // Keep the bytes little-endian even on a big-endian host.
  if (os.endianness() !== 'LE') {
    for (let i = 0; i < u16.length; i++) {
      const v = u16[i];
      u16[i] = ((v & 0xff) << 8) | ((v >> 8) & 0xff);
    }
  }

  return {
    u16,
    b64: Buffer.from(u16.buffer, u16.byteOffset, u16.byteLength).toString('base64'),
    rawBytes: u16.byteLength,
  };
}

/** Read a uint16 back out of the base64 blob, little-endian, host-independent. */
function decodeWord(buf, wordIndex) {
  const off = wordIndex * 2;
  return buf[off] | (buf[off + 1] << 8);
}

function decodeStar(buf, index) {
  const base = index * 4;
  return {
    raDeg: decodeWord(buf, base + 0) / 100,
    decDeg: (decodeWord(buf, base + 1) - 9000) / 100,
    mag: (decodeWord(buf, base + 2) - 2000) / 100,
    ci: (decodeWord(buf, base + 3) - 5000) / 100,
  };
}

function jsString(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n]+/g, ' ') + "'";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const started = new Date();
  ensureProjectRoot();

  console.log('HELIOS star field — HYG catalogue build');
  console.log('=======================================');

  const { cat, gz, gzBytes, fromCache } = await loadCatalogue();
  console.log(`catalogue   : ${cat.label} (${cat.file})`);
  console.log(`cache       : ${cat.cache}`);
  console.log(`              ${fmt(gzBytes)} bytes gz, ${fromCache ? 'reused local cache' : 'downloaded just now'}`);
  console.log(`licence     : ${cat.license}`);

  // ---------------------------------------------------------------- gunzip
  let text;
  try {
    text = zlib.gunzipSync(gz).toString('utf8');
  } catch (err) {
    die('gunzip failed: ' + err.message);
  }
  console.log(`gunzipped   : ${fmt(Buffer.byteLength(text, 'utf8'))} bytes`);

  // ----------------------------------------------------------------- parse
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = {};
  for (const name of ['id', 'proper', 'ra', 'dec', 'mag', 'ci']) {
    col[name] = header.indexOf(name);
    if (col[name] < 0) die(`column "${name}" missing from the header: ${lines[0]}`);
  }

  const stars = [];
  let rows = 0;
  let droppedNoCoord = 0;
  let droppedFaint = 0;
  let droppedSun = 0;
  let missingCi = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    rows++;

    const fields = splitCsvLine(line);
    const raRaw = fields[col.ra] ?? '';
    const decRaw = fields[col.dec] ?? '';
    const magRaw = fields[col.mag] ?? '';

    if (raRaw === '' || decRaw === '' || magRaw === '') {
      droppedNoCoord++;
      continue;
    }

    const raHours = Number(raRaw);
    const decDeg = Number(decRaw);
    const mag = Number(magRaw);
    if (!Number.isFinite(raHours) || !Number.isFinite(decDeg) || !Number.isFinite(mag)) {
      droppedNoCoord++;
      continue;
    }
    if (mag > MAG_LIMIT) {
      droppedFaint++;
      continue;
    }

    const id = (fields[col.id] ?? '').trim();
    const proper = (fields[col.proper] ?? '').trim();

    // id 0 / "Sol" is the Sun itself (ra 0, dec 0, mag -26.7). It is the
    // observer, not a background star; keeping it would plant a bogus
    // extreme-brightness point at the vernal equinox.
    if (id === '0' || proper === 'Sol') {
      droppedSun++;
      continue;
    }

    const ciRaw = fields[col.ci] ?? '';
    let ci = Number(ciRaw);
    if (ciRaw === '' || !Number.isFinite(ci)) {
      ci = 0; // unknown colour -> neutral (B-V 0.00), encoded as 5000
      missingCi++;
    }

    stars.push({ raDeg: raHours * 15, decDeg, mag, ci, proper });
  }

  if (stars.length === 0) die('no stars survived the magnitude cut');

  // ----------------------------------------------------------------- sort
  stars.sort(
    (a, b) => a.raDeg - b.raDeg || a.decDeg - b.decDeg || a.mag - b.mag
  );

  const n = stars.length;

  // --------------------------------------------------------------- encode
  const { b64, rawBytes } = encode(stars);

  // ---------------------------------------------------------------- names
  // Proper names, only for stars at mag <= 3.5. If more than NAME_CAP
  // candidates exist, keep the brightest ones (a name you cannot see is
  // useless), then restore star-index order in the output.
  const candidates = [];
  for (let i = 0; i < n; i++) {
    const s = stars[i];
    if (s.proper && s.mag <= NAME_MAG_LIMIT) candidates.push({ i, name: s.proper, mag: s.mag });
  }
  candidates.sort((a, b) => a.mag - b.mag || a.i - b.i);
  const names = candidates
    .slice(0, NAME_CAP)
    .sort((a, b) => a.i - b.i)
    .map((x) => [x.i, x.name]);

  // ------------------------------------------------------------ mag range
  let minMag = Infinity;
  let maxMag = -Infinity;
  for (const s of stars) {
    if (s.mag < minMag) minMag = s.mag;
    if (s.mag > maxMag) maxMag = s.mag;
  }

  // ----------------------------------------------------------------- file
  const pulled = new Date().toISOString();
  const b64Bytes = Buffer.byteLength(b64, 'utf8');

  const out = [
    '/* GENERATED — do not edit by hand. Regenerate with: node tools/fetch-stars.mjs */',
    `// Source: ${cat.label} (${cat.file}) — ${REPO_URL}`,
    `// Licence: ${cat.license} (full licence text: research/stars-source.md, repo LICENSE)`,
    '// Truncation: V magnitude <= 6.50 (naked-eye limit), J2000 equatorial coordinates.',
    '// Encoding: little-endian Uint16 x4 per star [RA centideg, Dec centideg + 9000, Vmag centimag + 2000, (B-V) centimag + 5000].',
    'window.HELIOS_STARS = {',
    '  meta: {',
    `    source: ${jsString(cat.source)},`,
    `    version: ${jsString(cat.version)},`,
    `    url: ${jsString(REPO_URL)},`,
    `    license: ${jsString(cat.license)},`,
    `    epoch: 'J2000',`,
    `    magLimit: ${MAG_LIMIT},`,
    `    count: ${n},`,
    `    pulled: ${jsString(pulled)},`,
    '  },',
    `  n: ${n},`,
    `  b64: '${b64}',`,
    '  names: [',
    ...names.map(([i, name]) => `    [${i}, ${jsString(name)}],`),
    '  ],',
    '};',
    '',
  ].join('\n');

  fs.writeFileSync(OUT_FILE, out, 'utf8');
  const outBytes = fs.statSync(OUT_FILE).size;

  // -------------------------------------------------------------- summary
  console.log(`rows parsed : ${fmt(rows)}`);
  console.log(
    `dropped     : ${fmt(droppedNoCoord)} empty/invalid RA-Dec, ` +
      `${fmt(droppedFaint)} fainter than ${MAG_LIMIT.toFixed(2)}, ` +
      `${fmt(droppedSun)} Solar row (id 0 / "Sol")`
  );
  console.log(`missing B-V : ${fmt(missingCi)} (encoded as B-V 0.00 = neutral)`);
  console.log(`stars kept  : ${fmt(n)}`);
  console.log(`b64 bytes   : ${fmt(b64Bytes)} (cap ${fmt(B64_CAP_BYTES)})`);
  console.log(`raw bytes   : ${fmt(rawBytes)} (${fmt(n)} x 8)`);
  console.log(`mag range   : ${fixed(minMag, 2)} .. ${fixed(maxMag, 2)}`);
  console.log(`named stars : ${fmt(names.length)} (proper name, mag <= ${NAME_MAG_LIMIT.toFixed(2)})`);
  console.log(`output      : ${OUT_FILE}`);
  console.log(`              ${fmt(outBytes)} bytes, UTF-8, no BOM`);
  console.log(`pulled      : ${pulled}`);
  console.log(`elapsed     : ${Date.now() - started.getTime()} ms`);

  // ------------------------------------------------- decoded spot checks
  const blob = Buffer.from(b64, 'base64');
  if (blob.length !== rawBytes) die(`base64 round-trip mismatch: ${blob.length} vs ${rawBytes} bytes`);

  // name -> every matching index (doubles can share a name)
  const byName = new Map();
  for (const [i, name] of names) {
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(i);
  }

  const wanted = [
    'Sirius',
    'Betelgeuse',
    'Polaris',
    'Vega',
    'Alnitak',
    'Alnilam',
    'Mintaka',
    'Dubhe',
    'Mizar',
    'Alkaid',
  ];

  console.log('');
  console.log('Decoded from the b64 blob (J2000 equatorial):');
  console.log('  name         index      RA deg     Dec deg      Vmag     B-V');
  const found = new Map();
  for (const name of wanted) {
    const hits = byName.get(name);
    if (!hits || hits.length === 0) {
      console.log(`  ${name.padEnd(12)} MISSING — no such proper name at mag <= ${NAME_MAG_LIMIT.toFixed(2)}`);
      continue;
    }
    // If a name occurs more than once, report the brightest component.
    let best = null;
    for (const i of hits) {
      const d = decodeStar(blob, i);
      if (!best || d.mag < best.d.mag) best = { i, d };
    }
    found.set(name, best);
    const { i, d } = best;
    console.log(
      `  ${name.padEnd(12)} ${String(i).padStart(6)}  ${fixed(d.raDeg, 4).padStart(10)}  ` +
        `${fixed(d.decDeg, 4).padStart(10)}  ${fixed(d.mag, 2).padStart(7)}  ${fixed(d.ci, 3).padStart(7)}`
    );
  }

  // -------------------------------------------------------- sanity checks
  const checks = [];
  const check = (ok, label) => checks.push({ ok, label });

  check(
    n >= 8000 && n <= 12000,
    `star count ${fmt(n)} is within the expected 8,000..12,000`
  );

  const sirius = found.get('Sirius');
  check(
    !!sirius && Math.abs(sirius.d.mag - -1.44) <= 0.02,
    `Sirius Vmag ${sirius ? fixed(sirius.d.mag, 2) : 'n/a'} is close to -1.44`
  );

  const polaris = found.get('Polaris');
  check(
    !!polaris && Math.abs(polaris.d.decDeg - 89.26) <= 0.05,
    `Polaris Dec ${polaris ? fixed(polaris.d.decDeg, 4) : 'n/a'} deg is close to +89.26`
  );

  check(b64Bytes < B64_CAP_BYTES, `b64 ${fmt(b64Bytes)} bytes is under the ${fmt(B64_CAP_BYTES)} byte cap`);

  check(
    wanted.every((name) => found.has(name)),
    `all ${wanted.length} reference stars are present in the name table`
  );

  console.log('');
  console.log('Sanity checks:');
  for (const c of checks) console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.label}`);

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.error('');
    console.error(`[fetch-stars] ${failed.length} sanity check(s) failed — inspect data.stars.js before shipping.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[fetch-stars] unhandled failure:');
  console.error(err);
  process.exit(1);
});
