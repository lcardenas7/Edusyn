import { lazy, Suspense } from 'react'

// Entrada publica: eager a proposito, para que la primera pantalla no espere
// una descarga adicional.
import Login from './pages/Login'
import InstitutionLogin from './pages/InstitutionLogin'
import LandingPage from './pages/LandingPage'

import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { InstitutionProvider } from './contexts/InstitutionContext'
import { AcademicProvider } from './contexts/AcademicContext'
import Layout from './components/Layout'
import PlayLayout from './components/play/PlayLayout'
import { PlayAuthProvider, usePlayAuth } from './contexts/PlayAuthContext'

// Nuevas páginas por dominio (Refactor UX)

// Reportes modulares (Refactor UX)

// Módulo Financiero
import { DialogHost } from './components/ui/confirm'

// ── Rutas diferidas ────────────────────────────────────────────────────────
// Cada pagina se descarga cuando alguien entra en ella, no al abrir Edusyn.
// La entrada publica (portada y acceso) sigue siendo eager: hacerla diferida
// añadiria una vuelta de red antes de la primera pantalla.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Setup = lazy(() => import('./pages/Setup'))
const Students = lazy(() => import('./pages/Students'))
const Grades = lazy(() => import('./pages/Grades'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Statistics = lazy(() => import('./pages/Statistics'))
const Teachers = lazy(() => import('./pages/Teachers'))
const AcademicLoad = lazy(() => import('./pages/AcademicLoad'))
const Reports = lazy(() => import('./pages/Reports'))
const Observer = lazy(() => import('./pages/Observer'))
const ReportCards = lazy(() => import('./pages/ReportCards'))
const Communications = lazy(() => import('./pages/Communications'))
const ContentManager = lazy(() => import('./pages/ContentManager'))
const PeriodFinalGrades = lazy(() => import('./pages/PeriodFinalGrades'))
const Recoveries = lazy(() => import('./pages/Recoveries'))
const StaffLeave = lazy(() => import('./pages/StaffLeave'))
const ObserverStats = lazy(() => import('./pages/ObserverStats'))
const Performances = lazy(() => import('./pages/Performances'))
const Achievements = lazy(() => import('./pages/Achievements'))
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'))
const PermissionsAdmin = lazy(() => import('./pages/PermissionsAdmin'))
const StaffManagement = lazy(() => import('./pages/StaffManagement'))
const AcademicYearWizard = lazy(() => import('./pages/AcademicYearWizard'))
const Enrollments = lazy(() => import('./pages/Enrollments'))
const AcademicYearClosure = lazy(() => import('./pages/AcademicYearClosure'))
const VotingPortal = lazy(() => import('./pages/VotingPortal'))
const Elections = lazy(() => import('./pages/Elections'))
const ElectionResults = lazy(() => import('./pages/ElectionResults'))
const ConfiguracionInicial = lazy(() => import('./pages/ConfiguracionInicial'))
const InstitutionalDocuments = lazy(() => import('./pages/InstitutionalDocuments'))
const ManagementTasks = lazy(() => import('./pages/ManagementTasks'))
const AcademicCatalog = lazy(() => import('./pages/AcademicCatalog'))
const AcademicTemplates = lazy(() => import('./pages/AcademicTemplates'))
const PlanEstudiosWizard = lazy(() => import('./pages/PlanEstudiosWizard'))
const ForceChangePassword = lazy(() => import('./pages/ForceChangePassword'))
const PedagogicalSupport = lazy(() => import('./pages/PedagogicalSupport'))
const DifferentialSupport = lazy(() => import('./pages/DifferentialSupport'))
const GradesBulkImport = lazy(() => import('./pages/GradesBulkImport'))
const TeacherWorkspace = lazy(() => import('./pages/TeacherWorkspace'))
const WorkspaceV2Page = lazy(() => import('./pages/WorkspaceV2'))
const SpaceDetailPage = lazy(() => import('./pages/WorkspaceV2/SpaceDetail'))
const Classroom = lazy(() => import('./pages/Classroom'))
const AulaVirtual = lazy(() => import('./pages/aula'))
const Scale = lazy(() => import('./pages/academic/config/Scale'))
const Periods = lazy(() => import('./pages/academic/config/Periods'))
const Levels = lazy(() => import('./pages/academic/config/Levels'))
const GradingWindows = lazy(() => import('./pages/academic/config/windows/GradingWindows'))
const RecoveryWindows = lazy(() => import('./pages/academic/config/windows/RecoveryWindows'))
const Structure = lazy(() => import('./pages/institution/Structure'))
const Profile = lazy(() => import('./pages/institution/Profile'))
const InstitutionHub = lazy(() => import('./pages/InstitutionHub'))
const AcademicHub = lazy(() => import('./pages/AcademicHub'))
const ReportsHub = lazy(() => import('./pages/ReportsHub'))
const AdminReports = lazy(() => import('./pages/reports/AdminReports'))
const AcademicReports = lazy(() => import('./pages/reports/AcademicReports'))
const CommissionReports = lazy(() => import('./pages/reports/CommissionReports'))
const AttendanceReports = lazy(() => import('./pages/reports/AttendanceReports'))
const AlertsReports = lazy(() => import('./pages/reports/AlertsReports'))
const BulletinsReports = lazy(() => import('./pages/reports/BulletinsReports'))
const EvaluationReports = lazy(() => import('./pages/reports/EvaluationReports'))
const PreventiveCutReports = lazy(() => import('./pages/reports/PreventiveCutReports'))
const SystemConfig = lazy(() => import('./pages/admin/SystemConfig'))
const InstitutionalPortfolio = lazy(() => import('./pages/InstitutionalPortfolio'))
const Timetabling = lazy(() => import('./pages/Timetabling'))
const CapabilitiesConfig = lazy(() => import('./pages/CapabilitiesConfig'))
const EduLabFuga = lazy(() => import('./pages/edulab/FugaLaboratorio'))
const RegisterPlay = lazy(() => import('./pages/play').then((m) => ({ default: m.RegisterPlay })))
const LoginPlay = lazy(() => import('./pages/play').then((m) => ({ default: m.LoginPlay })))
const PlayDashboard = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayDashboard })))
const PlayQuizzes = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayQuizzes })))
const PlayQuizEditor = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayQuizEditor })))
const PlayLessons = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayLessons })))
const PlayLessonEditor = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayLessonEditor })))
const PlaySessions = lazy(() => import('./pages/play').then((m) => ({ default: m.PlaySessions })))
const JoinPage = lazy(() => import('./pages/play').then((m) => ({ default: m.JoinPage })))
const PlayProjector = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayProjector })))
const PlayLanding = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayLanding })))
const PlayMe = lazy(() => import('./pages/play').then((m) => ({ default: m.PlayMe })))
const FinanceHub = lazy(() => import('./pages/finance').then((m) => ({ default: m.FinanceHub })))
const FinanceDashboard = lazy(() => import('./pages/finance').then((m) => ({ default: m.FinanceDashboard })))
const ThirdParties = lazy(() => import('./pages/finance').then((m) => ({ default: m.ThirdParties })))
const ThirdPartyDetail = lazy(() => import('./pages/finance').then((m) => ({ default: m.ThirdPartyDetail })))
const Concepts = lazy(() => import('./pages/finance').then((m) => ({ default: m.Concepts })))
const Obligations = lazy(() => import('./pages/finance').then((m) => ({ default: m.Obligations })))
const ObligationDetail = lazy(() => import('./pages/finance').then((m) => ({ default: m.ObligationDetail })))
const Payments = lazy(() => import('./pages/finance').then((m) => ({ default: m.Payments })))
const Expenses = lazy(() => import('./pages/finance').then((m) => ({ default: m.Expenses })))
const Categories = lazy(() => import('./pages/finance').then((m) => ({ default: m.Categories })))
const Invoices = lazy(() => import('./pages/finance').then((m) => ({ default: m.Invoices })))
const FinanceReports = lazy(() => import('./pages/finance').then((m) => ({ default: m.FinanceReports })))
const FinanceSettings = lazy(() => import('./pages/finance').then((m) => ({ default: m.FinanceSettings })))
const NewInvoice = lazy(() => import('./pages/finance').then((m) => ({ default: m.NewInvoice })))
const NewObligation = lazy(() => import('./pages/finance').then((m) => ({ default: m.NewObligation })))
const NewThirdParty = lazy(() => import('./pages/finance').then((m) => ({ default: m.NewThirdParty })))
const NewConcept = lazy(() => import('./pages/finance').then((m) => ({ default: m.NewConcept })))


function ProtectedRoute({ children, allowChangePassword = false }: { children: React.ReactNode; allowChangePassword?: boolean }) {
  const { isAuthenticated, isLoading, mustChangePassword, user, institution } = useAuth()
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Skip forced password change for students if institution disabled it
  const isStudent = user?.roles?.some((r: any) => (r.role?.name || r) === 'ESTUDIANTE')
  const institutionBlocksStudentPwdChange = (institution as any)?.allowStudentPasswordChange === false

  if (mustChangePassword && !allowChangePassword && !(isStudent && institutionBlocksStudentPwdChange)) {
    return <Navigate to="/change-password" replace />
  }
  
  return <>{children}</>
}

/**
 * Ruta protegida SOLO para SuperAdmin
 * Verifica que el usuario tenga isSuperAdmin = true
 */
function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isSuperAdmin, user } = useAuth()
  
  // Debug log
  console.log('[SuperAdminRoute] Check:', { isAuthenticated, isLoading, isSuperAdmin, userEmail: user?.email })
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  
  if (!isAuthenticated) {
    console.log('[SuperAdminRoute] Not authenticated, redirecting to /login')
    return <Navigate to="/login" replace />
  }
  
  // Si no es SuperAdmin, redirigir al dashboard normal
  if (!isSuperAdmin) {
    console.log('[SuperAdminRoute] User is NOT SuperAdmin, redirecting to /')
    return <Navigate to="/" replace />
  }
  
  console.log('[SuperAdminRoute] Access granted - user is SuperAdmin')
  return <>{children}</>
}

function PlayProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = usePlayAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login-play" replace />
  return <>{children}</>
}

function PlayRoutes() {
  return (
    <PlayAuthProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400">Cargando…</div>}>
      <Routes>
        <Route path="/" element={<PlayProtectedRoute><PlayLayout><PlayDashboard /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/quizzes" element={<PlayProtectedRoute><PlayLayout><PlayQuizzes /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/quizzes/:quizId/edit" element={<PlayProtectedRoute><PlayLayout><PlayQuizEditor /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/lessons" element={<PlayProtectedRoute><PlayLayout><PlayLessons /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/lessons/:lessonId/edit" element={<PlayProtectedRoute><PlayLayout><PlayLessonEditor /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/sessions" element={<PlayProtectedRoute><PlayLayout><PlaySessions /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/me" element={<PlayProtectedRoute><PlayLayout><PlayMe /></PlayLayout></PlayProtectedRoute>} />
        <Route path="/projector/:sessionId" element={<PlayProtectedRoute><PlayProjector /></PlayProtectedRoute>} />
      </Routes>
      </Suspense>
    </PlayAuthProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={4500}
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
      <DialogHost />
      <InstitutionProvider>
      <AcademicProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center text-slate-400">Cargando…</div>}>
      <Routes>
        {/* Landing Page - Página principal pública */}
        <Route path="/" element={<LandingPage />} />

        {/* Login por institución (multi-tenant) */}
        <Route path="/login" element={<InstitutionLogin />} />
        <Route path="/login/:slug" element={<InstitutionLogin />} />
        <Route path="/auth/login" element={<Login />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* EDUSYN PLAY - Docentes personales + Invitados              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/play-landing" element={<PlayLanding />} />
        <Route path="/register-play" element={<PlayAuthProvider><RegisterPlay /></PlayAuthProvider>} />
        <Route path="/login-play" element={<PlayAuthProvider><LoginPlay /></PlayAuthProvider>} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<JoinPage />} />
        <Route path="/play/*" element={<PlayRoutes />} />

        {/* EduLab: experiencia inmersiva aislada del shell y cargada bajo demanda. */}
        <Route path="/edulab/fuga" element={<ProtectedRoute><EduLabFuga /></ProtectedRoute>} />
        
        {/* Cambio obligatorio de contraseña */}
        <Route
          path="/change-password"
          element={
            <ProtectedRoute allowChangePassword>
              <ForceChangePassword />
            </ProtectedRoute>
          }
        />
        
        {/* Portal de Votación - Ruta especial sin Layout para estudiantes */}
        <Route
          path="/votar"
          element={
            <ProtectedRoute>
              <VotingPortal />
            </ProtectedRoute>
          }
        />
        
        {/* Resultados en tiempo real - Sin Layout para pantalla completa */}
        <Route
          path="/resultados-elecciones"
          element={
            <ProtectedRoute>
              <ElectionResults />
            </ProtectedRoute>
          }
        />
        
        {/* SuperAdmin con Layout - SOLO usuarios con isSuperAdmin=true */}
        <Route
          path="/superadmin/*"
          element={
            <SuperAdminRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<SuperAdminDashboard />} />
                  <Route path="/institutions" element={<SuperAdminDashboard />} />
                  <Route path="/institutions/new" element={<SuperAdminDashboard />} />
                  <Route path="/configs" element={<SuperAdminDashboard />} />
                  <Route path="/audit-logs" element={<SuperAdminDashboard />} />
                  <Route path="/user-activity" element={<SuperAdminDashboard />} />
                  <Route path="/recalculate" element={<SuperAdminDashboard />} />
                  <Route path="/clone-config" element={<SuperAdminDashboard />} />
                  <Route path="/portfolio" element={<InstitutionalPortfolio />} />
                </Routes>
              </Layout>
            </SuperAdminRoute>
          }
        />
        <Route path="/superadmin/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/configuracion-inicial" element={<ConfiguracionInicial />} />
                  <Route path="/setup" element={<Setup />} />
                  <Route path="/institution" element={<InstitutionHub />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/grades" element={<Grades />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/teachers" element={<Teachers />} />
                  <Route path="/academic-load" element={<AcademicLoad />} />
                  <Route path="/reports" element={<ReportsHub />} />
                  <Route path="/reports/admin" element={<AdminReports />} />
                  <Route path="/reports/academic" element={<AcademicReports />} />
                  <Route path="/reports/commission" element={<CommissionReports />} />
                  <Route path="/reports/attendance" element={<AttendanceReports />} />
                  <Route path="/reports/alerts" element={<AlertsReports />} />
                  <Route path="/reports/preventive-cut" element={<PreventiveCutReports />} />
                  <Route path="/reports/bulletins" element={<BulletinsReports />} />
                  <Route path="/reports/evaluation" element={<EvaluationReports />} />
                  <Route path="/admin/system" element={<SystemConfig />} />
                  {/* Legacy route - mantiene compatibilidad */}
                  <Route path="/reports-legacy" element={<Reports />} />
                  <Route path="/observer" element={<Observer />} />
                  <Route path="/report-cards" element={<ReportCards />} />
                  <Route path="/communications" element={<Communications />} />
                  <Route path="/content-manager" element={<ContentManager />} />
                  <Route path="/period-final-grades" element={<PeriodFinalGrades />} />
                  <Route path="/recoveries" element={<Recoveries />} />
                  <Route path="/staff-leave" element={<StaffLeave />} />
                  <Route path="/observer-stats" element={<ObserverStats />} />
                  <Route path="/performances" element={<Performances />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/admin/permissions" element={<PermissionsAdmin />} />
                  <Route path="/staff" element={<StaffManagement />} />
                  <Route path="/academic-year-wizard" element={<AcademicYearWizard />} />
                  <Route path="/enrollments" element={<Enrollments />} />
                  <Route path="/academic-year-closure" element={<AcademicYearClosure />} />
                  <Route path="/elections" element={<Elections />} />
                  <Route path="/institutional-documents" element={<InstitutionalDocuments />} />
                  <Route path="/management-tasks" element={<ManagementTasks />} />
                  <Route path="/academic-catalog" element={<AcademicCatalog />} />
                  <Route path="/academic-templates" element={<AcademicTemplates />} />
                  
                  {/* ═══════════════════════════════════════════════════════════ */}
                  {/* NUEVAS RUTAS - Refactor UX por Dominios                     */}
                  {/* ═══════════════════════════════════════════════════════════ */}
                  
                  {/* Académico - Hub principal */}
                  <Route path="/academic" element={<AcademicHub />} />
                  
                  {/* Académico > Configuración SIEE */}
                  <Route path="/academic/config/scale" element={<Scale />} />
                  <Route path="/academic/config/periods" element={<Periods />} />
                  <Route path="/academic/config/levels" element={<Levels />} />
                  <Route path="/academic/config/windows/grading" element={<GradingWindows />} />
                  <Route path="/academic/config/windows/recovery" element={<RecoveryWindows />} />
                  
                  {/* Institución */}
                  <Route path="/institution/profile" element={<Profile />} />
                  <Route path="/institution/structure" element={<Structure />} />
                  
                  <Route path="/academic/plan-wizard" element={<PlanEstudiosWizard />} />

                  {/* Rutas alias para nueva estructura (mantienen compatibilidad) */}
                  <Route path="/academic/catalog" element={<AcademicCatalog />} />
                  <Route path="/academic/templates" element={<AcademicTemplates />} />
                  <Route path="/academic/assignments" element={<AcademicLoad />} />
                  <Route path="/academic/year/setup" element={<AcademicYearWizard />} />
                  <Route path="/academic/year/closure" element={<AcademicYearClosure />} />
                  
                  {/* Gestión Estudiantil */}
                  <Route path="/students/enrollments" element={<Enrollments />} />
                  <Route path="/students/grades" element={<Grades />} />
                  <Route path="/students/attendance" element={<Attendance />} />
                  <Route path="/students/observer" element={<Observer />} />
                  <Route path="/students/achievements" element={<Achievements />} />
                  <Route path="/students/performances" element={<Performances />} />
                  <Route path="/students/alerts" element={<Alerts />} />
                  <Route path="/students/period-closure" element={<PeriodFinalGrades />} />
                  <Route path="/students/recoveries" element={<Recoveries />} />
                  <Route path="/students/pedagogical-support" element={<PedagogicalSupport />} />
                  <Route path="/pedagogical-support" element={<PedagogicalSupport />} />
                  <Route path="/differential-support" element={<DifferentialSupport />} />
                  
                  {/* ═══════════════════════════════════════════════════════════ */}
                  {/* IMPORTACIÓN MASIVA DE NOTAS (Solo Rector)                    */}
                  {/* ═══════════════════════════════════════════════════════════ */}
                  <Route path="/admin/grades-import" element={<GradesBulkImport />} />
                  
                  {/* ═══════════════════════════════════════════════════════════ */}
                  {/* MÓDULO FINANCIERO                                            */}
                  {/* ═══════════════════════════════════════════════════════════ */}
                  <Route path="/finance" element={<FinanceDashboard />} />
                  <Route path="/finance/dashboard" element={<FinanceDashboard />} />
                  <Route path="/finance/hub" element={<FinanceHub />} />
                  <Route path="/finance/third-parties" element={<ThirdParties />} />
                  <Route path="/finance/third-parties/new" element={<NewThirdParty />} />
                  <Route path="/finance/third-parties/:id" element={<ThirdPartyDetail />} />
                  <Route path="/finance/concepts" element={<Concepts />} />
                  <Route path="/finance/concepts/new" element={<NewConcept />} />
                  <Route path="/finance/concepts/:id/edit" element={<NewConcept />} />
                  <Route path="/finance/obligations" element={<Obligations />} />
                  <Route path="/finance/obligations/new" element={<NewObligation />} />
                  <Route path="/finance/obligations/:id" element={<ObligationDetail />} />
                  <Route path="/finance/payments" element={<Payments />} />
                  <Route path="/finance/expenses" element={<Expenses />} />
                  <Route path="/finance/categories" element={<Categories />} />
                  <Route path="/finance/invoices" element={<Invoices />} />
                  <Route path="/finance/invoices/new" element={<NewInvoice />} />
                  <Route path="/finance/reports" element={<FinanceReports />} />
                  <Route path="/finance/settings" element={<FinanceSettings />} />
                  
                  {/* ═══════════════════════════════════════════════════════════ */}
                  {/* MÓDULO DE TIMETABLING (HORARIOS)                            */}
                  {/* ═══════════════════════════════════════════════════════════ */}
                  <Route path="/timetabling" element={<Timetabling />} />
                  {/* Mi Espacio V2 es ahora la versión principal en /my-workspace.
                      La versión clásica queda escondida en /my-workspace-classic
                      como respaldo. /my-workspace-v2 se mantiene como alias. */}
                  <Route path="/my-workspace" element={<WorkspaceV2Page />} />
                  <Route path="/my-workspace/:boardId" element={<SpaceDetailPage />} />
                  <Route path="/my-workspace-classic" element={<TeacherWorkspace />} />
                  <Route path="/my-workspace-v2" element={<WorkspaceV2Page />} />
                  <Route path="/my-workspace-v2/:boardId" element={<SpaceDetailPage />} />
                  {/* El Aula Virtual rediseñada (docs/REDISENO_AULA_VIRTUAL.md) es ya la
                      predeterminada. Las direcciones antiguas apuntan a ella para que los
                      enlaces guardados y los avisos ya enviados sigan funcionando.

                      El aula anterior NO se retira: vive en /aula-clasica, sigue siendo el
                      respaldo y además el aula nueva reutiliza cuatro de sus pestañas
                      (ver HerramientasAula). Cambiar entre una y otra no escribe nada. */}
                  {/* Redirección, no render: si /classroom siguiera dibujando el aula nueva, la
                      barra de direcciones diría una cosa y la pantalla otra, y un enlace copiado
                      desde ahí perpetuaría la ruta vieja. Con `replace` no queda en el historial,
                      así que el botón "atrás" no rebota entre la ruta vieja y la nueva. */}
                  <Route path="/classroom" element={<Navigate to="/aula" replace />} />
                  <Route path="/my-classes" element={<Navigate to="/aula" replace />} />
                  <Route path="/aula-clasica" element={<Classroom />} />
                  <Route path="/aula" element={<AulaVirtual />} />
                  <Route path="/aula/:classroomId" element={<AulaVirtual />} />
                  <Route path="/aula/:classroomId/:vista" element={<AulaVirtual />} />
                  <Route path="/aula/:classroomId/actividades/:activityId" element={<AulaVirtual />} />
                  <Route path="/capabilities-config" element={<CapabilitiesConfig />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
      </AcademicProvider>
      </InstitutionProvider>
    </AuthProvider>
  )
}

export default App
