// Text preparation. The search string has the same length as the cleaned text,
// so match offsets can be used to quote the cleaned text exactly.

const MAX_CHARS = 6000
const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»',
  mdash: '—', ndash: '–', hellip: '…', shy: '',
}

/** Plain text of a field: no HTML, decoded entities, collapsed spaces. */
export function cleanField(raw: string | null | undefined): string {
  if (!raw) return ''
  return String(raw)
    .slice(0, MAX_CHARS * 2)
    .replace(/<\s*(br|\/p|\/div|\/li)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))
        return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : ' '
      }
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/[\u00a0\u2000-\u200b\u202f\t\r]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n[\n ]*/g, '\n')
    .trim()
    .slice(0, MAX_CHARS)
}

/** Lower case, ё→е, unified dashes; one output char per input char. */
export function searchForm(text: string): string {
  let out = ''
  for (const ch of text) {
    let c = ch.toLowerCase()
    if (c.length !== 1) c = ch.length === 1 ? ch : ' '
    if (c === 'ё') c = 'е'
    else if ('\u2010\u2011\u2012\u2013\u2014'.includes(c)) c = '-'
    // Astral symbols take two UTF-16 units; keep the length equal.
    out += ch.length === 2 ? '  ' : c
  }
  return out
}

export interface Token { text: string, start: number, end: number }

const TOKEN_RE = /[a-zа-я0-9]+(?:-[a-zа-я0-9]+)*/g
/** Word tokens of a search-form string, with offsets. */
export function tokenize(s: string): Token[] {
  const out: Token[] = []
  for (const m of s.matchAll(TOKEN_RE)) out.push({ text: m[0], start: m.index!, end: m.index! + m[0].length })
  return out
}

/** Sentence and clause boundaries used for local context. */
const SENTENCE_END = /[.!?;\n…]/
const CLAUSE_END = /[.!?;\n…,:()«»"]/

function span(s: string, pos: number, stop: RegExp): [number, number] {
  let a = pos
  while (a > 0 && !stop.test(s[a - 1]!)) a--
  let b = pos
  while (b < s.length && !stop.test(s[b]!)) b++
  return [a, b]
}

export const sentenceAt = (s: string, pos: number) => span(s, pos, SENTENCE_END)
export const clauseAt = (s: string, pos: number) => span(s, pos, CLAUSE_END)

/** True when a clause separator or a contrast conjunction lies between a and b. */
export function crossesBoundary(s: string, a: number, b: number): boolean {
  const between = s.slice(Math.min(a, b), Math.max(a, b))
  return CLAUSE_END.test(between) || /(^|\s)(но|а|однако)\s/.test(between)
}

const QUOTE_MAX = 220

/** Human-sized exact quote around [start, end) with offsets relative to the quote. */
export function makeQuote(clean: string, search: string, start: number, end: number) {
  let [a, b] = sentenceAt(search, start)
  if (b < end) b = end
  if (b - a > QUOTE_MAX) {
    ;[a, b] = clauseAt(search, start)
    if (b < end) b = end
    // Grow by neighbouring clauses while it stays short.
    while (b - a < QUOTE_MAX / 2) {
      const [pa] = a > 1 ? clauseAt(search, a - 2) : [a]
      const [, nb] = b < search.length - 1 ? clauseAt(search, b + 1) : [0, b]
      if (pa < a && b - pa <= QUOTE_MAX) a = pa
      else if (nb > b && nb - a <= QUOTE_MAX) b = nb
      else break
    }
  }
  while (a < start && /\s/.test(clean[a]!)) a++
  while (b > end && /[\s,:]/.test(clean[b - 1]!)) b--
  return { quote: clean.slice(a, b), start: start - a, end: end - a }
}

/**
 * Ranges about food pairing or serving: aroma words there are dishes, not notes
 * ("подавайте к вишнёвому пирогу"). A range runs from the marker to the end of the sentence.
 */
const PAIRING_RE = new RegExp([
  'подава', 'подаетс', 'подойд', 'подходит', 'сочета(?:ется|ются|ться|ния\\s*:)', 'гармонир\\S* с ', 'в паре с', 'компаньон', 'аперитив',
  'гастроном', 'к блюд', 'к столу', 'к закуск', 'идеальн\\S* к ',
  '(?<![а-я])к\\s+(?:[а-я-]+\\s+){0,3}(?:пирог|мяс|сыр|рыб|дич|десерт|паст|морепродукт|птиц|салат|шашлык|стейк|баранин|говядин|свинин|утк|курк|куриц|фрукт|ягод|выпечк|шоколад|сладост|пицц|плов|суш)',
].join('|'), 'g')

export function pairingRanges(search: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const m of search.matchAll(PAIRING_RE)) out.push([m.index!, sentenceAt(search, m.index!)[1]])
  return out
}

export const inRanges = (pos: number, ranges: Array<[number, number]>) => ranges.some(([a, b]) => pos >= a && pos < b)
