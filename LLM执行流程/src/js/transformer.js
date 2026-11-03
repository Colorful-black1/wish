/* ============================================================================
 * transformer.js — 场景中心的 Transformer Block 拆解塔
 * 8 层结构：输入嵌入 → 归一化 → 多头注意力 → 残差 → 归一化 → FFN → 残差 → 输出
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  LLM.LAYERS = [
    { key: 'embed', cn: '输入嵌入', en: 'Input Embeddings', color: 0x4fe3ff, concept: 'embedding' },
    { key: 'norm1', cn: '归一化', en: 'LayerNorm', color: 0x5a8dff, concept: 'layernorm' },
    { key: 'attn', cn: '多头注意力', en: 'Multi-Head Attention', color: 0x4fe3ff, concept: 'multi-head' },
    { key: 'res1', cn: '残差连接', en: 'Residual Add', color: 0x6dffc0, concept: 'residual' },
    { key: 'norm2', cn: '归一化', en: 'LayerNorm', color: 0x5a8dff, concept: 'layernorm' },
    { key: 'ffn', cn: '前馈网络', en: 'Feed Forward', color: 0xa57bff, concept: 'ffn' },
    { key: 'res2', cn: '残差连接', en: 'Residual Add', color: 0x6dffc0, concept: 'residual' },
    { key: 'out', cn: '块输出', en: 'Block Output', color: 0xffc46b, concept: 'transformer-block' }
  ];

  LLM.createTransformer = function (S) {
    var layout = LLM.LAYOUT.tower;
    var group = new THREE.Group();
    group.position.set(layout.x, layout.y, layout.z);
    S.scene.add(group);

    var T = {
      group: group,
      layers: [],
      exploded: false,
      activeIndex: -1,
      focusStage: 0,
      pickables: [],
      labels: []
    };

    /* 基座 */
    var baseMat = new THREE.MeshStandardMaterial({
      color: 0x050f19,
      emissive: 0x04141f,
      emissiveIntensity: 0.12,
      metalness: 0.25,
      roughness: 0.5,
      transparent: true,
      opacity: 0.45
    });
    var base = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 0.42, 8), baseMat);
    base.position.y = 0;
    group.add(base);

    var baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.35, 0.035, 6, 96),
      new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.23;
    group.add(baseRing);

    for (var r = 0; r < 3; r++) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(5.4 + r * 1.15, 0.018, 4, 120),
        new THREE.MeshBasicMaterial({
          color: r === 1 ? 0xa57bff : 0x4fe3ff,
          transparent: true,
          opacity: 0.16 - r * 0.035,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      ring.userData.spin = 0.06 + r * 0.03;
      ring.userData.dir = r % 2 ? -1 : 1;
      group.add(ring);
    }

    /* 中心光柱 */
    var beamGeom = new THREE.CylinderGeometry(0.05, 0.05, 13, 8, 1, true);
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0x7fe8ff,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    var beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.y = 6.8;
    group.add(beam);

    var beamGlow = U.sprite(0x4fe3ff, 2.8, 0.09);
    beamGlow.position.y = 5.4;
    group.add(beamGlow);

    /* 背后的大型光环，给中心塔一个实验室式的纵深 */
    var haloGroup = new THREE.Group();
    haloGroup.position.set(0, 10, -6);
    group.add(haloGroup);
    for (var hh = 0; hh < 2; hh++) {
      var haloRing = new THREE.Mesh(
        new THREE.TorusGeometry(8.4 + hh * 2.6, 0.015, 4, 160),
        new THREE.MeshBasicMaterial({
          color: hh ? 0xa57bff : 0x4fe3ff,
          transparent: true,
          opacity: hh ? 0.1 : 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      haloGroup.add(haloRing);
      if (hh === 0) haloRing.userData.spin = 0.03;
    }
    var haloGlow = U.sprite(0x6a9dff, 22, 0.045);
    haloGlow.position.set(0, 10, -8);
    group.add(haloGlow);

    /* 顶部标题标签 */
    var titleAnchor = new THREE.Object3D();
    titleAnchor.position.set(0, 13.6, 0);
    group.add(titleAnchor);

    /* 8 层结构 */
    var plateW = 6.6;
    var plateD = 4.5;
    var compactGap = 0.92;
    var explodeGap = 1.62;
    var y0 = 1.1;

    LLM.LAYERS.forEach(function (cfg, i) {
      var y = y0 + i * compactGap;
      var plate = new THREE.Group();
      plate.position.set(0, y, 0);
      plate.userData.homeY = y;
      plate.userData.index = i;
      group.add(plate);

      var glass = new THREE.Mesh(
        new THREE.BoxGeometry(plateW, 0.34, plateD),
        new THREE.MeshStandardMaterial({
          color: 0x0a1b2b,
          emissive: cfg.color,
          emissiveIntensity: 0.08,
          metalness: 0.35,
          roughness: 0.32,
          transparent: true,
          opacity: 0.52
        })
      );
      glass.userData.pick = { type: 'layer', index: i, concept: cfg.concept };
      S.addPickable(glass, glass.userData.pick);
      T.pickables.push(glass);
      plate.add(glass);

      var edge = U.edgeBox(plateW, 0.34, plateD, cfg.color, 0.55);
      plate.add(edge);

      var inner = new THREE.Mesh(
        new THREE.BoxGeometry(plateW * 0.78, 0.36, plateD * 0.72),
        new THREE.MeshBasicMaterial({
          color: cfg.color,
          transparent: true,
          opacity: 0.035,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      plate.add(inner);

      var sideGlow = U.sprite(cfg.color, 1.2, 0.14);
      sideGlow.position.set(plateW * 0.52, 0, 0);
      plate.add(sideGlow);

      var core = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.36, 0.8),
        new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      core.position.set(-plateW * 0.22, 0, 0);
      plate.add(core);

      var plateData = {
        group: plate,
        glass: glass,
        edge: edge,
        inner: inner,
        sideGlow: sideGlow,
        core: core,
        cfg: cfg,
        index: i,
        x: 0
      };
      T.layers.push(plateData);
    });

    /* 虚拟数据粒子：沿中心光柱向上 */
    var particles = [];
    var particleCount = 34;
    var particleGeom = new THREE.BufferGeometry();
    var particlePos = new Float32Array(particleCount * 3);
    for (var p = 0; p < particleCount; p++) {
      particlePos[p * 3] = (Math.random() - 0.5) * 5.4;
      particlePos[p * 3 + 1] = Math.random() * 12;
      particlePos[p * 3 + 2] = (Math.random() - 0.5) * 3.4;
      particles.push({ y: Math.random() * 12, speed: 0.6 + Math.random() * 1.4 });
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    var particleMat = new THREE.PointsMaterial({
      color: 0x9ff5ff,
      size: 0.12,
      map: U.glowTexture(),
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var particleSystem = new THREE.Points(particleGeom, particleMat);
    group.add(particleSystem);

    /* 光柱上的扫描环 */
    var scanRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.7, 0.025, 5, 80),
      new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scanRing.rotation.x = Math.PI / 2;
    group.add(scanRing);

    /* 每层的 HTML 标签 */
    T.buildLabels = function (makeLabel) {
      T.layers.forEach(function (layer) {
        var el = makeLabel(layer.cfg, layer.index);
        el.style.display = 'none';
        var anchor = new THREE.Object3D();
        anchor.position.set(plateW / 2 + 0.4, layer.group.position.y, 0);
        group.add(anchor);
        S.registerLabel(el, anchor, { offset: [0, 0, 0], stage: 5 });
        T.labels.push({ el: el, anchor: anchor, layer: layer });
      });
    };

    T.setLabelsVisible = function (visible) {
      T.labels.forEach(function (L) {
        L.el.style.display = visible ? '' : 'none';
        L.anchor.position.y = L.layer.group.position.y;
      });
    };

    T.setExploded = function (exploded, instant) {
      T.exploded = !!exploded;
      T.layers.forEach(function (layer, i) {
        var targetY = y0 + i * (exploded ? explodeGap : compactGap);
        if (instant) {
          layer.group.position.y = targetY;
        } else if (window.gsap) {
          gsap.to(layer.group.position, {
            y: targetY,
            duration: 0.9,
            ease: 'power3.inOut',
            delay: i * 0.025
          });
        } else {
          layer.group.position.y = targetY;
        }
        layer.group.userData.homeY = targetY;
      });
      T.setLabelsVisible(exploded);
    };

    T.setFocusStage = function (stageNo) {
      T.focusStage = stageNo;
    };

    T.setActiveLayer = function (index) {
      T.activeIndex = index;
      T.layers.forEach(function (layer, i) {
        var on = i === index;
        layer.glass.material.emissiveIntensity = on ? 0.62 : 0.08;
        layer.edge.material.opacity = on ? 0.95 : 0.48;
        layer.inner.material.opacity = on ? 0.2 : 0.035;
        layer.sideGlow.material.opacity = on ? 0.55 : 0.14;
      });
    };

    T.update = function (dt, elapsed) {
      // 旋转光环
      group.children.forEach(function (child) {
        if (child.userData && child.userData.spin) {
          child.rotation.z += dt * child.userData.spin * child.userData.dir;
        }
      });
      haloGroup.children.forEach(function (child, i) {
        if (child.userData && child.userData.spin) child.rotation.z += dt * child.userData.spin;
        child.rotation.z += dt * (i ? -0.008 : 0.012);
      });

      // 粒子上升
      var pos = particleSystem.geometry.attributes.position;
      for (var i = 0; i < particles.length; i++) {
        particles[i].y += dt * particles[i].speed;
        if (particles[i].y > 12.4) particles[i].y = 0.2;
        pos.setY(i, particles[i].y + 0.4);
      }
      pos.needsUpdate = true;

      // 扫描环
      var scan = (elapsed * 0.55) % 1;
      scanRing.position.y = 0.8 + scan * 10.8;
      scanRing.material.opacity = 0.15 + 0.5 * (1 - scan);

      // 激活层自动轮播
      if (T.focusStage === 5) {
        var idx = Math.floor((elapsed * 1.15) % 8);
        if (idx !== T.activeIndex) T.setActiveLayer(idx);
        beamMat.opacity = 0.16 + Math.sin(elapsed * 2.2) * 0.05;
      } else if (T.focusStage === 8) {
        T.layers.forEach(function (layer, i) {
          var wave = (elapsed * 1.5 - i * 0.32) % 2;
          var glow = wave > 0 && wave < 0.7 ? 0.55 : 0.1;
          layer.glass.material.emissiveIntensity = 0.08 + glow * 0.35;
        });
      } else if (T.activeIndex < 0) {
        T.layers.forEach(function (layer) {
          layer.glass.material.emissiveIntensity = 0.06 + Math.sin(elapsed * 0.9 + layer.index) * 0.025;
        });
      }

      // 展开时让 HTML 标签跟随层高度
      if (T.exploded) {
        T.labels.forEach(function (L) {
          L.anchor.position.y = L.layer.group.position.y;
        });
      }

      beamGlow.material.opacity = 0.07 + Math.sin(elapsed * 1.6) * 0.025;
      baseRing.rotation.z += dt * 0.12;
    };

    T.anchor = titleAnchor;

    T.group = group;

    return T;
  };
})();
