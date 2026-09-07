// Dominio de API extraido de la fachada para que el grafo eager no la arrastre entera.
// Ver docs/CONVENCION_DOCUMENTACION.md y el bloque R1 de code splitting.
import api from './client'

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
}

// Institutions
