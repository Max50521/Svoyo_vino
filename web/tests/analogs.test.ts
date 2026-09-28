import { describe, expect, it } from 'vitest'
import { findAnalogs, findLabelAnalogs, labelHints, profileOf, sameGrape, type CatalogWine } from '../server/taste/analogs'

const w = (slug: string, winery: string, category: string, grapes: string, description: string, name = slug): CatalogWine =>
  ({ slug, name, winery, category, grapes, description })

const catalog = [
  w('target', 'Винодельня А', 'Красное', 'Саперави', 'Сухое вино. Аромат вишни, чернослива и специй, высокая кислотность.', 'Саперави А'),
  w('same-winery', 'Винодельня А', 'Красное', 'Саперави', 'Сухое вино. Аромат вишни и чернослива.'),
  w('twin', 'Винодельня Б', 'Красное', 'Саперави', 'Сухое вино. Аромат вишни и чернослива, высокая кислотность.'),
  w('twin-2', 'Винодельня Б', 'Красное', 'Саперави', 'Сухое вино с нотами вишни.'),
  w('notes-only', 'Винодельня В', 'Красное', 'Мерло', 'Аромат вишни, чернослива и специй.'),
  w('one-note', 'Винодельня Г', 'Красное', 'Мерло', 'Аромат вишни.'),
  w('white', 'Винодельня Д', 'Белое', 'Саперави', 'Аромат вишни и чернослива.'),
  w('sweet', 'Винодельня Е', 'Красное', 'Саперави', 'Сладкое вино. Аромат вишни и чернослива.'),
].map(x => profileOf(x))
const target = catalog[0]!

describe('analogs of a catalog wine', () => {
  const found = findAnalogs(target, catalog)
  const slugs = found.map(a => a.slug)

  it('keeps only other wineries, one wine per winery', () => {
    expect(slugs).not.toContain('target')
    expect(slugs).not.toContain('same-winery')
    expect(slugs.filter(s => s.startsWith('twin'))).toEqual(['twin'])
  })

  it('never mixes colours or dry with sweet', () => {
    expect(slugs).not.toContain('white')
    expect(slugs).not.toContain('sweet')
  })

  it('needs the grape or at least two shared notes', () => {
    expect(slugs).toContain('notes-only')
    expect(slugs).not.toContain('one-note')
    expect(slugs[0]).toBe('twin')
  })

  it('explains the match only with shared facts', () => {
    const twin = found.find(a => a.slug === 'twin')!
    expect(twin.reasons).toEqual(['Тот же сорт: Саперави', 'Тоже красное сухое', 'Общие ноты: вишня, чернослив'])
    const notes = found.find(a => a.slug === 'notes-only')!
    expect(notes.reasons[0]).toBe('Тоже красное')
    expect(notes.reasons.join(' ')).not.toMatch(/сорт|сухое/)
  })

  it('is deterministic', () => {
    expect(findAnalogs(target, catalog)).toEqual(found)
  })
})

describe('analogs from the label of an unknown wine', () => {
  it('reads grape, colour and sweetness, including Latin spellings', () => {
    expect(labelHints('SAPERAVI Red dry 2021', ['саперави', 'мерло'])).toEqual({
      category: 'Красное', sweetness: { label: 'Сухое', level: 1, sparkling: false }, grapes: ['саперави'],
    })
    expect(labelHints('Красное полусладкое', ['саперави']).grapes).toEqual([])
    expect(labelHints('Белое и красное', []).category).toBeNull()
    // letters split by OCR; short names are not matched without spaces
    expect(labelHints('КАБ ЕРНЕ СОВИ НЬОН', ['каберне совиньон']).grapes).toEqual(['каберне совиньон'])
    expect(labelHints('ме рло', ['мерло']).grapes).toEqual([])
  })

  it('returns same-grape wines of compatible style and skips the producer on the label', () => {
    const { analogs } = findLabelAnalogs('Винодельня Б саперави красное сухое', catalog)
    const slugs = analogs.map(a => a.slug)
    expect(slugs).not.toContain('twin')
    expect(slugs).not.toContain('white')
    expect(slugs).not.toContain('sweet')
    // one wine per winery: "Винодельня А" is represented once
    expect(slugs.filter(s => s === 'target' || s === 'same-winery')).toHaveLength(1)
    expect(analogs[0]!.reasons[0]).toBe('Сорт с этикетки: Саперави')
  })

  it('gives nothing without a grape on the label', () => {
    expect(findLabelAnalogs('Шато 2019 резерв', catalog).analogs).toEqual([])
  })

  it('treats grape names by whole words', () => {
    expect(sameGrape('мускат', 'мускат белый')).toBe(true)
    expect(sameGrape('каберне фран', 'каберне совиньон')).toBe(false)
  })
})
