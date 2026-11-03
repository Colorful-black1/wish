/* ============================================================================
 * pipeline.js — 13 站 3D 推理流水线：站台、发光数据河、阶段专属装置
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  LLM.createPipeline = function (S) {
    var P = {
      stations: [],
      group: new THREE.Group(),
      active: 1,
      progress: 0,
      tokenGroup: null,
      tokens: [],
      question: '',
      answer: ''
    };
    S.scene.add(P.group);

    var L = LLM.LAYOUT;
    var towerPos = new THREE.Vector3(L.tower.x, L.tower.y, L.tower.z);
    var accent = [0x4fe3ff, 0x56b4ff, 0x7f8dff, 0x9a7bff, 0x4fe6d4, 0x45e0ff, 0x7fc4ff, 0x5f9dff, 0xffc46b, 0xff9d6b, 0xff7bd5, 0x7effc4, 0xc9a96a];

    /* ------------------------------------------------------------ 公共元素 */

    function mkMat(color, opacity, additive) {
      return new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: opacity,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: !additive
      });
    }

    function glowSprite(parent, color, scale, opacity, x, y, z) {
      var s = U.sprite(color, scale, opacity);
      s.position.set(x || 0, y || 0, z || 0);
      parent.add(s);
      return s;
    }

    function makeStationBase(stage, color) {
      var g = new THREE.Group();

      var plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(2.35, 2.65, 0.2, 6),
        new THREE.MeshStandardMaterial({
          color: 0x050f1a,
          emissive: 0x061b28,
          emissiveIntensity: 0.22,
          metalness: 0.6,
          roughness: 0.45,
          transparent: true,
          opacity: 0.92
        })
      );
      plinth.position.y = 0;
        g.add(plinth);

      var rim = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.022, 4, 96), mkMat(color, 0.42, true));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.115;
      g.add(rim);

      var halo = new THREE.Mesh(new THREE.CircleGeometry(2.95, 48), mkMat(color, 0.022, true));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = -0.02;
      g.add(halo);

      var arc = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.016, 4, 80, Math.PI * 1.15), mkMat(color, 0.3, true));
      arc.rotation.x = Math.PI / 2;
      arc.position.y = 0.16;
      arc.userData.spin = 0.18;
      g.add(arc);

      // 细光柱替代锥形体积光，避免过曝与遮挡
      var beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.08, 7.2, 6, 1, true),
        new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      beam.position.y = 3.6;
      beam.position.z = -0.9;
      g.add(beam);
      g.userData.beam = beam;

      var topGlow = U.sprite(color, 2.2, 0.1);
      topGlow.position.set(0, 1.2, -0.9);
      g.add(topGlow);

      var beaconRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.012, 4, 48), mkMat(color, 0.28, true));
      beaconRing.rotation.x = Math.PI / 2;
      beaconRing.position.y = 1.1;
      beaconRing.userData.spin = 0.5;
      g.add(beaconRing);
      var gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), mkMat(color, 0.8, true));
      gem.position.y = 1.1;
      g.add(gem);
      g.userData.gem = gem;

      // 地面编号铭牌
      var plateTex = U.textTexture({
        w: 256,
        h: 128,
        text: String(stage.no).padStart(2, '0'),
        sub: stage.en.toUpperCase(),
        color: '#dff9ff',
        subColor: 'rgba(120,210,240,0.8)',
        font: '600 58px "JetBrains Mono", monospace',
        subSize: 13,
        bg: 'rgba(5,13,22,0.7)',
        border: 'rgba(126,202,255,0.22)',
        radius: 12
      });
      var plate = U.textPlane(1.5, 0.75, plateTex, 0.9);
      plate.rotation.x = -Math.PI / 2;
      plate.position.set(0, 0.13, 2.95);
      g.add(plate);

      // 可点击体积
      var hit = new THREE.Mesh(
        new THREE.SphereGeometry(2.55, 12, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.position.y = 1.15;
      hit.userData.pick = { type: 'stage', no: stage.no };
      S.addPickable(hit, hit.userData.pick);
      g.add(hit);

      return g;
    }

    /* ------------------------------------------------------------ 终端画布 */

    function createTerminal(opts) {
      var w = 768;
      var h = 432;
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      var texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = 4;
      var mesh = U.textPlane(opts.w || 4.9, opts.h || 2.75, texture, 0.96);
      var state = { text: '', typed: 0, mode: opts.mode || 'user', dirty: true, status: 'READY' };

      function wrap(text, maxWidth) {
        var lines = [];
        var cur = '';
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (ch === '\n') {
            lines.push(cur);
            cur = '';
            continue;
          }
          var test = cur + ch;
          if (ctx.measureText(test).width > maxWidth && cur) {
            lines.push(cur);
            cur = ch;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);
        return lines;
      }

      function draw() {
        ctx.clearRect(0, 0, w, h);

        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(8,22,36,1)');
        g.addColorStop(1, 'rgba(3,9,16,1)');
        ctx.fillStyle = g;
        U.roundRect(ctx, 2, 2, w - 4, h - 4, 18);
        ctx.fill();
        ctx.strokeStyle = state.mode === 'ai' ? 'rgba(109,255,192,0.4)' : 'rgba(79,227,255,0.42)';
        ctx.lineWidth = 2;
        U.roundRect(ctx, 2, 2, w - 4, h - 4, 18);
        ctx.stroke();

        // 标题栏
        ctx.fillStyle = 'rgba(79,227,255,0.07)';
        ctx.fillRect(2, 2, w - 4, 44);
        ctx.fillStyle = state.mode === 'ai' ? '#6dffc0' : '#4fe3ff';
        ctx.beginPath();
        ctx.arc(28, 24, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(215,244,255,0.78)';
        ctx.font = '500 20px "JetBrains Mono", Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(state.mode === 'ai' ? 'ASSISTANT · STREAM' : 'USER · MESSAGE', 46, 32);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(120,180,205,0.55)';
        ctx.font = '400 17px "JetBrains Mono", monospace';
        ctx.fillText(state.status, w - 24, 32);

        // 消息气泡
        ctx.fillStyle = 'rgba(79,227,255,0.055)';
        U.roundRect(ctx, 28, 66, w - 56, 236, 14);
        ctx.fill();
        ctx.strokeStyle = 'rgba(79,227,255,0.16)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 正文
        var visible = state.text.slice(0, state.typed);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#eefcff';
        ctx.font = '500 34px "PingFang SC","Microsoft YaHei",sans-serif';
        var lines = wrap(visible, w - 96);
        lines.slice(0, 5).forEach(function (line, i) {
          ctx.fillText(line, 46, 118 + i * 45);
        });

        // 光标
        if (state.typed < state.text.length) {
          var last = lines[lines.length - 1] || '';
          var cw = ctx.measureText(last).width;
          if (lines.length <= 5) {
            ctx.fillStyle = state.mode === 'ai' ? '#6dffc0' : '#4fe3ff';
            ctx.fillRect(48 + cw, 96 + (lines.length - 1) * 45, 12, 29);
          }
        }

        // 底部提示
        ctx.fillStyle = 'rgba(120,180,205,0.45)';
        ctx.font = '400 16px "JetBrains Mono", monospace';
        ctx.fillText(state.mode === 'ai' ? 'TOKENS STREAMING · SSE' : 'TOKENS PENDING · CONTEXT ATTACHED', 40, h - 26);

        // 边框装饰
        ctx.strokeStyle = 'rgba(79,227,255,0.25)';
        ctx.beginPath();
        ctx.moveTo(18, h - 54);
        ctx.lineTo(18, h - 18);
        ctx.lineTo(54, h - 18);
        ctx.stroke();
        texture.needsUpdate = true;
      }

      state.set = function (text) {
        if (state.text === text) return;
        state.text = text;
        state.typed = Math.min(state.typed, text.length);
        state.dirty = true;
      };
      state.setStatus = function (status) {
        if (state.status === status) return;
        state.status = status;
        state.dirty = true;
      };
      state.setProgress = function (p) {
        var typed = Math.round(U.clamp(p, 0, 1) * state.text.length);
        if (typed !== state.typed) {
          state.typed = typed;
          state.dirty = true;
        }
      };
      state.update = function () {
        if (state.dirty) {
          state.dirty = false;
          draw();
        }
      };
      state.mesh = mesh;
      state.texture = texture;

      draw();
      return state;
    }

    /* ------------------------------------------------------------ 数据河 */

    var points = [];
    LLM.PIPELINE.forEach(function (stage, i) {
      var t = i / (LLM.PIPELINE.length - 1);
      var x = L.startX + (L.endX - L.startX) * t;
      var z = L.baseZ + L.bow * Math.sin(Math.PI * t);
      var y = L.baseY + Math.sin(Math.PI * t) * 0.7;
      points.push(new THREE.Vector3(x, y, z));
    });

    var pathCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
    var pathSamples = 320;
    P.pathCurve = pathCurve;

    var tube = new THREE.Mesh(
      new THREE.TubeGeometry(pathCurve, pathSamples, 0.05, 6, false),
      mkMat(0x4fe3ff, 0.55, true)
    );
    P.group.add(tube);

    var tubeGlow = new THREE.Mesh(
      new THREE.TubeGeometry(pathCurve, 160, 0.28, 6, false),
      mkMat(0x2b7fb0, 0.075, true)
    );
    P.group.add(tubeGlow);

    // 地面投影：把数据河投到机房地板上，并立起每站的定位光柱
    var floorPoints = points.map(function (p) {
      return new THREE.Vector3(p.x, -2.24, p.z);
    });
    var floorCurve = new THREE.CatmullRomCurve3(floorPoints, false, 'catmullrom', 0.25);
    var floorTube = new THREE.Mesh(
      new THREE.TubeGeometry(floorCurve, 180, 0.018, 4, false),
      mkMat(0x3e8fb8, 0.18, true)
    );
    P.group.add(floorTube);
    P.floorCurve = floorCurve;

    points.forEach(function (pt, i) {
      var base = new THREE.Vector3(pt.x, -2.2, pt.z);
      var top = new THREE.Vector3(pt.x, pt.y - 0.15, pt.z);
      var pillar = U.lineBetween(base, top, accent[i % accent.length], 0.08, true);
      P.group.add(pillar);
      var pad = new THREE.Mesh(
        new THREE.RingGeometry(0.25, 0.42, 24),
        mkMat(accent[i % accent.length], 0.16, true)
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(pt.x, -2.2, pt.z);
      P.group.add(pad);
      P.stationGround = P.stationGround || [];
      P.stationGround.push([pillar, pad]);
    });

    // 沿曲线流动的粒子
    var FLOW = 90;
    var flowGeom = new THREE.BufferGeometry();
    var flowPos = new Float32Array(FLOW * 3);
    var flowCol = new Float32Array(FLOW * 3);
    var flowData = [];
    for (var f = 0; f < FLOW; f++) {
      flowData.push({
        offset: f / FLOW + (Math.random() - 0.5) * 0.008,
        speed: 0.008 + Math.random() * 0.014,
        size: Math.random()
      });
      var c = new THREE.Color(0x4fe3ff);
      flowCol[f * 3] = c.r;
      flowCol[f * 3 + 1] = c.g;
      flowCol[f * 3 + 2] = c.b;
    }
    flowGeom.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
    flowGeom.setAttribute('color', new THREE.BufferAttribute(flowCol, 3));
    var flowMat = new THREE.PointsMaterial({
      size: 0.19,
      map: U.glowTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    var flowPoints = new THREE.Points(flowGeom, flowMat);
    P.group.add(flowPoints);
    P.flowPoints = flowPoints;
    P.flowData = flowData;

    // 较大的数据包，让流向在远景中也能被看见
    var packetMeshes = [];
    for (var pk = 0; pk < 7; pk++) {
      var packetMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshBasicMaterial({
          color: pk % 3 === 0 ? 0x9ff5ff : pk % 3 === 1 ? 0x8d9dff : 0xffc46b,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      P.group.add(packetMesh);
      packetMeshes.push({ mesh: packetMesh, offset: pk / 7, speed: 0.022 + (pk % 3) * 0.006 });
    }
    P.packetMeshes = packetMeshes;

    /* ------------------------------------------------------------ 13 个站台 */

    LLM.PIPELINE.forEach(function (stage, i) {
      var group = new THREE.Group();
      group.position.copy(points[i]);
      group.userData.stageNo = stage.no;

      var color = accent[i];
      var base = makeStationBase(stage, color);
      group.add(base);

      var st = {
        stage: stage,
        no: stage.no,
        group: group,
        base: base,
        color: color,
        position: group.position.clone(),
        props: {},
        anchor: new THREE.Object3D()
      };
      var anchorHeights = [5.9, 5.2, 4.9, 5.0, 4.9, 4.8, 5.0, 6.9, 5.3, 5.6, 7.0, 4.9, 7.2];
      st.anchor.position.set(0, anchorHeights[i] || 4.8, 0);
      group.add(st.anchor);
      P.group.add(group);
      P.stations.push(st);
    });

    /* ------------------------------------------------------------ 1 用户输入 */

    var st1 = P.stations[0];
    var terminalUser = createTerminal({ w: 5.2, h: 2.95, mode: 'user' });
    terminalUser.mesh.position.set(0, 3.3, 0.5);
    terminalUser.mesh.rotation.x = -0.03;
    terminalUser.mesh.material.depthWrite = true;
    terminalUser.mesh.material.opacity = 1;
    terminalUser.mesh.renderOrder = 2;
    st1.group.add(terminalUser.mesh);
    st1.props.terminal = terminalUser;

    // 上下文三件套：System / History / User，让「输入不是一句话」可见
    var contextChips = [];
    [
      { label: 'SYSTEM PROMPT', sub: '角色与规则', color: 0xa57bff, y: 5.0 },
      { label: 'HISTORY × 3', sub: '多轮消息', color: 0x5a8dff, y: 4.1 },
      { label: 'USER MESSAGE', sub: '当前输入', color: 0x4fe3ff, y: 3.2 }
    ].forEach(function (cfg, i) {
      var hex = '#' + cfg.color.toString(16).padStart(6, '0');
      var tex = U.textTexture({
        w: 640,
        h: 160,
        text: cfg.label,
        sub: cfg.sub,
        color: '#eafcff',
        subColor: 'rgba(180,225,245,.78)',
        font: '500 40px "JetBrains Mono", monospace',
        subSize: 21,
        bg: 'rgba(6,16,28,0.92)',
        border: hex,
        radius: 16,
        glow: 'rgba(120,220,255,.3)',
        glowBlur: 6
      });
      var chip = U.textPlane(3.15, 0.79, tex, 0.98);
      chip.position.set(-4.55, cfg.y, 0.35);
      st1.group.add(chip);
      contextChips.push(chip);

      var line = U.lineBetween(
        new THREE.Vector3(-3.0, cfg.y, 0.35),
        new THREE.Vector3(-2.62, 3.55, 0.45),
        cfg.color,
        0.3,
        true
      );
      st1.group.add(line);
    });
    st1.props.contextChips = contextChips;

    var contextRings = new THREE.Group();
    for (var cr = 0; cr < 3; cr++) {
      var ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.1 + cr * 0.32, 0.012, 4, 64),
        mkMat(cr === 0 ? 0x4fe3ff : cr === 1 ? 0x5a8dff : 0xa57bff, 0.34 - cr * 0.07, true)
      );
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = cr * 0.4;
      ring.position.set(0, 1.1 + cr * 0.22, 0.3);
      ring.userData.spin = 0.25 - cr * 0.06;
      contextRings.add(ring);
    }
    st1.group.add(contextRings);
    st1.props.rings = contextRings;

    var packet = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), mkMat(0x8ff6ff, 0.9, true));
    packet.rotation.x = Math.PI / 2;
    packet.position.set(2.4, 2.5, 0.4);
    st1.group.add(packet);
    st1.props.packet = packet;

    /* ------------------------------------------------------------ 2 分词 */

    var st2 = P.stations[1];
    P.tokenGroup = new THREE.Group();
    P.tokenGroup.position.set(0, 2.6, 0.2);
    st2.group.add(P.tokenGroup);
    st2.props.tokenGroup = P.tokenGroup;

    var splitBarTex = U.textTexture({
      w: 1024,
      h: 160,
      text: LLM.DEMO.question,
      sub: 'RAW TEXT · TOKENIZE',
      color: '#eafcff',
      subColor: 'rgba(150,220,245,0.7)',
      font: '500 44px "PingFang SC","Microsoft YaHei",sans-serif',
      subSize: 17,
      bg: 'rgba(5,15,26,0.82)',
      border: 'rgba(79,227,255,0.35)',
      radius: 16,
      glow: 'rgba(79,227,255,0.25)',
      glowBlur: 8
    });
    var splitBar = U.textPlane(5.6, 0.88, splitBarTex, 0.95);
    splitBar.position.set(0, 4.75, 0);
    st2.group.add(splitBar);
    st2.props.splitBar = splitBar;
    st2.props.splitBarTex = splitBarTex;

    P.updateRibbon = function (text) {
      var tex = U.textTexture({
        w: 1024,
        h: 160,
        text: text,
        sub: 'RAW TEXT · TOKENIZE',
        color: '#eafcff',
        subColor: 'rgba(150,220,245,0.7)',
        font: '500 44px "PingFang SC","Microsoft YaHei",sans-serif',
        subSize: 17,
        bg: 'rgba(5,15,26,0.82)',
        border: 'rgba(79,227,255,0.35)',
        radius: 16,
        glow: 'rgba(79,227,255,0.25)',
        glowBlur: 8
      });
      if (splitBar.material.map) splitBar.material.map.dispose();
      splitBar.material.map = tex;
      splitBar.material.needsUpdate = true;
      st2.props.splitBarTex = tex;
    };

    /* ------------------------------------------------------------ 3 嵌入 */

    var st3 = P.stations[2];
    var embGroup = new THREE.Group();
    embGroup.position.set(0, 3.1, 0);
    embGroup.rotation.x = -0.12;
    embGroup.rotation.y = 0.18;
    st3.group.add(embGroup);
    var embCubes = [];
    var E_COLS = 7;
    var E_ROWS = 5;
    for (var ec = 0; ec < E_COLS; ec++) {
      for (var er = 0; er < E_ROWS; er++) {
        var col = new THREE.Color(0x4fe3ff).lerp(new THREE.Color(0xa57bff), ec / (E_COLS - 1));
        var cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.4, 0.4),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 })
        );
        cube.position.set((ec - (E_COLS - 1) / 2) * 0.62, (er - (E_ROWS - 1) / 2) * 0.62, 0);
        cube.userData.col = ec;
        cube.userData.row = er;
        embGroup.add(cube);
        embCubes.push(cube);
      }
    }
    var embFrame = U.edgeBox(4.72, 3.42, 0.7, 0x5a8dff, 0.28);
    embGroup.add(embFrame);
    var embScan = new THREE.Mesh(new THREE.BoxGeometry(0.56, 3.5, 0.56), mkMat(0x8ff6ff, 0.1, true));
    embGroup.add(embScan);
    st3.props.embCubes = embCubes;
    st3.props.embScan = embScan;
    st3.props.embGroup = embGroup;

    /* ------------------------------------------------------------ 4 位置 */

    var st4 = P.stations[3];
    var waveGroup = new THREE.Group();
    waveGroup.position.set(0, 3.2, 0);
    st4.group.add(waveGroup);
    var waves = [];
    var wConfigs = [
      { color: 0x4fe3ff, y: 0.9, phase: 0, amp: 0.28 },
      { color: 0x5a8dff, y: 0.2, phase: 1.4, amp: 0.24 },
      { color: 0xa57bff, y: -0.5, phase: 2.6, amp: 0.22 }
    ];
    wConfigs.forEach(function (cfg) {
      var pts = [];
      for (var wi = 0; wi <= 60; wi++) {
        var wx = -2.4 + (4.8 * wi) / 60;
        pts.push(new THREE.Vector3(wx, cfg.y + Math.sin(wx * 2.2 + cfg.phase) * cfg.amp, 0));
      }
      var geom = new THREE.BufferGeometry().setFromPoints(pts);
      var line = new THREE.Line(
        geom,
        new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      line.userData = { cfg: cfg, base: pts.map(function (p) { return p.clone(); }) };
      waveGroup.add(line);
      waves.push(line);
    });
    var posBars = new THREE.Group();
    for (var pb = 0; pb < 4; pb++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.42), mkMat(0x4fe3ff, 0.16, true));
      bar.position.set(-1.8 + pb * 1.2, 2.5, 0);
      bar.userData.baseY = 2.5;
      posBars.add(bar);
      var numTex = U.textTexture({
        w: 128,
        h: 128,
        text: String(pb),
        color: '#9ff5ff',
        font: '500 56px "JetBrains Mono", monospace',
        sub: 'POS',
        subSize: 15
      });
      var num = U.textPlane(0.5, 0.5, numTex, 0.8);
      num.position.set(-1.8 + pb * 1.2, 3.45, 0);
      posBars.add(num);
    }
    st4.group.add(posBars);
    st4.props.waves = waves;
    st4.props.posBars = posBars;

    /* ------------------------------------------------------------ 5 Transformer 连接 */

    var st5 = P.stations[4];
    var link5 = new THREE.Group();
    var linkStart = new THREE.Vector3(0, 2, 0);
    var linkEnd = towerPos.clone().sub(st5.group.position);
    linkEnd.y = 0.5 - st5.group.position.y + 1.4;
    var linkCurve = new THREE.QuadraticBezierCurve3(
      linkStart,
      new THREE.Vector3(linkEnd.x * 0.45, 5.5, linkEnd.z * 0.45),
      linkEnd
    );
    var linkTube = new THREE.Mesh(new THREE.TubeGeometry(linkCurve, 60, 0.035, 5, false), mkMat(0x4fe6d4, 0.4, true));
    link5.add(linkTube);
    var linkPulse = U.sprite(0x8ffff0, 1.1, 0.8);
    link5.add(linkPulse);
    st5.group.add(link5);
    st5.props.link = link5;
    st5.props.linkCurve = linkCurve;
    st5.props.linkPulse = linkPulse;

    var coreIcon = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshStandardMaterial({
        color: 0x07202a,
        emissive: 0x4fe6d4,
        emissiveIntensity: 1.1,
        metalness: 0.4,
        roughness: 0.2,
        transparent: true,
        opacity: 0.9
      })
    );
    coreIcon.position.set(2.7, 2.2, 0);
    st5.group.add(coreIcon);
    st5.props.core = coreIcon;

    /* ------------------------------------------------------------ 6 attention 锚点 */

    var st6 = P.stations[5];
    var attnAnchor = new THREE.Object3D();
    attnAnchor.position.set(0, 6.2, 0);
    st6.group.add(attnAnchor);
    st6.props.attnAnchor = attnAnchor;

    var attnBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 5.4, 4),
      mkMat(0x45e0ff, 0.18, true)
    );
    attnBeam.position.y = 2.7;
    st6.group.add(attnBeam);
    st6.props.attnBeam = attnBeam;

    /* ------------------------------------------------------------ 7 多头 */

    var st7 = P.stations[6];
    var heads = new THREE.Group();
    heads.position.set(0, 3.1, 0);
    st7.group.add(heads);
    var headWedges = [];
    for (var hw = 0; hw < 4; hw++) {
      var wedge = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 2.05, 24, 1, (hw * Math.PI * 2) / 4 + 0.07, Math.PI / 2 - 0.14),
        new THREE.MeshBasicMaterial({
          color: accent[hw % accent.length],
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      wedge.position.set(0, (hw % 2) * 0.12 - 0.06, (hw % 2) * 0.16);
      wedge.userData.index = hw;
      wedge.userData.baseY = wedge.position.y;
      heads.add(wedge);
      headWedges.push(wedge);
    }
    var headHub = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.22, 1),
      new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending })
    );
    headHub.position.set(0, 0, 0.35);
    heads.add(headHub);
    var headOut = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0xffc46b, emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.3 })
    );
    headOut.position.y = 3.2;
    st7.group.add(headOut);
    st7.props.wedges = headWedges;
    st7.props.headHub = headHub;
    st7.props.headOut = headOut;
    st7.props.headGroup = heads;

    /* ------------------------------------------------------------ 8 堆叠 */

    var st8 = P.stations[7];
    var stackGroup = new THREE.Group();
    stackGroup.position.set(0, 2.2, 0);
    st8.group.add(stackGroup);
    var stackLayers = [];
    for (var sl = 0; sl < 8; sl++) {
      var layer = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 0.18, 1.9),
        new THREE.MeshStandardMaterial({
          color: 0x0a1b2b,
          emissive: new THREE.Color(0x4fe3ff).lerp(new THREE.Color(0xa57bff), sl / 7),
          emissiveIntensity: 0.55,
          metalness: 0.5,
          roughness: 0.3,
          transparent: true,
          opacity: 0.8
        })
      );
      layer.position.y = sl * 0.62;
      layer.position.x = (sl % 2 ? 1 : -1) * 0.12;
      stackGroup.add(layer);
      stackLayers.push(layer);
      var edge = U.edgeBox(2.7, 0.18, 1.9, 0x4fe3ff, 0.22);
      edge.position.copy(layer.position);
      stackGroup.add(edge);
    }
    var stackPulse = U.sprite(0xbff8ff, 1.2, 0.8);
    stackPulse.position.set(0, 0.2, 0);
    stackGroup.add(stackPulse);
    var stackAxis = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.6, 4), mkMat(0x4fe3ff, 0.22, true));
    stackAxis.position.y = 2.3;
    stackGroup.add(stackAxis);
    st8.props.stackGroup = stackGroup;
    st8.props.stackLayers = stackLayers;
    st8.props.stackPulse = stackPulse;

    /* ------------------------------------------------------------ 9 Logits */

    var st9 = P.stations[8];
    var logitGroup = new THREE.Group();
    logitGroup.position.set(0, 3.1, 0);
    st9.group.add(logitGroup);
    var logitBars = [];
    var barColors = [0x4fe3ff, 0x5f9dff, 0x7f8dff, 0x9a7bff, 0xff7bd5, 0xff9d6b, 0xffc46b, 0x6dffc0, 0x4fe3ff, 0x5a8dff];
    LLM.DEMO.vocab.forEach(function (item, i) {
      var bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 1, 0.34),
        new THREE.MeshBasicMaterial({ color: barColors[i % barColors.length], transparent: true, opacity: 0.9 })
      );
      bar.geometry.translate(0, 0.5, 0);
      bar.position.set((i - (LLM.DEMO.vocab.length - 1) / 2) * 0.52, 0, 0);
      bar.scale.y = 0.05;
      bar.userData.target = 0;
      logitGroup.add(bar);
      logitBars.push(bar);
    });
    var logitBase = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.06, 0.9), mkMat(0x4fe3ff, 0.22, true));
    logitGroup.add(logitBase);
    var funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 1.7, 1.3, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc46b,
        transparent: true,
        opacity: 0.2,
        wireframe: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    funnel.position.y = 2.2;
    logitGroup.add(funnel);
    var hiddenCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 1),
      new THREE.MeshBasicMaterial({ color: 0x8ff6ff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending })
    );
    hiddenCore.position.y = 2.95;
    logitGroup.add(hiddenCore);
    st9.props.logitBars = logitBars;
    st9.props.funnel = funnel;
    st9.props.hiddenCore = hiddenCore;

    /* ------------------------------------------------------------ 10 采样 */

    var st10 = P.stations[9];
    var roulette = new THREE.Group();
    roulette.position.set(0, 2.8, 0);
    st10.group.add(roulette);
    var rouletteSegs = [];
    var SEG = 10;
    for (var sg = 0; sg < SEG; sg++) {
      var seg = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 2.1, 18, 1, (sg * Math.PI * 2) / SEG + 0.02, (Math.PI * 2) / SEG - 0.04),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0x4fe3ff).lerp(new THREE.Color(0xff7bd5), sg / (SEG - 1)),
          transparent: true,
          opacity: 0.3 + (sg === 0 ? 0.12 : 0),
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      seg.rotation.x = -Math.PI / 2;
      roulette.add(seg);
      rouletteSegs.push(seg);
    }
    var pointer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 2.0), mkMat(0xff7bd5, 1, true));
    pointer.position.z = 0.6;
    pointer.position.y = 0.16;
    roulette.add(pointer);
    var rouletteHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 16), mkMat(0xffd2f0, 0.8, true));
    roulette.add(rouletteHub);
    var rouletteRing = new THREE.Mesh(new THREE.TorusGeometry(2.14, 0.02, 4, 90), mkMat(0xff7bd5, 0.45, true));
    rouletteRing.rotation.x = Math.PI / 2;
    roulette.add(rouletteRing);
    var sampledTokenMesh = new THREE.Group();
    sampledTokenMesh.position.set(0, 4.2, 0);
    st10.group.add(sampledTokenMesh);
    st10.props.roulette = roulette;
    st10.props.pointer = pointer;
    st10.props.sampleToken = sampledTokenMesh;
    st10.props.rouletteSegs = rouletteSegs;

    /* ------------------------------------------------------------ 11 自回归 */

    var st11 = P.stations[10];
    var loopGroup = new THREE.Group();
    loopGroup.position.set(0, 3.0, 0);
    st11.group.add(loopGroup);
    var loop = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.03, 6, 90), mkMat(0xff7bd5, 0.72, true));
    loop.rotation.x = Math.PI / 2;
    loopGroup.add(loop);
    var loopInner = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.012, 4, 70), mkMat(0xffd2f0, 0.24, true));
    loopInner.rotation.x = Math.PI / 2;
    loopGroup.add(loopInner);
    var orbitToken = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xff9ada, transparent: true, opacity: 0.9 })
    );
    loopGroup.add(orbitToken);
    var loopCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.24, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd9a6, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending })
    );
    loopCore.position.y = 0.35;
    loopGroup.add(loopCore);
    var kvGroup = new THREE.Group();
    kvGroup.position.set(0, 5.4, 0);
    st11.group.add(kvGroup);
    var kvBars = [];
    for (var kb = 0; kb < 12; kb++) {
      var kv = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.14), mkMat(0x4fe3ff, 0.55, true));
      kv.geometry.translate(0, 0.5, 0);
      kv.position.set((kb - 5.5) * 0.3, 0, 0);
      kv.scale.y = 0.12;
      kvGroup.add(kv);
      kvBars.push(kv);
    }
    var kvLabelTex = U.textTexture({
      w: 512,
      h: 96,
      text: 'KV CACHE',
      sub: 'PAST TOKENS · K / V',
      color: '#9ff5ff',
      subColor: 'rgba(120,210,240,0.6)',
      font: '500 34px "JetBrains Mono", monospace',
      subSize: 13
    });
    var kvLabel = U.textPlane(2.2, 0.42, kvLabelTex, 0.7);
    kvLabel.position.set(0, 6.1, 0);
    st11.group.add(kvLabel);
    st11.props.loopGroup = loopGroup;
    st11.props.orbitToken = orbitToken;
    st11.props.kvBars = kvBars;

    /* ------------------------------------------------------------ 12 反分词 */

    var st12 = P.stations[11];
    var detokGroup = new THREE.Group();
    detokGroup.position.set(0, 3.4, 0);
    st12.group.add(detokGroup);
    var detokChips = [];
    for (var dc = 0; dc < 4; dc++) {
      var chipTex = U.tokenTexture('—', 0, LLM.util.PALETTE.mint);
      var chip = U.textPlane(1.15, 0.58, chipTex, 0.9);
      chip.position.set((dc - 1.5) * 1.4, 1.25 - dc * 0.06, 0);
      chip.userData.baseX = chip.position.x;
      detokGroup.add(chip);
      detokChips.push(chip);
    }
    var detokLineTex = U.textTexture({
      w: 1024,
      h: 256,
      text: 'AI 回答',
      sub: 'DETOKENIZED TEXT',
      color: '#e8ffe8',
      subColor: 'rgba(109,255,192,0.7)',
      font: '600 54px "PingFang SC","Microsoft YaHei",sans-serif',
      subSize: 20,
      bg: 'rgba(5,18,14,0.82)',
      border: 'rgba(109,255,192,0.45)',
      radius: 20
    });
    var detokLine = U.textPlane(5.4, 1.35, detokLineTex, 0.98);
    detokLine.position.set(0, 0.1, 0);
    detokGroup.add(detokLine);
    st12.props.detokChips = detokChips;
    st12.props.detokLine = detokLine;
    st12.props.detokLineTex = detokLineTex;
    st12.props.detokGroup = detokGroup;

    /* ------------------------------------------------------------ 13 返回 */

    var st13 = P.stations[12];
    var gate = new THREE.Group();
    gate.position.set(0, 3.0, 0);
    st13.group.add(gate);
    var gateRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.035, 6, 100), mkMat(0xc9a96a, 0.7, true));
    gateRing.rotation.x = Math.PI / 2;
    gate.add(gateRing);
    var gateRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.014, 4, 100), mkMat(0xffc46b, 0.3, true));
    gateRing2.rotation.x = Math.PI / 2;
    gateRing2.rotation.z = 0.4;
    gate.add(gateRing2);
    var gateCore = U.sprite(0xffc46b, 3.2, 0.22);
    gate.add(gateCore);
    var eosTex = U.textTexture({
      w: 512,
      h: 192,
      text: 'EOS',
      sub: 'STOP · 200 OK',
      color: '#ffe6b7',
      subColor: 'rgba(255,196,107,0.65)',
      font: '600 68px "JetBrains Mono", monospace',
      subSize: 17
    });
    var eosPlane = U.textPlane(2.4, 0.9, eosTex, 0.9);
    eosPlane.position.set(0, 3.2, 0);
    st13.group.add(eosPlane);

    // 返回用户的光束：从 13 站绕到 1 站上方
    var p1 = points[12].clone();
    var p13 = points[0].clone();
    var retCurve = new THREE.CatmullRomCurve3([
      p1.add(new THREE.Vector3(0, 2.5, 0)),
      new THREE.Vector3(18, 12, 16),
      new THREE.Vector3(0, 15, 18),
      new THREE.Vector3(-18, 12, 16),
      p13.add(new THREE.Vector3(0, 2.2, 0))
    ]);
    var retTube = new THREE.Mesh(new THREE.TubeGeometry(retCurve, 120, 0.02, 4, false), mkMat(0xc9a96a, 0.22, true));
    P.group.add(retTube);
    var retPulse = U.sprite(0xffe6b7, 0.9, 0.7);
    P.group.add(retPulse);
    P.props = { retCurve: retCurve, retPulse: retPulse };
    P.pathObjects = [tube, tubeGlow, floorTube, flowPoints, retTube, retPulse].concat(
      packetMeshes.map(function (p) {
        return p.mesh;
      })
    );
    P.returnObjects = [retTube, retPulse];

    /* ------------------------------------------------------------ 2 站 token 视图 */

    P.setTokens = function (tokens) {
      P.tokens = tokens.slice(0, 8);
      while (P.tokenGroup.children.length) {
        var old = P.tokenGroup.children.pop();
        U.disposeObject(old);
      }
      P.tokens.forEach(function (token, i) {
        var tex = U.tokenTexture(token.text, token.id, token.color);
        var mesh = U.textPlane(1.42, 0.71, tex, 0.96);
        var row = Math.floor(i / 4);
        var col = i % 4;
        mesh.position.set((col - 1.5) * 1.6, (1 - row) * 0.92 - 0.4, 0);
        mesh.userData.baseY = mesh.position.y;
        mesh.userData.index = i;
        P.tokenGroup.add(mesh);
      });
    };

    P.setQuestion = function (text) {
      P.question = text;
      terminalUser.set(text);
      if (P.updateRibbon) P.updateRibbon(text);
    };

    P.setAnswer = function (text) {
      P.answer = text;
      var short = text.length > 20 ? text.slice(0, 18) + '…' : text;
      if (st12.props.detokLineTex) st12.props.detokLineTex.dispose();
      var tex = U.textTexture({
        w: 1024,
        h: 256,
        text: short,
        sub: 'DETOKENIZED TEXT',
        color: '#e8ffe8',
        subColor: 'rgba(109,255,192,0.7)',
        font: '600 54px "PingFang SC","Microsoft YaHei",sans-serif',
        subSize: 20,
        bg: 'rgba(5,18,14,0.82)',
        border: 'rgba(109,255,192,0.45)',
        radius: 20
      });
      st12.props.detokLine.material.map = tex;
      st12.props.detokLine.material.needsUpdate = true;
      st12.props.detokLineTex = tex;
      detokChips.forEach(function (chip, i) {
        var word = P.tokens[i] ? P.tokens[i].text : '·';
        var ct = U.tokenTexture(word, P.tokens[i] ? P.tokens[i].id : 0, LLM.util.PALETTE.mint);
        if (chip.material.map) chip.material.map.dispose();
        chip.material.map = ct;
        chip.material.needsUpdate = true;
      });
    };

    P.setSampleToken = function (token) {
      while (sampledTokenMesh.children.length) {
        U.disposeObject(sampledTokenMesh.children.pop());
      }
      var tex = U.tokenTexture(token, (1000 + Math.abs(LLM.util.hashString(token)) % 49000), LLM.util.PALETTE.pink);
      var plane = U.textPlane(1.4, 0.7, tex, 0.98);
      sampledTokenMesh.add(plane);
    };

    P.setActive = function (no) {
      P.active = no;
      P.stations.forEach(function (st) {
        var on = st.no === no;
        var beam = st.base.userData.beam;
        if (beam) beam.material.opacity = on ? 0.28 : 0.1;
        st.group.userData.active = on;
      });
      if (P.tokenGroup) P.tokenGroup.visible = no === 2;
      if (LLM.app && LLM.app.transformer) {
        LLM.app.transformer.setFocusStage(no);
      }
    };

    /**
     * 单模块探索时只保留当前站台，避免前景道具挡住镜头。
     * no = null 恢复全部；no = 5 时展示中心塔，隐藏所有站台。
     */
    P.setFocus = function (no) {
      P.stations.forEach(function (st) {
        st.group.visible = no == null || (no !== 5 && st.no === no);
        if (st.base.userData.beam) st.base.userData.beam.visible = no == null;
      });
      if (P.stationGround) {
        P.stationGround.forEach(function (pair, i) {
          var show = no == null || (no !== 5 && i + 1 === no);
          pair[0].visible = show;
          pair[1].visible = show;
        });
      }
      if (P.pathObjects) {
        P.pathObjects.forEach(function (obj) {
          obj.visible = no == null;
        });
      }
      if (no === 13 && P.returnObjects) {
        P.returnObjects.forEach(function (obj) {
          obj.visible = true;
        });
      }
    };

    P.setProgress = function (p) {
      P.progress = U.clamp(p, 0, 1);
    };

    /* ------------------------------------------------------------ 动画 */

    P.update = function (dt, elapsed) {
      var active = P.active;
      var progress = P.progress;
      // 手动聚焦某个阶段（未播放）时，用静态预览值展示该阶段的典型状态
      var vp = LLM.app && LLM.app.playing ? progress : 0.72;

      // 数据河粒子
      var pos = flowGeom.attributes.position;
      for (var i = 0; i < flowData.length; i++) {
        var d = flowData[i];
        var t = (d.offset + elapsed * (0.012 + d.speed * 0.45)) % 1;
        if (!isFinite(t)) t = 0;
        var pt;
        try {
          pt = pathCurve.getPointAt(t);
        } catch (err) {
          P._badFlow = { t: t, elapsed: elapsed, i: i, offset: d.offset, speed: d.speed };
          pt = points[0];
        }
        if (!pt) pt = points[0];
        pos.setXYZ(i, pt.x, pt.y + 0.05, pt.z);
        if (active === 1) {
          flowCol[i * 3] = 0.3;
          flowCol[i * 3 + 1] = 0.85;
          flowCol[i * 3 + 2] = 1;
        }
      }
      pos.needsUpdate = true;

      P.packetMeshes.forEach(function (p) {
        var t = (p.offset + elapsed * p.speed) % 1;
        var pt = pathCurve.getPointAt(t);
        p.mesh.position.set(pt.x, pt.y + 0.12, pt.z);
        p.mesh.rotation.y = elapsed * 1.2 + p.offset * 6;
        p.mesh.rotation.x = elapsed * 0.7;
        p.mesh.scale.setScalar(0.8 + Math.sin(elapsed * 2 + p.offset * 8) * 0.15);
      });

      // 各站台公共动画
      P.stations.forEach(function (st) {
        var on = st.no === active;
        st.base.children.forEach(function (child) {
          if (child.userData && child.userData.spin) child.rotation.z += dt * child.userData.spin * (on ? 1.8 : 0.6);
        });
        var s = on ? 1 + Math.sin(elapsed * 2.6) * 0.01 : 1;
        st.group.scale.setScalar(s);
        if (st.base.userData.gem) {
          st.base.userData.gem.rotation.y += dt * (on ? 1.6 : 0.5);
          st.base.userData.gem.rotation.x += dt * 0.3;
        }
      });

      // 1 输入
      var typing = active === 1 && LLM.app && LLM.app.playing;
      terminalUser.setProgress(typing ? progress : 1);
      terminalUser.setStatus(typing ? 'TYPING' : 'READY');
      terminalUser.update();
      st1.props.rings.children.forEach(function (r, i) {
        r.rotation.z += dt * (0.2 + i * 0.08);
      });
      if (active === 1) {
        st1.props.packet.position.x = 2.4 - progress * 3.6;
        st1.props.packet.material.opacity = 0.2 + progress * 0.8;
        st1.props.packet.scale.setScalar(0.6 + progress * 0.8);
      } else {
        st1.props.packet.material.opacity = 0.25;
      }

      // 2 token
      P.tokenGroup.children.forEach(function (chip, i) {
        var appear = active === 2 ? U.smoothstep(U.clamp(vp * 6 - i * 0.4, 0, 1)) : 1;
        chip.scale.setScalar(0.4 + appear * 0.6);
        chip.position.y = chip.userData.baseY + Math.sin(elapsed * 1.4 + i * 0.5) * 0.045;
        chip.material.opacity = 0.2 + appear * 0.75;
      });
      st2.props.splitBar.material.opacity = 0.92;

      // 3 embedding
      var scanCol = Math.floor((elapsed * 1.6) % E_COLS);
      st3.props.embScan.position.x = (scanCol - (E_COLS - 1) / 2) * 0.62;
      st3.props.embScan.material.opacity = active === 3 ? 0.2 : 0.06;
      st3.props.embCubes.forEach(function (cube) {
        var near = cube.userData.col === scanCol;
        var target = near ? 0.95 : 0.42;
        cube.material.opacity += (target - cube.material.opacity) * Math.min(1, dt * 5);
        var sc = near ? 1.18 : 1;
        cube.scale.setScalar(cube.scale.x + (sc - cube.scale.x) * Math.min(1, dt * 6));
      });
      st3.props.embGroup.rotation.y = 0.18 + Math.sin(elapsed * 0.4) * 0.08;

      // 4 waves
      st4.props.waves.forEach(function (line, wi) {
        var arr = line.geometry.attributes.position;
        var base = line.userData.base;
        for (var k = 0; k < base.length; k++) {
          var p = base[k];
          var phase = line.userData.cfg.phase;
          arr.setXYZ(k, p.x, p.y + Math.sin(p.x * 1.8 + elapsed * 1.6 + phase) * 0.16, 0);
        }
        arr.needsUpdate = true;
      });
      st4.props.posBars.children.forEach(function (child, i) {
        if (child.geometry && child.geometry.type === 'BoxGeometry') {
          child.position.y = child.userData.baseY + Math.sin(elapsed * 2 + i) * 0.12;
        }
      });

      // 5 transformer link
      var lt = (elapsed * 0.36) % 1;
      st5.props.linkPulse.position.copy(st5.props.linkCurve.getPoint(lt));
      st5.props.linkPulse.material.opacity = 0.35 + Math.sin(elapsed * 3) * 0.2;
      st5.props.core.rotation.y += dt * 0.6;
      st5.props.core.rotation.x += dt * 0.3;

      // 6 attention 站台微光
      st6.props.attnBeam.material.opacity = active === 6 ? 0.28 + Math.sin(elapsed * 3) * 0.12 : 0.12;

      // 7 multi-head
      heads.rotation.z += dt * 0.07;
      st7.props.wedges.forEach(function (w, i) {
        var spread = active === 7 ? vp : 1;
        w.rotation.z = Math.sin(elapsed * 0.4 + i) * 0.06;
        w.material.opacity = 0.16 + (i % 2 ? 0.05 : 0.1) * spread;
        w.scale.setScalar(1 + spread * 0.08);
      });
      st7.props.headOut.rotation.y += dt * 0.5;
      st7.props.headOut.position.y = 3.2 + Math.sin(elapsed * 1.4) * 0.1;

      // 8 stack
      st8.props.stackLayers.forEach(function (layer, i) {
        var wave = active === 8 ? vp * 8 - i : 0;
        var glow = wave > 0 && wave < 1 ? 1 : 0.25;
        layer.material.emissiveIntensity = 0.35 + glow * 0.9;
      });
      st8.props.stackPulse.position.y = 0.15 + ((elapsed * 0.55) % 1) * 4.8;
      st8.props.stackPulse.material.opacity = 0.3 + Math.sin(elapsed * 3) * 0.15;

      // 9 logits
      st9.props.logitBars.forEach(function (bar, i) {
        var logit = LLM.DEMO.vocab[i].logit;
        var target = 0.1 + ((logit + 2) / 7) * 2.4;
        if (active === 9) target *= U.clamp(vp * 5 - i * 0.15, 0, 1);
        bar.userData.target = target;
        bar.scale.y += (target - bar.scale.y) * Math.min(1, dt * 4);
      });
      st9.props.hiddenCore.rotation.y += dt * 0.8;
      st9.props.funnel.rotation.y += dt * 0.2;

      // 10 sampling
      st10.props.roulette.rotation.y += dt * (active === 10 ? 0.7 + progress * 1.8 : 0.25);
      st10.props.pointer.position.x = Math.cos(elapsed * 2.6) * 1.5;
      st10.props.pointer.position.z = Math.sin(elapsed * 2.6) * 1.5;
      st10.props.pointer.rotation.y = -elapsed * 2.6;
      st10.props.sampleToken.position.y = 4.1 + Math.sin(elapsed * 1.6) * 0.1;
      st10.props.sampleToken.rotation.y = Math.sin(elapsed * 0.8) * 0.2;

      // 11 autoregressive
      var orbitT = active === 11 ? progress : (elapsed * 0.18) % 1;
      var ang = orbitT * Math.PI * 2;
      st11.props.orbitToken.position.set(Math.cos(ang) * 1.55, 0.25 + Math.sin(ang * 2) * 0.12, Math.sin(ang) * 1.55);
      st11.props.orbitToken.rotation.y = ang;
      st11.props.kvBars.forEach(function (bar, i) {
        var target = active === 11 ? U.clamp(vp * 14 - i, 0, 1) : 0.35;
        bar.scale.y += (0.08 + target * 0.9 - bar.scale.y) * Math.min(1, dt * 4);
      });

      // 12 detokenize
      st12.props.detokChips.forEach(function (chip, i) {
        var p = active === 12 ? vp : 1;
        var converge = U.smoothstep(U.clamp(p * 1.5 - 0.15 - i * 0.08, 0, 1));
        chip.position.x = chip.userData.baseX * (1 - converge);
        chip.position.y = 1.25 - i * 0.06 + (1 - converge) * 0.4;
        chip.material.opacity = 0.9 - converge * 0.68;
      });
      st12.props.detokLine.position.y = 0.1 + (active === 12 ? (progress - 0.7) * 0.3 : 0);

      // 13 return
      gate.rotation.y += dt * 0.2;
      st13.props = st13.props || {};
      gateRing.material.opacity = active === 13 ? 0.5 + Math.sin(elapsed * 3) * 0.25 : 0.55;
      var rt = (elapsed * 0.22) % 1;
      retPulse.position.copy(retCurve.getPoint(active === 13 ? Math.min(0.99, vp) : rt));
      retPulse.material.opacity = active === 13 ? 0.9 : 0.4;

      // 连接塔的分流粒子
      if (st5.props.linkPulse) {
        st5.props.linkPulse.material.opacity = active === 5 ? 0.9 : 0.35;
      }
    };

    /* 初始内容 */
    P.setTokens(LLM.Mech.tokenize(LLM.DEMO.question));
    P.setQuestion(LLM.DEMO.question);
    P.setAnswer(LLM.DEMO.answer);
    P.setSampleToken(LLM.DEMO.vocab[0].token);

    return P;
  };
})();
