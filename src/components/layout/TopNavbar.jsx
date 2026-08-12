import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Bell, Menu, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import GlobalSearch from '../ui/GlobalSearch'
import NotificationCenter from '../ui/NotificationCenter'

const pageTitles = {
  '/admin/students': 'الطلاب',
  '/admin/buses': 'الحافلات',
  '/admin/operations/today': 'تشغيل اليوم',
  '/admin/operations/history': 'سجل التشغيل',
  '/admin/operations/return': 'الرجوع',
  '/admin/operations/departed': 'المنطلقات',
  '/admin/reports/weekly-sheets': 'الكشوف الأسبوعية',
  '/admin/financial-control': 'الإدارة المالية',
  '/admin/manage/users': 'المستخدمين',
  '/admin/manage/settings': 'الإعدادات',
  '/admin/manage/system': 'إدارة النظام',
  '/admin/subscriptions': 'الاشتراكات',
  '/admin': 'لوحة التحكم',
}

export default function TopNavbar({ onMenuToggle, unreadCount: _unreadCount }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [dateStr, setDateStr] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()

  useEffect(() => {
    const now = new Date()
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    setDateStr(now.toLocaleDateString('ar-SA', options))

    function handleOnline() { setOnline(true) }
    function handleOffline() { setOnline(false) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const currentTitle = Object.entries(pageTitles).find(([path]) =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] || ''

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ y: -30 }}
            animate={{ y: 0 }}
            exit={{ y: -30 }}
            className="offline-ribbon"
          >
            لا يوجد اتصال بالإنترنت
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-14 sm:h-16 glass sticky top-0 z-30 border-b border-[var(--color-border)] flex items-center justify-between px-3 sm:px-4 lg:px-6 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={onMenuToggle} className="p-2 sm:p-2.5 rounded-xl hover:bg-[var(--color-border-light)] lg:hidden">
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base lg:text-lg font-bold text-[var(--color-text)] truncate">{currentTitle}</h2>
            <p className="text-[10px] sm:text-[11px] text-[var(--color-text-muted)] hidden sm:block">{dateStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Online status — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-success-light)] text-green-700">
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden sm:inline">{online ? 'متصل' : 'غير متصل'}</span>
          </div>

          {/* Search — desktop */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--color-border-light)] text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-border)] transition-colors"
          >
            <Search size={16} />
            <span>بحث</span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-[var(--color-border)] text-[10px] font-medium">Ctrl+K</kbd>
          </button>

          {/* Search — mobile icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 sm:p-2.5 rounded-xl hover:bg-[var(--color-border-light)] sm:hidden"
          >
            <Search size={18} />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 sm:p-2.5 rounded-xl hover:bg-[var(--color-border-light)]">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--color-danger)] text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
          </div>

          {/* Profile — desktop only */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-[var(--color-border-light)] transition-colors"
            >
              <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0] || 'م'}
              </div>
              <span className="text-sm font-medium">{user?.name || 'المشرف'}</span>
              <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
            </button>
            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[var(--color-border)] py-1 min-w-[180px] z-30"
                  onMouseLeave={() => setProfileOpen(false)}
                >
                  <div className="px-3 py-2 border-b border-[var(--color-border-light)]">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{user?.phone}</p>
                  </div>
                  <button onClick={handleLogout} className="w-full text-right px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] flex items-center gap-2">
                    تسجيل الخروج
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
