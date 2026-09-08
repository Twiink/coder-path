---
title: "向量数据库选型与实战"
tags:
  - "Agent"
  - "向量数据库"
  - "RAG"
category: "Agent开发"
folder: "RAG技术"

created: 2026-09-07
updated: 2026-09-07
---

# 向量数据库选型与实战

> 向量数据库是RAG系统的核心基础设施。本文对比主流方案,从原理到实战,助你选择最适合的向量数据库。

---

## 一、向量数据库全景

### 1.1 为什么需要专门的向量数据库?

```python
# 【问题】传统数据库无法高效检索向量

# ❌ 暴力遍历(O(n))
query_vector = [0.1, 0.2, ..., 0.768]  # 768维
similarities = []
for doc_vector in all_vectors:  # 100万个文档
    sim = cosine_similarity(query_vector, doc_vector)  # 每次768次乘法
    similarities.append(sim)
# 时间复杂度: O(n*d), n=文档数, d=维度
# 100万文档: 约需10秒!

# ✅ 向量数据库(近似最近邻ANN)
results = vector_db.search(query_vector, top_k=10)
# 时间复杂度: O(log n)
# 100万文档: <50ms!
```

### 1.2 主流向量数据库对比

| 数据库 | 类型 | 部署 | 性能 | 功能 | 成本 | 推荐场景 |
|-------|-----|------|------|------|------|---------|
| **Chroma** | 嵌入式 | 本地/Docker | ⭐⭐⭐ | ⭐⭐⭐ | 免费 | 原型开发、中小规模 |
| **Qdrant** | 服务端 | Docker/云 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费/云付费 | 生产环境、高性能 |
| **Pinecone** | 云服务 | 托管 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 按量付费 | 快速上线、不想运维 |
| **Weaviate** | 服务端 | Docker/云 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费/云付费 | 复杂查询、混合检索 |
| **Milvus** | 分布式 | K8s/云 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 免费/企业版 | 海量数据、企业级 |
| **FAISS** | 库 | 本地 | ⭐⭐⭐⭐⭐ | ⭐⭐ | 免费 | 离线批处理、研究 |
---

## 二、Chroma - 最简单的入门选择

### 2.1 快速开始

```bash
pip install chromadb
```

```python
import chromadb
from chromadb.config import Settings

# 创建客户端(持久化到磁盘)
client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_db"
))

# 创建集合
collection = client.create_collection(
    name="my_documents",
    metadata={"description": "我的文档库"}
)

# 添加文档
collection.add(
    documents=[
        "Python是一种高级编程语言",
        "Java用于企业级应用开发",
        "JavaScript主要用于前端开发"
    ],
    ids=["doc1", "doc2", "doc3"],
    metadatas=[
        {"source": "wiki", "language": "python"},
        {"source": "blog", "language": "java"},
        {"source": "tutorial", "language": "javascript"}
    ]
)

# 查询
results = collection.query(
    query_texts=["告诉我关于编程语言的信息"],
    n_results=2
)

print(results["documents"])  # 返回最相关的2个文档
print(results["metadatas"])  # 对应的元数据
print(results["distances"])  # 距离(越小越相似)
```

### 2.2 使用自己的Embedding

```python
from openai import OpenAI

client_openai = OpenAI()

def embed_function(texts):
    """自定义embedding函数"""
    response = client_openai.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]

# 创建集合时指定embedding函数
collection = client.create_collection(
    name="custom_embeddings",
    embedding_function=embed_function
)

# 后续使用相同,Chroma会自动调用你的函数
```

### 2.3 过滤查询

```python
# 元数据过滤
results = collection.query(
    query_texts=["编程语言"],
    n_results=10,
    where={"language": "python"},  # 只查询Python相关
    where_document={"$contains": "高级"}  # 文档内容包含"高级"
)

# 支持的操作符
# $eq, $ne, $gt, $gte, $lt, $lte
# $in, $nin
# $and, $or
# $contains (文档内容)
```

---

## 三、Qdrant - 生产级首选

### 3.1 部署

```bash
# Docker部署
docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage:z \
    qdrant/qdrant

# Python客户端
pip install qdrant-client
```

### 3.2 完整CRUD

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# 连接
client = QdrantClient(host="localhost", port=6333)

# 创建集合
client.create_collection(
    collection_name="documents",
    vectors_config=VectorParams(
        size=1536,  # embedding维度
        distance=Distance.COSINE  # 距离度量
    )
)

# 插入数据
from openai import OpenAI
openai_client = OpenAI()

def get_embedding(text):
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

documents = [
    {"id": 1, "text": "Python编程", "category": "tech"},
    {"id": 2, "text": "机器学习", "category": "ai"},
]

points = [
    PointStruct(
        id=doc["id"],
        vector=get_embedding(doc["text"]),
        payload={"text": doc["text"], "category": doc["category"]}
    )
    for doc in documents
]

client.upsert(collection_name="documents", points=points)

# 搜索
query_text = "学习人工智能"
query_vector = get_embedding(query_text)

results = client.search(
    collection_name="documents",
    query_vector=query_vector,
    limit=5,
    with_payload=True
)

for result in results:
    print(f"分数: {result.score:.3f}")
    print(f"文本: {result.payload['text']}")
    print(f"类别: {result.payload['category']}\n")
```

### 3.3 过滤与混合查询

```python
from qdrant_client.models import Filter, FieldCondition, MatchValue

# 带过滤的搜索
results = client.search(
    collection_name="documents",
    query_vector=query_vector,
    query_filter=Filter(
        must=[
            FieldCondition(
                key="category",
                match=MatchValue(value="ai")
            )
        ]
    ),
    limit=10
)

# 【实战】分数过滤
results = client.search(
    collection_name="documents",
    query_vector=query_vector,
    score_threshold=0.7,  # 只返回相似度>0.7的
    limit=10
)
```

### 3.4 批量操作

```python
# 批量插入(高效)
batch_size = 100
points = []

for i, doc in enumerate(documents):
    points.append(PointStruct(
        id=i,
        vector=get_embedding(doc["text"]),
        payload=doc
    ))
    
    # 每100条插入一次
    if len(points) >= batch_size:
        client.upsert(collection_name="documents", points=points)
        points = []

# 剩余的
if points:
    client.upsert(collection_name="documents", points=points)
```
---

## 四、Pinecone - 云服务最快上手

### 4.1 设置

```bash
pip install pinecone-client
```

```python
from pinecone import Pinecone

# 初始化(需要API key)
pc = Pinecone(api_key="your-api-key")

# 创建索引
pc.create_index(
    name="my-index",
    dimension=1536,
    metric="cosine",
    spec=ServerlessSpec(
        cloud="aws",
        region="us-east-1"
    )
)

# 连接索引
index = pc.Index("my-index")

# 插入向量
index.upsert(vectors=[
    {
        "id": "doc1",
        "values": get_embedding("Python编程"),
        "metadata": {"text": "Python编程", "category": "tech"}
    },
    {
        "id": "doc2",
        "values": get_embedding("机器学习"),
        "metadata": {"text": "机器学习", "category": "ai"}
    }
])

# 查询
results = index.query(
    vector=get_embedding("学习编程"),
    top_k=5,
    include_metadata=True
)

for match in results["matches"]:
    print(f"ID: {match['id']}, 分数: {match['score']:.3f}")
    print(f"文本: {match['metadata']['text']}\n")
```

### 4.2 命名空间(多租户)

```python
# 为不同用户/项目创建独立命名空间
index.upsert(
    vectors=[...],
    namespace="user_123"
)

# 查询特定命名空间
results = index.query(
    vector=query_vector,
    namespace="user_123",
    top_k=5
)
```

---

## 五、LangChain 集成

### 5.1 Chroma + LangChain

```python
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.chains import RetrievalQA

# 1. 准备文档
documents = [
    "Python是一种解释型、面向对象、动态数据类型的高级程序设计语言。",
    "Java是一种广泛使用的计算机编程语言,拥有跨平台、面向对象、泛型编程的特性。",
    "JavaScript是一种具有函数优先的轻量级、解释型或即时编译型的编程语言。"
]

# 2. 分块(如果文档很长)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50
)
splits = text_splitter.create_documents(documents)

# 3. 创建向量库
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=embeddings,
    persist_directory="./chroma_langchain"
)

# 4. 创建检索器
retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={"k": 3}  # Top-3
)

# 5. 创建问答链
llm = ChatOpenAI(model="gpt-3.5-turbo")
qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",  # 将检索内容塞入上下文
    retriever=retriever,
    return_source_documents=True  # 返回来源
)

# 6. 查询
query = "Python有什么特点?"
result = qa_chain({"query": query})

print("答案:")
print(result["result"])
print("\n来源文档:")
for doc in result["source_documents"]:
    print(f"- {doc.page_content[:100]}...")
```

### 5.2 Qdrant + LangChain

```python
from langchain_community.vectorstores import Qdrant
from qdrant_client import QdrantClient

client = QdrantClient(host="localhost", port=6333)

vectorstore = Qdrant(
    client=client,
    collection_name="my_documents",
    embeddings=OpenAIEmbeddings()
)

# 添加文档
vectorstore.add_documents(splits)

# 使用与Chroma相同
retriever = vectorstore.as_retriever()
```
---

## 六、高级功能

### 6.1 混合检索(Dense + Sparse)

```python
# Weaviate 支持原生混合检索
import weaviate

client = weaviate.Client("http://localhost:8080")

# 混合搜索(alpha=0.5表示50%向量+50%关键词)
results = client.query.get(
    "Document",
    ["text", "title"]
).with_hybrid(
    query="Python编程",
    alpha=0.5  # 0=纯关键词, 1=纯向量
).with_limit(10).do()
```

### 6.2 多向量查询

```python
# Qdrant 支持多向量搜索
from qdrant_client.models import SearchRequest, Fusion

# 用多个查询向量检索,融合结果
query_vectors = [
    get_embedding("Python"),
    get_embedding("编程语言"),
]

results = client.search_batch(
    collection_name="documents",
    requests=[
        SearchRequest(vector=vec, limit=10)
        for vec in query_vectors
    ]
)

# RRF(Reciprocal Rank Fusion)融合
# 【效果】比单一查询召回率提升20-30%
```

### 6.3 向量更新与删除

```python
# Chroma
collection.update(
    ids=["doc1"],
    documents=["更新后的文档内容"],
    metadatas=[{"updated": True}]
)

collection.delete(ids=["doc2"])

# Qdrant
client.delete(
    collection_name="documents",
    points_selector=[1, 2, 3]  # 删除ID为1,2,3的点
)

# 条件删除
from qdrant_client.models import FilterSelector, FieldCondition

client.delete(
    collection_name="documents",
    points_selector=FilterSelector(
        filter=Filter(
            must=[
                FieldCondition(key="category", match=MatchValue(value="old"))
            ]
        )
    )
)
```

---

## 七、性能优化

### 7.1 索引类型选择

```python
# FAISS 提供多种索引类型
import faiss

# 1. Flat: 最准确,但慢(暴力搜索)
index = faiss.IndexFlatL2(dimension)

# 2. IVF: 快速近似搜索
quantizer = faiss.IndexFlatL2(dimension)
index = faiss.IndexIVFFlat(quantizer, dimension, nlist=100)
# nlist: 聚类中心数,越大越准确但越慢

# 3. HNSW: 高性能图索引
index = faiss.IndexHNSWFlat(dimension, M=32)
# M: 每层连接数,越大越准确但内存占用越大

# 4. PQ: 乘积量化,节省内存
index = faiss.IndexIVFPQ(quantizer, dimension, nlist, m, 8)
# m: 子向量数,通常是dimension/4
```

### 7.2 批量查询优化

```python
# ❌ 逐个查询(慢)
results = []
for query in queries:
    result = collection.query(query_texts=[query], n_results=5)
    results.append(result)

# ✅ 批量查询(快3-5倍)
results = collection.query(
    query_texts=queries,  # 一次性传入所有查询
    n_results=5
)
```

### 7.3 预过滤 vs 后过滤

```python
# 【策略1】预过滤(Pre-filtering)
# 先过滤再检索,适合过滤后剩余数据少的场景
results = client.search(
    collection_name="documents",
    query_vector=query_vector,
    query_filter=Filter(must=[...]),  # 先应用过滤
    limit=10
)

# 【策略2】后过滤(Post-filtering)
# 先检索更多结果,再过滤,适合过滤条件宽松的场景
results = client.search(
    collection_name="documents",
    query_vector=query_vector,
    limit=100  # 先检索100个
)
# 在应用层过滤
filtered = [r for r in results if r.payload["category"] == "ai"][:10]
```
---

## 八、选型决策树

```python
def select_vector_db(requirements):
    """根据需求选择向量数据库"""
    
    # 1. 快速原型/学习
    if requirements["use_case"] == "prototype":
        return "Chroma"  # 零配置,5分钟上手
    
    # 2. 不想运维
    if requirements["prefer_managed"]:
        return "Pinecone"  # 托管服务
    
    # 3. 超大规模(10亿+向量)
    if requirements["scale"] > 1_000_000_000:
        return "Milvus"  # 分布式架构
    
    # 4. 需要复杂查询(混合检索、GraphQL)
    if requirements["complex_queries"]:
        return "Weaviate"
    
    # 5. 高性能+自主控制
    if requirements["performance"] == "high" and requirements["self_hosted"]:
        return "Qdrant"  # 生产级性能,易部署
    
    # 6. 研究/离线处理
    if requirements["use_case"] == "research":
        return "FAISS"  # 最灵活,但需自己管理
    
    # 默认推荐
    return "Qdrant"  # 综合最佳

# 示例
requirements = {
    "use_case": "production",
    "scale": 1_000_000,
    "performance": "high",
    "self_hosted": True,
    "prefer_managed": False,
    "complex_queries": False
}

print(f"推荐: {select_vector_db(requirements)}")
```

---

## 九、实战案例:构建企业知识库

```python
import os
from pathlib import Path
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Qdrant
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA
from qdrant_client import QdrantClient

class EnterpriseKnowledgeBase:
    """企业知识库RAG系统"""
    
    def __init__(self, docs_dir, collection_name="kb"):
        self.docs_dir = docs_dir
        self.collection_name = collection_name
        
        # 初始化组件
        self.embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        self.llm = ChatOpenAI(model="gpt-4", temperature=0)
        self.qdrant_client = QdrantClient(host="localhost", port=6333)
        
        # 构建向量库
        self.vectorstore = self._build_vectorstore()
        self.qa_chain = self._create_qa_chain()
    
    def _build_vectorstore(self):
        """加载文档并构建向量库"""
        print("加载文档...")
        
        # 支持多种文件类型
        loader = DirectoryLoader(
            self.docs_dir,
            glob="**/*.{txt,md,pdf}",
            loader_cls=TextLoader
        )
        documents = loader.load()
        print(f"加载了{len(documents)}个文档")
        
        # 分块
        print("分块处理...")
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", "。", "!", "?", ",", " ", ""]
        )
        splits = text_splitter.split_documents(documents)
        print(f"分成{len(splits)}个块")
        
        # 构建向量库
        print("构建向量索引...")
        vectorstore = Qdrant.from_documents(
            splits,
            self.embeddings,
            url="http://localhost:6333",
            collection_name=self.collection_name,
            force_recreate=False  # 增量添加
        )
        print("完成!")
        
        return vectorstore
    
    def _create_qa_chain(self):
        """创建问答链"""
        retriever = self.vectorstore.as_retriever(
            search_type="mmr",  # MMR去重
            search_kwargs={"k": 5, "fetch_k": 20}
        )
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True,
            verbose=True
        )
        
        return qa_chain
    
    def query(self, question):
        """查询知识库"""
        result = self.qa_chain({"query": question})
        
        return {
            "answer": result["result"],
            "sources": [
                {
                    "content": doc.page_content,
                    "source": doc.metadata.get("source", "unknown")
                }
                for doc in result["source_documents"]
            ]
        }
    
    def add_documents(self, new_docs_dir):
        """增量添加文档"""
        loader = DirectoryLoader(new_docs_dir)
        documents = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        splits = text_splitter.split_documents(documents)
        
        # 添加到现有向量库
        self.vectorstore.add_documents(splits)
        print(f"添加了{len(splits)}个新文档块")

# 使用示例
if __name__ == "__main__":
    # 初始化知识库
    kb = EnterpriseKnowledgeBase(docs_dir="./company_docs")
    
    # 查询
    result = kb.query("公司的请假政策是什么?")
    
    print("回答:")
    print(result["answer"])
    print("\n来源:")
    for i, source in enumerate(result["sources"]):
        print(f"[{i+1}] {source['source']}")
        print(f"    {source['content'][:100]}...\n")
    
    # 增量添加新文档
    # kb.add_documents("./new_docs")
```
---

## 十、监控与维护

### 10.1 性能监控

```python
import time
from functools import wraps

def monitor_query(func):
    """查询性能监控装饰器"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start
        
        print(f"查询耗时: {elapsed*1000:.2f}ms")
        print(f"返回结果数: {len(result)}")
        
        # 记录到日志/监控系统
        log_metrics({
            "query_time": elapsed,
            "result_count": len(result)
        })
        
        return result
    return wrapper

@monitor_query
def search_vectors(query):
    return vectorstore.similarity_search(query, k=10)
```

### 10.2 数据备份

```python
# Qdrant 快照备份
snapshot = client.create_snapshot(collection_name="documents")
print(f"快照创建: {snapshot}")

# 恢复快照
client.recover_snapshot(
    collection_name="documents",
    snapshot_path="/path/to/snapshot"
)

# Chroma 持久化
# 只需备份persist_directory目录
import shutil
shutil.copytree("./chroma_db", "./chroma_db_backup")
```

---

## 十一、常见问题

**Q1: 向量维度越高越好吗?**

不一定。维度对比:
- 768维(BERT): 平衡,大多数场景够用
- 1536维(OpenAI): 更准确,但存储/计算成本高50%
- 384维(MiniLM): 快速,准确率下降5-10%

建议: 先用1536维,遇到性能瓶颈再降维。

**Q2: 如何处理多语言?**

```python
# 使用多语言Embedding模型
from langchain_community.embeddings import HuggingFaceEmbeddings

embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
)

# 或分别处理
def embed_with_language_detection(text):
    lang = detect_language(text)
    if lang == "zh":
        return chinese_embedder.embed(text)
    else:
        return english_embedder.embed(text)
```

**Q3: 向量数据库崩溃了怎么办?**

- Qdrant: 支持WAL(Write-Ahead Log),自动恢复
- Pinecone: 云服务自动备份
- Chroma: 需要手动备份persist_directory

**建议**: 生产环境用Qdrant/Pinecone,定期备份。

**Q4: 如何选择相似度指标?**

```python
# 三种常见指标
similarity_metrics = {
    "cosine": "余弦相似度,最常用,范围[-1,1]",
    "euclidean": "欧氏距离,适合低维空间",
    "dot_product": "点积,适合归一化向量"
}

# Qdrant示例
collection = client.recreate_collection(
    collection_name="test",
    vectors_config=VectorParams(
        size=1536,
        distance=Distance.COSINE  # 或 EUCLIDEAN, DOT
    )
)

# 选择建议:
# - 文本检索: Cosine(标准选择)
# - 图像检索: Euclidean
# - 归一化后的向量: Dot Product(等价于Cosine但更快)
```

**Q5: 冷启动问题如何解决?**

```python
# 向量库刚建立,文档很少,检索效果差

# 方案1: 预填充通用知识
def bootstrap_knowledge_base():
    """用公开数据集预填充"""
    # Wikipedia摘要、FAQ、常见问题等
    wikipedia_docs = load_wikipedia_articles(topics=["Python", "Java", "AI"])
    vector_store.add_documents(wikipedia_docs)

# 方案2: 混合检索(BM25 + 向量)
from rank_bm25 import BM25Okapi

class HybridRetriever:
    def __init__(self, vector_store, documents):
        self.vector_store = vector_store
        self.bm25 = BM25Okapi([doc.split() for doc in documents])
        self.documents = documents
    
    def retrieve(self, query, k=5):
        # 文档少时,BM25可能比向量更稳定
        if len(self.documents) < 100:
            # 以BM25为主
            bm25_scores = self.bm25.get_scores(query.split())
            top_indices = np.argsort(bm25_scores)[-k:]
            return [self.documents[i] for i in top_indices]
        else:
            # 文档多时,向量检索更好
            return self.vector_store.similarity_search(query, k=k)
```

---

## 十二、向量索引算法详解

理解底层算法,才能更好地调优。

### 12.1 暴力搜索 (Flat/Brute Force)

```python
# 最简单,最准确,但最慢
def brute_force_search(query_vector, all_vectors, k=10):
    """O(n*d)时间复杂度"""
    similarities = []
    
    for i, doc_vector in enumerate(all_vectors):
        # 计算余弦相似度
        sim = np.dot(query_vector, doc_vector) / (
            np.linalg.norm(query_vector) * np.linalg.norm(doc_vector)
        )
        similarities.append((i, sim))
    
    # 排序取top-k
    similarities.sort(key=lambda x: x[1], reverse=True)
    return similarities[:k]

# 适用场景:
# - 文档数 < 10,000
# - 需要100%准确率
# - 离线批处理
```

### 12.2 HNSW (Hierarchical Navigable Small World)

**原理**: 构建多层图,每层是不同粒度的"小世界网络"。

```
第3层(最粗粒度): ●---●         ●
                           ↓
第2层:              ●--●--●--●  ●--●
                           ↓
第1层(最细粒度):    ●-●-●-●-●-●-●-●-●
                    [搜索路径]
```

```python
# HNSW参数调优

# Qdrant HNSW配置
from qdrant_client.models import HnswConfigDiff

collection = client.recreate_collection(
    collection_name="optimized",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    hnsw_config=HnswConfigDiff(
        m=16,              # 每个节点的边数(默认16)
                          # 越大越准确,但内存占用越大
                          # m=16: 平衡
                          # m=32: 高准确率,内存+50%
                          # m=8:  低内存,准确率-5%
        
        ef_construct=100,  # 构建索引时的搜索宽度(默认100)
                          # 越大构建越慢,但索引质量越好
                          # ef_construct=200: 构建慢2x,查询快10%
        
        full_scan_threshold=10000  # 文档数少于此值,用暴力搜索
    )
)

# 查询时的ef参数
results = client.search(
    collection_name="optimized",
    query_vector=query_emb,
    limit=10,
    search_params={"hnsw_ef": 128}  # 查询时的搜索宽度
    # ef越大越准确,但越慢
    # hnsw_ef=64:  快,准确率95%
    # hnsw_ef=128: 平衡,准确率98%
    # hnsw_ef=256: 慢,准确率99.5%
)

# 性能对比(100万文档):
# Brute Force: 10秒, 100%准确
# HNSW(默认):  50ms, 98%准确
# HNSW(优化):  30ms, 99.5%准确(m=32, ef=256)
```

**HNSW 优势**:
- 查询速度快(O(log n))
- 准确率高(>95%)
- 适合高维向量

**HNSW 劣势**:
- 内存占用大(比数据本身大2-3倍)
- 不支持动态更新(需要重建索引)

### 12.3 IVF (Inverted File Index)

**原理**: 聚类 + 倒排索引。

```
1. 聚类: 将100万向量聚为1000个簇
   簇0: [doc1, doc5, doc99, ...]
   簇1: [doc2, doc7, ...]
   ...
   簇999: [...]

2. 查询: 先找最近的N个簇,再在簇内搜索
   query → 找最近3个簇 → 只搜索3000个文档
   
时间复杂度: O(k + n/nlist)
k=簇数, n=文档数, nlist=总簇数
```

```python
# FAISS IVF示例
import faiss

# 训练阶段
d = 768  # 向量维度
nlist = 100  # 簇数

# 创建IVF索引
quantizer = faiss.IndexFlatL2(d)  # 量化器
index = faiss.IndexIVFFlat(quantizer, d, nlist)

# 训练(聚类)
index.train(training_vectors)  # 需要训练数据

# 添加向量
index.add(all_vectors)

# 查询
index.nprobe = 10  # 搜索10个最近的簇
distances, indices = index.search(query_vector, k=10)

# 参数调优:
# nlist(簇数):
#   - 太小: 每个簇太大,搜索慢
#   - 太大: 簇查找开销大
#   - 推荐: sqrt(n), 如100万文档 → nlist=1000
# 
# nprobe(搜索的簇数):
#   - nprobe=1: 最快,准确率低(80%)
#   - nprobe=10: 平衡(95%)
#   - nprobe=nlist: 等价于暴力搜索(100%)
```

**IVF 优势**:
- 内存占用小
- 查询速度可调(nprobe)
- 支持PQ压缩(见下文)

**IVF 劣势**:
- 需要训练
- 准确率低于HNSW
- 簇划分不当影响性能

### 12.4 Product Quantization (PQ) - 压缩技术

**原理**: 将高维向量压缩为低内存编码。

```
原始向量(768维, 每维4字节): 768 * 4 = 3KB
PQ压缩后(768维 → 96字节):     96字节
压缩比: 32倍!
```

```python
# FAISS PQ示例
import faiss

d = 768
m = 96   # 子空间数量(768/8=96)
nbits = 8  # 每个子空间用8bit编码

# 创建PQ索引
index = faiss.IndexPQ(d, m, nbits)

# 训练
index.train(training_vectors)

# 添加
index.add(all_vectors)

# 查询(速度快,但准确率下降)
distances, indices = index.search(query_vector, k=10)

# 内存对比(100万文档,768维):
# 原始: 100万 * 768 * 4 = 3GB
# PQ:   100万 * 96 = 96MB (压缩32倍!)
# 
# 准确率:
# 无压缩: 100%
# PQ(m=96): 85-90%
# PQ(m=192): 95%
```

**组合使用: IVFPQ (最常见)**

```python
# IVF + PQ = 速度+压缩
index = faiss.IndexIVFPQ(quantizer, d, nlist, m, nbits)

# 训练
index.train(training_vectors)
index.add(all_vectors)

# 查询
index.nprobe = 10
distances, indices = index.search(query_vector, k=10)

# 性能对比(100万文档,768维):
# Flat(暴力):   内存3GB,   查询10s,  准确率100%
# HNSW:         内存9GB,   查询50ms, 准确率98%
# IVF:          内存3GB,   查询100ms,准确率95%
# IVFPQ:        内存96MB,  查询80ms, 准确率90%
```

---

## 十三、分布式与高可用

生产环境需要考虑扩展性和可靠性。

### 13.1 Qdrant 集群部署

```yaml
# docker-compose.yml
version: '3.8'

services:
  qdrant-node1:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_data_node1:/qdrant/storage
    environment:
      - QDRANT_CLUSTER_ENABLED=true
      - QDRANT_NODE_ID=node1
    networks:
      - qdrant-network

  qdrant-node2:
    image: qdrant/qdrant
    ports:
      - "6334:6333"
    volumes:
      - ./qdrant_data_node2:/qdrant/storage
    environment:
      - QDRANT_CLUSTER_ENABLED=true
      - QDRANT_NODE_ID=node2
      - QDRANT_BOOTSTRAP_URL=http://qdrant-node1:6335
    networks:
      - qdrant-network

  qdrant-node3:
    image: qdrant/qdrant
    ports:
      - "6335:6333"
    volumes:
      - ./qdrant_data_node3:/qdrant/storage
    environment:
      - QDRANT_CLUSTER_ENABLED=true
      - QDRANT_NODE_ID=node3
      - QDRANT_BOOTSTRAP_URL=http://qdrant-node1:6335
    networks:
      - qdrant-network

networks:
  qdrant-network:
    driver: bridge
```

```python
# 客户端配置
from qdrant_client import QdrantClient

# 连接集群(自动负载均衡)
client = QdrantClient(
    host="qdrant-load-balancer.example.com",
    port=6333,
    timeout=30
)

# 创建带副本的集合
client.recreate_collection(
    collection_name="prod_collection",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
    replication_factor=2,  # 2个副本
    write_consistency_factor=1  # 至少1个副本写入成功即可
)

# 高可用配置
# replication_factor=2: 数据存2份,1个节点挂了仍可用
# replication_factor=3: 数据存3份,2个节点挂了仍可用(推荐生产)
```

### 13.2 分片策略

```python
# 手动分片(按业务逻辑)
class ShardedVectorStore:
    """按租户/类别分片"""
    
    def __init__(self, qdrant_hosts):
        self.clients = [
            QdrantClient(host=host, port=6333)
            for host in qdrant_hosts
        ]
        self.num_shards = len(self.clients)
    
    def _get_shard(self, key):
        """根据key路由到分片"""
        shard_id = hash(key) % self.num_shards
        return self.clients[shard_id]
    
    def add_documents(self, tenant_id, documents):
        """按租户分片"""
        client = self._get_shard(tenant_id)
        
        collection_name = f"tenant_{tenant_id}"
        
        # 确保集合存在
        try:
            client.get_collection(collection_name)
        except:
            client.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
            )
        
        # 添加文档
        client.upsert(
            collection_name=collection_name,
            points=[...documents...]
        )
    
    def search(self, tenant_id, query_vector, k=10):
        """在对应分片搜索"""
        client = self._get_shard(tenant_id)
        collection_name = f"tenant_{tenant_id}"
        
        return client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=k
        )

# 使用
store = ShardedVectorStore([
    "qdrant-shard1.example.com",
    "qdrant-shard2.example.com",
    "qdrant-shard3.example.com"
])

# 租户1的数据 → shard1
store.add_documents("tenant_123", docs)

# 租户2的数据 → shard2
store.add_documents("tenant_456", docs)
```

### 13.3 备份与恢复

```python
# Qdrant备份
import requests
import shutil
from datetime import datetime

def backup_qdrant_collection(collection_name, backup_dir):
    """备份集合"""
    
    # 1. 创建快照
    response = requests.post(
        f"http://localhost:6333/collections/{collection_name}/snapshots"
    )
    
    snapshot_name = response.json()["result"]["name"]
    
    # 2. 下载快照
    snapshot_url = f"http://localhost:6333/collections/{collection_name}/snapshots/{snapshot_name}"
    
    backup_path = f"{backup_dir}/{collection_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.snapshot"
    
    with requests.get(snapshot_url, stream=True) as r:
        with open(backup_path, 'wb') as f:
            shutil.copyfileobj(r.raw, f)
    
    print(f"备份完成: {backup_path}")
    
    return backup_path

def restore_qdrant_collection(snapshot_path, collection_name):
    """恢复集合"""
    
    # 1. 上传快照
    with open(snapshot_path, 'rb') as f:
        response = requests.put(
            f"http://localhost:6333/collections/{collection_name}/snapshots/upload",
            files={"snapshot": f}
        )
    
    # 2. 从快照恢复
    snapshot_name = response.json()["result"]["name"]
    
    requests.post(
        f"http://localhost:6333/collections/{collection_name}/snapshots/{snapshot_name}/recover"
    )
    
    print(f"恢复完成: {collection_name}")

# 定期备份
import schedule

def daily_backup():
    backup_qdrant_collection("prod_collection", "./backups")

schedule.every().day.at("02:00").do(daily_backup)

# 运行
while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## 十四、成本优化实战

### 14.1 存储成本优化

```python
# 方法1: 使用较小的embedding模型
# OpenAI text-embedding-3-small: 1536维 → $0.00002/1K tokens
# OpenAI text-embedding-ada-002: 1536维 → $0.0001/1K tokens
# 
# text-embedding-3-small比ada-002便宜5倍!

from langchain_openai import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# 方法2: 降维(保留主要信息)
from sklearn.decomposition import PCA

def reduce_dimensions(vectors, target_dim=512):
    """从1536维降到512维,节省67%存储"""
    pca = PCA(n_components=target_dim)
    reduced = pca.fit_transform(vectors)
    
    # 准确率损失: 约2-5%
    # 存储节省: 67%
    # 查询速度: 提升3倍
    
    return reduced

# 方法3: 量化压缩(Qdrant内置)
client.recreate_collection(
    collection_name="compressed",
    vectors_config=VectorParams(
        size=1536,
        distance=Distance.COSINE
    ),
    quantization_config=ScalarQuantization(
        scalar=ScalarQuantizationConfig(
            type=ScalarType.INT8,  # 32位float → 8位int
            quantile=0.99
        )
    )
)

# 节省75%内存!(4字节 → 1字节)
# 准确率损失: <1%
```

### 14.2 查询成本优化

```python
# 方法1: 批量查询
# ❌ 逐个查询(100次API调用)
for query in queries:
    results = vector_store.similarity_search(query, k=5)

# ✅ 批量查询(1次API调用)
results = vector_store.similarity_search_batch(queries, k=5)

# 节省: 90%+ API调用

# 方法2: 缓存热门查询
from functools import lru_cache
import hashlib

@lru_cache(maxsize=1000)
def cached_search(query_hash):
    return vector_store.similarity_search(query_hash, k=5)

def search_with_cache(query):
    query_hash = hashlib.md5(query.encode()).hexdigest()
    return cached_search(query_hash)

# 命中率: 20-40%(取决于查询重复度)
# 节省: 20-40% API调用
```

---
