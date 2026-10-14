import { useCallback, useEffect, useState } from 'react'
import { History, RotateCcw, X } from 'lucide-react'
import Editor from './Editor'
import Spinner from '../ui/Spinner'
import ConfirmDialog from '../ui/ConfirmDialog'
import pageService from '../../services/pageService'
import { getErrorMessage } from '../../services/api'

const noop = () => {}

const formatVersionDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

export default function VersionHistory({ pageId, canRestore, onRestore, onClose }) {
  const [versions, setVersions] = useState(null)
  const [listError, setListError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  useEffect(() => {
    let cancelled = false
    pageService
      .getVersions(pageId)
      .then(({ data }) => {
        if (cancelled) return
        setVersions(data.data.versions)
        setSelectedId(data.data.versions[0]?._id ?? null)
      })
      .catch((error) => !cancelled && setListError(getErrorMessage(error, 'Could not load version history')))
    return () => { cancelled = true }
  }, [pageId])

  useEffect(() => {
    if (!selectedId) return undefined
    let cancelled = false
    setPreview(null)
    setPreviewError(null)
    pageService
      .getVersion(pageId, selectedId)
      .then(({ data }) => !cancelled && setPreview(data.data.version))
      .catch((error) => !cancelled && setPreviewError(getErrorMessage(error, 'Could not load this version')))
    return () => { cancelled = true }
  }, [pageId, selectedId])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !isConfirmOpen) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, isConfirmOpen])

  const handleRestore = useCallback(async () => {
    setIsRestoring(true)
    try {
      await onRestore(selectedId)
      onClose()
    } catch {
      // The parent shows the error toast; keep the panel open so the user can retry
      setIsConfirmOpen(false)
    } finally {
      setIsRestoring(false)
    }
  }, [onRestore, onClose, selectedId])

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <History className="h-4 w-4 text-zinc-500" />
          <h2 className="flex-1 text-sm font-semibold">Version history</h2>
          <button onClick={onClose} className="btn-ghost px-2" aria-label="Close version history">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="max-h-40 shrink-0 overflow-y-auto border-b border-zinc-200 p-2 dark:border-zinc-800 sm:max-h-none sm:w-60 sm:border-b-0 sm:border-r">
            {versions === null && !listError && (
              <div className="flex justify-center py-6"><Spinner /></div>
            )}
            {listError && <p className="p-2 text-xs text-red-600 dark:text-red-400">{listError}</p>}
            {versions?.length === 0 && (
              <p className="p-2 text-xs leading-relaxed text-zinc-400">
                No earlier versions yet. They appear here as you edit this page.
              </p>
            )}
            {versions?.map((version) => (
              <button
                key={version._id}
                onClick={() => setSelectedId(version._id)}
                className={`w-full rounded-md px-2.5 py-2 text-left text-sm ${
                  selectedId === version._id
                    ? 'bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/70'
                }`}
              >
                <div>{formatVersionDate(version.createdAt)}</div>
                <div className="truncate text-xs text-zinc-400">{version.title || 'Untitled'}</div>
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {previewError && <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>}
              {selectedId && !preview && !previewError && (
                <div className="flex justify-center py-10"><Spinner /></div>
              )}
              {preview && (
                <>
                  <h3 className="mb-3 text-2xl font-bold tracking-tight">{preview.title || 'Untitled'}</h3>
                  <Editor key={preview._id} initialContent={preview.content} editable={false} onChange={noop} />
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-400">
                Restoring keeps your current version in the history.
              </p>
              <button
                onClick={() => setIsConfirmOpen(true)}
                disabled={!preview || !canRestore || isRestoring}
                className="btn-primary"
              >
                <RotateCcw className="h-4 w-4" /> Restore this version
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmOpen}
        title="Restore this version?"
        message="The page will be replaced with this version. Your current content is saved to the history first, so you can come back to it."
        confirmLabel={isRestoring ? 'Restoring…' : 'Restore'}
        onConfirm={handleRestore}
        onCancel={() => !isRestoring && setIsConfirmOpen(false)}
      />
    </div>
  )
}
