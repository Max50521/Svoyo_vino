import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildTastePassport } from '../server/taste'
import type { TasteInput, TastePassport } from '../server/taste'

const p = (description: string, name = 'Вино') => buildTastePassport({ name, description })
const noteIds = (x: TastePassport) => x.notes.map(n => n.id)
const matched = (e: { quote: string, start: number, end: number }) => e.quote.slice(e.start, e.end)

describe('taste passport: acceptance cases', () => {
  it('1. «полусухое» is not «сухое»', () => {
    const r = p('Полусухое вино с ароматом груши.')
    expect(r.scales.sweetness).toMatchObject({ state: 'known', label: 'Полусухое', level: 2 })
    expect(buildTastePassport({ name: 'Рислинг белое полусухое', description: '' }).scales.sweetness.label).toBe('Полусухое')
  })

  it('2. «без выраженных танинов» gives no tannin level', () => {
    const r = p('Лёгкое вино без выраженных танинов.')
    expect(r.scales.tannin.state).toBe('unknown')
    expect(r.scales.tannin.level).toBeNull()
    expect(p('Танины не выражены.').scales.tannin.level).toBeNull()
  })

  it('3. «сливочная текстура, аромат чернослива» → prune, not plum', () => {
    const ids = noteIds(p('Сливочная текстура, аромат чернослива.'))
    expect(ids).toEqual(['prune'])
  })

  it('4. «насыщенный рубиновый цвет, лёгкое тело» → light body, colour is not a note', () => {
    const r = p('Насыщенный рубиновый цвет, лёгкое тело.')
    expect(r.scales.body).toMatchObject({ state: 'known', level: 1, label: 'лёгкое' })
    expect(r.notes).toEqual([])
  })

  it('5. «аромат мёда, сухое вино» stays dry', () => {
    const r = p('Аромат мёда, сухое вино.')
    expect(r.scales.sweetness).toMatchObject({ state: 'known', label: 'Сухое', level: 1 })
    expect(noteIds(r)).toEqual(['honey'])
    expect(p('Сладкие ароматы мёда.').scales.sweetness.state).toBe('unknown')
  })

  it('6. «гармоничная кислотность» is not medium', () => {
    const s = p('Гармоничная кислотность.').scales.acidity
    expect(s.state).toBe('unknown')
    expect(s.level).toBeNull()
    expect(s.descriptor).toBe('гармоничная')
  })

  it('7. oak ageing and pairing do not add vanilla or cherry', () => {
    const r = p('Выдержано в дубе, подавайте к вишнёвому пирогу.')
    expect(r.notes).toEqual([])
    expect(noteIds(p('Хорошо к вишнёвому пирогу. Аромат малины.'))).toEqual(['raspberry'])
    expect(noteIds(p('В аромате тона дуба и ванили.'))).toEqual(['oak', 'vanilla'])
  })

  it('8. conflicts, empty text, XSS and long text are safe', () => {
    const c = p('Высокая кислотность. Во вкусе низкая кислотность.').scales.acidity
    expect(c).toMatchObject({ state: 'conflict', level: null, label: null })
    expect(c.evidence).toHaveLength(2)

    const empty = buildTastePassport({ name: null, description: null })
    expect(empty.summary).toBeNull()
    expect(empty.notes).toEqual([])
    expect(Object.values(empty.scales).every(s => s.state === 'unknown' && s.level === null)).toBe(true)

    const xss = p('<script>alert("x")</script><img src=x onerror=alert(1)> Аромат <b>вишни</b> &amp; малины')
    const quotes = JSON.stringify(xss)
    expect(quotes).not.toMatch(/<script|onerror|<img|<b>/)
    expect(noteIds(xss)).toEqual(['cherry', 'raspberry'])

    const long = p(`${'Аромат вишни, сливы и специй, высокая кислотность. '.repeat(400)}`)
    expect(long.notes.length).toBeGreaterThan(0)
    expect(long.scales.acidity.state).toBe('known')
  })

  it('9. every known scale and note has an exact, reproducible source', () => {
    const w: TasteInput = { name: 'Каберне белое сухое', description: 'В аромате чёрная смородина и кедр. Вкус с высокой кислотностью, выраженными танинами и полным телом.' }
    const a = buildTastePassport(w)
    const b = buildTastePassport(w)
    expect(a).toEqual(b)
    for (const s of Object.values(a.scales)) {
      if (s.state !== 'known') continue
      expect(s.evidence.length).toBeGreaterThan(0)
      for (const e of s.evidence) expect(w[e.field]).toContain(e.quote)
    }
    for (const n of a.notes) {
      expect(n.evidence.length).toBeGreaterThan(0)
      for (const e of n.evidence) {
        expect(w[e.field]).toContain(e.quote)
        expect(matched(e).length).toBeGreaterThan(0)
      }
    }
    expect(a.summary).toBe('Сухое · высокая кислотность · выраженные танины · полное тело')
  })
})

describe('taste passport: extraction rules', () => {
  it('keeps a modifier with its own feature', () => {
    const r = p('Высокая кислотность и мягкие танины.')
    expect(r.scales.acidity).toMatchObject({ state: 'known', label: 'высокая' })
    expect(r.scales.tannin).toMatchObject({ state: 'unknown', descriptor: 'мягкие', level: null })
  })

  it('does not take an adjective of the next word', () => {
    const r = p('Вкус с умеренной кислотностью и выраженной минеральностью.')
    expect(r.scales.acidity).toMatchObject({ state: 'known', label: 'средняя' })
    expect(p('Кислотность высокая, послевкусие долгое.').scales.acidity.label).toBe('высокая')
  })

  it('uses the sparkling sweetness scale', () => {
    const s = buildTastePassport({ name: 'Игристое Брют розовое', description: 'Аромат клубники.' }).scales.sweetness
    expect(s).toMatchObject({ state: 'known', label: 'Брют', sparkling: true })
    expect(buildTastePassport({ name: 'Шардоне экстра брют', description: '' }).scales.sweetness.label).toBe('Экстра брют')
  })

  it('keeps generic groups generic', () => {
    const r = p('Аромат ягод и цветов.')
    expect(r.notes.map(n => [n.label, n.generic])).toEqual([['Ягоды', true], ['Цветы', true]])
  })

  it('ignores colour and technology words', () => {
    expect(p('Цвет светло-лимонный с золотистыми отблесками.').notes).toEqual([])
    expect(p('Сбор винограда вручную, выращен на меловых почвах.').notes).toEqual([])
    expect(noteIds(p('Аромат с нотами спелого винограда.'))).toEqual(['grape'])
  })

  it('«интенсивный аромат» and «насыщенный вкус» are not body', () => {
    expect(p('Интенсивный аромат, насыщенный вкус.').scales.body.state).toBe('unknown')
  })

  it('fixes found in the manual review of 50 cards', () => {
    // "в сочетании с" is not food pairing
    expect(noteIds(p('Тона сухофруктов в сочетании с медом, степными травами.'))).toEqual(['dried_fruit', 'honey', 'herbs'])
    // "едва заметный танин" is a light level
    expect(p('С едва заметным танином и освежающей кислотностью.').scales.tannin).toMatchObject({ state: 'known', label: 'лёгкие' })
    // English category in the name
    expect(buildTastePassport({ name: 'Quintessence Semi-Sweet White', description: '' }).scales.sweetness.label).toBe('Полусладкое')
    // lemongrass is one herbal note; malolactic fermentation is not an apple
    expect(noteIds(p('С оттенками ревеня, лимонной травы и персика.'))).toEqual(['rhubarb', 'lemongrass', 'peach'])
    expect(p('Прошло яблочно-молочное брожение.').notes).toEqual([])
  })

  it('limits the map grouping to found families without quantities', () => {
    const r = p('Аромат лимона, груши, вишни и мёда.')
    expect(r.families.map(f => f.id)).toEqual(['citrus', 'orchard', 'red_berry', 'sweet'])
    expect(r.families.flatMap(f => f.notes)).toEqual(noteIds(r).sort((a, b) => r.families.findIndex(f => f.notes.includes(a)) - r.families.findIndex(f => f.notes.includes(b))))
  })
})

describe('taste passport: real catalog samples', () => {
  const samples = JSON.parse(readFileSync(new URL('../../docs/taste-passport-catalog-samples.json', import.meta.url), 'utf8')).records as Array<TasteInput & { slug: string }>
  const bySlug = Object.fromEntries(samples.map(s => [s.slug, buildTastePassport(s)]))

  it('Автохтонное вино Крыма: dry from the name, full palate, dried apricot', () => {
    const r = bySlug['avtohtonnoe-vino-kryma-beloe-suhoe']!
    expect(r.scales.sweetness).toMatchObject({ state: 'known', label: 'Сухое' })
    expect(r.scales.sweetness.evidence[0]!.field).toBe('name')
    expect(r.scales.body.label).toBe('полное')
    expect(noteIds(r)).toEqual(['flowers', 'dried_apricot', 'pear', 'honey'])
  })

  it('Мускат: harmonious acidity has no level; exotic fruit and bergamot', () => {
    const r = bySlug['belbek-muskat-muskat-belyy-beloe-suhoe-127']!
    expect(r.scales.acidity).toMatchObject({ state: 'unknown', descriptor: 'гармоничная' })
    expect(r.scales.sweetness.state).toBe('unknown')
    expect(noteIds(r)).toEqual(['tropical', 'bergamot'])
    expect(r.summary).toBeNull()
  })

  it('Пет-Нат Рубин: sparkling with unknown sweetness, high acidity, berries', () => {
    const r = bySlug['denisov_pet_nat_rubin']!
    expect(r.scales.sweetness).toMatchObject({ state: 'unknown', sparkling: true })
    expect(r.scales.acidity).toMatchObject({ state: 'known', label: 'высокая' })
    expect(noteIds(r)).toEqual(['garden_berries', 'cherry', 'lingonberry', 'cranberry', 'cornel', 'black_currant'])
  })

  it('Good Steak Cabernet: moderate acidity, round tannins without level', () => {
    const r = bySlug['good-steak-cabernet']!
    expect(r.scales.acidity.label).toBe('средняя')
    expect(r.scales.tannin).toMatchObject({ state: 'unknown', descriptor: 'округлые' })
    expect(noteIds(r)).toEqual(['fruit', 'cocoa', 'dark_berries', 'spices'])
  })
})
