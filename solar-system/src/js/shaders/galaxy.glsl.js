/* ==========================================================================
   galaxy.glsl.js — L3 银河视图：程序化的银河盘 + 太阳轨道与当前位置
   这是一个独立的示意坐标系（单位 kpc），和太阳系的 AU 坐标不是同一套比例，
   所以用淡入淡出过渡，不做「连续缩放」。位置与轨道半径是真的，形态是画的。
   ========================================================================== */
window.HELIOS_SHADERS = Object.assign(window.HELIOS_SHADERS || {}, {
  'galaxy': /* glsl */ `
#define KPC_SUN 8.3

/* 对数螺旋臂：theta = k·ln(r) + 臂序号偏移 */
float spiralArm(float r, float ang, float arms, float pitch, float phase) {
  float k = 1.0 / tan(pitch);
  float th = k * log(max(r, 0.35));
  float d = ang - th - phase;
  float wrapped = mod(d + PI / arms, TAU / arms) - PI / arms;
  return exp(-pow(wrapped / 0.30, 2.0));
}

vec3 galaxyRadiance(vec2 uv) {
  /* 虚拟相机：在银道面坐标里，绕银心转，俯角 uGalaxyCam.z */
  float distKpc = uGalaxyCam.x;
  float azim = uGalaxyCam.y;
  float elev = uGalaxyCam.z;

  vec3 camPos = distKpc * vec3(cos(elev) * cos(azim), cos(elev) * sin(azim), sin(elev));
  vec3 fwd = normalize(-camPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 0.0, 1.0)));
  vec3 up = cross(right, fwd);

  vec3 rd = normalize(right * uv.x * uTanHalfFov * uAspect + up * uv.y * uTanHalfFov + fwd);
  vec3 ro = camPos;

  /* ---- 背景天区：极暗的深空 + 远处星系点 ---- */
  vec3 col = vec3(0.004, 0.005, 0.010);
  float far = fbm(rd * 18.0 + 3.0, 3);
  col += vec3(0.010, 0.012, 0.020) * smoothstep(0.55, 0.85, far);

  /* ---- 银盘：射线与 z=0 平面的交点 ---- */
  float denom = rd.z;
  if (abs(denom) > 1e-4) {
    float t = -ro.z / denom;
    if (t > 0.0) {
      vec3 p = ro + rd * t;
      float r = length(p.xy);
      float ang = atan(p.y, p.x);

      if (r < 17.0) {
        /* 核球 */
        float bulge = exp(-pow(r / 1.7, 1.6)) * 2.1;
        /* 盘 */
        float disk = exp(-r / 2.9) * 0.55 + exp(-r / 6.5) * 0.20;
        /* 旋臂：两条主臂 + 两条次臂 */
        float arms = spiralArm(r, ang, 2.0, 0.22, 0.0) * 0.95 + spiralArm(r, ang, 2.0, 0.22, 2.9) * 0.50;
        arms += spiralArm(r, ang, 4.0, 0.15, 1.2) * 0.26;
        float knots = smoothstep(0.55, 0.92, fbm(vec3(p.xy * 1.5, 7.0), 5));
        float gas = disk * (0.35 + 1.8 * arms) * (0.70 + 0.85 * knots);

        /* 尘埃带：沿臂的内侧偏暗 */
        float dust = smoothstep(0.45, 0.75, ridged(vec3(p.xy * 2.2, 11.0), 4)) * exp(-r / 7.0);
        gas *= 1.0 - 0.50 * dust;

        vec3 bulgeCol = vec3(1.00, 0.88, 0.66);
        vec3 diskCol = mix(vec3(0.66, 0.76, 1.00), vec3(0.92, 0.90, 0.86), smoothstep(1.5, 8.0, r));
        vec3 armCol = vec3(0.56, 0.72, 1.00);
        vec3 g = bulgeCol * bulge + diskCol * disk * 0.50 + armCol * gas * 0.80;

        /* 中心更亮 */
        g += vec3(1.0, 0.92, 0.78) * exp(-r * r / 0.22) * 2.4;
        col += g * 0.62;
      }
    }
  }

  /* ---- 太阳的轨道与当前位置（叠加在最上面，不受盘面遮挡） ---- */
  {
    /* 轨道圆环：r = 8.3 kpc 的一条细线 */
    float denom2 = rd.z;
    if (abs(denom2) > 1e-4) {
      float t = -ro.z / denom2;
      if (t > 0.0) {
        vec3 p = ro + rd * t;
        float r = length(p.xy);
        float ring = 1.0 - smoothstep(0.0, 0.10, abs(r - KPC_SUN));
        col += vec3(0.36, 0.62, 0.70) * ring * 0.55;

        /* 太阳在轨道上的位置：从银心看是 180° + 相位 */
        float sunAng = PI + uSunGalAngle;
        vec2 sunP = KPC_SUN * vec2(cos(sunAng), sin(sunAng));
        float dSun = length(p.xy - sunP);
        float marker = exp(-pow(dSun / 0.35, 2.0)) * 1.6 + exp(-pow(dSun / 1.2, 2.0)) * 0.25;
        col += vec3(0.98, 0.82, 0.46) * marker;

        /* 太阳到银心的连线（虚线感） */
        float lineW = 0.03;
        vec2 a = vec2(0.0);
        vec2 b = sunP;
        vec2 pa = p.xy - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float dLine = length(pa - ba * h);
        float seg = step(0.55, fract(h * 9.0));
        col += vec3(0.50, 0.56, 0.60) * (1.0 - smoothstep(0.0, lineW, dLine)) * seg * 0.30;

        /* 银心标记 */
        float dGc = length(p.xy);
        col += vec3(1.0, 0.88, 0.62) * (1.0 - smoothstep(0.0, 0.5, dGc)) * 0.9;
      }
    }
  }

  return col;
}
`,
});
