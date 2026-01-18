import { useState, useEffect } from 'react'
import {
  Megaphone,
  Image,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff
} from 'lucide-react'
import { announcementsApi, galleryApi, eventsApi } from '../lib/api'
import { useInstitution } from '../contexts/InstitutionContext'

type TabType = 'announcements' | 'gallery' | 'events'

interface Announcement {
  id: string
  title: string
  content: string
  imageUrl?: string
  priority: number
  isActive: boolean
  publishedAt: string
  expiresAt?: string
}

interface GalleryImage {
  id: string
  title: string
  description?: string
  imageUrl: string
  category?: string
  isActive: boolean
  order: number
}

interface Event {
  id: string
  title: string
  description?: string
  eventDate: string
  endDate?: string
  location?: string
  eventType: string
  isActive: boolean
}

export default function ContentManager() {
  const { institution } = useInstitution()
  const [activeTab, setActiveTab] = useState<TabType>('announcements')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [events, setEvents] = useState<Event[]>([])
  
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    imageUrl: '',
    priority: 0,
    expiresAt: ''
  })
  
  const [galleryForm, setGalleryForm] = useState({
    title: '',
    description: '',
    imageUrl: '',
    category: ''
  })
  
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventDate: '',
    endDate: '',
    location: '',
    eventType: 'GENERAL'
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [annRes, galRes, evtRes] = await Promise.all([
        announcementsApi.getAll(undefined, false),
        galleryApi.getAll(undefined, undefined, false),
        eventsApi.getAll(undefined, false)
      ])
      setAnnouncements(annRes.data || [])
      setGallery(galRes.data || [])
      setEvents(evtRes.data || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingItem(null)
    if (activeTab === 'announcements') {
      setAnnouncementForm({ title: '', content: '', imageUrl: '', priority: 0, expiresAt: '' })
    } else if (activeTab === 'gallery') {
      setGalleryForm({ title: '', description: '', imageUrl: '', category: '' })
    } else {
      setEventForm({ title: '', description: '', eventDate: '', endDate: '', location: '', eventType: 'GENERAL' })
    }
    setShowModal(true)
  }

  const openEditModal = (item: any) => {
    setEditingItem(item)
    if (activeTab === 'announcements') {
      setAnnouncementForm({
        title: item.title,
        content: item.content,
        imageUrl: item.imageUrl || '',
        priority: item.priority,
        expiresAt: item.expiresAt ? item.expiresAt.split('T')[0] : ''
      })
    } else if (activeTab === 'gallery') {
      setGalleryForm({
        title: item.title,
        description: item.description || '',
        imageUrl: item.imageUrl,
        category: item.category || ''
      })
    } else {
      setEventForm({
        title: item.title,
        description: item.description || '',
        eventDate: item.eventDate ? item.eventDate.split('T')[0] : '',
        endDate: item.endDate ? item.endDate.split('T')[0] : '',
        location: item.location || '',
        eventType: item.eventType
      })
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (activeTab === 'announcements') {
        const data = {
          ...announcementForm,
          institutionId: institution.id,
          expiresAt: announcementForm.expiresAt || undefined
        }
        if (editingItem) {
          await announcementsApi.update(editingItem.id, data)
        } else {
          await announcementsApi.create(data as any)
        }
      } else if (activeTab === 'gallery') {
        const data = {
          ...galleryForm,
          institutionId: institution.id
        }
        if (editingItem) {
          await galleryApi.update(editingItem.id, data)
        } else {
          await galleryApi.create(data as any)
        }
      } else {
        const data = {
          ...eventForm,
          institutionId: institution.id,
          endDate: eventForm.endDate || undefined
        }
        if (editingItem) {
          await eventsApi.update(editingItem.id, data)
        } else {
          await eventsApi.create(data as any)
        }
      }
      setShowModal(false)
      fetchData()
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este elemento?')) return
    try {
      if (activeTab === 'announcements') {
        await announcementsApi.delete(id)
      } else if (activeTab === 'gallery') {
        await galleryApi.delete(id)
      } else {
        await eventsApi.delete(id)
      }
      fetchData()
    } catch (err) {
      console.error('Error deleting:', err)
    }
  }

  const toggleActive = async (item: any) => {
    try {
      if (activeTab === 'announcements') {
        await announcementsApi.update(item.id, { isActive: !item.isActive })
      } else if (activeTab === 'gallery') {
        await galleryApi.update(item.id, { isActive: !item.isActive })
      } else {
        await eventsApi.update(item.id, { isActive: !item.isActive })
      }
      fetchData()
    } catch (err) {
      console.error('Error toggling:', err)
    }
  }

  const tabs = [
    { id: 'announcements' as TabType, label: 'Anuncios', icon: Megaphone, count: announcements.length },
    { id: 'gallery' as TabType, label: 'Galería', icon: Image, count: gallery.length },
    { id: 'events' as TabType, label: 'Eventos', icon: Calendar, count: events.length },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Contenidos</h1>
          <p className="text-slate-500 mt-1">Administra los contenidos del dashboard institucional</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar {activeTab === 'announcements' ? 'Anuncio' : activeTab === 'gallery' ? 'Imagen' : 'Evento'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? 'bg-blue-500' : 'bg-slate-200'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {activeTab === 'announcements' && (
          <div className="divide-y divide-slate-100">
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Megaphone className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p>No hay anuncios creados</p>
              </div>
            ) : (
              announcements.map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="w-16 h-16 object-cover rounded-lg" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      {!item.isActive && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">Oculto</span>
                      )}
                      {item.priority > 0 && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">Destacado</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">{item.content}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(item)} className="p-2 hover:bg-slate-100 rounded-lg" title={item.isActive ? 'Ocultar' : 'Mostrar'}>
                      {item.isActive ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button onClick={() => openEditModal(item)} className="p-2 hover:bg-slate-100 rounded-lg">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-slate-100 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="p-4">
            {gallery.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <Image className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p>No hay imágenes en la galería</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {gallery.map((item) => (
                  <div key={item.id} className="relative group">
                    <img src={item.imageUrl} alt={item.title} className={`w-full h-32 object-cover rounded-lg ${!item.isActive ? 'opacity-50' : ''}`} />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                      <p className="text-white text-xs font-medium text-center px-2">{item.title}</p>
                      <div className="flex gap-1">
                        <button onClick={() => toggleActive(item)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded">
                          {item.isActive ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-white" />}
                        </button>
                        <button onClick={() => openEditModal(item)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded">
                          <Edit2 className="w-3 h-3 text-white" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-white/20 hover:bg-white/30 rounded">
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && (
          <div className="divide-y divide-slate-100">
            {events.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p>No hay eventos creados</p>
              </div>
            ) : (
              events.map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-slate-50">
                  <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    <span className="text-xs font-medium">{new Date(item.eventDate).toLocaleDateString('es-CO', { month: 'short' })}</span>
                    <span className="text-lg font-bold">{new Date(item.eventDate).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      {!item.isActive && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">Oculto</span>
                      )}
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">{item.eventType}</span>
                    </div>
                    <p className="text-sm text-slate-500">{item.location || 'Sin ubicación'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleActive(item)} className="p-2 hover:bg-slate-100 rounded-lg">
                      {item.isActive ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    </button>
                    <button onClick={() => openEditModal(item)} className="p-2 hover:bg-slate-100 rounded-lg">
                      <Edit2 className="w-4 h-4 text-blue-600" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-slate-100 rounded-lg">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingItem ? 'Editar' : 'Nuevo'} {activeTab === 'announcements' ? 'Anuncio' : activeTab === 'gallery' ? 'Imagen' : 'Evento'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {activeTab === 'announcements' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Título del anuncio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contenido *</label>
                    <textarea
                      value={announcementForm.content}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Contenido del anuncio"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL de Imagen (opcional)</label>
                    <input
                      type="url"
                      value={announcementForm.imageUrl}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
                      <select
                        value={announcementForm.priority}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, priority: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={0}>Normal</option>
                        <option value={1}>Destacado</option>
                        <option value={2}>Urgente</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Expira (opcional)</label>
                      <input
                        type="date"
                        value={announcementForm.expiresAt}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, expiresAt: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'gallery' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                    <input
                      type="text"
                      value={galleryForm.title}
                      onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Título de la imagen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL de Imagen *</label>
                    <input
                      type="url"
                      value={galleryForm.imageUrl}
                      onChange={(e) => setGalleryForm({ ...galleryForm, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="https://ejemplo.com/imagen.jpg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                    <textarea
                      value={galleryForm.description}
                      onChange={(e) => setGalleryForm({ ...galleryForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Descripción de la imagen"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría (opcional)</label>
                    <input
                      type="text"
                      value={galleryForm.category}
                      onChange={(e) => setGalleryForm({ ...galleryForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ej: Eventos, Deportes, Académico"
                    />
                  </div>
                </>
              )}

              {activeTab === 'events' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Título del evento"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Descripción del evento"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Inicio *</label>
                      <input
                        type="date"
                        value={eventForm.eventDate}
                        onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Fin (opcional)</label>
                      <input
                        type="date"
                        value={eventForm.endDate}
                        onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación</label>
                      <input
                        type="text"
                        value={eventForm.location}
                        onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Ej: Auditorio Principal"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                      <select
                        value={eventForm.eventType}
                        onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="GENERAL">General</option>
                        <option value="ACADEMICO">Académico</option>
                        <option value="CULTURAL">Cultural</option>
                        <option value="DEPORTIVO">Deportivo</option>
                        <option value="REUNION">Reunión</option>
                        <option value="FESTIVO">Festivo</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
