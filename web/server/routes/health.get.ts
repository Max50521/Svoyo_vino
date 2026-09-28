// Liveness remains HTTP 200; /ready is the deployment/readiness gate.
export default defineEventHandler(async () => {
  const state = await checkReadiness()
  return { ...state, status: state.engine === 'stub' ? 'ok' : state.status }
})
