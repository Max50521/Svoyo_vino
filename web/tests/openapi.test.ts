import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { openApiSpec, swaggerHtml } from '../server/openapi'

const ROUTES = fileURLToPath(new URL('../server/routes', import.meta.url))
const SELF = new Set(['/openapi.json', '/docs'])

/** server/routes/v1/wines/[slug]/index.get.ts -> ["get", "/v1/wines/{slug}"] */
function routes(dir = ROUTES): Array<[string, string]> {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return routes(p)
    const m = relative(ROUTES, p).replace(/\\/g, '/').match(/^(.*)\.(get|post)\.ts$/)
    if (!m) return []
    const path = `/${m[1]}`.replace(/\/index$/, '').replace(/\[(\w+)\]/g, '{$1}')
    return [[m[2]!, path] as [string, string]]
  })
}

describe('OpenAPI spec', () => {
  it('documents every API route of the server', () => {
    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>
    const missing = routes().filter(([method, path]) => !SELF.has(path) && !paths[path]?.[method])
    expect(missing).toEqual([])
  })

  it('keeps the organizer contract: predict returns exactly {slug}', () => {
    const schema = openApiSpec.paths['/v1/eval/predict'].post.responses[200].content['application/json'].schema as { properties: Record<string, unknown> }
    expect(schema).toMatchObject({ required: ['slug'], additionalProperties: false })
    expect(Object.keys(schema.properties)).toEqual(['slug'])
  })

  it('Swagger UI page loads this spec', () => {
    expect(swaggerHtml).toContain("url: '/openapi.json'")
    expect(swaggerHtml).toContain('swagger-ui-bundle.js')
  })
})
