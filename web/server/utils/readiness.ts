export async function checkReadiness() {
  let db: Record<string, any> = { ok: false }
  let ml: Record<string, any> = { ok: false }
  try {
    const { rows } = await getPool().query(`
      SELECT (SELECT count(*)::int FROM wines) AS wines,
        count(DISTINCT slug)::int AS indexed,
        count(DISTINCT slug) FILTER (WHERE view='full')::int AS full,
        count(DISTINCT slug) FILTER (WHERE view='label_mid')::int AS label_mid,
        count(DISTINCT slug) FILTER (WHERE view='label_low')::int AS label_low,
        min(vector_dims(embedding))::int AS min_dim,
        max(vector_dims(embedding))::int AS max_dim
      FROM wine_embeddings WHERE model=$1`, [appConfig.modelName])
    db = { ok: true, ...rows[0] }
  } catch (error) { console.error('[readiness db]', error) }
  try {
    const r = await fetch(`${appConfig.mlUrl}/health`, { signal: AbortSignal.timeout(2000) })
    if (r.ok) ml = { ...await r.json(), ok: true }
  } catch { /* dependency unavailable */ }
  const ready = appConfig.engine === 'vector' && db.ok && db.wines > 0
    && db.full === db.wines && db.label_mid === db.wines && db.label_low === db.wines
    && db.min_dim === appConfig.embeddingDim && db.max_dim === appConfig.embeddingDim
    && ml.ok && ml.model === appConfig.modelName && ml.dim === appConfig.embeddingDim
  return { ready: Boolean(ready), status: ready ? 'ok' : 'degraded', engine: appConfig.engine, model: appConfig.modelName, db, ml }
}
