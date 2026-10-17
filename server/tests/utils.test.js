import { describe, expect, it } from 'vitest'
import { buildSnippet, escapeRegex, extractText } from '../src/utils/tiptapText.js'

describe('extractText', () => {
  it('returns an empty string for missing or invalid input', () => {
    expect(extractText(null)).toBe('')
    expect(extractText(undefined)).toBe('')
    expect(extractText('text')).toBe('')
    expect(extractText({ type: 'doc' })).toBe('')
  })

  it('puts each top-level block on its own line', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body' }] },
      ],
    }
    expect(extractText(doc)).toBe('Title\nBody')
  })

  it('ignores formatting marks and node attributes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com/secret' } }] },
          ],
        },
        { type: 'image', attrs: { src: 'https://example.com/pic.png' } },
      ],
    }
    expect(extractText(doc)).toBe('bold link')
  })

  it('reads text inside nested lists', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'outer' }] }],
            },
          ],
        },
      ],
    }
    expect(extractText(doc)).toContain('outer')
  })
})

describe('escapeRegex', () => {
  it('escapes every regex special character', () => {
    const special = '.*+?^${}()|[]\\'
    expect(new RegExp(escapeRegex(special)).test(special)).toBe(true)
    expect(escapeRegex('a.c')).toBe('a\\.c')
  })

  it('leaves ordinary text untouched', () => {
    expect(escapeRegex('hello world')).toBe('hello world')
  })
})

describe('buildSnippet', () => {
  it('returns an empty string for empty text', () => {
    expect(buildSnippet('', 'x')).toBe('')
  })

  it('centres the snippet around a case-insensitive match', () => {
    const text = `${'a'.repeat(100)} NEEDLE ${'b'.repeat(200)}`
    const snippet = buildSnippet(text, 'needle')
    expect(snippet).toContain('NEEDLE')
    expect(snippet.startsWith('…')).toBe(true)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('falls back to the start of the text when there is no match', () => {
    expect(buildSnippet('short text', 'zzz')).toBe('short text')
    expect(buildSnippet('x'.repeat(300), 'zzz')).toBe(`${'x'.repeat(140)}…`)
  })
})
