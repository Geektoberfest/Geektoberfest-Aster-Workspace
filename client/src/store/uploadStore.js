import { create } from 'zustand'

// In-flight image uploads, shown by the editor's upload indicator
export const useUploadStore = create((set) => ({
  uploads: [],

  startUpload: (id, name) => set((s) => ({ uploads: [...s.uploads, { id, name, progress: 0 }] })),
  setProgress: (id, progress) =>
    set((s) => ({ uploads: s.uploads.map((u) => (u.id === id ? { ...u, progress } : u)) })),
  finishUpload: (id) => set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),
}))
