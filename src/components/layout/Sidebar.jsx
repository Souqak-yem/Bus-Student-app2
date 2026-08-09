import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Bus, CalendarCheck, ClipboardList,
  FileText, DollarSign, Settings, LogOut, Menu, X, AlertTriangle,
  CreditCard, MapPin, CalendarRange, Shield, MessageSquare,
} from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

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

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <>
      <aside
        className={`h-screen bg-white border-l border-[var(--color-border)] flex flex-col transition-all duration-300 sticky top-0 ${
          collapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]'
        }`}
        style={{ direction: 'rtl' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-20 border-b border-[var(--color-border)] shrink-0 bg-gradient-to-l from-[var(--color-primary)]/[0.05] to-transparent">
          <img src="/full-logo.svg" alt="شعار" className="w-12 h-12 lg:w-14 lg:h-14 object-contain flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="text-[10px] text-[var(--color-text-muted)]">تنسيقية مواصلات فلك</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={onToggle} className="mr-auto p-2 rounded-lg hover:bg-[var(--color-border-light)]">
            {collapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
        </div>

        {/* User info */}
        {!collapsed && (
          <div className="px-4 py-3 border-b border-[var(--color-border)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold shadow-[0_4px_10px_-4px_rgba(37,99,235,0.55)]">
                {user?.name?.[0] || 'م'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.name || 'المشرف'}</p>
                <span className="badge-blue text-[10px]">{user?.role === 'admin' ? 'مدير النظام' : 'مشرف'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin">
          {navGroups.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <p className="px-3 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 rounded-xl text-sm transition-all duration-150 min-h-[44px] ${
                          isActive
                            ? 'gradient-primary text-white font-semibold shadow-[0_4px_14px_-4px_rgba(37,99,235,0.6)]'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]'
                        } ${collapsed ? 'justify-center px-3' : ''}`
                      }
                    >
                      <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-[var(--color-border)] shrink-0">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 min-h-[44px] rounded-xl text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] transition-all duration-150 ${collapsed ? 'justify-center px-3' : ''}`}
          >
            <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
