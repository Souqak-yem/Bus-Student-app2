import { AnimatePresence, motion } from 'framer-motion'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Bus, CalendarCheck, ClipboardList,
  FileText, DollarSign, Settings, LogOut, X, AlertTriangle,
  CreditCard, MapPin, CalendarRange, Shield, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { canAccessAdminPage } from '../../lib/adminPermissions'

const navGroups = [
  {
    label: 'الرئيسية',
    items: [
      { to: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'التشغيل',
    items: [
      { to: '/admin/operations/today', label: 'تشغيل اليوم', icon: CalendarCheck },
      { to: '/admin/operations/return', label: 'رحلات العودة', icon: ClipboardList },
      { to: '/admin/emergency', label: 'مركز الطوارئ', icon: AlertTriangle },
    ],
  },
  {
    label: 'البيانات',
    items: [
      { to: '/admin/buses', label: 'الباصات', icon: Bus },
      { to: '/admin/students', label: 'الطلاب', icon: Users },
      { to: '/admin/student-requests', label: 'طلبات التسجيل', icon: MessageSquare },
      { to: '/admin/destinations', label: 'الوجهات', icon: MapPin },
    ],
  },
  {
    label: 'الاشتراكات والمالية',
    items: [
      { to: '/admin/subscriptions', label: 'الاشتراكات', icon: DollarSign },
      { to: '/admin/subscriptions/daily', label: 'إدارة اليومي', icon: CalendarRange },
      { to: '/admin/financial-control', label: 'الإدارة المالية', icon: CreditCard },
    ],
  },
  {
    label: 'التقارير',
    items: [
      { to: '/admin/reports/weekly-sheets', label: 'الكشوف الأسبوعية', icon: FileText },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      { to: '/admin/manage/users', label: 'المستخدمون', icon: Users },
      { to: '/admin/manage/settings', label: 'الإعدادات', icon: Settings },
      { to: '/admin/manage/system', label: 'إدارة النظام', icon: Shield },
    ],
  },
]

export default function MobileDrawer({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const visibleNavGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (user?.role !== 'admin') return true
        if (!user?.adminPermissions?.length) return true
        return canAccessAdminPage(user, item.to)
      }),
    }))
    .filter(group => group.items.length > 0)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 lg:hidden"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 h-full w-[85vw] max-w-sm bg-white z-50 shadow-2xl overflow-y-auto lg:hidden"
            style={{ direction: 'rtl' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <img src="/full-logo.svg" alt="شعار" className="w-9 h-9 sm:w-11 sm:h-11 object-contain" />
                <div>
                  <p className="text-sm font-bold">{user?.name || 'المشرف'}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{user?.role === 'admin' ? 'مدير النظام' : 'مشرف'}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-border-light)]">
                <X size={20} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="p-3 sm:p-4 space-y-4">
              {visibleNavGroups.map(group => (
                <div key={group.label}>
                  <p className="px-3 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl text-sm sm:text-base transition-all duration-150 ${
                              isActive
                                ? 'gradient-primary text-white font-semibold shadow-[0_4px_14px_-4px_rgba(37,99,235,0.6)]'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
                            }`
                          }
                        >
                          <Icon size={20} strokeWidth={1.5} className="shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Logout */}
            <div className="p-3 sm:p-4 border-t border-[var(--color-border)]">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 sm:px-4 py-3 rounded-xl text-sm sm:text-base text-[var(--color-text-secondary)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] transition-all duration-150"
              >
                <LogOut size={20} strokeWidth={1.5} className="shrink-0" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
