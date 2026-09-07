// Dominio institucional. Lo consume InstitutionContext, que carga al arranque.
import api from './client'

export const institutionProfileApi = {
  get: () => api.get('/institution-config/profile'),
  update: (data: { name?: string; nit?: string; daneCode?: string; city?: string; address?: string; phone?: string; email?: string; website?: string; logo?: string; primaryColor?: string }) =>
    api.put('/institution-config/profile', data),
}

// Campuses (Sedes)
