/* ============================================================================
 * infra.js — 推理基础设施岛：GPU、显存、量化、批处理与并行
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  LLM.createInfra = function (S, onPick) {
    var origin = new THREE.Vector3(LLM.LAYOUT.infra.x, LLM.LAYOUT.infra.y, LLM.LAYOUT.infra.z);
    var group = new THREE.Group();
    group.position.copy(origin);
    S.scene.add(group);

    var I = {
      group: group,
      nodes: [],
      active: null,
      center: new THREE.Vector3(origin.x, origin.y + 2.6, origin.z)
    };

    /* 岛基座 */
    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 21.5, 0.5, 64),
      new THREE.MeshStandardMaterial({
        color: 0x041019,
        emissive: 0x061724,
        emissiveIntensity: 0.35,
        metalness: 0.55,
        roughness: 0.45,
        transparent: true,
        opacity: 0.92
      })
    );
    base.position.y = -1.4;
    group.add(base);

    var baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(19.6, 0.04, 4, 140),
      new THREE.MeshBasicMaterial({ color: 0xa57bff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -1.12;
    group.add(baseRing);

    var baseRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(16.4, 0.02, 4, 120),
      new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    baseRing2.rotation.x = Math.PI / 2;
    baseRing2.position.y = -1.1;
    group.add(baseRing2);

    var islandLight = new THREE.PointLight(0x5fdcff, 1.0, 48, 2);
    islandLight.position.set(0, 9, 6);
    group.add(islandLight);
    var islandLight2 = new THREE.PointLight(0xa57bff, 0.7, 44, 2);
    islandLight2.position.set(-12, 5, -8);
    group.add(islandLight2);

    var gridTex = (function () {
      var c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      var ctx = c.getContext('2d');
      ctx.fillStyle = 'rgba(4,14,22,0.9)';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = 'rgba(79,227,255,0.22)';
      ctx.lineWidth = 1;
      for (var i = 0; i <= 512; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(165,123,255,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(64, 64, 384, 384);
      ctx.fillStyle = 'rgba(140,220,255,0.8)';
      ctx.font = '500 48px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GPU  ·  TENSOR CORE', 256, 280);
      ctx.font = '400 22px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(120,200,230,0.55)';
      ctx.fillText('SM CLUSTER · HBM · NVLink', 256, 322);
      var tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      return tex;
    })();

    var chip = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.5, 8.4),
      new THREE.MeshBasicMaterial({
        color: 0xbfeaff,
        map: gridTex,
        transparent: true,
        opacity: 0.98
      })
    );
    chip.position.y = 0.2;
    group.add(chip);

    var chipEdge = U.edgeBox(8.4, 0.5, 8.4, 0x4fe3ff, 0.6);
    chipEdge.position.y = 0.2;
    group.add(chipEdge);

    var chipGlow = U.sprite(0x4fe3ff, 3.4, 0.03);
    chipGlow.position.y = 0.5;
    chipGlow.visible = false;
    group.add(chipGlow);

    // 光柱和扫描环
    var core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 7, 6),
      new THREE.MeshBasicMaterial({ color: 0x9ff5ff, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    core.position.y = 3.6;
    group.add(core);

    var scan = new THREE.Mesh(
      new THREE.TorusGeometry(4.6, 0.03, 4, 80),
      new THREE.MeshBasicMaterial({ color: 0x9ff5ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scan.rotation.x = Math.PI / 2;
    group.add(scan);

    var fanGroup = new THREE.Group();
    fanGroup.position.set(0, 0.55, 0);
    group.add(fanGroup);
    for (var f = 0; f < 3; f++) {
      var fan = new THREE.Mesh(
        new THREE.TorusGeometry(1.1 + f * 0.55, 0.02, 4, 60),
        new THREE.MeshBasicMaterial({ color: 0x5a8dff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      fan.rotation.x = Math.PI / 2;
      fanGroup.add(fan);
    }

    /* 节点 */
    var colors = [0x4fe3ff, 0x5a8dff, 0xa57bff, 0x6dffc0, 0xffc46b, 0xff7bd5, 0x7fc4ff, 0xff9d6b, 0x5f9dff, 0x7effc4];
    var radiusX = 12.4;
    var radiusZ = 8.6;

    LLM.INFRA.forEach(function (node, i) {
      var angle = -Math.PI / 2 + (i / LLM.INFRA.length) * Math.PI * 2;
      var x = Math.cos(angle) * radiusX;
      var z = Math.sin(angle) * radiusZ;
      var color = colors[i];

      var g = new THREE.Group();
      g.position.set(x, 0, z);
      group.add(g);

      var pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.55, 0.16, 6),
        new THREE.MeshStandardMaterial({ color: 0x06131f, emissive: 0x0a2636, emissiveIntensity: 0.4, metalness: 0.6, roughness: 0.4 })
      );
      g.add(pad);

      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.28, 0.018, 4, 56),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.1;
      g.add(ring);

      var icon = new THREE.Group();
      icon.position.y = 1.5;
      icon.scale.setScalar(1.2);
      g.add(icon);

      var geo;
      if (node.kind === 'chip') {
        geo = new THREE.BoxGeometry(1.1, 0.12, 1.1);
        var body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x06131f, emissive: color, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.3 }));
        icon.add(body);
        icon.add(U.edgeBox(1.1, 0.12, 1.1, color, 0.8));
      } else if (node.kind === 'memory') {
        for (var m = 0; m < 4; m++) {
          var stick = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.7), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.55 }));
          stick.position.x = (m - 1.5) * 0.24;
          icon.add(stick);
        }
        icon.add(U.edgeBox(1.15, 1.1, 0.8, color, 0.5));
      } else if (node.kind === 'weights') {
        for (var w = 0; w < 4; w++) {
          var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55 - w * 0.08, 0.55 - w * 0.08, 0.12, 20), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.3 + w * 0.1 }));
          disc.position.y = (w - 1.5) * 0.24;
          icon.add(disc);
        }
      } else if (node.kind === 'quant') {
        for (var q = 0; q < 5; q++) {
          var bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3 + q * 0.16, 0.16), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7 - q * 0.08 }));
          bar.position.x = (q - 2) * 0.26;
          bar.position.y = (0.3 + q * 0.16) / 2 - 0.5;
          icon.add(bar);
        }
      } else if (node.kind === 'batch' || node.kind === 'cluster') {
        for (var b = 0; b < 3; b++) {
          var cube = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.55 }));
          cube.position.set((b - 1) * 0.46, b % 2 ? 0.2 : -0.1, 0);
          icon.add(cube);
        }
      } else if (node.kind === 'stream' || node.kind === 'pipe') {
        for (var s = 0; s < 3; s++) {
          var seg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5 }));
          seg.position.y = (s - 1) * 0.32;
          seg.position.x = (s - 1) * 0.16;
          icon.add(seg);
        }
        icon.add(U.edgeBox(1.25, 1.2, 0.5, color, 0.4));
      } else if (node.kind === 'mesh') {
        var sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 0), new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.7 }));
        icon.add(sphere);
      } else {
        var ico = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0x06131f, emissive: color, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.2 }));
        icon.add(ico);
      }

      var glow = U.sprite(color, 1.5, 0.1);
      glow.position.y = 1.4;
      g.add(glow);

      // 名称标签：使用 HTML 投影标签，保证远距离可读
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'lbl3d lbl3d--wide is-infra';
      el.style.display = 'none';
      el.innerHTML =
        '<span class="lbl3d__no">' +
        String(i + 1).padStart(2, '0') +
        '</span><span class="lbl3d__tx"><b>' +
        node.label +
        '</b><i>INFRA · ' +
        node.kind.toUpperCase() +
        '</i></span>';
      el.addEventListener('click', function () {
        if (onPick) onPick(node.id);
        else if (LLM.app) LLM.app.focusInfra(node.id);
      });
      var host = document.getElementById('labels');
      if (host) host.appendChild(el);
      S.registerLabel(el, g, { offset: [0, 3.3, 0], stage: 0 });
      I.labelEls = I.labelEls || [];
      I.labelEls.push(el);

      var hit = new THREE.Mesh(
        new THREE.SphereGeometry(1.7, 10, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.position.y = 1.2;
      hit.userData.pick = { type: 'infra', id: node.id };
      S.addPickable(hit, hit.userData.pick);
      g.add(hit);

      // 与中心芯片的连接
      var line = U.lineBetween(new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(x, 0.6, z), color, 0.1, true);
      group.add(line);

      I.nodes.push({
        id: node.id,
        group: g,
        icon: icon,
        glow: glow,
        ring: ring,
        pad: pad,
        labelEl: el,
        color: color,
        phase: i / LLM.INFRA.length
      });
    });

    var labelTex2 = U.textTexture({
      w: 1024,
      h: 192,
      text: 'INFRASTRUCTURE LAYER',
      sub: 'GPU · VRAM · BATCHING · PARALLELISM',
      color: '#d9cbff',
      subColor: 'rgba(180,150,255,0.65)',
      font: '500 48px "JetBrains Mono", monospace',
      subSize: 20
    });
    var title = U.textPlane(9.8, 1.84, labelTex2, 0.85);
    title.position.set(0, 7.4, -4);
    title.visible = false;
    group.add(title);
    I.title = title;

    I.setActive = function (id) {
      I.active = id;
      I.nodes.forEach(function (n) {
        var on = n.id === id;
        n.ring.material.opacity = on ? 1 : 0.32;
        n.glow.material.opacity = on ? 0.35 : 0.1;
        n.icon.scale.setScalar(on ? 1.45 : 1.2);
        if (n.labelEl) n.labelEl.classList.toggle('is-active', on);
      });
    };

    I.setLabelsVisible = function (visible) {
      (I.labelEls || []).forEach(function (el) {
        el.style.display = visible ? '' : 'none';
      });
    };

    I.focusView = function () {
      return {
        pos: new THREE.Vector3(origin.x + 6, origin.y + 26, origin.z + 28),
        target: new THREE.Vector3(origin.x + 6, origin.y + 0.2, origin.z)
      };
    };

    I.update = function (dt, elapsed) {
      fanGroup.rotation.y += dt * 0.9;
      scan.position.y = 0.8 + ((elapsed * 0.25) % 1) * 6.4;
      scan.material.opacity = 0.15 + 0.5 * (1 - ((elapsed * 0.25) % 1));
      baseRing.rotation.z += dt * 0.02;
      baseRing2.rotation.z -= dt * 0.03;

      I.nodes.forEach(function (n, i) {
        n.icon.position.y = 1.45 + Math.sin(elapsed * 0.9 + i) * 0.12;
        n.icon.rotation.y += dt * (0.2 + i * 0.02);
        n.ring.rotation.z += dt * 0.4;
        var on = n.id === I.active;
        n.glow.material.opacity = (on ? 0.35 : 0.1) + Math.sin(elapsed * 1.4 + i) * 0.03;
      });
      title.position.y = 7.4 + Math.sin(elapsed * 0.6) * 0.08;    };

    return I;
  };
})();
