# 前后端协作

前后端分离之后，接口就是双方的"合同"：设计、错误处理、类型共享，全都需要提前约定好。

## API 设计规范

**RESTful 风格**

```
GET    /api/resources         # 列表
GET    /api/resources/:id     # 详情
POST   /api/resources         # 创建
PUT    /api/resources/:id     # 更新（全量）
PATCH  /api/resources/:id     # 更新（部分）
DELETE /api/resources/:id     # 删除
```

**统一响应格式**

```json
// 成功
{
  "success": true,
  "data": { ... }
}

// 失败
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": { ... }
  }
}

// 分页
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**错误处理**

- 后端：所有异常收敛到全局错误处理器，统一输出 error 结构（code/message/details），未知错误记录日志后返回 500
- 前端：请求层统一封装，非 2xx 时读取 error.message 提示用户，业务代码不散落 try/catch

## 类型共享（TypeScript）

把前后端共享的类型（如 User、Post、CreatePostDTO）放进独立的 shared 目录或 npm 包，前后端从同一处 import，保证类型只有单一来源；进阶可用 monorepo 让两端直接引用同一份源码。
