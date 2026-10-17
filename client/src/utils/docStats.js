export const WORDS_PER_MINUTE = 200

// A token only counts as a word if it contains a letter or digit, so stray
// symbols like "-", "•" or "=" (common in lists and code) are ignored
const WORD_CHAR = /[\p{L}\p{N}]/u

export const countWords = (text) => {
  if (!text) return 0
  return text.split(/\s+/).filter((token) => WORD_CHAR.test(token)).length
}

export const getReadingMinutes = (words) => Math.ceil(words / WORDS_PER_MINUTE)

// Reads the editor's rendered text (no JSON, marks or attributes). Blocks are
// separated by a newline so adjacent headings/list items/code lines don't merge.
export const getEditorWordCount = (editor) => countWords(editor.getText({ blockSeparator: '\n' }))
