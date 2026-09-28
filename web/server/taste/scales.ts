// Sweetness, acidity, tannins and body from explicit words only.
import type { Evidence, Level, ScaleId, TasteScale } from './types'
import { ACIDITY, BODY, BODY_PHRASES, NEGATIONS, RULES_VERSION, SPARKLING_RE, SWEET_SPARKLING, SWEET_STILL, TANNIN, type ScaleLexicon, type SweetTerm } from './lexicon'
import { crossesBoundary, makeQuote, tokenize, type Token } from './normalize'

export interface FieldText { field: 'name' | 'description', clean: string, search: string, tokens: Token[] }

interface Finding { level: Level | null, label: string | null, descriptor: string | null, evidence: Evidence }

const rule = (id: string) => `${id}@${RULES_VERSION}`
const evidence = (f: FieldText, start: number, end: number, id: string): Evidence =>
  ({ field: f.field, ...makeQuote(f.clean, f.search, start, end), rule: rule(id) })

// Words allowed between a modifier and its noun: "ярко выраженная", "мягкие и бархатистые".
const LINKS = new Set(['и', 'очень', 'довольно', 'достаточно', 'весьма', 'слегка', 'чуть', 'хорошо', 'умеренно', 'вполне', 'явно', 'приятно', 'ненавязчиво', 'более', 'менее', 'на', 'редкость',
  'заметный', 'заметная', 'заметное', 'заметные', 'заметным', 'заметной', 'заметными', 'уловимый', 'уловимая', 'уловимые', 'уловимым', 'уловимой', 'уловимыми'])
const ALL_NOUNS = [ACIDITY.nouns, TANNIN.nouns, BODY.nouns]
const isFeatureNoun = (w: string) => ALL_NOUNS.some(re => re.test(w))

function classify(lex: ScaleLexicon, word: string) {
  const level = lex.levels.find(l => word.startsWith(l.stem))
  if (level) return { level: level.level, label: level.label, descriptor: null }
  const d = lex.descriptors.find(x => word.startsWith(x.stem))
  return d ? { level: null, label: null, descriptor: d.label } : null
}
// "выражены" (short form) and "выраженные" share this stem.
const classifyWord = (lex: ScaleLexicon, w: string) =>
  classify(lex, w.startsWith('выражен') ? 'выраженн' : w)

/** Modifier chain next to a feature noun, stopping at clause boundaries and other nouns. */
function modifiers(lex: ScaleLexicon, f: FieldText, i: number): Finding[] {
  const toks = f.tokens
  const out: Finding[] = []
  const noun = toks[i]!
  for (const dir of [-1, 1] as const) {
    const found: Array<{ tok: Token, c: NonNullable<ReturnType<typeof classify>> }> = []
    let negated = false
    for (let j = i + dir, steps = 0; j >= 0 && j < toks.length && steps < 5; j += dir, steps++) {
      const tok = toks[j]!
      const edge = dir < 0 ? [tok.end, toks[j + 1]!.start] : [toks[j - 1]!.end, tok.start]
      if (crossesBoundary(f.search, edge[0]!, edge[1]!)) break
      if (NEGATIONS.has(tok.text)) { negated = true; if (dir < 0) break; continue }
      if (isFeatureNoun(tok.text)) {
        // "кислотность и мягкие танины": modifiers before another noun belong to it.
        if (dir > 0) found.length = 0
        break
      }
      // Nouns like "минеральностью" are other features, not modifiers.
      const c = /ост(ь|и|ью|ей)$/.test(tok.text) ? null : classifyWord(lex, tok.text)
      if (c && (dir < 0 || lex.predicate.test(tok.text))) { found.push({ tok, c }); continue }
      if (LINKS.has(tok.text)) continue
      // After the noun only a predicate counts: "кислотность высокая." — not
      // "кислотностью и выраженной минеральностью", where the adjective belongs to the next word.
      if (dir > 0) found.length = 0
      break
    }
    // In one chain the level word nearest to the noun wins: "хрустящей средней кислотностью" → средняя.
    const nearestLevel = found.find(x => x.c.level)
    for (let k = found.length - 1; k >= 0; k--) {
      if (found[k]!.c.level && found[k] !== nearestLevel) found.splice(k, 1)
    }
    // "без выраженных танинов": a negation right before the chain cancels it.
    if (dir < 0 && found.length) {
      const first = toks.indexOf(found[found.length - 1]!.tok)
      for (let k = first - 1; k >= Math.max(0, first - 2); k--) {
        if (crossesBoundary(f.search, toks[k]!.end, toks[k + 1]!.start)) break
        if (NEGATIONS.has(toks[k]!.text)) negated = true
      }
    }
    if (negated || !found.length) continue
    // One quote per chain: "высокой освежающей кислотностью".
    const a = Math.min(noun.start, ...found.map(x => x.tok.start))
    const b = Math.max(noun.end, ...found.map(x => x.tok.end))
    for (const { c } of found) {
      out.push({ ...c, evidence: evidence(f, a, b, `${lex.id}.${c.level ? `level${c.level}` : 'descriptor'}`) })
    }
  }
  return out
}

function scanFeature(lex: ScaleLexicon, f: FieldText): Finding[] {
  const out: Finding[] = []
  f.tokens.forEach((tok, i) => { if (lex.nouns.test(tok.text)) out.push(...modifiers(lex, f, i)) })
  return out
}

function scanBodyPhrases(f: FieldText): Finding[] {
  const out: Finding[] = []
  for (const p of BODY_PHRASES) {
    for (const m of f.search.matchAll(p.re)) {
      const before = f.tokens.filter(t => t.end <= m.index!).slice(-2)
      if (before.some(t => NEGATIONS.has(t.text) && !crossesBoundary(f.search, t.end, m.index!))) continue
      out.push({ level: p.level, label: BODY.levelLabels[p.level], descriptor: null, evidence: evidence(f, m.index!, m.index! + m[0].length, p.rule) })
    }
  }
  return out
}

/** Tannin presence without intensity: "терпкий вкус". */
function scanAstringent(f: FieldText): Finding[] {
  const out: Finding[] = []
  f.tokens.forEach((tok, i) => {
    if (!tok.text.startsWith('терпк') || tok.text.startsWith('терпкост')) return
    const near = f.tokens.slice(Math.max(0, i - 3), i + 4).some(t => TANNIN.nouns.test(t.text))
    const neg = i > 0 && NEGATIONS.has(f.tokens[i - 1]!.text)
    if (!near && !neg) out.push({ level: null, label: null, descriptor: 'терпкие', evidence: evidence(f, tok.start, tok.end, 'tannin.astringent') })
  })
  return out
}

function combine(id: ScaleId, lex: ScaleLexicon | null, findings: Finding[], extra: Partial<TasteScale> = {}): TasteScale {
  const withLevel = findings.filter(x => x.level)
  const levels = new Set(withLevel.map(x => x.label ?? x.level))
  const descriptors = [...new Set(findings.map(x => x.descriptor).filter(Boolean))] as string[]
  const ev = dedupe(findings.map(x => x.evidence)).slice(0, 4)
  const base = { id, descriptor: descriptors.slice(0, 2).join(', ') || null, ...extra }
  if (levels.size > 1) {
    // Same coarse level with different words (e.g. "яркая" and "высокая") is not a conflict,
    // except for sweetness where each word is its own category.
    const coarse = new Set(withLevel.map(x => x.level))
    if (id === 'sweetness' || coarse.size > 1) return { ...base, state: 'conflict', level: null, label: null, evidence: ev }
  }
  if (withLevel.length) {
    const first = withLevel[0]!
    const label = lex && id !== 'sweetness' ? lex.levelLabels[first.level!] : first.label
    return { ...base, state: 'known', level: first.level, label, evidence: ev }
  }
  return { ...base, state: 'unknown', level: null, label: null, evidence: ev }
}

function dedupe(ev: Evidence[]): Evidence[] {
  const seen = new Set<string>()
  return ev.filter((e) => {
    const k = `${e.field}:${e.quote}:${e.start}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---- sweetness ------------------------------------------------------------

function termMatches(terms: SweetTerm[], s: string) {
  const all: Array<{ t: SweetTerm, start: number, end: number }> = []
  for (const t of terms) {
    for (const m of s.matchAll(new RegExp(`(?<![а-яa-z])(?:${t.re})(?![а-яa-z])`, 'g'))) all.push({ t, start: m.index!, end: m.index! + m[0].length })
  }
  all.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start)
  const kept: typeof all = []
  for (const m of all) if (!kept.some(k => m.start < k.end && k.start < m.end)) kept.push(m)
  return kept.sort((a, b) => a.start - b.start)
}

const WINE_WORD = /^(вин[оау]|винный|игрист|шампанск)/
const BRUT_FAMILY = new Set(['Брют натюр', 'Экстра брют', 'Брют'])

function scanSweetness(fields: FieldText[], sparkling: boolean): Finding[] {
  const terms = sparkling ? SWEET_SPARKLING : SWEET_STILL
  const out: Finding[] = []
  for (const f of fields) {
    for (const m of termMatches(terms, f.search)) {
      const idx = f.tokens.findIndex(t => t.start <= m.start && t.end > m.start)
      const prev = f.tokens[idx - 1]
      if (prev && NEGATIONS.has(prev.text)) continue
      // In descriptions a category needs the word "вино" next to it: "сладкие ароматы мёда" is not sweetness.
      if (f.field === 'description' && !BRUT_FAMILY.has(m.t.label)) {
        const near = f.tokens.slice(Math.max(0, idx - 2), idx + 3)
          .some(t => WINE_WORD.test(t.text) && !crossesBoundary(f.search, Math.min(t.start, m.start), Math.max(t.end, m.end)))
        if (!near) continue
      }
      out.push({ level: m.t.level, label: m.t.label, descriptor: null, evidence: evidence(f, m.start, m.end, `sweetness.${sparkling ? 'sparkling' : 'still'}`) })
    }
  }
  return out
}

export function isSparkling(fields: FieldText[]): boolean {
  return fields.some(f => SPARKLING_RE.test(f.search.replace(/игристост[а-я]*/g, ' ')))
}

export function buildScales(name: FieldText, description: FieldText): Record<ScaleId, TasteScale> {
  const sparkling = isSparkling([name, description])
  const d = description
  return {
    sweetness: combine('sweetness', null, scanSweetness([name, d], sparkling), { sparkling }),
    acidity: combine('acidity', ACIDITY, scanFeature(ACIDITY, d)),
    tannin: combine('tannin', TANNIN, [...scanFeature(TANNIN, d), ...scanAstringent(d)]),
    body: combine('body', BODY, [...scanFeature(BODY, d), ...scanBodyPhrases(d)]),
  }
}

export function fieldText(field: 'name' | 'description', clean: string, search: string): FieldText {
  return { field, clean, search, tokens: tokenize(search) }
}
