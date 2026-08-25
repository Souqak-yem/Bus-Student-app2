import { useState, useEffect, useCallback } from 'react'
import { useWhatsAppRedirect } from '../../context/WhatsAppContext'
import { api } from '../../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus, Users, Search, Plus, X, GripVertical, Phone, MessageCircle, MapPin } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import ConfirmModal from '../../components/ui/ConfirmModal'
import StatusBadge from '../../components/ui/StatusBadge'
import { getStudentGenderTone } from '../../lib/studentGender'
import { onAdminReadinessUpdate, offAdminReadinessUpdate, onAdminBoardingTimerUpdate, offAdminBoardingTimerUpdate, onAdminReadinessStats, offAdminReadinessStats } from '../../lib/socket'

const STATUS_BADGE = {
  READY: { label: 'جاهز', cls: 'bg-green-100 text-green-700 border-green-200' },
  DELAYED: { label: 'متأخر', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  NO_RESPONSE: { label: 'لم يرد', cls: 'bg-red-100 text-red-700 border-red-200' },
  ON_BOARD: { label: 'داخل الباص', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  MISSED_BUS: { label: 'تغيب', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
}

function ReadinessBadge({ status }) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE.NO_RESPONSE
  return (
    <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${badge.cls}`}>
      {badge.label}
    </span>
  )
}

export default function ReturnDispatchCenter() {
  const openWhatsApp = useWhatsAppRedirect()
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState([])
  const [activeBuses, setActiveBuses] = useState([])
  const [search, setSearch] = useState('')
  const [selectedBus, setSelectedBus] = useState(null)
  const [busLine, setBusLine] = useState('')
  const [busStudents, setBusStudents] = useState([])
  const [draggedIdx, setDraggedIdx] = useState(null)
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [addStudentSearch, setAddStudentSearch] = useState('')
  const [transferMode, setTransferMode] = useState(null)
  const [confirmRemoveQueueId, setConfirmRemoveQueueId] = useState(null)
  const [confirmRemoveBusStudentId, setConfirmRemoveBusStudentId] = useState(null)
  const [readinessStats, setReadinessStats] = useState({})
  const [boardingTimers, setBoardingTimers] = useState({})

  const dateStr = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const loadAll = useCallback(async () => {
    try {
      const [q, ab] = await Promise.all([
        api.return.queue.list().catch(() => []),
        api.return.activeBuses.list().catch(() => []),
      ])
      setQueue(Array.isArray(q) ? q : [])
      setActiveBuses(Array.isArray(ab) ? ab : [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  useEffect(() => {
    const handleReadiness = (payload) => {
      if (!payload) return
      setBusStudents(prev => prev.map(load => {
        if (load.id === payload.busLoadId || load.studentId === payload.studentId) {
          return { ...load, readinessStatus: payload.status, delayMinutes: payload.delayMinutes, delayReason: payload.delayReason, onBoardAt: payload.onBoardAt }
        }
        return load
      }))
      setActiveBuses(prev => prev.map(b => ({
        ...b,
        loads: b.loads ? b.loads.map(l => (l.id === payload.busLoadId || l.studentId === payload.studentId
          ? { ...l, readinessStatus: payload.status, delayMinutes: payload.delayMinutes, delayReason: payload.delayReason, onBoardAt: payload.onBoardAt }
          : l)) : [],
      })))
    }
    const handleStats = (payload) => {
      if (payload?.activeBusId) {
        setReadinessStats(prev => ({ ...prev, [payload.activeBusId]: payload.stats }))
      }
    }
    const handleTimer = (payload) => {
      if (payload?.activeBusId) {
        setBoardingTimers(prev => ({ ...prev, [payload.activeBusId]: payload }))
      }
    }
    onAdminReadinessUpdate(handleReadiness)
    onAdminReadinessStats(handleStats)
    onAdminBoardingTimerUpdate(handleTimer)
    return () => {
      offAdminReadinessUpdate()
      offAdminReadinessStats()
      offAdminBoardingTimerUpdate()
    }
  }, [])

  function openBusPanel(bus) {
    setSelectedBus(bus)
    setBusLine(bus.line || '')
    setBusStudents([...(bus.loads || [])])
    setShowAddStudent(false)
    setTransferMode(null)
    setAddStudentSearch('')
  }

  function closeBusPanel() {
    setSelectedBus(null)
    setBusLine('')
    setBusStudents([])
  }

  async function handleLineChange(line) {
    const previousLine = busLine
    setBusLine(line)
    try {
      await api.return.activeBuses.updateLine(selectedBus.id, line)
      setSelectedBus(prev => prev ? { ...prev, line } : prev)
      setActiveBuses(prev => prev.map(bus => bus.id === selectedBus.id ? { ...bus, line } : bus))
    } catch (err) {
      setBusLine(previousLine)
      alert(err.message)
    }
  }

  async function handleAddToQueue(studentId) {
    try { await api.return.queue.add(studentId, ''); loadAll() } catch (err) { alert(err.message) }
  }

  async function handleRemoveFromQueue(id) {
    setConfirmRemoveQueueId(id)
  }

  async function confirmRemoveQueue() {
    const id = confirmRemoveQueueId
    setConfirmRemoveQueueId(null)
    try { await api.return.queue.remove(id); loadAll() } catch (err) { alert(err.message) }
  }

  async function handleAddToBus(studentId) {
    try {
      await api.return.loads.add(selectedBus.id, studentId, '')
      try {
        await api.returnReadiness.admin.announceAssign(selectedBus.id, studentId).catch(() => {})
      } catch { /* silent */ }
      const [buses, q] = await Promise.all([
        api.return.activeBuses.list().catch(() => []),
        api.return.queue.list().catch(() => []),
      ])
      setActiveBuses(buses)
      setQueue(q)
      const updated = buses.find(b => b.id === selectedBus.id)
      if (updated) {
        setSelectedBus(updated)
        setBusStudents([...(updated.loads || [])])
      }
      setShowAddStudent(false)
    } catch (err) { alert(err.message) }
  }

  async function handleRemoveFromBus(studentId) {
    setConfirmRemoveBusStudentId(studentId)
  }

  async function confirmRemoveBus() {
    const studentId = confirmRemoveBusStudentId
    setConfirmRemoveBusStudentId(null)
    try {
      await api.return.loads.remove(selectedBus.id, studentId)
      loadAll()
      const buses = await api.return.activeBuses.list().catch(() => [])
      setActiveBuses(buses)
      const updated = buses.find(b => b.id === selectedBus.id)
      if (updated) {
        setSelectedBus(updated)
        setBusStudents([...(updated.loads || [])])
      }
    } catch (err) { alert(err.message) }
  }

  async function handleTransfer(targetBusId) {
    if (!transferMode) return
    try {
      await api.return.loads.transfer(transferMode.studentId, transferMode.activeBusId, targetBusId, '')
      loadAll()
      const buses = await api.return.activeBuses.list().catch(() => [])
      setActiveBuses(buses)
      const updated = buses.find(b => b.id === selectedBus.id)
      if (updated) {
        setSelectedBus(updated)
        setBusStudents([...(updated.loads || [])])
      }
      setTransferMode(null)
    } catch (err) { alert(err.message) }
  }

  function handleDragStart(idx) { setDraggedIdx(idx) }

  function handleDragOver(e, idx) {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === idx) return
    const updated = [...busStudents]
    const [moved] = updated.splice(draggedIdx, 1)
    updated.splice(idx, 0, moved)
    setBusStudents(updated)
    setDraggedIdx(idx)
  }

  function handleDragEnd() { setDraggedIdx(null) }

  const filteredQueue = queue.filter(item =>
    !search || item.student?.name?.includes(search) || item.student?.phone?.includes(search)
  )

  const queueNotInBus = queue.filter(item =>
    !selectedBus?.loads?.some(l => l.studentId === item.studentId) &&
    (!addStudentSearch || item.student?.name?.includes(addStudentSearch))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="رحلات العودة" subtitle={`إدارة رحلات العودة · ${dateStr}`} />

      {activeBuses.length > 0 && (() => {
        const totals = activeBuses.reduce((acc, b) => {
          const loads = b.loads || []
          for (const l of loads) {
            const st = l.readinessStatus || 'NO_RESPONSE'
            acc[st] = (acc[st] || 0) + 1
            acc.TOTAL = (acc.TOTAL || 0) + 1
          }
          return acc
        }, {})
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-green-600 mb-1">جاهزون</div>
              <div className="text-2xl font-black text-green-700">{totals.READY || 0}</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-amber-600 mb-1">متأخرون</div>
              <div className="text-2xl font-black text-amber-700">{totals.DELAYED || 0}</div>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-red-600 mb-1">لم يردوا</div>
              <div className="text-2xl font-black text-red-700">{totals.NO_RESPONSE || 0}</div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-blue-600 mb-1">داخل الباص</div>
              <div className="text-2xl font-black text-blue-700">{totals.ON_BOARD || 0}</div>
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Right column: Queue */}
        <div className="lg:col-span-1 order-last lg:order-first">
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 text-sm">
                <Users className="inline w-3.5 h-3.5 ml-1 -mt-0.5" />
                قائمة الانتظار
                <span className="text-xs text-slate-400 mr-1">({queue.length})</span>
              </h3>
              <AddStudentToQueue onAdd={handleAddToQueue} />
            </div>

            <div className="relative mb-2">
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="بحث بالاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pr-8 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
              />
            </div>

            <div className="space-y-1 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredQueue.map(item => {
                const point = item.student?.transportMode === 'HOME'
                  ? (item.student?.homeAddress || item.student?.address)
                  : (item.student?.pickupLocation || item.student?.address)
                const address = [item.student?.zone, point].filter(Boolean).join(' / ') || '---'
                return (
                  <div key={item.id} className={`rounded-lg p-2 border ${getStudentGenderTone(item.student?.gender).card}`}>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm truncate flex-1 min-w-0">{item.student?.name || 'غير معروف'}</span>
                          {item.student?.transportMode && (
                            <StatusBadge status={item.student.transportMode.toLowerCase()} />
                          )}
                          {item.student?.institutionName && (
                            <span className="text-[10px] text-slate-400 truncate shrink-0">{item.student.institutionName}</span>
                          )}
                        </div>
                        {item.student?.destination?.name && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{item.student.destination.name}</div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <MapPin size={8} className="shrink-0" />
                          <span className="truncate">{address}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.student?.phone && (
                          <a href={`tel:${item.student.phone}`}
                            className="w-7 h-7 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                            title="اتصال">
                            <Phone size={12} />
                          </a>
                        )}
                        {item.student?.whatsapp && (
                          <button type="button" onClick={() => openWhatsApp(item.student.whatsapp)}
                            className="w-7 h-7 rounded-full bg-green-600 text-white hover:bg-green-700 flex items-center justify-center transition-colors"
                            title="واتساب">
                            <MessageCircle size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {filteredQueue.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-4">
                  {search ? 'لا توجد نتائج' : 'قائمة الانتظار فارغة'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Left column: Buses */}
        <div className="lg:col-span-2">
          <div className="card p-3">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">
              <Bus className="inline w-3.5 h-3.5 ml-1 -mt-0.5" />
              الباصات
              <span className="text-xs text-slate-400 mr-1">({activeBuses.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeBuses.map(bus => (
                <button
                  key={bus.id}
                  onClick={() => openBusPanel(bus)}
                  className="bg-slate-50 rounded-xl p-3 text-right border border-slate-100 hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-slate-800">باص {bus.bus?.busNumber || '---'}</h4>
                    {bus.status === 'DEPARTED' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-100 text-green-700">
                        منطلق
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{bus.driver?.name ? `السائق: ${bus.driver.name}` : ''}</span>
                    <span className="text-slate-700 font-medium">
                      {bus.loads?.length || 0}/{bus.capacitySnapshot || 0}
                    </span>
                    <span className="text-slate-400">
                      {bus.capacitySnapshot - (bus.loads?.length || 0)}
                    </span>
                  </div>
                </button>
              ))}
              {activeBuses.length === 0 && (
                <div className="col-span-full text-center py-8 text-sm text-slate-400">
                  لا توجد باصات في تشغيل اليوم
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Side panel */}
      <AnimatePresence>
        {selectedBus && (
          <>
            <div className="fixed inset-0 bg-black/30 z-40" onClick={closeBusPanel} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="fixed top-0 left-0 h-full w-full max-w-[min(100vw,1080px)] lg:max-w-[1100px] bg-white z-50 shadow-2xl overflow-y-auto"
            >
              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-slate-800">
                    باص {selectedBus.bus?.busNumber}
                  </h2>
                  <button onClick={closeBusPanel} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">الطريق</p>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="line"
                        value="JEBALI"
                        checked={busLine === 'JEBALI'}
                        onChange={(e) => handleLineChange(e.target.value)}
                        className="w-3.5 h-3.5 text-[var(--color-primary)]"
                      />
                      <span className="text-xs text-slate-700">جبلي</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="line"
                        value="BAHRY"
                        checked={busLine === 'BAHRY'}
                        onChange={(e) => handleLineChange(e.target.value)}
                        className="w-3.5 h-3.5 text-[var(--color-primary)]"
                      />
                      <span className="text-xs text-slate-700">بحري</span>
                    </label>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-slate-700">
                      الطلاب ({busStudents.length})
                    </p>
                    {selectedBus.status !== 'DEPARTED' && (
                      <button
                        onClick={() => { setShowAddStudent(!showAddStudent); setAddStudentSearch('') }}
                        className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        إضافة طالب
                      </button>
                    )}
                  </div>

                  {showAddStudent && selectedBus.status !== 'DEPARTED' && (
                    <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="relative mb-2">
                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                        <input
                          type="text"
                          placeholder="ابحث في قائمة الانتظار..."
                          value={addStudentSearch}
                          onChange={(e) => setAddStudentSearch(e.target.value)}
                          className="w-full pr-7 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-0.5 max-h-40 overflow-y-auto">
                        {queueNotInBus.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleAddToBus(item.studentId)}
                            className="w-full text-right px-2 py-1.5 rounded-lg hover:bg-white text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <span className="font-medium truncate">{item.student?.name}</span>
                            <span className="text-[10px] text-slate-400 truncate">{item.student?.institutionName || ''}</span>
                          </button>
                        ))}
                        {queueNotInBus.length === 0 && (
                          <p className="text-xs text-slate-400 text-center py-2">لا يوجد طلاب في قائمة الانتظار</p>
                        )}
                      </div>
                      <button onClick={() => setShowAddStudent(false)} className="text-xs text-slate-400 mt-1 hover:text-slate-600">
                        إلغاء
                      </button>
                    </div>
                  )}

                  <div className="space-y-0.5">
                    {busStudents.map((load, idx) => {
                      const s = load.student
                      const isHome = s?.transportMode === 'HOME'
                      const isDeparted = selectedBus.status === 'DEPARTED'
                      const readinessStatus = load.readinessStatus || 'NO_RESPONSE'
                      const hasDelay = readinessStatus === 'DELAYED' && load.delayMinutes
                      return (
                        <div
                          key={load.id || load.studentId}
                          draggable={!isDeparted}
                          onDragStart={() => !isDeparted && handleDragStart(idx)}
                          onDragOver={(e) => !isDeparted && handleDragOver(e, idx)}
                          onDragEnd={!isDeparted ? handleDragEnd : undefined}
                          className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-colors ${
                            draggedIdx === idx ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : getStudentGenderTone(s?.gender).card
                          }`}
                        >
                          {!isDeparted && (
                            <div className="cursor-grab text-slate-300 hover:text-slate-500 shrink-0">
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-semibold text-slate-800 text-xs truncate">{s?.name}</span>
                              <ReadinessBadge status={readinessStatus} />
                              {s?.transportMode && (
                                <StatusBadge status={s.transportMode.toLowerCase()} />
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-wrap">
                              {s?.institutionName && <span className="truncate">{s.institutionName}</span>}
                              {s?.destination?.name && <span className="truncate">{s.destination.name}</span>}
                              <span className="truncate">{[s?.zone, isHome ? (s?.homeAddress || s?.address) : (s?.pickupLocation || s?.address)].filter(Boolean).join(' / ') || '---'}</span>
                              {hasDelay && (
                                <span className="shrink-0 text-amber-600">
                                  ⏱ {load.delayMinutes}د {load.delayReason ? `· ${load.delayReason}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isDeparted && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {s?.phone && (
                                <a
                                  href={`tel:${s.phone}`}
                                  className="w-6 h-6 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                                  title="اتصال"
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {s?.whatsapp && (
                                <button
                                  type="button"
                                  onClick={() => openWhatsApp(s.whatsapp)}
                                  className="w-6 h-6 rounded-full bg-green-600 text-white hover:bg-green-700 flex items-center justify-center transition-colors"
                                  title="واتساب"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setTransferMode({ studentId: load.studentId, activeBusId: selectedBus.id })}
                                className="w-6 h-6 rounded text-blue-600 hover:bg-blue-50 flex items-center justify-center text-xs transition-colors"
                                title="تحويل"
                              >
                                &#8646;
                              </button>
                              <button
                                onClick={() => handleRemoveFromBus(load.studentId)}
                                className="w-6 h-6 rounded text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                                title="حذف"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {busStudents.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-6">لا يوجد طلاب في هذا الباص</p>
                    )}
                  </div>
                </div>

                {transferMode && selectedBus.status !== 'DEPARTED' && (
                  <div className="mb-3 p-2 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs font-semibold text-blue-800 mb-1.5">تحويل الطالب إلى:</p>
                    <div className="space-y-0.5 max-h-40 overflow-y-auto">
                      {activeBuses.filter(b => b.id !== selectedBus.id).map(b => (
                        <button
                          key={b.id}
                          onClick={() => handleTransfer(b.id)}
                          className="w-full text-right px-2 py-1.5 rounded-lg hover:bg-white text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Bus className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="font-medium truncate">باص {b.bus?.busNumber}</span>
                          <span className="text-[10px] text-slate-400 mr-auto truncate">{b.driver?.name || ''}</span>
                        </button>
                      ))}
                      {activeBuses.filter(b => b.id !== selectedBus.id).length === 0 && (
                        <p className="text-xs text-slate-500">لا توجد باصات أخرى</p>
                      )}
                    </div>
                    <button onClick={() => setTransferMode(null)} className="text-[10px] text-slate-500 mt-0.5 hover:text-slate-700">
                      إلغاء
                    </button>
                  </div>
                )}

                {(() => {
                  const busTimer = boardingTimers[selectedBus.id] || selectedBus.boardingTimer
                  const stats = readinessStats[selectedBus.id] || busStudents.reduce((acc, l) => {
                    const st = l.readinessStatus || 'NO_RESPONSE'
                    acc[st] = (acc[st] || 0) + 1
                    return acc
                  }, { READY: 0, DELAYED: 0, NO_RESPONSE: 0, ON_BOARD: 0, MISSED_BUS: 0 })
                  const totals = { READY: 0, DELAYED: 0, NO_RESPONSE: 0, ON_BOARD: 0, MISSED_BUS: 0, ...stats }
                  return (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-slate-700 mb-1.5">إحصائيات الجاهزية لهذا الباص</div>
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        <div className="bg-green-50 rounded-lg p-1.5 text-center border border-green-100">
                          <div className="text-xs font-black text-green-700">{totals.READY || 0}</div>
                          <div className="text-[9px] text-green-600">جاهز</div>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-1.5 text-center border border-amber-100">
                          <div className="text-xs font-black text-amber-700">{totals.DELAYED || 0}</div>
                          <div className="text-[9px] text-amber-600">متأخر</div>
                        </div>
                        <div className="bg-red-50 rounded-lg p-1.5 text-center border border-red-100">
                          <div className="text-xs font-black text-red-700">{totals.NO_RESPONSE || 0}</div>
                          <div className="text-[9px] text-red-600">لم يرد</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-1.5 text-center border border-blue-100">
                          <div className="text-xs font-black text-blue-700">{totals.ON_BOARD || 0}</div>
                          <div className="text-[9px] text-blue-600">بالداخل</div>
                        </div>
                      </div>
                      {selectedBus.status !== 'DEPARTED' && busTimer && (
                        <div className="bg-slate-50 rounded-lg p-2 border border-slate-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-slate-600">العد التنازلي للصعود</span>
                            <span className={`text-[10px] font-black ${busTimer.endedAt ? 'text-red-600' : 'text-green-600'}`}>
                              {busTimer.endedAt ? 'انتهى' : 'يعمل'}
                            </span>
                          </div>
                          <TimerDisplay timer={busTimer} />
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                  <button
                    onClick={closeBusPanel}
                    className="w-full bg-slate-100 text-slate-600 py-2 rounded-xl font-medium text-xs hover:bg-slate-200 transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        show={!!confirmRemoveQueueId}
        onClose={() => setConfirmRemoveQueueId(null)}
        onConfirm={confirmRemoveQueue}
        title="تأكيد الحذف من قائمة الانتظار"
        danger
      >
        هل أنت متأكد من حذف هذا الطالب من قائمة الانتظار؟
      </ConfirmModal>

      <ConfirmModal
        show={!!confirmRemoveBusStudentId}
        onClose={() => setConfirmRemoveBusStudentId(null)}
        onConfirm={confirmRemoveBus}
        title="تأكيد حذف الطالب من الباص"
        danger
      >
        هل أنت متأكد من حذف هذا الطالب من الباص؟
      </ConfirmModal>
    </div>
  )
}

function TimerDisplay({ timer }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  const start = new Date(timer.startedAt)
  const effectiveNow = new Date(Date.now())
  const durationMs = (timer.durationMinutes || 15) * 60 * 1000
  const endMs = start.getTime() + durationMs
  const remainingMs = Math.max(0, endMs - effectiveNow.getTime())
  const elapsedMs = Math.max(0, durationMs - remainingMs)
  const pct = Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100))
  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)
  const isEnded = remainingMs <= 0 || timer.endedAt
  return (
    <div>
      <div className="text-center mb-1">
        <span className={`text-2xl font-black font-mono ${remainingMs <= 60000 ? 'text-red-600 animate-pulse' : remainingMs <= 5 * 60000 ? 'text-amber-600' : 'text-slate-700'}`}>
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all duration-1000 ${isEnded ? 'bg-red-500' : remainingMs <= 5 * 60000 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function AddStudentToQueue({ onAdd }) {
  const [search, setSearch] = useState('')
  const [students, setStudents] = useState([])
  const [show, setShow] = useState(false)

  async function handleSearch(q) {
    setSearch(q)
    if (q.length < 1) { setStudents([]); return }
    try {
      const data = await api.students.list({ search: q, status: 'active' })
      setStudents(Array.isArray(data) ? data.slice(0, 10) : [])
    } catch (err) { console.error(err) }
  }

  return (
    <div className="relative z-20 flex justify-end">
      {!show ? (
        <button onClick={() => setShow(true)} className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" />
          إضافة
        </button>
      ) : (
        <div
          dir="rtl"
          className="fixed top-20 right-3 z-[60] w-[min(88vw,420px)] max-w-[min(95vw,440px)] lg:max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-3"
          style={{ left: 'auto', right: '0.75rem', top: '5.5rem' }}
        >
          <input
            type="text"
            placeholder="ابحث عن طالب..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full text-sm py-2.5 px-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] text-right"
            autoFocus
          />
          <div className="mt-2 space-y-1 max-h-44 overflow-y-auto text-right">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => { onAdd(s.id); setSearch(''); setStudents([]); setShow(false) }}
                className="w-full text-right px-1.5 py-1 rounded-lg hover:bg-slate-50 text-xs flex items-center gap-1.5 transition-colors"
              >
                <span className="font-medium truncate">{s.name}</span>
                <span className="text-[10px] text-slate-400 truncate">{s.institutionName || ''}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { setShow(false); setSearch(''); setStudents([]) }} className="text-[10px] text-slate-400 mt-0.5 hover:text-slate-600 transition-colors">
            إلغاء
          </button>
        </div>
      )}
    </div>
  )
}
