import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Staff from './pages/Staff'
import Calendar from './pages/Calendar'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Checklist from './pages/Checklist'
import DailyRoutine from './pages/DailyRoutine'
import Incentives from './pages/Incentives'
import AuditLog from './pages/AuditLog'
import PatientRefillCenter from './pages/PatientRefillCenter'
import { ROUTE_ROLES } from './services/permissions'

function protectedPage(routeKey, element) {
  return (
    <ProtectedRoute roles={ROUTE_ROLES[routeKey]}>
      {element}
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={protectedPage('dashboard', <Dashboard />)} />
            <Route path="tasks"     element={protectedPage('tasks', <Tasks />)} />
            <Route path="checklist" element={protectedPage('checklist', <Checklist />)} />
            <Route path="daily-routine" element={protectedPage('dailyRoutine', <DailyRoutine />)} />
            <Route path="incentives" element={protectedPage('incentives', <Incentives />)} />
            <Route path="audit"     element={protectedPage('audit', <AuditLog />)} />
            <Route path="staff"     element={protectedPage('staff', <Staff />)} />
            <Route path="calendar"  element={protectedPage('calendar', <Calendar />)} />
            <Route path="reports"   element={protectedPage('reports', <Reports />)} />
            <Route path="settings"  element={protectedPage('settings', <Settings />)} />
            <Route path="patient-refill" element={protectedPage('patientRefill', <PatientRefillCenter />)} />
            <Route path="*"         element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
