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

function App() {
  return (
    <AuthProvider>
      <InstitutionProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
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
