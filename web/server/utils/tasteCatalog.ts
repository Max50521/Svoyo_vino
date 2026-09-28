import { profileOf, type TasteProfile } from '../taste/analogs'

// Taste profiles of the whole catalog, built once from the wines table (~2k rows, well under a second)
// and kept in memory; rebuilt after TASTE_CATALOG_TTL_MS so catalog updates are picked up.
const TTL_MS = Number(process.env.TASTE_CATALOG_TTL_MS || 10 * 60_000)
let cache: { at: number, profiles: Promise<TasteProfile[]> } | null = null

export function getTasteCatalog(): Promise<TasteProfile[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.profiles
  const profiles = (async () => {
    const { rows } = await getPool().query(
      'SELECT slug, name, winery, category, grapes, description FROM wines ORDER BY slug',
    )
    return rows.map(r => profileOf(r))
  })()
  cache = { at: Date.now(), profiles }
  // a failed load must not be cached
  profiles.catch(() => { if (cache?.profiles === profiles) cache = null })
  return profiles
}
