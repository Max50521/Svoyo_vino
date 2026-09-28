// Organizer contract: multipart "image" -> {"slug": "..."}
export default defineEventHandler(async (event) => {
  try {
    // analogs are not needed for the flat {slug} answer: keep this path as lean as before
    const result = await runSearch(event, { analogs: false })
    if (!result.top1) throw new ApiError(503, 'index is empty')
    return { slug: result.top1.slug }
  }
  catch (e) {
    return sendApiError(event, e)
  }
})
