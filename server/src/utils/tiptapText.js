// Flattens a Tiptap JSON document into plain text (used for search + snippets)
export const extractText = (node) => {
  if (!node || typeof node !== 'object') return ''
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  if (node.type === 'doc') return node.content.map(extractText).filter(Boolean).join('\n')
  return node.content.map(extractText).filter(Boolean).join(' ').slice(0, 100000)
}

export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const buildSnippet = (text, query) => {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) {
    const short = text.slice(0, 140).trim()
    return short.length < text.length ? `${short}…` : short
  }
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 90)
  const snippet = text.slice(start, end).trim()
  return `${start > 0 ? '…' : ''}${snippet}${end < text.length ? '…' : ''}`
}

/**
 * Calculates a deterministic relevance score for a page against a search query.
 *
 * Scoring Strategy:
 * - Tier 1 (100): Exact title match (case-insensitive).
 * - Tier 2 (75): Title starts with query (prefix match, case-insensitive).
 * - Tier 3 (50): Title contains query as substring (case-insensitive).
 * - Tier 4 (25): Content-only match (title does not match, but contentText contains query).
 * - Non-match (0): Neither title nor content contains query.
 */
export const computeRelevanceScore = (page, query) => {
  if (!page || !query) return 0
  const q = String(query).trim().toLowerCase()
  if (!q) return 0

  const title = (page.title || '').trim().toLowerCase()
  if (title === q) return 100
  if (title.startsWith(q)) return 75
  if (title.includes(q)) return 50

  const content = (page.contentText || '').toLowerCase()
  if (content.includes(q)) return 25

  return 0
}