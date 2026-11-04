/* ==========================================================================
   data.questions.js — 6 个预设问题与它们的验收口径
   每个问题都跑在同一批虚构语料上，但结论不同：
   语义改写 / 精确编号 / 跨文档 / 权限 / 无答案 / 时间条件。
   ========================================================================== */
(function (root) {
  'use strict';

  var QUESTIONS = [
    {
      id: 'q1',
      no: 1,
      label: '语义改写',
      short: '到期后还能留多久',
      text: '合同到期后数据还能留多久？',
      kind: 'semantic',
      filter: { acl: 'all', updatedFrom: '' },
      probe: ['保留期', '90 天', '保留'],
      answerDoc: 'security',
      why:
        '问句用「合同到期…留多久」，语料写的是「服务终止后…保留期 90 天」。两者只共享「数据」这种泛词，真正考的是语义向量。',
      expect:
        'dense 路应该把《权限与加密白皮书》的「数据保留与删除」排到前面；BM25 只能靠「数据」这类泛词碰运气，分数与名次都不稳。'
    },
    {
      id: 'q2',
      no: 2,
      label: '精确编号',
      short: 'VX-2048 是什么错误',
      text: 'VX-2048 是什么错误？',
      kind: 'exact',
      filter: { acl: 'all', updatedFrom: '' },
      probe: ['VX-2048', '维度'],
      answerDoc: 'errors',
      why:
        '知识库里还有 VX-2041、VX-2049，编号只差一位。语义向量只认得「故障」这个话题，分不清具体编号；BM25 的词元可以一击即中。',
      expect:
        'BM25 路应该把 VX-2048 排第一；dense 路会在几个故障码之间摇摆。融合之后，融合结果要落到正确的块上。'
    },
    {
      id: 'q3',
      no: 3,
      label: '跨文档',
      short: 'M 调大后内存与召回',
      text: 'M 调大之后内存和召回怎么变？',
      kind: 'cross',
      filter: { acl: 'all', updatedFrom: '' },
      probe: ['M', '内存', '召回', 'CU'],
      answerDoc: 'index',
      why:
        '索引篇讲 M、邻居表与召回；计费篇讲索引内存如何折算成 CU。答案横跨两篇文档，考的是 Top-n 覆盖。',
      expect:
        'Top-5 里应该同时出现《索引选型指南》和《计费与配额说明》的块；只取 Top-1 会丢掉计费那一半。'
    },
    {
      id: 'q4',
      no: 4,
      label: '权限',
      short: '只保留 finance 可见',
      text: '合同到期后数据还能留多久？（只保留 finance 可见的块）',
      kind: 'acl',
      filter: { acl: 'finance', updatedFrom: '' },
      probe: ['保留期', '90 天', '保留'],
      answerDoc: 'billing',
      why:
        '同一句语义问题，加上 acl == "finance" 之后，答案只能来自《计费与配额说明》。考的是过滤发生在检索之前还是之后。',
      expect:
        'pre-filter 应该在 finance 可见的块里检索，还能找到「保留期 90 天」；post-filter 先取全库 Top-k 再筛，很可能一条不剩。'
    },
    {
      id: 'q5',
      no: 5,
      label: '无答案',
      short: '明年会不会涨价',
      text: '明年会不会涨价？',
      kind: 'none',
      filter: { acl: 'all', updatedFrom: '' },
      probe: ['涨价', '明年', '价格调整'],
      answerDoc: null,
      why:
        '语料只写了「续费价格以商务合同为准」，没有明年的定价结论。这是为拒答阈值准备的题：检索仍然会返回计费相关的块，但最高分应该过不了阈值。',
      expect:
        '默认阈值下应该拒答；把阈值调到很低时页面会「硬答」，并把缺少依据的句子标出来。'
    },
    {
      id: 'q6',
      no: 6,
      label: '时间条件',
      short: '只要 2026 年以后更新',
      text: '合同到期后数据还能留多久？（只保留 updated ≥ 2026-01-01 的块）',
      kind: 'time',
      filter: { acl: 'all', updatedFrom: '2026-01-01' },
      probe: ['保留期', '90 天', '保留'],
      answerDoc: 'security',
      why:
        '同一个问题，把 updated 早于 2026-01-01 的块全部排除。可检索的块数会直接下降，答案是否还在、召回掉多少，都要能看见。',
      expect:
        '候选块数、Top-k 与分数都会变化；过滤条件写在 search 的 filter 参数里，而不是拿到结果后再筛。'
    }
  ];

  var DEFAULT_THRESHOLD = 0.45; // 示例语料标定值，不是 Milvus 默认值；页面可调。

  var api = { QUESTIONS: QUESTIONS, DEFAULT_THRESHOLD: DEFAULT_THRESHOLD };
  root.MILVUS = root.MILVUS || {};
  root.MILVUS.data = root.MILVUS.data || {};
  root.MILVUS.data.questions = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
