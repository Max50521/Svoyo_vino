import type { H3Event } from 'h3'

export interface UploadedImage {
  data: Buffer
  filename: string
  type: string
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const HEIF_BRANDS = new Set(['heic', 'heix', 'mif1', 'msf1', 'hevc'])

const SIGNATURES: { type: string, test: (b: Buffer) => boolean }[] = [
  { type: 'image/jpeg', test: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { type: 'image/png', test: b => b.subarray(0, 8).equals(PNG_MAGIC) },
  { type: 'image/webp', test: b => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { type: 'image/gif', test: b => b.toString('ascii', 0, 4) === 'GIF8' },
  { type: 'image/bmp', test: b => b.toString('ascii', 0, 2) === 'BM' },
  { type: 'image/heic', test: b => b.toString('ascii', 4, 8) === 'ftyp' && HEIF_BRANDS.has(b.toString('ascii', 8, 12)) },
]

export function detectImageType(data: Buffer): string | null {
  if (data.length < 12) return null
  return SIGNATURES.find(s => s.test(data))?.type ?? null
}

/** Reads multipart field `image`; throws ApiError(400/413) on bad input. */
export async function readImage(event: H3Event): Promise<UploadedImage> {
  const contentType = getHeader(event, 'content-type') ?? ''
  if (!contentType.startsWith('multipart/form-data;')) throw new ApiError(400, 'expected multipart/form-data')
  // Bound the entire streamed request before parsing multipart, including chunked uploads.
  const limit = appConfig.maxUploadBytes + 64 * 1024
  if (Number(getHeader(event, 'content-length')) > limit) throw new ApiError(413, 'image too large')
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0, rejected = false
    event.node.req.on('data', (chunk: Buffer) => {
      if (rejected) return
      size += chunk.length
      if (size > limit) {
        rejected = true; chunks.length = 0
        reject(new ApiError(413, 'image too large'))
      } else chunks.push(chunk)
    })
    event.node.req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)) })
    event.node.req.on('error', () => reject(new ApiError(400, 'invalid upload')))
    event.node.req.on('aborted', () => reject(new ApiError(400, 'upload aborted')))
  })
  let parts: { name: string, data: Buffer, filename?: string }[]
  try {
    const form = await new Response(new Uint8Array(raw), { headers: { 'content-type': contentType } }).formData()
    parts = []
    for (const [name, value] of form.entries()) {
      if (typeof value !== 'string') parts.push({ name, filename: value.name, data: Buffer.from(await value.arrayBuffer()) })
    }
  } catch { throw new ApiError(400, 'invalid multipart/form-data') }
  const part = parts?.find(p => p.name === 'image')
  if (!part || !part.data?.length) throw new ApiError(400, 'missing multipart field "image"')
  if (part.data.length > appConfig.maxUploadBytes) throw new ApiError(413, 'image too large')
  const type = detectImageType(part.data)
  if (!type) throw new ApiError(400, 'unsupported or corrupted image')
  return { data: part.data, filename: part.filename || 'image', type }
}
