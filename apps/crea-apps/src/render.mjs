// Piezas de una app publicada de Edusyn Crea: la página (código del equipo + SDK), el manifiesto
// para instalarla, el service worker (instalable y sin conexión) y la política de seguridad.

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

export const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])
const escapeClose = (text, tag) => String(text).replace(new RegExp('</(' + tag + ')', 'gi'), '<\\/$1')

/** Lo que la app publicada puede hacer: ejecutar su código y hablar SOLO con este servicio. Sin
 * recursos externos (igual que en el taller), sin marcos y sin enviar formularios afuera. */
export const APP_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src data:",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

export function filesOf(manifest) {
  const byPath = new Map((manifest?.files || []).map(file => [file.path, String(file.content ?? '')]))
  return { html: byPath.get('index.html') || '', css: byPath.get('styles.css') || '', js: byPath.get('app.js') || '' }
}

/** Nombre corto para debajo del ícono (el sistema lo recorta si es largo). */
export const shortName = title => {
  const text = String(title || 'Mi app').trim()
  return text.length <= 12 ? text : text.split(/\s+/)[0].slice(0, 12)
}

export function appManifest({ token, title, color }) {
  const base = `/a/${token}/`
  return {
    id: base,
    name: String(title),
    short_name: shortName(title),
    description: 'App escolar hecha en Edusyn Crea',
    lang: 'es',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: color,
    icons: [
      { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

/** Service worker de UNA app (su alcance es /a/<token>/): la última versión abierta queda
 * guardada para abrirla sin conexión; con conexión siempre se pide la más nueva. */
export function serviceWorker(token, version) {
  return `// Edusyn Crea · app ${token} · v${version}
const CACHE = 'crea-${token}-v${version}'
const BASE = '/a/${token}/'
const SHELL = [BASE, BASE + 'manifest.webmanifest', BASE + 'icon-192.png', BASE + 'icon-512.png']
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('crea-${token}-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return
  if (request.mode === 'navigate') {
    // Red primero: la app publicada puede haber cambiado de versión.
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(BASE, copy)) }
      return response
    }).catch(() => caches.match(BASE).then(hit => hit || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))))
    return
  }
  event.respondWith(caches.match(request).then(hit => hit || fetch(request)))
})
`
}

/** SDK que Edusyn agrega a cada app publicada, ANTES del código del equipo:
 * - separa el localStorage de cada app (todas comparten el mismo servicio);
 * - mide el uso anónimo (aperturas, tiempo visible, instalación);
 * - ofrece instalar la app (Android) o explica cómo agregarla a inicio (iPhone);
 * - registra el service worker. */
export function sdkScript(token) {
  return `(function () {
  var TOKEN = ${JSON.stringify(token)}
  var BASE = '/a/' + TOKEN + '/'
  var PREFIX = 'app:' + TOKEN + ':'
  var real = null
  try { real = window.localStorage; real.getItem('x') } catch (e) { real = null }
  function own(key) { return key && key.indexOf(PREFIX) === 0 }
  function ownKeys() {
    var keys = []
    for (var i = 0; i < real.length; i++) { var k = real.key(i); if (own(k)) keys.push(k.slice(PREFIX.length)) }
    return keys
  }
  if (real) {
    var api = {
      getItem: function (k) { return real.getItem(PREFIX + k) },
      setItem: function (k, v) { real.setItem(PREFIX + k, String(v)) },
      removeItem: function (k) { real.removeItem(PREFIX + k) },
      clear: function () { ownKeys().forEach(function (k) { real.removeItem(PREFIX + k) }) },
      key: function (n) { var keys = ownKeys(); return n < keys.length ? keys[n] : null },
    }
    // Un Proxy para que localStorage.puntos, Object.keys(localStorage) y delete funcionen
    // igual que con el almacenamiento real del navegador.
    var scoped = typeof Proxy === 'function' ? new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'length') return ownKeys().length
        if (api[prop]) return api[prop]
        if (typeof prop !== 'string') return undefined
        var value = real.getItem(PREFIX + prop)
        return value === null ? undefined : value
      },
      set: function (_, prop, value) { real.setItem(PREFIX + prop, String(value)); return true },
      has: function (_, prop) { return real.getItem(PREFIX + prop) !== null || !!api[prop] },
      deleteProperty: function (_, prop) { real.removeItem(PREFIX + prop); return true },
      ownKeys: function () { return ownKeys() },
      getOwnPropertyDescriptor: function (_, prop) {
        var value = real.getItem(PREFIX + prop)
        return value === null ? undefined : { value: value, enumerable: true, configurable: true, writable: true }
      },
    }) : api
    if (scoped === api) Object.defineProperty(api, 'length', { get: function () { return ownKeys().length } })
    try { Object.defineProperty(window, 'localStorage', { configurable: true, enumerable: true, value: scoped }) } catch (e) {}
  }
  function mem(key, value) {
    var k = 'edusyn:' + TOKEN + ':' + key
    try { if (value === undefined) return real && real.getItem(k); if (real) real.setItem(k, value) } catch (e) {}
    return value
  }
  function randomId() {
    var bytes = new Uint8Array(18); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach(function (_, i) { bytes[i] = Math.random() * 256 })
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2) }).join('')
  }
  var params = new URLSearchParams(location.search)
  var src = params.get('src')
  if (src === 'team') mem('team', '1')
  var source = mem('team') === '1' ? 'team' : (src === 'qr' || src === 'link' ? src : 'direct')
  var device = mem('device') || mem('device', randomId())
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true }
  function send(type, extra) {
    var body = { type: type, deviceId: device, source: source, standalone: standalone() }
    for (var k in extra || {}) body[k] = extra[k]
    try { fetch(BASE + 'e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {}) } catch (e) {}
  }
  var last = Date.now()
  function ping() { var now = Date.now(); var s = Math.round((now - last) / 1000); last = now; if (s > 0) send('ping', { seconds: Math.min(s, 60) }) }
  send('open')
  setInterval(function () { if (document.visibilityState === 'visible') ping() }, 30000)
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') ping(); else last = Date.now() })
  window.addEventListener('appinstalled', function () { send('install') })
  if (params.has('src')) { try { history.replaceState(null, '', BASE) } catch (e) {} }
  if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(function () {}) }) }

  // Ayuda para instalar: botón en Android/Chrome, instrucciones en iPhone. Vive en su propio
  // shadow DOM para que el CSS de la app no lo afecte ni él afecte a la app.
  var deferred = null
  window.addEventListener('beforeinstallprompt', function (event) { event.preventDefault(); deferred = event; showChip() })
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
  function showChip() {
    if (standalone() || mem('chip') === 'no' || document.getElementById('edusyn-instalar')) return
    var host = document.createElement('div'); host.id = 'edusyn-instalar'
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host
    root.innerHTML = '<style>.c{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483647;display:flex;gap:8px;align-items:center;max-width:min(92vw,420px);padding:8px 10px 8px 14px;border-radius:999px;background:#0f172ae6;color:#fff;font:13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.28);backdrop-filter:blur(4px)}.t{flex:1}.b{border:0;border-radius:999px;padding:7px 12px;font:600 13px system-ui,sans-serif;cursor:pointer}.i{background:#fff;color:#0f172a}.x{background:transparent;color:#cbd5e1;padding:7px 8px}</style>' +
      '<div class="c" role="dialog" aria-label="Instalar la app"><span class="t">' + (deferred ? 'Instálala en tu teléfono' : 'Instálala: Compartir → “Agregar a inicio”') + '</span>' +
      (deferred ? '<button class="b i" data-a="i">Instalar</button>' : '') + '<button class="b x" data-a="x" aria-label="Cerrar">✕</button></div>'
    root.addEventListener('click', function (event) {
      var action = event.target && event.target.getAttribute && event.target.getAttribute('data-a')
      if (action === 'i' && deferred) { deferred.prompt(); deferred.userChoice && deferred.userChoice.then(function (choice) { if (choice && choice.outcome === 'accepted') send('install') }); deferred = null; host.remove() }
      if (action === 'x') { mem('chip', 'no'); host.remove() }
    })
    document.documentElement.appendChild(host)
    // Se retira sola: la app es lo importante, no el aviso.
    setTimeout(function () { if (host.isConnected) host.remove() }, 15000)
  }
  if (ios) window.addEventListener('load', function () { setTimeout(showChip, 1500) })

  window.edusyn = Object.freeze({ app: Object.freeze({ standalone: standalone }) })
})()`
}

export function appPage({ token, title, color, manifest, version }) {
  const { html, css, js } = filesOf(manifest)
  const safeTitle = escapeHtml(title || 'Mi app')
  const base = `/a/${token}/`
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${escapeHtml(color)}">
<meta name="application-name" content="${safeTitle}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${escapeHtml(shortName(title))}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="generator" content="Edusyn Crea v${Number(version) || 0}">
<title>${safeTitle}</title>
<link rel="manifest" href="${base}manifest.webmanifest">
<link rel="icon" type="image/png" href="${base}icon-192.png">
<link rel="apple-touch-icon" href="${base}apple-touch-icon.png">
<script>${escapeClose(sdkScript(token), 'script')}</script>
<style>
${escapeClose(css, 'style')}
</style>
</head>
<body>
${html}
<script>
${escapeClose(js, 'script')}
</script>
</body>
</html>
`
}

export function unavailablePage() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>App no disponible</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f8fafc;color:#0f172a}main{max-width:22rem;padding:24px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{color:#475569;margin:0}</style></head>
<body><main><h1>Esta app no está disponible</h1><p>Puede que el enlace esté mal escrito, que la app se haya retirado o que ya haya vencido. Pídele el enlace nuevo a quien te la compartió.</p></main></body></html>`
}
