import { buildTastePassport, type TastePassport } from '../../../../taste'

// A failure of the optional taste analyzer must not turn a working card into an error.
function tastePassport(row: { slug: string, name: string | null, description: string | null }): TastePassport | null {
  try {
    return buildTastePassport(row)
  }
  catch (e) {
    console.error(`[taste] analyzer failed for "${row.slug}": ${(e as Error)?.message ?? e}`)
    return null
  }
}

// Wine card by slug.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  try {
    let rows
    try {
      ({ rows } = await getPool().query(
        `SELECT slug, name, category, color, region, grapes, description, winery
           FROM wines WHERE slug = $1`,
        [slug],
      ))
    }
    catch (e) {
      throw new ApiError(503, `database error: ${(e as Error).message}`)
    }
    if (!rows.length) throw new ApiError(404, `wine "${slug}" not found`)
    return { ...rows[0], image_url: wineImageUrl(rows[0].slug), taste_passport: tastePassport(rows[0]) }
  }
  catch (e) {
    return sendApiError(event, e)
  }
})
