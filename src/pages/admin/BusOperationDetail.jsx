import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Bus, Users, Clock, Search, Plus, ChevronDown, ArrowUpDown, Phone, MapPin, ArrowLeftRight, Check } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import { api } from '../../lib/api'
import { getStudentGenderTone } from '../../lib/studentGender'
import { connectSocket, joinBusRoom, leaveBusRoom, onTrackingUpdate, offTrackingUpdate } from '../../lib/socket'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmModal from '../../components/ui/ConfirmModal'

const dayNames = { SATURDAY: 'السبت', SUNDAY: 'الأحد', MONDAY: 'الإثنين', TUESDAY: 'الثلاثاء', WEDNESDAY: 'الأربعاء', THURSDAY: 'الخميس', FRIDAY: 'الجمعة' }

export default function BusOperationDetail({ busId, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [line, setLine] = useState('JEBALI')
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showTransfer, setShowTransfer] = useState(null)
  const [transferStudentId, setTransferStudentId] = useState('')
  const [transferBusId, setTransferBusId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [bulkAdj, setBulkAdj] = useState('add')
  const [bulkMins, setBulkMins] = useState(10)
  const [tracking, setTracking] = useState(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showConfirm, setShowConfirm] = useState(null)

  async function load() {
    try {
      const data = await api.operations.getBusDetail(busId)
      setDetail(data)
      setLine(data.line)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [busId])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) connectSocket(token)
  }, [])

  useEffect(() => {
    const abId = busId
    if (abId) {
      joinBusRoom(abId)
      api.tracking.get(abId).then(setTracking).catch(() => {})
      onTrackingUpdate((state) => {
        if (state.activeBusId === abId) setTracking(state)
      })
      return () => {
        leaveBusRoom(abId)
        offTrackingUpdate()
      }
    }
  }, [busId])

  function toMinutes(time) {
    if (!time) return 24 * 60
    const parts = String(time).split(':')
    const h = Number(parts[0] || 0)
    const m = Number(parts[1] || 0)
    if (Number.isNaN(h) || Number.isNaN(m)) return 24 * 60
    return h * 60 + m
  }

  const sortedStudents = (detail?.students || []).slice().sort((a, b) => {
    const aTime = a.assignment?.pickupTime || a.templatePickupTime || null
    const bTime = b.assignment?.pickupTime || b.templatePickupTime || null
    return toMinutes(aTime) - toMinutes(bTime)
  })

  async function handleLineChange(newLine) {
    setLine(newLine)
    try { await api.operations.updateBusLine(busId, newLine) } catch (err) { alert(err.message) }
  }

  async function handleCancelTrip() {
    try {
      await api.operations.cancelTrip(busId)
      setShowCancelConfirm(false)
      load()
    } catch (err) { alert(err.message) }
  }

  async function handleRemove(assignmentId, studentName) {
    setShowConfirm({ assignmentId, studentName })
  }

  async function handleConfirmed() {
    const { assignmentId } = showConfirm
    setShowConfirm(null)
    try { await api.operations.removeStudent(busId, assignmentId); load() } catch (err) { alert(err.message) }
  }

  async function handleAddStudent(studentId) {
    setSubmitting(true)
    try {
      await api.operations.addStudent(busId, studentId)
      setShowAdd(false); setAddSearch(''); load()
    } catch (err) { alert(err.message) } finally { setSubmitting(false) }
  }

  async function handlePickupTimeChange(assignmentId, pickupTime) {
    await api.operations.updateAssignment(busId, assignmentId, { pickupTime })
    load()
  }

  async function handleTransfer() {
    if (!transferBusId || !transferStudentId) return
    setTransferring(true)
    try {
      await api.operations.transferStudent(busId, transferBusId, transferStudentId)
      setShowTransfer(null); setTransferStudentId(''); setTransferBusId(''); load(); onRefresh()
    } catch (err) { alert(err.message) } finally { setTransferring(false) }
  }

  const filteredAvailable = detail?.availableStudents?.filter(s =>
    s.name?.toLowerCase().includes(addSearch.toLowerCase()) || s.phone?.includes(addSearch)
  ) || []

  if (loading || !detail) {
    return (
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="modal-overlay" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5"><div className="skeleton h-8 w-48 rounded mb-4" />{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 w-full rounded mb-2" />)}</div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="modal-content max-w-5xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-lighter)] flex items-center justify-center">
                <Bus size={20} className="text-[var(--color-primary-dark)]" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{detail.bus?.busNumber || 'باص'}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {detail.bus?.driver?.name || detail.bus?.driverName ? `السائق: ${detail.bus.driver?.name || detail.bus.driverName}` : 'بدون سائق'}
                  {detail.bus?.vehicleType ? ` · ${detail.bus.vehicleType}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-[var(--color-border-light)] p-1 rounded-xl">
                <button onClick={() => handleLineChange('JEBALI')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${line === 'JEBALI' ? 'bg-white shadow-sm text-[var(--color-primary-dark)]' : 'text-[var(--color-text-muted)]'}`}>جبالي</button>
                <button onClick={() => handleLineChange('BAHRY')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${line === 'BAHRY' ? 'bg-white shadow-sm text-[var(--color-primary-dark)]' : 'text-[var(--color-text-muted)]'}`}>بحري</button>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-border-light)]"><X size={20} /></button>
            </div>
          </div>

          <div className="p-5 max-h-[70vh] overflow-y-auto">
            <div className="flex gap-3 mb-4">
              <div className="flex-1 p-3 rounded-xl bg-[var(--color-border-light)] text-center">
                <p className="text-2xl font-bold text-[var(--color-primary-dark)]">{detail.students?.length || 0}</p>
                <p className="text-xs text-[var(--color-text-muted)]">الطلاب</p>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-[var(--color-border-light)] text-center">
                <p className="text-2xl font-bold text-green-600">{detail.students?.filter(s => s.attendance?.status === 'present').length || 0}</p>
                <p className="text-xs text-[var(--color-text-muted)]">حاضر</p>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-[var(--color-border-light)] text-center">
                <p className="text-2xl font-bold text-orange-600">{detail.students?.filter(s => s.subscription?.paymentStatus !== 'paid').length || 0}</p>
                <p className="text-xs text-[var(--color-text-muted)]">غير مسدد</p>
              </div>
              <div className="flex-1 p-3 rounded-xl bg-[var(--color-border-light)] text-center">
                <p className="text-2xl font-bold text-blue-600">{detail.templateStudentCount || 0}</p>
                <p className="text-xs text-[var(--color-text-muted)]">القالب</p>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">حالة الرحلة:</span>
                <StatusBadge status={
                  !tracking?.busStatus ? 'pending' :
                  tracking.busStatus === 'AVAILABLE' ? 'pending' :
                  tracking.busStatus === 'DEPARTED' || tracking.busStatus === 'LOADING' ? 'active' :
                  tracking.busStatus === 'ARRIVED' ? 'paid' :
                  tracking.busStatus === 'CANCELLED' || tracking.busStatus === 'BROKEN_DOWN' ? 'inactive' : 'pending'
                } label={
                  !tracking?.busStatus ? 'جاري التحميل...' :
                  tracking.busStatus === 'AVAILABLE' ? 'مجدولة' :
                  tracking.busStatus === 'DEPARTED' || tracking.busStatus === 'LOADING' ? 'قيد التنفيذ' :
                  tracking.busStatus === 'ARRIVED' ? 'مكتملة' :
                  tracking.busStatus === 'CANCELLED' ? 'ملغية' :
                  tracking.busStatus === 'BROKEN_DOWN' ? 'ملغية - عطل' : 'غير محددة'
                } />
              </div>
              {tracking?.busStatus && !['ARRIVED', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'].includes(tracking.busStatus) && (
                <button onClick={() => setShowCancelConfirm(true)} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
                  إلغاء الرحلة
                </button>
              )}
            </div>

            {tracking && tracking.busStatus === 'ARRIVED' && (
              <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-700">اكتملت رحلة الذهاب</p>
                    <p className="text-xs text-green-600">تم استلام {tracking.pickedUpCount} / {tracking.total} طالب</p>
                  </div>
                </div>
              </div>
            )}
            {tracking && tracking.busStatus !== 'ARRIVED' && (
              <div className="mb-4 p-4 rounded-xl bg-[var(--color-border-light)]">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-700">تقدم الرحلة</h4>
                  {tracking.currentStudent && (
                    <span className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full font-medium">
                      الطالب الحالي: {tracking.currentStudent.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500">تم استلام {tracking.pickedUpCount} / {tracking.total}</span>
                  <span className="text-xs font-bold text-[var(--color-primary)]">
                    {tracking.total > 0 ? `${Math.round((tracking.pickedUpCount / tracking.total) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-500"
                    style={{ width: tracking.total > 0 ? `${(tracking.pickedUpCount / tracking.total) * 100}%` : '0%' }} />
                </div>
                {tracking.nextStudent && (
                  <p className="text-xs text-slate-500 mt-2">التالي: {tracking.nextStudent.name}</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setShowAdd(!showAdd)} className="btn-ghost btn-sm">
                <Plus size={14} /> {showAdd ? 'إخفاء' : 'إضافة طالب لهذه الرحلة (مؤقت)'}
              </button>
              <button onClick={() => setShowBulk(true)} className="btn-ghost btn-sm">
                <Clock size={14} /> تعديل وقت الجميع (مؤقت)
              </button>
            </div>

            {showAdd && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 p-3 rounded-xl bg-[var(--color-border-light)] space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input type="text" placeholder="بحث عن طالب..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="input-field pr-8 py-1.5 text-sm" />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] text-center py-4">لا يوجد طلاب متاحون</p>
                  ) : filteredAvailable.map(s => (
                    <button key={s.id} onClick={() => handleAddStudent(s.id)} disabled={submitting}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-white text-sm flex items-center justify-between transition-colors">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{s.institutionName || s.major || ''}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">ملاحظة: الإضافة مؤقتة لرحلة اليوم فقط ولا تؤثر على القالب</p>
              </motion.div>
            )}

            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <table className="w-full border-collapse border-spacing-0">
                <thead className="max-sm:hidden">
                  <tr>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10 w-8">#</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">الطالب</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">وقت الصعود</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">الهاتف</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">العنوان</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">الاشتراك</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">الحضور</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10">الحالة</th>
                    <th className="text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-white sticky top-0 z-10 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((item, idx) => {
                    const subStatus = item.subscription?.paymentStatus
                    const attStatus = item.attendance?.status
                    return (
                      <tr key={item.assignment?.id || item.student?.id || `temp-${idx}`} className={`transition-colors hover:bg-[var(--color-border-light)] max-sm:block max-sm:mb-2 max-sm:rounded-xl max-sm:border max-sm:bg-white max-sm:p-3 max-sm:hover:bg-white ${getStudentGenderTone(item.student?.gender).card}`}>

                        {/* Mobile card */}
                        <td colSpan={9} className="sm:hidden block p-0 border-0">
                          <div className={`flex flex-col gap-1.5 rounded-xl border p-2 ${getStudentGenderTone(item.student?.gender).card}`}>
                            {/* Header: avatar + name/inst | trip status */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getStudentGenderTone(item.student?.gender).avatar}`}>
                                  {item.student.name?.[0] || '?'}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate leading-tight">{item.student.name}</p>
                                  <p className="text-[11px] text-gray-500 truncate leading-tight">{item.student.institutionName || ''} {item.student.major || ''}</p>
                                </div>
                              </div>
                              <StatusBadge status={
                                !tracking?.busStatus ? 'pending' :
                                tracking.busStatus === 'AVAILABLE' ? 'pending' :
                                tracking.busStatus === 'DEPARTED' || tracking.busStatus === 'LOADING' ? 'active' :
                                tracking.busStatus === 'ARRIVED' ? 'paid' :
                                tracking.busStatus === 'CANCELLED' || tracking.busStatus === 'BROKEN_DOWN' ? 'inactive' : 'pending'
                              } label={
                                !tracking?.busStatus ? 'جاري التحميل...' :
                                tracking.busStatus === 'AVAILABLE' ? 'مجدولة' :
                                tracking.busStatus === 'DEPARTED' || tracking.busStatus === 'LOADING' ? 'قيد التنفيذ' :
                                tracking.busStatus === 'ARRIVED' ? 'مكتملة' :
                                tracking.busStatus === 'CANCELLED' ? 'ملغية' :
                                tracking.busStatus === 'BROKEN_DOWN' ? 'ملغية - عطل' : 'غير محددة'
                              } />
                            </div>

                            {/* Details: pickup time, phone, address */}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock size={10} />
                                <input
                                  type="time"
                                  defaultValue={item.assignment.pickupTime || item.templatePickupTime || ''}
                                  onBlur={e => handlePickupTimeChange(item.assignment.id, e.target.value)}
                                  className="w-20 px-1 py-0.5 border border-[var(--color-border)] rounded text-[11px]"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Phone size={10} />
                                {item.student.phone || '-'}
                              </div>
                              <div className="flex items-center gap-1 max-w-[160px]">
                                <MapPin size={10} className="shrink-0" />
                                <span className="truncate">
                                  {item.student.transportMode === 'HOME'
                                    ? (item.student.homeAddress || '-')
                                    : (item.student.pickupLocation || '-')}
                                </span>
                              </div>
                            </div>

                            {/* Bottom: badges + actions */}
                            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 w-full">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(() => {
                                  if (item.financialStatus === 'SUSPENDED') return <StatusBadge status="inactive" label="موقوف" />
                                  if (item.financialStatus === 'GRACE_PERIOD') return <StatusBadge status="pending" label="مهلة" />
                                  if (item.financialStatus === 'OVERDUE') return <StatusBadge status="inactive" label="متأخر" />
                                  if (item.financialStatus === 'SETTLED') return <StatusBadge status="paid" label="مسدد" />
                                  if (item.subscription && subStatus === 'paid') return <StatusBadge status="paid" label="مسدد" />
                                  if (item.subscription && subStatus === 'partial') return <StatusBadge status="partial" label="جزئي" />
                                  return <StatusBadge status="pending" label="غير مسدد" />
                                })()}
                                {item.attendance ? (
                                  <StatusBadge status={attStatus === 'present' ? 'active' : attStatus === 'absent' ? 'inactive' : 'pending'}
                                    label={attStatus === 'present' ? 'حاضر' : attStatus === 'absent' ? 'غائب' : 'بعذر'} />
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                {detail.todayActiveBuses?.length > 0 && (
                                  <button
                                    onClick={() => { setShowTransfer(item.student.id); setTransferStudentId(item.student.id); setTransferBusId('') }}
                                    className="text-xs px-3 py-1.5 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center gap-1"
                                  >
                                    <ArrowLeftRight size={10} /> نقل
                                  </button>
                                )}
                                <button onClick={() => handleRemove(item.assignment.id, item.student.name)}
                                  className="px-3 py-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 text-xs font-medium">
                                  حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Desktop cells */}
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] text-xs text-[var(--color-text-muted)] max-sm:hidden">{idx + 1}</td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${getStudentGenderTone(item.student?.gender).avatar}`}>
                              {item.student.name?.[0] || '?'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{item.student.name}</p>
                              <p className="text-[10px] text-[var(--color-text-muted)]">{item.student.institutionName || ''} {item.student.major || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <div className="flex items-center gap-1">
                            <input
                              type="time"
                              defaultValue={item.assignment.pickupTime || item.templatePickupTime || ''}
                              onBlur={e => handlePickupTimeChange(item.assignment.id, e.target.value)}
                              className="w-20 px-1.5 py-1 border border-[var(--color-border)] rounded-lg text-xs"
                              title="تعديل وقت الصعود لهذه الرحلة فقط"
                            />
                            {item.templatePickupTime && item.templatePickupTime !== item.assignment.pickupTime && (
                              <span className="text-[10px] text-[var(--color-text-muted)]">(القالب: {item.templatePickupTime})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <div className="text-xs">
                            <div className="flex items-center gap-1">
                              <Phone size={10} className="text-[var(--color-text-muted)]" />
                              {item.student.phone || '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <div className="text-xs flex items-start gap-1 max-w-[140px]">
                            <MapPin size={10} className="text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                            <span className="truncate">
                              {item.student.transportMode === 'HOME'
                                ? (item.student.homeAddress || '-')
                                : (item.student.pickupLocation || '-')}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <div className="flex items-center gap-1">
                            {(() => {
                              if (item.financialStatus === 'SUSPENDED') return <StatusBadge status="inactive" label="موقوف" />
                              if (item.financialStatus === 'GRACE_PERIOD') return <StatusBadge status="pending" label="مهلة" />
                              if (item.financialStatus === 'OVERDUE') return <StatusBadge status="inactive" label="متأخر" />
                              if (item.financialStatus === 'SETTLED') return <StatusBadge status="paid" label="مسدد" />
                              if (item.subscription && subStatus === 'paid') return <StatusBadge status="paid" label="مسدد" />
                              if (item.subscription && subStatus === 'partial') return <StatusBadge status="partial" label="جزئي" />
                              return <StatusBadge status="pending" label="غير مسدد" />
                            })()}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          {item.attendance ? (
                            <StatusBadge status={attStatus === 'present' ? 'active' : attStatus === 'absent' ? 'inactive' : 'pending'}
                              label={attStatus === 'present' ? 'حاضر' : attStatus === 'absent' ? 'غائب' : 'بعذر'} />
                          ) : <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <StatusBadge status={
                            !tracking?.busStatus ? 'pending' :
                            tracking.busStatus === 'AVAILABLE' ? 'pending' :
                            tracking.busStatus === 'DEPARTED' || tracking.busStatus === 'LOADING' ? 'active' :
                            tracking.busStatus === 'ARRIVED' ? 'paid' :
                            tracking.busStatus === 'CANCELLED' || tracking.busStatus === 'BROKEN_DOWN' ? 'inactive' : 'pending'
                          } label={
                            !tracking?.busStatus ? 'جاري التحميل...' :
                            tracking.busStatus === 'AVAILABLE' ? 'مجدولة' :
                            tracking.busStatus === 'DEPARTED' || tracking.busStatus === 'LOADING' ? 'قيد التنفيذ' :
                            tracking.busStatus === 'ARRIVED' ? 'مكتملة' :
                            tracking.busStatus === 'CANCELLED' ? 'ملغية' :
                            tracking.busStatus === 'BROKEN_DOWN' ? 'ملغية - عطل' : 'غير محددة'
                          } />
                        </td>
                        <td className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[var(--color-border-light)] max-sm:hidden">
                          <div className="flex items-center gap-1">
                            {detail.todayActiveBuses?.length > 0 && (
                              <button
                                onClick={() => { setShowTransfer(item.student.id); setTransferStudentId(item.student.id); setTransferBusId('') }}
                                className="text-xs px-1.5 py-1 rounded-lg text-blue-600 hover:bg-blue-50"
                                title="نقل إلى باص آخر"
                              >
                                <ArrowLeftRight size={12} />
                              </button>
                            )}
                            <button onClick={() => handleRemove(item.assignment.id, item.student.name)}
                              className="text-xs px-1.5 py-1 rounded-lg text-[var(--color-danger)] hover:bg-red-50">
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
              جميع التعديلات في هذه النافذة مؤقتة لرحلة اليوم فقط ولا تؤثر على القالب أو البيانات الدائمة
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Select student for transfer */}
      {showTransfer === 'SELECT' && (
        <Modal
          show={true}
          title="اختر الطالب للنقل"
          onClose={() => setShowTransfer(null)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button onClick={() => setShowTransfer(null)} className="btn-ghost btn-sm">إلغاء</button>
            </div>
          }
        >
          <p className="text-sm text-[var(--color-text-muted)] mb-3">اختر طالباً من هذه الرحلة لتحديد باص الهدف.</p>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {detail.students?.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center">لا يوجد طلاب في هذه الرحلة.</p>
            ) : detail.students.map(item => (
              <button
                key={item.student.id}
                onClick={() => { setShowTransfer(item.student.id); setTransferStudentId(item.student.id); setTransferBusId('') }}
                className="w-full text-right px-3 py-2.5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-light)] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.student.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{item.student.institutionName || item.student.major || item.student.phone || 'بدون تفاصيل'}</p>
                  </div>
                  <span className="text-[var(--color-primary)] text-xs">اختيار</span>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Transfer dialog */}
      {showTransfer && showTransfer !== 'SELECT' && (
        <Modal
          show={true}
          title="نقل طالب إلى باص آخر"
          onClose={() => setShowTransfer(null)}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[var(--color-text-muted)]">النقل مؤقت لليوم فقط</span>
              <div className="flex gap-2">
                <button onClick={() => setShowTransfer(null)} className="btn-ghost btn-sm">إلغاء</button>
                <button onClick={async () => {
                  if (showTransfer === 'ALL') {
                    if (!transferBusId) return alert('اختر باص الهدف')
                    try {
                      await api.operations.transferAllStudents(busId, transferBusId)
                      setShowTransfer(null); load(); onRefresh()
                    } catch (err) { alert(err.message) }
                    return
                  }
                  handleTransfer()
                }} disabled={(!transferBusId || (showTransfer !== 'ALL' && !transferStudentId)) || transferring} className="btn-primary btn-sm">
                  {transferring ? 'جاري...' : 'نقل'}
                </button>
              </div>
            </div>
          }
        >
          {showTransfer !== 'ALL' && transferStudentId && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-[var(--color-border-light)] text-sm">
              <span className="font-medium">الطالب:</span> {detail.students?.find(item => item.student.id === transferStudentId)?.student.name || 'غير محدد'}
            </div>
          )}
          <p className="text-sm text-[var(--color-text-muted)] mb-3">اختر الباص الهدف:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {detail.todayActiveBuses?.map(b => (
              <button
                key={b.id}
                onClick={() => setTransferBusId(b.id)}
                className={`w-full text-right px-3 py-2.5 rounded-xl border transition-all max-sm:flex-col max-sm:gap-1 ${
                  transferBusId === b.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-lighter)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                }`}
              >
                <div className="flex items-center gap-2 w-full">
                  <Bus size={16} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className="font-medium">{b.busNumber || 'باص'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mr-7 max-sm:mr-0">
                  <span>{b.driver?.name || ''}</span>
                  <span>السعة: {b.capacity}</span>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <Modal
          show={true}
          title={<span className="text-red-600">تأكيد إلغاء الرحلة</span>}
          onClose={() => setShowCancelConfirm(false)}
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button onClick={() => setShowCancelConfirm(false)} className="btn-ghost btn-sm">تراجع</button>
              <button onClick={handleCancelTrip} className="btn-primary btn-sm bg-red-600 hover:bg-red-700">تأكيد الإلغاء</button>
            </div>
          }
        >
          <div className="text-sm text-slate-600 space-y-3">
            <p>هل أنت متأكد من إلغاء رحلة الذهاب لهذا الباص؟</p>
            <p className="text-xs text-slate-400">سيتم تسجيل الطلاب غير المحددين كغائبين، وإلغاء جميع تخصيصات الرحلة.</p>
          </div>
        </Modal>
      )}

      {/* Bulk pickup modal */}
      {showBulk && (
        <Modal
          show={true}
          title="تعديل وقت جميع الطلاب"
          onClose={() => setShowBulk(false)}
          footer={
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[var(--color-text-muted)]">التعديل مؤقت لليوم فقط</span>
              <div className="flex gap-2">
                <button onClick={() => setShowBulk(false)} className="btn-ghost btn-sm">إلغاء</button>
                <button onClick={async () => {
                  if (!bulkMins || bulkMins < 1 || bulkMins > 120) return alert('الرجاء إدخال عدد دقائق صحيح (1-120)')
                  try { await api.operations.bulkPickupTime(busId, bulkAdj, bulkMins); setShowBulk(false); load() } catch (err) { alert(err.message) }
                }} className="btn-primary btn-sm">تطبيق</button>
              </div>
            </div>
          }
        >
          <p className="text-sm text-[var(--color-text-muted)] mb-3">نوع العملية</p>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setBulkAdj('add')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${bulkAdj === 'add' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-border-light)]'}`}>زيادة الوقت</button>
            <button onClick={() => setBulkAdj('subtract')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${bulkAdj === 'subtract' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-border-light)]'}`}>إنقاص الوقت</button>
          </div>
          <label className="text-sm text-[var(--color-text-muted)] mb-1 block">عدد الدقائق</label>
          <input type="number" min="1" max="120" step="1" placeholder="أدخل عدد الدقائق"
            value={bulkMins} onChange={(e) => setBulkMins(e.target.value === '' ? '' : parseInt(e.target.value))}
            className="input-field w-full text-center text-lg py-2 mb-1" />
          <p className="text-[10px] text-[var(--color-text-muted)]">الحد الأدنى 1 - الحد الأقصى 120 دقيقة</p>
        </Modal>
      )}
    </AnimatePresence>
  )
}
