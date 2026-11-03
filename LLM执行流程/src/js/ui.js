/* ============================================================================
 * ui.js — 阶段轨道、原理面板、知识库、时间轴、3D 标签、输入台
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};
  var U = LLM.util;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  LLM.createUI = function (app, scene) {
    var UI = {
      app: app,
      scene: scene,
      state: {
        stage: 1,
        mode: 'flow',
        playing: false,
        panelTab: 'stage',
        panelOpen: true,
        speed: 1,
        kbQuery: '',
        kbDetail: null,
        kbFrom: 'list'
      },
      ctx: {},
      labels: [],
      stageLabels: {},
      samplerEls: null,
      padBusy: false
    };

    var $ = function (sel) {
      return document.querySelector(sel);
    };
    var $$ = function (sel) {
      return Array.prototype.slice.call(document.querySelectorAll(sel));
    };

    var els = {
      boot: $('#boot'),
      bootText: $('#bootText'),
      stageList: $('#stageList'),
      scrub: $('#scrub'),
      scrubFill: $('#scrubFill'),
      scrubHead: $('#scrubHead'),
      scrubTicks: $('#scrubTicks'),
      scrubLabels: $('#scrubLabels'),
      nowStage: $('#nowStage'),
      nowState: $('#nowState'),
      tokCount: $('#tokCount'),
      panel: $('#panel'),
      panelBody: $('#panelBody'),
      panelOpen: $('#btnPanelOpen'),
      pad: $('#pad'),
      padBody: $('#padBody'),
      padText: $('#padText'),
      padSend: $('#padSend'),
      modeNav: $('#modes'),
      play: $('#btnPlay'),
      speedSel: $('#speedSel'),
      toast: $('#toast'),
      about: $('#about'),
      labels: $('#labels')
    };

    function toast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add('is-on');
      clearTimeout(UI._toastTimer);
      UI._toastTimer = setTimeout(function () {
        els.toast.classList.remove('is-on');
      }, 2400);
    }

    /* ------------------------------------------------------------ 轨道与时间轴 */

    els.stageList.innerHTML = LLM.PIPELINE.map(function (stage) {
      return (
        '<li><button type="button" class="rail__item" data-stage="' +
        stage.no +
        '" title="' +
        esc(stage.no + ' · ' + stage.title) +
        '" aria-label="第 ' +
        stage.no +
        ' 阶段：' +
        esc(stage.title) +
        '">' +
        '<span class="rail__dot">' +
        String(stage.no).padStart(2, '0') +
        '</span>' +
        '<span class="rail__name">' +
        esc(stage.title) +
        '</span></button></li>'
      );
    }).join('');

    els.scrubTicks.innerHTML = LLM.PIPELINE.map(function (stage, i) {
      var pct = (i / (LLM.PIPELINE.length - 1)) * 100;
      return '<i style="left:' + pct.toFixed(2) + '%" data-tick="' + stage.no + '"></i>';
    }).join('');

    els.scrubLabels.innerHTML = [1, 4, 7, 10, 13]
      .map(function (n) {
        var pct = ((n - 1) / LLM.PIPELINE.length) * 100;
        return '<span data-lab="' + n + '" style="position:absolute;left:' + pct.toFixed(2) + '%">' + String(n).padStart(2, '0') + '</span>';
      })
      .join('');

    /* ------------------------------------------------------------ 3D 标签 */

    function buildLabels() {
      if (!scene || !scene.ok) return;
      app.pipeline.stations.forEach(function (st) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'lbl3d';
        el.innerHTML =
          '<span class="lbl3d__no">' +
          String(st.no).padStart(2, '0') +
          '</span><span class="lbl3d__tx"><b>' +
          esc(st.stage.title) +
          '</b><i>' +
          esc(st.stage.en) +
          '</i></span>';
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          app.selectStage(st.no, { focus: true, user: true });
        });
        els.labels.appendChild(el);
        scene.registerLabel(el, st.anchor, { offset: [0, 0.2, 0], stage: st.no });
        UI.stageLabels[st.no] = el;
      });

      // Transformer 塔顶标签
      if (app.transformer) {
        var tEl = document.createElement('button');
        tEl.type = 'button';
        tEl.className = 'lbl3d lbl3d--wide';
        tEl.innerHTML =
          '<span class="lbl3d__no">TR</span><span class="lbl3d__tx"><b>Transformer Block</b><i>点击拆解 · 8 层结构</i></span>';
        tEl.addEventListener('click', function () {
          app.focusStage(5, { explode: true });
        });
        els.labels.appendChild(tEl);
        scene.registerLabel(tEl, app.transformer.anchor, { offset: [0, 0, 0], stage: 5 });
        UI.towerLabel = tEl;
        app.transformer.buildLabels(function (cfg) {
          var lab = document.createElement('button');
          lab.type = 'button';
          lab.className = 'lbl3d lbl3d--wide';
          lab.dataset.layer = cfg.key;
          lab.innerHTML =
            '<span class="lbl3d__no">' +
            cfg.cn.slice(0, 1) +
            '</span><span class="lbl3d__tx"><b>' +
            esc(cfg.cn) +
            '</b><i>' +
            esc(cfg.en) +
            '</i></span>';
          els.labels.appendChild(lab);
          return lab;
        });
        app.transformer.setLabelsVisible(false);
      }
    }

    UI.setActiveLabel = function (no) {
      Object.keys(UI.stageLabels).forEach(function (k) {
        UI.stageLabels[k].classList.toggle('is-active', Number(k) === no);
      });
    };

    UI.setFocusLabels = function (focused, stageNo) {
      Object.keys(UI.stageLabels).forEach(function (k) {
        UI.stageLabels[k].style.display = focused ? 'none' : '';
      });
      if (UI.towerLabel) {
        UI.towerLabel.style.display = focused && stageNo !== 5 ? 'none' : '';
      }
      if (app.transformer) {
        var layersOn = !focused || (stageNo === 5 && app.transformer.exploded);
        app.transformer.labels.forEach(function (L) {
          L.el.style.display = layersOn ? '' : 'none';
        });
      }
    };

    UI.setLabelsForMode = function (mode) {
      Object.keys(UI.stageLabels).forEach(function (k) {
        UI.stageLabels[k].style.display = mode === 'infra' ? 'none' : '';
      });
      if (UI.towerLabel) UI.towerLabel.style.display = mode === 'infra' ? 'none' : '';
      if (app.transformer) {
        var show = mode === 'flow' && app.transformer.exploded;
        app.transformer.setLabelsVisible(show);
      }
    };

    /* ------------------------------------------------------------ 面板渲染 */

    function stageReadout(stage) {
      var tokens = UI.ctx.tokens || [];
      var stats = LLM.Mech.stats(tokens);
      var ms = stage.duration;
      var cells;
      if (stage.no === 1) {
        cells = [
          ['TOKENS', stats.tokens, 'pre-tokenized'],
          ['CHARS', stats.chars, 'UTF-8'],
          ['CTX', '8K', 'tokens']
        ];
      } else if (stage.no === 2) {
        cells = [
          ['TOKENS', stats.tokens, 'simulated'],
          ['CHARS/TOK', stats.avg.toFixed(2), 'ratio'],
          ['VOCAB', '50K', 'demo']
        ];
      } else if (stage.no === 3) {
        cells = [['DIM', '16', 'demo'], ['TOKENS', stats.tokens, ''], ['DTYPE', 'FP16', 'demo']];
      } else if (stage.no === 4) {
        cells = [['POS', '0…' + Math.max(0, stats.tokens - 1), ''], ['SCHEME', 'sin / RoPE', 'varies'], ['MODE', 'add / rot', 'varies']];
      } else if (stage.no === 5) {
        cells = [['PLATES', '8', 'block view'], ['HEADS', '4', 'demo'], ['D_MODEL', '32', 'demo']];
      } else if (stage.no === 6) {
        cells = [['HEAD DIM', '8', 'demo'], ['CAUSAL', 'ON', 'mask'], ['WEIGHTS', 'n²', 'attention']];
      } else if (stage.no === 7) {
        cells = [['HEADS', '4', 'demo'], ['HEAD DIM', '8', 'each'], ['PROJ', 'W_O', 'merge']];
      } else if (stage.no === 8) {
        cells = [['BLOCKS', '8', 'demo'], ['PARAMS', '1.2B', 'illustrative'], ['STATE', 'd=32', 'demo']];
      } else if (stage.no === 9) {
        cells = [['VOCAB', '50K', 'demo'], ['CANDIDATES', '10', 'shown'], ['LOGITS', 'raw', 'not p']];
      } else if (stage.no === 10) {
        cells = [['TEMP', (UI.ctx.sampleOpts && UI.ctx.sampleOpts.temperature) || '0.9', ''], ['TOP-K', (UI.ctx.sampleOpts && UI.ctx.sampleOpts.topK) || '5', ''], ['TOP-P', (UI.ctx.sampleOpts && UI.ctx.sampleOpts.topP) || '0.9', '']];
      } else if (stage.no === 11) {
        cells = [['DECODED', UI.ctx.decodedTokens || 0, 'tokens'], ['KV CACHE', 'ON', 'layers×heads'], ['PHASE', 'decode', 'step']];
      } else if (stage.no === 12) {
        cells = [['IDS', stats.tokens, '→ text'], ['STREAM', 'SSE', 'app layer'], ['EOS', 'hidden', 'control']];
      } else {
        cells = [['STOP', 'EOS', 'token'], ['LATENCY', '—', 'simulated'], ['STREAM', 'SSE', 'app layer']];
      }
      return (
        '<dl class="readout">' +
        cells
          .map(function (c) {
            return '<div><dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + ' <small>' + esc(c[2]) + '</small></dd></div>';
          })
          .join('') +
        '</dl>'
      );
    }

    function attentionBlock() {
      var att = UI.ctx.attention;
      if (!att) return '';
      var active = UI.ctx.activeToken || 0;
      var n = att.tokens.length;
      var cells = [];
      for (var i = 0; i < n; i++) {
        for (var j = 0; j < n; j++) {
          var w = att.weights[i][j];
          var masked = j > i || !att.tokens[j];
          if (masked) {
            cells.push('<i title="causal mask" style="background:rgba(90,115,135,.12);color:#476274">·</i>');
          } else {
            var alpha = 0.06 + w * 0.85;
            var color = w > 0.45 ? '#021016' : '#a9e7f5';
            cells.push(
              '<i title="' +
                esc(att.tokens[i].text + ' → ' + att.tokens[j].text + ' ' + (w * 100).toFixed(1) + '%') +
                '" style="background:rgba(79,227,255,' +
                alpha.toFixed(3) +
                ');color:' +
                color +
                '">' +
                (w * 100 >= 9 ? Math.round(w * 100) : '')
                + '</i>'
            );
          }
        }
      }
      var rows = [];
      var row = att.weights[active] || [];
      for (var r = 0; r < n; r++) {
        if (r > active) continue;
        rows.push({ to: r, w: row[r] });
      }
      rows.sort(function (a, b) {
        return b.w - a.w;
      });
      var top = rows.slice(0, 3).map(function (r) {
        return esc(att.tokens[r.to].text) + ' ' + (r.w * 100).toFixed(1) + '%';
      });

      return (
        '<div id="attnBlock">' +
        '<div class="heat" style="grid-template-columns:30px repeat(' +
        n +
        ',minmax(0,1fr))">' +
        '<span></span>' +
        att.tokens
          .map(function (t) {
            return '<span>' + esc(t.text) + '</span>';
          })
          .join('') +
        cells.join('') +
        '</div>' +
        '<div class="heat-row">查询 <b>' +
        esc(att.tokens[active].text) +
        '</b> 最关注：' +
        top.join(' · ') +
        '</div>' +
        '<div class="chips" style="margin-top:10px">' +
        att.tokens
          .map(function (t, i) {
            return (
              '<button type="button" class="chip" data-attn="' +
              i +
              '" style="' +
              (i === active ? 'color:#04121a;background:#4fe3ff;border-color:#4fe3ff' : '') +
              '">' +
              esc(t.text) +
              '</button>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="heat-row">点击 token 切换查询行；灰色表示被因果掩码遮住的未来位置。</div>' +
        '</div>'
      );
    }

    function logitsBlock() {
      var dist = UI.ctx.distribution || LLM.Mech.distribution(LLM.Mech.candidateList(), UI.ctx.sampleOpts || {});
      var max = Math.max.apply(
        null,
        dist.probs.map(function (p) {
          return p;
        })
      );
      return (
        '<div class="sampler">' +
        LLM.DEMO.vocab
          .map(function (c, i) {
            var w = max ? (dist.probs[i] / max) * 100 : 0;
            return (
              '<div class="sampler__row' +
              (i === dist.pick ? ' is-pick' : '') +
              '"><span>' +
              esc(c.token) +
              '</span><span class="sampler__bar"><i style="width:' +
              w.toFixed(1) +
              '%;background:linear-gradient(90deg,rgba(79,227,255,.45),#4fe3ff)"></i></span><span>' +
              c.logit.toFixed(1) +
              '</span></div>'
            );
          })
          .join('') +
        '</div><div class="heat-row">柱长按 softmax 概率归一化展示；右侧为原始 logits（不是概率）。</div>'
      );
    }

    function samplerBlock() {
      var dist = UI.ctx.distribution;
      if (!dist) return '';
      return (
        '<div id="samplerList" class="sampler">' +
        LLM.DEMO.vocab
          .map(function (c, i) {
            var p = dist.final[i];
            var base = dist.probs[i];
            return (
              '<div class="sampler__row' +
              (i === dist.pick ? ' is-pick' : '') +
              '" data-i="' +
              i +
              '"><span>' +
              esc(c.token) +
              '</span><span class="sampler__bar"><i style="width:' +
              (p * 100).toFixed(1) +
              '%;opacity:' +
              (dist.kept[i] ? 1 : 0.18) +
              '"></i></span><span>' +
              (dist.kept[i] ? (p * 100).toFixed(1) : (base * 100).toFixed(1)) +
              '%</span></div>'
            );
          })
          .join('') +
        '</div>' +
        '<div class="heat-row">已按 T / Top-K / Top-P 截断；暗色为被过滤候选。当前选中 <b>' +
        esc(LLM.DEMO.vocab[dist.pick].token) +
        '</b>。</div>'
      );
    }

    function samplerControls() {
      var o = UI.ctx.sampleOpts || { temperature: 0.9, topK: 5, topP: 0.9 };
      return (
        '<div class="ctrl">' +
        '<div class="ctrl__line"><span>TEMPERATURE</span><b id="tempOut">' +
        Number(o.temperature).toFixed(2) +
        '</b></div>' +
        '<input type="range" id="tempRange" min="0.1" max="1.8" step="0.05" value="' +
        o.temperature +
        '" aria-label="Temperature" />' +
        '<div class="ctrl__line"><span>TOP-K</span><b id="topkOut">' +
        o.topK +
        '</b></div>' +
        '<input type="range" id="topkRange" min="1" max="10" step="1" value="' +
        o.topK +
        '" aria-label="Top-K" />' +
        '<div class="ctrl__line"><span>TOP-P</span><b id="toppOut">' +
        Number(o.topP).toFixed(2) +
        '</b></div>' +
        '<input type="range" id="toppRange" min="0.2" max="1" step="0.05" value="' +
        o.topP +
        '" aria-label="Top-P" />' +
        '<div class="ctrl__row"><span>确定性 ←</span><span>→ 随机性</span></div>' +
        '</div>'
      );
    }

    function tokenBlock() {
      var tokens = UI.ctx.tokens || [];
      if (!tokens.length) return '<div class="heat-row">暂无 token。</div>';
      return (
        '<div class="chips">' +
        tokens
          .slice(0, 16)
          .map(function (t) {
            return '<span class="chip" title="模拟 ID ' + t.id + '">' + esc(t.text) + ' <b style="color:#5b7285;font-weight:400">' + t.id + '</b></span>';
          })
          .join('') +
        (tokens.length > 16 ? '<span class="chip">+' + (tokens.length - 16) + '</span>' : '') +
        '</div><div class="heat-row">近似分词：中文按常见词合并，英文长词按 5 字符切分；ID 为演示值。</div>'
      );
    }

    function answerBlock() {
      var text = UI.ctx.answer || LLM.DEMO.answer;
      return (
        '<div class="formula" style="white-space:pre-wrap;font-family:var(--sans);font-size:12.5px;line-height:1.85;color:#dffcff">' +
        esc(text) +
        '</div><div class="heat-row">' +
        esc(UI.ctx.custom ? LLM.DEMO.customDisclaimer : LLM.DEMO.disclaimer) +
        '</div>'
      );
    }

    function dynamicExtra(stage) {
      if (stage.no === 2) return tokenBlock();
      if (stage.no === 6) return attentionBlock();
      if (stage.no === 9) return logitsBlock();
      if (stage.no === 10) return samplerBlock() + samplerControls();
      if (stage.no === 12 || stage.no === 13) return answerBlock();
      return '';
    }

    function layerList() {
      return (
        '<div class="chips">' +
        LLM.LAYERS.map(function (layer) {
          return '<button type="button" class="chip" data-layer="' + layer.key + '">' + esc(layer.cn) + '</button>';
        }).join('') +
        '</div>'
      );
    }

    function renderStage() {
      var stage = LLM.getStage(UI.state.stage);
      UI.state.panelTab = 'stage';
      UI.setPanelTab('stage');
      els.panel.classList.remove('is-infra');
      var concepts = stage.concepts
        .map(function (id) {
          var c = LLM.KNOWLEDGE_MAP[id];
          return c ? '<button type="button" class="chip" data-concept="' + id + '">' + esc(c.cn) + '</button>' : '';
        })
        .join('');

      var extra = '';
      if (stage.no === 8) {
        extra +=
          '<div class="sp-sec"><h3>逐层通过</h3><div class="heat-row">8 个 Block 依次更新隐藏状态；点击下方按钮在 3D 中播放逐层脉冲。</div></div>';
      }
      if (stage.no === 11) {
        extra +=
          '<div class="sp-sec"><h3>生成状态</h3><div class="heat-row">Prefill 已完成 · Decode 进行中 · KV Cache 随序列增长。</div></div>';
      }

      var extraTop = '';
      if (stage.no === 5) {
        extraTop =
          '<div class="sp-sec"><h3>拆解塔</h3>' +
          layerList() +
          '<div class="chips" style="margin-top:8px"><button type="button" class="chip" data-gostage="4">位置编码</button><button type="button" class="chip" data-gostage="9">LM Head</button></div>' +
          '<div class="sp-actions"><button type="button" class="act act--solid" data-act2="explode">展开 / 合拢 8 层结构</button></div></div>';
      }
      if (stage.no === 2) {
        extraTop =
          '<div class="sp-sec"><h3>本句的 token</h3><div id="spDyn">' + dynamicExtra(stage) + '</div></div>';
      }
      if (stage.no === 6) {
        extraTop =
          '<div class="sp-sec"><h3>注意力矩阵 · 本地计算</h3><div id="spDyn">' +
          dynamicExtra(stage) +
          '</div><div class="sp-actions"><button type="button" class="act" data-act2="focus">聚焦注意力网络</button></div></div>';
      }
      if (stage.no === 9) {
        extraTop =
          '<div class="sp-sec"><h3>候选 logits → 概率</h3><div id="spDyn">' + dynamicExtra(stage) + '</div></div>';
      }
      if (stage.no === 10) {
        extraTop =
          '<div class="sp-sec"><h3>采样沙盒</h3><div id="spDyn">' +
          dynamicExtra(stage) +
          '</div><div class="sp-actions"><button type="button" class="act act--solid" data-act2="resample">再抽一次</button><button type="button" class="act" data-act2="focus">聚焦采样装置</button></div></div>';
      }
      if (stage.no === 12 || stage.no === 13) {
        extraTop =
          '<div class="sp-sec"><h3>返回的文本</h3><div id="spDyn">' + dynamicExtra(stage) + '</div></div>';
      }

      els.panelBody.innerHTML =
        '<div class="sp-head">' +        '<div class="sp-head__line"><span>STAGE ' +
        String(stage.no).padStart(2, '0') +
        ' / 13</span><em>' +
        esc(stage.en.toUpperCase()) +
        '</em></div>' +
        '<h2>' +
        esc(stage.title) +
        ' <span>' +
        esc(stage.en) +
        '</span></h2>' +
        '<p class="sp-tagline">' +
        esc(stage.tagline) +
        '</p>' +
        '</div>' +
        '<p class="sp-sum">' +
        esc(stage.summary) +
        '</p>' +
        stageReadout(stage) +
        extraTop +
        '<div class="sp-sec"><h3>它在做什么</h3><ol class="ops">' +
        stage.ops
          .map(function (op, i) {
            return '<li><b>' + String(i + 1).padStart(2, '0') + '</b><span>' + esc(op) + '</span></li>';
          })
          .join('') +
        '</ol></div>' +
        '<div class="sp-sec"><h3>关键公式</h3><div class="formula">' +
        esc(stage.formula) +
        '</div></div>' +
        '<div class="sp-sec"><h3>生活类比</h3><div class="analogy">' +
        esc(stage.analogy) +
        '</div></div>' +
        '<div class="sp-note"><b>口径</b><span>' +
        esc(stage.note) +
        '</span></div>' +
        '<div class="sp-sec"><h3>相关知识点</h3><div class="chips">' +
        concepts +
        '</div></div>' +
        extra;

      if (stage.no === 11) {
        var dd = els.panelBody.querySelector('.readout dd');
        if (dd) {
          dd.innerHTML = '<span id="decodedOut">' + String(UI.ctx.decodedTokens || 0) + '</span> <small>tokens</small>';
        }
      }

      els.panelBody.scrollTop = 0;
    }

    function renderKnowledgeList() {
      var q = UI.state.kbQuery.trim().toLowerCase();
      var groups = {};
      LLM.KNOWLEDGE.forEach(function (item) {
        if (q && item.cn.toLowerCase().indexOf(q) < 0 && item.en.toLowerCase().indexOf(q) < 0 && item.def.toLowerCase().indexOf(q) < 0) return;
        (groups[item.group] = groups[item.group] || []).push(item);
      });

      var html =
        '<div class="kb-search"><input type="search" id="kbSearch" placeholder="搜索概念、英文名或定义…" value="' +
        esc(UI.state.kbQuery) +
        '" aria-label="搜索知识库" /></div>';

      var total = 0;
      Object.keys(groups).forEach(function (g) {
        total += groups[g].length;
      });
      if (!total) {
        html += '<div class="kb-empty">没有匹配「' + esc(UI.state.kbQuery) + '」的条目。</div>';
      }
      LLM.KNOWLEDGE_GROUPS.forEach(function (group) {
        var items = groups[group];
        if (!items || !items.length) return;
        html +=
          '<div class="kb-group"><h3><span>' +
          esc(group) +
          '</span><b>' +
          items.length +
          '</b></h3>' +
          items
            .map(function (item) {
              return (
                '<button type="button" class="kb-item" data-kb="' +
                item.id +
                '"><span class="kb-item__cn">' +
                esc(item.cn) +
                '</span><span class="kb-item__en">' +
                esc(item.en) +
                '</span></button>'
              );
            })
            .join('') +
          '</div>';
      });

      els.panelBody.innerHTML = html;
      var inp = $('#kbSearch');
      if (inp) {
        inp.addEventListener('input', function () {
          UI.state.kbQuery = inp.value;
          var pos = inp.selectionStart;
          renderKnowledgeList();
          var next = $('#kbSearch');
          if (next) {
            next.focus();
            try {
              next.setSelectionRange(pos, pos);
            } catch (e) {
              /* ignore */
            }
          }
        });
      }
    }

    function renderConcept(id) {
      var c = LLM.KNOWLEDGE_MAP[id];
      if (!c) return;
      UI.state.kbDetail = id;
      UI.setPanelTab('concepts');
      var related = c.related
        .map(function (rid) {
          var rc = LLM.KNOWLEDGE_MAP[rid];
          return rc ? '<button type="button" class="chip" data-concept="' + rid + '">' + esc(rc.cn) + '</button>' : '';
        })
        .join('');
      var jump =
        c.stage > 0
          ? '<button type="button" class="act" data-gostage="' + c.stage + '">跳到第 ' + c.stage + ' 阶段</button>'
          : '<button type="button" class="act" data-infra="' + c.id + '">去基础设施层</button>';
      els.panel.classList.toggle('is-infra', c.group === '推理基础设施');
      els.panelBody.innerHTML =
        '<button type="button" class="kc-back" data-kbback="1">← 返回' +
        (UI.state.kbFrom === 'stage' ? '阶段讲解' : '知识库列表') +
        '</button>' +
        '<div class="kc-head"><h2>' +
        esc(c.cn) +
        '</h2><p>' +
        esc(c.en) +
        ' · ' +
        esc(c.group) +
        '</p></div>' +
        '<p class="kc-def">' +
        esc(c.def) +
        '</p>' +
        '<div class="kc-sec"><h3>工作原理</h3><p>' +
        esc(c.how) +
        '</p></div>' +
        '<div class="kc-sec"><h3>输入 / 输出</h3><div class="kc-io">' +
        c.io
          .map(function (x) {
            return '<span>' + esc(x) + '</span>';
          })
          .join('') +
        '</div></div>' +
        '<div class="kc-sec"><h3>公式 / 关系</h3><div class="formula">' +
        esc(c.formula) +
        '</div></div>' +
        '<div class="kc-sec"><h3>生活化类比</h3><div class="analogy">' +
        esc(c.analogy) +
        '</div></div>' +
        '<div class="kc-sec"><h3>相关概念</h3><div class="chips">' +
        related +
        '</div></div>' +
        '<div class="sp-actions">' +
        jump +
        '<button type="button" class="act" data-kbback="1">返回</button></div>';
      els.panelBody.scrollTop = 0;
    }

    UI.showConcept = function (id, from) {
      UI.state.kbFrom = from || UI.state.kbFrom || 'list';
      UI.state.panelTab = 'concepts';
      UI.openPanel();
      renderConcept(id);
    };

    UI.setPanelTab = function (tab) {
      UI.state.panelTab = tab;
      $$('[data-ptab]').forEach(function (b) {
        var on = b.dataset.ptab === tab;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    };

    UI.openPanel = function () {
      UI.state.panelOpen = true;
      els.panel.classList.remove('is-closed');
      els.panelOpen.hidden = true;
    };

    UI.closePanel = function () {
      UI.state.panelOpen = false;
      els.panel.classList.add('is-closed');
      els.panelOpen.hidden = false;
    };

    UI.renderKnowledge = function () {
      UI.setPanelTab('concepts');
      UI.state.kbFrom = 'list';
      UI.state.kbDetail = null;
      UI.openPanel();
      renderKnowledgeList();
    };

    /* ------------------------------------------------------------ 动态块刷新 */

    UI.refreshDynamic = function () {
      var stage = LLM.getStage(UI.state.stage);
      var host = document.getElementById('spDyn');
      if (!host) return;
      if (stage.no === 2) host.innerHTML = tokenBlock();
      else if (stage.no === 6) host.innerHTML = attentionBlock();
      else if (stage.no === 9) host.innerHTML = logitsBlock();
      else if (stage.no === 10) host.innerHTML = samplerBlock();
      else if (stage.no === 12 || stage.no === 13) host.innerHTML = answerBlock();
    };

    UI.updateSampler = function (dist) {
      UI.ctx.distribution = dist;
      var list = document.getElementById('samplerList');
      if (!list) return;
      var rows = list.querySelectorAll('.sampler__row');
      LLM.DEMO.vocab.forEach(function (c, i) {
        var row = rows[i];
        if (!row) return;
        var p = dist.final[i];
        row.classList.toggle('is-pick', i === dist.pick);
        var fill = row.querySelector('.sampler__bar i');
        var val = row.querySelectorAll('span')[2];
        if (fill) {
          fill.style.width = (p * 100).toFixed(1) + '%';
          fill.style.opacity = dist.kept[i] ? '1' : '0.18';
        }
        if (val) val.textContent = (dist.kept[i] ? p * 100 : dist.probs[i] * 100).toFixed(1) + '%';
      });
      var out = document.getElementById('tempOut');
      if (out) out.textContent = Number(dist.temperature).toFixed(2);
      var topk = document.getElementById('topkOut');
      if (topk) topk.textContent = String(dist.topK);
      var topp = document.getElementById('toppOut');
      if (topp) topp.textContent = Number(dist.topP).toFixed(2);
      var tr = document.getElementById('tempRange');
      if (tr && document.activeElement !== tr) tr.value = String(dist.temperature);
      var kr = document.getElementById('topkRange');
      if (kr && document.activeElement !== kr) kr.value = String(dist.topK);
      var pr = document.getElementById('toppRange');
      if (pr && document.activeElement !== pr) pr.value = String(dist.topP);

      // 阶段页顶部的读数同步（仅第 10 站）
      if (UI.state.stage === 10) {
        var dds = els.panelBody.querySelectorAll('.readout dd');
        if (dds.length >= 3) {
          dds[0].childNodes[0].nodeValue = Number(dist.temperature).toFixed(2) + ' ';
          dds[1].childNodes[0].nodeValue = String(dist.topK) + ' ';
          dds[2].childNodes[0].nodeValue = Number(dist.topP).toFixed(2) + ' ';
        }
      }
    };

    UI.updateAttention = function (att, active) {
      UI.ctx.attention = att;
      UI.ctx.activeToken = active;
      var host = document.getElementById('attnBlock');
      if (host) host.outerHTML = attentionBlock();
    };

    /* ------------------------------------------------------------ 状态同步 */

    UI.setStages = function (stations) {
      // 站台已由 app 建立；这里只更新标签需要的引用
      UI.stations = stations;
    };

    UI.setActiveStage = function (no, opts) {
      opts = opts || {};
      UI.state.stage = no;
      var stage = LLM.getStage(no);
      $$('.rail__item').forEach(function (b) {
        var n = Number(b.dataset.stage);
        b.classList.toggle('is-on', n === no);
        b.setAttribute('aria-current', n === no ? 'step' : 'false');
      });
      $$('.scrub__labels span').forEach(function (s) {
        s.classList.toggle('is-on', Number(s.dataset.lab) === no);
      });
      $$('.scrub__ticks i').forEach(function (t) {
        t.classList.toggle('is-done', Number(t.dataset.tick) <= no);
      });
      els.nowStage.textContent = String(no).padStart(2, '0') + ' · ' + stage.title;
      els.scrub.setAttribute('aria-valuenow', String(no));
      UI.setActiveLabel(no);
      if (UI.state.panelTab === 'stage' || !opts.keepPanel) renderStage();
      if (UI.ctx.tokens) els.tokCount.textContent = String(UI.ctx.tokens.length);
    };

    UI.setProgress = function (fraction) {
      var p = U.clamp(fraction, 0, 1);
      els.scrubFill.style.width = (p * 100).toFixed(2) + '%';
      els.scrubHead.style.left = (p * 100).toFixed(2) + '%';
      var text = UI.state.mode === 'infra'
        ? 'MODE · INFRA'
        : UI.state.playing
          ? 'RUNNING · ' + Math.round(p * 100) + '%'
          : p < 0.002 && UI.state.stage === 1
            ? 'READY · 0%'
            : 'PAUSED · ' + Math.round(p * 100) + '%';
      if (UI._lastStateText !== text) {
        els.nowState.textContent = text;
        UI._lastStateText = text;
      }
    };

    UI.setPlaying = function (playing) {
      UI.state.playing = playing;
      els.play.classList.toggle('is-paused', !playing);
      els.play.setAttribute('aria-label', playing ? '暂停' : '开始演示');
      els.play.innerHTML = playing
        ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3.5" y="2.6" width="3.2" height="10.8" rx="1"/><rect x="9.3" y="2.6" width="3.2" height="10.8" rx="1"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 2.6 13 8l-9 5.4z"/></svg>';
      var text = playing ? 'RUNNING' : 'READY';
      if (UI._lastStateText !== text) {
        els.nowState.textContent = text;
        UI._lastStateText = text;
      }
    };

    UI.setTokenCount = function (n) {
      els.tokCount.textContent = String(n);
    };

    UI.setMode = function (mode) {
      UI.state.mode = mode;
      $$('#modes button').forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.mode === mode);
      });
      UI.setLabelsForMode(mode);
      if (mode === 'infra') {
        els.nowStage.textContent = '基础设施 · INFRASTRUCTURE';
        els.nowState.textContent = 'MODE · INFRA';
      } else {
        var st = LLM.getStage(UI.state.stage);
        els.nowStage.textContent = String(st.no).padStart(2, '0') + ' · ' + st.title;
      }
      if (mode === 'knowledge') {
        UI.renderKnowledge();
      } else if (mode === 'infra') {
        UI.setPanelTab('concepts');
        UI.openPanel();
        UI.showInfraList();
      } else {
        if (UI.state.panelTab !== 'stage') renderStage();
        UI.openPanel();
      }
    };

    UI.showInfraList = function () {
      els.panel.classList.add('is-infra');
      var html =
        '<div class="kc-head"><h2>推理基础设施</h2><p>BEYOND THE MODEL · GPU / MEMORY / PARALLELISM</p></div>' +
        '<p class="kc-def">模型之外，还有一整套让推理跑得起来、跑得快的工程系统。点击任意条目查看概念；场景会同步飞到下方的基础设施岛。</p>' +
        '<div class="sp-sec"><h3>十个部件</h3><div class="kb-group">' +
        LLM.INFRA.map(function (node) {
          var c = LLM.KNOWLEDGE_MAP[node.id];
          return (
            '<button type="button" class="kb-item" data-kb="' +
            node.id +
            '"><span class="kb-item__cn">' +
            esc(node.label) +
            '</span><span class="kb-item__en">' +
            esc(c ? c.en : '') +
            '</span></button>'
          );
        }).join('') +
        '</div></div>' +
        '<div class="sp-note"><b>口径</b><span>基础设施不是模型内部的一层，而是模型运行的载体。3D 岛屿为示意布局，不代表真实机架拓扑。</span></div>';
      els.panelBody.innerHTML = html;
      els.panelBody.scrollTop = 0;
    };

    /* ------------------------------------------------------------ 事件绑定 */

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-stage], [data-concept], [data-kb], [data-ptab], [data-kbback], [data-gostage], [data-layer], [data-infra], [data-act2]') : null;
      if (!t) return;

      if (t.dataset.stage) {
        app.selectStage(Number(t.dataset.stage), { focus: true, user: true });
        return;
      }
      if (t.dataset.ptab != null) {
        UI.setPanelTab(t.dataset.ptab);
        if (t.dataset.ptab === 'concepts') {
          if (UI.state.kbDetail) renderConcept(UI.state.kbDetail);
          else {
            UI.state.kbFrom = 'list';
            renderKnowledgeList();
          }
        } else {
          renderStage();
        }
        return;
      }
      if (t.dataset.concept) {
        UI.showConcept(t.dataset.concept, 'stage');
        return;
      }
      if (t.dataset.kb) {
        UI.state.kbFrom = UI.state.panelTab === 'concepts' && UI.state.kbDetail ? 'list' : UI.state.kbFrom || 'list';
        UI.showConcept(t.dataset.kb, UI.state.kbFrom);
        return;
      }
      if (t.dataset.kbback != null) {
        if (UI.state.kbFrom === 'stage') {
          renderStage();
        } else if (UI.state.mode === 'infra') {
          UI.showInfraList();
        } else {
          UI.renderKnowledge();
        }
        return;
      }
      if (t.dataset.gostage) {
        app.selectStage(Number(t.dataset.gostage), { focus: true });
        return;
      }
      if (t.dataset.layer) {
        app.focusLayerByKey(t.dataset.layer);
        return;
      }
      if (t.dataset.infra) {
        app.focusInfra(t.dataset.infra);
        return;
      }
      if (t.dataset.act2) {
        if (t.dataset.act2 === 'explode') app.toggleExplode();
        else if (t.dataset.act2 === 'focus') app.focusCurrent(true);
        else if (t.dataset.act2 === 'resample') {
          app.resample();
        }
        return;
      }
    });

    els.panelBody.addEventListener('input', function (e) {
      var id = e.target.id;
      if (id !== 'tempRange' && id !== 'topkRange' && id !== 'toppRange') return;
      var opts = UI.ctx.sampleOpts || { temperature: 0.9, topK: 5, topP: 0.9 };
      if (id === 'tempRange') opts.temperature = Number(e.target.value);
      if (id === 'topkRange') opts.topK = Number(e.target.value);
      if (id === 'toppRange') opts.topP = Number(e.target.value);
      UI.ctx.sampleOpts = opts;
      app.previewSampling(opts);
    });

    els.panelBody.addEventListener('click', function (e) {
      var a = e.target.closest('[data-attn]');
      if (a) {
        app.setAttentionToken(Number(a.dataset.attn));
      }
    });

    els.railList = els.stageList;

    $$('#modes button').forEach(function (b) {
      b.addEventListener('click', function () {
        app.setMode(b.dataset.mode);
      });
    });

    UI.setPanelTab('stage');
    $('#btnPanelClose').addEventListener('click', function () {
      UI.closePanel();
    });
    els.panelOpen.addEventListener('click', function () {
      UI.openPanel();
    });

    els.play.addEventListener('click', function () {
      app.togglePlay();
    });
    $$('[data-act="prev"]').forEach(function (b) {
      b.addEventListener('click', function () {
        app.prev();
      });
    });
    $$('[data-act="next"]').forEach(function (b) {
      b.addEventListener('click', function () {
        app.next();
      });
    });
    $$('[data-act="replay"]').forEach(function (b) {
      b.addEventListener('click', function () {
        app.replay();
      });
    });
    els.speedSel.addEventListener('change', function () {
      app.setSpeed(Number(els.speedSel.value));
    });
    var overviewBtn = document.getElementById('btnOverview');
    if (overviewBtn) {
      overviewBtn.addEventListener('click', function () {
        app.goOverview();
      });
    }

    // 进度条：点击 / 拖动
    var dragging = false;
    function seekAt(clientX) {
      var rect = els.scrub.getBoundingClientRect();
      var f = U.clamp((clientX - rect.left) / rect.width, 0, 1);
      app.seek(f);
    }
    els.scrub.addEventListener('pointerdown', function (e) {
      dragging = true;
      els.scrub.setPointerCapture && els.scrub.setPointerCapture(e.pointerId);
      seekAt(e.clientX);
    });
    els.scrub.addEventListener('pointermove', function (e) {
      if (dragging) seekAt(e.clientX);
    });
    els.scrub.addEventListener('pointerup', function () {
      dragging = false;
    });
    els.scrub.addEventListener('pointercancel', function () {
      dragging = false;
    });
    els.scrub.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        app.next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        app.prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        app.selectStage(1, { focus: true });
      } else if (e.key === 'End') {
        e.preventDefault();
        app.selectStage(13, { focus: true });
      }
    });

    // 关于弹窗
    function openAbout() {
      els.about.classList.add('is-on');
      document.body.style.overflow = 'hidden';
      var btn = $('#btnAboutClose');
      if (btn) btn.focus();
    }
    function closeAbout() {
      els.about.classList.remove('is-on');
      document.body.style.overflow = '';
      $('#btnAbout').focus();
    }
    $('#btnAbout').addEventListener('click', openAbout);
    $('#btnAboutClose').addEventListener('click', closeAbout);
    els.about.addEventListener('click', function (e) {
      if (e.target === els.about) closeAbout();
    });

    // 输入台
    function openPad() {
      els.pad.classList.remove('is-closed');
      setTimeout(function () {
        els.padText.focus();
      }, 260);
    }
    function closePad() {
      els.pad.classList.add('is-closed');
    }
    UI.openPad = openPad;
    UI.closePad = closePad;
    $('#btnInputPad').addEventListener('click', function () {
      if (els.pad.classList.contains('is-closed')) openPad();
      else closePad();
    });
    $('#btnPadClose').addEventListener('click', closePad);

    $('#padSamples').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || UI.padBusy) return;
      els.padText.value = b.textContent.trim();
      sendPad();
    });

    function sendPad() {
      var text = els.padText.value.trim();
      if (!text || UI.padBusy) return;
      UI.padBusy = true;
      els.padSend.disabled = true;
      els.padText.value = '';
      UI.padClearMessages();
      UI.padAddMessage('user', text);
      closePad();
      app.runCustom(text);
    }

    els.padSend.addEventListener('click', sendPad);
    els.padText.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPad();
      }
    });

    UI.padClearMessages = function () {
      var msgs = els.padBody.querySelectorAll('.msg');
      msgs.forEach(function (m) {
        m.remove();
      });
    };

    UI.padAddMessage = function (who, text) {
      var div = document.createElement('div');
      div.className = 'msg msg--' + (who === 'ai' ? 'ai' : 'user');
      div.innerHTML =
        '<span class="msg__who">' +
        (who === 'ai' ? 'ASSISTANT · DEMO' : 'YOU') +
        '</span><div class="msg__bubble">' +
        esc(text) +
        '</div>';
      els.padBody.appendChild(div);
      els.padBody.scrollTop = els.padBody.scrollHeight;
      return div;
    };

    UI.padAnswer = function (text, meta) {
      var div = UI.padAddMessage('ai', '');
      var bubble = div.querySelector('.msg__bubble');
      var i = 0;
      var timer = setInterval(function () {
        i += 2;
        bubble.textContent = text.slice(0, i);
        els.padBody.scrollTop = els.padBody.scrollHeight;
        if (i >= text.length) {
          clearInterval(timer);
          bubble.textContent = text;
          if (meta) {
            var m = document.createElement('div');
            m.className = 'msg__meta';
            m.innerHTML =
              '<span>Tokens <b>' + esc(meta.tokens) + '</b></span><span>Chars <b>' + esc(meta.chars) + '</b></span><span>模拟耗时 <b>' + esc(meta.ms) + ' ms</b></span><span>非真实模型</span>';
            div.appendChild(m);
            els.padBody.scrollTop = els.padBody.scrollHeight;
          }
          UI.padBusy = false;
          els.padSend.disabled = false;
          openPad();
        }
      }, 26);
    };

    // 键盘
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
      if (e.key === 'Escape') {
        if (els.about.classList.contains('is-on')) closeAbout();
        else if (!els.pad.classList.contains('is-closed')) closePad();
        else if (UI.state.panelOpen) UI.closePanel();
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        app.togglePlay();
      } else if (e.key === 'ArrowRight') {
        app.next();
      } else if (e.key === 'ArrowLeft') {
        app.prev();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.setMode('knowledge');
      }
    });

    /* ------------------------------------------------------------ 启动 */

    UI.init = function () {
      buildLabels();
      UI.setActiveStage(1);
      UI.setProgress(0);
      UI.setPlaying(false);
      if (U.isNarrow()) UI.closePanel();
      UI.setTokenCount((UI.ctx.tokens || []).length);
    };

    UI.els = els;
    UI.toast = toast;

    return UI;
  };
})();
