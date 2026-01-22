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
  MapPin
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
                        <img 
                          src={announcement.imageUrl} 
                          alt={announcement.title}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
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
                  <div className="relative h-64 overflow-hidden">
                    {gallery.map((img, index) => (
                      <div 
                        key={img.id} 
                        className={`absolute inset-0 transition-opacity duration-500 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                      >
                        <img 
                          src={img.imageUrl} 
                          alt={img.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                          <p className="text-white font-medium">{img.title}</p>
                          {img.category && (
                            <span className="text-white/70 text-sm">{img.category}</span>
                          )}
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
                  <div key={event.id} className="px-6 py-3 hover:bg-slate-50 transition-colors">
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

          {/* Cumpleaños del Mes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Cake className="w-5 h-5 text-pink-600" />
                Cumpleaños del Mes
              </h2>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {birthdays.length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500">
                  <Cake className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p>No hay cumpleaños este mes</p>
                </div>
              ) : (
                <>
                  {/* Cumpleaños de hoy destacados */}
                  {birthdays.filter(b => b.isToday).length > 0 && (
                    <div className="px-4 py-3 bg-gradient-to-r from-pink-50 to-purple-50 border-b border-pink-100">
                      <p className="text-xs font-semibold text-pink-600 uppercase mb-2">🎂 ¡Hoy cumplen años!</p>
                      <div className="space-y-2">
                        {birthdays.filter(b => b.isToday).map((birthday) => (
                          <div key={birthday.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm">
                            <div className="w-8 h-8 bg-pink-500 text-white rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold">{new Date(birthday.birthDate).getDate()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm truncate">{birthday.name}</p>
                              <p className="text-xs text-slate-500">
                                {birthday.type === 'DOCENTE' ? (
                                  <span className="text-blue-600 font-medium">Docente</span>
                                ) : (
                                  <span className="text-green-600">{birthday.detail}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Docentes */}
                  {birthdays.filter(b => b.type === 'DOCENTE' && !b.isToday).length > 0 && (
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Docentes</p>
                      <div className="space-y-1">
                        {birthdays.filter(b => b.type === 'DOCENTE' && !b.isToday).map((birthday) => (
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

                  {/* Estudiantes */}
                  {birthdays.filter(b => b.type === 'ESTUDIANTE' && !b.isToday).length > 0 && (
                    <div className="px-4 py-2">
                      <p className="text-xs font-semibold text-green-600 uppercase mb-2">Estudiantes</p>
                      <div className="space-y-1">
                        {birthdays.filter(b => b.type === 'ESTUDIANTE' && !b.isToday).map((birthday) => (
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
