# 技术口径与参考来源

本项目是原理演示，不是任何模型的实现或实测记录。下面列出知识库内容所依据的公开资料与关键取舍，便于核对。

## 主要参考

1. Vaswani et al., *Attention Is All You Need*, 2017.  
   <https://arxiv.org/abs/1706.03762>  
   Transformer、缩放点积注意力、多头注意力、正弦位置编码、Encoder-Decoder 的原始定义。
2. Su et al., *RoFormer: Enhanced Transformer with Rotary Position Embedding*, 2021.  
   <https://arxiv.org/abs/2104.09864>  
   RoPE 的旋转形式与相对位置性质。
3. Press et al., *Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation*, 2022.  
   <https://arxiv.org/abs/2108.12409>  
   ALiBi 的距离线性偏置。
4. Brown et al., *Language Models are Few-Shot Learners*（GPT-3）, 2020.  
   <https://arxiv.org/abs/2005.14165>  
   decoder-only、自回归、上下文学习。
5. Touvron et al., *LLaMA: Open and Efficient Foundation Language Models*, 2023.  
   <https://arxiv.org/abs/2302.13971>  
   RMSNorm、SwiGLU、RoPE 等现代 decoder-only 配置。
6. Raffel et al., *Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer*（T5）, 2020.  
   <https://arxiv.org/abs/1910.10683>  
   Encoder-Decoder 与 span corruption。
7. Devlin et al., *BERT: Pre-training of Deep Bidirectional Transformers*, 2019.  
   <https://arxiv.org/abs/1810.04805>  
   Encoder-only 与双向注意力。
8. Kwon et al., *Efficient Memory Management for Large Language Model Serving with PagedAttention*（vLLM）, 2023.  
   <https://arxiv.org/abs/2309.06180>  
   KV Cache 分页、连续批处理与吞吐优化。
9. Dao et al., *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness*, 2022.  
   <https://arxiv.org/abs/2205.14135>  
   注意力实现与显存/带宽权衡（仅作背景，不在页面中展开）。
10. NVIDIA, *TensorRT-LLM documentation* 与 *CUDA C Programming Guide*.  
    <https://nvidia.github.io/TensorRT-LLM/> · <https://docs.nvidia.com/cuda/cuda-c-programming-guide/>  
    Tensor Core、量化、批处理、张量并行与流水线并行的工程背景。
11. Hugging Face, *Tokenizer* 与 *Generation strategies* 文档.  
    <https://huggingface.co/docs/transformers/tokenizer_summary> · <https://huggingface.co/docs/transformers/generation_strategies>  
    BPE / WordPiece / Unigram、贪心/束搜索/Top-K/Top-P。

## 页面中的关键取舍

- **以 decoder-only 为主**：项目演示的是「输入 Prompt → 逐个 token 生成」的推理路径，因此主流程采用因果注意力；知识库同时解释 Encoder-only 与 Encoder-Decoder，避免把所有模型都描述成 GPT。
- **位置编码不是唯一答案**：页面明确列出正弦编码、可学习位置嵌入、RoPE、ALiBi，并说明现代模型多用 RoPE；不把正弦编码写成「Transformer 的唯一做法」。
- **归一化区分 LayerNorm / RMSNorm**：介绍 Pre-LN/Post-LN 的放置差异，不把两种归一化混为一谈。
- **logits 不等于概率**：LM Head 输出原始分数，softmax（可带温度）之后才是概率；采样建立在概率分布上。
- **Temperature / Top-K / Top-P 分开讲**：温度缩放分布形状；Top-K 固定候选数；Top-P 按累计概率自适应截断。
- **KV Cache 不是聊天记录**：缓存的是每层历史 token 的 K/V 张量；长上下文与高并发会显著增加显存占用。
- **训练与推理分开**：页面只演示推理，不把反向传播、优化器状态混入生成流程。
- **应用层与模型层分开**：SSE/WebSocket、停止串、鉴权、限流属于服务层；模型内部只负责产生 token 分布。
- **GPU 并行不是串行**：矩阵运算、批处理、连续批处理、张量并行与流水线并行按工程实际描述。
- **明确标注演示**：3D 数值、耗时、token 计数、注意力矩阵都是小规模演示；分词为近似实现，回答为预置文案，项目不连接任何 API。

## 复核建议

如果要进一步核对某个数字或说法：

1. 先看 [data.knowledge.js](../src/js/data.knowledge.js) 中对应条目的 `def` / `how` / `note`；
2. 再看 [data.stages.js](../src/js/data.stages.js) 里该阶段的 `ops` / `note`；
3. 最后对照上面的论文或官方文档。页面不引用未标注来源的具体参数量、层数或价格数字；涉及「常见范围」时均写为范围或「取决于模型」。
