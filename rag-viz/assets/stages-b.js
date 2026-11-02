/* ============================================================================
 * stages-b.js —— 第 5~9 站：查询理解、混合召回、重排、上下文与生成、校验评测
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
  let retTab = "lanes";

  function grid(main, aside) {
    return h("div", { class: "stage-grid" }, h("div", { class: "col" }, main), h("aside", { class: "inspector" }, aside));
  }

  /** 一条召回结果行。 */
  function laneRow(item, rank, scoreText, laneColor, selected) {
    const doc = UI.docById(item.chunk.docId);
    return h(
      "button",
      {
        class: "lane-row" + (selected ? " on" : ""),
        title: item.chunk.section + " · " + item.chunk.chars + " 字",
        on: {
          click: () => {
            S.selectedChunkId = item.chunk.id;
            UI.render({ scroll: false });
          }
        }
      },
      h("span", { class: "r", text: String(rank) }),
      h(
        "span",
        { class: "txt" },
        item.chunk.section,
        h("small", {}, h("i", { class: "source-dot", style: { background: doc.color } }), doc.short + " · " + item.chunk.chars + " 字")
      ),
      h("span", { class: "sc", style: laneColor ? { color: laneColor } : null, text: scoreText })
    );
  }

  /** 一个召回通道卡片。 */
  function lane(title, sub, color, rows, emptyText) {
    return h(
      "div",
      { class: "lane", style: { "--lane-color": color } },
      h("div", { class: "lane-head" }, h("span", { class: "dot" }), h("b", { text: title }), h("span", { text: sub }), h("span", { class: "num", text: rows.length + " 条" })),
      h("div", { class: "lane-body" }, rows.length ? rows : C.empty(emptyText || "没有结果"))
    );
  }

  /* ======================================================== 5. 查询理解 */

  UI.stages.rewrite = {
    render(view) {
      const pack = view.pack;
      const q = view.ret.query;
      const base = UI.searchState();
      const off = E.retrieve(pack, Object.assign({}, base, { useRewrite: false, useMultiQuery: false, useHyde: false }));
      const on = E.retrieve(pack, Object.assign({}, base, { useRewrite: true, useMultiQuery: false, useHyde: false }));
      const first = (r) => (r.dense[0] ? r.dense[0].chunk.section : "—");
      const sameTop = first(off) === first(on);

      const flowNodes = [
        { t: "原始问题", v: q.text, active: false },
        { t: "规范化", v: q.text.replace(/[？?。！!]+$/, "").trim(), active: false },
        { t: "LLM 改写", v: S.query.rewrite ? q.rewrite : "（已关闭）", active: S.query.rewrite },
        { t: "实际检索文本", v: view.ret.retrievalText, active: true }
      ];

      const flow = h(
        "div",
        { class: "flow" },
        flowNodes.map((n) =>
          h(
            "div",
            { class: "flow-node" + (n.active ? " active" : "") },
            h("h5", { text: n.t }),
            h("p", { text: n.v })
          )
        )
      );

      const rewritePanel = C.card(
        "改写（Rewrite）",
        "补全指代 · 口语转书面",
        C.toggle("LLM 改写", "把口语问题改写成更贴近文档用词的检索语句", S.query.rewrite, (v) => {
          S.query.rewrite = v;
          UI.rerender();
        }),
        h("div", { class: "prompt", style: { marginTop: "8px" } }, h("span", { class: "sys", text: "原始：" }), q.text + "\n", h("span", { class: "role", text: "改写：" }), q.rewrite)
      );

      const multiPanel = C.card(
        "多查询（Multi-Query）",
        "3 个变体 + 原问题",
        C.toggle("启用多查询", "每个变体各自召回，取并集后再融合", S.query.multi, (v) => {
          S.query.multi = v;
          UI.rerender();
        }),
        h(
          "div",
          { style: { marginTop: "8px", display: "flex", flexDirection: "column", gap: "5px" } },
          (q.multi.length ? q.multi : ["（这个问题没有预设变体）"]).map((m, i) =>
            h(
              "div",
              { class: "ctx-item", style: { marginBottom: 0 } },
              h("div", { class: "ci-head" }, h("span", { class: "ci-cite", text: "Q" + (i + 2) }), h("span", { class: "ci-src", text: m }))
            )
          )
        ),
        h("div", { style: { marginTop: "8px" } }, C.kv("候选块数", view.ret.multi ? view.ret.multi.runs.reduce((a, r) => a + r.list.length, 0) + " 条（去重前）" : "未启用"))
      );

      const hydePanel = C.card(
        "假设文档嵌入（HyDE）",
        "用一个假答案去检索",
        C.toggle("启用 HyDE", "先让模型写一段答案，再把它的向量与问题向量加权", S.query.hyde, (v) => {
          S.query.hyde = v;
          UI.rerender();
        }),
        h("div", { class: "prompt", style: { marginTop: "8px" } }, h("span", { class: "ctx", text: "假答案：" }), q.hyde || "（这个问题没有预设假设文档）")
      );

      const concepts = Object.keys(q.concepts);
      const conceptChips = h(
        "div",
        { class: "chips" },
        concepts.length
          ? concepts.map((c) => h("span", { class: "chip chip-static" }, D.CONCEPTS[c].label, h("span", { class: "x", text: q.concepts[c].toFixed(2) })))
          : h("span", { class: "tag bad", text: "没有识别到已知概念" })
      );

      const tokenChips = E.tokenize(view.ret.retrievalText).slice(0, 24).map((t) => h("span", { class: "tag", text: t }));

      const body = grid(
        [
          C.card("查询理解流水线", "第 3 步可选", flow, { flush: true, style: { padding: "12px" } }),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } }, rewritePanel, multiPanel),
          hydePanel,
          C.card(
            "概念识别与分词",
            "向量靠概念，BM25 靠词元",
            h("div", { class: "mini-label", text: "识别到的概念及权重" }),
            conceptChips,
            h("div", { class: "mini-label", style: { marginTop: "11px" }, text: "BM25 实际使用的词元（前 24 个）" }),
            h("div", { class: "chips", style: { marginTop: "3px" } }, tokenChips)
          )
        ],
        [
          C.explain(UI.STAGES[4]),
          C.card(
            "改写到底有没有用？",
            "同一份索引，只切换改写",
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" } },
              h("div", {}, h("div", { class: "mini-label", text: "改写关闭 · Top-1" }), h("div", { style: { fontSize: "11.5px", color: "var(--text)" }, text: first(off) })),
              h("div", {}, h("div", { class: "mini-label", text: "改写开启 · Top-1" }), h("div", { style: { fontSize: "11.5px", color: "var(--text)" }, text: first(on) }))
            ),
            C.note(
              sameTop
                ? "本页这两次召回的 Top-1 相同。改写不是免费午餐：它可能补全信息，也可能把关键实体改丢 —— 必须用评测集验证。"
                : "Top-1 变了！改写既可以救回漏召，也可能把正确答案挤下去。真实项目里要逐题看 diff，不能默认开。",
              sameTop ? "var(--line-2)" : "var(--warn)"
            )
          ),
          C.metrics([
            [E.tokenize(q.text).length, "原始词元"],
            [concepts.length, "识别概念"],
            [view.ret.retrievalText.length, "检索文本字数"],
            [S.query.multi ? "ON" : "OFF", "多查询"]
          ]),
          C.notes(UI.STAGES[4]),
          C.pitfall("依次打开「改写 / 多查询 / HyDE」，观察候选池和 Top-1 的变化。注意多查询会带来更多候选，也更容易混进噪声。")
        ]
      );

      return {
        badges: [
          C.badge(S.query.rewrite ? "改写 ON" : "改写 OFF", S.query.rewrite ? "info" : ""),
          C.badge(S.query.multi ? "多查询 ON" : "多查询 OFF", ""),
          C.badge(S.query.hyde ? "HyDE ON" : "HyDE OFF", "")
        ],
        body
      };
    }
  };

  /* ======================================================== 6. 混合召回 */

  UI.stages.retrieve = {
    render(view) {
      const pack = view.pack;
      const ret = view.ret;
      const denseIds = new Set(ret.dense.map((d) => d.chunk.id));
      const sparseIds = new Set(ret.sparse.map((d) => d.chunk.id));
      const fusedById = new Map(ret.fused.map((f, i) => [f.chunk.id, { rank: i + 1, score: f.score, ranks: f.ranks }]));

      // --- 三维空间
      const wrap = h("div", { class: "scene-wrap tall" });
      const canvas = h("canvas", { "aria-label": "召回空间：拖拽旋转，点击点位" });
      wrap.appendChild(canvas);
      wrap.appendChild(
        h(
          "div",
          { class: "scene-overlay" },
          h(
            "div",
            { class: "scene-legend" },
            h("span", {}, h("i", { style: { background: "#f0fdfa" } }), "查询"),
            h("span", {}, h("i", { style: { background: "#fbbf24" } }), "融合 Top-8"),
            h("span", {}, h("i", { style: { background: "#5eead4" } }), "ANN 访问过的点")
          ),
          h("div", { class: "scene-hint", text:
            ret.ann.mode === "prefilter"
              ? "pre-filter · 只在 " + ret.poolSize + " 块里精确扫描"
              : S.index.type === "hnsw"
              ? "efSearch=" + S.search.efSearch + " · 访问 " + ret.ann.visitedOrder.length + " 点"
              : "Flat 全扫描 · " + pack.chunks.length + " 点"
          })
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
          const f = fusedById.get(c.id);
          return {
            id: c.id,
            coord: c.coord,
            color: doc.color,
            meta: { section: c.docShort + " / " + c.section, text: c.text, score: f ? f.score : null }
          };
        })
      );
      scene.setQuery(ret.qcoord, "q");
      scene.setLinks(ret.fused.slice(0, 8).map((f, i) => ({ id: f.chunk.id, rank: i + 1, color: "#fbbf24" })));
      if (ret.ann.mode === "hnsw") scene.setTrace(ret.ann.visitedOrder.map((v) => v.id), ret.ann.edges);
      if (S.selectedChunkId) scene.setSelection([S.selectedChunkId]);

      // --- 三路对比
      const denseRows = ret.dense.slice(0, 10).map((d, i) => laneRow(d, i + 1, fmt.score(d.score), null, S.selectedChunkId === d.chunk.id));
      const sparseRows = ret.sparse.slice(0, 10).map((d, i) =>
        laneRow(d, i + 1, d.score === 0 ? "0.00 ⚠" : d.score.toFixed(2), d.score === 0 ? "var(--bad)" : null, S.selectedChunkId === d.chunk.id)
      );
      const fusedRows = ret.fused.slice(0, 10).map((f, i) =>
        h(
          "button",
          {
            class: "lane-row" + (S.selectedChunkId === f.chunk.id ? " on" : ""),
            title: f.chunk.section,
            on: {
              click: () => {
                S.selectedChunkId = f.chunk.id;
                UI.render({ scroll: false });
              }
            }
          },
          h("span", { class: "r", text: String(i + 1) }),
          h(
            "span",
            { class: "txt" },
            f.chunk.section,
            h("small", { text: "dense #" + (f.ranks[0] || "—") + " · bm25 #" + (f.ranks[1] || "—") })
          ),
          h("span", { class: "sc", text: f.score.toFixed(4) })
        )
      );

      const lanes = h(
        "div",
        { class: "lanes" },
        lane("向量召回", "dense · cosine", "#22d3ee", denseRows),
        lane("关键词召回", "BM25", "#a3e635", sparseRows),
        lane("RRF 融合", "只看名次", "#fbbf24", fusedRows)
      );

      // --- ANN 细节
      const layerChips = h(
        "div",
        { class: "chips" },
        ret.ann.layerPath.map((p, i) =>
          h("span", { class: "chip chip-static" }, "L" + p.level, h("span", { class: "x", text: "#" + p.id }))
        )
      );
      const efRows = [4, 8, 16, 32].map((ef) => {
        const r = E.retrieve(pack, Object.assign({}, UI.searchState(), { efSearch: ef }));
        return h(
          "tr",
          {},
          h("td", { class: "num", text: "ef = " + ef + (ef === S.search.efSearch ? " ←" : "") }),
          h("td", { class: "num", text: r.ann.dists }),
          h("td", { class: "num", text: r.recall == null ? "—" : fmt.pct(r.recall) }),
          h("td", { class: "num", text: fmt.ms(r.timings.ann) })
        );
      });

      const annPanel = h(
        "div",
        {},
        h(
          "div",
          { class: "metric-grid", style: { marginBottom: "10px" } },
          C.metric(ret.ann.mode === "prefilter" ? ret.poolSize : ret.ann.mode === "hnsw" ? ret.ann.dists : pack.chunks.length, "距离计算次数", true),
          C.metric(ret.recall == null ? "精确" : fmt.pct(ret.recall), "Recall@K（对全扫描）"),
          C.metric(ret.ann.visitedOrder.length, "访问过的点"),
          C.metric(fmt.ms(view.timings.ann), "ANN 耗时")
        ),
        ret.ann.mode === "prefilter"
          ? C.note(
              "pre-filter 模式下没有分层图遍历：先按元数据把候选池收窄到 " +
                ret.poolSize +
                " 块，再精确扫描。生产里对应「按部门/密级分区的子索引」或 filtered HNSW。",
              "var(--line-2)"
            )
          : [
              h("div", { class: "mini-label", text: "分层下降路径" }),
              layerChips,
              h(
                "table",
                { class: "table", style: { marginTop: "10px" } },
                h("thead", {}, h("tr", {}, h("th", { text: "efSearch" }), h("th", { class: "num", text: "距离计算" }), h("th", { class: "num", text: "Recall@K" }), h("th", { class: "num", text: "耗时" }))),
                h("tbody", {}, efRows)
              )
            ],
        C.note(
          S.index.type === "flat"
            ? "当前是 Flat：每个块都要算一次距离，结果是精确的，但没有提前终止。"
            : "efSearch 越大，搜索越宽、召回越高、计算越多。本库只有 " + pack.chunks.length + " 个点，所以差异被压得很小。",
          "var(--line-2)"
        )
      );

      // --- 融合公式
      const fusePanel = h(
        "div",
        {},
        h(
          "div",
          { class: "prompt", style: { marginBottom: "10px" } },
          h("span", { class: "role", text: "RRF(d) = Σ " }),
          " weight_i / (k + rank_i)     ",
          h("span", { class: "sys", text: "# k = " + S.search.rrfK + "，rank 从 1 开始" })
        ),
        h(
          "table",
          { class: "table" },
          h(
            "thead",
            {},
            h("tr", {}, h("th", { text: "#" }), h("th", { text: "块" }), h("th", { class: "num", text: "dense 名次" }), h("th", { class: "num", text: "bm25 名次" }), h("th", { class: "num", text: "RRF" }))
          ),
          h(
            "tbody",
            {},
            ret.fused.slice(0, 10).map((f, i) =>
              h(
                "tr",
                {},
                h("td", { class: "num dim", text: String(i + 1) }),
                h("td", {}, C.docChip(f.chunk.docId), h("span", { style: { marginLeft: "5px" }, text: f.chunk.section })),
                h("td", { class: "num", text: f.ranks[0] || "—" }),
                h("td", { class: "num", text: f.ranks[1] || "—" }),
                h("td", { class: "num", text: f.score.toFixed(4) })
              )
            )
          )
        )
      );

      const tabs = h(
        "div",
        { class: "inline", style: { marginBottom: "10px" } },
        C.seg(
          [
            { value: "lanes", label: "三路对比" },
            { value: "ann", label: "ANN 轨迹" },
            { value: "fuse", label: "融合明细" }
          ],
          retTab,
          (v) => {
            retTab = v;
            UI.rerender();
          }
        ),
        h("span", { class: "faint", style: { fontSize: "10.5px" }, text: "候选池 " + ret.poolSize + " 块（已按文档过滤）" })
      );
      const noConcepts = !ret.query.concepts || Object.keys(ret.query.concepts).length === 0;
      const filterWarn =
        ret.ann.mode !== "prefilter" && ret.poolSize < pack.chunks.length && ret.dense.length < Math.min(S.search.denseK, ret.poolSize)
          ? C.note(
              "post-filter 的代价：向量检索在全库取了 Top-" +
                S.search.denseK +
                "，按元数据筛完只剩 " +
                ret.dense.length +
                " 条（候选池 " +
                ret.poolSize +
                "）。把上面的「过滤时机」切到 pre 看区别。",
              "var(--warn)"
            )
          : null;
      const tabBody = retTab === "lanes" ? lanes : retTab === "ann" ? annPanel : fusePanel;

      const body = grid(
        [
          C.card("召回空间", "点位越近 = 余弦越高", wrap, { flush: true, style: { overflow: "hidden" } }),
          noConcepts
            ? C.note(
                "这个问题没有匹配到已知概念：查询向量是用字面词元临时拼的，场景里的点位只能当作示意；真实系统会走 embedding 模型，不存在「认不出概念」这回事。",
                "var(--warn)"
              )
            : null,
          C.card("召回与融合", null, [filterWarn, tabs, tabBody])
        ],
        [
          C.explain(UI.STAGES[5]),
          C.card(
            "过滤条件（元数据）",
            "先过滤，再排序",
            h("div", {}, C.docFilter(view)),
            h("div", { class: "mini-label", style: { margin: "11px 0 5px" }, text: "过滤时机" }),
            C.seg(
              [
                { value: "pre", label: "先过滤 pre" },
                { value: "post", label: "后过滤 post" }
              ],
              S.search.filterMode,
              (v) => {
                S.search.filterMode = v;
                UI.rerender();
              }
            ),
            h(
              "div",
              { style: { marginTop: "7px" } },
              C.note(
                S.search.filterMode === "post"
                  ? "post：先在全库取 Top-K，再按元数据筛。权限过滤绝不能这么写 —— 无权限的内容会先被算进候选，还可能把有权限的结果挤掉。"
                  : "pre：先按元数据收窄候选池，再检索。权限、密级、时效过滤应该走这条路（分区索引 / filtered HNSW）。",
                S.search.filterMode === "post" ? "var(--warn)" : "var(--line-2)"
              )
            )
          ),
          C.card(
            "检索参数",
            null,
            h(
              "div",
              { style: { marginBottom: "10px" } },
              h("div", { class: "control-head" }, h("span", { text: "向量索引" })),
              C.seg(
                [
                  { value: "hnsw", label: "HNSW" },
                  { value: "flat", label: "Flat" }
                ],
                S.index.type,
                (v) => {
                  S.index.type = v;
                  UI.rerender();
                }
              )
            ),
            C.range("dense Top-K", S.search.denseK, 3, 12, 1, (v) => {
              S.search.denseK = v;
              UI.rerender();
            }),
            C.range("efSearch", S.search.efSearch, 4, 64, 4, (v) => {
              S.search.efSearch = v;
              UI.rerender();
            }),
            C.range("dense 权重", S.search.denseWeight, 0.2, 2, 0.2, (v) => {
              S.search.denseWeight = v;
              UI.rerender();
            }, (v) => Number(v).toFixed(1)),
            C.range("BM25 权重", S.search.sparseWeight, 0.2, 2, 0.2, (v) => {
              S.search.sparseWeight = v;
              UI.rerender();
            }, (v) => Number(v).toFixed(1)),
            C.toggle("混合检索", "关闭后只看向量召回", S.search.useHybrid, (v) => {
              S.search.useHybrid = v;
              UI.rerender();
            })
          ),
          C.card(
            "这次检索的体检指标",
            null,
            C.kv("候选池", ret.poolSize + " 块"),
            C.kv("向量命中", denseIds.size + " 条"),
            C.kv("关键词命中", sparseIds.size + " 条"),
            C.kv("RRF 融合后", ret.fused.length + " 条"),
            C.kv("ANN 召回率", ret.recall == null ? "精确（无近似）" : fmt.pct(ret.recall), ret.recall == null || ret.recall >= 0.99 ? "ok" : "muted"),
            ret.bm25Zero ? C.note("<b>BM25 全 0 分！</b>它仍会按文档顺序返回 Top-1，看起来像命中 —— 必须看分数。", "var(--bad)") : null
          ),
          C.notes(UI.STAGES[5]),
          C.pitfall("关掉「混合检索」，看 q2 的正确答案掉到第几；再把 efSearch 拖到 4，看 Recall 掉不掉。")
        ]
      );

      return {
        badges: [
          C.badge("dense " + denseIds.size + " / bm25 " + sparseIds.size, "info"),
          C.badge("Recall " + (ret.recall == null ? "精确" : fmt.pct(ret.recall)), ret.recall != null && ret.recall >= 0.99 ? "ok" : "warn")
        ],
        body
      };
    }
  };

  /* ======================================================== 7. 重排 */

  UI.stages.rerank = {
    render(view) {
      const ret = view.ret;
      const before = ret.fused.slice(0, ret.rerankN);
      const after = ret.reranked;
      const afterMap = new Map(after.map((a, i) => [a.chunk.id, { rank: i + 1, score: a.score }]));
      const selectedId = S.selectedChunkId && afterMap.has(S.selectedChunkId) ? S.selectedChunkId : after[0] && after[0].chunk.id;
      const selected = after.find((a) => a.chunk.id === selectedId) || after[0];
      const rerankOff = S.search.useRerank === false;

      const beforeRows = before.map((f, i) => {
        const a = afterMap.get(f.chunk.id);
        const delta = a ? i + 1 - a.rank : null;
        return h(
          "button",
          {
            class: "rk-item" + (a ? " promote" : "") + (selectedId === f.chunk.id ? " on" : ""),
            on: {
              click: () => {
                S.selectedChunkId = f.chunk.id;
                UI.render({ scroll: false });
              }
            }
          },
          h("span", { class: "pos", text: String(i + 1) }),
          h("span", { class: "t" }, f.chunk.section, h("small", { text: f.chunk.docShort + " · RRF " + f.score.toFixed(4) })),
          h(
            "span",
            { class: "s" },
            a ? "→ " + a.rank : "→ 出局",
            delta && delta !== 0 ? h("span", { class: "delta" + (delta < 0 ? " down" : ""), text: (delta > 0 ? " ↑" + delta : " ↓" + Math.abs(delta)) }) : null
          )
        );
      });

      const afterRows = after.map((a, i) =>
        h(
          "button",
          {
            class: "rk-item" + (selectedId === a.chunk.id ? " on" : ""),
            on: {
              click: () => {
                S.selectedChunkId = a.chunk.id;
                UI.render({ scroll: false });
              }
            }
          },
          h("span", { class: "pos", text: String(i + 1) }),
          h("span", { class: "t" }, a.chunk.section, h("small", { text: a.chunk.docShort + " · 覆盖 " + (a.coverage == null ? "—" : fmt.pct(a.coverage)) })),
          h("span", { class: "s", text: fmt.score(a.score) })
        )
      );

      const breakdown = selected
        ? h(
            "div",
            {},
            h(
              "div",
              { class: "inline", style: { marginBottom: "8px" } },
              C.docChip(selected.chunk.docId),
              C.tag(selected.chunk.section),
              selected.beforeRank ? C.tag("原第 " + selected.beforeRank + " 位") : null
            ),
            h(
              "div",
              { class: "score-break" },
              C.scoreLine("答案覆盖度" + (rerankOff ? "（未启用）" : ""), selected.coverage == null ? 0 : selected.coverage, selected.coverage == null ? "—" : fmt.pct(selected.coverage), "#fbbf24"),
              C.scoreLine("语义相似", selected.denseScore, fmt.score(selected.denseScore), "#22d3ee"),
              C.scoreLine("字面重合", selected.lexical, fmt.pct(selected.lexical), "#a3e635"),
              C.scoreLine(rerankOff ? "融合分数（RRF）" : "重排总分", selected.score, fmt.score(selected.score), "#4ade80")
            ),
            h("div", { class: "prompt", style: { marginTop: "9px" } }, h("span", { class: "sys", text: "# 演示用打分器（真实 cross-encoder 会读 query+chunk 的每个 token）\n" }), "0.60 × coverage + 0.28 × cosine + 0.12 × lexical"),
            h("div", { class: "ctx-item", style: { marginTop: "9px" } }, h("div", { class: "ci-text", text: selected.chunk.text }))
          )
        : C.empty("没有候选");

      const body = grid(
        [
          C.card(
            "候选重排",
            rerankOff ? "重排已关闭：直接按 RRF 取 Top-N" : ret.rerankN + " 个候选 → " + after.length + " 个上下文",
            rerankOff
              ? C.note("重排关闭时，上下文直接取融合后的前几名。召回阶段的排序没有读过 query-chunk 的交互，容易把「主题相关但没有答案」的块排上来。", "var(--warn)")
              : h("div", { class: "rerank-grid" }, h("div", { class: "rk-col" }, h("div", { class: "rk-head" }, h("span", { text: "重排前 · RRF 融合" }), h("span", { text: before.length + " 条" })), h("div", { class: "rk-body" }, beforeRows)), h("div", { class: "rk-col" }, h("div", { class: "rk-head" }, h("span", { text: "重排后 · cross-encoder" }), h("span", { text: after.length + " 条" })), h("div", { class: "rk-body" }, afterRows)))
          ),
          C.card("为什么这个分数？", selected ? selected.chunk.id : "", breakdown)
        ],
        [
          C.explain(UI.STAGES[6]),
          C.card(
            "重排开关与预算",
            null,
            C.toggle("启用重排", "关闭后直接用 RRF 排序结果", S.search.useRerank, (v) => {
              S.search.useRerank = v;
              UI.rerender();
            }),
            C.range("候选数（rerank Top-N）", S.search.rerankN, 4, 20, 2, (v) => {
              S.search.rerankN = v;
              UI.rerender();
            }),
            C.range("最终上下文块数", S.search.contextN, 2, 8, 1, (v) => {
              S.search.contextN = v;
              S.search.rerankN = Math.max(S.search.rerankN, v * 2);
              UI.rerender();
            })
          ),
          C.card(
            "成本与延迟",
            null,
            C.metrics([
              [rerankOff ? 0 : ret.rerankN, "送入模型"],
              [after.length, "留在上下文"],
              [fmt.ms(view.timings.rerank), "重排耗时"],
              ["¥" + (rerankOff ? "0.0000" : (0.00012 * ret.rerankN).toFixed(4)), "估算成本"]
            ]),
            h("div", { style: { marginTop: "8px" } }, C.kv("模型", rerankOff ? "未启用" : "bge-reranker-v2-m3（示意）"), C.kv("输入", "query + 每个候选，拼起来过模型"))
          ),
          C.notes(UI.STAGES[6]),
          C.pitfall("点一个被降权的候选，看「答案覆盖度」这一栏。主题像不等于有答案，这是 rerank 最核心的价值。")
        ]
      );

      return {
        badges: [
          C.badge(rerankOff ? "重排 OFF" : "重排 ON", rerankOff ? "warn" : "info"),
          C.badge(ret.rerankN + " → " + after.length, "")
        ],
        body
      };
    }
  };

  /* ======================================================== 8. 上下文与生成 */

  function buildPrompt(view) {
    const q = view.ret.query;
    const items = view.ctx.items;
    const ctxText = items
      .map((it) => "[" + it.citation + "] 来源：" + it.chunk.docShort + " / " + it.chunk.section + "\n" + it.text)
      .join("\n\n");
    return {
      system:
        "你是公司制度问答助手。只依据 <资料> 回答，不要使用资料之外的知识。\n" +
        "每个结论后面用 [编号] 标注依据；资料不足时直接回答「资料中没有提到」。",
      user: "<资料>\n" + (ctxText || "（空）") + "\n</资料>\n\n问题：" + q.text
    };
  }

  UI.stages.generate = {
    render(view) {
      const ctx = view.ctx;
      const ans = view.answer;
      const q = view.ret.query;
      const prompt = buildPrompt(view);

      const bar = h(
        "div",
        { class: "budget", "aria-label": "上下文 token 预算" },
        ctx.items.map((it) =>
          h("div", {
            style: {
              flexGrow: it.tokens,
              flexBasis: "0px",
              background: it.chunk.color,
              opacity: 0.72
            },
            title: "[" + it.citation + "] " + it.chunk.section + " · " + it.tokens + " tokens"
          })
        ),
        h("div", {
          style: { flexGrow: Math.max(1, ctx.budget - ctx.tokens), flexBasis: "0px", background: "var(--panel-3)" },
          title: "剩余预算"
        })
      );

      const items = ctx.items.map((it) =>
        h(
          "div",
          { class: "ctx-item", dataset: { cite: it.citation, cid: it.chunk.id } },
          h(
            "div",
            { class: "ci-head" },
            h("span", { class: "ci-cite", text: String(it.citation) }),
            C.docChip(it.chunk.docId),
            h("span", { class: "ci-src", text: it.chunk.section }),
            h("span", { class: "ci-tok", text: it.tokens + " tok" + (it.saved ? " · 压缩省 " + it.saved + " 字" : "") })
          ),
          h("div", { class: "ci-text", text: it.text })
        )
      );

      const dropped = ctx.dropped.map((it) =>
        h(
          "div",
          { class: "ctx-item dropped" },
          h("div", { class: "ci-head" }, h("span", { class: "ci-cite", text: "—" }), C.docChip(it.chunk.docId), h("span", { class: "ci-src", text: it.chunk.section }), h("span", { class: "ci-tok", text: "超出预算，未放入" }))
        )
      );

      const answerEl = h("div", { class: "answer" + (ans.refused ? " refused" : ""), "aria-live": "polite" });
      if (ans.refused) {
        answerEl.appendChild(h("div", { style: { fontWeight: "600", marginBottom: "5px" }, text: "资料中没有提到，无法回答。" }));
        answerEl.appendChild(h("div", { class: "faint", style: { fontSize: "11.5px" }, text: "拒答原因：" + ans.reason + (ans.topScore != null ? "（最高分 " + fmt.score(ans.topScore) + " < 阈值 " + S.ctx.threshold + "）" : "") }));
      } else {
        ans.sentences.forEach((s, i) => {
          const span = h("span", { class: "ans-sent", style: { animationDelay: Math.min(1.2, i * 0.18) + "s" } });
          span.appendChild(document.createTextNode(s.text + " "));
          if (s.cite != null) {
            const chip = h("button", { class: "cite", text: String(s.cite), "aria-label": "跳转到引用 " + s.cite });
            chip.addEventListener("click", () => {
              const target = document.querySelector('[data-cite="' + s.cite + '"]');
              if (target) {
                target.scrollIntoView({ block: "nearest", behavior: "smooth" });
                target.classList.add("flash");
                setTimeout(() => target.classList.remove("flash"), 1200);
              }
            });
            span.appendChild(chip);
          }
          answerEl.appendChild(span);
        });
        if (ans.ungrounded) {
          answerEl.appendChild(h("div", { style: { marginTop: "8px" } }, C.note("这段回答没有引用，也没有经过事实校验 —— 模型在凭参数记忆作答。", "var(--bad)")));
        }
        if (ans.partial) {
          answerEl.appendChild(h("div", { style: { marginTop: "8px" }, class: "faint", text: "资料只覆盖了部分要点：缺少 " + ans.missing.join("、") }));
        }
      }

      const promptEl = h("div", { class: "prompt" });
      promptEl.innerHTML =
        '<span class="sys"># system</span>\n' +
        esc(prompt.system) +
        '\n\n<span class="sys"># user</span>\n' +
        '<span class="ctx">' +
        esc(prompt.user) +
        "</span>";

      const contextCard = C.card(
        "上下文窗口",
        ctx.tokens + " / " + ctx.budget + " tokens",
        [
          bar,
          h(
            "div",
            { class: "inline", style: { margin: "10px 0" } },
            C.seg(
              [
                { value: "score", label: "按分数排" },
                { value: "sandwich", label: "首尾放强证据" }
              ],
              S.ctx.order,
              (v) => {
                S.ctx.order = v;
                UI.rerender();
              }
            ),
            C.toggle("上下文压缩", "只保留相关句", S.ctx.compress, (v) => {
              S.ctx.compress = v;
              UI.rerender();
            })
          ),
          items,
          dropped.length ? h("div", { class: "mini-label", style: { margin: "10px 0 6px" }, text: "因预算被丢弃" }) : null,
          dropped
        ]
      );
      const answerCard = C.card(
        "回答",
        ans.refused ? "已拒答" : ans.sentences.length + " 句 · " + (ans.ungrounded ? "无引用" : "带引用"),
        [answerEl],
        { right: h("span", { class: "tag " + (ans.refused ? "bad" : "ok"), text: ans.refused ? "REFUSED" : S.ctx.freeform ? "UNGROUNDED" : "GROUNDED" }) }
      );
      const promptCard = C.card("提示词（Prompt）", "引用编号来自上下文顺序", promptEl, { flush: true });

      const body = grid(
        [
          h(
            "div",
            { class: "gen-grid" },
            contextCard,
            h("div", { class: "gen-side" }, answerCard, promptCard)
          )
        ],
        [
          C.explain(UI.STAGES[7]),
          C.card(
            "生成参数",
            null,
            C.range("上下文块数", S.search.contextN, 2, 8, 1, (v) => {
              S.search.contextN = v;
              UI.rerender();
            }),
            C.range("token 预算", S.ctx.budget, 300, 1600, 100, (v) => {
              S.ctx.budget = v;
              UI.rerender();
            }),
            C.range("拒答阈值", S.ctx.threshold, 0.1, 0.9, 0.05, (v) => {
              S.ctx.threshold = v;
              UI.rerender();
            }, (v) => Number(v).toFixed(2)),
            C.toggle("不加引用约束（裸模型）", "模拟模型只凭记忆回答", S.ctx.freeform, (v) => {
              S.ctx.freeform = v;
              UI.rerender();
            })
          ),
          C.card(
            "成本",
            null,
            C.metrics([
              [ctx.tokens, "上下文 tokens"],
              [view.cost.completionTokens, "输出 tokens"],
              ["¥" + view.cost.cny.toFixed(4), "本次成本"],
              [fmt.ms(view.timings.llm), "生成耗时"]
            ])
          ),
          C.notes(UI.STAGES[7]),
          C.pitfall("点答案里的引用编号，左边会跳到对应的上下文块。再把「不加引用约束」打开，看没有依据的回答长什么样。")
        ]
      );

      return {
        badges: [
          C.badge(ctx.tokens + " tok", "info"),
          C.badge(ans.refused ? "拒答" : ans.ungrounded ? "无引用" : "有引用", ans.refused ? "warn" : ans.ungrounded ? "bad" : "ok")
        ],
        body
      };
    }
  };

  /* ======================================================== 9. 校验与评测 */

  let evalCache = { key: "", data: null };

  function getEval(pack) {
    const key = JSON.stringify([pack.key, S.search, S.index]);
    if (evalCache.key === key) return evalCache.data;
    const base = UI.searchState();
    const data = {
      vector: E.evaluate(pack, base, { evalMode: "vector" }),
      fused: E.evaluate(pack, base, { evalMode: "fused" }),
      reranked: E.evaluate(pack, base, { evalMode: "reranked" })
    };
    evalCache = { key, data };
    return data;
  }

  UI.stages.verify = {
    render(view) {
      const ans = view.answer;
      const v = view.verify;
      const ctx = view.ctx;
      const q = view.ret.query;
      const ev = getEval(view.pack);

      const claims = v.claims.length
        ? v.claims.map((c) =>
            h(
              "div",
              { class: "claim " + (c.supported ? "ok" : "bad") },
              h("span", { class: "mark", text: c.supported ? "✓" : "✕" }),
              h("div", { class: "ctext", text: c.text }),
              h(
                "div",
                { class: "cmeta" },
                c.cite != null ? "引用 [" + c.cite + "]" : "无引用",
                h("br"),
                "置信 " + c.confidence.toFixed(2)
              )
            )
          )
        : [C.empty("没有可校验的句子（拒答或上下文为空）")];

      const precision =
        q.goldDoc && ctx.items.length
          ? ctx.items.filter((it) => it.chunk.docId === q.goldDoc && it.chunk.section === q.goldSection).length / ctx.items.length
          : null;

      const evalRows = [
        ["纯向量召回", ev.vector, "dense"],
        ["混合召回（RRF）", ev.fused, "fused"],
        ["混合 + 重排", ev.reranked, "reranked"]
      ].map(([name, r, key]) =>
        h(
          "tr",
          { style: key === "reranked" ? { background: "rgba(74,222,128,.05)" } : null },
          h("td", {}, name, key === "reranked" ? h("span", { class: "tag ok", style: { marginLeft: "6px" }, text: "当前" }) : null),
          h("td", { class: "num" + (r.r1 >= 0.99 ? " hi" : ""), text: r.r1.toFixed(2) }),
          h("td", { class: "num", text: r.r3.toFixed(2) }),
          h("td", { class: "num", text: r.r5.toFixed(2) }),
          h("td", { class: "num", text: r.mrr.toFixed(3) })
        )
      );

      const wf = [
        ["解析", view.timings.parse, "#7dd3fc"],
        ["分块", view.timings.chunk, "#34d399"],
        ["向量化", view.timings.embed, "#a3e635"],
        ["建索引", view.timings.index, "#60a5fa"],
        ["改写/扩展", view.timings.rewrite + view.timings.multi + view.timings.hyde, "#f0abfc"],
        ["查询向量", view.timings.queryEmbed, "#a3e635"],
        ["ANN 检索", view.timings.ann, "#22d3ee"],
        ["BM25", view.timings.bm25, "#a3e635"],
        ["融合", view.timings.fuse, "#fbbf24"],
        ["重排", view.timings.rerank, "#fbbf24"],
        ["上下文", view.timings.context, "#fb923c"],
        ["LLM 生成", view.timings.llm, "#fb923c"],
        ["引用校验", view.timings.verify, "#4ade80"]
      ];
      const maxT = Math.max.apply(null, wf.map((x) => x[1] || 0).concat([1]));
      const waterfall = h(
        "div",
        { class: "waterfall" },
        wf.map(([name, ms, color]) =>
          h(
            "div",
            { class: "wf-row", style: { "--c": color } },
            h("span", { text: name }),
            h("div", { class: "wf-bar" }, h("i", { style: { width: Math.max(0.6, ((ms || 0) / maxT) * 100) + "%" } })),
            h("b", { text: fmt.msShort(ms) })
          )
        )
      );

      const body = grid(
        [
          C.card(
            "逐句核验",
            ans.refused ? "拒答，不走校验" : "每一句都要能在引用块里找到原文",
            [
              h(
                "div",
                { class: "metric-grid", style: { marginBottom: "10px" } },
                C.metric(v.claims.length ? v.faithfulness.toFixed(2) : "—", "faithfulness（忠实度）", true),
                C.metric(v.factCoverage == null ? "—" : fmt.pct(v.factCoverage), "关键事实覆盖"),
                C.metric(precision == null ? "—" : fmt.pct(precision), "context precision"),
                C.metric(ans.refused ? "—" : fmt.score(ans.topScore), "最高相关性")
              ),
              claims
            ]
          ),
          C.card(
            "离线评测：三种召回配置",
            "5 道有答案题 · 同一份索引",
            h(
              "table",
              { class: "table eval-matrix" },
              h("thead", {}, h("tr", {}, h("th", { text: "配置" }), h("th", { class: "num", text: "R@1" }), h("th", { class: "num", text: "R@3" }), h("th", { class: "num", text: "R@5" }), h("th", { class: "num", text: "MRR" }))),
              h("tbody", {}, evalRows)
            ),
            h(
              "div",
              { style: { marginTop: "9px" } },
              C.note(
                ev.vector.r5 >= 0.99
                  ? "R@5 三种配置都是 1.00 —— 语料只有 4 篇、题目也不难，指标已经饱和（rag/README 坑 9）。真实项目要专门构造难例。"
                  : "注意 R@1 和 R@5 的差距：正确答案常在候选里，只是排得不够前 —— 这正是重排要解决的问题。",
                "var(--line-2)"
              )
            )
          ),
          C.card("耗时瀑布", "在线总耗时 " + fmt.ms(view.timings.online), waterfall)
        ],
        [
          C.explain(UI.STAGES[8]),
          C.card(
            "拒答阈值",
            "产品策略，不是技术参数",
            C.range("阈值", S.ctx.threshold, 0.1, 0.9, 0.05, (val) => {
              S.ctx.threshold = val;
              UI.rerender();
            }, (val) => Number(val).toFixed(2)),
            C.kv("当前最高分", ans.topScore == null ? "—" : fmt.score(ans.topScore)),
            C.kv("判定", ans.refused ? "拒答" : "作答", ans.refused ? "muted" : "ok"),
            h("div", { style: { marginTop: "7px" } }, C.note("调低 → 更容易硬答（可能幻觉）；调高 → 更容易拒答（可能漏答）。", "var(--line-2)"))
          ),
          C.card(
            "评测 & 成本",
            null,
            C.kv("检索 R@1", ev.reranked.r1.toFixed(2)),
            C.kv("MRR", ev.reranked.mrr.toFixed(3)),
            C.kv("token 成本", "¥" + view.cost.cny.toFixed(4)),
            C.kv("在线延迟", fmt.ms(view.timings.online)),
            C.kv("校验", ans.refused ? "跳过" : v.faithfulness.toFixed(2) + " / 1.00", "ok")
          ),
          C.notes(UI.STAGES[8]),
          C.pitfall("把拒答阈值拖到 0.10，无答案的问题会变成硬答；再拖回 0.45。阈值决定的是产品行为，不只是分数。")
        ]
      );

      return {
        badges: [
          C.badge("faithfulness " + (v.claims.length ? v.faithfulness.toFixed(2) : "—"), v.claims.length && v.faithfulness >= 0.99 ? "ok" : "warn"),
          C.badge("评测 R@1 " + ev.reranked.r1.toFixed(2), "info"),
          C.badge("阈值 " + Number(S.ctx.threshold).toFixed(2), "")
        ],
        body
      };
    }
  };

  /** 允许从 URL 指定召回页的子标签（lanes / ann / fuse）。 */
  UI.retTabSetter = function (v) {
    if (["lanes", "ann", "fuse"].indexOf(v) >= 0) retTab = v;
  };
})(window);
