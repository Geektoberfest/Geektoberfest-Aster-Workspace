import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { createPage, createUser } from './helpers.js'
import Page from '../src/models/Page.js'

const missingId = () => new mongoose.Types.ObjectId().toString()

// root -> child -> grandchild, plus an unrelated sibling of root
const buildTree = async (agent) => {
  const root = await createPage(agent, { title: 'Root' })
  const child = await createPage(agent, { title: 'Child', parentPage: root._id })
  const grandchild = await createPage(agent, { title: 'Grandchild', parentPage: child._id })
  const sibling = await createPage(agent, { title: 'Sibling' })
  return { root, child, grandchild, sibling }
}

const idsOf = (res) => res.body.data.pages.map((p) => p._id)

describe('DELETE /api/pages/:id (move to trash)', () => {
  it('trashes the page together with all of its descendants', async () => {
    const { agent } = await createUser()
    const { root, child, grandchild, sibling } = await buildTree(agent)

    const res = await agent.delete(`/api/pages/${root._id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.deletedCount).toBe(3)

    const pages = await agent.get('/api/pages')
    expect(idsOf(pages)).not.toContain(root._id)
    expect(idsOf(pages)).not.toContain(child._id)
    expect(idsOf(pages)).not.toContain(grandchild._id)
    expect(idsOf(pages)).toContain(sibling._id)

    const trash = await agent.get('/api/pages/trash')
    expect(idsOf(trash).sort()).toEqual([root._id, child._id, grandchild._id].sort())
  })

  it('records when pages were trashed', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent)
    await agent.delete(`/api/pages/${page._id}`)

    const stored = await Page.findById(page._id).lean()
    expect(stored.isDeleted).toBe(true)
    expect(stored.deletedAt).toBeInstanceOf(Date)
  })

  it('trashes only the chosen subtree, leaving the parent in place', async () => {
    const { agent } = await createUser()
    const { root, child, grandchild } = await buildTree(agent)

    const res = await agent.delete(`/api/pages/${child._id}`)
    expect(res.body.data.deletedCount).toBe(2)

    const active = idsOf(await agent.get('/api/pages'))
    expect(active).toContain(root._id)
    expect(active).not.toContain(child._id)
    expect(active).not.toContain(grandchild._id)
  })

  it('handles a deeply nested chain', async () => {
    const { agent } = await createUser()
    let parent = await createPage(agent, { title: 'Level 0' })
    const top = parent
    for (let level = 1; level <= 8; level += 1) {
      parent = await createPage(agent, { title: `Level ${level}`, parentPage: parent._id })
    }

    const res = await agent.delete(`/api/pages/${top._id}`)
    expect(res.body.data.deletedCount).toBe(9)
    expect(await Page.countDocuments({ isDeleted: false, title: /^Level/ })).toBe(0)
  })

  it('returns 404 for a missing page and for a page that is already trashed', async () => {
    const { agent } = await createUser()
    expect((await agent.delete(`/api/pages/${missingId()}`)).status).toBe(404)

    const page = await createPage(agent)
    await agent.delete(`/api/pages/${page._id}`)
    expect((await agent.delete(`/api/pages/${page._id}`)).status).toBe(404)
  })
})

describe('GET /api/pages/trash', () => {
  it('is empty for a user with nothing trashed', async () => {
    const { agent } = await createUser()
    const res = await agent.get('/api/pages/trash')
    expect(res.status).toBe(200)
    expect(res.body.data.pages).toEqual([])
  })

  it('lists the most recently trashed first', async () => {
    const { agent } = await createUser()
    const first = await createPage(agent, { title: 'First' })
    const second = await createPage(agent, { title: 'Second' })
    await agent.delete(`/api/pages/${first._id}`)
    await new Promise((resolve) => setTimeout(resolve, 15))
    await agent.delete(`/api/pages/${second._id}`)

    const res = await agent.get('/api/pages/trash')
    expect(idsOf(res)).toEqual([second._id, first._id])
  })
})

describe('PATCH /api/pages/:id/restore', () => {
  it('restores a page together with its descendants', async () => {
    const { agent } = await createUser()
    const { root, child, grandchild } = await buildTree(agent)
    await agent.delete(`/api/pages/${root._id}`)

    const res = await agent.patch(`/api/pages/${root._id}/restore`)
    expect(res.status).toBe(200)
    expect(res.body.data.restoredCount).toBe(3)

    const active = idsOf(await agent.get('/api/pages'))
    expect(active).toEqual(expect.arrayContaining([root._id, child._id, grandchild._id]))
    expect(idsOf(await agent.get('/api/pages/trash'))).toEqual([])

    const stored = await Page.findById(root._id).lean()
    expect(stored.isDeleted).toBe(false)
    expect(stored.deletedAt).toBeNull()
  })

  it('keeps the original parent when that parent is still active', async () => {
    const { agent } = await createUser()
    const { root, child } = await buildTree(agent)
    await agent.delete(`/api/pages/${child._id}`)
    await agent.patch(`/api/pages/${child._id}/restore`)

    const stored = await Page.findById(child._id).lean()
    expect(String(stored.parentPage)).toBe(root._id)
  })

  it('moves a page to the workspace root when its parent is still in the trash', async () => {
    const { agent } = await createUser()
    const { root, child, grandchild } = await buildTree(agent)
    await agent.delete(`/api/pages/${root._id}`)

    const res = await agent.patch(`/api/pages/${child._id}/restore`)
    expect(res.status).toBe(200)

    const restoredChild = await Page.findById(child._id).lean()
    expect(restoredChild.parentPage).toBeNull()
    expect(restoredChild.isDeleted).toBe(false)
    // Its own subtree stays attached to it and comes back too
    const restoredGrandchild = await Page.findById(grandchild._id).lean()
    expect(String(restoredGrandchild.parentPage)).toBe(child._id)
    expect(restoredGrandchild.isDeleted).toBe(false)
    // The parent is still trashed
    expect((await Page.findById(root._id).lean()).isDeleted).toBe(true)
  })

  it('returns 404 for a page that is not in the trash, or does not exist', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent)
    const active = await agent.patch(`/api/pages/${page._id}/restore`)
    expect(active.status).toBe(404)
    expect(active.body.message).toBe('Page not found in trash')
    expect((await agent.patch(`/api/pages/${missingId()}/restore`)).status).toBe(404)
  })
})

describe('DELETE /api/pages/:id/permanent', () => {
  it('permanently removes a trashed page and its descendants', async () => {
    const { agent } = await createUser()
    const { root, child, grandchild, sibling } = await buildTree(agent)
    await agent.delete(`/api/pages/${root._id}`)

    const res = await agent.delete(`/api/pages/${root._id}/permanent`)
    expect(res.status).toBe(200)
    expect(res.body.data.deletedCount).toBe(3)

    expect(await Page.countDocuments({ _id: { $in: [root._id, child._id, grandchild._id] } })).toBe(0)
    expect(await Page.findById(sibling._id)).not.toBeNull()
    expect((await agent.get(`/api/pages/${root._id}`)).status).toBe(404)
  })

  it('refuses to permanently delete a page that is not in the trash', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent)

    const res = await agent.delete(`/api/pages/${page._id}/permanent`)
    expect(res.status).toBe(404)
    expect(await Page.findById(page._id)).not.toBeNull()
  })

  it('returns 404 for a page that does not exist', async () => {
    const { agent } = await createUser()
    expect((await agent.delete(`/api/pages/${missingId()}/permanent`)).status).toBe(404)
  })
})

describe('DELETE /api/pages/trash (empty trash)', () => {
  it('permanently removes everything in the trash and nothing else', async () => {
    const { agent, welcomePageId } = await createUser()
    const { root, sibling } = await buildTree(agent)
    await agent.delete(`/api/pages/${root._id}`)

    const res = await agent.delete('/api/pages/trash')
    expect(res.status).toBe(200)
    expect(res.body.data.deletedCount).toBe(3)

    expect(idsOf(await agent.get('/api/pages/trash'))).toEqual([])
    expect(idsOf(await agent.get('/api/pages'))).toEqual([welcomePageId, sibling._id])
  })

  it('succeeds with a count of zero when the trash is already empty', async () => {
    const { agent } = await createUser()
    const res = await agent.delete('/api/pages/trash')
    expect(res.status).toBe(200)
    expect(res.body.data.deletedCount).toBe(0)
  })

  it('can be run repeatedly', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent)
    await agent.delete(`/api/pages/${page._id}`)

    expect((await agent.delete('/api/pages/trash')).body.data.deletedCount).toBe(1)
    expect((await agent.delete('/api/pages/trash')).body.data.deletedCount).toBe(0)
  })
})
