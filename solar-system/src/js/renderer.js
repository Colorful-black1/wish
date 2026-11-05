/* ==========================================================================
   renderer.js — WebGL2 上下文、程序、帧缓冲、星点与线段几何
   一次绘制 = 全屏 raytrace + 星点 + 轨道线 → 亮部提取 → 高斯 → ACES 合成
   ========================================================================== */
(function () {
  'use strict';

  var MAXB = 20;
  var MAXR = 2;

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    // GLSL ES 3.00 要求 #version 必须出现在最前面
    gl.shaderSource(sh, /^\s*#version/.test(src) ? src : '#version 300 es\n' + src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh) || '';
      gl.deleteShader(sh);
      throw new Error('shader compile failed:\n' + log + '\n--- source ---\n' + src.slice(0, 1200));
    }
    return sh;
  }

  function program(gl, vsSrc, fsSrc) {
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('program link failed: ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  }

  function locs(gl, prog, names) {
    var out = {};
    for (var i = 0; i < names.length; i++) out[names[i]] = gl.getUniformLocation(prog, names[i]);
    return out;
  }

  function blackbodyRGB(kelvin) {
    var t = Math.min(Math.max(kelvin, 1000), 40000) / 100;
    var r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(Math.max(t, 1)) - 161.1195681661;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    }
    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [
      Math.min(Math.max(r, 0), 255) / 255,
      Math.min(Math.max(g, 0), 255) / 255,
      Math.min(Math.max(b, 0), 255) / 255,
    ];
  }

  function bvToKelvin(bv) {
    var b = Math.min(Math.max(bv, -0.4), 2.0);
    return Math.min(Math.max(4600 * (1 / (0.92 * b + 1.7) + 1 / (0.92 * b + 0.62)), 1700), 30000);
  }

  function decodeStars() {
    var S = window.HELIOS_STARS;
    if (!S || !S.b64) return null;
    var bin = atob(S.b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var u16 = new Uint16Array(bytes.buffer, 0, S.n * 4);
    return { n: S.n, u16: u16, names: S.names || [], meta: S.meta || {} };
  }

  function create(canvas) {
    var opts = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      desynchronized: false,
    };
    var gl = canvas.getContext('webgl2', opts);
    if (!gl) return null;

    var S = window.HELIOS_SHADERS;
    var floatOK = !!gl.getExtension('EXT_color_buffer_float');
    var colorFmt = floatOK ? gl.RGBA16F : gl.RGBA8;
    var colorType = floatOK ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    /* ---- 程序 ---- */
    var sceneProg, starProg, lineProg, brightProg, blurProg, copyProg, compProg;
    var errors = [];
    try {
      sceneProg = program(
        gl,
        S['sceneVert'],
        S['common'] + S['sceneDecl'] + S['surface'] + S['sky'] + S['galaxy'] + S['sceneBody']
      );
      starProg = program(gl, S['starVert'], S['starFrag']);
      lineProg = program(gl, S['lineVert'], S['lineFrag']);
      brightProg = program(gl, S['sceneVert'], S['brightFrag']);
      blurProg = program(gl, S['sceneVert'], S['blurFrag']);
      copyProg = program(gl, S['sceneVert'], S['copyFrag']);
      compProg = program(gl, S['sceneVert'], S['compositeFrag']);
    } catch (e) {
      errors.push(String(e && e.message ? e.message : e));
      return { failed: true, error: errors.join('\n'), gl: gl };
    }

    var sceneU = locs(gl, sceneProg, [
      'uRes', 'uCamPos', 'uCamBasis', 'uTanHalfFov', 'uAspect', 'uDetail', 'uTime',
      'uBgOn', 'uBodyCount', 'uHover',
      'uBodyPos', 'uBodyAxes', 'uBodyColA', 'uBodyColB', 'uBodyColC', 'uBodyColD', 'uBodyPar',
      'uRingGeom', 'uRingGeom2', 'uRingExtra', 'uRingColor',
      'uEclToGal', 'uStarBright', 'uMilkyGain', 'uSkyObjCount',
      'uSkyObjDir', 'uSkyObjAxis', 'uSkyObjSize', 'uSkyObjPa', 'uSkyObjBright', 'uSkyObjKind',
      'uGalaxyMix', 'uGalaxyCam', 'uSunGalAngle', 'uNearMix', 'uOctaveCap',
    ]);
    var starU = locs(gl, starProg, [
      'uCamBasis', 'uTanHalfFov', 'uAspect', 'uRes', 'uGain', 'uMinPx', 'uPxScale', 'uSpike',
      'uMode', 'uCamPos', 'uNearMix', 'uStretch',
    ]);
    var brightU = locs(gl, brightProg, ['uScene', 'uTexel', 'uThreshold', 'uKnee']);
    var blurU = locs(gl, blurProg, ['uSource', 'uDirection', 'uSigma']);
    var copyU = locs(gl, copyProg, ['uSource', 'uTexel']);
    var compU = locs(gl, compProg, [
      'uScene', 'uBloom', 'uBloomWide', 'uExposure', 'uBloomGain', 'uGrain', 'uVignette', 'uAberration', 'uFrame',
      'uSceneTexel', 'uSS', 'uDebug',
    ]);

    /* ---- 全屏四边形（无顶点缓冲，用 gl_VertexID） ---- */
    var emptyVao = gl.createVertexArray();

    /* ---- 星点几何（一次性） ---- */
    var starCount = 0;
    var starVao = gl.createVertexArray();
    var starBuf = gl.createBuffer();
    var starIndex = new Map(); // 名字 → 索引
    (function buildStars() {
      var cat = decodeStars();
      if (!cat) return;
      var n = cat.n;
      var u16 = cat.u16;
      var data = new Float32Array(n * 8);
      var A = window.HELIOS_ASTRO;
      for (var i = 0; i < n; i++) {
        var ra = u16[i * 4] / 100;
        var dec = (u16[i * 4 + 1] - 9000) / 100;
        var mag = (u16[i * 4 + 2] - 2000) / 100;
        var ci = (u16[i * 4 + 3] - 5000) / 100;
        var d = A.raDecToEclipticUnit(ra, dec);
        var rgb = blackbodyRGB(bvToKelvin(ci));
        var flux = Math.pow(10, -0.4 * (mag + 1.44));
        data[i * 8 + 0] = d.x;
        data[i * 8 + 1] = d.y;
        data[i * 8 + 2] = d.z;
        data[i * 8 + 3] = rgb[0];
        data[i * 8 + 4] = rgb[1];
        data[i * 8 + 5] = rgb[2];
        data[i * 8 + 6] = flux;
        data[i * 8 + 7] = mag;
      }
      for (var k = 0; k < cat.names.length; k++) starIndex.set(cat.names[k][1], cat.names[k][0]);
      starCount = n;
      gl.bindVertexArray(starVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, starBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var stride = 32;
      var aDir = gl.getAttribLocation(starProg, 'aDir');
      var aColor = gl.getAttribLocation(starProg, 'aColor');
      var aMag = gl.getAttribLocation(starProg, 'aMag');
      gl.enableVertexAttribArray(aDir);
      gl.vertexAttribPointer(aDir, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(aMag);
      gl.vertexAttribPointer(aMag, 1, gl.FLOAT, false, stride, 28);
      gl.bindVertexArray(null);
    })();

    /* ---- L2 近邻恒星（带真实距离） ---- */
    var nearCount = 0;
    var nearVao = gl.createVertexArray();
    var nearBuf = gl.createBuffer();
    (function buildNearStars() {
      var N = window.HELIOS_STARS_NEAR;
      if (!N || !N.b64) return;
      var bin = atob(N.b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var f32 = new Float32Array(bytes.buffer, 0, N.n * 5);
      // 交错：dir(3) color(4) mag(1) pos(3) = 11 floats
      var data = new Float32Array(N.n * 11);
      for (var k = 0; k < N.n; k++) {
        var px = f32[k * 5], py = f32[k * 5 + 1], pz = f32[k * 5 + 2];
        var mag = f32[k * 5 + 3], ci = f32[k * 5 + 4];
        var len = Math.hypot(px, py, pz) || 1;
        var rgb = blackbodyRGB(bvToKelvin(ci));
        var flux = Math.pow(10, -0.4 * (mag + 1.44));
        var o = k * 11;
        data[o] = px / len;
        data[o + 1] = py / len;
        data[o + 2] = pz / len;
        data[o + 3] = rgb[0];
        data[o + 4] = rgb[1];
        data[o + 5] = rgb[2];
        data[o + 6] = flux;
        data[o + 7] = mag;
        data[o + 8] = px;
        data[o + 9] = py;
        data[o + 10] = pz;
      }
      nearCount = N.n;
      gl.bindVertexArray(nearVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, nearBuf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var stride = 44;
      var aDir = gl.getAttribLocation(starProg, 'aDir');
      var aColor = gl.getAttribLocation(starProg, 'aColor');
      var aMag = gl.getAttribLocation(starProg, 'aMag');
      var aPos = gl.getAttribLocation(starProg, 'aPos');
      gl.enableVertexAttribArray(aDir);
      gl.vertexAttribPointer(aDir, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(aMag);
      gl.vertexAttribPointer(aMag, 1, gl.FLOAT, false, stride, 28);
      if (aPos >= 0) {
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 32);
      }
      gl.bindVertexArray(null);
    })();

    /* ---- 线段（轨道 / 星座），每帧更新 ---- */
    var lineVao = gl.createVertexArray();
    var lineBuf = gl.createBuffer();
    var lineCapacity = 0;
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    var aPos = gl.getAttribLocation(lineProg, 'aPos');
    var aCol = gl.getAttribLocation(lineProg, 'aColor');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);

    /* ---- 帧缓冲 ---- */
    function makeTarget(w, h, withDepth) {
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, colorFmt, w, h, 0, gl.RGBA, colorType, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      var depth = null;
      if (withDepth) {
        depth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fbo: fbo, tex: tex, depth: depth, w: w, h: h };
    }

    var sceneTarget = null;
    var bloomA = null;
    var bloomB = null;
    var bloomW = null;
    var bloomX = null;

    function ensureTargets(w, h) {
      if (sceneTarget && sceneTarget.w === w && sceneTarget.h === h) return;
      if (sceneTarget) {
        gl.deleteFramebuffer(sceneTarget.fbo);
        gl.deleteTexture(sceneTarget.tex);
        if (sceneTarget.depth) gl.deleteRenderbuffer(sceneTarget.depth);
      }
      [bloomA, bloomB, bloomW, bloomX].forEach(function (t) {
        if (t) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
      });
      sceneTarget = makeTarget(w, h, true);
      var bw = Math.max(1, w >> 2);
      var bh = Math.max(1, h >> 2);
      bloomA = makeTarget(bw, bh, false);
      bloomB = makeTarget(bw, bh, false);
      var ww = Math.max(1, w >> 3);
      var wh = Math.max(1, h >> 3);
      bloomW = makeTarget(ww, wh, false);
      bloomX = makeTarget(ww, wh, false);
    }

    /* ---- 缓冲 ---- */
    var bodyPos = new Float32Array(MAXB * 4);
    var bodyAxes = new Float32Array(MAXB * 4);
    var bodyColA = new Float32Array(MAXB * 4);
    var bodyColB = new Float32Array(MAXB * 4);
    var bodyColC = new Float32Array(MAXB * 4);
    var bodyColD = new Float32Array(MAXB * 4);
    var bodyPar = new Float32Array(MAXB * 4);
    var ringGeom = new Float32Array(MAXR * 4);
    var ringGeom2 = new Float32Array(MAXR * 4);
    var ringExtra = new Float32Array(MAXR * 4);
    var ringColor = new Float32Array(MAXR * 3);

    var skyDirs = new Float32Array(8 * 3);
    var skyAxes = new Float32Array(8 * 3);
    var skySizes = new Float32Array(8 * 2);
    var skyPa = new Float32Array(8);
    var skyBright = new Float32Array(8);
    var skyKind = new Int32Array(8);

    var api = {
      gl: gl,
      ok: true,
      starCount: starCount,
      nearStarCount: nearCount,
      starIndex: starIndex,
      floatOK: floatOK,
      drawCalls: 0,

      /* 当前真正送去绘制的线段顶点数（0 = 这一帧没有画线） */
      lineVertices: function () {
        return api._lineCount || 0;
      },

      setLines: function (arr) {
        if (!arr || !arr.length) {
          // 必须把绘制计数清零，否则上一帧的轨道线会用旧顶点继续画在特写里
          lineCapacity = 0;
          api._lineCount = 0;
          return;
        }
        gl.bindVertexArray(lineVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
        if (arr.length > lineCapacity) {
          lineCapacity = arr.length;
          gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
        } else {
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, arr);
        }
        gl.bindVertexArray(null);
        lineCapacity = Math.max(lineCapacity, arr.length);
        api._lineCount = arr.length / 7;
      },

      render: function (st) {
        var w = st.pixelWidth;
        var h = st.pixelHeight;
        if (!w || !h) return;
        var sw = st.sceneWidth || w;
        var sh = st.sceneHeight || h;
        ensureTargets(sw, sh);

        var aspect = sw / sh;
        var pxScale = st.pxScale || 1;

        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneTarget.fbo);
        gl.viewport(0, 0, sw, sh);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.clearColor(0, 0, 0, 1);
        gl.clearDepth(1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        /* ---- 场景 raytrace ---- */
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.useProgram(sceneProg);
        gl.bindVertexArray(emptyVao);
        gl.uniform2f(sceneU.uRes, sw, sh);
        gl.uniform3fv(sceneU.uCamPos, st.camPos);
        gl.uniformMatrix3fv(sceneU.uCamBasis, false, st.camBasis);
        gl.uniform1f(sceneU.uTanHalfFov, st.tanHalf);
        gl.uniform1f(sceneU.uAspect, aspect);
        gl.uniform1f(sceneU.uDetail, st.detail);
        gl.uniform1f(sceneU.uTime, st.time);
        gl.uniform1f(sceneU.uBgOn, st.bgOn ? 1 : 0);
        gl.uniform1i(sceneU.uHover, st.hover);
        gl.uniform1i(sceneU.uBodyCount, st.bodyCount);
        gl.uniform4fv(sceneU.uBodyPos, bodyPos);
        gl.uniform4fv(sceneU.uBodyAxes, bodyAxes);
        gl.uniform4fv(sceneU.uBodyColA, bodyColA);
        gl.uniform4fv(sceneU.uBodyColB, bodyColB);
        gl.uniform4fv(sceneU.uBodyColC, bodyColC);
        gl.uniform4fv(sceneU.uBodyColD, bodyColD);
        gl.uniform4fv(sceneU.uBodyPar, bodyPar);
        gl.uniform4fv(sceneU.uRingGeom, ringGeom);
        gl.uniform4fv(sceneU.uRingGeom2, ringGeom2);
        gl.uniform4fv(sceneU.uRingExtra, ringExtra);
        gl.uniform3fv(sceneU.uRingColor, ringColor);
        gl.uniformMatrix3fv(sceneU.uEclToGal, false, st.eclToGal);
        gl.uniform1f(sceneU.uStarBright, st.starBright);
        gl.uniform1f(sceneU.uMilkyGain, st.milkyGain);
        gl.uniform1i(sceneU.uSkyObjCount, st.skyObjCount);
        gl.uniform3fv(sceneU.uSkyObjDir, skyDirs);
        gl.uniform3fv(sceneU.uSkyObjAxis, skyAxes);
        gl.uniform2fv(sceneU.uSkyObjSize, skySizes);
        gl.uniform1fv(sceneU.uSkyObjPa, skyPa);
        gl.uniform1fv(sceneU.uSkyObjBright, skyBright);
        gl.uniform1iv(sceneU.uSkyObjKind, skyKind);
        gl.uniform1f(sceneU.uGalaxyMix, st.galaxyMix || 0);
        gl.uniform3fv(sceneU.uGalaxyCam, st.galaxyCam || [30, 0, 0.4]);
        gl.uniform1f(sceneU.uSunGalAngle, st.sunGalAngle || 0);
        gl.uniform1f(sceneU.uNearMix, st.nearMix || 0);
        gl.uniform1i(sceneU.uOctaveCap, st.octaveCap || 7);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        api.drawCalls = 1;

        /* ---- 星点 ---- */
        gl.useProgram(starProg);
        gl.uniformMatrix3fv(starU.uCamBasis, false, st.camBasis);
        gl.uniform1f(starU.uTanHalfFov, st.tanHalf);
        gl.uniform1f(starU.uAspect, aspect);
        gl.uniform2f(starU.uRes, sw, sh);
        gl.uniform1f(starU.uGain, st.starGain);
        gl.uniform1f(starU.uMinPx, 1.0);
        gl.uniform1f(starU.uPxScale, pxScale);
        gl.uniform1f(starU.uSpike, 1.0);
        gl.uniform3fv(starU.uCamPos, st.camPos);
        gl.uniform1f(starU.uNearMix, st.nearMix || 0);
        gl.uniform1f(starU.uStretch, 0.0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.depthMask(false);

        if (st.bgOn && starCount) {
          gl.bindVertexArray(starVao);
          gl.uniform1f(starU.uMode, 0.0);
          gl.drawArrays(gl.POINTS, 0, starCount);
          api.drawCalls++;
        }
        if (st.bgOn && nearCount && (st.nearMix || 0) > 0.002) {
          gl.bindVertexArray(nearVao);
          gl.uniform1f(starU.uMode, 1.0);
          gl.drawArrays(gl.POINTS, 0, nearCount);
          api.drawCalls++;
        }

        /* ---- 线段 ---- */
        if (api._lineCount > 0 && st.linesOn) {
          gl.useProgram(lineProg);
          gl.bindVertexArray(lineVao);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(false);
          gl.drawArrays(gl.LINES, 0, api._lineCount);
          api.drawCalls++;
        }

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.bindVertexArray(null);

        /* ---- 亮部 ---- */
        var bw = bloomA.w;
        var bh = bloomA.h;
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
        gl.viewport(0, 0, bw, bh);
        gl.useProgram(brightProg);
        gl.bindVertexArray(emptyVao);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sceneTarget.tex);
        gl.uniform1i(brightU.uScene, 0);
        gl.uniform2f(brightU.uTexel, 1 / w, 1 / h);
        gl.uniform1f(brightU.uThreshold, st.bloomThreshold);
        gl.uniform1f(brightU.uKnee, 0.55);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        api.drawCalls++;

        /* ---- 可分离高斯（乒乓） ---- */
        gl.useProgram(blurProg);
        var passes = st.bloomPasses;
        for (var p = 0; p < passes; p++) {
          var sigma = 2.2 + p * 1.1;
          gl.bindFramebuffer(gl.FRAMEBUFFER, bloomB.fbo);
          gl.viewport(0, 0, bw, bh);
          gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
          gl.uniform1i(blurU.uSource, 0);
          gl.uniform2f(blurU.uDirection, 1 / bw, 0);
          gl.uniform1f(blurU.uSigma, sigma);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindFramebuffer(gl.FRAMEBUFFER, bloomA.fbo);
          gl.bindTexture(gl.TEXTURE_2D, bloomB.tex);
          gl.uniform2f(blurU.uDirection, 0, 1 / bh);
          gl.uniform1f(blurU.uSigma, sigma);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          api.drawCalls += 2;
        }

        /* ---- 第二级（更宽、1/8 分辨率）---- */
        gl.useProgram(copyProg);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bloomW.fbo);
        gl.viewport(0, 0, bloomW.w, bloomW.h);
        gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
        gl.uniform1i(copyU.uSource, 0);
        gl.uniform2f(copyU.uTexel, 1 / bw, 1 / bh);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.useProgram(blurProg);
        for (var p2 = 0; p2 < 2; p2++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, bloomX.fbo);
          gl.viewport(0, 0, bloomW.w, bloomW.h);
          gl.bindTexture(gl.TEXTURE_2D, bloomW.tex);
          gl.uniform1i(blurU.uSource, 0);
          gl.uniform2f(blurU.uDirection, 1 / bloomW.w, 0);
          gl.uniform1f(blurU.uSigma, 3.0 + p2 * 2.0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.bindFramebuffer(gl.FRAMEBUFFER, bloomW.fbo);
          gl.bindTexture(gl.TEXTURE_2D, bloomX.tex);
          gl.uniform2f(blurU.uDirection, 0, 1 / bloomW.h);
          gl.uniform1f(blurU.uSigma, 3.0 + p2 * 2.0);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        api.drawCalls += 5;

        /* ---- 合成到画布 ---- */
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.useProgram(compProg);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, bloomW.tex);
        gl.uniform1i(compU.uBloomWide, 2);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bloomA.tex);
        gl.uniform1i(compU.uBloom, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sceneTarget.tex);
        gl.uniform1i(compU.uScene, 0);
        gl.uniform1f(compU.uExposure, st.exposure);
        gl.uniform1f(compU.uBloomGain, st.bloomGain);
        gl.uniform1f(compU.uGrain, st.grain);
        gl.uniform1f(compU.uVignette, st.vignette);
        gl.uniform1f(compU.uAberration, st.aberration === undefined ? 0.0016 : st.aberration);
        gl.uniform1f(compU.uFrame, st.frameIndex);
        gl.uniform2f(compU.uSceneTexel, 1 / sw, 1 / sh);
        gl.uniform1f(compU.uSS, st.ss || 1);
        gl.uniform1i(compU.uDebug, st.debugView || 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        api.drawCalls++;
        gl.bindVertexArray(null);
      },

      uploadBodies: function (list) {
        for (var i = 0; i < MAXB; i++) {
          var b = list[i];
          if (!b) {
            bodyPos[i * 4] = 0;
            bodyPos[i * 4 + 1] = 0;
            bodyPos[i * 4 + 2] = 0;
            bodyPos[i * 4 + 3] = 0;
            continue;
          }
          bodyPos[i * 4] = b.pos[0];
          bodyPos[i * 4 + 1] = b.pos[1];
          bodyPos[i * 4 + 2] = b.pos[2];
          bodyPos[i * 4 + 3] = b.radius;
          bodyAxes[i * 4] = b.type;
          bodyAxes[i * 4 + 1] = b.tilt;
          bodyAxes[i * 4 + 2] = b.node;
          bodyAxes[i * 4 + 3] = b.spin;
          bodyColA[i * 4] = b.colorA[0];
          bodyColA[i * 4 + 1] = b.colorA[1];
          bodyColA[i * 4 + 2] = b.colorA[2];
          bodyColA[i * 4 + 3] = b.atmoStrength;
          bodyColB[i * 4] = b.colorB[0];
          bodyColB[i * 4 + 1] = b.colorB[1];
          bodyColB[i * 4 + 2] = b.colorB[2];
          bodyColB[i * 4 + 3] = b.atmoScale;
          bodyColC[i * 4] = b.colorC[0];
          bodyColC[i * 4 + 1] = b.colorC[1];
          bodyColC[i * 4 + 2] = b.colorC[2];
          bodyColC[i * 4 + 3] = b.ringSlot;
          bodyColD[i * 4] = b.atmoColor[0];
          bodyColD[i * 4 + 1] = b.atmoColor[1];
          bodyColD[i * 4 + 2] = b.atmoColor[2];
          bodyColD[i * 4 + 3] = 0;
          bodyPar[i * 4] = b.mie || 0;
          bodyPar[i * 4 + 1] = b.albedo === undefined ? 1 : b.albedo;
          bodyPar[i * 4 + 2] = 0;
          bodyPar[i * 4 + 3] = 0;
        }
      },

      uploadRings: function (rings) {
        var slots = [0, 0, 0, 0];
        ringGeom.fill(0);
        ringGeom2.fill(0);
        ringExtra.fill(0);
        ringColor.fill(0);
        for (var i = 0; i < rings.length && i < MAXR; i++) {
          var r = rings[i];
          ringGeom[i * 4] = r.inner;
          ringGeom[i * 4 + 1] = r.cOuter;
          ringGeom[i * 4 + 2] = r.bOuter;
          ringGeom[i * 4 + 3] = r.cassiniInner;
          ringGeom2[i * 4] = r.cassiniOuter;
          ringGeom2[i * 4 + 1] = r.aOuter;
          ringGeom2[i * 4 + 2] = r.fRing;
          ringGeom2[i * 4 + 3] = r.style;
          ringExtra[i * 4] = r.opacity;
          ringColor[i * 3] = r.color[0];
          ringColor[i * 3 + 1] = r.color[1];
          ringColor[i * 3 + 2] = r.color[2];
        }
        return slots;
      },

      uploadSky: function (list) {
        var n = Math.min(list.length, 8);
        skyDirs.fill(0);
        skyAxes.fill(0);
        skySizes.fill(0);
        skyPa.fill(0);
        skyBright.fill(0);
        skyKind.fill(0);
        for (var i = 0; i < n; i++) {
          var o = list[i];
          skyDirs[i * 3] = o.dir.x;
          skyDirs[i * 3 + 1] = o.dir.y;
          skyDirs[i * 3 + 2] = o.dir.z;
          skyAxes[i * 3] = o.axis.x;
          skyAxes[i * 3 + 1] = o.axis.y;
          skyAxes[i * 3 + 2] = o.axis.z;
          skySizes[i * 2] = o.size.x;
          skySizes[i * 2 + 1] = o.size.y;
          skyPa[i] = o.pa;
          skyBright[i] = o.bright;
          skyKind[i] = o.kind;
        }
        return n;
      },

      resize: function (w, h) {
        canvas.width = w;
        canvas.height = h;
      },
    };

    return api;
  }

  window.HELIOS_RENDERER = {
    create: create,
    blackbodyRGB: blackbodyRGB,
    bvToKelvin: bvToKelvin,
    decodeStars: decodeStars,
  };
})();
