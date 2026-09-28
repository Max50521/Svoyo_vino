import type { H3Event } from 'h3'
import { findLabelAnalogs, type Analog, type LabelHints } from '../taste/analogs'

export interface CandidateOut extends Candidate {
  image_url: string
}

/**
 * How clearly the answer stands out (per request). These are ranking scores and gaps,
 * not probabilities and not F1; measured quality lives in GET /v1/metrics.
 */
export interface SearchConfidence {
  /** score of the Top-1 card */
  top1: number
  /** scores of the Top-5 cards, best first */
  top5: number[]
  /** Top-1 minus Top-2: the gap that decides "one card" vs "variants" */
  gap_top2: number | null
  /** Top-1 minus the last card of the Top-5 */
  gap_top5: number | null
  /** best visual similarity; below NOT_FOUND_SCORE the wine is treated as not in the catalog */
  visual_top1: number
  thresholds: { confidence_margin: number, not_found_score: number }
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
  confidence: SearchConfidence
  /** status = not_found: wines of other wineries with the grape read on the label */
  analogs?: Array<Analog & { image_url: string }>
  /** status = not_found: what the label states (grape, colour, sweetness) */
  label_hints?: LabelHints
  engine: string
  model: string | null
  latency_ms: number
  diagnostics?: Record<string, unknown>
}

export const wineImageUrl = (slug: string) => `/v1/wines/${encodeURIComponent(slug)}/image`

const r4 = (x: number) => Number(x.toFixed(4))

export async function runSearch(event: H3Event, opts: { analogs?: boolean } = {}): Promise<SearchResponse> {
  const t0 = performance.now()
  const image = await readImage(event)
  const engine = getEngine()
  const result = await engine.recognize(image, 5)
  const top5 = result.candidates.map(c => ({ ...c, image_url: wineImageUrl(c.slug) }))
  if (!top5.length) throw new ApiError(503, 'recognition index is empty')
  const margin = top5.length >= 2 ? r4(top5[0].score - top5[1].score) : null
  const status = recognitionStatus(result.bestVisualScore, margin, {
    notFoundScore: appConfig.notFoundScore, confidenceMargin: appConfig.confidenceMargin,
  })
  const confidence: SearchConfidence = {
    top1: top5[0].score,
    top5: top5.map(c => c.score),
    gap_top2: margin,
    gap_top5: top5.length >= 2 ? r4(top5[0].score - top5[top5.length - 1].score) : null,
    visual_top1: r4(result.bestVisualScore),
    thresholds: { confidence_margin: appConfig.confidenceMargin, not_found_score: appConfig.notFoundScore },
  }
  const extra: Pick<SearchResponse, 'analogs' | 'label_hints'> = {}
  if (status === 'not_found' && result.labelText && opts.analogs !== false) {
    // Optional: a failure here must not break recognition.
    try {
      const { hints, analogs } = findLabelAnalogs(result.labelText, await getTasteCatalog(), top5.map(c => c.slug))
      extra.label_hints = hints
      extra.analogs = analogs.map(a => ({ ...a, image_url: wineImageUrl(a.slug) }))
    }
    catch (e) {
      console.error('[analogs]', (e as Error)?.message ?? e)
    }
  }
  return {
    top1: top5[0] ?? null,
    top5,
    margin,
    confident: status === 'confident',
    // "not in catalog" is decided by the best *visual* match: label text must not pull in a wine
    // that does not look like the photo
    status,
    confidence,
    ...extra,
    diagnostics: { ...result.diagnostics, best_visual_score: result.bestVisualScore },
    engine: engine.name,
    model: engine.model,
    latency_ms: Math.round(performance.now() - t0),
  }
}
