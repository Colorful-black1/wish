/* ==========================================================================
   scene.glsl.js — 主场景 pass：一个全屏四边形，逐像素解一串球体求交
   为什么不用光栅化：球体、环、遮挡、日月食式光影全部可以解析求出，
   而且没有深度精度问题 —— 从 0.06 AU 到 30 AU 可以同时在一个画面里。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'sceneVert': /* glsl */ `
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`,

  // 声明区：必须在所有函数之前，因为 sky / surface 两段会先被拼进来
  'sceneDecl': /* glsl */ `
#define MAXB 20
#define MAXR 2

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform vec3  uCamPos;
uniform mat3  uCamBasis;     // 列：右、上、前
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uDetail;       // 0 = 全景，1 = 最近观察
uniform float uTime;
uniform float uBgOn;
uniform int   uBodyCount;
uniform int   uHover;

uniform vec4 uBodyPos[MAXB];   // xyz 世界坐标，w 半径（世界单位）
uniform vec4 uBodyAxes[MAXB];  // x 类型，y 轴倾角(度)，z 方位角(弧度)，w 自转相位
uniform vec4 uBodyColA[MAXB];  // rgb 主色，a 大气强度
uniform vec4 uBodyColB[MAXB];  // rgb 次色，a 大气厚度（相对半径）
uniform vec4 uBodyColC[MAXB];  // rgb 第三色，a 环槽（0 无 / 1 / 2）
uniform vec4 uBodyColD[MAXB];  // rgb 大气色调
uniform vec4 uBodyPar[MAXB];   // x Mie 前向散射强度，y 反照率系数

uniform vec4 uRingGeom[MAXR];   // 内径, C 外缘, B 外缘, 卡西尼内缘
uniform vec4 uRingGeom2[MAXR];  // 卡西尼外缘, A 外缘, F 环, 样式
uniform vec4 uRingExtra[MAXR];  // 不透明度, 未用, 未用, 未用
uniform vec3 uRingColor[MAXR];

uniform mat3  uEclToGal;
uniform float uStarBright;
uniform float uMilkyGain;
uniform int   uSkyObjCount;
uniform vec3  uSkyObjDir[8];
uniform vec3  uSkyObjAxis[8];
uniform vec2  uSkyObjSize[8];
uniform float uSkyObjPa[8];
uniform float uSkyObjBright[8];
uniform int   uSkyObjKind[8];

uniform float uGalaxyMix;     // 0 = 太阳系，1 = 银河视图
uniform vec3  uGalaxyCam;     // x=距银心 kpc，y=方位角，z=俯角
uniform float uSunGalAngle;   // 太阳绕银心的相位
uniform float uNearMix;       // L2 恒星邻域淡入
uniform int   uOctaveCap;     // 画质档位对噪声层数的上限
`,

  'sceneBody': /* glsl */ `
/* ---- 求交 ------------------------------------------------------------- */
bool raySphere(vec3 ro, vec3 rd, vec3 c, float r, out float t) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r * r;
  float h = b * b - cc;
  if (h < 0.0) return false;
  h = sqrt(h);
  float t0 = -b - h;
  if (t0 > 0.0) { t = t0; return true; }
  float t1 = -b + h;
  if (t1 > 0.0) { t = t1; return true; }
  return false;
}

/* ---- 环密度 ----------------------------------------------------------- */
float hairline(float rr) {
  return 0.5 + 0.5 * sin(rr * 320.0) * sin(rr * 61.0 + 1.7);
}

float ringAlpha(float rr, int slot) {
  vec4 g = uRingGeom[slot];
  vec4 h = uRingGeom2[slot];
  float inner = g.x, cOuter = g.y, bOuter = g.z, cassIn = g.w;
  float cassOut = h.x, aOuter = h.y, fRing = h.z;
  int style = int(h.w + 0.5);

  if (rr < inner || rr > fRing) return 0.0;

  float a;
  if (style == 1) {
    /* 天王星的 13 条细环：半径按 25559 km 的行星半径归一化，逐条画 */
    const float UR[13] = float[13](
      1.6000, // ζ / 1986U2R
      1.6368, // 6
      1.6523, // 5
      1.6655, // 4
      1.7496, // α
      1.7865, // β
      1.8458, // η
      1.8634, // γ
      1.8897, // δ
      1.9572, // λ
      2.0013, // ε（最亮最宽）
      2.5862, // ν
      3.8226  // μ
    );
    float a = 0.0;
    for (int i = 0; i < 13; i++) {
      float w = (i == 10) ? 0.0038 : 0.0016;
      float wgt = (i == 10) ? 0.95 : (i == 0 ? 0.10 : (i >= 11 ? 0.16 : 0.34));
      a += exp(-pow((rr - UR[i]) / w, 2.0)) * wgt;
    }
    a *= 0.55 + 0.45 * hairline(rr);
    return clamp(a, 0.0, 1.0);
  }

  if (rr < cOuter) {
    a = 0.16 + 0.44 * smoothstep(inner, cOuter, rr);          // D + C 环
  } else if (rr < bOuter) {
    a = 0.92;                                                  // B 环：最密
  } else if (rr < cassOut) {
    a = 0.045 + 0.10 * exp(-pow((rr - (cassIn + cassOut) * 0.5) / 0.008, 2.0)); // 卡西尼缝
  } else if (rr < aOuter) {
    a = 0.60;                                                  // A 环
    a *= 1.0 - 0.85 * exp(-pow((rr - (cassOut + (aOuter - cassOut) * 0.72)) / 0.004, 2.0)); // Encke 缝
  } else {
    a = 0.26 * exp(-pow((rr - fRing) / 0.010, 2.0));           // F 环
  }
  a *= 0.70 + 0.55 * hairline(rr);
  return clamp(a, 0.0, 1.0);
}

/* ---- 大气光晕（沿视线到球体的最近点做一个球壳衰减） ------------------- */
vec3 atmosphereGlow(vec3 ro, vec3 rd, float tLimit) {
  vec3 sum = vec3(0.0);
  for (int i = 1; i < MAXB; i++) {
    if (i >= uBodyCount) break;
    float strength = uBodyColA[i].a;
    if (strength <= 0.001) continue;
    vec3 c = uBodyPos[i].xyz;
    float R = uBodyPos[i].w;
    if (R <= 0.0) continue;
    float shell = R * (1.0 + max(uBodyColB[i].a, 0.004) * 16.0);
    vec3 oc = ro - c;
    float b = dot(oc, rd);
    float d2 = dot(oc, oc) - b * b;
    if (d2 > shell * shell) continue;
    float tClose = -b;
    if (tClose < 0.0 || tClose > tLimit) continue;
    float d = sqrt(max(d2, 0.0));
    if (d < R) continue;                        // 盘面内部已经有大气的边缘项，别再叠一层
    float x = clamp((d - R) / max(shell - R, 1e-6), 0.0, 1.0);
    float halo = pow(1.0 - x, 4.2) * 0.11;
    /* 只有被太阳照到的那一侧的大气才会亮 */
    vec3 limbDir = normalize(normalize(ro + rd * tClose - c) + vec3(1e-5));
    float lit = smoothstep(-0.45, 0.55, dot(limbDir, normalize(-c)));
    sum += uBodyColD[i].rgb * halo * strength * lit;
  }
  return sum;
}

/* ---- 单个天体着色 ----------------------------------------------------- */
vec3 shadeBody(int i, vec3 P, vec3 rd) {
  vec3 c = uBodyPos[i].xyz;
  float R = uBodyPos[i].w;
  vec3 nW = normalize(P - c);
  vec3 L = normalize(-P);                 // 太阳在原点
  float mu = dot(nW, L);
  int type = int(uBodyAxes[i].x + 0.5);
  float tilt = uBodyAxes[i].y;
  float node = uBodyAxes[i].z;
  float spin = uBodyAxes[i].w;
  vec3 cA = uBodyColA[i].rgb;
  vec3 cB = uBodyColB[i].rgb;
  vec3 cC = uBodyColC[i].rgb;

  /* 太阳：自发光 */
  if (type == 0) {
    vec3 lp = worldToLocal(nW, 7.25, 0.9, spin);
    /* 三个尺度的细胞：米粒 / 中尺度对流 / 超米粒 */
    float g1 = ridged(lp * 96.0, 4);
    float g2 = ridged(lp * 34.0, 4);
    float g3 = fbm(lp * 11.0, 3);
    float gran = g1 * 0.5 + g2 * 0.32 + g3 * 0.18;

    /* 黑子：本影 + 半影，成对出现在活动带 */
    float belt = smoothstep(0.72, 0.28, abs(lp.z));
    float spotField = fbm(lp * 12.0 + 17.0, 5);
    float penumbra = smoothstep(0.700, 0.745, spotField) * belt;
    float umbra = smoothstep(0.752, 0.790, spotField) * belt;
    float facula = smoothstep(0.58, 0.76, ridged(lp * 34.0 + 5.0, 3));

    /* 边缘耀斑：临边附近的细亮丝 */
    float muS = clamp(dot(nW, normalize(uCamPos - P)), 0.0, 1.0);
    float flare = smoothstep(0.42, 0.06, muS) * smoothstep(0.55, 0.85, ridged(lp * 46.0 + 31.0, 3));

    float heat = 0.26 + 0.46 * gran + 0.16 * facula;
    vec3 hot = vec3(1.0, 0.96, 0.87);
    vec3 warm = vec3(1.0, 0.62, 0.26);
    vec3 col = mix(warm, hot, saturate(heat));
    col *= 1.0 - penumbra * 0.35 - umbra * 0.55;

    /* 临边昏暗：边缘偏红偏暗 */
    float limb = 1.0 - 0.50 * (1.0 - muS) - 0.28 * pow(1.0 - muS, 3.0);
    col *= limb;
    col += vec3(1.0, 0.62, 0.30) * pow(1.0 - muS, 4.0) * 0.30;
    col += vec3(1.0, 0.55, 0.26) * flare * 2.2;
    return col * 1.02;
  }

  vec3 lp = worldToLocal(nW, tilt, node, spin);

  vec3 albedo, emissive;
  float specMask, specPower;
  bodySurface(type, lp, uDetail, cA, cB, cC, albedo, emissive, specMask, specPower);

  float atmo = uBodyColA[i].a;
  float soft = mix(0.012, 0.16, atmo);
  float diff = smoothstep(-soft, soft, mu);

  vec3 Vv = normalize(uCamPos - P);
  /* Oren–Nayar 近似：粗糙表面在掠射角不会骤暗，岩石天体不再「塑料」 */
  if (type == 1 || type == 4 || type == 9) {
    float s = 0.6;
    float A = 1.0 - 0.5 * s * s / (s * s + 0.33);
    float B = 0.45 * s * s / (s * s + 0.09);
    float ti = acos(clamp(mu, 0.0, 1.0));
    float to = acos(clamp(dot(nW, Vv), 0.0, 1.0));
    float al = max(ti, to);
    float be = min(ti, to);
    vec3 Li = normalize(L - nW * mu);
    vec3 Vo = normalize(Vv - nW * dot(nW, Vv));
    float gam = clamp(dot(Li, Vo), 0.0, 1.0);
    float on = max(mu, 0.0) * (A + B * gam * sin(al) * tan(be));
    diff = mix(diff, clamp(on, 0.0, 1.02), 0.55);
  }

  /* 光照补偿：真实 1/r² 会让海王星只剩 0.1%，为了看得见做压缩，README 有说明 */
  float r = max(length(P), 0.05);
  float irr = clamp(1.15 / pow(r, 0.55), 0.55, 1.12);
  float albedoGain = uBodyPar[i].y;
  vec3 col = albedo * albedoGain * diff * irr * 0.95;

  /* Mie 前向散射：太阳在身后时，大气边缘出现一圈亮环 */
  if (atmo > 0.001) {
    float g = clamp(-dot(Vv, L), 0.0, 1.0);
    float rim = pow(1.0 - clamp(dot(nW, Vv), 0.0, 1.0), 3.0);
    col += uBodyColD[i].rgb * pow(g, 5.0) * rim * atmo * uBodyPar[i].x * 1.6;
  }

  /* 环在行星上的投影 */
  float slot = uBodyColC[i].a;
  if (slot > 0.5) {
    int si = int(slot + 0.5) - 1;
    mat3 frame = basisFromUp(axialNorth(tilt, node));
    vec3 nrm = frame[2];
    float denom = dot(L, nrm);
    if (abs(denom) > 1e-5) {
      float tt = dot(c - P, nrm) / denom;
      if (tt > 0.0) {
        vec3 rel = (P + L * tt) - c;
        float rr = length(rel) / R;
        col *= 1.0 - 0.55 * ringAlpha(rr, si);
      }
    }
  }

  /* 夜面 */
  float night = smoothstep(0.02, -0.20, mu);
  col += emissive * night * 1.1;
  col += albedo * 0.012;                  // 星光级别的环境光

  /* 高光 */
  vec3 V = normalize(uCamPos - P);
  vec3 Hv = normalize(L + V);

  /* 有大气的地方才有临边昏暗：无气的岩石天体几乎是平光 */
  float faced = clamp(dot(nW, V), 0.0, 1.0);
  col *= mix(1.0 - 0.42 * atmo, 1.0, pow(faced, 0.55));

  float spec = pow(clamp(dot(nW, Hv), 0.0, 1.0), specPower) * specMask;
  col += vec3(0.92, 0.96, 1.0) * spec * diff * irr * 0.55;

  /* 大气边缘 */
  if (atmo > 0.001) {
    float rim = pow(1.0 - clamp(dot(nW, V), 0.0, 1.0), 2.6);
    float lit = smoothstep(-0.25, 0.55, mu);
    col += uBodyColD[i].rgb * rim * atmo * lit * 0.42;
  }
  return col;
}

/* ---- 日冕 ------------------------------------------------------------- */
vec3 sunCorona(vec3 ro, vec3 rd, float tLimit) {
  vec3 c = uBodyPos[0].xyz;
  float R = uBodyPos[0].w;
  if (R <= 0.0) return vec3(0.0);
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float d2 = dot(oc, oc) - b * b;
  float d = sqrt(max(d2, 0.0));
  if (d > R * 7.0) return vec3(0.0);
  float tClose = -b;
  if (tClose < 0.0 || tClose > tLimit) return vec3(0.0);
  float x = max(d / R, 1.0);
  if (x < 1.0) return vec3(0.0);
  /* 真实日冕比光球暗 6 个数量级，画面里没法等比；这里压到 1–2 个半径内可见 */
  float glow = 0.95 * pow(1.0 / x, 8.0) + 0.16 * pow(1.0 / x, 3.2);
  /* 针状体：从日面径向拉出的细丝 */
  vec3 perp = normalize(oc - rd * b + vec3(1e-6));
  vec3 loc = worldToLocal(perp, 7.25, 0.9, uTime * 0.05);
  float spikes = ridged(vec3(loc.xy * 9.0, loc.z * 2.0) + 3.0, 4);
  glow *= 0.74 + 0.62 * spikes;
  vec3 tint = mix(vec3(1.0, 0.86, 0.62), vec3(1.0, 0.6, 0.36), saturate((x - 1.0) / 6.0));
  return tint * glow * 1.35;
}

/* ---- 悬停高亮环 ------------------------------------------------------- */
vec3 hoverRing(vec3 col, vec2 uv, vec3 ro, vec3 rd) {
  if (uHover < 0 || uHover >= uBodyCount) return col;
  vec3 c = uBodyPos[uHover].xyz;
  float R = uBodyPos[uHover].w;
  vec3 rel = c - ro;
  float z = dot(rel, uCamBasis[2]);
  if (z <= 0.0) return col;
  vec2 sc = vec2(
    dot(rel, uCamBasis[0]) / (z * uTanHalfFov * uAspect),
    dot(rel, uCamBasis[1]) / (z * uTanHalfFov)
  );
  float dist = length(rel);
  float angR = atan(R / max(dist, 1e-6));
  float pxR = angR / uTanHalfFov * 0.5 * uRes.y;
  float want = max(pxR + 6.0, 11.0);
  float dpx = length((uv - sc) * uRes * 0.5);
  float ring = smoothstep(want + 1.6, want + 0.2, dpx) * smoothstep(want - 1.6, want - 0.2, dpx);
  float halo = smoothstep(want + 16.0, want, dpx) * 0.10;
  return col + vec3(0.42, 0.72, 0.80) * (ring * 1.5 + halo);
}

/* ---- 主函数 ----------------------------------------------------------- */
void main() {
  vec2 uv = gl_FragCoord.xy / uRes * 2.0 - 1.0;
  vec3 rd = normalize(uCamBasis * vec3(uv.x * uTanHalfFov * uAspect, uv.y * uTanHalfFov, 1.0));
  vec3 ro = uCamPos;

  int skyOct = 4 + int(uDetail * 3.0);

  float tBest = 1e18;
  int hit = -1;
  for (int i = 0; i < MAXB; i++) {
    if (i >= uBodyCount) break;
    float t;
    if (raySphere(ro, rd, uBodyPos[i].xyz, uBodyPos[i].w, t) && t < tBest) {
      tBest = t;
      hit = i;
    }
  }

  float tRing = 1e18;
  int ringHit = -1;
  vec3 ringP = vec3(0.0);
  for (int i = 0; i < MAXB; i++) {
    if (i >= uBodyCount) break;
    float slot = uBodyColC[i].a;
    if (slot < 0.5) continue;
    int si = int(slot + 0.5) - 1;
    vec3 c = uBodyPos[i].xyz;
    float R = uBodyPos[i].w;
    mat3 frame = basisFromUp(axialNorth(uBodyAxes[i].y, uBodyAxes[i].z));
    vec3 nrm = frame[2];
    float denom = dot(rd, nrm);
    if (abs(denom) < 1e-6) continue;
    float t = dot(c - ro, nrm) / denom;
    if (t <= 0.0 || t >= tRing) continue;
    vec3 P = ro + rd * t;
    float rr = length(P - c) / R;
    if (rr < uRingGeom[si].x || rr > uRingGeom2[si].z) continue;
    tRing = t;
    ringHit = i;
    ringP = P;
  }

  vec3 col;
  float tOut = tBest;

  if (hit >= 0) {
    col = shadeBody(hit, ro + rd * tBest, rd);
  } else {
    col = (uBgOn > 0.5) ? skyRadiance(rd, skyOct) : vec3(0.0);
    tOut = 1e18;
  }

  if (ringHit >= 0 && tRing < tBest) {
    int si = int(uBodyColC[ringHit].a + 0.5) - 1;
    vec3 c = uBodyPos[ringHit].xyz;
    float R = uBodyPos[ringHit].w;
    float rr = length(ringP - c) / R;
    float a = ringAlpha(rr, si);

    /* 掠射角：环变薄但单位面积更亮 */
    mat3 frame = basisFromUp(axialNorth(uBodyAxes[ringHit].y, uBodyAxes[ringHit].z));
    float grazing = clamp(abs(dot(rd, frame[2])), 0.02, 1.0);
    a = clamp(a / max(grazing, 0.05) * 0.55, 0.0, 1.0) * uRingExtra[si].x;

    /* 行星在环上的影子 */
    vec3 L = normalize(-ringP);
    float ts;
    float shadow = 1.0;
    if (raySphere(ringP, L, c, R, ts)) shadow = 0.16;
    /* 环自身的散射：不用物理相函数，只让背光侧稍暗；太阳在环背后时按前向散射增亮 */
    vec3 ringCol = uRingColor[si] * (0.20 + 0.52 * max(dot(normalize(ringP - ro), L), 0.0)) * shadow;
    float backlit = clamp(-dot(normalize(ringP - ro), L), 0.0, 1.0);
    ringCol *= 1.0 + 0.85 * pow(backlit, 4.0);
    col = mix(col, ringCol, a);
    if (tRing < tOut) tOut = tRing;
  }

  col += sunCorona(ro, rd, min(tBest, tRing));
  col += atmosphereGlow(ro, rd, min(tBest, tRing));
  col = hoverRing(col, uv, ro, rd);

  /* L3：银河视图淡入。它是一个独立的 kpc 坐标系，用淡入淡出过渡，不假装连续。 */
  if (uGalaxyMix > 0.001) {
    vec3 gal = galaxyRadiance(uv);
    col = mix(col, gal, uGalaxyMix);
  }

  fragColor = vec4(col, 1.0);
  gl_FragDepth = (tOut > 1e17) ? 1.0 : clamp(1.0 - exp(-tOut * 0.9), 0.0, 0.999);
}
`,
});
