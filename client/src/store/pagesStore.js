import { create } from 'zustand'
import pageService from '../services/pageService'
import { getSiblings } from '../utils/pageTree'

// Local (optimistic) helper: all descendant ids of a page, from the flat list
const collectLocalDescendantIds = (pages, rootId) => {
  const childMap = new Map()
  for (const page of pages) {
    const key = page.parentPage || null
    if (!childMap.has(key)) childMap.set(key, [])
    childMap.get(key).push(page)
  }
  const ids = []
  const stack = [rootId]
  while (stack.length) {
    const current = stack.pop()
    for (const child of childMap.get(current) || []) {
      ids.push(child._id)
      stack.push(child._id)
    }
  }
  return ids
}

export const usePagesStore = create((set, get) => ({
  pages: [],
  trash: [],
  isPagesLoaded: false,
  isPagesLoading: false,
  pagesLoadError: null,
  trashLoaded: false,

  reset: () => set({ pages: [], trash: [], isPagesLoaded: false, isPagesLoading: false, pagesLoadError: null, trashLoaded: false }),

  loadPages: async () => {
    if (get().isPagesLoading) return
    set({ isPagesLoading: true, pagesLoadError: null })
    try {
      const { data } = await pageService.getPages()
      set({ pages: data.data.pages, isPagesLoaded: true, pagesLoadError: null })
    } catch (error) {
      set({ isPagesLoaded: true, pagesLoadError: error })
    } finally {
      set({ isPagesLoading: false })
    }
  },

  createPage: async (parentPage = null) => {
    const { data } = await pageService.createPage({ parentPage })
    set((s) => ({ pages: [...s.pages, data.data.page] }))
    return data.data.page
  },

  updatePageLocal: (id, patch) =>
    set((s) => ({ pages: s.pages.map((p) => (p._id === id ? { ...p, ...patch } : p)) })),

  toggleFavorite: async (id) => {
    const previous = get().pages
    set((s) => ({ pages: s.pages.map((p) => (p._id === id ? { ...p, isFavorite: !p.isFavorite } : p)) }))
    try {
      const { data } = await pageService.toggleFavorite(id)
      get().updatePageLocal(id, { isFavorite: data.data.page.isFavorite })
      return data.data.page.isFavorite
    } catch (error) {
      set({ pages: previous })
      throw error
    }
  },

  deletePage: async (id) => {
    const ids = [id, ...collectLocalDescendantIds(get().pages, id)]
    const previous = get().pages
    set((s) => ({ pages: s.pages.filter((p) => !ids.includes(p._id)) }))
    try {
      await pageService.deletePage(id)
    } catch (error) {
      set({ pages: previous })
      throw error
    }
  },

  duplicatePage: async (id) => {
    const { data } = await pageService.duplicatePage(id)
    set((s) => ({ pages: [...s.pages, data.data.page] }))
    return data.data.page
  },

  // Optimistically reorders/reparents a page; rolls back if the server rejects the move
  movePage: async (id, parentPage, index) => {
    const previous = get().pages
    const page = previous.find((p) => p._id === id)
    if (!page) return
    const siblingIds = getSiblings(previous, parentPage)
      .filter((p) => p._id !== id)
      .map((p) => p._id)
    const target = Math.min(index, siblingIds.length)
    if ((page.parentPage || null) === parentPage && getSiblings(previous, parentPage).findIndex((p) => p._id === id) === target) {
      return
    }
    siblingIds.splice(target, 0, id)
    const positions = new Map(siblingIds.map((siblingId, position) => [siblingId, position]))

    set({
      pages: previous.map((p) => {
        if (p._id === id) return { ...p, parentPage, position: positions.get(id) }
        return positions.has(p._id) ? { ...p, position: positions.get(p._id) } : p
      }),
    })
    try {
      await pageService.movePage(id, parentPage, target)
    } catch (error) {
      set({ pages: previous })
      throw error
    }
  },

  loadTrash: async () => {
    const { data } = await pageService.getTrash()
    set({ trash: data.data.pages, trashLoaded: true })
  },

  restorePage: async (id) => {
    await pageService.restorePage(id)
    const [pagesRes, trashRes] = await Promise.all([pageService.getPages(), pageService.getTrash()])
    set({ pages: pagesRes.data.data.pages, trash: trashRes.data.data.pages, isPagesLoaded: true })
  },

  permanentDelete: async (id) => {
    await pageService.permanentDelete(id)
    set((s) => ({ trash: s.trash.filter((p) => p._id !== id) }))
  },

  emptyTrash: async () => {
    await pageService.emptyTrash()
    set({ trash: [] })
  },
}))