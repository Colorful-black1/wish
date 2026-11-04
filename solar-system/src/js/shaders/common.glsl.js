/* ==========================================================================
   common.glsl.js — 所有 shader 共用的常量、哈希、噪声、坐标工具
   纯程序化：这里没有一个纹理采样，所有细节都是算出来的。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'common': /* glsl */ `
precision highp float;

#define PI  3.14159265359
#define TAU 6.28318530718
#define DEG 0.01745329252

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3  saturate3(vec3 v) { return clamp(v, 0.0, 1.0); }

/* ---- 哈希：整数格点 → 伪随机 ------------------------------------------ */
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

/* ---- 值噪声 ------------------------------------------------------------ */
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

/* 分形叠加。oct 由视距决定：越近层数越多，这是「细节真的变多」而不是放大。 */
float fbm(vec3 p, int oct) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    sum += amp * vnoise(p);
    norm += amp;
    p = p * 2.03 + vec3(11.7, 7.3, 5.1);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-5);
}

/* 脊状噪声：山脊、云带边缘、日冕纤维都用它。 */
float ridged(vec3 p, int oct) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0);
    sum += amp * n * n;
    norm += amp;
    p = p * 2.11 + vec3(3.1, 9.7, 1.3);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-5);
}

/* 近似涡胞噪声：单个格点取最近随机点，够像撞击坑，成本只有一次哈希。 */
float cellF1(vec3 p) {
  vec3 q = floor(p);
  vec3 f = fract(p);
  vec3 r = hash33(q);
  vec3 d = f - (0.15 + r * 0.7);
  return length(d);
}

/* ---- 旋转 / 坐标系 ----------------------------------------------------- */
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

mat3 rotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0);
}

/* 以 up 为 +Z 的正交基（列向量）。 */
mat3 basisFromUp(vec3 up) {
  vec3 helper = abs(up.z) > 0.94 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 ex = normalize(cross(helper, up));
  vec3 ey = cross(up, ex);
  return mat3(ex, ey, up);
}

/* 天体自转轴：从黄道北极按轴倾角倾斜，绕一个固定的方位角（由 seed 决定，
   避免所有行星的北极朝同一侧，也让天王星的环躺在自己该躺的平面里）。 */
vec3 axialNorth(float tiltDeg, float nodeRad) {
  float t = tiltDeg * DEG;
  return normalize(vec3(sin(t) * cos(nodeRad), sin(t) * sin(nodeRad), cos(t)));
}

/* 世界方向 → 天体本地方向（含自转相位）。 */
vec3 worldToLocal(vec3 dirWorld, float tiltDeg, float nodeRad, float spin) {
  mat3 frame = basisFromUp(axialNorth(tiltDeg, nodeRad));
  vec3 l = transpose(frame) * dirWorld;
  return rotZ(spin) * l;
}

/* ---- 色彩 ------------------------------------------------------------- */
/* 粗略黑体色：用于恒星 B−V → 色温 → RGB。不是光谱还原，只求蓝白到橙红的分布对。 */
vec3 blackbodyRGB(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  float r, g, b;
  if (t <= 66.0) {
    r = 255.0;
    g = 99.4708025861 * log(max(t, 1.0)) - 161.1195681661;
  } else {
    r = 329.698727446 * pow(t - 60.0, -0.1332047592);
    g = 288.1221695283 * pow(t - 60.0, -0.0755148492);
  }
  if (t >= 66.0) {
    b = 255.0;
  } else if (t <= 19.0) {
    b = 0.0;
  } else {
    b = 138.5177312231 * log(t - 10.0) - 305.0447927307;
  }
  return saturate3(vec3(r, g, b) / 255.0);
}

/* B−V → 有效温度（Ballesteros 公式），只用于配色。 */
float bvToKelvin(float bv) {
  float b = clamp(bv, -0.4, 2.0);
  return clamp(4600.0 * (1.0 / (0.92 * b + 1.7) + 1.0 / (0.92 * b + 0.62)), 1700.0, 30000.0);
}
`,
});
