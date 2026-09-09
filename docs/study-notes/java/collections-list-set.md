---
title: "集合框架-List与Set"
aliases:
  - "ArrayList 与 LinkedList"
  - "Java 集合体系"
tags:
  - "后端"
  - "java"
  - "笔记"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/集合框架-Map与源码剖析]]"
  - "[[后端/Java基础/常用类与API]]"
  - "[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]"
  - "[[后端/JVM/垃圾回收机制与收集器]]"
created: 2026-09-06
updated: 2026-09-06
---

# 集合框架：List 与 Set

## 1. 集合框架总览

### 1.1 为什么要用集合

**数组的局限**：长度固定、增删元素需要手动搬移、无丰富 API。集合（Collection Framework，JDK 1.2 引入）解决了这些问题：动态扩容、丰富的操作 API、多种数据结构实现。

### 1.2 两大体系

```
                    ┌──────────────────────────────────┐
                    │        Iterable<E>               │  ← 可迭代
                    │        Collection<E>             │  ← 单列集合根接口
                    └───────┬──────────┬──────────┬────┘
                            │          │          │
                      ┌─────▼───┐ ┌────▼────┐ ┌───▼─────┐
                      │  List   │ │   Set   │ │  Queue  │
                      │ 有序可重复│ │ 不重复   │ │ 队列     │
                      └────┬────┘ └────┬────┘ └────┬────┘
                           │           │           │
        ┌──────────────────┼───────┐   │      ┌────┴─────────────┐
        │                  │       │   │      │                  │
   ArrayList         LinkedList Vector │   PriorityQueue    ArrayDeque
   （数组）           （双向链表）（数组+锁）│   （二叉堆）        （循环数组）
                                            │
                    ┌───────────────────────┼───────────────────┐
                    │                       │                   │
                 HashSet               LinkedHashSet        TreeSet
                 （HashMap 实现）       （LinkedHashMap）     （TreeMap 红黑树）
                 无序、O(1)             插入顺序              排序、O(log n)


                    ┌──────────────────────────────────┐
                    │           Map<K,V>               │  ← 双列集合根接口（独立体系！）
                    │           键值对                   │
                    └───────┬──────────┬───────────────┘
                            │          │
                    ┌───────▼───┐  ┌───▼───────┐  ┌──────────────┐
                    │  HashMap  │  │  TreeMap  │  │ LinkedHashMap│
                    │ 数组+链表  │  │  红黑树    │  │ HashMap+链表  │
                    │ +红黑树    │  │  排序      │  │  插入/访问顺序│
                    └───────────┘  └───────────┘  └──────────────┘
                          │
                    ┌─────▼──────────┐  ┌──────────────┐
                    │ConcurrentHashMap│  │  Hashtable   │
                    │ CAS+synchronized│  │ 全表锁（过时） │
                    └────────────────┘  └──────────────┘
```

> 【注意】**`Map` 不是 `Collection` 的子接口**，是独立的体系。因为它存的是键值对（Entry），与单元素集合的语义不同。

### 1.3 核心接口与实现类对照表

| 接口 | 特点 | 主要实现类 | 底层结构 | 有序性 | 重复性 | null |
| --- | --- | --- | --- | --- | --- | --- |
| `List` | 有序、可重复、可索引 | `ArrayList` | 动态数组 | 插入顺序 | 允许 | 允许 |
| | | `LinkedList` | 双向链表 | 插入顺序 | 允许 | 允许 |
| | | `Vector` | 动态数组 + synchronized | 插入顺序 | 允许 | 允许 |
| | | `CopyOnWriteArrayList` | 数组 + 写时复制 | 插入顺序 | 允许 | 允许 |
| `Set` | 不重复 | `HashSet` | HashMap | **无序** | 不允许 | **允许 1 个 null** |
| | | `LinkedHashSet` | LinkedHashMap | **插入顺序** | 不允许 | 允许 |
| | | `TreeSet` | TreeMap（红黑树） | **排序** | 不允许 | **不允许 null** |
| | | `CopyOnWriteArraySet` | CopyOnWriteArrayList | 插入顺序 | 不允许 | 允许 |
| `Queue` | 队列语义 | `PriorityQueue` | 二叉堆数组 | 优先级 | 允许 | 不允许 |
| | | `ArrayDeque` | 循环数组 | FIFO/LIFO | 允许 | 不允许 |
| | | `LinkedList` | 双向链表 | FIFO | 允许 | 允许 |
| | | `BlockingQueue` 系列 | 各异 | FIFO | — | 不允许 |
| `Map` | 键值对 | `HashMap` | 数组+链表+红黑树 | 无序 | key 不重复 | **key/value 都可 null** |
| | | `LinkedHashMap` | HashMap+双向链表 | 插入/访问顺序 | key 不重复 | 可 null |
| | | `TreeMap` | 红黑树 | **key 排序** | key 不重复 | **key 不可 null** |
| | | `Hashtable` | 数组+链表（全表锁） | 无序 | key 不重复 | **不可 null** |
| | | `ConcurrentHashMap` | 数组+链表+红黑树 | 无序 | key 不重复 | **不可 null** |
| `Deque` | 双端队列 | `ArrayDeque` | 循环数组 | 两端 | 允许 | 不允许 |

### 1.4 选型决策树

```
需要存储什么？
├── 键值对 → Map
│   ├── 需要排序 → TreeMap
│   ├── 需要保持插入顺序 / 做 LRU → LinkedHashMap
│   ├── 多线程 → ConcurrentHashMap
│   └── 一般场景 → HashMap ★
└── 单个元素 → Collection
    ├── 允许重复 → List
    │   ├── 随机访问多、读多写少 → ArrayList ★（90% 场景）
    │   ├── 频繁头尾插入删除 → ArrayDeque（比 LinkedList 更好！）
    │   ├── 频繁中间插入删除 → LinkedList（但仍不推荐，缓存不友好）
    │   └── 读多写极少的并发场景 → CopyOnWriteArrayList
    ├── 不允许重复 → Set
    │   ├── 需要排序 → TreeSet
    │   ├── 需要插入顺序 → LinkedHashSet
    │   └── 一般场景 → HashSet ★
    └── 队列/栈语义 → Queue/Deque
        ├── 先进先出 → ArrayDeque / LinkedList
        ├── 后进先出（栈）→ ArrayDeque（★ 优于过时的 Stack）
        ├── 优先级 → PriorityQueue
        └── 阻塞等待 → ArrayBlockingQueue / LinkedBlockingQueue
```

> 【重要】阿里手册：**不推荐 `Vector`、`Hashtable`、`Stack`**（都是同步开销大的过时类）。并发用 `java.util.concurrent` 的替代品；栈用 `ArrayDeque`。

## 2. List 详解

### 2.1 ArrayList ★★★★★

#### 底层结构

```java
public class ArrayList<E> extends AbstractList<E>
        implements List<E>, RandomAccess, Cloneable, java.io.Serializable {

    private static final int DEFAULT_CAPACITY = 10;       // 默认容量
    private static final Object[] EMPTY_ELEMENTDATA = {};  // 指定容量 0 时用
    private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};  // 无参构造用
    transient Object[] elementData;                        // ★ 真正存数据的数组（transient 不序列化）
    private int size;                                      // 实际元素个数（≠ 数组长度）
    protected transient int modCount = 0;                  // 结构修改次数（fail-fast 用）
    private static final int MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8;
}
```

**关键点：**
- `elementData` 是 `Object[]`，用 `transient` 修饰 → 自定义 `writeObject` 只序列化 `size` 个有效元素，不序列化空槽（节省空间）。
- `size` 是**元素个数**，`elementData.length` 是**容量**，两者不同。
- 实现了 `RandomAccess` 标记接口 → 表示支持 O(1) 随机访问（`get(i)` 快），遍历时应用索引 for。
- **线程不安全**（无同步）。

#### 构造器与初始化

```java
// 1. 无参构造：JDK 8+ 初始为空数组，首次 add 时扩容到 10（懒初始化）
ArrayList<String> list = new ArrayList<>();
// elementData = DEFAULTCAPACITY_EMPTY_ELEMENTDATA (长度 0)

// 2. 指定初始容量：直接分配数组（避免多次扩容）
ArrayList<String> list2 = new ArrayList<>(100);
// elementData = new Object[100]

// 3. 由集合构造：拷贝元素
ArrayList<String> list3 = new ArrayList<>(otherList);
// elementData = Arrays.copyOf(otherList.toArray(), size)

// JDK 7 及以前：无参构造直接 new Object[10]（急切初始化）
```

#### add 与扩容机制（核心考点）

```java
// add(E e)：追加到末尾
public boolean add(E e) {
    modCount++;                              // 结构修改计数 +1
    add(e, elementData, size);               // JDK 17 的实现（JDK 8 是 ensureCapacityInternal）
    size++;
    return true;
}

// JDK 17 源码
private void add(E e, Object[] elementData, int s) {
    if (s == elementData.length)             // 数组满了
        elementData = grow();                // 扩容
    elementData[s] = e;                      // 放入
}

private Object[] grow() {
    return grow(size + 1);                   // 至少能装 size+1 个
}

private Object[] grow(int minCapacity) {
    int oldCapacity = elementData.length;
    if (oldCapacity > 0 || elementData != DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        // 正常扩容：新容量 = 旧容量 + 旧容量/2 = 1.5 倍
        int newCapacity = ArraysSupport.newLength(oldCapacity,
                minCapacity - oldCapacity,   // 需要增加的最小值
                oldCapacity >> 1             // 期望增长 = 旧容量的一半
        );
        return elementData = Arrays.copyOf(elementData, newCapacity);
    } else {
        // 首次 add（从空数组）：容量直接设为 10
        return elementData = new Object[Math.max(DEFAULT_CAPACITY, minCapacity)];
    }
}

// JDK 8 的扩容（grow）
private void grow(int minCapacity) {
    int oldCapacity = elementData.length;
    int newCapacity = oldCapacity + (oldCapacity >> 1);   // ★ 1.5 倍：old + old/2
    if (newCapacity - minCapacity < 0)
        newCapacity = minCapacity;                        // 如果 1.5 倍还不够，用需要的容量
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);          // 超大数组处理
    elementData = Arrays.copyOf(elementData, newCapacity);// ★ 数组拷贝
}
```

**扩容过程图解：**

```
初始：new ArrayList<>()
elementData = [] (长度 0), size = 0

第 1 次 add：
  s(0) == elementData.length(0) → grow()
  因为是 DEFAULTCAPACITY_EMPTY_ELEMENTDATA → 新容量 = max(10, 1) = 10
elementData = [_,_,_,_,_,_,_,_,_,_] (长度 10), size = 1

add 到第 11 个元素：
  s(10) == elementData.length(10) → grow()
  新容量 = 10 + (10 >> 1) = 10 + 5 = 15
  Arrays.copyOf(elementData, 15)   ← 数组拷贝，O(n)
elementData = [10 个元素 + 5 个空], size = 11

第 16 个：15 + 7 = 22
第 23 个：22 + 11 = 33
容量序列：0 → 10 → 15 → 22 → 33 → 49 → 73 → 109 ...
```

**【面试】ArrayList 的扩容机制？**

1. 无参构造时数组长度为 0（JDK 8+），**首次 add 时扩容为 10**。
2. 之后每次容量不足时，**新容量 = 旧容量 × 1.5**（`oldCapacity + (oldCapacity >> 1)`）。
3. 通过 `Arrays.copyOf()`（底层 `System.arraycopy`，native）把旧数组元素拷贝到新数组。
4. 如果 1.5 倍仍不够（如一次 `addAll` 大量元素），直接扩到所需容量。
5. 上限是 `Integer.MAX_VALUE - 8`（部分 JVM 数组头占用，超过可能 OOM）。

**扩容的成本**：每次扩容都要**完整拷贝数组**（O(n)），且产生**旧数组垃圾**（GC 压力）。所以：

> 【最佳实践】**能预估容量时一定指定初始容量**：`new ArrayList<>(10000)`。否则从 0 加到 10 万元素要扩容约 30 次，累计拷贝约 30 万元素。

```java
// 计算所需容量的公式
int expectedSize = 10000;
List<T> list = new ArrayList<>(expectedSize);

// Guava 的工具方法（考虑了 load factor）
Lists.newArrayListWithCapacity(10000);
Lists.newArrayListWithExpectedSize(10000);
```

#### 常见操作的时间复杂度

| 操作 | 方法 | 时间复杂度 | 说明 |
| --- | --- | --- | --- |
| 尾部添加 | `add(e)` | **O(1)** 均摊 | 扩容时是 O(n)，但均摊到每次是 O(1) |
| 指定位置添加 | `add(i, e)` | **O(n)** | 需要 `System.arraycopy` 移动 i 之后的所有元素 |
| 尾部删除 | `remove(size-1)` | O(1) | |
| 指定位置删除 | `remove(i)` | **O(n)** | 移动 i 之后的元素 |
| 按对象删除 | `remove(Object)` | O(n) | 先遍历查找再删除 |
| 查询 | `get(i)` | **O(1)** | 数组随机访问 |
| 查找索引 | `indexOf(o)` | O(n) | 遍历 |
| 是否包含 | `contains(o)` | O(n) | 内部调 indexOf |
| 批量添加 | `addAll(c)` | O(m) | m 是集合大小，可能触发一次扩容 |
| 遍历 | for / iterator | O(n) | |

```java
// add(index, element) 的实现：需要移动元素
public void add(int index, E element) {
    rangeCheckForAdd(index);
    modCount++;
    final int s;
    Object[] elementData;
    if ((s = (elementData = this.elementData).length) == (this.size))
        elementData = grow(s + 1);
    System.arraycopy(elementData, index,      // 从 index 开始
                     elementData, index + 1,  // 移到 index+1
                     s - index);              // 移动 s-index 个元素 ★ O(n)
    elementData[index] = element;
    size = s + 1;
}

// remove(index) 的实现：同样需要移动
public E remove(int index) {
    Objects.checkIndex(index, size);
    final Object[] es = elementData;
    E oldValue = (E) es[index];
    fastRemove(es, index);
    return oldValue;
}

private void fastRemove(Object[] es, int i) {
    modCount++;
    final int newSize;
    if ((newSize = size - 1) > i)
        System.arraycopy(es, i + 1, es, i, newSize - i);   // ★ 前移覆盖
    es[size = newSize] = null;      // ★ 最后一个位置置 null，防止内存泄漏
}
```

> 【坑】**`es[size] = null` 很重要**：如果不置 null，被删除对象的引用还在数组中，GC 无法回收（称为「内存泄漏的隐藏引用」）。这是《Effective Java》第 7 条的经典案例。

#### 删除元素的正确姿势（高频坑）

```java
List<String> list = new ArrayList<>(Arrays.asList("a", "b", "c", "d", "e"));

// ❌ 方式 1：for-each 中 remove → ConcurrentModificationException
for (String s : list) {
    if (s.equals("b")) list.remove(s);
}
// java.util.ConcurrentModificationException

// ❌ 方式 2：正向索引遍历中 remove → 漏删元素
for (int i = 0; i < list.size(); i++) {
    if (list.get(i).equals("b")) {
        list.remove(i);
        // 删除后，后面的元素前移，i++ 会跳过刚移过来的那个元素！
    }
}
// list = ["a","b","b","c"] 时，删掉第一个 b 后，第二个 b 移到 i 位置，但 i 已经 ++ → 漏删

// ✅ 方式 3：倒序索引遍历（删除不影响前面的索引）
for (int i = list.size() - 1; i >= 0; i--) {
    if (list.get(i).equals("b")) list.remove(i);
}

// ✅ 方式 4：Iterator.remove（官方推荐，会同步 expectedModCount）
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    if (it.next().equals("b")) it.remove();
}

// ✅ 方式 5：removeIf（JDK 8+，最简洁，内部用 BitSet 批量删除，性能最好）
list.removeIf(s -> s.equals("b"));
list.removeIf(Objects::isNull);                    // 去除 null
list.removeIf(s -> s.startsWith("temp_"));         // 条件删除

// ✅ 方式 6：Stream filter 生成新集合（不修改原集合）
List<String> filtered = list.stream()
        .filter(s -> !s.equals("b"))
        .collect(Collectors.toList());

// ✅ 方式 7：批量删除
list.removeAll(toRemoveList);                      // 删除所有在 toRemoveList 中的元素
list.retainAll(keepList);                          // 只保留 keepList 中的元素
```

**【原理】为什么 for-each 中 remove 会抛 ConcurrentModificationException？**

```java
// ArrayList.Itr 的源码
private class Itr implements Iterator<E> {
    int cursor;                       // 下一个元素的索引
    int lastRet = -1;                 // 上次返回元素的索引
    int expectedModCount = modCount;  // ★ 创建迭代器时记录 modCount

    public E next() {
        checkForComodification();     // ★ 每次 next 都检查
        int i = cursor;
        if (i >= size) throw new NoSuchElementException();
        ...
        cursor = i + 1;
        return (E) elementData[lastRet = i];
    }

    final void checkForComodification() {
        if (modCount != expectedModCount)     // ★ 不一致就抛异常
            throw new ConcurrentModificationException();
    }

    public void remove() {
        ...
        ArrayList.this.remove(lastRet);       // 调用外部类的 remove，modCount++
        cursor = lastRet;
        lastRet = -1;
        expectedModCount = modCount;          // ★ 同步更新！所以不抛异常
    }
}

// 流程：
// 1. list.iterator() → expectedModCount = modCount (0)
// 2. it.next() → 检查通过，返回元素
// 3. list.remove(x) → modCount 变成 1，但 expectedModCount 还是 0
// 4. it.next() → checkForComodification() → 1 != 0 → 抛 ConcurrentModificationException
```

**fail-fast（快速失败）机制**：这是 Java 集合的一种**错误检测机制**，不是并发控制。一旦检测到集合结构被非法修改（迭代期间），立即抛异常而不是继续产生不可预期的结果。

> 【注意】fail-fast **不能保证一定触发**：如果恰好在最后一次 `next()` 后修改，`hasNext()` 返回 false 就直接退出循环，不会检查。所以**不能依赖它做并发保护**，并发场景必须用 `CopyOnWriteArrayList` 等。

#### ArrayList 的序列化

```java
// elementData 是 transient，ArrayList 自定义了序列化逻辑
private void writeObject(java.io.ObjectOutputStream s) throws IOException {
    int expectedModCount = modCount;
    s.defaultWriteObject();                  // 序列化非 transient 字段（size 等）
    s.writeInt(size);
    for (int i = 0; i < size; i++) {
        s.writeObject(elementData[i]);       // ★ 只序列化有效元素，不序列化空槽
    }
    if (modCount != expectedModCount) {
        throw new ConcurrentModificationException();
    }
}
```

#### 实战：ArrayList 性能陷阱

```java
// 陷阱 1：频繁在头部/中间插入 → O(n²)
List<Integer> list = new ArrayList<>();
for (int i = 0; i < 100000; i++) {
    list.add(0, i);          // 每次都要移动所有元素！总体 O(n²)，极慢
}
// 改用 LinkedList 或 ArrayDeque（addFirst 是 O(1)）

// 陷阱 2：contains 在循环中 → O(n²)
List<String> list = ...;   // 10 万元素
for (String s : otherList) {
    if (list.contains(s)) { ... }      // 每次 O(n)，总体 O(n*m)
}
// ✅ 先转 HashSet，contains 变 O(1)
Set<String> set = new HashSet<>(list);
for (String s : otherList) {
    if (set.contains(s)) { ... }       // O(m)
}

// 陷阱 3：remove(Object) 在循环中 → O(n²)
for (String s : toRemove) {
    list.remove(s);          // 每次 O(n)
}
// ✅ 用 removeAll（内部对 ArrayList 有优化）或先转 Set
list.removeAll(new HashSet<>(toRemove));

// 陷阱 4：subList 的坑
List<Integer> big = new ArrayList<>(Arrays.asList(1,2,3,4,5));
List<Integer> sub = big.subList(1, 3);    // ★ 返回的是视图（view），不是新集合！
sub.add(99);                               // big 也被修改了！
big.add(100);                              // ❌ 之后访问 sub 抛 ConcurrentModificationException
// subList 底层是 SubList 内部类，持有父 list 引用和 offset
// 若只是想拷贝一段：new ArrayList<>(big.subList(1, 3))
```

### 2.2 LinkedList

#### 底层结构：双向链表

```java
public class LinkedList<E> extends AbstractSequentialList<E>
        implements List<E>, Deque<E>, Cloneable, java.io.Serializable {

    transient int size = 0;
    transient Node<E> first;        // 头节点
    transient Node<E> last;         // 尾节点

    // 节点定义：三个字段
    private static class Node<E> {
        E item;             // 数据
        Node<E> next;       // 后继指针
        Node<E> prev;       // 前驱指针
        Node(Node<E> prev, E element, Node<E> next) {
            this.item = element;
            this.next = next;
            this.prev = prev;
        }
    }
}
```

**内存结构：**

```
      first                                     last
        ↓                                        ↓
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │prev=null│←───│prev     │←───│prev     │
   │ item=A  │    │ item=B  │    │ item=C  │
   │next ────┼───→│next ────┼───→│next=null│
   └─────────┘    └─────────┘    └─────────┘
   
每个 Node 是堆中独立对象，通过指针连接（不连续内存）
```

**注意：LinkedList 没有扩容机制**（链表不需要连续内存），也没有默认容量概念。

#### 核心操作实现

```java
// 头插 O(1)
private void linkFirst(E e) {
    final Node<E> f = first;
    final Node<E> newNode = new Node<>(null, e, f);
    first = newNode;
    if (f == null) last = newNode;
    else f.prev = newNode;
    size++;
    modCount++;
}

// 尾插 O(1)
void linkLast(E e) {
    final Node<E> l = last;
    final Node<E> newNode = new Node<>(l, e, null);
    last = newNode;
    if (l == null) first = newNode;
    else l.next = newNode;
    size++;
    modCount++;
}

// 指定位置插入 O(n)（需要先找到位置）
void linkBefore(E e, Node<E> succ) {
    final Node<E> pred = succ.prev;
    final Node<E> newNode = new Node<>(pred, e, succ);
    succ.prev = newNode;
    if (pred == null) first = newNode;
    else pred.next = newNode;
    size++;
    modCount++;
}

// get(index) O(n)：从头或从尾遍历（有个小优化）
public E get(int index) {
    checkElementIndex(index);
    return node(index).item;
}

Node<E> node(int index) {
    // ★ 优化：index 在前半段从头找，后半段从尾找（平均 n/4 而非 n/2）
    if (index < (size >> 1)) {
        Node<E> x = first;
        for (int i = 0; i < index; i++) x = x.next;
        return x;
    } else {
        Node<E> x = last;
        for (int i = size - 1; i > index; i--) x = x.prev;
        return x;
    }
}
```

#### ArrayList vs LinkedList 全面对比 ★★★★★

| 对比项 | ArrayList | LinkedList |
| --- | --- | --- |
| 底层结构 | 动态数组（连续内存） | 双向链表（分散内存） |
| 随机访问 `get(i)` | **O(1)** ✅ | O(n)（遍历指针） |
| 尾部增删 | O(1) 均摊 | **O(1)** |
| 头部增删 | **O(n)**（移动所有元素） | **O(1)** ✅ |
| 中间增删 | O(n)（移动 + 查找） | O(n)（查找）+ O(1)（改指针） |
| 内存占用 | 紧凑（数组 + 少量空槽） | **每个节点多 2 个指针（24 字节对象头 + 8 + 8）** |
| CPU 缓存 | **友好**（连续内存，预取有效） | 不友好（内存跳跃访问，cache miss 多） |
| 扩容 | 1.5 倍扩容 + 数组拷贝 | 无需扩容 |
| 实现接口 | `List`、`RandomAccess` | `List`、**`Deque`** |
| 线程安全 | 都不安全 | 都不安全 |
| 序列化 | 自定义（只存有效元素） | 逐个节点序列化 |
| 适用场景 | **99% 的业务场景** | 需要 Deque 语义、频繁头尾操作 |

**【面试】真实基准测试数据（颠覆认知）：**

很多教程说「LinkedList 插入删除快」，**实际测试并非如此**：

```java
// 测试：10 万元素，在中间位置插入
// ArrayList.add(50000, x)：约 0.5 ms（一次 arraycopy）
// LinkedList.add(50000, x)：约 1.5 ms（先遍历 5 万个节点找到位置）

// 测试：顺序遍历 100 万元素
// ArrayList：约 1 ms（CPU 缓存命中率高）
// LinkedList：约 10 ms（每个节点都是 cache miss）

// 测试：内存占用 100 万个 Integer
// ArrayList：约 4 MB（数组 4MB + 包装对象）
// LinkedList：约 32 MB（每节点额外 24 字节对象头 + 16 字节指针）
```

**结论（来自 JDK 作者和《Effective Java》）：**
1. **LinkedList 的插入优势只在「已经持有节点引用」时才成立**（如用 `ListIterator` 遍历中插入），而 `add(index, e)` 仍需 O(n) 查找。
2. **CPU 缓存不友好**是 LinkedList 的致命弱点：现代 CPU 从内存读数据是按缓存行（64 字节）批量预取的，数组连续存储能极大提升命中率，链表节点分散在堆中导致大量 cache miss。
3. **实践中几乎总是选 ArrayList**。Josh Bloch（Java 集合框架设计者）本人说：「**I use LinkedList rarely; ArrayList is almost always faster.**」
4. 需要队列/栈语义时用 **`ArrayDeque`**（循环数组，比 LinkedList 更快、更省内存）。

#### LinkedList 作为 Deque 使用

```java
LinkedList<String> deque = new LinkedList<>();

// 双端队列操作（每对方法：抛异常版 / 返回特殊值版）
deque.addFirst("a");      // 头插，满则抛异常      deque.offerFirst("a");  // 返回 boolean
deque.addLast("b");       // 尾插                  deque.offerLast("b");
deque.removeFirst();      // 头删，空则抛异常      deque.pollFirst();      // 返回 null
deque.removeLast();       // 尾删                  deque.pollLast();
deque.getFirst();         // 看头，空则抛异常      deque.peekFirst();      // 返回 null
deque.getLast();          // 看尾                  deque.peekLast();

// 当栈用（LIFO）—— 优于过时的 Stack 类
deque.push("a");          // = addFirst
deque.pop();              // = removeFirst
deque.peek();             // = peekFirst

// 当队列用（FIFO）
deque.offer("a");         // = offerLast
deque.poll();             // = pollFirst

// 【强制】阿里手册：栈用 ArrayDeque，不要用 Stack（Stack 继承 Vector，全方法 synchronized，性能差且暴露了 get(index) 破坏 LIFO 语义）
```

### 2.3 Vector 与 CopyOnWriteArrayList

#### Vector（过时，仅作了解）

```java
public class Vector<E> extends AbstractList<E> implements List<E>, RandomAccess, Cloneable, Serializable {
    protected Object[] elementData;
    protected int elementCount;
    protected int capacityIncrement;      // 扩容增量（可指定）

    // 几乎所有方法都加了 synchronized
    public synchronized boolean add(E e) {
        modCount++;
        ensureCapacityHelper(elementCount + 1);
        elementData[elementCount++] = e;
        return true;
    }
    public synchronized E get(int index) { ... }

    // 扩容：指定了 capacityIncrement 就加这个值，否则翻倍（2 倍）
    private void grow(int minCapacity) {
        int oldCapacity = elementData.length;
        int newCapacity = oldCapacity + ((capacityIncrement > 0) ? capacityIncrement : oldCapacity);
        // ★ 2 倍扩容（ArrayList 是 1.5 倍）
    }
}
```

**Vector vs ArrayList：**

| 对比 | Vector | ArrayList |
| --- | --- | --- |
| 线程安全 | ✅ synchronized | ❌ |
| 扩容倍数 | **2 倍**（或指定增量） | **1.5 倍** |
| 初始容量 | 10（构造时立即分配） | 0（首次 add 时分配 10） |
| 性能 | 差（每个方法都加锁） | 好 |
| 现状 | **过时，不推荐** | 主流 |

> **Vector 的「线程安全」是假的**：单个方法安全，但**复合操作不安全**。
> ```java
> Vector&lt;Integer&gt; v = new Vector<>();
> // 线程不安全的复合操作
> if (v.size() > 0) &#123;                    // 检查
>     v.remove(v.size() - 1);            // 执行 —— 两步之间可能被其他线程修改！
> &#125;
> // 正确做法：外部加锁
> synchronized (v) &#123;
>     if (v.size() > 0) v.remove(v.size() - 0);
> &#125;
> ```

#### CopyOnWriteArrayList（并发场景推荐）★

**「写时复制」（Copy-On-Write）思想**：读操作无锁，写操作时复制一份新数组修改，改完替换引用。

```java
public class CopyOnWriteArrayList<E> implements List<E>, RandomAccess, Cloneable, Serializable {

    final transient ReentrantLock lock = new ReentrantLock();   // 写操作用锁
    private transient volatile Object[] array;                   // ★ volatile：保证可见性

    // 读操作：无锁！直接读数组
    public E get(int index) {
        return elementAt(getArray(), index);
    }

    // 写操作：加锁 + 复制整个数组
    public boolean add(E e) {
        final ReentrantLock lock = this.lock;
        lock.lock();                             // 1. 加锁（只有一个线程能写）
        try {
            Object[] elements = getArray();
            int len = elements.length;
            Object[] newElements = Arrays.copyOf(elements, len + 1);   // 2. ★ 复制新数组（长度 +1）
            newElements[len] = e;                                       // 3. 修改新数组
            setArray(newElements);                                      // 4. ★ 替换引用（volatile 写，立即可见）
            return true;
        } finally {
            lock.unlock();
        }
    }

    // 迭代器：基于创建时的数组快照，永不抛 ConcurrentModificationException
    public Iterator<E> iterator() {
        return new COWIterator<E>(getArray(), 0);   // ★ 快照
    }
}
```

**CopyOnWriteArrayList 的优缺点：**

| 优点 | 缺点 |
| --- | --- |
| **读操作完全无锁**，性能极高 | **写操作开销大**：每次都要复制整个数组 O(n) |
| **迭代时不会抛 ConcurrentModificationException** | **内存占用翻倍**：写时同时存在新旧两个数组 |
| 迭代器基于快照，读写并发安全 | **数据弱一致性**：迭代器读到的是快照，可能不是最新数据 |
| 适合读多写极少的场景 | 不适合写频繁、数据量大的场景 |

```java
// 适用场景：监听器列表、白名单/黑名单、配置列表（启动时写，运行时只读）
private final List<EventListener> listeners = new CopyOnWriteArrayList<>();

public void register(EventListener l) { listeners.add(l); }        // 偶发写
public void fireEvent(Event e) {
    for (EventListener l : listeners) { l.onEvent(e); }            // 高频读，无锁安全
}

// ❌ 不适用：日志队列、高频写入的缓存列表（内存和性能都扛不住）
```

> 【弱一致性】`size()`、`contains()` 等读操作可能读到旧数据（写线程还没替换引用）。这是「以一致性换性能」的取舍。如果需要强一致，用 `Collections.synchronizedList` 或手动加锁。

### 2.4 List 的其他实现与工具

```java
// Arrays$ArrayList（Arrays.asList 返回的，固定长度）
List<String> fixed = Arrays.asList("a", "b");        // 不能 add/remove，能 set

// 不可变 List（三种）
List<String> immutable1 = Collections.unmodifiableList(new ArrayList<>(...));  // 视图，原集合变它也变
List<String> immutable2 = List.of("a", "b");                    // JDK 9+，真不可变，不允许 null
List<String> immutable3 = ImmutableList.of("a", "b");           // Guava

// 同步包装（所有方法加锁，性能一般）
List<String> sync = Collections.synchronizedList(new ArrayList<>());
// 迭代时仍需手动加锁！
synchronized (sync) {
    for (String s : sync) { ... }
}

// 空 List（避免返回 null）
List<String> empty = Collections.emptyList();

// 单元素 List
List<String> single = Collections.singletonList("only");

// 重复元素 List（JDK 9+）
List<String> nCopies = Collections.nCopies(5, "x");   // ["x","x","x","x","x"]（不可变）

// 排序
list.sort(Comparator.comparing(User::getAge));                 // List 默认方法（JDK 8+）
list.sort(Comparator.comparing(User::getAge).reversed());      // 降序
list.sort(Comparator.comparing(User::getName)
                    .thenComparing(User::getAge));             // 多字段
Collections.sort(list);                                        // 传统方式
Collections.reverse(list);                                     // 反转
Collections.shuffle(list);                                     // 打乱
Collections.swap(list, 0, 1);                                  // 交换
Collections.rotate(list, 2);                                   // 轮转
Collections.fill(list, "x");                                   // 填充
```

## 3. Set 详解

### 3.1 HashSet ★★★★★

**HashSet 的底层就是 HashMap**（value 是一个共享的常量 Object）。

```java
public class HashSet<E> extends AbstractSet<E> implements Set<E>, Cloneable, Serializable {

    private transient HashMap<E, Object> map;              // ★ 底层就是 HashMap
    private static final Object PRESENT = new Object();    // ★ 所有 value 共享这个哑对象

    public HashSet() {
        map = new HashMap<>();
    }
    // 指定初始容量和负载因子
    public HashSet(int initialCapacity, float loadFactor) {
        map = new HashMap<>(initialCapacity, loadFactor);
    }

    public boolean add(E e) {
        return map.put(e, PRESENT) == null;      // ★ key = 元素，value = PRESENT
    }

    public boolean contains(Object o) {
        return map.containsKey(o);
    }

    public boolean remove(Object o) {
        return map.remove(o) == PRESENT;
    }

    public int size() { return map.size(); }
    public Iterator<E> iterator() { return map.keySet().iterator(); }
}
```

> 【面试】**HashSet 如何保证元素不重复？**
>
> 完全依赖 `HashMap.put` 的逻辑：
> 1. 计算元素的 `hashCode()`，通过扰动函数定位桶下标。
> 2. 如果桶为空，直接放入。
> 3. 如果桶不为空，遍历链表/红黑树，对每个节点先用 `==` 比较引用，再用 `equals()` 比较内容。
> 4. **hash 相同且 equals 为 true → 认为是同一元素 → 覆盖 value，add 返回 false**。
> 5. hash 相同但 equals 为 false → 哈希冲突，追加到链表。
>
> 所以：**必须同时正确重写 `equals()` 和 `hashCode()`**，否则重复元素会被当作不同元素存进去。

```java
// 经典错误：只重写 equals 不重写 hashCode
class BadUser {
    String name;
    @Override public boolean equals(Object o) {
        return o instanceof BadUser && Objects.equals(name, ((BadUser)o).name);
    }
    // 没重写 hashCode → 用 Object 的地址哈希
}
Set<BadUser> set = new HashSet<>();
set.add(new BadUser("Tom"));
set.add(new BadUser("Tom"));
System.out.println(set.size());    // 2！应该去重却存了 2 个
// 因为两个对象 hashCode 不同 → 落到不同桶 → 不会调 equals 比较
```

#### HashSet 的特性

| 特性 | 说明 |
| --- | --- |
| 有序性 | **无序**（遍历顺序不等于插入顺序，且可能随扩容变化） |
| 重复性 | 不允许重复元素 |
| null | **允许一个 null**（HashMap 允许 null key） |
| 线程安全 | ❌ 不安全 |
| 时间复杂度 | add/remove/contains 都是 **O(1)**（哈希定位） |
| 初始容量 | 16（HashMap 默认） |
| 负载因子 | 0.75 |

```java
Set<String> set = new HashSet<>();
set.add("c"); set.add("a"); set.add("b"); set.add(null); set.add("a");
System.out.println(set);          // [null, a, b, c]  ← 顺序不保证！可能是任意顺序
System.out.println(set.size());   // 4（重复的 "a" 只存一个）
```

> 【坑】HashSet 的**遍历顺序是不确定的**，且**同一批数据在不同 JDK 版本/不同容量下顺序可能不同**（因为扩容会 rehash）。**绝对不能依赖 HashSet 的顺序**！需要顺序用 LinkedHashSet 或 TreeSet。

### 3.2 LinkedHashSet

**底层是 LinkedHashMap**（HashMap + 贯穿所有条目的双向链表），**保持插入顺序**。

```java
public class LinkedHashSet<E> extends HashSet<E> {
    public LinkedHashSet() {
        super(16, 0.75f);           // 实际调用的是 HashSet 的包私有构造器
    }
    // HashSet 的特殊构造器（包级私有）
    HashSet(int initialCapacity, float loadFactor, boolean dummy) {
        map = new LinkedHashMap<>(initialCapacity, loadFactor);   // ★ 用 LinkedHashMap
    }
}

// LinkedHashMap 的 Entry 多了 before/after 指针，串成双向链表
static class Entry<K,V> extends HashMap.Node<K,V> {
    Entry<K,V> before, after;       // ★ 维护插入顺序的双向链表
}
```

```java
Set<String> set = new LinkedHashSet<>();
set.add("c"); set.add("a"); set.add("b"); set.add("a");
System.out.println(set);          // [c, a, b] ← 严格保持插入顺序！
```

| 特性 | LinkedHashSet |
| --- | --- |
| 有序性 | **插入顺序** |
| 时间复杂度 | O(1)（比 HashSet 略慢，要维护链表指针） |
| 内存 | 比 HashSet 多（每条目 2 个额外指针） |
| 适用 | 需要去重 + 保持顺序（如缓存、日志去重） |

### 3.3 TreeSet

**底层是 TreeMap（红黑树）**，元素**自动排序**。

```java
public class TreeSet<E> extends AbstractSet<E> implements NavigableSet<E> {
    private transient NavigableMap<E,Object> m;      // ★ TreeMap
    private static final Object PRESENT = new Object();

    public TreeSet() {
        m = new TreeMap<>();                          // 自然排序（元素需实现 Comparable）
    }
    public TreeSet(Comparator<? super E> comparator) {
        m = new TreeMap<>(comparator);                // 自定义排序
    }
}
```

**两种排序方式：**

```java
// 方式 1：自然排序（元素类实现 Comparable）
class User implements Comparable<User> {
    String name;
    int age;
    @Override
    public int compareTo(User other) {
        return Integer.compare(this.age, other.age);      // 按年龄升序
        // return this.name.compareTo(other.name);        // 按名字字典序
    }
}
Set<User> set = new TreeSet<>();
set.add(new User("Tom", 30));
set.add(new User("Jerry", 20));
System.out.println(set);        // [User{Jerry,20}, User{Tom,30}] 按年龄排序

// 方式 2：定制排序（传入 Comparator，优先级高于 Comparable）
Set<User> set2 = new TreeSet<>(Comparator.comparing(User::getName));
set2.add(new User("Tom", 30));
set2.add(new User("Jerry", 20));
System.out.println(set2);       // [User{Jerry,20}, User{Tom,30}] 按名字排序

// 多字段排序
Set<User> set3 = new TreeSet<>(
    Comparator.comparing(User::getAge).thenComparing(User::getName));
```

**【坑】TreeSet 的「重复」判定与 HashSet 完全不同！**

```java
// TreeSet 判断元素是否重复，用的是 compareTo()/compare() 返回 0，不是 equals()！
Set<User> set = new TreeSet<>(Comparator.comparingInt(User::getAge));
set.add(new User("Tom", 20));
set.add(new User("Jerry", 20));        // 年龄相同 → compare 返回 0 → 被认为是「重复」！
System.out.println(set.size());        // 1！Jerry 没进去

// 后果：如果 Comparator 只比较部分字段，会丢失数据
// ✅ 正确做法：Comparator 要比较所有影响「相等」的字段
Comparator.comparingInt(User::getAge).thenComparing(User::getName)
```

> 【强制】**TreeSet/TreeMap 中，`compareTo`/`compare` 的结果必须与 `equals` 保持一致**（即 `a.compareTo(b) == 0` ⟺ `a.equals(b)`）。否则集合的行为会「违反 Set 契约」，出现诡异的数据丢失。这是 `Comparable` 接口的官方文档明确要求的。

**TreeSet 特有 API（NavigableSet）：**

```java
TreeSet<Integer> set = new TreeSet<>(Arrays.asList(1, 3, 5, 7, 9));

set.first();                    // 1（最小）
set.last();                     // 9（最大）
set.floor(6);                   // 5（≤ 6 的最大元素）
set.ceiling(6);                 // 7（≥ 6 的最小元素）
set.lower(5);                   // 3（< 5 的最大元素）
set.higher(5);                  // 7（> 5 的最小元素）
set.pollFirst();                // 1（取出并删除最小）
set.pollLast();                 // 9
set.headSet(5);                 // [1, 3]（< 5 的子集视图）
set.tailSet(5);                 // [5, 7, 9]（≥ 5）
set.subSet(3, 7);               // [3, 5]（[3, 7) 区间）
set.descendingSet();            // [9,7,5,3,1]（降序视图）
set.descendingIterator();       // 降序迭代器
```

| Set 实现 | 底层 | 顺序 | add/remove/contains | null | 使用场景 |
| --- | --- | --- | --- | --- | --- |
| `HashSet` | HashMap | 无序 | **O(1)** | 允许 1 个 | **默认选择** |
| `LinkedHashSet` | LinkedHashMap | **插入顺序** | O(1) | 允许 1 个 | 需保持顺序的去重 |
| `TreeSet` | TreeMap（红黑树） | **排序** | **O(log n)** | **不允许** | 需排序、范围查询 |
| `CopyOnWriteArraySet` | CopyOnWriteArrayList | 插入顺序 | O(n) | 允许 | 读多写极少的并发 |
| `ConcurrentSkipListSet` | ConcurrentSkipListMap | 排序 | O(log n) | 不允许 | 并发 + 排序 |

### 3.4 Set 的实战应用

```java
// 应用 1：列表去重
List<Integer> list = Arrays.asList(1, 2, 2, 3, 3, 3);
List<Integer> distinct = new ArrayList<>(new LinkedHashSet<>(list));    // 保持顺序去重
// 或 JDK 8
List<Integer> distinct2 = list.stream().distinct().collect(Collectors.toList());

// 应用 2：O(1) 判断存在（替代 List.contains 的 O(n)）
Set<String> allowedStatus = Set.of("PAID", "SHIPPED", "COMPLETED");
if (allowedStatus.contains(order.getStatus())) { ... }      // O(1)

// 应用 3：集合运算（交集、并集、差集）
Set<String> setA = new HashSet<>(Arrays.asList("a", "b", "c"));
Set<String> setB = new HashSet<>(Arrays.asList("b", "c", "d"));

Set<String> union = new HashSet<>(setA);
union.addAll(setB);                                    // 并集 [a,b,c,d]

Set<String> intersection = new HashSet<>(setA);
intersection.retainAll(setB);                          // 交集 [b,c]

Set<String> difference = new HashSet<>(setA);
difference.removeAll(setB);                            // 差集 A-B [a]

Set<String> symmetricDiff = new HashSet<>(setA);
symmetricDiff.addAll(setB);
Set<String> tmp = new HashSet<>(setA);
tmp.retainAll(setB);
symmetricDiff.removeAll(tmp);                          // 对称差集 [a,d]

// 应用 4：权限/标签的位集合替代（小集合用 EnumSet 更快）
EnumSet<OrderStatus> cancellable = EnumSet.of(OrderStatus.PENDING, OrderStatus.PAID);
if (cancellable.contains(status)) { ... }
// EnumSet 底层是位向量（long），性能远超 HashSet

// 应用 5：检测循环依赖（拓扑排序）
Set<String> visited = new HashSet<>();
Set<String> inStack = new HashSet<>();    // 检测环

// 应用 6：布隆过滤器前置去重（海量数据）
Set<Long> processedIds = new HashSet<>();    // 小量可以，海量要用 BloomFilter
```

## 4. Queue 与 Deque

### 4.1 Queue 接口

```java
public interface Queue<E> extends Collection<E> {
    boolean add(E e);        // 插入，失败抛 IllegalStateException
    boolean offer(E e);      // 插入，失败返回 false（推荐，容量受限时）
    E remove();              // 移除并返回头，空则抛 NoSuchElementException
    E poll();                // 移除并返回头，空则返回 null（推荐）
    E element();             // 查看头，空则抛异常
    E peek();                // 查看头，空则返回 null（推荐）
}
```

**六方法的对照（记这个表就够了）：**

| 操作 | 抛异常版 | 返回特殊值版（推荐） | 特殊值 |
| --- | --- | --- | --- |
| 插入 | `add(e)` | `offer(e)` | false |
| 移除 | `remove()` | `poll()` | null |
| 检查 | `element()` | `peek()` | null |

> 【规范】**优先用 offer/poll/peek**，避免异常控制流程。空队列时 `remove()` 抛异常，`poll()` 返回 null。

### 4.2 PriorityQueue（优先队列 / 二叉堆）

```java
// 底层：数组实现的二叉堆（默认小顶堆）
public class PriorityQueue<E> extends AbstractQueue<E> {
    transient Object[] queue;      // 堆数组
    private int size;
    private final Comparator<? super E> comparator;

    // 堆的性质：queue[parent] <= queue[child]
    // parent(i) = (i-1)/2,  left(i) = 2i+1,  right(i) = 2i+2
}

// 默认小顶堆（自然排序，最小值在堆顶）
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(5); pq.offer(1); pq.offer(3);
System.out.println(pq.poll());     // 1（最小的先出）
System.out.println(pq.poll());     // 3
System.out.println(pq.poll());     // 5
// ⚠️ 注意：pq 的 toString/iterator 不是有序的！只有 poll 才按序

// 大顶堆
PriorityQueue<Integer> maxPq = new PriorityQueue<>(Comparator.reverseOrder());
maxPq.offer(5); maxPq.offer(1); maxPq.offer(3);
maxPq.poll();      // 5

// 自定义排序
PriorityQueue<Task> taskQueue = new PriorityQueue<>(Comparator.comparingInt(Task::getPriority));

// 时间复杂度
// offer / add：O(log n)（上浮 siftUp）
// poll / remove：O(log n)（下沉 siftDown）
// peek：O(1)
// remove(Object)：O(n)（要先找位置）
```

**PriorityQueue 的实战应用：**

```java
// 应用 1：Top K 问题（求最大的 K 个元素 → 用小顶堆）
public static int[] topK(int[] nums, int k) {
    PriorityQueue<Integer> minHeap = new PriorityQueue<>(k);   // 小顶堆，容量 k
    for (int n : nums) {
        if (minHeap.size() < k) {
            minHeap.offer(n);
        } else if (n > minHeap.peek()) {        // 比堆顶大才替换
            minHeap.poll();
            minHeap.offer(n);
        }
    }
    return minHeap.stream().mapToInt(Integer::intValue).toArray();
}
// 时间 O(n log k)，空间 O(k)。若用全排序是 O(n log n)

// 应用 2：合并 K 个有序链表
PriorityQueue<ListNode> pq = new PriorityQueue<>(Comparator.comparingInt(n -> n.val));
for (ListNode head : lists) if (head != null) pq.offer(head);
while (!pq.isEmpty()) {
    ListNode node = pq.poll();
    tail.next = node;
    tail = node;
    if (node.next != null) pq.offer(node.next);
}

// 应用 3：延迟任务队列（ScheduledThreadPoolExecutor 内部用 DelayedWorkQueue，基于堆）
// 应用 4：中位数（对顶堆：大顶堆 + 小顶堆）
// 应用 5：Dijkstra 最短路径
```

> 【坑】**PriorityQueue 不允许 null 元素**（会 NPE，因为要调 compareTo）；**不是线程安全的**，并发用 `PriorityBlockingQueue`；**迭代顺序不是排序顺序**（只有 poll 才有序）。

### 4.3 ArrayDeque（循环数组双端队列）

```java
// 底层：循环数组（head/tail 指针，取模实现「循环」）
public class ArrayDeque<E> implements Deque<E> {
    transient Object[] elements;
    transient int head;      // 头元素索引
    transient int tail;      // 下一个可插入位置的索引

    // 扩容：2 倍（且必须是 2 的幂，用位运算代替取模：index & (length-1)）
    private void grow(int neededSpace) {
        int oldCapacity = elements.length;
        int newCapacity = oldCapacity + ((neededSpace < 0) ? oldCapacity >> 1 : oldCapacity);
        // ...
    }
}
```

**ArrayDeque vs LinkedList vs Stack：**

| 操作 | ArrayDeque | LinkedList | Stack（Vector） |
| --- | --- | --- | --- |
| 头插 `addFirst` | O(1) | O(1) | O(n) |
| 尾插 `addLast` | **O(1) 均摊** | O(1) | O(1) |
| 头删 `pollFirst` | O(1) | O(1) | O(n) |
| `push`/`pop` | O(1) | O(1) | O(1) 但加锁 |
| `get(i)` | O(1) | O(n) | O(1) |
| 内存 | 紧凑 | 每节点 2 指针 | 紧凑但同步开销 |
| 缓存友好 | ✅ | ❌ | ✅ |
| 线程安全 | ❌ | ❌ | ✅（但假安全） |
| 允许 null | ❌ | ✅ | ✅ |

> 【强制】**栈和队列都用 `ArrayDeque`**，性能全面优于 `Stack` 和 `LinkedList`。JDK 文档明确说明：「This class is likely to be faster than Stack when used as a stack, and faster than LinkedList when used as a queue.」

```java
// 用 ArrayDeque 实现栈
Deque<String> stack = new ArrayDeque<>();
stack.push("a");          // addFirst
stack.push("b");
stack.pop();              // removeFirst → "b"
stack.peek();             // "a"

// 用 ArrayDeque 实现队列
Deque<String> queue = new ArrayDeque<>();
queue.offer("a");         // offerLast
queue.offer("b");
queue.poll();             // pollFirst → "a"

// 实战：BFS 层序遍历
Deque<TreeNode> queue = new ArrayDeque<>();
queue.offer(root);
while (!queue.isEmpty()) {
    int levelSize = queue.size();
    for (int i = 0; i < levelSize; i++) {
        TreeNode node = queue.poll();
        if (node.left != null) queue.offer(node.left);
        if (node.right != null) queue.offer(node.right);
    }
}

// 实战：单调栈（求下一个更大元素）
Deque<Integer> stack = new ArrayDeque<>();
for (int i = 0; i < nums.length; i++) {
    while (!stack.isEmpty() && nums[i] > nums[stack.peek()]) {
        result[stack.pop()] = nums[i];
    }
    stack.push(i);
}
```

### 4.4 阻塞队列（BlockingQueue）★ 线程池的核心

**阻塞队列是生产者-消费者模型的标准实现**，也是 `ThreadPoolExecutor` 的任务队列。

| 实现类 | 底层 | 有界 | 特点 |
| --- | --- | --- | --- |
| `ArrayBlockingQueue` | 数组 | **有界**（必须指定容量） | 一把锁（ReentrantLock），FIFO，支持公平模式 |
| `LinkedBlockingQueue` | 链表 | 可选有界（默认 `Integer.MAX_VALUE`） | **两把锁**（takeLock/putLock），吞吐量更高 |
| `PriorityBlockingQueue` | 二叉堆 | 无界 | 按优先级出队 |
| `DelayQueue` | PriorityQueue | 无界 | 元素到期才能取出（定时任务） |
| `SynchronousQueue` | 无容量 | 0 容量 | 每个 put 必须等一个 take（直接交付），`Executors.newCachedThreadPool` 用它 |
| `LinkedTransferQueue` | 链表 | 无界 | 支持 transfer（等待消费者接收） |
| `LinkedBlockingDeque` | 双向链表 | 有界 | 双端阻塞 |

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

// 四组 API（关键区别在于「队列满/空时的行为」）
queue.add(task);        // 满则抛 IllegalStateException
queue.offer(task);      // 满则返回 false
queue.put(task);        // ★ 满则阻塞等待（生产者常用）
queue.offer(task, 3, TimeUnit.SECONDS);   // 满则最多等 3 秒，超时返回 false

queue.remove();         // 空则抛 NoSuchElementException
queue.poll();           // 空则返回 null
queue.take();           // ★ 空则阻塞等待（消费者常用）
queue.poll(3, TimeUnit.SECONDS);          // 空则最多等 3 秒

queue.element();        // 空则抛异常
queue.peek();           // 空则返回 null

// 其他
queue.size();           // 当前元素数
queue.remainingCapacity();  // 剩余容量
queue.drainTo(list);    // 批量取出到 list（性能优于循环 poll）
queue.drainTo(list, 10);// 最多取 10 个
```

**生产者-消费者模型（手写）：**

```java
public class ProducerConsumerDemo {
    private static final BlockingQueue<String> queue = new ArrayBlockingQueue<>(10);

    // 生产者
    static class Producer implements Runnable {
        public void run() {
            try {
                while (true) {
                    String data = produce();
                    queue.put(data);            // ★ 队列满则阻塞，天然背压（back-pressure）
                    System.out.println(Thread.currentThread().getName() + " 生产：" + data);
                    Thread.sleep(100);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        private String produce() { return "data-" + System.nanoTime(); }
    }

    // 消费者
    static class Consumer implements Runnable {
        public void run() {
            try {
                while (true) {
                    String data = queue.take();  // ★ 队列空则阻塞，无需轮询
                    consume(data);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        private void consume(String data) {
            System.out.println(Thread.currentThread().getName() + " 消费：" + data);
        }
    }

    public static void main(String[] args) {
        ExecutorService pool = Executors.newFixedThreadPool(5);
        pool.submit(new Producer());
        pool.submit(new Consumer());
        pool.submit(new Consumer());
    }
}
```

> 【坑】**`Executors.newFixedThreadPool` 用的 `LinkedBlockingQueue` 是无界的**（容量 `Integer.MAX_VALUE`），任务堆积会导致 **OOM**！这是阿里手册禁止用 `Executors` 创建线程池的核心原因。详见 [[后端/Java基础/并发编程/线程池原理与实战]]。

## 5. fail-fast 与 fail-safe

| 机制 | 代表集合 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| **fail-fast** | ArrayList、HashMap、HashSet 等所有 `java.util` 集合 | 迭代器记录 `expectedModCount`，与 `modCount` 不一致就抛 `ConcurrentModificationException` | 尽早暴露 bug | 不是并发保护，可能不触发 |
| **fail-safe**（弱一致性） | `java.util.concurrent` 的 CopyOnWriteArrayList、ConcurrentHashMap | 迭代基于**快照**或**弱一致性视图**，不检查 modCount | 并发安全，不抛异常 | 可能读到旧数据 |

```java
// fail-fast 演示（单线程也会触发！）
List<String> list = new ArrayList<>(Arrays.asList("a", "b", "c"));
for (String s : list) {
    if (s.equals("b")) list.remove(s);      // ❌ ConcurrentModificationException
}
// 注意：这不是多线程问题，单线程迭代中修改结构就会触发

// fail-safe 演示（并发安全）
List<String> cow = new CopyOnWriteArrayList<>(Arrays.asList("a", "b", "c"));
for (String s : cow) {
    cow.remove(s);                          // ✅ 不抛异常（迭代的是快照）
}

// ConcurrentHashMap 的迭代器也是弱一致性的
ConcurrentHashMap<String, Integer> map = new ConcurrentHashMap<>();
for (Map.Entry<String, Integer> e : map.entrySet()) {
    map.put("new", 1);                      // ✅ 不抛异常，但迭代器可能看不到新元素
}
```

## 6. 集合的遍历方式对比

```java
List<String> list = new ArrayList<>(Arrays.asList("a", "b", "c"));

// 1. 普通 for（只有 List 能用，可修改元素，可拿索引）
for (int i = 0; i < list.size(); i++) {
    System.out.println(i + ":" + list.get(i));
}
// ⚠️ LinkedList 用这个是 O(n²)，必须先转 ArrayList 或用迭代器

// 2. 增强 for（通用，简洁，不能增删）
for (String s : list) {
    System.out.println(s);
}

// 3. Iterator（通用，可以安全删除）
Iterator<String> it = list.iterator();
while (it.hasNext()) {
    String s = it.next();
    if (s.equals("b")) it.remove();
}

// 4. ListIterator（List 专用，可双向遍历、可修改、可插入）
ListIterator<String> lit = list.listIterator();
while (lit.hasNext()) {
    String s = lit.next();
    lit.set(s.toUpperCase());       // 修改当前元素
    lit.add("new");                 // 插入
}
while (lit.hasPrevious()) {         // 反向遍历
    System.out.println(lit.previous());
}

// 5. forEach + Lambda（JDK 8+）
list.forEach(s -> System.out.println(s));
list.forEach(System.out::println);

// 6. Stream（JDK 8+，可链式处理、并行）
list.stream().filter(s -> s.startsWith("a")).forEach(System.out::println);
list.parallelStream().forEach(System.out::println);   // 并行（注意线程安全）

// 7. removeIf（JDK 8+，批量删除，性能最好）
list.removeIf(s -> s.startsWith("a"));

// Map 的遍历
Map<String, Integer> map = new HashMap<>();
// 方式 1：entrySet（推荐，一次遍历拿到 k 和 v）
for (Map.Entry<String, Integer> entry : map.entrySet()) {
    System.out.println(entry.getKey() + "=" + entry.getValue());
}
// 方式 2：keySet + get（❌ 慢，每次 get 都要哈希查找）
for (String key : map.keySet()) {
    System.out.println(key + "=" + map.get(key));
}
// 方式 3：forEach（JDK 8+，最简洁）
map.forEach((k, v) -> System.out.println(k + "=" + v));
// 方式 4：Stream
map.entrySet().stream()
   .filter(e -> e.getValue() > 10)
   .sorted(Map.Entry.comparingByValue())
   .forEach(e -> System.out.println(e.getKey()));
// 方式 5：values()（只要值）
for (Integer v : map.values()) { }
```

**遍历性能对比（100 万元素的 ArrayList）：**

| 方式 | 相对耗时 | 说明 |
| --- | --- | --- |
| 普通 for（索引） | **1.0x（最快）** | 无迭代器对象创建 |
| Iterator | 1.05x | 多一层方法调用（JIT 可内联） |
| 增强 for | 1.05x | 编译为 Iterator |
| `forEach` Lambda | 1.2x | Lambda 调用开销 |
| Stream（串行） | 1.8x | Stream 管道创建开销 |
| Stream（并行） | 视核数和任务量 | 小数据量反而更慢 |

> 【结论】**性能敏感的热路径用普通 for；业务代码用增强 for 或 Stream（可读性优先）**。不要为了微小的性能差异牺牲可读性。

## 7. Collections 工具类

```java
import java.util.Collections;

// 排序
Collections.sort(list);                                  // 自然排序（元素需 Comparable）
Collections.sort(list, Comparator.reverseOrder());       // 自定义排序
Collections.reverse(list);                               // 反转
Collections.shuffle(list);                               // 随机打乱（洗牌）
Collections.shuffle(list, new Random(42));               // 固定种子（可复现）
Collections.rotate(list, 3);                             // 轮转（后 3 个移到前面）
Collections.swap(list, 0, 1);                            // 交换两个位置

// 查找
Collections.binarySearch(sortedList, key);               // 二分查找（需已排序）
Collections.max(list);                                   // 最大值
Collections.min(list);
Collections.max(list, Comparator.comparing(User::getAge));
Collections.frequency(list, "a");                        // 统计出现次数
Collections.disjoint(listA, listB);                      // 是否无交集

// 填充与复制
Collections.fill(list, "x");                             // 全部填充
Collections.copy(dest, src);                             // 复制（dest 长度必须 ≥ src！）
Collections.replaceAll(list, "old", "new");              // 替换所有

// 包装（返回视图）
Collections.unmodifiableList(list);                      // 只读视图（修改抛 UnsupportedOperationException）
Collections.synchronizedList(list);                      // 同步包装（所有方法加锁）
Collections.emptyList();                                 // 不可变空 List
Collections.emptyMap();
Collections.emptySet();
Collections.singletonList("only");                       // 不可变单元素 List
Collections.singleton("only");                           // 不可变单元素 Set
Collections.singletonMap("k", "v");                      // 不可变单元素 Map
Collections.nCopies(5, "x");                             // 不可变重复 List

// 集合运算（通过方法实现）
listA.retainAll(listB);      // 交集（修改 listA）
listA.addAll(listB);         // 并集
listA.removeAll(listB);      // 差集
```

> 【坑】`Collections.synchronizedList` 返回的同步 List，**迭代时仍需手动加锁**：
> ```java
> List&lt;String&gt; sync = Collections.synchronizedList(new ArrayList<>());
> // ❌ 不安全
> for (String s : sync) &#123; &#125;     // 可能抛 ConcurrentModificationException
> // ✅ 正确
> synchronized (sync) &#123;
>     for (String s : sync) &#123; &#125;
> &#125;
> ```
> 因为迭代是**多次调用**的组合操作，同步包装只保证单个方法的原子性。

## 8. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `Arrays.asList` 返回固定长度 List | `add` 抛 `UnsupportedOperationException` | `new ArrayList<>(Arrays.asList(...))` |
| 2 | `Arrays.asList(int[])` 只有 1 个元素 | 泛型不支持基本类型 | `Arrays.stream().boxed()` |
| 3 | `subList` 是视图不是副本 | 修改互相影响、结构变化后访问抛异常 | `new ArrayList<>(subList)` |
| 4 | for-each 中 remove | `ConcurrentModificationException` | `removeIf` 或 `Iterator.remove` |
| 5 | 正向索引遍历中 remove | 漏删元素 | 倒序遍历或 `removeIf` |
| 6 | 只重写 equals 不重写 hashCode | HashSet 存了重复元素 | 必须同时重写 |
| 7 | TreeSet 的 compareTo 与 equals 不一致 | 数据莫名丢失 | compare 返回 0 应等价 equals |
| 8 | TreeSet 的 Comparator 只比部分字段 | 不同对象被判重复 | 比较所有关键字段 |
| 9 | 依赖 HashSet 的遍历顺序 | 顺序不稳定 | 用 LinkedHashSet / TreeSet |
| 10 | LinkedList 用索引遍历 | O(n²) 极慢 | 用迭代器或换 ArrayList |
| 11 | 以为 LinkedList 插入一定快 | 实测常比 ArrayList 慢 | 默认用 ArrayList |
| 12 | `ArrayList` 未指定初始容量 | 大量扩容拷贝 | `new ArrayList<>(expectedSize)` |
| 13 | `List.contains` 在循环中 | O(n²) | 先转 HashSet |
| 14 | `PriorityQueue` 迭代以为有序 | 顺序混乱 | 只有 poll 才有序 |
| 15 | `Executors.newFixedThreadPool` | 无界队列导致 OOM | 手动 `ThreadPoolExecutor` |
| 16 | `Collections.copy` dest 太短 | `IndexOutOfBoundsException` | dest 长度 ≥ src |
| 17 | 同步 List 迭代不加锁 | `ConcurrentModificationException` | `synchronized(list)&#123;&#125;` |
| 18 | Vector 的复合操作 | 线程不安全 | 外部加锁或换并发集合 |
| 19 | `Stack` 类的使用 | 性能差、语义漏洞 | 用 `ArrayDeque` |
| 20 | 不可变集合传 null | `List.of(null)` NPE | JDK 9 工厂方法不接受 null |

---

## 关联笔记

- 上一篇：[[后端/Java基础/常用类与API]]
- 下一篇：[[后端/Java基础/集合框架-Map与源码剖析]]（HashMap 源码深挖）
- 相关：[[后端/Java基础/并发编程/JUC工具类与ThreadLocal]]（并发集合）、[[后端/Java基础/Java8新特性-Lambda与Stream]]（集合处理）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
