/* ==========================================================================
   sky.glsl.js — 天球背景：银河（贴着真实银道面）+ 河外星系与深空天体
   方向是真的（由 IAU J2000 银极 / 银心换算来的矩阵），形态是 fBm 画出来的。
   恒星不在这里画：它们走独立的点精灵通道，位置直接来自星表。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'sky': /* glsl */ `
/* uEclToGal / uStarBright / uMilkyGain / uSkyObj* 都在 sceneDecl 里声明 */

/* 银河：银道面附近的高斯带 + fBm 云气 + 暗尘带，越靠银心越亮越黄。 */
vec3 milkyWay(vec3 dirEcl, int oct) {
  vec3 g = normalize(uEclToGal * dirEcl);
  float lat = asin(clamp(g.z, -1.0, 1.0));
  float lon = atan(g.y, g.x);

  float bw = 0.155;                             // 银盘半宽（弧度，约 9°）
  float band = exp(-pow(lat / bw, 2.0));
  float bandWide = exp(-pow(lat / (bw * 2.6), 2.0));

  /* 沿银经的云气：用方向本身做域，避免接缝 */
  vec3 warp = vec3(
    fbm(g * 2.4 + 1.3, 3),
    fbm(g * 2.4 + 6.7, 3),
    fbm(g * 2.4 + 9.1, 3)
  );
  float cloud = fbm(g * 9.0 + warp * 2.2, oct);
  float fine = fbm(g * 26.0 + warp * 3.0, min(oct + 2, 10));
  float glow = band * (0.42 + 0.90 * cloud) + bandWide * 0.24 * fine;

  /* 银心方向更亮更暖，反银心更暗 */
  float towardCentre = 0.5 + 0.5 * cos(lon);
  float centreBoost = mix(0.34, 1.50, pow(towardCentre, 1.6));

  /* 暗尘带：紧贴银道面，把亮带切成两半 */
  float dust = ridged(g * 13.0 + 21.0, min(oct + 1, 10));
  float dustMask = smoothstep(0.50, 0.80, dust) * exp(-pow(lat / (bw * 0.70), 2.0));
  glow *= (1.0 - 0.72 * dustMask);

  vec3 warm = vec3(1.00, 0.86, 0.64);
  vec3 cool = vec3(0.70, 0.78, 0.94);
  vec3 tint = mix(cool, warm, pow(towardCentre, 2.2));

  return tint * glow * centreBoost * uMilkyGain * mix(0.25, 1.0, uStarBright);
}

/* 单个深空天体：把方向投到以它为中心的切平面，再按形态函数着色。 */
vec3 deepSkyObject(
  vec3 dir, vec3 centre, vec3 majorAxis,
  vec2 halfSize, float pa, float bright, int kind, float seed
) {
  float cosang = dot(dir, centre);
  float reach = max(halfSize.x, halfSize.y) * 2.4;
  if (cosang < cos(min(reach, 1.2))) return vec3(0.0);

  vec3 T = normalize(majorAxis - centre * dot(majorAxis, centre));
  vec3 B = cross(centre, T);
  /* 角度近似：q 的单位是弧度 */
  vec2 q = vec2(dot(dir, T), dot(dir, B)) / max(cosang, 0.2);
  vec2 rot = vec2(cos(pa), sin(pa));
  vec2 u = vec2(q.x * rot.x + q.y * rot.y, -q.x * rot.y + q.y * rot.x);
  vec2 n = u / max(halfSize, vec2(1e-5));
  float r = length(n);
  float ang = atan(n.y, n.x);

  vec3 col = vec3(0.0);
  float shape = 0.0;
  vec3 tint = vec3(0.86, 0.88, 0.96);

  if (kind == 0) {
    /* 旋涡星系：核球 + 盘 + 两条旋臂 */
    float bulge = exp(-r * r * 14.0);
    float disc = exp(-r * 3.1);
    float arm = 0.5 + 0.5 * cos(2.0 * ang - log(max(r, 0.05)) * 5.2 + seed);
    arm = pow(arm, 3.0) * smoothstep(1.35, 0.12, r);
    shape = bulge * 1.25 + disc * (0.55 + 0.85 * arm);
    tint = mix(vec3(0.95, 0.86, 0.72), vec3(0.78, 0.84, 1.0), smoothstep(0.05, 0.9, r));
    /* 伴星系：两个小光点（M32 / M110 的示意位置） */
    vec2 s1 = n - vec2(-0.62, 0.58);
    vec2 s2 = n - vec2(0.86, -0.44);
    shape += exp(-dot(s1, s1) * 420.0) * 0.55;
    shape += exp(-dot(s2, s2) * 620.0) * 0.32;
  } else if (kind == 1) {
    /* 不规则矮星系：团块 */
    vec3 p = vec3(n * 2.4, seed);
    float blob = fbm(p, 5);
    shape = smoothstep(0.34, 0.86, blob) * exp(-r * 1.9) * 1.4;
    float knot = smoothstep(0.72, 0.92, fbm(p * 3.1 + 4.0, 4));
    shape += knot * exp(-r * 2.6) * 0.9;
    tint = vec3(0.82, 0.86, 1.0);
  } else if (kind == 2) {
    /* 发射星云：粉红 + 青 */
    vec3 p = vec3(n * 2.2, seed);
    float core = exp(-r * r * 5.0);
    float wisps = fbm(p * 2.6, 5);
    shape = core * (0.65 + 0.75 * wisps);
    tint = mix(vec3(1.0, 0.55, 0.55), vec3(0.62, 0.82, 1.0), smoothstep(0.2, 0.9, wisps));
  } else if (kind == 3) {
    /* 疏散星团：几颗可分辨的亮点（银河系内，物理上可分辨） */
    float pts = 0.0;
    for (int i = 0; i < 6; i++) {
      vec3 h = hash33(vec3(float(i) * 3.7 + seed, 1.3, 0.7));
      vec2 o = (h.xy - 0.5) * 1.7;
      vec2 d = n - o;
      pts += exp(-dot(d, d) * 2600.0) * (0.35 + h.z);
    }
    shape = exp(-r * r * 3.2) * 0.30 + pts;
    tint = vec3(0.78, 0.86, 1.0);
  } else {
    /* 球状星团：致密核 + 粗糙颗粒 */
    float core = exp(-r * r * 9.0);
    float grain = smoothstep(0.55, 0.95, fbm(vec3(n * 9.0, seed), 4));
    shape = core * (0.8 + 0.9 * grain);
    tint = vec3(0.94, 0.88, 0.74);
  }

  shape *= smoothstep(1.9, 0.6, r);
  col = tint * shape * bright;
  return col;
}

/* 整个背景。dir 为黄道系单位方向。 */
vec3 skyRadiance(vec3 dir, int oct) {
  vec3 col = milkyWay(dir, oct);
  for (int i = 0; i < 8; i++) {
    if (i >= uSkyObjCount) break;
    col += deepSkyObject(
      dir,
      uSkyObjDir[i],
      uSkyObjAxis[i],
      uSkyObjSize[i],
      uSkyObjPa[i],
      uSkyObjBright[i],
      uSkyObjKind[i],
      float(i) * 0.37
    );
  }
  return col;
}
`,
});
