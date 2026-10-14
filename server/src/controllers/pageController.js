import Page, { emptyDoc } from '../models/Page.js'
import ApiError from '../utils/apiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { extractText, escapeRegex, buildSnippet, computeRelevanceScore } from '../utils/tiptapText.js'
import collectDescendantIds from '../utils/pageTree.js'
import { snapshotPage, deleteVersionsForPages } from '../services/pageVersions.js'

export const getPages = asyncHandler(async (req, res) => {
  const pages = await Page.find({ owner: req.user.id, isDeleted: false })
    .select('title icon parentPage isFavorite createdAt updatedAt')
    .sort({ createdAt: 1 })
    .lean()
  res.json({ success: true, data: { pages } })
})

export const getTrash = asyncHandler(async (req, res) => {
  const pages = await Page.find({ owner: req.user.id, isDeleted: true })
    .select('title icon parentPage deletedAt updatedAt')
    .sort({ deletedAt: -1 })
    .lean()
  res.json({ success: true, data: { pages } })
})

export const getPage = asyncHandler(async (req, res) => {
  const page = await Page.findOne({ _id: req.params.id, owner: req.user.id }).lean()
  if (!page) throw new ApiError(404, 'Page not found')
  res.json({ success: true, data: { page } })
})

export const createPage = asyncHandler(async (req, res) => {
  const { title, icon, content, parentPage } = req.body

  if (parentPage) {
    const parent = await Page.findOne({ _id: parentPage, owner: req.user.id, isDeleted: false })
      .select('_id')
      .lean()
    if (!parent) throw new ApiError(400, 'Parent page not found')
  }

  const doc = {
    title: title?.trim() || 'Untitled',
    icon: icon || '📄',
    parentPage: parentPage || null,
    owner: req.user.id,
  }
  if (content) {
    doc.content = content
    doc.contentText = extractText(content)
  }

  const page = await Page.create(doc)
  res.status(201).json({ success: true, data: { page } })
})

export const updatePage = asyncHandler(async (req, res) => {
  const { title, icon, content } = req.body

  const update = {}
  if (title !== undefined) update.title = title.trim() || 'Untitled'
  if (icon !== undefined) update.icon = icon
  if (content !== undefined) {
    update.content = content
    update.contentText = extractText(content)
  }
  if (Object.keys(update).length === 0) throw new ApiError(400, 'Nothing to update')

  // Snapshot the state being replaced; only when the title or content actually changes
  if (update.title !== undefined || update.content !== undefined) {
    const existing = await Page.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: false })
      .select('title content owner')
      .lean()
    if (!existing) throw new ApiError(404, 'Page not found')
    const changed =
      (update.title !== undefined && update.title !== existing.title) ||
      (update.content !== undefined && JSON.stringify(update.content) !== JSON.stringify(existing.content))
    if (changed) await snapshotPage(existing)
  }

  const page = await Page.findOneAndUpdate(
    { _id: req.params.id, owner: req.user.id, isDeleted: false },
    update,
    { new: true }
  ).lean()
  if (!page) throw new ApiError(404, 'Page not found')

  res.json({ success: true, data: { page } })
})

export const toggleFavorite = asyncHandler(async (req, res) => {
  const page = await Page.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: false })
  if (!page) throw new ApiError(404, 'Page not found')
  page.isFavorite = !page.isFavorite
  await page.save()
  res.json({ success: true, data: { page: page.toObject() } })
})

export const deletePage = asyncHandler(async (req, res) => {
  const page = await Page.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: false })
  if (!page) throw new ApiError(404, 'Page not found')

  // Soft-delete the page and its entire subtree
  const descendantIds = await collectDescendantIds(req.user.id, page._id, false)
  const ids = [page._id, ...descendantIds]
  await Page.updateMany({ _id: { $in: ids }, owner: req.user.id }, { $set: { isDeleted: true, deletedAt: new Date() } })

  res.json({ success: true, data: { deletedCount: ids.length } })
})

export const restorePage = asyncHandler(async (req, res) => {
  const page = await Page.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: true })
  if (!page) throw new ApiError(404, 'Page not found in trash')

  const descendantIds = await collectDescendantIds(req.user.id, page._id, true)
  await Page.updateMany(
    { _id: { $in: [page._id, ...descendantIds] }, owner: req.user.id },
    { $set: { isDeleted: false, deletedAt: null } }
  )

  // If the restored page's parent is gone (still trashed or permanently deleted),
  // detach it to the workspace root so it never becomes unreachable.
  if (page.parentPage) {
    const parent = await Page.findOne({ _id: page.parentPage, owner: req.user.id, isDeleted: false })
      .select('_id')
      .lean()
    if (!parent) await Page.updateOne({ _id: page._id }, { $set: { parentPage: null } })
  }

  res.json({ success: true, data: { restoredCount: 1 + descendantIds.length } })
})

export const duplicatePage = asyncHandler(async (req, res) => {
  const original = await Page.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: false }).lean()
  if (!original) throw new ApiError(404, 'Page not found')

  const copy = await Page.create({
    title: `${original.title} (copy)`,
    icon: original.icon,
    content: original.content ?? emptyDoc(),
    contentText: original.contentText,
    parentPage: original.parentPage,
    owner: req.user.id,
  })
  res.status(201).json({ success: true, data: { page: copy } })
})

export const permanentDelete = asyncHandler(async (req, res) => {
  const page = await Page.findOne({ _id: req.params.id, owner: req.user.id, isDeleted: true })
  if (!page) throw new ApiError(404, 'Page not found in trash')

  const descendantIds = await collectDescendantIds(req.user.id, page._id, true)
  const ids = [page._id, ...descendantIds]
  const { deletedCount } = await Page.deleteMany({ _id: { $in: ids }, owner: req.user.id })
  await deleteVersionsForPages(ids)
  res.json({ success: true, data: { deletedCount } })
})

export const emptyTrash = asyncHandler(async (req, res) => {
  const trashed = await Page.find({ owner: req.user.id, isDeleted: true }).select('_id').lean()
  await deleteVersionsForPages(trashed.map((p) => p._id))
  const { deletedCount } = await Page.deleteMany({ owner: req.user.id, isDeleted: true })
  res.json({ success: true, data: { deletedCount } })
})

export const searchPages = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100)
  if (!q) return res.json({ success: true, data: { pages: [] } })

  const rawScope = String(req.query.scope || '').trim().toLowerCase()
  const scope = rawScope === 'title' || rawScope === 'titles' ? 'title' : 'all'

  const rawSort = String(req.query.sort || '').trim().toLowerCase()
  const sort = rawSort === 'relevance' ? 'relevance' : 'updated'

  const regex = new RegExp(escapeRegex(q), 'i')
  const filter = {
    owner: req.user.id,
    isDeleted: false,
  }

  if (scope === 'title') {
    filter.title = regex
  } else {
    filter.$or = [{ title: regex }, { contentText: regex }]
  }

  let pages = []

  if (sort === 'relevance') {
    const candidates = await Page.find(filter)
      .select('title icon contentText updatedAt')
      .limit(100)
      .lean()

    candidates.sort((a, b) => {
      const scoreA = computeRelevanceScore(a, q)
      const scoreB = computeRelevanceScore(b, q)
      if (scoreA !== scoreB) return scoreB - scoreA

      if (scoreA >= 50) {
        const lenA = (a.title || '').length
        const lenB = (b.title || '').length
        if (lenA !== lenB) return lenA - lenB
      }

      const timeA = new Date(a.updatedAt || 0).getTime()
      const timeB = new Date(b.updatedAt || 0).getTime()
      if (timeA !== timeB) return timeB - timeA

      return String(a._id).localeCompare(String(b._id))
    })

    pages = candidates.slice(0, 20)
  } else {
    pages = await Page.find(filter)
      .select('title icon contentText updatedAt')
      .sort({ updatedAt: -1, _id: 1 })
      .limit(20)
      .lean()
  }

  const results = pages.map(({ contentText, ...page }) => ({
    ...page,
    snippet: buildSnippet(contentText, q),
  }))

  res.json({ success: true, data: { pages: results } })
})