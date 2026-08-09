import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Bus, Users, Wrench, Activity, History, CheckCircle, XCircle, AlertCircle, Phone, MessageCircle, Check, X, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import { SkeletonCard } from '../../components/ui/Skeleton'

const STATUS_CONFIG = {
  BROKEN_DOWN: { label: 'متعطل', color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle },
  REPLACED: { label: 'تم استبداله', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: CheckCircle },
  AVAILABLE: { label: 'يعمل', color: 'text-green-600 bg-green-50 border-green-200', icon: Activity },
  LOADING: { label: 'تحميل', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: AlertCircle },
  DEPARTED: { label: 'منطلق', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Bus },
}

const REPORT_REASONS = {
  MECHANICAL: 'عطل ميكانيكي',
  ACCIDENT: 'حادث',
  TRAFFIC: 'ازدحام شديد',
  ROAD_CLOSED: 'إغلاق طريق',
  OTHER: 'أخرى',
}

export default function EmergencyCenter() {
  const [buses, setBuses] = useState([])
  const [logs, setLogs] = useState([])
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLogs, setShowLogs] = useState(false)
  const [reviewingReport, setReviewingReport] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [processing, setProcessing] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const [busesData, logsData, reportsData] = await Promise.all([
        api.emergency.buses(),
        api.emergency.logs(),
        api.emergency.getPendingReports().catch(() => []),
      ])
      setBuses(Array.isArray(busesData) ? busesData : [])
      setLogs(Array.isArray(logsData) ? logsData : [])
      setReports(Array.isArray(reportsData) ? reportsData : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const brokenCount = buses.filter(b => b.status === 'BROKEN_DOWN').length
  const totalStudents = buses.reduce((s, b) => s + b.studentCount, 0)
  const pendingReports = reports.filter(r => r.status === 'PENDING_REVIEW')
  const activeReports = reports.filter(r => r.status === 'APPROVED')

  async function handleApprove(report) {
    setProcessing(true)
    try {
      await api.emergency.approveReport(report.id)
      setReviewingReport(null)
      await load()
      navigate(`/admin/emergency/${report.busId}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject(report) {
    if (!rejectionReason.trim()) return
    setProcessing(true)
    try {
      await api.emergency.rejectReport(report.id, rejectionReason)
      setReviewingReport(null)
      setShowRejectForm(false)
      setRejectionReason('')
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <div className="space-y-4"><PageHeader title="مركز إدارة الطوارئ" /><SkeletonCard count={3} /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="مركز إدارة التشغيل اليومي" actions={
        <div className="flex gap-2">
          <button onClick={() => setShowLogs(!showLogs)} className="btn-ghost text-sm flex items-center gap-1.5">
            <History size={16} /> {showLogs ? 'إخفاء السجل' : 'سجل الطوارئ'}
          </button>
          <button onClick={load} className="btn-ghost text-sm">تحديث</button>
        </div>
      } />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Bus size={20} className="text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{buses.length}</p><p className="text-xs text-[var(--color-text-muted)]">الباصات العاملة</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><Users size={20} className="text-green-600" /></div>
            <div><p className="text-2xl font-bold">{totalStudents}</p><p className="text-xs text-[var(--color-text-muted)]">إجمالي الطلاب</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><AlertTriangle size={20} className="text-amber-600" /></div>
            <div><p className="text-2xl font-bold">{brokenCount}</p><p className="text-xs text-[var(--color-text-muted)]">باصات متعطلة</p></div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Wrench size={20} className="text-purple-600" /></div>
            <div><p className="text-2xl font-bold">{logs.length}</p><p className="text-xs text-[var(--color-text-muted)]">عمليات الطوارئ</p></div>
          </div>
        </div>
      </div>

      {/* Driver Reports */}
      {(pendingReports.length > 0 || activeReports.length > 0) && (
        <div className="card p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            بلاغات السائقين
            {pendingReports.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingReports.length} جديد</span>
            )}
          </h3>
          <div className="space-y-2">
            {reports.map(report => (
              <div key={report.id} className={`rounded-xl border p-3 ${
                report.status === 'PENDING_REVIEW'
                  ? 'border-red-200 bg-red-50/50'
                  : report.status === 'APPROVED'
                    ? 'border-amber-200 bg-amber-50/50'
                    : 'border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    report.status === 'PENDING_REVIEW' ? 'bg-red-100' : 'bg-amber-100'
                  }`}>
                    {report.status === 'PENDING_REVIEW'
                      ? <Clock size={18} className="text-red-600" />
                      : <CheckCircle size={18} className="text-amber-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        باص {report.busNumber}
                      </p>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        report.status === 'PENDING_REVIEW'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {report.status === 'PENDING_REVIEW' ? 'قيد المراجعة' : 'تم الاعتماد'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {report.driverName} | {REPORT_REASONS[report.reason] || report.reason}
                    </p>
                    {report.notes && (
                      <p className="text-[11px] text-slate-400 mt-0.5">ملاحظة: {report.notes}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(report.createdAt).toLocaleString('ar-SA')}
                    </p>
                  </div>
                </div>
                {report.status === 'PENDING_REVIEW' && (
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => handleApprove(report)} disabled={processing}
                      className="flex-1 bg-green-600 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1">
                      <Check size={12} /> اعتماد
                    </button>
                    <button onClick={() => { setReviewingReport(report); setShowRejectForm(false); setRejectionReason('') }}
                      className="flex-1 bg-red-100 text-red-700 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                      <X size={12} /> رفض
                    </button>
                  </div>
                )}
                {report.status === 'APPROVED' && (
                  <button onClick={() => navigate(`/admin/emergency/${report.busId}`)}
                    className="mt-2 w-full bg-[var(--color-primary)] text-white py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <Activity size={12} /> فتح أدوات الطوارئ
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bus List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {buses.map(bus => {
          const cfg = STATUS_CONFIG[bus.status] || STATUS_CONFIG.AVAILABLE
          const StatusIcon = cfg.icon
          const isProblematic = bus.status === 'BROKEN_DOWN' || bus.status === 'REPLACED'
          return (
            <motion.button
              key={bus.busId}
              onClick={() => navigate(`/admin/emergency/${bus.busId}`)}
              className={`card p-4 text-right w-full transition-all hover:shadow-md ${isProblematic ? 'ring-2 ring-red-200' : ''}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isProblematic ? 'bg-red-50' : 'bg-blue-50'}`}>
                    {isProblematic ? <AlertTriangle size={20} className="text-red-500" /> : <Bus size={20} className="text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-bold text-lg">باص {bus.busNumber}</p>
                    {bus.driver && <p className="text-xs text-[var(--color-text-muted)]">{bus.driver.name}</p>}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                  <StatusIcon size={12} className="inline ml-1" />
                  {cfg.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <p className="font-bold">{bus.studentCount}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">طلاب</p>
                </div>
                <div>
                  <p className="font-bold">{bus.capacity}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">السعة</p>
                </div>
                <div>
                  <p className="font-bold">{bus.remainingCapacity}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">متبقي</p>
                </div>
              </div>
              <div className="mt-3 bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all ${isProblematic ? 'bg-red-400' : 'bg-blue-500'}`} style={{ width: `${bus.fillPercent}%` }} />
              </div>
            </motion.button>
          )
        })}
      </div>

      {buses.length === 0 && (
        <div className="card p-8 text-center">
          <Bus size={48} className="mx-auto mb-3 text-[var(--color-text-muted)]" />
          <p className="text-[var(--color-text-muted)]">لا توجد باصات في تشغيل اليوم</p>
        </div>
      )}

      {/* ─── REVIEW MODAL ─── */}
      <AnimatePresence>
        {reviewingReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
            onClick={() => { setReviewingReport(null); setShowRejectForm(false); setRejectionReason('') }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-5 max-h-[85vh] overflow-y-auto shadow-xl w-full max-w-[min(95vw,960px)] lg:max-w-3xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-bold mb-4">رفض بلاغ السائق</h3>
              <p className="text-sm text-slate-600 mb-3">
                هل تريد رفض بلاغ السائق {reviewingReport.driverName} للباص {reviewingReport.busNumber}؟
              </p>
              {!showRejectForm ? (
                <div className="flex gap-2">
                  <button onClick={() => { setReviewingReport(null); setRejectReason('') }}
                    className="btn-ghost flex-1 py-2 text-sm">إلغاء</button>
                  <button onClick={() => setShowRejectForm(true)}
                    className="btn-danger flex-1 py-2 text-sm">رفض البلاغ</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">سبب الرفض</label>
                    <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-400"
                      rows={3} placeholder="اكتب سبب الرفض..." />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowRejectForm(false); setRejectionReason('') }}
                      className="btn-ghost flex-1 py-2 text-sm">رجوع</button>
                    <button onClick={() => handleReject(reviewingReport)} disabled={processing || !rejectionReason.trim()}
                      className="btn-danger flex-1 py-2 text-sm disabled:opacity-50">
                      {processing ? 'جاري...' : 'تأكيد الرفض'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Logs */}
      {showLogs && (
        <div className="card p-4">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Activity size={18} /> سجل الطوارئ</h3>
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">لا توجد عمليات طوارئ مسجلة</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 text-sm">
                  <div className="w-2 h-2 rounded-full mt-1.5 bg-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{LOG_ACTIONS[log.action] || log.action}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {log.busNumber && `باص ${log.busNumber} - `}
                      {log.performedBy?.name && `بواسطة ${log.performedBy.name} - `}
                      {new Date(log.createdAt).toLocaleString('ar-SA')}
                    </p>
                    {log.details && log.details.totalStudents && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {log.details.transferredCount || 0} من {log.details.totalStudents} طالب
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const LOG_ACTIONS = {
  DECLARE_BREAKDOWN: 'إعلان تعطل',
  AUTO_TRANSFER: 'نقل تلقائي',
  MANUAL_TRANSFER: 'نقل يدوي',
  REPLACEMENT: 'استبدال باص',
  CANCEL_EMERGENCY: 'إلغاء حالة الطوارئ',
}
