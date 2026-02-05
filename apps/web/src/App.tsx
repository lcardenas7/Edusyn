import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { InstitutionProvider } from './contexts/InstitutionContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Grades from './pages/Grades'
import Attendance from './pages/Attendance'
import Alerts from './pages/Alerts'
import Statistics from './pages/Statistics'
import AreasAdmin from './pages/AreasAdmin'
import Teachers from './pages/Teachers'
import AcademicLoad from './pages/AcademicLoad'
import Reports from './pages/Reports'
import Observer from './pages/Observer'
import ReportCards from './pages/ReportCards'
import Communications from './pages/Communications'
import ContentManager from './pages/ContentManager'
import PeriodFinalGrades from './pages/PeriodFinalGrades'
import Recoveries from './pages/Recoveries'
import Performances from './pages/Performances'
import Achievements from './pages/Achievements'
import InstitutionLogin from './pages/InstitutionLogin'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import PermissionsAdmin from './pages/PermissionsAdmin'
import StaffManagement from './pages/StaffManagement'
import AcademicYearWizard from './pages/AcademicYearWizard'
import Enrollments from './pages/Enrollments'
import AcademicYearClosure from './pages/AcademicYearClosure'
import VotingPortal from './pages/VotingPortal'
import Elections from './pages/Elections'
import ElectionResults from './pages/ElectionResults'
import LandingPage from './pages/LandingPage'
import InstitutionalDocuments from './pages/InstitutionalDocuments'
import ManagementTasks from './pages/ManagementTasks'
import AcademicCatalog from './pages/AcademicCatalog'
import AcademicTemplates from './pages/AcademicTemplates'
import Layout from './components/Layout'

// Nuevas páginas por dominio (Refactor UX)
import Scale from './pages/academic/config/Scale'
import Periods from './pages/academic/config/Periods'
import Levels from './pages/academic/config/Levels'
import GradingWindows from './pages/academic/config/windows/GradingWindows'
import RecoveryWindows from './pages/academic/config/windows/RecoveryWindows'
import Structure from './pages/institution/Structure'
import Profile from './pages/institution/Profile'
import InstitutionHub from './pages/InstitutionHub'
import AcademicHub from './pages/AcademicHub'

// Reportes modulares (Refactor UX)
import ReportsHub from './pages/ReportsHub'
import AdminReports from './pages/reports/AdminReports'
import AcademicReports from './pages/reports/AcademicReports'
import AttendanceReports from './pages/reports/AttendanceReports'
import AlertsReports from './pages/reports/AlertsReports'
import BulletinsReports from './pages/reports/BulletinsReports'
import EvaluationReports from './pages/reports/EvaluationReports'
import SystemConfig from './pages/admin/SystemConfig'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
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

function App() {
  return (
    <AuthProvider>
      <InstitutionProvider>
      <Routes>
        {/* Landing Page - Página principal pública */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Login por institución (multi-tenant) */}
        <Route path="/login" element={<InstitutionLogin />} />
        <Route path="/login/:slug" element={<InstitutionLogin />} />
        <Route path="/auth/login" element={<Login />} />
        
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
                  <Route path="/institution" element={<InstitutionHub />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/grades" element={<Grades />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/admin/areas" element={<AreasAdmin />} />
                  <Route path="/teachers" element={<Teachers />} />
                  <Route path="/academic-load" element={<AcademicLoad />} />
                  <Route path="/reports" element={<ReportsHub />} />
                  <Route path="/reports/admin" element={<AdminReports />} />
                  <Route path="/reports/academic" element={<AcademicReports />} />
                  <Route path="/reports/attendance" element={<AttendanceReports />} />
                  <Route path="/reports/alerts" element={<AlertsReports />} />
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
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      </InstitutionProvider>
    </AuthProvider>
  )
}

export default App
