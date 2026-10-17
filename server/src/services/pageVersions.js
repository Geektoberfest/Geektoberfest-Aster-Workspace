import PageVersion from '../models/PageVersion.js'

// A new snapshot is only taken when the newest one is at least this old, so a burst of
// autosaves produces one version rather than one per save
export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000
export const MAX_VERSIONS_PER_PAGE = 50

const isSameState = (version, page) =>
  version.title === page.title && JSON.stringify(version.content) === JSON.stringify(page.content)

const pruneVersions = async (pageId) => {
  const stale = await PageVersion.find({ page: pageId })
    .sort({ createdAt: -1 })
    .skip(MAX_VERSIONS_PER_PAGE)
    .select('_id')
    .lean()
  if (stale.length) await PageVersion.deleteMany({ _id: { $in: stale.map((v) => v._id) } })
}

// Saves the page's current state as a version. Skipped when it matches the newest version,
// or (unless `force`) when the newest version is recent.
export const snapshotPage = async (page, { force = false } = {}) => {
  const latest = await PageVersion.findOne({ page: page._id }).sort({ createdAt: -1 }).lean()
  if (latest) {
    if (isSameState(latest, page)) return null
    if (!force && Date.now() - new Date(latest.createdAt).getTime() < SNAPSHOT_INTERVAL_MS) return null
  }

  const version = await PageVersion.create({
    page: page._id,
    owner: page.owner,
    title: page.title,
    content: page.content,
  })
  await pruneVersions(page._id)
  return version
}

export const deleteVersionsForPages = (pageIds) => PageVersion.deleteMany({ page: { $in: pageIds } })
