import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  Megaphone,
  Calendar,
  Image,
  Cake,
  ChevronRight,
  ChevronLeft,
  Clock,
  MapPin,
  X,
  ZoomIn
} from 'lucide-react'
import { dashboardApi } from '../lib/api'

interface Announcement {
  id: string
  title: string
  content: string
  imageUrl?: string
  publishedAt: string
  author: { firstName: string; lastName: string }
}

interface Event {
  id: string
  title: string
  description?: string
  eventDate: string
  location?: string
  eventType: string
}

interface GalleryImage {
  id: string
  title: string
  imageUrl: string
  category?: string
}

interface Birthday {
  id: string
  name: string
  birthDate: string
  type: 'ESTUDIANTE' | 'DOCENTE'
  detail: string
  isToday: boolean
  daysFromToday: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const sliderRef = useRef<NodeJS.Timeout | null>(null)
  const [imageModal, setImageModal] = useState<{ url: string; title: string } | null>(null)
  const [eventModal, setEventModal] = useState<Event | null>(null)

  // Auto-slide para galería
  useEffect(() => {
    if (gallery.length > 1) {
      sliderRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % gallery.length)
      }, 4000)
    }
    return () => {
      if (sliderRef.current) clearInterval(sliderRef.current)
    }
  }, [gallery.length])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await dashboardApi.getData()
        const data = response.data
        setAnnouncements(data.announcements || [])
        setEvents(data.upcomingEvents || [])
        setGallery(data.gallery || [])
        setBirthdays(data.birthdays || [])
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          ¡Bienvenido, {user?.firstName}!
        </h1>
        <p className="text-slate-500 mt-1">
          Aquí tienes las novedades de la institución
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Anuncios - Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Anuncios */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-blue-600" />
                Anuncios
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {announcements.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  <Megaphone className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No hay anuncios publicados</p>
                </div>
              ) : (
                announcements.map((announcement) => (
                  <div key={announcement.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex gap-4">
                      {announcement.imageUrl && (
                        <div 
                          className="relative group cursor-pointer flex-shrink-0"
                          onClick={() => setImageModal({ url: announcement.imageUrl!, title: announcement.title })}
                        >
                          <img 
                            src={announcement.imageUrl} 
                            alt={announcement.title}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-900">{announcement.title}</h3>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{announcement.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(announcement.publishedAt)}</span>
                          <span>•</span>
                          <span>{announcement.author.firstName} {announcement.author.lastName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Galería - Slider Automático */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Image className="w-5 h-5 text-purple-600" />
                Galería
              </h2>
              {gallery.length > 1 && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentSlide((prev) => (prev - 1 + gallery.length) % gallery.length)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                  </button>
                  <span className="text-sm text-slate-500">{currentSlide + 1} / {gallery.length}</span>
                  <button 
                    onClick={() => setCurrentSlide((prev) => (prev + 1) % gallery.length)}
                    className="p-1 hover:bg-slate-100 rounded"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              )}
            </div>
            <div className="relative">
              {gallery.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Image className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  <p>No hay imágenes en la galería</p>
                </div>
              ) : (
                <>
                  <div className="relative h-72 overflow-hidden bg-slate-100">
                    {gallery.map((img, index) => (
                      <div 
                        key={img.id} 
                        className={`absolute inset-0 transition-opacity duration-500 cursor-pointer ${index === currentSlide ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onClick={() => setImageModal({ url: img.imageUrl, title: img.title })}
                      >
                        <img 
                          src={img.imageUrl} 
                          alt={img.title}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                          <p className="text-white font-medium">{img.title}</p>
                          {img.category && (
                            <span className="text-white/70 text-sm">{img.category}</span>
                          )}
                        </div>
                        <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 opacity-0 hover:opacity-100 transition-opacity">
                          <ZoomIn className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Indicadores */}
                  <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2">
                    {gallery.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSlide(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${index === currentSlide ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Columna lateral */}
        <div className="space-y-6">
          {/* Próximos Eventos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-600" />
                Próximos Eventos
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No hay eventos próximos</p>
                </div>
              ) : (
                events.map((event) => (
                  <div 
                    key={event.id} 
                    className="px-6 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setEventModal(event)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 text-green-700 rounded-lg px-2 py-1 text-center min-w-[50px]">
                        <p className="text-xs font-medium">{formatDate(event.eventDate)}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm">{event.title}</p>
                        {event.location && (
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cumpleaños Próximos */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-600" />
                Cumpleaños Próximos
              </h2>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {birthdays.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  <Cake className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No hay cumpleaños próximos</p>
                </div>
              ) : (
                <>
                  {/* Cumpleaños de hoy */}
                  {birthdays.filter(b => b.isToday).length > 0 && (
                    <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
                      <p className="text-xs font-semibold text-pink-600 uppercase mb-2">🎂 ¡Hoy cumplen años!</p>
                      {/* Docentes de hoy */}
                      {birthdays.filter(b => b.isToday && b.type === 'DOCENTE').length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-blue-600 font-medium mb-1">Docentes</p>
                          <div className="space-y-1">
                            {birthdays.filter(b => b.isToday && b.type === 'DOCENTE').map((birthday) => (
                              <div key={birthday.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold">{new Date(birthday.birthDate).getDate()}</span>
                                </div>
                                <p className="font-medium text-slate-900 text-sm truncate">{birthday.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Estudiantes de hoy */}
                      {birthdays.filter(b => b.isToday && b.type === 'ESTUDIANTE').length > 0 && (
                        <div>
                          <p className="text-xs text-green-600 font-medium mb-1">Estudiantes</p>
                          <div className="space-y-1">
                            {birthdays.filter(b => b.isToday && b.type === 'ESTUDIANTE').map((birthday) => (
                              <div key={birthday.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold">{new Date(birthday.birthDate).getDate()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-slate-900 text-sm truncate">{birthday.name}</p>
                                  <p className="text-xs text-slate-500">{birthday.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Próximos días (agrupados por día) */}
                  {[1, 2, 3].map(daysAhead => {
                    const dayBirthdays = birthdays.filter(b => b.daysFromToday === daysAhead);
                    if (dayBirthdays.length === 0) return null;
                    const futureDate = new Date();
                    futureDate.setDate(futureDate.getDate() + daysAhead);
                    const dayLabel = daysAhead === 1 ? 'Mañana' : futureDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
                    
                    return (
                      <div key={daysAhead} className="px-4 py-3 border-b border-slate-100 last:border-b-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">{dayLabel}</p>
                        {/* Docentes del día */}
                        {dayBirthdays.filter(b => b.type === 'DOCENTE').length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-blue-600 font-medium mb-1">Docentes</p>
                            <div className="space-y-1">
                              {dayBirthdays.filter(b => b.type === 'DOCENTE').map((birthday) => (
                                <div key={birthday.id} className="flex items-center gap-2 py-1">
                                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold">{new Date(birthday.birthDate).getDate()}</span>
                                  </div>
                                  <p className="text-sm text-slate-700 truncate">{birthday.name}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Estudiantes del día */}
                        {dayBirthdays.filter(b => b.type === 'ESTUDIANTE').length > 0 && (
                          <div>
                            <p className="text-xs text-green-600 font-medium mb-1">Estudiantes</p>
                            <div className="space-y-1">
                              {dayBirthdays.filter(b => b.type === 'ESTUDIANTE').map((birthday) => (
                                <div key={birthday.id} className="flex items-center gap-2 py-1">
                                  <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold">{new Date(birthday.birthDate).getDate()}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 truncate">{birthday.name}</p>
                                    <p className="text-xs text-slate-400">{birthday.detail}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para ver imagen en grande */}
      {imageModal && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setImageModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button 
              onClick={() => setImageModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-slate-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={imageModal.url} 
              alt={imageModal.title}
              className="w-full h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-center mt-4 font-medium">{imageModal.title}</p>
          </div>
        </div>
      )}

      {/* Modal para ver detalle de evento */}
      {eventModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEventModal(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header con color según tipo de evento */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-lg p-2">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">
                      {new Date(eventModal.eventDate).toLocaleDateString('es-CO', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    <p className="text-white/60 text-xs">
                      {new Date(eventModal.eventDate).toLocaleTimeString('es-CO', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setEventModal(null)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div className="px-6 py-5">
              <h3 className="text-xl font-bold text-slate-900 mb-3">{eventModal.title}</h3>
              
              {eventModal.eventType && (
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full mb-4">
                  {eventModal.eventType}
                </span>
              )}

              {eventModal.description ? (
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  {eventModal.description}
                </p>
              ) : (
                <p className="text-slate-400 text-sm italic mb-4">
                  No hay descripción disponible para este evento.
                </p>
              )}

              {eventModal.location && (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-50 rounded-lg px-4 py-3">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <span className="text-sm">{eventModal.location}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setEventModal(null)}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
