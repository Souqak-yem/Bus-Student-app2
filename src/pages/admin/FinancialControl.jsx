import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign, AlertTriangle, Ban, Clock, UserCheck,
  Send, X,
} from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import ResponsiveKpiGrid from '../../components/ui/ResponsiveKpiGrid'
import DataTable from '../../components/ui/DataTable'

const STATUS_LABELS = {
  SETTLED: 'مسدد',
  OVERDUE: 'متأخر',
  SUSPENDED: 'موقوف',
  GRACE_PERIOD: 'مهلة',
}

const STATUS_COLORS = {
  SETTLED: 'green',
  OVERDUE: 'red',
  SUSPENDED: 'red',
  GRACE_PERIOD: 'yellow',
}

export default function FinancialControl() {
  const [dashboard, setDashboard] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [actionStudent, setActionStudent] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [modalData, setModalData] = useState({ reason: '', endDate: '' })

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.financial.dashboard()
      setDashboard(data)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadStudents = useCallback(async () => {
    try {
      const params = {}
      if (filter) params.status = filter
      const data = await api.financial.students(params)
      setStudents(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    setLoading(true)
    loadStudents()
  }, [loadStudents])

  async function handleAction() {
    if (!actionStudent) return
    try {
      const sid = actionStudent.studentId || actionStudent.id
      switch (actionType) {
        case 'suspend':
          await api.financial.suspend(sid, modalData.reason)
          break
        case 'reactivate':
          await api.financial.reactivate(sid)
          break
        case 'grace':
          await api.financial.grantGrace(sid, modalData.endDate, modalData.reason)
          break
        case 'cancelGrace':
          await api.financial.cancelGrace(sid)
          break
        case 'reminder':
          await api.financial.sendReminder(sid)
          break
      }
      setActionStudent(null)
      setActionType(null)
      setModalData({ reason: '', endDate: '' })
      loadDashboard()
      loadStudents()
    } catch (e) {
      alert(e.message)
    }
  }

  const stats = [
    { icon: DollarSign, label: 'مسددون', value: dashboard?.counts?.SETTLED ?? null, color: 'green' },
    { icon: AlertTriangle, label: 'متأخرون', value: dashboard?.counts?.OVERDUE ?? null, color: 'red' },
    { icon: Ban, label: 'موقوفون', value: dashboard?.counts?.SUSPENDED ?? null, color: 'red' },
    { icon: Clock, label: 'مهلة', value: dashboard?.counts?.GRACE_PERIOD ?? null, color: 'yellow' },
  ]

  const columns = [
    { key: 'studentName', label: 'الطالب', render: (r) => r.studentName || r.name || '-' },
    { key: 'status', label: 'الحالة المالية', render: (r) => (
      <span className={`badge badge-${STATUS_COLORS[r.financialStatus] || 'gray'}`}>
        {STATUS_LABELS[r.financialStatus] || r.financialStatus}
      </span>
    )},
    { key: 'delayDays', label: 'أيام التأخير', hideOnMobile: true, render: (r) => r.delayDays > 0 ? `${r.delayDays} يوم` : '-' },
    { key: 'destinationName', label: 'الوجهة', hideOnMobile: true, render: (r) => r.destinationName || r.institutionName || '-' },
    { key: 'busInfo', label: 'الباص', hideOnMobile: true, render: (r) => {
      const b = r.bus?.busNumber || r.bus?.plateNumber || r.busNumber || r.templateStudents?.[0]?.bus?.busNumber
      return b || '-'
    }},
    { key: 'actions', label: 'الإجراءات', render: (r) => (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {r.financialStatus !== 'SUSPENDED' && (
          <button onClick={() => { setActionStudent(r); setActionType('suspend') }}
            className="btn-ghost btn-sm text-red-500" title="إيقاف">
            <Ban size={14} />
          </button>
        )}
        {r.financialStatus === 'SUSPENDED' && (
          <button onClick={() => { setActionStudent(r); setActionType('reactivate') }}
            className="btn-ghost btn-sm text-green-500" title="إعادة تفعيل">
            <UserCheck size={14} />
          </button>
        )}
        {r.financialStatus !== 'GRACE_PERIOD' && r.financialStatus !== 'SUSPENDED' && (
          <button onClick={() => { setActionStudent(r); setActionType('grace') }}
            className="btn-ghost btn-sm text-yellow-500" title="منح مهلة">
            <Clock size={14} />
          </button>
        )}
        {r.financialStatus === 'GRACE_PERIOD' && (
          <button onClick={() => { setActionStudent(r); setActionType('cancelGrace') }}
            className="btn-ghost btn-sm text-orange-500" title="إلغاء المهلة">
            <X size={14} />
          </button>
        )}
        {r.financialStatus === 'OVERDUE' && (
          <button onClick={() => { setActionStudent(r); setActionType('reminder') }}
            className="btn-ghost btn-sm text-blue-500" title="إرسال تذكير">
            <Send size={14} />
          </button>
        )}
      </div>
    )},
  ]

  const filterTabs = [
    { value: '', label: 'الكل' },
    { value: 'SETTLED', label: 'مسدد' },
    { value: 'OVERDUE', label: 'متأخر' },
    { value: 'SUSPENDED', label: 'موقوف' },
    { value: 'GRACE_PERIOD', label: 'مهلة' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="الإدارة المالية" subtitle="التحكم بحالة الطلاب المالية" />

      {/* Stat Cards */}
      <ResponsiveKpiGrid>
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={loading ? null : s.value} color={s.color} />
        ))}
      </ResponsiveKpiGrid>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((t) => (
          <button key={t.value} onClick={() => setFilter(t.value)}
            className={`px-3 py-2.5 min-h-[44px] rounded-2xl text-sm font-medium transition-all ${
              filter === t.value
                ? 'bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Students Table */}
      <DataTable
        columns={columns}
        data={students}
        loading={loading}
        mobileCards
        searchPlaceholder="بحث عن طالب..."
        emptyTitle="لا يوجد طلاب"
        emptyDescription={filter ? `لا يوجد طلاب بهذه الحالة` : 'لم يتم تحميل البيانات بعد'}
        renderRow={(row, visibleCols) => (
          <>
            {visibleCols.map(col => (
              <td key={col.key} className="max-sm:hidden px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-[var(--color-border-light)]">
                {col.render ? col.render(row) : row[col.key] ?? '-'}
              </td>
            ))}
            <td className="sm:hidden block p-0 border-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{row.studentName || row.name || '-'}</span>
                  <span className={`badge badge-${STATUS_COLORS[row.financialStatus] || 'gray'}`}>
                    {STATUS_LABELS[row.financialStatus] || row.financialStatus}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  {row.delayDays > 0 && <span className="flex items-center gap-1"><Clock size={10} /> {row.delayDays} يوم تأخير</span>}
                  {(row.destinationName || row.institutionName) && <span>{row.destinationName || row.institutionName}</span>}
                  {(row.bus?.busNumber || row.bus?.plateNumber || row.busNumber || row.templateStudents?.[0]?.bus?.busNumber) && (
                    <span>باص: {row.bus?.busNumber || row.bus?.plateNumber || row.busNumber || row.templateStudents?.[0]?.bus?.busNumber}</span>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
                  {row.financialStatus !== 'SUSPENDED' && (
                    <button onClick={() => { setActionStudent(row); setActionType('suspend') }} className="btn-ghost btn-sm text-xs text-red-500">إيقاف</button>
                  )}
                  {row.financialStatus === 'SUSPENDED' && (
                    <button onClick={() => { setActionStudent(row); setActionType('reactivate') }} className="btn-ghost btn-sm text-xs text-green-500">إعادة تفعيل</button>
                  )}
                  {row.financialStatus !== 'GRACE_PERIOD' && row.financialStatus !== 'SUSPENDED' && (
                    <button onClick={() => { setActionStudent(row); setActionType('grace') }} className="btn-ghost btn-sm text-xs text-yellow-600">مهلة</button>
                  )}
                  {row.financialStatus === 'GRACE_PERIOD' && (
                    <button onClick={() => { setActionStudent(row); setActionType('cancelGrace') }} className="btn-ghost btn-sm text-xs text-orange-500">إلغاء المهلة</button>
                  )}
                  {row.financialStatus === 'OVERDUE' && (
                    <button onClick={() => { setActionStudent(row); setActionType('reminder') }} className="btn-ghost btn-sm text-xs text-blue-500">تذكير</button>
                  )}
                </div>
              </div>
            </td>
          </>
        )}
      />

      {/* Action Modals */}
      <AnimatePresence>
        {actionStudent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay" onClick={() => { setActionStudent(null); setActionType(null) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="modal-content max-w-[min(95vw,680px)] lg:max-w-[780px] p-6" onClick={(e) => e.stopPropagation()}>

              {actionType === 'suspend' && (
                <>
                  <h3 className="text-lg font-bold mb-2">إيقاف طالب</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    إيقاف {actionStudent.studentName || actionStudent.name} مالياً
                  </p>
                  <textarea className="input-field mb-4" rows={3} placeholder="سبب الإيقاف"
                    value={modalData.reason} onChange={(e) => setModalData(p => ({ ...p, reason: e.target.value }))} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionStudent(null); setActionType(null) }} className="btn-ghost">إلغاء</button>
                    <button onClick={handleAction} className="btn-danger" disabled={!modalData.reason.trim()}>تأكيد الإيقاف</button>
                  </div>
                </>
              )}

              {actionType === 'reactivate' && (
                <>
                  <h3 className="text-lg font-bold mb-2">إعادة تفعيل طالب</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    إعادة تفعيل {actionStudent.studentName || actionStudent.name}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionStudent(null); setActionType(null) }} className="btn-ghost">إلغاء</button>
                    <button onClick={handleAction} className="btn-primary">تأكيد إعادة التفعيل</button>
                  </div>
                </>
              )}

              {actionType === 'grace' && (
                <>
                  <h3 className="text-lg font-bold mb-2">منح مهلة</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    منح مهلة لـ {actionStudent.studentName || actionStudent.name}
                  </p>
                  <label className="block text-sm font-medium mb-1">تاريخ انتهاء المهلة</label>
                  <input type="date" className="input-field mb-3"
                    value={modalData.endDate} onChange={(e) => setModalData(p => ({ ...p, endDate: e.target.value }))} />
                  <textarea className="input-field mb-4" rows={2} placeholder="سبب المهلة"
                    value={modalData.reason} onChange={(e) => setModalData(p => ({ ...p, reason: e.target.value }))} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionStudent(null); setActionType(null) }} className="btn-ghost">إلغاء</button>
                    <button onClick={handleAction} className="btn-primary" disabled={!modalData.endDate}>تأكيد المهلة</button>
                  </div>
                </>
              )}

              {actionType === 'cancelGrace' && (
                <>
                  <h3 className="text-lg font-bold mb-2">إلغاء المهلة</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    إلغاء مهلة {actionStudent.studentName || actionStudent.name}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionStudent(null); setActionType(null) }} className="btn-ghost">إلغاء</button>
                    <button onClick={handleAction} className="btn-danger">تأكيد الإلغاء</button>
                  </div>
                </>
              )}

              {actionType === 'reminder' && (
                <>
                  <h3 className="text-lg font-bold mb-2">إرسال تذكير</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    إرسال تذكير لـ {actionStudent.studentName || actionStudent.name}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setActionStudent(null); setActionType(null) }} className="btn-ghost">إلغاء</button>
                    <button onClick={handleAction} className="btn-primary">تأكيد الإرسال</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
