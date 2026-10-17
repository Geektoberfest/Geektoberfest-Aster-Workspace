import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import {
  Code, Heading1, Heading2, Heading3, Image as ImageIcon, ImagePlus, List, ListChecks,
  ListOrdered, Minus, Quote, Type,
} from 'lucide-react'
import { pickAndUploadImage } from '../../utils/imageUpload'

const COMMANDS = [
  {
    title: 'Text',
    description: 'Plain paragraph',
    icon: Type,
    keywords: ['paragraph', 'plain'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    keywords: ['h1', 'title'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    keywords: ['h2', 'subtitle'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    keywords: ['h3'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run(),
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: List,
    keywords: ['unordered', 'ul'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: ListOrdered,
    keywords: ['ordered', 'ol'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: 'To-do List',
    description: 'Track tasks with checkboxes',
    icon: ListChecks,
    keywords: ['todo', 'task', 'checklist'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quote or callout',
    icon: Quote,
    keywords: ['blockquote'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: 'Code',
    description: 'Code block',
    icon: Code,
    keywords: ['codeblock', 'snippet'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: 'Divider',
    description: 'Visually divide sections',
    icon: Minus,
    keywords: ['hr', 'rule', 'line'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    title: 'Upload Image',
    description: 'Upload a PNG, JPEG or WebP from your device',
    icon: ImagePlus,
    keywords: ['image', 'picture', 'photo', 'file', 'device'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      pickAndUploadImage(editor)
    },
  },
  {
    title: 'Image Link',
    description: 'Embed an image from a URL',
    icon: ImageIcon,
    keywords: ['picture', 'photo', 'url', 'embed'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run()
      const url = window.prompt('Image URL')
      if (url && url.trim()) editor.chain().focus().setImage({ src: url.trim() }).run()
    },
  },
]

const SlashCommandMenu = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const { items, command } = props

  useEffect(() => setSelectedIndex(0), [props.query])

  const selectItem = (index) => {
    const item = items[index]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'Escape') {
        // Move the cursor in front of the slash so the suggestion plugin deactivates
        props.editor?.chain().focus().setTextSelection(props.range.from - 1).run()
        return true
      }
      if (items.length === 0) return false
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-400 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        No results
      </div>
    )
  }

  return (
    <div className="w-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
      <div className="max-h-72 overflow-y-auto p-1.5">
        {items.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={item.title}
              onClick={() => selectItem(index)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${
                index === selectedIndex ? 'bg-zinc-100 dark:bg-zinc-700/70' : ''
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.title}</span>
                <span className="block truncate text-xs text-zinc-400">{item.description}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="border-t border-zinc-100 px-3 py-1.5 text-[10px] text-zinc-400 dark:border-zinc-700/60">
        ↑↓ navigate · ↵ select · esc dismiss
      </div>
    </div>
  )
})
SlashCommandMenu.displayName = 'SlashCommandMenu'

const renderSuggestion = () => {
  let reactRenderer = null
  let container = null

  const applyPosition = (props) => {
    const rect = props.clientRect?.()
    if (!rect || !container) return
    const MENU_W = 288
    const MENU_H = 360
    let left = rect.left
    let top = rect.bottom + 8
    if (left + MENU_W > window.innerWidth - 8) left = window.innerWidth - MENU_W - 8
    if (left < 8) left = 8
    if (top + MENU_H > window.innerHeight - 8) top = Math.max(8, rect.top - MENU_H - 8)
    container.style.left = `${left}px`
    container.style.top = `${top}px`
  }

  return {
    onStart(props) {
      reactRenderer = new ReactRenderer(SlashCommandMenu, { props, editor: props.editor })
      container = document.createElement('div')
      container.className = 'slash-menu-container'
      container.appendChild(reactRenderer.element)
      document.body.appendChild(container)
      applyPosition(props)
    },
    onUpdate(props) {
      reactRenderer?.updateProps(props)
      applyPosition(props)
    },
    onKeyDown(props) {
      return reactRenderer?.ref?.onKeyDown(props) ?? false
    },
    onExit() {
      reactRenderer?.destroy()
      container?.remove()
      reactRenderer = null
      container = null
    },
  }
}

export const buildSuggestionConfig = () => ({
  char: '/',
  items: ({ query }) => {
    const q = query.toLowerCase()
    return COMMANDS.filter(
      (item) => item.title.toLowerCase().includes(q) || item.keywords?.some((k) => k.includes(q))
    )
  },
  // Don't open the menu inside code blocks
  allow: ({ state, range }) => {
    const $from = state.doc.resolve(range.from)
    return $from.parent.type.name !== 'codeBlock'
  },
  command: ({ editor, range, props }) => {
    props.command({ editor, range })
  },
  render: renderSuggestion,
})

const SlashCommands = Extension.create({
  name: 'slashCommands',
  addOptions() {
    return { suggestion: {} }
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...buildSuggestionConfig(),
        ...this.options.suggestion,
      }),
    ]
  },
})

export default SlashCommands