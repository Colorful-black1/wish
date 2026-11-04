/* derive-poles.mjs — 由 IAU 极轴赤经（Wikipedia infobox，2026-11-04 抓取）+ NASA 表里的
   轴倾角，解出极轴的赤纬，再转到黄道系得到 tilt / node。
   这样做的好处：倾角严格等于 NASA 表值，方位角来自真实极轴赤经，两者都不是编的。
   运行：cd solar-system && node tools/derive-poles.mjs */
import fs from 'node:fs';

const DEG = Math.PI / 180;
const EPS = 23.43928 * DEG; // 黄赤交角 J2000

// 极轴赤经：Wikipedia 各行星条目 infobox「North pole」字段（IAU 2015 引用）
const POLES = {
  mercury: { ra: 281.01, obliquity: 0.034 },
  venus: { ra: 272.76, obliquity: 177.4 },
  earth: { ra: 0.0, obliquity: 23.4 },
  mars: { ra: 317.269, obliquity: 25.2 },
  jupiter: { ra: 268.057, obliquity: 3.1 },
  saturn: { ra: 40.589, obliquity: 26.7 },
  uranus: { ra: 257.311, obliquity: 97.8 },
  neptune: { ra: 299.36, obliquity: 28.3 },
};

function solveDec(raDeg, tiltDeg) {
  const a = raDeg * DEG;
  // 归一到「离黄道北极最近」的那一侧，方向由自转周期的正负表达
  const t = tiltDeg > 90 ? 180 - tiltDeg : tiltDeg;
  const c = Math.cos(t * DEG);
  const A = Math.cos(EPS);
  const B = -Math.sin(a) * Math.sin(EPS);
  const R = Math.hypot(A, B);
  const phi = Math.atan2(B, A);
  const s = Math.max(-1, Math.min(1, c / R));
  const d1 = Math.asin(s) - phi;
  const d2 = Math.PI - Math.asin(s) - phi;
  const pick = Math.abs(d1) <= Math.PI / 2 ? d1 : d2;
  return pick;
}

const rows = [];
for (const [id, v] of Object.entries(POLES)) {
  const ra = v.ra * DEG;
  const dec = solveDec(v.ra, v.obliquity);
  const e = { x: Math.cos(dec) * Math.cos(ra), y: Math.cos(dec) * Math.sin(ra), z: Math.sin(dec) };
  const p = {
    x: e.x,
    y: e.y * Math.cos(EPS) + e.z * Math.sin(EPS),
    z: -e.y * Math.sin(EPS) + e.z * Math.cos(EPS),
  };
  const tilt = Math.acos(Math.max(-1, Math.min(1, p.z))) / DEG;
  const nodeDeg = (Math.atan2(p.y, p.x) / DEG + 360) % 360;
  rows.push({
    id,
    ra: v.ra,
    dec: dec / DEG,
    tilt,
    tiltWant: v.obliquity,
    node: nodeDeg,
    spinSign: v.obliquity > 90 ? -1 : 1,
  });
  console.log(
    id.padEnd(9),
    'dec=' + (dec / DEG).toFixed(3).padStart(8),
    'tilt=' + tilt.toFixed(3).padStart(7),
    '(NASA ' + v.obliquity + ')',
    'node=' + nodeDeg.toFixed(2).padStart(7),
    'spin=' + (v.obliquity > 90 ? '负（逆行）' : '正')
  );
}

const md = `# 自转极轴：由真实赤经 + NASA 轴倾角解出

- 极轴赤经（IAU 2015 值）：Wikipedia 各行星条目 infobox「North pole」字段，2026-11-04 抓取。
  已核对到的赤经：水星 281.010°、金星 272.76°、火星 317.269°、木星 268.057°、土星 40.589°、
  天王星 257.311°、海王星 299.36°；地球按定义取 RA 0°。
- 轴倾角：NASA Planetary Fact Sheet（2025-03-18）的 Obliquity to Orbit，见 \`research/SOURCES.md\`。
- 极轴赤纬：由「极轴与黄道北极的夹角 = 轴倾角」这一约束解出（解 \`A·sin δ + B·cos δ = cos θ\`），
  不另抄一份可能矛盾的赤纬。忽略行星轨道倾角（≤7°）带来的二阶误差。
- 极轴转黄道后：\`tilt = acos(p.z)\`，\`node = atan2(p.y, p.x)\`。
  倾角 > 90° 的天体（金星、天王星）把轴归一到北侧，逆行改由自转周期取负表达。

| 天体 | 极轴赤经（°） | 极轴赤纬（°） | 轴倾角 tilt（°，本页用） | NASA 表值（°） | 方位角 node（°） | 自转 |
| --- | --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (r) =>
      `| ${r.id} | ${r.ra.toFixed(3)} | ${r.dec.toFixed(3)} | ${r.tilt.toFixed(2)} | ${r.tiltWant} | ${r.node.toFixed(2)} | ${
        r.spinSign < 0 ? '逆行（周期取负）' : '顺行'
      } |`
  )
  .join('\n')}

> 说明：倾角接近 0° 的天体（水星、木星）极轴几乎就在黄道北极上，方位角在几何上不敏感，
> 对画面没有影响。倾角大的天体（土星 26.7°、天王星 97.8°）方位角是实打实算出来的，
> 所以环面的朝向有依据，不是随便摆的。
`;

fs.writeFileSync('research/pole-directions.md', md, 'utf8');
console.log('\nwrote research/pole-directions.md');

// 直接给出可粘贴的 JS 片段
console.log('\nJS:');
for (const r of rows) {
  console.log(`  ${r.id.padEnd(9)} tilt: ${r.tilt.toFixed(2)}, node: ${((r.node * Math.PI) / 180).toFixed(6)}, spin: ${r.spinSign}`);
}
