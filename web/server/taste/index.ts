// buildTastePassport(wine): deterministic, offline, no side effects.
import type { ScaleId, TasteInput, TastePassport, TasteScale } from './types'
import { RULES_VERSION } from './lexicon'
import { cleanField, searchForm } from './normalize'
import { buildScales, fieldText } from './scales'
import { buildNotes } from './aromas'

export type * from './types'
export { RULES_VERSION } from './lexicon'

const SUMMARY_ORDER: ScaleId[] = ['sweetness', 'acidity', 'tannin', 'body']
const NOUN: Record<ScaleId, string> = { sweetness: '', acidity: 'кислотность', tannin: 'танины', body: 'тело' }

/** One line from known scales only; null when nothing is known. */
function summarize(scales: Record<ScaleId, TasteScale>): string | null {
  const parts = SUMMARY_ORDER
    .map(id => scales[id])
    .filter(s => s.state === 'known' && s.label)
    .map(s => (s.id === 'sweetness' ? s.label! : `${s.label} ${NOUN[s.id]}`))
  if (!parts.length) return null
  const line = parts.join(' · ')
  return line[0]!.toUpperCase() + line.slice(1)
}

export function buildTastePassport(wine: TasteInput): TastePassport {
  const nameClean = cleanField(wine.name)
  const descClean = cleanField(wine.description)
  const name = fieldText('name', nameClean, searchForm(nameClean))
  const description = fieldText('description', descClean, searchForm(descClean))
  const scales = buildScales(name, description)
  const { notes, families } = buildNotes(description)
  return { version: RULES_VERSION, summary: summarize(scales), scales, notes, families }
}
