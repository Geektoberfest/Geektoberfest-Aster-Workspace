import multer from 'multer'
import Upload from '../models/Upload.js'
import ApiError from '../utils/apiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { IMAGE_TYPES, detectImageType } from '../utils/imageType.js'
import * as storage from '../services/storage.js'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const UNSUPPORTED = 'Unsupported file. Please upload a PNG, JPEG or WebP image.'

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
  // Reject by declared type before buffering anything; the contents are verified later
  fileFilter: (req, file, cb) => cb(IMAGE_TYPES[file.mimetype] ? null : new ApiError(415, UNSUPPORTED), true),
}).single('image')

export const receiveImage = (req, res, next) =>
  parser(req, res, (error) => {
    if (!error) return next()
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new ApiError(413, `Image is too large. The maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`))
      }
      return next(new ApiError(400, 'Invalid upload. Send a single image in the "image" field.'))
    }
    return next(error)
  })

export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'No image file provided')

  // The declared type must agree with what the bytes actually are
  const detected = detectImageType(req.file.buffer)
  if (!detected || detected !== req.file.mimetype) throw new ApiError(415, UNSUPPORTED)

  const key = await storage.save(req.file.buffer, IMAGE_TYPES[detected])
  let upload
  try {
    upload = await Upload.create({
      owner: req.user.id,
      key,
      mimeType: detected,
      size: req.file.size,
      originalName: String(req.file.originalname || '').slice(0, 255),
    })
  } catch (error) {
    await storage.remove(key).catch(() => {})
    throw error
  }

  res.status(201).json({
    success: true,
    data: { upload: { id: upload._id, url: `/api/uploads/${upload._id}`, mimeType: detected, size: upload.size } },
  })
})

// Images are private: only the user who uploaded one can fetch it
export const getImage = asyncHandler(async (req, res) => {
  const upload = await Upload.findOne({ _id: req.params.id, owner: req.user.id }).lean()
  if (!upload) throw new ApiError(404, 'Image not found')

  let file
  try {
    file = await storage.open(upload.key)
  } catch (error) {
    if (error.code === 'ENOENT') throw new ApiError(404, 'Image not found')
    throw error
  }

  res.set({
    'Content-Type': upload.mimeType,
    'Content-Length': file.size,
    'Content-Disposition': 'inline',
    'Content-Security-Policy': "default-src 'none'",
    // Content for an id never changes, but it must not be shared between users
    'Cache-Control': 'private, max-age=31536000, immutable',
  })
  file.stream.on('error', (error) => res.destroy(error))
  file.stream.pipe(res)
})
