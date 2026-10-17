import { describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { app, createPage, createUser, doc } from './helpers.js'
import Page from '../src/models/Page.js'

const someId = () => new mongoose.Types.ObjectId().toString()

describe('authentication is required for every page endpoint', () => {
  const endpoints = [
    ['get', '/api/pages'],
    ['get', '/api/pages/search?q=x'],
    ['get', '/api/pages/trash'],
    ['delete', '/api/pages/trash'],
    ['get', `/api/pages/${someId()}`],
    ['post', '/api/pages'],
    ['put', `/api/pages/${someId()}`],
    ['patch', `/api/pages/${someId()}/favorite`],
    ['patch', `/api/pages/${someId()}/restore`],
    ['post', `/api/pages/${someId()}/duplicate`],
    ['delete', `/api/pages/${someId()}`],
    ['delete', `/api/pages/${someId()}/permanent`],
  ]

  it.each(endpoints)('%s %s returns 401 without a session', async (method, url) => {
    const res = await request(app)[method](url).send({})
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('does not create anything for an unauthenticated request', async () => {
    await request(app).post('/api/pages').send({ title: 'Sneaky' })
    expect(await Page.countDocuments({ title: 'Sneaky' })).toBe(0)
  })
})

describe('users cannot touch each other\'s pages', () => {
  const setup = async () => {
    const alice = await createUser()
    const bob = await createUser()
    const page = await createPage(alice.agent, { title: 'Alice page', content: doc('alice content') })
    return { alice, bob, page }
  }

  it('cannot read another user\'s page', async () => {
    const { bob, page } = await setup()
    const res = await bob.agent.get(`/api/pages/${page._id}`)
    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain('alice content')
  })

  it('cannot edit another user\'s page', async () => {
    const { bob, page } = await setup()
    const res = await bob.agent.put(`/api/pages/${page._id}`).send({ title: 'Hacked', content: doc('hacked') })
    expect(res.status).toBe(404)

    const stored = await Page.findById(page._id).lean()
    expect(stored.title).toBe('Alice page')
    expect(stored.contentText).toBe('alice content')
  })

  it('cannot favorite another user\'s page', async () => {
    const { bob, page } = await setup()
    expect((await bob.agent.patch(`/api/pages/${page._id}/favorite`)).status).toBe(404)
    expect((await Page.findById(page._id).lean()).isFavorite).toBe(false)
  })

  it('cannot duplicate another user\'s page', async () => {
    const { bob, page } = await setup()
    const before = await Page.countDocuments()
    expect((await bob.agent.post(`/api/pages/${page._id}/duplicate`)).status).toBe(404)
    expect(await Page.countDocuments()).toBe(before)
  })

  it('cannot trash another user\'s page', async () => {
    const { bob, page } = await setup()
    expect((await bob.agent.delete(`/api/pages/${page._id}`)).status).toBe(404)
    expect((await Page.findById(page._id).lean()).isDeleted).toBe(false)
  })

  it('cannot restore or permanently delete another user\'s trashed page', async () => {
    const { alice, bob, page } = await setup()
    await alice.agent.delete(`/api/pages/${page._id}`)

    expect((await bob.agent.patch(`/api/pages/${page._id}/restore`)).status).toBe(404)
    expect((await Page.findById(page._id).lean()).isDeleted).toBe(true)

    expect((await bob.agent.delete(`/api/pages/${page._id}/permanent`)).status).toBe(404)
    expect(await Page.findById(page._id)).not.toBeNull()
  })

  it('cannot nest a new page under another user\'s page', async () => {
    const { bob, page } = await setup()
    const res = await bob.agent.post('/api/pages').send({ title: 'Intruder', parentPage: page._id })
    expect(res.status).toBe(400)
    expect(await Page.countDocuments({ title: 'Intruder' })).toBe(0)
  })

  it('does not include another user\'s pages in lists or the trash', async () => {
    const { alice, bob, page } = await setup()
    await alice.agent.delete(`/api/pages/${page._id}`)
    const aliceLive = await createPage(alice.agent, { title: 'Alice live' })

    const pages = await bob.agent.get('/api/pages')
    const ids = pages.body.data.pages.map((p) => p._id)
    expect(ids).not.toContain(aliceLive._id)
    expect(ids).toHaveLength(1) // only Bob's own welcome page

    expect((await bob.agent.get('/api/pages/trash')).body.data.pages).toEqual([])
  })

  it('emptying the trash only affects the current user', async () => {
    const { alice, bob, page } = await setup()
    await alice.agent.delete(`/api/pages/${page._id}`)
    const bobPage = await createPage(bob.agent, { title: 'Bob trashed' })
    await bob.agent.delete(`/api/pages/${bobPage._id}`)

    const res = await bob.agent.delete('/api/pages/trash')
    expect(res.body.data.deletedCount).toBe(1)
    expect(await Page.findById(page._id)).not.toBeNull()
    expect(await Page.findById(bobPage._id)).toBeNull()
  })

  it('trashing a subtree never reaches into another user\'s pages', async () => {
    const { alice, bob } = await setup()
    const parent = await createPage(bob.agent, { title: 'Bob parent' })
    // Simulate a corrupted reference: Alice's page pointing at Bob's page as its parent
    const stray = await createPage(alice.agent, { title: 'Alice stray' })
    await Page.updateOne({ _id: stray._id }, { parentPage: parent._id })

    const res = await bob.agent.delete(`/api/pages/${parent._id}`)
    expect(res.body.data.deletedCount).toBe(1)
    expect((await Page.findById(stray._id).lean()).isDeleted).toBe(false)
  })
})
