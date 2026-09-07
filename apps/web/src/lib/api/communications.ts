// Dominio de API extraido de la fachada para que el grafo eager no la arrastre entera.
// Ver docs/CONVENCION_DOCUMENTACION.md y el bloque R1 de code splitting.
import api from './client'

export const communicationsApi = {
  getAll: (params?: { institutionId?: string; type?: string; status?: string }) => api.get('/communications', { params }),
  create: (data: { institutionId: string; type: string; subject: string; content: string; recipients?: Array<{ type: string; recipientId?: string }> }) => api.post('/communications', data),
  getById: (id: string) => api.get(`/communications/${id}`),
  update: (id: string, data: { type?: string; subject?: string; content?: string; scheduledAt?: string }) => api.put(`/communications/${id}`, data),
  send: (id: string) => api.post(`/communications/${id}/send`),
  delete: (id: string) => api.delete(`/communications/${id}`),
  getInbox: () => api.get('/communications/inbox'),
  markAsRead: (id: string) => api.post(`/communications/${id}/read`),
  reply: (id: string, content: string) => api.post(`/communications/${id}/reply`, { content }),
  getReplies: (id: string) => api.get(`/communications/${id}/replies`),
  getAvailableRecipients: (search?: string) => api.get('/communications/available-recipients', { params: { search } }),
  getAllowedCategories: () => api.get('/communications/allowed-categories'),
  uploadAttachment: (messageId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/communications/${messageId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  removeAttachment: (attachmentId: string) => api.delete(`/communications/attachments/${attachmentId}`),
  getAttachmentDownloadUrl: (attachmentId: string) => api.get(`/communications/attachments/${attachmentId}/download`),
  getStorageUsage: () => api.get('/communications/storage-usage'),
}

// ═══════════════════════════════════════════════════════════════════════════
// ACADEMIC STUDENTS API - Para uso exclusivo de páginas académicas
// ═══════════════════════════════════════════════════════════════════════════
// Las páginas académicas (Grades, Attendance, Observer, Achievements, etc.)
// deben usar esta API en lugar de studentsApi para mantener la separación de dominios.

