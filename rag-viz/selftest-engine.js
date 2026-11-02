/* 临时自检脚本：在 Node 里跑检索内核，验证分块/BM25/HNSW/rerank 的数字是否合理。 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

global.window = global;
const dir = path.join(__dirname, "assets");
for (const f of ["data.js", "engine.js"]) {
  vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f });
}

const E = global.RAG_ENGINE;
const D = global.RAG_DATA;

function pad(s, n) {
  s = String(s);
  const w = [...s].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, n - w));
}

const pack = E.buildPack({ strategy: "markdown_recursive", chunkSize: 200, overlap: 40 });
console.log("=== 分块 ===");
console.log(JSON.stringify(pack.stats, null, 1));
console.log("文档块数:", pack.perDoc.map((d) => d.doc.id + ":" + d.chunks.length).join(" "));
console.log("首块:", pack.chunks[0].id, pack.chunks[0].chars, JSON.stringify(pack.chunks[0].text.slice(0, 40)));
console.log(
  "块:",
  pack.chunks.map((c) => `${c.id}[${c.section.slice(0, 6)}]${c.chars}${c.truncated ? "!" : ""}`).join(" ")
);

for (const strategy of ["markdown_recursive", "markdown", "recursive", "fixed"]) {
  const p = E.buildPack({ strategy, chunkSize: 200, overlap: 50 });
  console.log(
    `\n策略 ${strategy}: 块数=${p.stats.count} 中位=${p.stats.median} 最大=${p.stats.max} 截断=${p.stats.truncated} 元数据=${p.stats.metaChunks} 平均重叠=${p.stats.avgOverlap.toFixed(1)}`
  );
}
for (const size of [120, 200, 350, 500]) {
  const p = E.buildPack({ strategy: "markdown_recursive", chunkSize: size, overlap: 50 });
  console.log(
    `chunk_size=${size}: 块数=${p.stats.count} 中位=${p.stats.median} 最大=${p.stats.max} 截断=${p.stats.truncated} 平均重叠=${p.stats.avgOverlap.toFixed(1)}`
  );
}

const baseState = {
  queryId: "q1",
  denseK: 10,
  sparseK: 10,
  efSearch: 24,
  indexType: "hnsw",
  useHybrid: true,
  useRerank: true,
  rerankN: 20,
  contextN: 5,
  rrfK: 60,
  denseWeight: 1,
  sparseWeight: 1,
  filters: {},
  useRewrite: false,
  useHyde: false
};

console.log("\n=== 每题四路结果 ===");
for (const q of D.QUERIES) {
  const r = E.retrieve(pack, Object.assign({}, baseState, { queryId: q.id }));
  const fmt = (arr) =>
    arr
      .slice(0, 3)
      .map((x) => `${x.chunk.docId}/${x.chunk.section.slice(0, 8)}:${(x.score == null ? 0 : x.score).toFixed(3)}`)
      .join(" | ");
  console.log(`\n[${q.id}] ${q.text}  (pool=${r.poolSize}, recall=${r.recall === null ? "-" : r.recall.toFixed(2)}, dists=${r.ann.dists})`);
  console.log("  dense :", fmt(r.dense));
  console.log("  bm25  :", fmt(r.sparse), r.bm25Zero ? "(全0!)" : "");
  console.log("  fused :", fmt(r.fused));
  console.log("  rerank:", fmt(r.reranked));
  const ctx = E.assembleContext(r.reranked, { topN: 4, budgetTokens: 900, compress: false, queryText: r.query.text });
  const ans = E.composeAnswer(r.query, ctx, { threshold: 0.45 });
  console.log(
    "  answer:",
    ans.refused ? "拒答(" + ans.reason + ")" : ans.sentences.map((s) => s.text.slice(0, 40) + (s.cite ? `[${s.cite}]` : "")).join(" ")
  );
  console.log("  ctxTokens:", ctx.tokens, "coverage:", ans.coverage);
}

console.log("\n=== HNSW efSearch 扫描 ===");
for (const ef of [1, 2, 4, 8, 16, 32, 64]) {
  const r = E.retrieve(pack, Object.assign({}, baseState, { efSearch: ef, denseK: 10 }));
  console.log(`ef=${String(ef).padStart(2)}  recall=${r.recall.toFixed(2)}  dists=${String(r.ann.dists).padStart(3)}  visited=${r.ann.visitedOrder.length}`);
}

console.log("\n=== 过滤 ===");
const f1 = E.retrieve(pack, Object.assign({}, baseState, { filters: { docs: ["leave", "security", "it"] } }));
console.log("排除差旅:", f1.dense.slice(0, 3).map((x) => x.chunk.docId).join(","), "pool", f1.poolSize);
const f2 = E.retrieve(pack, Object.assign({}, baseState, { filters: { freshOnly: true } }));
console.log("仅2026H2:", f2.dense.slice(0, 3).map((x) => x.chunk.docId).join(","), "pool", f2.poolSize);
const f3 = E.retrieve(pack, Object.assign({}, baseState, { filters: { docs: ["travel"] } }));
console.log("只差旅:", f3.dense.slice(0, 3).map((x) => x.chunk.section).join(" | "));

console.log("\n=== 关闭混合 / 关闭 rerank ===");
const nh = E.retrieve(pack, Object.assign({}, baseState, { queryId: "q2", useHybrid: false }));
console.log("q2 纯向量 dense:", nh.dense.slice(0, 2).map((x) => x.chunk.section).join(" | "));
const nr = E.retrieve(pack, Object.assign({}, baseState, { queryId: "q1", useRerank: false }));
console.log("q1 不重排:", nr.reranked.slice(0, 3).map((x) => x.chunk.section + ":" + x.score.toFixed(3)).join(" | "));
console.log("q1 重排  :", E.retrieve(pack, baseState).reranked.slice(0, 3).map((x) => x.chunk.section + ":" + x.score.toFixed(3)).join(" | "));

console.log("\n=== 评估 ===");
for (const mode of ["vector", "fused", "reranked"]) {
  const ev = E.evaluate(pack, baseState, { evalMode: mode });
  console.log(
    `${mode.padEnd(9)}: R@1=${ev.r1.toFixed(2)} R@3=${ev.r3.toFixed(2)} R@5=${ev.r5.toFixed(2)} MRR=${ev.mrr.toFixed(3)}  ranks=[${ev.rows.map((r) => r.rank).join(",")}]`
  );
}

console.log("\n=== 多查询 ===");
const mq = E.retrieve(pack, Object.assign({}, baseState, { queryId: "q2", useMultiQuery: true }));
console.log("variants:", mq.multi && mq.multi.variants.length, "dense top:", mq.dense.slice(0, 3).map((x) => x.chunk.section + ":" + x.score.toFixed(3)).join(" | "));
console.log("rerank top:", mq.reranked.map((x) => x.chunk.section).join(" | "));

console.log("\n=== 校验 ===");
const q1 = E.retrieve(pack, baseState);
const ctx1 = E.assembleContext(q1.reranked, { topN: 4, budgetTokens: 900, compress: false, queryText: q1.query.text });
const a1 = E.composeAnswer(q1.query, ctx1, { threshold: 0.45 });
const v1 = E.verifyClaims(a1, ctx1, q1.query);
console.log("q1 answer:", a1.sentences.map((s) => s.text + "[" + s.cite + "]").join(" || "));
console.log("claims:", v1.claims.map((c) => `${c.supported ? "✓" : "✗"}${c.confidence.toFixed(2)}`).join(" "), "faithfulness:", v1.faithfulness);
const aBad = E.composeAnswer(q1.query, ctx1, { freeform: true });
const vBad = E.verifyClaims(aBad, ctx1, q1.query);
console.log("裸模型:", aBad.sentences[0].text, "supported:", vBad.claims[0].supported, "faithfulness:", vBad.faithfulness);

const q6 = E.retrieve(pack, Object.assign({}, baseState, { queryId: "q6" }));
const ctx6 = E.assembleContext(q6.reranked, { topN: 4, budgetTokens: 900, compress: false, queryText: q6.query.text });
console.log("q6 answer:", JSON.stringify(E.composeAnswer(q6.query, ctx6, { threshold: 0.45 })));

const q2 = E.retrieve(pack, Object.assign({}, baseState, { queryId: "q2" }));
const ctx2 = E.assembleContext(q2.reranked, { topN: 4, budgetTokens: 900, compress: false, queryText: q2.query.text });
const a2 = E.composeAnswer(q2.query, ctx2, { threshold: 0.45 });
console.log("q2 answer:", a2.sentences.map((s) => s.text + "[" + s.cite + "]").join(" || "));

console.log("\n=== 自定义问题 ===");
const c1 = E.retrieve(pack, Object.assign({}, baseState, { queryId: "custom", customQuery: "出差住宿费能报多少" }));
console.log("concepts:", JSON.stringify(c1.query.concepts), "dense top:", c1.dense[0] && c1.dense[0].chunk.section, c1.dense[0] && c1.dense[0].score.toFixed(3));
const c2 = E.retrieve(pack, Object.assign({}, baseState, { queryId: "custom", customQuery: "今天天气怎么样" }));
console.log("无概念:", JSON.stringify(c2.query.concepts), "dense top:", c2.dense[0] && c2.dense[0].chunk.docId, "bm25Zero", c2.bm25Zero);

console.log("\n=== 数值健全性 ===");
let bad = 0;
pack.chunks.forEach((c) => {
  if (!c.vector.every(Number.isFinite)) bad++;
  if (!c.coord.every(Number.isFinite)) bad++;
});
console.log("NaN/Inf 块数:", bad, " 向量维度:", pack.vectors[0].length, " 坐标范围:", JSON.stringify(pack.projection.coords.reduce((a, c) => [Math.min(a[0], ...c), Math.max(a[1], ...c)], [0, 0])));
