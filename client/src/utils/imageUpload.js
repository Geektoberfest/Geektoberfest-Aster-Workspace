import api, { getErrorMessage } from '../services/api'
import { useUploadStore } from '../store/uploadStore'
import { toast } from '../store/toastStore'

// Keep in sync with the server limits (server/src/controllers/uploadController.js)
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

let nextUploadId = 1

// Returns an error message for an unusable file, or null when it is fine to upload
export const validateImageFile = (file) => {
  if (!file) return 'No file selected.'
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Only PNG, JPEG and WebP images can be uploaded.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_IMAGE_BYTES) return `That image is too large. The maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`
  return null
}

// Uploads the file, then inserts the stored image into the editor. On any failure the
// document is left untouched and an error toast explains what went wrong.
export const uploadImageToEditor = async (editor, file) => {
  const problem = validateImageFile(file)
  if (problem) {
    toast.error(problem)
    return
  }

  const { startUpload, setProgress, finishUpload } = useUploadStore.getState()
  const id = nextUploadId++
  const insertAt = editor.state.selection.from
  startUpload(id, file.name)

  try {
    const form = new FormData()
    form.append('image', file)
    const { data } = await api.post('/uploads', form, {
      onUploadProgress: (event) => setProgress(id, event.total ? event.loaded / event.total : 0),
    })

    // The user may have left the page while the upload ran
    if (editor.isDestroyed) return
    const src = `${String(api.defaults.baseURL).replace(/\/$/, '')}/uploads/${data.data.upload.id}`
    const position = Math.min(insertAt, editor.state.doc.content.size)
    editor
      .chain()
      .focus()
      .insertContentAt(position, { type: 'image', attrs: { src, alt: file.name.replace(/\.[^.]+$/, '') } })
      .run()
  } catch (error) {
    toast.error(getErrorMessage(error, 'Could not upload the image'))
  } finally {
    finishUpload(id)
  }
}

// Opens the system file picker and uploads the chosen image
export const pickAndUploadImage = (editor) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ALLOWED_IMAGE_TYPES.join(',')
  input.onchange = () => {
    const [file] = input.files || []
    if (file) uploadImageToEditor(editor, file)
  }
  input.click()
}
