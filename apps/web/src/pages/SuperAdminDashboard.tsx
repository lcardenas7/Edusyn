/**
 * Dashboard de SuperAdmin
 * 
 * El SuperAdmin es el ARQUITECTO del sistema, NO el rector.
 * 
 * Puede:
 * - Crear instituciones
 * - Crear el usuario administrativo inicial de cada institución
 * - Acceder a todas las configuraciones institucionales
 * - Editar / clonar / corregir configuraciones
 * - Bloquear instituciones
 * - Auditar datos (solo lectura académica)
 * - Forzar recálculo académico si hay cambios normativos
 * 
 * NO debería:
 * - Ingresar notas
 * - Tomar decisiones académicas diarias
 * - Alterar datos históricos sin versionado
 */

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Users, 
  GraduationCap, 
  Plus, 
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Eye,
  Power,
  Package,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Edit
} from 'lucide-react'
import { superadminApi } from '../lib/api'

// Tipos
interface Institution {
  id: string
  name: string
  slug: string
  daneCode?: string
  nit?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  status: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'INACTIVE'
  trialEndsAt?: string
  modules: string[]
  features: string[]  // Funcionalidades específicas habilitadas
  adminEmail?: string
  adminName?: string
  studentsCount: number
  campusesCount: number
  createdAt: string
}

interface SystemStats {
  totalInstitutions: number
  activeInstitutions: number
  trialInstitutions: number
  suspendedInstitutions: number
  totalUsers: number
  totalStudents: number
}

// Sistema de módulos con funcionalidades granulares
interface ModuleFeature {
  id: string
  name: string
  description: string
  subFeatures?: ModuleFeature[]  // Sub-features para categorías anidadas
}

interface ModuleConfig {
  id: string
  name: string
  description: string
  features: ModuleFeature[]
  required?: boolean  // Módulos obligatorios que no se pueden desactivar
}

const AVAILABLE_MODULES: ModuleConfig[] = [
  { 
    id: 'DASHBOARD', 
    name: 'Dashboard', 
    description: 'Panel de control',
    required: true,  // Obligatorio - siempre activo
    features: [
      { id: 'DASHBOARD_VIEW', name: 'Ver Dashboard', description: 'Acceso al panel principal' },
      { id: 'DASHBOARD_STATS', name: 'Estadísticas', description: 'Ver estadísticas generales' },
      { id: 'DASHBOARD_ALERTS', name: 'Alertas rápidas', description: 'Ver alertas en dashboard' },
    ]
  },
  { 
    id: 'ACADEMIC', 
    name: 'Gestión Académica', 
    description: 'Notas, áreas, asignaturas',
    required: true,  // Obligatorio - núcleo del sistema
    features: [
      { id: 'ACADEMIC_GRADES', name: 'Calificaciones', description: 'Gestión de notas parciales' },
      { id: 'ACADEMIC_PERIOD_GRADES', name: 'Notas de Período', description: 'Notas finales de período' },
      { id: 'ACADEMIC_AREAS', name: 'Áreas y Asignaturas', description: 'Configurar áreas y materias' },
      { id: 'ACADEMIC_LOAD', name: 'Carga Académica', description: 'Asignación docente-grupo' },
    ]
  },
  { 
    id: 'ATTENDANCE', 
    name: 'Asistencia', 
    description: 'Control de asistencia',
    features: [
      { id: 'ATTENDANCE_REGISTER', name: 'Registrar Asistencia', description: 'Tomar asistencia diaria' },
      { id: 'ATTENDANCE_REPORTS', name: 'Reportes Asistencia', description: 'Ver reportes de asistencia' },
      { id: 'ATTENDANCE_ALERTS', name: 'Alertas Inasistencia', description: 'Alertas por inasistencia crítica' },
    ]
  },
  { 
    id: 'EVALUATION', 
    name: 'Evaluación', 
    description: 'Actividades evaluativas',
    features: [
      { id: 'EVALUATION_ACTIVITIES', name: 'Actividades', description: 'Crear actividades evaluativas' },
      { id: 'EVALUATION_RUBRICS', name: 'Rúbricas', description: 'Gestionar rúbricas de evaluación' },
      { id: 'EVALUATION_PLANS', name: 'Planes de Evaluación', description: 'Planificación de evaluaciones' },
    ]
  },
  { 
    id: 'RECOVERY', 
    name: 'Recuperaciones', 
    description: 'Gestión de recuperaciones',
    features: [
      { id: 'RECOVERY_PERIOD', name: 'Recuperación Período', description: 'Recuperaciones por período' },
      { id: 'RECOVERY_FINAL', name: 'Recuperación Final', description: 'Recuperaciones de fin de año' },
      { id: 'RECOVERY_CONFIG', name: 'Configuración', description: 'Configurar reglas de recuperación' },
    ]
  },
  { 
    id: 'REPORTS', 
    name: 'Reportes', 
    description: 'Boletines y reportes',
    features: [
      // Categoría: Administración (8 reportes)
      { 
        id: 'RPT_ADMIN', 
        name: '📊 Administración', 
        description: 'Carga académica, cobertura, docentes',
        subFeatures: [
          { id: 'RPT_ADMIN_LOAD_TEACHER', name: 'Carga por docente', description: 'Asignaturas y grupos por docente' },
          { id: 'RPT_ADMIN_LOAD_GROUP', name: 'Carga por grupo', description: 'Docentes y asignaturas por grupo' },
          { id: 'RPT_ADMIN_LOAD_AREA', name: 'Carga por área', description: 'Distribución por áreas' },
          { id: 'RPT_ADMIN_NO_TEACHER', name: 'Asignaturas sin docente', description: 'Sin docente asignado' },
          { id: 'RPT_ADMIN_INCOMPLETE', name: 'Grupos incompletos', description: 'Asignaturas pendientes' },
          { id: 'RPT_ADMIN_TEACHERS_ACTIVE', name: 'Docentes activos', description: 'Listado de docentes' },
          { id: 'RPT_ADMIN_TEACHERS_NO_LOAD', name: 'Docentes sin carga', description: 'Sin asignación' },
          { id: 'RPT_ADMIN_TEACHERS_HOURS', name: 'Horas docentes', description: 'Asignadas vs contratadas' },
        ]
      },
      // Categoría: Académico (15 reportes)
      { 
        id: 'RPT_ACAD', 
        name: '📚 Académico', 
        description: 'Promedios, aprobación, consolidados',
        subFeatures: [
          { id: 'RPT_ACAD_AVG_GROUP', name: 'Promedios por grupo', description: 'Rendimiento por grupo' },
          { id: 'RPT_ACAD_AVG_AREA', name: 'Promedios por área', description: 'Rendimiento por área' },
          { id: 'RPT_ACAD_AVG_INST', name: 'Promedios institucionales', description: 'Indicadores generales' },
          { id: 'RPT_ACAD_APPROVED', name: 'Áreas aprobadas', description: 'Estudiantes aprobados' },
          { id: 'RPT_ACAD_FAILED', name: 'Áreas reprobadas', description: 'Estudiantes reprobados' },
          { id: 'RPT_ACAD_PROMOTION', name: 'Tasa de promoción', description: 'Por grupo y grado' },
          { id: 'RPT_ACAD_PERIODS', name: 'Comparativo períodos', description: 'Evolución rendimiento' },
          { id: 'RPT_ACAD_HISTORY', name: 'Historial estudiante', description: 'Trayectoria individual' },
          { id: 'RPT_ACAD_CONS_SUBJ', name: 'Consolidado asignaturas', description: 'Acumulado por asignatura' },
          { id: 'RPT_ACAD_CONS_AREAS', name: 'Consolidado áreas', description: 'Acumulado por área' },
          { id: 'RPT_ACAD_CONS_DIM', name: 'Consolidado dimensiones', description: 'Por dimensión' },
          { id: 'RPT_ACAD_MIN_GRADE', name: 'Nota mínima', description: 'Para no reprobar' },
          { id: 'RPT_ACAD_DBA', name: 'Consolidado DBA', description: 'Por DBA' },
          { id: 'RPT_ACAD_PECAB', name: 'Consolidado PECAB', description: 'Por PECAB' },
          { id: 'RPT_ACAD_PERIOD_AVG', name: 'Acumulado período', description: 'Promedio por período' },
        ]
      },
      // Categoría: Evaluación SIEE (6 reportes)
      { 
        id: 'RPT_EVAL', 
        name: '📋 Evaluación (SIEE)', 
        description: 'Cumplimiento SIEE, actividades',
        subFeatures: [
          { id: 'RPT_EVAL_SIEE', name: 'Cumplimiento SIEE', description: 'Por dimensión evaluativa' },
          { id: 'RPT_EVAL_ACTIVITIES', name: 'Actividades creadas', description: 'Por docente/asignatura' },
          { id: 'RPT_EVAL_TYPES', name: 'Tipos de actividades', description: 'Distribución por tipo' },
          { id: 'RPT_EVAL_WEIGHTS', name: 'Peso por dimensión', description: 'Pesos evaluativos' },
          { id: 'RPT_EVAL_PENDING', name: 'Notas incompletas', description: 'Docentes pendientes' },
          { id: 'RPT_EVAL_PERIODS', name: 'Períodos abiertos', description: 'Estado de cierre' },
        ]
      },
      // Categoría: Asistencia (6 reportes)
      { 
        id: 'RPT_ATT', 
        name: '📅 Asistencia', 
        description: 'Asistencia por grupo, estudiante, docente',
        subFeatures: [
          { id: 'RPT_ATT_GROUP', name: 'Asistencia por grupo', description: 'Estado por grupo' },
          { id: 'RPT_ATT_STUDENT', name: 'Asistencia por estudiante', description: 'Seguimiento individual' },
          { id: 'RPT_ATT_SUBJECT', name: 'Asistencia por asignatura', description: 'Por materia' },
          { id: 'RPT_ATT_TEACHER', name: 'Asistencia por docente', description: 'Control de clases' },
          { id: 'RPT_ATT_CRITICAL', name: 'Inasistencias críticas', description: 'Estudiantes en riesgo' },
          { id: 'RPT_ATT_CONSOLIDATED', name: 'Consolidado asistencia', description: 'Datos institucionales' },
        ]
      },
      // Categoría: Boletines (5 reportes)
      { 
        id: 'RPT_BULLETIN', 
        name: '📄 Boletines', 
        description: 'Boletines parciales y finales',
        subFeatures: [
          { id: 'RPT_BULLETIN_PARTIAL', name: 'Boletines parciales', description: 'De período' },
          { id: 'RPT_BULLETIN_FINAL', name: 'Boletines finales', description: 'De fin de año' },
          { id: 'RPT_BULLETIN_PROMOTED', name: 'Estudiantes promovidos', description: 'Listado promovidos' },
          { id: 'RPT_BULLETIN_NOT_PROMOTED', name: 'No promovidos', description: 'Listado reprobados' },
          { id: 'RPT_BULLETIN_RECOVERY', name: 'En recuperación', description: 'Con actividades pendientes' },
        ]
      },
      // Categoría: Estadísticas (3 reportes)
      { 
        id: 'RPT_STAT', 
        name: '📈 Estadísticas', 
        description: 'Alertas, promoción, indicadores',
        subFeatures: [
          { id: 'RPT_STAT_LOW_PERF', name: 'Bajo rendimiento', description: 'Promedio bajo' },
          { id: 'RPT_STAT_FAIL_RISK', name: 'Riesgo reprobación', description: 'En riesgo de perder' },
          { id: 'RPT_STAT_ATTENDANCE', name: 'Inasistencia reiterada', description: 'Patrón de inasistencia' },
        ]
      },
      // Categoría: Configuración (6 reportes)
      { 
        id: 'RPT_CONFIG', 
        name: '⚙️ Configuración', 
        description: 'Áreas, asignaturas, períodos',
        subFeatures: [
          { id: 'RPT_CONFIG_AREAS', name: 'Áreas configuradas', description: 'Listado de áreas' },
          { id: 'RPT_CONFIG_SUBJECTS', name: 'Asignaturas', description: 'Por área' },
          { id: 'RPT_CONFIG_PERIODS', name: 'Períodos académicos', description: 'Configuración' },
          { id: 'RPT_CONFIG_SIEE', name: 'Porcentajes SIEE', description: 'Sistema evaluación' },
          { id: 'RPT_CONFIG_AUDIT', name: 'Cambios administrativos', description: 'Historial' },
          { id: 'RPT_CONFIG_ADJUSTMENTS', name: 'Historial ajustes', description: 'Correcciones' },
        ]
      },
      // Exportar (sin sub-features)
      { id: 'RPT_EXPORT', name: '⬇️ Exportar', description: 'Excel/PDF' },
    ]
  },
  { 
    id: 'COMMUNICATIONS', 
    name: 'Comunicaciones', 
    description: 'Mensajes y anuncios',
    features: [
      { id: 'COMM_MESSAGES', name: 'Mensajes', description: 'Enviar mensajes internos' },
      { id: 'COMM_ANNOUNCEMENTS', name: 'Anuncios', description: 'Publicar anuncios' },
      { id: 'COMM_NOTIFICATIONS', name: 'Notificaciones', description: 'Gestionar notificaciones' },
    ]
  },
  { 
    id: 'OBSERVER', 
    name: 'Observador', 
    description: 'Observador del estudiante',
    features: [
      { id: 'OBSERVER_VIEW', name: 'Ver Observador', description: 'Consultar observador' },
      { id: 'OBSERVER_REGISTER', name: 'Registrar', description: 'Agregar observaciones' },
      { id: 'OBSERVER_REPORTS', name: 'Reportes', description: 'Reportes del observador' },
    ]
  },
  { 
    id: 'PERFORMANCE', 
    name: 'Desempeños', 
    description: 'Indicadores de desempeño',
    features: [
      { id: 'PERF_VIEW', name: 'Ver Desempeños', description: 'Consultar desempeños' },
      { id: 'PERF_MANAGE', name: 'Gestionar', description: 'Crear y editar desempeños' },
      { id: 'PERF_REPORTS', name: 'Reportes', description: 'Reportes de desempeño' },
    ]
  },
  { 
    id: 'MEN_REPORTS', 
    name: 'Reportes MEN', 
    description: 'Reportes ministeriales',
    features: [
      { id: 'MEN_SIMAT', name: 'SIMAT', description: 'Exportar datos SIMAT' },
      { id: 'MEN_DANE', name: 'Formularios DANE', description: 'Generar formularios DANE' },
      { id: 'MEN_STATISTICS', name: 'Estadísticas MEN', description: 'Estadísticas oficiales' },
    ]
  },
  { 
    id: 'USERS', 
    name: 'Gestión de Usuarios', 
    description: 'Administración de usuarios',
    required: true,  // Obligatorio - gestión de personas
    features: [
      { id: 'USERS_TEACHERS', name: 'Docentes', description: 'Gestionar docentes' },
      { id: 'USERS_STUDENTS', name: 'Estudiantes', description: 'Gestionar estudiantes' },
      { id: 'USERS_PARENTS', name: 'Acudientes', description: 'Gestionar acudientes' },
      { id: 'USERS_IMPORT', name: 'Importar', description: 'Importar usuarios desde Excel' },
    ]
  },
  { 
    id: 'CONFIG', 
    name: 'Configuración', 
    description: 'Configuración institucional',
    required: true,  // Obligatorio - configuración base
    features: [
      { id: 'CONFIG_INSTITUTION', name: 'Institución', description: 'Datos de la institución' },
      { id: 'CONFIG_ACADEMIC', name: 'Académica', description: 'Configuración académica' },
      { id: 'CONFIG_GRADING', name: 'Calificaciones', description: 'Escala y componentes' },
      { id: 'CONFIG_PERIODS', name: 'Períodos', description: 'Configurar períodos' },
    ]
  },
]

// Tipo para permisos de institución (usado en el backend)
// interface InstitutionPermissions {
//   modules: string[]  // IDs de módulos habilitados
//   features: string[] // IDs de funcionalidades habilitadas
// }

export default function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [stats, setStats] = useState<SystemStats>({
    totalInstitutions: 0,
    activeInstitutions: 0,
    trialInstitutions: 0,
    suspendedInstitutions: 0,
    totalUsers: 0,
    totalStudents: 0,
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [showModulesModal, setShowModulesModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cargar datos al montar el componente
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, institutionsRes] = await Promise.all([
        superadminApi.getStats(),
        superadminApi.getAllInstitutions(),
      ])
      
      setStats(statsRes.data || {
        totalInstitutions: 0,
        activeInstitutions: 0,
        trialInstitutions: 0,
        suspendedInstitutions: 0,
        totalUsers: 0,
        totalStudents: 0,
      })
      
      // Mapear datos del backend
      const mappedInstitutions = (institutionsRes.data || []).map((inst: any) => {
        // Extraer módulos y features de la estructura del backend
        // inst.modules es un array de { module: string, features: string[], isActive: boolean }
        const moduleIds = (inst.modules || [])
          .filter((m: any) => m.isActive)
          .map((m: any) => m.module)
        const featureIds = (inst.modules || [])
          .filter((m: any) => m.isActive)
          .flatMap((m: any) => m.features || [])
        
        return {
          id: inst.id,
          name: inst.name,
          slug: inst.slug || '',
          daneCode: inst.daneCode,
          nit: inst.nit,
          address: inst.address,
          phone: inst.phone,
          email: inst.email,
          website: inst.website,
          status: inst.status || 'INACTIVE',
          trialEndsAt: inst.trialEndsAt,
          modules: [...new Set(moduleIds)],  // Sin duplicados
          features: [...new Set(featureIds)],  // Sin duplicados
          adminEmail: inst.adminEmail || inst.createdBy?.email || '',
          adminName: inst.adminName || (inst.createdBy ? `${inst.createdBy.firstName} ${inst.createdBy.lastName}` : ''),
          studentsCount: inst._count?.students || inst.studentsCount || 0,
          campusesCount: inst._count?.campuses || inst.campusesCount || 0,
          createdAt: inst.createdAt,
        }
      })
      
      setInstitutions(mappedInstitutions)
    } catch (err: any) {
      console.error('Error loading data:', err)
      setError(err.response?.data?.message || 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar instituciones
  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inst.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Estado badge
  const getStatusBadge = (status: Institution['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Activa
          </span>
        )
      case 'TRIAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3" />
            Prueba
          </span>
        )
      case 'SUSPENDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Suspendida
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            Inactiva
          </span>
        )
    }
  }

  // Toggle estado
  const toggleInstitutionStatus = async (id: string, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    try {
      if (newStatus === 'ACTIVE') {
        await superadminApi.activateInstitution(id)
      } else {
        await superadminApi.suspendInstitution(id)
      }
      
      setInstitutions(prev =>
        prev.map(inst =>
          inst.id === id ? { ...inst, status: newStatus } : inst
        )
      )
    } catch (err: any) {
      console.error('Error updating institution status:', err)
      alert(err.response?.data?.message || 'Error al actualizar estado')
    }
    setActiveMenu(null)
  }

  // Mostrar loading
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Cargando datos del sistema...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button onClick={loadData} className="ml-auto text-red-600 hover:text-red-800">
            Reintentar
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Instituciones</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalInstitutions}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="text-green-600">{stats.activeInstitutions} activas</span>
              <span className="text-blue-600">{stats.trialInstitutions} en prueba</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Usuarios</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Docentes, administrativos y directivos
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Estudiantes</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalStudents.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              En todas las instituciones
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Suspendidas</p>
                <p className="text-2xl font-bold text-red-600">{stats.suspendedInstitutions}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Requieren atención
            </div>
          </div>
      </div>

      {/* Institutions List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Instituciones</h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Institución
              </button>
            </div>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="overflow-visible">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Institución
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Admin/Rector
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Módulos
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Estudiantes
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInstitutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div>
                        <div className="font-medium text-slate-900">{inst.name}</div>
                        <div className="text-sm text-slate-500">/{inst.slug}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(inst.status)}
                      {inst.status === 'TRIAL' && inst.trialEndsAt && (
                        <div className="text-xs text-slate-400 mt-1">
                          Vence: {new Date(inst.trialEndsAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-900">{inst.adminName}</div>
                      <div className="text-xs text-slate-500">{inst.adminEmail}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600">{inst.modules.length} módulos</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-slate-900">{inst.studentsCount.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === inst.id ? null : inst.id)}
                          className="p-2 hover:bg-slate-100 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-500" />
                        </button>
                        
                        {activeMenu === inst.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                            <button
                              onClick={() => {
                                setSelectedInstitution(inst)
                                setActiveMenu(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="w-4 h-4" />
                              Ver detalles
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInstitution(inst)
                                setShowEditModal(true)
                                setActiveMenu(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Edit className="w-4 h-4" />
                              Editar institución
                            </button>
                            <button
                              onClick={() => {
                                setSelectedInstitution(inst)
                                setShowModulesModal(true)
                                setActiveMenu(null)
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              <Settings className="w-4 h-4" />
                              Módulos y funcionalidades
                            </button>
                            <hr className="my-1" />
                            {inst.status === 'ACTIVE' || inst.status === 'TRIAL' ? (
                              <button
                                onClick={() => toggleInstitutionStatus(inst.id, 'SUSPENDED')}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <Power className="w-4 h-4" />
                                Suspender
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleInstitutionStatus(inst.id, 'ACTIVE')}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                              >
                                <Power className="w-4 h-4" />
                                Activar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {/* Modal: Crear Institución */}
      {showCreateModal && (
        <CreateInstitutionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(newInst) => {
            setInstitutions(prev => [newInst, ...prev])
            setShowCreateModal(false)
          }}
        />
      )}

      {/* Modal: Editar Institución */}
      {showEditModal && selectedInstitution && (
        <EditInstitutionModal
          institution={selectedInstitution}
          onClose={() => {
            setShowEditModal(false)
            setSelectedInstitution(null)
          }}
          onSave={(data) => {
            setInstitutions(prev =>
              prev.map(inst =>
                inst.id === selectedInstitution.id ? { ...inst, ...data } : inst
              )
            )
            setShowEditModal(false)
            setSelectedInstitution(null)
          }}
        />
      )}

      {/* Modal: Gestionar Módulos y Funcionalidades */}
      {showModulesModal && selectedInstitution && (
        <ModulesModal
          institution={selectedInstitution}
          onClose={() => {
            setShowModulesModal(false)
            setSelectedInstitution(null)
          }}
          onSave={(modules, features) => {
            setInstitutions(prev =>
              prev.map(inst =>
                inst.id === selectedInstitution.id ? { ...inst, modules, features } : inst
              )
            )
            setShowModulesModal(false)
            setSelectedInstitution(null)
          }}
        />
      )}
    </div>
  )
}

// Modal: Crear Institución
function CreateInstitutionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (inst: Institution) => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    daneCode: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    modules: ['ACADEMIC', 'DASHBOARD'] as string[],
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Llamar al API real
      const response = await superadminApi.createInstitution({
        name: formData.name,
        slug: formData.slug,
        daneCode: formData.daneCode || undefined,
        adminFirstName: formData.adminFirstName,
        adminLastName: formData.adminLastName,
        adminEmail: formData.adminEmail,
        modules: formData.modules,
      })

      const newInst: Institution = {
        id: response.data?.id || `inst-${Date.now()}`,
        name: formData.name,
        slug: formData.slug,
        daneCode: formData.daneCode || undefined,
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        modules: formData.modules,
        features: [], // Se configuran después
        adminEmail: formData.adminEmail,
        adminName: `${formData.adminFirstName} ${formData.adminLastName}`,
        studentsCount: 0,
        campusesCount: 0,
        createdAt: new Date().toISOString(),
      }

      onCreated(newInst)
    } catch (err: any) {
      console.error('Error creating institution:', err)
      alert(err.response?.data?.message || 'Error al crear institución')
    } finally {
      setLoading(false)
    }
  }

  const toggleModule = (moduleId: string) => {
    setFormData(prev => ({
      ...prev,
      modules: prev.modules.includes(moduleId)
        ? prev.modules.filter(m => m !== moduleId)
        : [...prev.modules, moduleId],
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Nueva Institución</h2>
          <p className="text-sm text-slate-500 mt-1">
            Crea una nueva institución y asigna su administrador
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Datos de la institución */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Datos de la Institución</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Colegio San José"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Slug (URL) *</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="colegio-san-jose"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Código DANE</label>
                <input
                  type="text"
                  value={formData.daneCode}
                  onChange={(e) => setFormData({ ...formData, daneCode: e.target.value })}
                  placeholder="123456789"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Datos del Admin */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Administrador / Rector(a)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.adminFirstName}
                  onChange={(e) => setFormData({ ...formData, adminFirstName: e.target.value })}
                  placeholder="María"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Apellido *</label>
                <input
                  type="text"
                  value={formData.adminLastName}
                  onChange={(e) => setFormData({ ...formData, adminLastName: e.target.value })}
                  placeholder="García"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-600 mb-1">Correo electrónico *</label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  placeholder="rector@colegio.edu.co"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Se enviará una contraseña temporal a este correo
                </p>
              </div>
            </div>
          </div>

          {/* Módulos */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Módulos Habilitados</h3>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_MODULES.map((module) => (
                <label
                  key={module.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.modules.includes(module.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.modules.includes(module.id)}
                    onChange={() => toggleModule(module.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{module.name}</div>
                    <div className="text-xs text-slate-500">{module.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creando...' : 'Crear Institución'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal: Editar Institución
function EditInstitutionModal({
  institution,
  onClose,
  onSave,
}: {
  institution: Institution
  onClose: () => void
  onSave: (data: Partial<Institution>) => void
}) {
  const [formData, setFormData] = useState({
    name: institution.name,
    slug: institution.slug,
    daneCode: institution.daneCode || '',
    nit: institution.nit || '',
    address: institution.address || '',
    phone: institution.phone || '',
    email: institution.email || '',
    website: institution.website || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await superadminApi.updateInstitution(institution.id, formData)
      onSave(formData)
    } catch (err: any) {
      console.error('Error updating institution:', err)
      alert(err.response?.data?.message || 'Error al actualizar institución')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Editar Institución</h2>
          <p className="text-sm text-slate-500 mt-1">{institution.name}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL)</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código DANE</label>
              <input
                type="text"
                value={formData.daneCode}
                onChange={(e) => setFormData({ ...formData, daneCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
              <input
                type="text"
                value={formData.nit}
                onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sitio Web</label>
              <input
                type="text"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Modal: Gestionar Módulos y Funcionalidades
function ModulesModal({
  institution,
  onClose,
  onSave,
}: {
  institution: Institution
  onClose: () => void
  onSave: (modules: string[], features: string[]) => void
}) {
  // Eliminar duplicados del estado inicial
  const [selectedModules, setSelectedModules] = useState<string[]>(() => 
    [...new Set(institution.modules || [])]
  )
  // Si no hay features guardadas pero hay módulos, inicializar con todas las features de esos módulos
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(() => {
    const savedFeatures = [...new Set(institution.features || [])]
    if (savedFeatures.length > 0) return savedFeatures
    
    // Si no hay features guardadas, activar todas las features de los módulos activos
    const modulesArray = [...new Set(institution.modules || [])]
    const allFeatures: string[] = []
    modulesArray.forEach(moduleId => {
      const module = AVAILABLE_MODULES.find(m => m.id === moduleId)
      if (module) {
        module.features.forEach(f => {
          allFeatures.push(f.id)
          // También agregar sub-features si existen
          if (f.subFeatures) {
            allFeatures.push(...f.subFeatures.map(sf => sf.id))
          }
        })
      }
    })
    return allFeatures
  })
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [expandedSubFeature, setExpandedSubFeature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const toggleModule = (moduleId: string) => {
    const module = AVAILABLE_MODULES.find(m => m.id === moduleId)
    if (!module) return

    // No permitir desactivar módulos obligatorios
    if (module.required && selectedModules.includes(moduleId)) return

    // Obtener todas las features y sub-features del módulo
    const getAllFeatureIds = () => {
      const ids: string[] = []
      module.features.forEach(f => {
        ids.push(f.id)
        if (f.subFeatures) {
          ids.push(...f.subFeatures.map(sf => sf.id))
        }
      })
      return ids
    }

    if (selectedModules.includes(moduleId)) {
      // Desactivar módulo y todas sus funcionalidades
      const allFeatureIds = getAllFeatureIds()
      setSelectedModules(prev => prev.filter(m => m !== moduleId))
      setSelectedFeatures(prev => prev.filter(f => !allFeatureIds.includes(f)))
    } else {
      // Activar módulo con todas sus funcionalidades por defecto (sin duplicados)
      setSelectedModules(prev => [...new Set([...prev, moduleId])])
      const newFeatures = getAllFeatureIds()
      setSelectedFeatures(prev => [...new Set([...prev, ...newFeatures])])
    }
  }

  const toggleFeature = (featureId: string, moduleId: string) => {
    if (!selectedModules.includes(moduleId)) return // No permitir si el módulo está desactivado
    
    setSelectedFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(f => f !== featureId)
        : [...prev, featureId]
    )
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Asegurar que solo se envíen módulos únicos (sin duplicados)
      const uniqueModules = [...new Set(selectedModules)]
      const uniqueFeatures = [...new Set(selectedFeatures)]
      
      await superadminApi.updateInstitutionModules(institution.id, uniqueModules, uniqueFeatures)
      onSave(uniqueModules, uniqueFeatures)
    } catch (err: any) {
      console.error('Error updating modules:', err)
      alert(err.response?.data?.message || 'Error al actualizar módulos')
    } finally {
      setLoading(false)
    }
  }

  const getModuleFeatureCount = (moduleId: string) => {
    const module = AVAILABLE_MODULES.find(m => m.id === moduleId)
    if (!module) return { enabled: 0, total: 0 }
    
    // Contar features y sub-features
    let total = 0
    let enabled = 0
    
    module.features.forEach(f => {
      if (f.subFeatures && f.subFeatures.length > 0) {
        // Categoría con sub-features: contar la categoría + sub-features
        total += 1 + f.subFeatures.length
        if (selectedFeatures.includes(f.id)) enabled++
        enabled += f.subFeatures.filter(sf => selectedFeatures.includes(sf.id)).length
      } else {
        // Feature simple
        total++
        if (selectedFeatures.includes(f.id)) enabled++
      }
    })
    
    return { enabled, total }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Módulos y Funcionalidades</h2>
          <p className="text-sm text-slate-500 mt-1">{institution.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {AVAILABLE_MODULES.map((module) => {
              const isModuleEnabled = selectedModules.includes(module.id)
              const isExpanded = expandedModule === module.id
              const { enabled, total } = getModuleFeatureCount(module.id)
              const isRequired = module.required

              return (
                <div key={module.id} className={`border rounded-lg ${isModuleEnabled ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'} ${isRequired ? 'ring-1 ring-green-200' : ''}`}>
                  {/* Cabecera del módulo */}
                  <div className="flex items-center gap-3 p-4">
                    <input
                      type="checkbox"
                      checked={isModuleEnabled}
                      onChange={() => toggleModule(module.id)}
                      disabled={isRequired}
                      className={`w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 ${isRequired ? 'cursor-not-allowed opacity-60' : ''}`}
                    />
                    <div className="flex-1 cursor-pointer" onClick={() => setExpandedModule(isExpanded ? null : module.id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900 flex items-center gap-2">
                            {module.name}
                            {isRequired && (
                              <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Obligatorio</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">{module.description}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isModuleEnabled && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {enabled}/{total} funciones
                            </span>
                          )}
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Funcionalidades del módulo */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-white p-4">
                      <div className="space-y-2">
                        {module.features.map((feature) => {
                          const hasSubFeatures = feature.subFeatures && feature.subFeatures.length > 0
                          const isSubExpanded = expandedSubFeature === feature.id
                          const subFeaturesEnabled = hasSubFeatures 
                            ? feature.subFeatures!.filter(sf => selectedFeatures.includes(sf.id)).length
                            : 0
                          const totalSubFeatures = hasSubFeatures ? feature.subFeatures!.length : 0

                          if (hasSubFeatures) {
                            // Renderizar categoría con sub-features desplegables
                            return (
                              <div key={feature.id} className={`border rounded-lg ${selectedFeatures.includes(feature.id) ? 'border-green-300 bg-green-50/30' : 'border-slate-200'}`}>
                                <div className="flex items-center gap-2 p-3">
                                  <input
                                    type="checkbox"
                                    checked={selectedFeatures.includes(feature.id)}
                                    onChange={() => {
                                      if (!isModuleEnabled) return
                                      if (selectedFeatures.includes(feature.id)) {
                                        // Desactivar categoría y todas sus sub-features
                                        setSelectedFeatures(prev => prev.filter(f => 
                                          f !== feature.id && !feature.subFeatures!.some(sf => sf.id === f)
                                        ))
                                      } else {
                                        // Activar categoría y todas sus sub-features
                                        const allSubIds = feature.subFeatures!.map(sf => sf.id)
                                        setSelectedFeatures(prev => [...new Set([...prev, feature.id, ...allSubIds])])
                                      }
                                    }}
                                    disabled={!isModuleEnabled}
                                    className="w-4 h-4"
                                  />
                                  <div 
                                    className="flex-1 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedSubFeature(isSubExpanded ? null : feature.id)}
                                  >
                                    <div>
                                      <div className="text-sm font-medium text-slate-800">{feature.name}</div>
                                      <div className="text-xs text-slate-500">{feature.description}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                        {subFeaturesEnabled}/{totalSubFeatures}
                                      </span>
                                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                    </div>
                                  </div>
                                </div>
                                {/* Sub-features */}
                                {isSubExpanded && (
                                  <div className="border-t border-slate-200 bg-white p-3">
                                    <div className="grid grid-cols-2 gap-1">
                                      {feature.subFeatures!.map((subFeature) => (
                                        <label
                                          key={subFeature.id}
                                          className={`flex items-start gap-2 p-2 rounded text-sm cursor-pointer ${
                                            !isModuleEnabled || !selectedFeatures.includes(feature.id) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                                          } ${selectedFeatures.includes(subFeature.id) ? 'bg-green-50' : ''}`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedFeatures.includes(subFeature.id)}
                                            onChange={() => {
                                              if (!isModuleEnabled || !selectedFeatures.includes(feature.id)) return
                                              setSelectedFeatures(prev =>
                                                prev.includes(subFeature.id)
                                                  ? prev.filter(f => f !== subFeature.id)
                                                  : [...prev, subFeature.id]
                                              )
                                            }}
                                            disabled={!isModuleEnabled || !selectedFeatures.includes(feature.id)}
                                            className="mt-0.5"
                                          />
                                          <div>
                                            <div className="font-medium text-slate-700">{subFeature.name}</div>
                                            <div className="text-xs text-slate-500">{subFeature.description}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          } else {
                            // Renderizar feature simple (sin sub-features)
                            return (
                              <label
                                key={feature.id}
                                className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                                  !isModuleEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                                } ${selectedFeatures.includes(feature.id) ? 'bg-green-50' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedFeatures.includes(feature.id)}
                                  onChange={() => toggleFeature(feature.id, module.id)}
                                  disabled={!isModuleEnabled}
                                  className="mt-0.5"
                                />
                                <div>
                                  <div className="text-sm font-medium text-slate-800">{feature.name}</div>
                                  <div className="text-xs text-slate-500">{feature.description}</div>
                                </div>
                              </label>
                            )
                          }
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            {selectedModules.length} módulos • {selectedFeatures.length} funcionalidades
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
