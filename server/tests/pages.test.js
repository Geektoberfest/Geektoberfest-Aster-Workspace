import { describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import { createPage, createUser, doc } from './helpers.js'
import Page from '../src/models/Page.js'

const missingId = () => new mongoose.Types.ObjectId().toString()

describe('POST /api/pages', () => {
  it('creates an untitled page with defaults', async () => {
    const { agent, user } = await createUser()
    const res = await agent.post('/api/pages').send({})

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    const { page } = res.body.data
    expect(page).toMatchObject({ title: 'Untitled', parentPage: null, isFavorite: false, isDeleted: false })
    expect(String(page.owner)).toBe(user.id)
    expect(page.content).toMatchObject({ type: 'doc' })
  })

  it('stores a trimmed title, icon and content with a plain-text projection', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: '  My Notes  ', icon: '🚀', content: doc('hello world') })

    expect(page.title).toBe('My Notes')
    expect(page.icon).toBe('🚀')
    expect(page.contentText).toBe('hello world')
  })

  it('nests a page under an existing parent', async () => {
    const { agent } = await createUser()
    const parent = await createPage(agent, { title: 'Parent' })
    const child = await createPage(agent, { title: 'Child', parentPage: parent._id })
    expect(child.parentPage).toBe(parent._id)
  })

  it('rejects a parent that does not exist', async () => {
    const { agent } = await createUser()
    const res = await agent.post('/api/pages').send({ parentPage: missingId() })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Parent page not found')
  })

  it('rejects a parent that is in the trash', async () => {
    const { agent } = await createUser()
    const parent = await createPage(agent, { title: 'Parent' })
    await agent.delete(`/api/pages/${parent._id}`)
    const res = await agent.post('/api/pages').send({ parentPage: parent._id })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed parent id', async () => {
    const { agent } = await createUser()
    const res = await agent.post('/api/pages').send({ parentPage: 'not-an-object-id' })
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  it.each([
    ['a title over 300 characters', { title: 'x'.repeat(301) }, /Title must be at most 300/],
    ['a non-string title', { title: 123 }, /Title must be a string/],
    ['an icon over 16 characters', { icon: 'x'.repeat(17) }, /Icon must be at most 16/],
    ['content that is not a document', { content: { type: 'paragraph' } }, /Content must be a valid document/],
    ['content that is an array', { content: [] }, /Content must be a valid document/],
  ])('rejects %s with 400', async (_label, body, message) => {
    const { agent } = await createUser()
    const before = await Page.countDocuments()
    const res = await agent.post('/api/pages').send(body)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(message)
    expect(await Page.countDocuments()).toBe(before)
  })
})

describe('GET /api/pages', () => {
  it('lists active pages with sidebar fields only', async () => {
    const { agent, welcomePageId } = await createUser()
    const page = await createPage(agent, { title: 'Second', content: doc('body text') })

    const res = await agent.get('/api/pages')
    expect(res.status).toBe(200)
    const ids = res.body.data.pages.map((p) => p._id)
    expect(ids).toEqual([welcomePageId, page._id]) // oldest first
    for (const listed of res.body.data.pages) {
      expect(listed).not.toHaveProperty('content')
      expect(listed).not.toHaveProperty('contentText')
      expect(listed).toHaveProperty('title')
    }
  })

  it('leaves out trashed pages', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Doomed' })
    await agent.delete(`/api/pages/${page._id}`)

    const res = await agent.get('/api/pages')
    expect(res.body.data.pages.map((p) => p._id)).not.toContain(page._id)
  })
})

describe('GET /api/pages/:id', () => {
  it('returns the full page including content', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Full', content: doc('details') })

    const res = await agent.get(`/api/pages/${page._id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.page.title).toBe('Full')
    expect(res.body.data.page.content).toEqual(doc('details'))
  })

  it('can still open a trashed page (so it can be previewed and restored)', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'In trash' })
    await agent.delete(`/api/pages/${page._id}`)

    const res = await agent.get(`/api/pages/${page._id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.page.isDeleted).toBe(true)
  })

  it('returns 404 for an id that does not exist', async () => {
    const { agent } = await createUser()
    const res = await agent.get(`/api/pages/${missingId()}`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ success: false, message: 'Page not found' })
  })

  it('returns 404 for a malformed id', async () => {
    const { agent } = await createUser()
    const res = await agent.get('/api/pages/not-an-object-id')
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/pages/:id', () => {
  it('updates the title and icon', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Old' })

    const res = await agent.put(`/api/pages/${page._id}`).send({ title: '  New title ', icon: '📘' })
    expect(res.status).toBe(200)
    expect(res.body.data.page).toMatchObject({ title: 'New title', icon: '📘' })
  })

  it('updates the content and keeps the plain-text projection in sync', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { content: doc('before') })

    const res = await agent.put(`/api/pages/${page._id}`).send({ content: doc('after edit') })
    expect(res.status).toBe(200)
    expect(res.body.data.page.content).toEqual(doc('after edit'))
    expect(res.body.data.page.contentText).toBe('after edit')
  })

  it('changes only the fields that were sent', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Keep me', icon: '🔥', content: doc('keep this too') })

    await agent.put(`/api/pages/${page._id}`).send({ icon: '❄️' })
    const stored = await Page.findById(page._id).lean()
    expect(stored).toMatchObject({ title: 'Keep me', icon: '❄️', contentText: 'keep this too' })
  })

  it('rejects an empty body because there is nothing to update', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Unchanged' })
    const res = await agent.put(`/api/pages/${page._id}`).send({})
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Nothing to update')
    expect((await Page.findById(page._id).lean()).title).toBe('Unchanged')
  })

  it('falls back to "Untitled" when the title is cleared', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Has a name' })
    const res = await agent.put(`/api/pages/${page._id}`).send({ title: '   ' })
    expect(res.status).toBe(200)
    expect(res.body.data.page.title).toBe('Untitled')
  })

  it('rejects invalid content', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { content: doc('safe') })
    const res = await agent.put(`/api/pages/${page._id}`).send({ content: 'just a string' })
    expect(res.status).toBe(400)
    expect((await Page.findById(page._id).lean()).contentText).toBe('safe')
  })

  it('returns 404 for a page that does not exist', async () => {
    const { agent } = await createUser()
    const res = await agent.put(`/api/pages/${missingId()}`).send({ title: 'x' })
    expect(res.status).toBe(404)
  })

  it('does not allow editing a trashed page', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Original' })
    await agent.delete(`/api/pages/${page._id}`)

    const res = await agent.put(`/api/pages/${page._id}`).send({ title: 'Changed' })
    expect(res.status).toBe(404)
    expect((await Page.findById(page._id).lean()).title).toBe('Original')
  })

  it('ignores attempts to change protected fields', async () => {
    const { agent, user } = await createUser()
    const other = await createUser()
    const page = await createPage(agent, { title: 'Mine' })

    await agent.put(`/api/pages/${page._id}`).send({ title: 'Still mine', owner: other.user.id, isDeleted: true })
    const stored = await Page.findById(page._id).lean()
    expect(String(stored.owner)).toBe(user.id)
    expect(stored.isDeleted).toBe(false)
  })
})

describe('PATCH /api/pages/:id/favorite', () => {
  it('toggles the favorite flag on and off', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent)

    const on = await agent.patch(`/api/pages/${page._id}/favorite`)
    expect(on.status).toBe(200)
    expect(on.body.data.page.isFavorite).toBe(true)

    const off = await agent.patch(`/api/pages/${page._id}/favorite`)
    expect(off.body.data.page.isFavorite).toBe(false)
  })

  it('returns 404 for a missing or trashed page', async () => {
    const { agent } = await createUser()
    expect((await agent.patch(`/api/pages/${missingId()}/favorite`)).status).toBe(404)

    const page = await createPage(agent)
    await agent.delete(`/api/pages/${page._id}`)
    expect((await agent.patch(`/api/pages/${page._id}/favorite`)).status).toBe(404)
  })
})

describe('POST /api/pages/:id/duplicate', () => {
  it('copies the page next to the original', async () => {
    const { agent } = await createUser()
    const parent = await createPage(agent, { title: 'Parent' })
    const original = await createPage(agent, {
      title: 'Report',
      icon: '📊',
      content: doc('quarterly numbers'),
      parentPage: parent._id,
    })
    await agent.patch(`/api/pages/${original._id}/favorite`)

    const res = await agent.post(`/api/pages/${original._id}/duplicate`)
    expect(res.status).toBe(201)
    const copy = res.body.data.page
    expect(copy._id).not.toBe(original._id)
    expect(copy).toMatchObject({ title: 'Report (copy)', icon: '📊', parentPage: parent._id, isFavorite: false })
    expect(copy.content).toEqual(doc('quarterly numbers'))
    expect(copy.contentText).toBe('quarterly numbers')

    // The original is untouched
    const stored = await Page.findById(original._id).lean()
    expect(stored.title).toBe('Report')
    expect(stored.isFavorite).toBe(true)
  })

  it('does not copy child pages', async () => {
    const { agent } = await createUser()
    const parent = await createPage(agent, { title: 'Parent' })
    await createPage(agent, { title: 'Child', parentPage: parent._id })

    const res = await agent.post(`/api/pages/${parent._id}/duplicate`)
    expect(await Page.countDocuments({ parentPage: res.body.data.page._id })).toBe(0)
  })

  it('returns 404 for a missing or trashed page', async () => {
    const { agent } = await createUser()
    expect((await agent.post(`/api/pages/${missingId()}/duplicate`)).status).toBe(404)

    const page = await createPage(agent)
    await agent.delete(`/api/pages/${page._id}`)
    expect((await agent.post(`/api/pages/${page._id}/duplicate`)).status).toBe(404)
  })
})
