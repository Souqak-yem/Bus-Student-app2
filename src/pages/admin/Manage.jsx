import { NavLink, Outlet } from 'react-router-dom'
import { Shield, Users, Settings, Server } from 'lucide-react'

const tabs = [
  { to: 'users', label: 'المستخدمين', icon: Users },
  { to: 'password-reset-requests', label: 'طلبات استعادة كلمة المرور', icon: Shield },
  { to: 'settings', label: 'الإعدادات', icon: Settings },
  { to: 'system', label: 'إدارة النظام', icon: Server },
]

export default function AdminManage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-medium transition-all ${
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
