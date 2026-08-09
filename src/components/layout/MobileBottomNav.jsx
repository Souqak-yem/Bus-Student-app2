import { LayoutDashboard, Bus, Users, CalendarCheck, Grid3X3 } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/admin', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/admin/buses', label: 'الباصات', icon: Bus },
  { to: '/admin/students', label: 'الطلاب', icon: Users },
  { to: '/admin/operations/today', label: 'التشغيل', icon: CalendarCheck },
]

export default function MobileBottomNav({ onMore }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden">
      <div className="px-3 pb-3">
        <div className="glass border border-[var(--color-border)] rounded-2xl shadow-pop flex items-center justify-around py-1.5 safe-area-bottom">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 ${
                    isActive
                      ? 'text-[var(--color-primary-dark)]'
                      : 'text-[var(--color-text-muted)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-0 rounded-xl gradient-primary opacity-15" />
                    )}
                    <Icon size={20} strokeWidth={1.5} className="relative" />
                    <span className="relative text-[10px] font-medium">{tab.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
          <button
            onClick={onMore}
            className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[var(--color-text-muted)] transition-colors"
          >
            <Grid3X3 size={20} strokeWidth={1.5} className="relative" />
            <span className="relative text-[10px] font-medium">المزيد</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
