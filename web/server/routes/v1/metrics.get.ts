// Measured recognition quality (offline acceptance runs), so the API shows Top-1/Top-5 quality
// next to the per-request confidence of /v1/search. Numbers come from docs/TOP1_ACCEPTANCE.md.
export default defineEventHandler(() => ({
  dataset: {
    name: 'public field photos (organizer), team labels',
    photos: 100,
    known_in_catalog: 64,
    single_slug: 56,
    not_in_catalog: 33,
    disputed: 3,
    note: 'used during development; not the organizer private set',
  },
  top1: { correct: 59, of: 64, accuracy: 0.9219 },
  top5: { hit: 64, of: 64, hit_rate: 1 },
  f1_top1: { micro: 0.9107, macro: 0.7826, on: 'single-slug subset, 56 photos' },
  not_found: { correct: 19, of: 33 },
  confident_answers: { correct: 32, of: 33, note: 'status=confident among unambiguously labeled known and unknown photos' },
  latency_ms: { p50: 684, p95: 970, source: 'organizer participant_test.sh, 100 photos, RTX 4060' },
  catalog: { wines: 2080, vectors: 6240 },
  notes: [
    'Top-5 hit rate is not called F1.',
    'score and gaps in /v1/search are ranking values, not probabilities.',
  ],
}))
