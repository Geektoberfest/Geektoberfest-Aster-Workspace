import { ImagePlus } from 'lucide-react'
import { useUploadStore } from '../../store/uploadStore'

export default function UploadStatus() {
  const uploads = useUploadStore((s) => s.uploads)
  if (uploads.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[190] flex w-72 -translate-x-1/2 flex-col gap-2"
    >
      {uploads.map((upload) => {
        const percent = Math.round(upload.progress * 100)
        return (
          <div
            key={upload.id}
            className="rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
          >
            <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              <ImagePlus className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate">{upload.name}</span>
              <span className="shrink-0 text-xs text-zinc-400">{percent < 100 ? `${percent}%` : 'Finishing…'}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
