/* ==========================================================================
   surface.glsl.js — 九类天体表面的程序化着色
   全部在单位球的本地方向上求值：没有 UV、没有接缝、也没有一张贴图。
   细节层级 det（0=全景，1=最近观察）决定噪声层数 —— 放大时是真的多算了几层。
   所有颜色都是艺术化近似，不是光谱还原。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'surface': /* glsl */ `
/* 撞击坑场：单个最近格点给出坑底与坑缘。返回 [-1,1]，正值更亮。 */
float craterField(vec3 p, float seed) {
  float d = cellF1(p + seed);
  float pit = smoothstep(0.40, 0.05, d);                                   // 坑内
  float rim = smoothstep(0.38, 0.44, d) * smoothstep(0.54, 0.44, d);       // 薄环坑缘
  return rim * 1.35 - pit * 0.80;
}

/* 叠加多层坑，远处只算粗层。 */
float craterStack(vec3 p, float det, float seed) {
  float c = craterField(p * 9.0, seed);
  c += craterField(p * 19.0 + 3.7, seed + 1.3) * 0.62;
  c += craterField(p * 38.0 + 9.1, seed + 5.9) * 0.40 * smoothstep(0.18, 0.75, det);
  c += craterField(p * 74.0 + 1.1, seed + 8.3) * 0.26 * smoothstep(0.45, 0.95, det);
  return c;
}

/* 地球的陆地遮罩：域扭曲 fBm，阈值化后得到大陆轮廓。 */
float earthLand(vec3 p, int oct) {
  vec3 w = vec3(fbm(p * 1.7 + 3.1, 3), fbm(p * 1.7 + 7.7, 3), fbm(p * 1.7 + 11.3, 3));
  float c = fbm(p * 2.15 + w * 1.15, oct);
  return smoothstep(0.505, 0.556, c);
}

/* 主入口。
   type: 1 水星 2 金星 3 地球 4 火星 5 木星 6 土星 7 天王星 8 海王星 9 卫星/岩石
   lp:   单位球上的本地坐标（+Z = 自转轴北极）
   det:  0..1 细节层级
   输出：albedo / emissive（只在地球夜面用）/ 高光遮罩 / 高光指数        */
void bodySurface(
  int type, vec3 lp, float det,
  vec3 cA, vec3 cB, vec3 cC,
  out vec3 albedo, out vec3 emissive, out float specMask, out float specPower
) {
  int oct = 3 + int(clamp(det, 0.0, 1.0) * 5.0);
  float lat = clamp(lp.z, -1.0, 1.0);
  float lon = atan(lp.y, lp.x);

  albedo = cA;
  emissive = vec3(0.0);
  specMask = 0.0;
  specPower = 24.0;

  if (type == 1) {
    /* ── 水星：密坑 + 断崖，无气硬阴影 ───────────────────────────── */
    float macro = fbm(lp * 2.6 + 13.0, oct);
    float craters = craterStack(lp, det, 2.0);
    float scarp = ridged(vec3(lp.xy * 8.0, lp.z * 3.0) + 5.0, 3);
    scarp = smoothstep(0.62, 0.78, scarp);
    float v = 0.46 + 0.42 * macro + 0.30 * craters - 0.16 * scarp;
    albedo = mix(cB, cA, saturate(v)) + vec3(0.05) * saturate(craters);
    specMask = 0.0;
  } else if (type == 2) {
    /* ── 金星：硫酸云带 + 赤道附近的人字形涡旋 ───────────────────── */
    float turb = fbm(lp * 3.2 + 4.0, oct) - 0.5;
    float band = sin(lat * 11.0 + turb * 5.5 + lon * 0.55);
    float chevron = sin(lon * 2.0 - lat * 7.5 + turb * 3.0) * exp(-pow(lat * 2.6, 2.0));
    float v = 0.52 + 0.46 * band + 0.26 * chevron + 0.34 * turb;
    albedo = mix(cB, cA, saturate(v)) * (0.90 + 0.16 * turb);
    albedo = mix(albedo, cC, saturate(0.10 + 0.20 * band));
    albedo *= 0.80;
    specMask = 0.0;
  } else if (type == 3) {
    /* ── 地球：海陆 + 极冰 + 云 + 夜灯 ───────────────────────────── */
    float land = earthLand(lp, oct);
    float relief = fbm(lp * 11.0 + 2.0, min(oct + 2, 10));
    vec3 ocean = cA * (0.55 + 0.9 * smoothstep(0.30, 0.50, fbm(lp * 3.4, 3)));
    vec3 landC = mix(cB * 0.55, cB * 1.45, relief);
    landC = mix(landC, cC * 0.9, smoothstep(0.62, 0.80, relief) * smoothstep(0.15, 0.0, abs(abs(lat) - 0.62)));
    vec3 base = mix(ocean, landC, land);

    float ice = smoothstep(0.70, 0.86, abs(lat) + 0.055 * fbm(lp * 9.0, 3));
    base = mix(base, cC, ice);

    /* 两层云：低层积云走得慢，高层卷云走得快，两层用不同的域偏移 */
    float cloudLow = fbm(lp * 3.9 + vec3(0.0, 0.0, 1.7), min(oct + 2, 10));
    float cloudHigh = fbm(lp * 6.7 + vec3(11.0, 5.0, 21.0), min(oct + 1, 9));
    float cloud = smoothstep(0.50, 0.68, cloudLow) * (0.85 + 0.15 * fbm(lp * 12.0, 3));
    float cirrus = smoothstep(0.58, 0.78, cloudHigh) * 0.42;
    base = mix(base, vec3(0.90, 0.92, 0.94), cloud * 0.70);
    base = mix(base, vec3(0.86, 0.89, 0.93), cirrus);

    float cityNoise = fbm(lp * 52.0 + 21.0, 4) * smoothstep(0.30, 0.62, fbm(lp * 8.0 + 3.0, 3));
    float city = smoothstep(0.16, 0.30, cityNoise) * smoothstep(0.42, 0.72, fbm(lp * 150.0 + 7.0, 3));
    emissive = vec3(1.0, 0.74, 0.40) * city * land * (1.0 - ice) * (1.0 - cloud * 0.85);

    albedo = base;
    specMask = (1.0 - land) * (1.0 - ice) * (1.0 - cloud * 0.7);
    specPower = 380.0;
  } else if (type == 4) {
    /* ── 火星：锈红地表 + 水手谷 + 奥林匹斯山 + 极冠 ─────────────── */
    float macro = fbm(lp * 2.8 + 6.0, oct);
    float fine = fbm(lp * 16.0, min(oct + 2, 10));
    vec3 base = mix(cB, cA, saturate(0.28 + 0.95 * macro)) * (0.80 + 0.40 * fine);

    /* 大块暗区（类似大瑟提斯）：只求色调分布像，不是地形还原 */
    float dark = smoothstep(0.54, 0.68, fbm(lp * 2.1 + 31.0, 3));
    base = mix(base, cB * 0.52, dark * 0.62);

    /* 水手谷：一条大圆弧带，只在半个半球内延伸 */
    vec3 canyonN = normalize(vec3(0.34, -0.90, 0.28));
    vec3 canyonAlong = normalize(vec3(0.90, 0.36, 0.24));
    float dc = abs(dot(lp, canyonN));
    float span = smoothstep(-0.15, 0.30, dot(lp, canyonAlong));
    float canyon = smoothstep(0.055, 0.006, dc) * span;
    float canyonEdge = smoothstep(0.075, 0.055, dc) * span * smoothstep(0.055, 0.075, dc);
    base = mix(base, cB * 0.24, canyon * 0.95);
    base += vec3(0.09) * canyonEdge;

    /* 奥林匹斯山：一个大圆盾 + 中央破火山口 */
    vec3 volcano = normalize(vec3(0.58, 0.66, 0.48));
    float dv = length(lp - volcano);
    float shield = smoothstep(0.32, 0.03, dv);
    float caldera = smoothstep(0.055, 0.014, dv);
    base = mix(base, base * 1.40 + vec3(0.06), shield * 0.55);
    base = mix(base, cB * 0.35, caldera * 0.85);

    float capN = smoothstep(0.895, 0.955, lat + 0.028 * fbm(lp * 7.0, 3));
    float capS = smoothstep(0.915, 0.965, -lat + 0.028 * fbm(lp * 7.0, 3));
    float cap = saturate(capN + capS);
    base = mix(base, mix(cC * 0.72, cC, smoothstep(0.0, 0.6, cap)), cap * 0.92);
    albedo = base;
    specMask = 0.0;
  } else if (type == 5) {
    /* ── 木星：明暗条带 + 湍流涡旋 + 大红斑 ─────────────────────── */
    float turb = fbm(vec3(lp.xy * 2.6, lat * 6.2) + 4.0, oct) - 0.5;
    float band = sin(lat * 17.0 + turb * 5.0) * 0.5 + 0.5;
    float fineBand = sin(lat * 41.0 + turb * 9.0) * 0.5 + 0.5;
    vec3 base = mix(cB * 0.72, cA, saturate(band * 0.88 + 0.10 + turb * 0.80));
    base = mix(base, cA * 1.14, smoothstep(0.58, 0.96, fineBand) * 0.20);
    base = mix(base, cB * 0.68, smoothstep(0.52, 0.92, abs(lat)));
    base *= 0.88 + 0.24 * fineBand;

    /* 大红斑：南纬约 22°，椭圆涡旋 */
    float dlon = atan(sin(lon - 0.4), cos(lon - 0.4));
    float dx = dlon / 0.34;
    float dy = (lat + 0.385) / 0.125;
    float r2 = dx * dx + dy * dy;
    float grs = smoothstep(1.06, 0.30, r2);
    float swirl = fbm(vec3(lon * 7.0 + lat * 9.0, lat * 11.0, 2.0), 4);
    base = mix(base, mix(cC, cC * 0.62, swirl), grs * (0.70 + 0.30 * swirl));
    base = mix(base, cC * 1.06, smoothstep(1.05, 1.45, r2) * smoothstep(1.9, 1.45, r2) * 0.16);

    /* 纬向风切变：赤道急流与中纬度带的交界处产生剪切湍流 */
    float shear = cos(lat * 6.0) * 0.5 + 0.5;
    base *= 0.88 + 0.20 * shear;
    /* 极区气旋：南北极各有若干小涡旋，靠噪声环纹体现 */
    float pole = smoothstep(0.60, 0.94, abs(lat));
    float cyc = fbm(vec3(lon * 3.2, lat * 6.0, 9.0), 3);
    base = mix(base, mix(cB * 0.72, cA * 1.12, sin(cyc * 26.0) * 0.5 + 0.5), pole * 0.45);

    albedo = base;
    specMask = 0.0;
  } else if (type == 6) {
    /* ── 土星：更淡的条带，整体乳黄 ─────────────────────────────── */
    float turb = fbm(vec3(lp.xy * 2.2, lat * 5.0) + 9.0, oct) - 0.5;
    float band = sin(lat * 13.0 + turb * 3.4) * 0.5 + 0.5;
    vec3 base = mix(cB, cA, saturate(0.42 + 0.44 * band + 0.30 * turb));
    base = mix(base, cB * 0.74, smoothstep(0.60, 0.95, abs(lat)) * 0.55);
    albedo = base;
    specMask = 0.0;
  } else if (type == 7) {
    /* ── 天王星：近乎无特征的青蓝，只有极淡的纬度变化 ───────────── */
    float v = fbm(lp * 2.4 + 1.0, min(oct, 5)) - 0.5;
    float band = sin(lat * 7.0 + v * 2.0) * 0.5 + 0.5;
    albedo = mix(cB, cA, saturate(0.52 + 0.16 * band + 0.10 * v));
    specMask = 0.0;
  } else if (type == 8) {
    /* ── 海王星：深蓝 + 大暗斑 + 高处亮云 ───────────────────────── */
    float turb = fbm(vec3(lp.xy * 2.4, lat * 5.5) + 3.0, oct) - 0.5;
    float band = sin(lat * 12.0 + turb * 4.0) * 0.5 + 0.5;
    vec3 base = mix(cB, cA, saturate(0.34 + 0.44 * band + 0.34 * turb));
    float dlon = atan(sin(lon + 0.9), cos(lon + 0.9));
    float dx = dlon / 0.32;
    float dy = (lat + 0.42) / 0.13;
    float ds = smoothstep(1.05, 0.20, dx * dx + dy * dy);
    base = mix(base, cB * 0.42, ds * 0.85);
    float cirrus = smoothstep(0.64, 0.84, fbm(lp * 13.0 + 17.0, min(oct + 1, 9)));
    base = mix(base, vec3(0.80, 0.88, 1.0), cirrus * 0.13 * smoothstep(0.1, 0.6, abs(lat)));
    albedo = base;
    specMask = 0.0;
  } else {
    /* ── 岩石卫星：坑 + 月海 ────────────────────────────────────── */
    float macro = fbm(lp * 3.0 + 31.0, oct);
    float craters = craterStack(lp, det, 7.0);
    float maria = smoothstep(0.56, 0.66, fbm(lp * 1.9 + 5.0, 3));
    float v = 0.50 + 0.40 * macro + 0.34 * craters - 0.18 * maria;
    albedo = mix(cB, cA, saturate(v)) + vec3(0.04) * saturate(craters);
    specMask = 0.0;
  }
}
`,
});
