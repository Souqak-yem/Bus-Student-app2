import { DollarSign, Flag, CheckSquare } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import AdminPricing from './Pricing'
import AdminCampaigns from './Campaigns'
import AdminApprovals from './Approvals'

const tabs = [
  { key: 'pricing', label: 'الأسعار', icon: DollarSign },
  { key: 'campaigns', label: 'الحملات', icon: Flag },
  { key: 'approvals', label: 'الموافقات', icon: CheckSquare },
]

export default function SubscriptionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'pricing'

  function handleTabClick(key) {
    setSearchParams({ tab: key })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2 lg:gap-3 lg:justify-start">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all lg:px-5 ${
                  activeTab === tab.key
                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:bg-slate-100 hover:text-[var(--color-text)]'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {activeTab === 'pricing' && <AdminPricing />}
      {activeTab === 'campaigns' && <AdminCampaigns />}
      {activeTab === 'approvals' && <AdminApprovals />}
    </div>
  )
}
