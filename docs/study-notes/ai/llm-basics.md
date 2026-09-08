---
title: "LLM基础原理"
tags:
  - "Agent"
  - "LLM"
  - "基础理论"
category: "Agent开发"
folder: "基础理论"
created: 2026-09-07
updated: 2026-09-07
---

# LLM 基础原理

## 一、什么是大语言模型

### 1.1 定义与本质

大语言模型(Large Language Model, LLM)是基于深度学习的自然语言处理模型,通过在海量文本数据上进行预训练,学习语言的统计规律和语义关系,从而具备理解和生成人类语言的能力。

**核心特征:**
- **规模**: 参数量从数十亿到数千亿(GPT-3: 175B, GPT-4推测超过1T)
- **架构**: 基于Transformer的自注意力机制
- **训练**: 自监督学习,预测下一个token
- **涌现能力**: 参数规模达到一定程度后出现的新能力(reasoning, few-shot learning等)

### 1.2 LLM的发展历程

```
2017年 - Transformer诞生
  《Attention is All You Need》论文
  Google提出Transformer架构
  ↓
2018年 - BERT时代
  双向编码器,预训练+微调范式
  NLP任务性能大幅提升
  ↓
2019年 - GPT-2
  单向生成式模型
  1.5B参数,生成能力显著
  ↓
2020年 - GPT-3
  175B参数
  Few-shot learning能力
  开启大模型时代
  ↓
2022年 - ChatGPT
  基于GPT-3.5 + RLHF
  对话能力革命性突破
  ↓
2023年 - GPT-4/Claude 3
  多模态能力
  128K-200K超长上下文
  推理能力再次飞跃
  ↓
2024年至今 - 百花齐放
  开源模型(LLaMA 3, Qwen, DeepSeek)
  长上下文(Gemini 1M+)
  多模态融合(GPT-4V, Claude 3)
```

### 1.3 主流模型横向对比

| 模型 | 开发者 | 参数量 | 上下文 | 训练数据截止 | 特点 | 价格(输入/输出) |
|-----|--------|-------|--------|------------|------|--------------|
| **GPT-4 Turbo** | OpenAI | 未公开 | 128K | 2023-04 | 综合最强 | $10/$30 per 1M tokens |
| **GPT-3.5 Turbo** | OpenAI | 未公开 | 16K | 2021-09 | 性价比高 | $0.5/$1.5 per 1M tokens |
| **Claude 3 Opus** | Anthropic | 未公开 | 200K | 2023-08 | 长文本强 | $15/$75 per 1M tokens |
| **Claude 3 Sonnet** | Anthropic | 未公开 | 200K | 2023-08 | 平衡 | $3/$15 per 1M tokens |
| **Claude 3 Haiku** | Anthropic | 未公开 | 200K | 2023-08 | 快速便宜 | $0.25/$1.25 per 1M tokens |
| **Gemini 1.5 Pro** | Google | 未公开 | 1M | 2024 | 超长上下文 | $7/$21 per 1M tokens |
| **LLaMA 3 70B** | Meta | 70B | 8K | 2023 | 开源最强 | 免费(自部署) |
| **Qwen 2.5 72B** | 阿里 | 72B | 32K | 2024 | 中文优秀 | 免费(自部署) |

---

## 二、Transformer架构深度解析

### 2.1 整体架构

Transformer由编码器(Encoder)和解码器(Decoder)组成,但现代LLM主要使用:
- **Decoder-only**: GPT系列、LLaMA(生成式任务)
- **Encoder-only**: BERT系列(理解式任务)
- **Encoder-Decoder**: T5、BART(翻译等seq2seq任务)

**Decoder-only架构(以GPT为例):**

```
输入文本: "你好世界"
     ↓
[1] Tokenization (分词)
     ["你", "好", "世", "界"] → [101, 872, 1266, 2345]
     ↓
[2] Token Embedding (词嵌入)
     每个token转为d_model维向量 (如768维)
     ↓
[3] Positional Encoding (位置编码)
     添加位置信息(让模型知道词序)
     ↓
[4] Transformer Blocks × N (堆叠多层)
     ┌──────────────────────────────┐
     │ Multi-Head Self-Attention    │ ← 核心:捕捉token间关系
     │         ↓                    │
     │ Add & Norm (残差+归一化)      │
     │         ↓                    │
     │ Feed Forward Network         │ ← 非线性变换
     │         ↓                    │
     │ Add & Norm                   │
     └──────────────────────────────┘
     ↓
[5] Output Linear Layer (输出层)
     映射到词表大小的logits向量
     ↓
[6] Softmax → 概率分布
     每个token的概率
     ↓
[7] Sampling (采样)
     根据概率选择下一个token
```

**关键参数:**
- **d_model**: 隐藏层维度 (GPT-3: 12288)
- **n_layers**: Transformer层数 (GPT-3: 96层)
- **n_heads**: 注意力头数 (GPT-3: 96头)
- **d_ff**: 前馈网络维度 (通常4×d_model)
- **vocab_size**: 词表大小 (GPT-3: 50257)

### 2.2 Self-Attention机制详解

**核心思想**: 让每个token关注序列中的所有token,计算相关性权重。

**数学表达:**

```
Q = X × W_Q  (Query: 查询)
K = X × W_K  (Key: 键)
V = X × W_V  (Value: 值)

Attention(Q, K, V) = softmax(Q×K^T / √d_k) × V
```

**直观理解:**

假设输入句子: "猫坐在垫子上"

```
对于token"猫":
  Q_猫 与 K_猫, K_坐, K_在, K_垫子, K_上 分别计算相似度
  → 得到权重: [0.5, 0.2, 0.1, 0.15, 0.05]
  → 加权求和: 0.5×V_猫 + 0.2×V_坐 + ... 
  → 得到"猫"的新表示(包含上下文信息)
```

**完整Python实现:**

```python
import torch
import torch.nn.functional as F

def scaled_dot_product_attention(Q, K, V, mask=None):
    """
    缩放点积注意力
    
    Args:
        Q: [batch, seq_len, d_k] 查询矩阵
        K: [batch, seq_len, d_k] 键矩阵
        V: [batch, seq_len, d_v] 值矩阵
        mask: [batch, seq_len, seq_len] 注意力掩码
    
    Returns:
        output: [batch, seq_len, d_v]
        attention_weights: [batch, seq_len, seq_len]
    """
    # 1. 计算注意力分数
    d_k = Q.size(-1)
    scores = torch.matmul(Q, K.transpose(-2, -1)) / torch.sqrt(torch.tensor(d_k, dtype=torch.float32))
    # scores shape: [batch, seq_len, seq_len]
    
    # 2. 应用掩码(用于decoder,遮蔽未来位置)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, -1e9)
    
    # 3. Softmax归一化为概率
    attention_weights = F.softmax(scores, dim=-1)
    
    # 4. 加权求和
    output = torch.matmul(attention_weights, V)
    
    return output, attention_weights

class MultiHeadAttention(torch.nn.Module):
    """多头注意力"""
    
    def __init__(self, d_model=512, num_heads=8):
        super().__init__()
        assert d_model % num_heads == 0
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads  # 每个头的维度
        
        # 线性变换层
        self.W_Q = torch.nn.Linear(d_model, d_model)
        self.W_K = torch.nn.Linear(d_model, d_model)
        self.W_V = torch.nn.Linear(d_model, d_model)
        self.W_O = torch.nn.Linear(d_model, d_model)
    
    def split_heads(self, x):
        """分割成多个头"""
        batch_size = x.size(0)
        # x: [batch, seq_len, d_model]
        x = x.view(batch_size, -1, self.num_heads, self.d_k)
        # 转置: [batch, num_heads, seq_len, d_k]
        return x.transpose(1, 2)
    
    def forward(self, Q, K, V, mask=None):
        batch_size = Q.size(0)
        
        # 1. 线性变换
        Q = self.W_Q(Q)  # [batch, seq_len, d_model]
        K = self.W_K(K)
        V = self.W_V(V)
        
        # 2. 分割成多头
        Q = self.split_heads(Q)  # [batch, num_heads, seq_len, d_k]
        K = self.split_heads(K)
        V = self.split_heads(V)
        
        # 3. 应用注意力
        attn_output, attn_weights = scaled_dot_product_attention(Q, K, V, mask)
        # attn_output: [batch, num_heads, seq_len, d_k]
        
        # 4. 合并多头
        attn_output = attn_output.transpose(1, 2).contiguous()
        # [batch, seq_len, num_heads, d_k]
        attn_output = attn_output.view(batch_size, -1, self.d_model)
        # [batch, seq_len, d_model]
        
        # 5. 最后的线性变换
        output = self.W_O(attn_output)
        
        return output, attn_weights

# 使用示例
batch_size, seq_len, d_model = 2, 10, 512
num_heads = 8

# 创建模块
mha = MultiHeadAttention(d_model=d_model, num_heads=num_heads)

# 输入
x = torch.randn(batch_size, seq_len, d_model)

# 前向传播(自注意力: Q=K=V=x)
output, weights = mha(x, x, x)

print(f"输入形状: {x.shape}")          # [2, 10, 512]
print(f"输出形状: {output.shape}")     # [2, 10, 512]
print(f"注意力权重: {weights.shape}")  # [2, 8, 10, 10]
```

**为什么要Multi-Head(多头)?**

1. **捕捉不同语义关系**: 
   - 头1可能关注语法关系(主谓宾)
   - 头2可能关注语义相似性
   - 头3可能关注共指消解

2. **增强表达能力**:
   - 单头只能学习一种注意力模式
   - 多头并行学习多种模式

3. **类比CNN的多个卷积核**:
   - CNN用多个卷积核提取不同特征
   - Transformer用多个注意力头捕捉不同关系

**实际例子(GPT-3):**
- 96个头
- 每个头维度: 12288 / 96 = 128
- 同时关注96种不同的语义关系

### 2.3 Position Encoding(位置编码)

**问题**: Self-Attention是置换不变的,即"猫咬狗"和"狗咬猫"会得到相同的表示。

**解决**: 添加位置信息。

**Sinusoidal Position Encoding(正弦位置编码):**

```python
import numpy as np
import matplotlib.pyplot as plt

def get_positional_encoding(seq_len, d_model):
    """
    生成位置编码
    
    PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
    PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
    """
    position = np.arange(seq_len)[:, np.newaxis]  # [seq_len, 1]
    div_term = np.exp(np.arange(0, d_model, 2) * -(np.log(10000.0) / d_model))
    
    pe = np.zeros((seq_len, d_model))
    pe[:, 0::2] = np.sin(position * div_term)  # 偶数维度用sin
    pe[:, 1::2] = np.cos(position * div_term)  # 奇数维度用cos
    
    return pe

# 生成位置编码
seq_len, d_model = 100, 512
pe = get_positional_encoding(seq_len, d_model)

# 可视化
plt.figure(figsize=(15, 5))
plt.pcolormesh(pe, cmap='RdBu')
plt.xlabel('Dimension')
plt.ylabel('Position')
plt.colorbar()
plt.title('Positional Encoding')
plt.show()

print(f"位置编码形状: {pe.shape}")  # (100, 512)
```

**为什么用sin/cos?**

1. **有界**: 值在[-1, 1]之间,不会爆炸
2. **唯一性**: 每个位置有唯一的编码
3. **相对位置**: sin(a)和cos(a)的线性组合可以表示位置偏移
4. **外推性**: 可以处理训练时未见过的序列长度

**现代改进: Learned Position Embedding**

GPT-3等模型使用可学习的位置嵌入:

```python
class LearnedPositionalEmbedding(torch.nn.Module):
    def __init__(self, max_seq_len, d_model):
        super().__init__()
        self.position_embeddings = torch.nn.Embedding(max_seq_len, d_model)
    
    def forward(self, seq_len):
        positions = torch.arange(seq_len)
        return self.position_embeddings(positions)
```

**RoPE(Rotary Position Embedding):**

LLaMA等新模型使用的旋转位置编码,通过旋转变换编码相对位置:

```python
def apply_rotary_pos_emb(x, cos, sin):
    """
    应用旋转位置编码
    x: [batch, seq_len, d_model]
    """
    # 将x分成前一半和后一半
    x1, x2 = x[..., :x.shape[-1]//2], x[..., x.shape[-1]//2:]
    
    # 应用旋转
    # [x1*cos - x2*sin, x1*sin + x2*cos]
    return torch.cat([
        x1 * cos - x2 * sin,
        x1 * sin + x2 * cos
    ], dim=-1)
```

### 2.4 Feed Forward Network(前馈网络)

在每个Transformer层中,注意力之后跟着一个前馈网络:

```python
class FeedForward(torch.nn.Module):
    """
    两层全连接网络,中间用激活函数
    FFN(x) = max(0, x×W1 + b1)×W2 + b2
    """
    
    def __init__(self, d_model=512, d_ff=2048, dropout=0.1):
        super().__init__()
        self.linear1 = torch.nn.Linear(d_model, d_ff)
        self.dropout = torch.nn.Dropout(dropout)
        self.linear2 = torch.nn.Linear(d_ff, d_model)
        self.activation = torch.nn.GELU()  # GPT使用GELU
    
    def forward(self, x):
        # x: [batch, seq_len, d_model]
        x = self.linear1(x)      # [batch, seq_len, d_ff]
        x = self.activation(x)    # 非线性激活
        x = self.dropout(x)
        x = self.linear2(x)      # [batch, seq_len, d_model]
        return x

# 使用示例
ff = FeedForward(d_model=512, d_ff=2048)
x = torch.randn(2, 10, 512)
output = ff(x)
print(f"输出形状: {output.shape}")  # [2, 10, 512]
```

**为什么需要FFN?**

1. **引入非线性**: 注意力是线性变换,FFN增加非线性表达能力
2. **特征变换**: 对每个位置独立进行复杂变换
3. **增加模型容量**: d_ff通常是d_model的4倍,大幅增加参数量

### 2.5 Layer Normalization & Residual Connection

```python
class TransformerBlock(torch.nn.Module):
    """完整的Transformer块"""
    
    def __init__(self, d_model=512, num_heads=8, d_ff=2048, dropout=0.1):
        super().__init__()
        
        self.attention = MultiHeadAttention(d_model, num_heads)
        self.feed_forward = FeedForward(d_model, d_ff, dropout)
        
        # Layer Normalization
        self.norm1 = torch.nn.LayerNorm(d_model)
        self.norm2 = torch.nn.LayerNorm(d_model)
        
        self.dropout1 = torch.nn.Dropout(dropout)
        self.dropout2 = torch.nn.Dropout(dropout)
    
    def forward(self, x, mask=None):
        # 1. Multi-Head Attention + Residual + Norm
        attn_output, _ = self.attention(x, x, x, mask)
        x = self.norm1(x + self.dropout1(attn_output))  # 残差连接
        
        # 2. Feed Forward + Residual + Norm
        ff_output = self.feed_forward(x)
        x = self.norm2(x + self.dropout2(ff_output))  # 残差连接
        
        return x
```

**Layer Norm vs Batch Norm:**

| 维度 | Batch Norm | Layer Norm |
|-----|-----------|-----------|
| 归一化方向 | 跨batch,每个特征 | 跨特征,每个样本 |
| 适用场景 | CNN | NLP(序列长度不固定) |
| 依赖batch | 是 | 否 |

**残差连接的作用:**
- 缓解梯度消失
- 允许信息直接流过
- 使深层网络训练更稳定

### 2.6 完整GPT模型实现

```python
class GPTModel(torch.nn.Module):
    """简化的GPT模型"""
    
    def __init__(
        self,
        vocab_size=50257,
        d_model=768,
        num_layers=12,
        num_heads=12,
        d_ff=3072,
        max_seq_len=1024,
        dropout=0.1
    ):
        super().__init__()
        
        # Token嵌入
        self.token_embedding = torch.nn.Embedding(vocab_size, d_model)
        
        # 位置嵌入
        self.position_embedding = torch.nn.Embedding(max_seq_len, d_model)
        
        # Transformer层
        self.layers = torch.nn.ModuleList([
            TransformerBlock(d_model, num_heads, d_ff, dropout)
            for _ in range(num_layers)
        ])
        
        # 输出层
        self.ln_f = torch.nn.LayerNorm(d_model)
        self.head = torch.nn.Linear(d_model, vocab_size, bias=False)
        
        # 权重共享: 输出层和嵌入层共享权重
        self.head.weight = self.token_embedding.weight
        
        self.dropout = torch.nn.Dropout(dropout)
    
    def forward(self, input_ids):
        """
        input_ids: [batch, seq_len]
        返回: logits [batch, seq_len, vocab_size]
        """
        batch_size, seq_len = input_ids.shape
        
        # 1. Token嵌入
        token_emb = self.token_embedding(input_ids)  # [batch, seq_len, d_model]
        
        # 2. 位置嵌入
        positions = torch.arange(seq_len, device=input_ids.device)
        pos_emb = self.position_embedding(positions)  # [seq_len, d_model]
        
        # 3. 相加 + Dropout
        x = self.dropout(token_emb + pos_emb)
        
        # 4. 通过Transformer层
        for layer in self.layers:
            x = layer(x)
        
        # 5. 最后的Layer Norm
        x = self.ln_f(x)
        
        # 6. 输出logits
        logits = self.head(x)  # [batch, seq_len, vocab_size]
        
        return logits
    
    def generate(self, input_ids, max_new_tokens=50, temperature=1.0, top_k=50):
        """
        自回归生成
        
        Args:
            input_ids: [batch, seq_len] 初始序列
            max_new_tokens: 生成多少个新token
            temperature: 温度参数(越小越确定)
            top_k: 只从概率最高的k个token中采样
        """
        for _ in range(max_new_tokens):
            # 1. 前向传播
            logits = self.forward(input_ids)  # [batch, seq_len, vocab_size]
            
            # 2. 只取最后一个位置的logits
            logits = logits[:, -1, :] / temperature  # [batch, vocab_size]
            
            # 3. Top-k过滤
            if top_k is not None:
                values, indices = torch.topk(logits, top_k)
                logits[logits < values[:, [-1]]] = -float('Inf')
            
            # 4. Softmax获取概率
            probs = F.softmax(logits, dim=-1)
            
            # 5. 采样
            next_token = torch.multinomial(probs, num_samples=1)  # [batch, 1]
            
            # 6. 拼接到序列
            input_ids = torch.cat([input_ids, next_token], dim=1)
        
        return input_ids

# 创建模型
model = GPTModel(
    vocab_size=50257,
    d_model=768,
    num_layers=12,
    num_heads=12
)

print(f"总参数量: {sum(p.numel() for p in model.parameters()) / 1e6:.2f}M")
# GPT-2 Small: ~124M参数
```
---

## 三、Token与Tokenization深度解析

### 3.1 什么是Token?

Token是LLM处理文本的最小单位,**不等于单词或字符**。

**示例对比:**

```python
文本: "I'm learning AI!"

# 字符级(Character-level)
tokens = ['I', "'", 'm', ' ', 'l', 'e', 'a', 'r', 'n', 'i', 'n', 'g', ' ', 'A', 'I', '!']
# 问题: 太细粒度,序列太长

# 单词级(Word-level)
tokens = ['I', "'", 'm', 'learning', 'AI', '!']
# 问题: 词表太大,无法处理未登录词(OOV)

# Subword级(GPT使用BPE)
tokens = ['I', "'m", 'Ġlearning', 'ĠAI', '!']
# ✅ 平衡: 常见词完整,罕见词拆分
```

### 3.2 BPE(Byte Pair Encoding)算法

**核心思想**: 从字符开始,迭代合并最频繁的字符对。

**训练过程:**

```python
def train_bpe(corpus, num_merges=1000):
    """
    BPE训练
    
    Args:
        corpus: 训练语料
        num_merges: 合并次数
    """
    import re
    from collections import Counter
    
    # 1. 初始化:每个字符是一个token
    vocab = Counter()
    for word in corpus.split():
        vocab[' '.join(word) + ' </w>'] += 1
    
    # 2. 迭代合并
    for i in range(num_merges):
        # 统计所有相邻token对的频率
        pairs = Counter()
        for word, freq in vocab.items():
            symbols = word.split()
            for j in range(len(symbols) - 1):
                pairs[(symbols[j], symbols[j+1])] += freq
        
        # 找出最频繁的pair
        if not pairs:
            break
        best_pair = max(pairs, key=pairs.get)
        
        # 合并这个pair
        vocab_new = {}
        pattern = re.escape(' '.join(best_pair))
        replacement = ''.join(best_pair)
        for word in vocab:
            new_word = re.sub(pattern, replacement, word)
            vocab_new[new_word] = vocab[word]
        vocab = vocab_new
        
        print(f"Merge {i+1}: {best_pair[0]} + {best_pair[1]} → {replacement}")
    
    return vocab

# 示例
corpus = "low low low low low lower lower newest newest newest newest newest newest widest widest widest"
vocab = train_bpe(corpus, num_merges=10)

# 输出示例:
# Merge 1: e + s → es
# Merge 2: es + t → est
# Merge 3: est + </w> → est</w>
# Merge 4: l + o → lo
# Merge 5: lo + w → low
# ...
```

**使用BPE编码:**

```python
def encode_bpe(text, merges):
    """使用训练好的BPE编码文本"""
    # 将文本拆成字符
    tokens = list(text)
    
    # 应用所有合并规则
    for merge in merges:
        i = 0
        while i < len(tokens) - 1:
            if (tokens[i], tokens[i+1]) == merge:
                tokens[i:i+2] = [''.join(merge)]
            else:
                i += 1
    
    return tokens
```

### 3.3 实战: tiktoken库(OpenAI官方)

```python
import tiktoken

# 加载编码器
encoding = tiktoken.encoding_for_model("gpt-4")

# 文本示例
text = """
Hello, how are you? 你好世界!
I'm learning about Large Language Models.
"""

# 编码
tokens = encoding.encode(text)
print(f"Token IDs: {tokens}")
print(f"Token数量: {len(tokens)}")

# 解码
decoded = encoding.decode(tokens)
print(f"解码回文本: {decoded}")

# 逐个token解码(查看分词结果)
for token_id in tokens:
    token_bytes = encoding.decode_single_token_bytes(token_id)
    print(f"{token_id}: {token_bytes}")

# 输出示例:
# Token IDs: [9906, 11, 1268, 527, 499, 30, 220, 57668, 53901, 16823, 0, 198, 40, 2846, 6975, 922, 20902, 11688, 27972, 13]
# Token数量: 20
```

**不同模型的tokenizer差异:**

```python
# GPT-4
enc_gpt4 = tiktoken.encoding_for_model("gpt-4")
tokens_gpt4 = enc_gpt4.encode("你好世界")
print(f"GPT-4 tokens: {len(tokens_gpt4)}")  # 可能是4

# GPT-3.5
enc_gpt35 = tiktoken.encoding_for_model("gpt-3.5-turbo")
tokens_gpt35 = enc_gpt35.encode("你好世界")
print(f"GPT-3.5 tokens: {len(tokens_gpt35)}")  # 可能不同!

# 【坑】不同模型token数不同,成本计算要注意!
```

### 3.4 Token与成本计算

**GPT-4定价(2024):**
- 输入: $10 / 1M tokens
- 输出: $30 / 1M tokens

**成本计算器:**

```python
def calculate_cost(input_text, output_text, model="gpt-4"):
    """计算API调用成本"""
    pricing = {
        "gpt-4": {"input": 10 / 1_000_000, "output": 30 / 1_000_000},
        "gpt-4-turbo": {"input": 10 / 1_000_000, "output": 30 / 1_000_000},
        "gpt-3.5-turbo": {"input": 0.5 / 1_000_000, "output": 1.5 / 1_000_000},
        "claude-3-opus": {"input": 15 / 1_000_000, "output": 75 / 1_000_000},
        "claude-3-sonnet": {"input": 3 / 1_000_000, "output": 15 / 1_000_000},
    }
    
    encoding = tiktoken.encoding_for_model(model if model.startswith("gpt") else "gpt-4")
    
    input_tokens = len(encoding.encode(input_text))
    output_tokens = len(encoding.encode(output_text))
    
    price = pricing.get(model, pricing["gpt-4"])
    cost = input_tokens * price["input"] + output_tokens * price["output"]
    
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost_usd": cost,
        "cost_cny": cost * 7.2  # 假设汇率7.2
    }

# 示例
result = calculate_cost(
    input_text="请详细解释量子计算的原理,包括量子比特、量子纠缠和量子门的概念。",
    output_text="量子计算是一种利用量子力学原理进行信息处理的新型计算范式...(500字回答)",
    model="gpt-4"
)

print(f"输入tokens: {result['input_tokens']}")
print(f"输出tokens: {result['output_tokens']}")
print(f"成本: ${result['cost_usd']:.4f} (¥{result['cost_cny']:.2f})")

# 输出示例:
# 输入tokens: 23
# 输出tokens: 387
# 成本: $0.0118 (¥0.08)
```

**节省成本技巧:**

1. **压缩Prompt**:
```python
# ❌ 冗长
prompt = """
你是一个非常专业的、经验丰富的Python编程专家,拥有超过10年的软件开发经验,
精通各种编程范式和设计模式,能够编写高质量、可维护、高性能的代码...
"""

# ✅ 简洁
prompt = "你是Python专家,写高质量代码。"
```

2. **使用便宜模型**:
```python
# 简单任务用3.5
if task_complexity == "simple":
    model = "gpt-3.5-turbo"  # 便宜20倍
else:
    model = "gpt-4"
```

3. **缓存结果**:
```python
import functools

@functools.lru_cache(maxsize=1000)
def cached_llm_call(prompt):
    """缓存相同prompt的结果"""
    return llm_api_call(prompt)
```

### 3.5 SentencePiece(用于LLaMA)

**特点**: 直接处理原始文本,不需要预分词,支持中文等语言更好。

```bash
pip install sentencepiece
```

```python
import sentencepiece as spm

# 训练模型
spm.SentencePieceTrainer.train(
    input='corpus.txt',
    model_prefix='m',
    vocab_size=32000,
    model_type='bpe'  # 或'unigram'
)

# 加载模型
sp = spm.SentencePieceProcessor(model_file='m.model')

# 编码
text = "你好世界 Hello World"
tokens = sp.encode(text, out_type=str)
print(tokens)  # ['▁你', '好', '世界', '▁Hello', '▁World']

ids = sp.encode(text, out_type=int)
print(ids)  # [123, 456, 789, ...]

# 解码
decoded = sp.decode(ids)
print(decoded)  # "你好世界 Hello World"
```

**`▁`符号**: 表示这个token是词的开始(空格被编码为▁)

---

## 四、LLM推理过程详解

### 4.1 自回归生成

LLM生成是**逐token预测**的自回归过程:

```
初始: "今天天气"

Step 1: "今天天气" → 预测下一个token → "很"
Step 2: "今天天气很" → 预测下一个token → "好"
Step 3: "今天天气很好" → 预测下一个token → "，"
Step 4: "今天天气很好，" → 预测下一个token → "适合"
...
直到生成 <|endoftext|> 或达到最大长度
```

**完整实现:**

```python
def generate_text(
    model,
    prompt,
    max_new_tokens=50,
    temperature=1.0,
    top_k=50,
    top_p=0.9,
    repetition_penalty=1.0
):
    """
    文本生成
    
    Args:
        model: LLM模型
        prompt: 初始提示
        max_new_tokens: 生成多少个新token
        temperature: 温度(0-2)
        top_k: top-k采样
        top_p: nucleus采样
        repetition_penalty: 重复惩罚
    """
    # 编码prompt
    input_ids = tokenizer.encode(prompt, return_tensors='pt')
    
    # 生成循环
    for step in range(max_new_tokens):
        # 1. 模型前向传播
        with torch.no_grad():
            outputs = model(input_ids)
            logits = outputs.logits[:, -1, :]  # 最后一个位置的logits
        
        # 2. 应用重复惩罚
        if repetition_penalty != 1.0:
            for token_id in set(input_ids[0].tolist()):
                logits[0, token_id] /= repetition_penalty
        
        # 3. 应用温度
        logits = logits / temperature
        
        # 4. Top-k过滤
        if top_k > 0:
            indices_to_remove = logits < torch.topk(logits, top_k)[0][..., -1, None]
            logits[indices_to_remove] = -float('Inf')
        
        # 5. Top-p(nucleus)过滤
        if top_p < 1.0:
            sorted_logits, sorted_indices = torch.sort(logits, descending=True)
            cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
            
            # 移除累积概率超过top_p的token
            sorted_indices_to_remove = cumulative_probs > top_p
            sorted_indices_to_remove[..., 1:] = sorted_indices_to_remove[..., :-1].clone()
            sorted_indices_to_remove[..., 0] = 0
            
            indices_to_remove = sorted_indices_to_remove.scatter(1, sorted_indices, sorted_indices_to_remove)
            logits[indices_to_remove] = -float('Inf')
        
        # 6. Softmax获取概率
        probs = F.softmax(logits, dim=-1)
        
        # 7. 采样
        next_token = torch.multinomial(probs, num_samples=1)
        
        # 8. 拼接
        input_ids = torch.cat([input_ids, next_token], dim=1)
        
        # 9. 检查停止条件
        if next_token.item() == tokenizer.eos_token_id:
            break
    
    # 解码
    generated_text = tokenizer.decode(input_ids[0])
    return generated_text
```

### 4.2 核心参数详解

#### Temperature(温度)

**作用**: 控制输出的随机性

```python
# temperature越小,分布越尖锐(更确定)
logits = [2.0, 1.0, 0.5]

# temperature = 0.1 (接近确定性)
probs_cold = softmax(logits / 0.1)
# [0.86, 0.12, 0.02] → 几乎总是选第一个

# temperature = 1.0 (标准)
probs_normal = softmax(logits / 1.0)
# [0.58, 0.24, 0.18] → 按概率采样

# temperature = 2.0 (更随机)
probs_hot = softmax(logits / 2.0)
# [0.42, 0.31, 0.27] → 接近均匀分布
```

**使用场景:**
- **temperature = 0**: 确定性任务(数据提取、代码生成)
- **temperature = 0.7**: 平衡任务(问答、摘要)
- **temperature = 1.2**: 创意任务(故事、诗歌)

#### Top-k Sampling

**作用**: 只从概率最高的k个token中采样

```python
logits = [5.0, 4.0, 3.0, 2.0, 1.0, 0.5, 0.3, 0.1, ...]  # 10000个
probs = softmax(logits)

# top_k = 3
# 只从概率最高的3个token中采样
# 其余token概率设为0,然后重新归一化
```

**问题**: k是固定的,但不同情况下合适的k不同:
- 确定性场景(如"北京是中国的___"): 只需k=1
- 开放性场景(如"写一个故事"): 需要更大的k

#### Top-p (Nucleus Sampling)

**作用**: 动态选择token数量,保留累积概率达到p的最小token集合

```python
probs_sorted = [0.3, 0.25, 0.2, 0.15, 0.05, 0.03, 0.02, ...]

# top_p = 0.9
cumsum = [0.3, 0.55, 0.75, 0.90, ...]
#                          ↑ 刚好>=0.9
# 只从前4个token中采样

# 优势: 自动适应不同场景
```

**top_k vs top_p:**

```python
# 【最佳实践】同时使用
def sample_token(logits, temperature=0.8, top_k=50, top_p=0.9):
    logits = logits / temperature
    
    # 先top_k过滤
    top_k_logits, top_k_indices = torch.topk(logits, k=top_k)
    
    # 再top_p过滤
    probs = F.softmax(top_k_logits, dim=-1)
    cumsum = torch.cumsum(probs, dim=-1)
    mask = cumsum > top_p
    mask[0] = False  # 至少保留一个
    probs[mask] = 0
    probs = probs / probs.sum()
    
    # 采样
    idx = torch.multinomial(probs, num_samples=1)
    next_token = top_k_indices[idx]
    
    return next_token
```

#### Frequency Penalty & Presence Penalty

**Frequency Penalty**: 根据token已出现的**次数**惩罚

```python
# 公式: logit_new = logit_old - frequency_count * penalty

# 示例: "the"已经出现3次
logit_the_old = 5.0
logit_the_new = 5.0 - 3 * 0.5 = 3.5  # penalty=0.5
```

**Presence Penalty**: 根据token是否出现过惩罚(0/1)

```python
# 公式: logit_new = logit_old - (1 if appeared else 0) * penalty

# 示例: "the"已出现
logit_the_old = 5.0
logit_the_new = 5.0 - 1 * 2.0 = 3.0  # penalty=2.0
```

**使用场景:**
- **Frequency Penalty**: 减少高频词重复(如"然后")
- **Presence Penalty**: 鼓励话题多样性

### 4.3 Beam Search vs Sampling

**Greedy Decoding(贪心解码):**
```python
# 每步选概率最高的token
def greedy_decode(model, prompt):
    for step in range(max_length):
        logits = model(input_ids)
        next_token = torch.argmax(logits, dim=-1)  # 选最大概率
        input_ids = torch.cat([input_ids, next_token])
```

**问题**: 
- 输出确定,重复运行结果相同
- 容易陷入重复模式("非常非常非常...")
- 无法探索其他可能性

**Beam Search(束搜索):**
```python
def beam_search(model, prompt, beam_width=5):
    """
    保留概率最高的beam_width个候选序列
    """
    # 初始化
    candidates = [(prompt, 0.0)]  # (序列, 累积log概率)
    
    for step in range(max_length):
        all_candidates = []
        
        for seq, score in candidates:
            logits = model(seq)
            probs = F.softmax(logits, dim=-1)
            
            # 对每个候选,扩展beam_width个可能
            top_k_probs, top_k_tokens = torch.topk(probs, beam_width)
            
            for prob, token in zip(top_k_probs, top_k_tokens):
                new_seq = torch.cat([seq, token])
                new_score = score + torch.log(prob)  # 累积log概率
                all_candidates.append((new_seq, new_score))
        
        # 保留得分最高的beam_width个
        candidates = sorted(all_candidates, key=lambda x: x[1], reverse=True)[:beam_width]
    
    # 返回得分最高的序列
    return candidates[0][0]
```

**Beam Search问题**:
- 倾向生成通用但平淡的文本
- 对开放性生成任务效果不好

**Sampling(采样):**
```python
# 按概率分布随机采样
def sampling_decode(model, prompt, temperature=0.8):
    for step in range(max_length):
        logits = model(input_ids) / temperature
        probs = F.softmax(logits, dim=-1)
        next_token = torch.multinomial(probs, num_samples=1)  # 随机采样
        input_ids = torch.cat([input_ids, next_token])
```

**优势**:
- 输出多样性
- 更适合创意任务

**何时用哪种?**

| 任务类型 | 推荐方法 | 参数建议 |
|---------|---------|---------|
| 机器翻译 | Beam Search | beam_width=5 |
| 代码生成 | Greedy或低温采样 | temperature=0-0.3 |
| 文本摘要 | Beam Search | beam_width=4 |
| 创意写作 | Sampling | temperature=0.8-1.2, top_p=0.9 |
| 问答 | 低温采样 | temperature=0-0.5 |
| 对话 | Sampling | temperature=0.7, top_p=0.9 |

### 4.4 KV Cache优化

**问题**: 自回归生成每步都要重新计算所有历史token的Key和Value,非常慢。

**解决**: 缓存已计算的KV,只计算新token的KV。

```python
class GPTWithKVCache(torch.nn.Module):
    def __init__(self, config):
        super().__init__()
        # ... (模型定义)
        self.kv_cache = None
    
    def forward(self, input_ids, use_cache=False):
        batch_size, seq_len = input_ids.shape
        
        # Token嵌入 + 位置嵌入
        x = self.token_embedding(input_ids) + self.position_embedding(torch.arange(seq_len))
        
        # 通过Transformer层
        past_key_values = self.kv_cache if use_cache else None
        present_key_values = []
        
        for i, layer in enumerate(self.layers):
            if past_key_values is not None:
                # 使用缓存的KV
                past_kv = past_key_values[i]
            else:
                past_kv = None
            
            x, kv = layer(x, past_kv=past_kv, use_cache=use_cache)
            present_key_values.append(kv)
        
        # 更新缓存
        if use_cache:
            self.kv_cache = present_key_values
        
        logits = self.output_layer(x)
        return logits
    
    def generate_with_cache(self, input_ids, max_new_tokens=50):
        """使用KV cache的生成"""
        self.kv_cache = None  # 清空缓存
        
        # 第一步: 处理整个prompt
        logits = self.forward(input_ids, use_cache=True)
        next_token = torch.argmax(logits[:, -1, :], dim=-1, keepdim=True)
        
        generated = [next_token]
        
        # 后续步骤: 只处理新token
        for _ in range(max_new_tokens - 1):
            logits = self.forward(next_token, use_cache=True)
            next_token = torch.argmax(logits[:, -1, :], dim=-1, keepdim=True)
            generated.append(next_token)
        
        return torch.cat([input_ids] + generated, dim=1)
```

**加速效果**:
- 没有KV Cache: O(n²) 每步重算所有token
- 有KV Cache: O(n) 每步只算新token
- **实测加速**: 3-10倍
---

## 五、LLM训练流程

### 5.1 三阶段训练

```
阶段1: 预训练 (Pre-training)
├─ 数据: 海量互联网文本(TB级)
├─ 目标: 下一个token预测
├─ 时间: 数周到数月
├─ 成本: 数百万到数千万美元
└─ 结果: 基础语言能力(Base Model)
      ↓
阶段2: 监督微调 (Supervised Fine-Tuning, SFT)
├─ 数据: 指令-回答对(人工标注,数万到数十万条)
├─ 目标: 学会遵循指令
├─ 时间: 数天
├─ 成本: 数万美元
└─ 结果: 指令模型(Instruct Model)
      ↓
阶段3: RLHF (Reinforcement Learning from Human Feedback)
├─ 数据: 人类偏好排序(A>B>C)
├─ 目标: 对齐人类价值观
├─ 时间: 数天到数周
├─ 成本: 数十万美元
└─ 结果: 对齐模型(Aligned Model,如ChatGPT)
```

### 5.2 预训练详解

**目标**: 最大化语言模型似然

```
给定语料库 D = {x₁, x₂, ..., xₙ}
每个 x = [w₁, w₂, ..., wₜ] (一段文本)

目标: 最大化 
  𝓛 = Σ log P(w₁, w₂, ..., wₜ)
    = Σ log P(w₁) + log P(w₂|w₁) + ... + log P(wₜ|w₁...wₜ₋₁)
```

**代码实现:**

```python
def pretrain_step(model, batch, optimizer):
    """
    预训练一个batch
    
    batch: [batch_size, seq_len] token IDs
    """
    # 输入: 除了最后一个token
    input_ids = batch[:, :-1]
    
    # 目标: 除了第一个token
    target_ids = batch[:, 1:]
    
    # 前向传播
    logits = model(input_ids)  # [batch, seq_len-1, vocab_size]
    
    # 计算损失(交叉熵)
    loss = F.cross_entropy(
        logits.reshape(-1, logits.size(-1)),  # [batch*(seq_len-1), vocab_size]
        target_ids.reshape(-1)                # [batch*(seq_len-1)]
    )
    
    # 反向传播
    optimizer.zero_grad()
    loss.backward()
    
    # 梯度裁剪(防止梯度爆炸)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    
    # 更新参数
    optimizer.step()
    
    return loss.item()

# 训练循环
model = GPTModel(...)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

for epoch in range(num_epochs):
    for batch in dataloader:
        loss = pretrain_step(model, batch, optimizer)
        print(f"Loss: {loss:.4f}")
```

**预训练数据:**

| 数据源 | 占比 | 示例 |
|-------|------|------|
| Common Crawl | 60% | 网页内容 |
| WebText | 15% | Reddit高赞链接 |
| Books | 10% | 电子书籍 |
| Wikipedia | 5% | 维基百科 |
| 代码 | 10% | GitHub代码 |

**数据清洗:**
1. 去重(避免记忆训练数据)
2. 过滤低质量内容(乱码、spam)
3. 移除个人信息(PII)
4. 平衡数据分布

### 5.3 指令微调(SFT)

**数据格式:**

```json
{
  "instruction": "将以下文本翻译成英文",
  "input": "今天天气很好",
  "output": "The weather is nice today"
}

{
  "instruction": "解释什么是机器学习",
  "input": "",
  "output": "机器学习是一种人工智能技术,通过算法让计算机从数据中学习规律..."
}
```

**训练:**

```python
def sft_step(model, batch, optimizer):
    """
    SFT训练步骤
    """
    # 构建输入
    # "Instruction: {instruction}\nInput: {input}\nOutput: "
    prompts = batch['prompts']
    completions = batch['completions']
    
    # 编码
    input_ids = tokenizer(prompts, return_tensors='pt').input_ids
    target_ids = tokenizer(completions, return_tensors='pt').input_ids
    
    # 拼接
    full_ids = torch.cat([input_ids, target_ids], dim=1)
    
    # 前向传播
    logits = model(full_ids[:, :-1])
    
    # 只计算completion部分的损失
    prompt_len = input_ids.size(1)
    loss = F.cross_entropy(
        logits[:, prompt_len:].reshape(-1, logits.size(-1)),
        full_ids[:, prompt_len+1:].reshape(-1)
    )
    
    # 反向传播
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    
    return loss.item()
```

**SFT数据来源:**
- 人工标注(最贵但质量高)
- Self-Instruct(用模型生成指令数据)
- Prompt工程师编写
- 公开数据集(如Alpaca, Dolly)

### 5.4 RLHF详解

**步骤1: 训练奖励模型(Reward Model, RM)**

收集人类偏好数据:
```
给定prompt: "解释什么是量子计算"

回答A: "量子计算是..." (详细准确)
回答B: "不知道" (无帮助)
回答C: "量子计算很复杂..." (模糊)

人类排序: A > C > B
```

**奖励模型架构:**

```python
class RewardModel(torch.nn.Module):
    """
    基于预训练模型,输出标量奖励分数
    """
    def __init__(self, pretrained_model):
        super().__init__()
        self.backbone = pretrained_model  # 冻结或微调
        self.reward_head = torch.nn.Linear(pretrained_model.config.hidden_size, 1)
    
    def forward(self, input_ids):
        # 获取最后一个token的hidden state
        hidden_states = self.backbone(input_ids).last_hidden_state
        last_hidden = hidden_states[:, -1, :]  # [batch, hidden_size]
        
        # 输出奖励分数
        reward = self.reward_head(last_hidden)  # [batch, 1]
        return reward

# 训练奖励模型
def train_reward_model(model, comparisons):
    """
    comparisons: [(prompt, chosen_response, rejected_response), ...]
    """
    optimizer = torch.optim.AdamW(model.parameters())
    
    for prompt, chosen, rejected in comparisons:
        # 计算两个回答的奖励
        chosen_input = prompt + chosen
        rejected_input = prompt + rejected
        
        reward_chosen = model(tokenizer(chosen_input).input_ids)
        reward_rejected = model(tokenizer(rejected_input).input_ids)
        
        # 损失: chosen的奖励应该高于rejected
        loss = -torch.log(torch.sigmoid(reward_chosen - reward_rejected))
        
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

**步骤2: PPO强化学习**

使用PPO算法优化策略模型:

```python
def ppo_step(policy_model, reward_model, ref_model, batch):
    """
    PPO训练步骤
    
    policy_model: 当前策略(要优化的模型)
    reward_model: 奖励模型
    ref_model: 参考模型(SFT模型,frozen)
    """
    prompts = batch['prompts']
    
    # 1. 用当前策略生成回答
    responses = policy_model.generate(prompts)
    
    # 2. 计算奖励
    rewards = reward_model(prompts + responses)
    
    # 3. 计算KL散度(防止偏离参考模型太远)
    log_probs_policy = policy_model.get_log_probs(prompts, responses)
    log_probs_ref = ref_model.get_log_probs(prompts, responses)
    kl_divergence = log_probs_policy - log_probs_ref
    
    # 4. 总奖励 = 模型奖励 - KL惩罚
    total_reward = rewards - beta * kl_divergence
    
    # 5. PPO损失
    # ... (PPO算法细节)
    
    return loss
```

**RLHF的作用:**
- ✅ 减少有害输出
- ✅ 提高回答质量
- ✅ 更好地遵循指令
- ✅ 拒绝不当请求

**RLHF的问题:**
- ❌ 可能过度对齐人类偏好(丧失创造性)
- ❌ 奖励模型可能被"hack"
- ❌ 训练不稳定

### 5.5 训练成本估算

**GPT-3 (175B参数):**
- 训练时间: ~1个月
- 硬件: ~10000个V100 GPU
- 成本: ~$4.6M (电费+硬件折旧)
- 碳排放: ~552吨CO₂

**计算FLOPs:**
```
单次前向传播 FLOPs ≈ 6 × 参数量 × token数
单次训练步骤 FLOPs ≈ 3 × 前向传播 FLOPs (前向+反向+更新)

GPT-3:
  参数: 175B
  训练tokens: 300B
  FLOPs: 6 × 175B × 300B × 3 ≈ 3.14 × 10²³

V100 GPU: 125 TFLOPs (半精度)
需要GPU时间: 3.14×10²³ / (125×10¹²) / 3600 / 24 ≈ 29天

考虑并行效率(~50%): 实际需要~2个月
```

---

## 六、上下文窗口与长文本处理

### 6.1 上下文窗口的限制

**计算复杂度:**

Self-Attention的复杂度是 **O(n²)**:

```
序列长度 n=1024: 
  注意力矩阵 1024×1024 = 1M 元素

序列长度 n=4096:
  注意力矩阵 4096×4096 = 16M 元素 (16倍!)

序列长度 n=128K:
  注意力矩阵 128K×128K = 16G 元素 (显存爆炸!)
```

**内存占用:**

```python
# 计算内存占用
def estimate_memory(seq_len, d_model, n_layers, n_heads, batch_size=1):
    """
    估算推理时的显存占用
    """
    # 激活值
    activations = batch_size * seq_len * d_model * n_layers * 4  # 4 bytes (float32)
    
    # 注意力矩阵
    attention = batch_size * n_heads * seq_len * seq_len * n_layers * 4
    
    # KV Cache
    kv_cache = 2 * batch_size * seq_len * d_model * n_layers * 4
    
    total_gb = (activations + attention + kv_cache) / 1e9
    
    return {
        "activations_gb": activations / 1e9,
        "attention_gb": attention / 1e9,
        "kv_cache_gb": kv_cache / 1e9,
        "total_gb": total_gb
    }

# GPT-3 (175B, d_model=12288, 96 layers, 96 heads)
memory_1k = estimate_memory(seq_len=1024, d_model=12288, n_layers=96, n_heads=96)
memory_128k = estimate_memory(seq_len=128*1024, d_model=12288, n_layers=96, n_heads=96)

print(f"1K context: {memory_1k['total_gb']:.2f} GB")
print(f"128K context: {memory_128k['total_gb']:.2f} GB")

# 输出:
# 1K context: ~5 GB
# 128K context: ~650 GB (!)
```

### 6.2 长上下文技术

#### Sparse Attention(稀疏注意力)

不是让每个token关注所有token,而是只关注部分token:

```python
# 局部注意力: 只关注窗口内的token
def local_attention(Q, K, V, window_size=256):
    """每个token只关注前后window_size个token"""
    seq_len = Q.size(1)
    
    # 构建局部掩码
    mask = torch.ones(seq_len, seq_len)
    for i in range(seq_len):
        left = max(0, i - window_size)
        right = min(seq_len, i + window_size + 1)
        mask[i, left:right] = 0
    
    # 应用注意力
    scores = torch.matmul(Q, K.transpose(-2, -1))
    scores = scores.masked_fill(mask.bool(), -float('inf'))
    attn = F.softmax(scores, dim=-1)
    output = torch.matmul(attn, V)
    
    return output

# Longformer: 局部+全局注意力
# 大部分token只看局部
# 少数"全局"token(如[CLS])看全部
```

#### FlashAttention(高效注意力)

通过算法优化减少内存访问:

```python
# 标准注意力: O(n²) 内存
S = Q @ K.T          # 写入HBM(慢)
P = softmax(S)       # 读取+写入HBM
O = P @ V            # 读取+写入HBM

# FlashAttention: O(n) 内存
# 分块计算,只在SRAM中操作(快100倍)
for block in blocks:
    S_block = Q_block @ K_block.T  # 在SRAM中
    P_block = softmax(S_block)
    O_block = P_block @ V_block
    # 只写入最终结果到HBM
```

**加速效果**: 2-4倍,且内存占用减少10倍

#### RoPE + ALiBi(位置编码改进)

**ALiBi(Attention with Linear Biases):**

不用位置编码,而是在注意力分数上加bias:

```python
def alibi_attention(Q, K, V):
    """
    ALiBi: 根据距离添加bias
    
    bias[i,j] = -m × |i-j|
    m是每个头的斜率
    """
    seq_len = Q.size(1)
    
    # 计算距离矩阵
    positions = torch.arange(seq_len)
    distance = positions.unsqueeze(0) - positions.unsqueeze(1)  # [seq_len, seq_len]
    
    # 添加bias(距离越远,bias越负)
    m = 0.1  # 斜率
    bias = -m * distance.abs()
    
    # 正常注意力 + bias
    scores = torch.matmul(Q, K.transpose(-2, -1)) / sqrt(d_k)
    scores = scores + bias
    attn = F.softmax(scores, dim=-1)
    output = torch.matmul(attn, V)
    
    return output
```

**优势**: 训练在短上下文,推理时可以外推到更长上下文
---

## 七、实战:调用LLM API

### 7.1 OpenAI API

```python
from openai import OpenAI

client = OpenAI(api_key="sk-...")

# 基础调用
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "你是AI助手"},
        {"role": "user", "content": "什么是机器学习?"}
    ],
    temperature=0.7,
    max_tokens=500,
    top_p=0.9,
    frequency_penalty=0.0,
    presence_penalty=0.0
)

print(response.choices[0].message.content)
print(f"Tokens: {response.usage.total_tokens}")
print(f"成本: ${response.usage.total_tokens * 0.00003:.4f}")

# 流式输出
stream = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "写一首诗"}],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end='')

# Function Calling
functions = [
    {
        "name": "get_weather",
        "description": "获取城市天气",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "城市名"}
            },
            "required": ["city"]
        }
    }
]

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "北京今天天气怎么样?"}],
    functions=functions,
    function_call="auto"
)

if response.choices[0].finish_reason == "function_call":
    function_call = response.choices[0].message.function_call
    print(f"调用函数: {function_call.name}")
    print(f"参数: {function_call.arguments}")
```

### 7.2 Anthropic Claude API

```python
import anthropic

client = anthropic.Anthropic(api_key="sk-ant-...")

# 基础调用
message = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "解释量子纠缠"}
    ]
)

print(message.content[0].text)

# 流式输出
with client.messages.stream(
    model="claude-3-opus-20240229",
    max_tokens=1024,
    messages=[{"role": "user", "content": "写一个故事"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

# 长上下文(200K tokens)
long_document = open("long_doc.txt").read()  # 比如50万字的文档

message = client.messages.create(
    model="claude-3-opus-20240229",
    max_tokens=4096,
    messages=[
        {
            "role": "user",
            "content": f"文档:\n{long_document}\n\n问题: 总结这篇文档的核心观点"
        }
    ]
)
```

### 7.3 本地部署(Ollama)

```bash
# 安装Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 拉取模型
ollama pull llama3
ollama pull qwen2.5:72b
ollama pull deepseek-coder

# 运行模型
ollama run llama3

# API服务(默认11434端口)
ollama serve
```

```python
import requests

def call_ollama(prompt, model="llama3"):
    """调用本地Ollama API"""
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }
    )
    return response.json()["response"]

# 使用
result = call_ollama("解释什么是Transformer", model="llama3")
print(result)

# 流式调用
def stream_ollama(prompt, model="llama3"):
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": model, "prompt": prompt, "stream": True},
        stream=True
    )
    
    for line in response.iter_lines():
        if line:
            import json
            data = json.loads(line)
            if "response" in data:
                print(data["response"], end="", flush=True)

stream_ollama("写一首关于AI的诗")
```

---

## 八、常见问题

**Q1: 为什么LLM会"幻觉"(编造事实)?**

本质原因:
1. **统计模式匹配**: LLM学习的是文本的统计规律,不是真实世界的知识
2. **训练目标**: 只优化"下一个token预测",而不是"事实准确性"
3. **过度自信**: 即使不确定,也会生成流畅的文本

**Q2: Temperature=0是否完全确定性?**

理论上是,但实际:
- 浮点运算精度问题可能导致微小差异
- 不同硬件(CPU/GPU)可能有细微不同
- 某些API有随机种子,设置seed可确保可复现

**Q3: 如何判断需要多大上下文窗口?**

```python
def estimate_context_need(
    system_prompt_tokens,
    few_shot_examples_tokens,
    user_input_tokens,
    expected_output_tokens,
    history_turns=0
):
    """
    估算所需上下文
    """
    total = (
        system_prompt_tokens +
        few_shot_examples_tokens +
        user_input_tokens +
        expected_output_tokens +
        history_turns * (user_input_tokens + expected_output_tokens) +
        500  # buffer
    )
    
    if total < 4000:
        return "gpt-3.5-turbo (4K)"
    elif total < 16000:
        return "gpt-3.5-turbo-16k"
    elif total < 128000:
        return "gpt-4-turbo (128K)"
    else:
        return "claude-3-opus (200K) 或 gemini-1.5-pro (1M)"

# 示例
model = estimate_context_need(
    system_prompt_tokens=200,
    few_shot_examples_tokens=1000,
    user_input_tokens=500,
    expected_output_tokens=1000,
    history_turns=5
)
print(f"推荐模型: {model}")
```

**Q4: 参数量越大模型越好吗?**

不一定:
- **数据质量 > 模型大小**: 在高质量数据上训练的小模型可能超过大模型
- **任务相关**: 简单任务不需要超大模型
- **成本考虑**: 7B模型本地部署,70B模型需要多卡

**典型配置:**
- 7B模型: 适合简单任务,可以在消费级GPU(16GB)运行
- 13B模型: 平衡性能和成本
- 70B模型: 接近GPT-3.5性能,需要专业硬件
- 175B+: 商业模型级别,个人无法部署

**Q5: 如何减少API成本?**

1. **选择合适模型**: 简单任务用gpt-3.5-turbo
2. **压缩Prompt**: 去除冗余,使用简洁表达
3. **缓存结果**: 相同输入不重复调用
4. **流式输出+提前停止**: 检测到无用输出立即停止
5. **本地模型**: 高频调用场景考虑自部署
---

## 九、LLM评估

### 9.1 自动评估指标

**困惑度(Perplexity):**

```python
def calculate_perplexity(model, text):
    """
    计算困惑度
    
    PPL = exp(-1/N * Σ log P(w_i | w_<i))
    
    困惑度越低,模型对文本的"惊讶程度"越低,说明模型越好
    """
    tokens = tokenizer.encode(text)
    log_likelihood = 0
    
    for i in range(1, len(tokens)):
        context = tokens[:i]
        target = tokens[i]
        
        logits = model(torch.tensor([context]))
        probs = F.softmax(logits[0, -1, :], dim=-1)
        
        log_likelihood += torch.log(probs[target])
    
    ppl = torch.exp(-log_likelihood / len(tokens))
    return ppl.item()

# GPT-2在Penn Treebank上PPL≈35
# GPT-3在相同数据上PPL≈20 (更好)
```

**BLEU/ROUGE(用于翻译/摘要):**

```python
from nltk.translate.bleu_score import sentence_bleu
from rouge import Rouge

# BLEU (翻译质量)
reference = [['the', 'cat', 'is', 'on', 'the', 'mat']]
candidate = ['the', 'cat', 'on', 'the', 'mat']
bleu = sentence_bleu(reference, candidate)
print(f"BLEU: {bleu}")

# ROUGE (摘要质量)
rouge = Rouge()
reference = "the cat is on the mat"
hypothesis = "the cat on the mat"
scores = rouge.get_scores(hypothesis, reference)
print(f"ROUGE-1: {scores[0]['rouge-1']['f']}")
```

### 9.2 人工评估

**维度:**
- **准确性**: 事实是否正确
- **相关性**: 是否回答了问题
- **流畅性**: 语言是否自然
- **无害性**: 是否包含有害内容
- **有用性**: 是否对用户有帮助

**Elo Rating(竞技场排名):**

让两个模型回答同一问题,人类选择更好的回答:

```python
def update_elo(rating_a, rating_b, result):
    """
    更新Elo评分
    
    result: 1(A赢), 0.5(平局), 0(B赢)
    """
    K = 32  # 学习率
    
    expected_a = 1 / (1 + 10 ** ((rating_b - rating_a) / 400))
    expected_b = 1 - expected_a
    
    new_rating_a = rating_a + K * (result - expected_a)
    new_rating_b = rating_b + K * ((1-result) - expected_b)
    
    return new_rating_a, new_rating_b

# Chatbot Arena使用此方法排名
# GPT-4: ~1250
# Claude 3 Opus: ~1240
# GPT-3.5: ~1100
```

### 9.3 Benchmark

**MMLU(大规模多任务语言理解):**
- 57个学科,14000道选择题
- GPT-4: 86.4%
- GPT-3.5: 70%
- LLaMA 3 70B: 79%

**HumanEval(代码生成):**
- 164道编程题
- GPT-4: 67%
- GPT-3.5: 48.1%
- Claude 3 Opus: 84.9%

**GSM8K(小学数学):**
- 8500道应用题
- GPT-4: 92%
- GPT-3.5: 57.1%
