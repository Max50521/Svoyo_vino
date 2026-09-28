// Coverage report of the taste analyzer over the full organizer CSV (not in git).
// Run: npx vitest run -c vitest.scripts.config.ts   (needs ../data/raw/strapi_output0709.csv)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { buildTastePassport, RULES_VERSION } from '../server/taste'
import type { ScaleId, TastePassport } from '../server/taste'

const CSV = process.env.TASTE_CSV || '../data/raw/strapi_output0709.csv'
const OUT = '../reports/taste-passport'

/** RFC 4180 CSV with quoted fields and embedded newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') q = false
      else field += c
    }
    else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    }
    else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}

// Small deterministic PRNG for the manual-review sample.
function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) }

it.skipIf(!existsSync(CSV))('taste coverage over full catalog', () => {
  const [header, ...body] = parseCsv(readFileSync(CSV, 'utf8').replace(/^﻿/, ''))
  const col = (n: string) => header!.indexOf(n)
  const [iName, iDesc, iSlug, iCat] = [col('Название вина'), col('Описание'), col('Slug'), col('Категория')]
  const wines = new Map<string, { slug: string, name: string, description: string, category: string }>()
  for (const r of body) {
    const slug = r[iSlug]?.trim()
    if (slug && !wines.has(slug)) wines.set(slug, { slug, name: r[iName] ?? '', description: r[iDesc] ?? '', category: r[iCat] ?? '' })
  }
  const list = [...wines.values()]
  const results: Array<{ slug: string, name: string, category: string, description: string, p: TastePassport, ms: number }> = []
  for (const w of list) {
    const t = performance.now()
    const p = buildTastePassport(w)
    results.push({ ...w, p, ms: performance.now() - t })
  }
  // Determinism: a second pass must be identical.
  const mismatches = results.filter(r => JSON.stringify(buildTastePassport(r)) !== JSON.stringify(r.p)).length

  const ids: ScaleId[] = ['sweetness', 'acidity', 'tannin', 'body']
  const scales = Object.fromEntries(ids.map(id => {
    const c = { known: 0, unknown: 0, conflict: 0, with_descriptor: 0, levels: {} as Record<string, number> }
    for (const r of results) {
      const s = r.p.scales[id]
      c[s.state]++
      if (s.descriptor) c.with_descriptor++
      if (s.state === 'known') c.levels[s.label!] = (c.levels[s.label!] ?? 0) + 1
    }
    return [id, c]
  }))
  const noteCount: Record<string, number> = {}, famCount: Record<string, number> = {}
  for (const r of results) {
    for (const n of r.p.notes) noteCount[n.label] = (noteCount[n.label] ?? 0) + 1
    for (const f of r.p.families) famCount[f.label] = (famCount[f.label] ?? 0) + 1
  }
  // Every evidence must quote the cleaned field exactly.
  let badEvidence = 0
  for (const r of results) {
    const ev = [...Object.values(r.p.scales).flatMap(s => s.evidence), ...r.p.notes.flatMap(n => n.evidence)]
    for (const e of ev) {
      const src = e.field === 'name' ? r.name : r.description
      if (!src.replace(/\s+/g, ' ').includes(e.quote.replace(/\s+/g, ' ')) || e.start < 0 || e.end > e.quote.length || e.start >= e.end) badEvidence++
    }
  }
  const ms = results.map(r => r.ms).sort((a, b) => a - b)
  const pct = (q: number) => +ms[Math.min(ms.length - 1, Math.ceil(q * ms.length) - 1)]!.toFixed(3)
  const summary = {
    version: RULES_VERSION,
    source: 'data/raw/strapi_output0709.csv (organizer dataset, unique slugs)',
    wines: results.length,
    scales,
    with_summary: results.filter(r => r.p.summary).length,
    with_any_known_scale: results.filter(r => ids.some(id => r.p.scales[id].state === 'known')).length,
    with_at_least_one_note: results.filter(r => r.p.notes.length).length,
    with_map: results.filter(r => r.p.families.length >= 2 || r.p.notes.length >= 3).length,
    notes_per_wine: { mean: +(results.reduce((s, r) => s + r.p.notes.length, 0) / results.length).toFixed(2), max: Math.max(...results.map(r => r.p.notes.length)) },
    families: Object.fromEntries(Object.entries(famCount).sort((a, b) => b[1] - a[1])),
    top_notes: Object.fromEntries(Object.entries(noteCount).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    evidence_not_exact_substring: badEvidence,
    determinism_mismatches: mismatches,
    analyzer_ms: { p50: pct(0.5), p95: pct(0.95), max: +ms[ms.length - 1]!.toFixed(3), total: +ms.reduce((s, x) => s + x, 0).toFixed(1) },
  }
  mkdirSync(OUT, { recursive: true })
  writeFileSync(`${OUT}/coverage.json`, `${JSON.stringify(summary, null, 2)}\n`)

  // Manual review sample: 50 cards stratified by colour category and description length.
  const rand = rng(20260928)
  const byCat = new Map<string, typeof results>()
  for (const r of results) byCat.set(r.category, [...(byCat.get(r.category) ?? []), r])
  const quota: Record<string, number> = { 'Белое': 17, 'Красное': 17, 'Розовое': 10, 'Оранжевое': 6 }
  const sample: typeof results = []
  for (const [cat, n] of Object.entries(quota)) {
    const pool = [...(byCat.get(cat) ?? [])].sort((a, b) => a.description.length - b.description.length)
    for (let k = 0; k < n && pool.length; k++) {
      // One pick per length stratum keeps short, typical and long texts in the sample.
      const lo = Math.floor((k / n) * pool.length), hi = Math.max(lo + 1, Math.floor(((k + 1) / n) * pool.length))
      sample.push(pool[lo + Math.floor(rand() * (hi - lo))]!)
    }
  }
  const dump = sample.map(r => ({
    slug: r.slug, name: r.name, category: r.category, description: r.description.trim(),
    summary: r.p.summary,
    scales: Object.fromEntries(ids.map(id => { const s = r.p.scales[id]; return [id, { state: s.state, label: s.label, descriptor: s.descriptor, sparkling: s.sparkling, quotes: s.evidence.map(e => e.quote.slice(e.start, e.end)) }] })),
    notes: r.p.notes.map(n => `${n.label}${n.generic ? ' (обобщ.)' : ''} ← ${n.evidence[0]!.quote.slice(n.evidence[0]!.start, n.evidence[0]!.end)}`),
  }))
  writeFileSync(`${OUT}/manual-review-sample.json`, `${JSON.stringify(dump, null, 2)}\n`)
  console.log(JSON.stringify(summary, null, 2))
})
