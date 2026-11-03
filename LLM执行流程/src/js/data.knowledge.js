/* ============================================================================
 * data.knowledge.js — 知识库条目（内容唯一来源）
 * 每条：中文名 / 英文名 / 定义 / 工作原理 / 输入输出 / 公式 / 类比 / 关联
 * 口径：以主流开源 decoder-only 模型为例，同时标注架构差异；不把演示当实测。
 * ========================================================================== */
(function () {
  'use strict';

  window.LLM = window.LLM || {};

  LLM.KNOWLEDGE_GROUPS = [
    '输入与上下文',
    '分词 Token',
    '向量嵌入',
    '位置编码',
    'Transformer',
    '注意力机制',
    '输出与采样',
    '自回归生成',
    '解码与返回',
    '推理基础设施'
  ];

  LLM.KNOWLEDGE = [
    /* ------------------------------------------------------------ 输入与上下文 */
    {
      id: 'prompt',
      group: '输入与上下文',
      cn: '提示词',
      en: 'Prompt',
      stage: 1,
      def: '用户交给模型的输入文本。它可以是问题、指令、待改写的段落，也可以是带示例的少样本提示。Prompt 本身不是「模型理解的意思」，只是被分词后的一串 token。',
      how: '客户端把 Prompt 与系统提示、历史消息一起组织成消息列表，再按模型要求的模板拼成一个 token 序列送进模型。同一个 Prompt 在不同模板下，边界 token 不一样，效果也可能不同。',
      io: ['输入：自然语言文本、图片占位或多模态片段', '输出：待分词的文本序列'],
      formula: 'Prompt → messages[] → chat template → token 序列',
      analogy: '像给同事写工单：写了什么很重要，但公司工单模板（角色、分隔符）也会影响他怎么读。',
      related: ['context', 'system-prompt', 'messages']
    },
    {
      id: 'context',
      group: '输入与上下文',
      cn: '上下文窗口',
      en: 'Context / Context Window',
      stage: 1,
      def: '模型这一次前向计算能看到的全部 token，包括系统提示、历史对话、检索到的资料和当前问题。上下文窗口是长度上限，不是「记忆容量」。',
      how: '服务端把多段消息拼成一个不超过上限的序列。超出窗口时通常截断最旧内容、做摘要或改用检索；模型不会自动记住窗口外的对话。',
      io: ['输入：系统提示 + 历史消息 + 当前输入', '输出：一次前向计算所用的定长 token 序列'],
      formula: 'context = [system] + [user₁, assistant₁, …] + [userₙ]',
      analogy: '像一张只能摊开固定大小的桌面：桌上放得下的资料才参与这次工作，抽屉里的不算。',
      related: ['prompt', 'messages', 'kv-cache']
    },
    {
      id: 'system-prompt',
      group: '输入与上下文',
      cn: '系统提示',
      en: 'System Prompt',
      stage: 1,
      def: '在对话最前面、由应用方设定的一段高优先级指令，用来规定角色、边界、输出格式和安全策略。它是输入的一部分，不是模型权重里的规则。',
      how: '推理时作为消息列表的第一条（或模板中的 system 区段）参与注意力计算。它约束力强，但并非不可突破；真正的安全策略通常还要在应用层做过滤。',
      io: ['输入：应用方编写的规则文本', '输出：拼进上下文的前缀 token'],
      formula: 'messages = [{role:"system", content:"…"}, …]',
      analogy: '像外包合同里的工作说明：写得越清楚，执行越稳定，但它不能替代验收。',
      related: ['prompt', 'context', 'messages']
    },
    {
      id: 'messages',
      group: '输入与上下文',
      cn: '多轮消息',
      en: 'Multi-turn Messages',
      stage: 1,
      def: '按 role（system / user / assistant / tool）组织的消息数组。模型没有独立的「记忆」，多轮对话是把历史消息重新拼进上下文再算一遍。',
      how: '应用层保存会话历史，每轮把历史与最新问题按模板拼接。模板会插入角色标记和分隔符，这些标记同样占 token；不同模型的模板不可混用。',
      io: ['输入：历史消息数组 + 新问题', '输出：带角色标记的完整输入序列'],
      formula: '[system] [user] … [assistant] … [user] 新问题',
      analogy: '像每次开会都重新发一遍前情纪要；模型看到的永远是这一叠纸，而不是昨天的大脑。',
      related: ['context', 'system-prompt', 'kv-cache']
    },

    /* ------------------------------------------------------------ 分词 */
    {
      id: 'token',
      group: '分词 Token',
      cn: '词元',
      en: 'Token',
      stage: 2,
      def: '模型处理文本的最小单位。它可能是一个汉字、一个英文单词、一个词根、一个空格加字母，甚至一个字节片段；不等于字符，也不等于单词。',
      how: 'Tokenizer 按训练时学到的切分规则把文本切成 token，并映射成整数 ID。模型自始至终只处理 ID 和向量，不直接处理字符串。',
      io: ['输入：原始字符串', '输出：token 序列（可再映射为 ID）'],
      formula: '文本 → [t₁, t₂, …, tₙ]',
      analogy: '像乐高积木：有的积木是一整块墙，有的只是一颗小凸点，拼出来的东西一样，但块数不同。',
      related: ['tokenizer', 'token-id', 'bpe']
    },
    {
      id: 'tokenizer',
      group: '分词 Token',
      cn: '分词器',
      en: 'Tokenizer',
      stage: 2,
      def: '把文本切成 token 并映射为 ID 的组件，包含词表和切分算法。它是模型发布包的一部分，训练和推理必须使用同一个分词器。',
      how: '常见做法是先做预切分（空格、标点、数字），再在词表上做最长匹配或 BPE 合并。中文常按字或常见词组合并；英文常按子词切分。',
      io: ['输入：文本', '输出：token ID 序列；反向可解码'],
      formula: 'encode(text) → ids；decode(ids) → text',
      analogy: '像快递分拣：先把大件拆成可扫描的包裹，每个包裹贴一个编号。',
      related: ['token', 'bpe', 'token-id', 'detokenization']
    },
    {
      id: 'bpe',
      group: '分词 Token',
      cn: '字节对编码',
      en: 'BPE / WordPiece / Unigram',
      stage: 2,
      def: '三类常见子词分词算法。BPE 反复合并高频相邻符号对；WordPiece 以似然增益挑选合并；Unigram 从大词表逐步删减。它们都为了平衡词表大小与序列长度。',
      how: '在训练语料上统计后得到固定词表与合并规则；推理时按规则切分。汉字在 UTF-8 下占 3 字节，字节级 BPE 可能把一个汉字拆成多个 token，也可能把常见词合并成一个。',
      io: ['输入：训练语料 / 待编码文本', '输出：词表与合并规则 / token 序列'],
      formula: 'BPE：合并频次最高的相邻符号对，重复 k 次',
      analogy: '像整理衣柜：常一起穿的衣服打包成一摞，不常一起的就单件放。',
      related: ['tokenizer', 'token', 'token-id']
    },
    {
      id: 'token-id',
      group: '分词 Token',
      cn: '词元编号',
      en: 'Token ID',
      stage: 2,
      def: '每个 token 在词表中的整数下标。ID 只是查表用的地址，数值大小没有语义；ID 23 不比 ID 24「更接近」某个概念。',
      how: '分词器输出 ID 序列，模型用它去嵌入矩阵取行。词表大小常见 3 万到 25 万级别，取决于模型与分词方案。',
      io: ['输入：token 文本', '输出：整数 ID'],
      formula: 'id = vocab[t]',
      analogy: '像学号：只用来找到人，学号大小不代表成绩高低。',
      related: ['token', 'tokenizer', 'embedding']
    },

    /* ------------------------------------------------------------ 嵌入 */
    {
      id: 'embedding',
      group: '向量嵌入',
      cn: '词向量嵌入',
      en: 'Embedding',
      stage: 3,
      def: '把离散的 token ID 映射成连续向量的过程。得到的向量让模型可以用加减、点积等数值运算处理语义关系。',
      how: '嵌入矩阵 E 的每一行对应一个 token；查表取出该行，得到 d 维向量。这个向量随后会与位置信息结合，再进入 Transformer 层。',
      io: ['输入：token ID', '输出：d 维实数向量'],
      formula: 'xᵢ = E[idᵢ] ∈ ℝᵈ',
      analogy: '像给每个词发一张多维坐标卡：意思相近的词，坐标也往往接近。',
      related: ['embedding-matrix', 'vector-dimension', 'semantic-space', 'token-id']
    },
    {
      id: 'embedding-matrix',
      group: '向量嵌入',
      cn: '嵌入矩阵',
      en: 'Embedding Matrix',
      stage: 3,
      def: '形状为「词表大小 × 向量维度」的参数矩阵，是整个模型里最大的参数之一。查表就是按 ID 取对应的一行。',
      how: '训练时随梯度更新；推理时只读。若词表 10 万、维度 4096，仅这一层就有约 4 亿参数（FP16 约 0.8 GB）。',
      io: ['输入：token ID', '输出：对应行向量'],
      formula: 'E ∈ ℝ^(V×d)，x = E[id]',
      analogy: '像一本大字典，每个词条占一页，查词就是翻到那一页。',
      related: ['embedding', 'vector-dimension', 'model-weights']
    },
    {
      id: 'vector-dimension',
      group: '向量嵌入',
      cn: '向量维度',
      en: 'Embedding Dimension',
      stage: 3,
      def: '每个 token 向量的分量个数 d。维度越高，能编码的特征越细，但显存与计算量也越大；主流模型常见 2048～8192。',
      how: 'd 由模型设计决定，同一模型内各层隐藏状态通常保持同一维度。注意力中每个头的维度 dₖ 往往等于 d / 头数。',
      io: ['输入：模型配置', '输出：固定长度的浮点向量'],
      formula: 'd_model = h × d_k',
      analogy: '像描述一个人用几个指标：只写身高体重很粗，加上性格、经历、偏好就更细，但记录成本更高。',
      related: ['embedding', 'multi-head', 'hidden-state']
    },
    {
      id: 'semantic-space',
      group: '向量嵌入',
      cn: '语义空间',
      en: 'Semantic Space',
      stage: 3,
      def: '把词向量放进高维空间后形成的几何结构。训练会把经常出现在相似语境中的 token 拉近，因此可以用距离或夹角衡量相似性。',
      how: '相似度常用余弦相似度或点积。需要注意：嵌入空间是统计学习的产物，存在偏差，也不等于人类的概念体系。',
      io: ['输入：两个 token 向量', '输出：相似度分数'],
      formula: 'cos(u,v) = (u·v) / (‖u‖‖v‖)',
      analogy: '像城市地图：常一起出现的地方被道路拉近，但地图不是城市本身。',
      related: ['embedding', 'vector-dimension']
    },

    /* ------------------------------------------------------------ 位置 */
    {
      id: 'positional-encoding',
      group: '位置编码',
      cn: '位置编码',
      en: 'Positional Encoding',
      stage: 4,
      def: '把 token 的顺序信息注入表示的方法。注意力本身对排列不敏感，若不加位置信息，「猫追狗」和「狗追猫」在模型看来可能一样。',
      how: '常见方案：正弦位置编码、可学习位置嵌入、RoPE（旋转位置编码）、ALiBi（注意力偏置）等。有的在输入端相加，有的在注意力里旋转 Q/K 或加偏置。',
      io: ['输入：token 向量 + 位置下标', '输出：带顺序信息的向量'],
      formula: 'hᵢ = xᵢ + pᵢ（相加式）',
      analogy: '像给排队的人发号码牌：能力相同，但站第几位决定了谁先被看到。',
      related: ['sinusoidal-pe', 'rope', 'alibi-pe', 'self-attention']
    },
    {
      id: 'sinusoidal-pe',
      group: '位置编码',
      cn: '正弦位置编码',
      en: 'Sinusoidal Position Encoding',
      stage: 4,
      def: 'Transformer 原论文使用的固定位置编码：用不同频率的正弦、余弦函数生成每个位置的向量，再与词向量相加。',
      how: '不同维度使用不同波长，短波区分邻近位置，长波区分远距离。它不需要训练参数，但现代大模型较少单独使用。',
      io: ['输入：位置下标 pos、维度下标 i', '输出：位置向量分量'],
      formula: 'PE(pos,2i)=sin(pos/10000^(2i/d))；PE(pos,2i+1)=cos(…)',
      analogy: '像用一组快慢不同的钟表指针组合出唯一时间。',
      related: ['positional-encoding', 'rope']
    },
    {
      id: 'rope',
      group: '位置编码',
      cn: '旋转位置编码',
      en: 'RoPE',
      stage: 4,
      def: 'Rotary Position Embedding：把位置信息编码成对 Q、K 向量的旋转操作，使注意力分数天然携带相对位置信息。LLaMA、Qwen 等大量现代模型采用。',
      how: '按维度成对旋转 Q/K，旋转角度随位置变化。相对位置体现在两向量的夹角中；配合 NTK/YaRN 等插值方法可扩展上下文长度。',
      io: ['输入：Q/K 向量与位置', '输出：旋转后的 Q/K'],
      formula: 'q̃ = R(pos)·q，k̃ = R(pos)·k',
      analogy: '像给每个词一个不同角度的罗盘，两个罗盘的夹角只跟距离有关。',
      related: ['positional-encoding', 'self-attention', 'sinusoidal-pe']
    },
    {
      id: 'alibi-pe',
      group: '位置编码',
      cn: 'ALiBi 与其他方案',
      en: 'ALiBi / Learned PE',
      stage: 4,
      def: '除正弦与 RoPE 外的常见选择：ALiBi 直接给注意力分数加一个随距离线性增长的负偏置；可学习位置嵌入则把位置当作可训练参数。',
      how: 'ALiBi 不修改向量本身，只在注意力分数上惩罚远距离；可学习位置嵌入在最长训练长度内查表，外推能力通常较弱。不同模型方案不同，不能一概而论。',
      io: ['输入：注意力分数 / 位置下标', '输出：带位置偏置的分数 / 位置向量'],
      formula: 'ALiBi：score(i,j) −= m·(i−j)',
      analogy: '像开会时给远处的人自动调低音量，越远越听不清。',
      related: ['positional-encoding', 'sinusoidal-pe', 'rope']
    },

    /* ------------------------------------------------------------ Transformer */
    {
      id: 'transformer',
      group: 'Transformer',
      cn: 'Transformer',
      en: 'Transformer',
      stage: 5,
      def: '2017 年论文《Attention Is All You Need》提出的神经网络架构，核心是用自注意力在序列内部建立联系，并用前馈网络做逐位置变换。它是今天绝大多数大语言模型的骨架。',
      how: '输入向量经过多层结构相同的 Block：归一化、注意力、残差、归一化、前馈网络、残差。最后接输出头得到词表上的分数。',
      io: ['输入：token 向量序列', '输出：同长度的上下文表示序列'],
      formula: 'H⁰ = Embed(x)+Pos；Hˡ⁺¹ = Blockˡ(Hˡ)',
      analogy: '像一间有多层流水线的工厂：每层都重新看一遍整条句子，再把手上的半成品加工得更抽象一点。',
      related: ['transformer-block', 'encoder-only', 'decoder-only', 'encoder-decoder']
    },
    {
      id: 'encoder-only',
      group: 'Transformer',
      cn: '仅编码器架构',
      en: 'Encoder-only',
      stage: 5,
      def: '只保留 Transformer 编码器的架构，注意力可双向看到整句，擅长理解类任务，如分类、抽取、句向量。BERT 是代表。',
      how: '输入整段文本，每层双向注意力；输出每个位置的上下文向量。通常不自带文本生成能力，需要外接任务头。',
      io: ['输入：完整文本', '输出：上下文表示 / 任务标签'],
      formula: 'H = Encoder(x)；y = Head(H)',
      analogy: '像阅读理解考官：可以来回看全文，然后打个分或圈出答案，但不负责续写。',
      related: ['transformer', 'decoder-only', 'encoder-decoder']
    },
    {
      id: 'decoder-only',
      group: 'Transformer',
      cn: '仅解码器架构',
      en: 'Decoder-only',
      stage: 5,
      def: '只保留解码器的自回归架构，用因果掩码保证每个位置只能看到自己和左侧的 token。GPT 系列、LLaMA、Qwen 等主流对话模型多属此类。',
      how: '训练目标是预测下一个 token；推理时逐个生成。因为结构统一，同一套权重既可用于续写，也可通过提示完成问答、翻译等任务。',
      io: ['输入：前缀 token 序列', '输出：下一个 token 的分布'],
      formula: 'p(yₜ | y₁…yₜ₋₁) = softmax(LMHead(hₜ))',
      analogy: '像接龙：只能看前面已经写出的内容，往后接一个词。',
      related: ['transformer', 'encoder-only', 'encoder-decoder', 'autoregressive', 'causal-mask']
    },
    {
      id: 'encoder-decoder',
      group: 'Transformer',
      cn: '编码器—解码器架构',
      en: 'Encoder–Decoder',
      stage: 5,
      def: '编码器先双向读入源序列，解码器再以因果方式生成目标序列，并通过交叉注意力读取编码器输出。T5、BART 与原始 Transformer 属此类。',
      how: '编码器输出一组键值表示；解码器每层在自注意力后再做一次交叉注意力，Query 来自解码器，Key/Value 来自编码器。适合翻译、摘要等序列到序列任务。',
      io: ['输入：源序列（可选目标前缀）', '输出：目标序列分布'],
      formula: 'H_enc = Enc(x)；p(y) = Dec(y, H_enc)',
      analogy: '像同声传译：先听懂整段（编码），再一句句说出译文（解码），说的时候不断回看原文。',
      related: ['transformer', 'encoder-only', 'decoder-only']
    },
    {
      id: 'transformer-block',
      group: 'Transformer',
      cn: 'Transformer 块',
      en: 'Transformer Block',
      stage: 5,
      def: '重复堆叠的基本单元。decoder-only 模型里通常包含：归一化 → 多头自注意力 → 残差 → 归一化 → 前馈网络 → 残差。',
      how: 'Pre-LN 结构把归一化放在子层之前，训练更稳定；Post-LN 放在残差相加之后。不同模型的细节（RMSNorm、QK-Norm、并行残差）不同。',
      io: ['输入：隐藏状态 H', '输出：更新后的隐藏状态 H′'],
      formula: "H′ = H + Attn(Norm(H))；H″ = H′ + FFN(Norm(H′))",
      analogy: '像一道标准化工序：先校准（归一化），再互相参考（注意力），最后各自深加工（FFN），每步都保留原件（残差）。',
      related: ['transformer', 'layernorm', 'residual', 'ffn', 'multi-head']
    },
    {
      id: 'layernorm',
      group: 'Transformer',
      cn: '层归一化',
      en: 'LayerNorm',
      stage: 5,
      def: '对单个 token 的隐藏向量做归一化：减去均值、除以标准差，再乘可学习缩放、加偏置。它稳定了深层网络的数值分布。',
      how: '在 Pre-LN 中位于注意力/FFN 之前；在 Post-LN 中位于残差相加之后。只在一个样本内部沿特征维计算，与 batch 大小无关。',
      io: ['输入：d 维隐藏向量', '输出：同维归一化向量'],
      formula: 'y = γ·(x−μ)/√(σ²+ε) + β',
      analogy: '像每次交接前把零件擦干净、校准到标准尺寸，下一道工序才不容易失控。',
      related: ['rmsnorm', 'transformer-block', 'residual']
    },
    {
      id: 'rmsnorm',
      group: 'Transformer',
      cn: 'RMS 归一化',
      en: 'RMSNorm',
      stage: 5,
      def: 'LayerNorm 的简化版：不减均值，只按均方根缩放，再乘可学习权重。LLaMA 等模型采用，计算更省。',
      how: '只统计向量元素的平方均值，省掉均值与偏置；实际效果在现代架构中与 LayerNorm 接近。',
      io: ['输入：d 维隐藏向量', '输出：同维归一化向量'],
      formula: 'y = x / √(mean(x²)+ε) · γ',
      analogy: '像只统一音量大小，不调整音色中心，省一道工序。',
      related: ['layernorm', 'transformer-block']
    },
    {
      id: 'residual',
      group: 'Transformer',
      cn: '残差连接',
      en: 'Residual Connection',
      stage: 5,
      def: '把子层输入直接加到子层输出上：y = x + f(x)。它给梯度提供短路径，使几十层甚至上百层的网络可以稳定训练。',
      how: '每个注意力子层和 FFN 子层外都包一层残差。深层模型还常用缩放残差、并行残差等变体。',
      io: ['输入：x 与子层输出 f(x)', '输出：x + f(x)'],
      formula: 'y = x + f(x)',
      analogy: '像传话游戏里允许每个人保留原稿：即使传歪了，原始信息也不会彻底丢失。',
      related: ['transformer-block', 'layernorm', 'stacking']
    },
    {
      id: 'ffn',
      group: 'Transformer',
      cn: '前馈网络',
      en: 'Feed Forward Network / MLP',
      stage: 5,
      def: '对每个位置独立作用的两层（或三层）全连接网络，中间维度通常比隐藏维度大 4 倍左右，常使用 SiLU/GELU 等激活函数。',
      how: '先升维、激活、再降维；不同位置共享同一组权重。它承担了大量参数与「知识存储」，注意力负责混合信息，FFN 负责逐位置变换。',
      io: ['输入：单个位置的 d 维向量', '输出：同维向量'],
      formula: 'FFN(x) = W₂·σ(W₁x + b₁) + b₂',
      analogy: '像每个工位各自对照手册加工自己的零件，工位之间不直接交流。',
      related: ['transformer-block', 'hidden-state']
    },
    {
      id: 'hidden-state',
      group: 'Transformer',
      cn: '隐藏状态',
      en: 'Hidden State',
      stage: 5,
      def: '序列中每个位置在某一层的向量表示。它随层数加深不断更新，最后一层的最后一个位置常被用来预测下一个 token。',
      how: '形状通常是 [序列长度 × 隐藏维度]。它不是「模型的意识」，而是可被线性读出、也可被可视化的中间数值。',
      io: ['输入：上一层隐藏状态', '输出：本层隐藏状态'],
      formula: 'Hˡ ∈ ℝ^(n×d)',
      analogy: '像会议逐轮更新的纪要：每讨论一轮，对同一句话的理解就更抽象一层。',
      related: ['stacking', 'lm-head', 'transformer-block']
    },
    {
      id: 'stacking',
      group: 'Transformer',
      cn: '多层堆叠',
      en: 'Layer Stacking',
      stage: 8,
      def: '把结构相同的 Block 重复 L 层。层数越多，模型能形成的抽象层次越深，但显存、延迟和训练难度也上升。',
      how: '每层有独立参数，输入输出维度不变。经验上浅层偏向词形与局部搭配，中层偏向句法，深层偏向语义与任务；这只是大致趋势，不是严格分工。',
      io: ['输入：第 0 层嵌入', '输出：第 L 层隐藏状态'],
      formula: 'H^L = Block^L ∘ … ∘ Block^1(H⁰)',
      analogy: '像审稿要过很多轮：第一轮改错字，中间轮调理逻辑，最后一轮看整体贡献。',
      related: ['transformer-block', 'hidden-state', 'residual']
    },

    /* ------------------------------------------------------------ 注意力 */
    {
      id: 'qkv',
      group: '注意力机制',
      cn: '查询、键、值',
      en: 'Query / Key / Value',
      stage: 6,
      def: '输入向量经过三个可学习线性变换得到的三组向量。Query 表示「我在找什么」，Key 表示「我能提供什么」，Value 是真正被加权汇总的内容。',
      how: 'Q 与所有 K 做点积得到相关性分数，softmax 归一化后对 V 加权求和。三者维度可以不同，但 Q、K 的维度必须一致。',
      io: ['输入：隐藏状态 H', '输出：Q、K、V 三组向量'],
      formula: 'Q=HW_Q，K=HW_K，V=HW_V',
      analogy: '像图书馆检索：你的检索词是 Q，书脊标签是 K，书里的内容是 V；匹配的是标签，取走的是内容。',
      related: ['attention-score', 'self-attention', 'multi-head']
    },
    {
      id: 'attention-score',
      group: '注意力机制',
      cn: '注意力分数',
      en: 'Attention Score',
      stage: 6,
      def: 'Query 与 Key 的点积，表示当前位置对另一个位置的关注强度。分数越高，说明两者的表示越匹配。',
      how: '对所有 Key 算分后除以 √dₖ、加掩码、做 softmax，得到每行和为 1 的权重，再用权重对 Value 加权求和。',
      io: ['输入：Q、K 向量', '输出：分数矩阵 / 权重矩阵'],
      formula: 'score(i,j) = qᵢ·kⱼ',
      analogy: '像相亲匹配度：不是谁更重要，而是「你的条件」和「对方的条件」有多合拍。',
      related: ['qkv', 'softmax', 'sqrt-dk', 'causal-mask']
    },
    {
      id: 'softmax',
      group: '注意力机制',
      cn: 'Softmax 归一化',
      en: 'Softmax',
      stage: 6,
      def: '把一组任意实数变成非负、总和为 1 的分布的函数。注意力和采样都用它，但目的不同：前者把分数变权重，后者把 logits 变概率。',
      how: '先取指数（放大差距、保证为正），再除以总和。数值实现通常先减去最大值，避免指数溢出。',
      io: ['输入：实数向量 z', '输出：概率向量 p，Σp=1'],
      formula: 'pᵢ = exp(zᵢ) / Σⱼ exp(zⱼ)',
      analogy: '像把一群人的支持票换算成百分比：总数固定，比例更能比较。',
      related: ['attention-score', 'temperature', 'logits']
    },
    {
      id: 'sqrt-dk',
      group: '注意力机制',
      cn: '缩放因子 √dₖ',
      en: 'Scaled Dot-Product',
      stage: 6,
      def: '点积注意力里除以 √dₖ 的做法。维度越大，点积的方差越大，不缩放会让 softmax 过度饱和、梯度变小。',
      how: 'dₖ 是每个头的键向量维度。缩放不改变排序，只改变分布的陡峭程度。',
      io: ['输入：点积分数', '输出：缩放后的分数'],
      formula: 'softmax(QKᵀ / √dₖ)',
      analogy: '像把不同量纲的评分先统一到同一把尺子上，否则分数越加越极端。',
      related: ['attention-score', 'softmax', 'multi-head']
    },
    {
      id: 'causal-mask',
      group: '注意力机制',
      cn: '因果掩码',
      en: 'Causal Mask',
      stage: 6,
      def: '在 decoder-only 模型中，把每个位置对「未来 token」的注意力分数设为 −∞，softmax 后权重为 0。它保证训练时不会偷看答案。',
      how: '通常用一个上三角为 −∞ 的掩码矩阵加到分数上。训练时可并行计算整句；推理时每个新 token 也只能看左侧。',
      io: ['输入：注意力分数矩阵', '输出：只保留左侧可见位置的分数'],
      formula: 'Mᵢⱼ = 0 (j≤i)；−∞ (j>i)',
      analogy: '像考试时用挡板遮住还没做的题，只能参考已经写完的部分。',
      related: ['decoder-only', 'self-attention', 'autoregressive']
    },
    {
      id: 'self-attention',
      group: '注意力机制',
      cn: '自注意力',
      en: 'Self-Attention',
      stage: 6,
      def: '同一序列内部的 token 互相计算注意力：每个位置根据与其他位置的匹配程度，汇总整句的信息。它是 Transformer 建模上下文的核心。',
      how: '一层里所有位置并行算 Q/K/V；每个位置得到一行注意力权重，对 V 加权求和。多头版本会并行多组。',
      io: ['输入：序列隐藏状态', '输出：同长度上下文向量'],
      formula: 'Attn(H)=softmax(QKᵀ/√dₖ+M)V',
      analogy: '像小组讨论：每个人发言前先判断「谁说的对我有用」，再综合大家的意见更新自己的观点。',
      related: ['qkv', 'attention-score', 'multi-head', 'causal-mask']
    },
    {
      id: 'multi-head',
      group: '注意力机制',
      cn: '多头注意力',
      en: 'Multi-Head Attention',
      stage: 7,
      def: '把隐藏维度切成 h 组，各自独立计算注意力，再把结果拼接并做一次线性投影。不同头可以关注不同模式。',
      how: '每个头有自己的 W_Q/W_K/W_V，头维度通常为 d/h。拼接后乘 W_O 混合各头信息。头数不是越多越好，需要与维度、算力平衡。',
      io: ['输入：序列隐藏状态', '输出：融合多视角的上下文向量'],
      formula: 'MHA = Concat(head₁,…,head_h)W_O',
      analogy: '像多位编辑同时审稿：有人盯逻辑，有人盯事实，有人盯语气，最后主编合并意见。',
      related: ['self-attention', 'qkv', 'vector-dimension']
    },

    /* ------------------------------------------------------------ 输出 */
    {
      id: 'lm-head',
      group: '输出与采样',
      cn: '语言模型输出头',
      en: 'LM Head',
      stage: 9,
      def: '把最后一层隐藏状态投影到词表维度的线性层，输出每个 token 的 logits。很多模型让输出头与嵌入矩阵共享权重（weight tying）。',
      how: '取最后一个位置的隐藏向量，乘以词表投影矩阵；得到长度为词表大小的分数向量。它不是概率，需要 softmax 才变概率。',
      io: ['输入：最后一个位置的隐藏状态', '输出：词表维度的 logits'],
      formula: 'z = h_last · W_vocabᵀ',
      analogy: '像把所有候选词排成一排打分，但分数还没换算成百分比。',
      related: ['logits', 'vocabulary', 'hidden-state']
    },
    {
      id: 'logits',
      group: '输出与采样',
      cn: '对数几率分数',
      en: 'Logits',
      stage: 9,
      def: '模型在 softmax 之前输出的未归一化实数分数，可正可负、总和不为 1。它只表示相对偏好，不能直接叫概率。',
      how: 'logits 经 softmax（可选 temperature 缩放）变成概率；采样或取 argmax 得到下一个 token。',
      io: ['输入：隐藏状态', '输出：词表大小的分数向量'],
      formula: 'p = softmax(z / T)',
      analogy: '像比赛评委的原始打分：可以用来排名，但不是「获胜概率」。',
      related: ['lm-head', 'softmax', 'temperature', 'vocabulary']
    },
    {
      id: 'vocabulary',
      group: '输出与采样',
      cn: '词表',
      en: 'Vocabulary',
      stage: 9,
      def: '模型认识的全部 token 集合，大小从几万到二十多万不等。输出层维度通常与词表大小一致。',
      how: '词表由分词器训练得到，包含常见字词、子词、标点、特殊标记（如 BOS、EOS）。词表外的文本会被拆成更小的片段，不会出现「未知词」报错。',
      io: ['输入：分词器训练结果', '输出：token ↔ ID 的双向映射'],
      formula: '|V| = 词表大小',
      analogy: '像模型的字母表：它只会用表里的积木拼东西。',
      related: ['tokenizer', 'lm-head', 'logits']
    },
    {
      id: 'temperature',
      group: '输出与采样',
      cn: '温度',
      en: 'Temperature',
      stage: 10,
      def: '采样前对 logits 的缩放系数 T。T<1 让分布更尖锐（更确定），T>1 让分布更平坦（更随机），T=0 等价于贪心。',
      how: '计算 softmax(z/T)。温度不改变模型的「知识」，只改变从分布中抽取时的随机程度；它也不是 Top-K/Top-P。',
      io: ['输入：logits 与 T', '输出：调整后的概率分布'],
      formula: 'pᵢ(T) = exp(zᵢ/T) / Σⱼ exp(zⱼ/T)',
      analogy: '像调收音机的旋钮：调低更清楚但死板，调高更活跃但杂音多。',
      related: ['logits', 'top-k', 'top-p', 'softmax']
    },
    {
      id: 'top-k',
      group: '输出与采样',
      cn: 'Top-K 采样',
      en: 'Top-K Sampling',
      stage: 10,
      def: '只保留概率最高的 K 个候选，重新归一化后按权重抽取。K 固定，候选数量不随分布形状变化。',
      how: '对概率排序取前 K，其余置零；再重归一化。K=1 即贪心。K 太大可能放进长尾噪声，太小会过于保守。',
      io: ['输入：概率分布与 K', '输出：截断后的分布'],
      formula: 'keep = topK(p, K)；p′ = p_keep / Σp_keep',
      analogy: '像点菜只从菜单前五名里选，不管今天有多少特价。',
      related: ['top-p', 'temperature', 'sampling']
    },
    {
      id: 'top-p',
      group: '输出与采样',
      cn: '核采样 Top-P',
      en: 'Top-P / Nucleus Sampling',
      stage: 10,
      def: '按概率从高到低累加，保留累计概率达到 P 的最小候选集合，再重归一化采样。候选数量随分布形状自适应。',
      how: '分布尖锐时集合小，分布平坦时集合大。P 常取 0.9～0.95；Top-P 与 Top-K 可以叠加使用，顺序会影响力结果。',
      io: ['输入：概率分布与阈值 P', '输出：截断后的分布'],
      formula: '最小集合 S：Σ_{i∈S} pᵢ ≥ P',
      analogy: '像打包行李：先装最有用的，装到总价值达到 90% 就停，不固定件数。',
      related: ['top-k', 'temperature', 'sampling']
    },
    {
      id: 'greedy-decoding',
      group: '输出与采样',
      cn: '贪心解码',
      en: 'Greedy Decoding',
      stage: 10,
      def: '每一步都选概率最高的 token，不做随机采样。输出确定、可复现，但容易重复、缺乏多样性。',
      how: 'argmax(softmax(z))。若模型与输入完全固定，结果通常一致；实际服务还受浮点、批处理等影响。',
      io: ['输入：logits', '输出：下一个 token'],
      formula: 'y = argmax p',
      analogy: '像每次都走地图上最宽的那条路，稳定但可能错过风景。',
      related: ['beam-search', 'temperature', 'sampling']
    },
    {
      id: 'beam-search',
      group: '输出与采样',
      cn: '束搜索',
      en: 'Beam Search',
      stage: 10,
      def: '同时保留 B 条候选序列，每步扩展并保留总分最高的 B 条。它优化序列整体概率，常用于翻译等任务，但对话中可能显得保守、重复。',
      how: '维护 beam 宽度 B，按累计对数概率排序剪枝。可与长度惩罚配合；计算量约为贪心的 B 倍。',
      io: ['输入：每步分布与束宽 B', '输出：若干候选序列'],
      formula: '保留累计 log p 最高的 B 条路径',
      analogy: '像同时派几支侦察队探路，最后选总路程最短的那条，而不是每步都选眼前最好走的。',
      related: ['greedy-decoding', 'sampling']
    },
    {
      id: 'sampling',
      group: '输出与采样',
      cn: '采样',
      en: 'Sampling',
      stage: 10,
      def: '按概率分布随机抽取下一个 token。相同 Prompt 多次生成可能不同，原因就在这一步的随机性（以及温度、Top-K/P 等设置）。',
      how: '常用逆变换采样：生成 [0,1) 随机数，沿累计概率找到落点。temperature 调形状，top-k/top-p 截断候选，最后在截断分布上抽取。',
      io: ['输入：概率分布 / 随机数', '输出：一个 token'],
      formula: 'y ~ p′(·)，p′ 为截断并重归一化后的分布',
      analogy: '像转盘抽奖：概率大的格子更大，但仍可能抽到小格子。',
      related: ['temperature', 'top-k', 'top-p', 'softmax']
    },

    /* ------------------------------------------------------------ 自回归 */
    {
      id: 'autoregressive',
      group: '自回归生成',
      cn: '自回归生成',
      en: 'Autoregressive Generation',
      stage: 11,
      def: '把刚生成的 token 追加到输入，再预测下一个，循环直到停止。语言模型一次前向只产出一个位置的分布，因此文本必须逐个 token 生成。',
      how: 'Prefill 阶段并行处理整段输入；Decode 阶段每次只处理新 token，并用 KV Cache 复用历史 K/V。生成长度、停止符和采样策略共同决定何时结束。',
      io: ['输入：当前序列', '输出：扩展一个 token 的新序列'],
      formula: 'sₜ₊₁ = sₜ ⊕ [yₜ]，yₜ ~ p(·|sₜ)',
      analogy: '像写接龙小说：每写一个词，就把稿子再读一遍，决定下一个词。',
      related: ['kv-cache', 'prefill-decode', 'eos', 'sampling']
    },
    {
      id: 'kv-cache',
      group: '自回归生成',
      cn: 'KV 缓存',
      en: 'KV Cache',
      stage: 11,
      def: '推理时缓存历史 token 在每一层的 Key、Value 向量，避免每生成一个 token 都把整段前缀重算一遍。它保存的是张量，不是对话文本。',
      how: 'Prefill 时一次性算好输入各层的 K/V；Decode 时只算新 token 的 Q/K/V，并追加到缓存。显存占用随层数、头数、序列长度线性增长，长上下文时非常可观。',
      io: ['输入：历史 K/V 与新 token', '输出：扩展后的 K/V 缓存'],
      formula: 'cache += [Kₜ, Vₜ]（每层）',
      analogy: '像做菜时把切好的备料放进冰箱：下一道菜直接用，不必每次重新切。',
      related: ['autoregressive', 'prefill-decode', 'vram']
    },
    {
      id: 'prefill-decode',
      group: '自回归生成',
      cn: '预填充与解码',
      en: 'Prefill / Decode',
      stage: 11,
      def: '推理的两个阶段。Prefill 并行处理整段输入，计算量大但可充分利用 GPU；Decode 逐 token 生成，单步计算小、常受显存带宽限制。',
      how: '首 token 延迟主要由 Prefill 决定；后续每 token 延迟由 Decode 决定。服务端常把多个请求的 Decode 合批（continuous batching）提高吞吐。',
      io: ['输入：完整 Prompt', '输出：首 token（Prefill）；后续 token（Decode）'],
      formula: 'TTFT ≈ Prefill；TPOT ≈ 单步 Decode',
      analogy: '像先通读整份材料再动笔（Prefill），之后每写一句都要停一下想下一个词（Decode）。',
      related: ['autoregressive', 'kv-cache', 'continuous-batching', 'batching']
    },

    /* ------------------------------------------------------------ 解码与返回 */
    {
      id: 'detokenization',
      group: '解码与返回',
      cn: '反分词',
      en: 'Detokenization',
      stage: 12,
      def: '把 token ID 序列还原成文本：ID → token 字符串 → 按规则拼接。它不是简单加空格，还要处理子词边界、字节回退和特殊标记。',
      how: '用与编码相同的词表反查；有些分词器用特殊前缀表示空格（如 Ġ），字节级 BPE 还需要把字节序列还原成 UTF-8。最后过滤 EOS 等控制符。',
      io: ['输入：token ID 序列', '输出：自然语言文本'],
      formula: 'text = concat(decode_token(idᵢ))',
      analogy: '像拼图：每块背后写着编号，按编号找回对应图块并拼回去。',
      related: ['tokenizer', 'streaming', 'eos']
    },
    {
      id: 'eos',
      group: '解码与返回',
      cn: '结束符',
      en: 'EOS Token',
      stage: 13,
      def: 'End Of Sequence，一个特殊 token，表示「这句话说完了」。模型输出它时，生成循环停止。',
      how: 'EOS 是词表里的特殊标记，训练时出现在样本末尾。推理时若采样到它，服务端结束本次生成；它本身通常不会显示给用户。',
      io: ['输入：下一个 token 分布', '输出：停止信号或继续生成'],
      formula: 'if yₜ = <EOS> then stop',
      analogy: '像邮件末尾的「完」：看到它就知道不用再往下读了。',
      related: ['max-tokens-stop', 'autoregressive', 'detokenization']
    },
    {
      id: 'max-tokens-stop',
      group: '解码与返回',
      cn: '长度上限与停止串',
      en: 'Max Tokens / Stop Sequence',
      stage: 13,
      def: '除 EOS 外的两种常见停止条件：达到最大生成长度 max_tokens，或输出中出现指定的停止字符串 stop sequence。',
      how: 'max_tokens 是硬上限，防止无限生成与费用失控；stop sequence 由应用层匹配，命中后截断。两者都可能让回答在句中戛然而止。',
      io: ['输入：生成配置与输出 token', '输出：是否停止'],
      formula: 'stop if len≥max_tokens ∨ suffix∈stop[]',
      analogy: '像演讲有时间限制和暗号：时间到或听到暗号就下台。',
      related: ['eos', 'autoregressive', 'streaming']
    },
    {
      id: 'streaming',
      group: '解码与返回',
      cn: '流式返回',
      en: 'Streaming / SSE',
      stage: 13,
      def: '服务端每生成一小段 token 就立即推给前端，而不是等全部生成完再响应。常见实现是 SSE（Server-Sent Events），也有 WebSocket 或 HTTP chunked。',
      how: '模型推理与网络传输是两层：模型内部仍逐 token 生成，服务端把增量文本编码成事件推送；前端拼接增量并逐字渲染。',
      io: ['输入：增量 token', '输出：浏览器端逐步显示的事件流'],
      formula: 'data: {"delta":"…"}\\n\\n（SSE 帧）',
      analogy: '像厨师边做边上菜，而不是等整桌菜齐了才端出来。',
      related: ['detokenization', 'max-tokens-stop', 'inference']
    },
    {
      id: 'inference',
      group: '解码与返回',
      cn: '推理与训练',
      en: 'Inference vs Training',
      stage: 13,
      def: '训练通过反向传播更新权重，目标是学会预测；推理只做前向计算，权重冻结，目标是生成结果。本项目演示的是推理。',
      how: '推理没有梯度与参数更新；常用低精度、KV Cache、批处理、并行化优化。训练则需要梯度、优化器状态和更大的显存。',
      io: ['输入：训练：数据与权重；推理：Prompt 与权重', '输出：训练：更新后的权重；推理：token 分布'],
      formula: '训练：θ ← θ − η∇L；推理：y = f_θ(x)',
      analogy: '像学生备考（训练）和考试答题（推理）：考试时不会再改大脑结构，只是调用已学内容。',
      related: ['streaming', 'model-weights', 'simulation-note']
    },
    {
      id: 'simulation-note',
      group: '解码与返回',
      cn: '关于本页的 3D 演示',
      en: 'Simulation Disclaimer',
      stage: 13,
      def: '本页的 3D 场景、粒子数量、矩阵数值、耗时和 token 计数都是原理演示与模拟数据，不是真实模型内部张量的实时可视化，也不代表任何特定模型的真实输出。',
      how: '页面里可交互的注意力权重、softmax、Top-K/Top-P 与采样由浏览器本地小规模计算得出，用来展示数学关系；真实模型的维度、层数与数值规模远大于此。',
      io: ['输入：示例文本与演示参数', '输出：可视化动画与解释'],
      formula: '演示 ≠ 实测；示意 ≠ 该模型的实际内部状态',
      analogy: '像用玩具模型讲解发动机：结构对得上，但马力不能照搬。',
      related: ['inference', 'attention-score', 'sampling']
    },

    /* ------------------------------------------------------------ 基础设施 */
    {
      id: 'gpu-cuda',
      group: '推理基础设施',
      cn: 'GPU 与 CUDA',
      en: 'GPU / CUDA',
      stage: 0,
      def: 'GPU 用成千上万个简单核心并行执行矩阵运算；CUDA 是 NVIDIA 的并行计算平台与编程模型，让开发者把算子放到 GPU 上跑。',
      how: '一次矩阵乘会被拆成许多线程块并行计算；CPU 负责调度与网络 I/O，GPU 负责密集计算。其他厂商也有 ROCm、Metal 等对应方案。',
      io: ['输入：权重、激活值、算子', '输出：计算结果 / 新激活值'],
      formula: 'Y = XW + b，按块并行',
      analogy: '像一千个人同时搬砖：不是每个人更快，而是同时干活的人多。',
      related: ['tensor-core', 'vram', 'distributed-inference']
    },
    {
      id: 'tensor-core',
      group: '推理基础设施',
      cn: '张量核心',
      en: 'Tensor Core',
      stage: 0,
      def: 'GPU 中专门加速矩阵乘加（MMA）的硬件单元，支持 FP16/BF16/TF32/INT8 等低精度输入与更高精度累加。',
      how: '一条指令完成小矩阵块的乘加，配合分块与共享内存提高吞吐。是否启用取决于精度、形状与软件栈；并非所有算子都能吃到这个加速。',
      io: ['输入：小矩阵块（如 16×16）', '输出：累加后的矩阵块'],
      formula: 'D = A×B + C（硬件 MMA）',
      analogy: '像专门的流水线压铸机：一次压出一整块，而不是逐个零件打磨。',
      related: ['gpu-cuda', 'quantization']
    },
    {
      id: 'vram',
      group: '推理基础设施',
      cn: '显存',
      en: 'VRAM',
      stage: 0,
      def: 'GPU 的专用内存，存放模型权重、KV Cache、激活值和临时缓冲区。容量与带宽共同决定能跑多大的模型、多长的上下文。',
      how: '权重常驻显存；KV Cache 随并发与上下文增长；激活值在计算中临时占用。显存不足会出现 OOM，需要量化、切分或换卡。',
      io: ['输入：权重 / 激活 / KV', '输出：可复用的显存块'],
      formula: '显存 ≈ 权重 + KV Cache + 激活 + 框架开销',
      analogy: '像工作台面积：材料、半成品和工具都摊在上面，台子小了就摆不开。',
      related: ['kv-cache', 'model-weights', 'quantization']
    },
    {
      id: 'model-weights',
      group: '推理基础设施',
      cn: '模型权重',
      en: 'Model Weights',
      stage: 0,
      def: '训练得到的参数张量，包括嵌入、注意力投影、FFN、归一化参数和输出头。推理时它们是只读的。',
      how: '启动时从磁盘加载到显存，常做格式转换与量化。参数数量决定基础显存需求：FP16 下每 10 亿参数约 2 GB，另有缓存与激活开销。',
      io: ['输入：检查点文件', '输出：显存中的权重张量'],
      formula: '显存(权重) ≈ 参数量 × 每参数字节数',
      analogy: '像一本印好的教材：考试时只翻不改。',
      related: ['vram', 'quantization', 'inference']
    },
    {
      id: 'quantization',
      group: '推理基础设施',
      cn: '量化',
      en: 'Quantization',
      stage: 0,
      def: '把权重或激活从高精度浮点（FP32/FP16/BF16）压缩到低精度（INT8/INT4 等），以减少显存和带宽、提高吞吐，可能带来精度损失。',
      how: '常见有训练后量化（PTQ）与量化感知训练（QAT）；可按通道缩放、保留少数敏感层。INT4 权重常配合 FP16 激活计算（weight-only）。',
      io: ['输入：FP16 权重与校准数据', '输出：低精度权重与缩放因子'],
      formula: 'w_q = round(w / s) + z',
      analogy: '像把高清图压成 JPEG：体积小很多，放大看会有细节损失。',
      related: ['model-weights', 'vram', 'tensor-core']
    },
    {
      id: 'batching',
      group: '推理基础设施',
      cn: '批处理',
      en: 'Batching',
      stage: 0,
      def: '把多个请求拼成一个 batch 一起送进 GPU，提高硬件利用率与吞吐。请求长度不同时需要填充或变长处理。',
      how: '静态 batch 一次组好、跑完再组下一批；填充会浪费算力。对话场景更常用动态批处理，以 token 为单位调度。',
      io: ['输入：多条请求', '输出：合并后的批计算结果'],
      formula: 'throughput ↑，单请求延迟可能 ↑',
      analogy: '像拼车：多个人一起走更省油，但每个人都可能多等一会儿。',
      related: ['continuous-batching', 'prefill-decode', 'gpu-cuda']
    },
    {
      id: 'continuous-batching',
      group: '推理基础设施',
      cn: '连续批处理',
      en: 'Continuous Batching',
      stage: 0,
      def: '以迭代（每生成一步）为单位动态调度请求：完成的请求立刻退出，新请求立刻补位，不必等整批结束。vLLM、TensorRT-LLM 等采用类似思路。',
      how: '调度器维护运行中的序列集合，每步组 batch；配合 PagedAttention 管理 KV Cache 分页，减少碎片与浪费。',
      io: ['输入：到达/完成的请求流', '输出：每步动态组批的执行计划'],
      formula: '每步 batch = 当前活跃序列（可变）',
      analogy: '像餐厅翻台：一桌吃完立刻收拾迎下一桌，而不是等整层楼都吃完。',
      related: ['batching', 'prefill-decode', 'vram']
    },
    {
      id: 'tensor-parallel',
      group: '推理基础设施',
      cn: '张量并行',
      en: 'Tensor Parallelism',
      stage: 0,
      def: '把单层的大矩阵切到多张 GPU 上，每张卡算一部分，再通过通信汇总。适合单卡放不下、层内计算量大的场景。',
      how: '常见按列/按行切分权重，注意 All-Reduce 通信开销。张量并行通常要求卡间高带宽（如 NVLink），跨节点扩展性有限。',
      io: ['输入：单层权重与激活', '输出：分片计算后拼接的结果'],
      formula: 'Y = [X₁W₁, X₂W₂] 后汇总',
      analogy: '像一张大报表拆给几个人同时算，再对对总数。',
      related: ['pipeline-parallel', 'distributed-inference', 'gpu-cuda']
    },
    {
      id: 'pipeline-parallel',
      group: '推理基础设施',
      cn: '流水线并行',
      en: 'Pipeline Parallelism',
      stage: 0,
      def: '按层把模型切到多张 GPU：前几层在卡 0，后几层在卡 1，数据像流水线一样传递。适合层数多、单层能放下的模型。',
      how: '把 batch 切成微批以提高流水线利用率；存在气泡与跨卡传输。常与张量并行组合成多维并行。',
      io: ['输入：按层切分的模型与微批', '输出：流水线式计算的结果'],
      formula: 'GPU₀: layers 1…k；GPU₁: layers k+1…L',
      analogy: '像工厂流水线：每道工序在不同车间，半成品依次传递。',
      related: ['tensor-parallel', 'distributed-inference', 'batching']
    },
    {
      id: 'distributed-inference',
      group: '推理基础设施',
      cn: '分布式推理',
      en: 'Distributed Inference',
      stage: 0,
      def: '把推理任务分布到多卡、多机：组合张量并行、流水线并行、数据并行与专家并行，并用高速网络通信。',
      how: '目标是更大的模型、更长的上下文或更高的吞吐。跨机通信通常走 RDMA/InfiniBand；调度、容错、负载均衡都是工程难点。',
      io: ['输入：请求与集群资源', '输出：分布式执行后的响应'],
      formula: '总吞吐 = 单卡吞吐 × 卡数 × 效率',
      analogy: '像跨城协作：人多了能干更大的项目，但沟通成本也跟着涨。',
      related: ['tensor-parallel', 'pipeline-parallel', 'continuous-batching']
    }
  ];

  /* id → 条目，供多处查询 */
  LLM.KNOWLEDGE_MAP = LLM.KNOWLEDGE.reduce(function (map, item) {
    map[item.id] = item;
    return map;
  }, {});

  LLM.knowledgeOfStage = function (stageNo) {
    return LLM.KNOWLEDGE.filter(function (item) {
      return item.stage === stageNo;
    });
  };
})();
