// Public shape of the taste passport (GET /v1/wines/:slug -> taste_passport).
export type ScaleId = 'sweetness' | 'acidity' | 'tannin' | 'body'
export type ScaleState = 'known' | 'unknown' | 'conflict'
export type Level = 1 | 2 | 3

export type FamilyId =
  | 'citrus' | 'orchard' | 'red_berry' | 'dark_berry' | 'tropical' | 'dried' | 'floral'
  | 'herbal' | 'spice' | 'nut' | 'wood' | 'sweet' | 'mineral'

/** Where a conclusion comes from: an exact substring of the cleaned field text. */
export interface Evidence {
  field: 'name' | 'description'
  /** Clause of the source text that contains the match. */
  quote: string
  /** Offsets of the matched words inside `quote`. */
  start: number
  end: number
  /** Internal rule id with analyzer version; never shown in the UI. */
  rule: string
}

export interface TasteScale {
  id: ScaleId
  state: ScaleState
  /** Coarse level for the three markers; null unless state === 'known'. */
  level: Level | null
  /** Word label for the known level, e.g. "Полусладкое", "высокая". */
  label: string | null
  /** Quality without intensity, e.g. "бархатистые", "живая". */
  descriptor: string | null
  /** Sweetness only: the sparkling-wine scale is used. */
  sparkling?: boolean
  evidence: Evidence[]
}

export interface AromaNote {
  id: string
  label: string
  family: FamilyId
  /** The source names only the group ("ягоды", "цветы"), not a concrete note. */
  generic: boolean
  evidence: Evidence[]
}

export interface AromaFamily {
  id: FamilyId
  label: string
  /** Note ids in order of first mention. Grouping only: no quantity meaning. */
  notes: string[]
}

export interface TastePassport {
  version: string
  summary: string | null
  scales: Record<ScaleId, TasteScale>
  notes: AromaNote[]
  families: AromaFamily[]
}

export interface TasteInput {
  name?: string | null
  description?: string | null
}
