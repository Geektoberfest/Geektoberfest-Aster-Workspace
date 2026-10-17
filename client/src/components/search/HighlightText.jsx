import { memo } from 'react'
import { highlightTextParts, escapeRegex } from '../../utils/highlight.js'

export { escapeRegex, highlightTextParts }

/**
 * Safely renders highlighted matching occurrences of `query` within `text`
 * using React JSX text nodes and <mark> elements (zero innerHTML/XSS risk).
 */
function HighlightText({ text, query, className = '' }) {
  if (!text) return null

  const parts = highlightTextParts(text, query)

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.isMatch ? (
          <mark
            key={index}
            className="rounded-[2px] bg-amber-200/90 px-0.5 font-medium text-zinc-900 dark:bg-amber-400/30 dark:text-amber-200"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  )
}

export default memo(HighlightText)
