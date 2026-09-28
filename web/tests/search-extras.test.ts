import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runSearch } from '../server/utils/search'
import { recognitionStatus } from '../server/utils/status'
import { ApiError } from '../server/utils/errors'
import { profileOf } from '../server/taste/analogs'

const catalog = [
  profileOf({ slug: 'sap-1', name: 'Саперави 1', winery: 'Другая', category: 'Красное', grapes: 'Саперави', description: 'Сухое вино. Аромат вишни.' }),
  profileOf({ slug: 'merlot', name: 'Мерло', winery: 'Третья', category: 'Красное', grapes: 'Мерло', description: 'Аромат сливы.' }),
]
let scores: number[], visual: number, labelText: string | undefined, catalogFails: boolean

beforeEach(() => {
  scores = [0.9, 0.8, 0.79, 0.78, 0.7]; visual = 0.9; labelText = 'SAPERAVI red dry'; catalogFails = false
  vi.stubGlobal('ApiError', ApiError)
  vi.stubGlobal('recognitionStatus', recognitionStatus)
  vi.stubGlobal('appConfig', { notFoundScore: 0.75, confidenceMargin: 0.05 })
  vi.stubGlobal('readImage', async () => ({ data: Buffer.from('x'), filename: 'x.png', type: 'image/png' }))
  vi.stubGlobal('getEngine', () => ({
    name: 'fake', model: 'fake',
    recognize: async () => ({ candidates: scores.map((s, i) => ({ slug: `c${i}`, name: `C${i}`, winery: null, score: s })), bestVisualScore: visual, labelText }),
  }))
  vi.stubGlobal('getTasteCatalog', async () => { if (catalogFails) throw new Error('db down'); return catalog })
})

describe('/v1/search extras', () => {
  it('reports per-request confidence for Top-1 and Top-5', async () => {
    const r = await runSearch({} as any)
    expect(r.status).toBe('confident')
    expect(r.confidence).toEqual({
      top1: 0.9, top5: [0.9, 0.8, 0.79, 0.78, 0.7], gap_top2: 0.1, gap_top5: 0.2, visual_top1: 0.9,
      thresholds: { confidence_margin: 0.05, not_found_score: 0.75 },
    })
    expect(r.analogs).toBeUndefined()
  })

  it('not_found: analogs of other wineries from the grape on the label', async () => {
    visual = 0.6
    const r = await runSearch({} as any)
    expect(r.status).toBe('not_found')
    expect(r.label_hints?.grapes).toEqual(['саперави'])
    expect(r.analogs?.map(a => a.slug)).toEqual(['sap-1'])
    expect(r.analogs?.[0]?.image_url).toBe('/v1/wines/sap-1/image')
  })

  it('the {slug} path skips analogs; an analog failure keeps the answer', async () => {
    visual = 0.6
    expect((await runSearch({} as any, { analogs: false })).analogs).toBeUndefined()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    catalogFails = true
    const r = await runSearch({} as any)
    expect(r.status).toBe('not_found')
    expect(r.top1?.slug).toBe('c0')
    expect(r.analogs).toBeUndefined()
    err.mockRestore()
  })
})
