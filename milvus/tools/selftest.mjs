// Engine self-test: the numbers the page claims to compute are asserted here.
// Usage: node tools/selftest.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const base = path.join(here, '..', 'src', 'js');
[
  'data.corpus.js',
  'data.questions.js',
  'data.milvus.js',
  'engine.text.js',
  'engine.embed.js',
  'engine.bm25.js',
  'engine.hnsw.js',
  'engine.fuse.js',
  'engine.pipeline.js'
].forEach((f) => require(path.join(base, f)));

const M = globalThis.MILVUS;
const P = M.Pipe;
const Text = M.Text;

const p = {
  chunkSize: 120,
  chunkOverlap: 40,
  byHeading: true,
  normalize: true,
  dim: 1024,
  bm25: true,
  dynamic: false,
  pk: 'int64',
  indexType: 'HNSW',
  M: 8,
  efConstruction: 200,
  nlist: 8,
  metric: 'COSINE',
  consistency: 'Bounded',
  batch: 500,
  t: 1,
  question: 'q1',
  customQuestion: '',
  limit: 5,
  ef: 64,
  nprobe: 3,
  growing: 20,
  nodes: 3,
  shards: 2,
  cand: 5,
  filterMode: 'pre',
  filterLimit: 1,
  filter: { dept: 'all', updatedFrom: '', acl: 'all' },
  ranker: 'weighted',
  wDense: 0.8,
  wSparse: 1,
  k1: 1.2,
  b: 0.75,
  rerank: true,
  topN: 5,
  budget: 700,
  threshold: 0.45,
  dimMismatch: false
};

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log('  ok  ' + name + (detail ? ' — ' + detail : ''));
  } else {
    failures.push(name + (detail ? ' — ' + detail : ''));
    console.log('  FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

console.log('\n# text / tokenizer');
const toks = Text.tokenize('VX-2048 是维度错误');
check('VX-2048 kept as one token', toks.includes('vx-2048'));
check('Chinese bigrams', toks.includes('维度') && toks.includes('错误'), toks.join(' '));

console.log('\n# chunking');
let model = P.getModel(p);
check('default chunk count', model.chunks.length === 32, model.chunks.length + ' chunks');
check('median length reported', Math.round(model.stats.median) === 98, model.stats.median);
check('measured overlap = 40', model.stats.measuredOverlap === 40, model.stats.measuredOverlap);
check('metadata coverage 100%', model.stats.coveragePct === 1);
const before = model.chunks.length;
p.chunkSize = 300;
model = P.getModel(p);
check('chunk size changes count', model.chunks.length !== before, before + ' → ' + model.chunks.length);
p.chunkSize = 120;
p.byHeading = false;
model = P.getModel(p);
check('no-heading chunking has overlap', model.stats.measuredOverlap >= 40, model.stats.measuredOverlap);
p.byHeading = true;

console.log('\n# embeddings / metrics');
p.normalize = true;
model = P.getModel(p);
const e = model.embedder;
const qv = P.queryVectorOf(p);
check('same text → same vector', e.embed('同一段文本') + '' === e.embed('同一段文本') + '');
const cos = e.cosine(qv, model.vectors[0]);
const ip = e.dot(qv, model.vectors[0]);
check('normalized vectors: cosine == ip', Math.abs(cos - ip) < 1e-9, `${cos.toFixed(6)} / ${ip.toFixed(6)}`);
const rankBy = (fn) =>
  model.chunks
    .map((c, i) => ({ id: c.id, s: fn(qv, model.vectors[i]) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((x) => x.id);
check('normalized: COSINE and IP same order', rankBy(e.cosine).join() === rankBy(e.dot).join());
p.normalize = false;
model = P.getModel(p);
const qv2 = P.queryVectorOf(p);
const rankBy2 = (fn) =>
  model.chunks
    .map((c, i) => ({ id: c.id, s: fn(qv2, model.vectors[i]) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map((x) => x.id);
check('unnormalized: COSINE and IP differ', rankBy2(model.embedder.cosine).join() !== rankBy2(model.embedder.dot).join());
p.normalize = true;

console.log('\n# BM25');
p.question = 'q2';
const bm = P.getBM25(p);
const bmres = bm.search(P.questionOf(p).text, { limit: 5, k1: 1.2, b: 0.75 });
check('BM25 N = chunks', bm.N === P.getModel(p).chunks.length, bm.N + '');
check('BM25 exact code ranks #1', bmres.top[0] && bmres.top[0].chunk.id === 'C28', bmres.top[0] && bmres.top[0].chunk.id);
const ex = bm.explain('C28', P.questionOf(p).text, { k1: 1.2, b: 0.75 });
const sumParts = ex.parts.reduce((s, x) => s + x.contribution, 0);
check('single-doc score = Σ term contributions', Math.abs(sumParts - ex.score) < 1e-9);

console.log('\n# HNSW / IVF');
p.question = 'q1';
p.indexType = 'HNSW';
let idx = P.getIndex(p);
let qv3 = P.queryVectorOf(p);
const r8 = idx.recallAt(qv3, 5, { ef: 8 });
const r160 = idx.recallAt(qv3, 5, { ef: 160 });
check('HNSW ef 8 loses recall', r8 < 1, 'recall ' + r8.toFixed(2));
check('HNSW ef 160 recovers recall', r160 === 1);
check('HNSW graph has edges', idx.graph && idx.graph.neighbors.some((l) => (l[0] || []).length > 0));
const mem = idx.memory();
const expected = idx.chunks.length * p.M * 4 + idx.chunks.length * p.dim * 4;
check('HNSW memory formula', mem.bytes === expected, mem.bytes + ' B');
p.indexType = 'IVF_FLAT';
idx = P.getIndex(p);
const ivfA = idx.recallAt(P.queryVectorOf(p), 5, { nprobe: 1 });
const ivfB = idx.recallAt(P.queryVectorOf(p), 5, { nprobe: idx.nlist });
check('IVF nprobe 1 < nprobe all', ivfA < ivfB, `${ivfA.toFixed(2)} / ${ivfB.toFixed(2)}`);
p.indexType = 'HNSW';

console.log('\n# fusion / rerank');
p.question = 'q2';
const funnel = P.fused(p);
check('dense path returns 5', funnel.dense.length === 5);
check('BM25 path has candidates', funnel.sparse.length >= 3, funnel.sparse.length + ' items');
const denseTop = funnel.dense[0].chunk.id;
const fusedTop = funnel.rows[0].chunk.id;
check('fusion lifts exact code above dense top', denseTop !== 'C28' && fusedTop === 'C28', `${denseTop} → ${fusedTop}`);
const rrf = M.Fuse.rrf([funnel.dense, funnel.sparse], 60);
check('RRF scores descending', rrf.every((x, i) => i === 0 || rrf[i - 1].score >= x.score));
const ranked = P.ranked(p);
check('rerank has confidence in [0,1]', ranked.items.every((x) => x.confidence >= 0 && x.confidence <= 1));

console.log('\n# filter');
p.question = 'q1';
p.filter = { dept: 'all', updatedFrom: '', acl: 'finance' };
p.filterLimit = 1;
const fs = P.filterSimulation(p);
check('pre-filter keeps 1 finance chunk', fs.pre.items.length === 1 && fs.preHit === 1);
check('post-filter empties result', fs.post.items.length === 0 && fs.postHit === 0);
check('filter expression is Milvus syntax', fs.expression === 'acl == "finance"', fs.expression);
p.filter = { dept: 'all', updatedFrom: '2026-01-01', acl: 'all' };
const fs2 = P.filterSimulation(p);
check('updated filter reduces candidates', fs2.allowedCount < P.getModel(p).chunks.length, fs2.allowedCount + '');
p.filter = { dept: 'all', updatedFrom: '', acl: 'all' };
p.filterLimit = 1;

console.log('\n# route / three-level merge');
p.question = 'q1';
p.cand = 1;
const routeLow = P.routeSimulation(p);
p.cand = 5;
const routeHigh = P.routeSimulation(p);
check('cand 1 loses recall', routeLow.recall < 1, routeLow.recall.toFixed(2));
check('cand 5 keeps recall', routeHigh.recall === 1);
check('naive concat differs from merge', routeHigh.naive.map((x) => x.chunk.id).join() !== routeHigh.global.map((x) => x.chunk.id).join());

console.log('\n# write timeline');
const tl = P.writeTimeline(p);
check('six phases', tl.phases.length === 6);
check('phases monotonic', tl.phases.every((x, i) => i === 0 || x.t >= tl.phases[i - 1].t));
check('Strong visible at t=0', tl.table[0].Strong === true);
check('Eventually not visible at t=0', tl.table[0].Eventually === false);

console.log('\n# answer / budget / refusal');
p.question = 'q5';
p.threshold = 0.45;
let ans = P.answerOf(p);
check('unanswerable question refused', ans.answer.refused === true, 'best ' + ans.answer.best.toFixed(3));
p.threshold = 0.05;
ans = P.answerOf(p);
check('low threshold hard-answers', ans.answer.refused === false && ans.answer.hard === true);
check('hard answer flags weak lines', ans.answer.lines.some((l) => !l.supported));
p.question = 'q1';
p.threshold = 0.45;
p.budget = 200;
const lowBudget = P.answerOf(p).context;
p.budget = 1400;
const highBudget = P.answerOf(p).context;
check('low budget truncates', lowBudget.truncated === true, lowBudget.used + ' token');
check('high budget fits', highBudget.truncated === false, highBudget.used + ' token');
check('token estimate is positive', M.Fuse.estimateTokens('合同到期后数据还能留多久？') > 5);

console.log(`\n${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  console.error('\nFAILURES:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('SELFTEST PASS');

