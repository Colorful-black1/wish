/* ============================================================================
 * core.js — 工具函数：画布纹理、颜色、缓动、对象释放、小型补间
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};

  var U = {};

  U.PALETTE = {
    cyan: '#4fe3ff',
    blue: '#5a8dff',
    violet: '#a57bff',
    mint: '#6dffc0',
    warm: '#ffc46b',
    pink: '#ff7bd5',
    ink: '#e7f4ff',
    muted: '#8ba3b7',
    faint: '#5b7285',
    bg: '#03060d'
  };

  U.COLOR = {
    cyan: 0x4fe3ff,
    blue: 0x5a8dff,
    violet: 0xa57bff,
    mint: 0x6dffc0,
    warm: 0xffc46b,
    pink: 0xff7bd5,
    glass: 0x7fd8ff,
    dim: 0x2a4a66,
    dark: 0x050d18
  };

  U.clamp = function (v, min, max) {
    return v < min ? min : v > max ? max : v;
  };

  U.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  U.smoothstep = function (t) {
    t = U.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  U.easeInOutCubic = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  U.easeOutCubic = function (t) {
    return 1 - Math.pow(1 - t, 3);
  };

  /* 稳定伪随机：同一 seed 永远得到同一序列 */
  U.rng = function (seed) {
    var a = seed >>> 0 || 1;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hashString = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.format = function (n, digits) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    var d = typeof digits === 'number' ? digits : 0;
    return n.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  U.prefersReducedMotion = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  U.isNarrow = function () {
    return window.innerWidth <= 860;
  };

  /* ------------------------------------------------------------ 画布纹理 */

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  U.roundRect = function (ctx, x, y, w, h, r) {
    var rr = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  var glowCache = null;

  U.glowTexture = function () {
    if (glowCache) return glowCache;
    var c = makeCanvas(128, 128);
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    glowCache = tex;
    return tex;
  };

  U.sprite = function (color, scale, opacity) {
    var mat = new THREE.SpriteMaterial({
      map: U.glowTexture(),
      color: color,
      transparent: true,
      opacity: opacity == null ? 0.8 : opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var s = new THREE.Sprite(mat);
    s.scale.set(scale, scale, 1);
    return s;
  };

  /**
   * 生成一块带文字的画布纹理。
   * opts: { w,h,text,sub,color,subColor,bg,border,font,subFont,pad,align,vignette }
   */
  U.textTexture = function (opts) {
    var w = opts.w || 512;
    var h = opts.h || 256;
    var c = makeCanvas(w, h);
    var ctx = c.getContext('2d');
    var color = opts.color || '#dff7ff';
    var subColor = opts.subColor || 'rgba(120,210,240,0.72)';
    var scale = opts.scale || 1;

    ctx.clearRect(0, 0, w, h);

    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      U.roundRect(ctx, 2, 2, w - 4, h - 4, opts.radius || 22 * scale);
      ctx.fill();
    }
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = Math.max(1, 2 * scale);
      U.roundRect(ctx, 3, 3, w - 6, h - 6, opts.radius || 22 * scale);
      ctx.stroke();
    }

    if (opts.vignette) {
      var vg = ctx.createLinearGradient(0, 0, 0, h);
      vg.addColorStop(0, 'rgba(255,255,255,0.06)');
      vg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    var align = opts.align || 'center';
    ctx.textAlign = align;
    var x = align === 'left' ? (opts.pad || 26) * scale : align === 'right' ? w - (opts.pad || 26) * scale : w / 2;

    var text = String(opts.text == null ? '' : opts.text);
    var fontBase = opts.font || '600 56px "PingFang SC","Microsoft YaHei",sans-serif';
    var maxW = w - (opts.pad || 30) * 2 * scale;
    var sizeMatch = fontBase.match(/(\d+)px/);
    var size = sizeMatch ? parseInt(sizeMatch[1], 10) : 56;
    var weightMatch = fontBase.match(/^\s*(\d{3}|bold|normal)\s+/);
    var weight = weightMatch ? weightMatch[1] : '500';
    var fontFamily = fontBase.replace(/^\s*(?:\d{3}|bold|normal)?\s*\d+px\s*/, '') || 'sans-serif';
    while (size > 12) {
      ctx.font = weight + ' ' + size + 'px ' + fontFamily;
      if (ctx.measureText(text).width <= maxW) break;
      size -= 2;
    }

    var sub = opts.sub ? String(opts.sub) : '';
    var subSize = opts.subSize || Math.max(11, Math.round(size * 0.34));
    var totalH = size + (sub ? subSize + 10 * scale : 0);
    var baseline = (h - totalH) / 2 + size * 0.82;

    ctx.font = weight + ' ' + size + 'px ' + fontFamily;
    ctx.fillStyle = color;
    ctx.shadowColor = opts.glow || 'rgba(79,227,255,0.55)';
    ctx.shadowBlur = opts.glowBlur == null ? 16 * scale : opts.glowBlur;
    ctx.fillText(text, x, baseline);
    ctx.shadowBlur = 0;

    if (sub) {
      ctx.font = (opts.subWeight || '500') + ' ' + subSize + 'px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = subColor;
      if ('letterSpacing' in ctx) {
        try {
          ctx.letterSpacing = Math.round(subSize * 0.18) + 'px';
        } catch (e) {
          /* 某些浏览器只读 */
        }
      }
      ctx.fillText(sub, x, baseline + subSize + 10 * scale);
      if ('letterSpacing' in ctx) {
        try {
          ctx.letterSpacing = '0px';
        } catch (e2) {
          /* ignore */
        }
      }
    }

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  };

  /** Token 小方块贴图：文字 + 模拟 ID */
  U.tokenTexture = function (token, id, accent) {
    var c = makeCanvas(320, 160);
    var ctx = c.getContext('2d');
    var color = accent || '#4fe3ff';

    ctx.clearRect(0, 0, 320, 160);
    var grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, 'rgba(14,34,52,0.96)');
    grad.addColorStop(1, 'rgba(5,14,24,0.96)');
    ctx.fillStyle = grad;
    U.roundRect(ctx, 4, 4, 312, 152, 20);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(18, 20, 3, 120);
    ctx.globalAlpha = 1;

    var text = String(token);
    var size = 62;
    var family = '"PingFang SC","Microsoft YaHei",sans-serif';
    do {
      ctx.font = '600 ' + size + 'px ' + family;
      size -= 3;
    } while (ctx.measureText(text).width > 220 && size > 20);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#eafcff';
    ctx.shadowColor = 'rgba(79,227,255,0.45)';
    ctx.shadowBlur = 14;
    ctx.fillText(text, 160, 98);
    ctx.shadowBlur = 0;

    ctx.font = '500 22px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = 'rgba(120,210,240,0.75)';
    ctx.textAlign = 'left';
    ctx.fillText('ID ' + id, 24, 140);
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.fillText('TOKEN', 296, 140);

    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  };

  U.textPlane = function (w, h, texture, opacity) {
    var mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: opacity == null ? 1 : opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    return mesh;
  };

  /* ------------------------------------------------------------ 缓动 */

  U.tween = function (obj, to, duration, options) {
    if (window.gsap) {
      return gsap.to(obj, Object.assign({ duration: duration, ease: 'power2.inOut', overwrite: 'auto' }, options || {}, to));
    }
    // 无 GSAP 时的极简补间
    var from = {};
    Object.keys(to).forEach(function (k) {
      from[k] = obj[k];
    });
    var start = performance.now();
    var raf;
    function step(now) {
      var t = U.clamp((now - start) / (duration * 1000), 0, 1);
      var e = U.easeInOutCubic(t);
      Object.keys(to).forEach(function (k) {
        obj[k] = from[k] + (to[k] - from[k]) * e;
      });
      if (t < 1) raf = requestAnimationFrame(step);
      else if (options && typeof options.onComplete === 'function') options.onComplete();
    }
    raf = requestAnimationFrame(step);
    return { kill: function () { cancelAnimationFrame(raf); } };
  };

  /* ------------------------------------------------------------ 清理 */

  U.disposeObject = function (root) {
    if (!root) return;
    root.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      var mats = obj.material;
      if (!mats) return;
      if (!Array.isArray(mats)) mats = [mats];
      mats.forEach(function (m) {
        if (!m) return;
        ['map', 'alphaMap', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'].forEach(function (k) {
          if (m[k] && m[k].dispose) m[k].dispose();
        });
        if (m.uniforms) {
          Object.keys(m.uniforms).forEach(function (k) {
            var v = m.uniforms[k] && m.uniforms[k].value;
            if (v && v.dispose) v.dispose();
          });
        }
        m.dispose();
      });
    });
  };

  U.lineBetween = function (a, b, color, opacity, dashed) {
    var geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    var mat = dashed
      ? new THREE.LineDashedMaterial({
          color: color,
          transparent: true,
          opacity: opacity,
          dashSize: 0.4,
          gapSize: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      : new THREE.LineBasicMaterial({
          color: color,
          transparent: true,
          opacity: opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
    var line = new THREE.Line(geom, mat);
    if (dashed) line.computeLineDistances();
    return line;
  };

  U.edgeBox = function (w, h, d, color, opacity) {
    var geom = new THREE.BoxGeometry(w, h, d);
    var edges = new THREE.EdgesGeometry(geom);
    geom.dispose();
    var line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity == null ? 0.5 : opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    return line;
  };

  LLM.util = U;
})();
