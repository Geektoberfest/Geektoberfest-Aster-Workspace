import { createReadStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Storage provider used for uploaded files. Controllers only call save/open/remove, so
// swapping local disk for S3, Cloudinary, etc. means replacing this module's
// implementation; nothing else needs to change. Files are addressed by an opaque `key`.
const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || defaultDir)

// Keys are generated here and never come from user input, but resolve defensively anyway
const resolveKey = (key) => {
  const target = path.resolve(uploadDir(), key)
  if (path.dirname(target) !== uploadDir()) throw new Error('Invalid storage key')
  return target
}

export const save = async (buffer, extension) => {
  const key = `${randomUUID()}.${extension}`
  await mkdir(uploadDir(), { recursive: true })
  await writeFile(resolveKey(key), buffer, { flag: 'wx' })
  return key
}

// Resolves to { stream, size }, or rejects with ENOENT when the file is missing
export const open = async (key) => {
  const target = resolveKey(key)
  const { size } = await stat(target)
  return { stream: createReadStream(target), size }
}

export const remove = async (key) => {
  try {
    await unlink(resolveKey(key))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}
