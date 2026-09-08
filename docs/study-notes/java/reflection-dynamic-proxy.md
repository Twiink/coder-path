---
title: "反射与动态代理"
aliases:
  - "Java 反射"
  - "JDK 动态代理 CGLIB"
tags:
  - "后端"
  - "java"
  - "笔记"
  - "面试"
category: "后端"
folder: "Java基础"
parent: "[[后端/Java/Java学习笔记总索引]]"
related:
  - "[[后端/Java基础/泛型枚举与注解]]"
  - "[[后端/Java基础/IO流与文件操作]]"
  - "[[后端/Spring/动态代理-JDK与CGLIB]]"
  - "[[后端/Spring/Spring概述与IoC容器]]"
created: 2026-09-06
updated: 2026-09-06
---

# 反射与动态代理

> 反射是 Spring、MyBatis、Jackson 等一切框架的基石；动态代理是 AOP 的实现手段。这两块吃透了，看框架源码才不会懵。

## 第一部分：反射（Reflection）

### 1. 反射是什么

**反射 = 在运行时动态获取类的信息（字段、方法、构造器、注解）并操作对象的能力。**

```java
// 正向：编译期就知道类型，直接 new 和调用
User user = new User("Tom");
user.setName("Jerry");

// 反向（反射）：运行时才拿到类名/Class 对象，动态创建和调用
Class<?> clazz = Class.forName("com.example.User");      // 运行时才知道是哪个类
Object obj = clazz.getDeclaredConstructor(String.class).newInstance("Tom");
Method setter = clazz.getMethod("setName", String.class);
setter.invoke(obj, "Jerry");                              // 动态调用
```

**反射能做什么：**

| 能力 | 说明 | 框架应用 |
| --- | --- | --- |
| 运行时判断任意对象的类 | `obj.getClass()` | 类型分发 |
| 运行时构造任意类的对象 | `Constructor.newInstance()` | Spring 实例化 Bean、Jackson 反序列化 |
| 运行时调用任意方法 | `Method.invoke()` | Spring 的 `@Scheduled`、MVC 的 Controller 调用 |
| 运行时读写字段（含 private） | `Field.set/get` + `setAccessible(true)` | 依赖注入、BeanUtils 拷贝 |
| 读取注解 | `getAnnotation()` | Spring 扫描 `@Component`、MyBatis 的 `@Select` |
| 动态生成代理类 | `Proxy.newProxyInstance()` | AOP、事务、MyBatis Mapper |
| 操作数组 | `Array.newInstance()` | 泛型数组创建 |

**反射的代价：**

1. **性能开销**：方法调用需要安全检查 + 参数装箱 + 查找，比直接调用慢（虽然 JIT 会优化）。
2. **破坏封装**：可以访问 private 成员。
3. **编译期检查失效**：类名/方法名写错要到运行时才报 `ClassNotFoundException`/`NoSuchMethodException`。

### 2. Class 对象 ★★★★★

**每个类被 JVM 加载后，都会在堆中生成一个唯一的 `Class` 对象，它是反射的入口。**

```java
// ─── 获取 Class 对象的 4 种方式 ───

// 方式 1：类名.class（编译期确定，最安全高效，不会触发类初始化）
Class<User> c1 = User.class;
Class<int[]> c2 = int[].class;                    // 数组也有 Class
Class<Integer> c3 = int.class;                    // 基本类型的 Class
Class<Void> c4 = void.class;

// 方式 2：对象.getClass()（运行时获取实际类型）
User user = new User();
Class<?> c5 = user.getClass();                    // 实际类型（可能是子类）

// 方式 3：Class.forName("全限定名")（★ 会触发类初始化，动态加载用）
Class<?> c6 = Class.forName("com.example.User");
Class<?> c7 = Class.forName("com.mysql.cj.jdbc.Driver");   // 传统 JDBC 加载驱动
Class<?> c8 = Class.forName("com.example.User", false, loader);  // false = 不初始化

// 方式 4：ClassLoader.loadClass()（只加载不初始化）
Class<?> c9 = getClass().getClassLoader().loadClass("com.example.User");

// 方式 5：包装类的 TYPE 字段（基本类型）
Class<Integer> c10 = Integer.TYPE;                // == int.class
Integer.class != int.class;                        // true，两者不同！

// ─── Class 对象的唯一性 ───
System.out.println(c1 == c5);                     // true！同一个类只有一个 Class 对象
System.out.println(c1 == c6);                     // true

// ★ 但是：不同 ClassLoader 加载的同一个类，Class 对象不同！
ClassLoader loader1 = new MyClassLoader();
ClassLoader loader2 = new MyClassLoader();
Class<?> x = loader1.loadClass("com.example.User");
Class<?> y = loader2.loadClass("com.example.User");
x == y;                                            // false！
// 这就是 Tomcat 能隔离多个 Web 应用同名类的原理
```

**【面试】`Class.forName` 与 `ClassLoader.loadClass` 的区别？**

| | `Class.forName(name)` | `ClassLoader.loadClass(name)` |
| --- | --- | --- |
| 加载 | ✅ | ✅ |
| 链接（验证、准备、解析） | ✅ | 部分（不解析） |
| **初始化（执行 static 块）** | ✅ **默认执行** | ❌ 不执行 |
| 可控制 | `Class.forName(name, false, loader)` 可不初始化 | — |
| 典型场景 | JDBC 驱动注册（需要执行静态块） | Spring 延迟加载、Tomcat 隔离 |

```java
// JDBC 为什么要 Class.forName 而不是 loadClass？
Class.forName("com.mysql.cj.jdbc.Driver");
// 因为 Driver 类的静态代码块会自动注册驱动到 DriverManager：
public class Driver extends NonRegisteringDriver implements java.sql.Driver {
    static {
        try {
            java.sql.DriverManager.registerDriver(new Driver());   // ★ 必须触发初始化
        } catch (SQLException E) {
            throw new RuntimeException("Can't register driver!");
        }
    }
}
// 用 loadClass 不会执行静态块，驱动注册不上
// 注：JDBC 4.0+（JDK 6+）通过 SPI 自动注册，不再需要 Class.forName
```

### 3. Class 类的方法全集

```java
Class<?> clazz = User.class;

// ─── 基本信息 ───
clazz.getName();                    // "com.example.User" 全限定名
clazz.getSimpleName();              // "User"
clazz.getCanonicalName();           // "com.example.User"（内部类用 . 分隔）
clazz.getTypeName();                // 同 getName（泛型信息更全）
clazz.getPackageName();             // "com.example"（JDK 9+）
clazz.getSuperclass();              // class java.lang.Object
clazz.getInterfaces();              // Class[] 直接实现的接口
clazz.getGenericInterfaces();       // Type[]（含泛型信息）
clazz.getGenericSuperclass();       // Type（含泛型，如 Base<User>）
clazz.getPackage();                 // Package 对象
clazz.getClassLoader();             // 加载它的类加载器
clazz.getModifiers();               // int 位掩码
Modifier.isPublic(clazz.getModifiers());
Modifier.isAbstract(...); Modifier.isFinal(...); Modifier.isStatic(...);
clazz.isArray();                    // 是否数组
clazz.isEnum();                     // 是否枚举
clazz.isInterface();                // 是否接口
clazz.isAnnotation();               // 是否注解
clazz.isPrimitive();                // 是否基本类型
clazz.isAnonymousClass();           // 是否匿名类
clazz.isLocalClass();               // 是否局部类
clazz.isMemberClass();              // 是否成员内部类
clazz.isSynthetic();                // 是否编译器生成
clazz.getComponentType();           // 数组的元素类型
clazz.getTypeParameters();          // 类型参数（泛型）
clazz.getResourceAsStream("/config.properties");   // 加载资源
clazz.cast(obj);                    // 类型安全的强转（等价 (User) obj）
clazz.isInstance(obj);              // 等价 obj instanceof User

// ─── 构造器 ───
Constructor<?>[] cs = clazz.getConstructors();          // public（含继承的？不含）
Constructor<?>[] cs2 = clazz.getDeclaredConstructors(); // 所有（含 private，不含继承）
Constructor<User> c = clazz.getConstructor(String.class, int.class);   // 指定参数类型的 public 构造器
Constructor<User> c2 = clazz.getDeclaredConstructor(String.class);

// ─── 方法 ───
Method[] ms = clazz.getMethods();               // ★ 所有 public（含从父类/接口继承的！）
Method[] ms2 = clazz.getDeclaredMethods();      // ★ 自己声明的所有（含 private，不含继承）
Method m = clazz.getMethod("setName", String.class);
Method m2 = clazz.getDeclaredMethod("privateMethod");

// ─── 字段 ───
Field[] fs = clazz.getFields();                 // 所有 public（含继承）
Field[] fs2 = clazz.getDeclaredFields();        // 自己声明的所有（含 private）
Field f = clazz.getField("id");
Field f2 = clazz.getDeclaredField("name");

// ─── 注解 ───
clazz.getAnnotations();                         // 含 @Inherited 继承的
clazz.getDeclaredAnnotations();                 // 只含自己声明的
clazz.getAnnotation(Service.class);
clazz.isAnnotationPresent(Service.class);
clazz.getAnnotationsByType(Schedule.class);     // 可重复注解
```

**getMethods vs getDeclaredMethods（易错）：**

| 方法 | 包含 | 访问权限 |
| --- | --- | --- |
| `getMethods()` | **本类 + 所有父类 + 接口**的 public 方法（含 Object 的 9 个） | 仅 public |
| `getDeclaredMethods()` | **仅本类声明**的方法（不含继承） | 所有（public/protected/default/private） |
| `getFields()` | 本类 + 父类的 public 字段 | 仅 public |
| `getDeclaredFields()` | 仅本类声明的字段 | 所有 |
| `getConstructors()` | 仅本类的 public 构造器（构造器不继承） | 仅 public |
| `getDeclaredConstructors()` | 仅本类的所有构造器 | 所有 |

```java
// 要获取「一个类的所有方法（含私有 + 含继承）」需要递归向上遍历
public static List<Method> getAllMethods(Class<?> clazz) {
    List<Method> methods = new ArrayList<>();
    while (clazz != null && clazz != Object.class) {
        methods.addAll(Arrays.stream(clazz.getDeclaredMethods())
                             .filter(m -> !m.isSynthetic() && !m.isBridge())   // ★ 过滤合成/桥接方法
                             .collect(Collectors.toList()));
        clazz = clazz.getSuperclass();
    }
    return methods;
}
```

### 4. 构造器反射

```java
Class<User> clazz = User.class;

// 1. 获取构造器
Constructor<User> c1 = clazz.getDeclaredConstructor();                       // 无参
Constructor<User> c2 = clazz.getDeclaredConstructor(String.class, Integer.class);  // 有参

// 2. 创建实例
User u1 = c1.newInstance();                                  // JDK 9 起废弃但可用
User u2 = clazz.getDeclaredConstructor().newInstance();      // ✅ JDK 9+ 推荐写法
User u3 = c2.newInstance("Tom", 20);

// 3. 访问私有构造器（破解单例的经典手段）
Constructor<User> privateC = clazz.getDeclaredConstructor(String.class);
privateC.setAccessible(true);                                // ★ 暴力打开访问权限
User u4 = privateC.newInstance("Hacked");

// 4. 构造器信息
c2.getParameterCount();                  // 2
c2.getParameterTypes();                  // [String.class, Integer.class]
c2.getGenericParameterTypes();           // 含泛型的类型
c2.getParameters();                      // Parameter[]（含参数名，需 -parameters 编译）
c2.getParameters()[0].getName();         // "name"（编译加 -parameters）或 "arg0"
c2.getModifiers();
c2.getExceptionTypes();                  // throws 的异常
c2.getAnnotation(Autowired.class);     // 构造器上的注解
c2.isVarArgs();                          // 是否可变参数

// 5. Spring 中的实际应用：实例化 Bean
// AbstractAutowireCapableBeanFactory#createBeanInstance
Constructor<?>[] candidates = determineCandidateConstructors(beanClass, beanName);
// 选择构造器后
beanInstance = instantiateBean(beanClass, constructorToUse, args);
// 底层用 ReflectionUtils.makeAccessible(constructor) + constructor.newInstance(args)

// 6. Jackson 反序列化（无参构造 + setter，或 @JsonCreator 指定构造器）
ObjectMapper mapper = new ObjectMapper();
User u5 = mapper.readValue(json, User.class);
// 内部：找到无参构造器 newInstance，然后反射调用各 setter
```

> 【坑】**`newInstance()` 的异常包装**：
> ```java
> try {
>     clazz.newInstance();
> } catch (InstantiationException e) {   // 抽象类/接口/无无参构造器
> } catch (IllegalAccessException e) {   // 构造器不可访问（private）
> }
> // 构造器内部抛出的异常会被包装成 InvocationTargetException
> catch (InvocationTargetException e) {
>     Throwable real = e.getTargetException();   // ★ 取出真正的异常
> }
> ```
> **`newInstance()` 会把构造器抛出的受检异常「偷偷」抛出**（绕过编译检查），所以 JDK 9 起废弃它，推荐 `getDeclaredConstructor().newInstance()`。

### 5. 方法反射

```java
Class<User> clazz = User.class;
User user = new User();

// 1. 获取方法
Method setName = clazz.getMethod("setName", String.class);          // public（含继承）
Method privateM = clazz.getDeclaredMethod("internalCheck");         // 含私有

// 2. 调用方法
setName.invoke(user, "Tom");                    // 实例方法：传对象 + 参数
Object result = setName.invoke(user, "Jerry");  // 返回值

Method staticM = clazz.getMethod("getCount");
Object r2 = staticM.invoke(null);               // ★ 静态方法：第一个参数传 null

privateM.setAccessible(true);                   // ★ 私有方法必须打开
privateM.invoke(user);

// 3. 可变参数方法的调用
Method varargsM = clazz.getMethod("log", String.class, Object[].class);
varargsM.invoke(obj, "格式", new Object[]{arg1, arg2});   // ★ 可变参数要包成数组
// 或者
varargsM.invoke(obj, "格式", arg1, arg2);                 // 也可以展开传

// 4. 方法信息
setName.getName();                          // "setName"
setName.getReturnType();                    // void.class
setName.getGenericReturnType();             // 含泛型
setName.getParameterCount();                // 1
setName.getParameterTypes();                // [String.class]
setName.getParameterAnnotations();          // Annotation[][]（每个参数的注解数组）
setName.getAnnotations();
setName.getModifiers();
setName.isVarArgs();
setName.isBridge(); setName.isSynthetic();  // ★ 过滤编译器生成的方法
setName.getDefaultValue();                  // 注解方法的默认值
MethodHandles.lookup().unreflect(setName);  // 转 MethodHandle（性能更好）

// 5. 异常处理
try {
    method.invoke(obj, args);
} catch (IllegalAccessException e) {
    // 方法不可访问 → setAccessible(true)
} catch (InvocationTargetException e) {
    Throwable target = e.getTargetException();    // ★ 目标方法抛出的真实异常
    if (target instanceof BusinessException) {
        throw (BusinessException) target;          // 还原业务异常
    }
    throw new RuntimeException("方法执行失败", target);
} catch (IllegalArgumentException e) {
    // 参数类型不匹配或对象类型不对
}
```

> 【坑 1】**`InvocationTargetException` 是反射调用最容易踩的坑**：目标方法抛的任何异常都被包装成它。如果直接 catch 并包装成「反射失败」，**真实的业务异常信息就丢了**。必须 `getTargetException()` 取出原异常再处理。
>
> Spring AOP 的处理方式（`AopUtils.invokeJoinpointUsingReflection`）：
> ```java
> try {
>     return method.invoke(target, args);
> } catch (InvocationTargetException ex) {
>     throw ex.getTargetException();      // ★ 直接把真实异常抛出，让 @Transactional 能正确回滚
> } catch (IllegalArgumentException ex) {
>     throw new AopInvocationException(...);
> }
> ```
> **这就是为什么 AOP 代理的方法能正确触发事务回滚** —— 真实异常被原样抛出，没有被包装污染。

> 【坑 2】**反射获取参数名需要编译时加 `-parameters`**：
> ```xml
> <!-- Maven 配置 -->
> <plugin>
>   <artifactId>maven-compiler-plugin</artifactId>
>   <configuration>
>     <parameters>true</parameters>       <!-- ★ Spring Boot 的 parent 已默认开启 -->
>   </configuration>
> </plugin>
> ```
> 不加的话 `parameter.getName()` 返回 `arg0`、`arg1`，MyBatis 的 `@Param` 就必须显式写了。Spring MVC 的 `@PathVariable` 不写 value 也依赖这个。

### 6. 字段反射

```java
Class<User> clazz = User.class;
User user = new User();

// 1. 获取字段
Field nameField = clazz.getDeclaredField("name");      // 含私有
Field idField = clazz.getField("id");                   // 仅 public

// 2. 读写实例字段
nameField.setAccessible(true);                          // ★ 私有字段必须打开
nameField.set(user, "Tom");                             // 写
Object value = nameField.get(user);                     // 读

// 3. 读写静态字段
Field staticField = clazz.getDeclaredField("MAX_COUNT");
staticField.setAccessible(true);
Object v = staticField.get(null);                       // ★ 静态字段传 null
// staticField.set(null, 100);                          // final 静态字段会失败（JDK 12+ 彻底禁止）

// 4. 修改 final 字段（JDK 8 可以，JDK 12+ 被禁止）
Field finalField = clazz.getDeclaredField("finalName");
finalField.setAccessible(true);
// JDK 8 及以前：可以通过修改 modifiers 字段绕过 final 检查（hack）
Field modifiers = Field.class.getDeclaredField("modifiers");
modifiers.setAccessible(true);
modifiers.setInt(finalField, finalField.getModifiers() & ~Modifier.FINAL);
finalField.set(user, "newValue");
// JDK 12+：抛 IllegalAccessException（模块化封闭了 java.lang.reflect）
// JDK 9+ 需要 --add-opens java.base/java.lang.reflect=ALL-UNNAMED

// 5. 字段信息
nameField.getName();
nameField.getType();                     // String.class
nameField.getGenericType();              // 含泛型（如 List<String>）
nameField.getModifiers();
nameField.isEnumConstant();
nameField.getAnnotations();
nameField.get(user);

// 6. 实战：对象转 Map（通用工具）
public static Map<String, Object> beanToMap(Object obj) throws IllegalAccessException {
    Map<String, Object> map = new LinkedHashMap<>();
    Class<?> clazz = obj.getClass();
    while (clazz != null && clazz != Object.class) {
        for (Field field : clazz.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers())) continue;    // 跳过静态字段
            if (field.isSynthetic()) continue;                        // 跳过合成字段（如内部类的 this$0）
            field.setAccessible(true);
            map.put(field.getName(), field.get(obj));
        }
        clazz = clazz.getSuperclass();                                 // ★ 递归父类字段
    }
    return map;
}

// 7. 实战：Map 转对象
public static <T> T mapToBean(Map<String, Object> map, Class<T> clazz) throws Exception {
    T obj = clazz.getDeclaredConstructor().newInstance();
    for (Map.Entry<String, Object> entry : map.entrySet()) {
        try {
            Field field = findField(clazz, entry.getKey());
            if (field == null) continue;
            field.setAccessible(true);
            field.set(obj, convertType(entry.getValue(), field.getType()));   // 类型转换
        } catch (NoSuchFieldException e) {
            // 忽略未知字段
        }
    }
    return obj;
}

// 8. 实战：找出对象中所有非空字段（构建动态更新 SQL）
public static Map<String, Object> getNonNullFields(Object obj) throws IllegalAccessException {
    Map<String, Object> result = new LinkedHashMap<>();
    for (Field field : obj.getClass().getDeclaredFields()) {
        if (Modifier.isStatic(field.getModifiers())) continue;
        field.setAccessible(true);
        Object value = field.get(obj);
        if (value != null) result.put(field.getName(), value);
    }
    return result;
}
// MyBatis-Plus 的 updateById 只更新非 null 字段，就是这个原理

// 9. 实战：校验带注解的字段（简易版 JSR-303）
public static List<String> validate(Object obj) throws IllegalAccessException {
    List<String> errors = new ArrayList<>();
    for (Field field : obj.getClass().getDeclaredFields()) {
        field.setAccessible(true);
        Object value = field.get(obj);
        if (field.isAnnotationPresent(NotNull.class) && value == null) {
            errors.add(field.getName() + " 不能为空");
        }
        if (field.isAnnotationPresent(Size.class) && value instanceof String) {
            Size size = field.getAnnotation(Size.class);
            int len = ((String) value).length();
            if (len < size.min() || len > size.max()) {
                errors.add(field.getName() + " 长度必须在 " + size.min() + "~" + size.max());
            }
        }
    }
    return errors;
}
```

### 7. setAccessible 与模块化限制

```java
// setAccessible(true) 的作用：
// 1. 绕过 Java 语言的访问控制检查（private/protected/包级）
// 2. 跳过安全检查，提升反射性能（约 4 倍，因为不再每次校验）

Field privateField = clazz.getDeclaredField("password");
privateField.setAccessible(true);      // ★ 打开
String pwd = (String) privateField.get(user);

// 即使字段是 private final，setAccessible 后也能读（写受限）
```

**JDK 9+ 模块化的限制（重要变化）：**

```java
// JDK 9 引入模块系统后，反射访问其他模块的私有成员需要「开放」
// 错误示例：反射修改 String 的 value 字段
Field valueField = String.class.getDeclaredField("value");
valueField.setAccessible(true);
// JDK 8：成功
// JDK 9+：InaccessibleObjectException:
//   Unable to make field private final byte[] java.lang.String.value accessible:
//   module java.base does not "opens java.lang" to unnamed module

// 解决方案：JVM 启动参数开放模块
// --add-opens java.base/java.lang=ALL-UNNAMED        # 开放 java.lang 给未命名模块
// --add-opens java.base/java.util=ALL-UNNAMED
// --add-exports java.base/sun.misc=ALL-UNNAMED       # 导出包（public 成员）

// module-info.java 中声明（自己的模块）
module my.module {
    opens com.example.internal;                      // 开放给反射
    opens com.example.entity to spring.core;         // 只开放给特定模块
}

// 常见的需要 --add-opens 的场景
// 1. 老版本 CGLIB / ByteBuddy 操作 JDK 内部类
// 2. Fastjson 1.x 反射修改 final 字段
// 3. Spring Boot 2.x 在 JDK 17 上运行（部分场景）
// 4. Lombok 的某些功能
// 5. 单元测试框架 mock final 类
```

> 【实践】**Spring Boot 3.x + JDK 17 环境下，`spring-boot-maven-plugin` 打包的 jar 会自动处理部分 add-opens**；手动运行需要时在 `JAVA_TOOL_OPTIONS` 或启动脚本加参数：
> ```bash
> java --add-opens java.base/java.lang=ALL-UNNAMED \
>      --add-opens java.base/java.util=ALL-UNNAMED \
>      -jar app.jar
> ```

### 8. MethodHandle 与 VarHandle（JDK 7/9+，反射的高性能替代）

```java
import java.lang.invoke.*;

// MethodHandle：方法句柄，JVM 层面的方法引用，性能接近直接调用
MethodHandles.Lookup lookup = MethodHandles.lookup();

// 查找方法
MethodType mt = MethodType.methodType(String.class, String.class);   // 返回类型 + 参数类型
MethodHandle mh = lookup.findVirtual(User.class, "setName", mt);      // 实例方法
mh.invoke(user, "Tom");                                               // 调用
mh.invokeExact(user, "Tom");                                          // ★ 精确调用（类型必须完全匹配，性能更好）

// 静态方法
MethodHandle staticMh = lookup.findStatic(Math.class, "max",
        MethodType.methodType(int.class, int.class, int.class));
int r = (int) staticMh.invokeExact(1, 2);

// 私有方法（需要 privateLookupIn）
MethodHandles.Lookup privateLookup = MethodHandles.privateLookupIn(User.class, MethodHandles.lookup());
MethodHandle privateMh = privateLookup.findSpecial(...);

// 构造器
MethodHandle ctor = lookup.findConstructor(User.class, MethodType.methodType(void.class, String.class));
User u = (User) ctor.invoke("Tom");

// 字段访问
MethodHandle getter = lookup.findGetter(User.class, "name", String.class);
MethodHandle setter = lookup.findSetter(User.class, "name", String.class);
String name = (String) getter.invoke(user);
setter.invoke(user, "Jerry");

// VarHandle（JDK 9+）：字段/数组元素的原子操作，替代 Unsafe
private static final VarHandle COUNT_HANDLE;
static {
    try {
        COUNT_HANDLE = MethodHandles.lookup().findVarHandle(Counter.class, "count", int.class);
    } catch (Exception e) { throw new ExceptionInInitializerError(e); }
}
class Counter {
    volatile int count;
    void increment() {
        COUNT_HANDLE.getAndAdd(this, 1);              // 原子加
        COUNT_HANDLE.compareAndSet(this, 0, 1);       // CAS
        COUNT_HANDLE.getAndSet(this, 5);
        COUNT_HANDLE.compareAndExchange(this, 0, 1);
    }
}
// AtomicInteger 内部的 Unsafe 操作在 JDK 9+ 已改用 VarHandle
```

**反射 vs MethodHandle：**

| 对比 | 反射（Reflection API） | MethodHandle |
| --- | --- | --- |
| 抽象层次 | Java API 层面 | **JVM 字节码层面** |
| 性能 | 慢（安全检查、装箱、查找） | **接近直接调用**（JIT 可内联） |
| 访问控制 | `setAccessible` 绕过 | 由 Lookup 对象的权限决定（更细粒度） |
| 类型安全 | 运行时检查 | `invokeExact` 编译期签名匹配 |
| 可组合 | ❌ | ✅（`filterArguments`、`insertArguments`、`foldArguments` 等函数式组合） |
| 语言中立 | 仅 Java | 支持所有 JVM 语言（ invokedynamic 的基础） |
| 用途 | 框架通用反射 | Lambda、字符串拼接、动态语言、高性能框架 |

### 9. 反射性能优化

```java
// 基准：调用 1000 万次 setName
// 直接调用:              ~20 ms
// MethodHandle(exact):   ~25 ms
// 反射（缓存 Method）:    ~200 ms      ← 慢 10 倍
// 反射（每次 getMethod）: ~1200 ms     ← 慢 60 倍
// 反射 + setAccessible:   ~50 ms       ← 跳过安全检查后大幅提升

// ─── 优化手段 ───

// 1. ★ 缓存 Class/Method/Field 对象（最重要）
private static final Map<Class<?>, Map<String, Method>> METHOD_CACHE = new ConcurrentHashMap<>();
public static Method getMethod(Class<?> clazz, String name, Class<?>... params) {
    return METHOD_CACHE
        .computeIfAbsent(clazz, k -> new ConcurrentHashMap<>())
        .computeIfAbsent(name + Arrays.toString(params), k -> {
            try {
                Method m = clazz.getMethod(name, params);
                m.setAccessible(true);                 // ★ 提前打开
                return m;
            } catch (NoSuchMethodException e) {
                throw new RuntimeException(e);
            }
        });
}

// 2. setAccessible(true)（跳过安全检查，提升 4 倍）
method.setAccessible(true);

// 3. 用 MethodHandle 替代反射
// 4. 用编译期代码生成替代运行时反射（MapStruct、Lombok、APT）
// 5. 避免自动装箱（用 getXxx 原始类型方法或 MethodHandle.invokeExact）
// 6. Spring 的 ReflectionUtils 已内置缓存和异常处理
ReflectionUtils.findMethod(clazz, "setName", String.class);
ReflectionUtils.invokeMethod(method, target, args);
ReflectionUtils.makeAccessible(field);
ReflectionUtils.doWithFields(clazz, field -> { ... });   // 遍历所有字段（含父类）
ReflectionUtils.handleReflectionException(ex);           // 统一异常转 RuntimeException
```

> 【实践】**性能敏感路径避免反射**。Spring 的做法：Bean 的字段注入在启动时反射一次并缓存 `InjectionMetadata`；MVC 的 HandlerMethod 在启动时解析并缓存；MyBatis 用动态代理生成 Mapper 后，方法调用走代理而非每次反射。

## 第二部分：动态代理

### 10. 代理模式

**代理模式：为目标对象提供一个替身，控制对它的访问，并可在访问前后增强逻辑。**

```java
// 静态代理：手动写代理类（每个接口都要写一个，代码重复）
public interface UserService {
    User getById(Long id);
    void save(User user);
}

public class UserServiceImpl implements UserService {
    public User getById(Long id) { return new User(id); }
    public void save(User user) { System.out.println("保存"); }
}

// 静态代理类
public class UserServiceProxy implements UserService {
    private final UserService target;                     // 持有目标对象
    public UserServiceProxy(UserService target) { this.target = target; }

    @Override
    public User getById(Long id) {
        System.out.println("开始日志");                    // 增强
        User result = target.getById(id);                  // 调用目标
        System.out.println("结束日志");
        return result;
    }

    @Override
    public void save(User user) {
        checkPermission();                                 // 增强
        target.save(user);
        recordLog();
    }
}
// 缺点：接口有 100 个方法就要写 100 遍；100 个接口要写 100 个代理类 → 爆炸

// 动态代理：运行时自动生成代理类，一套逻辑处理所有接口 ★
```

**代理模式的三种实现：**

| 类型 | 生成时机 | 代表 | 特点 |
| --- | --- | --- | --- |
| 静态代理 | 编译期手写 | 上面的 UserServiceProxy | 代码冗余 |
| **JDK 动态代理** | 运行时生成 | `java.lang.reflect.Proxy` | **基于接口**，JDK 原生 |
| **CGLIB** | 运行时生成 | `Enhancer` + ASM 字节码 | **基于继承**，可代理无接口的类 |
| Javassist | 运行时生成 | 字节码编辑库 | MyBatis、Dubbo 用，API 更简单但性能略低 |

### 11. JDK 动态代理 ★★★★★

#### 11.1 基本用法

```java
import java.lang.reflect.*;

// ─── InvocationHandler：代理逻辑的载体 ───
public class LogInvocationHandler implements InvocationHandler {

    private final Object target;                       // 被代理的目标对象

    public LogInvocationHandler(Object target) {
        this.target = target;
    }

    /**
     * ★ 所有对代理对象的方法调用都会转到这里
     * @param proxy  代理对象本身（⚠️ 不是 target！在方法内调用 proxy 会导致死循环）
     * @param method 被调用的方法
     * @param args   方法参数
     */
    @Override
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        long start = System.currentTimeMillis();
        System.out.printf("[调用] %s.%s(%s)%n",
                method.getDeclaringClass().getSimpleName(),
                method.getName(),
                Arrays.toString(args));
        try {
            Object result = method.invoke(target, args);      // ★ 反射调用目标方法
            System.out.printf("[返回] %s，耗时 %d ms%n", result, System.currentTimeMillis() - start);
            return result;
        } catch (InvocationTargetException e) {
            System.err.println("[异常] " + e.getTargetException().getMessage());
            throw e.getTargetException();                     // ★ 抛出真实异常（保证事务回滚）
        }
    }
}

// ─── 创建代理对象 ───
public class ProxyDemo {
    public static void main(String[] args) {
        UserService target = new UserServiceImpl();

        UserService proxy = (UserService) Proxy.newProxyInstance(
                target.getClass().getClassLoader(),      // ① 类加载器
                target.getClass().getInterfaces(),       // ② 要代理的接口数组
                new LogInvocationHandler(target));       // ③ 调用处理器

        // 使用代理（所有方法都经过 invoke）
        proxy.getById(1L);
        proxy.save(new User());

        // 校验
        System.out.println(proxy.getClass().getName());  // com.sun.proxy.$Proxy0 ★ 运行时生成的类
        System.out.println(Proxy.isProxyClass(proxy.getClass()));   // true
        System.out.println(Proxy.getInvocationHandler(proxy));       // 拿到 handler
    }
}
```

#### 11.2 Proxy.newProxyInstance 的三个参数

```java
public static Object newProxyInstance(ClassLoader loader,        // ① 用哪个类加载器加载生成的代理类
                                      Class<?>[] interfaces,      // ② 代理类要实现的接口列表
                                      InvocationHandler h)        // ③ 方法调用的分发处理器
```

| 参数 | 说明 | 常见取值 |
| --- | --- | --- |
| `loader` | 加载动态生成的代理类 | `target.getClass().getClassLoader()`、`Thread.currentThread().getContextClassLoader()` |
| `interfaces` | 代理类实现的接口（**JDK 代理必须有接口！**） | `target.getClass().getInterfaces()` |
| `h` | 调用处理器，所有方法都转发到它的 `invoke` | 自定义 InvocationHandler |

**InvocationHandler 接口的三个方法（JDK 8+）：**

```java
public interface InvocationHandler {
    // 核心方法：处理所有代理方法调用
    Object invoke(Object proxy, Method method, Object[] args) throws Throwable;

    // JDK 16+：处理 Object 的默认方法（equals/hashCode/toString）
    default Object invokeDefault(Object proxy, Method method, Object[] args) throws Throwable {
        // 调用接口中 default 方法的原始实现（JDK 16+ 支持）
    }
}
```

#### 11.3 生成的代理类长什么样（源码剖析）★★★★★

**把生成的代理类输出到磁盘：**

```java
// JDK 8
System.setProperty("sun.misc.ProxyGenerator.saveGeneratedFiles", "true");
// JDK 9+
System.setProperty("jdk.proxy.ProxyGenerator.saveGeneratedFiles", "true");
// 运行后会在工作目录生成 com/sun/proxy/$Proxy0.class
// 用 JD-GUI / javap -c 查看
```

**生成的 `$Proxy0` 反编译后：**

```java
public final class $Proxy0 extends Proxy implements UserService {
    // ★ 所有方法的 Method 对象被缓存为静态字段（避免每次反射查找）
    private static Method m0;   // hashCode
    private static Method m1;   // equals
    private static Method m2;   // toString
    private static Method m3;   // getById
    private static Method m4;   // save

    static {
        try {
            m0 = Class.forName("java.lang.Object").getMethod("hashCode");
            m1 = Class.forName("java.lang.Object").getMethod("equals", Class.forName("java.lang.Object"));
            m2 = Class.forName("java.lang.Object").getMethod("toString");
            m3 = Class.forName("com.example.UserService").getMethod("getById", Class.forName("java.lang.Long"));
            m4 = Class.forName("com.example.UserService").getMethod("save", Class.forName("com.example.User"));
        } catch (NoSuchMethodException e) {
            throw new NoSuchMethodError(e.getMessage());
        } catch (ClassNotFoundException e) {
            throw new NoClassDefFoundError(e.getMessage());
        }
    }

    // ★ 构造器接收 InvocationHandler
    public $Proxy0(InvocationHandler h) {
        super(h);                    // Proxy 类的 protected InvocationHandler h 字段
    }

    // ★ 每个接口方法都被重写，转发到 h.invoke
    public final User getById(Long id) {
        try {
            return (User) super.h.invoke(this, m3, new Object[]{id});   // ★ 转发
        } catch (RuntimeException | Error e) {
            throw e;                       // 运行时异常直接抛
        } catch (Throwable t) {
            throw new UndeclaredThrowableException(t,
                "undeclared throwable exception invoking method getById");
        }
    }

    public final void save(User user) {
        try {
            super.h.invoke(this, m4, new Object[]{user});
        } catch (RuntimeException | Error e) {
            throw e;
        } catch (Throwable t) {
            throw new UndeclaredThrowableException(t, "...");
        }
    }

    // ★ 连 Object 的三个方法也被代理了！
    public final int hashCode() {
        try {
            return (Integer) super.h.invoke(this, m0, null);
        } catch (...) { }
    }
    public final boolean equals(Object obj) {
        try {
            return (Boolean) super.h.invoke(this, m1, new Object[]{obj});
        } catch (...) { }
    }
    public final String toString() {
        try {
            return (String) super.h.invoke(this, m2, null);
        } catch (...) { }
    }

    // 类的标识
    public final boolean isProxyClass() { return true; }
}

// Proxy 父类
public class Proxy implements Serializable {
    protected InvocationHandler h;             // ★ 持有 handler
    protected Proxy(InvocationHandler h) { this.h = h; }
}
```

**关键结论（面试必答）：**

1. **代理类继承 `Proxy` 并实现所有指定接口**，是 `final` 类。
2. **所有接口方法（含 Object 的 hashCode/equals/toString）都转发到 `h.invoke()`**。
3. **Method 对象被静态缓存**，避免每次调用都反射查找（性能优化）。
4. **参数被包装成 `Object[]`**（基本类型自动装箱，有性能损耗）。
5. **返回值需要强转**（`(User)`，可能 ClassCastException）。
6. **受检异常如果没在接口方法声明，会被包装成 `UndeclaredThrowableException`**（这是个大坑）。

> 【坑 1】**`invoke` 的第一个参数 `proxy` 不是 `target`**：
> ```java
> public Object invoke(Object proxy, Method method, Object[] args) {
>     // ❌ 死循环！proxy 的方法又会调到 invoke
>     method.invoke(proxy, args);
>     // ✅ 必须调用 target
>     method.invoke(target, args);
> }
> ```

> 【坑 2】**`UndeclaredThrowableException`**：
> ```java
> interface Service { void doIt(); }        // 没声明 throws
> class Impl implements Service {
>     public void doIt() { throw new RuntimeException("x"); }   // RuntimeException 没事
> }
> // 如果 handler 中抛出的是「接口方法未声明的受检异常」
> public Object invoke(...) throws Throwable {
>     throw new IOException("io error");    // ← 接口方法没声明 IOException
> }
> // 调用方会收到 UndeclaredThrowableException，真实异常在 getCause() 里
> // 排查时容易困惑「我的 IOException 哪去了」
> ```

> 【坑 3】**代理对象无法转成实现类**：
> ```java
> UserService proxy = (UserService) Proxy.newProxyInstance(...);
> UserServiceImpl impl = (UserServiceImpl) proxy;   // ❌ ClassCastException
> // $Proxy0 extends Proxy implements UserService，与 UserServiceImpl 无继承关系！
> // 这就是 Spring 中「JDK 代理下 @Autowired 只能用接口类型注入」的原因
> ```

#### 11.4 JDK 动态代理的完整实战封装

```java
/**
 * 通用代理工厂（支持多个增强器链式组合）
 */
public class ProxyFactory {

    @SuppressWarnings("unchecked")
    public static <T> T createProxy(T target, Interceptor... interceptors) {
        return (T) Proxy.newProxyInstance(
                target.getClass().getClassLoader(),
                target.getClass().getInterfaces(),
                new ChainedInvocationHandler(target, interceptors));
    }

    /** 拦截器接口 */
    public interface Interceptor {
        /** 返回 true 才继续执行下一个拦截器/目标方法 */
        boolean before(Object target, Method method, Object[] args);
        void afterReturning(Object target, Method method, Object[] args, Object result);
        void afterThrowing(Object target, Method method, Object[] args, Throwable ex);
        void after(Object target, Method method, Object[] args);
    }

    /** 适配器（默认空实现，只需重写关心的方法） */
    public static abstract class InterceptorAdapter implements Interceptor {
        public boolean before(Object t, Method m, Object[] a) { return true; }
        public void afterReturning(Object t, Method m, Object[] a, Object r) { }
        public void afterThrowing(Object t, Method m, Object[] a, Throwable e) { }
        public void after(Object t, Method m, Object[] a) { }
    }

    private static class ChainedInvocationHandler implements InvocationHandler {
        private final Object target;
        private final Interceptor[] interceptors;

        ChainedInvocationHandler(Object target, Interceptor[] interceptors) {
            this.target = target;
            this.interceptors = interceptors;
        }

        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            // 跳过 Object 的方法和接口的 default 方法
            if (isObjectMethod(method)) {
                return method.invoke(target, args);
            }

            Object result = null;
            boolean proceed = true;
            try {
                // 前置拦截（任一返回 false 就中断）
                for (Interceptor i : interceptors) {
                    if (!i.before(target, method, args)) { proceed = false; break; }
                }
                if (proceed) {
                    result = method.invoke(target, args);        // ★ 执行目标方法
                    for (Interceptor i : interceptors) {
                        i.afterReturning(target, method, args, result);
                    }
                }
            } catch (InvocationTargetException e) {
                Throwable real = e.getTargetException();
                for (Interceptor i : interceptors) {
                    i.afterThrowing(target, method, args, real);
                }
                throw real;                                       // ★ 抛真实异常
            } catch (IllegalAccessException e) {
                throw new RuntimeException("反射调用失败", e);
            } finally {
                for (Interceptor i : interceptors) {
                    i.after(target, method, args);
                }
            }
            return result;
        }

        private boolean isObjectMethod(Method method) {
            String name = method.getName();
            return "toString".equals(name) || "hashCode".equals(name) || "equals".equals(name);
        }
    }
}

// ─── 使用 ───
UserService proxy = ProxyFactory.createProxy(
    new UserServiceImpl(),
    // 日志拦截器
    new ProxyFactory.InterceptorAdapter() {
        @Override public boolean before(Object t, Method m, Object[] a) {
            log.info("调用 {}.{}", m.getDeclaringClass().getSimpleName(), m.getName());
            return true;
        }
    },
    // 性能监控拦截器
    new ProxyFactory.InterceptorAdapter() {
        private final ThreadLocal<Long> start = new ThreadLocal<>();
        @Override public boolean before(Object t, Method m, Object[] a) {
            start.set(System.currentTimeMillis());
            return true;
        }
        @Override public void after(Object t, Method m, Object[] a) {
            long cost = System.currentTimeMillis() - start.get();
            start.remove();
            if (cost > 1000) log.warn("慢方法：{} 耗时 {}ms", m.getName(), cost);
        }
    },
    // 权限拦截器
    new ProxyFactory.InterceptorAdapter() {
        @Override public boolean before(Object t, Method m, Object[] a) {
            if (m.isAnnotationPresent(RequiresPermission.class)) {
                String perm = m.getAnnotation(RequiresPermission.class).value();
                if (!SecurityContext.hasPermission(perm)) {
                    throw new AuthorizationException("无权限：" + perm);   // 中断执行
                }
            }
            return true;
        }
    }
);
```

> 这个封装其实就是 **Spring AOP 的简化版**：Spring 的 `JdkDynamicAopProxy` 实现了 `InvocationHandler`，内部维护一个**拦截器链（InterceptorAndDynamicMethodMatcher[]）**，用 `ReflectiveMethodInvocation.proceed()` 递归执行链上的每个拦截器。详见 [[后端/Spring/动态代理-JDK与CGLIB]]。

### 12. CGLIB 动态代理 ★★★★★

#### 12.1 基本用法

**CGLIB（Code Generation Library）基于 ASM 字节码框架，通过「继承目标类 + 重写方法」生成代理，因此不需要接口。**

```xml
<!-- Maven 依赖（Spring 已内置 cglib，无需单独引入） -->
<dependency>
    <groupId>cglib</groupId>
    <artifactId>cglib</artifactId>
    <version>3.3.0</version>
</dependency>
```

```java
import net.sf.cglib.proxy.*;

// ─── MethodInterceptor：CGLIB 的拦截器 ───
public class CglibInterceptor implements MethodInterceptor {

    /**
     * @param obj    生成的代理对象（⚠️ 不是 target，CGLIB 没有 target 概念！）
     * @param method 被拦截的方法
     * @param args   参数
     * @param proxy  ★ 方法代理（用于调用父类方法，性能优于 method.invoke）
     */
    @Override
    public Object intercept(Object obj, Method method, Object[] args, MethodProxy proxy) throws Throwable {
        System.out.println("[前置] " + method.getName());
        long start = System.currentTimeMillis();
        try {
            // ★ 调用父类（目标类）的方法：用 proxy.invokeSuper，不是 method.invoke
            Object result = proxy.invokeSuper(obj, args);
            System.out.printf("[后置] 耗时 %d ms%n", System.currentTimeMillis() - start);
            return result;
        } catch (Throwable e) {
            System.err.println("[异常] " + e.getMessage());
            throw e;
        }
    }
}

// ─── 创建代理 ───
public class CglibDemo {
    public static void main(String[] args) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(UserServiceImpl.class);      // ★ 设置父类（不是接口）
        enhancer.setCallback(new CglibInterceptor());       // 设置拦截器
        // enhancer.setCallbacks(new Callback[]{...});      // 多个回调
        // enhancer.setCallbackFilter(method -> 0);          // 按方法选择回调

        UserServiceImpl proxy = (UserServiceImpl) enhancer.create();   // ★ 可以转成实现类！
        // 带构造参数的创建
        // UserServiceImpl proxy2 = (UserServiceImpl) enhancer.create(
        //         new Class[]{String.class}, new Object[]{"initParam"});

        proxy.save(new User());                             // 走拦截器
        System.out.println(proxy.getClass().getName());
        // com.example.UserServiceImpl$$EnhancerByCGLIB$$1a2b3c4d ★ 生成的子类
        System.out.println(proxy.getClass().getSuperclass());   // class UserServiceImpl
    }
}
```

#### 12.2 CGLIB 生成的类结构

```java
// 反编译 UserServiceImpl$$EnhancerByCGLIB$$xxx
public class UserServiceImpl$$EnhancerByCGLIB$$1a2b extends UserServiceImpl {

    // ★ CGLIB 生成的三个内部辅助字段
    private boolean CGLIB$BOUND;
    public static Object CGLIB$FACTORY_DATA;
    private static final ThreadLocal CGLIB$THREAD_CALLBACKS;
    private static final Callback[] CGLIB$STATIC_CALLBACKS;
    private MethodInterceptor CGLIB$CALLBACK_0;              // ★ 我们的拦截器

    // ★ 缓存的 Method 和 MethodProxy
    private static final Method CGLIB$save$0$Method;
    private static final MethodProxy CGLIB$save$0$Proxy;
    private static final Object[] CGLIB$emptyArgs;

    static {
        CGLIB$STATICHOOK1();       // 静态初始化，反射查找所有 Method
    }

    // ★ 重写目标方法
    public final void save(User user) {
        MethodInterceptor mi = this.CGLIB$CALLBACK_0;
        if (mi != null) {
            // 走拦截器
            mi.intercept(this, CGLIB$save$0$Method, new Object[]{user}, CGLIB$save$0$Proxy);
        } else {
            super.save(user);      // 没有拦截器就直接调父类
        }
    }

    // ★ 生成「未被代理的父类方法」副本（供 invokeSuper 调用，避免死循环）
    final void CGLIB$save$0(User user) {
        super.save(user);
    }

    // ★ final/private/static 方法不会被重写（无法代理）
}
```

**`proxy.invokeSuper(obj, args)` vs `method.invoke(obj, args)`：**

| 方式 | 效果 | 性能 |
| --- | --- | --- |
| `proxy.invokeSuper(obj, args)` | 调用 CGLIB 生成的 `CGLIB$save$0`（内部 `super.save()`） | **快**（FastClass 索引直接调用，无反射） |
| `method.invoke(obj, args)` | 反射调用 → 又进入代理方法 → **无限递归 StackOverflowError** | 慢 + 死循环 |

> 【坑】**CGLIB 中绝不能用 `method.invoke(obj, args)`**（obj 是代理对象），会导致死循环。必须用 `proxy.invokeSuper(obj, args)`。
>
> CGLIB 的 **FastClass 机制**：为每个类生成一个 FastClass，把方法映射成整数索引，调用时通过 switch 直接跳转，**完全避免反射**，这是 CGLIB 比 JDK 代理性能略高的原因。

#### 12.3 CGLIB 的限制

```java
// ❌ 1. 不能代理 final 类（无法继承）
public final class FinalService { }
// Enhancer.setSuperclass(FinalService.class) → IllegalArgumentException:
//   Cannot subclass final class com.example.FinalService

// ❌ 2. 不能代理 final 方法（无法重写）
public class Service {
    public final void finalMethod() { }      // 调用它不走拦截器（直接执行）
}

// ❌ 3. 不能代理 private 方法（子类看不到，不构成重写）
private void privateMethod() { }             // 不走拦截器

// ❌ 4. 不能代理 static 方法（静态方法属于类，不参与多态）
public static void staticMethod() { }        // 不走拦截器

// ❌ 5. 构造器会被调用两次（代理类和目标类各一次！）
// ★ 因为代理是「子类实例」，创建时会执行父类构造器
public class Service {
    public Service() {
        System.out.println("构造器执行");     // 创建代理时打印一次
        this.name = generateName();          // 此时子类的字段还没初始化！
    }
}
Service proxy = (Service) enhancer.create();  // 构造器执行了

// ❌ 6. Spring Boot 2.x+ 用 Objenesis 绕过了构造器问题
// Spring 的 SpringObjenesis 直接创建对象实例，跳过构造器调用

// ⚠️ 7. JDK 17 上老版本 CGLIB 可能报错（需要 --add-opens 或升级 Spring 6）
// Spring Framework 6 已内置 repackaged cglib + 适配 JDK 17
```

#### 12.4 自调用问题（AOP 失效的经典场景）★★★★★

```java
@Service
public class OrderService {

    @Transactional
    public void createOrder(Order order) {
        saveOrder(order);                    // ❌ 内部调用，事务不生效！
        this.saveDetail(order);              // ❌ 同样不生效
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveOrder(Order order) { orderMapper.insert(order); }

    @Cacheable("detail")
    public void saveDetail(Order order) { }
}
```

**为什么失效？**

```
外部调用：
  Controller → 代理对象.createOrder() → 拦截器 → 事务开始 → 目标对象.createOrder()
                                                              ↓
内部调用（this 指向目标对象，不是代理！）：
  目标对象.createOrder() 中调用 this.saveOrder()
                              ↓
                        直接执行，绕过代理 → 无事务！

内存示意：
  Spring 容器持有：proxy（代理对象）
  proxy 内部持有：target（原始对象）
  target 的 this 指向自己 → this.saveOrder() 调的是原始方法，不经过 proxy
```

**五种解决方案：**

```java
// ✅ 方案 1：注入自己（Spring 4.3+ 支持自注入）
@Service
public class OrderService {
    @Autowired
    @Lazy                              // ★ 必须加 @Lazy，否则循环依赖
    private OrderService self;         // 注入的是代理对象

    @Transactional
    public void createOrder(Order order) {
        self.saveOrder(order);          // ✅ 通过代理调用，事务生效
    }
}

// ✅ 方案 2：AopContext 获取当前代理（需开启 exposeProxy）
// 配置：@EnableAspectJAutoProxy(exposeProxy = true)
//      或 spring.aop.proxy-target-class=true + exposeProxy
@Service
public class OrderService {
    @Transactional
    public void createOrder(Order order) {
        OrderService proxy = (OrderService) AopContext.currentProxy();
        proxy.saveOrder(order);          // ✅
    }
}
// 原理：AopContext 用 ThreadLocal 存当前代理对象（CglibAopProxy/JdkDynamicAopProxy 在 invoke 时设置）

// ✅ 方案 3：从 ApplicationContext 获取
@Service
public class OrderService implements ApplicationContextAware {
    private ApplicationContext ctx;
    @Override public void setApplicationContext(ApplicationContext c) { this.ctx = c; }

    public void createOrder(Order order) {
        ctx.getBean(OrderService.class).saveOrder(order);    // ✅
    }
}

// ✅ 方案 4：拆分到不同的 Bean（★ 最佳实践，符合单一职责）
@Service
public class OrderService {
    @Autowired private OrderTxService orderTxService;      // 拆出事务方法
    public void createOrder(Order order) {
        orderTxService.saveOrder(order);                    // ✅ 跨 Bean 调用，走代理
    }
}
@Service
public class OrderTxService {
    @Transactional
    public void saveOrder(Order order) { orderMapper.insert(order); }
}

// ✅ 方案 5：手动编程式事务（不依赖代理）
@Service
public class OrderService {
    @Autowired private TransactionTemplate txTemplate;
    public void createOrder(Order order) {
        txTemplate.execute(status -> {
            saveOrder(order);
            return null;
        });
    }
}
```

> 【推荐】**方案 4（拆分类）是最优解**：既解决了自调用问题，又符合单一职责原则，还让事务边界清晰。方案 1/2/3 是「绕过」而非「解决」，会让代码可读性下降。

### 13. JDK 代理 vs CGLIB 全面对比 ★★★★★

| 对比项 | JDK 动态代理 | CGLIB |
| --- | --- | --- |
| 实现原理 | `java.lang.reflect.Proxy` + `InvocationHandler` | ASM 字节码框架生成子类 |
| 代理方式 | **实现接口** | **继承目标类** |
| 是否需要接口 | **必须有接口** | 不需要 |
| 生成的类 | `$Proxy0 extends Proxy implements 接口` | `Target$$EnhancerByCGLIB$$xxx extends Target` |
| 能否转为实现类 | ❌ ClassCastException | ✅ 可以 |
| 调用方式 | `method.invoke(target, args)`（反射） | `proxy.invokeSuper()`（**FastClass，无反射**） |
| final 类 | ✅ 可代理（代理的是接口） | ❌ 不能 |
| final/private/static 方法 | ✅ 接口方法都可代理 | ❌ 无法拦截 |
| 构造器调用 | 不调用目标类构造器（target 已存在） | ⚠️ 会调用（Spring 用 Objenesis 规避） |
| 依赖 | JDK 原生 | 需 cglib 库（Spring 已内置 repackaged 版本） |
| 性能（创建） | **快**（生成字节码简单） | 慢（ASM 生成子类 + FastClass） |
| 性能（调用） | 略慢（反射 + 参数装箱） | **略快**（FastClass 直接索引调用） |
| JDK 兼容 | 全版本 | JDK 17+ 需要新版本（Spring 6 已适配） |

**性能实测（1000 万次调用，参考值）：**

| 场景 | 直接调用 | JDK 代理 | CGLIB |
| --- | --- | --- | --- |
| 创建 1 万个代理 | — | ~150 ms | ~400 ms |
| 1000 万次方法调用 | ~20 ms | ~280 ms | ~230 ms |

> **结论：创建 JDK 代理快，调用 CGLIB 快。** 但差距在现代 JVM 上已不明显（JIT 会内联优化），**选型主要看「有没有接口」而非性能**。

#### Spring 的选择策略（版本演进）★★★★★

| 版本 | 默认策略 |
| --- | --- |
| Spring 4.x 及以前 | **有接口 → JDK 代理；无接口 → CGLIB** |
| **Spring Boot 2.x+** | **默认全部用 CGLIB**（`spring.aop.proxy-target-class=true` 默认 true） |
| Spring Framework 6 / Boot 3 | 默认 CGLIB，但优化了生成逻辑 |

**为什么 Spring Boot 2 改成默认 CGLIB？**

1. **解决注入问题**：JDK 代理下 `@Autowired UserServiceImpl impl` 会失败（代理只能转成接口），CGLIB 代理可以转成实现类，**减少了一大类新手困惑**。
2. **避免 `@Configuration` 的问题**：`@Configuration` 类需要代理来保证 `@Bean` 方法的单例语义，而这些类通常没接口 → 必须 CGLIB。
3. **一致性**：所有 Bean 用同一种代理方式，行为可预测。

```java
// 显式控制代理方式
@EnableAspectJAutoProxy(proxyTargetClass = true)     // true = 强制 CGLIB；false = 有接口用 JDK
// application.yml
spring:
  aop:
    proxy-target-class: true      # Spring Boot 2.x 默认 true
```

```java
// JDK 代理下的经典报错
@Autowired
private UserServiceImpl userServiceImpl;     // ❌ 注入失败
// Field userServiceImpl required a bean of type 'UserServiceImpl' that could not be found.
// 因为容器里的 Bean 是 $Proxy0，不是 UserServiceImpl

// ✅ 改为注入接口
@Autowired
private UserService userService;             // ✅

// CGLIB 下两种都可以（因为代理是 UserServiceImpl 的子类）
```

### 14. 动态代理的其他实现

#### 14.1 Javassist（MyBatis、Dubbo 使用）

```java
import javassist.*;

// Javassist 用「源码字符串」或「字节码 API」生成类，比 ASM 更简单
ClassPool pool = ClassPool.getDefault();
CtClass cc = pool.makeClass("com.example.GeneratedService");

// 添加字段
CtField field = CtField.make("private String name;", cc);
cc.addField(field);

// 添加方法（直接写 Java 源码字符串！）
CtMethod method = CtMethod.make(
    "public String getName() { " +
    "   System.out.println(\"getName called\"); " +
    "   return this.name; " +
    "}", cc);
cc.addMethod(method);

// 生成 Class
Class<?> clazz = cc.toClass();
Object obj = clazz.getDeclaredConstructor().newInstance();

// 修改已有类（插入代码）
CtClass target = pool.get("com.example.UserService");
CtMethod m = target.getDeclaredMethod("save");
m.insertBefore("System.out.println(\"before\");");      // 方法前插入
m.insertAfter("System.out.println(\"after\");");        // 方法后插入
m.insertAt(5, "System.out.println(\"line 5\");");       // 指定行插入
Class<?> enhanced = target.toClass();
```

| 对比 | JDK Proxy | CGLIB(ASM) | Javassist |
| --- | --- | --- | --- |
| 生成方式 | 字节码 API | 字节码 API | **源码字符串**（简单） |
| 性能 | 中 | **高** | 略低（源码需编译） |
| 学习成本 | 低 | 高（ASM 很底层） | **低** |
| 使用者 | Spring AOP（接口） | Spring AOP、@Configuration | **MyBatis（延迟加载）、Dubbo** |

#### 14.2 Byte Buddy（现代选择，Mockito 使用）

```java
// Byte Buddy：类型安全的字节码生成 API（比 ASM/CGLIB 更现代，活跃维护）
Class<?> proxyType = new ByteBuddy()
    .subclass(UserServiceImpl.class)
    .method(ElementMatchers.named("save"))
    .intercept(MethodDelegation.to(new MyInterceptor()))
    .make()
    .load(getClass().getClassLoader())
    .getLoaded();

public class MyInterceptor {
    @RuntimeType
    public static Object intercept(@SuperCall Callable<?> callable) throws Exception {
        System.out.println("before");
        Object result = callable.call();
        System.out.println("after");
        return result;
    }
}
```

**使用者**：Mockito 2+、Hibernate 5.2+、Spring Framework 6（部分场景替代 CGLIB）。

#### 14.3 字节码增强框架对比

| 框架 | 抽象层次 | 性能 | 维护状态 | 使用者 |
| --- | --- | --- | --- | --- |
| **ASM** | 最底层（直接操作字节码指令） | **最快** | 活跃 | CGLIB、Spring、JaCoCo |
| **Javassist** | 源码字符串级 | 中 | 维护中 | MyBatis、Hibernate（旧）、Dubbo |
| **CGLIB** | 封装 ASM 的高级 API | 快 | **停滞**（3.3.0，2019） | Spring（repackaged） |
| **Byte Buddy** | 类型安全的 DSL | 快 | **活跃** | Mockito、Hibernate、Spring 6 |
| **JDK Proxy** | JDK 原生 | 中 | JDK 维护 | Spring AOP |

### 15. 动态代理的框架应用地图

```
┌──────────────────────────────────────────────────────────────┐
│                    动态代理在框架中的应用                       │
├──────────────────────────────────────────────────────────────┤
│ Spring AOP                                                     │
│   @Transactional → 事务切面代理（PlatformTransactionManager）    │
│   @Async          → 异步执行代理                                │
│   @Cacheable      → 缓存切面代理                                │
│   @Validated      → 方法级参数校验代理                           │
│   @Configuration  → CGLIB 代理保证 @Bean 单例语义                │
│   自定义 @Aspect    → AOP 切面                                   │
├──────────────────────────────────────────────────────────────┤
│ MyBatis                                                        │
│   Mapper 接口      → JDK 动态代理（MapperProxy）★ 无实现类也能调用 │
│   延迟加载          → Javassist 生成代理实体                     │
├──────────────────────────────────────────────────────────────┤
│ Spring MVC                                                     │
│   @Controller 方法 → HandlerAdapter 反射调用（非代理，是反射）      │
│   Feign Client     → JDK 动态代理（远程调用）                     │
├──────────────────────────────────────────────────────────────┤
│ RPC 框架                                                       │
│   Dubbo            → Javassist/JDK 生成 Stub 代理（远程调用）      │
│   OpenFeign        → JDK 动态代理 + LoadBalancer                 │
├──────────────────────────────────────────────────────────────┤
│ 测试                                                           │
│   Mockito          → Byte Buddy 生成 Mock 对象                   │
├──────────────────────────────────────────────────────────────┤
│ 监控与诊断                                                      │
│   SkyWalking/Arthas → Java Agent + Byte Buddy 字节码增强          │
│   JRebel           → 热部署，运行时替换类                          │
└──────────────────────────────────────────────────────────────┘
```

**MyBatis Mapper 代理示例（最经典的 JDK 动态代理应用）：**

```java
// MyBatis 中只有接口没有实现类，却能调用方法
public interface UserMapper {
    @Select("SELECT * FROM user WHERE id = #{id}")
    User selectById(Long id);
}

// MyBatis 的 MapperProxyFactory 生成代理
public class MapperProxyFactory<T> {
    private final Class<T> mapperInterface;

    public T newInstance(SqlSession sqlSession) {
        final MapperProxy<T> mapperProxy =
            new MapperProxy<>(sqlSession, mapperInterface, methodCache);
        return (T) Proxy.newProxyInstance(
            mapperInterface.getClassLoader(),
            new Class[]{mapperInterface},
            mapperProxy);
    }
}

// MapperProxy 的 invoke：根据方法找到对应的 SQL 并执行
public class MapperProxy<T> implements InvocationHandler {
    public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
        if (Object.class.equals(method.getDeclaringClass())) {
            return method.invoke(this, args);           // Object 方法直接调
        }
        if (method.isDefault()) {
            return invokeDefaultMethod(proxy, method, args);   // 接口 default 方法
        }
        // ★ 核心：找到 MapperMethod（缓存），执行 SQL
        return cachedInvoker(method).invoke(proxy, method, args, sqlSession);
    }
}
// MapperMethod.invoke 内部根据方法类型（INSERT/UPDATE/DELETE/SELECT）
// 调用 sqlSession.insert/update/delete/selectOne/selectList
```

### 16. 常见坑汇总

| # | 坑 | 现象 | 解决 |
| --- | --- | --- | --- |
| 1 | `newInstance()` 的异常被包装 | 拿不到真实异常 | `getTargetException()` |
| 2 | 反射调用抛 `InvocationTargetException` | 事务不回滚 | 抛出 target 异常 |
| 3 | 未 `setAccessible(true)` 访问私有 | `IllegalAccessException` | 打开访问权限 |
| 4 | 反射参数名是 arg0 | MyBatis/@PathVariable 失效 | 编译加 `-parameters` |
| 5 | JDK 9+ 反射 JDK 内部类失败 | `InaccessibleObjectException` | `--add-opens` |
| 6 | 修改 final 字段（JDK 12+） | `IllegalAccessException` | 改用可变设计或 VarHandle |
| 7 | 每次反射都 getMethod | 性能差 60 倍 | 缓存 Method 对象 |
| 8 | `invoke` 中用 proxy 调方法 | 无限递归 StackOverflow | 用 target |
| 9 | JDK 代理强转实现类 | `ClassCastException` | 注入接口类型或用 CGLIB |
| 10 | CGLIB 中 `method.invoke(obj)` | 死循环 | 用 `proxy.invokeSuper` |
| 11 | CGLIB 代理 final 类 | `IllegalArgumentException` | 去掉 final 或用 JDK 代理 |
| 12 | final/private/static 方法不被增强 | 事务/缓存/日志失效 | 改为 public 非 final |
| 13 | AOP 自调用失效 | `@Transactional` 不生效 | 拆类 / 注入 self / AopContext |
| 14 | `UndeclaredThrowableException` | 看不到真实异常 | 检查 handler 抛的受检异常是否声明 |
| 15 | CGLIB 构造器执行两次 | 初始化逻辑重复 | Spring 用 Objenesis 规避 |
| 16 | 代理类的 hashCode/equals 也被拦截 | 集合行为异常 | handler 中特殊处理 Object 方法 |
| 17 | 桥接方法被反射重复处理 | 注解被处理两次 | 过滤 `isBridge()`/`isSynthetic()` |
| 18 | 反射遍历方法漏了父类的 | 注解未生效 | 递归向上遍历 `getSuperclass()` |
| 19 | 静态字段反射 `get(obj)` | 传 obj 也行但语义不清 | 静态成员传 `null` |
| 20 | 反射创建泛型数组 | `new T[]` 编译错误 | `Array.newInstance(clazz, size)` |

---

## 关联笔记

- 上一篇：[[后端/Java基础/IO流与文件操作]]
- 下一篇：[[后端/Java基础/Java8新特性-Lambda与Stream]]
- 相关：[[后端/Java基础/泛型枚举与注解]]（注解读取靠反射）
- 深入：[[后端/Spring/动态代理-JDK与CGLIB]]（Spring AOP 中的完整应用）、[[后端/Spring/AOP面向切面编程]]
- 框架应用：[[后端/MyBatis/MyBatis入门与核心配置]]（Mapper 动态代理原理）
- 返回索引：[[后端/Java/Java学习笔记总索引]]
