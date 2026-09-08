---
created: 2024-01-20
updated: 2024-01-20
parent: "[[后端/Java/Java学习笔记总索引]]"
tags:
  - Java
  - Seata
  - 分布式事务
  - 微服务
---

# Seata分布式事务

> **核心定位**：Seata 是阿里巴巴开源的分布式事务解决方案，提供 AT / TCC / Saga / XA 四种模式，AT 模式无侵入、最常用。

## 1. 分布式事务问题

```
┌─────────────────────────────────────────────┐
│ 分布式事务问题                                │
├─────────────────────────────────────────────┤
│                                              │
│  订单服务（DB-A）                             │
│    INSERT INTO order ...                     │
│    ↓ 调用 Feign                               │
│  库存服务（DB-B）                             │
│    UPDATE stock SET qty=qty-1                │
│    ↓ 调用 Feign                               │
│  账户服务（DB-C）                             │
│    UPDATE account SET balance=balance-100    │
│                                              │
│  问题：三个操作在三个数据库                  │
│  → 一个 @Transactional 管不了三个数据库      │
│  → 库存扣了但账户没扣 → 数据不一致            │
│                                              │
│  ★ Seata 解决：跨数据库/跨服务的事务          │
└─────────────────────────────────────────────┘
```

## 2. Seata 架构

```
┌─────────────────────────────────────────────┐
│ Seata 架构                                   │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────┐                           │
│  │    TC (Server) │  事务协调者             │
│  │  维护全局事务状态 │  独立部署             │
│  └──────┬──────┘                           │
│         │                                      │
│  ┌──────┴──────┬──────────┐                 │
│  │             │           │                   │
│  ↓             ↓           ↓                   │
│ ┌─────┐   ┌─────┐   ┌─────┐                 │
│ │TM    │   │RM   │   │RM   │                 │
│ │订单  │   │库存  │   │账户  │                 │
│ │服务  │   │服务  │   │服务  │                 │
│ └─────┘   └─────┘   └─────┘                 │
│                                              │
│  TM：事务管理器（开启/提交/回滚全局事务）    │
│  RM：资源管理器（管理本地分支事务）          │
│  TC：事务协调者（维护全局事务状态）          │
└─────────────────────────────────────────────┘
```

## 3. AT 模式（无侵入）

```
┌─────────────────────────────────────────────┐
│ Seata AT 模式流程                            │
├─────────────────────────────────────────────┤
│                                              │
│ 1. TM 开启全局事务                           │
│    → TC 生成 XID（全局事务 ID）              │
│                                              │
│ 2. RM 执行本地 SQL + 记录 undo_log           │
│    → 执行前：记录前镜像（before image）       │
│    → 执行 SQL                                 │
│    → 执行后：记录后镜像（after image）         │
│    → 注册分支事务到 TC                        │
│                                              │
│ 3. 各 RM 执行完毕                             │
│                                              │
│ 4. TM 提交/回滚                              │
│    提交：TC 通知各 RM 删除 undo_log           │
│    回滚：TC 通知各 RM 用 undo_log 反向回滚   │
│                                              │
│ ★ AT 模式特点：                              │
│   - ★ 无侵入（只需加 @GlobalTransactional） │
│   - 自动生成 undo_log（基于 SQL 解析）       │
│   - 适用于大部分场景                          │
│   - 缺点：有短暂的数据不一致窗口             │
└─────────────────────────────────────────────┘
```

```java
// ★ 使用：只需加一个注解
@GlobalTransactional(rollbackFor = Exception.class)
public void createOrder(OrderDTO dto) {
    // 1. 创建订单（本地事务）
    orderMapper.insert(order);
    
    // 2. 远程调用扣减库存
    Result<?> stockResult = stockClient.deduct(dto.getSkuId(), dto.getQuantity());
    if (!stockResult.isSuccess()) throw new BusinessException("库存不足");
    
    // 3. 远程调用扣减余额
    Result<?> accountResult = accountClient.deduct(dto.getUserId(), dto.getAmount());
    if (!accountResult.isSuccess()) throw new BusinessException("余额不足");
    
    // 4. 任意一步失败 → 全部回滚（包括远程服务）
}
```

## 4. TCC 模式（手动补偿）

```java
// TCC：Try-Confirm-Cancel
// ★ 需要实现三个方法（业务侵入大，但性能好）

public interface StockTccAction {
    
    @TwoPhaseBusinessAction(name = "deductStock",
        commitMethod = "confirm", rollbackMethod = "cancel")
    boolean prepare(BusinessActionContext ctx,
                    @BusinessActionContextParameter(paramName = "skuId") Long skuId,
                    @BusinessActionContextParameter(paramName = "quantity") int quantity);
    
    boolean confirm(BusinessActionContext ctx);   // 确认
    boolean cancel(BusinessActionContext ctx);    // 取消
}

// 实现
@Service
public class StockTccActionImpl implements StockTccAction {
    
    @Override
    public boolean prepare(BusinessActionContext ctx, Long skuId, int quantity) {
        // Try：预扣减（冻结库存）
        // UPDATE stock SET available = available - #{qty}, frozen = frozen + #{qty}
        // WHERE sku_id = #{skuId} AND available >= #{qty}
        return stockMapper.freeze(skuId, quantity) > 0;
    }
    
    @Override
    public boolean confirm(BusinessActionContext ctx) {
        // Confirm：扣减冻结的库存
        // UPDATE stock SET frozen = frozen - #{qty} WHERE sku_id = #{skuId}
        Long skuId = ctx.getActionContext("skuId");
        int quantity = ctx.getActionContext("quantity");
        return stockMapper.deductFrozen(skuId, quantity) > 0;
    }
    
    @Override
    public boolean cancel(BusinessActionContext ctx) {
        // Cancel：解冻库存（回滚）
        // UPDATE stock SET available = available + #{qty}, frozen = frozen - #{qty}
        Long skuId = ctx.getActionContext("skuId");
        int quantity = ctx.getActionContext("quantity");
        return stockMapper.unfreeze(skuId, quantity) > 0;
    }
}
```

## 5. 方案对比

```
┌─────────────────────────────────────────────┐
│ 分布式事务方案对比                            │
├──────────┬────────┬────────┬───────────────┤
│ 方案      │ AT     │ TCC    │ 消息最终一致  │
├──────────┼────────┼────────┼───────────────┤
│ 侵入性    │★ 无   │ 高     │ 中           │
│ 性能      │ 中     │ ★ 高  │ ★ 最高      │
│ 一致性    │ 最终   │ 强     │ 最终         │
│ 复杂度    │ ★ 低  │ 高     │ 中           │
│ 适用      │★ 通用 │高性能  │ 异步场景     │
│           │默认   │金融    │ 通知/对账    │
└──────────┴────────┴────────┴───────────────┘

★ 推荐：
  - 快速接入 → AT 模式（加一个注解）
  - 高性能要求 → TCC 模式
  - 异步解耦 → 消息最终一致性
```

## 6. 常见问题

```
┌─────────────────────────────────────────────┐
│ Seata 常见问题                              │
├─────────────────────────────────────────────┤
│ 1. undo_log 表                              │
│    - ★ 每个数据库都要建 undo_log 表         │
│    - AT 模式必需                             │
│                                              │
│ 2. 数据源代理                                │
│    - Seata 自动代理 DataSource              │
│    - 多数据源需指定 @Primary                │
│                                              │
│ 3. XID 传递                                  │
│    - OpenFeign 自动传递 XID                  │
│    - 手动 HTTP 调用需手动传递 XID            │
│                                              │
│ 4. 悬挂与空回滚                              │
│    - TCC 模式需处理（try 未执行先 cancel）  │
│    - ★ 幂等设计                              │
│                                              │
│ 5. 死锁                                      │
│    - 多个全局事务同时操作同一行              │
│    - ★ 合理设计全局锁超时                   │
└─────────────────────────────────────────────┘
```

## 关联笔记

- [[后端/Spring/事务管理与失效场景]]：本地事务
- [[后端/消息队列/消息可靠性与常见问题]]：消息最终一致性
- [[后端/微服务/OpenFeign服务调用]]：Feign 传递 XID
