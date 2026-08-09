import { useState, useCallback, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Onboarding from './components/Onboarding'
import AuthLayout from './components/layout/AuthLayout'
import AdminLayout from './components/layout/AdminLayout'
import DriverLayout from './components/layout/DriverLayout'
import StudentLayout from './components/layout/StudentLayout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ChangePassword from './pages/auth/ChangePassword'
import InstallPWAPopup from './components/ui/InstallPWAPopup'
import UpdateNotification from './components/ui/UpdateNotification'
import StudentHome from './pages/student/Home'
import StudentSubscriptions from './pages/student/Subscriptions'
import StudentNotifications from './pages/student/Notifications'
import StudentSettings from './pages/student/Settings'
import AdminDashboard from './pages/admin/Dashboard'
import AdminStudents from './pages/admin/Students'
import AdminStudentRequests from './pages/admin/StudentRequests'
import AdminBuses from './pages/admin/buses/Buses'
import BusDetails from './pages/admin/buses/BusDetails'
import AdminDailyOperation from './pages/admin/DailyOperation'
import OperationHistory from './pages/admin/OperationHistory'
import ReturnDispatchCenter from './pages/admin/ReturnDispatchCenter'
import DepartedTrips from './pages/admin/DepartedTrips'
import AdminDestinations from './pages/admin/Destinations'
import AdminSettings from './pages/admin/Settings'
import AdminTransfers from './pages/admin/Transfers'
import AdminSheets from './pages/admin/WeeklySheets'
import WeeklySheetPrint from './pages/admin/WeeklySheetPrint'
import WeeklySheetArchive from './pages/admin/WeeklySheetArchive'
import AdminAudit from './pages/admin/Audit'
import AdminUsers from './pages/admin/Users'
import AdminOperations from './pages/admin/Operations'
import SubscriptionsPage from './pages/admin/Subscriptions'
import DailySubscriptionManagement from './pages/admin/DailySubscriptionManagement'
import AdminReports from './pages/admin/Reports'
import AdminManage from './pages/admin/Manage'
import AdminControl from './pages/admin/Control'
import AdminSystemManagement from './pages/admin/SystemManagement'
import FinancialControl from './pages/admin/FinancialControl'
import EmergencyCenter from './pages/admin/EmergencyCenter'
import EmergencyBusDetail from './pages/admin/EmergencyBusDetail'
import DriverDashboard from './pages/driver/Dashboard'
import DriverReturnTrip from './pages/driver/ReturnTrip'
import DriverSettings from './pages/driver/Settings'
import Debug from './pages/Debug'

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary-dark)]/10"><div className="skeleton h-8 w-48 rounded-lg" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword && location.pathname !== '/settings/change-password') return <Navigate to="/settings/change-password" replace />
  const role = user.role
  if (allowedRole && role !== allowedRole) return <Navigate to={`/${role}`} replace />
  return children
}

function RoleRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/${user.role}`} replace />
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const onboardingSeen = localStorage.getItem('mashawerk_onboarding_seen')
    const token = localStorage.getItem('token')
    return !onboardingSeen && !token
  })

  const handleOnboardingComplete = useCallback(() => {
    localStorage.setItem('mashawerk_onboarding_seen', 'true')
    setShowOnboarding(false)
  }, [])

  const navigate = useNavigate()

  useEffect(() => {
    function handleServiceWorkerMessage(event) {
      if (!event.data || event.data.type !== 'SW_NAVIGATE' || !event.data.url) return
      const origin = window.location.origin
      if (!event.data.url.startsWith(origin)) return
      const path = event.data.url.slice(origin.length) || '/'
      navigate(path, { replace: false, state: { fromNotification: true } })
    }

    window.addEventListener('message', handleServiceWorkerMessage)
    return () => window.removeEventListener('message', handleServiceWorkerMessage)
  }, [navigate])

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route path="/debug" element={<Debug />} />

        <Route path="/settings/change-password" element={
          <ProtectedRoute><ChangePassword /></ProtectedRoute>
        } />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="student-requests" element={<AdminStudentRequests />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="buses" element={<AdminBuses />} />
          <Route path="buses/:id" element={<BusDetails />} />
          <Route path="operations" element={<AdminOperations />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<AdminDailyOperation />} />
            <Route path="history" element={<OperationHistory />} />
            <Route path="return" element={<ReturnDispatchCenter />} />
            <Route path="departed" element={<DepartedTrips />} />
          </Route>
          <Route path="subscriptions" element={<SubscriptionsPage />} />
          <Route path="subscriptions/daily" element={<DailySubscriptionManagement />} />
          <Route path="finance/pricing" element={<Navigate to="/admin/subscriptions?tab=pricing" replace />} />
          <Route path="finance/campaigns" element={<Navigate to="/admin/subscriptions?tab=campaigns" replace />} />
          <Route path="finance/approvals" element={<Navigate to="/admin/subscriptions?tab=approvals" replace />} />
          <Route path="finance" element={<Navigate to="/admin/subscriptions?tab=pricing" replace />} />
          <Route path="reports" element={<AdminReports />}>
            <Route index element={<Navigate to="weekly-sheets" replace />} />
            <Route path="weekly-sheets">
              <Route index element={<AdminSheets />} />
              <Route path=":id" element={<WeeklySheetPrint />} />
              <Route path=":id/print" element={<WeeklySheetPrint />} />
            </Route>
            <Route path="archive" element={<WeeklySheetArchive />} />
          </Route>
          <Route path="manage" element={<AdminManage />}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="system" element={<AdminSystemManagement />} />
          </Route>
          <Route path="control" element={<AdminControl />}>
            <Route index element={<Navigate to="transfers" replace />} />
            <Route path="transfers" element={<AdminTransfers />} />
            <Route path="audit" element={<AdminAudit />} />
          </Route>
          <Route path="emergency" element={<EmergencyCenter />} />
          <Route path="emergency/:busId" element={<EmergencyBusDetail />} />
          <Route path="financial-control" element={<FinancialControl />} />
          <Route path="destinations" element={<AdminDestinations />} />
          <Route path="system" element={<Navigate to="/admin/manage/system" replace />} />
          {/* Legacy admin aliases preserved for direct links */}
          <Route path="trips" element={<AdminDailyOperation />} />
          <Route path="operations-history" element={<OperationHistory />} />
          <Route path="return" element={<ReturnDispatchCenter />} />
          <Route path="departed" element={<DepartedTrips />} />
          <Route path="weekly-sheets" element={<AdminSheets />} />
          <Route path="weekly-sheets/:id/print" element={<WeeklySheetPrint />} />
          <Route path="weekly-sheets/:id" element={<WeeklySheetPrint />} />
          <Route path="weekly-sheets-archive" element={<WeeklySheetArchive />} />
          <Route path="transfers" element={<AdminTransfers />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRole="driver">
              <DriverLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DriverDashboard />} />
          <Route path="return" element={<DriverReturnTrip />} />
          <Route path="settings" element={<DriverSettings />} />
        </Route>

        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentHome />} />
          <Route path="subscriptions/*" element={<StudentSubscriptions />} />
          <Route path="notifications" element={<StudentNotifications />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>

        <Route path="*" element={<RoleRedirect />} />
      </Routes>
      <InstallPWAPopup />
      <UpdateNotification />
    </>
  )
}
