import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VectorEngine } from '../server/utils/engine/vector'
import { runSearch } from '../server/utils/search'
import { recognitionStatus } from '../server/utils/status'
import { ApiError } from '../server/utils/errors'
import { appConfig } from '../server/utils/config'
import { checkReadiness } from '../server/utils/readiness'
const photo = { data: Buffer.from('x'), filename: 'x.png', type: 'image/png' }
let rows: any[], mode: string
beforeEach(() => {
  process.env.MODEL_NAME = 'fake'; process.env.EMBEDDING_DIM = '4'; process.env.OCR_ENABLED = '1'; process.env.ENGINE = 'vector'
  rows = [{ slug: 'a', name: 'A', score: .8 }, { slug: 'b', name: 'B', score: .79 }]; mode = 'ok'
  vi.stubGlobal('appConfig', appConfig); vi.stubGlobal('ApiError', ApiError); vi.stubGlobal('recognitionStatus', recognitionStatus)
  vi.stubGlobal('getPool', () => ({ query: async () => ({ rows }) }))
  vi.stubGlobal('readImage', async () => photo); vi.stubGlobal('getEngine', () => new VectorEngine())
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/rerank')) {
      if (mode === 'rerank_error') return new Response('{}', { status: 503 })
      const c = rows.map(x => ({ ...x, visual: x.score, final: x.slug === 'leader' ? .66 : x.score + .1 }))
      return Response.json({ candidates: c })
    }
    return Response.json({ model: mode === 'wrong_model' ? 'wrong' : 'fake', embedding: mode === 'wrong_dim' ? [1, 0] : [.5, .5, .5, .5], ocr: mode === 'no_ocr' ? [] : [{ text: 'x', conf: 1 }] })
  })
})
describe('recognition resilience', () => {
  it('returns visual candidates when rerank fails', async () => { mode = 'rerank_error'; const r = await new VectorEngine().recognize(photo, 5); expect(r.candidates).toHaveLength(2); expect(r.diagnostics?.ocr_fallback).toBe('rerank_error') })
  it.each(['wrong_model', 'wrong_dim'])('rejects incompatible ML %s', async (m) => { mode = m; await expect(new VectorEngine().recognize(photo, 5)).rejects.toMatchObject({ status: 503 }) })
  it('empty index is unavailable', async () => { rows = []; await expect(runSearch({} as any)).rejects.toMatchObject({ status: 503 }) })
  it('single candidate has consistent confidence', async () => { mode = 'no_ocr'; rows = [{ slug: 'a', name: 'A', score: .8 }]; const r = await runSearch({} as any); expect(r.status).toBe('confident'); expect(r.confident).toBe(true) })
  it('low visual score is not confident despite large margin', async () => { mode = 'no_ocr'; rows = [{ slug: 'a', name: 'A', score: .7 }, { slug: 'b', name: 'B', score: .5 }]; const r = await runSearch({} as any); expect(r.status).toBe('not_found'); expect(r.confident).toBe(false) })
  it('preserves visual leader outside final top5 for status', async () => { rows = [{ slug: 'leader', name: 'Leader', score: .76 }, ...Array.from({ length: 5 }, (_, i) => ({ slug: String(i), name: String(i), score: .74 - i * .001 }))]; const r = await runSearch({} as any); expect(r.top5.some(c => c.slug === 'leader')).toBe(false); expect(r.status).not.toBe('not_found') })
  it('readiness rejects partial index', async () => { rows = [{ wines: 2, indexed: 1, full: 1, label_mid: 1, label_low: 1, min_dim: 4, max_dim: 4 }]; vi.stubGlobal('fetch', async () => Response.json({ model: 'fake', dim: 4 })); expect((await checkReadiness()).ready).toBe(false) })
  it('readiness requires matching model', async () => { rows = [{ wines: 2, indexed: 2, full: 2, label_mid: 2, label_low: 2, min_dim: 4, max_dim: 4 }]; vi.stubGlobal('fetch', async () => Response.json({ model: 'wrong', dim: 4 })); expect((await checkReadiness()).ready).toBe(false) })
  it('readiness accepts complete compatible index', async () => { rows = [{ wines: 2, indexed: 2, full: 2, label_mid: 2, label_low: 2, min_dim: 4, max_dim: 4 }]; vi.stubGlobal('fetch', async () => Response.json({ model: 'fake', dim: 4 })); expect((await checkReadiness()).ready).toBe(true) })
})
