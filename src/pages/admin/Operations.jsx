import { NavLink, Outlet } from 'react-router-dom'
import { Clock, History, ClipboardList, Bus } from 'lucide-react'

const tabs = [
  { to: 'today', label: 'اليوم', icon: Clock },
  { to: 'return', label: 'الرجوع', icon: ClipboardList },
  { to: 'departed', label: 'المنطلقات', icon: Bus },
  { to: 'history', label: 'السجل', icon: History },
]

export default function AdminOperations() {
  return (
    <div className="space-y-4">
      <div className="flex flex-nowrap gap-1.5 mb-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition-all sm:gap-2 sm:px-3 sm:py-2 sm:rounded-2xl sm:text-sm ${
                  isActive
                    ? 'bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]'
                }`
              }
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </NavLink>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}
