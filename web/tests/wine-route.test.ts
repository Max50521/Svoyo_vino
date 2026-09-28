import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, sendApiError } from '../server/utils/errors'

const analyzer = vi.hoisted(() => ({ fail: false }))
vi.mock('../server/taste', async (orig) => {
  const real = await orig<typeof import('../server/taste')>()
  return { ...real, buildTastePassport: (w: Parameters<typeof real.buildTastePassport>[0]) => {
    if (analyzer.fail) throw new Error('boom')
    return real.buildTastePassport(w)
  } }
})

const ROW = { slug: 'x', name: 'Шардоне белое сухое', category: 'Белое', color: 'Соломенный', region: 'Крым', grapes: 'Шардоне', description: 'Аромат груши, высокая кислотность.', winery: 'W' }
let db: 'ok' | 'empty' | 'down'
let status = 200

beforeEach(() => {
  db = 'ok'; status = 200; analyzer.fail = false
  vi.stubGlobal('defineEventHandler', (h: unknown) => h)
  vi.stubGlobal('getRouterParam', () => 'x')
  vi.stubGlobal('ApiError', ApiError)
  vi.stubGlobal('sendApiError', sendApiError)
  vi.stubGlobal('setResponseStatus', (_e: unknown, s: number) => { status = s })
  vi.stubGlobal('wineImageUrl', (s: string) => `/v1/wines/${s}/image`)
  vi.stubGlobal('getPool', () => ({ query: async () => {
    if (db === 'down') throw new Error('connection refused')
    return { rows: db === 'ok' ? [ROW] : [] }
  } }))
})

async function call() {
  const { default: handler } = await import('../server/routes/v1/wines/[slug]/index.get')
  return (handler as unknown as (e: object) => Promise<Record<string, unknown>>)({})
}

describe('GET /v1/wines/:slug with taste_passport', () => {
  it('keeps every old field and adds the passport', async () => {
    const body = await call()
    expect(status).toBe(200)
    expect(body).toMatchObject({ ...ROW, image_url: '/v1/wines/x/image' })
    const tp = body.taste_passport as { version: string, scales: { sweetness: { label: string } }, notes: Array<{ id: string }> }
    expect(tp.version).toMatch(/^taste-rules@/)
    expect(tp.scales.sweetness.label).toBe('Сухое')
    expect(tp.notes.map(n => n.id)).toEqual(['pear'])
  })

  it('analyzer failure keeps the card (200) and hides the passport', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    analyzer.fail = true
    const body = await call()
    expect(status).toBe(200)
    expect(body.taste_passport).toBeNull()
    expect(body.name).toBe(ROW.name)
    expect(JSON.stringify(body)).not.toMatch(/boom|stack|at /)
    err.mockRestore()
  })

  it('404 and 503 are unchanged', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    db = 'empty'
    expect(await call()).toEqual({ error: 'wine "x" not found' })
    expect(status).toBe(404)
    db = 'down'
    expect(await call()).toEqual({ error: 'Сервис временно недоступен. Попробуйте ещё раз.' })
    expect(status).toBe(503)
    err.mockRestore()
  })
})
