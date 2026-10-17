import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import PageMenu from './PageMenu'
import { usePagesStore } from '../../store/pagesStore'
import { useUiStore } from '../../store/uiStore'
import { useDragStore } from '../../store/dragStore'
import { getSiblings, isSelfOrDescendant } from '../../utils/pageTree'
import { toast } from '../../store/toastStore'
import { getErrorMessage } from '../../services/api'

export default function TreeItem({ page, depth }) {
  const pages = usePagesStore((s) => s.pages)
  const children = useMemo(() => getSiblings(pages, page._id), [pages, page._id])
  const hasChildren = children.length > 0
  const { pageId } = useParams()
  const isActive = pageId === page._id
  const isExpanded = useUiStore((s) => s.expandedIds.includes(page._id))
  const toggleExpanded = useUiStore((s) => s.toggleExpanded)
  const expand = useUiStore((s) => s.expand)
  const createPage = usePagesStore((s) => s.createPage)
  const movePage = usePagesStore((s) => s.movePage)
  const dragId = useDragStore((s) => s.dragId)
  const dropTarget = useDragStore((s) => s.dropTarget)
  const { startDrag, setDropTarget, endDrag } = useDragStore.getState()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleAddChild = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      const child = await createPage(page._id)
      expand(page._id)
      navigate(`/page/${child._id}`, { state: { focusTitle: true } })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create the page'))
    }
  }

  // A page cannot be dropped onto itself or anything inside it
  const canDropHere = dragId !== null && !isSelfOrDescendant(pages, dragId, page._id)
  const zoneHere = dropTarget?.id === page._id ? dropTarget.zone : null

  const getZone = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    if (ratio < 0.25) return 'before'
    if (ratio > 0.75) return 'after'
    return 'inside'
  }

  const handleDragOver = (event) => {
    if (dragId && !canDropHere) {
      // Invalid target: swallow the event so it does not fall through to the root drop area
      event.stopPropagation()
      setDropTarget(null)
      return
    }
    if (!canDropHere) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropTarget({ id: page._id, zone: getZone(event) })
  }

  const handleDrop = async (event) => {
    if (dragId && !canDropHere) {
      event.stopPropagation()
      endDrag()
      return
    }
    if (!canDropHere) return
    event.preventDefault()
    event.stopPropagation()
    const zone = getZone(event)
    endDrag()

    let parentPage
    let index
    if (zone === 'inside') {
      parentPage = page._id
      index = children.filter((c) => c._id !== dragId).length
    } else {
      parentPage = page.parentPage || null
      const siblings = getSiblings(pages, parentPage).filter((p) => p._id !== dragId)
      const position = siblings.findIndex((p) => p._id === page._id)
      index = zone === 'before' ? position : position + 1
    }

    try {
      await movePage(dragId, parentPage, index)
      if (parentPage) expand(parentPage)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not move the page'))
    }
  }

  return (
    <div>
      <div
        draggable={!isMenuOpen}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', page._id)
          startDrag(page._id)
        }}
        onDragEnd={endDrag}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`group relative flex items-center gap-0.5 rounded-md pr-1 text-sm ${
          dragId === page._id ? 'opacity-40' : ''
        } ${zoneHere === 'inside' ? 'bg-accent/15 ring-1 ring-accent' : ''} ${
          isActive
            ? 'bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
            : 'text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-800/70'
        }`}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        {zoneHere === 'before' && <div className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-accent" />}
        {zoneHere === 'after' && <div className="pointer-events-none absolute inset-x-1 -bottom-px h-0.5 rounded bg-accent" />}
        <button
          type="button"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleExpanded(page._id) }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-zinc-300/70 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 ${hasChildren ? '' : 'invisible'}`}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>

        <Link to={`/page/${page._id}`} draggable={false} className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5">
          <span className="shrink-0 text-sm leading-none">{page.icon || '📄'}</span>
          <span className="truncate">{page.title || 'Untitled'}</span>
        </Link>

        <div className={`flex shrink-0 items-center gap-0.5 ${isMenuOpen ? '' : 'opacity-0 group-hover:opacity-100'}`}>
          <button
            type="button"
            onClick={handleAddChild}
            title="Add a page inside"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-300/70 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); setIsMenuOpen((v) => !v) }}
              title="More options"
              className="rounded p-1 text-zinc-400 hover:bg-zinc-300/70 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {isMenuOpen && <PageMenu page={page} onClose={() => setIsMenuOpen(false)} />}
          </div>
        </div>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {children.map((child) => (
            <TreeItem key={child._id} page={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}