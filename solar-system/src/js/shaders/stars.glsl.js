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

uniform mat3  uCamBasis;   // 列：右、上、前
uniform float uTanHalfFov;
uniform float uAspect;
uniform vec2  uRes;
uniform float uGain;       // 用户星空亮度
uniform float uMinPx;
uniform float uPxScale;    // dpr

out vec4 vColor;
out vec2 vQuiet;

void main() {
  vec3 d = aDir;
  float zf = dot(d, uCamBasis[2]);
  if (zf <= 0.02) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec4(0.0);
    vQuiet = vec2(0.0);
    return;
  }
  vec2 ndc = vec2(
    dot(d, uCamBasis[0]) / (zf * uTanHalfFov * uAspect),
    dot(d, uCamBasis[1]) / (zf * uTanHalfFov)
  );
  gl_Position = vec4(ndc, 0.9999995, 1.0);

  float flux = aColor.a;
  float lum = clamp(flux * uGain, 0.0, 40.0);

  /* 亮星给更大的点，暗星只占 1–2 px —— 不允许「每颗一样亮」 */
  float px = uMinPx + pow(clamp(flux, 0.0, 1.0), 0.42) * 2.6;
  px *= uPxScale;
  gl_PointSize = px;

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
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 5.5);
  float halo = exp(-r2 * 1.6) * 0.30;

  /* 星芒 / 衍射十字：艺术化处理，只给最亮的一档 */
  float mag = vQuiet.x;
  float spike = 0.0;
  if (mag < 1.2) {
    float k = clamp((1.2 - mag) / 2.2, 0.0, 1.0) * uSpike;
    vec2 a = abs(p);
    float arm = exp(-a.y * 9.0) * exp(-a.x * 1.1) + exp(-a.x * 9.0) * exp(-a.y * 1.1);
    spike = arm * k * 0.45;
  }
  vec3 col = vColor.rgb * (core + halo + spike);
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
