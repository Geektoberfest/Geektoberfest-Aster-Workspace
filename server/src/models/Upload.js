import mongoose from 'mongoose'

// Metadata for an uploaded file. The bytes live in the storage provider under `key`.
const uploadSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '', maxlength: 255 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

uploadSchema.index({ owner: 1, createdAt: -1 })

export default mongoose.model('Upload', uploadSchema)
