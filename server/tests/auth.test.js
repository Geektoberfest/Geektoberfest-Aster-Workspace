import { describe, expect, it } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { app, createUser } from './helpers.js'
import User from '../src/models/User.js'
import Page from '../src/models/Page.js'

const valid = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'password123' }

describe('GET /api/health', () => {
  it('reports the API is up', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } })
  })
})

describe('POST /api/auth/register', () => {
  it('creates a user, a welcome page and a session cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(valid)

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' })
    expect(res.body.data.user.password).toBeUndefined()
    expect(res.headers['set-cookie'].join(';')).toMatch(/token=.+HttpOnly/i)

    const welcome = await Page.findById(res.body.data.pageId).lean()
    expect(welcome.title).toBe('Getting Started')
    expect(String(welcome.owner)).toBe(res.body.data.user.id)
  })

  it('stores the password hashed, never in plain text', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const stored = await User.findOne({ email: valid.email }).select('+password').lean()
    expect(stored.password).not.toBe(valid.password)
    expect(stored.password).toMatch(/^\$2[aby]\$/)
  })

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const res = await request(app).post('/api/auth/register').send({ ...valid, name: 'Someone Else' })
    expect(res.status).toBe(409)
    expect(res.body.success).toBe(false)
    expect(await User.countDocuments({ email: valid.email })).toBe(1)
  })

  it.each([
    ['a missing name', { ...valid, name: undefined }, /Name is required/],
    ['a missing email', { ...valid, email: undefined }, /Email is required/],
    ['an invalid email', { ...valid, email: 'not-an-email' }, /Email is invalid/],
    ['a missing password', { ...valid, password: undefined }, /Password is required/],
    ['a short password', { ...valid, password: 'short' }, /at least 8 characters/],
    ['a non-string password', { ...valid, password: 12345678 }, /must be a string/],
    ['an overly long name', { ...valid, name: 'x'.repeat(61) }, /at most 60 characters/],
  ])('rejects %s with 400', async (_label, body, message) => {
    const res = await request(app).post('/api/auth/register').send(body)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(message)
    expect(await User.countDocuments()).toBe(0)
  })
})

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets a cookie', async () => {
    await createUser(valid)
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password })

    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ email: valid.email, name: valid.name })
    expect(res.headers['set-cookie'].join(';')).toMatch(/token=/)
  })

  it('rejects a wrong password with a generic 401', async () => {
    await createUser(valid)
    const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'wrong-password' })
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('gives the same error for an unknown email (no account enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' })
    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid email or password')
  })

  it.each([
    ['a missing email', { password: 'password123' }],
    ['a missing password', { email: 'ada@example.com' }],
    ['an invalid email', { email: 'nope', password: 'password123' }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await request(app).post('/api/auth/login').send(body)
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })
})

describe('GET /api/auth/me', () => {
  it('returns the logged-in user', async () => {
    const { agent, user } = await createUser(valid)
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.data.user).toMatchObject({ id: user.id, email: valid.email, name: valid.name })
  })

  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('returns 401 for a malformed token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not-a-real-jwt')
    expect(res.status).toBe(401)
  })

  it('returns 401 for a token signed with a different secret', async () => {
    const forged = jwt.sign({ id: new mongoose.Types.ObjectId() }, 'some-other-secret')
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${forged}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 for an expired token', async () => {
    const { user } = await createUser()
    const expired = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -10 })
    const res = await request(app).get('/api/auth/me').set('Cookie', `token=${expired}`)
    expect(res.status).toBe(401)
  })

  it('returns 401 when the token belongs to a user that no longer exists', async () => {
    const { agent, user } = await createUser()
    await User.deleteOne({ _id: user.id })
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const { agent } = await createUser()
    const res = await agent.post('/api/auth/logout')

    expect(res.status).toBe(200)
    expect(res.body.data.message).toBe('Logged out')
    expect(res.headers['set-cookie'].join(';')).toMatch(/token=;/)

    // The agent's cookie jar was cleared, so the session is really gone
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })

  it('requires an authenticated session', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(401)
  })
})

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ success: false })
    expect(res.body.message).toMatch(/Route not found/)
  })

  it('returns 400 for a malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Invalid request body')
  })
})
