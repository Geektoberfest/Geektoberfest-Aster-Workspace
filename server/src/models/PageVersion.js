import mongoose from 'mongoose'

// Immutable snapshot of a page's title and content at a point in time
const pageVersionSchema = new mongoose.Schema(
  {
    page: { type: mongoose.Types.ObjectId, ref: 'Page', required: true },
    owner: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'Untitled', maxlength: 300 },
    // Tiptap JSON document
    content: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

pageVersionSchema.index({ page: 1, createdAt: -1 })

export default mongoose.model('PageVersion', pageVersionSchema)
