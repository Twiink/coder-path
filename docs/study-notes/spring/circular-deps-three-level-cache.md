---
title: "循环依赖与三级缓存"
aliases:
  - "三级缓存"
  - "Spring 循环依赖"
tags:
  - "后端"
  - "java"
  - "spring"
  - "面试"
category: "后端"
folder: "Spring"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Spring/Bean生命周期与作用域]]"
  - "[[后端/Spring/Spring概述与IoC容器]]"
  - "[[后端/Spring/AOP面向切面编程]]"
  - "[[后端/Spring/动态代理-JDK与CGLIB]]"
created: 2026-09-07
updated: 2026-09-07
---

# 循环依赖与三级缓存

## 1. 什么是循环依赖

**循环依赖 = 两个或多个 Bean 互相持有对方，形成闭环，导致容器无法确定先创建谁。**

```java
// ─── 二元循环（最常见）───
@Service
public class A {
    @Autowired
    private B b;              // A 依赖 B
}
@Service
public class B {
    @Autowired
    private A a;              // B 依赖 A → 形成闭环
}
// 创建 A → 需要 B → 创建 B → 需要 A → 又回到创建 A → 死循环？

// ─── 三元循环 ───
A → B → C → A

// ─── 自依赖 ───
@Service
public class SelfRef {
    @Autowired
    private SelfRef self;      // ★ 自己依赖自己（Spring 4.3+ 支持，用于 AOP 自调用）
}
```

**依赖关系的三种形态与循环依赖的可解性（★ 核心结论）：**

| 注入方式 | 是否可解循环依赖 | 原因 |
| --- | --- | --- |
| **字段注入** `@Autowired private B b;` | ✅ **可以** | 先创建实例（构造器），再填充属性 → 可以提前暴露半成品 |
| **Setter 注入** `@Autowired public void setB(B b)` | ✅ **可以** | 同上 |
| **构造器注入** `public A(B b)` | ❌ **不可以** | ★ 实例化就需要 B，而 B 的实例化需要 A，无法提前暴露「还不存在的对象」 |
| **prototype 作用域** | ❌ **不可以** | prototype 不进缓存，无法提前暴露 |
| **`@Async` 代理的 Bean** | ⚠️ 可能报错 | 代理时机与三级缓存冲突 |

```java
// ─── 构造器循环依赖：直接启动失败 ───
@Service
public class A {
    private final B b;
    public A(B b) { this.b = b; }         // ★ 构造 A 必须先有 B
}
@Service
public class B {
    private final A a;
    public B(A a) { this.a = a; }         // ★ 构造 B 必须先有 A
}
// 报错：
// BeanCurrentlyInCreationException: Error creating bean with name 'a':
//   Requested bean is currently in creation: Is there an unresolvable circular reference?
```

## 2. 三级缓存的结构与作用 ★★★★★

```java
// DefaultSingletonBeanRegistry 中的三级缓存（Spring 的核心数据结构）
public class DefaultSingletonBeanRegistry extends SimpleAliasRegistry implements SingletonBeanRegistry {

    /** ★★ 一级缓存（单例池）：完全初始化好的成品 Bean */
    private final Map<String, Object> singletonObjects = new ConcurrentHashMap<>(256);

    /** ★★ 二级缓存：提前暴露的「半成品」Bean（已实例化，未填充属性/未初始化） */
    private final Map<String, Object> earlySingletonObjects = new ConcurrentHashMap<>(16);

    /** ★★ 三级缓存：ObjectFactory（★ Lambda 工厂，用于「需要时才生成」早期引用，含 AOP 代理判断） */
    private final Map<String, ObjectFactory<?>> singletonFactories = new HashMap<>(16);

    /** 正在创建中的 Bean 名称集合（★ 检测循环依赖的关键） */
    private final Set<String> singletonsCurrentlyInCreation =
            Collections.newSetFromMap(new ConcurrentHashMap<>(16));

    /** 已注册的单例（含创建失败的） */
    private final Set<String> registeredSingletons = ...;

    /** 依赖记录（谁依赖了谁，用于诊断） */
    private final Map<String, Set<String>> dependentBeanMap = ...;
}
```

**三级缓存的完整定义：**

| 级别 | 字段名 | 存什么 | 何时放入 | 何时移除 |
| --- | --- | --- | --- | --- |
| **一级** | `singletonObjects` | ★ **完整的成品 Bean**（可直接使用） | Bean 完全初始化后 | 容器关闭 |
| **二级** | `earlySingletonObjects` | ★ **早期引用**（半成品对象或其代理） | 三级缓存的 ObjectFactory 被调用后 | 升级到一级时 |
| **三级** | `singletonFactories` | ★ **ObjectFactory（Lambda）**，能生产早期引用 | **实例化后、属性填充前** | ObjectFactory 被调用后，或升级时 |

```java
// ObjectFactory 是函数式接口
@FunctionalInterface
public interface ObjectFactory<T> {
    T getObject() throws BeansException;
}

// 三级缓存中实际存的是这个 Lambda（在 doCreateBean 中）：
addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
//                                   ↑ ★ 关键：延迟决定返回「原始对象」还是「代理对象」
```

## 3. 循环依赖的完整解决流程 ★★★★★

### 3.1 源码流程（以 A 依赖 B、B 依赖 A 为例）

```java
// ─── AbstractBeanFactory.doGetBean() ───
protected <T> T doGetBean(String name, ...) {
    String beanName = transformedBeanName(name);

    // ★① 先从缓存中取（getSingleton 会查三级缓存）
    Object sharedInstance = getSingleton(beanName);
    if (sharedInstance != null && args == null) {
        return getObjectForBeanInstance(sharedInstance, name, beanName, mbd);
    }

    // ★② 检查是否正在创建中（循环依赖检测的入口）
    if (isPrototypeCurrentlyInCreation(beanName)) { throw new BeanCurrentlyInCreationException(...); }

    // ③ 处理父容器、依赖的 Bean（depends-on）
    ...

    // ④ 创建 Bean
    if (mbd.isSingleton()) {
        sharedInstance = getSingleton(beanName, () -> createBean(beanName, mbd, args));
        ...
    }
}

// ─── ★ getSingleton(String, ObjectFactory)：带「创建逻辑」的版本 ───
public Object getSingleton(String beanName, ObjectFactory<?> singletonFactory) {
    synchronized (this.singletonObjects) {
        Object singletonObject = this.singletonObjects.get(beanName);
        if (singletonObject == null) {
            beforeSingletonCreation(beanName);        // ★ 标记为「正在创建」
            singletonObject = singletonFactory.getObject();   // ★★ 真正创建 Bean
            afterSingletonCreation(beanName);          // ★ 移除「正在创建」标记
            addSingleton(beanName, singletonObject);   // ★ 放入一级缓存，清除二三级
        }
        return singletonObject;
    }
}

// ─── ★★ getSingleton(String)：只查缓存的版本（三级缓存的查找逻辑）───
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    // ① 查一级缓存
    Object singletonObject = this.singletonObjects.get(beanName);

    // ② 一级没有 && 该 Bean 正在创建中 → 说明发生了循环依赖
    if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {

        // ③ 查二级缓存（早期引用）
        singletonObject = this.earlySingletonObjects.get(beanName);

        // ④ 二级也没有 && 允许早期引用 → 查三级缓存
        if (singletonObject == null && allowEarlyReference) {
            synchronized (this.singletonObjects) {              // ★ 加锁（防并发重复创建代理）
                // 双重检查
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    singletonObject = this.earlySingletonObjects.get(beanName);
                    if (singletonObject == null) {
                        // ★★ 从三级缓存取出 ObjectFactory 并调用！
                        ObjectFactory<?> singletonFactory = this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            singletonObject = singletonFactory.getObject();   // ★ 可能是代理！
                            // ★★ 升级到二级缓存
                            this.earlySingletonObjects.put(beanName, singletonObject);
                            // ★★ 从三级缓存移除（保证 ObjectFactory 只执行一次）
                            this.singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
    }
    return singletonObject;      // 都没有则返回 null → 触发创建流程
}

// ─── ★★★ doCreateBean：三级缓存的写入时机 ───
protected Object doCreateBean(String beanName, RootBeanDefinition mbd, Object[] args) {
    // ═══ 阶段 1：实例化（创建原始对象，属性都是 null）═══
    instanceWrapper = createBeanInstance(beanName, mbd, args);
    bean = instanceWrapper.getWrappedInstance();

    // ═══ 阶段 2：合并 BeanDefinition（收集 @Autowired 元数据）═══
    applyMergedBeanDefinitionPostProcessors(mbd, beanType, beanName);

    // ═══ ★★ 阶段 3：提前暴露到三级缓存（解决循环依赖的关键！）═══
    boolean earlySingletonExposure = (mbd.isSingleton()                     // 单例
            && this.allowCircularReferences                                 // ★ 允许循环依赖（默认 true）
            && isSingletonCurrentlyInCreation(beanName));                    // 正在创建中
    if (earlySingletonExposure) {
        addSingletonFactory(beanName,
            () -> getEarlyBeanReference(beanName, mbd, bean));              // ★★ 存入 ObjectFactory
    }

    // ═══ 阶段 4：属性填充（依赖注入）═══
    populateBean(beanName, mbd, instanceWrapper);
    //   → AutowiredAnnotationBeanPostProcessor.postProcessProperties()
    //   → 发现需要注入 B → getBean("b") → 如果 B 也依赖 A，就会走到 getSingleton("a")
    //     → 从三级缓存拿到 A 的早期引用 ★ 循环依赖在此被打破！

    // ═══ 阶段 5：初始化（Aware → @PostConstruct → afterPropertiesSet → init-method）═══
    exposedObject = initializeBean(beanName, exposedObject, mbd);

    // ═══ 阶段 6：检查循环依赖的一致性（★ 重要校验）═══
    if (earlySingletonExposure) {
        Object earlySingletonReference = getSingleton(beanName, false);      // 只查一二级
        if (earlySingletonReference != null) {
            // ★ 说明有别的 Bean 已经拿到了 A 的早期引用
            if (exposedObject == bean) {
                exposedObject = earlySingletonReference;      // 用早期引用作为最终结果
            } else if (!this.allowRawInjectionDespiteWrapping && hasDependentBean(beanName)) {
                // ★★ 问题：初始化后的对象（可能是新代理）与已注入给别人的早期引用不一致！
                throw new BeanCurrentlyInCreationException(beanName,
                    "Bean with name '" + beanName + "' has been injected into other beans ["
                    + ... + "] in its raw version as part of a circular reference, but has eventually been wrapped...");
            }
        }
    }

    // ═══ 阶段 7：注册销毁回调 ═══
    registerDisposableBeanIfNecessary(beanName, bean, mbd);
    return exposedObject;
}

// ─── ★★★ getEarlyBeanReference：决定是否返回代理（三级缓存的核心价值）───
protected Object getEarlyBeanReference(String beanName, RootBeanDefinition mbd, Object bean) {
    Object exposedObject = bean;                              // 默认返回原始对象
    if (!mbd.isSynthetic() && hasInstantiationAwareBeanPostProcessors()) {
        for (BeanPostProcessor bp : getBeanPostProcessors()) {
            if (bp instanceof SmartInstantiationAwareBeanPostProcessor ibp) {
                // ★★ AOP 的 AbstractAutoProxyCreator 在这里判断：需要代理就【提前】生成代理！
                exposedObject = ibp.getEarlyBeanReference(exposedObject, beanName);
            }
        }
    }
    return exposedObject;
}
```

### 3.2 图解：A、B 循环依赖的完整过程

```
时间轴（假设先创建 A）：

【创建 A】
① getBean("a") → 缓存无 → 标记 A 为「正在创建」
② 实例化 A（new A()，属性都是 null）
③ ★ 存入三级缓存：singletonFactories.put("a", () -> getEarlyBeanReference(a))
④ 填充 A 的属性 → 发现 @Autowired B → getBean("b")
    │
    │  【创建 B】
    │  ⑤ getBean("b") → 缓存无 → 标记 B 为「正在创建」
    │  ⑥ 实例化 B（new B()）
    │  ⑦ ★ 存入三级缓存：singletonFactories.put("b", () -> ...)
    │  ⑧ 填充 B 的属性 → 发现 @Autowired A → getBean("a")
    │      │
    │      │  【A 的缓存查找】
    │      │  ⑨ getSingleton("a")：
    │      │     - 一级缓存 singletonObjects.get("a") → null（A 还没完成）
    │      │     - A 正在创建中？→ 是 ✅
    │      │     - 二级缓存 earlySingletonObjects.get("a") → null
    │      │     - 三级缓存 singletonFactories.get("a") → ★ 拿到 ObjectFactory！
    │      │     - 调用 factory.getObject() → getEarlyBeanReference(a)
    │      │         → 无 AOP：返回原始 A 对象
    │      │         → 有 AOP：★ 提前生成 A 的代理对象
    │      │     - ★ 升级到二级缓存：earlySingletonObjects.put("a", 早期A)
    │      │     - ★ 从三级缓存移除：singletonFactories.remove("a")
    │      │     - 返回早期 A（半成品，但引用可用！）
    │      ↓
    │  ⑩ B 的属性 a = 早期A 引用 ✅ 注入成功
    │  ⑪ B 初始化完成（@PostConstruct、afterPropertiesSet）
    │  ⑫ B 放入【一级缓存】singletonObjects.put("b", 完整的B)
    │     清除 B 的二三级缓存
    │  ⑬ 返回完整的 B
    ↓
⑭ A 的属性 b = 完整的B ✅ 注入成功
⑮ A 初始化完成
⑯ 一致性检查：早期引用 == 最终对象？
    - 无 AOP：是 → 直接用
    - 有 AOP：早期引用已经是代理，最终也是同一个代理 → 是 → 用早期引用
⑰ A 放入【一级缓存】singletonObjects.put("a", 完整的A)
   清除 A 的二三级缓存
⑱ 完成！A 和 B 都在一级缓存中，互相持有正确的引用
```

**关键洞察：**
- **提前暴露的是「引用」而非「完整的对象」**：A 的实例已经在堆中分配好了（步骤 ②），只是属性还没填充。B 拿到的是这个对象的**内存地址**，等 A 后续填充完属性，B 持有的引用自然就指向了完整的 A。
- **这就是「引用传递」的价值**：Java 对象引用是地址，先给地址、后填内容，最终两边都能看到完整数据。

### 3.3 为什么需要三级缓存？二级不够吗？★★★★★（★ 面试核心）

**结论：如果没有 AOP，二级缓存完全够用。三级缓存的存在是为了解决「AOP 代理对象」的提前创建问题。**

```java
// ─── 假设只有二级缓存的实现 ───
// 方案 A：实例化后立即放入二级缓存（存原始对象）
addEarlySingleton(beanName, bean);        // 存的是【原始对象】

// 问题：如果 A 需要被 AOP 代理呢？
// 正常流程下，AOP 代理是在【初始化完成后】的 postProcessAfterInitialization 中创建的
// 但 B 已经拿到了 A 的【原始对象】（不是代理）
// 最终 A 在一级缓存中是【代理对象】
// → ★ B 持有原始 A，容器持有代理 A，两者不一致！
// → B 调用 a.method() 时【切面不生效】（事务、日志、权限全部失效）！

// 方案 B：实例化后立即判断是否需要代理，需要就提前创建代理，放入二级缓存
if (needProxy(beanName)) {
    earlyRef = createProxy(bean);          // 提前创建代理
} else {
    earlyRef = bean;
}
addEarlySingleton(beanName, earlyRef);

// 问题：★ 破坏了 Spring 的设计原则！
// 1. AOP 的设计初衷是「在生命周期【最后】才织入代理」（postProcessAfterInitialization）
//    提前创建代理会让所有 Bean 都在实例化后就判断代理 → 违背设计
// 2. ★ 即使没有循环依赖，也要为每个 Bean 提前判断/创建代理 → 无谓的性能开销
// 3. 某些代理需要在初始化后才能确定（如依赖其他 Bean 的切面逻辑）

// ─── 三级缓存的方案（★ 完美解决）───
// 三级缓存存的是 ObjectFactory（Lambda），【延迟执行】：
addSingletonFactory(beanName, () -> getEarlyBeanReference(beanName, mbd, bean));
//                             ↑ 这个 Lambda 只有【真的发生循环依赖】时才会被调用！

// 情况 1：没有循环依赖
//   → 三级缓存的 ObjectFactory 永远不会被调用
//   → AOP 代理正常在 postProcessAfterInitialization 中创建（Spring 的标准流程）
//   → ★ 零额外开销

// 情况 2：有循环依赖
//   → B 需要 A 的引用 → 调用三级缓存的 ObjectFactory
//   → getEarlyBeanReference() 判断：需要 AOP 吗？
//       需要 → ★ 提前创建代理，返回代理（B 拿到代理，后续切面生效）
//       不需要 → 返回原始对象
//   → 结果升级到二级缓存（保证 ObjectFactory 只执行一次，多次获取拿到同一个引用）
//   → ★ 只在「必要时」才提前创建代理
```

**三级缓存各自的作用总结：**

| 缓存 | 作用 | 如果去掉会怎样 |
| --- | --- | --- |
| **一级** `singletonObjects` | 存放成品 Bean，getBean 的正常返回 | 无法缓存单例，每次都要重新创建 |
| **二级** `earlySingletonObjects` | 缓存「已生成的早期引用」，★ 保证多次获取拿到**同一个对象**（尤其代理对象只生成一次） | 每次循环依赖查找都会重新执行 ObjectFactory → **可能生成多个不同的代理对象** → 引用不一致 |
| **三级** `singletonFactories` | 存 ObjectFactory，★ **延迟决定**返回原始对象还是代理，且只在真发生循环依赖时才执行 | 要么提前为所有 Bean 创建代理（性能差、破坏设计），要么无法正确处理 AOP 场景 |

```java
// ─── 二级缓存保证「代理只创建一次」的具体场景 ───
// A 被 B 和 C 同时依赖，且 B、C 之间也有循环
// B 获取 A → 三级缓存的 ObjectFactory 执行 → 生成代理 → 存入二级缓存，删除三级
// C 获取 A → 三级缓存已空 → 从二级缓存拿到【同一个代理】✅
// 若没有二级缓存，C 会再次执行 ObjectFactory → 生成【第二个代理】→ B 和 C 持有不同的 A！
```

> 【延伸】**Spring 6 / Boot 3 的变化**：从 Spring Boot 2.6 开始，**默认禁止循环依赖**！
> ```yaml
> # Spring Boot 2.6+ 默认值
> spring:
>   main:
>     allow-circular-references: false     # ★ 默认 false，有循环依赖直接启动失败
> ```
> 报错：`The dependencies of some of the beans in the application context form a cycle`
>
> 要恢复旧行为需显式开启 `allow-circular-references: true`。**官方态度：循环依赖是设计缺陷，应该重构而非依赖框架兜底。**

## 4. 各种循环依赖场景分析 ★★★★★

### 4.1 能解决 vs 不能解决

```java
// ═══ ✅ 场景 1：字段注入的 singleton 循环依赖（可解决）═══
@Service public class A { @Autowired private B b; }
@Service public class B { @Autowired private A a; }
// → 正常启动

// ═══ ✅ 场景 2：setter 注入（可解决）═══
@Service public class A {
    private B b;
    @Autowired public void setB(B b) { this.b = b; }
}
// → 正常启动

// ═══ ❌ 场景 3：构造器注入（不可解决）═══
@Service public class A {
    private final B b;
    public A(B b) { this.b = b; }         // ★ 实例化就需要 B
}
@Service public class B {
    private final A a;
    public B(A a) { this.a = a; }
}
// → BeanCurrentlyInCreationException
// 原因：三级缓存的提前暴露发生在【实例化之后】，
//      而构造器注入在【实例化时】就需要依赖 → 无法提前暴露（对象还不存在）

// ✅ 构造器循环依赖的解决方案
// 方案 1：@Lazy（★ 最简单，注入代理，首次使用时才真正解析）
@Service public class A {
    private final B b;
    public A(@Lazy B b) { this.b = b; }    // ★ 注入的是 B 的代理，延迟到调用方法时才 getBean
}
// 原理：@Lazy 让 Spring 注入一个 CGLIB/JDK 代理，代理的方法调用时才从容器解析真实 Bean
//      此时 A 和 B 都已创建完成，无循环问题

// 方案 2：改为字段/setter 注入（打破构造器闭环）
@Service public class A {
    private final B b;
    public A() { }                          // 无参构造
    @Autowired public void setB(B b) { this.b = b; }
}

// 方案 3：ObjectProvider（延迟获取）
@Service public class A {
    private final ObjectProvider<B> bProvider;
    public A(ObjectProvider<B> bProvider) { this.bProvider = bProvider; }
    public void use() { bProvider.getObject().doSomething(); }   // 用时才解析
}

// 方案 4：★ 重构（根本解决）—— 见 4.3 节

// ═══ ❌ 场景 4：prototype 作用域（不可解决）═══
@Service @Scope("prototype") public class A { @Autowired private B b; }
@Service @Scope("prototype") public class B { @Autowired private A a; }
// → BeanCurrentlyInCreationException
// 原因：prototype 不进任何缓存（每次都新建），无法提前暴露
// 源码：DefaultSingletonBeanRegistry.isPrototypeCurrentlyInCreation() 检测到直接抛异常

// ═══ ❌ 场景 5：singleton 依赖 prototype（不报循环但有问题）═══
@Service public class SingletonA { @Autowired private PrototypeB b; }   // 只注入一次
@Service @Scope("prototype") public class PrototypeB { @Autowired private SingletonA a; }
// → 能启动，但 PrototypeB 的「每次新建」语义失效（见 [[后端/Spring/Bean生命周期与作用域]]）

// ═══ ⚠️ 场景 6：@Async 的 Bean 参与循环依赖（可能报错）═══
@Service public class A { @Autowired private B b; }
@Service public class B {
    @Autowired private A a;
    @Async public void doAsync() { }         // ★ @Async 会生成代理
}
// 可能报错：
// BeanCurrentlyInCreationException: Bean with name 'b' has been injected into other beans [a]
//   in its raw version as part of a circular reference, but has eventually been wrapped.
//   This means that said other beans do not use the final version of the bean.
//
// 原因：@Async 的代理（AsyncAnnotationBeanPostProcessor）在 postProcessAfterInitialization 创建，
//      而它【不支持】getEarlyBeanReference（不像 AOP 的 AbstractAutoProxyCreator）
//      → 三级缓存暴露的是【原始对象】，但最终容器里是【代理对象】→ 不一致 → 报错
// 解决：@Lazy、拆分依赖、或把 @Async 方法拆到独立的 Bean

// ═══ ⚠️ 场景 7：@Transactional 的 Bean（通常可以，因为走 AOP 的 getEarlyBeanReference）═══
@Service public class A { @Autowired private B b; }
@Service public class B {
    @Autowired private A a;
    @Transactional public void doTx() { }    // ✅ 可以，因为事务代理走 AbstractAutoProxyCreator
}
// AbstractAutoProxyCreator 实现了 SmartInstantiationAwareBeanPostProcessor，
// 其 getEarlyBeanReference 会提前创建代理并存入二级缓存 → 一致 → 不报错
```

### 4.2 allowCircularReferences 配置

```java
// ─── 全局开关 ───
// XML
<beans default-lazy-init="false">
    <!-- AbstractApplicationContext 的 setAllowCircularReferences -->
</beans>

// JavaConfig
@Configuration
public class AppConfig {
    @Bean
    public static BeanFactoryPostProcessor circularRefConfig() {
        return beanFactory -> {
            if (beanFactory instanceof DefaultSingletonBeanRegistry registry) {
                registry.setAllowCircularReferences(false);   // ★ 禁止循环依赖
            }
        };
    }
}

// Spring Boot 2.6+ 配置（★ 默认已禁止）
spring:
  main:
    allow-circular-references: true      # 恢复允许（不推荐，应重构）
    lazy-initialization: true            # 全局懒加载（也能规避部分循环依赖）
```

### 4.3 循环依赖的重构方案（★ 最佳实践）

**循环依赖本质是「职责划分不清」的信号。Spring 能兜底，但应该重构。**

```java
// ─── 反例：UserService 和 OrderService 互相依赖 ───
@Service
public class UserService {
    @Autowired private OrderService orderService;      // 查用户的订单
    public UserVO getUserWithOrders(Long id) {
        User user = userDao.selectById(id);
        List<Order> orders = orderService.listByUserId(id);    // ★ 依赖 OrderService
        return new UserVO(user, orders);
    }
    public void deductBalance(Long id, BigDecimal amount) { ... }
}

@Service
public class OrderService {
    @Autowired private UserService userService;         // 下单要校验用户、扣余额
    public Order create(OrderDTO dto) {
        userService.checkActive(dto.getUserId());        // ★ 依赖 UserService
        userService.deductBalance(dto.getUserId(), dto.getAmount());
        ...
    }
}
// 问题：两个 Service 互相依赖，职责混乱，改一个影响另一个，测试困难

// ─── ✅ 重构方案 1：抽取第三方（依赖倒置）───
// 把「共同依赖的能力」抽到独立的 Service，让两者都依赖它，而非互相依赖
@Service
public class AccountService {                    // ★ 账户能力（余额、状态）
    public void checkActive(Long userId) { }
    public void deductBalance(Long userId, BigDecimal amount) { }
}
@Service
public class UserService {
    @Autowired private OrderQueryService orderQueryService;   // ★ 只依赖查询
    // 不再被 OrderService 依赖
}
@Service
public class OrderService {
    @Autowired private AccountService accountService;         // ★ 依赖账户服务，不依赖 UserService
    public Order create(OrderDTO dto) {
        accountService.checkActive(dto.getUserId());
        accountService.deductBalance(...);
    }
}
// 依赖关系：UserService → OrderQueryService；OrderService → AccountService（无环）

// ─── ✅ 重构方案 2：事件驱动（★ 彻底解耦，推荐）───
@Service
public class OrderService {
    @Autowired private ApplicationEventPublisher publisher;   // ★ 只依赖事件发布器
    @Transactional
    public Order create(OrderDTO dto) {
        Order order = save(dto);
        publisher.publishEvent(new OrderCreatedEvent(order.getId(), dto.getUserId(), dto.getAmount()));
        return order;
        // ★ 不需要知道谁会处理这个事件（扣余额、加积分、发短信...）
    }
}
@Service
public class AccountListener {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)   // ★ 事务提交后执行
    public void onOrderCreated(OrderCreatedEvent event) {
        accountService.deductBalance(event.getUserId(), event.getAmount());
    }
}
// 优势：OrderService 完全不依赖 UserService，新增消费方零改动（开闭原则）

// ─── ✅ 重构方案 3：分层（Controller 编排，Service 只做单一职责）───
@RestController
public class UserOrderController {
    private final UserService userService;
    private final OrderService orderService;      // ★ 在 Controller 层编排两个 Service

    @GetMapping("/users/{id}/detail")
    public Result<UserDetailVO> detail(@PathVariable Long id) {
        User user = userService.getById(id);                    // 各调各的
        List<Order> orders = orderService.listByUserId(id);
        return Result.success(assemble(user, orders));           // Controller 组装
    }
}
// Service 之间不再有依赖（但 Controller 会变胖，适合简单场景）

// ─── ✅ 重构方案 4：接口 + 回调（依赖倒置原则）───
public interface OrderCallback {                  // ★ UserService 定义接口
    void onOrderCreated(Order order);
}
@Service
public class UserService implements OrderCallback {
    @Autowired private OrderService orderService;   // 单向依赖
    @Override public void onOrderCreated(Order order) { ... }
}
@Service
public class OrderService {
    private final List<OrderCallback> callbacks;    // ★ 注入接口列表，不依赖具体类
    public OrderService(List<OrderCallback> callbacks) { this.callbacks = callbacks; }
    public Order create(OrderDTO dto) {
        Order order = save(dto);
        callbacks.forEach(c -> c.onOrderCreated(order));
        return order;
    }
}

// ─── ✅ 重构方案 5：门面模式（Facade）───
@Service
public class TradeFacade {                        // ★ 上层门面，编排两个 Service
    private final UserService userService;
    private final OrderService orderService;
    public UserDetailVO getUserDetail(Long id) { ... }
}
// UserService 和 OrderService 互不依赖，都由 Facade 编排
```

**重构决策树：**

```
发现循环依赖
   ├── 是「查询」互相依赖？ → 抽 Query Service，或 Controller/Facade 编排
   ├── 是「A 做完通知 B」？ → ★ 事件驱动（ApplicationEvent / MQ）
   ├── 是「共同依赖某能力」？ → 抽第三方 Service（依赖倒置）
   ├── 是「A 需要 B 的接口能力」？ → 定义接口 + 回调
   └── 实在无法拆分？ → @Lazy（临时方案）+ 记录技术债
```

## 5. 实战：诊断循环依赖

```bash
# ─── Spring Boot 2.6+ 的报错信息（★ 非常详细，会画出依赖环）───
# ***************************
# APPLICATION FAILED TO START
# ***************************
# Description:
# The dependencies of some of the beans in the application context form a cycle:
#
# ┌──────┐
# |  orderController (field private com.example.service.OrderService com.example.controller.OrderController.orderService)
# ↑     ↓
# |  orderServiceImpl (field private com.example.service.UserService com.example.service.impl.OrderServiceImpl.userService)
# ↑     ↓
# |  userServiceImpl (field private com.example.service.OrderService com.example.service.impl.UserServiceImpl.orderService)
# └──────┘
#
# Action:
# Relying upon circular references is discouraged and they are prohibited by default.
# Update your application to remove the dependency cycle between beans.
# As a last resort, it may be possible to break the cycle automatically by setting
# spring.main.allow-circular-references to true.
```

```java
// ─── 编程式检测循环依赖（启动时主动扫描并告警）───
@Component
@Slf4j
public class CircularDependencyDetector implements ApplicationListener<ContextRefreshedEvent> {

    @Override
    public void onApplicationEvent(ContextRefreshedEvent event) {
        ConfigurableApplicationContext ctx =
                (ConfigurableApplicationContext) event.getApplicationContext();
        DefaultListableBeanFactory bf =
                (DefaultListableBeanFactory) ctx.getBeanFactory();

        // 构建依赖图
        Map<String, Set<String>> graph = new HashMap<>();
        for (String name : bf.getBeanDefinitionNames()) {
            try {
                BeanDefinition bd = bf.getBeanDefinition(name);
                Set<String> deps = new HashSet<>();
                // 从依赖记录中获取
                String[] dependents = bf.getDependentBeans(name);
                // 或解析 BeanDefinition 的属性引用
                graph.put(name, deps);
            } catch (Exception e) {
                log.debug("跳过 {}", name);
            }
        }

        // DFS 检测环
        Set<String> visited = new HashSet<>(), inStack = new HashSet<>();
        List<String> path = new ArrayList<>();
        for (String node : graph.keySet()) {
            if (hasCycle(node, graph, visited, inStack, path)) {
                log.error("★★★ 检测到循环依赖：{}", String.join(" → ", path));
            }
        }
    }

    private boolean hasCycle(String node, Map<String, Set<String>> graph,
                             Set<String> visited, Set<String> inStack, List<String> path) {
        if (inStack.contains(node)) {
            path.add(node);
            return true;
        }
        if (visited.contains(node)) return false;
        visited.add(node);
        inStack.add(node);
        path.add(node);
        for (String next : graph.getOrDefault(node, Set.of())) {
            if (hasCycle(next, graph, visited, inStack, path)) return true;
        }
        path.remove(path.size() - 1);
        inStack.remove(node);
        return false;
    }
}

// ─── 用 Spring 内置 API 查看依赖关系 ───
@Component
public class DependencyReporter implements ApplicationRunner {
    private final ConfigurableListableBeanFactory bf;
    public DependencyReporter(ConfigurableListableBeanFactory bf) { this.bf = bf; }

    @Override
    public void run(ApplicationArguments args) {
        for (String name : bf.getBeanDefinitionNames()) {
            String[] deps = bf.getDependenciesForBean(name);      // ★ 该 Bean 依赖了谁
            String[] dependents = bf.getDependentBeans(name);      // ★ 谁依赖了该 Bean
            if (deps.length > 5) {
                log.warn("Bean {} 依赖过多（{} 个），可能需要重构：{}", name, deps.length, Arrays.toString(deps));
            }
        }
    }
}
```

## 6. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | 构造器循环依赖 | `BeanCurrentlyInCreationException` | `@Lazy` / setter 注入 / **重构** |
| 2 | prototype 循环依赖 | 同上 | prototype 不支持，必须重构 |
| 3 | Spring Boot 2.6+ 默认禁止循环依赖 | 老项目升级后启动失败 | 重构（推荐）或 `allow-circular-references: true`（临时） |
| 4 | `@Async` Bean 参与循环 | 「injected in its raw version」报错 | `@Async` 方法拆到独立 Bean，或 `@Lazy` |
| 5 | 以为三级缓存能解决所有循环 | 构造器/prototype 仍失败 | 理解三级缓存的作用时机（实例化之后） |
| 6 | 二级缓存的作用不理解 | 面试答不上 | 二级保证「早期引用只生成一次」（尤其代理） |
| 7 | 三级缓存的必要性不理解 | 答「二级就够」 | 三级是为了**延迟**决定代理，无循环时零开销 |
| 8 | 用循环依赖「实现功能」 | 代码难维护、测试困难 | 重构（事件驱动/抽第三方/门面） |
| 9 | `allowRawInjectionDespiteWrapping` | 罕见配置，允许注入原始对象 | 一般不改，改了会导致切面失效 |
| 10 | 全局懒加载规避循环 | 问题被掩盖，运行时才暴露 | `lazy-initialization` 会让所有 Bean 懒加载，首次请求慢 |
| 11 | `@Lazy` 注入后 NPE | 代理未正确生成 | 检查是否接口注入用了 JDK 代理 |
| 12 | 循环依赖 + AOP 导致注入原始对象 | 切面不生效（事务/日志失效） | 三级缓存已处理；若仍出问题检查自定义 BPP |
| 13 | 大量 Bean 依赖过多 | 启动时报「依赖环」难排查 | 用依赖检测工具，控制单 Bean 依赖数 ≤ 5 |
| 14 | 误以为 setter 注入不会有循环问题 | 依然可能报错（prototype/构造器混合） | 关键是「作用域 + 注入时机」 |
| 15 | 三级缓存的并发问题 | 多线程 getBean 同一 Bean | Spring 用 `synchronized(singletonObjects)` 保证 |

---

## 关联笔记

- 上一篇：[[后端/Spring/Bean生命周期与作用域]]
- 下一篇：[[后端/Spring/AOP面向切面编程]]
- 相关：[[后端/Spring/Spring概述与IoC容器]]（DI 三种方式）、[[后端/Spring/动态代理-JDK与CGLIB]]（代理创建时机）
- Boot：[[后端/SpringBoot/自动配置原理]]（`@Lazy` 与条件装配）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
