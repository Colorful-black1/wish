/* ==========================================================================
   ui.timeline.js — 站 5 的可播放写入时间线（时间值是模型，不是实测）
   ========================================================================== */
(function (root) {
  'use strict';

  var UI = root.MILVUS.UI;

  function create(spec) {
    var labels = spec.labels;
    var phases = spec.phases;
    var total = spec.total;
    var time = Math.max(0, Math.min(total, spec.time || 0));
    var playing = false;
    var raf = 0;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var playBtn = UI.el('button', { type: 'button', class: 'btn btn--ghost btn--play' }, [
      UI.el('span', { class: 'btn__glyph', text: '▶' }),
      UI.el('span', { class: 'btn__text', text: labels.play })
    ]);
    var readout = UI.el('output', { class: 'tl__readout' });
    var fill = UI.el('div', { class: 'tl__fill' });
    var marker = UI.el('div', { class: 'tl__marker' }, UI.el('span', { text: 'BATCH' }));
    var track = UI.el('div', { class: 'tl__track' }, [fill, marker]);
    var ticks = UI.el('div', { class: 'tl__ticks' });
    var marks = UI.el('div', { class: 'tl__marks' });
    var list = UI.el('ol', { class: 'tl__list' });

    var phaseEls = phases.map(function (p, i) {
      var el = UI.el('div', {
        class: 'tl__mark tl__mark--' + (i % 2 ? 'down' : 'up'),
        dataset: { phase: p.id }
      }, [
        UI.el('span', { class: 'tl__dot' }),
        UI.el('span', { class: 'tl__label' }, [
          UI.el('b', { text: labels.phases[i] }),
          UI.el('i', { text: root.MILVUS.UI.ms(p.t) })
        ])
      ]);
      marks.appendChild(el);
      return el;
    });

    phases.forEach(function (p, i) {
      list.appendChild(UI.el('li', { class: 'tl__item', dataset: { phase: p.id } }, [
        UI.el('span', { class: 'tl__idx', text: String(i + 1).padStart(2, '0') }),
        UI.el('span', { class: 'tl__name', text: labels.phases[i] }),
        UI.el('span', {
          class: 'tl__time',
          text: root.MILVUS.UI.ms(p.t) + root.MILVUS.data.milvus.COPY.ui.modelMark
        })
      ]));
    });

    for (var i = 0; i <= 4; i++) {
      ticks.appendChild(UI.el('span', { text: root.MILVUS.UI.ms((total * i) / 4) }));
    }

    var rootEl = UI.el('div', { class: 'tl' }, [
      UI.el('div', { class: 'tl__head' }, [
        UI.el('div', null, [
          UI.el('b', { class: 'tl__title', text: labels.title }),
          UI.el('p', { class: 'tl__sub', text: labels.axis })
        ]),
        UI.el('div', { class: 'tl__live' }, [readout, playBtn])
      ]),
      UI.el('div', { class: 'tl__scale' }, [track, marks, ticks]),
      list
    ]);

    function render() {
      var ratio = total ? time / total : 0;
      fill.style.width = (ratio * 100).toFixed(2) + '%';
      marker.style.left = (ratio * 100).toFixed(2) + '%';
      readout.textContent = labels.current + ' ' + UI.ms(time);
      phaseEls.forEach(function (el, idx) {
        var done = time >= phases[idx].t;
        el.classList.toggle('is-done', done);
        el.classList.toggle('is-current', false);
      });
      var current = -1;
      phases.forEach(function (p, idx) {
        if (time >= p.t) current = idx;
      });
      if (current >= 0) phaseEls[current].classList.add('is-current');
      Array.prototype.forEach.call(list.children, function (li, idx) {
        li.classList.toggle('is-done', time >= phases[idx].t);
        li.classList.toggle('is-current', idx === current);
      });
      if (spec.onFrame) spec.onFrame(time);
    }

    function setTime(t) {
      time = Math.max(0, Math.min(total, t));
      render();
    }

    function stop() {
      playing = false;
      cancelAnimationFrame(raf);
      playBtn.querySelector('.btn__glyph').textContent = '▶';
      playBtn.querySelector('.btn__text').textContent = labels.play;
      playBtn.classList.remove('is-playing');
    }

    function play() {
      if (playing) return;
      if (reduced) {
        setTime(total);
        if (spec.onFrame) spec.onFrame(time);
        return;
      }
      playing = true;
      playBtn.querySelector('.btn__glyph').textContent = '❚❚';
      playBtn.querySelector('.btn__text').textContent = root.MILVUS.data.milvus.COPY.actions.pause;
      playBtn.classList.add('is-playing');
      var start = performance.now();
      var from = time >= total ? 0 : time;
      var duration = 4200;
      function step(now) {
        if (!playing) return;
        var k = Math.min(1, (now - start) / duration);
        var t = from + (total - from) * k;
        time = t;
        render();
        if (k < 1) {
          raf = requestAnimationFrame(step);
        } else {
          stop();
          if (spec.onTime) spec.onTime(total);
        }
      }
      raf = requestAnimationFrame(step);
    }

    playBtn.addEventListener('click', function () {
      if (playing) stop();
      else play();
    });

    render();

    return {
      root: rootEl,
      setTime: setTime,
      play: play,
      stop: stop,
      isPlaying: function () { return playing; }
    };
  }

  root.MILVUS.UI.timeline = create;
})(typeof globalThis !== 'undefined' ? globalThis : this);
