/* ==========================================================================
   stars.glsl.js — 恒星星点与轨道 / 星座连线（都是独立的几何通道）
   星点位置直接来自 HYG 星表，亮度按 I ∝ 10^(−0.4·m) 换算，颜色由 B−V 推色温。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'starVert': /* glsl */ `
precision highp float;

in vec3 aDir;      // 天球方向（黄道系单位向量）
in vec4 aColor;    // rgb = 颜色，a = 相对通量
in float aMag;     // V 星等，用来定尺寸
in vec3 aPos;      // L2：恒星的真实 3D 位置（AU，黄道系）

uniform mat3  uCamBasis;   // 列：右、上、前
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec2  uRes;
uniform float uGain;       // 用户星空亮度
uniform float uMinPx;
uniform float uPxScale;    // dpr
uniform float uMode;       // 0 = 天球方向（无穷远），1 = 3D 位置（L2）
uniform vec3  uCamPos;
uniform float uNearMix;
uniform float uStretch;    // 一个像素对应多少世界单位（L2 的点大小）

out vec4 vColor;
out vec2 vQuiet;

void main() {
  float zf;
  vec3 v3;
  if (uMode > 0.5) {
    vec3 rel = aPos - uCamPos;
    zf = dot(rel, uCamBasis[2]);
    v3 = vec3(dot(rel, uCamBasis[0]), dot(rel, uCamBasis[1]), zf);
  } else {
    float d = dot(aDir, uCamBasis[2]);
    zf = d * 1e12;
    v3 = vec3(dot(aDir, uCamBasis[0]), dot(aDir, uCamBasis[1]), 0.0);
  }

  if (zf <= 0.02) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vQuiet = vec2(0.0);
    return;
  }

  vec2 ndc;
  if (uMode > 0.5) {
    ndc = vec2(v3.x / (zf * uTanHalfFov * uAspect), v3.y / (zf * uTanHalfFov));
  } else {
    float z = dot(aDir, uCamBasis[2]);
    ndc = vec2(v3.x / (z * uTanHalfFov * uAspect), v3.y / (z * uTanHalfFov));
  }
  gl_Position = vec4(ndc, 0.9999995, 1.0);

  float flux = aColor.a;
  float lum = clamp(flux * uGain, 0.0, 40.0);

  float px = uMinPx + pow(clamp(flux, 0.0, 1.0), 0.42) * 2.6;
  if (uMode > 0.5) {
    /* L2：近邻恒星用真实距离；点大小保底 1.6 px，否则和无穷远星点分不出来 */
    float sizePx = uStretch > 0.0 ? (1.6 / zf) * uRes.y * 0.5 : 1.6;
    px = clamp(sizePx, 1.6, 9.0);
    lum *= uNearMix;
    if (lum > 0.001) lum = max(lum, 0.05);
  }
  gl_PointSize = px * uPxScale;

  vColor = vec4(aColor.rgb * lum, 1.0);
  vQuiet = vec2(aMag, px);
}
`,

  'starFrag': /* glsl */ `
precision highp float;

in vec4 vColor;
in vec2 vQuiet;

uniform float uSpike;   // 只有最亮的几颗给星芒
out vec4 fragColor;

void main() {
  /* PSF：核心用高斯，外围用 Moffat 的长尾，合起来才像真实星点而不是像素方块 */
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 7.0);
  float moffat = pow(1.0 + r2 * 4.0, -2.2) * 0.42;

  float mag = vQuiet.x;
  float spike = 0.0;
  if (mag < 2.0) {
    float k = clamp((2.0 - mag) / 3.0, 0.0, 1.0) * uSpike;
    vec2 a = abs(p);
    float arm = exp(-a.y * 11.0) * exp(-a.x * 1.3) + exp(-a.x * 11.0) * exp(-a.y * 1.3);
    spike = arm * k * 0.5;
  }
  vec3 col = vColor.rgb * (core + moffat + spike);
  fragColor = vec4(col, 1.0);
}
`,

  /* 通用线段：轨道椭圆、星座连线。位置已在 CPU 侧投影并做过近平面裁剪。 */
  'lineVert': /* glsl */ `
precision highp float;
in vec3 aPos;      // 已投影的 NDC（x, y, depth）
in vec4 aColor;
out vec4 vColor;
void main() {
  vColor = aColor;
  gl_Position = vec4(aPos.xy, aPos.z, 1.0);
}
`,

  'lineFrag': /* glsl */ `
precision highp float;
in vec4 vColor;
out vec4 fragColor;
void main() {
  fragColor = vColor;
}
`,
});
