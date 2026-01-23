import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { 
  Vote, Users, TrendingUp, BarChart3, Trophy, 
  RefreshCw, Clock, CheckCircle, Loader2
} from 'lucide-react'

interface ElectionResult {
  id: string
  votes: number
  percentage: number
  position: number
  isWinner: boolean
  candidate: {
    id: string
    student: {
      firstName: string
      lastName: string
    }
  } | null
}

interface Election {
  id: string
  type: string
  status: string
  grade: { id: string; name: string } | null
  group: { id: string; name: string; grade: { name: string } } | null
  results: ElectionResult[]
  _count: { votes: number }
}

interface Stats {
  totalStudents: number
  totalVoters: number
  participationRate: number
  elections: Array<{
    id: string
    type: string
    totalVotes: number
    totalCandidates: number
  }>
}

interface ElectionProcess {
  id: string
  name: string
  status: string
  elections: Election[]
}

const electionTypeLabels: Record<string, string> = {
  PERSONERO: 'Personero Estudiantil',
  CONTRALOR: 'Contralor Estudiantil',
  REPRESENTANTE_GRADO: 'Representante de Grado',
  REPRESENTANTE_CURSO: 'Representante de Curso',
}

const electionTypeIcons: Record<string, string> = {
  PERSONERO: '🎓',
  CONTRALOR: '📋',
  REPRESENTANTE_GRADO: '📚',
  REPRESENTANTE_CURSO: '🏫',
}

const electionTypeColors: Record<string, string> = {
  PERSONERO: 'from-purple-500 to-indigo-600',
  CONTRALOR: 'from-blue-500 to-cyan-600',
  REPRESENTANTE_GRADO: 'from-green-500 to-emerald-600',
  REPRESENTANTE_CURSO: 'from-orange-500 to-amber-600',
}

export default function ElectionResults() {
  const { institution } = useAuth()
  const [process, setProcess] = useState<ElectionProcess | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [autoPlay, setAutoPlay] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const loadData = useCallback(async () => {
    if (!institution?.id) return

    try {
      // Obtener proceso actual
      const processRes = await api.get(`/elections/process/current?institutionId=${institution.id}`)
      
      if (processRes.data) {
        setProcess(processRes.data)
        
        // Obtener estadísticas
        const statsRes = await api.get(`/elections/process/${processRes.data.id}/stats`)
        setStats(statsRes.data)
        
        // Obtener resultados de cada elección
        const resultsRes = await api.get(`/elections/process/${processRes.data.id}/results`)
        setProcess(prev => prev ? { ...prev, elections: resultsRes.data } : null)
      }
      
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error loading election data:', err)
    } finally {
      setLoading(false)
    }
  }, [institution?.id])

  // Cargar datos iniciales y refrescar cada 10 segundos
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000) // Refresh cada 10 segundos
    return () => clearInterval(interval)
  }, [loadData])

  // Auto-slide cada 8 segundos
  useEffect(() => {
    if (!autoPlay || !process?.elections?.length) return
    
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % (process.elections.length + 1)) // +1 para incluir resumen
    }, 8000)
    
    return () => clearInterval(interval)
  }, [autoPlay, process?.elections?.length])

  const getElectionTitle = (election: Election) => {
    const baseTitle = electionTypeLabels[election.type] || election.type
    if (election.type === 'REPRESENTANTE_GRADO' && election.grade) {
      return `${baseTitle} - ${election.grade.name}`
    }
    if (election.type === 'REPRESENTANTE_CURSO' && election.group) {
      return `${baseTitle} - ${election.group.grade.name} ${election.group.name}`
    }
    return baseTitle
  }

  const groupElectionsByType = () => {
    if (!process?.elections) return {}
    
    return process.elections.reduce((acc, election) => {
      const type = election.type
      if (!acc[type]) acc[type] = []
      acc[type].push(election)
      return acc
    }, {} as Record<string, Election[]>)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4" />
          <p className="text-xl">Cargando resultados...</p>
        </div>
      </div>
    )
  }

  if (!process) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Vote className="w-20 h-20 mx-auto mb-4 opacity-50" />
          <h1 className="text-3xl font-bold mb-2">Sin proceso electoral activo</h1>
          <p className="text-gray-400">No hay elecciones en curso en este momento</p>
        </div>
      </div>
    )
  }

  const groupedElections = groupElectionsByType()
  const electionTypes = Object.keys(groupedElections)

  // Slides: Resumen + cada tipo de elección
  const slides = [
    { type: 'summary', title: 'Resumen General' },
    ...electionTypes.map(type => ({ type, title: electionTypeLabels[type] || type }))
  ]

  const renderSummarySlide = () => (
    <div className="animate-fadeIn">
      {/* Header con estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center transform hover:scale-105 transition-transform">
          <Users className="w-12 h-12 text-blue-400 mx-auto mb-3" />
          <p className="text-4xl font-bold text-white mb-1">{stats?.totalStudents || 0}</p>
          <p className="text-blue-200">Estudiantes Habilitados</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center transform hover:scale-105 transition-transform">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-4xl font-bold text-white mb-1">{stats?.totalVoters || 0}</p>
          <p className="text-green-200">Han Votado</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-center transform hover:scale-105 transition-transform">
          <TrendingUp className="w-12 h-12 text-purple-400 mx-auto mb-3" />
          <p className="text-4xl font-bold text-white mb-1">
            {stats?.participationRate?.toFixed(1) || 0}%
          </p>
          <p className="text-purple-200">Participación</p>
        </div>
      </div>

      {/* Barra de progreso de participación */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8">
        <div className="flex justify-between items-center mb-3">
          <span className="text-white font-medium">Progreso de Votación</span>
          <span className="text-white font-bold">{stats?.participationRate?.toFixed(1) || 0}%</span>
        </div>
        <div className="h-4 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${stats?.participationRate || 0}%` }}
          />
        </div>
      </div>

      {/* Resumen por tipo de elección */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {electionTypes.map(type => {
          const elections = groupedElections[type]
          const totalVotes = elections.reduce((sum, e) => sum + (e._count?.votes || 0), 0)
          return (
            <div 
              key={type}
              className={`bg-gradient-to-br ${electionTypeColors[type] || 'from-gray-500 to-gray-600'} rounded-xl p-4 text-center`}
            >
              <span className="text-3xl">{electionTypeIcons[type]}</span>
              <p className="text-white font-bold mt-2">{electionTypeLabels[type]}</p>
              <p className="text-white/80 text-sm">{elections.length} elección(es)</p>
              <p className="text-white/80 text-sm">{totalVotes} votos</p>
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderElectionTypeSlide = (type: string) => {
    const elections = groupedElections[type] || []
    
    // Para Personero y Contralor, mostrar una sola elección grande
    if (type === 'PERSONERO' || type === 'CONTRALOR') {
      const election = elections[0]
      if (!election) return null
      
      return (
        <div className="animate-fadeIn">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <div className="text-center mb-8">
              <span className="text-6xl">{electionTypeIcons[type]}</span>
              <h2 className="text-3xl font-bold text-white mt-4">{electionTypeLabels[type]}</h2>
              <p className="text-gray-300">{election._count?.votes || 0} votos emitidos</p>
            </div>

            <div className="space-y-4">
              {election.results?.slice(0, 5).map((result, index) => (
                <div 
                  key={result.id}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-500 ${
                    result.isWinner 
                      ? 'bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border-2 border-yellow-400' 
                      : 'bg-white/5'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                    index === 0 ? 'bg-yellow-500 text-yellow-900' :
                    index === 1 ? 'bg-gray-300 text-gray-700' :
                    index === 2 ? 'bg-amber-600 text-amber-100' :
                    'bg-white/20 text-white'
                  }`}>
                    {result.position}°
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg">
                      {result.candidate 
                        ? `${result.candidate.student.firstName} ${result.candidate.student.lastName}`
                        : 'Voto en Blanco'
                      }
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            result.isWinner ? 'bg-yellow-400' : 'bg-blue-400'
                          }`}
                          style={{ width: `${result.percentage}%` }}
                        />
                      </div>
                      <span className="text-white font-medium w-16 text-right">
                        {result.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{result.votes}</p>
                    <p className="text-gray-400 text-sm">votos</p>
                  </div>
                  {result.isWinner && (
                    <Trophy className="w-8 h-8 text-yellow-400 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Para Representantes de Grado y Curso, mostrar grid
    return (
      <div className="animate-fadeIn">
        <div className="text-center mb-6">
          <span className="text-5xl">{electionTypeIcons[type]}</span>
          <h2 className="text-2xl font-bold text-white mt-2">{electionTypeLabels[type]}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
          {elections.map(election => {
            const winner = election.results?.find(r => r.isWinner)
            const totalVotes = election._count?.votes || 0
            
            return (
              <div 
                key={election.id}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white font-bold">
                    {election.type === 'REPRESENTANTE_GRADO' && election.grade
                      ? election.grade.name
                      : election.group
                        ? `${election.group.grade.name} ${election.group.name}`
                        : 'Sin asignar'
                    }
                  </h3>
                  <span className="text-gray-400 text-sm">{totalVotes} votos</span>
                </div>

                {winner ? (
                  <div className="flex items-center gap-3 bg-green-500/20 rounded-lg p-3">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-white font-medium">
                        {winner.candidate?.student.firstName} {winner.candidate?.student.lastName}
                      </p>
                      <p className="text-green-300 text-sm">
                        {winner.votes} votos ({winner.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    Sin votos aún
                  </div>
                )}

                {/* Mini barras de los demás candidatos */}
                {election.results?.slice(0, 3).map(result => (
                  <div key={result.id} className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>
                        {result.candidate 
                          ? `${result.candidate.student.firstName.charAt(0)}. ${result.candidate.student.lastName}`
                          : 'Blanco'
                        }
                      </span>
                      <span>{result.percentage.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${
                          result.isWinner ? 'bg-yellow-400' : 'bg-blue-400'
                        }`}
                        style={{ width: `${result.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-10 h-10 text-purple-400" />
              Resultados en Tiempo Real
            </h1>
            <p className="text-gray-400 mt-1">{process.name}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Clock className="w-4 h-4" />
              Actualizado: {lastUpdate.toLocaleTimeString()}
            </div>
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                autoPlay 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                  : 'bg-white/10 text-gray-400'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${autoPlay ? 'animate-spin' : ''}`} />
              {autoPlay ? 'Auto' : 'Manual'}
            </button>
          </div>
        </div>

        {/* Indicador de estado */}
        {process.status === 'VOTING' && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 font-medium">Votación en curso - Los resultados se actualizan automáticamente</span>
          </div>
        )}

        {process.status === 'CLOSED' && (
          <div className="bg-purple-500/20 border border-purple-500/50 rounded-xl p-4 mb-6 flex items-center justify-center gap-3">
            <CheckCircle className="w-5 h-5 text-purple-400" />
            <span className="text-purple-400 font-medium">Votación cerrada - Resultados finales</span>
          </div>
        )}

        {/* Navegación de slides */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => {
                setCurrentSlide(index)
                setAutoPlay(false)
              }}
              className={`px-4 py-2 rounded-lg transition-all ${
                currentSlide === index
                  ? 'bg-white text-purple-900 font-bold'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {slide.type === 'summary' ? '📊 Resumen' : `${electionTypeIcons[slide.type]} ${slide.title}`}
            </button>
          ))}
        </div>

        {/* Contenido del slide actual */}
        <div className="min-h-[500px]">
          {currentSlide === 0 
            ? renderSummarySlide()
            : renderElectionTypeSlide(slides[currentSlide].type)
          }
        </div>

        {/* Indicadores de slide */}
        <div className="flex justify-center gap-2 mt-8">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${
                currentSlide === index ? 'w-8 bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  )
}
