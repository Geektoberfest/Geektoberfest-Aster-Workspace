import Page from '../models/Page.js'
import PageVersion from '../models/PageVersion.js'
import ApiError from '../utils/apiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { extractText } from '../utils/tiptapText.js'
import { snapshotPage } from '../services/pageVersions.js'

// Versions are only reachable through a page the authenticated user owns
const findOwnedPage = async (req, extra = {}) => {
  const page = await Page.findOne({ _id: req.params.id, owner: req.user.id, ...extra })
  if (!page) throw new ApiError(404, 'Page not found')
  return page
}

const findVersion = async (req, page) => {
  const version = await PageVersion.findOne({ _id: req.params.versionId, page: page._id, owner: req.user.id }).lean()
  if (!version) throw new ApiError(404, 'Version not found')
  return version
}

export const listVersions = asyncHandler(async (req, res) => {
  const page = await findOwnedPage(req)
  const versions = await PageVersion.find({ page: page._id, owner: req.user.id })
    .sort({ createdAt: -1 })
    .select('title createdAt')
    .lean()
  res.json({ success: true, data: { versions } })
})

export const getVersion = asyncHandler(async (req, res) => {
  const page = await findOwnedPage(req)
  const version = await findVersion(req, page)
  res.json({ success: true, data: { version } })
})

export const restoreVersion = asyncHandler(async (req, res) => {
  const page = await findOwnedPage(req, { isDeleted: false })
  const version = await findVersion(req, page)

  // Keep the current state as a version first, so restoring never loses it
  await snapshotPage(page, { force: true })

  page.title = version.title
  page.content = version.content
  page.contentText = extractText(version.content)
  await page.save()

  res.json({ success: true, data: { page: page.toObject() } })
})
