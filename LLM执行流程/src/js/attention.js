/* ============================================================================
 * attention.js — 3D 自注意力网络：token 节点、因果权重连线、Q/K/V 分流
 * 权重由 mechanics.js 在本地真实计算，用于展示因果自注意力的结构。
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  LLM.createAttention = function (S, origin, tokens, onSelect) {
    var group = new THREE.Group();
    group.position.copy(origin);
    S.scene.add(group);

    var A = {
      group: group,
      tokens: [],
      weights: [],
      nodes: [],
      lines: [],
      active: 0,
      visible: true,
      onSelect: onSelect || function () {},
      qkv: null,
      labels: []
    };

    var nodeGroup = new THREE.Group();
    var lineGroup = new THREE.Group();
    var fxGroup = new THREE.Group();
    group.add(lineGroup, nodeGroup, fxGroup);

    var frame = new THREE.Mesh(
      new THREE.TorusGeometry(5.35, 0.018, 4, 120),
      new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    frame.rotation.x = Math.PI / 2;
    frame.position.y = -1.1;
    group.add(frame);

    // 不再铺满整块圆盘，避免遮挡站台与地板网格
    var plate = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 5.2, 64),
      new THREE.MeshBasicMaterial({
        color: 0x08202f,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.position.y = -1.09;
    group.add(plate);

    var labelGroup = new THREE.Group();
    group.add(labelGroup);

    /* Q/K/V 三路分流 */
    var qkv = new THREE.Group();
    qkv.position.set(0, 3.7, -0.3);
    group.add(qkv);
    var qkvDefs = [
      { text: 'Q', cn: '查询', color: 0x4fe3ff, x: -3.2 },
      { text: 'K', cn: '键', color: 0xa57bff, x: 0 },
      { text: 'V', cn: '值', color: 0xff7bd5, x: 3.2 }
    ];
    A.qkvCubes = [];
    qkvDefs.forEach(function (def) {
      var edges = U.edgeBox(1.05, 1.05, 1.05, def.color, 0.9);
      edges.position.x = def.x;
      qkv.add(edges);
      A.qkvCubes.push(edges);

      var glow = U.sprite(def.color, 1.4, 0.14);
      glow.position.x = def.x;
      qkv.add(glow);

      var tex = U.textTexture({
        w: 256,
        h: 192,
        text: def.text,
        sub: def.cn,
        color: '#eafcff',
        subColor: 'rgba(180,230,255,.7)',
        font: '600 100px "JetBrains Mono", monospace',
        subSize: 20,
        glow: 'rgba(180,240,255,.3)',
        glowBlur: 8
      });
      var label = U.textPlane(1.12, 0.84, tex, 0.95);
      label.position.set(def.x, 0.05, 0.62);
      qkv.add(label);
    });

    /* 从当前 token 到 Q/K/V 的光束 */
    A.qkvBeams = qkvDefs.map(function (def) {
      var line = U.lineBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(def.x, 0, 0.4), def.color, 0.22, true);
      group.add(line);
      return line;
    });

    function clearGroup(g) {
      while (g.children.length) {
        var child = g.children.pop();
        U.disposeObject(child);
      }
    }

    function tokenLabelTexture(token, index) {
      return U.textTexture({
        w: 256,
        h: 128,
        text: token.text,
        sub: 'T' + String(index + 1).padStart(2, '0'),
        color: '#eafcff',
        subColor: token.color || '#4fe3ff',
        font: '600 46px "PingFang SC","Microsoft YaHei",sans-serif',
        subSize: 18,
        bg: 'rgba(5,14,24,0.88)',
        border: token.color || 'rgba(79,227,255,0.55)',
        radius: 16,
        glow: 'rgba(79,227,255,0.35)',
        glowBlur: 8
      });
    }

    A.build = function (newTokens) {
      clearGroup(nodeGroup);
      clearGroup(lineGroup);
      clearGroup(fxGroup);
      if (labelGroup.clear) labelGroup.clear();

      // 旧节点的拾取体已随重建移除，避免射线打到已销毁对象
      S.pickables = S.pickables.filter(function (o) {
        return !(o.userData && o.userData.pick && o.userData.pick.type === 'attn');
      });

      A.nodes = [];
      A.lines = [];
      A.tokens = newTokens.slice(0, 8);
      if (!A.tokens.length) {
        A.tokens = [{ text: '·', id: 0, color: '#4fe3ff' }];
      }

      var att = LLM.Mech.attention(A.tokens, { dim: 16, limit: 8 });
      A.attention = att;
      A.weights = att.weights;

      var n = A.tokens.length;
      var spacing = Math.min(1.62, 10.2 / n);
      var nodeObjs = [];

      A.tokens.forEach(function (token, i) {
        var x = (i - (n - 1) / 2) * spacing;
        var z = Math.abs(i - (n - 1) / 2) * 0.28;
        var y = Math.sin(i * 0.9) * 0.14;

        var node = new THREE.Group();
        node.position.set(x, y, z);
        node.userData.baseY = y;
        nodeGroup.add(node);

        var sphere = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.3, 1),
          new THREE.MeshStandardMaterial({
            color: 0x0a1b2b,
            emissive: new THREE.Color(token.color || LLM.util.PALETTE.cyan),
            emissiveIntensity: 0.45,
            metalness: 0.4,
            roughness: 0.3,
            transparent: true,
            opacity: 0.9
          })
        );
        sphere.userData.pick = { type: 'attn', index: i };
        S.addPickable(sphere, sphere.userData.pick);
        node.add(sphere);

        var halo = U.sprite(0x4fe3ff, 1.1, 0.18);
        node.add(halo);

        var ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.5, 0.012, 4, 40),
          new THREE.MeshBasicMaterial({ color: 0x6fe8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        ring.rotation.x = Math.PI / 2;
        node.add(ring);

        var tex = tokenLabelTexture(token, i);
        var plate = U.textPlane(1.36, 0.68, tex, 0.95);
        plate.position.set(0, 0.94, 0);
        node.add(plate);

        A.nodes.push({ group: node, sphere: sphere, halo: halo, ring: ring, texture: tex, index: i, token: token });
        nodeObjs.push(node);
      });

      // 因果权重连线：j <= i
      for (var i = 1; i < n; i++) {
        for (var j = 0; j <= i; j++) {
          var w = A.weights[i][j];
          if (!(w > 0.004)) continue;
          var a = nodeObjs[j].position.clone();
          var b = nodeObjs[i].position.clone();
          a.y += 0.08;
          b.y += 0.08;
          var mid = a.clone().add(b).multiplyScalar(0.5);
          mid.y += 1.2 + Math.abs(i - j) * 0.18;
          var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          var pts = curve.getPoints(20);
          var geom = new THREE.BufferGeometry().setFromPoints(pts);
          var color = new THREE.Color(0x2f77a8).lerp(new THREE.Color(0xff7bd5), Math.pow(w, 0.8));
          var mat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.04 + w * 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });
          var line = new THREE.Line(geom, mat);
          line.userData.baseOpacity = 0.04 + w * 0.34;
          line.userData.layoutOpacity = line.userData.baseOpacity;
          line.userData.from = j;
          line.userData.to = i;
          line.userData.weight = w;
          lineGroup.add(line);
          A.lines.push(line);
        }
      }

      // 高权重路径上的流动光点
      var topPairs = att.pairs.slice(0, 10);
      A.pulses = topPairs.map(function (pair, idx) {
        var dot = U.sprite(new THREE.Color(0x4fe3ff).lerp(new THREE.Color(0xff7bd5), pair.weight), 0.32, 0.85);
        fxGroup.add(dot);
        return {
          sprite: dot,
          from: nodeObjs[pair.to] ? nodeObjs[pair.to].position : null,
          to: nodeObjs[pair.from] ? nodeObjs[pair.from].position : null,
          weight: pair.weight,
          phase: idx / topPairs.length
        };
      });

      // 高权重路径再叠一层发光管，解决 WebGL 线宽只有 1px 的问题
      A.tubes = [];
      att.pairs.slice(0, 8).forEach(function (pair) {
        if (pair.weight < 0.08) return;
        var a = nodeObjs[pair.to].position.clone();
        var b = nodeObjs[pair.from].position.clone();
        a.y += 0.1;
        b.y += 0.1;
        var mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y += 1.15;
        var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        var color = new THREE.Color(0x4fe3ff).lerp(new THREE.Color(0xff7bd5), Math.min(1, pair.weight * 1.6));
        var tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 26, 0.008 + pair.weight * 0.022, 4, false),
          new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.16 + pair.weight * 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        );
        tube.userData.baseOpacity = 0.16 + pair.weight * 0.4;
        tube.userData.from = pair.to;
        tube.userData.to = pair.from;
        lineGroup.add(tube);
        A.tubes.push(tube);
      });

      A.setActive(Math.min(A.active, n - 1));
    };

    A.setActive = function (index) {
      A.active = index;
      A.nodes.forEach(function (node, i) {
        var on = i === index;
        node.sphere.material.emissiveIntensity = on ? 1.15 : 0.4;
        node.halo.material.opacity = on ? 0.6 : 0.12;
        node.ring.material.opacity = on ? 0.65 : 0.16;
        node.ring.scale.setScalar(on ? 1.25 : 1);
        node.group.scale.setScalar(on ? 1.06 : 1);
      });
      A.lines.forEach(function (line) {
        var engages = line.userData.from === index || line.userData.to === index;
        var base = line.userData.baseOpacity;
        line.userData.layoutOpacity = engages ? Math.min(1, base * 1.9 + 0.12) : base * 0.22;
        line.material.opacity = line.userData.layoutOpacity;
      });
      if (A.qkvBeams) {
        A.qkvBeams.forEach(function (beam, i) {
          beam.material.opacity = 0.28 + i * 0.06;
        });
      }
      if (A.tubes) {
        A.tubes.forEach(function (tube) {
          var engages = tube.userData.from === index || tube.userData.to === index;
          tube.material.opacity = tube.userData.baseOpacity * (engages ? 1.35 : 0.5);
        });
      }
      var node = A.nodes[index];
      if (node && A.qkvCubes) {
        A.qkvCubes.forEach(function (edge) {
          edge.material.opacity = 1;
        });
      }
    };

    A.setVisible = function (visible) {
      A.visible = visible;
      group.visible = visible;
    };

    A.update = function (dt, elapsed) {
      if (!A.visible) return;
      A.nodes.forEach(function (node, i) {
        node.group.position.y = node.group.userData.baseY + Math.sin(elapsed * 0.9 + i * 0.7) * 0.06;
        node.halo.material.rotation += dt * 0.2;
      });

      if (A.lines.length) {
        A.lines.forEach(function (line) {
          var pulse = 0.86 + 0.14 * Math.sin(elapsed * 2.2 + line.userData.to);
          line.material.opacity = line.userData.layoutOpacity * pulse;
        });
      }

      if (A.pulses) {
        A.pulses.forEach(function (p, i) {
          if (!p.from || !p.to) return;
          var t = (elapsed * 0.42 + p.phase) % 1;
          var from = p.from;
          var to = p.to;
          var mid = from.clone().add(to).multiplyScalar(0.5);
          mid.y += 1.1;
          var curve = new THREE.QuadraticBezierCurve3(from, mid, to);
          var pos = curve.getPoint(t);
          p.sprite.position.copy(pos);
          p.sprite.material.opacity = 0.3 + 0.7 * Math.sin(t * Math.PI);
        });
      }

      if (A.qkvCubes) {
        A.qkvCubes.forEach(function (cube, i) {
          cube.rotation.x = elapsed * (0.3 + i * 0.08);
          cube.rotation.y = elapsed * (0.42 - i * 0.05);
          cube.position.y = Math.sin(elapsed * 1.1 + i) * 0.12;
        });
      }
      if (A.qkvBeams) {
        var activeNode = A.nodes[A.active];
        if (activeNode) {
          var world = new THREE.Vector3();
          activeNode.group.getWorldPosition(world);
          group.worldToLocal(world);
          A.qkvBeams.forEach(function (beam, i) {
            var target = new THREE.Vector3((i - 1) * 3.2, 3.7, 0.5);
            var positions = beam.geometry.attributes.position;
            positions.setXYZ(0, world.x, world.y + 0.1, world.z);
            positions.setXYZ(1, target.x, target.y - 0.5, target.z);
            positions.needsUpdate = true;
          });
        }
      }
    };

    A.build(tokens);

    return A;
  };
})();
