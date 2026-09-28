// Browser check of the taste passport against a running stand, via Chrome DevTools Protocol.
// No extra dependencies: Node 24 (global WebSocket) + an installed Chrome/Edge.
//   node scripts/taste-browser-check.mjs [--base http://127.0.0.1:8080] [--chrome path]
// Writes reports/taste-passport/browser-check.json and screenshots/*.png.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const BASE = arg('--base', 'http://127.0.0.1:8080')
const CHROME = arg('--chrome', [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => existsSync(p)))
const ROOT = resolve(import.meta.dirname, '../..')
const OUT = join(ROOT, 'reports/taste-passport')
const SHOTS = join(OUT, 'screenshots')
mkdirSync(SHOTS, { recursive: true })

const RICH = 'le-k2-kamenolomnya-sira-krasnoe-suhoe-145'
const PARTIAL = 'zolotoe-pole-legend-of-crimea-chardonnay-shardone-beloe-suhoe-13'
const SPARKLING = 'abrau-dyurso-imperatorskoe-bryut-shardone-beloe-12'
const UNCERTAIN_PHOTO = join(ROOT, 'eval/real/photos/48.98_02-09-2026_18-34-15.webp')
const NOT_FOUND_PHOTO = join(ROOT, 'eval/real/photos/1.73_06-09-2026_14-54-06.webp')
const WIDTHS = [360, 390, 768, 1440]

// ---- minimal CDP client ----
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'taste-cdp-'))
const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let wsUrl
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl }
  catch { await sleep(200) }
}
if (!wsUrl) throw new Error('Chrome DevTools endpoint not available')
const ws = new WebSocket(wsUrl)
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail })
let seq = 0
const pending = new Map(), listeners = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { const { ok, fail } = pending.get(msg.id); pending.delete(msg.id); msg.error ? fail(new Error(msg.error.message)) : ok(msg.result) }
  else listeners.forEach(l => l(msg))
}
const send = (method, params = {}) => new Promise((ok, fail) => { const id = ++seq; pending.set(id, { ok, fail }); ws.send(JSON.stringify({ id, method, params })) })
const once = method => new Promise(ok => { const l = (m) => { if (m.method === method) { listeners.splice(listeners.indexOf(l), 1); ok(m.params) } }; listeners.push(l) })

const consoleIssues = []
listeners.push((m) => {
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleIssues.push(m.params.args.map(a => a.value ?? a.description).join(' '))
  if (m.method === 'Runtime.exceptionThrown') consoleIssues.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
})
await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result.value
}
async function waitFor(cond, ms = 15000) {
  const t = Date.now()
  while (Date.now() - t < ms) { if (await js(`return !!(${cond})`).catch(() => false)) return true; await sleep(100) }
  throw new Error(`timeout waiting for ${cond}`)
}
async function viewport(width) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: width < 768 ? 800 : 900, deviceScaleFactor: width < 768 ? 2 : 1, mobile: width < 768 })
}
async function open(path) {
  const loaded = once('Page.loadEventFired')
  await send('Page.navigate', { url: BASE + path })
  await loaded
  await waitFor(`window.useNuxtApp ? true : document.querySelector('#__nuxt')`)
  await sleep(400) // hydration
}
async function key(k) {
  const code = { Escape: 27, Enter: 13, Tab: 9 }[k]
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code })
}
async function shot(name, selectorTop = 'body', selectorBottom = '.tp') {
  const box = await js(`const a=document.querySelector(${JSON.stringify(selectorTop)}).getBoundingClientRect(), b=document.querySelector(${JSON.stringify(selectorBottom)}).getBoundingClientRect();
    return { x: 0, y: a.top + scrollY, width: document.documentElement.clientWidth, height: b.bottom - a.top + 16 }`)
  await js(`document.querySelector('header').style.position='static'`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 1 } })
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'))
  await js(`document.querySelector('header').style.position=''`)
  return `screenshots/${name}.png`
}
async function uploadPhoto(file) {
  const { result } = await send('Runtime.evaluate', { expression: `document.querySelectorAll('input[type=file]')[1]` })
  await send('DOM.setFileInputFiles', { files: [file], objectId: result.objectId })
}

// ---- checks ----
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`) }

const LAYOUT = `
  const W = document.documentElement.clientWidth
  const overflow = document.documentElement.scrollWidth > W
  const outside = [...document.querySelectorAll('.tp *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 0.5 || r.left < -0.5) }).length
  const small = [...document.querySelectorAll('.tp button, .tp [role=button], .portal-link')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 44 && r.width < 44 || r.height < 43.5) }).map(e => e.textContent.trim().slice(0, 30))
  const clipped = [...document.querySelectorAll('.tp .note__label, .tp .scale__value, .tp .fam__label, .tp .tp__summary')].filter(e => e.scrollWidth > e.clientWidth + 1).length
  return { W, overflow, outside, small, clipped }`

const shots = {}
for (const w of WIDTHS) {
  await viewport(w)
  await open(`/wine/${RICH}`)
  const l = await js(LAYOUT)
  check(`layout ${w}px: no horizontal scroll, nothing outside, no clipped labels`, !l.overflow && !l.outside && !l.clipped, JSON.stringify(l))
  check(`tap targets ${w}px ≥ 44px`, !l.small.length, l.small.join(', '))
  // open the map and a family: mobile list or desktop sector
  await js(`document.querySelector('.map__toggle').click()`)
  await waitFor(`document.querySelector('.map__body')`)
  const wide = w >= 720
  check(`map ${w}px shows ${wide ? 'wheel' : 'list'}`, await js(`const wh=getComputedStyle(document.querySelector('.map__wheel')).display, li=getComputedStyle(document.querySelector('.map__list')).display; return ${wide} ? wh==='block'&&li==='none' : wh==='none'&&li!=='none'`))
  const l2 = await js(LAYOUT)
  check(`layout ${w}px with open map`, !l2.overflow && !l2.outside, JSON.stringify(l2))
  if (wide) {
    const out = await js(`const card = document.querySelector('.map').closest('.tp__block').getBoundingClientRect();
      return [...document.querySelectorAll('.map__wheel text')].filter(t => { const r = t.getBoundingClientRect(); return r.left < card.left || r.right > card.right }).map(t => t.textContent)`)
    check(`wheel labels ${w}px stay inside the card`, !out.length, out.join(', '))
  }
  if (w === 390 || w === 1440) {
    const target = wide ? '.sector' : '.fam'
    await js(`const t=document.querySelector('${target}'); t.focus(); t.dispatchEvent(new MouseEvent('click', { bubbles: true }))`)
    await waitFor(`document.querySelector('.panel')`)
    shots[w] = await shot(`rich-${w}-map-open`, w === 390 ? '.tp' : '.card', '.tp')
  }
}

// Interactions on a phone.
await viewport(390)
await open(`/wine/${RICH}`)
await js(`document.querySelector('.scale__name').click()`)
check('help opens on tap', await js(`return !!document.querySelector('.scale__help') && document.querySelector('.scale__name').getAttribute('aria-expanded')==='true'`))
await js(`document.querySelectorAll('.scale__name')[1].click()`)
check('only one help open at a time', await js(`return document.querySelectorAll('.scale__help').length===1 && document.querySelectorAll('.scale__name')[1].getAttribute('aria-expanded')==='true'`))
await js(`document.querySelector('.note').click()`)
check('note tap shows the source phrase with highlight', await js(`return !!document.querySelector('.notes__src mark')`))
await js(`document.querySelector('.map__toggle').click()`)
await waitFor(`document.querySelector('.fam')`)
await js(`const f=document.querySelector('.fam'); f.focus(); f.click()`)
await waitFor(`document.querySelector('.panel')`)
check('family opens panel with notes and quotes', await js(`return document.querySelectorAll('.panel__notes li').length>0 && !!document.querySelector('.panel mark')`))
await js(`document.querySelectorAll('.fam')[1].click()`)
check('one family panel at a time', await js(`return document.querySelectorAll('.panel').length===1 && document.querySelectorAll('.fam[aria-expanded=true]').length===1`))
await js(`document.querySelectorAll('.fam')[1].focus()`)
await key('Escape')
await sleep(150)
check('Escape closes the panel and returns focus', await js(`return !document.querySelector('.panel') && document.activeElement===document.querySelectorAll('.fam')[1]`))
await js(`document.querySelector('.ev__toggle').click()`)
check('«На чём основано» lists quotes', await js(`return document.querySelectorAll('.ev__body dd mark').length>0`))
check('caption about associations is visible', await js(`return document.body.innerText.includes('Ассоциации из описания вина, а не добавленные ингредиенты')`))
const contrast = await js(`
  const lum = c => { const [r, g, b] = c.match(/\\d+/g).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * g + .0722 * b }
  const bgOf = e => { for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\\(.*, 0\\)|transparent/.test(c)) return c } return 'rgb(255,255,255)' }
  return [...document.querySelectorAll('.tp p, .tp span, .tp dt, .tp dd, .tp b, .tp .note__label')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(e => { const a = lum(getComputedStyle(e).color), b = lum(bgOf(e)); return { t: e.textContent.trim().slice(0, 24), r: +((Math.max(a, b) + .05) / (Math.min(a, b) + .05)).toFixed(2) } })
    .filter(x => x.r < 4.5)`)
check('text contrast in the passport ≥ 4.5:1', !contrast.length, JSON.stringify(contrast.slice(0, 5)))
check('portal link is built from the slug', await js(`return document.querySelector('.portal-link').href==='https://vino-svoe.ru/wines/${RICH}'`))
shots.evidence = await shot('rich-390-evidence', '.tp', '.tp')

// Keyboard on desktop wheel.
await viewport(1440)
await open(`/wine/${RICH}`)
await js(`document.querySelector('.map__toggle').click()`)
await waitFor(`document.querySelector('.sector')`)
await js(`document.querySelector('.sector').focus()`)
await key('Enter')
await waitFor(`document.querySelector('.panel')`)
check('wheel sector opens with Enter', await js(`return document.querySelector('.sector').getAttribute('aria-pressed')==='true'`))
await key('Escape')
await sleep(150)
check('Escape on wheel returns focus to the sector', await js(`return !document.querySelector('.panel') && document.activeElement===document.querySelector('.sector')`))

// Partial data, sparkling, direct link + reload.
await viewport(390)
await open(`/wine/${PARTIAL}`)
check('partial card: unknown scales show a neutral label', await js(`return document.body.innerText.includes('В описании не уточнено')`))

shots.partial = await shot('partial-390', '.tp', '.tp')
await open(`/wine/${SPARKLING}`)
check('sparkling card marks the sparkling scale', await js(`return document.body.innerText.includes('шкала для игристых')`))
shots.sparkling = await shot('sparkling-390', '.tp', '.tp')
const before = await js(`return document.querySelector('.tp').innerText`)
await send('Page.reload'); await once('Page.loadEventFired'); await sleep(500)
check('reload renders the same passport (SSR + hydration)', (await js(`return document.querySelector('.tp').innerText`)) === before)

// 404 card keeps its old behaviour.
await open('/wine/no-such-wine-xyz')
check('404 card: «Вино не найдено», no passport', await js(`return document.body.innerText.includes('Вино не найдено') && !document.querySelector('.tp')`))

// Recognition flow: uncertain photo → card → switch candidate → passport updates.
await open('/')
await uploadPhoto(UNCERTAIN_PHOTO)
await waitFor(`location.pathname.startsWith('/wine/') && document.querySelector('.tp, .card')`, 30000)
await sleep(600)
const first = await js(`return { slug: location.pathname, notice: !!document.querySelector('.top-notice'), alts: !!document.querySelector('.alts__body'), order: (() => { const a=document.querySelector('.alts'), t=document.querySelector('.tp'); return a && t ? !!(a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) : null })(), tp: document.querySelector('.tp')?.innerText ?? '' }`)
check('uncertain scan: warning and candidates shown before the passport', first.notice && first.alts && first.order !== false, JSON.stringify({ ...first, tp: undefined }))
check('no scale facts → one compact line, no empty markers', first.tp.includes('в описании не уточнены') && !first.tp.includes('Кислотность'))
shots.uncertain = await shot('uncertain-390', 'main', '.tp')
await js(`document.querySelector('.alts__body a').click()`)
await waitFor(`location.pathname !== ${JSON.stringify(first.slug)}`)
await sleep(800)
const second = await js(`return { slug: location.pathname, tp: document.querySelector('.tp')?.innerText ?? '', api: await (await fetch('/v1/wines/' + location.pathname.split('/').pop())).json() }`)
const expectedNotes = (second.api.taste_passport?.notes ?? []).slice(0, 6).map(n => n.label)
check('candidate switch updates the whole passport', second.tp !== first.tp && expectedNotes.every(l => second.tp.includes(l)), `${first.slug} → ${second.slug}`)

await open('/')
await uploadPhoto(NOT_FOUND_PHOTO)
await waitFor(`document.querySelector('.not-found')`, 30000)
check('not_found scan: no card and no passport', await js(`return location.pathname==='/' && !document.querySelector('.tp')`))

const hydration = consoleIssues.filter(x => /hydrat/i.test(x))
check('no hydration warnings', !hydration.length, hydration.slice(0, 3).join(' | '))
check('no uncaught exceptions', !consoleIssues.some(x => /Error|Uncaught/.test(x) && !/Failed to load resource/.test(x)), consoleIssues.slice(0, 5).join(' | '))

writeFileSync(join(OUT, 'browser-check.json'), `${JSON.stringify({ base: BASE, browser: CHROME, date: new Date().toISOString(), passed: results.filter(r => r.ok).length, total: results.length, results, screenshots: shots, console: consoleIssues }, null, 2)}\n`)
console.log(`\n${results.filter(r => r.ok).length}/${results.length} checks passed`)
ws.close(); chrome.kill()
process.exit(results.every(r => r.ok) ? 0 : 1)
