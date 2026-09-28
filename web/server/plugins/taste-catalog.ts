// Warm the taste-profile cache at startup so the first "not in catalog" answer is not slower.
export default defineNitroPlugin(() => {
  setTimeout(() => getTasteCatalog().catch(() => {}), 1000)
})
