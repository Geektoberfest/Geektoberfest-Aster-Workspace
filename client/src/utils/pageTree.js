// Children of a parent (null = workspace root) in display order. Mirrors the server sort.
export const getSiblings = (pages, parentId = null) =>
  pages
    .filter((p) => (p.parentPage || null) === parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)))

// True when `id` is `ancestorId` itself or sits anywhere below it
export const isSelfOrDescendant = (pages, ancestorId, id) => {
  const byId = new Map(pages.map((p) => [p._id, p]))
  const visited = new Set()
  let current = id
  while (current && !visited.has(current)) {
    if (current === ancestorId) return true
    visited.add(current)
    current = byId.get(current)?.parentPage
  }
  return false
}
