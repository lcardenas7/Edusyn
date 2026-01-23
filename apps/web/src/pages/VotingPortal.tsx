import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Vote, Users, CheckCircle, AlertCircle, Loader2, User } from 'lucide-react'

interface Candidate {
  id: string
  slogan: string | null
  proposals: string | null
  photo: string | null
  student: {
    id: string
    firstName: string
    lastName: string
    photo: string | null
  }
}

interface Election {
  id: string
  type: 'PERSONERO' | 'CONTRALOR' | 'REPRESENTANTE_GRADO' | 'REPRESENTANTE_CURSO'
  grade: { id: string; name: string } | null
  group: { id: string; name: string; grade: { name: string } } | null
  candidates: Candidate[]
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

export default function VotingPortal() {
  const { user, institution } = useAuth()
  const [pendingElections, setPendingElections] = useState<Election[]>([])
  const [currentElection, setCurrentElection] = useState<Election | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [isBlankVote, setIsBlankVote] = useState(false)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    loadPendingElections()
  }, [])

  const loadPendingElections = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get(`/elections/voting/pending?institutionId=${institution?.id}`)
      const elections = response.data || []
      setPendingElections(elections)
      
      if (elections.length === 0) {
        setCompleted(true)
      }
    } catch (err: any) {
      setError('Error al cargar las elecciones')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

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

  const handleSelectElection = (election: Election) => {
    setCurrentElection(election)
    setSelectedCandidate(null)
    setIsBlankVote(false)
    setSuccessMessage(null)
  }

  const handleSelectCandidate = (candidateId: string) => {
    setSelectedCandidate(candidateId)
    setIsBlankVote(false)
  }

  const handleBlankVote = () => {
    setSelectedCandidate(null)
    setIsBlankVote(true)
  }

  const handleVote = async () => {
    if (!currentElection) return
    if (!selectedCandidate && !isBlankVote) {
      setError('Debes seleccionar un candidato o votar en blanco')
      return
    }

    try {
      setVoting(true)
      setError(null)

      await api.post('/elections/vote', {
        electionId: currentElection.id,
        candidateId: selectedCandidate || undefined,
      })

      setSuccessMessage('¡Voto registrado exitosamente!')
      
      // Remover la elección votada de la lista
      const remaining = pendingElections.filter(e => e.id !== currentElection.id)
      setPendingElections(remaining)
      
      // Esperar un momento y pasar a la siguiente
      setTimeout(() => {
        setCurrentElection(null)
        setSelectedCandidate(null)
        setIsBlankVote(false)
        setSuccessMessage(null)
        
        if (remaining.length === 0) {
          setCompleted(true)
        }
      }, 1500)

    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrar el voto')
    } finally {
      setVoting(false)
    }
  }

  const handleBack = () => {
    setCurrentElection(null)
    setSelectedCandidate(null)
    setIsBlankVote(false)
    setError(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4" />
          <p className="text-xl">Cargando elecciones...</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 via-emerald-900 to-teal-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-lg text-center">
          <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            ¡Votación Completada!
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Has ejercido tu derecho al voto en todas las elecciones disponibles.
            Gracias por participar en el proceso democrático de tu institución.
          </p>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-green-700 font-medium">
              Tu voto es secreto y ha sido registrado de forma segura.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Vista de selección de elección
  if (!currentElection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <Vote className="w-16 h-16 text-white mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white mb-2">
              Portal de Votación
            </h1>
            <p className="text-blue-200 text-lg">
              Hola, {user?.firstName}. Tienes {pendingElections.length} elección(es) pendiente(s)
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400 rounded-xl p-4 mb-6 text-center">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {/* Grid de elecciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingElections.map((election) => (
              <button
                key={election.id}
                onClick={() => handleSelectElection(election)}
                className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-left hover:bg-white/20 transition-all duration-300 transform hover:scale-105 border border-white/20 group"
              >
                <div className="text-6xl mb-4">
                  {electionTypeIcons[election.type]}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {getElectionTitle(election)}
                </h2>
                <p className="text-blue-200 mb-4">
                  {election.candidates.length} candidato(s)
                </p>
                <div className="flex items-center text-blue-300 group-hover:text-white transition-colors">
                  <span className="font-medium">Votar ahora</span>
                  <svg className="w-5 h-5 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Vista de votación
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            {electionTypeIcons[currentElection.type]}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {getElectionTitle(currentElection)}
          </h1>
          <p className="text-blue-200">
            Selecciona tu candidato y confirma tu voto
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400 rounded-xl p-4 mb-6 text-center">
            <AlertCircle className="w-6 h-6 text-red-300 inline mr-2" />
            <span className="text-red-200">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-500/20 border border-green-400 rounded-xl p-4 mb-6 text-center">
            <CheckCircle className="w-6 h-6 text-green-300 inline mr-2" />
            <span className="text-green-200">{successMessage}</span>
          </div>
        )}

        {/* Candidatos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {currentElection.candidates.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => handleSelectCandidate(candidate.id)}
              disabled={voting}
              className={`relative bg-white rounded-2xl p-6 text-center transition-all duration-300 transform hover:scale-105 ${
                selectedCandidate === candidate.id
                  ? 'ring-4 ring-green-500 shadow-lg shadow-green-500/30'
                  : 'hover:shadow-xl'
              }`}
            >
              {selectedCandidate === candidate.id && (
                <div className="absolute -top-3 -right-3 bg-green-500 rounded-full p-2">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              )}
              
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
                {candidate.photo || candidate.student.photo ? (
                  <img 
                    src={candidate.photo || candidate.student.photo || ''} 
                    alt={candidate.student.firstName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-1">
                {candidate.student.firstName} {candidate.student.lastName}
              </h3>
              
              {candidate.slogan && (
                <p className="text-purple-600 font-medium italic mb-2">
                  "{candidate.slogan}"
                </p>
              )}
              
              {candidate.proposals && (
                <p className="text-gray-500 text-sm line-clamp-3">
                  {candidate.proposals}
                </p>
              )}
            </button>
          ))}

          {/* Voto en blanco */}
          <button
            onClick={handleBlankVote}
            disabled={voting}
            className={`bg-gray-100 rounded-2xl p-6 text-center transition-all duration-300 transform hover:scale-105 border-2 border-dashed ${
              isBlankVote
                ? 'border-gray-500 ring-4 ring-gray-400'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {isBlankVote && (
              <div className="absolute -top-3 -right-3 bg-gray-500 rounded-full p-2">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            )}
            
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-4xl">⬜</span>
            </div>
            
            <h3 className="text-xl font-bold text-gray-600">
              Voto en Blanco
            </h3>
            <p className="text-gray-400 text-sm mt-2">
              No seleccionar ningún candidato
            </p>
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <button
            onClick={handleBack}
            disabled={voting}
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
          >
            ← Volver
          </button>
          
          <button
            onClick={handleVote}
            disabled={voting || (!selectedCandidate && !isBlankVote)}
            className={`px-12 py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
              selectedCandidate || isBlankVote
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
          >
            {voting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Registrando voto...
              </>
            ) : (
              <>
                <Vote className="w-5 h-5 inline mr-2" />
                Confirmar Voto
              </>
            )}
          </button>
        </div>

        {/* Indicador de progreso */}
        <div className="mt-8 text-center">
          <p className="text-blue-200 text-sm">
            Elección {pendingElections.findIndex(e => e.id === currentElection.id) + 1} de {pendingElections.length}
          </p>
          <div className="flex justify-center gap-2 mt-2">
            {pendingElections.map((e, i) => (
              <div
                key={e.id}
                className={`w-3 h-3 rounded-full ${
                  e.id === currentElection.id
                    ? 'bg-white'
                    : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
