/* ==========================================================================
   ui.js — HUD、参考系/时间/尺度控件、里程表、轨迹对照插图、信息面板、帮助浮层
   只负责 DOM，不碰轨道计算。
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) {
    return document.getElementById(id);
  };

  var SCALES = [
    { id: 'orrery', label: '比例压缩' },
    { id: 'distance', label: '真实距离' },
    { id: 'true', label: '完全真实' },
  ];

  var QUALITY = [
    { id: 'standard', label: '标准' },
    { id: 'high', label: '高' },
    { id: 'cinematic', label: '电影级' },
  ];

  function fmt(n, digits) {
    if (n === null || n === undefined || n === '' || Number.isNaN(n)) return null;
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits === undefined ? 0 : digits,
    });
  }

  function createUI(app) {
    var ui = {};
    var MOTION = window.HELIOS_MOTION;

    /* ---- 天体列表 ---- */
    var rosterList = $('rosterList');
    var rosterButtons = [];
    app.bodies.forEach(function (b, i) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'roster-item';
      btn.setAttribute('data-body', String(i));
      btn.setAttribute('aria-label', '查看' + b.nameZh + '（' + b.nameEn + '）的特写');
      btn.innerHTML = '<span class="idx" aria-hidden="true">' + (i + 1) + '</span><span class="nm">' + b.nameZh + '</span>';
      btn.addEventListener('click', function () { app.focusBody(i); });
      btn.addEventListener('mouseenter', function () { app.setHover(i); });
      btn.addEventListener('mouseleave', function () { app.setHover(-1); });
      li.appendChild(btn);
      rosterList.appendChild(li);
      rosterButtons.push(btn);
    });

    /* ---- 分段控件 ---- */
    function buildSegmented(host, items, activeId, onPick) {
      host.innerHTML = '';
      var btns = [];
      items.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = it.label;
        b.setAttribute('data-id', it.id);
        b.setAttribute('aria-pressed', it.id === activeId ? 'true' : 'false');
        if (it.title) b.title = it.title;
        b.addEventListener('click', function () { onPick(it.id); });
        host.appendChild(b);
        btns.push(b);
      });
      return btns;
    }

    function press(btns, id) {
      btns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
      });
    }

    var scaleBtns = buildSegmented($('scaleGroup'), SCALES, 'orrery', function (id) { app.setScale(id); });
    var frameBtns = buildSegmented($('frameGroup'), MOTION.frames.map(function (f) { return { id: f.id, label: f.label, title: f.desc }; }), 'sun', function (id) { app.setFrame(id); });
    var qualityBtns = buildSegmented($('qualityGroup'), QUALITY, 'standard', function (id) { app.setQuality(id); });

    /* 时间倍率：暂停 + 六档 */
    var timeHost = $('timeGroup');
    timeHost.innerHTML = '';
    var timeBtns = [];
    var TIME_ITEMS = [{ id: 'paused', label: '暂停' }].concat(
      MOTION.timeSteps.map(function (s) { return { id: s.id, label: s.glyph, title: '1 秒 = ' + s.label }; })
    );
    TIME_ITEMS.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      b.setAttribute('data-id', it.id);
      b.setAttribute('aria-pressed', it.id === 'paused' ? 'true' : 'false');
      if (it.title) b.title = it.title;
      b.addEventListener('click', function () {
        if (it.id === 'paused') app.pause();
        else app.setTimeStep(it.id);
      });
      timeHost.appendChild(b);
      timeBtns.push(b);
    });

    $('btnToday').addEventListener('click', function () { app.goToday(); });

    /* 自定义时间倍率：1 秒 = N 个<单位> */
    var rateInput = $('customRate');
    var rateUnit = $('customUnit');
    MOTION.timeSteps.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.label.replace(/^1\s+/, '');
      rateUnit.appendChild(o);
    });
    rateUnit.value = 'year';
    function applyRate() {
      var v = Number(rateInput.value);
      if (!isFinite(v) || v <= 0) return;
      app.setRate(v, rateUnit.value);
    }
    rateInput.addEventListener('change', applyRate);
    rateUnit.addEventListener('change', applyRate);

    ui.setCustomRate = function (value, unitId) {
      if (value !== null && value !== undefined) rateInput.value = String(value);
      if (unitId) rateUnit.value = unitId;
    };

    var trailHost = $('trailGainGroup');
    var trailBtns = [];
    MOTION.trailGains.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '×' + g;
      b.setAttribute('data-id', String(g));
      b.setAttribute('aria-pressed', g === 1 ? 'true' : 'false');
      b.addEventListener('click', function () { app.setTrailGain(g); });
      trailHost.appendChild(b);
      trailBtns.push(b);
    });

    /* ---- 设置行 ---- */
    var settingsToggle = $('settingsToggle');
    var settingsRow = $('settingsRow');
    settingsToggle.addEventListener('click', function () {
      var open = settingsRow.hasAttribute('hidden');
      if (open) settingsRow.removeAttribute('hidden');
      else settingsRow.setAttribute('hidden', '');
      settingsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    var starSlider = $('starBrightness');
    var starOut = $('starBrightnessOut');
    starSlider.addEventListener('input', function () {
      starOut.textContent = starSlider.value;
      app.setStarBrightness(Number(starSlider.value) / 100);
    });

    function slider(id, outId, onInput, scale) {
      var el = $(id);
      var out = $(outId);
      if (!el) return;
      el.addEventListener('input', function () {
        out.textContent = el.value;
        onInput(Number(el.value) / (scale || 100));
      });
    }
    slider('exposure', 'exposureOut', function (v) { app.setPostParam('exposure', v); });
    slider('bloom', 'bloomOut', function (v) { app.setPostParam('bloom', v); });
    slider('grain', 'grainOut', function (v) { app.setPostParam('grain', v); });
    slider('aberration', 'aberrationOut', function (v) { app.setPostParam('aberration', v); });

    var debugBtns = buildSegmented(
      $('debugGroup'),
      [
        { id: '0', label: '成片' },
        { id: '1', label: '场景' },
        { id: '2', label: '辉光' },
        { id: '3', label: '无辉光' },
      ],
      '0',
      function (id) { app.setDebugView(Number(id)); }
    );

    $('btnSavePng').addEventListener('click', function () { app.savePng(); });
    $('btnResetParams').addEventListener('click', function () { app.resetParams(); });

    var bgToggle = $('toggleBackground');
    var cnToggle = $('toggleConstellations');
    bgToggle.addEventListener('click', function () { app.toggleBackground(); });
    cnToggle.addEventListener('click', function () { app.toggleConstellations(); });

    /* ---- 日期 ---- */
    var dateInput = $('dateInput');
    dateInput.addEventListener('change', function () { if (dateInput.value) app.setDateString(dateInput.value); });
    dateInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') dateInput.blur(); });

    /* ---- 返回 / 帮助 ---- */
    $('btnBack').addEventListener('click', function () { app.exitFocus(); });
    $('panelClose').addEventListener('click', function () { app.exitFocus(); });

    var help = $('help');
    var helpClose = $('helpClose');
    var lastFocus = null;
    helpClose.addEventListener('click', function () { app.closeHelp(); });
    help.addEventListener('click', function (e) { if (e.target === help) app.closeHelp(); });

    /* ---- 对外接口 ---- */
    ui.setActive = function (i) {
      rosterButtons.forEach(function (b, k) {
        b.classList.toggle('is-active', k === i);
        b.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
    };

    ui.setHover = function (i) {
      rosterButtons.forEach(function (b, k) { b.classList.toggle('is-hovered', k === i); });
    };

    ui.focusRoster = function (i) { if (rosterButtons[i]) rosterButtons[i].focus(); };

    ui.setScale = function (id, note) {
      press(scaleBtns, id);
      $('scaleNote').textContent = note || '';
    };

    ui.setFrame = function (id, note) {
      press(frameBtns, id);
      $('frameNote').textContent = note || '';
      document.body.classList.toggle('frame-moving', id !== 'sun');
    };

    ui.setTimeStep = function (id) {
      press(timeBtns, id);
    };

    ui.setPlaying = function (on) {
      if (!on) press(timeBtns, 'paused');
    };

    ui.setQuality = function (id) { press(qualityBtns, id); };
    ui.setDebugView = function (n) { press(debugBtns, String(n)); };

    ui.setPostSlider = function (key, v) {
      var map = { exposure: ['exposure', 50, 180, 100], bloom: ['bloom', 0, 150, 100], grain: ['grain', 0, 200, 100], aberration: ['aberration', 0, 300, 100] };
      var m = map[key];
      if (!m) return;
      var el = $(m[0]);
      var out = $(m[0] + 'Out');
      var val = Math.round(Math.min(m[2], Math.max(m[1], v * 100)));
      if (el) el.value = String(val);
      if (out) out.textContent = String(val);
    };

    /* ---- 遥测 ---- */
    var fpsHist = [];
    ui.setTelemetry = function (t) {
      $('tFps').textContent = t.fps > 0 ? t.fps.toFixed(0) : '—';
      $('tFrame').textContent = String(t.frame);
      $('tQuality').textContent = t.quality;
      $('tRender').textContent = t.render;
      $('tLod').textContent = 'L' + t.lod;
      $('tDpr').textContent = t.dpr.toFixed(2);
    };
    ui.setBackground = function (on) { bgToggle.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    ui.setConstellations = function (on) { cnToggle.setAttribute('aria-pressed', on ? 'true' : 'false'); };

    ui.setStarBrightness = function (v) {
      starSlider.value = String(Math.round(v * 100));
      starOut.textContent = starSlider.value;
    };

    ui.setDate = function (date) {
      if (!date || Number.isNaN(date.getTime())) return;
      var y = date.getUTCFullYear();
      if (y < 1600 || y > 2400) return;
      var iso = String(y).padStart(4, '0') + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
      if (dateInput.value !== iso) dateInput.value = iso;
    };

    ui.setDateNote = function (text) { $('jdNote').textContent = text; };

    ui.setMastheadTucked = function (t) { $('masthead').classList.toggle('is-tucked', !!t); };
    ui.setHint = function (text) { $('hint').textContent = text; };
    ui.setBackVisible = function (on) {
      var b = $('btnBack');
      if (on) b.removeAttribute('hidden'); else b.setAttribute('hidden', '');
    };
    ui.setHudVisible = function (on) {
      $('hud').classList.toggle('is-hidden', !on);
      document.body.classList.toggle('no-ui', !on);
    };

    ui.setPlanetLocked = function () { /* 2050 冻结已取消：行星一直算下去 */ };

    /* ---- 里程表 ---- */
    var fmtNum = function (n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); };

    function fmtAngle(deg) {
      if (deg < 1e-4) return (deg * 3600).toExponential(1) + '<span class="u">″</span>';
      if (deg < 0.01) return (deg * 3600).toFixed(2) + '<span class="u">″</span>';
      if (deg < 10) return deg.toFixed(3) + '<span class="u">°</span>';
      return fmtNum(deg, deg < 100 ? 1 : 0) + '<span class="u">°</span>';
    }
    function fmtLy(ly) {
      if (ly < 1e-3) return ly.toExponential(1) + '<span class="u">ly</span>';
      if (ly < 1) return ly.toFixed(4) + '<span class="u">ly</span>';
      if (ly < 1e4) return fmtNum(ly, ly < 100 ? 2 : 0) + '<span class="u">ly</span>';
      return (ly / 1e4).toExponential(1) + '<span class="u">万 ly</span>';
    }

    ui.setReadouts = function (m) {
      $('odoDate').textContent = m.date;
      $('odoFrame').textContent = m.frameLabel;
      $('odoVgc').innerHTML = fmtNum(m.gcSpeed, 1) + '<span class="u">km/s</span>';
      $('odoRgc').innerHTML = fmtNum(m.rGcLy, 0) + '<span class="u">ly</span> · ' + m.rGcKpc + '<span class="u">kpc</span>';
      $('odoArc').innerHTML = fmtAngle(m.arcDeg) + ' · ' + fmtLy(m.arcLy);
      $('odoGain').innerHTML = '×' + m.trailGain + (m.trailGain === 1 ? '<span class="u">真实</span>' : '<span class="u">已放大</span>');
      $('odoLod').innerHTML = 'L' + m.lod + ' <span class="u">' + ['天体特写', '太阳系', '恒星邻域', '银河'][m.lod] + '</span>';
      $('odoVcmb').innerHTML = m.cmbSpeed.toFixed(2) + '<span class="u">km/s</span>';
      if (m.hoverText) $('readout').textContent = m.hoverText;
    };

    /* ---- 轨迹对照插图 -------------------------------------------------- */
    function helixPath(cx, cy, w, h, pitchPx, turns) {
      var pts = [];
      var N = 96;
      var r = w * 0.28;
      for (var i = 0; i <= N; i++) {
        var t = i / N;
        var th = t * turns * Math.PI * 2;
        var x = cx + Math.sin(th) * r;
        var y = cy + h / 2 - t * h;
        pts.push((i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1));
        if (turns * (t * 1) > 1.4) break;
      }
      return pts.join(' ');
    }

    ui.setTrailGain = function (g, model) {
      press(trailBtns, String(g));
      var svg = $('trailSvg');
      var cap = $('trailCaption');
      if (!svg) return;
      var W = 210, H = 96;
      var half = (W - 18) / 2;
      function panel(x0, title, pitchAu, sub) {
        var scalePx = (half - 10) / 8; // 8 AU 宽度放进半栏
        var pitchPx = Math.min(2000, pitchAu * scalePx);
        var turns = Math.max(0.06, H / Math.max(pitchPx, 0.4));
        var path = helixPath(x0 + half / 2, 14, half - 16, H - 34, pitchPx, Math.min(turns, 6));
        return (
          '<g><text x="' + (x0 + half / 2) + '" y="11" text-anchor="middle" class="ti-lbl">' + title + '</text>' +
          '<path d="' + path + '" class="ti-path"/></g>' +
          '<text x="' + (x0 + half / 2) + '" y="' + (H - 4) + '" text-anchor="middle" class="ti-sub">' + sub + '</text>'
        );
      }
      var truePitch = model.truePitchAu;
      var shown = model.shownPitchAu;
      svg.innerHTML =
        panel(6, '真实 ×1', truePitch, '螺距 ' + truePitch.toFixed(1) + ' AU/年') +
        panel(W / 2 + 6, '轨迹放大 ×' + g, shown, '按 1/' + g + ' 显示');
      cap.innerHTML =
        '地球轨道半径 1 AU，太阳一年真实走 ' + truePitch.toFixed(1) + ' AU —— 放大 ×' + g +
        ' 后按 ' + shown.toFixed(2) + ' AU/年 画，螺距才和轨道直径可比。天文量没有变。';
    };

    /* ---- 信息面板 ---- */
    function statRow(label, value, unit, source) {
      var dt = document.createElement('dt');
      dt.textContent = label;
      if (source) dt.title = source;
      var dd = document.createElement('dd');
      if (value === null || value === undefined) {
        dd.className = 'is-unknown';
        dd.textContent = '暂无可靠数据';
      } else {
        dd.textContent = value;
        if (unit) {
          var s = document.createElement('span');
          s.className = 'unit';
          s.textContent = unit;
          dd.appendChild(s);
        }
      }
      if (source) dd.title = source;
      return [dt, dd];
    }

    ui.showPanel = function (body) {
      var panel = $('panel');
      var stats = $('panelStats');
      stats.innerHTML = '';
      $('panelKicker').textContent = '编号 ' + body.key + ' / 9 · ' + body.nameEn.toUpperCase();
      $('panelName').textContent = body.nameZh;
      $('panelType').textContent = body.typeZh + ' · ' + body.nameEn;

      var s = body.sources || {};
      var rows = [];

      if (body.typeId === 0) {
        rows.push(
          statRow('直径', fmt(body.diameterKm), 'km', s.radiusKm),
          statRow('质量', fmt(body.massE24), '×10²⁴ kg', s.massE24),
          statRow('表面重力', fmt(body.gravity, 1), 'm/s²', s.gravity),
          statRow('自转周期', fmt(body.rotationHours, 2), 'h', s.rotationHours),
          statRow('有效温度', fmt(body.effectiveTempK), 'K', s.effectiveTempK),
          statRow('光球温度', fmt(body.photosphereTopK) + ' – ' + fmt(body.photosphereBottomK), 'K', 'NASA Sun Fact Sheet'),
          statRow('轴倾角', fmt(body.obliquityDeg, 2), '°', s.obliquityDeg),
          statRow('相对邻近恒星', '19.4', 'km/s', 'NASA Sun Fact Sheet'),
          statRow('相对银心', '≈220', 'km/s', 'Wikipedia: Milky Way'),
          statRow('相对 CMB', '369.82 ± 0.11', 'km/s', 'Planck 2018')
        );
        $('compareFill').style.width = '100%';
        $('compareValue').textContent = '109.2 × 地球直径';
      } else {
        var rot = fmt(body.rotationHours, 2);
        if (body.rotationHoursRaw < 0) rot = '−' + rot;
        rows.push(
          statRow('直径', fmt(body.diameterKm), 'km', s.diameterKm),
          statRow('质量', fmt(body.massE24, body.massE24 < 10 ? 3 : 0), '×10²⁴ kg', s.massE24),
          statRow('表面重力', fmt(body.gravity, 1), 'm/s²', s.gravity),
          statRow('自转周期', rot, 'h' + (body.retrograde ? '（逆行）' : ''), s.rotationHours),
          statRow('公转周期', fmt(body.orbitalPeriodDays), 'd', s.orbitalPeriodDays),
          statRow('平均距日', fmt(body.meanDistMkm, 1), '×10⁶ km', s.meanDistMkm),
          statRow('平均温度', fmt(body.meanTempC), '°C', s.meanTempC),
          statRow('轴倾角', fmt(body.obliquityDeg, 1), '°', s.obliquityDeg),
          statRow('卫星数', fmt(body.moons), '（截至 2025 年 3 月）', s.moons)
        );
        var ratio = body.diameterKm / 12756;
        var maxRatio = Math.max(11.21, ratio);
        $('compareFill').style.width = Math.min(100, (ratio / maxRatio) * 100).toFixed(1) + '%';
        $('compareValue').textContent =
          (ratio >= 1 ? ratio.toFixed(2) : ratio.toFixed(3)) + ' × 地球直径' + (body.id === 'earth' ? '（基准）' : '');
      }

      rows.forEach(function (pair) {
        stats.appendChild(pair[0]);
        stats.appendChild(pair[1]);
      });

      $('panelNote').textContent = body.note || '';
      panel.removeAttribute('hidden');
      void panel.offsetWidth;
      panel.classList.add('is-open');
    };

    ui.hidePanel = function () {
      var panel = $('panel');
      panel.classList.remove('is-open');
      window.setTimeout(function () {
        if (!panel.classList.contains('is-open')) panel.setAttribute('hidden', '');
      }, 420);
    };

    ui.openHelp = function () {
      lastFocus = document.activeElement;
      help.removeAttribute('hidden');
      document.body.classList.add('is-locked');
      helpClose.focus();
    };

    ui.closeHelp = function () {
      help.setAttribute('hidden', '');
      document.body.classList.remove('is-locked');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      lastFocus = null;
    };

    ui.helpOpen = function () { return !help.hasAttribute('hidden'); };

    ui.setLoader = function (text) {
      var l = $('loaderLine');
      if (l) l.textContent = text;
    };

    ui.hideLoader = function () {
      var l = $('loader');
      l.classList.add('is-done');
      window.setTimeout(function () { l.style.display = 'none'; }, 700);
    };

    ui.showFallback = function (msg) { /* 由 app 直接处理 */ };

    ui.setSrLine = function (text) { $('srList').textContent = text; };
    ui.dateInput = dateInput;

    return ui;
  }

  window.HELIOS_UI = { createUI: createUI, SCALES: SCALES, QUALITY: QUALITY };
})();
