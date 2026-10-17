import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Asterisk, Plus, Search, Trash2 } from 'lucide-react'
import TreeItem from './TreeItem'
import { SidebarSkeleton } from '../ui/Skeletons'
import { useAuthStore } from '../../store/authStore'
import { usePagesStore } from '../../store/pagesStore'
import { useUiStore } from '../../store/uiStore'
import { useDragStore } from '../../store/dragStore'
import { getSiblings } from '../../utils/pageTree'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../services/api'

const rowClass = (active) =>
  `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${
    active
      ? 'bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
      : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/70'
  }`

export default function Sidebar() {
  const pages = usePagesStore((s) => s.pages)
  const isPagesLoaded = usePagesStore((s) => s.isPagesLoaded)
  const pagesLoadError = usePagesStore((s) => s.pagesLoadError)
  const createPage = usePagesStore((s) => s.createPage)
  const loadPages = usePagesStore((s) => s.loadPages)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()
  const { pageId } = useParams()

  const favorites = useMemo(
    () => pages.filter((p) => p.isFavorite).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [pages]
  )
  const rootPages = useMemo(() => getSiblings(pages, null), [pages])
  const movePage = usePagesStore((s) => s.movePage)
  const dragId = useDragStore((s) => s.dragId)
  const isRootTarget = useDragStore((s) => s.dropTarget?.id === 'root')

  // Dropping on the empty area below the tree moves the page to the end of the root
  const handleRootDragOver = (event) => {
    if (!dragId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    useDragStore.getState().setDropTarget({ id: 'root' })
  }

  const handleRootDrop = async (event) => {
    if (!dragId) return
    event.preventDefault()
    const id = dragId
    useDragStore.getState().endDrag()
    try {
      await movePage(id, null, rootPages.length)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not move the page'))
    }
  }

  const handleNewPage = async () => {
    try {
      const page = await createPage(null)
      navigate(`/page/${page._id}`, { state: { focusTitle: true } })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create the page'))
    }
  }

  return (
    <div className="flex h-full flex-col bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
      <Link to="/" className="mx-2 mt-2 flex items-center gap-2 rounded-md px-2 py-2 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/70">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-white">
          <Asterisk className="h-4 w-4" />
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {user ? `${user.name}'s workspace` : 'Workspace'}
        </span>
      </Link>

      <button onClick={() => setSearchOpen(true)} className={`${rowClass(false)} mx-2 mt-2`}>
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="rounded border border-zinc-300 px-1 text-[10px] text-zinc-400 dark:border-zinc-700">⌘K</kbd>
      </button>

      {favorites.length > 0 && (
        <div className="mt-4">
          <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Favorites</div>
          {favorites.map((page) => (
            <Link key={page._id} to={`/page/${page._id}`} className={`mx-2 ${rowClass(pageId === page._id)}`}>
              <span className="text-sm leading-none">{page.icon || '📄'}</span>
              <span className="truncate">{page.title || 'Untitled'}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between px-4 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pages</span>
        <button
          onClick={handleNewPage}
          title="New page"
          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <nav
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        className={`flex-1 overflow-y-auto px-2 pb-4 ${isRootTarget ? 'bg-accent/10' : ''}`}
      >
        {!isPagesLoaded && <SidebarSkeleton />}
        {pagesLoadError && (
          <div className="mx-1 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <p>Could not load pages.</p>
            <button onClick={loadPages} className="mt-1 font-medium underline underline-offset-2">Try again</button>
          </div>
        )}
        {isPagesLoaded && rootPages.length === 0 && (
          <p className="px-2 py-1 text-xs leading-relaxed text-zinc-400">
            No pages yet. Create your first page to get started.
          </p>
        )}
        {rootPages.map((page) => (
          <TreeItem key={page._id} page={page} depth={0} />
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-zinc-200 p-2 dark:border-zinc-800">
        <button onClick={handleNewPage} className={`${rowClass(false)} w-full`}>
          <Plus className="h-4 w-4 shrink-0" /> New page
        </button>
        <Link to="/trash" className={`${rowClass(location.pathname === '/trash')} w-full`}>
          <Trash2 className="h-4 w-4 shrink-0" /> Trash
        </Link>
      </div>
    </div>
  )
}