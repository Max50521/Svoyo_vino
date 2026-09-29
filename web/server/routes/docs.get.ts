import { swaggerHtml } from '../openapi'

// Swagger UI for the public API (try requests right from the page).
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  return swaggerHtml
})
