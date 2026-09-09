---
title: "React-Vue-Lifecycle"
aliases:
  - "React 与 Vue 生命周期对应关系"
tags:
  - "前端"
  - "react"
  - "vue"
  - "教程"
category: "前端"
folder: "React"
parent: "[[前端/React/react]]"
related:
  - "[[前端/React/react]]"
  - "[[前端/React/React-Query-vs-API-Cancel]]"
created: 2026-04-03
updated: 2026-04-04
---

# React 与 Vue 生命周期对应关系

本文档对比 React 和 Vue 的生命周期钩子,帮助开发者理解两个框架之间的对应关系。

## 生命周期对比表

### 挂载阶段 (Mounting)

组件创建并插入到 DOM 中的过程。

| React (类组件) | React (Hooks) | Vue 2 | Vue 3 | 说明 |
|---------------|---------------|-------|-------|------|
| `constructor()` | `useState()` 初始化 | `beforeCreate` | `setup()` 开始 | 初始化状态 |
| - | - | `created` | `setup()` 中 | 实例创建完成 |
| `render()` | 函数体执行 | `beforeMount` | `onBeforeMount()` | 渲染前 |
| `componentDidMount()` | `useEffect(() => &#123;&#125;, [])` | `mounted` | `onMounted()` | 挂载完成,可访问 DOM |

**使用场景:**
- 数据请求通常在 `componentDidMount` / `useEffect` / `mounted` / `onMounted` 中执行
- 订阅事件、初始化第三方库也在此阶段

### 更新阶段 (Updating)

组件的 props 或 state 发生变化时触发重新渲染。

| React (类组件) | React (Hooks) | Vue 2 | Vue 3 | 说明 |
|---------------|---------------|-------|-------|------|
| `shouldComponentUpdate()` | `useMemo()` / `React.memo()` | - | - | 性能优化,决定是否更新 |
| `render()` | 函数体重新执行 | `beforeUpdate` | `onBeforeUpdate()` | 更新前 |
| `getSnapshotBeforeUpdate()` | `useLayoutEffect()` | - | - | 更新前获取 DOM 快照 |
| `componentDidUpdate()` | `useEffect(() => &#123;&#125;)` | `updated` | `onUpdated()` | 更新完成 |

**使用场景:**
- 响应 props 变化执行副作用
- 对比前后数据差异
- 更新后的 DOM 操作

### 卸载阶段 (Unmounting)

组件从 DOM 中移除的过程。

| React (类组件) | React (Hooks) | Vue 2 | Vue 3 | 说明 |
|---------------|---------------|-------|-------|------|
| `componentWillUnmount()` | `useEffect(() => &#123; return () => &#123;&#125; &#125;)` | `beforeDestroy` | `onBeforeUnmount()` | 卸载前 |
| - | - | `destroyed` | `onUnmounted()` | 卸载完成 |

**使用场景:**
- 清理定时器
- 取消网络请求
- 移除事件监听
- 清理订阅

### 错误处理 (Error Handling)

捕获子组件中的错误。

| React (类组件) | React (Hooks) | Vue 2 | Vue 3 | 说明 |
|---------------|---------------|-------|-------|------|
| `static getDerivedStateFromError()` | - | - | - | 渲染备用 UI |
| `componentDidCatch()` | - | `errorCaptured` | `onErrorCaptured()` | 记录错误信息 |

**注意:** Reac有直接的错误边界钩子,需要使用类组件或第三方库。

## 代码示例对比

### 挂载时获取数据

**React (Hooks):**
```typescript
const UserProfile = () => {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser().then(data => setUser(data))
  }, []) // 空依赖数组,仅在挂载时执行

  return <div>{user?.name}</div>
}
```

**Vue 3 (Composition API):**
```typescript
const UserProfile = defineComponent({
  setup() {
    const user = ref(null)

    onMounted(async () => {
      user.value = await fetchUser()
    })

    return { user }
  }
})
```

### 响应 props 变化

**React (Hooks):**
```typescript
const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetchUser(userId).then(data => setUser(data))
  }, [userId]) // userId 变化时重新执行

  return <div>{user?.name}</div>
}
```

**Vue 3 (Composition API):**
```typescript
const UserProfile = defineComponent({
  props: ['userId'],
  setup(props) {
    const user = ref(null)

    watch(() => props.userId, async (newId) => {
      user.value = await fetchUser(newId)
    }, { immediate: true })

    return { user }
  }
})
```

### 清理副作用

**React (Hooks):**
```typescript
useEffect(() => {
  const timer = setInterval(() => {
    console.log('tick')
  }, 1000)

  // 返回清理函数
  return () => {
    clearInterval(timer)
  }
}, [])
```

**Vue 3 (Composition API):**
```typescript
onMounted(() => {
  const timer = setInterval(() => {
    console.log('tick')
  }, 1000)

  onUnmounted(() => {
    clearInterval(timer)
  })
})
```

## 关键差异

### 1. 执行时机
- **React Hooks**: 函数组件每次渲染时都会执行,通过依赖数组控制副作用
- **Vue Composition API**: `setup()` 只在组件初始化时执行一次,生命周期钩子注册后在特定时机触发

### 2. 响应式系统
- **React**: 通过 `useState` 触发重新渲染,需要手动管理状态更新
- **Vue**: 内置响应式系统 (`ref`, `reactive`),自动追踪依赖并触发更新

### 3. 更新控制
- **React**: 需要在 `useEffect` 中手动指定依赖数组
- **Vue**: 自动追踪响应式数据的依赖关系

### 4. 生命周期粒度
- **React**: `useEffect` 同时处理挂载、更新和卸载
- **Vue**: 提供更细粒度的钩子 (`onBeforeMount`, `onMounted`, `onBeforeUpdate`, `onUpdated` 等)

## 最佳实践

### React (本项目使用)
- 优先使用函数组件 + Hooks
- 使用箭头函数声明组件(符合项目规范)
- 合理使用 `useMemo` 和 `useCallback` 优化性能
- 避免在 `useEffect` 中遗漏依赖项

### Vue
- Vue 3 推荐使用 Composition API
- 合理使用 `computed` 和 `watch`
- 避免在生命周期钩子中执行过重的同步操作

## 参考资源

- [React 生命周期图谱](https://projects.wojtekmaj.pl/react-lifecycle-methods-diagram/)
- [Vue 生命周期图谱](https://vuejs.org/guide/essentials/lifecycle.html)
- [React Hooks 文档](https://react.dev/reference/react)
- [Vue Composition API 文档](https://vuejs.org/api/composition-api-lifecycle.html)
