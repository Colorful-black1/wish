/* astro-check.mjs — 天文核心的离线自检
   运行：cd solar-system && node tools/astro-check.mjs
   不放宽断言：任何一条失败都说明根数外推 / 开普勒求解 / 旋转矩阵写错了。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const sandbox = { window: {}, Math, Date, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const f of ['src/js/data.orbits.js', 'src/js/astro.js']) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}
const A = sandbox.window.HELIOS_ASTRO;
const O = sandbox.window.HELIOS_ORBITS;

let pass = 0;
const fails = [];
const near = (label, got, want, tol, unit = '') => {
  const ok = Math.abs(got - want) <= tol;
  if (ok) pass++;
  else fails.push(`${label}: got ${got.toFixed(6)}${unit}, want ${want}${unit} ±${tol}${unit}`);
  return ok;
};

const D = Math.PI / 180;

// ── 1. 儒略日往返 ────────────────────────────────────────────────
{
  const jd = A.julianDay(2000, 1, 1, 12);
  near('JD 2000-01-01T12:00Z', jd, 2451545.0, 1e-9);
  const jd2 = A.julianDay(2026, 11, 4, 0);
  near('JD 2026-11-04T00:00Z', jd2, 2461348.5, 1e-9); // 与 JPL 儒略日换算器一致
  const back = A.calendarFromJulianDay(jd2);
  near('JD→日历 年', back.y, 2026, 0);
  near('JD→日历 月', back.m, 11, 0);
  near('JD→日历 日', back.d, 4, 0);
}

// ── 2. 地球：春分点日心黄经应为 180°（在 J2000 惯性系里要扣掉岁差） ──
// JPL 根数用的是 J2000 平均黄道与分点，坐标系不随日期进动；而「春分」是当日
// 真太阳黄经 0°。两者之间差一个 J2000→当日的岁差（黄经总岁差 1.396971°/世纪）。
{
  const jd = A.julianDay(2026, 3, 20, 14.75); // 2026 年三月分点 ≈ 2026-03-20 14:46 UTC
  const p = A.heliocentric(O.elements.earth, jd);
  const T = A.centuriesSinceJ2000(jd);
  const precession = 1.396971 * T;
  near('2026 春分地球日心黄经（J2000 系，含岁差折算）', p.lon + precession, 180.0, 0.05, '°');
  console.log(`  岁差折算 ${precession.toFixed(4)}°（J2000 → 2026-03-20）`);
}

// ── 3. 地球：近日点 1 月初、远日点 7 月初，距离应为 0.9833 / 1.0167 AU ──
{
  let best = { jd: 0, r: 9 }, worst = { jd: 0, r: 0 };
  for (let d = 0; d < 366; d++) {
    const jd = A.julianDay(2026, 1, 1, 0) + d;
    const r = A.heliocentric(O.elements.earth, jd).r;
    if (r < best.r) best = { jd, r };
    if (r > worst.r) worst = { jd, r };
  }
  const pd = A.calendarFromJulianDay(best.jd);
  const ad = A.calendarFromJulianDay(worst.jd);
  near('地球近日点距离', best.r, 0.9833, 0.0006, ' AU');
  near('地球远日点距离', worst.r, 1.0167, 0.0006, ' AU');
  console.log(
    `  近日点 ${pd.y}-${String(pd.m).padStart(2, '0')}-${String(pd.d).padStart(2, '0')} · 远日点 ${ad.y}-${String(ad.m).padStart(2, '0')}-${String(ad.d).padStart(2, '0')}`
  );
}

// ── 4. 公转周期：平均黄经走 360° 用多少天，应与 NASA 表一致 ─────────
// 注意 Neptune：NASA Fact Sheet 记 59,800 天，而由 JPL 根数的平均运动反推是
// 60,190 天（≈164.8 年，与天文年历一致）。两处口径不同，页面显示 NASA 表值并
// 在 README「数据口径」里记录这个差异，所以这里不放宽对另外七颗的断言。
{
  const want = {
    mercury: 88.0, venus: 224.7, earth: 365.2, mars: 687.0,
    jupiter: 4331, saturn: 10747, uranus: 30589,
  };
  for (const k of Object.keys(want)) {
    const el = O.elements[k];
    const period = (360 / el.L[1]) * 36525; // L 的变化率即平均运动（度/世纪）
    near(`${k} 公转周期`, period, want[k], Math.max(1, want[k] * 0.004), ' d');
  }
  const nep = (360 / O.elements.neptune.L[1]) * 36525;
  near('neptune 公转周期（JPL 平均运动）', nep, 60190, 20, ' d');
  console.log(`  Neptune：NASA 表 59,800 d / JPL 根数 ${nep.toFixed(0)} d（口径差异，README 有记录）`);
}

// ── 5. 偏心率 / 倾角 / 逆行 ──────────────────────────────────────
{
  const T = A.centuriesSinceJ2000(A.julianDay(2026, 11, 4, 0));
  const mer = A.elementsAt(O.elements.mercury, T);
  near('水星偏心率', mer.e, 0.2056, 0.002);
  near('水星轨道倾角', mer.I, 7.0, 0.05, '°');
  const ura = A.elementsAt(O.elements.uranus, T);
  near('天王星轨道倾角', ura.I, 0.77, 0.05, '°');
  // 行星不在同一平面：倾角极差必须 > 6°
  const I = Object.keys(O.elements).map((k) => A.elementsAt(O.elements[k], T).I);
  near('倾角极差', Math.max(...I) - Math.min(...I), 7.0, 0.1, '°');
}

// ── 6. 2026-11-04 各星日心黄经（记录用） ────────────────────────
{
  const jd = A.julianDay(2026, 11, 4, 0);
  console.log('\n  2026-11-04 00:00 UTC 日心黄道坐标');
  console.log('  body        lon(°)     lat(°)     r(AU)');
  for (const k of Object.keys(O.elements)) {
    const p = A.heliocentric(O.elements[k], jd);
    console.log(
      '  ' + k.padEnd(10) + p.lon.toFixed(4).padStart(9) + p.lat.toFixed(4).padStart(11) + p.r.toFixed(6).padStart(11)
    );
  }
}

// ── 7. 坐标矩阵：银心必须落在银经 0° ─────────────────────────────
{
  // 银心 J2000：RA 266.40510°, Dec −28.936175°
  const v = A.equatorialToGalactic(A.raDecToUnit(266.4051, -28.936175));
  near('银心 → 银经', A.mod360(Math.atan2(v.y, v.x) * A.RAD), 0, 0.02, '°');
  near('银心 → 银纬', Math.asin(v.z) * A.RAD, 0, 0.02, '°');
  // 北银极 J2000：RA 192.85948°, Dec +27.12825°
  const np = A.equatorialToGalactic(A.raDecToUnit(192.85948, 27.12825));
  near('北银极 → 银纬', Math.asin(np.z) * A.RAD, 90, 0.02, '°');
  // 赤道→黄道：北天极的黄纬应等于 90° − 23.43928°
  const eqp = A.equatorialToEcliptic({ x: 0, y: 0, z: 1 });
  near('北天极黄纬', Math.asin(eqp.z) * A.RAD, 90 - 23.43928, 0.001, '°');
}

// ── 8. 天体不在同一平面：z 分量非零 ──────────────────────────────
{
  const jd = A.julianDay(2026, 11, 4, 0);
  let maxAbsZ = 0;
  for (const k of Object.keys(O.elements)) maxAbsZ = Math.max(maxAbsZ, Math.abs(A.heliocentric(O.elements[k], jd).z));
  if (maxAbsZ > 0.1) pass++;
  else fails.push(`所有行星 z 分量都 < 0.1 AU（${maxAbsZ.toFixed(3)}），倾角可能没参与计算`);
}

console.log(`\n  ${pass} passed, ${fails.length} failed`);
fails.forEach((f) => console.log('  FAIL  ' + f));
process.exit(fails.length ? 1 : 0);
