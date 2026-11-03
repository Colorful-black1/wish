/* ============================================================================
 * app.js — 场景装配、播放状态机、镜头调度、拾取、自定义输入演示
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  var app = {
    stage: 1,
    stageProgress: 0,
    playing: false,
    speed: 1,
    mode: 'flow',
    overview: true,
    customMode: false,
    question: LLM.DEMO.question,
    answer: LLM.DEMO.answer,
    customAnswer: '',
    tokens: [],
    distribution: null,
    sampleOpts: { temperature: 0.9, topK: 5, topP: 0.9 },
    activeToken: 0,
    attentionPinned: false,
    decodedTokens: 0,
    finished: false,
    lastUI: 0
  };
  LLM.app = app;

  function pickCustomAnswer(text) {
    var lower = String(text).toLowerCase();
    for (var i = 0; i < LLM.CUSTOM_ANSWERS.length; i++) {
      var item = LLM.CUSTOM_ANSWERS[i];
      for (var k = 0; k < item.keys.length; k++) {
        if (lower.indexOf(item.keys[k].toLowerCase()) >= 0) return item.text;
      }
    }
    return LLM.CUSTOM_FALLBACK;
  }

  function basePoint(no) {
    var st = app.pipeline.stations[no - 1];
    return st.group.position.clone();
  }

  app.updateGlobalProgress = function (force) {
    var p = ((this.stage - 1) + U.clamp(this.stageProgress, 0, 1)) / LLM.PIPELINE.length;
    var now = performance.now();
    if (force || now - this.lastUI > 70) {
      this.lastUI = now;
      this.ui.setProgress(p);
      this.ui.els.scrub.setAttribute('aria-valuenow', String(this.stage));
    }
  };

  app.focusStageView = function (no, duration) {
    if (!this.scene || !this.scene.ok) return;
    var narrow = U.isNarrow();
    var target;
    var pos;
    if (no === 5) {
      target = new THREE.Vector3(0, narrow ? 10.2 : 10.8, LLM.LAYOUT.tower.z);
      pos = narrow ? new THREE.Vector3(8, 15.6, 27) : new THREE.Vector3(8.8, 16.4, 21);
    } else if (no === 6) {
      target = this.attention.group.position.clone().add(new THREE.Vector3(narrow ? 0 : 2.1, 1.1, 0));
      pos = target.clone().add(new THREE.Vector3(narrow ? 0 : 0.2, narrow ? 2.1 : 2.8, narrow ? 24 : 15.5));
    } else {
      var st = this.pipeline.stations[no - 1];
      var targetYs = [3.4, 3.6, 3.5, 3.8, 3.2, 3.1, 3.5, 4.4, 3.9, 4.1, 4.8, 3.6, 4.4];
      target = st.position.clone().add(new THREE.Vector3(0, targetYs[no - 1] || 3.4, 0));
      pos = target.clone().add(new THREE.Vector3(narrow ? 1.2 : 2.2, narrow ? 4.4 : 4.6, narrow ? 19 : 16));
    }
    this.scene.cameraTween(pos, target, duration || 1.35);
    this.overview = false;
  };

  app.enterStage = function (no, opts) {
    opts = opts || {};
    no = Math.max(1, Math.min(LLM.PIPELINE.length, no));
    var stage = LLM.getStage(no);
    this.stage = no;
    this.stageProgress = U.clamp(opts.progress || 0, 0, 1);
    this.decodedTokens = 0;
    this.attentionPinned = false;
    this.sampledThisStage = false;
    this.activeToken = 0;
    this.ui.ctx.decodedTokens = 0;

    this.ui.setActiveStage(no, { keepPanel: !!opts.keepPanel });
    this.pipeline.setActive(no);
    this.pipeline.setFocus(no);
    this.pipeline.group.visible = true;
    this.transformer.group.visible = no === 5;
    this.transformer.setFocusStage(no);
    this.transformer.setExploded(no === 5);
    this.transformer.setActiveLayer(-1);
    this.attention.setVisible(no === 6);
    this.attention.setActive(0);

    if (no === 6) {
      this.ui.updateAttention(this.attention.attention, 0);
    }
    if (no === 10) {
      this.resample({ silent: true });
    }
    if (no === 12) {
      this.decodedTokens = Math.min(12, LLM.Mech.tokenize(this.answer).length);
    }
    this.ui.ctx.decodedTokens = this.decodedTokens;
    this.ui.setTokenCount(this.tokens.length);
    this.ui.setPlaying(this.playing);

    if (opts.focus !== false) this.focusStageView(no);
    this.ui.setFocusLabels(opts.focus !== false, no);
    this.updateGlobalProgress(true);
  };

  app.selectStage = function (no, opts) {
    opts = opts || {};
    if (this.mode !== 'flow') {
      this.mode = 'flow';
      this.ui.setMode('flow');
      if (this.infra) {
        this.infra.group.visible = false;
        this.infra.setLabelsVisible(false);
      }
    }
    if (opts.user) {
      this.playing = false;
      this.finished = false;
      this.ui.setPlaying(false);
    }
    this.enterStage(no, { focus: opts.focus !== false });
  };

  app.next = function () {
    this.playing = false;
    this.ui.setPlaying(false);
    var next = Math.min(LLM.PIPELINE.length, this.stage + 1);
    this.selectStage(next, { focus: true });
  };

  app.prev = function () {
    this.playing = false;
    this.ui.setPlaying(false);
    if (this.stageProgress > 0.12) {
      this.stageProgress = 0;
      this.updateGlobalProgress(true);
    } else {
      this.selectStage(Math.max(1, this.stage - 1), { focus: true });
    }
  };

  app.seek = function (fraction) {
    this.playing = false;
    this.ui.setPlaying(false);
    var f = U.clamp(fraction, 0, 0.9999);
    var idx = Math.floor(f * LLM.PIPELINE.length);
    var inner = f * LLM.PIPELINE.length - idx;
    this.enterStage(Math.min(13, idx + 1), { progress: inner, focus: true });
  };

  app.togglePlay = function () {
    if (this.mode !== 'flow') {
      this.setMode('flow');
    }
    if (this.playing) {
      this.playing = false;
      this.ui.setPlaying(false);
      this.updateGlobalProgress(true);
      return;
    }
    if (this.stage === 13 && this.stageProgress >= 0.999) {
      this.replay();
      return;
    }
    this.playing = true;
    this.finished = false;
    this.ui.setPlaying(true);
    if (this.overview) this.focusStageView(this.stage);
    this.updateGlobalProgress(true);
  };

  app.setSpeed = function (v) {
    this.speed = v;
    this.ui.toast('播放速度 ' + v + '×');
  };

  app.replay = function () {
    this.resetDemo();
    this.playing = true;
    this.finished = false;
    this.enterStage(1, { focus: true });
    this.ui.setPlaying(true);
  };

  app.resetDemo = function () {
    this.customMode = false;
    this.question = LLM.DEMO.question;
    this.answer = LLM.DEMO.answer;
    this.customAnswer = '';
    this.tokens = LLM.Mech.tokenize(this.question);
    this.pipeline.setTokens(this.tokens);
    this.pipeline.setQuestion(this.question);
    this.pipeline.setAnswer(this.answer);
    this.attention.build(this.tokens);
    this.attention.setActive(0);
    this.activeToken = 0;
    this.stageProgress = 0;
    this.ui.ctx = {
      tokens: this.tokens,
      question: this.question,
      answer: this.answer,
      custom: false,
      attention: this.attention.attention,
      activeToken: 0,
      sampleOpts: this.sampleOpts,
      distribution: this.distribution,
      decodedTokens: 0
    };
    this.ui.setTokenCount(this.tokens.length);
    this.ui.padClearMessages();
    this.ui.padBusy = false;
    this.ui.els.padSend.disabled = false;
    this.ui.closePad();
  };

  app.finish = function () {
    if (this.finished) return;
    this.finished = true;
    this.playing = false;
    this.stageProgress = 1;
    this.ui.setPlaying(false);
    this.updateGlobalProgress(true);
    var answer = this.customMode ? this.customAnswer : this.answer;
    var answerTokens = LLM.Mech.tokenize(answer);
    var meta = {
      tokens: answerTokens.length,
      chars: answer.length,
      ms: this.customMode ? 740 : 1120
    };
    var self = this;
    setTimeout(function () {
      if (self.customMode) {
        self.ui.openPad();
        self.ui.padBusy = true;
        self.ui.els.padSend.disabled = true;
        self.ui.padAnswer(answer, meta);
      } else if (!U.isNarrow()) {
        self.ui.padClearMessages();
        self.ui.padAddMessage('user', self.question);
        self.ui.openPad();
        self.ui.padBusy = true;
        self.ui.els.padSend.disabled = true;
        self.ui.padAnswer(answer, meta);
      }
      self.ui.toast(self.customMode ? '模拟推理完成 · 结果为预置演示文案' : '全流程演示完成 · 点击站台可复盘任意阶段');
    }, 420);
  };

  app.setMode = function (mode) {
    this.mode = mode;
    this.playing = false;
    this.finished = false;
    this.ui.setPlaying(false);
    this.ui.setFocusLabels(false);
    this.ui.setMode(mode);
    this.pipeline.setFocus(null);
    if (this.infra) this.infra.group.visible = mode === 'infra';
    if (mode === 'infra') {
      this.overview = false;
      this.transformer.group.visible = false;
      this.pipeline.group.visible = false;
      this.attention.setVisible(false);
      if (this.infra) {
        var view = this.infra.focusView();
        this.scene.cameraTween(view.pos, view.target, 1.7);
        this.infra.setActive(null);
        this.infra.setLabelsVisible(true);
      }
      this.attention.setVisible(false);
      this.transformer.setExploded(false);
    } else if (mode === 'knowledge') {
      this.overview = false;
      this.attention.setVisible(false);
      this.transformer.group.visible = true;
      this.pipeline.group.visible = true;
      if (this.infra) this.infra.setLabelsVisible(false);
      this.scene.goHome(1.6);
      this.transformer.setExploded(false);
    } else {
      this.overview = true;
      this.attention.setVisible(this.stage === 6);
      this.transformer.group.visible = true;
      this.pipeline.group.visible = true;
      if (this.infra) this.infra.setLabelsVisible(false);
      this.scene.goHome(1.5);
      this.transformer.setExploded(false);
    }
    this.updateGlobalProgress(true);
  };

  app.goOverview = function () {
    this.playing = false;
    this.finished = false;
    this.ui.setPlaying(false);
    this.mode = 'flow';
    this.ui.setMode('flow');
    this.ui.setFocusLabels(false);
    this.scene.goHome(1.4);
    this.transformer.setExploded(false);
    this.transformer.group.visible = true;
    this.pipeline.group.visible = true;
    this.pipeline.setFocus(null);
    this.attention.setVisible(false);
    if (this.infra) {
      this.infra.setLabelsVisible(false);
      this.infra.group.visible = false;
    }
    this.overview = true;
    this.ui.toast('已回到全景视角 · 滚轮缩放 / 拖拽旋转');
  };

  app.focusCurrent = function () {
    if (this.mode !== 'flow') this.setMode('flow');
    this.focusStageView(this.stage);
  };

  app.toggleExplode = function () {
    if (this.mode !== 'flow') this.setMode('flow');
    var next = !this.transformer.exploded;
    this.transformer.setExploded(next);
    this.ui.toast(next ? 'Transformer Block 已展开 · 点击层标签查看原理' : 'Transformer Block 已合拢');
    if (next) {
      this.selectStage(5, { focus: true });
      this.transformer.setExploded(true);
    }
  };

  app.focusLayer = function (index) {
    var layer = LLM.LAYERS[index];
    if (!layer) return;
    this.selectStage(5, { focus: false });
    this.transformer.setExploded(true);
    this.transformer.setActiveLayer(index);
    this.focusStageView(5);
    this.ui.showConcept(layer.concept, 'stage');
  };

  app.focusLayerByKey = function (key) {
    for (var i = 0; i < LLM.LAYERS.length; i++) {
      if (LLM.LAYERS[i].key === key) {
        this.focusLayer(i);
        return;
      }
    }
  };

  app.focusInfra = function (id) {
    if (this.mode !== 'infra') {
      this.mode = 'infra';
      this.ui.setMode('infra');
      this.transformer.group.visible = false;
      this.pipeline.group.visible = false;
      var view = this.infra.focusView();
      this.scene.cameraTween(view.pos, view.target, 1.6);
    }
    this.infra.setLabelsVisible(true);
    this.infra.group.visible = true;
    this.infra.setActive(id);
    this.ui.showConcept(id, 'list');
  };

  app.setAttentionToken = function (i) {
    if (!this.attention.attention) return;
    var n = this.attention.attention.tokens.length;
    i = Math.max(0, Math.min(n - 1, i));
    this.activeToken = i;
    this.attentionPinned = true;
    this.attention.setActive(i);
    this.ui.ctx.activeToken = i;
    this.ui.updateAttention(this.attention.attention, i);
  };

  app.previewSampling = function (opts) {
    this.sampleOpts = Object.assign({}, this.sampleOpts, opts);
    var dist = LLM.Mech.distribution(LLM.Mech.candidateList(), Object.assign({}, this.sampleOpts, { greedy: true }));
    this.distribution = dist;
    this.ui.ctx.sampleOpts = this.sampleOpts;
    this.ui.ctx.distribution = dist;
    this.ui.updateSampler(dist);
  };

  app.resample = function (opts) {
    opts = opts || {};
    var dist = LLM.Mech.distribution(LLM.Mech.candidateList(), Object.assign({}, this.sampleOpts));
    this.distribution = dist;
    this.ui.ctx.sampleOpts = this.sampleOpts;
    this.ui.ctx.distribution = dist;
    this.pipeline.setSampleToken(LLM.DEMO.vocab[dist.pick].token);
    this.ui.updateSampler(dist);
    if (!opts.silent) {
      this.ui.toast('采样完成 → ' + LLM.DEMO.vocab[dist.pick].token + ' · Top-K ' + dist.topK + ' / Top-P ' + dist.topP);
    }
  };

  app.runCustom = function (text) {
    var clean = String(text || '').trim();
    if (!clean) return;
    this.customMode = true;
    this.customAnswer = pickCustomAnswer(clean);
    this.question = clean;
    this.answer = this.customAnswer;
    this.tokens = LLM.Mech.tokenize(clean);
    if (!this.tokens.length) this.tokens = LLM.Mech.tokenize('你好');
    this.activeToken = 0;
    this.attentionPinned = false;
    this.pipeline.setTokens(this.tokens);
    this.pipeline.setQuestion(clean);
    this.pipeline.setAnswer(this.customAnswer);
    this.attention.build(this.tokens);
    this.attention.setActive(0);
    this.ui.ctx = {
      tokens: this.tokens,
      question: clean,
      answer: this.customAnswer,
      custom: true,
      attention: this.attention.attention,
      activeToken: 0,
      sampleOpts: this.sampleOpts,
      distribution: this.distribution,
      decodedTokens: 0
    };
    this.ui.setTokenCount(this.tokens.length);
    this.mode = 'flow';
    this.ui.setMode('flow');
    if (this.infra) {
      this.infra.group.visible = false;
      this.infra.setLabelsVisible(false);
    }
    this.ui.openPanel();
    this.ui.toast('已分词为 ' + this.tokens.length + ' 个 token · 开始模拟推理');
    this.playing = true;
    this.finished = false;
    this.enterStage(1, { focus: true });
    this.ui.setPlaying(true);
  };

  app.getDuration = function () {
    if (!this.customMode) return LLM.getStage(this.stage).duration;
    if (this.stage === 5 || this.stage === 6 || this.stage === 11) return 1500;
    return 1000;
  };

  /* ------------------------------------------------------------ 主循环 */

  app.tick = function (dt) {
    var stage = LLM.getStage(this.stage);

    if (this.playing) {
      var duration = this.getDuration();
      this.stageProgress += (dt * 1000 * this.speed) / duration;

      if (this.stageProgress >= 1) {
        if (this.stage < LLM.PIPELINE.length) {
          this.stageProgress = 0;
          this.enterStage(this.stage + 1, { focus: true });
        } else {
          this.stageProgress = 1;
          this.finish();
        }
      }
    }

    // 注意力查询行自动轮播（用户点击后停止轮播）
    if (this.playing && this.stage === 6 && !this.attentionPinned && this.attention.attention) {
      var n = this.attention.attention.tokens.length;
      var idx = Math.floor(this.stageProgress * n * 1.1) % n;
      if (idx !== this.activeToken) {
        this.activeToken = idx;
        this.attention.setActive(idx);
        this.ui.ctx.activeToken = idx;
        this.ui.updateAttention(this.attention.attention, idx);
      }
    }

    // 采样阶段自动抽一次
    if (this.playing && this.stage === 10 && !this.sampledThisStage && this.stageProgress > 0.52) {
      this.sampledThisStage = true;
      this.resample({ silent: true });
    }

    // 自回归计数
    if (this.stage === 11) {
      var answerTokens = LLM.Mech.tokenize(this.answer).length;
      var decoded = Math.max(0, Math.min(answerTokens, Math.floor(this.stageProgress * answerTokens)));
      if (decoded !== this.decodedTokens) {
        this.decodedTokens = decoded;
        this.ui.ctx.decodedTokens = decoded;
        var el = document.getElementById('decodedOut');
        if (el) el.textContent = String(decoded);
      }
    }

    this.pipeline.setProgress(this.stageProgress);
    this.pipeline.update(dt, this.scene.elapsed);
    this.transformer.update(dt, this.scene.elapsed);
    this.attention.update(dt, this.scene.elapsed);
    this.infra.update(dt, this.scene.elapsed);

    this.updateGlobalProgress(false);
  };

  /* ------------------------------------------------------------ 拾取 */

  app.bindPointer = function () {
    var canvas = this.scene.canvas;
    var down = null;
    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    canvas.addEventListener('pointerup', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      var dy = e.clientY - down.y;
      var dt = performance.now() - down.t;
      down = null;
      if (dx * dx + dy * dy > 42 || dt > 650) return;
      var hit = app.scene.pick(e.clientX, e.clientY);
      if (!hit) return;
      app.handlePick(hit.data);
    });
    canvas.addEventListener('dblclick', function () {
      app.goOverview();
    });
  };

  app.handlePick = function (data) {
    if (!data) return;
    if (data.type === 'stage') {
      this.selectStage(data.no, { focus: true, user: true });
    } else if (data.type === 'layer') {
      this.focusLayer(data.index);
    } else if (data.type === 'attn') {
      if (this.mode !== 'flow') {
        this.mode = 'flow';
        this.ui.setMode('flow');
      }
      this.selectStage(6, { focus: true });
      this.setAttentionToken(data.index);
    } else if (data.type === 'infra') {
      this.focusInfra(data.id);
    }
  };

  /* ------------------------------------------------------------ 启动 */

  function failBoot(message) {
    var boot = document.getElementById('boot');
    var txt = document.getElementById('bootText');
    if (txt) {
      txt.textContent = message;
      txt.classList.add('is-error');
    }
    var bar = boot && boot.querySelector('.boot__bar');
    if (bar) bar.style.display = 'none';
  }

  app.boot = function () {
    if (window.gsap) {
      // 低帧率（如无头软件渲染）下不要让 GSAP 拖慢镜头补间
      gsap.ticker.lagSmoothing(0);
    }
    var canvas = document.getElementById('view');
    var scene;

    try {
      scene = LLM.createScene(canvas);
    } catch (err) {
      failBoot('无法初始化 3D 场景：' + (err && err.message ? err.message : err));
      return;
    }

    if (!scene.ok) {
      failBoot('当前浏览器或环境未启用 WebGL。请用支持 WebGL 的 Chrome / Edge 打开，或关闭无头模式后重试。');
      return;
    }

    scene.flushError = function (msg) {
      failBoot(msg);
    };

    var bootText = document.getElementById('bootText');
    if (bootText) bootText.textContent = '装配 13 站推理流水线…';

    this.scene = scene;
    this.tokens = LLM.Mech.tokenize(this.question);
    this.distribution = LLM.Mech.distribution(LLM.Mech.candidateList(), Object.assign({}, this.sampleOpts, { greedy: true }));

    this.pipeline = LLM.createPipeline(scene);
    this.pipeline.setActive(1);
    this.pipeline.setProgress(0);
    this.pipeline.setFocus(null);

    if (bootText) bootText.textContent = '构建 Transformer Block…';
    this.transformer = LLM.createTransformer(scene);

    var st6 = this.pipeline.stations[5];
    var attOrigin = st6.group.position.clone().add(new THREE.Vector3(0, 6.2, 0));
    this.attention = LLM.createAttention(scene, attOrigin, this.tokens, function (i) {
      app.setAttentionToken(i);
    });
    this.attention.setVisible(false);
    this.attention.setActive(0);

    if (bootText) bootText.textContent = '铺设推理基础设施岛…';
    this.infra = LLM.createInfra(scene);
    this.infra.group.visible = false;

    this.ui = LLM.createUI(this, scene);
    this.ui.ctx = {
      tokens: this.tokens,
      question: this.question,
      answer: this.answer,
      custom: false,
      attention: this.attention.attention,
      activeToken: 0,
      sampleOpts: this.sampleOpts,
      distribution: this.distribution,
      decodedTokens: 0
    };
    this.ui.init();
    this.ui.setTokenCount(this.tokens.length);

    this.bindPointer();
    scene.addTicker(function (dt) {
      app.tick(dt);
    });
    scene.start();

    // 初始全景
    this.overview = true;
    this.updateGlobalProgress(true);

    if (bootText) bootText.textContent = '场景就绪 · 13 stations online';
    setTimeout(function () {
      var boot = document.getElementById('boot');
      if (boot) boot.classList.add('is-done');
      document.documentElement.dataset.ready = '1';
      window.LLM_READY = true;
    }, 520);

    // 首屏提示：轻推一下相机，暗示场景可拖拽（不改变构图）
    setTimeout(function () {
      if (!app.overview || app.playing || app.mode !== 'flow') return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      app.scene.controls.autoRotate = true;
      app.scene.controls.autoRotateSpeed = 0.18;
      setTimeout(function () {
        app.scene.controls.autoRotate = false;
      }, 3200);
    }, 1400);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      app.boot();
    });
  } else {
    app.boot();
  }
})();
