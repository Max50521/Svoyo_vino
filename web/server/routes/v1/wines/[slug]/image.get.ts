import { createReadStream, existsSync, openSync, readSync, closeSync } from 'node:fs'
import { resolve } from 'node:path'

// Catalog reference photo. build_catalog.py stores it as <slug><ext>, so no DB lookup is needed.
const TYPES: [string, string][] = [
  ['.webp', 'image/webp'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'],
  ['.gif', 'image/gif'], ['.bmp', 'image/bmp'], ['.tif', 'image/tiff'], ['.tiff', 'image/tiff'],
]

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[\w-]+$/.test(slug)) return sendApiError(event, new ApiError(400, 'bad slug'))
  for (const [ext, type] of TYPES) {
    const path = resolve(appConfig.catalogImagesDir, slug + ext)
    if (existsSync(path)) {
      const fd = openSync(path, 'r')
      const header = Buffer.alloc(16)
      try { readSync(fd, header, 0, 16, 0) } finally { closeSync(fd) }
      setResponseHeaders(event, { 'Content-Type': detectImageType(header) ?? type, 'Cache-Control': 'public, max-age=86400' })
      return sendStream(event, createReadStream(path))
    }
  }
  return sendApiError(event, new ApiError(404, 'image not found'))
})
