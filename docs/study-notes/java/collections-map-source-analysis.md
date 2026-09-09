---
title: "集合框架-Map与源码剖析"
aliases:
  - "HashMap 源码"
  - "ConcurrentHashMap 原理"
tags:
  - "后端"
  - "java"
  - "笔记"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/集合框架-List与Set]]"
  - "[[后端/Java基础/并发编程/volatile与CAS原子类]]"
  - "[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]"
  - "[[后端/JVM/JVM概述与运行时数据区]]"
created: 2026-09-06
updated: 2026-09-06
---

# 集合框架：Map 与源码剖析

> 这是 Java 面试的**头号考点**。HashMap 的 put 流程、扩容、红黑树、扰动函数、线程不安全原因、ConcurrentHashMap 的 CAS + synchronized，几乎每场面试必问。本篇按源码级别拆解。

## 1. Map 体系总览

| 实现类 | 底层结构 | 有序性 | 线程安全 | null key | null value | 时间复杂度 |
| --- | --- | --- | --- | --- | --- | --- |
| **HashMap** | 数组 + 链表 + 红黑树（JDK 8） | 无序 | ❌ | ✅ 1 个 | ✅ | O(1)，最差 O(log n) |
| **LinkedHashMap** | HashMap + 双向链表 | **插入顺序 / 访问顺序** | ❌ | ✅ | ✅ | O(1) |
| **TreeMap** | 红黑树 | **key 排序** | ❌ | ❌ | ✅ | O(log n) |
| **Hashtable** | 数组 + 链表（synchronized 全表锁） | 无序 | ✅（性能差） | ❌ | ❌ | O(1) |
| **ConcurrentHashMap** | JDK 7 分段锁；**JDK 8 CAS + synchronized + 红黑树** | 无序 | ✅（高并发） | ❌ | ❌ | O(1) |
| **ConcurrentSkipListMap** | 跳表 | key 排序 | ✅ | ❌ | ❌ | O(log n) |
| **WeakHashMap** | 数组 + 弱引用 key | 无序 | ❌ | ✅ | ✅ | O(1) |
| **EnumMap** | 位向量数组 | 枚举顺序 | ❌ | ❌ | ✅ | **O(1) 极致** |
| **IdentityHashMap** | 数组 + 线性探测 | 无序 | ❌ | ✅ | ✅ | O(1) |

**特殊 Map 的适用场景：**

```java
// EnumMap：key 是枚举时的最优选择（数组下标 = ordinal，无哈希计算）
Map<OrderStatus, Handler> handlers = new EnumMap<>(OrderStatus.class);
// 性能远超 HashMap，内存紧凑

// WeakHashMap：key 无强引用时自动移除（缓存场景）
Map<Object, Metadata> cache = new WeakHashMap<>();   // 对象被 GC 后条目自动清理

// IdentityHashMap：用 == 而非 equals 比较 key（序列化框架、深拷贝去环）
Map<Object, Object> seen = new IdentityHashMap<>();

// ConcurrentSkipListMap：需要并发 + 排序
ConcurrentSkipListMap<Long, Task> timeline = new ConcurrentSkipListMap<>();
```

## 2. HashMap 深度剖析 ★★★★★

### 2.1 底层数据结构演进

| 版本 | 结构 | 说明 |
| --- | --- | --- |
| JDK 7 | **数组 + 链表** | 冲突全部用链表（头插法），链过长时查询退化 O(n)，并发扩容成环导致死循环 |
| **JDK 8** | **数组 + 链表 + 红黑树** | 链表长度 ≥ 8 且数组长度 ≥ 64 时转红黑树（尾插法），查询稳定 O(log n)，扩容不再成环 |

```java
// JDK 8 HashMap 的核心字段
public class HashMap<K,V> extends AbstractMap<K,V>
        implements Map<K,V>, Cloneable, Serializable {

    static final int DEFAULT_INITIAL_CAPACITY = 1 << 4;   // ★ 默认容量 16（必须是 2 的幂）
    static final int MAXIMUM_CAPACITY = 1 << 30;          // 最大容量 2^30
    static final float DEFAULT_LOAD_FACTOR = 0.75f;       // ★ 默认负载因子
    static final int TREEIFY_THRESHOLD = 8;               // ★ 链表转红黑树的阈值
    static final int UNTREEIFY_THRESHOLD = 6;             // ★ 红黑树退化为链表的阈值
    static final int MIN_TREEIFY_CAPACITY = 64;           // ★ 树化要求的最小表容量

    transient Node<K,V>[] table;                          // ★ 哈希表（桶数组），懒初始化
    transient Set<Map.Entry<K,V>> entrySet;               // entrySet 缓存
    transient int size;                                   // 键值对数量
    transient int modCount;                               // 结构修改次数（fail-fast）
    int threshold;                                        // ★ 扩容临界值 = capacity * loadFactor
    final float loadFactor;                               // 负载因子

    // 节点定义
    static class Node<K,V> implements Map.Entry<K,V> {
        final int hash;              // ★ 缓存 hash 值，避免重复计算
        final K key;
        V value;
        Node<K,V> next;              // 链表指针
    }

    // 红黑树节点（继承 LinkedHashMap.Entry，以便树化时保留顺序信息）
    static final class TreeNode<K,V> extends LinkedHashMap.Entry<K,V> {
        TreeNode<K,V> parent, left, right;
        TreeNode<K,V> prev;          // 双向链表指针（退化时用）
        boolean red;
    }
}
```

**结构图（JDK 8）：**

```
table (Node<K,V>[16])
┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐
│ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │10 │11 │12 │13 │14 │15 │
└───┴─┬─┴───┴─┬─┴───┴───┴─┬─┴───┴───┴───┴───┴─┬─┴───┴───┴───┴───┘
      │       │           │                   │
      ▼       ▼           ▼                   ▼
   ┌─────┐ ┌─────┐    ┌─────────┐          (null)
   │Node │ │Node │    │TreeNode │ ← 红黑树（链表长度 ≥ 8 且表长 ≥ 64）
   │ k:v │ │ k:v │    │  根节点   │
   └──┬──┘ └──┬──┘    └────┬────┘
      ▼       ▼          ┌─┴─┐
   ┌─────┐ ┌─────┐       ▼   ▼
   │Node │ │Node │    TreeNode TreeNode
   └──┬──┘ └─────┘       │      │
      ▼                  ▼      ▼
   ┌─────┐            TreeNode  ...
   │Node │  ← 链表（冲突）
   └─────┘
```

### 2.2 扰动函数（hash 计算）★

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

**为什么要做「高 16 位异或低 16 位」的扰动？**

计算桶下标的公式是：

```java
index = (n - 1) & hash      // n 是数组长度（2 的幂）
```

- 当 `n = 16` 时，`n - 1 = 15 = 0000 0000 0000 0000 0000 0000 0000 1111`。
- **与运算只有低 4 位参与**，hash 的高 28 位全部被丢弃！
- 如果两个 key 的 hashCode 只有高位不同（低位相同），它们会落到同一个桶 → 大量冲突。
- 扰动函数把**高 16 位的信息混合到低 16 位**，让高位也能影响下标计算，**降低碰撞概率**。

```
假设 hashCode = 0x7FFF0001
扰动前:  0000 0000 0000 0000 0111 1111 1111 1111 0000 0000 0000 0001
h >>> 16: 0000 0000 0000 0000 0000 0000 0000 0000 0111 1111 1111 1111
异或结果:  0000 0000 0000 0000 0111 1111 1111 1111 0111 1111 1111 1110
                                                 ↑ 高位信息已进入低位

index = 15 & hash → 现在低 4 位包含了原高位的信息
```

**代价**：只有一次移位和一次异或，几乎零成本，**用最小的性能损失换取最好的哈希分布**——这是 JDK 8 的经典优化（JDK 7 的扰动函数做了 4 次移位 + 5 次异或，更复杂但收益有限）。

### 2.3 为什么容量必须是 2 的幂次方 ★

```java
// 定位桶下标
int index = (n - 1) & hash;      // 用位与，不用取模
```

**三个原因：**

1. **性能**：`(n-1) & hash` 是位运算，比 `hash % n` 快得多（取模是除法运算，CPU 开销大）。
2. **等价性**：只有当 `n` 是 2 的幂时，`hash % n == hash & (n - 1)` 才成立。
   ```
   n = 16, n-1 = 15 = 0b1111
   hash = 0b10110 (22)
   22 % 16 = 6
   22 & 15 = 0b10110 & 0b01111 = 0b00110 = 6  ✅ 等价
   ```
3. **哈希分布均匀**：`n - 1` 的二进制全是 1（如 15 = `1111`），与 hash 做与运算时每一位都参与，下标分布均匀。如果 n 不是 2 的幂（如 12 = `1100`），`n-1 = 11 = 1011`，第 2 位是 0 → **该位永远是 0，下标只能是 0,1,8,9,10,11**，一半的桶永远用不到，冲突率飙升。
4. **扩容时的巧妙迁移**（见 2.5）：扩容为 2 倍后，元素的新位置只有两种可能——「原位置」或「原位置 + 旧容量」，判断依据就是 hash 新增的那一位是 0 还是 1，**无需重新计算 hash**。

**tableSizeFor：把任意容量转成不小于它的最小 2 的幂**

```java
static final int tableSizeFor(int cap) {
    int n = -1 >>> Integer.numberOfLeadingZeros(cap - 1);
    return (n < 0) ? 1 : (n >= MAXIMUM_CAPACITY) ? MAXIMUM_CAPACITY : n + 1;
}
// JDK 8 的经典写法（位运算填满低位）
static final int tableSizeFor(int cap) {
    int n = cap - 1;
    n |= n >>> 1;      // 把最高位 1 右边 1 位填满
    n |= n >>> 2;      // 再填 2 位
    n |= n >>> 4;      // 再填 4 位
    n |= n >>> 8;      // 再填 8 位
    n |= n >>> 16;     // 再填 16 位 → 所有低位全变 1
    return (n < 0) ? 1 : (n >= MAXIMUM_CAPACITY) ? MAXIMUM_CAPACITY : n + 1;  // +1 得到 2 的幂
}
// tableSizeFor(10) → 16
// tableSizeFor(17) → 32
// tableSizeFor(16) → 16

// 所以 new HashMap(17) 的实际容量是 32，不是 17！
```

### 2.4 put 流程（逐行源码解析）★★★★★

```java
public V put(K key, V value) {
    return putVal(hash(key), key, value, false, true);
}

final V putVal(int hash, K key, V value, boolean onlyIfAbsent, boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;

    // ─── 步骤 1：table 为空则初始化（懒加载）───
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;            // 首次 put 触发 resize 来创建数组

    // ─── 步骤 2：计算下标，桶为空则直接放入 ───
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);   // 新建节点作为桶的头节点

    else {
        // ─── 步骤 3：桶不为空，处理冲突 ───
        Node<K,V> e; K k;

        // 3.1 头节点就是要找的 key（hash 相同 && (引用相同 || equals 相同)）
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
            e = p;                              // 找到了，准备覆盖

        // 3.2 头节点是红黑树节点 → 走树的插入
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);

        // 3.3 是链表 → 遍历链表
        else {
            for (int binCount = 0; ; ++binCount) {
                // 3.3.1 到达链表尾部，尾插新节点（JDK 8 是尾插，JDK 7 是头插）
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null);
                    // 3.3.2 插入后链表长度 ≥ 8 → 尝试树化
                    if (binCount >= TREEIFY_THRESHOLD - 1)     // binCount 从 0 开始，所以是 ≥ 7
                        treeifyBin(tab, hash);
                    break;
                }
                // 3.3.3 链表中找到了相同 key → 跳出准备覆盖
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    break;
                p = e;                          // 继续向后遍历
            }
        }

        // ─── 步骤 4：key 已存在 → 覆盖 value ───
        if (e != null) {
            V oldValue = e.value;
            if (!onlyIfAbsent || oldValue == null)
                e.value = value;
            afterNodeAccess(e);                 // 钩子（LinkedHashMap 用于 LRU）
            return oldValue;                    // 返回旧值
        }
    }

    // ─── 步骤 5：新增节点 → modCount++、size++、判断扩容 ───
    ++modCount;
    if (++size > threshold)
        resize();                               // ★ 超过阈值扩容
    afterNodeInsertion(evict);                  // 钩子（LinkedHashMap 用于移除最老元素）
    return null;                                // 新增返回 null
}
```

**put 流程图：**

```
put(key, value)
     │
     ▼
① hash(key) = (h = key.hashCode()) ^ (h >>> 16)      扰动函数
     │
     ▼
② table 为空？──是──→ resize() 初始化（容量 16）
     │否
     ▼
③ index = (n - 1) & hash，取桶头节点 p
     │
     ├─ p == null（桶空）──→ 直接新建节点放入，跳到 ⑧
     │
     ├─ p 的 key 相同 ──→ e = p（待覆盖），跳到 ⑦
     │
     ├─ p 是 TreeNode ──→ 走红黑树插入 putTreeVal，跳到 ⑦
     │
     └─ p 是链表 ──→ 遍历链表
            │
            ├─ 找到相同 key ──→ e = 该节点，跳到 ⑦
            │
            └─ 到链表尾 ──→ 尾插新节点
                   │
                   └─ 链表长度 ≥ 8 ──→ treeifyBin（判断表长）
                          │
                          ├─ 表长 < 64 ──→ 优先 resize 扩容（而非树化）
                          └─ 表长 ≥ 64 ──→ 真正树化为红黑树
     │
     ▼
⑦ e != null → 覆盖 value，返回 oldValue
     │
     ▼
⑧ modCount++；++size > threshold？──是──→ resize() 扩容
     │
     ▼
   返回 null（新增）或 oldValue（覆盖）
```

**【面试】key 相同的判断条件？**

```java
p.hash == hash && ((k = p.key) == key || (key != null && key.equals(k)))
```

必须**同时满足**：
1. `hash` 值相等（快速筛选，避免每个节点都调 equals）
2. `==` 引用相等 **或** `equals()` 内容相等

> 【坑】这就是为什么**必须同时重写 equals 和 hashCode**：
> - 只重写 equals：两个「相等」对象 hashCode 不同 → 落到不同桶 → Map 里出现两个「相同」的 key。
> - 只重写 hashCode：两个对象落到同一桶，但 equals 返回 false → 被当作不同 key 追加到链表。

### 2.5 resize 扩容机制 ★★★★★

```java
final Node<K,V>[] resize() {
    Node<K,V>[] oldTab = table;
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    int oldThr = threshold;
    int newCap, newThr = 0;

    // ─── 阶段 1：计算新容量和新阈值 ───
    if (oldCap > 0) {
        // 已达最大容量，不再扩容，返回原数组（threshold 设为 Integer.MAX_VALUE）
        if (oldCap >= MAXIMUM_CAPACITY) {
            threshold = Integer.MAX_VALUE;
            return oldTab;
        }
        // ★ 新容量 = 旧容量 × 2，新阈值 = 旧阈值 × 2
        else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY &&
                 oldCap >= DEFAULT_INITIAL_CAPACITY)
            newThr = oldThr << 1;
    }
    else if (oldThr > 0)          // 用了指定初始容量的构造器（threshold 暂存初始容量）
        newCap = oldThr;
    else {                        // 全新 HashMap（无参构造首次 put）
        newCap = DEFAULT_INITIAL_CAPACITY;              // 16
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);   // 12
    }

    if (newThr == 0) {            // 计算新阈值
        float ft = (float)newCap * loadFactor;
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY ?
                  (int)ft : Integer.MAX_VALUE);
    }
    threshold = newThr;

    // ─── 阶段 2：创建新数组并迁移数据 ───
    @SuppressWarnings({"rawtypes","unchecked"})
    Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    table = newTab;

    if (oldTab != null) {
        for (int j = 0; j < oldCap; ++j) {          // 遍历旧数组每个桶
            Node<K,V> e;
            if ((e = oldTab[j]) != null) {
                oldTab[j] = null;                    // ★ 帮助 GC

                // 情况 A：桶里只有一个节点 → 直接重算下标
                if (e.next == null)
                    newTab[e.hash & (newCap - 1)] = e;

                // 情况 B：红黑树 → 拆分（节点数 ≤ 6 则退化为链表）
                else if (e instanceof TreeNode)
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);

                // 情况 C：链表 → ★ JDK 8 的巧妙拆分（高低位两条链）
                else {
                    Node<K,V> loHead = null, loTail = null;   // 低位链（下标不变）
                    Node<K,V> hiHead = null, hiTail = null;   // 高位链（下标 = 原 + oldCap）
                    Node<K,V> next;
                    do {
                        next = e.next;
                        // ★ 核心判断：hash 与 oldCap 做与运算
                        if ((e.hash & oldCap) == 0) {          // 新增的那一位是 0 → 留在原位
                            if (loTail == null) loHead = e;
                            else loTail.next = e;
                            loTail = e;
                        }
                        else {                                  // 是 1 → 移到 原位置 + oldCap
                            if (hiTail == null) hiHead = e;
                            else hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);

                    if (loTail != null) {                       // 低位链放到原下标 j
                        loTail.next = null;
                        newTab[j] = loHead;
                    }
                    if (hiTail != null) {                       // 高位链放到 j + oldCap
                        hiTail.next = null;
                        newTab[j + oldCap] = hiHead;
                    }
                }
            }
        }
    }
    return newTab;
}
```

**【原理】扩容时元素位置的迁移规律（JDK 8 的精髓）：**

扩容前容量 `oldCap = 16`，扩容后 `newCap = 32`。

```
旧下标 = hash & (16 - 1) = hash & 0b01111    → 看 hash 的低 4 位
新下标 = hash & (32 - 1) = hash & 0b11111    → 看 hash 的低 5 位

差别只在于「第 5 位」（即 oldCap 那一位）：
  hash & oldCap == 0  → 第 5 位是 0 → 新下标 = 旧下标（位置不变）
  hash & oldCap == 1  → 第 5 位是 1 → 新下标 = 旧下标 + 16（原位置 + oldCap）
```

```
示例：oldCap = 16，桶 j = 5 上有链表 A → B → C → D
hash 值分别为：A=5(00101), B=21(10101), C=37(100101), D=53(110101)

hash & 16 (0b10000)：
  A: 00101 & 10000 = 0  → 低位链
  B: 10101 & 10000 = 16 → 高位链
  C: 100101 & 10000 = 0 → 低位链
  D: 110101 & 10000 = 16→ 高位链

拆分结果：
  低位链 loHead = A → C     → newTab[5]      （原下标）
  高位链 hiHead = B → D     → newTab[5 + 16] = newTab[21]
```

**这个设计的三大优势：**

1. **无需重新计算 hash**：只用一次位运算 `hash & oldCap` 判断，比 `hash % newCap` 快。
2. **保持链表相对顺序**：低位链和高位链内部顺序不变（JDK 7 头插法会逆序）。
3. **避免 JDK 7 的死循环**：JDK 7 用头插法迁移，并发扩容时链表可能形成**环形结构**，后续 get 操作陷入死循环（CPU 100%）。JDK 8 改为尾插 + 双链拆分，彻底解决。

**JDK 7 的死循环问题（经典面试题）：**

```java
// JDK 7 的 transfer 方法（头插法迁移）
void transfer(Entry[] newTable, boolean rehash) {
    int newCapacity = newTable.length;
    for (Entry<K,V> e : table) {
        while (null != e) {
            Entry<K,V> next = e.next;          // ① 记录下一个节点
            int i = indexFor(e.hash, newCapacity);
            e.next = newTable[i];              // ② 头插：当前节点指向新桶的头
            newTable[i] = e;                   // ③ 新桶头指向当前节点
            e = next;                          // ④ 处理下一个
        }
    }
}
```

```
并发场景（线程 A、B 同时扩容，链表 A→B→null）：

线程 1 执行到 ① 后挂起：e = A, next = B
线程 2 完成整个扩容：新表中链表变成 B→A→null（头插法逆序！）
线程 1 恢复，继续用旧的 next 引用：
  第一轮：e=A, next=B → A 插入新桶 → newTable[i]=A
  第二轮：e=B, next=A（线程2已把 B.next 改成 A）→ B 头插 → B→A
  第三轮：e=A, next=B（A.next 还指向 B）→ A 头插 → A→B→A  ★ 环形链表！
  
之后任何 get() 落到这个桶且 key 不存在 → while(e != null) 无限循环 → CPU 100%
```

> 【结论】**HashMap 在任何版本都不是线程安全的**，JDK 8 只是解决了「死循环」这个最恶劣的表现，但仍会有：数据覆盖、size 不准、fail-fast 异常等问题。并发必须用 `ConcurrentHashMap`。

### 2.6 treeifyBin 树化与退化

```java
final void treeifyBin(Node<K,V>[] tab, int hash) {
    int n, index; Node<K,V> e;
    // ★ 关键：如果表容量 < 64，优先扩容而不是树化！
    if (tab == null || (n = tab.length) < MIN_TREEIFY_CAPACITY)
        resize();
    else if ((e = tab[index = (n - 1) & hash]) != null) {
        // 真正的树化：把链表节点替换为 TreeNode
        TreeNode<K,V> hd = null, tl = null;
        do {
            TreeNode<K,V> p = replacementTreeNode(e, null);
            if (tl == null) hd = p;
            else { p.prev = tl; tl.next = p; }
            tl = p;
        } while ((e = e.next) != null);
        if ((tab[index] = hd) != null)
            hd.treeify(tab);          // 构建红黑树
    }
}
```

**树化与退化的阈值：**

| 阈值 | 值 | 触发条件 | 动作 |
| --- | --- | --- | --- |
| `TREEIFY_THRESHOLD` | **8** | 链表长度 ≥ 8 | **且** 表容量 ≥ 64 → 树化；否则 → 扩容 |
| `MIN_TREEIFY_CAPACITY` | **64** | 树化的最小表容量 | 小于此值优先 resize |
| `UNTREEIFY_THRESHOLD` | **6** | 扩容时红黑树节点数 ≤ 6 | 退化为链表 |

**【面试】为什么树化阈值是 8，退化阈值是 6（不是同一个值）？**

1. **8 的来源 —— 泊松分布**：HashMap 源码注释中给出了理想情况下（hash 分布均匀、负载因子 0.75）单个桶中节点数的概率分布：
   ```
   0: 0.60653066
   1: 0.30326533
   2: 0.07581633
   3: 0.01263606
   4: 0.00157952
   5: 0.00015795
   6: 0.00001316
   7: 0.00000094
   8: 0.00000006      ← 链表长度达到 8 的概率是 6 千万分之一！
   ```
   **正常情况下链表长度到 8 几乎不可能发生**。如果真到了 8，说明 hashCode 实现有问题或遭受哈希碰撞攻击，此时用红黑树把 O(n) 查询优化为 O(log n) 是「兜底保护」，而不是常态优化。

2. **6 与 8 之间留缓冲**：如果树化和退化都用同一个值（比如都是 8），当链表长度在 8 附近反复波动时，会**频繁树化/退化**（这两个操作都很昂贵）。留 7 这个缓冲区可以避免震荡（**滞回设计 hysteresis**）。

3. **红黑树的代价**：`TreeNode` 的大小约是 `Node` 的 **2 倍**（多了 parent/left/right/prev/red 五个字段），空间换时间。所以只在必要时才用。

### 2.7 负载因子 0.75 的取舍

```java
threshold = capacity * loadFactor     // 16 * 0.75 = 12，size > 12 时扩容
```

| 负载因子 | 空间利用率 | 哈希冲突概率 | 查询性能 |
| --- | --- | --- | --- |
| 0.5（小） | 低（浪费一半内存） | 低 | **快** |
| **0.75（默认）** | **较高** | **较低** | **平衡** |
| 1.0（大） | 高 | **高**（冲突多，链表长） | 慢 |

**0.75 是「时间与空间的折中」**：
- 泊松分布计算表明，负载因子 0.75 时，桶中元素个数达到 8 的概率仅 0.00000006，冲突控制在可接受范围。
- 若为 1.0，冲突概率大幅上升，链表变长，查询退化。
- 若为 0.5，扩容太频繁，空间浪费严重。

> 【实践】**不要随意修改负载因子**。如果已知元素数量，应该调整**初始容量**：
> ```java
> // 要存 1000 个元素，避免扩容的最佳初始容量
> int initCapacity = (int) (1000 / 0.75f) + 1;   // 1334
> Map&lt;String, Object&gt; map = new HashMap<>(initCapacity);   // 实际会是 2048（tableSizeFor）
>
> // Guava 提供的工具（更准确）
> Map&lt;String, Object&gt; map2 = Maps.newHashMapWithExpectedSize(1000);
> // 内部：(int) ((float) expectedSize / 0.75F + 1.0F)
>
> // JDK 19+ 官方提供
> Map&lt;String, Object&gt; map3 = HashMap.newHashMap(1000);
> ```
> 【强制】阿里手册：**集合初始化时指定初始容量**（`HashMap` 用 `initialCapacity = (需要存储的元素数 / 负载因子) + 1`）。

### 2.8 HashMap 的 get 流程

```java
public V get(Object key) {
    Node<K,V> e;
    return (e = getNode(hash(key), key)) == null ? null : e.value;
}

final Node<K,V> getNode(int hash, Object key) {
    Node<K,V>[] tab; Node<K,V> first, e; int n; K k;

    // 1. 表非空 && 桶非空
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (first = tab[(n - 1) & hash]) != null) {

        // 2. 头节点就命中（最常见，O(1)）
        if (first.hash == hash &&
            ((k = first.key) == key || (key != null && key.equals(k))))
            return first;

        if ((e = first.next) != null) {
            // 3. 红黑树查找 O(log n)
            if (first instanceof TreeNode)
                return ((TreeNode<K,V>)first).getTreeNode(hash, key);

            // 4. 链表遍历 O(n)
            do {
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    return e;
            } while ((e = e.next) != null);
        }
    }
    return null;
}
```

**get 的时间复杂度：**
- 最好情况（头节点命中）：**O(1)**
- 链表：**O(n)**（n 是链表长度，≤ 8）
- 红黑树：**O(log n)**
- **实际几乎总是 O(1)**，因为冲突极少。

### 2.9 HashMap 的 null 处理

```java
// null key 固定放在下标 0 的桶
static final int hash(Object key) {
    return (key == null) ? 0 : ...;      // null 的 hash 是 0
}

Map<String, Integer> map = new HashMap<>();
map.put(null, 1);
map.put(null, 2);
System.out.println(map.get(null));       // 2（覆盖）
System.out.println(map.size());          // 1

map.put("a", null);
map.put("b", null);
System.out.println(map.size());          // 3（value 可以多个 null）

// containsKey vs get（区分「不存在」和「值为 null」）
map.containsKey("a");                    // true
map.get("a");                            // null
map.get("notExist");                     // null  ← 无法区分！
// ✅ 正确判断
if (map.containsKey(key)) { V v = map.get(key); }
// 或用 getOrDefault
Integer value = map.getOrDefault(key, 0);
```

### 2.10 HashMap 线程不安全的具体表现（JDK 8）

```java
// 表现 1：put 时数据覆盖（size 丢失）
// 线程 A、B 同时执行 if ((p = tab[i = (n-1) & hash]) == null)
// 都判断桶为空 → 都执行 tab[i] = newNode(...) → 后写的覆盖先写的 → 丢数据

// 表现 2：size 不准确
// ++size 不是原子操作（读-改-写三步），并发下会丢失计数

// 表现 3：ConcurrentModificationException
// 一个线程迭代，另一个线程 put/remove → modCount 变化 → fail-fast

// 表现 4：可见性问题
// table、size 都不是 volatile，一个线程的修改其他线程可能看不到

// 验证代码
Map<Integer, Integer> map = new HashMap<>();
ExecutorService pool = Executors.newFixedThreadPool(10);
for (int i = 0; i < 10; i++) {
    final int base = i * 1000;
    pool.submit(() -> {
        for (int j = 0; j < 1000; j++) map.put(base + j, j);
    });
}
pool.shutdown();
pool.awaitTermination(1, TimeUnit.MINUTES);
System.out.println(map.size());    // 大概率 < 10000！
```

**并发场景的正确选择：**

| 方案 | 性能 | 说明 |
| --- | --- | --- |
| `ConcurrentHashMap` | ★★★★★ | **首选**，CAS + synchronized 桶级锁 |
| `Collections.synchronizedMap(map)` | ★★ | 所有方法加同一把锁，全表串行 |
| `Hashtable` | ★ | 过时，全表锁 |
| `HashMap` + 外部加锁 | ★★ | 需要自己控制粒度，易出错 |
| `ConcurrentSkipListMap` | ★★★★ | 需要排序时用 |

### 2.11 HashMap 的其他 API 与技巧

```java
Map<String, Integer> map = new HashMap<>();

// JDK 8 新增的实用方法
map.putIfAbsent("a", 1);                       // 不存在才放入，返回旧值或 null
map.getOrDefault("x", 0);                      // 不存在返回默认值（避免 NPE）
map.computeIfAbsent("a", k -> expensiveCompute(k));   // ★ 不存在才计算并放入（缓存利器）
map.computeIfPresent("a", (k, v) -> v * 2);    // 存在才计算更新
map.compute("a", (k, v) -> (v == null ? 1 : v + 1));  // 无论如何都计算
map.merge("a", 1, Integer::sum);               // ★ 计数/累加神器
map.replace("a", 2);                           // 替换（存在才替换）
map.replace("a", 1, 2);                        // CAS 语义：旧值是 1 才替换为 2
map.forEach((k, v) -> System.out.println(k + v));
map.remove("a");                               // 按 key 删除
map.remove("a", 1);                            // key 和 value 都匹配才删除
map.keySet();                                  // Set 视图（修改会影响 map）
map.values();                                  // Collection 视图
map.entrySet();                                // Set<Entry> 视图（遍历首选）

// 经典应用 1：词频统计
Map<String, Integer> count = new HashMap<>();
for (String word : words) {
    // ❌ 传统写法（两次哈希查找）
    Integer c = count.get(word);
    count.put(word, c == null ? 1 : c + 1);

    // ✅ merge（一次查找）
    count.merge(word, 1, Integer::sum);

    // ✅ compute
    count.compute(word, (k, v) -> v == null ? 1 : v + 1);

    // ✅ getOrDefault + put
    count.put(word, count.getOrDefault(word, 0) + 1);
}
// JDK 8 Stream 版
Map<String, Long> counts = Arrays.stream(words)
    .collect(Collectors.groupingBy(w -> w, Collectors.counting()));

// 经典应用 2：分组
Map<String, List<User>> byDept = users.stream()
    .collect(Collectors.groupingBy(User::getDept));
// computeIfAbsent 手写版
Map<String, List<User>> byDept2 = new HashMap<>();
for (User u : users) {
    byDept2.computeIfAbsent(u.getDept(), k -> new ArrayList<>()).add(u);
}

// 经典应用 3：多级缓存
Map<String, Map<String, Object>> cache = new HashMap<>();
cache.computeIfAbsent("user", k -> new ConcurrentHashMap<>())
     .put("1001", userObj);

// 经典应用 4：Map 排序
Map<String, Integer> sorted = map.entrySet().stream()
    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
    .collect(Collectors.toMap(
        Map.Entry::getKey,
        Map.Entry::getValue,
        (a, b) -> a,
        LinkedHashMap::new));        // ★ 必须用 LinkedHashMap 才能保持顺序！
```

> 【坑】**HashMap 遍历顺序不保证**。如果需要「排序后的 Map」，收集到 `LinkedHashMap`（保持插入顺序）；如果需要按 key 排序，用 `TreeMap`。用 `Collectors.toMap` 不指定第四个参数会返回 HashMap，排序结果丢失。

## 3. LinkedHashMap 与 LRU 缓存 ★

### 3.1 底层结构

**LinkedHashMap = HashMap + 贯穿所有 Entry 的双向链表**

```java
public class LinkedHashMap<K,V> extends HashMap<K,V> implements Map<K,V> {

    // Entry 继承 HashMap.Node，多了 before/after 指针
    static class Entry<K,V> extends HashMap.Node<K,V> {
        Entry<K,V> before, after;      // ★ 双向链表指针
        Entry(int hash, K key, V value, Node<K,V> next) {
            super(hash, key, value, next);
        }
    }

    transient LinkedHashMap.Entry<K,V> head;    // 链表头（最老）
    transient LinkedHashMap.Entry<K,V> tail;    // 链表尾（最新）

    final boolean accessOrder;      // ★ false = 插入顺序；true = 访问顺序（LRU 的基础）

    public LinkedHashMap() {
        super();
        accessOrder = false;
    }
    public LinkedHashMap(int initialCapacity, float loadFactor, boolean accessOrder) {
        super(initialCapacity, loadFactor);
        this.accessOrder = accessOrder;
    }

    // HashMap 的三个钩子方法（模板方法模式）
    void afterNodeAccess(Node<K,V> e) {          // 访问节点后调用
        LinkedHashMap.Entry<K,V> last;
        if (accessOrder && (last = tail) != e) {  // ★ 访问顺序模式下，把节点移到链表尾
            // ... 从链表中摘除 e，接到 tail 后面
        }
    }
    void afterNodeInsertion(boolean evict) {      // 插入节点后调用
        LinkedHashMap.Entry<K,V> first;
        if (evict && (first = head) != null && removeEldestEntry(first)) {
            removeNode(hash(first.key), first.key, null, false, true);  // ★ 移除最老元素
        }
    }
    void afterNodeRemoval(Node<K,V> e) { }        // 删除节点后维护链表

    // ★ 淘汰策略钩子：默认返回 false（不淘汰）
    protected boolean removeEldestEntry(Map.Entry<K,V> eldest) {
        return false;
    }
}
```

**这是「模板方法模式 + 钩子方法」的教科书级应用**：HashMap 在 put/get/remove 的关键点预留了三个空钩子（`afterNodeAccess`、`afterNodeInsertion`、`afterNodeRemoval`），LinkedHashMap 通过重写它们，在不改动 HashMap 一行代码的前提下实现了顺序维护和 LRU 淘汰。

### 3.2 手写 LRU 缓存 ★★★★★（面试必考）

```java
/**
 * 基于 LinkedHashMap 的 LRU 缓存（3 行核心代码）
 */
public class LRUCache<K, V> extends LinkedHashMap<K, V> {

    private final int capacity;

    public LRUCache(int capacity) {
        // initialCapacity, loadFactor, accessOrder=true（★ 访问顺序）
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }

    /** ★ 重写淘汰钩子：超过容量就移除最久未使用的（链表头） */
    @Override
    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
        return size() > capacity;
    }
}

// 使用
LRUCache<Integer, String> cache = new LRUCache<>(3);
cache.put(1, "a");
cache.put(2, "b");
cache.put(3, "c");
cache.get(1);                       // 访问 1 → 1 变成最新，顺序变为 2,3,1
cache.put(4, "d");                  // 超容量 → 淘汰最久未用的 2
System.out.println(cache);          // {3=c, 1=a, 4=d}
```

**手写双向链表 + HashMap 版（不依赖 LinkedHashMap，考察数据结构能力）：**

```java
public class LRUCache {

    /** 双向链表节点 */
    private static class Node {
        int key, value;
        Node prev, next;
        Node(int k, int v) { key = k; value = v; }
    }

    private final Map<Integer, Node> map;      // key → 节点（O(1) 定位）
    private final Node head, tail;             // 虚拟头尾哨兵（简化边界处理）
    private final int capacity;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.map = new HashMap<>(capacity);
        head = new Node(0, 0);
        tail = new Node(0, 0);
        head.next = tail;
        tail.prev = head;
    }

    public int get(int key) {
        Node node = map.get(key);
        if (node == null) return -1;
        moveToHead(node);                      // ★ 访问后移到头部（最近使用）
        return node.value;
    }

    public void put(int key, int value) {
        Node node = map.get(key);
        if (node != null) {                    // 已存在 → 更新并移到头部
            node.value = value;
            moveToHead(node);
            return;
        }
        if (map.size() == capacity) {          // 满了 → 淘汰尾部（最久未用）
            Node last = tail.prev;
            removeNode(last);
            map.remove(last.key);              // ★ 节点里存 key 就是为了这一步能删 map
        }
        Node newNode = new Node(key, value);
        map.put(key, newNode);
        addToHead(newNode);
    }

    private void addToHead(Node node) {
        node.prev = head;
        node.next = head.next;
        head.next.prev = node;
        head.next = node;
    }

    private void removeNode(Node node) {
        node.prev.next = node.next;
        node.next.prev = node.prev;
    }

    private void moveToHead(Node node) {
        removeNode(node);
        addToHead(node);
    }
}
```

**LRU 的其他实现方案对比：**

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| `LinkedHashMap` + `removeEldestEntry` | 代码极少，JDK 原生 | 非线程安全，需外部加锁 |
| 手写 HashMap + 双向链表 | 完全可控，可加统计/过期 | 代码量大，易出 bug |
| Guava `CacheBuilder` | 支持过期、刷新、统计、并发安全 | 引入依赖 |
| Caffeine | **性能最优**（W-TinyLFU 算法，命中率高于 LRU） | 引入依赖 |
| Redis | 分布式共享、容量大 | 网络开销 |

```java
// Caffeine（Spring Boot 2+ 默认推荐的本地缓存）
Cache<String, Object> cache = Caffeine.newBuilder()
    .maximumSize(10_000)                          // LRU/W-TinyLFU 淘汰
    .expireAfterWrite(10, TimeUnit.MINUTES)       // 写入后 10 分钟过期
    .expireAfterAccess(5, TimeUnit.MINUTES)       // 访问后 5 分钟过期
    .recordStats()                                // 开启统计
    .build();

// Guava Cache
LoadingCache<String, Object> guavaCache = CacheBuilder.newBuilder()
    .maximumSize(1000)
    .expireAfterWrite(10, TimeUnit.MINUTES)
    .build(key -> loadFromDb(key));
```

### 3.3 LinkedHashMap 的应用

```java
// 应用 1：保持 JSON 字段顺序（Jackson 反序列化默认用 LinkedHashMap）
Map<String, Object> json = objectMapper.readValue(str, LinkedHashMap.class);

// 应用 2：FIFO 队列（插入顺序 + 容量限制）
Map<K,V> fifo = new LinkedHashMap<K,V>(16, 0.75f, false) {   // accessOrder = false
    @Override protected boolean removeEldestEntry(Map.Entry<K,V> eldest) {
        return size() > 100;
    }
};

// 应用 3：Map 排序结果的容器
Map<String, Integer> sorted = ...collect(Collectors.toMap(..., LinkedHashMap::new));
```

## 4. TreeMap 与红黑树

### 4.1 TreeMap 基础

```java
// 底层：红黑树（自平衡二叉搜索树），key 有序
public class TreeMap<K,V> extends AbstractMap<K,V> implements NavigableMap<K,V> {
    private transient Entry<K,V> root;
    private final Comparator<? super K> comparator;   // null 则用 key 的 Comparable

    static final class Entry<K,V> implements Map.Entry<K,V> {
        K key; V value;
        Entry<K,V> left, right, parent;
        boolean color = BLACK;                        // ★ 红黑树的节点颜色
    }
}

// 使用
TreeMap<String, Integer> map = new TreeMap<>();       // 按 key 字典序
map.put("banana", 2);
map.put("apple", 1);
map.put("cherry", 3);
System.out.println(map);               // {apple=1, banana=2, cherry=3} ← 自动排序

// 自定义排序
TreeMap<User, Integer> map2 = new TreeMap<>(Comparator.comparing(User::getAge));

// 不允许 null key（因为要调 compareTo）
map.put(null, 1);                      // NullPointerException
map.put("a", null);                    // ✅ value 可以是 null
```

### 4.2 红黑树的五大性质

1. 每个节点是**红色或黑色**。
2. **根节点是黑色**。
3. 所有**叶子节点（NIL 空节点）是黑色**。
4. **红色节点的两个子节点必须是黑色**（不能有连续的红节点）。
5. **从任一节点到其每个叶子的所有路径都包含相同数目的黑色节点**（黑高相同）。

**由此推出**：最长路径 ≤ 2 × 最短路径（最坏情况是「红黑相间」的路径），保证了**近似平衡**，查询/插入/删除都是 **O(log n)**。

**红黑树 vs AVL 树：**

| 对比 | 红黑树 | AVL 树 |
| --- | --- | --- |
| 平衡标准 | 弱平衡（最长 ≤ 2×最短） | **严格平衡**（左右高度差 ≤ 1） |
| 查询效率 | O(log n)，略慢 | O(log n)，**更快**（树更矮） |
| 插入/删除 | **旋转少（最多 2~3 次）** | 旋转多（可能到根） |
| 适用 | **写多读多平衡**（Map、调度器） | 读远多于写（数据库索引查多） |
| 应用 | TreeMap、HashMap、Linux CFS 调度器、epoll | 数据库内部、内存索引 |

> TreeMap 选红黑树而非 AVL，因为 Map 的插入删除也很频繁，红黑树的**综合成本更低**。

### 4.3 NavigableMap 的导航 API

```java
TreeMap<Integer, String> map = new TreeMap<>();
map.put(1, "a"); map.put(3, "c"); map.put(5, "e"); map.put(7, "g");

map.firstKey();              // 1
map.lastKey();               // 7
map.firstEntry();            // 1=a
map.lastEntry();             // 7=g
map.pollFirstEntry();        // 1=a（取出并删除）
map.pollLastEntry();         // 7=g

map.floorKey(4);             // 3（≤ 4 的最大 key）
map.ceilingKey(4);           // 5（≥ 4 的最小 key）
map.lowerKey(5);             // 3（< 5 的最大 key）
map.higherKey(5);            // 7（> 5 的最小 key）
map.floorEntry(4);           // 3=c

map.headMap(5);              // {1=a, 3=c}（< 5 的视图）
map.headMap(5, true);        // {1=a, 3=c, 5=e}（含 5）
map.tailMap(3);              // {3=c, 5=e, 7=g}（≥ 3）
map.subMap(3, 7);            // {3=c, 5=e}（[3, 7)）
map.descendingMap();           // 降序视图 {7=g, 5=e, 3=c, 1=a}
map.navigableKeySet();       // 可导航的 key 集合

// 实战：根据时间戳找最近的记录
TreeMap<Long, Snapshot> timeline = ...;
Map.Entry<Long, Snapshot> nearest = timeline.floorEntry(queryTime);
// 实战：IP 段归属地查询
TreeMap<Long, String> ipRanges = ...;      // 起始 IP → 地区
String location = ipRanges.floorEntry(ipToLong(ip)).getValue();
```

## 5. ConcurrentHashMap ★★★★★

### 5.1 JDK 7：分段锁（Segment）

```
ConcurrentHashMap（JDK 7）
┌──────────────────────────────────────────────┐
│ Segment[] (默认 16 个段，继承 ReentrantLock)     │
│  ┌────────┐ ┌────────┐        ┌────────┐     │
│  │Segment0│ │Segment1│  ...   │Segment15│    │
│  │  🔒    │ │  🔒    │        │  🔒     │    │
│  │HashEntry[]                                 │
│  │  ┌──┐┌──┐┌──┐                              │
│  │  │  ││  ││  │ → 链表                        │
│  └────────┘                                   │
└──────────────────────────────────────────────┘
并发度 = Segment 数量 = 16（最多 16 个线程同时写）
```

- **Segment 继承 `ReentrantLock`**，每个 Segment 守护一个 `HashEntry[]`。
- 写操作只锁对应的 Segment，**并发度默认 16**（构造时可指定 `concurrencyLevel`）。
- `size()` 的实现很巧妙：先**不加锁统计 2 次**，如果 modCount 一致就返回；不一致则**锁住所有 Segment** 再统计。

### 5.2 JDK 8：CAS + synchronized（彻底重构）★★★★★

**放弃 Segment，改为「数组 + 链表 + 红黑树」（与 HashMap 结构一致），锁粒度细化到「桶（单个头节点）」。**

```java
public class ConcurrentHashMap<K,V> extends AbstractMap<K,V>
        implements ConcurrentMap<K,V>, Serializable {

    transient volatile Node<K,V>[] table;              // ★ volatile：保证可见性
    private transient volatile Node<K,V>[] nextTable;  // 扩容时的新表
    private transient volatile long baseCount;         // 元素计数（base + CounterCell[]）
    private transient volatile int sizeCtl;            // ★ 控制标识（-1 初始化中，-N 表示 N-1 个线程在扩容，>0 表示下次扩容阈值）
    private transient volatile int transferIndex;      // 扩容时的分配索引
    private transient volatile int cellsBusy;          // CounterCell 数组的初始化锁
    private transient volatile CounterCell[] counterCells;   // ★ 计数分散（LongAdder 思想）

    // 节点
    static class Node<K,V> implements Map.Entry<K,V> {
        final int hash;
        final K key;
        volatile V val;                 // ★ volatile
        volatile Node<K,V> next;        // ★ volatile
    }

    // 扩容时的转发节点（hash = MOVED = -1）
    static final class ForwardingNode<K,V> extends Node<K,V> {
        final Node<K,V>[] nextTable;
        ForwardingNode(Node<K,V>[] tab) { super(MOVED, null, null, null); this.nextTable = tab; }
    }

    // 树节点
    static final class TreeNode<K,V> extends Node<K,V> { ... }
}
```

**put 流程（JDK 8）：**

```java
final V putVal(K key, V value, boolean onlyIfAbsent) {
    if (key == null || value == null) throw new NullPointerException();   // ★ 不允许 null！
    int hash = spread(key.hashCode());                  // 扰动：(h ^ (h >>> 16)) & HASH_BITS
    int binCount = 0;

    for (Node<K,V>[] tab = table;;) {                   // ★ 自旋（无锁重试）
        Node<K,V> f; int n, i, fh;

        // 情况 1：表未初始化 → 初始化（CAS 控制只有一个线程成功）
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();

        // 情况 2：目标桶为空 → ★ CAS 直接放入（无锁！）
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null) {
            if (casTabAt(tab, i, null, new Node<K,V>(hash, key, value, null)))
                break;                                   // CAS 成功，无需加锁
            // CAS 失败说明有其他线程抢先插入了，自旋重试
        }

        // 情况 3：桶的头节点 hash == MOVED(-1) → 正在扩容 → ★ 帮助扩容
        else if ((fh = f.hash) == MOVED)
            tab = helpTransfer(tab, f);

        // 情况 4：桶不为空 → ★ synchronized 锁住头节点（只锁这一个桶！）
        else {
            V oldVal = null;
            synchronized (f) {                           // ★ 锁粒度 = 单个桶
                if (tabAt(tab, i) == f) {                // 双重检查：头节点没被改
                    if (fh >= 0) {                       // 链表
                        binCount = 1;
                        for (Node<K,V> e = f;; ++binCount) {
                            K ek;
                            if (e.hash == hash && ((ek = e.key) == key || (ek != null && key.equals(ek)))) {
                                oldVal = e.val;
                                if (!onlyIfAbsent) e.val = value;
                                break;
                            }
                            Node<K,V> pred = e;
                            if ((e = e.next) == null) {
                                pred.next = new Node<K,V>(hash, key, value, null);
                                break;
                            }
                        }
                    }
                    else if (f instanceof TreeBin) {      // 红黑树
                        Node<K,V> p;
                        binCount = 2;
                        if ((p = ((TreeBin<K,V>)f).putTreeVal(hash, key, value)) != null) {
                            oldVal = p.val;
                            if (!onlyIfAbsent) p.val = value;
                        }
                    }
                }
            }
            if (binCount != 0) {
                if (binCount >= TREEIFY_THRESHOLD)        // ≥ 8 树化
                    treeifyBin(tab, i);
                if (oldVal != null) return oldVal;
                break;
            }
        }
    }
    addCount(1L, binCount);                               // ★ 计数 + 判断扩容
    return null;
}
```

**四种情况的处理策略总结：**

| 情况 | 处理方式 | 锁 |
| --- | --- | --- |
| table 未初始化 | `initTable()` | **CAS** 抢 `sizeCtl` |
| 桶为空 | `casTabAt()` 直接放入 | **CAS**（无锁） |
| 桶正在扩容（`hash == MOVED`） | `helpTransfer()` 协助扩容 | — |
| 桶非空（链表/红黑树） | `synchronized (头节点)` | **桶级锁** |

**【面试】JDK 8 ConcurrentHashMap 如何保证线程安全？为什么用 synchronized 而不用 ReentrantLock？**

**保证安全的三大手段：**
1. **`volatile`**：`table`、`Node.val`、`Node.next` 都是 volatile，保证可见性。
2. **CAS**：桶为空时用 `Unsafe.compareAndSwapObject` 无锁插入；计数用 `baseCount` + `CounterCell[]` 分散。
3. **`synchronized`**：桶非空时锁住**头节点**，锁粒度极细（一个桶一把锁），并发度 = 桶数量（可达数万）。
4. **`tabAt`/`casTabAt` 用 `Unsafe.getObjectVolatile`**：即使数组元素不是 volatile，也能保证读取的可见性（数组本身是 volatile 不够，元素需要显式的 volatile 读）。

**为什么 JDK 8 改用 synchronized：**
1. **锁粒度大幅降低**：从 Segment（16 个）降到每个桶（可能上万个），冲突概率极低。**低竞争下 synchronized 有锁升级优化（偏向锁 → 轻量级锁 → 重量级锁），轻量级锁只是 CAS，开销比 ReentrantLock 小**。
2. **JVM 层面的持续优化**：synchronized 是 JVM 原生支持的，有锁消除、锁粗化、自适应自旋、逃逸分析等优化；ReentrantLock 是 API 层面的，JVM 难以优化。
3. **内存占用**：ReentrantLock 需要 AQS 的同步队列节点对象，synchronized 直接用对象头的 Mark Word，**零额外内存**。
4. **代码简洁**：不需要手动 `unlock()`（finally 块），不会因异常导致锁泄漏。
5. **GC 友好**：ReentrantLock 的 AQS 节点会产生更多垃圾对象。

> 【补充】在 JDK 6 之前，synchronized 确实比 ReentrantLock 慢很多（直接进重量级锁，涉及用户态/内核态切换）。但 JDK 6 引入锁升级机制后，**低竞争场景下 synchronized 已经反超**。这也是为什么 `Vector`/`Hashtable` 的 synchronized 在当年被认为是「性能差」，而现在 ConcurrentHashMap 又用回了它。

**initTable 的 CAS 控制：**

```java
private final Node<K,V>[] initTable() {
    Node<K,V>[] tab; int sc;
    while ((tab = table) == null || tab.length == 0) {
        // ★ sizeCtl < 0 说明有其他线程正在初始化/扩容，当前线程让出 CPU
        if ((sc = sizeCtl) < 0)
            Thread.yield();                       // 自旋等待（礼让）
        // ★ CAS 把 sizeCtl 从 sc 改成 -1，成功的线程负责初始化
        else if (U.compareAndSwapInt(this, SIZECTL, sc, -1)) {
            try {
                if ((tab = table) == null || tab.length == 0) {   // 双重检查
                    int n = (sc > 0) ? sc : DEFAULT_CAPACITY;      // 默认 16
                    @SuppressWarnings("unchecked")
                    Node<K,V>[] nt = (Node<K,V>[]) new Node<?,?>[n];
                    table = tab = nt;
                    sc = n - (n >>> 2);                            // 0.75 * n（用位运算算）
                }
            } finally {
                sizeCtl = sc;                                      // 恢复为阈值
            }
            break;
        }
    }
    return tab;
}
```

### 5.3 size() 的实现：LongAdder 思想 ★

**高并发下统计元素个数是难点**：如果用一个 `volatile int size` + CAS，高竞争时 CAS 失败率极高，性能崩溃。

**ConcurrentHashMap 的方案（与 `LongAdder` 完全一致的「分散热点」思想）：**

```java
private final void addCount(long x, int check) {
    CounterCell[] as; long b, s;
    // ★ 先尝试 CAS 更新 baseCount
    if ((as = counterCells) != null ||
        !U.compareAndSwapLong(this, BASECOUNT, b = baseCount, s = b + x)) {
        // baseCount CAS 失败（说明有竞争）→ 分散到 CounterCell 数组
        CounterCell a; long v; int m;
        boolean uncontended = true;
        if (as == null || (m = as.length - 1) < 0 ||
            (a = as[ThreadLocalRandom.getProbe() & m]) == null ||     // ★ 用线程探针哈希定位 Cell
            !(uncontended = U.compareAndSwapLong(a, CELLVALUE, v = a.value, v + x))) {
            fullAddCount(x, uncontended);         // Cell 也 CAS 失败 → 扩容 Cell 数组或新建 Cell
            return;
        }
        ...
    }
    // 求和时：baseCount + 所有 CounterCell 的 value
}

// size() 实际调用 sumCount()
final long sumCount() {
    CounterCell[] as = counterCells; CounterCell a;
    long sum = baseCount;
    if (as != null) {
        for (int i = 0; i < as.length; ++i) {
            if ((a = as[i]) != null)
                sum += a.value;                  // ★ 累加所有 Cell
        }
    }
    return sum;
}
```

**原理图解：**

```
低竞争：所有线程 CAS 更新 baseCount
   baseCount = 100

高竞争：CAS 失败后分散到 CounterCell[]（每个线程按 probe 哈希落到不同 Cell）
   baseCount = 30
   CounterCell[0].value = 20   ← 线程 A、B 更新
   CounterCell[1].value = 25   ← 线程 C、D 更新
   CounterCell[2].value = 15   ← 线程 E 更新
   ...
   size() = 30 + 20 + 25 + 15 + ... = 90+

Cell 数组还会动态扩容（fullAddCount）来进一步降低竞争
```

**这带来的一个重要特性 —— `size()` 是弱一致的：**

```java
// 统计过程中如果有其他线程在修改，返回的值可能不精确
// 这是「以精确性换性能」的设计取舍
map.size();        // 可能不是绝对准确的实时值
```

> 【对比】`AtomicLong` 在高并发下所有线程争抢同一个 value，CAS 失败率高；`LongAdder` / `CounterCell` 分散到多个 Cell，最后求和，**吞吐量高一个数量级**。所以 JDK 8 的高并发计数一律用 LongAdder 思想。详见 [[后端/Java基础/并发编程/volatile与CAS原子类]]。

### 5.4 get 为何完全无锁

```java
public V get(Object key) {
    Node<K,V>[] tab; Node<K,V> e, p; int n, eh; K ek;
    int h = spread(key.hashCode());
    if ((tab = table) != null && (n = tab.length) > 0 &&
        (e = tabAt(tab, (n - 1) & h)) != null) {
        if ((eh = e.hash) == h) {                       // 头节点命中
            if ((ek = e.key) == key || (ek != null && key.equals(ek)))
                return e.val;
        }
        else if (eh < 0)                                 // ★ hash < 0 说明是特殊节点
            return (p = e.find(h, key)) != null ? p.val : null;
            // eh == MOVED(-1)：ForwardingNode，去 nextTable 里找（扩容中也能读！）
            // eh == TREEBIN(-2)：红黑树，走树的查找
        while ((e = e.next) != null) {                   // 链表遍历
            if (e.hash == h && ((ek = e.key) == key || (ek != null && key.equals(ek))))
                return e.val;
        }
    }
    return null;
}
```

**get 无锁的原因：**
1. `Node.val` 和 `Node.next` 都是 **`volatile`**，读操作天然能看到最新值（JMM 保证）。
2. `tabAt` 用 `Unsafe.getObjectVolatile` 读数组元素，保证可见性。
3. 扩容时旧表的桶会放 `ForwardingNode`，`get` 能自动转发到新表读，**读操作永不阻塞**。

### 5.5 多线程协助扩容（transfer）★

JDK 8 ConcurrentHashMap 的扩容是**多线程协作**的（HashMap 是单线程扩容）：

```java
private final void transfer(Node<K,V>[] tab, Node<K,V>[] nextTab) {
    int n = tab.length, stride;
    // ★ 计算每个线程负责的桶数量（步长），最少 16 个
    if ((stride = (NCPU > 1) ? (n >>> 3) / NCPU : n) < MIN_TRANSFER_STRIDE)
        stride = MIN_TRANSFER_STRIDE;

    // 首个线程创建新表
    if (nextTab == null) {
        Node<K,V>[] nt = (Node<K,V>[]) new Node<?,?>[n << 1];   // 2 倍
        nextTab = nt;
    }
    nextTable = nextTab;
    int transferIndex = n;

    // ★ 从后往前遍历桶，每个线程领取一段（stride 个桶）
    while (advancing) {
        ...
        int nextIndex = transferIndex - stride;     // ★ CAS 领取任务区间
        ...
    }

    // 迁移单个桶后，在旧表放 ForwardingNode 标记
    setTabAt(tab, i, fwd);      // ★ hash = MOVED，其他线程看到会 helpTransfer
}
```

**协作扩容流程：**

```
1. 线程 A 触发扩容，创建 nextTable（2 倍大小）
2. 线程 A 从后往前迁移桶，每次领 stride 个（最少 16）
3. 迁移完的桶在旧表放 ForwardingNode（hash = MOVED）
4. 线程 B 来 put 时发现桶是 ForwardingNode → 调用 helpTransfer 一起扩容
5. 线程 B 领取另一段桶区间继续迁移（CAS transferIndex 分配任务）
6. get 遇到 ForwardingNode 会转发到 nextTable 查询（读不阻塞）
7. 所有桶迁移完成，table = nextTable，sizeCtl 更新为新阈值
```

**这是「工作窃取 / 任务分摊」思想的应用**，扩容速度随线程数增加而提升，且扩容期间读写都不阻塞。

### 5.6 ConcurrentHashMap 的其他要点

```java
// 1. 不允许 null key 和 null value（HashMap 允许！）
map.put(null, 1);          // NullPointerException
map.put("a", null);        // NullPointerException
// 原因：并发环境下 get 返回 null 无法区分「不存在」还是「值为 null」
//      单线程可以用 containsKey 二次确认，但并发下两次调用之间状态可能变化（二义性）
//      Doug Lea 明确说明这是为了避免歧义

// 2. 复合操作用原子方法，不要「先检查后执行」
// ❌ 线程不安全
if (!map.containsKey(key)) {
    map.put(key, value);          // 两步之间可能被其他线程插入
}
// ✅ 原子方法
map.putIfAbsent(key, value);
map.computeIfAbsent(key, k -> expensiveCompute(k));   // ★ 缓存场景必备
map.merge(key, 1, Integer::sum);                      // 原子计数
map.replace(key, oldVal, newVal);                     // CAS 语义替换
map.remove(key, value);                               // 值匹配才删除

// 3. computeIfAbsent 的原子性保证
map.computeIfAbsent("k", key -> {
    // 这个 lambda 在 synchronized 块内执行，保证原子性
    // ⚠️ 但不要在 lambda 里再操作同一个 map（会死锁或 ConcurrentModificationException）
    return new Value();
});

// 4. 批量并行操作（JDK 8 新增，parallelismThreshold 控制是否并行）
map.forEach(4, (k, v) -> System.out.println(k + v));    // 阈值 4，超过则并行
map.search(4, (k, v) -> v > 100 ? k : null);            // 并行查找
map.reduce(4, (k1,v1,k2,v2) -> v1+v2, v -> v);          // 并行归约
map.reduceValues(4, Long::sum);                          // 只对 value 归约
map.reduceKeys(4, (a, b) -> a + b);

// 5. 弱一致性迭代器（不抛 ConcurrentModificationException）
for (Map.Entry<String, Integer> e : map.entrySet()) {
    map.put("new", 1);      // ✅ 不抛异常，但迭代器可能看不到新元素
}
map.keySet().iterator();     // 迭代器反映某个时间点的状态
```

**HashMap vs Hashtable vs ConcurrentHashMap 终极对比：**

| 对比项 | HashMap | Hashtable | ConcurrentHashMap |
| --- | --- | --- | --- |
| 线程安全 | ❌ | ✅ | ✅ |
| 锁粒度 | — | **整个表**（synchronized 方法） | **单个桶**（JDK 8）/ 段（JDK 7） |
| 锁实现 | — | synchronized | **CAS + synchronized** |
| null key | ✅ 1 个 | ❌ | ❌ |
| null value | ✅ | ❌ | ❌ |
| 底层结构 | 数组+链表+红黑树 | 数组+链表 | 数组+链表+红黑树 |
| 扩容 | 单线程 2 倍 | 单线程 2 倍+1 | **多线程协助** 2 倍 |
| size() | 直接返回 size 字段 | synchronized 遍历 | **baseCount + CounterCell**（弱一致） |
| 迭代器 | fail-fast（抛 CME） | fail-fast | **fail-safe（弱一致，不抛）** |
| 性能 | 最高（单线程） | 最低 | 高（多线程下远超 Hashtable） |
| 现状 | 单线程首选 | **过时，禁用** | **并发首选** |
| 继承 | AbstractMap | Dictionary（过时） | AbstractMap |

## 6. 其他 Map 实现

### 6.1 Hashtable（了解即可，禁止使用）

```java
public class Hashtable<K,V> extends Dictionary<K,V> implements Map<K,V> {
    // 所有方法都是 synchronized（全表锁）
    public synchronized V put(K key, V value) { ... }
    public synchronized V get(Object key) { ... }
    // 初始容量 11，扩容为 2n + 1（不是 2 的幂！所以用 hash % length 定位）
    protected void rehash() {
        int newCapacity = (oldCapacity << 1) + 1;
    }
    // 不允许 null key/value（put 时直接抛 NPE）
}
```

> Hashtable 是 JDK 1.0 的遗留类，继承的 `Dictionary` 也是过时抽象类。**任何场景都不要用**，并发用 ConcurrentHashMap，单线程用 HashMap。

### 6.2 WeakHashMap（弱引用 key）

```java
// key 是弱引用：当 key 除了 WeakHashMap 的 Entry 外无其他强引用时，GC 会回收 key，条目自动移除
Map<Object, String> cache = new WeakHashMap<>();
Object key = new Object();
cache.put(key, "value");
System.out.println(cache.size());   // 1

key = null;                          // 移除强引用
System.gc();                         // 建议 GC
System.out.println(cache.size());   // 0（条目被自动清理）

// 应用：ThreadLocal 的 ThreadLocalMap.Entry 就是弱引用 key（同样机制）
// 应用：对象 → 元数据的临时映射（不希望阻止对象被回收）
// ⚠️ 注意：如果 value 强引用 key，会导致 key 永远不被回收（内存泄漏）
```

### 6.3 EnumMap

```java
// key 必须是枚举，底层是数组（下标 = enum.ordinal()）
Map<OrderStatus, Handler> handlers = new EnumMap<>(OrderStatus.class);
handlers.put(OrderStatus.PAID, paidHandler);

// 性能：get/put 都是纯数组访问，O(1) 且无哈希计算、无冲突、无扩容
// 内存：一个数组，极致紧凑
// 遍历顺序：枚举定义顺序（天然有序）
// 缺点：只能用于枚举 key；非线程安全（可用 Collections.synchronizedMap 包装）
```

### 6.4 不可变 Map

```java
// JDK 9+ 工厂方法（真不可变，不接受 null，key 不能重复）
Map<String, Integer> m1 = Map.of("a", 1, "b", 2);
Map<String, Integer> m2 = Map.ofEntries(
    Map.entry("a", 1),
    Map.entry("b", 2)
);
m1.put("c", 3);          // UnsupportedOperationException
Map.of("a", 1, "a", 2);  // IllegalArgumentException（重复 key）
Map.of("a", null);       // NullPointerException

// 视图（原 map 变化时视图也变）
Map<String, Integer> readOnly = Collections.unmodifiableMap(mutableMap);

// Guava
ImmutableMap.of("a", 1, "b", 2);
ImmutableMap.copyOf(map);
ImmutableMap.builder().put("a", 1).put("b", 2).build();
```

## 7. Map 实战技巧汇总

```java
// 1. 遍历性能：entrySet 优于 keySet
for (Map.Entry<K,V> e : map.entrySet()) { }    // ✅ 一次遍历
for (K k : map.keySet()) { map.get(k); }        // ❌ 遍历 + n 次哈希查找

// 2. 遍历中删除
Iterator<Map.Entry<K,V>> it = map.entrySet().iterator();
while (it.hasNext()) {
    if (shouldRemove(it.next())) it.remove();
}
map.entrySet().removeIf(e -> e.getValue() == null);   // JDK 8+，最简洁
map.values().removeIf(Objects::isNull);                // 也可以对 values 操作
map.keySet().removeIf(k -> k.startsWith("tmp_"));

// 3. Map 转 List
List<String> keys = new ArrayList<>(map.keySet());
List<Integer> values = new ArrayList<>(map.values());
List<Map.Entry<String,Integer>> entries = new ArrayList<>(map.entrySet());
List<String> list = map.entrySet().stream()
    .map(e -> e.getKey() + "=" + e.getValue())
    .collect(Collectors.toList());

// 4. List 转 Map（注意 key 冲突！）
Map<Long, User> byId = users.stream()
    .collect(Collectors.toMap(User::getId, u -> u));
// ⚠️ key 重复会抛 IllegalStateException: Duplicate key
// ✅ 提供合并函数
Map<Long, User> byId2 = users.stream()
    .collect(Collectors.toMap(User::getId, u -> u, (old, neu) -> neu));   // 保留后者
// ✅ 指定 Map 类型
Map<Long, User> byId3 = users.stream()
    .collect(Collectors.toMap(User::getId, u -> u, (a,b) -> a, TreeMap::new));

// 5. 分组
Map<String, List<User>> byDept = users.stream()
    .collect(Collectors.groupingBy(User::getDept));
// 多级分组
Map<String, Map<Integer, List<User>>> nested = users.stream()
    .collect(Collectors.groupingBy(User::getDept,
                                    Collectors.groupingBy(User::getAge)));
// 分组后统计
Map<String, Long> countByDept = users.stream()
    .collect(Collectors.groupingBy(User::getDept, Collectors.counting()));
Map<String, BigDecimal> sumByDept = orders.stream()
    .collect(Collectors.groupingBy(Order::getDept,
        Collectors.reducing(BigDecimal.ZERO, Order::getAmount, BigDecimal::add)));
// 分组后取字段
Map<String, List<String>> namesByDept = users.stream()
    .collect(Collectors.groupingBy(User::getDept,
        Collectors.mapping(User::getName, Collectors.toList())));

// 6. 分区（按布尔条件分两组）
Map<Boolean, List<User>> partition = users.stream()
    .collect(Collectors.partitioningBy(u -> u.getAge() >= 18));
partition.get(true);    // 成年
partition.get(false);   // 未成年（保证两个 key 都存在，即使为空列表）

// 7. Map 合并
Map<String, Integer> merged = new HashMap<>(map1);
map2.forEach((k, v) -> merged.merge(k, v, Integer::sum));   // 同 key 累加

// 8. 反转 Map（value → key）
Map<V, K> reversed = map.entrySet().stream()
    .collect(Collectors.toMap(Map.Entry::getValue, Map.Entry::getKey));
// ⚠️ value 有重复会抛异常，需要合并函数
// ⚠️ 反转后是 HashMap，顺序丢失，需要顺序用 LinkedHashMap::new

// 9. 过滤
Map<String, Integer> filtered = map.entrySet().stream()
    .filter(e -> e.getValue() > 10)
    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

// 10. 排序后收集（必须 LinkedHashMap 保序）
Map<String, Integer> sorted = map.entrySet().stream()
    .sorted(Map.Entry.<String,Integer>comparingByValue().reversed())
    .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue,
                              (a,b) -> a, LinkedHashMap::new));

// 11. 双 key 的 Map（用复合 key 或嵌套 Map）
// 方案 1：嵌套 Map
Map<String, Map<String, Integer>> nested = new HashMap<>();
nested.computeIfAbsent(rowKey, k -> new HashMap<>()).put(colKey, value);
// 方案 2：复合 key 对象（要正确实现 equals/hashCode，或用 record）
record Pair(String a, String b) { }
Map<Pair, Integer> pairMap = new HashMap<>();
pairMap.put(new Pair("r1", "c1"), 100);
// 方案 3：Guava Table
Table<String, String, Integer> table = HashBasedTable.create();
table.put("r1", "c1", 100);
table.row("r1");       // Map<String, Integer>
table.column("c1");

// 12. 缓存穿透防护（缓存 null 值）
Map<String, Object> cache = new ConcurrentHashMap<>();
private static final Object NULL_HOLDER = new Object();   // 空值占位符
public Object get(String key) {
    Object v = cache.computeIfAbsent(key, k -> {
        Object db = queryDb(k);
        return db == null ? NULL_HOLDER : db;
    });
    return v == NULL_HOLDER ? null : v;
}
```

## 8. Map 相关的常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | HashMap 并发 put | 数据覆盖、size 不准 | `ConcurrentHashMap` |
| 2 | JDK 7 HashMap 并发扩容 | 环形链表 → CPU 100% | 升级 JDK 8 + 用并发容器 |
| 3 | 只重写 equals 不重写 hashCode | Map 中出现重复 key | 必须同时重写 |
| 4 | hashCode 依赖可变字段 | put 后改字段，get 找不到 | hashCode 只用 final 字段 |
| 5 | 用可变对象作 key | 同上 | key 用不可变类型（String、Long、枚举） |
| 6 | `new HashMap(1000)` | 实际容量 1024，但会在 768 时扩容 | 用 `(int)(n/0.75)+1` 或 `newHashMap(n)` |
| 7 | ConcurrentHashMap put null | NPE | 不允许 null，用 Optional 或占位符 |
| 8 | `containsKey` + `get` 两步 | 并发下二义性、性能差 | 用 `getOrDefault`/`computeIfAbsent` |
| 9 | `Collectors.toMap` key 重复 | `IllegalStateException: Duplicate key` | 提供合并函数 `(a,b)->b` |
| 10 | `Collectors.toMap` value 为 null | NPE（JDK 8 的 bug） | 用 `HashMap::new` 手动 put 或 filter |
| 11 | TreeMap 的 compareTo 与 equals 不一致 | 数据丢失 | 保持一致 |
| 12 | TreeMap put null key | NPE | TreeMap 不允许 null key |
| 13 | 排序后收集到 HashMap | 顺序丢失 | 收集到 `LinkedHashMap::new` |
| 14 | 遍历中 put/remove | `ConcurrentModificationException` | `Iterator.remove` / `removeIf` / `computeIfAbsent` |
| 15 | `computeIfAbsent` 的 lambda 中操作同一 map | 死锁 / CME | lambda 内不要碰同一个 map |
| 16 | keySet + get 遍历 | 性能差（n 次哈希） | 用 `entrySet` |
| 17 | LinkedHashMap 未开 accessOrder 当 LRU | 不淘汰最近访问 | 构造器第三个参数传 `true` |
| 18 | 用 HashMap 做计数（get+put 两步） | 代码冗长、并发不安全 | `merge(k, 1, Integer::sum)` |
| 19 | `subList`/`keySet` 视图误当副本 | 修改影响原 Map | 需要副本时 `new HashMap<>(view)` |
| 20 | 大 Map 长期持有导致 OOM | 内存泄漏 | 用 WeakHashMap / Caffeine 带过期淘汰 |

---

## 关联笔记

- 上一篇：[[后端/Java基础/集合框架-List与Set]]
- 下一篇：[[后端/Java基础/异常处理]]
- 相关：[[后端/Java基础/并发编程/volatile与CAS原子类]]（CAS 与 LongAdder）、[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]（ThreadLocalMap）
- 应用：[[后端/中间件/Redis在Java项目中的整合]]（本地缓存 + 分布式缓存）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
