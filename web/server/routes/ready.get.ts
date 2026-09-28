export default defineEventHandler(async (event) => {
  const state = await checkReadiness()
  if (!state.ready) setResponseStatus(event, 503)
  return state
})
