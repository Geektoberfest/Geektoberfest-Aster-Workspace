import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { highlightTextParts, escapeRegex } from '../src/utils/highlight.js'

describe('Client Highlight Utility & Security Tests', () => {
  describe('escapeRegex', () => {
    it('escapes all regex metacharacters properly', () => {
      const meta = '.*+?^${}()|[]\\'
      const escaped = escapeRegex(meta)
      assert.equal(escaped, '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\')

      const re = new RegExp(escaped)
      assert.ok(re.test('prefix .*+?^${}()|[]\\ suffix'))
    })

    it('escapes user query with parentheses, brackets, and wildcards', () => {
      const query = '(v2) [beta] *notes*'
      const escaped = escapeRegex(query)
      const re = new RegExp(escaped, 'i')
      assert.ok(re.test('Project (v2) [beta] *notes* document'))
      assert.ok(!re.test('Project v2 beta notes document'))
    })
  })

  describe('highlightTextParts', () => {
    it('returns empty array when text is null, undefined, or empty', () => {
      assert.deepEqual(highlightTextParts('', 'query'), [])
      assert.deepEqual(highlightTextParts(null, 'query'), [])
      assert.deepEqual(highlightTextParts(undefined, 'query'), [])
    })

    it('returns single non-matching part when query is empty or whitespace', () => {
      const resultEmpty = highlightTextParts('Sample Text', '')
      assert.deepEqual(resultEmpty, [{ text: 'Sample Text', isMatch: false }])

      const resultWhitespace = highlightTextParts('Sample Text', '   ')
      assert.deepEqual(resultWhitespace, [{ text: 'Sample Text', isMatch: false }])
    })

    it('correctly splits text into matching and non-matching parts with preserved casing', () => {
      const parts = highlightTextParts('Learning JavaScript and React', 'javascript')
      assert.deepEqual(parts, [
        { text: 'Learning ', isMatch: false },
        { text: 'JavaScript', isMatch: true },
        { text: ' and React', isMatch: false },
      ])
    })

    it('handles multiple occurrences of search term', () => {
      const parts = highlightTextParts('Notes on meeting: Discussed notes and action items', 'notes')
      assert.deepEqual(parts, [
        { text: 'Notes', isMatch: true },
        { text: ' on meeting: Discussed ', isMatch: false },
        { text: 'notes', isMatch: true },
        { text: ' and action items', isMatch: false },
      ])
    })

    it('handles punctuation and regex characters safely', () => {
      const text = 'Release [v1.0] is ready (check docs)'
      const parts = highlightTextParts(text, '[v1.0]')
      assert.deepEqual(parts, [
        { text: 'Release ', isMatch: false },
        { text: '[v1.0]', isMatch: true },
        { text: ' is ready (check docs)', isMatch: false },
      ])
    })

    it('does not interpret HTML tags as markup (XSS safety)', () => {
      const malicious = '<script>alert("xss")</script> <b>bold</b>'
      const parts = highlightTextParts(malicious, 'alert("xss")')
      assert.deepEqual(parts, [
        { text: '<script>', isMatch: false },
        { text: 'alert("xss")', isMatch: true },
        { text: '</script> <b>bold</b>', isMatch: false },
      ])
    })
  })

  describe('Search Parameter Serialization', () => {
    it('serializes search params properly for API client', () => {
      const formatParams = (params) => (typeof params === 'string' ? { q: params } : params)

      assert.deepEqual(formatParams('test'), { q: 'test' })
      assert.deepEqual(formatParams({ q: 'test', scope: 'title', sort: 'relevance' }), {
        q: 'test',
        scope: 'title',
        sort: 'relevance',
      })
    })
  })
})
