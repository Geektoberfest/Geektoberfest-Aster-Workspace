import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, createPage, createUser, doc } from './helpers.js'

const search = (agent, q) => agent.get('/api/pages/search').query(q === undefined ? {} : { q })
const titlesOf = (res) => res.body.data.pages.map((p) => p.title)

describe('GET /api/pages/search', () => {
  it('finds pages by title, ignoring case', async () => {
    const { agent } = await createUser()
    await createPage(agent, { title: 'Quarterly Budget' })
    await createPage(agent, { title: 'Holiday plans' })

    const res = await search(agent, 'budget')
    expect(res.status).toBe(200)
    expect(titlesOf(res)).toEqual(['Quarterly Budget'])
  })

  it('finds pages by content and returns a snippet around the match', async () => {
    const { agent } = await createUser()
    await createPage(agent, { title: 'Unrelated title', content: doc('The migration to PostgreSQL finished on Friday') })

    const res = await search(agent, 'postgresql')
    expect(titlesOf(res)).toEqual(['Unrelated title'])
    expect(res.body.data.pages[0].snippet).toContain('PostgreSQL')
  })

  it('finds text added by a later edit', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Draft' })
    await agent.put(`/api/pages/${page._id}`).send({ content: doc('zebrafish observations') })

    expect(titlesOf(await search(agent, 'zebrafish'))).toEqual(['Draft'])
  })

  it('finds the welcome page that every new account starts with', async () => {
    const { agent } = await createUser()
    expect(titlesOf(await search(agent, 'getting started'))).toContain('Getting Started')
  })

  it('does not return the raw content in the results', async () => {
    const { agent } = await createUser()
    await createPage(agent, { title: 'Leaky', content: doc('findme please') })

    const [result] = (await search(agent, 'findme')).body.data.pages
    expect(result).not.toHaveProperty('contentText')
    expect(result).not.toHaveProperty('content')
    expect(result).toHaveProperty('snippet')
  })

  it.each([
    ['a missing query', undefined],
    ['an empty query', ''],
    ['a whitespace-only query', '   '],
  ])('returns no results for %s', async (_label, q) => {
    const { agent } = await createUser()
    await createPage(agent, { title: 'Something' })

    const res = await search(agent, q)
    expect(res.status).toBe(200)
    expect(res.body.data.pages).toEqual([])
  })

  it('returns an empty list when nothing matches', async () => {
    const { agent } = await createUser()
    const res = await search(agent, 'no-such-text-anywhere')
    expect(res.status).toBe(200)
    expect(res.body.data.pages).toEqual([])
  })

  it('treats regex characters as plain text, not as a pattern', async () => {
    const { agent } = await createUser()
    await createPage(agent, { title: 'zq.x literal dot' })
    await createPage(agent, { title: 'zqax would match an unescaped dot' })

    // An unescaped "." would also match "zqax"
    expect(titlesOf(await search(agent, 'zq.x'))).toEqual(['zq.x literal dot'])
  })

  it.each(['.', '*', '+', '?', '^', '$', '{', '}', '(', ')', '|', '[', ']', '\\'])(
    'does not crash on the special character %s',
    async (char) => {
      const { agent } = await createUser()
      await createPage(agent, { title: `zz${char}zz` })

      const res = await search(agent, `zz${char}zz`)
      expect(res.status).toBe(200)
      expect(titlesOf(res)).toEqual([`zz${char}zz`])
    }
  )

  it('handles an unbalanced bracket without throwing', async () => {
    const { agent } = await createUser()
    expect((await search(agent, '(unclosed')).status).toBe(200)
    expect((await search(agent, '[a-')).status).toBe(200)
  })

  it('copes with a very long query', async () => {
    const { agent } = await createUser()
    const res = await search(agent, 'x'.repeat(500))
    expect(res.status).toBe(200)
    expect(res.body.data.pages).toEqual([])
  })

  it('excludes trashed pages', async () => {
    const { agent } = await createUser()
    const page = await createPage(agent, { title: 'Findable once' })
    await agent.delete(`/api/pages/${page._id}`)
    expect(titlesOf(await search(agent, 'findable'))).toEqual([])

    await agent.patch(`/api/pages/${page._id}/restore`)
    expect(titlesOf(await search(agent, 'findable'))).toEqual(['Findable once'])
  })

  it('never returns another user\'s pages', async () => {
    const alice = await createUser()
    const bob = await createUser()
    await createPage(alice.agent, { title: 'Alice secret plan', content: doc('alice private text') })

    expect(titlesOf(await search(bob.agent, 'secret'))).toEqual([])
    expect(titlesOf(await search(bob.agent, 'private'))).toEqual([])
    expect(titlesOf(await search(alice.agent, 'secret'))).toEqual(['Alice secret plan'])
  })

  it('returns at most 20 results, most recently updated first', async () => {
    const { agent } = await createUser()
    for (let i = 1; i <= 22; i += 1) await createPage(agent, { title: `bulk item ${i}` })

    const res = await search(agent, 'bulk item')
    expect(res.body.data.pages).toHaveLength(20)
    expect(titlesOf(res)[0]).toBe('bulk item 22')
  })

  it('requires authentication', async () => {
    const { agent } = await createUser()
    await createPage(agent, { title: 'Hidden' })
    expect((await request(app).get('/api/pages/search').query({ q: 'hidden' })).status).toBe(401)
  })
})
