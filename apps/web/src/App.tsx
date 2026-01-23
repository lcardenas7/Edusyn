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
import Institution from './pages/Institution'
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
import Layout from './components/Layout'

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
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/institution" element={<Institution />} />
                  <Route path="/students" element={<Students />} />
                  <Route path="/grades" element={<Grades />} />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/admin/areas" element={<AreasAdmin />} />
                  <Route path="/teachers" element={<Teachers />} />
                  <Route path="/academic-load" element={<AcademicLoad />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/observer" element={<Observer />} />
                  <Route path="/report-cards" element={<ReportCards />} />
                  <Route path="/communications" element={<Communications />} />
                  <Route path="/content-manager" element={<ContentManager />} />
                  <Route path="/period-final-grades" element={<PeriodFinalGrades />} />
                  <Route path="/recoveries" element={<Recoveries />} />
                  <Route path="/performances" element={<Performances />} />
                  <Route path="/admin/permissions" element={<PermissionsAdmin />} />
                  <Route path="/staff" element={<StaffManagement />} />
                  <Route path="/academic-year-wizard" element={<AcademicYearWizard />} />
                  <Route path="/enrollments" element={<Enrollments />} />
                  <Route path="/academic-year-closure" element={<AcademicYearClosure />} />
                  <Route path="/elections" element={<Elections />} />
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
