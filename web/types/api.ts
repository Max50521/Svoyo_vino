// Shapes of the public API responses (see README "API").
import type { TastePassport } from './taste'

export type * from './taste'
export type RecognitionStatus = 'confident' | 'uncertain' | 'not_found'

export interface WineShort {
  slug: string
  name: string
  winery: string | null
  score: number
  image_url: string
}

/** Wine of another winery that shares grape/style/notes; reasons are shared facts only. */
export interface Analog {
  slug: string
  name: string
  winery: string | null
  score: number
  reasons: string[]
  image_url: string
}

export interface LabelHints {
  category: string | null
  sweetness: { label: string, level: number, sparkling: boolean } | null
  grapes: string[]
}

/** Per-request ranking scores and gaps (not probabilities, not F1). */
export interface SearchConfidence {
  top1: number
  top5: number[]
  gap_top2: number | null
  gap_top5: number | null
  visual_top1: number
  thresholds: { confidence_margin: number, not_found_score: number }
}

export interface SearchResult {
  top1: WineShort | null
  top5: WineShort[]
  margin: number | null
  confident: boolean
  status: RecognitionStatus
  /** Absent on servers before this field was added. */
  confidence?: SearchConfidence
  /** status = not_found: same grape from the label, other wineries */
  analogs?: Analog[]
  label_hints?: LabelHints
  engine: string
  model: string | null
  latency_ms: number
}

export interface Wine {
  slug: string
  name: string
  category: string | null
  color: string | null
  region: string | null
  grapes: string | null
  description: string | null
  winery: string | null
  image_url: string
  /** Absent on servers before the taste passport; null when the analyzer failed. */
  taste_passport?: TastePassport | null
}
