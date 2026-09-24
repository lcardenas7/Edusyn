import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { createServer } from '../src/server.mjs'
import { appManifest, appPage, APP_CSP, shortName } from '../src/render.mjs'
import { colorFor, iconPng, initialOf, PALETTE } from '../src/icon.mjs'

const TOKEN = 'tokenSecretoDeVeinticuatro'
const APP = {
  title: 'Estudia Fácil',
  kind: 'APP',
  versionNumber: 3,
  manifest: { files: [
    { path: 'index.html', content: '<h1>Hola</h1>' },
    { path: 'styles.css', content: 'h1 { color: red } </style><b>' },
    { path: 'app.js', content: 'const s = "</script><script>alert(1)"' },
  ] },
}

function fakeApi({ app = APP, fail = false } = {}) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init })
    if (fail) throw new Error('caída')
    if (url.endsWith('/events')) return new Response('{"ok":true}', { status: 200 })
    if (url.endsWith(`/public/crea-apps/${TOKEN}`) && app) return new Response(JSON.stringify(app), { status: 200 })
    return new Response('{}', { status: 404 })
  }
  return { calls, fetchImpl }
}

async function withServer(options, run) {
  const server = createServer({ apiUrl: 'http://api.test/api/', ...options })
  await new Promise(resolve => server.listen(0, resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try { await run(base) } finally { server.close() }
}

test('sirve la app aprobada con su CSP, manifiesto, ícono y SDK antes del código del equipo', async () => {
  const api = fakeApi()
  await withServer({ fetchImpl: api.fetchImpl }, async base => {
    const page = await fetch(`${base}/a/${TOKEN}/`)
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('content-security-policy'), APP_CSP)
    const html = await page.text()
    assert.match(html, /<title>Estudia Fácil<\/title>/)
    assert.match(html, new RegExp(`<link rel="manifest" href="/a/${TOKEN}/manifest.webmanifest">`))
    assert.match(html, /apple-touch-icon/)
    assert.ok(html.indexOf('window.edusyn') < html.indexOf('<h1>Hola</h1>'), 'el SDK va antes del código del equipo')
    assert.ok(!html.includes('</style><b>') && !html.includes('"</script><script>'), 'el código no cierra antes de tiempo su etiqueta')

    const manifest = await (await fetch(`${base}/a/${TOKEN}/manifest.webmanifest`)).json()
    assert.equal(manifest.display, 'standalone')
    assert.equal(manifest.start_url, `/a/${TOKEN}/`)
    assert.equal(manifest.scope, `/a/${TOKEN}/`)
    assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512', '512x512'])

    const icon = await fetch(`${base}/a/${TOKEN}/icon-192.png`)
    assert.equal(icon.headers.get('content-type'), 'image/png')
    const bytes = Buffer.from(await icon.arrayBuffer())
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG')

    const sw = await (await fetch(`${base}/a/${TOKEN}/sw.js`)).text()
    assert.match(sw, new RegExp(`const BASE = '/a/${TOKEN}/'`))
  })
})

test('la caché es breve; si la API cae no se sirve una copia posiblemente retirada', async () => {
  let clock = 0
  const api = fakeApi()
  await withServer({ fetchImpl: api.fetchImpl, now: () => clock }, async base => {
    await fetch(`${base}/a/${TOKEN}/`)
    await fetch(`${base}/a/${TOKEN}/manifest.webmanifest`)
    assert.equal(api.calls.length, 1)
  })
  const flaky = fakeApi()
  let down = false
  const fetchImpl = (url, init) => (down ? Promise.reject(new Error('caída')) : flaky.fetchImpl(url, init))
  await withServer({ fetchImpl, now: () => clock }, async base => {
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 200)
    down = true
    clock += 2_001
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 502)
    down = false
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 200)
  })
})

test('retirar una app se refleja tras dos segundos como máximo en el servicio público', async () => {
  let clock = 0
  let published = true
  const fetchImpl = async () => published
    ? new Response(JSON.stringify(APP), { status: 200 })
    : new Response('{}', { status: 404 })
  await withServer({ fetchImpl, now: () => clock }, async base => {
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 200)
    published = false
    clock += 2_001
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 404)
  })
})

test('apps inexistentes, retiradas o tokens raros muestran "no disponible" sin llamar a la API de más', async () => {
  const api = fakeApi({ app: null })
  await withServer({ fetchImpl: api.fetchImpl }, async base => {
    const gone = await fetch(`${base}/a/${TOKEN}/`)
    assert.equal(gone.status, 404)
    assert.match(await gone.text(), /no está disponible/)
    const weird = await fetch(`${base}/a/..%2F..%2Fetc/`)
    assert.equal(weird.status, 404)
    assert.equal(api.calls.length, 1)
    const redirect = await fetch(`${base}/a/${TOKEN}?src=qr`, { redirect: 'manual' })
    assert.equal(redirect.status, 301)
    assert.equal(redirect.headers.get('location'), `/a/${TOKEN}/?src=qr`)
  })
})

test('reenvía el uso anónimo a la API y limita el tamaño', async () => {
  const api = fakeApi()
  await withServer({ fetchImpl: api.fetchImpl }, async base => {
    const ok = await fetch(`${base}/a/${TOKEN}/e`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"type":"open","deviceId":"abcdefghijklmnop"}' })
    assert.equal(ok.status, 204)
    assert.equal(api.calls[0].url, `http://api.test/api/public/crea-apps/${TOKEN}/events`)
    const big = await fetch(`${base}/a/${TOKEN}/e`, { method: 'POST', body: 'x'.repeat(5000) }).catch(() => ({ status: 413 }))
    assert.equal(big.status, 413)
  })
})

test('el uso nunca rompe la app aunque la API no responda', async () => {
  await withServer({ fetchImpl: fakeApi({ fail: true }).fetchImpl }, async base => {
    const res = await fetch(`${base}/a/${TOKEN}/e`, { method: 'POST', body: '{}' })
    assert.equal(res.status, 204)
  })
})

test('íconos: color estable por app, inicial sin tildes y PNG válido del tamaño pedido', () => {
  assert.equal(colorFor(TOKEN), colorFor(TOKEN))
  assert.ok(PALETTE.includes(colorFor('otro-token-cualquiera')))
  assert.equal(initialOf('Ñandú veloz'), 'N')
  assert.equal(initialOf('¿Estudia?'), 'E')
  assert.equal(initialOf('***'), 'E')
  const png = iconPng(64, '#4f46e5', 'A')
  assert.equal(png.readUInt32BE(16), 64)
  const idat = png.indexOf('IDAT')
  const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)))
  assert.equal(raw.length, (64 * 3 + 1) * 64)
  assert.ok(raw.includes(255), 'la letra blanca está dibujada')
})

test('nombre corto y manifiesto', () => {
  assert.equal(shortName('Estudia Fácil'), 'Estudia')
  assert.equal(shortName('Quiz'), 'Quiz')
  const manifest = appManifest({ token: TOKEN, title: 'Quiz', color: '#000000' })
  assert.equal(manifest.theme_color, '#000000')
  assert.equal(manifest.lang, 'es')
})

test('el título se escapa en la página', () => {
  const html = appPage({ token: TOKEN, title: '<img src=x onerror=alert(1)>', color: '#4f46e5', manifest: APP.manifest, version: 1 })
  assert.ok(!html.includes('<img src=x'))
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

test('una app recién aprobada aparece enseguida: el "no existe" casi no se recuerda', async () => {
  let clock = 0
  let publicada = false
  const fetchImpl = async url => (publicada && url.endsWith(TOKEN) ? new Response(JSON.stringify(APP), { status: 200 }) : new Response('{}', { status: 404 }))
  await withServer({ fetchImpl, now: () => clock }, async base => {
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 404)
    publicada = true
    clock += 3100
    assert.equal((await fetch(`${base}/a/${TOKEN}/`)).status, 200)
  })
})

test('el SDK separa el almacenamiento por app y no tapa el contenido', async () => {
  const { sdkScript } = await import('../src/render.mjs')
  const sdk = sdkScript(TOKEN)
  assert.ok(sdk.includes("var PREFIX = 'app:' + TOKEN + ':'"), 'cada app guarda con su propio prefijo')
  assert.match(sdk, /ownKeys/, 'Object.keys(localStorage) devuelve las claves de la app')
  assert.match(sdk, /bottom:calc\(16px \+ env\(safe-area-inset-bottom\)\)/, 'el aviso de instalar va abajo, no sobre el encabezado')
  assert.ok(!/top:12px/.test(sdk))
  assert.match(sdk, /setTimeout\(function \(\) \{ if \(host\.isConnected\) host\.remove\(\) \}, 15000\)/, 'el aviso se retira solo')
})
