import { create } from 'zustand'

// Transient sidebar drag state. dropTarget is { id, zone: 'before' | 'inside' | 'after' },
// or { id: 'root' } while hovering the empty area below the tree.
export const useDragStore = create((set) => ({
  dragId: null,
  dropTarget: null,

  startDrag: (dragId) => set({ dragId, dropTarget: null }),
  setDropTarget: (dropTarget) =>
    set((s) =>
      s.dropTarget?.id === dropTarget?.id && s.dropTarget?.zone === dropTarget?.zone ? s : { dropTarget }
    ),
  endDrag: () => set({ dragId: null, dropTarget: null }),
}))
