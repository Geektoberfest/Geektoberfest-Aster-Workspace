import Page from '../models/Page.js'

// Breadth-first walk of a page's subtree. `deleted` filters which children are matched.
const collectDescendantIds = async (ownerId, rootId, deleted) => {
  const ids = []
  let frontier = [rootId]
  let guard = 0
  while (frontier.length && guard++ < 25) {
    const children = await Page.find({
      owner: ownerId,
      isDeleted: deleted,
      parentPage: { $in: frontier },
    })
      .select('_id')
      .lean()
    frontier = children.map((child) => child._id)
    ids.push(...frontier)
  }
  return ids
}

// Position that places a new page after all of its active siblings
export const getNextPosition = async (ownerId, parentId) => {
  const last = await Page.findOne({ owner: ownerId, isDeleted: false, parentPage: parentId || null })
    .sort({ position: -1 })
    .select('position')
    .lean()
  return last ? last.position + 1 : 0
}

// Walks up from `startId` to the root and reports whether `targetId` is on that path
// (the start page included). Unlike a downward walk this has no depth cap; the visited
// set only guards against a pre-existing cycle.
export const isSelfOrAncestor = async (ownerId, targetId, startId) => {
  const target = String(targetId)
  const visited = new Set()
  let currentId = startId
  while (currentId && !visited.has(String(currentId))) {
    if (String(currentId) === target) return true
    visited.add(String(currentId))
    const current = await Page.findOne({ _id: currentId, owner: ownerId }).select('parentPage').lean()
    currentId = current?.parentPage
  }
  return false
}

export default collectDescendantIds