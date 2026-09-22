import { createServer } from './server.mjs'

const port = Number(process.env.PORT) || 5175
const apiUrl = process.env.EDUSYN_API_URL
if (!apiUrl) {
  console.error('Falta EDUSYN_API_URL (p. ej. https://api.edusyn.co/api)')
  process.exit(1)
}
createServer({ apiUrl }).listen(port, () => console.log(`[crea-apps] escuchando en :${port} → ${apiUrl}`))
