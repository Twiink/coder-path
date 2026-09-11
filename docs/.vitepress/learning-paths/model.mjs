/**
 * Learning-path catalog primitives. A page's id is its durable identity; its
 * slug is the current file-system and public-route location.
 */
export function page({ id, slug, title, navTitle = title, status, previousRoutes = [] }) {
  return Object.freeze({
    kind: 'page',
    id,
    slug,
    title,
    navTitle,
    status,
    previousRoutes: Object.freeze([...previousRoutes])
  })
}

export function group(id, navTitle, children, collapsed = true) {
  return Object.freeze({
    kind: 'group',
    id,
    navTitle,
    collapsed,
    children: Object.freeze(children)
  })
}

/**
 * Estimate the rendered width of a navigation label. CJK glyphs occupy about
 * twice the horizontal space of ASCII glyphs in the sidebar's default font.
 * Keeping this here makes the sidebar's short-to-long reading order explicit
 * without changing a page's title, route, or catalog identity.
 */
export function navigationLabelWidth(navTitle) {
  return Array.from(navTitle).reduce((width, character) => {
    if (/\s/u.test(character)) return width
    return width + (/^[\u0000-\u00ff]$/u.test(character) ? 1 : 2)
  }, 0)
}

function isOverviewPage(node) {
  return node.kind === 'page' && (
    node.slug === '' ||
    node.slug.endsWith('/overview') ||
    node.slug.endsWith('/index')
  )
}

/**
 * Keep an overview as the first item in its section, then arrange sibling
 * labels from short to long. Ties retain the catalog's intentional order.
 */
export function orderNavigationSiblings(nodes) {
  return nodes
    .map((node, index) => ({ node, index, width: navigationLabelWidth(node.navTitle) }))
    .sort((left, right) => {
      const overviewDifference = Number(isOverviewPage(right.node)) - Number(isOverviewPage(left.node))
      if (overviewDifference) return overviewDifference
      return left.width - right.width || left.index - right.index
    })
    .map(({ node }) => node)
}
