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
    <div className="min-h-screen surface-wash">
      <header className="glass sticky top-0 z-20 border-b border-slate-200/70">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-[0_4px_14px_-6px_rgba(37,99,235,0.7)]">
              <Bus size={19} className="text-white" />
            </div>
            <h1 className="text-base font-bold text-slate-800">بوابة الطالب</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-3 pb-24">
        <Outlet />
      </main>

      {/* Notification popups */}
      <AnimatePresence>
        {popups.map(p => (
          <NotificationPopup key={p._popupId} notification={p} />
        ))}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 z-10 px-3 pb-3">
        <div className="max-w-lg mx-auto glass border border-slate-200/80 rounded-2xl shadow-pop flex items-stretch px-1.5 py-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-slate-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`absolute inset-x-2 top-1.5 bottom-1.5 rounded-xl transition-all duration-200 ${
                    isActive ? 'gradient-primary shadow-[0_4px_14px_-6px_rgba(37,99,235,0.7)]' : 'opacity-0'
                  }`} />
                  <span className="relative flex items-center justify-center">
                    <item.icon size={20} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold min-w-[15px] h-3.5 flex items-center justify-center rounded-full px-1 shadow-sm">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <span className={`relative text-[10px] font-semibold mt-0.5 ${isActive ? 'text-white' : ''}`}>
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
