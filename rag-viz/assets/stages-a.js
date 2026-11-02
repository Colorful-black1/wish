/* ============================================================================
 * stages-a.js —— 第 1~4 站：解析、分块、向量化、建索引
 * ========================================================================== */

(function (global) {
  "use strict";

  const UI = global.UI;
  const E = global.RAG_ENGINE;
  const D = global.RAG_DATA;
  const C = global.RAG_COMP;
  const h = UI.h;
  const fmt = UI.fmt;
  const esc = UI.esc;

  const S = UI.state;
  let parseFilter = null;

  /** 统一的「主区 + 右侧说明栏」布局。 */
  function grid(main, aside) {
    return h("div", { class: "stage-grid" }, h("div", { class: "col" }, main), h("aside", { class: "inspector" }, aside));
  }

  /* ======================================================== 1. 解析 */

  UI.stages.parse = {
    render(view) {
      const docStats = D.DOCS.map((doc) => {
        const sections = doc.sections.length;
        const paras = doc.sections.reduce((a, s) => a + s.paras.length, 0);
        return { doc, sections, paras };
      });
      const totalParas = docStats.reduce((a, x) => a + x.paras, 0);
      const shown = parseFilter ? docStats.filter((x) => x.doc.id === parseFilter) : docStats;

      const srcList = h("div", { class: "chunk-list", style: { maxHeight: "none" } });
      shown.forEach(({ doc, sections, paras }) => {
        const active = parseFilter === doc.id;
        srcList.appendChild(
          h(
            "button",
            {
              class: "chunk-item" + (active ? " on" : ""),
              style: { "--c": doc.color },
              "aria-pressed": active ? "true" : "false",
              on: {
                click: () => {
                  parseFilter = active ? null : doc.id;
                  UI.render({ scroll: false });
                }
              }
            },
            h("span", { class: "cid", text: doc.id.toUpperCase() }),
            h(
              "span",
              { class: "ctext" },
              doc.name,
              h("small", { style: { display: "block", color: "var(--text-4)", fontSize: "9.5px" }, text: doc.dept + " · " + doc.version + " · " + doc.updated })
            ),
            h("span", { class: "cmeta", text: sections + " 章 / " + paras + " 段" })
          )
        );
      });

      const blocks = [];
      shown.forEach(({ doc }) => {
        doc.sections.forEach((sec, si) => {
          blocks.push({ doc, sec, type: "标题", text: sec.h2 ? "## " + sec.h2 : "# " + sec.h1, si });
          sec.paras.forEach((p) => {
            const type = /^- /.test(p) ? "列表" : /^\d+\. /.test(p) ? "有序列表" : "段落";
            blocks.push({ doc, sec, type, text: p, si });
          });
        });
      });

      const rows = blocks.slice(0, 46).map((b, i) =>
        h(
          "tr",
          { class: "is-hover" },
          h("td", { class: "num dim", text: String(i + 1).padStart(2, "0") }),
          h(
            "td",
            {},
            h(
              "span",
              {
                class: "tag",
                style:
                  b.type === "标题"
                    ? { color: "#7dd3fc", borderColor: "rgba(125,211,252,.35)" }
                    : b.type.includes("列表")
                    ? { color: "#a3e635", borderColor: "rgba(163,230,53,.3)" }
                    : {}
              },
              b.type
            )
          ),
          h("td", { style: { color: "var(--text-2)" }, text: b.text.slice(0, 96) + (b.text.length > 96 ? "…" : "") }),
          h("td", { class: "dim" }, C.docChip(b.doc.id), h("div", { style: { marginTop: "3px", fontSize: "10px" }, text: b.sec.h2 || b.sec.h1 }))
        )
      );

      const metaSample = shown[0]
        ? JSON.stringify(
            {
              source: shown[0].doc.name,
              dept: shown[0].doc.dept,
              version: shown[0].doc.version,
              updated: shown[0].doc.updated,
              section: shown[0].doc.sections[1] ? shown[0].doc.sections[1].h2 : shown[0].doc.sections[0].h1,
              acl: ["finance", "all-staff"]
            },
            null,
            2
          )
        : "{}";

      const body = grid(
        [
          C.card("数据源", "点击筛选", srcList, {
            right: h("div", { class: "chips", style: { marginLeft: "auto" } }, C.tag(shown.length + " / " + D.DOCS.length + " 份"))
          }),
          C.card(
            "解析产物 · 结构化文本块",
            "共 " + blocks.length + " 段",
            h(
              "div",
              { style: { maxHeight: "420px", overflow: "auto" } },
              h(
                "table",
                { class: "table" },
                h(
                  "thead",
                  {},
                  h("tr", {}, h("th", { text: "#" }), h("th", { text: "类型" }), h("th", { text: "内容" }), h("th", { text: "来源 / 章节" }))
                ),
                h("tbody", {}, rows)
              )
            ),
            { flush: true }
          )
        ],
        [
          C.explain(UI.STAGES[0]),
          C.card(
            "解析阶段产出的东西",
            null,
            C.metrics([
              [D.DOCS.length, "份文档"],
              [totalParas, "个段落"],
              [D.DOCS.reduce((a, d) => a + d.sections.length, 0), "个章节"],
              ["100%", "元数据覆盖"]
            ])
          ),
          C.card("元数据长这样", "后面用于过滤与引用", h("div", { class: "prompt", style: { maxHeight: "190px" }, text: metaSample })),
          C.notes(UI.STAGES[0]),
          C.pitfall("点一份文档只看它的解析结果。注意：本页语料是 Markdown，所以没有表格和 OCR；真实 PDF 里这两件事最费劲。")
        ]
      );

      return {
        badges: [C.badge(D.DOCS.length + " 份文档", "info"), C.badge(totalParas + " 段", ""), C.badge("元数据 100%", "ok")],
        body
      };
    }
  };

  /* ======================================================== 2. 分块 */

  UI.stages.chunk = {
    render(view) {
      const pack = view.pack;
      const st = pack.stats;
      const s = S.chunk;

      const controls = h(
        "div",
        { style: { display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "12px" } },
        h(
          "div",
          {},
          h("div", { class: "control-head" }, h("span", { text: "切分策略" })),
          C.seg(
            [
              { value: "markdown_recursive", label: "标题 + 递归" },
              { value: "markdown", label: "只按标题" },
              { value: "recursive", label: "纯递归" },
              { value: "fixed", label: "固定长度" }
            ],
            s.strategy,
            (v) => {
              s.strategy = v;
              UI.rerender();
            }
          )
        ),
        h(
          "div",
          { style: { width: "190px" } },
          C.range("chunk_size（字）", s.size, 100, 500, 20, (v) => {
            s.size = v;
            s.overlap = Math.min(s.overlap, Math.floor(v * 0.5));
            UI.rerender();
          })
        ),
        h(
          "div",
          { style: { width: "190px" } },
          C.range("overlap（字）", s.overlap, 0, Math.floor(s.size * 0.5), 10, (v) => {
            s.overlap = v;
            UI.rerender();
          })
        ),
        h("div", { class: "spacer" }),
        h(
          "div",
          { style: { paddingBottom: "2px" } },
          h("span", { class: "tag", text: "块数 " + st.count }),
          " ",
          h("span", { class: "tag", text: "中位 " + st.median + " 字" })
        )
      );

      const map = h("div", { class: "doc-map" });
      pack.perDoc.forEach(({ doc, chunks }) => {
        const strip = h("div", { class: "strip" });
        chunks.forEach((chunk, i) => {
          const selected = S.selectedChunkId === chunk.id;
          strip.appendChild(
            h("button", {
              class: "chunk-block" + (selected ? " on" : "") + (chunk.truncated ? " trunc" : ""),
              style: { "--c": doc.color, flexGrow: chunk.chars, flexBasis: "0px" },
              title: chunk.id + " · " + chunk.section + " · " + chunk.chars + " 字" + (chunk.truncated ? "（硬切）" : ""),
              text: String(i + 1),
              "aria-label": doc.short + " 第 " + (i + 1) + " 块",
              on: {
                click: () => {
                  S.selectedChunkId = chunk.id;
                  UI.render({ scroll: false });
                }
              }
            })
          );
        });
        map.appendChild(
          h(
            "div",
            { class: "doc-row" },
            h(
              "div",
              { class: "doc-name" },
              h("i", { style: { background: doc.color } }),
              doc.short,
              h("span", { class: "faint", text: " · " + chunks.length + " 块" })
            ),
            strip
          )
        );
      });

      const legend = h(
        "div",
        { class: "legend-inline", style: { marginTop: "10px" } },
        D.DOCS.map((d) => h("span", {}, h("i", { style: { background: d.color } }), d.short)),
        h("span", {}, h("i", { style: { background: "#fbbf24" } }), "右上角标记 = 硬切断句")
      );

      const selected = pack.chunks.find((c) => c.id === S.selectedChunkId) || pack.chunks[0];
      const list = h("div", { class: "chunk-list" });
      pack.chunks.forEach((chunk) => {
        const doc = UI.docById(chunk.docId);
        list.appendChild(
          h(
            "button",
            {
              class: "chunk-item" + (selected && selected.id === chunk.id ? " on" : ""),
              style: { "--c": doc.color },
              on: {
                click: () => {
                  S.selectedChunkId = chunk.id;
                  UI.render({ scroll: false });
                }
              }
            },
            h("span", { class: "cid", text: chunk.id.replace(/^[a-z]+-/, "#") }),
            h("span", { class: "ctext", text: chunk.text.replace(/^#+\s*/, "").slice(0, 60) }),
            h("span", { class: "cmeta", text: chunk.chars + " 字" })
          )
        );
      });

      const detail = selected
        ? h(
            "div",
            { class: "chunk-detail" },
            h(
              "div",
              { class: "cd-head" },
              C.docChip(selected.docId),
              C.tag(selected.section),
              C.tag(selected.chars + " 字"),
              C.tag("overlap " + selected.overlapChars + " 字", selected.overlapChars === 0 ? "bad" : ""),
              selected.truncated ? C.tag("硬切", "bad") : null
            ),
            h("div", { class: "cd-text", text: selected.text }),
            h(
              "div",
              { style: { marginTop: "8px", display: "flex", gap: "5px", flexWrap: "wrap" } },
              Object.keys(selected.concepts).map((c) =>
                C.tag(D.CONCEPTS[c].label + " " + selected.concepts[c].toFixed(2))
              )
            )
          )
        : C.empty("点一个块看看");

      const overlapHint =
        st.avgOverlap < 1
          ? "平均实际重叠只有 " + st.avgOverlap.toFixed(1) + " 字 —— overlap 额度小于段落长度时，整段被丢弃，等于没设重叠。"
          : "平均实际重叠 " + st.avgOverlap.toFixed(1) + " 字。";

      const body = grid(
        [
          C.card("分块地图", "每块宽度 ∝ 字数", [controls, map, legend]),
          C.card(
            "块列表与细节",
            "点选查看",
            h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "12px" } }, list, detail)
          )
        ],
        [
          C.explain(UI.STAGES[1]),
          C.card(
            "这一组参数的结果",
            null,
            C.metrics([
              [st.count, "块数"],
              [st.median, "中位字数", false, "字"],
              [st.max, "最大块", false, "字"],
              [fmt.pct(st.metaRate), "元数据覆盖", st.metaRate === 1]
            ]),
            h("div", { style: { marginTop: "10px" } }, [
              C.kv("硬切断句", st.truncated + " 块", st.truncated ? "muted" : "ok"),
              C.kv("超出设定大小", st.overSize + " 块（标题按结构切时允许）"),
              C.kv("平均实际重叠", st.avgOverlap.toFixed(1) + " 字")
            ]),
            h("div", { style: { marginTop: "8px" } }, C.note(overlapHint, st.avgOverlap < 1 ? "var(--warn)" : "var(--ok)"))
          ),
          C.notes(UI.STAGES[1]),
          C.pitfall("把 chunk_size 拖到 120 再拖回 500，看块数和中位长度；切到「纯递归」，元数据覆盖率会掉到 0。")
        ]
      );

      return {
        badges: [
          C.badge(st.count + " 块", "info"),
          C.badge("中位 " + st.median + " 字", ""),
          C.badge(st.metaRate === 1 ? "元数据 100%" : "元数据 " + fmt.pct(st.metaRate), st.metaRate === 1 ? "ok" : "warn")
        ],
        body
      };
    }
  };

  /* ======================================================== 3. 向量化 */

  UI.stages.embed = {
    render(view) {
      const pack = view.pack;
      const ret = view.ret;
      const denseScores = new Map(ret.dense.map((d) => [d.chunk.id, d.score]));

      const wrap = h("div", { class: "scene-wrap tall" });
      const canvas = h("canvas", { "aria-label": "三维语义空间：拖拽旋转，点击点位查看块" });
      wrap.appendChild(canvas);
      wrap.appendChild(
        h(
          "div",
          { class: "scene-overlay" },
          h(
            "div",
            { class: "scene-legend" },
            D.DOCS.map((d) => h("span", {}, h("i", { style: { background: d.color } }), d.short)),
            h("span", {}, h("i", { style: { background: "#f0fdfa" } }), "查询向量"),
            h("span", {}, h("i", { style: { background: "#a3e635" } }), "Top-6 命中")
          ),
          h("div", { class: "scene-hint", text: "拖拽旋转 · 滚轮缩放 · 点击点位查看" })
        )
      );

      const scene = new global.VectorScene(
        canvas,
        {
          onSelect: (id) => {
            if (id === "__query__") return;
            S.selectedChunkId = id;
            UI.render({ scroll: false });
          }
        },
        UI.camera || undefined
      );
      UI.scene = scene;
      scene.setPoints(
        pack.chunks.map((c) => {
          const doc = UI.docById(c.docId);
          return {
            id: c.id,
            coord: c.coord,
            color: doc.color,
            meta: { section: c.docShort + " / " + c.section, text: c.text, score: denseScores.get(c.id) }
          };
        })
      );
      scene.setQuery(ret.qcoord, "q");
      scene.setLinks(
        ret.dense.slice(0, 6).map((d, i) => ({
          id: d.chunk.id,
          rank: i + 1,
          color: "#a3e635",
          score: d.score
        }))
      );

      const selected = pack.chunks.find((c) => c.id === S.selectedChunkId) || ret.dense[0].chunk;
      const selVec = selected.vector;
      const maxAbs = Math.max.apply(null, Array.from(selVec).map((v) => Math.abs(v)));
      const bars = h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "1px",
            height: "64px",
            padding: "0 2px",
            border: "1px solid var(--line)",
            borderRadius: "4px",
            background: "var(--bg-2)"
          },
          "aria-label": "64 维向量数值分布"
        },
        Array.from(selVec).map((v) =>
          h("i", {
            style: {
              flex: "1",
              height: Math.max(3, (Math.abs(v) / (maxAbs || 1)) * 100) + "%",
              alignSelf: v >= 0 ? "flex-end" : "flex-start",
              background: v >= 0 ? "rgba(163,230,53,.72)" : "rgba(251,113,133,.68)",
              borderRadius: "1px"
            }
          })
        )
      );

      const topRows = ret.dense.slice(0, 8).map((d, i) =>
        h(
          "tr",
          {
            class: "is-hover",
            style: { cursor: "pointer" },
            on: {
              click: () => {
                S.selectedChunkId = d.chunk.id;
                UI.render({ scroll: false });
              }
            }
          },
          h("td", { class: "num dim", text: String(i + 1) }),
          h("td", {}, C.docChip(d.chunk.docId), h("div", { style: { marginTop: "2px" }, text: d.chunk.section })),
          h(
            "td",
            {},
            h("div", { class: "bar", style: { width: "90px", display: "inline-block", verticalAlign: "middle" } }, h("i", { style: { width: d.score * 100 + "%", "--bar-color": "var(--c-embed)" } })),
            h("span", { class: "num", style: { marginLeft: "6px" }, text: fmt.score(d.score) })
          )
        )
      );

      const cos = ret.dense[0].score;
      const body = grid(
        [
          C.card("三维语义空间", "64 维 → PCA 降到 3 维", wrap, { flush: true, style: { overflow: "hidden" } }),
          h(
            "div",
            { class: "space-strip" },
            C.metric("64", "向量维度（示意）", true),
            C.metric(pack.chunks.length, "块向量", false),
            C.metric(fmt.score(cos), "查询 Top-1 余弦", false),
            C.metric(fmt.score(ret.dense[4] ? ret.dense[4].score : 0), "第 5 名余弦", false)
          ),
          C.card(
            "查询与 Top-8 块的余弦",
            "点一行看它在空间里的位置",
            h(
              "table",
              { class: "table" },
              h("thead", {}, h("tr", {}, h("th", { text: "#" }), h("th", { text: "块 / 章节" }), h("th", { text: "cosine" }))),
              h("tbody", {}, topRows)
            ),
            { tight: true }
          )
        ],
        [
          C.explain(UI.STAGES[2]),
          C.card(
            "选中的块",
            selected.id,
            h(
              "div",
              { class: "chunk-detail", style: { marginBottom: "8px" } },
              h("div", { class: "cd-head" }, C.docChip(selected.docId), C.tag(selected.section), C.tag(selected.chars + " 字")),
              h("div", { class: "cd-text", text: selected.text.slice(0, 120) + (selected.text.length > 120 ? "…" : "") })
            ),
            h("div", { class: "mini-label", style: { marginBottom: "5px" }, text: "64 维向量的前 64 个分量" }),
            bars,
            h("div", { style: { marginTop: "8px" } }, C.kv("L2 范数", "1.000（已归一化）", "ok"), C.kv("向量维度", "64（真实 bge 为 1024）"))
          ),
          C.card("模型信息", null, [
            C.kv("模型", "bge-large-zh-v1.5"),
            C.kv("维度", "1024（本页示意 64）"),
            C.kv("距离", "cosine（= 归一化后的点积）"),
            C.kv("文档侧", "离线批量计算"),
            C.kv("查询侧", "在线计算 ~14ms")
          ]),
          C.notes(UI.STAGES[2]),
          C.pitfall("同一篇文档的点会聚成一簇。注意：语义最近 ≠ 有答案 —— 下一步重排会修正这件事。")
        ]
      );

      return {
        badges: [C.badge("64 维示意", "warn"), C.badge("cos " + fmt.score(cos), "info"), C.badge(pack.chunks.length + " 个向量", "")],
        body
      };
    }
  };

  /* ======================================================== 4. 建索引 */

  /** 把 HNSW 的分层图画到 canvas 上（hover 高亮、点击选中）。 */
  function mountHnswGraph(canvas, pack, onSelect) {
    const ctx = canvas.getContext("2d");
    const graph = pack.hnsw;
    let w = 0;
    let hgt = 0;
    let hover = null;
    let nodes = [];

    function layout() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      w = Math.max(320, rect.width);
      hgt = 360;
      canvas.width = w * dpr;
      canvas.height = hgt * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = hgt + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function draw() {
      ctx.clearRect(0, 0, w, hgt);
      if (!graph) {
        ctx.fillStyle = "#718396";
        ctx.font = "12px sans-serif";
        ctx.fillText("没有索引", 20, 40);
        return;
      }
      const levels = graph.maxLevel;
      const rows = levels + 1;
      const padTop = 30;
      const padBottom = 16;
      const rowH = (hgt - padTop - padBottom) / rows;
      const xs = pack.chunks.map((c) => c.coord[0]);
      const zs = pack.chunks.map((c) => c.coord[2]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const px = (v) => 54 + ((v - minX) / (maxX - minX || 1)) * (w - 92);
      const py = (l, c) => padTop + (levels - l) * rowH + rowH / 2 + c.coord[2] * rowH * 0.34;

      nodes = [];
      for (let l = levels; l >= 0; l--) {
        const y0 = padTop + (levels - l) * rowH;
        ctx.strokeStyle = "rgba(38,52,63,.55)";
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(12, y0 + rowH - 1);
        ctx.lineTo(w - 12, y0 + rowH - 1);
        ctx.stroke();
        ctx.setLineDash([]);
        const nodesAt = Array.from(graph.layers[l].keys());
        ctx.fillStyle = "#718396";
        ctx.font = "500 9.5px ui-monospace, Consolas, monospace";
        ctx.fillText("L" + l + " · " + nodesAt.length + " 点", 12, y0 + 12);

        // 边
        nodesAt.forEach((id) => {
          const a = pack.chunks[id];
          const ax = px(a.coord[0]);
          const ay = py(l, a);
          graph.layers[l].get(id).forEach((nb) => {
            if (nb < id) return;
            const b = pack.chunks[nb];
            const bx = px(b.coord[0]);
            const by = py(l, b);
            const active = hover != null && (hover.id === id || hover.id === nb);
            ctx.strokeStyle = active ? "rgba(34,211,238,.6)" : l === 0 ? "rgba(96,165,250,.16)" : "rgba(125,211,252,.24)";
            ctx.lineWidth = active ? 1.4 : 0.7;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          });
        });

        nodesAt.forEach((id) => {
          const c = pack.chunks[id];
          const x = px(c.coord[0]);
          const y = py(l, c);
          const doc = UI.docById(c.docId);
          const isHover = hover && hover.id === id && hover.level === l;
          const isSelected = S.selectedChunkId === c.id;
          const r = l === 0 ? 3.4 : 4.4;
          ctx.beginPath();
          ctx.arc(x, y, isHover ? r + 2.4 : r, 0, Math.PI * 2);
          ctx.fillStyle = doc.color;
          ctx.globalAlpha = isSelected || isHover ? 1 : 0.85;
          ctx.fill();
          ctx.globalAlpha = 1;
          if (graph.entry === id && l === levels) {
            ctx.strokeStyle = "#f0fdfa";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (isSelected) {
            ctx.strokeStyle = "rgba(255,255,255,.8)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
          nodes.push({ id, level: l, x, y });
        });
      }

      if (hover) {
        const c = pack.chunks[hover.id];
        const label = c.docShort + " / " + c.section + " · " + c.chars + " 字";
        ctx.font = "10.5px 'Microsoft YaHei UI', sans-serif";
        const tw = ctx.measureText(label).width;
        const bx = Math.min(w - tw - 22, Math.max(12, hover.x - tw / 2));
        const by = Math.max(6, hover.y - 30);
        ctx.fillStyle = "rgba(8,13,20,.95)";
        ctx.strokeStyle = "rgba(38,52,63,1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 14, 20, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e9f0f9";
        ctx.fillText(label, bx + 7, by + 14);
      }
    }

    function pick(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best = null;
      let bestD = 11;
      nodes.forEach((n) => {
        const d = Math.hypot(n.x - mx, n.y - my);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      });
      return best;
    }

    const onMove = (e) => {
      const hit = pick(e);
      const changed = (hit && hit.id) !== (hover && hover.id);
      hover = hit;
      canvas.style.cursor = hit ? "pointer" : "default";
      if (changed) draw();
    };
    const onClick = (e) => {
      const hit = pick(e);
      if (hit) onSelect(pack.chunks[hit.id].id);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    const ro = new ResizeObserver(layout);
    ro.observe(canvas.parentElement);
    layout();
    return () => {
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }

  UI.stages.index = {
    render(view) {
      const pack = view.pack;
      const graph = pack.hnsw;
      const ret = view.ret;
      const st = pack.stats;
      const mem = (st.count * 1024 * 4) / 1024;
      let edges = 0;
      for (let l = 0; l <= graph.maxLevel; l++) {
        for (const arr of graph.layers[l].values()) edges += arr.length;
      }
      edges = Math.round(edges / 2);

      const wrap = h("div", { class: "scene-wrap", style: { height: "380px", background: "var(--panel)" } });
      const canvas = h("canvas", { "aria-label": "HNSW 分层图" });
      wrap.appendChild(canvas);
      wrap.appendChild(
        h(
          "div",
          { class: "scene-overlay" },
          h("div", { class: "scene-legend" }, h("span", { style: { color: "#7dd3fc" } }, "上疏：跨簇跳转"), h("span", { style: { color: "#60a5fa" } }, "下密：精确收窄")),
          h("div", { class: "scene-hint", text: "入口在最高层 · 点击节点联动" })
        )
      );

      const tokens = E.tokenize(ret.retrievalText)
        .filter((t, i, a) => a.indexOf(t) === i && (pack.bm25.df[t] || 0) > 0)
        .slice(0, 8);
      const N = pack.chunks.length;
      const bmRows = tokens.map((t) => {
        const df = pack.bm25.df[t] || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const hits = pack.chunks.filter((c) => E.tokenize(c.text).indexOf(t) >= 0).slice(0, 3);
        return h(
          "tr",
          {},
          h("td", { class: "mono", text: t }),
          h("td", { class: "num", text: df }),
          h("td", { class: "num", text: idf.toFixed(2) }),
          h("td", {}, hits.length ? hits.map((c) => C.docChip(c.docId)).reduce((a, b) => [a, " ", b], []) : h("span", { class: "dim", text: "无命中 → 0 分" }))
        );
      });
      if (!bmRows.length) {
        bmRows.push(h("tr", {}, h("td", { class: "dim", colspan: "4", text: "没有任何词元命中 —— BM25 会给所有块 0 分，但仍按原顺序返回 Top-1（假命中）。" })));
      }

      const sample = pack.chunks.find((c) => c.id === "travel-02") || pack.chunks[0];
      const vecPreview = "[" + sample.vector.slice(0, 6).map((v) => v.toFixed(2)).join(", ") + ", ...]";
      const record = {
        id: sample.id,
        vector: vecPreview,
        text: sample.text.replace(/\n+/g, " ").slice(0, 48) + "...",
        metadata: {
          source: sample.docName,
          section: sample.section,
          dept: sample.dept,
          updated: sample.updated,
          acl: ["finance", "all-staff"]
        }
      };

      const body = grid(
        [
          C.card("HNSW 分层图", "层次越往上越稀疏", wrap, { flush: true, style: { overflow: "hidden" } }),
          C.card(
            "向量数据库里到底存了什么",
            "不止是向量",
            h("div", { class: "prompt", style: { maxHeight: "240px" }, text: JSON.stringify(record, null, 2) }),
            h(
              "div",
              { style: { marginTop: "9px" } },
              C.note(
                "vector 实际是 1024 维，这里只截前 6 个分量。向量库 = 向量索引 + 标量索引 + 元数据/原文存储；生产里还要管持久化、分片副本、增量 upsert、删除与版本回滚、按部门/密级过滤。",
                "var(--line-2)"
              )
            )
          ),
          C.card(
            "BM25 的倒排索引（当前问题的词元）",
            "df = 文档频率，IDF 越低越没区分度",
            h(
              "table",
              { class: "table" },
              h("thead", {}, h("tr", {}, h("th", { text: "词元" }), h("th", { class: "num", text: "df" }), h("th", { class: "num", text: "IDF" }), h("th", { text: "命中块" }))),
              h("tbody", {}, bmRows)
            ),
            { tight: true }
          ),
          C.card(
            "索引类型对照",
            "为什么企业里常常是「向量索引 + 倒排索引」同时存在",
            h(
              "table",
              { class: "table" },
              h(
                "thead",
                {},
                h("tr", {}, h("th", { text: "结构" }), h("th", { text: "解决什么" }), h("th", { text: "代价" }), h("th", { text: "本页" }))
              ),
              h(
                "tbody",
                {},
                h("tr", {}, h("td", { text: "Flat 全扫描" }), h("td", { text: "100% 精确，零构建" }), h("td", { text: "延迟随 N 线性涨" }), h("td", {}, C.tag("可切换", "ok"))),
                h("tr", {}, h("td", { text: "HNSW" }), h("td", { text: "高召回、低延迟" }), h("td", { text: "内存大、构建慢、删除麻烦" }), h("td", {}, C.tag("已实现", "ok"))),
                h("tr", {}, h("td", { text: "IVF-PQ" }), h("td", { text: "省内存、可放磁盘" }), h("td", { text: "量化有损，召回更低" }), h("td", {}, C.tag("文字说明"))),
                h("tr", {}, h("td", { text: "BM25 倒排" }), h("td", { text: "精确词 / 编号 / 人名" }), h("td", { text: "不懂同义与语义" }), h("td", {}, C.tag("已实现", "ok")))
              )
            ),
            { tight: true }
          )
        ],
        [
          C.explain(UI.STAGES[3]),
          C.card(
            "索引参数",
            null,
            h(
              "div",
              { style: { marginBottom: "10px" } },
              h("div", { class: "control-head" }, h("span", { text: "索引类型" })),
              C.seg(
                [
                  { value: "hnsw", label: "HNSW" },
                  { value: "flat", label: "Flat 全扫描" }
                ],
                S.index.type,
                (v) => {
                  S.index.type = v;
                  UI.rerender();
                }
              )
            ),
            C.range("M（每层邻居数）", S.index.M, 4, 16, 2, (v) => {
              S.index.M = v;
              UI.rerender();
            }),
            C.kv("层数", graph.maxLevel + 1),
            C.kv("节点 / 边", st.count + " / " + edges),
            C.kv("平均度", (edges * 2 / st.count).toFixed(1)),
            C.kv("向量内存", mem.toFixed(0) + " KB（1024 维 × float32）"),
            C.kv("构建耗时", fmt.ms(view.timings.index))
          ),
          C.card(
            "注意：库太小，ANN 不一定快",
            null,
            C.prose(
              "本次 ANN 访问了 <strong>" +
                ret.ann.dists +
                "</strong> 个点，全扫描要 <strong>" +
                N +
                "</strong> 个。库这么小时 HNSW 甚至更慢 —— 图遍历本身有开销。" +
                "真实百万级库里，两者是「几百次距离计算」和「一百万次」的差距。"
            ),
            { tight: true }
          ),
          C.notes(UI.STAGES[3]),
          C.pitfall("把 M 拖到 4 再拖到 16，看边数和平均度怎么变；切到 Flat，第 6 站的 ANN 轨迹会变成全量扫描。")
        ]
      );

      const cleanup = mountHnswGraph(canvas, pack, (id) => {
        S.selectedChunkId = id;
        UI.render({ scroll: false });
      });
      // 页面重绘时 canvas 会被移除，ResizeObserver 自然失效；这里挂到 scene 上以便统一销毁
      UI.scene = { destroy: cleanup, getCamera: () => UI.camera };

      return {
        badges: [C.badge(S.index.type.toUpperCase(), "info"), C.badge("M=" + S.index.M, ""), C.badge(graph.maxLevel + 1 + " 层 / " + st.count + " 点", "")],
        body
      };
    }
  };
})(window);
