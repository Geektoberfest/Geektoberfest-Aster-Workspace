import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeRegex, buildSnippet, computeRelevanceScore } from '../src/utils/tiptapText.js'
import { searchPages } from '../src/controllers/pageController.js'
import Page from '../src/models/Page.js'

describe('Search Utilities & Relevance', () => {
  describe('escapeRegex', () => {
    it('escapes all regex metacharacters properly', () => {
      const meta = '.*+?^${}()|[]\\'
      const escaped = escapeRegex(meta)
      assert.equal(escaped, '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')

      // Ensure that creating a RegExp with the escaped string matches literally
      const re = new RegExp(escaped)
      assert.ok(re.test(meta))
      assert.ok(!re.test('other text'))
    })

    it('escapes user input with special punctuation and brackets', () => {
      const input = 'Feature (v1.0) [WIP] + notes?'
      const escaped = escapeRegex(input)
      const re = new RegExp(escaped, 'i')
      assert.ok(re.test('Documentation for Feature (v1.0) [WIP] + notes? here'))
      assert.ok(!re.test('Feature v1.0 WIP notes'))
    })
  })

  describe('computeRelevanceScore', () => {
    it('assigns 100 to exact title match (case-insensitive)', () => {
      const page = { title: 'Project Roadmap', contentText: 'Some notes' }
      assert.equal(computeRelevanceScore(page, 'project roadmap'), 100)
      assert.equal(computeRelevanceScore(page, 'Project Roadmap'), 100)
      assert.equal(computeRelevanceScore(page, '  PROJECT ROADMAP  '), 100)
    })

    it('assigns 75 to title prefix match', () => {
      const page = { title: 'Project Roadmap 2026', contentText: 'Some notes' }
      assert.equal(computeRelevanceScore(page, 'project roadmap'), 75)
    })

    it('assigns 50 to title substring match', () => {
      const page = { title: 'Q3 Project Roadmap', contentText: 'Some notes' }
      assert.equal(computeRelevanceScore(page, 'project roadmap'), 50)
    })

    it('assigns 25 to content-only match when title does not match', () => {
      const page = { title: 'Quarterly Planning', contentText: 'Reviewing the project roadmap details' }
      assert.equal(computeRelevanceScore(page, 'project roadmap'), 25)
    })

    it('assigns 0 when neither title nor content matches', () => {
      const page = { title: 'Meeting Notes', contentText: 'Discuss budget' }
      assert.equal(computeRelevanceScore(page, 'project roadmap'), 0)
    })

    it('handles empty, null, or undefined values safely', () => {
      assert.equal(computeRelevanceScore(null, 'query'), 0)
      assert.equal(computeRelevanceScore({}, ''), 0)
      assert.equal(computeRelevanceScore({ title: null }, 'query'), 0)
      assert.equal(computeRelevanceScore({ title: 'test' }, null), 0)
    })
  })

  describe('buildSnippet', () => {
    it('returns empty string when text is missing', () => {
      assert.equal(buildSnippet('', 'query'), '')
      assert.equal(buildSnippet(null, 'query'), '')
    })

    it('extracts snippet centered around the matching term', () => {
      const text = 'This is a long introductory paragraph that provides context before discussing the secret keyword inside the workspace document.'
      const snippet = buildSnippet(text, 'secret keyword')
      assert.ok(snippet.includes('secret keyword'))
      assert.ok(snippet.startsWith('…'))
    })

    it('handles case-insensitive query matches', () => {
      const text = 'Important: The API Endpoint is live.'
      const snippet = buildSnippet(text, 'api endpoint')
      assert.ok(snippet.includes('API Endpoint'))
    })

    it('handles short text without match by returning truncated text', () => {
      const text = 'Quick meeting notes for Monday'
      const snippet = buildSnippet(text, 'unmatched')
      assert.equal(snippet, 'Quick meeting notes for Monday')
    })
  })
})

describe('searchPages Controller', () => {
  const originalFind = Page.find

  it('returns empty results immediately for empty or whitespace query without querying DB', async () => {
    let dbCalled = false
    Page.find = () => {
      dbCalled = true
      return { select: () => ({ sort: () => ({ limit: () => ({ lean: () => [] }) }) }) }
    }

    try {
      const req = {
        user: { id: 'user123' },
        query: { q: '   ' },
      }
      let jsonResponse
      const res = { json: (data) => { jsonResponse = data } }

      await searchPages(req, res, () => {})
      assert.equal(dbCalled, false)
      assert.deepEqual(jsonResponse, { success: true, data: { pages: [] } })
    } finally {
      Page.find = originalFind
    }
  })

  it('enforces ownership and soft-delete filters, and applies titles-only scope', async () => {
    let capturedFilter = null
    Page.find = (filter) => {
      capturedFilter = filter
      return {
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: () => Promise.resolve([
                { _id: 'p1', title: 'Test Document', contentText: 'Content here', updatedAt: new Date() },
              ]),
            }),
          }),
        }),
      }
    }

    try {
      const req = {
        user: { id: 'user_secure_456' },
        query: { q: 'test', scope: 'title', sort: 'updated' },
      }
      let jsonResponse
      const res = { json: (data) => { jsonResponse = data } }

      await searchPages(req, res, () => {})

      // Verify security guarantees:
      assert.equal(capturedFilter.owner, 'user_secure_456')
      assert.equal(capturedFilter.isDeleted, false)
      assert.ok(capturedFilter.title instanceof RegExp)
      assert.equal(capturedFilter.$or, undefined)

      assert.equal(jsonResponse.success, true)
      assert.equal(jsonResponse.data.pages.length, 1)
      assert.equal(jsonResponse.data.pages[0].title, 'Test Document')
    } finally {
      Page.find = originalFind
    }
  })

  it('enforces ownership and soft-delete filters, and applies titles-and-content scope by default', async () => {
    let capturedFilter = null
    Page.find = (filter) => {
      capturedFilter = filter
      return {
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        }),
      }
    }

    try {
      const req = {
        user: { id: 'user_secure_789' },
        query: { q: 'hello', scope: 'all' },
      }
      let jsonResponse
      const res = { json: (data) => { jsonResponse = data } }

      await searchPages(req, res, () => {})

      assert.equal(capturedFilter.owner, 'user_secure_789')
      assert.equal(capturedFilter.isDeleted, false)
      assert.ok(Array.isArray(capturedFilter.$or))
      assert.equal(capturedFilter.$or.length, 2)
      assert.ok(capturedFilter.$or[0].title instanceof RegExp)
      assert.ok(capturedFilter.$or[1].contentText instanceof RegExp)
    } finally {
      Page.find = originalFind
    }
  })

  it('safely falls back to safe defaults when scope or sort parameters are invalid', async () => {
    let capturedFilter = null
    let capturedSort = null
    Page.find = (filter) => {
      capturedFilter = filter
      return {
        select: () => ({
          sort: (sortObj) => {
            capturedSort = sortObj
            return {
              limit: () => ({
                lean: () => Promise.resolve([]),
              }),
            }
          },
        }),
      }
    }

    try {
      const req = {
        user: { id: 'user_secure_789' },
        query: { q: 'sample', scope: 'INVALID_SCOPE', sort: 'INJECTION_ATTEMPT' },
      }
      let jsonResponse
      const res = { json: (data) => { jsonResponse = data } }

      await searchPages(req, res, () => {})

      // Fallback scope is 'all'
      assert.ok(Array.isArray(capturedFilter.$or))
      // Fallback sort is 'updated' ({ updatedAt: -1, _id: 1 })
      assert.deepEqual(capturedSort, { updatedAt: -1, _id: 1 })
    } finally {
      Page.find = originalFind
    }
  })

  it('ranks results by relevance when sort=relevance is requested', async () => {
    const mockCandidates = [
      { _id: 'page-content-only', title: 'General Overview', contentText: 'Mentions meeting notes in body', updatedAt: new Date('2026-01-01') },
      { _id: 'page-exact-match', title: 'Meeting Notes', contentText: 'Brief text', updatedAt: new Date('2025-01-01') },
      { _id: 'page-prefix-match', title: 'Meeting Notes 2026', contentText: 'Brief text', updatedAt: new Date('2025-06-01') },
      { _id: 'page-substring-long', title: 'Team Sync and Meeting Notes Discussion', contentText: 'Brief text', updatedAt: new Date('2025-05-01') },
      { _id: 'page-substring-short', title: 'Daily Meeting Notes', contentText: 'Brief text', updatedAt: new Date('2025-05-01') },
    ]

    Page.find = () => ({
      select: () => ({
        limit: () => ({
          lean: () => Promise.resolve([...mockCandidates]),
        }),
      }),
    })

    try {
      const req = {
        user: { id: 'user_123' },
        query: { q: 'meeting notes', sort: 'relevance' },
      }
      let jsonResponse
      const res = { json: (data) => { jsonResponse = data } }

      await searchPages(req, res, () => {})

      const results = jsonResponse.data.pages
      assert.equal(results.length, 5)
      // Rank 1: exact title match
      assert.equal(results[0]._id, 'page-exact-match')
      // Rank 2: title prefix match
      assert.equal(results[1]._id, 'page-prefix-match')
      // Rank 3: shorter title containing substring
      assert.equal(results[2]._id, 'page-substring-short')
      // Rank 4: longer title containing substring
      assert.equal(results[3]._id, 'page-substring-long')
      // Rank 5: content-only match
      assert.equal(results[4]._id, 'page-content-only')
    } finally {
      Page.find = originalFind
    }
  })

  it('provides deterministic tie-breaking for equal sort values', async () => {
    const sameTime = new Date('2026-05-01T12:00:00Z')
    const mockCandidates = [
      { _id: 'page-c', title: 'Same Title', contentText: '', updatedAt: sameTime },
      { _id: 'page-a', title: 'Same Title', contentText: '', updatedAt: sameTime },
      { _id: 'page-b', title: 'Same Title', contentText: '', updatedAt: sameTime },
    ]

    Page.find = () => ({
      select: () => ({
        limit: () => ({
          lean: () => Promise.resolve([...mockCandidates]),
        }),
      }),
    })

    try {
      const req = {
        user: { id: 'user_123' },
        query: { q: 'Same Title', sort: 'relevance' },
      }
      let jsonResponse
      const res = { json: (data) => { jsonResponse = data } }

      await searchPages(req, res, () => {})

      const results = jsonResponse.data.pages
      // Equal relevance and equal updatedAt -> tie broken by _id ascending
      assert.equal(results[0]._id, 'page-a')
      assert.equal(results[1]._id, 'page-b')
      assert.equal(results[2]._id, 'page-c')
    } finally {
      Page.find = originalFind
    }
  })

  it('safely handles long queries exceeding 100 characters by truncating', async () => {
    let capturedRegex = null
    Page.find = (filter) => {
      capturedRegex = filter.$or[0].title
      return {
        select: () => ({
          sort: () => ({
            limit: () => ({
              lean: () => Promise.resolve([]),
            }),
          }),
        }),
      }
    }

    try {
      const veryLongQuery = 'a'.repeat(250)
      const req = {
        user: { id: 'user_123' },
        query: { q: veryLongQuery },
      }
      const res = { json: () => {} }

      await searchPages(req, res, () => {})

      // Should be truncated to 100
      assert.equal(capturedRegex.source.length, 100)
    } finally {
      Page.find = originalFind
    }
  })
})
