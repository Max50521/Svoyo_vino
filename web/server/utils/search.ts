import type { H3Event } from 'h3'

export interface CandidateOut extends Candidate {
  image_url: string
}

export interface SearchResponse {
  top1: CandidateOut | null
  top5: CandidateOut[]
  /** top1.score - top2.score: how clearly the winner stands out */
  margin: number | null
  /** margin >= CONFIDENCE_MARGIN */
  confident: boolean
  /** UI decision: single card / card + alternatives / not in catalog */
  status: RecognitionStatus
  engine: string
  model: string | null
  latency_ms: number
  diagnostics?: Record<string, unknown>
}

export const wineImageUrl = (slug: string) => `/v1/wines/${encodeURIComponent(slug)}/image`

export async function runSearch(event: H3Event): Promise<SearchResponse> {
  const t0 = performance.now()
  const image = await readImage(event)
  const engine = getEngine()
  const result = await engine.recognize(image, 5)
  const top5 = result.candidates.map(c => ({ ...c, image_url: wineImageUrl(c.slug) }))
  if (!top5.length) throw new ApiError(503, 'recognition index is empty')
  const margin = top5.length >= 2 ? Number((top5[0].score - top5[1].score).toFixed(4)) : null
  const status = recognitionStatus(result.bestVisualScore, margin, {
    notFoundScore: appConfig.notFoundScore, confidenceMargin: appConfig.confidenceMargin,
  })
  return {
    top1: top5[0] ?? null,
    top5,
    margin,
    confident: status === 'confident',
    // "not in catalog" is decided by the best *visual* match: label text must not pull in a wine
    // that does not look like the photo
    status,
    diagnostics: { ...result.diagnostics, best_visual_score: result.bestVisualScore },
    engine: engine.name,
    model: engine.model,
    latency_ms: Math.round(performance.now() - t0),
  }
}
