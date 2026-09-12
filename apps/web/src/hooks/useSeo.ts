import { useEffect } from 'react'

/**
 * Actualiza <title> y <meta name="description"> por ruta.
 * La app es un SPA client-rendered: Google ejecuta el JS y sí indexa esto,
 * pero las vistas previas de enlaces (WhatsApp, redes) no leen JS — para
 * eso hace falta SSR o meta tags estáticas por ruta, fuera de alcance aquí.
 */
export function useSeo(title: string, description: string) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title

    let meta = document.querySelector('meta[name="description"]')
    const prevDescription = meta?.getAttribute('content') ?? null
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)

    return () => {
      document.title = prevTitle
      if (meta && prevDescription !== null) meta.setAttribute('content', prevDescription)
    }
  }, [title, description])
}
