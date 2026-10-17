import request from 'supertest'
import app from '../src/app.js'

let counter = 0

export const doc = (text = '') => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
})

// Registers a fresh user. `agent` keeps the session cookie for later requests.
export const createUser = async (overrides = {}) => {
  counter += 1
  const credentials = {
    name: `Test User ${counter}`,
    email: `user${counter}@example.com`,
    password: 'password123',
    ...overrides,
  }
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/register').send(credentials)
  if (res.status !== 201) throw new Error(`Could not register test user: ${res.status} ${res.text}`)
  return { agent, credentials, user: res.body.data.user, welcomePageId: res.body.data.pageId }
}

export const createPage = async (agent, body = {}) => {
  const res = await agent.post('/api/pages').send(body)
  if (res.status !== 201) throw new Error(`Could not create test page: ${res.status} ${res.text}`)
  return res.body.data.page
}

export { app }
