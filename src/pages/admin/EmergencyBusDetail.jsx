import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, AlertTriangle, Bus, Users, Wrench, Truck, 
  UserPlus, Check, X, AlertCircle, RefreshCw, 
  ArrowRight, List, LayoutDashboard
} from 'lucide-react'
import { api } from '../../lib/api'
import { getStudentGenderTone } from '../../lib/studentGender'
import Section from '../../components/ui/Section'
import StatusBadge from '../../components/ui/StatusBadge'

const BREAKDOWN_REASONS = [
  { value: 'MECHANICAL', label: 'عطل ميكانيكي' },
  { value: 'ACCIDENT', label: 'حادث' },
  { value: 'DRIVER_ABSENT', label: 'السائق اعتذر' },
  { value: 'OTHER', label: 'أخرى' },
]

export default function EmergencyBusDetail() {
  const { busId } = useParams()
  const navigate = useNavigate()
  const [operation, setOperation] = useState(null)
  const [busData, setBusData] = useState(null)
  const [allBuses, setAllBuses] = useState([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [breakdownReason, setBreakdownReason] = useState('MECHANICAL')
  const [showAutoTransfer, setShowAutoTransfer] = useState(false)
  const [showManualTransfer, setShowManualTransfer] = useState(false)
  const [showReplace, setShowReplace] = useState(false)
  const [selectedTargets, setSelectedTargets] = useState([])
  const [manualTransfers, setManualTransfers] = useState([])
  const [replaceTargetId, setReplaceTargetId] = useState('')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [opData, busesData] = await Promise.all([
        api.operations.getBusDetail(busId),
        api.emergency.buses(),
      ])
      setOperation(opData)
      setAllBuses(Array.isArray(busesData) ? busesData : [])
      const thisBus = Array.isArray(busesData) ? busesData.find(b => b.busId === busId) : null
      setBusData(thisBus || null)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [busId])

  useEffect(() => { load() }, [load])

  const students = operation?.students || []
  const isBrokenDown = busData?.status === 'BROKEN_DOWN'
  const isReplaced = busData?.status === 'REPLACED'
  const isNormal = !isBrokenDown && !isReplaced
  const availableBuses = allBuses.filter(b => b.busId !== busId && b.status !== 'BROKEN_DOWN' && b.status !== 'REPLACED' && b.remainingCapacity > 0)

  // ─── DECLARE BREAKDOWN ───
  async function handleBreakdown() {
    setProcessing(true)
    try {
      await api.emergency.declareBreakdown(busId, breakdownReason)
      setShowBreakdown(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // ─── AUTO TRANSFER ───
  async function handleAutoTransfer() {
    if (selectedTargets.length === 0) { alert('اختر باص واحد على الأقل'); return }
    setProcessing(true)
    try {
      const res = await api.emergency.autoTransfer(busId, selectedTargets, breakdownReason)
      setResult(res)
      setShowAutoTransfer(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  // ─── MANUAL TRANSFER ───
  async function handleManualTransfer() {
    if (manualTransfers.length === 0) { alert('لم تقم بإضافة أي نقل'); return }
    setProcessing(true)
    try {
      const res = await api.emergency.manualTransfer(busId, manualTransfers, breakdownReason)
      setResult(res)
      setShowManualTransfer(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  function addToManualTransfer(studentId, toBusId) {
    if (!toBusId) return
    setManualTransfers(prev => {
      const filtered = prev.filter(t => t.studentId !== studentId)
      return [...filtered, { studentId, toBusId }]
    })
  }

  function removeManualTransfer(studentId) {
    setManualTransfers(prev => prev.filter(t => t.studentId !== studentId))
  }

  function getStudentTarget(studentId) {
    return manualTransfers.find(t => t.studentId === studentId)
  }

  // ─── REPLACE BUS ───
  async function handleReplace() {
    if (!replaceTargetId) { alert('اختر باصاً للاستبدال'); return }
    setProcessing(true)
    try {
      await api.emergency.replaceBus(busId, replaceTargetId, 'REPLACEMENT')
      setShowReplace(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const totalCapacity = availableBuses.reduce((s, b) => s + b.remainingCapacity, 0)
  const resultTargetSummary = result?.targetBuses ? Object.values(result.targetBuses) : []

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/emergency')} className="btn-ghost p-2"><ArrowLeft size={20} /></button>
          <div className="skeleton h-6 w-40 rounded-lg" />
        </div>
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/emergency')} className="btn-ghost p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">باص {busData?.busNumber || ''}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {busData?.driver?.name || 'بدون سائق'} | {students.length} طالب | {busData?.capacity || '?'} سعة
            </p>
          </div>
        </div>
        <StatusBadge status={isBrokenDown ? 'danger' : isReplaced ? 'warning' : 'success'}>
          {isBrokenDown ? 'متعطل' : isReplaced ? 'مستبدل' : 'يعمل'}
        </StatusBadge>
      </div>

      {/* Emergency Actions */}
      <Section title="إجراءات الطوارئ" icon={AlertTriangle}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {isNormal && (
            <button onClick={() => { setBreakdownReason('MECHANICAL'); setShowBreakdown(true) }} className="card p-4 hover:ring-2 hover:ring-red-300 transition-all text-center">
              <AlertTriangle size={24} className="mx-auto mb-2 text-red-500" />
              <p className="font-medium text-sm">تعطل الباص</p>
              <p className="text-xs text-[var(--color-text-muted)]">إعلان تعطل الباص</p>
            </button>
          )}
          {(isBrokenDown || result) && (
            <>
              <button onClick={() => { setSelectedTargets([]); setShowAutoTransfer(true) }} className="card p-4 hover:ring-2 hover:ring-blue-300 transition-all text-center">
                <Truck size={24} className="mx-auto mb-2 text-blue-500" />
                <p className="font-medium text-sm">نقل تلقائي</p>
                <p className="text-xs text-[var(--color-text-muted)]">توزيع الطلاب تلقائياً</p>
              </button>
              <button onClick={() => { setManualTransfers([]); setShowManualTransfer(true) }} className="card p-4 hover:ring-2 hover:ring-green-300 transition-all text-center">
                <UserPlus size={24} className="mx-auto mb-2 text-green-500" />
                <p className="font-medium text-sm">نقل يدوي</p>
                <p className="text-xs text-[var(--color-text-muted)]">نقل طالب أو أكثر يدوياً</p>
              </button>
            </>
          )}
          {isNormal && (
            <button onClick={() => { setReplaceTargetId(''); setShowReplace(true) }} className="card p-4 hover:ring-2 hover:ring-purple-300 transition-all text-center">
              <RefreshCw size={24} className="mx-auto mb-2 text-purple-500" />
              <p className="font-medium text-sm">استبدال الباص</p>
              <p className="text-xs text-[var(--color-text-muted)]">استبدال بآخر احتياطي</p>
            </button>
          )}
        </div>
      </Section>

      {/* Students List */}
      <Section title={`الطلاب (${students.length})`} icon={Users}>
        {students.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] p-4">لا يوجد طلاب في هذا الباص</p>
        ) : (
          <div className="divide-y">
            {students.map((s, i) => (
              <div key={s.assignment?.id || i} className={`flex items-center justify-between py-2.5 px-1 rounded-xl border ${getStudentGenderTone(s.student?.gender).card}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${getStudentGenderTone(s.student?.gender).avatar}`}>{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{s.student?.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{s.student?.zone || s.student?.institutionName || ''}</p>
                  </div>
                </div>
                {s.attendance && <StatusBadge status={s.attendance.status === 'present' ? 'success' : 'danger'}>{s.attendance.status === 'present' ? 'حاضر' : 'غائب'}</StatusBadge>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ─── BREAKDOWN DIALOG ─── */}
      <AnimatePresence>
        {showBreakdown && (
          <Modal onClose={() => setShowBreakdown(false)} title="إعلان تعطل الباص">
            <p className="text-sm text-[var(--color-text-muted)] mb-4">اختر سبب التعطل:</p>
            <div className="space-y-2 mb-4">
              {BREAKDOWN_REASONS.map(r => (
                <label key={r.value} className={`block p-3 rounded-xl border cursor-pointer transition-all ${breakdownReason === r.value ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="reason" value={r.value} checked={breakdownReason === r.value} onChange={() => setBreakdownReason(r.value)} className="accent-red-500" />
                    <span className="text-sm">{r.label}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowBreakdown(false)} className="btn-ghost flex-1 py-2 text-sm">إلغاء</button>
              <button onClick={handleBreakdown} disabled={processing} className="btn-danger flex-1 py-2 text-sm flex items-center justify-center gap-1">
                {processing ? 'جاري...' : <><AlertTriangle size={16} /> تأكيد التعطل</>}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── AUTO TRANSFER DIALOG ─── */}
      <AnimatePresence>
        {showAutoTransfer && (
          <Modal onClose={() => setShowAutoTransfer(false)} title="النقل التلقائي">
            <p className="text-sm text-[var(--color-text-muted)] mb-2">اختر الباصات المستهدفة (المقاعد المتاحة):</p>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">عدد الطلاب المراد نقلهم: {students.length} | المقاعد المتاحة: {totalCapacity}</p>

            {totalCapacity < students.length && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4 flex items-center gap-2">
                <AlertCircle size={16} /> المقاعد غير كافية. تحتاج {students.length - totalCapacity} مقعد(اً) إضافي(اً)
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {availableBuses.map(b => (
                <label key={b.busId} className={`block p-3 rounded-xl border cursor-pointer transition-all ${selectedTargets.includes(b.busId) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedTargets.includes(b.busId)} onChange={() => {
                        setSelectedTargets(prev => prev.includes(b.busId) ? prev.filter(id => id !== b.busId) : [...prev, b.busId])
                      }} className="accent-blue-500" />
                      <span className="text-sm font-medium">باص {b.busNumber}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{b.remainingCapacity} مقعد</span>
                  </div>
                </label>
              ))}
              {availableBuses.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">لا توجد باصات متاحة</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAutoTransfer(false)} className="btn-ghost flex-1 py-2 text-sm">إلغاء</button>
              <button onClick={handleAutoTransfer} disabled={processing || selectedTargets.length === 0 || totalCapacity < students.length} className="btn-primary flex-1 py-2 text-sm">
                {processing ? 'جاري...' : 'ابدأ النقل التلقائي'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── MANUAL TRANSFER DIALOG ─── */}
      <AnimatePresence>
        {showManualTransfer && (
          <Modal onClose={() => setShowManualTransfer(false)} title="النقل اليدوي" wide>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Students */}
              <div>
                <h4 className="text-sm font-medium mb-2">الطلاب في الباص المعطل</h4>
                <div className="space-y-1.5 max-h-80 overflow-y-auto">
                  {students.map(s => {
                    const target = getStudentTarget(s.student?.id)
                    return (
                      <div key={s.student?.id} className={`p-2 rounded-lg border text-sm ${target ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                        <p className="font-medium">{s.student?.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <select
                            value={target?.toBusId || ''}
                            onChange={e => addToManualTransfer(s.student?.id, e.target.value)}
                            className="text-xs border rounded-lg px-2 py-1 flex-1"
                          >
                            <option value="">اختر باص...</option>
                            {availableBuses.map(b => (
                              <option key={b.busId} value={b.busId} disabled={b.remainingCapacity <= 0}>
                                باص {b.busNumber} ({b.remainingCapacity})
                              </option>
                            ))}
                          </select>
                          {target && (
                            <button onClick={() => removeManualTransfer(s.student?.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Target Buses */}
              <div>
                <h4 className="text-sm font-medium mb-2">الباصات المستهدفة</h4>
                <div className="space-y-2">
                  {availableBuses.map(b => {
                    const assigned = manualTransfers.filter(t => t.toBusId === b.busId).length
                    const remaining = b.remainingCapacity - assigned
                    return (
                      <div key={b.busId} className="p-3 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">باص {b.busNumber}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${remaining <= 0 ? 'bg-red-50 text-red-600' : remaining <= 2 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                            {remaining} مقعد
                          </span>
                        </div>
                        {assigned > 0 && <p className="text-xs text-[var(--color-text-muted)] mt-1">تم تخصيص {assigned} طالب</p>}
                        <div className="mt-2 bg-gray-100 rounded-full h-1">
                          <div className={`h-1 rounded-full ${remaining <= 0 ? 'bg-red-400' : 'bg-blue-400'}`} style={{ width: `${Math.min(100, ((b.remainingCapacity - remaining) / b.remainingCapacity) * 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t">
              <button onClick={() => setShowManualTransfer(false)} className="btn-ghost flex-1 py-2 text-sm">إلغاء</button>
              <button onClick={handleManualTransfer} disabled={processing || manualTransfers.length === 0} className="btn-primary flex-1 py-2 text-sm">
                {processing ? 'جاري...' : `نقل (${manualTransfers.length}) طالب`}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── REPLACE BUS DIALOG ─── */}
      <AnimatePresence>
        {showReplace && (
          <Modal onClose={() => setShowReplace(false)} title="استبدال الباص">
            <p className="text-sm text-[var(--color-text-muted)] mb-4">اختر الباص البديل:</p>
            <div className="space-y-2 mb-4">
              {allBuses.filter(b => b.busId !== busId && b.status !== 'BROKEN_DOWN' && b.status !== 'REPLACED').map(b => (
                <label key={b.busId} className={`block p-3 rounded-xl border cursor-pointer transition-all ${replaceTargetId === b.busId ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input type="radio" name="replaceTarget" value={b.busId} checked={replaceTargetId === b.busId} onChange={() => setReplaceTargetId(b.busId)} className="accent-purple-500" />
                      <span className="text-sm font-medium">باص {b.busNumber}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">{b.studentCount} طالب | {b.remainingCapacity} متبقي</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowReplace(false)} className="btn-ghost flex-1 py-2 text-sm">إلغاء</button>
              <button onClick={handleReplace} disabled={processing || !replaceTargetId} className="btn-primary flex-1 py-2 text-sm">
                {processing ? 'جاري...' : 'تأكيد الاستبدال'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ─── RESULT REPORT ─── */}
      <AnimatePresence>
        {result && (
          <Modal onClose={() => setResult(null)} title="تقرير عملية النقل">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-blue-50">
                  <p className="text-2xl font-bold text-blue-700">{result.transferredCount || 0}</p>
                  <p className="text-xs text-blue-600">تم نقلهم</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50">
                  <p className="text-2xl font-bold text-amber-700">{(result.totalStudents || 0) - (result.transferredCount || 0)}</p>
                  <p className="text-xs text-amber-600">متبقون</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{result.errors?.length || 0}</p>
                  <p className="text-xs text-green-600">أخطاء</p>
                </div>
              </div>

              {result.errors?.length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-700 mb-1">الأخطاء:</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e.reason || e.studentName}</p>
                  ))}
                </div>
              )}

              {result.students && result.students.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">تفاصيل النقل:</p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {result.students.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 text-sm">
                        <ArrowRight size={14} className="text-blue-500 shrink-0" />
                        <span className="flex-1">{s.studentName}</span>
                        <span className="text-[var(--color-text-muted)]">→ باص {s.toBusNumber}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {resultTargetSummary.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">إحصائيات الباصات المستهدفة:</p>
                  {resultTargetSummary.map((b, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm mb-1">
                      <span>باص {b.busNumber}</span>
                      <span className="text-[var(--color-text-muted)]">{b.used} طالب / {b.remaining + b.used} مقعد</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setResult(null)} className="btn-primary w-full py-2 text-sm">حسناً</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}

function Modal({ children, onClose, title, wide }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className={`bg-white rounded-2xl p-5 max-h-[85vh] overflow-y-auto shadow-xl ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}
        onClick={e => e.stopPropagation()}
      >
        {title && <h3 className="text-lg font-bold mb-4">{title}</h3>}
        {children}
      </motion.div>
    </motion.div>
  )
}
