import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { 
  Vote, Plus, Calendar, Users, CheckCircle, XCircle, 
  Clock, BarChart3, FileText, Loader2, AlertCircle,
  Play, Pause, Square, Eye, Download
} from 'lucide-react'

interface ElectionProcess {
  id: string
  name: string
  description: string | null
  status: string
  registrationStart: string
  registrationEnd: string
  campaignStart: string
  campaignEnd: string
  votingStart: string
  votingEnd: string
  enablePersonero: boolean
  enableContralor: boolean
  enableRepresentanteGrado: boolean
  enableRepresentanteCurso: boolean
  allowBlankVote: boolean
  academicYear: { id: string; year: number }
  _count?: { elections: number }
  elections?: Election[]
}

interface Election {
  id: string
  type: string
  status: string
  grade: { id: string; name: string } | null
  group: { id: string; name: string; grade: { name: string } } | null
  candidates: Candidate[]
  _count?: { votes: number }
  results?: ElectionResult[]
}

interface Candidate {
  id: string
  status: string
  slogan: string | null
  proposals: string | null
  student: {
    id: string
    firstName: string
    lastName: string
  }
}

interface ElectionResult {
  id: string
  votes: number
  percentage: number
  position: number
  isWinner: boolean
  candidate: Candidate | null
}

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-700', icon: FileText },
  REGISTRATION: { label: 'Inscripción', color: 'bg-blue-100 text-blue-700', icon: Users },
  CAMPAIGN: { label: 'Campaña', color: 'bg-yellow-100 text-yellow-700', icon: Calendar },
  VOTING: { label: 'Votación', color: 'bg-green-100 text-green-700', icon: Vote },
  CLOSED: { label: 'Cerrada', color: 'bg-purple-100 text-purple-700', icon: CheckCircle },
  CANCELLED: { label: 'Anulada', color: 'bg-red-100 text-red-700', icon: XCircle },
}

const electionTypeLabels: Record<string, string> = {
  PERSONERO: 'Personero',
  CONTRALOR: 'Contralor',
  REPRESENTANTE_GRADO: 'Rep. Grado',
  REPRESENTANTE_CURSO: 'Rep. Curso',
}

export default function Elections() {
  const { institution } = useAuth()
  const [processes, setProcesses] = useState<ElectionProcess[]>([])
  const [selectedProcess, setSelectedProcess] = useState<ElectionProcess | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCandidatesModal, setShowCandidatesModal] = useState(false)
  const [selectedElection, setSelectedElection] = useState<Election | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    registrationStart: '',
    registrationEnd: '',
    campaignStart: '',
    campaignEnd: '',
    votingStart: '',
    votingEnd: '',
    enablePersonero: true,
    enableContralor: true,
    enableRepresentanteGrado: true,
    enableRepresentanteCurso: true,
    allowBlankVote: true,
  })

  useEffect(() => {
    if (institution?.id) {
      loadProcesses()
    }
  }, [institution?.id])

  const loadProcesses = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/elections/process?institutionId=${institution?.id}`)
      setProcesses(response.data || [])
    } catch (err) {
      console.error(err)
      setError('Error al cargar procesos electorales')
    } finally {
      setLoading(false)
    }
  }

  const loadProcessDetails = async (processId: string) => {
    try {
      const [processRes, statsRes] = await Promise.all([
        api.get(`/elections/process/${processId}`),
        api.get(`/elections/process/${processId}/stats`).catch(() => ({ data: null })),
      ])
      setSelectedProcess(processRes.data)
      setStats(statsRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateProcess = async () => {
    try {
      setActionLoading(true)
      setError(null)

      // Obtener año académico activo
      const yearsRes = await api.get(`/academic-years?institutionId=${institution?.id}`)
      const activeYear = yearsRes.data?.find((y: any) => y.status === 'ACTIVE')

      if (!activeYear) {
        setError('No hay un año académico activo')
        return
      }

      await api.post('/elections/process', {
        institutionId: institution?.id,
        academicYearId: activeYear.id,
        ...formData,
        registrationStart: new Date(formData.registrationStart),
        registrationEnd: new Date(formData.registrationEnd),
        campaignStart: new Date(formData.campaignStart),
        campaignEnd: new Date(formData.campaignEnd),
        votingStart: new Date(formData.votingStart),
        votingEnd: new Date(formData.votingEnd),
      })

      setShowCreateModal(false)
      loadProcesses()
      resetForm()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear proceso')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateStatus = async (processId: string, newStatus: string) => {
    try {
      setActionLoading(true)
      await api.put(`/elections/process/${processId}/status`, { status: newStatus })
      loadProcesses()
      if (selectedProcess?.id === processId) {
        loadProcessDetails(processId)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al actualizar estado')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCloseProcess = async (processId: string) => {
    if (!confirm('¿Cerrar el proceso electoral y calcular resultados finales?')) return
    try {
      setActionLoading(true)
      await api.post(`/elections/process/${processId}/close`)
      loadProcesses()
      if (selectedProcess?.id === processId) {
        loadProcessDetails(processId)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cerrar proceso')
    } finally {
      setActionLoading(false)
    }
  }

  const handleApproveCandidate = async (candidateId: string) => {
    try {
      await api.put(`/elections/candidate/${candidateId}/approve`)
      if (selectedProcess) {
        loadProcessDetails(selectedProcess.id)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al aprobar candidato')
    }
  }

  const handleRejectCandidate = async (candidateId: string) => {
    const reason = prompt('Motivo del rechazo:')
    if (!reason) return
    try {
      await api.put(`/elections/candidate/${candidateId}/reject`, { reason })
      if (selectedProcess) {
        loadProcessDetails(selectedProcess.id)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al rechazar candidato')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      registrationStart: '',
      registrationEnd: '',
      campaignStart: '',
      campaignEnd: '',
      votingStart: '',
      votingEnd: '',
      enablePersonero: true,
      enableContralor: true,
      enableRepresentanteGrado: true,
      enableRepresentanteCurso: true,
      allowBlankVote: true,
    })
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Vote className="w-7 h-7 text-purple-600" />
            Elecciones Escolares
          </h1>
          <p className="text-gray-500 mt-1">
            Gestiona los procesos electorales de tu institución
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="/resultados-elecciones"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <BarChart3 className="w-5 h-5" />
            Ver Resultados en Vivo
          </a>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proceso Electoral
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de procesos */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-semibold text-gray-700">Procesos Electorales</h2>
          
          {processes.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Vote className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No hay procesos electorales</p>
              <p className="text-gray-400 text-sm">Crea uno para comenzar</p>
            </div>
          ) : (
            processes.map((process) => {
              const statusInfo = statusLabels[process.status] || statusLabels.DRAFT
              const StatusIcon = statusInfo.icon
              return (
                <button
                  key={process.id}
                  onClick={() => loadProcessDetails(process.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    selectedProcess?.id === process.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 bg-white hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">{process.name}</h3>
                      <p className="text-sm text-gray-500">Año {process.academicYear.year}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {process._count?.elections || 0} elecciones
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Detalle del proceso */}
        <div className="lg:col-span-2">
          {selectedProcess ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {/* Header del proceso */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedProcess.name}</h2>
                  {selectedProcess.description && (
                    <p className="text-gray-500 mt-1">{selectedProcess.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {selectedProcess.status === 'DRAFT' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedProcess.id, 'REGISTRATION')}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      <Play className="w-4 h-4" />
                      Iniciar Inscripción
                    </button>
                  )}
                  {selectedProcess.status === 'REGISTRATION' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedProcess.id, 'CAMPAIGN')}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700"
                    >
                      <Play className="w-4 h-4" />
                      Iniciar Campaña
                    </button>
                  )}
                  {selectedProcess.status === 'CAMPAIGN' && (
                    <button
                      onClick={() => handleUpdateStatus(selectedProcess.id, 'VOTING')}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                    >
                      <Vote className="w-4 h-4" />
                      Iniciar Votación
                    </button>
                  )}
                  {selectedProcess.status === 'VOTING' && (
                    <button
                      onClick={() => handleCloseProcess(selectedProcess.id)}
                      disabled={actionLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                    >
                      <Square className="w-4 h-4" />
                      Cerrar y Calcular
                    </button>
                  )}
                  {selectedProcess.status === 'CLOSED' && (
                    <>
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/elections/process/${selectedProcess.id}/report/acta`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                      >
                        <Download className="w-4 h-4" />
                        Acta de Escrutinio
                      </a>
                      <a
                        href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/elections/process/${selectedProcess.id}/report/participation`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        <Download className="w-4 h-4" />
                        Informe Participación
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Estadísticas */}
              {stats && selectedProcess.status === 'VOTING' && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.totalStudents}</p>
                    <p className="text-sm text-blue-700">Estudiantes</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.totalVoters}</p>
                    <p className="text-sm text-green-700">Han votado</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-600">{stats.participationRate.toFixed(1)}%</p>
                    <p className="text-sm text-purple-700">Participación</p>
                  </div>
                </div>
              )}

              {/* Fechas */}
              <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Inscripción</p>
                  <p className="font-medium">{new Date(selectedProcess.registrationStart).toLocaleDateString()}</p>
                  <p className="text-gray-400 text-xs">al {new Date(selectedProcess.registrationEnd).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Campaña</p>
                  <p className="font-medium">{new Date(selectedProcess.campaignStart).toLocaleDateString()}</p>
                  <p className="text-gray-400 text-xs">al {new Date(selectedProcess.campaignEnd).toLocaleDateString()}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs">Votación</p>
                  <p className="font-medium">{new Date(selectedProcess.votingStart).toLocaleDateString()}</p>
                  <p className="text-gray-400 text-xs">al {new Date(selectedProcess.votingEnd).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Elecciones */}
              <h3 className="font-semibold text-gray-700 mb-3">Elecciones</h3>
              <div className="space-y-3">
                {selectedProcess.elections?.map((election) => (
                  <div
                    key={election.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-800">
                          {getElectionTitle(election)}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {election.candidates?.length || 0} candidato(s)
                          {election._count?.votes !== undefined && ` • ${election._count.votes} votos`}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedElection(election)
                          setShowCandidatesModal(true)
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Ver detalles
                      </button>
                    </div>

                    {/* Resultados si está cerrada */}
                    {selectedProcess.status === 'CLOSED' && election.results && election.results.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Resultados:</p>
                        <div className="space-y-1">
                          {election.results.slice(0, 3).map((result) => (
                            <div key={result.id} className="flex items-center justify-between text-sm">
                              <span className={result.isWinner ? 'font-bold text-green-600' : 'text-gray-600'}>
                                {result.position}° {result.candidate 
                                  ? `${result.candidate.student.firstName} ${result.candidate.student.lastName}`
                                  : 'Voto en blanco'
                                }
                              </span>
                              <span className="text-gray-500">
                                {result.votes} ({result.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-12 text-center">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Selecciona un proceso electoral para ver los detalles</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear Proceso */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">Nuevo Proceso Electoral</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Elecciones Gobierno Escolar 2026"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Inscripción</label>
                  <input
                    type="datetime-local"
                    value={formData.registrationStart}
                    onChange={(e) => setFormData({ ...formData, registrationStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin Inscripción</label>
                  <input
                    type="datetime-local"
                    value={formData.registrationEnd}
                    onChange={(e) => setFormData({ ...formData, registrationEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Campaña</label>
                  <input
                    type="datetime-local"
                    value={formData.campaignStart}
                    onChange={(e) => setFormData({ ...formData, campaignStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin Campaña</label>
                  <input
                    type="datetime-local"
                    value={formData.campaignEnd}
                    onChange={(e) => setFormData({ ...formData, campaignEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Inicio Votación</label>
                  <input
                    type="datetime-local"
                    value={formData.votingStart}
                    onChange={(e) => setFormData({ ...formData, votingStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fin Votación</label>
                  <input
                    type="datetime-local"
                    value={formData.votingEnd}
                    onChange={(e) => setFormData({ ...formData, votingEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Cargos a elegir</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enablePersonero}
                      onChange={(e) => setFormData({ ...formData, enablePersonero: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Personero</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enableContralor}
                      onChange={(e) => setFormData({ ...formData, enableContralor: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Contralor</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enableRepresentanteGrado}
                      onChange={(e) => setFormData({ ...formData, enableRepresentanteGrado: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Representante de Grado</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.enableRepresentanteCurso}
                      onChange={(e) => setFormData({ ...formData, enableRepresentanteCurso: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Representante de Curso</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.allowBlankVote}
                  onChange={(e) => setFormData({ ...formData, allowBlankVote: e.target.checked })}
                  className="rounded text-purple-600"
                />
                <span className="text-sm text-gray-700">Permitir voto en blanco</span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  resetForm()
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProcess}
                disabled={actionLoading || !formData.name}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? 'Creando...' : 'Crear Proceso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Candidatos */}
      {showCandidatesModal && selectedElection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-800">
                {getElectionTitle(selectedElection)}
              </h2>
              <p className="text-gray-500 text-sm">Candidatos inscritos</p>
            </div>
            <div className="p-6">
              {selectedElection.candidates?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No hay candidatos inscritos</p>
              ) : (
                <div className="space-y-4">
                  {selectedElection.candidates?.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-800">
                            {candidate.student.firstName} {candidate.student.lastName}
                          </h4>
                          {candidate.slogan && (
                            <p className="text-purple-600 text-sm italic">"{candidate.slogan}"</p>
                          )}
                          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
                            candidate.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                            candidate.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {candidate.status === 'APPROVED' ? 'Aprobado' :
                             candidate.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                          </span>
                        </div>
                        {candidate.status === 'PENDING' && selectedProcess?.status === 'REGISTRATION' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveCandidate(candidate.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              title="Aprobar"
                            >
                              <CheckCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleRejectCandidate(candidate.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Rechazar"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setShowCandidatesModal(false)
                  setSelectedElection(null)
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
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
