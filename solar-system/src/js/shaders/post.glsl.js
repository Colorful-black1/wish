/* ==========================================================================
   post.glsl.js — HDR 后处理链：亮部提取 → 可分离高斯 → ACES 合成
   没有这一层，太阳就没法「亮到溢出却不过曝」，银河暗部也会被压死。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'brightFrag': /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2 uTexel;     // 目标纹理的 texel 尺寸
uniform float uThreshold;
uniform float uKnee;

void main() {
  vec3 c = vec3(0.0);
  c += texture(uScene, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture(uScene, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture(uScene, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture(uScene, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;

  float lum = max(c.r, max(c.g, c.b));
  float soft = clamp(lum - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float w = max(soft, lum - uThreshold) / max(lum, 1e-4);
  fragColor = vec4(c * w, 1.0);
}
`,

  'blurFrag': /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec2 uDirection;   // texel 尺寸 × 方向
uniform float uSigma;

void main() {
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int i = -7; i <= 7; i++) {
    float fi = float(i);
    float w = exp(-(fi * fi) / (2.0 * uSigma * uSigma));
    sum += texture(uSource, vUv + uDirection * fi).rgb * w;
    wsum += w;
  }
  fragColor = vec4(sum / max(wsum, 1e-4), 1.0);
}
`,

  'compositeFrag': /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uExposure;
uniform float uBloomGain;
uniform float uGrain;
uniform float uVignette;
uniform float uFrame;     // 固定帧号，保证同一 URL 两次截图一致

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, 1e-5), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float grain(vec2 p) {
  return fract(sin(dot(p + uFrame * 0.0, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 col = scene + bloom * uBloomGain;
  col *= uExposure;
  col = aces(col);

  /* 极轻的暗角，把视线收回中央 */
  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(q, q) * 1.35;
  col *= clamp(vig, 0.0, 1.0);

  col = toSRGB(col);
  float n = grain(gl_FragCoord.xy) - 0.5;
  col += n * uGrain;
  fragColor = vec4(col, 1.0);
}
`,
});
