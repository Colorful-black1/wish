/* ==========================================================================
   ui.js — HUD、列表、信息面板、帮助浮层、焦点管理
   只负责 DOM，不碰轨道计算；所有数字来自 data.*.js，由 app.js 传进来。
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) {
    return document.getElementById(id);
  };

  var SPEEDS = [
    { id: 'pause', label: '暂停', days: 0 },
    { id: 'day', label: '1 天/秒', days: 1 },
    { id: 'week', label: '1 周/秒', days: 7 },
    { id: 'month', label: '1 月/秒', days: 30 },
    { id: 'year', label: '1 年/秒', days: 365.25 },
  ];

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
      btn.innerHTML =
        '<span class="idx" aria-hidden="true">' + (i + 1) + '</span><span class="nm">' + b.nameZh + '</span>';
      btn.addEventListener('click', function () {
        app.focusBody(i);
      });
      btn.addEventListener('mouseenter', function () {
        app.setHover(i);
      });
      btn.addEventListener('mouseleave', function () {
        app.setHover(-1);
      });
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
        b.addEventListener('click', function () {
          onPick(it.id);
        });
        host.appendChild(b);
        btns.push(b);
      });
      return btns;
    }

    var speedBtns = buildSegmented($('speedGroup'), SPEEDS, 'pause', function (id) {
      app.setSpeed(id);
    });
    var scaleBtns = buildSegmented($('scaleGroup'), SCALES, 'orrery', function (id) {
      app.setScale(id);
    });
    var qualityBtns = buildSegmented($('qualityGroup'), QUALITY, 'standard', function (id) {
      app.setQuality(id);
    });

    function press(btns, id) {
      btns.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-id') === id ? 'true' : 'false');
      });
    }

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

    var bgToggle = $('toggleBackground');
    var cnToggle = $('toggleConstellations');
    bgToggle.addEventListener('click', function () {
      app.toggleBackground();
    });
    cnToggle.addEventListener('click', function () {
      app.toggleConstellations();
    });

    /* ---- 日期 ---- */
    var dateInput = $('dateInput');
    dateInput.addEventListener('change', function () {
      var v = dateInput.value;
      if (!v) return;
      app.setDateString(v);
    });
    dateInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') dateInput.blur();
    });

    /* ---- 返回 ---- */
    $('btnBack').addEventListener('click', function () {
      app.exitFocus();
    });
    $('panelClose').addEventListener('click', function () {
      app.exitFocus();
    });

    /* ---- 帮助浮层 ---- */
    var help = $('help');
    var helpClose = $('helpClose');
    var lastFocus = null;
    helpClose.addEventListener('click', function () {
      app.closeHelp();
    });
    help.addEventListener('click', function (e) {
      if (e.target === help) app.closeHelp();
    });

    /* ---- 对外接口 ---- */
    ui.setActive = function (i) {
      rosterButtons.forEach(function (b, k) {
        b.classList.toggle('is-active', k === i);
        b.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
    };

    ui.setHover = function (i) {
      rosterButtons.forEach(function (b, k) {
        b.classList.toggle('is-hovered', k === i);
      });
    };

    ui.focusRoster = function (i) {
      if (rosterButtons[i]) rosterButtons[i].focus();
    };

    ui.setSpeed = function (id) {
      press(speedBtns, id);
    };

    ui.setScale = function (id, note) {
      press(scaleBtns, id);
      $('scaleNote').textContent = note || '';
    };

    ui.setQuality = function (id) {
      press(qualityBtns, id);
    };

    ui.setBackground = function (on) {
      bgToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    ui.setConstellations = function (on) {
      cnToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    ui.setStarBrightness = function (v) {
      starSlider.value = String(Math.round(v * 100));
      starOut.textContent = starSlider.value;
    };

    ui.setDate = function (date) {
      var iso =
        String(date.getUTCFullYear()).padStart(4, '0') +
        '-' +
        String(date.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getUTCDate()).padStart(2, '0');
      if (dateInput.value !== iso) dateInput.value = iso;
    };

    ui.setDateNote = function (text) {
      $('jdNote').textContent = text;
    };

    ui.setReadout = function (text) {
      $('readout').textContent = text || '';
    };

    ui.setMastheadTucked = function (tucked) {
      $('masthead').classList.toggle('is-tucked', !!tucked);
    };

    ui.setHint = function (text) {
      $('hint').textContent = text;
    };

    ui.setBackVisible = function (on) {
      var b = $('btnBack');
      if (on) b.removeAttribute('hidden');
      else b.setAttribute('hidden', '');
    };

    ui.setHudVisible = function (on) {
      $('hud').classList.toggle('is-hidden', !on);
      document.body.classList.toggle('no-ui', !on);
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
          statRow('卫星数', '—', null, '太阳不绕行星运行')
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
          statRow(
            '卫星数',
            fmt(body.moons),
            '（截至 2025 年 3 月）',
            s.moons
          )
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
      // 触发过渡
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

    ui.helpOpen = function () {
      return !help.hasAttribute('hidden');
    };

    ui.setLoader = function (text) {
      var l = $('loaderLine');
      if (l) l.textContent = text;
    };

    ui.hideLoader = function () {
      var l = $('loader');
      l.classList.add('is-done');
      window.setTimeout(function () {
        l.style.display = 'none';
      }, 700);
    };

    ui.showFallback = function (msg) {
      var f = $('fallback');
      f.removeAttribute('hidden');
      if (msg) {
        var p = document.createElement('p');
        p.className = 'fallback-foot';
        p.textContent = msg;
        f.appendChild(p);
      }
      $('loader').style.display = 'none';
      document.getElementById('hud').style.display = 'none';
    };

    ui.setSrLine = function (text) {
      $('srList').textContent = text;
    };

    ui.dateInput = dateInput;

    return ui;
  }

  window.HELIOS_UI = { createUI: createUI, SPEEDS: SPEEDS, SCALES: SCALES, QUALITY: QUALITY };
})();
