/* fetch-moons.mjs — 一次性抓取主要卫星的半径与轨道半长径（JPL Horizons）。
   只在核对数据时手动运行；产物写入 research/moons-source.md 供 data.bodies.js 抄写。
   运行：cd solar-system && node tools/fetch-moons.mjs */
import fs from 'node:fs';

const MOONS = [
  ['moon', '301', '399', '月球 Moon', 'Earth'],
  ['phobos', '401', '499', '火卫一 Phobos', 'Mars'],
  ['deimos', '402', '499', '火卫二 Deimos', 'Mars'],
  ['io', '501', '599', '木卫一 Io', 'Jupiter'],
  ['europa', '502', '599', '木卫二 Europa', 'Jupiter'],
  ['ganymede', '503', '599', '木卫三 Ganymede', 'Jupiter'],
  ['callisto', '504', '599', '木卫四 Callisto', 'Jupiter'],
  ['titan', '606', '699', '土卫六 Titan', 'Saturn'],
];

const q = async (params) => {
  const p = new URLSearchParams({ format: 'text', ...params });
  const r = await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p.toString(), { signal: AbortSignal.timeout(40000) });
  return r.text();
};

const out = [];
for (const [id, code, parentCode, label, parent] of MOONS) {
  let radius = '';
  let a = '';
  let ecc = '';
  let inc = '';
  let per = '';
  try {
    const t1 = await q({ COMMAND: `'${code}'`, OBJ_DATA: "'YES'", MAKE_EPHEM: "'NO'", CENTER: "'@sun'" });
    const m = t1.match(/Mean radius \(km\)\s*=\s*([\d.]+)/i) || t1.match(/Radius \(km\)\s*=\s*([\d.]+)/i) || t1.match(/Vol\. mean radius \(km\)\s*=\s*([\d.]+)/i);
    if (m) radius = m[1];
  } catch (e) {
    console.log(id, 'radius ERR', e.message);
  }
  try {
    const t2 = await q({
      COMMAND: `'${code}'`,
      OBJ_DATA: "'NO'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'ELEMENTS'",
      CENTER: `'500@${parentCode}'`,
      START_TIME: "'2026-11-04'",
      STOP_TIME: "'2026-11-05'",
      STEP_SIZE: "'1 d'",
      REF_PLANE: "'ECLIPTIC'",
      OUT_UNITS: "'KM-S'",
    });
    const ge = (re) => {
      const m = t2.match(re);
      return m ? m[1].trim() : '';
    };
    a = ge(/\n\s*A\s*=\s*([\d.E+-]+)/);
    ecc = ge(/\n\s*EC\s*=\s*([\d.E+-]+)/);
    inc = ge(/\bIN\s*=\s*([\d.E+-]+)/);
    const prSec = ge(/\bPR\s*=\s*([\d.E+-]+)/);
    per = prSec ? (parseFloat(prSec) / 86400).toFixed(4) : ''; // PR 单位是秒
  } catch (e) {
    console.log(id, 'elem ERR', e.message);
  }
  out.push({ id, code, label, parent, radius, a, ecc, inc, per });
  console.log(id.padEnd(9), 'R=' + radius, 'a=' + a, 'e=' + ecc, 'i=' + inc, 'P=' + per);
}

const md = `# 主要卫星参数（JPL Horizons）

- 抓取：${new Date().toISOString().slice(0, 10)}
- 接口：\`https://ssd.jpl.nasa.gov/api/horizons.api\`
  - 半径：\`OBJ_DATA='YES'\` 的 \`Mean radius (km)\`
  - 轨道：\`EPHEM_TYPE='ELEMENTS'\`，中心为各自母体，历元 2026-11-04
- 这些数字只用于「卫星轨道位置示意」：轨道相位由程序按周期推算，**不是星历**，
  页面上一律标注为示意。
- 许可：NASA/JPL 内容按 NASA media usage guidelines 属公有领域。

| 卫星 | 母体 | 平均半径（km） | 轨道半长径（km） | 偏心率 | 倾角（°） | 周期（d） |
| --- | --- | --- | --- | --- | --- | --- |
${out.map((o) => `| ${o.label} | ${o.parent} | ${o.radius || '—'} | ${o.a || '—'} | ${o.ecc || '—'} | ${o.inc || '—'} | ${o.per || '—'} |`).join('\n')}
`;
fs.writeFileSync('research/moons-source.md', md, 'utf8');
console.log('\nwrote research/moons-source.md');
