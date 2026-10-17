// Identifies an image from its first bytes instead of trusting the file name or the
// Content-Type header, both of which the client controls.
export const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

const startsWith = (buffer, bytes, offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte)

export const detectImageType = (buffer) => {
  if (!buffer || buffer.length < 12) return null
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  // WebP: "RIFF" <size> "WEBP"
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return null
}
