import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bus, Users, CalendarCheck, FileText, ArrowLeftRight, DollarSign, Clock, AlertTriangle,
  Megaphone, CheckSquare, TrendingUp, ClipboardList, Percent, UserPlus, Plus, RefreshCw,
  Ban, MessageSquare,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/format'
import KpiCard from '../../components/ui/KpiCard'
import ResponsiveKpiGrid from '../../components/ui/ResponsiveKpiGrid'
import Section from '../../components/ui/Section'
import AlertCard from '../../components/ui/AlertCard'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [todayOp, setTodayOp] = useState(null)
  const [finStats, setFinStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState([])
  const [timeline, setTimeline] = useState([])
  const navigate = useNavigate()

  const loadAll = useCallback(async () => {
    try {
      const [s, op, hist, fin] = await Promise.all([
        api.dashboard.stats().catch(() => ({})),
        api.operations.getToday().catch(() => null),
        api.operations.getHistory().catch(() => []),
        api.financial.dashboard().catch(() => null),
      ])
      setFinStats(fin)
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
      if (fin?.overdue > 0) {
        a.push({ id: 'fin-overdue', type: 'danger', title: `${fin.overdue} طالب متأخر عن السداد`, description: 'طلاب تجاوزت اشتراكاتهم تاريخ الاستحقاق', action: () => navigate('/admin/financial-control') })
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
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على عمليات اليوم">
        <div className="flex items-center gap-2">
          <img src="/full-logo.svg" alt="شعار الشركة" className="w-9 sm:w-11 h-9 sm:h-11 object-contain" />
          <span className="text-xs sm:text-sm font-medium text-[var(--color-text-muted)]">تنسيقية مواصلات فلك</span>
        </div>
      </PageHeader>

      <ResponsiveKpiGrid>
        <KpiCard
          title="الباصات العاملة اليوم"
          value={loading ? null : (operatingBuses || stats?.todayBusesOperating || 0)}
          icon={Bus}
          color="primary"
          trend={operatingBuses > 0 ? 'up' : null}
          trendValue="نشطة"
          loading={loading}
        />
        <KpiCard
          title="الطلاب اليوم"
          value={loading ? null : (totalStudents || stats?.studentsToday || 0)}
          icon={Users}
          color="info"
          loading={loading}
        />
        <KpiCard
          title="الطلاب النشطاء"
          value={loading ? null : stats?.activeStudents}
          icon={Users}
          color="success"
          subtitle="إجمالي"
          loading={loading}
        />
        <KpiCard
          title="المدفوعات المعلقة"
          value={loading ? null : stats?.pendingPayments}
          icon={DollarSign}
          color="warning"
          trend={stats?.pendingPayments > 0 ? 'down' : 'up'}
          trendValue={stats?.pendingPayments > 0 ? 'بحاجة للتحصيل' : 'لا توجد'}
          loading={loading}
        />
        <KpiCard
          title="إيصالات بانتظار الموافقة"
          value={loading ? null : stats?.pendingReceipts}
          icon={CheckSquare}
          color="accent"
          loading={loading}
        />
        <KpiCard
          title="طلبات التسجيل الجديدة"
          value={loading ? null : stats?.pendingStudentRegistrations}
          icon={MessageSquare}
          color="warning"
          subtitle="قيد المراجعة"
          loading={loading}
          onClick={() => navigate('/admin/student-requests')}
        />
        <KpiCard
          title="إيرادات اليوم"
          value={loading ? null : formatCurrency(stats?.todayRevenue ?? 0)}
          icon={DollarSign}
          color="success"
          loading={loading}
        />
        <KpiCard
          title="الإيرادات الشهرية"
          value={loading ? null : formatCurrency(stats?.monthlyRevenue ?? 0)}
          icon={TrendingUp}
          color="primary"
          loading={loading}
        />
        <KpiCard
          title="الإيرادات المتوقعة"
          value={loading ? null : formatCurrency(stats?.expectedRevenue ?? 0)}
          icon={DollarSign}
          color="info"
          loading={loading}
        />
        <KpiCard
          title="متأخرون عن السداد"
          value={loading ? null : finStats?.counts?.OVERDUE ?? 0}
          icon={Ban}
          color="danger"
          subtitle={finStats?.counts?.OVERDUE > 0 ? 'بحاجة للمتابعة' : 'لا يوجد'}
          loading={loading}
          onClick={() => navigate('/admin/financial-control')}
        />
        <KpiCard
          title="التحويلات المؤقتة"
          value={loading ? null : stats?.activeTransfers}
          icon={ArrowLeftRight}
          color="warning"
          loading={loading}
        />
        <KpiCard
          title="الكشوف الأسبوعية"
          value={loading ? null : stats?.weeklySheets || 0}
          icon={FileText}
          color="purple"
          loading={loading}
        />
        <KpiCard
          title="الرحلات الراجعة"
          value={loading ? null : stats?.returnTrips || 0}
          icon={ClipboardList}
          color="accent"
          loading={loading}
        />
        <KpiCard
          title="نسبة الإشغال"
          value={loading ? null : (stats?.occupancyRate != null ? `${Math.round(stats.occupancyRate)}%` : '-')}
          icon={Percent}
          color="success"
          subtitle="متوسط"
          loading={loading}
        />
      </ResponsiveKpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Section title="حالة التشغيل" icon={Bus} subtitle="الوضع الحالي للباصات">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
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
            <div className="text-center py-4 sm:py-6">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-[var(--color-success-light)] flex items-center justify-center mx-auto mb-2 sm:mb-3">
                <CheckSquare size={20} className="text-green-600" />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Section title="النشاطات الأخيرة" icon={Clock} subtitle="آخر العمليات" className="lg:col-span-2">
          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-4 sm:py-6">
              <p className="text-sm text-[var(--color-text-muted)]">لا توجد نشاطات بعد</p>
            </div>
          ) : (
            <div className="space-y-0">
              {timeline.map((event, idx) => (
                <div key={event.id ?? idx} className="flex gap-3 pb-3 sm:pb-4 relative">
                  {idx < timeline.length - 1 && (
                    <div className="absolute right-[11px] top-6 bottom-0 w-px bg-[var(--color-border)]" />
                  )}
                  <div className={`w-5 sm:w-6 h-5 sm:h-6 rounded-full shrink-0 flex items-center justify-center ${
                    event.type === 'success' ? 'bg-[var(--color-success-light)]' :
                    event.type === 'danger' ? 'bg-[var(--color-danger-light)]' :
                    'bg-[var(--color-info-light)]'
                  }`}>
                    <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${
                      event.type === 'success' ? 'bg-green-500' :
                      event.type === 'danger' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm">{event.text}</p>
                    <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)] mt-0.5">
                      {event.date ? new Date(event.date).toLocaleString('ar-SA') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="إجراءات سريعة" icon={RefreshCw}>
          <div className="space-y-2">
            <QuickActionButton icon={UserPlus} label="إضافة طالب" onClick={() => navigate('/admin/students')} color="primary" />
            <QuickActionButton icon={Plus} label="إضافة باص" onClick={() => navigate('/admin/buses')} color="accent" />
            <QuickActionButton icon={CalendarCheck} label="تشغيل اليوم" onClick={() => navigate('/admin/operations/today')} color="success" />
            <QuickActionButton icon={FileText} label="الكشوف الأسبوعية" onClick={() => navigate('/admin/reports/weekly-sheets')} color="purple" />
            <QuickActionButton icon={ClipboardList} label="مركز الرجوع" onClick={() => navigate('/admin/operations/return')} color="info" />
            <QuickActionButton icon={DollarSign} label="التسعير" onClick={() => navigate('/admin/finance/pricing')} color="warning" />
            <QuickActionButton icon={Megaphone} label="الحملات" onClick={() => navigate('/admin/finance/campaigns')} color="accent" />
          </div>
        </Section>
      </div>
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
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-2 sm:p-3 min-h-[44px] rounded-xl bg-[var(--color-border-light)]"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`w-7 sm:w-8 h-7 sm:h-8 rounded-lg shrink-0 ${bgColors[color] || 'bg-gray-100'} flex items-center justify-center`}>
          {Icon && <Icon size={14} className="text-[var(--color-text-secondary)]" />}
        </div>
        <span className="text-xs sm:text-sm truncate">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <span className="text-base sm:text-lg font-bold">{value}</span>
        <span className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${dotColors[color] || 'bg-gray-400'}`} />
      </div>
    </motion.div>
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
  }
  return (
    <motion.button
      whileHover={{ x: -4 }}
      onClick={onClick}
      className="w-full flex items-center gap-2 sm:gap-3 p-2 sm:p-3 min-h-[44px] rounded-xl bg-[var(--color-border-light)] hover:bg-[var(--color-primary-lighter)] transition-colors text-right"
    >
      <div className={`w-8 sm:w-9 h-8 sm:h-9 rounded-lg bg-gradient-to-br ${colors[color] || colors.primary} flex items-center justify-center shrink-0`}>
        <Icon size={14} className="text-white" />
      </div>
      <span className="text-xs sm:text-sm font-medium truncate">{label}</span>
    </motion.button>
  )
}
