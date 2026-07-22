import { AnimatePresence } from 'framer-motion'
import { NavLink, Outlet } from 'react-router-dom'
import { Home, CreditCard, Bell, Settings, Bus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import NotificationPopup from '../ui/NotificationPopup'

export default function StudentLayout() {
  const { unreadCount, popups } = useNotifications()

  const navItems = [
    { path: '/student', label: 'الرئيسية', icon: Home, end: true },
    { path: '/student/subscriptions', label: 'الاشتراكات', icon: CreditCard },
    { path: '/student/notifications', label: 'الإشعارات', icon: Bell, badge: unreadCount },
    { path: '/student/settings', label: 'الإعدادات', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--color-primary)]/5 to-[var(--color-primary-dark)]/5">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bus size={22} className="text-[var(--color-primary)]" />
            <h1 className="text-base font-bold text-slate-800">بوابة الطالب</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-3 pb-20">
        <Outlet />
      </main>

      {/* Notification popups */}
      <AnimatePresence>
        {popups.map(p => (
          <NotificationPopup key={p._popupId} notification={p} />
        ))}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-10">
        <div className="max-w-lg mx-auto flex justify-around items-center">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-col items-center py-1.5 px-3 min-h-[52px] justify-center transition-all ${
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon size={22} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-[var(--color-primary)]' : ''}`}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
