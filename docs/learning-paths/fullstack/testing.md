# 测试

测试不是"写完了再说"，而是给重构兜底的安全网。前端管交互，后端管接口，两手都要抓。
## 前端测试

单元测试：用 Testing Library 的 render/screen/fireEvent 渲染组件、模拟点击并断言回调；E2E 用 Playwright 走真实用户路径（打开页面 → 填表提交 → 断言跳转与结果展示）。

## 后端测试

接口测试：用 supertest 直接请求 app，先获取 JWT token 再带 Authorization 头调用接口，断言状态码与响应体关键字段（id、title 等）。

