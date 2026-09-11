import { group, orderNavigationSiblings, page } from './model.mjs'
import { directions } from './directions.mjs'
import { foundations } from './foundations.mjs'
import { engineering } from './engineering.mjs'

export const learningPathRoot = page({
  id: 'learning-paths-home',
  slug: '',
  title: '升级路线图',
  navTitle: '概述',
  status: 'published'
})

export const learningPathTree = Object.freeze([
  group('directions', '方向路线', directions),
  group('foundations', '通用基础', foundations),
  group('engineering', '工程与架构', engineering)
])

export function routeOf(pageNode) {
  return pageNode.slug ? `/learning-paths/${pageNode.slug}` : '/learning-paths/'
}

export function relativePathOf(pageNode) {
  return pageNode.slug
    ? `learning-paths/${pageNode.slug}.md`
    : 'learning-paths/index.md'
}

export function normalizeRoute(value) {
  const withoutOrigin = value.replace(/^https?:\/\/[^/]+/i, '')
  const withoutQueryOrHash = withoutOrigin.split(/[?#]/, 1)[0]
  const normalized = withoutQueryOrHash
    .replace(/\\/g, '/')
    .replace(/\.(?:md|html)$/i, '')
    .replace(/\/index$/i, '')
    .replace(/\/$/, '')
    .normalize('NFC')
    .toLocaleLowerCase('en-US')

  return normalized ? `/${normalized.replace(/^\/+/, '')}` : '/'
}

export function flattenPages(nodes = learningPathTree) {
  const pages = []

  for (const node of nodes) {
    if (node.kind === 'page') {
      pages.push(node)
    } else {
      pages.push(...flattenPages(node.children))
    }
  }

  return pages
}

export const learningPathPages = Object.freeze([
  learningPathRoot,
  ...flattenPages()
])

export const pagesByRelativePath = new Map(
  learningPathPages.map((pageNode) => [relativePathOf(pageNode), pageNode])
)

export const pagesByRoute = new Map(
  learningPathPages.map((pageNode) => [normalizeRoute(routeOf(pageNode)), pageNode])
)

function toSidebarItems(nodes) {
  return orderNavigationSiblings(nodes).map((node) => {
    if (node.kind === 'page') {
      return { text: node.navTitle, link: routeOf(node) }
    }

    return {
      text: node.navTitle,
      collapsed: node.collapsed,
      items: toSidebarItems(node.children)
    }
  })
}

export const learningPathsSidebar = Object.freeze([
  { text: learningPathRoot.navTitle, link: routeOf(learningPathRoot) },
  ...toSidebarItems(learningPathTree)
])

export function isPlaceholderRelativePath(relativePath) {
  const normalized = relativePath.replace(/^\.\//, '').replace(/\\/g, '/')
  return pagesByRelativePath.get(normalized)?.status === 'placeholder'
}

export function isPlaceholderRoute(route) {
  return pagesByRoute.get(normalizeRoute(route))?.status === 'placeholder'
}
