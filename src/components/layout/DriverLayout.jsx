import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import NotificationPopup from '../ui/NotificationPopup'
import NotificationCenter from '../ui/NotificationCenter'
import { LayoutDashboard, Bus, Settings, LogOut, Bell } from 'lucide-react'

const navItems = [
  { to: '/driver', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/driver/return', label: 'العودة', icon: Bus },
  { to: '/driver/settings', label: 'الإعدادات', icon: Settings },
]

export default function DriverLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { popups, unreadCount } = useNotifications()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const currentPage = navItems.find(i => i.to === location.pathname || (i.end && location.pathname === i.to))?.label || ''

  return (
    <div
      className="min-h-screen surface-wash flex"
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
      {/* Desktop sidebar */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-white shadow-lg transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} lg:block`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3 mb-2">
              <img src="/full-logo.svg" alt="شعار" className="w-16 h-16 object-contain" />

            
              <div>
                <p className="text-xs text-slate-500">تنسيقية مواصلات فلك</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">لوحة تحكم السائق</p>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 min-h-screen pb-16 lg:pb-0">
        {/* Mobile header */}
        <header className="bg-white shadow-sm px-3 py-2 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <img src="/full-logo.svg" alt="شعار" className="w-10 h-10 object-contain" />
            <span className="text-sm font-bold text-slate-800">{currentPage}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 flex lg:hidden safe-area-bottom">
          {navItems.map((item) => {
            const isActive = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-[var(--color-primary)]' : 'text-slate-400'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-[var(--color-primary)]' : ''} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="p-3 lg:p-6">
          <Outlet />
        </div>
        <AnimatePresence>
          {popups.map(p => (
            <NotificationPopup key={p._popupId} notification={p} />
          ))}
        </AnimatePresence>
      </main>
    </div>
  )
}
