// Aroma and flavour notes named in the description.
import type { AromaFamily, AromaNote } from './types'
import { ACIDITY, BODY, FAMILIES, NEGATIONS, NOT_A_NOTE_NEXT, NOTE_CONTEXT, NOTES, RULES_VERSION, TANNIN, type NoteTerm } from './lexicon'
import { clauseAt, crossesBoundary, inRanges, makeQuote, pairingRanges } from './normalize'
import type { FieldText } from './scales'

const COMPILED: Array<{ term: NoteTerm, re: RegExp }> = NOTES.map(term => ({
  term,
  re: new RegExp(`(?<![a-zа-я])(?:${term.patterns.join('|')})(?![a-zа-я])`, 'g'),
}))

const MAX_EVIDENCE = 3
// Clauses about the colour of the wine: "рубиново-гранатовый цвет", "с золотистыми отблесками".
const COLOUR_MARK = /^(цвет|цвета|цветом|цвете|окрас|отблеск|рефлекс|перелив|оттенок$)/
const PURE_COLOUR = /^(светл|темн|рубин|золот|соломен|янтар|кирпичн|пурпур|фиолет|медн|луков|бордов|малинов(?=о$)|зеленовато|желтовато)/
const COLOUR_WORD = /^(светл|темн|рубин|гранатов|золот|соломен|янтар|кирпичн|пурпур|фиолет|вишнев|лимонн|розов|медн|луков|малинов|абрикосов|персиков)/
const FEATURE_NOUN = (w: string) => ACIDITY.nouns.test(w) || TANNIN.nouns.test(w) || BODY.nouns.test(w)

interface Hit { term: NoteTerm, start: number, end: number }

function allHits(s: string): Hit[] {
  const hits: Hit[] = []
  for (const { term, re } of COMPILED) for (const m of s.matchAll(re)) hits.push({ term, start: m.index!, end: m.index! + m[0].length })
  // Longest match wins; equal length keeps the earlier one and then dictionary order.
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)
  const kept: Hit[] = []
  for (const h of hits) if (!kept.some(k => h.start < k.end && k.start < h.end)) kept.push(h)
  return kept.sort((a, b) => a.start - b.start)
}

function isColourClause(f: FieldText, pos: number): boolean {
  const [a, b] = clauseAt(f.search, pos)
  return f.tokens.some(t => t.start >= a && t.end <= b && COLOUR_MARK.test(t.text))
}

function rejected(f: FieldText, h: Hit, pairing: Array<[number, number]>): boolean {
  if (inRanges(h.start, pairing)) return true
  const idx = f.tokens.findIndex(t => t.start <= h.start && t.end > h.start)
  const tok = f.tokens[idx]
  if (!tok) return true
  // Compound colour words: "светло-лимонный", "рубиново-гранатовый".
  if (tok.text.includes('-') && tok.text.split('-').some(p => PURE_COLOUR.test(p))) return true
  if (COLOUR_WORD.test(tok.text) && isColourClause(f, h.start)) return true
  const before = f.tokens.slice(Math.max(0, idx - 3), idx).filter(t => !crossesBoundary(f.search, t.end, h.start))
  if (before.some(t => NEGATIONS.has(t.text))) return true
  const endIdx = f.tokens.findIndex(t => t.end >= h.end)
  const next = f.tokens[endIdx + 1]
  const nextSameClause = next && !crossesBoundary(f.search, h.end, next.start) ? next : undefined
  // "фруктовая кислотность" describes acidity, not an aroma.
  if (nextSameClause && (FEATURE_NOUN(nextSameClause.text) || NOT_A_NOTE_NEXT.test(nextSameClause.text))) return true
  // Technology, not aroma: "яблочно-молочное брожение" (malolactic fermentation).
  if (/^яблочно-молочн/.test(tok.text)) return true
  if (h.term.needsNoteContext) {
    const ctx = before.some(t => NOTE_CONTEXT.test(t.text)) || (nextSameClause && NOTE_CONTEXT.test(nextSameClause.text))
    if (!ctx) return true
  }
  return false
}

export function buildNotes(d: FieldText): { notes: AromaNote[], families: AromaFamily[] } {
  const pairing = pairingRanges(d.search)
  const byId = new Map<string, AromaNote>()
  for (const h of allHits(d.search)) {
    if (rejected(d, h, pairing)) continue
    const ev = { field: d.field, ...makeQuote(d.clean, d.search, h.start, h.end), rule: `note.${h.term.id}@${RULES_VERSION}` }
    const note = byId.get(h.term.id)
    if (note) { if (note.evidence.length < MAX_EVIDENCE && !note.evidence.some(e => e.quote === ev.quote && e.start === ev.start)) note.evidence.push(ev) }
    else byId.set(h.term.id, { id: h.term.id, label: h.term.label, family: h.term.family, generic: !!h.term.generic, evidence: [ev] })
  }
  let notes = [...byId.values()]
  // A generic note adds nothing next to a concrete one of the same family ("ягоды" + "вишня").
  notes = notes.filter(n => !n.generic || !notes.some(o => !o.generic && o.family === n.family && FAMILY_GENERIC_REDUNDANT.has(n.id)))
  const families: AromaFamily[] = FAMILIES
    .filter(fam => notes.some(n => n.family === fam.id))
    .map(fam => ({ id: fam.id, label: fam.label, notes: notes.filter(n => n.family === fam.id).map(n => n.id) }))
  return { notes, families }
}

/** Generic notes hidden when the same family already has a concrete note. */
const FAMILY_GENERIC_REDUNDANT = new Set(['citrus', 'fruit', 'berries', 'flowers', 'herbs', 'spices', 'nuts', 'dried_fruit', 'tropical'])
