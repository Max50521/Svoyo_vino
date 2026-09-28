// Analogs from other wineries, built from taste passports (no network, deterministic).
//  - card mode: wines like an open card (colour, grape, sweetness, shared notes, same scale levels);
//  - label mode: for a wine that is not in the catalog, from what OCR read on its label.
// Every reason shown to the user is a fact both wines share; nothing is inferred.
import type { ScaleId, TastePassport } from './types'
import { buildTastePassport } from './index'
import { searchForm } from './normalize'

export interface CatalogWine {
  slug: string
  name: string
  winery: string | null
  category: string | null
  grapes: string | null
  description: string | null
}

export interface TasteProfile {
  slug: string
  name: string
  winery: string | null
  wineryKey: string
  category: string | null
  grapes: string[]
  /** sparkling wine by name/description, even when the sweetness category is not stated */
  sparkling: boolean
  sweetness: { label: string, level: number, sparkling: boolean } | null
  levels: Partial<Record<Exclude<ScaleId, 'sweetness'>, { level: number, label: string }>>
  notes: Map<string, string>
  families: Set<string>
}

export interface Analog {
  slug: string
  name: string
  winery: string | null
  score: number
  reasons: string[]
}

export interface LabelHints {
  category: string | null
  sweetness: { label: string, level: number, sparkling: boolean } | null
  grapes: string[]
}

const norm = (s: string | null | undefined) => searchForm(s ?? '').replace(/[«»"'().,]/g, ' ').replace(/\s+/g, ' ').trim()

export function splitGrapes(grapes: string | null): string[] {
  return [...new Set((grapes ?? '').split(/[,;/]/).map(norm).filter(Boolean))]
}

/** "мускат" ~ "мускат белый", "красностоп" ~ "красностоп золотовский"; "каберне фран" ≠ "каберне совиньон". */
export const sameGrape = (a: string, b: string) => a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `)

export function profileOf(w: CatalogWine, passport: TastePassport = buildTastePassport(w)): TasteProfile {
  const s = passport.scales
  const levels: TasteProfile['levels'] = {}
  for (const id of ['acidity', 'tannin', 'body'] as const) {
    if (s[id].state === 'known') levels[id] = { level: s[id].level!, label: s[id].label! }
  }
  return {
    slug: w.slug,
    name: w.name,
    winery: w.winery,
    wineryKey: norm(w.winery),
    category: w.category || null,
    grapes: splitGrapes(w.grapes),
    sparkling: !!s.sweetness.sparkling,
    sweetness: s.sweetness.state === 'known' ? { label: s.sweetness.label!, level: s.sweetness.level!, sparkling: !!s.sweetness.sparkling } : null,
    levels,
    notes: new Map(passport.notes.filter(n => !n.generic).map(n => [n.id, n.label])),
    families: new Set(passport.families.map(f => f.id)),
  }
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const NOUN = { acidity: 'кислотность', tannin: 'танины', body: 'тело' } as const

function styleReason(category: string | null, sweet: { label: string } | null) {
  const parts = [category && lower(category), sweet && lower(sweet.label)].filter(Boolean)
  return parts.length ? `Тоже ${parts.join(' ')}` : null
}

/** Sweetness known on both sides must be compatible: same sparkling scale, not dry vs sweet. */
function sweetnessCompatible(a: TasteProfile['sweetness'], b: TasteProfile['sweetness']) {
  if (!a || !b) return true
  return a.sparkling === b.sparkling && Math.abs(a.level - b.level) < 1
}

function diverse(list: Analog[], profiles: Map<string, TasteProfile>, limit: number): Analog[] {
  const out: Analog[] = []
  const wineries = new Set<string>()
  for (const a of list) {
    const key = profiles.get(a.slug)!.wineryKey || a.slug
    if (wineries.has(key)) continue
    wineries.add(key)
    out.push(a)
    if (out.length >= limit) break
  }
  return out
}

const byScore = (a: Analog, b: Analog) => b.score - a.score || a.slug.localeCompare(b.slug)

/** Wines of other wineries that share style and taste facts with `target`. */
export function findAnalogs(target: TasteProfile, catalog: TasteProfile[], limit = 6): Analog[] {
  const scored: Analog[] = []
  for (const c of catalog) {
    if (c.slug === target.slug || (target.wineryKey && c.wineryKey === target.wineryKey)) continue
    if (target.category && c.category && c.category !== target.category) continue
    // sparkling and still wines are not analogs of each other
    if (target.sparkling !== c.sparkling) continue
    if (!sweetnessCompatible(target.sweetness, c.sweetness)) continue
    let score = 0
    const reasons: string[] = []
    const grapes = target.grapes.filter(g => c.grapes.some(x => sameGrape(g, x)))
    if (grapes.length) {
      score += 3 * Math.min(grapes.length, 2)
      reasons.push(`${grapes.length > 1 ? 'Те же сорта' : 'Тот же сорт'}: ${grapes.slice(0, 2).map(capitalize).join(', ')}`)
    }
    const sameSweet = target.sweetness && c.sweetness && target.sweetness.label === c.sweetness.label
    if (sameSweet) score += 2
    const style = styleReason(target.category && target.category === c.category ? target.category : null, sameSweet ? target.sweetness : null)
    const shared = [...target.notes.keys()].filter(id => c.notes.has(id))
    if (shared.length) {
      score += 1.5 * Math.min(shared.length, 4)
      reasons.push(`Общие ноты: ${shared.slice(0, 3).map(id => lower(target.notes.get(id)!)).join(', ')}`)
    }
    const union = new Set([...target.families, ...c.families])
    if (union.size) score += 2 * [...target.families].filter(f => c.families.has(f)).length / union.size
    for (const id of ['acidity', 'tannin', 'body'] as const) {
      const a = target.levels[id], b = c.levels[id]
      if (a && b && a.level === b.level) {
        score += 0.7
        reasons.push(`Тоже ${a.label} ${NOUN[id]}`)
      }
    }
    // A taste analog needs a real common fact: the grape or at least two shared notes.
    if (!grapes.length && shared.length < 2) continue
    if (score < 3) continue
    if (style) reasons.splice(grapes.length ? 1 : 0, 0, style)
    scored.push({ slug: c.slug, name: c.name, winery: c.winery, score: round(score), reasons: reasons.slice(0, 3) })
  }
  scored.sort(byScore)
  return diverse(scored, new Map(catalog.map(p => [p.slug, p])), limit)
}

// ---- label mode -------------------------------------------------------------

const COLOURS: Array<[RegExp, string]> = [
  [/(?<![a-zа-я])(бел(ое|ый|ая)|white|blanc|bianco)(?![a-zа-я])/, 'Белое'],
  [/(?<![a-zа-я])(красн(ое|ый|ая)|red|rouge|rosso|tinto)(?![a-zа-я])/, 'Красное'],
  [/(?<![a-zа-я])(розов(ое|ый|ая)|розе|rose|rosato|rosado)(?![a-zа-я])/, 'Розовое'],
  [/(?<![a-zа-я])(оранжев(ое|ый|ая)|оранж|orange)(?![a-zа-я])/, 'Оранжевое'],
]
const SWEET: Array<[RegExp, string, number, boolean]> = [
  [/(брют|brut)\s+(натюр|nature|zero)/, 'Брют натюр', 1, true],
  [/(экстра|extra)[\s-]+(брют|brut)/, 'Экстра брют', 1, true],
  [/(?<![a-zа-я])(брют|brut)(?![a-zа-я])/, 'Брют', 1, true],
  [/(?<![a-zа-я])(полусладк[а-я]*|semi[\s-]?sweet|demi[\s-]?doux)(?![a-zа-я])/, 'Полусладкое', 2, false],
  [/(?<![a-zа-я])(полусух[а-я]*|semi[\s-]?dry|demi[\s-]?sec)(?![a-zа-я])/, 'Полусухое', 2, false],
  [/(?<![a-zа-я])(сух(ое|ой|ая)|dry|sec|secco|seco|trocken)(?![a-zа-я])/, 'Сухое', 1, false],
  [/(?<![a-zа-я])(сладк(ое|ий|ая)|десертн[а-я]*|sweet|dolce|doux)(?![a-zа-я])/, 'Сладкое', 3, false],
]
/** Latin spellings on labels → catalog grape names. */
const GRAPE_ALIASES: Array<[string, string]> = [
  ['cabernet sauvignon', 'каберне совиньон'], ['cabernet franc', 'каберне фран'], ['sauvignon blanc', 'совиньон блан'],
  ['chardonnay', 'шардоне'], ['pinot noir', 'пино нуар'], ['pinot blanc', 'пино блан'], ['pinot gris', 'пино гри'],
  ['pinot grigio', 'пино гри'], ['riesling', 'рислинг'], ['merlot', 'мерло'], ['saperavi', 'саперави'],
  ['rkatsiteli', 'ркацители'], ['aligote', 'алиготе'], ['syrah', 'сира'], ['shiraz', 'шираз'], ['viognier', 'вионье'],
  ['krasnostop', 'красностоп'], ['muscat', 'мускат'], ['moscato', 'мускат'], ['kokur', 'кокур'],
  ['tsimlyansky', 'цимлянский черный'], ['traminer', 'траминер'], ['gewurztraminer', 'гевюрцтраминер'],
  ['malbec', 'мальбек'], ['marselan', 'марселан'], ['tempranillo', 'темпранильо'], ['petit verdot', 'пти вердо'],
  ['sibirkovy', 'сибирьковый'], ['chenin blanc', 'шенен блан'], ['gruner veltliner', 'грюнер вельтлинер'],
]
const SHORT_OK = new Set(['сира'])

/** What the label text states about the wine; only explicit words count. */
export function labelHints(text: string, grapeVocab: string[]): LabelHints {
  const t = ` ${norm(text)} `
  const colours = [...new Set(COLOURS.filter(([re]) => re.test(t)).map(([, c]) => c))]
  const sweet = SWEET.find(([re]) => re.test(t))
  const grapes: string[] = []
  // OCR often splits letters ("КАБ ЕРНЕ СОВИНЬОН"): long names are also looked up without spaces.
  const compact = t.replace(/\s+/g, '')
  const has = (g: string) => new RegExp(`(?<![a-zа-я])${g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zа-я])`).test(t)
    || (g.replace(/\s+/g, '').length >= 7 && compact.includes(g.replace(/\s+/g, '')))
  for (const g of [...grapeVocab].sort((a, b) => b.length - a.length)) {
    if ((g.length >= 5 || SHORT_OK.has(g)) && has(g) && !grapes.some(x => x.includes(g))) grapes.push(g)
  }
  for (const [latin, ru] of GRAPE_ALIASES) {
    if (has(latin) && grapeVocab.includes(ru) && !grapes.some(x => sameGrape(x, ru))) grapes.push(ru)
  }
  return {
    category: colours.length === 1 ? colours[0]! : null,
    sweetness: sweet ? { label: sweet[1], level: sweet[2], sparkling: sweet[3] } : null,
    grapes,
  }
}

/** Analogs for a wine that is not in the catalog: same grape from the label, compatible style. */
export function findLabelAnalogs(text: string, catalog: TasteProfile[], exclude: string[] = [], limit = 6): { hints: LabelHints, analogs: Analog[] } {
  const vocab = [...new Set(catalog.flatMap(p => p.grapes))]
  const hints = labelHints(text, vocab)
  if (!hints.grapes.length) return { hints, analogs: [] }
  const t = ` ${norm(text)} `
  const scored: Analog[] = []
  for (const c of catalog) {
    if (exclude.includes(c.slug)) continue
    // "из других виноделен": skip the producer named on the label
    if (c.wineryKey.length >= 4 && t.includes(` ${c.wineryKey} `)) continue
    if (hints.category && c.category && c.category !== hints.category) continue
    if (hints.sweetness?.sparkling && !c.sparkling) continue
    if (!sweetnessCompatible(hints.sweetness && { ...hints.sweetness }, c.sweetness)) continue
    const grapes = hints.grapes.filter(g => c.grapes.some(x => sameGrape(g, x)))
    if (!grapes.length) continue
    let score = 3 * grapes.length + (c.grapes.length === 1 ? 1 : 0) // single-variety wines are closer analogs
    const reasons = [`Сорт с этикетки: ${grapes.map(capitalize).join(', ')}`]
    const sameSweet = hints.sweetness && c.sweetness && hints.sweetness.label === c.sweetness.label
    if (hints.category && c.category === hints.category) score += 1
    if (sameSweet) score += 2
    const style = styleReason(hints.category && c.category === hints.category ? hints.category : null, sameSweet ? hints.sweetness : null)
    if (style) reasons.push(style)
    else if (hints.sweetness?.sparkling) reasons.push('Тоже игристое')
    score += Math.min(c.notes.size, 6) * 0.1 // prefer cards with a described taste
    scored.push({ slug: c.slug, name: c.name, winery: c.winery, score: round(score), reasons })
  }
  scored.sort(byScore)
  return { hints, analogs: diverse(scored, new Map(catalog.map(p => [p.slug, p])), limit) }
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function round(x: number) { return Math.round(x * 100) / 100 }
