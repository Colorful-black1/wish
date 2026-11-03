/* ============================================================================
 * scene.js — Three.js 舞台：渲染器、相机、轨道控制、辉光、星空、网格地面、标签投影
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  LLM.createScene = function (canvas) {
    var S = {
      ok: false,
      canvas: canvas,
      labels: [],
      pickables: [],
      tickers: [],
      elapsed: 0,
      mode: 'flow',
      home: null,
      bloom: null,
      composer: null,
      focusTween: null,
      labelTween: null
    };

    var params = new URLSearchParams(location.search);
    var lite = params.get('lite') === '1' || window.innerWidth < 520;
    S.lite = lite;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !lite,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      });
    } catch (err) {
      console.error('WebGL init failed', err);
      return S;
    }

    if (!renderer.getContext()) return S;

    var width = window.innerWidth;
    var height = window.innerHeight;
    S.ok = true;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.6));
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x03060d, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03060d, 0.0062);

    var camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 600);
    camera.position.set(14, 25, 56);
    if (width / height < 0.9) {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }

    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.65;
    controls.panSpeed = 0.55;
    controls.minDistance = 10;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minPolarAngle = Math.PI * 0.08;
    controls.target.set(0, 7, -2);
    controls.update();

    S.renderer = renderer;
    S.scene = scene;
    S.camera = camera;
    S.controls = controls;

    /* ------------------------------------------------------------ 背景 */

    var skyGeo = new THREE.SphereGeometry(260, 48, 32);
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x010208) },
        uMid: { value: new THREE.Color(0x030913) },
        uLow: { value: new THREE.Color(0x04030a) }
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vDir = normalize(wp.xyz - cameraPosition);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uLow;',
        'varying vec3 vDir;',
        'void main(){',
        '  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);',
        '  vec3 col = mix(uLow, uMid, smoothstep(0.0, 0.52, h));',
        '  col = mix(col, uTop, smoothstep(0.48, 1.0, h));',
        '  float glow = pow(max(dot(vDir, normalize(vec3(0.1, 0.12, 0.99))), 0.0), 6.0);',
        '  col += vec3(0.01, 0.032, 0.055) * glow;',
        '  float violet = pow(max(dot(vDir, normalize(vec3(-0.85, 0.1, 0.4))), 0.0), 12.0);',
        '  col += vec3(0.028, 0.01, 0.05) * violet;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var stars = new THREE.Group();
    scene.add(stars);
    S.stars = stars;

    function makeStars(count, minR, maxR, size, color, opacity) {
      var pos = new Float32Array(count * 3);
      var rnd = U.rng(count * 37 + minR);
      for (var i = 0; i < count; i++) {
        var theta = rnd() * Math.PI * 2;
        var phi = Math.acos(2 * rnd() - 1);
        var r = minR + rnd() * (maxR - minR);
        pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
        pos[i * 3 + 1] = Math.cos(phi) * r * 0.75 + 6;
        pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var mat = new THREE.PointsMaterial({
        color: color,
        size: size,
        map: U.glowTexture(),
        transparent: true,
        opacity: opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
      });
      var points = new THREE.Points(geo, mat);
      stars.add(points);
      return points;
    }

    var starFar = makeStars(900, 90, 210, 0.75, 0x9fd8ff, 0.62);
    var starMid = makeStars(380, 55, 120, 0.5, 0x7fa6ff, 0.5);
    var starNear = makeStars(120, 26, 60, 0.34, 0xc9a96a, 0.38);

    /* 两团星云光晕 */
    var nebulaA = U.sprite(0x2b6fff, 90, 0.055);
    nebulaA.position.set(-46, 26, -70);
    scene.add(nebulaA);
    var nebulaB = U.sprite(0x8a4dff, 70, 0.05);
    nebulaB.position.set(52, 14, -60);
    scene.add(nebulaB);

    /* ------------------------------------------------------------ 灯光 */

    scene.add(new THREE.AmbientLight(0x38536e, 0.62));
    var hemi = new THREE.HemisphereLight(0x7fd8ff, 0x070b12, 0.34);
    scene.add(hemi);

    var keyLight = new THREE.PointLight(0x6fe8ff, 1.55, 130, 2);
    keyLight.position.set(0, 24, 12);
    scene.add(keyLight);

    var violetLight = new THREE.PointLight(0xa57bff, 0.95, 110, 2);
    violetLight.position.set(-34, 10, -4);
    scene.add(violetLight);

    var warmLight = new THREE.PointLight(0xffc46b, 0.7, 110, 2);
    warmLight.position.set(34, 8, 4);
    scene.add(warmLight);
    S.lights = { key: keyLight, violet: violetLight, warm: warmLight };

    /* ------------------------------------------------------------ 地面网格 */

    var gridGeo = new THREE.PlaneGeometry(280, 280);
    var gridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x4fe3ff) },
        uTime: { value: 0 }
      },
      vertexShader: [
        'varying vec3 vW;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vW = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform float uTime;',
        'varying vec3 vW;',
        'float line(float x, float step_){',
        '  float f = abs(fract(x / step_ - 0.5) - 0.5) / fwidth(x / step_);',
        '  return 1.0 - min(f, 1.0);',
        '}',
        'void main(){',
        '  float g1 = line(vW.x, 5.0) + line(vW.z, 5.0);',
        '  float g2 = (line(vW.x, 1.0) + line(vW.z, 1.0)) * 0.16;',
        '  float d = length(vW.xz - vec2(0.0, 2.0));',
        '  float fade = smoothstep(78.0, 8.0, d);',
        '  float pulse = 0.72 + 0.28 * sin(d * 0.22 - uTime * 0.7);',
        '  float a = (g1 * 0.085 + g2 * 0.07) * fade * pulse;',
        '  gl_FragColor = vec4(uColor, a);',
        '}'
      ].join('\n')
    });
    var grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -2.4;
    scene.add(grid);
    S.grid = grid;

    /* ------------------------------------------------------------ 辉光 */

    var useBloom = !lite && params.get('nobloom') !== '1';
    if (useBloom) {
      try {
        S.composer = new THREE.EffectComposer(renderer);
        S.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        S.composer.setSize(width, height);
        var renderPass = new THREE.RenderPass(scene, camera);
        S.composer.addPass(renderPass);
        var bloom = new THREE.UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.5, 0.78);
        S.composer.addPass(bloom);
        S.bloom = bloom;
      } catch (err) {
        console.warn('bloom disabled', err);
        S.composer = null;
      }
    }

    /* ------------------------------------------------------------ 标签 */

    var tmpV = new THREE.Vector3();
    var tmpQ = new THREE.Vector3();

    S.registerLabel = function (el, object, opts) {
      opts = opts || {};
      S.labels.push({
        el: el,
        object: object,
        offset: new THREE.Vector3(opts.offset ? opts.offset[0] : 0, opts.offset ? opts.offset[1] : 2.2, opts.offset ? opts.offset[2] : 0),
        hideBelow: opts.hideBelow == null ? -Infinity : opts.hideBelow,
        stage: opts.stage
      });
      return el;
    };

    S.updateLabels = function () {
      var w = window.innerWidth;
      var h = window.innerHeight;
      var top = 72;
      var bottom = U.isNarrow() ? 190 : 118;
      for (var i = 0; i < S.labels.length; i++) {
        var L = S.labels[i];
        if (!L.object || !L.object.parent) {
          L.el.classList.add('is-hidden');
          continue;
        }
        L.object.getWorldPosition(tmpV);
        tmpV.add(L.offset);
        tmpV.project(camera);
        var visible = tmpV.z > -1 && tmpV.z < 1;
        var x = (tmpV.x * 0.5 + 0.5) * w;
        var y = (-tmpV.y * 0.5 + 0.5) * h;
        if (x < -120 || x > w + 120 || y < top || y > h - bottom + 30) visible = false;
        L.el.classList.toggle('is-hidden', !visible);
        if (visible) {
          // 标签大小随深度轻微缩放
          var scale = U.clamp(1.05 - (tmpV.z + 1) * 0.16, 0.72, 1.05);
          L.el.style.transform =
            'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + scale.toFixed(3) + ')';
        }
      }
    };

    /* ------------------------------------------------------------ 相机 */

    function homeForViewport() {
      var aspect = window.innerWidth / window.innerHeight;
      var narrow = aspect < 0.9;
      return {
        pos: narrow ? new THREE.Vector3(0, 14, 38) : new THREE.Vector3(44, 24, 46),
        target: narrow ? new THREE.Vector3(0, 8, 3) : new THREE.Vector3(10, 7, 2)
      };
    }
    S.home = homeForViewport();

    S.jumpHome = function () {
      S.home = homeForViewport();
      camera.position.copy(S.home.pos);
      controls.target.copy(S.home.target);
      controls.update();
    };
    S.jumpHome();

    S.cameraTween = function (pos, target, duration, onDone) {
      if (S.focusTween) {
        if (typeof S.focusTween.kill === 'function') S.focusTween.kill();
        else if (typeof S.focusTween === 'number') cancelAnimationFrame(S.focusTween);
        S.focusTween = null;
      }
      controls.enabled = false;
      S.focusing = true;
      var p0 = camera.position.clone();
      var t0 = controls.target.clone();
      var proxy = { t: 0 };
      var done = function () {
        controls.enabled = true;
        S.focusing = false;
        controls.target.copy(target);
        controls.update();
        if (typeof onDone === 'function') onDone();
      };
      if (window.gsap) {
        S.focusTween = gsap.to(proxy, {
          t: 1,
          duration: duration || 1.4,
          ease: 'power3.inOut',
          onUpdate: function () {
            var e = U.easeInOutCubic(proxy.t);
            camera.position.lerpVectors(p0, pos, e);
            controls.target.lerpVectors(t0, target, e);
            camera.lookAt(controls.target);
          },
          onComplete: done
        });
      } else {
        var start = performance.now();
        function step(now) {
          var t = U.clamp((now - start) / ((duration || 1.4) * 1000), 0, 1);
          var e = U.easeInOutCubic(t);
          camera.position.lerpVectors(p0, pos, e);
          controls.target.lerpVectors(t0, target, e);
          camera.lookAt(controls.target);
          if (t < 1) S.focusTween = requestAnimationFrame(step);
          else done();
        }
        S.focusTween = requestAnimationFrame(step);
      }
    };

    S.goHome = function (duration) {
      S.home = homeForViewport();
      S.cameraTween(S.home.pos.clone(), S.home.target.clone(), duration || 1.5);
    };

    S.lookAt = function (posArray, targetArray, duration) {
      var pos = new THREE.Vector3(posArray[0], posArray[1], posArray[2]);
      var target = new THREE.Vector3(targetArray[0], targetArray[1], targetArray[2]);
      S.cameraTween(pos, target, duration);
    };

    /* ------------------------------------------------------------ 拾取 */

    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();

    S.addPickable = function (obj, data) {
      obj.userData.pick = data;
      S.pickables.push(obj);
      return obj;
    };

    S.pick = function (clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(S.pickables, false);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        var visible = o.visible;
        var node = o.parent;
        while (visible && node) {
          if (node.visible === false) visible = false;
          node = node.parent;
        }
        if (visible && o.userData && o.userData.pick) return { object: o, data: o.userData.pick, point: hits[i].point };
      }
      return null;
    };

    /* ------------------------------------------------------------ 尺寸与循环 */

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, S.lite ? 1 : 1.6);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.9 ? 60 : 46;
      camera.updateProjectionMatrix();
      if (S.composer) {
        S.composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        S.composer.setSize(width, height);
        if (S.bloom) S.bloom.setSize(width, height);
      }
    }
    window.addEventListener('resize', resize);
    S.resize = resize;

    S.addTicker = function (fn) {
      S.tickers.push(fn);
      return fn;
    };

    var clock = new THREE.Clock();
    var fpsEl = document.getElementById('fps');
    var fpsFrames = 0;
    var fpsTime = 0;

    S.frameHooks = [];

    function loop() {
      requestAnimationFrame(loop);
      var dt = Math.min(clock.getDelta(), 0.06);
      S.elapsed += dt;

      if (!S.focusing) controls.update();

      for (var i = 0; i < S.tickers.length; i++) {
        try {
          S.tickers[i](dt, S.elapsed);
        } catch (err) {
          if (!S._tickErrorShown) {
            console.error(err);
            S._tickErrorShown = true;
          }
        }
      }

      stars.rotation.y += dt * 0.004;
      starNear.rotation.y -= dt * 0.006;
      gridMat.uniforms.uTime.value = S.elapsed;
      nebulaA.material.opacity = 0.05 + Math.sin(S.elapsed * 0.25) * 0.012;
      nebulaB.material.opacity = 0.045 + Math.cos(S.elapsed * 0.2) * 0.012;
      keyLight.intensity = 1.5 + Math.sin(S.elapsed * 1.2) * 0.1;

      S.updateLabels();

      if (S.composer) S.composer.render(dt);
      else renderer.render(scene, camera);

      fpsFrames++;
      fpsTime += dt;
      if (fpsTime > 0.8) {
        if (fpsEl) fpsEl.textContent = Math.round(fpsFrames / fpsTime) + ' FPS';
        fpsFrames = 0;
        fpsTime = 0;
      }
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      S.ok = false;
      S.flushError && S.flushError('WebGL 上下文丢失，请刷新页面重试。');
    });

    S.start = function () {
      S.ok = true;
      clock.start();
      loop();
    };

    S.dispose = function () {
      window.removeEventListener('resize', resize);
      U.disposeObject(scene);
      renderer.dispose();
    };

    S.projectToScreen = function (object, offsetY) {
      object.getWorldPosition(tmpQ);
      if (offsetY) tmpQ.y += offsetY;
      tmpQ.project(camera);
      return {
        x: (tmpQ.x * 0.5 + 0.5) * window.innerWidth,
        y: (-tmpQ.y * 0.5 + 0.5) * window.innerHeight,
        visible: tmpQ.z > -1 && tmpQ.z < 1
      };
    };

    return S;
  };
})();
