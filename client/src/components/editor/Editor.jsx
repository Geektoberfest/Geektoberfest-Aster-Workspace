import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import SlashCommands from './SlashCommands'
import FloatingToolbar from './FloatingToolbar'
import UploadStatus from './UploadStatus'
import { getEditorWordCount } from '../../utils/docStats'

export default function Editor({ initialContent, editable = true, onChange, onEditorReady, onWordCountChange }) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onWordCountChangeRef = useRef(onWordCountChange)
  onWordCountChangeRef.current = onWordCountChange

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Explicitly disabled in case a future StarterKit version bundles these
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Highlight,
      TextStyle,
      Color,
      Image.configure({ inline: false, allowBase64: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === 'heading' ? 'Heading' : "Type '/' for commands…"),
      }),
      SlashCommands,
    ],
    content: initialContent,
    editable,
    onCreate: ({ editor: current }) => onWordCountChangeRef.current?.(getEditorWordCount(current)),
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(current.getJSON())
      onWordCountChangeRef.current?.(getEditorWordCount(current))
    },
    editorProps: {
      attributes: {
        class: 'prose prose-zinc dark:prose-invert focus:outline-none min-h-[60vh] max-w-none',
      },
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    onEditorReady?.(editor)
    return () => onEditorReady?.(null)
  }, [editor, onEditorReady])

  return (
    <div>
      {editor && editable && <FloatingToolbar editor={editor} />}
      <EditorContent editor={editor} />
      <UploadStatus />
    </div>
  )
}