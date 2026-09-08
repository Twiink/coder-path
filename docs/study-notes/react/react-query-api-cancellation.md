---
title: "React-Query-vs-API-Cancel"
aliases:
  - "React Query vs API 请求取消机制详解"
tags:
  - "前端"
  - "react"
  - "对比"
category: "前端"
folder: "React"
parent: "[[前端/React/react]]"
related:
  - "[[前端/React/react]]"
  - "[[前端/React/附02：React扩展阅读]]"
  - "[[前端/React/React-Vue-Lifecycle]]"
created: 2026-04-03
updated: 2026-04-04
---

# React Query vs API 请求取消机制详解

## 目录
- [核心概念](#核心概念)
- [React 实现方案](#react-实现方案)
- [Vue 实现方案](#vue-实现方案)
- [两者对比](#两者对比)
- [最佳实践](#最佳实践)

---

## 核心概念

### 问题背景

在现代前端应用中，我们需要解决两个层面的问题：

1. **HTTP 请求层面**：防止重复的网络请求（毫秒级）
2. **应用数据层面**：管理数据状态、缓存、共享（分钟级）

### 分层架构

```
┌─────────────────────────────────────┐
│   组件层 (Component Layer)           │
│   - 使用数据                         │
│   - 触发请求                         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   数据管理层 (Data Management)       │
│   - React Query / TanStack Query    │
│   - 缓存管理                         │
│   - 状态管理                         │
│   - 跨组件共享                       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   API 封装层 (API Layer)             │
│   - 请求拦截器                       │
│   - 请求去重 (cancelManager)         │
│   - Token 管理                       │
│   - 错误处理                         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   HTTP 客户端 (axios)                │
└─────────────────────────────────────┘
```

---

## React 实现方案

### 1. API 封装层 - 请求取消机制

#### 作用
- **请求去重**：防止完全相同的请求同时发起
- **取消重复请求**：自动取消旧的重复请求
- **生命周期**：请求开始 → 请求结束（几百毫秒）

#### 实现代码

```typescript
// src/api/utils/cancel.ts
class CancelManager {
  private pendingRequests = new Map<string, CancelTokenSource>()

  addPendingRequest(url: string, method: string, params?: unknown): CancelTokenSource {
    const requestKey = generateRequestKey(url, method, params)

    // 如果存在相同的请求，先取消它
    this.removePendingRequest(requestKey)

    // 创建新的取消令牌
    const cancelToken = axios.CancelToken.source()
    this.pendingRequests.set(requestKey, cancelToken)

    return cancelToken
  }

  removePendingRequest(requestKey: string): void {
    const cancelToken = this.pendingRequests.get(requestKey)
    if (cancelToken) {
      cancelToken.cancel('请求已取消')
      this.pendingRequests.delete(requestKey)
    }
  }
}
```

#### 使用场景

```typescript
// 场景：用户快速点击两次按钮
onClick={() => {
  authApi.getUserInfo() // 请求 1
  authApi.getUserInfo() // 请求 2（立即取消请求 1）
}}
```

### 2. React Query - 数据状态管理

#### 作用
- **缓存管理**：避免重复请求相同数据
- **跨组件共享**：多个组件共享同一份数据
- **自动状态管理**：loading、error、data 状态
- **后台自动更新**：窗口聚焦、定时刷新
- **生命周期**：数据获取 → 缓存 → 过期 → 重新获取（分钟级别）

#### 全局配置

```typescript
// src/providers/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5分钟内数据视为新鲜
      gcTime: 10 * 60 * 1000,        // 10分钟后清理缓存
      retry: 1,                       // 失败后重试1次
      refetchOnWindowFocus: false,    // 窗口聚焦时不自动重新请求
    },
  },
})

export const QueryProvider = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)
```

#### 组件中使用

```tsx
// src/pages/Dashboard/index.tsx
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/api/modules/auth'

export default function DashboardLayout() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['userInfo'],
    queryFn: async () => {
      const response = await authApi.getUserInfo()
      return response.data
    },
  })

  if (isLoading) return <div>加载中...</div>
  if (error) return <div>错误: {error.message}</div>

  return (
    <div>
      <DashboardHeader user={data} />
      <DashboardSidebar />
      <Outlet />
    </div>
  )
}
```

#### 跨组件数据共享

```tsx
// Header 组件
const { data: user } = useQuery({
  queryKey: ['userInfo'],
  queryFn: () => authApi.getUserInfo()
})

// Sidebar 组件
const { data: user } = useQuery({
  queryKey: ['userInfo'],
  queryFn: () => authApi.getUserInfo()
})

// ✅ 两个组件共享同一份数据，只请求一次
// ✅ 5分钟内不会重复请求
```

### 3. 对比：传统方式 vs React Query

#### ❌ 传统方式（需要手写大量代码）

```tsx
export default function DashboardLayout() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const fetchUser = async () => {
      try {
        setLoading(true)
        const response = await authApi.getUserInfo()
        if (!cancelled) {
          setUser(response.data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchUser()

    return () => { cancelled = true }
  }, [])

  // 还需要手动处理：
  // - 缓存逻辑
  // - 重试逻辑
  // - 窗口聚焦刷新
  // - 跨组件共享
  // - 数据过期
}
```

#### ✅ 使用 React Query（3行代码）

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['userInfo'],
  queryFn: () => authApi.getUserInfo()
})
```

---

## Vue 实现方案

### 1. TanStack Query (Vue Query) - 推荐 ⭐⭐⭐⭐⭐

**和 React Query 是同一个团队开发的！API 几乎完全一致。**

#### 安装

```bash
npm install @tanstack/vue-query
```

#### 全局配置

```typescript
// main.ts
import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './App.vue'

const app = createApp(App)

app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,      // 5分钟内数据视为新鲜
        gcTime: 10 * 60 * 1000,        // 10分钟后清理缓存
        retry: 1,                       // 失败后重试1次
        refetchOnWindowFocus: false,    // 窗口聚焦时不自动重新请求
      }
    }
  }
})

app.mount('#app')
```

#### 组件中使用

```vue
<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { authApi } from '@/api/modules/auth'

// 和 React Query 几乎一模一样的 API
const { data, isLoading, error } = useQuery({
  queryKey: ['userInfo'],
  queryFn: async () => {
    const response = await authApi.getUserInfo()
    return response.data
  }
})
</script>

<template>
  <div v-if="isLoading">加载中...</div>
  <div v-else-if="error">错误: {{ error.message }}</div>
  <div v-else>
    <DashboardHeader :user="data" />
    <DashboardSidebar />
    <RouterView />
  </div>
</template>
```

#### 跨组件数据共享

```vue
<!-- Header.vue -->
<script setup lang="ts">
const { data: user } = useQuery({
  queryKey: ['userInfo'],
  queryFn: () => authApi.getUserInfo()
})
</script>

<!-- Sidebar.vue -->
<script setup lang="ts">
const { data: user } = useQuery({
  queryKey: ['userInfo'],
  queryFn: () => authApi.getUserInfo()
})
</script>

<!-- ✅ 两个组件共享同一份数据，只请求一次 -->
```

### 2. VueUse - 轻量级方案

适合简单场景，不需要复杂缓存管理。

```bash
npm install @vueuse/core
```

```vue
<script setup lang="ts">
import { useFetch } from '@vueuse/core'

const { data, error, isFetching } = useFetch('/api/user').json()
</script>

<template>
  <div v-if="isFetching">加载中...</div>
  <div v-else>{{ data }}</div>
</template>
```

**局限性**：
- 缓存功能较弱
- 不支持跨组件共享
- 没有自动重试、乐观更新等高级功能

### 3. Pinia + 自定义 Composable - 传统方式

```typescript
// stores/user.ts
import { defineStore } from 'pinia'
import { authApi } from '@/api/modules/auth'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const fetchUser = async () => {
    // 简单缓存：如果已有数据就不请求
    if (user.value) return

    loading.value = true
    error.value = null

    try {
      const response = await authApi.getUserInfo()
      user.value = response.data
    } catch (err) {
      error.value = err
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, fetchUser }
})
```

```vue
<script setup lang="ts">
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onMounted(() => {
  userStore.fetchUser()
})
</script>

<template>
  <div v-if="userStore.loading">加载中...</div>
  <div v-else>{{ userStore.user }}</div>
</template>
```

**局限性**：
- 需要手写缓存逻辑
- 需要手写重试逻辑
- 需要手写数据过期逻辑
- 代码量大，维护成本高

---

## 两者对比

### 功能对比表

| 功能 | API 封装层 (cancelManager) | React Query / TanStack Query |
|------|---------------------------|------------------------------|
| **请求去重** | ✅ 毫秒级（防止重复点击） | ✅ 分钟级（缓存） |
| **取消请求** | ✅ 取消重复的 HTTP 请求 | ❌ 不取消，复用 Promise |
| **缓存数据** | ❌ | ✅ 核心功能 |
| **跨组件共享** | ❌ | ✅ 核心功能 |
| **自动重试** | ❌ | ✅ 可配置 |
| **后台刷新** | ❌ | ✅ 窗口聚焦、定时刷新 |
| **加载状态** | ❌ | ✅ isLoading, isFetching |
| **错误处理** | ✅ 统一错误处理 | ✅ error 状态 |
| **乐观更新** | ❌ | ✅ 支持 |
| **无限滚动** | ❌ | ✅ useInfiniteQuery |

### Vue 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **TanStack Query** | • 功能最强大<br>• 和 React Query 一致<br>• 官方维护 | • 需要学习新 API<br>• 包体积稍大 | 中大型项目 |
| **VueUse** | • 轻量级<br>• 开箱即用<br>• 符合 Vue 习惯 | • 缓存功能弱<br>• 无跨组件共享 | 简单数据获取 |
| **Pinia + Composable** | • 完全可控<br>• 符合 Vue 传统 | • 需要手写大量逻辑<br>• 维护成本高 | 需要深度定制 |

---

## 最佳实践

### 1. 为什么需要两层？

```
API 封装层：管理 HTTP 请求本身
    ↓
    • 请求拦截
    • Token 注入
    • 请求去重（防止重复点击）
    • 错误统一处理

数据管理层：管理应用的数据状态
    ↓
    • 数据缓存（避免重复请求）
    • 跨组件共享
    • 自动刷新
    • 状态管理
```

### 2. 开发模式下的"两次请求"

在 React 18+ 的 Strict Mode 下：

```
组件第一次挂载 → React Query 发起请求 A
组件第二次挂载 → React Query 发起请求 B
API 层检测到重复 → 取消请求 A
控制台打印错误 → "请求已取消"
```

**这是正常行为**：
- ✅ 开发模式：帮助发现副作用问题
- ✅ 生产模式：只会请求一次

### 3. 推荐配置

#### React 项目

```typescript
// QueryProvider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5分钟缓存
      gcTime: 10 * 60 * 1000,        // 10分钟后清理
      retry: 1,                       // 重试1次
      refetchOnWindowFocus: false,    // 不自动刷新
    },
  },
})
```

#### Vue 项目

```typescript
// main.ts
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      }
    }
  }
})
```

### 4. 何时使用哪个方案？

#### 使用 TanStack Query (React/Vue)
- ✅ 需要缓存数据
- ✅ 多个组件使用相同数据
- ✅ 需要自动刷新
- ✅ 需要乐观更新
- ✅ 中大型项目

#### 使用 VueUse (仅 Vue)
- ✅ 简单的数据获取
- ✅ 不需要复杂缓存
- ✅ 小型项目

#### 使用 Pinia/Redux
- ✅ 需要深度定制
- ✅ 复杂的业务逻辑
- ✅ 需要完全控制数据流

### 5. API 封装层配置

```typescript
// 请求去重配置
const config = {
  enableDedup: true,  // 启用请求去重
}

// 特定请求禁用去重
authApi.getUserInfo({
  enableDedup: false  // 允许重复请求
})
```

---

## 总结

### 核心要点

1. **API 封装层** 和 **数据管理层** 是两个不同的层面，各司其职
2. **API 封装层** 负责 HTTP 请求的去重和取消（毫秒级）
3. **React Query / TanStack Query** 负责数据状态管理和缓存（分钟级）
4. **Vue 和 React 可以使用同一套方案**（TanStack Query）
5. **两者配合使用才是最佳实践**

### 快速决策

```
需要数据缓存？ → 使用 TanStack Query
需要跨组件共享？ → 使用 TanStack Query
需要自动刷新？ → 使用 TanStack Query
只是简单获取数据？ → VueUse (Vue) / 原生 fetch (React)
需要深度定制？ → Pinia (Vue) / Redux (React)
```

---

## 参考资源

- [TanStack Query 官方文档](https://tanstack.com/query/latest)
- [React Query 文档](https://tanstack.com/query/latest/docs/react/overview)
- [Vue Query 文档](https://tanstack.com/query/latest/docs/vue/overview)
- [VueUse 文档](https://vueuse.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
