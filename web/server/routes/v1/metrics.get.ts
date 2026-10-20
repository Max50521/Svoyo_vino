// Measured recognition quality (offline acceptance runs), so the API shows Top-1/Top-5 quality
// next to the per-request confidence of /v1/search. Numbers come from docs/TOP1_ACCEPTANCE.md.
export default defineEventHandler(() => ({
  dataset: {
    name: 'public field photos (organizer), team labels',
    photos: 100,
    known_in_catalog: 64,
    single_slug: 55,
    not_in_catalog: 33,
    disputed: 3,
    note: 'used during development; not the organizer private set',
  },
  top1: { correct: 62, of: 64, accuracy: 0.9688 },
  top5: { hit: 64, of: 64, hit_rate: 1 },
  f1_top1: { micro: 0.9636, macro: 0.9048, on: 'single-slug subset, 55 photos' },
  not_found: { correct: 19, of: 33 },
  confident_answers: { correct: 35, of: 36, note: 'status=confident among unambiguously labeled known and unknown photos' },
  latency_ms: { p50: 688, p95: 963, source: 'organizer participant_test.sh, 100 photos, RTX 4060' },
  catalog: { wines: 2103, vectors: 6309 },
  notes: [
    'Top-5 hit rate is not called F1.',
    'score and gaps in /v1/search are ranking values, not probabilities.',
  ],
}))
