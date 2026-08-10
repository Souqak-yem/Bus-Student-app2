import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import AlertCard from '../../components/ui/AlertCard'
import KpiCard from '../../components/ui/KpiCard'
import StatusBadge from '../../components/ui/StatusBadge'
import { formatCurrency } from '../../lib/format'
import { api } from '../../lib/api'
import { useCallback, useEffect, useState } from 'react'
import { Bus, Users, DollarSign, CheckSquare, FileText, ArrowLeftRight, ClipboardList, TrendingUp, AlertTriangle, Clock, Plus, Flag, Trash2, X } from 'lucide-react'
import ResponsiveKpiGrid from '../../components/ui/ResponsiveKpiGrid'
import { useNavigate } from 'react-router-dom'

export default function AdminOverview() {
  const [stats, setStats] = useState(null)
  const [todayOp, setTodayOp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [timeline, setTimeline] = useState([])
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const navigate = useNavigate()

  const loadAll = useCallback(async () => {
    try {
      const [s, op, hist] = await Promise.all([
        api.dashboard.stats().catch(() => ({})),
        api.operations.getToday().catch(() => null),
        api.operations.getHistory().catch(() => []),
      ])
      setStats(s)
      setTodayOp(op)

      const tl = Array.isArray(hist) ? hist.slice(0, 10).map(h => ({
        id: h.id,
        text: h.operationDate ? `تم إنشاء تشغيل يوم ${new Date(h.operationDate).toLocaleDateString('ar-SA')}` : 'حدث',
        type: h.status === 'OPEN' ? 'info' : 'success',
        date: h.createdAt,
      })) : []
      setTimeline(tl)

      const a = []
      if (s?.studentsWithoutSubscription > 0) {
        a.push({ id: 'subs', type: 'warning', title: `${s.studentsWithoutSubscription} طالب بدون اشتراك`, description: 'طلاب نشطاء بدون اشتراك صالح', action: () => navigate('/admin/students') })
      }
      if (s?.pendingReceipts > 0) {
        a.push({ id: 'receipts', type: 'warning', title: `${s.pendingReceipts} إيصال بانتظار الموافقة`, description: 'إيصالات بحاجة للموافقة', action: () => navigate('/admin/finance/approvals') })
      }
      if (s?.expiredCampaigns > 0) {
        a.push({ id: 'campaigns', type: 'danger', title: `${s.expiredCampaigns} حملة منتهية`, description: 'حملات تجاوزت تاريخ الانتهاء', action: () => navigate('/admin/finance/campaigns') })
      }
      if (s?.busesExceedingCapacity > 0) {
        a.push({ id: 'capacity', type: 'danger', title: `${s.busesExceedingCapacity} باص يتجاوز السعة`, description: 'باصات عدد طلابها أكبر من السعة', action: () => navigate('/admin/buses') })
      }
      if (s?.transfersEndingTomorrow > 0) {
        a.push({ id: 'transfers', type: 'info', title: `${s.transfersEndingTomorrow} تحويل ينتهي غداً`, description: 'تحويلات مؤقتة تنتهي غداً', action: () => navigate('/admin/control/transfers') })
      }
      setAlerts(a)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { loadAll() }, [loadAll])

  const buses = todayOp?.buses || []
  const totalStudents = todayOp?.students?.length || 0
  const operatingBuses = buses.length
  const departedBuses = buses.filter(b => b.status === 'departed').length
  const fullBuses = buses.filter(b => b.students?.length >= (b.bus?.capacity || 999)).length
  const waitingBuses = buses.filter(b => b.status === 'available').length

  return (
    <div className="space-y-6">
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على عمليات اليوم" />

      <ResponsiveKpiGrid>
        <KpiCard title="الباصات العاملة اليوم" value={loading ? null : (operatingBuses || stats?.todayBusesOperating || 0)} icon={Bus} color="primary" trend={operatingBuses > 0 ? 'up' : null} trendValue="نشطة" loading={loading} />
        <KpiCard title="الطلاب اليوم" value={loading ? null : (totalStudents || stats?.studentsToday || 0)} icon={Users} color="info" loading={loading} />
        <KpiCard title="الطلاب النشطاء" value={loading ? null : stats?.activeStudents} icon={Users} color="success" subtitle="إجمالي" loading={loading} />
        <KpiCard title="المدفوعات المعلقة" value={loading ? null : stats?.pendingPayments} icon={DollarSign} color="warning" trend={stats?.pendingPayments > 0 ? 'down' : 'up'} trendValue={stats?.pendingPayments > 0 ? 'بحاجة للتحصيل' : 'لا توجد'} loading={loading} />
        <KpiCard title="إيصالات بانتظار الموافقة" value={loading ? null : stats?.pendingReceipts} icon={CheckSquare} color="accent" loading={loading} />
        <KpiCard title="إيرادات اليوم" value={loading ? null : formatCurrency(stats?.todayRevenue)} icon={DollarSign} color="success" loading={loading} />
        <KpiCard title="الإيرادات الشهرية" value={loading ? null : formatCurrency(stats?.monthlyRevenue)} icon={TrendingUp} color="primary" loading={loading} />
        <KpiCard title="الإيرادات المتوقعة" value={loading ? null : formatCurrency(stats?.expectedRevenue)} icon={DollarSign} color="info" loading={loading} />
        <KpiCard title="التحويلات المؤقتة" value={loading ? null : stats?.activeTransfers} icon={ArrowLeftRight} color="warning" loading={loading} />
        <KpiCard title="الكشوف الأسبوعية" value={loading ? null : stats?.weeklySheets || 0} icon={FileText} color="purple" loading={loading} />
        <KpiCard title="الرحلات الراجعة" value={loading ? null : stats?.returnTrips || 0} icon={ClipboardList} color="accent" loading={loading} />
      </ResponsiveKpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="حالة التشغيل" icon={Bus} subtitle="الوضع الحالي للباصات">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <StatusRow label="باصات عاملة" value={operatingBuses} color="green" icon={Bus} />
              <StatusRow label="باصات في الانتظار" value={waitingBuses} color="blue" icon={Clock} />
              <StatusRow label="باصات منطلقة" value={departedBuses} color="accent" icon={Bus} />
              <StatusRow label="باصات ممتلئة" value={fullBuses} color="orange" icon={Bus} />
              <StatusRow label="باصات قرب الامتلاء" value={buses.filter(b => {
                const cap = b.bus?.capacity || 999
                return b.students?.length >= cap * 0.8 && b.students?.length < cap
              }).length} color="yellow" icon={AlertTriangle} />
            </div>
          )}
        </Section>

        <Section title="التنبيهات" icon={AlertTriangle} subtitle={`${alerts.length} تنبيه`}>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-[var(--color-success-light)] flex items-center justify-center mx-auto mb-3">
                <CheckSquare size={24} className="text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-700">لا توجد تنبيهات</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">كل شيء يعمل بشكل طبيعي</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(alert => (
                <AlertCard key={alert.id} type={alert.type} title={alert.title} description={alert.description} onClick={alert.action} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="النشاطات الأخيرة" icon={Clock} subtitle="آخر العمليات" className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-[var(--color-text-muted)]">لا توجد نشاطات بعد</p>
            </div>
          ) : (
            <div className="space-y-0">
              {timeline.map((event, idx) => (
                <div key={event.id} className="flex gap-3 pb-4 relative">
                  {idx < timeline.length - 1 && (
                    <div className="absolute right-[11px] top-6 bottom-0 w-px bg-[var(--color-border)]" />
                  )}
                  <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center ${
                    event.type === 'success' ? 'bg-[var(--color-success-light)]' :
                    event.type === 'danger' ? 'bg-[var(--color-danger-light)]' :
                    'bg-[var(--color-info-light)]'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      event.type === 'success' ? 'bg-green-500' :
                      event.type === 'danger' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{event.text}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{event.date ? new Date(event.date).toLocaleString('ar-SA') : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="إجراءات سريعة" icon={Plus}>
          <div className="space-y-2">
            <QuickActionButton icon={Users} label="الطلاب" onClick={() => navigate('/admin/students')} color="primary" />
            <QuickActionButton icon={Bus} label="الحافلات" onClick={() => navigate('/admin/buses')} color="accent" />
            <QuickActionButton icon={Clock} label="تشغيل اليوم" onClick={() => navigate('/admin/operations/today')} color="success" />
            <QuickActionButton icon={FileText} label="الكشوف الأسبوعية" onClick={() => navigate('/admin/reports/weekly-sheets')} color="purple" />
            <QuickActionButton icon={ClipboardList} label="مركز الرجوع" onClick={() => navigate('/admin/operations/return')} color="info" />
            <QuickActionButton icon={DollarSign} label="التسعير" onClick={() => navigate('/admin/finance/pricing')} color="warning" />
            <QuickActionButton icon={Flag} label="الحملات" onClick={() => navigate('/admin/finance/campaigns')} color="accent" />
            <QuickActionButton icon={Trash2} label="مسح البيانات" onClick={() => setShowResetModal(true)} color="danger" />
          </div>
        </Section>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowResetModal(false); setResetConfirmText('') }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[min(95vw,780px)] lg:max-w-[900px] shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-red-600">مسح جميع البيانات</h3>
              <button onClick={() => { setShowResetModal(false); setResetConfirmText('') }} className="p-1 rounded-lg hover:bg-[var(--color-border-light)]">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <p className="font-medium mb-1">تحذير: هذا الإجراء لا يمكن التراجع عنه!</p>
                <p>سيتم حذف جميع الطلاب، الباصات، الاشتراكات، المدفوعات، الحضور، الحملات، الكشوف الأسبوعية، والبيانات المالية. سيبقى حساب الأدمن والإعدادات والمناطق والأسعار والوجهات.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">اكتب <span className="font-bold text-red-600">RESET</span> لتأكيد المسح</label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="اكتب RESET هنا"
                  className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm outline-none focus:border-red-400"
                  dir="ltr"
                />
              </div>
              <button
                onClick={async () => {
                  if (resetConfirmText !== 'RESET') return
                  setResetting(true)
                  try {
                    await api.admin.resetData()
                    setShowResetModal(false)
                    setResetConfirmText('')
                    loadAll()
                  } catch (err) {
                    alert('فشلت عملية المسح: ' + err.message)
                  } finally {
                    setResetting(false)
                  }
                }}
                disabled={resetConfirmText !== 'RESET' || resetting}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resetting ? 'جارٍ المسح...' : 'تأكيد مسح جميع البيانات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusRow({ label, value, color, icon: Icon }) {
  const dotColors = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    accent: 'bg-orange-500',
    orange: 'bg-orange-500',
    yellow: 'bg-yellow-500',
  }
  const bgColors = {
    green: 'bg-[var(--color-success-light)]',
    blue: 'bg-[var(--color-info-light)]',
    accent: 'bg-[var(--color-accent-lighter)]',
    orange: 'bg-[var(--color-accent-lighter)]',
    yellow: 'bg-[var(--color-warning-light)]',
  }
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-border-light)]">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${bgColors[color] || 'bg-gray-100'} flex items-center justify-center`}>
          {Icon && <Icon size={16} className="text-[var(--color-text-secondary)]" />}
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">{value}</span>
        <span className={`w-2 h-2 rounded-full ${dotColors[color] || 'bg-gray-400'}`} />
      </div>
    </div>
  )
}

function QuickActionButton({ icon: Icon, label, onClick, color }) {
  const colors = {
    primary: 'from-blue-500 to-blue-600',
    accent: 'from-orange-500 to-orange-600',
    success: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    info: 'from-cyan-500 to-cyan-600',
    warning: 'from-yellow-500 to-yellow-600',
    danger: 'from-red-500 to-red-600',
  }
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl bg-[var(--color-border-light)] hover:bg-[var(--color-primary-lighter)] transition-colors text-right`}>
      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colors[color] || colors.primary} flex items-center justify-center shrink-0`}>
        <Icon size={16} className="text-white" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
