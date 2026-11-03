/* ============================================================================
 * data.stages.js — 13 个流程阶段、演示文本、基础设施节点
 * 所有文案与参数集中在这里；场景与 UI 只负责渲染。
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};

  LLM.PIPELINE = [
    {
      no: 1,
      key: 'input',
      title: '用户输入',
      en: 'User Input',
      tagline: '一条消息，先被组织成上下文',
      summary:
        '一次推理的起点不是孤零零的一句话，而是系统提示、历史对话和当前问题拼成的完整输入序列。模型每次前向计算都重新读这一整叠内容。',
      ops: [
        '应用把 System Prompt、历史消息与当前问题按模型模板拼成 messages 数组',
        '消息被序列化为请求，经过长度检查、鉴权与内容安全检查',
        '输入文本进入分词器，准备变成 token 序列'
      ],
      formula: 'context = [system] + [user₁, assistant₁, …] + [userₙ]',
      analogy: '像给同事交接任务：不只要说需求，还要附上前情提要与工作规范。',
      note: '窗口长度是硬上限；模型不会自动记住窗口外的对话。',
      concepts: ['prompt', 'context', 'system-prompt', 'messages'],
      accent: '#59d7ff',
      duration: 4800
    },
    {
      no: 2,
      key: 'tokenize',
      title: '分词',
      en: 'Tokenization',
      tagline: '文字先被拆成模型认识的最小单位',
      summary:
        'Tokenizer 把字符串切成 token，再查词表变成整数 ID。Token 既不是字也不是词：一个汉字可能拆成多个 token，常见词组也可能合并成一个。',
      ops: [
        '按预切分规则处理空格、标点、数字与中英文边界',
        '在词表上执行 BPE / WordPiece / Unigram 等子词切分',
        '把每个 token 映射为词表 ID，并统计 token 数量'
      ],
      formula: '文本 → [t₁, t₂, …, tₙ] → [id₁, id₂, …, idₙ]',
      analogy: '像把整段话拆成乐高积木，再给每块积木贴上编号。',
      note: '不同模型的词表不同，同一句话的 token 数也不同；本页分词为近似演示。',
      concepts: ['token', 'tokenizer', 'bpe', 'token-id'],
      accent: '#56b4ff',
      duration: 5400
    },
    {
      no: 3,
      key: 'embed',
      title: '词向量嵌入',
      en: 'Embedding',
      tagline: '每个编号，变成一串有方向的数字',
      summary:
        '模型按 ID 从嵌入矩阵里取出一行向量。离散符号由此变成连续空间中的坐标，后续所有计算都建立在向量之上。',
      ops: [
        '用 token ID 作为行号，在嵌入矩阵中查表',
        '得到 d 维浮点向量，维度由模型结构决定',
        '在语义空间中，经常出现在相似语境的词会靠得更近'
      ],
      formula: 'xᵢ = E[idᵢ]，E ∈ ℝ^(V×d)',
      analogy: '像给每个词发一张多维坐标卡，意思越近，坐标通常也越近。',
      note: '嵌入不是「理解」，只是一种可学习的数值表示；相似度也会继承语料偏差。',
      concepts: ['embedding', 'embedding-matrix', 'vector-dimension', 'semantic-space'],
      accent: '#7f8dff',
      duration: 5200
    },
    {
      no: 4,
      key: 'position',
      title: '位置编码',
      en: 'Positional Encoding',
      tagline: '告诉模型：谁在前，谁在后',
      summary:
        '注意力本身对顺序不敏感，必须额外注入位置信息。不同模型方案不同：正弦编码、可学习位置嵌入、RoPE 旋转位置编码、ALiBi 距离偏置等。',
      ops: [
        '为序列中的每个位置生成位置表示',
        '相加式编码把位置向量加到词向量上；RoPE 则在注意力里旋转 Q/K',
        '现代 decoder-only 模型多采用 RoPE，并配合插值扩展上下文长度'
      ],
      formula: '相加式：hᵢ = xᵢ + pᵢ；RoPE：q̃ = R(pos)·q',
      analogy: '像给排队的人发号码牌：能力一样，站位决定了谁先被注意到。',
      note: '不要把所有模型都当成使用同一种位置编码；这是架构差异最大的环节之一。',
      concepts: ['positional-encoding', 'sinusoidal-pe', 'rope', 'alibi-pe'],
      accent: '#9a7bff',
      duration: 5200
    },
    {
      no: 5,
      key: 'transformer',
      title: 'Transformer 主体',
      en: 'Transformer Block',
      tagline: '一层层重复的「看上下文 + 做变换」',
      summary:
        '嵌入序列进入由 L 个结构相同的 Block 组成的塔。每个 Block 先归一化，再做多头注意力，接残差；再归一化、过前馈网络，再接残差。',
      ops: [
        'LayerNorm / RMSNorm 稳定数值分布',
        '多头自注意力让每个位置汇总上下文信息',
        '前馈网络对每个位置独立做非线性变换',
        '残差连接保留原始信息，让梯度能穿过深层'
      ],
      formula: "H′ = H + Attn(Norm(H))；H″ = H′ + FFN(Norm(H′))",
      analogy: '像多层流水线：每一层都重新读整句，再把半成品加工得更抽象一点。',
      note: 'Encoder-only（如 BERT）、Decoder-only（如 GPT/LLaMA）与 Encoder-Decoder（如 T5）结构不同，本项目以 decoder-only 推理为主。',
      concepts: [
        'transformer',
        'transformer-block',
        'layernorm',
        'rmsnorm',
        'residual',
        'ffn',
        'decoder-only',
        'encoder-only',
        'encoder-decoder'
      ],
      accent: '#4fe6d4',
      duration: 7600
    },
    {
      no: 6,
      key: 'attention',
      title: '自注意力',
      en: 'Self-Attention',
      tagline: '每个词，按相关度去看其他词',
      summary:
        '输入向量分别投影成 Query、Key、Value。Q 与所有 K 点积得到相关性分数，经缩放、掩码与 softmax 变成权重，再对 V 加权求和。',
      ops: [
        '三组线性变换生成 Q、K、V',
        '计算 QKᵀ / √dₖ，得到每个位置对其他位置的分数',
        'decoder 加上因果掩码，禁止看到未来 token',
        'softmax 归一化后对 V 加权求和，得到上下文向量'
      ],
      formula: 'Attention(Q,K,V) = softmax(QKᵀ/√dₖ + M)·V',
      analogy: '像小组讨论：发言前先判断谁说的对我有用，再综合大家的意见更新自己的观点。',
      note: '页面上的注意力矩阵由本地小规模向量计算，用于展示数学关系，不代表真实模型某一层。',
      concepts: ['qkv', 'attention-score', 'self-attention', 'sqrt-dk', 'causal-mask', 'softmax'],
      accent: '#45e0ff',
      duration: 7600
    },
    {
      no: 7,
      key: 'multihead',
      title: '多头注意力',
      en: 'Multi-Head Attention',
      tagline: '把一次「看」拆成多种视角',
      summary:
        '隐藏维度被切成 h 个头，每个头独立算一组注意力，最后拼接并做线性投影。不同头可以学到不同的关系模式。',
      ops: [
        '把 d 维隐藏状态投影成 h 组独立的 Q/K/V',
        '每个头在 dₖ = d/h 的子空间里计算注意力',
        '拼接所有头的输出，再用 W_O 融合成 d 维'
      ],
      formula: 'MHA = Concat(head₁, …, head_h)·W_O',
      analogy: '像多位编辑同时审稿：有人盯逻辑，有人盯事实，有人盯语气，最后主编合并意见。',
      note: '头数不是越多越好，需要与隐藏维度、算力和数据量匹配；不同头可解释性有限。',
      concepts: ['multi-head', 'self-attention', 'qkv'],
      accent: '#7fc4ff',
      duration: 5400
    },
    {
      no: 8,
      key: 'stack',
      title: '深层堆叠',
      en: 'Layer Stacking',
      tagline: '抽象一层层长出来',
      summary:
        '几十层 Block 依次堆叠，隐状态逐层更新。浅层更偏向词形与局部搭配，中层常见句法信息，深层更偏语义与任务相关特征——这是趋势，不是严格分工。',
      ops: [
        'Token 表示依次穿过每一层，维度保持不变',
        '每层都在前一层的基础上重新混合上下文',
        '参数量、层数、隐藏维度共同决定容量与成本'
      ],
      formula: 'H^L = Block^L ∘ … ∘ Block^1(H⁰)',
      analogy: '像审稿要过很多轮：先改错字，再调逻辑，最后看整体贡献。',
      note: '「第几层负责什么」没有统一的严格地图，可视化中的分层标签是示意。',
      concepts: ['stacking', 'hidden-state', 'transformer-block', 'residual'],
      accent: '#5f9dff',
      duration: 6000
    },
    {
      no: 9,
      key: 'logits',
      title: 'LM Head 与 Logits',
      en: 'LM Head & Logits',
      tagline: '从隐藏状态到整张词表的分数',
      summary:
        '最后一层最后一个位置的隐藏状态，被线性投影到词表维度，得到每个 token 的 logits。Logits 是未归一化分数，不是概率。',
      ops: [
        '取最后一个位置的隐状态 h_last',
        '乘以词表投影矩阵，得到长度为 |V| 的分数向量',
        '很多模型让输出头与嵌入矩阵共享权重'
      ],
      formula: 'z = h_last·W_vocabᵀ，z ∈ ℝ^|V|',
      analogy: '像给所有候选词打原始分：可以排名，但还不是百分比。',
      note: '页面只展示少量候选 token 的 logits，真实词表通常有数万到二十多万项。',
      concepts: ['lm-head', 'logits', 'vocabulary', 'hidden-state'],
      accent: '#ffc46b',
      duration: 5200
    },
    {
      no: 10,
      key: 'sample',
      title: '概率与采样',
      en: 'Softmax & Sampling',
      tagline: '把分数变成概率，再掷一次骰子',
      summary:
        'logits 先除以温度，再经 softmax 变成概率；Top-K / Top-P 截断候选后按权重采样。贪心与束搜索是另外两条确定性的解码路线。',
      ops: [
        'softmax 把 logits 变成总和为 1 的概率',
        'temperature 缩放 logits：低温更确定，高温更随机',
        'Top-K 固定保留前 K 个；Top-P 保留累计概率达到阈值的集合',
        '在最终分布上按概率抽取下一个 token'
      ],
      formula: 'pᵢ = softmax(zᵢ/T)；Top-K / Top-P 截断后重归一化',
      analogy: '像转盘抽奖：概率大的格子更大，但仍然可能抽到小格子。',
      note: 'Temperature、Top-K、Top-P 是三件不同的事；同一个 Prompt 多次结果不同，主要来自采样随机性。',
      concepts: ['temperature', 'top-k', 'top-p', 'sampling', 'greedy-decoding', 'beam-search', 'softmax'],
      accent: '#ff9d6b',
      duration: 6400
    },
    {
      no: 11,
      key: 'autoregressive',
      title: '自回归生成',
      en: 'Autoregressive Generation',
      tagline: '一次一个 token，把回答接下去',
      summary:
        '新 token 被追加到序列，整段再进入模型预测下一个。推理分 Prefill 与 Decode：前者并行处理输入，后者逐 token 生成，并靠 KV Cache 复用历史 K/V。',
      ops: [
        'Prefill：整段输入并行前向，写入每层 KV Cache',
        'Decode：只为新 token 计算，读取并追加 KV Cache',
        '采样出的 token 追加到序列，循环直到停止'
      ],
      formula: 'sₜ₊₁ = sₜ ⊕ [yₜ]；重复直到 EOS',
      analogy: '像写接龙小说：每写一个词，就再读一遍稿子，决定下一个词。',
      note: 'KV Cache 保存的是张量，不是聊天记录；它显著影响长上下文时的显存占用。',
      concepts: ['autoregressive', 'kv-cache', 'prefill-decode', 'sampling'],
      accent: '#ff7bd5',
      duration: 6400
    },
    {
      no: 12,
      key: 'detokenize',
      title: '反分词',
      en: 'Detokenization',
      tagline: '把编号拼回人类可读的句子',
      summary:
        '生成的 token ID 依次反查词表，得到 token 文本，再按分词器的规则拼接。子词边界、空格标记与特殊符号都要正确处理。',
      ops: [
        '把每个 token ID 反查成 token 字符串',
        '按规则拼接（处理空格、子词前缀、字节序列）',
        '过滤 EOS 等控制标记，得到最终文本'
      ],
      formula: 'ids → [t₁, …, tₙ] → text',
      analogy: '像拼图：每块背后有编号，按编号找回图块并拼回去。',
      note: 'Token 边界通常不对应自然语言单词边界，所以同样长度的文本 token 数会不同。',
      concepts: ['detokenization', 'tokenizer', 'eos'],
      accent: '#7effc4',
      duration: 4600
    },
    {
      no: 13,
      key: 'return',
      title: '停止与返回',
      en: 'Stop & Response',
      tagline: '结束生成，把增量送回前端',
      summary:
        '命中 EOS、停止串或最大长度后结束生成。服务端可以把增量 token 流式推给前端；模型推理结束与用户看到完整回答是两个不同层面的时间点。',
      ops: [
        '检测 EOS / stop sequence / max_tokens 停止条件',
        '按 SSE 或 WebSocket 把增量文本推送到客户端',
        '前端拼接增量并逐字渲染，记录本次统计'
      ],
      formula: 'stop if yₜ = <EOS> ∨ t ≥ max_tokens ∨ suffix ∈ stop[]',
      analogy: '像厨师边做边上菜：不必等整桌齐了才端出来。',
      note: '首 token 延迟（Prefill）与后续每 token 延迟（Decode）是不同指标。',
      concepts: ['eos', 'max-tokens-stop', 'streaming', 'detokenization', 'inference', 'simulation-note'],
      accent: '#c9a96a',
      duration: 5000
    }
  ];

  LLM.STAGE_BY_KEY = LLM.PIPELINE.reduce(function (map, stage) {
    map[stage.key] = stage;
    return map;
  }, {});

  LLM.getStage = function (no) {
    return LLM.PIPELINE[Math.max(0, Math.min(LLM.PIPELINE.length - 1, no - 1))];
  };

  /* ------------------------------------------------------------------ 演示文本 */
  LLM.DEMO = {
    question: '人工智能是如何理解人类语言的？',
    answer:
      '它先把你的问题切成 token，再把 token 变成向量；自注意力找出词与词之间的关系，一层层抽象出语义，最后按概率逐个生成 token。它并不像人那样「理解」，而是在海量语料中学到了预测下一个 token 的统计规律。',
    shortAnswer: '它并不真正「理解」语言，而是把文字变成向量，用注意力建立联系，再逐个预测下一个 token。',
    disclaimer: '示例回答为预置文案，用于演示流程；本次并未调用任何真实大模型。',
    customDisclaimer: '演示回答为预置文案，按问题关键词选取；分词与注意力数值由本地演示器计算。',
    vocab: [
      { token: '它', logit: 4.6 },
      { token: '这', logit: 3.4 },
      { token: '模型', logit: 2.8 },
      { token: '语言', logit: 2.1 },
      { token: '我们', logit: 1.5 },
      { token: '人工智能', logit: 1.1 },
      { token: '因为', logit: 0.4 },
      { token: '答案', logit: -0.2 },
      { token: '理解', logit: -0.9 },
      { token: '的', logit: -1.6 }
    ]
  };

  /* 自定义问题的「预置回答」池，按关键词匹配，匹配不到用通用回答 */
  LLM.CUSTOM_ANSWERS = [
    {
      keys: ['注意力', 'attention', 'qkv', 'q', 'k', 'v'],
      text:
        '注意力把每个 token 投影成 Query、Key、Value，用 Query 和所有 Key 的点积算相关度，softmax 归一化后对 Value 加权求和。因果掩码会挡住未来 token，因此每个位置只能看到自己和左侧的上下文。'
    },
    {
      keys: ['分词', 'token', 'tokenizer', '词表'],
      text:
        'Tokenizer 按训练时学到的子词规则把文本切成 token，再查词表变成整数 ID。Token 不等于汉字或单词：常见词可能合并成一个，生僻字也可能拆成多个字节片段。'
    },
    {
      keys: ['温度', '采样', 'top-k', 'top-p', '随机', 'temperature'],
      text:
        '温度缩放 logits，改变分布的陡峭程度；Top-K 固定保留前 K 个候选，Top-P 保留累计概率达到阈值的候选集合，最后在截断后的分布上按权重采样。三者作用不同，可以组合使用。'
    },
    {
      keys: ['kv', '缓存', 'cache', '显存'],
      text:
        'KV Cache 缓存每一层历史 token 的 Key 和 Value 张量，让 Decode 阶段不必重算整段前缀。它保存的是张量而不是对话文本；上下文越长、并发越高，占用的显存越多。'
    },
    {
      keys: ['transformer', '架构', '编码器', '解码器', 'gpt'],
      text:
        'Transformer 用自注意力混合序列内的信息，再用前馈网络逐位置变换。Encoder-only、Decoder-only 和 Encoder-Decoder 是三种不同结构；GPT 类模型属于 Decoder-only，使用因果注意力。'
    },
    {
      keys: ['训练', '推理', '区别'],
      text:
        '训练通过反向传播更新权重，推理只做前向计算、权重冻结。本项目演示的是推理：输入 Prompt，经过分词、嵌入、注意力与采样，逐个 token 生成回答。'
    }
  ];

  LLM.CUSTOM_FALLBACK =
    '你的问题会先被切成 token，再变成向量进入 Transformer。自注意力让每个 token 参考上下文，层层堆叠后由输出头给出下一个 token 的概率分布；采样出一个 token 后追加到序列，循环直到 EOS。这是一段按关键词选取的演示回答，并非真实模型生成。';

  /* ------------------------------------------------------------------ 基础设施 */
  LLM.INFRA = [
    { id: 'gpu-cuda', label: 'GPU / CUDA', kind: 'chip' },
    { id: 'tensor-core', label: 'Tensor Core', kind: 'core' },
    { id: 'vram', label: '显存 VRAM', kind: 'memory' },
    { id: 'model-weights', label: '模型权重', kind: 'weights' },
    { id: 'quantization', label: '量化', kind: 'quant' },
    { id: 'batching', label: '批处理', kind: 'batch' },
    { id: 'continuous-batching', label: '连续批处理', kind: 'stream' },
    { id: 'tensor-parallel', label: '张量并行', kind: 'mesh' },
    { id: 'pipeline-parallel', label: '流水线并行', kind: 'pipe' },
    { id: 'distributed-inference', label: '分布式推理', kind: 'cluster' }
  ];

  /* 每个阶段的 3D 站台在弧形流水线上的参数由 pipeline.js 计算。 */
  LLM.LAYOUT = {
    spacing: 5,
    startX: -30,
    endX: 30,
    baseY: 4.2,
    baseZ: 2.4,
    bow: 5.6,
    tower: { x: 0, y: 4.7, z: -9.2, size: 6.2 },
    attentionLift: 5.2,
    infra: { x: 0, y: -15, z: -30 }
  };
})();
