// Dominio de almacenamiento. Lo consume el grafo eager (modal de firma), de
// modo que vive aparte para no traerse los 93 objetos de la fachada.
import api, { API_BASE_URL } from './client'

export const storageApi = {
  resolveUrl: (path: string) => api.get('/storage/resolve-url', { params: { path } }),
  uploadGalleryImage: (file: File, institutionId: string, category?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('institutionId', institutionId);
    if (category) formData.append('category', category);
    return api.post('/storage/upload/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadAnnouncementImage: (file: File, institutionId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('institutionId', institutionId);
    return api.post('/storage/upload/announcement', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadSignature: (file: File, role: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('role', role);
    return api.post('/storage/upload/signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMySignature: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/storage/upload/my-signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
}


export function toPublicFileUrl(storedValue: string | null | undefined): string {
  if (!storedValue) return ''
  // Si ya es una URL proxy, devolverla tal cual
  if (storedValue.includes('/storage/public?path=')) return storedValue
  // Extraer key de una URL firmada de R2
  let key = storedValue
  if (storedValue.startsWith('http')) {
    try {
      const url = new URL(storedValue)
      const parts = url.pathname.split('/').filter(Boolean)
      // Quitar bucket name del path: /edusyn-files/galeria/... → galeria/...
      key = parts.length > 1 ? parts.slice(1).join('/') : parts.join('/')
    } catch { return storedValue }
  }
  // Solo proxiar prefijos permitidos
  if (!key.startsWith('galeria/') && !key.startsWith('firmas/')) return storedValue
  return `${API_BASE_URL}/storage/public?path=${encodeURIComponent(key)}`
}

