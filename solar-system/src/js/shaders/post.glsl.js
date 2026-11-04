/* ==========================================================================
   post.glsl.js — HDR 后处理链：亮部提取 → 两级 bloom → ACES → 色差 / 暗角 / 颗粒
   没有这一层，太阳就没法「亮到溢出却不过曝」，银河暗部也会被压死。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'brightFrag': /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2 uTexel;
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

  'copyFrag': /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSource;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  c += texture(uSource, vUv + uTexel * vec2(-0.5, -0.5)).rgb;
  c += texture(uSource, vUv + uTexel * vec2(0.5, -0.5)).rgb;
  c += texture(uSource, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture(uSource, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  fragColor = vec4(c * 0.25, 1.0);
}
`,

  'compositeFrag': /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;      // 紧的一级（1/4）
uniform sampler2D uBloomWide;  // 宽的一级（1/8）
uniform vec2  uSceneTexel;     // 场景纹理的单位像素
uniform float uSS;             // 超采样倍率（1 / 1.25 / 1.5）
uniform int   uDebug;          // 0 成片 / 1 场景 / 2 辉光 / 3 无辉光
uniform float uExposure;
uniform float uBloomGain;
uniform float uGrain;
uniform float uVignette;
uniform float uAberration;
uniform float uFrame;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(max(c, 1e-5), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

float grainNoise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

/* 超采样降采样：一个输出像素里取 4 个次像素做 box filter，边缘立刻干净 */
vec3 sampleScene(vec2 uv) {
  vec3 c = texture(uScene, uv).rgb;
  if (uSS > 1.001) {
    vec2 o = uSceneTexel * 0.5;
    c = vec3(0.0);
    c += texture(uScene, uv + vec2(-o.x, -o.y)).rgb;
    c += texture(uScene, uv + vec2( o.x, -o.y)).rgb;
    c += texture(uScene, uv + vec2(-o.x,  o.y)).rgb;
    c += texture(uScene, uv + vec2( o.x,  o.y)).rgb;
    c *= 0.25;
  }
  return c;
}

void main() {
  /* 轻微横向色差：越靠边缘越明显 */
  vec2 dir = vUv - 0.5;
  float amt = uAberration * dot(dir, dir);
  vec3 scene;
  scene.r = sampleScene(vUv + dir * amt).r;
  scene.g = sampleScene(vUv).g;
  scene.b = sampleScene(vUv - dir * amt).b;

  vec3 bloom = texture(uBloom, vUv).rgb + texture(uBloomWide, vUv).rgb * 0.75;

  if (uDebug == 1) {
    fragColor = vec4(toSRGB(aces(scene * uExposure)), 1.0);
    return;
  }
  if (uDebug == 2) {
    fragColor = vec4(toSRGB(aces(bloom * uBloomGain * 2.0)), 1.0);
    return;
  }

  vec3 col = scene + (uDebug == 3 ? vec3(0.0) : bloom * uBloomGain);
  col *= uExposure;
  col = aces(col);

  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * dot(q, q) * 1.35;
  col *= clamp(vig, 0.0, 1.0);

  col = toSRGB(col);
  /* 抖动：8bit 输出前加一点噪声，压掉暗部渐变里的色带 */
  float dither = (grainNoise(gl_FragCoord.xy) - 0.5) * (1.6 / 255.0);
  col += dither;
  col += (grainNoise(gl_FragCoord.xy + 31.7) - 0.5) * uGrain;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`,
});
