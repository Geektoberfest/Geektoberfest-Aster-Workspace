import mongoose from 'mongoose'

const emptyDoc = () => ({ type: 'doc', content: [{ type: 'paragraph' }] })

const pageSchema = new mongoose.Schema(
  {
    title: { type: String, default: 'Untitled', trim: true, maxlength: 300 },
    icon: { type: String, default: '📄', trim: true, maxlength: 16 },
    // Tiptap JSON document
    content: { type: mongoose.Schema.Types.Mixed, default: emptyDoc },
    // Plain-text projection of content, kept in sync for search + snippets
    contentText: { type: String, default: '', maxlength: 200000 },
    parentPage: { type: mongoose.Types.ObjectId, ref: 'Page', default: null },
    // Order among siblings (ascending); ties fall back to createdAt
    position: { type: Number, default: 0 },
    owner: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    isFavorite: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

pageSchema.index({ owner: 1, isDeleted: 1 })
pageSchema.index({ owner: 1, parentPage: 1, isDeleted: 1 })

export { emptyDoc }
export default mongoose.model('Page', pageSchema)