import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bus as BusIcon, ArrowRight, Users, Calendar, Clock, User, Phone, MapPin, X, GraduationCap, Home, GripVertical, ArrowLeftRight, Timer, CheckSquare, AlertTriangle, Plus } from 'lucide-react'
import { api } from '../../../lib/api'
import Modal from '../../../components/ui/Modal'
import PageHeader from '../../../components/ui/PageHeader'
import Section from '../../../components/ui/Section'
import StatusBadge from '../../../components/ui/StatusBadge'
import ResponsiveKpiGrid from '../../../components/ui/ResponsiveKpiGrid'
import { SkeletonCard } from '../../../components/ui/Skeleton'

export default function BusDetails() {
  const { id } = useParams()
  const [bus, setBus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('students')
  const [allStudents, setAllStudents] = useState([])
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState(new Set())
  const [submittingTemplate, setSubmittingTemplate] = useState(false)
  const [orderedStudents, setOrderedStudents] = useState([])
  const [dragIndex, setDragIndex] = useState(null)
  const [allBusRecords, setAllBusRecords] = useState([])
  const [transferTarget, setTransferTarget] = useState(null)
  const [availableBuses, setAvailableBuses] = useState([])
  const [tempTransfers, setTempTransfers] = useState({ outgoing: [], incoming: [] })
  const [selectedForTransfer, setSelectedForTransfer] = useState(new Set())
  const [showTempTransferModal, setShowTempTransferModal] = useState(false)
  const [tempTransferBusId, setTempTransferBusId] = useState('')
  const [tempTransferDays, setTempTransferDays] = useState(1)
  const [submittingTempTransfer, setSubmittingTempTransfer] = useState(false)
  const [showBulkPickupModal, setShowBulkPickupModal] = useState(false)
  const [bulkPickupAdjustment, setBulkPickupAdjustment] = useState('add')
  const [bulkPickupMinutes, setBulkPickupMinutes] = useState(10)

  const load = useCallback(async () => {
    try {
      const data = await api.buses.get(id)
      setBus(data)
      // preload students for template management
      try {
        const studs = await api.students.list({ status: 'active' })
        setAllStudents(studs)
      } catch (e) { setAllStudents([]) }
      // load permanent student order
      try {
        const orderData = await api.busStudentOrder.get(id)
        const orderMap = new Map()
        orderData.order?.forEach((o, i) => orderMap.set(o.studentId, i))
        const sorted = [...(data.templateStudents || [])].sort((a, b) => {
          const aTime = a.pickupTime || '99:99'
          const bTime = b.pickupTime || '99:99'
          const timeComparison = aTime.localeCompare(bTime)
          if (timeComparison !== 0) return timeComparison

          const ai = orderMap.has(a.studentId) ? orderMap.get(a.studentId) : 999
          const bi = orderMap.has(b.studentId) ? orderMap.get(b.studentId) : 999
          return ai - bi
        })
        setOrderedStudents(sorted)
      } catch (e) {
        setOrderedStudents(data.templateStudents || [])
      }
      // load all bus records for transfer
      try {
        const allBuses = await api.buses.list({ status: 'active' })
        setAvailableBuses(allBuses.filter(b => b.id !== id))
        const allRecs = await api.busStudents.listAll()
        setAllBusRecords(allRecs)
      } catch (e) {}
      // load temp transfers for this bus
      try {
        const transferData = await api.tempTransfers.forBus(id)
        setTempTransfers(transferData)
      } catch (e) {}
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div>
        <PageHeader title="تفاصيل الحافلة" subtitle="جاري التحميل..." />
        <ResponsiveKpiGrid>{[1,2,3].map(i => <SkeletonCard key={i} />)}</ResponsiveKpiGrid>
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-4 sm:p-6 mt-6"><div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}</div></div>
      </div>
    )
  }

  if (!bus) {
    return (
      <div>
        <PageHeader title="الحافلة غير موجودة" />
        <Link to="/admin/buses" className="link text-sm">العودة إلى قائمة الحافلات</Link>
      </div>
    )
  }

  function handleDragStart(idx) { setDragIndex(idx) }

  function handleDragOver(e, idx) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === idx) return
    const updated = [...orderedStudents]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(idx, 0, moved)
    setOrderedStudents(updated)
    setDragIndex(idx)
  }

  async function handleDrop() {
    setDragIndex(null)
    if (!bus) return
    const studentIds = orderedStudents.map(s => s.studentId || s.student?.id)
    try {
      await api.busStudentOrder.reorder(bus.id, studentIds, false, true)
    } catch (err) {
      console.error(err)
    }
  }

  function studentAddress(bs) {
    const s = bs.student
    if (s?.transportMode === 'HOME') return s.homeAddress || '-'
    return s?.pickupLocation || '-'
  }

  const tabs = [
    { key: 'students', label: 'الطلاب' },
    { key: 'trips', label: 'الرحلات' },
    { key: 'info', label: 'المعلومات' },
  ]

  return (
    <div>
      <PageHeader
        title={`حافلة ${bus.busNumber}`}
        subtitle={`${bus.vehicleType || ''}${bus.driver?.name || bus.driverName ? ` · السائق: ${bus.driver?.name || bus.driverName}` : ''}`.trim()}
      >
        <Link to="/admin/buses" className="btn-ghost btn-sm"><ArrowRight size={16} /> العودة</Link>
      </PageHeader>

      {/* Bus overview cards */}
      <ResponsiveKpiGrid className="mb-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-2 sm:p-3 lg:p-4 flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="w-8 sm:w-11 lg:w-14 h-8 sm:h-11 lg:h-14 rounded-xl sm:rounded-2xl gradient-primary flex items-center justify-center shrink-0">
            <BusIcon size={14} className="sm:size-5 lg:size-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs lg:text-sm text-[var(--color-text-secondary)] font-medium">رقم الباص</p>
            <p className="text-sm sm:text-lg lg:text-xl font-bold truncate">{bus.busNumber}</p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-2 sm:p-3 lg:p-4 flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="w-8 sm:w-11 lg:w-14 h-8 sm:h-11 lg:h-14 rounded-xl sm:rounded-2xl gradient-accent flex items-center justify-center shrink-0">
            <Users size={14} className="sm:size-5 lg:size-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs lg:text-sm text-[var(--color-text-secondary)] font-medium">الطلاب</p>
            <p className="text-sm sm:text-lg lg:text-xl font-bold">{bus.templateStudents?.length || 0}</p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.075 }} className="card p-2 sm:p-3 lg:p-4 flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="w-8 sm:w-11 lg:w-14 h-8 sm:h-11 lg:h-14 rounded-xl sm:rounded-2xl gradient-secondary flex items-center justify-center shrink-0">
            <User size={14} className="sm:size-5 lg:size-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs lg:text-sm text-[var(--color-text-secondary)] font-medium">السائق</p>
            <p className="text-xs sm:text-base lg:text-lg font-bold truncate">{bus.driver?.name || bus.driverName || 'غير معرف'}</p>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-2 sm:p-3 lg:p-4 flex items-center gap-2 sm:gap-3 lg:gap-4">
          <div className="w-8 sm:w-11 lg:w-14 h-8 sm:h-11 lg:h-14 rounded-xl sm:rounded-2xl gradient-success flex items-center justify-center shrink-0">
            <Clock size={14} className="sm:size-5 lg:size-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs lg:text-sm text-[var(--color-text-secondary)] font-medium">الحالة</p>
            <StatusBadge status={bus.status === 'active' ? 'active' : 'maintenance'} />
          </div>
        </motion.div>
      </ResponsiveKpiGrid>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`tab ${activeTab === tab.key ? 'tab-active' : ''}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'students' && (
        <Section title={`الطلاب (${orderedStudents.length || 0})`} icon={Users}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs text-[var(--color-text-muted)]">اسحب وأفلت لترتيب الطلاب</p>
              <button onClick={() => setShowBulkPickupModal(true)} className="btn-ghost btn-sm" title="تعديل وقت الجميع">
                <Timer size={14} /> تعديل وقت الجميع
              </button>
            </div>
            <div className="flex items-center gap-2">
              {selectedForTransfer.size > 0 && (
                <button onClick={() => setShowTempTransferModal(true)} className="btn-primary btn-sm">
                  <ArrowLeftRight size={14} /> تحويل مؤقت ({selectedForTransfer.size})
                </button>
              )}
              <button onClick={() => { const ids = new Set(orderedStudents.map(bs => bs.studentId || bs.student?.id)); setSelectedTemplateIds(ids); setShowTemplateModal(true) }} className="btn-ghost btn-sm">إدارة قالب الحافلة</button>
            </div>
          </div>
          {orderedStudents.length === 0 && tempTransfers.incoming.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">لا يوجد طلاب مسجلين في هذه الحافلة</div>
          ) : (
            <div className="space-y-1">
              {orderedStudents.map((bs, idx) => {
                const studentId = bs.studentId || bs.student?.id
                const outgoingInfo = tempTransfers.outgoing.find(t => t.studentId === studentId)
                const isOutgoing = !!outgoingInfo
                return (
                  <div key={bs.id} draggable={!isOutgoing} onDragStart={() => !isOutgoing && handleDragStart(idx)} onDragOver={(e) => !isOutgoing && handleDragOver(e, idx)} onDrop={!isOutgoing ? handleDrop : undefined} onDragEnd={() => !isOutgoing && setDragIndex(null)}
                    className={`grid gap-2 p-2 sm:p-3 rounded-xl transition-colors sm:grid-cols-[1fr_auto] ${isOutgoing ? 'opacity-40' : dragIndex === idx ? 'opacity-50 bg-[var(--color-primary-lighter)]' : 'hover:bg-[var(--color-border-light)]'}`}>
                    <div className="grid gap-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 w-full sm:justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <input type="checkbox" disabled={isOutgoing} checked={selectedForTransfer.has(studentId)} onChange={() => setSelectedForTransfer(prev => { const n = new Set(prev); if (n.has(studentId)) n.delete(studentId); else n.add(studentId); return n })}
                            className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/50 shrink-0" />
                          {!isOutgoing && <div className="cursor-grab active:cursor-grabbing text-[var(--color-text-muted)] shrink-0"><GripVertical size={16} /></div>}
                          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-lighter)] flex items-center justify-center text-sm font-bold text-[var(--color-primary-dark)] shrink-0">{bs.student?.name?.[0] || '?'}</div>
                          <p className="text-sm font-medium truncate">{bs.student?.name || 'غير معروف'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 justify-end sm:justify-start lg:justify-end">
                          <div className="flex items-center gap-1 rounded-xl bg-[var(--color-border-light)] px-1.5 py-0.5">
                            <Clock size={10} className="text-[var(--color-text-muted)]" />
                            <input type="time" value={bs.pickupTime || '07:00'} onChange={async (e) => { try { await api.busStudents.update(bus.id, bs.studentId, { pickupTime: e.target.value }); await load() } catch (err) { alert(err.message) } }}
                              className="text-[10px] bg-transparent border-none p-0 min-w-[72px] sm:min-w-[88px] text-center" />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={bs.student?.transportMode === 'HOME' ? 'home' : 'line'} />
                            {isOutgoing && <StatusBadge status="warning" label={`محول`} />}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-2 text-xs text-[var(--color-text-muted)] lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:flex-nowrap min-w-0">
                          {bs.student?.institutionName && <span className="flex items-center gap-1 truncate"><GraduationCap size={10} /> {bs.student.institutionName}</span>}
                          <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {studentAddress(bs)}</span>
                        </div>
                      </div>
                    </div>
                    {!isOutgoing && (
                      <div className="flex justify-end items-start w-full sm:w-auto">
                        <button onClick={() => setTransferTarget(bs)} className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors" title="نقل دائم"><ArrowLeftRight size={14} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
              {tempTransfers.incoming.map(t => (
                <div key={t.id} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-[var(--color-primary-lighter)]/30 max-sm:flex-col max-sm:gap-1">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-warning)]/20 flex items-center justify-center text-sm font-bold text-[var(--color-warning)] shrink-0">{t.student?.name?.[0] || '?'}</div>
                    <p className="text-sm font-medium truncate">{t.student?.name}</p>
                    <StatusBadge status="warning" label={`منقول`} className="mr-auto shrink-0" />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] pr-10">من باص {t.fromBus?.busNumber || ''} حتى {new Date(t.endDate).toLocaleDateString('ar-SA')}</p>
                </div>
              ))}
            </div>
          )}
          {/* Bulk pickup modal */}
          {showBulkPickupModal && (
            <div className="modal-overlay" onClick={() => setShowBulkPickupModal(false)}>
              <div className="modal-content max-w-[min(95vw,520px)] sm:max-w-[min(90vw,620px)] lg:max-w-[720px] p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">تعديل وقت الجميع</h2>
                  <button onClick={() => setShowBulkPickupModal(false)} className="p-1 rounded hover:bg-[var(--color-border-light)]"><X size={18} /></button>
                </div>
                <p className="text-sm text-[var(--color-text-muted)] mb-4">تعديل وقت الصعود لجميع طلاب القالب (التعديل دائم)</p>
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setBulkPickupAdjustment('add')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${bulkPickupAdjustment === 'add' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-border-light)]'}`}>زيادة</button>
                  <button onClick={() => setBulkPickupAdjustment('subtract')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${bulkPickupAdjustment === 'subtract' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-border-light)]'}`}>إنقاص</button>
                </div>
                <div className="mb-4">
                  <label className="text-sm text-[var(--color-text-muted)] mb-1 block">عدد الدقائق</label>
                  <input type="number" min="1" max="120" step="1" placeholder="أدخل عدد الدقائق"
                    value={bulkPickupMinutes} onChange={(e) => setBulkPickupMinutes(e.target.value === '' ? '' : parseInt(e.target.value))} 
                    className="input-field w-full text-center text-lg py-2" />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">الحد الأدنى 1 دقيقة - الحد الأقصى 120 دقيقة</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setShowBulkPickupModal(false)} className="btn-ghost btn-sm">إلغاء</button>
                  <button onClick={async () => {
                    if (!bulkPickupMinutes || bulkPickupMinutes < 1 || bulkPickupMinutes > 120) return alert('الرجاء إدخال عدد دقائق صحيح (1-120)')
                    try { await api.busStudents.bulkPickupTime(bus.id, bulkPickupAdjustment, bulkPickupMinutes); setShowBulkPickupModal(false); await load() } catch (err) { alert(err.message) }
                  }} className="btn-primary btn-sm">تطبيق</button>
                </div>
              </div>
            </div>
          )}
          {/* Template management modal */}
          {showTemplateModal && (
            <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
              <div className="modal-content max-w-[min(95vw,1080px)] lg:max-w-[1150px] p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold">إدارة قالب الحافلة</h2>
                  <button onClick={() => setShowTemplateModal(false)} className="p-1 rounded hover:bg-[var(--color-border-light)]"><X size={18} /></button>
                </div>
                <div className="space-y-2 mb-4">
                  <p className="text-sm text-[var(--color-text-muted)]">اختر الطلاب. الطلاب المضافون إلى باص آخر لا يمكن اختيارهم.</p>
                </div>
                <div className="max-h-64 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y mb-4">
                  {(() => {
                    const elsewhereMap = new Map()
                    allBusRecords.forEach(r => { if (r.busId !== bus.id) elsewhereMap.set(r.student.id, r.bus.busNumber) })
                    return allStudents.map(s => {
                      const elsewhere = elsewhereMap.get(s.id)
                      return <label key={s.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${elsewhere ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--color-border-light)] cursor-pointer'}`}>
                        <input type="checkbox" disabled={!!elsewhere} checked={selectedTemplateIds.has(s.id)} onChange={() => setSelectedTemplateIds(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })}
                          className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/50" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><span className="font-medium truncate">{s.name}</span>{s.institutionName && <span className="text-xs text-[var(--color-text-muted)] mr-auto">{s.institutionName}</span>}</div>
                          <p className="text-xs text-[var(--color-text-muted)]">{s.phone || '-'} · {s.transportMode === 'HOME' ? (s.homeAddress || '-') : (s.pickupLocation || '-')}{elsewhere && <span className="text-[var(--color-danger)] mr-1">مضاف إلى باص {elsewhere}</span>}</p>
                        </div>
                      </label>
                    })
                  })()}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setShowTemplateModal(false)} className="btn-ghost">إلغاء</button>
                  <button onClick={async () => {
                    setSubmittingTemplate(true)
                    try {
                      const currentIds = new Set(orderedStudents.map(bs => bs.studentId || bs.student?.id))
                      const toAdd = [...selectedTemplateIds].filter(id => !currentIds.has(id))
                      const toRemove = [...currentIds].filter(id => !selectedTemplateIds.has(id))
                      for (const sid of toAdd) { await api.busStudents.add(bus.id, sid) }
                      for (const sid of toRemove) { await api.busStudents.remove(bus.id, sid) }
                      await load(); setShowTemplateModal(false)
                    } catch (err) { alert(err.message) } finally { setSubmittingTemplate(false) }
                  }} className="btn-primary" disabled={submittingTemplate}>{submittingTemplate ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>
                </div>
              </div>
            </div>
          )}
          {/* Permanent transfer modal */}
          <Modal show={!!transferTarget} onClose={() => setTransferTarget(null)} title={<h2 className="text-lg font-bold">نقل دائم</h2>}>
            <p className="text-sm text-gray-500 mb-4">نقل <strong>{transferTarget?.student?.name}</strong> من الباص <strong>{bus.busNumber}</strong> إلى:</p>
            {availableBuses.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد باصات أخرى متاحة</p>
            ) : (
              <div className="space-y-2">
                {availableBuses.map(b => <button key={b.id} onClick={async () => { try { await api.busStudents.transfer(transferTarget.studentId || transferTarget.student?.id, bus.id, b.id, transferTarget.pickupTime); setTransferTarget(null); await load() } catch (err) { alert(err.response?.data?.error || err.message) } }} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors text-right">
                  <div><p className="text-sm font-medium">حافلة {b.busNumber}</p><p className="text-xs text-gray-500">{b.driver?.name || b.driverName || 'بدون سائق'}</p></div><ArrowLeftRight size={16} className="text-gray-400 shrink-0" />
                </button>)}
              </div>
            )}
          </Modal>
          {/* Temp transfer modal */}
          <Modal
            show={showTempTransferModal}
            onClose={() => setShowTempTransferModal(false)}
            title={<h2 className="text-lg font-bold">تحويل مؤقت</h2>}
            footer={
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setShowTempTransferModal(false)} className="btn-ghost btn-sm">إلغاء</button>
                <button onClick={async () => {
                  if (!tempTransferBusId) return alert('اختر باصاً')
                  setSubmittingTempTransfer(true)
                  try { for (const studentId of selectedForTransfer) { await api.tempTransfers.create(studentId, bus.id, tempTransferBusId, tempTransferDays) } setShowTempTransferModal(false); setSelectedForTransfer(new Set()); setTempTransferBusId(''); await load() } catch (err) { alert(err.message) } finally { setSubmittingTempTransfer(false) }
                }} className="btn-primary btn-sm" disabled={!tempTransferBusId || submittingTempTransfer}>{submittingTempTransfer ? 'جاري...' : 'تنفيذ التحويل'}</button>
              </div>
            }
          >
            <p className="text-sm text-gray-500 mb-3">تحويل <strong>{selectedForTransfer.size}</strong> طالب إلى:</p>
            <div className="space-y-1 mb-4">
              {availableBuses.map(b => <button key={b.id} onClick={() => setTempTransferBusId(b.id)} className={`w-full text-right px-3 py-2 rounded-xl border text-sm transition-all ${tempTransferBusId === b.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                <span className="font-medium">حافلة {b.busNumber}</span> <span className="text-xs text-gray-500 mr-2">{b.driver?.name || b.driverName || ''}</span>
              </button>)}
            </div>
            <p className="text-sm text-gray-500 mb-2">المدة:</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map(d => <button key={d} onClick={() => setTempTransferDays(d)} className={`py-2 rounded-xl text-sm font-medium transition-all ${tempTransferDays === d ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>{d} {d === 1 ? 'يوم' : 'أيام'}</button>)}
            </div>
          </Modal>
        </Section>
      )}

      {activeTab === 'trips' && (
        <Section title="الرحلات الأخيرة" icon={Calendar}>
          {bus.assignments?.length === 0 ? (
            <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">لا توجد رحلات مسجلة</div>
          ) : (
            <div className="space-y-1">
              {bus.assignments.slice(0, 20).map((a, idx) => (
                <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-border-light)] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                    <span className="text-sm">{new Date(a.date).toLocaleDateString('ar-SA')}</span>
                    <StatusBadge status={a.line?.toLowerCase()} />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{a.student?.name || a.studentId}</span>
                </motion.div>
              ))}
            </div>
          )}
        </Section>
      )}

      {activeTab === 'info' && (
        <Section title="معلومات الحافلة" icon={BusIcon}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoRow icon={User} label="السائق" value={bus.driver?.name || bus.driverName || 'غير معين'} />
            <InfoRow icon={Phone} label="جوال السائق" value={bus.driver?.phone || bus.primaryPhone || '-'} />
            <InfoRow icon={BusIcon} label="نوع المركبة" value={bus.vehicleType || '-'} />
            <InfoRow icon={BusIcon} label="اللون" value={bus.color || '-'} />
            <InfoRow icon={Users} label="السعة" value={`${bus.capacity} مقعد`} />
            <InfoRow icon={Clock} label="تاريخ الإضافة" value={new Date(bus.createdAt).toLocaleDateString('ar-SA')} />
          </div>
        </Section>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-border-light)]">
      <Icon size={16} className="text-[var(--color-text-muted)] shrink-0" />
      <div>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
