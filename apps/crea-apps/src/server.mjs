// Servicio público de las apps de Edusyn Crea: /a/<token>/ sirve la app aprobada por el docente,
// lista para instalar en el celular. No tiene sesión, cookies ni base de datos propia: pide la
// app a la API por su token y le reenvía el uso anónimo.
import http from 'node:http'
import { appManifest, appPage, APP_CSP, serviceWorker, TOKEN_RE, unavailablePage } from './render.mjs'
import { colorFor, iconPng, initialOf } from './icon.mjs'

const MAX_EVENT_BYTES = 2048
// La aprobación se verifica casi en cada visita: retirar una app no debe dejarla disponible
// durante veinte segundos en el servidor público.
const CACHE_MS = 2_000
// Una app que todavía no existe (o acaba de retirarse) se recuerda muy poco: si no, el equipo
// aprueba y el enlace sigue diciendo "no disponible" durante veinte segundos.
const MISSING_CACHE_MS = 3_000

export function createServer({ apiUrl, fetchImpl = fetch, now = () => Date.now() } = {}) {
  const api = String(apiUrl || '').replace(/\/+$/, '')
  const cache = new Map()

  async function loadApp(token) {
    const hit = cache.get(token)
    if (hit && now() - hit.at < (hit.app ? CACHE_MS : MISSING_CACHE_MS)) return hit.app
    let app = null
    try {
      const response = await fetchImpl(`${api}/public/crea-apps/${token}`, { headers: { Accept: 'application/json' } })
      if (response.ok) {
        const data = await response.json()
        app = { ...data, color: colorFor(token), letter: initialOf(data.title) }
      } else if (response.status !== 404) {
        throw new Error(`API ${response.status}`)
      }
    } catch (error) {
      // Una copia anterior podría haber sido retirada mientras la API estaba caída.
      // Nunca se sirve sin poder comprobar su estado vigente.
      cache.delete(token)
      throw error
    }
    cache.set(token, { at: now(), app })
    if (cache.size > 2000) cache.delete(cache.keys().next().value)
    return app
  }

  const baseHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { ...baseHeaders, ...headers })
    res.end(body)
  }
  const unavailable = res => send(res, 404, unavailablePage(), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" })

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0
      const chunks = []
      req.on('data', chunk => {
        size += chunk.length
        if (size > MAX_EVENT_BYTES) { reject(new Error('too large')); req.destroy() } else chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      if (url.pathname === '/health') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' })
      if (url.pathname === '/' || url.pathname === '/robots.txt') {
        return send(res, 200, url.pathname === '/' ? 'Edusyn Crea · apps de estudiantes' : 'User-agent: *\nDisallow: /\n', { 'Content-Type': 'text/plain; charset=utf-8' })
      }
      const match = url.pathname.match(/^\/a\/([^/]+)(\/.*)?$/)
      if (!match || !TOKEN_RE.test(match[1])) return unavailable(res)
      const token = match[1]
      const rest = match[2]
      if (rest === undefined) return send(res, 301, '', { Location: `/a/${token}/${url.search}` })

      if (rest === '/e' && req.method === 'POST') {
        let body = ''
        try { body = await readBody(req) } catch { return send(res, 413, '') }
        try {
          await fetchImpl(`${api}/public/crea-apps/${token}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        } catch { /* el uso es "mejor esfuerzo": nunca rompe la app */ }
        return send(res, 204, '')
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '')

      const app = await loadApp(token)
      if (!app) return unavailable(res)
      const title = app.title || 'Mi app'
      const version = app.versionNumber || 0

      if (rest === '/') {
        return send(res, 200, appPage({ token, title, color: app.color, manifest: app.manifest, version }), {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Content-Security-Policy': APP_CSP,
          'X-Robots-Tag': 'noindex, nofollow',
        })
      }
      if (rest === '/manifest.webmanifest') {
        return send(res, 200, JSON.stringify(appManifest({ token, title, color: app.color })), { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' })
      }
      if (rest === '/sw.js') {
        return send(res, 200, serviceWorker(token, version), { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' })
      }
      const icon = rest.match(/^\/(icon-(192|512)|apple-touch-icon)\.png$/)
      if (icon) {
        const size = icon[2] ? Number(icon[2]) : 180
        return send(res, 200, iconPng(size, app.color, app.letter), { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' })
      }
      return unavailable(res)
    } catch (error) {
      console.error('[crea-apps]', error?.message || error)
      return send(res, 502, 'La app no está disponible en este momento. Intenta de nuevo.', { 'Content-Type': 'text/plain; charset=utf-8' })
    }
  })
}

