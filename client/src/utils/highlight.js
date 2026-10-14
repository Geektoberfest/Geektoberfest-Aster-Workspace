/**
 * Escapes characters with special meaning in regular expressions.
 */
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits `text` into non-matching and matching segments based on `query`.
 * Returns an array of `{ text: string, isMatch: boolean }` objects.
 *
 * @param {string} text - The input text to be highlighted.
 * @param {string} query - The search query term.
 * @returns {Array<{ text: string, isMatch: boolean }>}
 */
export const highlightTextParts = (text, query) => {
  if (!text) return []

  const trimmed = (query || '').trim()
  if (!trimmed) {
    return [{ text, isMatch: false }]
  }

  const escaped = escapeRegex(trimmed)
  const regex = new RegExp(`(${escaped})`, 'gi')
  const rawParts = text.split(regex)

  const lowerQuery = trimmed.toLowerCase()
  return rawParts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      isMatch: part.toLowerCase() === lowerQuery,
    }))
}
