import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function AuthLayout() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) {
    return <Navigate to={`/${user.role}`} replace />
  }
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-primary-dark)]/10 flex items-center justify-center p-4"
      style={{
        '--color-primary': '#2563EB',
        '--color-primary-dark': '#1D4ED8',
        '--color-primary-light': '#60A5FA',
        '--color-primary-lighter': '#DBEAFE',
        '--color-accent': '#F97316',
        '--color-accent-dark': '#EA580C',
        '--color-accent-light': '#FB923C',
        '--color-accent-lighter': '#FED7AA',
        '--color-surface': '#FFFFFF',
      }}
    >
      <Outlet />
    </div>
  )
}
