// Converts a Tiptap JSON document to Markdown. Read-only: the input is never modified.
// Anything Markdown cannot express (colors, highlights, underline, unknown nodes) falls
// back to its plain text instead of failing.

const escapeText = (text) => text.replace(/[\\`*_[\]<>~]/g, '\\$&')

// Stops a line that merely starts like Markdown ("# x", "- x", "1. x") from becoming one
const escapeLineStarts = (text) =>
  text
    .split('\n')
    .map((line) =>
      line
        .replace(/^(\s*)(#{1,6}|[-+])(?=\s|$)/, '$1\\$2')
        .replace(/^(\s*\d+)([.)])(?=\s|$)/, '$1\\$2')
    )
    .join('\n')

const encodeHref = (href) =>
  String(href)
    .trim()
    .replace(/[()\s<>]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)

// Keeps surrounding whitespace outside the delimiters, which Markdown requires
const wrap = (text, delimiter) => {
  const [, lead, body, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  return body ? `${lead}${delimiter}${body}${delimiter}${trail}` : text
}

const wrapCode = (text) => {
  const longestRun = Math.max(0, ...(text.match(/`+/g) || []).map((run) => run.length))
  const fence = '`'.repeat(longestRun + 1)
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : ''
  return `${fence}${pad}${text}${pad}${fence}`
}

const isNode = (value) => value !== null && typeof value === 'object'

const applyMarks = (text, marks) => {
  const byType = new Map((Array.isArray(marks) ? marks : []).filter(isNode).map((mark) => [mark.type, mark]))
  let out = byType.has('code') ? wrapCode(text) : escapeText(text)
  if (byType.has('italic')) out = wrap(out, '*')
  if (byType.has('bold')) out = wrap(out, '**')
  if (byType.has('strike')) out = wrap(out, '~~')
  const href = byType.get('link')?.attrs?.href
  if (href) out = `[${out}](${encodeHref(href)})`
  return out
}

const renderImage = (node) => {
  const { src, alt, title } = node.attrs || {}
  if (!src) return ''
  const altText = String(alt || '').replace(/[[\]\\]/g, '\\$&')
  const titleText = title ? ` "${String(title).replace(/"/g, '\\"')}"` : ''
  return `![${altText}](${encodeHref(src)}${titleText})`
}

const renderInlineNode = (node) => {
  if (!isNode(node)) return ''
  if (node.type === 'hardBreak') return '  \n'
  if (node.type === 'image') return renderImage(node)
  if (typeof node.text === 'string') return applyMarks(node.text, node.marks)
  return Array.isArray(node.content) ? node.content.map(renderInlineNode).join('') : ''
}

const renderInline = (nodes) => (Array.isArray(nodes) ? nodes.map(renderInlineNode).join('') : '')

const prefixLines = (text, prefix) =>
  text
    .split('\n')
    .map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
    .join('\n')

const indentLines = (text, indent) =>
  text
    .split('\n')
    .map((line) => (line ? `${indent}${line}` : line))
    .join('\n')

const renderCodeBlock = (node) => {
  const text = (Array.isArray(node.content) ? node.content : []).map((child) => child?.text || '').join('')
  const longestRun = Math.max(0, ...(text.match(/`{3,}/g) || []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  const language = String(node.attrs?.language || '').replace(/[^\w+#.-]/g, '')
  return `${fence}${language}\n${text}\n${fence}`
}

const renderListItem = (item, listType, number) => {
  let marker = '- '
  let indent = '  '
  if (listType === 'orderedList') {
    marker = `${number}. `
    indent = ' '.repeat(marker.length)
  } else if (listType === 'taskList') {
    marker = `- [${item?.attrs?.checked ? 'x' : ' '}] `
  }

  const children = Array.isArray(item?.content) ? item.content : []
  const [first, ...rest] = children
  const hasLeadingParagraph = first?.type === 'paragraph'
  const head = hasLeadingParagraph ? renderBlock(first) : ''
  const blocks = (hasLeadingParagraph ? rest : children).map(renderBlock).filter(Boolean)

  // Nested lists sit directly under their item; other blocks (code, quotes) get a blank line
  let out = `${marker}${indentLines(head, indent).trimStart()}`.trimEnd()
  for (const block of blocks) {
    const nested = /^\s*(?:[-+*]|\d+\.) /.test(block)
    out += `${nested ? '\n' : '\n\n'}${indentLines(block, indent)}`
  }
  return out
}

const renderList = (node) => {
  const start = Number.isInteger(node.attrs?.start) ? node.attrs.start : 1
  return (Array.isArray(node.content) ? node.content : [])
    .map((item, index) => renderListItem(item, node.type, start + index))
    .join('\n')
}

function renderBlock(node) {
  if (!isNode(node)) return ''
  switch (node.type) {
    case 'paragraph': {
      const text = escapeLineStarts(renderInline(node.content))
      return text.trim() ? text.trimEnd() : ''
    }
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6)
      const text = renderInline(node.content).trim()
      return text ? `${'#'.repeat(level)} ${text}` : ''
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return renderList(node)
    case 'blockquote': {
      const inner = renderBlocks(node.content)
      return inner ? prefixLines(inner, '> ') : ''
    }
    case 'codeBlock':
      return renderCodeBlock(node)
    case 'horizontalRule':
      return '---'
    case 'image':
      return renderImage(node)
    default:
      // Unknown node: keep whatever text it contains rather than dropping it
      if (typeof node.text === 'string') return renderInlineNode(node)
      return Array.isArray(node.content) ? renderBlocks(node.content) : ''
  }
}

function renderBlocks(nodes) {
  return Array.isArray(nodes) ? nodes.map(renderBlock).filter(Boolean).join('\n\n') : ''
}

export const docToMarkdown = (doc) => renderBlocks(doc?.content)

// Full file contents: the page title as an H1, then the body
export const pageToMarkdown = ({ title, content }) => {
  const heading = `# ${escapeText((title || '').trim() || 'Untitled')}`
  const body = docToMarkdown(content)
  return body ? `${heading}\n\n${body}\n` : `${heading}\n`
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/

// "My Notes: Q1/Q2?" -> "my-notes-q1-q2.md". Keeps letters and numbers from any language.
export const getMarkdownFilename = (title) => {
  let slug = String(title || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '')
  if (!slug) slug = 'untitled'
  if (WINDOWS_RESERVED.test(slug)) slug = `${slug}-page`
  return `${slug}.md`
}

export const downloadMarkdownFile = ({ title, content }) => {
  const blob = new Blob([pageToMarkdown({ title, content })], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = getMarkdownFilename(title)
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
