import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileWarning, MoreHorizontal, Star, Undo2 } from 'lucide-react'
import Editor from '../components/editor/Editor'
import VersionHistory from '../components/editor/VersionHistory'
import EmojiPicker from '../components/ui/EmojiPicker'
import PageMenu from '../components/sidebar/PageMenu'
import { PageSkeleton } from '../components/ui/Skeletons'
import EmptyState from '../components/ui/EmptyState'
import pageService from '../services/pageService'
import { getErrorMessage } from '../services/api'
import { usePagesStore } from '../store/pagesStore'
import { useUiStore } from '../store/uiStore'
import { toast } from '../store/toastStore'
import { getReadingMinutes } from '../utils/docStats'

const SAVE_DEBOUNCE_MS = 800

export default function PageView() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [page, setPage] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [title, setTitle] = useState('')
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  // Bumped when the document is replaced from outside the editor (version restore)
  const [editorKey, setEditorKey] = useState(0)
  // null until the editor reports, so a previous page's count never flashes
  const [wordCount, setWordCount] = useState(null)

  const titleRef = useRef(null)
  const editorRef = useRef(null)
  const latestTitle = useRef('')
  const latestContent = useRef(null)
  const saveTimer = useRef(null)
  const dirtyRef = useRef(false)
  const versionRef = useRef(0)
  const inflightRef = useRef(null)
  const pageIdRef = useRef(pageId)

  const updatePageLocal = usePagesStore((s) => s.updatePageLocal)
  const toggleFavorite = usePagesStore((s) => s.toggleFavorite)
  const restorePage = usePagesStore((s) => s.restorePage)
  const storePage = usePagesStore((s) => s.pages.find((p) => p._id === pageId))
  const setSaveStatus = useUiStore((s) => s.setSaveStatus)

  const isFavorite = storePage?.isFavorite ?? page?.isFavorite ?? false

  /* ---------- Autosave ----------
     Saves are debounced (800ms) and serialized: a new save always waits for the
     previous one to settle, so out-of-order overwrites cannot happen. A version
     counter prevents marking the doc "saved" if the user typed during a save. */
  const performSave = useCallback(async () => {
    const id = pageIdRef.current
    if (!id || !latestContent.current) return
    const version = versionRef.current
    const payload = {
      title: (latestTitle.current || '').trim() || 'Untitled',
      content: latestContent.current,
    }
    setSaveStatus('saving')

    const previous = inflightRef.current
    const current = (async () => {
      if (previous) {
        try { await previous } catch { /* already handled when initiated */ }
      }
      await pageService.updatePage(id, payload)
    })()
    inflightRef.current = current

    try {
      await current
      if (versionRef.current === version) {
        dirtyRef.current = false
        setSaveStatus('saved')
      }
    } catch {
      setSaveStatus('error')
      toast.error('Could not save. Your changes are still here — edit again to retry.')
    }
  }, [setSaveStatus])

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    versionRef.current += 1
    setSaveStatus('dirty')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(performSave, SAVE_DEBOUNCE_MS)
  }, [performSave, setSaveStatus])

  const flushSave = useCallback(() => {
    if (!dirtyRef.current) return undefined
    clearTimeout(saveTimer.current)
    return performSave()
  }, [performSave])

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (dirtyRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  /* ---------- Load page (flushing any pending save of the previous page) ---------- */
  useEffect(() => {
    pageIdRef.current = pageId
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    setWordCount(null)

    pageService
      .getPage(pageId)
      .then(({ data }) => {
        if (cancelled) return
        const loaded = data.data.page
        latestTitle.current = loaded.title
        latestContent.current = loaded.content
        dirtyRef.current = false
        versionRef.current += 1
        setPage(loaded)
        setTitle(loaded.title)
        setIsLoading(false)
        setSaveStatus('saved')
        if (location.state?.focusTitle) {
          requestAnimationFrame(() => {
            titleRef.current?.focus()
            titleRef.current?.select()
          })
          navigate(location.pathname, { replace: true, state: null })
        }
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(getErrorMessage(error, 'Could not load this page'))
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      flushSave()
    }
    // location.state is intentionally not a dependency (it is consumed once on load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, flushSave, setSaveStatus, navigate])

  /* ---------- Handlers ---------- */
  const handleTitleChange = (e) => {
    const value = e.target.value
    setTitle(value)
    latestTitle.current = value
    if (page) updatePageLocal(page._id, { title: value.trim() || 'Untitled' })
    scheduleSave()
  }

  const handleTitleBlur = () => {
    if (!title.trim()) {
      setTitle('Untitled')
      latestTitle.current = 'Untitled'
      if (page) updatePageLocal(page._id, { title: 'Untitled' })
    }
    flushSave()
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editorRef.current?.commands.focus('start')
    }
  }

  const handleContentChange = useCallback(
    (content) => {
      latestContent.current = content
      scheduleSave()
    },
    [scheduleSave]
  )

  // Make sure the server has the latest edits, then swap in the restored version. Pending
  // edits are saved first so a late autosave cannot overwrite the restored content.
  const handleRestoreVersion = async (versionId) => {
    try {
      clearTimeout(saveTimer.current)
      if (inflightRef.current) {
        try { await inflightRef.current } catch { /* surfaced by the save itself */ }
      }
      if (dirtyRef.current) await performSave()
      if (dirtyRef.current) throw new Error('Unsaved changes could not be saved')

      const { data } = await pageService.restoreVersion(page._id, versionId)
      const restored = data.data.page
      latestTitle.current = restored.title
      latestContent.current = restored.content
      dirtyRef.current = false
      versionRef.current += 1
      setPage(restored)
      setTitle(restored.title)
      updatePageLocal(restored._id, { title: restored.title || 'Untitled' })
      setEditorKey((k) => k + 1)
      setSaveStatus('saved')
      toast.success('Version restored')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not restore this version'))
      throw error
    }
  }

  const handleEditorReady = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  const handleIconSelect = async (icon) => {
    setIsIconPickerOpen(false)
    if (!page || icon === page.icon) return
    const previousIcon = page.icon
    setPage((p) => ({ ...p, icon }))
    updatePageLocal(page._id, { icon })
    try {
      await pageService.updatePage(page._id, { icon })
    } catch (error) {
      setPage((p) => ({ ...p, icon: previousIcon }))
      updatePageLocal(page._id, { icon: previousIcon })
      toast.error(getErrorMessage(error, 'Could not update the icon'))
    }
  }

  const handleToggleFavorite = async () => {
    try {
      const next = await toggleFavorite(page._id)
      toast.success(next ? 'Added to favorites' : 'Removed from favorites')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update favorites'))
    }
  }

  const handleRestore = async () => {
    try {
      await restorePage(page._id)
      setPage((p) => ({ ...p, isDeleted: false }))
      toast.success('Page restored')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not restore the page'))
    }
  }

  /* ---------- Render ---------- */
  if (isLoading) return <PageSkeleton />

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <EmptyState
          icon={FileWarning}
          title={loadError}
          description="It may have been permanently deleted, or it belongs to a different account."
        >
          <Link to="/" className="btn-primary mt-3">
            <ArrowLeft className="h-4 w-4" /> Back to workspace
          </Link>
        </EmptyState>
      </div>
    )
  }

  if (!page) return null

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pb-32 pt-10 sm:px-10">
      {page.isDeleted && (
        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <Undo2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 text-sm text-amber-700 dark:text-amber-400">
            This page is in the trash. Restore it to keep editing.
          </p>
          <button
            onClick={handleRestore}
            className="btn border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-200"
          >
            Restore
          </button>
        </div>
      )}

      <div className="relative mb-1.5">
        <button
          type="button"
          onClick={() => !page.isDeleted && setIsIconPickerOpen((v) => !v)}
          disabled={page.isDeleted}
          className="-ml-1.5 rounded-lg px-1.5 py-1 text-6xl leading-none transition-colors hover:bg-zinc-100 disabled:hover:bg-transparent dark:hover:bg-zinc-800/70"
          title="Change icon"
        >
          {page.icon || '📄'}
        </button>
        {isIconPickerOpen && (
          <EmojiPicker onSelect={handleIconSelect} onClose={() => setIsIconPickerOpen(false)} />
        )}
      </div>

      <input
        ref={titleRef}
        value={title}
        onChange={handleTitleChange}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        disabled={page.isDeleted}
        placeholder="Untitled"
        className="mb-2 w-full bg-transparent text-3xl font-bold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-300 disabled:opacity-70 dark:text-zinc-50 dark:placeholder:text-zinc-700 sm:text-4xl"
      />

      <div className="relative mb-4 flex items-center justify-end gap-1">
        {wordCount !== null && (
          <span className="mr-auto text-xs text-zinc-400 dark:text-zinc-500">
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'} · {getReadingMinutes(wordCount)} min read
          </span>
        )}
        <button
          onClick={handleToggleFavorite}
          disabled={page.isDeleted}
          className="btn-ghost px-2"
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <button
          onClick={() => setIsActionsOpen((v) => !v)}
          className="btn-ghost px-2"
          title="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {isActionsOpen && (
          <PageMenu
            page={{ ...page, isFavorite }}
            onClose={() => setIsActionsOpen(false)}
            showRename={false}
            onShowHistory={() => setIsHistoryOpen(true)}
            getExportData={() => ({ title: latestTitle.current, content: latestContent.current ?? page.content })}
          />
        )}
      </div>

      <Editor
        key={`${page._id}-${editorKey}`}
        initialContent={page.content}
        editable={!page.isDeleted}
        onChange={handleContentChange}
        onEditorReady={handleEditorReady}
        onWordCountChange={setWordCount}
      />

      {isHistoryOpen && (
        <VersionHistory
          pageId={page._id}
          canRestore={!page.isDeleted}
          onRestore={handleRestoreVersion}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  )
}