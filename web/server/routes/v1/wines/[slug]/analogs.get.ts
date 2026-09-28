import { findAnalogs } from '../../../../taste/analogs'

// Analogs of a catalog wine from other wineries, by taste passport (grape, style, shared notes).
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const limit = Math.min(12, Math.max(1, Number(getQuery(event).limit) || 6))
  try {
    let catalog
    try {
      catalog = await getTasteCatalog()
    }
    catch (e) {
      throw new ApiError(503, `database error: ${(e as Error).message}`)
    }
    const target = catalog.find(p => p.slug === slug)
    if (!target) throw new ApiError(404, `wine "${slug}" not found`)
    return findAnalogs(target, catalog, limit).map(a => ({ ...a, image_url: wineImageUrl(a.slug) }))
  }
  catch (e) {
    return sendApiError(event, e)
  }
})
