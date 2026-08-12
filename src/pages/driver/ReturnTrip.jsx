import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { connectSocket, joinBusRoom, leaveBusRoom, onReadinessUpdate, offReadinessUpdate, onBoardingTimerUpdate, offBoardingTimerUpdate, onDriverOperationUpdate, offDriverOperationUpdate, joinDriverBusRoom, leaveDriverBusRoom } from '../../lib/socket'
import { useNotifications } from '../../context/NotificationContext'
import { MapPin, Home, Check, Clock, Users, Bus, CheckSquare, Square, X, PlayCircle, StopCircle } from 'lucide-react'
import { getStudentGenderTone } from '../../lib/studentGender'

const READINESS_LABELS = {
  NO_RESPONSE: { label: 'لم يرد', cls: 'bg-red-100 text-red-700 border-red-200' },
  READY: { label: 'جاهز', cls: 'bg-green-100 text-green-700 border-green-200' },
  DELAYED: { label: 'متأخر', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  ON_BOARD: { label: 'صعد', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  MISSED_BUS: { label: 'فات', cls: 'bg-slate-200 text-slate-600 border-slate-300' },
}

function getLineLabel(line) {
  if (line === 'JEBALI') return 'جبلي'
  if (line === 'BAHRY') return 'بحري'
  return 'غير محدد'
}

function BoardingTimerBar({ timer }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  if (!timer || timer.endedAt) return null
  const startedAt = timer.serverNow ? new Date(timer.serverNow) : new Date()
  const offsetMs = timer.startedAt ? (startedAt.getTime() - new Date(timer.startedAt).getTime()) : 0
  const effectiveNow = new Date(now.getTime() + offsetMs)
  const start = new Date(timer.startedAt)
  const durationMs = (timer.durationMinutes || 15) * 60 * 1000
  const endMs = start.getTime() + durationMs
  const remainingMs = Math.max(0, endMs - effectiveNow.getTime())
  const elapsedMs = Math.max(0, durationMs - remainingMs)
  const pct = Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100))
  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock size={16} className="text-indigo-600" />
          <span className="text-xs font-bold text-indigo-800">العد التنازلي لتسجيل الصعود</span>
        </div>
        <span className="text-3xl font-black font-mono tracking-tight text-indigo-700">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="w-full bg-white rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${remainingMs <= 60000 ? 'bg-red-500 animate-pulse' : remainingMs <= 5 * 60000 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function ReturnTrip() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const [loading, setLoading] = useState(true)
  const [noReturnTrip, setNoReturnTrip] = useState(false)

  const [phase, setPhase] = useState('idle')
  const [buses, setBuses] = useState([])
  const [selectedBus, setSelectedBus] = useState(null)
  const [loads, setLoads] = useState([])
  const [boardingTimer, setBoardingTimer] = useState(null)

  const [dropoffIndex, setDropoffIndex] = useState(0)
  const [droppedOffCount, setDroppedOffCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState(1)

  const loadData = useCallback(async () => {
    try {
      const data = await api.returnReadiness.driver.checklist().catch(() => null)
      if (!data?.operationExists || !data?.buses || data.buses.length === 0) {
        setNoReturnTrip(true)
        setLoading(false)
        return
      }
      setBuses(data.buses)
      if (data.buses.length === 1) {
        selectBus(data.buses[0])
      }
      setLoading(false)
    } catch (err) {
      console.error(err)
      setNoReturnTrip(true)
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  function selectBus(bus) {
    setSelectedBus(bus)
    setLoads(bus.loads || [])
    setBoardingTimer(bus.boardingTimer || null)
    const anyDropped = (bus.loads || []).some(l => l.onBoardAt)
    const isDeparted = bus.status === 'DEPARTED'
    const isBoarding = bus.status === 'BOARDING' || bus.status === 'BOARDING_TIME_ENDED'
    if (isDeparted) {
      const validLoads = (bus.loads || []).filter(l => l.readinessStatus === 'ON_BOARD')
      setLoads(validLoads)
      setPhase('dropoff')
    } else if (isBoarding || (bus.boardingTimer && !bus.boardingTimer.endedAt)) {
      setPhase('boarding')
    } else {
      setPhase('checklist')
    }
    if (bus.id) joinBusRoom(bus.id)
  }

  useEffect(() => {
    if (!selectedBus?.id) return
    const abId = selectedBus.id
    const busId = selectedBus.bus?.id
    if (busId) joinDriverBusRoom(busId)

    onReadinessUpdate((payload) => {
      if (!payload || payload.activeBusId !== abId) return
      setLoads((prev) => prev.map(l => {
        if (l.id === payload.busLoadId || l.studentId === payload.studentId) {
          return { ...l, readinessStatus: payload.status, delayMinutes: payload.delayMinutes, delayReason: payload.delayReason, onBoardAt: payload.onBoardAt }
        }
        return l
      }))
    })
    onBoardingTimerUpdate((payload) => {
      if (!payload || payload.activeBusId !== abId) return
      setBoardingTimer(payload)
      const status = payload.status
      if (status === 'BOARDING' || (payload.startedAt && !payload.endedAt)) {
        setSelectedBus((prev) => prev ? { ...prev, status: status || prev.status || 'BOARDING' } : prev)
        setPhase((prev) => (prev === 'dropoff' || prev === 'completed' || prev === 'just_completed') ? prev : 'boarding')
      } else if (status === 'BOARDING_TIME_ENDED') {
        setSelectedBus((prev) => prev ? { ...prev, status: 'BOARDING_TIME_ENDED' } : prev)
        setPhase((prev) => (prev === 'dropoff' || prev === 'completed' || prev === 'just_completed') ? prev : 'boarding')
      }
    })
    onDriverOperationUpdate((payload) => {
      if (payload.type === 'driver_bus_removed' || payload.type === 'driver_trip_cancelled') {
        setNoReturnTrip(true)
      }
      if (payload.type === 'return:boarding-started' && payload.activeBusId === abId) {
        setSelectedBus((prev) => prev ? { ...prev, status: payload.status || 'BOARDING' } : prev)
        setPhase((prev) => (prev === 'dropoff' || prev === 'completed' || prev === 'just_completed') ? prev : 'boarding')
      }
      if (payload.type === 'return:boarding-time-ended' && payload.activeBusId === abId) {
        setSelectedBus((prev) => prev ? { ...prev, status: payload.status || 'BOARDING_TIME_ENDED' } : prev)
        setPhase((prev) => (prev === 'dropoff' || prev === 'completed' || prev === 'just_completed') ? prev : 'boarding')
      }
      if (payload.priority === 'CRITICAL' && payload.title) {
        addNotification(payload.title, payload.message || '', 'CRITICAL')
      }
    })
    return () => {
      leaveBusRoom(abId)
      if (busId) leaveDriverBusRoom(busId)
      offReadinessUpdate()
      offBoardingTimerUpdate()
      offDriverOperationUpdate()
    }
  }, [selectedBus?.id, addNotification])

  async function handleMarkOnBoard(studentId) {
    if (!selectedBus?.id) return
    try {
      await api.returnReadiness.driver.onBoard(selectedBus.id, studentId)
      setLoads((prev) => prev.map(l => l.studentId === studentId ? { ...l, readinessStatus: 'ON_BOARD', onBoardAt: new Date().toISOString() } : l))
    } catch (e) { alert(e.message) }
  }

  async function handleStartTimer() {
    if (!selectedBus?.id) return
    try {
      await api.returnReadiness.driver.startTimer(selectedBus.id)
    } catch (e) {
      alert(e?.message || 'تعذر بدء العداد')
    }
  }

  async function handleStopTimer() {
    if (!selectedBus?.id) return
    try {
      await api.returnReadiness.driver.stopTimer(selectedBus.id)
      setBoardingTimer(null)
    } catch (e) { alert(e.message) }
  }

  async function handleDispatchBoarding() {
    if (!selectedBus?.id) return
    const boarders = loads.filter(l => l.readinessStatus === 'ON_BOARD')
    const pending = loads.filter(l => l.readinessStatus !== 'ON_BOARD')
    if (boarders.length === 0 && !window.confirm('لا يوجد طلاب تم تسجيل صعودهم حتى الآن. هل تريد الانطلاق بالفعل؟')) {
      return
    }
    if (pending.length > 0) {
      const proceed = window.confirm(`يوجد ${pending.length} طالب لم يصعدوا بعد. هل تريد الانطلاق؟`)
      if (!proceed) return
    }
    setSubmitting(true)
    try {
      await api.return.dispatchByDriver(selectedBus.id)
      setDirection(1)
      setDropoffIndex(0)
      setDroppedOffCount(0)
      setLoads(boarders)
      setSelectedBus((prev) => prev ? { ...prev, status: 'DEPARTED' } : prev)
      setPhase('dropoff')
    } catch (e) { alert(e?.message || 'تعذر تنفيذ عملية الانطلاق') }
    finally { setSubmitting(false) }
  }

  async function handleDropoff() {
    if (dropoffIndex >= loads.length || dropoffIndex < 0) return
    const studentId = loads[dropoffIndex]?.studentId
    if (!studentId || submitting || !selectedBus?.id) return
    setSubmitting(true)
    try {
      await api.return.loads.dropoff(selectedBus.id, studentId)
      setDroppedOffCount((prev) => prev + 1)
      if (dropoffIndex < loads.length - 1) {
        setDirection(1)
        setDropoffIndex((prev) => prev + 1)
      } else {
        setPhase('completed')
      }
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  async function handleEndReturnTrip() {
    try {
      await api.return.complete(selectedBus?.id)
      setPhase('just_completed')
    } catch (err) { console.error(err) }
  }

  const stats = useMemo(() => {
    const c = { READY: 0, DELAYED: 0, NO_RESPONSE: 0, ON_BOARD: 0, MISSED_BUS: 0, total: loads.length }
    for (const l of loads) {
      const s = l.readinessStatus || 'NO_RESPONSE'
      c[s] = (c[s] || 0) + 1
    }
    return c
  }, [loads])

  const pendingLoads = loads.filter(l => l.readinessStatus !== 'ON_BOARD')
  const onBoardLoads = loads.filter(l => l.readinessStatus === 'ON_BOARD')
  const lineLabel = !selectedBus?.line
    ? 'غير محدد'
    : selectedBus.line === 'BAHRY'
      ? 'بحري'
      : selectedBus.line === 'JEBALI'
        ? 'جبلي'
        : 'غير محدد'

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-14 h-14 rounded-2xl gradient-primary text-white flex items-center justify-center animate-pulse shadow-card">
          <Bus className="w-7 h-7" />
        </div>
        <div className="text-slate-400 text-sm">جاري التحميل...</div>
      </div>
    )
  }

  if (noReturnTrip) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-10 max-w-sm text-center fade-in-up">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">لا توجد رحلة عودة لهذا اليوم.</h2>
        </div>
      </div>
    )
  }

  if (phase === 'just_completed') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-4 text-center fade-in-up">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-2 ring-1 ring-green-100">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-slate-800">تم إنهاء رحلة العودة</h2>
        </div>
      </div>
    )
  }

  if (phase === 'completed') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card p-4 text-center fade-in-up">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-2 ring-1 ring-green-100">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-3">اكتمل إنزال جميع الطلاب</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-slate-50 rounded-xl p-2">
              <p className="text-lg font-bold text-slate-800">{loads.length}</p>
              <p className="text-[10px] text-slate-500">إجمالي الطلاب</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2">
              <p className="text-lg font-bold text-green-700">{droppedOffCount}</p>
              <p className="text-[10px] text-green-600">تم الإنزال</p>
            </div>
          </div>
          <button
            onClick={handleEndReturnTrip}
            className="w-full gradient-primary text-white py-3.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all min-h-[48px] shadow-[0_8px_24px_-6px_rgba(37,99,235,0.55)] active:scale-[0.98]"
          >
            إنهاء رحلة العودة
          </button>
        </div>
      </div>
    )
  }

  if (!selectedBus) {
    return (
      <div className="max-w-lg mx-auto space-y-2">
        <div className="card p-4 fade-in-up">
          <h1 className="text-lg font-bold text-slate-800 mb-1">اختر الباص</h1>
          <p className="text-xs text-slate-500 mb-3">يوجد أكثر من باص مخصص لك اليوم</p>
          <div className="space-y-2">
            {buses.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBus(b)}
                className="w-full bg-slate-50 hover:bg-slate-100 rounded-xl p-3 text-right border border-slate-200 transition-colors hover:border-[var(--color-primary)]/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">باص {b.bus?.busNumber || b.bus?.plateNumber}</p>
                    <p className="text-[10px] text-slate-500">{b.loads?.length || 0} طالب</p>
                  </div>
                  <Bus size={20} className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'dropoff') {
    const currentLoad = loads[dropoffIndex]
    const currentStudent = currentLoad?.student
    const isHomeDelivery = currentStudent?.transportMode === 'HOME'
    const dropoffLocation = isHomeDelivery
      ? (currentStudent?.homeAddress || null)
      : (currentStudent?.pickupLocation || currentStudent?.address || null)
    const remaining = loads.length - (dropoffIndex + 1)

    return (
      <div className="max-w-lg mx-auto space-y-2 pb-4">
        <div className="card px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">باص {selectedBus.bus?.busNumber}</span>
            <div className="text-left">
              <p className="text-xs font-bold text-[var(--color-primary)]">
                {dropoffIndex + 1} / {loads.length}
              </p>
              <p className="text-[10px] text-slate-400">المتبقي: {remaining}</p>
            </div>
          </div>
          <div className="progress-track h-1.5 mt-2">
            <div className="progress-fill"
              style={{ width: `${((dropoffIndex + 1) / loads.length) * 100}%`, background: 'linear-gradient(90deg, #22C55E 0%, #16A34A 60%, #15803D 100%)' }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={dropoffIndex}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.2 }}
            className={`card p-3.5 shadow-pop ${getStudentGenderTone(currentStudent?.gender).card}`}
          >
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-slate-800">{currentStudent?.name}</h2>
              {currentStudent?.institutionName && (
                <p className="text-xs text-slate-500 mt-0.5">{currentStudent.institutionName}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mb-3">
              {isHomeDelivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 text-orange-700 px-2 py-1 text-xs font-medium whitespace-nowrap">
                  <Home size={12} /> توصيل منزلي
                </span>
              )}
              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 max-w-[60%]">
                <MapPin size={12} className="text-slate-500 shrink-0" />
                <span className="text-xs text-slate-700 truncate">{dropoffLocation || 'غير محدد'}</span>
              </div>
            </div>

            <button
              onClick={handleDropoff}
              disabled={submitting}
              className="w-full gradient-success text-white py-4 rounded-xl font-bold text-base hover:brightness-110 transition-all disabled:opacity-50 min-h-[52px] shadow-[0_6px_16px_-6px_rgba(22,163,74,0.55)] active:scale-[0.98]"
            >
              <Check size={20} className="inline ml-1 -mt-0.5" />
              تم الإنزال
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    )
  }

  if (phase === 'boarding') {
    const now = new Date()
    const timerStartedAt = boardingTimer?.startedAt ? new Date(boardingTimer.startedAt) : null
    const serverNow = boardingTimer?.serverNow ? new Date(boardingTimer.serverNow) : now
    const offsetMs = timerStartedAt && boardingTimer?.serverNow
      ? (serverNow.getTime() - timerStartedAt.getTime())
      : 0
    const effectiveNow = boardingTimer ? new Date(now.getTime() + offsetMs) : now
    const durationMs = ((boardingTimer?.durationMinutes || 15)) * 60 * 1000
    const endMs = timerStartedAt ? (timerStartedAt.getTime() + durationMs) : null
    const remainingMs = endMs ? Math.max(0, endMs - effectiveNow.getTime()) : 0
    const elapsedMs = Math.max(0, durationMs - remainingMs)
    const pct = durationMs > 0 ? Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100)) : 0
    const mm = Math.floor(remainingMs / 60000)
    const ss = Math.floor((remainingMs % 60000) / 1000)
    const isCritical = remainingMs <= 60000
    const isWarning = !isCritical && remainingMs <= 5 * 60000
    const boardingEnded = !!boardingTimer?.endedAt || (endMs && remainingMs <= 0)

    return (
      <div className="max-w-lg mx-auto space-y-2 pb-4">
        <div className={`rounded-2xl overflow-hidden border shadow-card ${
          isCritical
            ? 'border-red-200 bg-gradient-to-br from-red-50 via-rose-50 to-orange-50'
            : isWarning
              ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50'
              : 'border-indigo-100 bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-50'
        }`}>
          <div className="px-4 py-3 border-b border-white/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-0.5">🚌 باص العودة · مرحلة الصعود</p>
                <h1 className="text-lg font-black text-slate-800">باص {selectedBus.bus?.busNumber || selectedBus.bus?.plateNumber}</h1>
                <p className="text-[11px] text-slate-600 mt-0.5">السائق: {selectedBus.driver?.name || user?.name}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                selectedBus.status === 'BOARDING_TIME_ENDED'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  selectedBus.status === 'BOARDING_TIME_ENDED' ? 'bg-red-500 animate-pulse' : 'bg-indigo-500 animate-pulse'
                }`} />
                {selectedBus.status === 'BOARDING_TIME_ENDED' ? 'وقت الصعود انتهى' : 'وقت الصعود'}
              </span>
            </div>
          </div>

          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={16} className={`${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-indigo-600'}`} />
                <span className={`text-[11px] font-bold ${isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-indigo-800'}`}>
                  {boardingEnded ? 'انتهى وقت الانطلاق · اضغط انطلاق' : 'متبقي على الانطلاق'}
                </span>
              </div>
              <span className={`text-5xl font-black font-mono tracking-tight tabular-nums ${
                isCritical
                  ? 'text-red-600 animate-pulse'
                  : isWarning
                    ? 'text-amber-600'
                    : 'text-indigo-700'
              }`}>
                {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
              </span>
            </div>
            <div className="w-full bg-white/70 rounded-full h-2.5 overflow-hidden border border-white">
              <div
                className={`h-2.5 rounded-full transition-all duration-1000 ${
                  isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 px-4 pb-3">
            <div className="bg-white/80 backdrop-blur border border-green-100 rounded-xl p-2 text-center">
              <div className="text-xl font-black text-green-700 tabular-nums">{stats.READY || 0}</div>
              <div className="text-[10px] font-bold text-green-600">جاهزون</div>
            </div>
            <div className="bg-white/80 backdrop-blur border border-amber-100 rounded-xl p-2 text-center">
              <div className="text-xl font-black text-amber-700 tabular-nums">{stats.DELAYED || 0}</div>
              <div className="text-[10px] font-bold text-amber-600">سيأخرون</div>
            </div>
            <div className="bg-white/80 backdrop-blur border border-red-100 rounded-xl p-2 text-center">
              <div className="text-xl font-black text-red-700 tabular-nums">{stats.NO_RESPONSE || 0}</div>
              <div className="text-[10px] font-bold text-red-600">لم يردوا</div>
            </div>
            <div className="bg-white/80 backdrop-blur border border-blue-100 rounded-xl p-2 text-center">
              <div className="text-xl font-black text-blue-700 tabular-nums">{stats.ON_BOARD || 0}</div>
              <div className="text-[10px] font-bold text-blue-600">صعدوا</div>
            </div>
          </div>

          <div className="px-4 pb-4">
            {boardingEnded ? (
              <>
                <button
                  onClick={handleDispatchBoarding}
                  disabled={submitting}
                  className="w-full rounded-2xl py-4 font-black text-base min-h-[56px] flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] gradient-danger text-white disabled:opacity-50"
                >
                  <Bus size={22} />
                  {submitting ? 'جاري الانطلاق...' : `🚍 انطلاق الباص الآن (${stats.ON_BOARD || 0})`}
                </button>
                {pendingLoads.length > 0 && (
                  <p className="text-[11px] text-center text-amber-700 mt-2 font-bold">
                    ⚠ متبقي {pendingLoads.length} طالب خارج الباص · السائق يقرر الانطلاق
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={handleDispatchBoarding}
                disabled={submitting}
                className="w-full rounded-2xl py-4 font-black text-base min-h-[56px] flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] gradient-success text-white disabled:opacity-50"
              >
                <Bus size={22} />
                {submitting ? 'جاري الانطلاق...' : `🚍 انطلاق الباص (${stats.ON_BOARD || 0})`}
              </button>
            )}
          </div>
        </div>

        <div className="card p-3">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Users size={16} className="text-slate-500" />
              قائمة الطلاب · {loads.length} طالب
            </h3>
          </div>
          <div className="space-y-1.5 max-h-[calc(100vh-440px)] overflow-y-auto">
            {loads.map((load) => {
              const s = load.student
              const rs = load.readinessStatus || 'NO_RESPONSE'
              const rl = READINESS_LABELS[rs] || READINESS_LABELS.NO_RESPONSE
              const isOnBoard = rs === 'ON_BOARD'
              const isMissed = rs === 'MISSED_BUS'
              const tone = getStudentGenderTone(s?.gender).card
              return (
                <div
                  key={load.id || load.studentId}
                  className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${tone} ${isMissed ? 'opacity-70' : ''}`}
                >
                  <button
                    onClick={() => handleMarkOnBoard(load.studentId)}
                    disabled={isMissed}
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isOnBoard
                        ? 'bg-blue-600 text-white shadow'
                        : isMissed
                          ? 'bg-slate-100 text-slate-300'
                          : 'bg-white border-2 border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                    title={isOnBoard ? 'إعادة الضبط' : 'تأكيد صعود الطالب'}
                  >
                    {isOnBoard
                      ? <Check size={18} strokeWidth={3.2} />
                      : <Square size={17} className="stroke-[2.5]" />
                    }
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800 text-[13px] truncate">{s?.name}</span>
                      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-bold border ${rl.cls}`}>
                        {rl.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s?.institutionName && (
                        <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                          <MapPin size={10} className="shrink-0" />
                          {s.institutionName}
                        </span>
                      )}
                      {rs === 'DELAYED' && load.delayMinutes && (
                        <span className="text-[10px] text-amber-700 font-bold shrink-0">
                          ⏱ {load.delayMinutes}د
                          {load.delayReason ? ` · ${load.delayReason}` : ''}
                        </span>
                      )}
                      {load.onBoardAt && (
                        <span className="text-[10px] text-blue-700 font-bold shrink-0">
                          صعد في {new Date(load.onBoardAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {s?.phone && (
                      <a
                        href={`tel:${s.phone}`}
                        className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors"
                        title="اتصال"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                      </a>
                    )}
                    {s?.whatsapp && (
                      <a
                        href={`https://wa.me/${String(s.whatsapp).replace(/^0+/, '966')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                        title="واتساب"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const allOnBoard = loads.length > 0 && pendingLoads.length === 0
  const timerRunning = boardingTimer?.startedAt && !boardingTimer?.endedAt
  const timerEnded = !!boardingTimer?.endedAt

  return (
    <div className="max-w-lg mx-auto space-y-2 pb-4">
      <div className="card p-4 fade-in-up">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">باص {selectedBus.bus?.busNumber}</h1>
            <p className="text-xs text-slate-500">السائق: {selectedBus.driver?.name || user?.name}</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
            <span className="w-1 h-1 rounded-full bg-green-500" />
            متصل
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-slate-800">{loads.length}</p>
            <p className="text-[10px] text-slate-500">إجمالي الطلاب</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-slate-800">{getLineLabel(selectedBus.line)}</p>
            <p className="text-[10px] text-slate-500">الطريق</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-3">
          <div className="bg-green-50 border border-green-100 rounded-lg p-1.5 text-center">
            <div className="text-sm font-black text-green-700">{stats.READY || 0}</div>
            <div className="text-[9px] text-green-600">جاهز</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-1.5 text-center">
            <div className="text-sm font-black text-amber-700">{stats.DELAYED || 0}</div>
            <div className="text-[9px] text-amber-600">متأخر</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 text-center">
            <div className="text-sm font-black text-red-700">{stats.NO_RESPONSE || 0}</div>
            <div className="text-[9px] text-red-600">لم يرد</div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-1.5 text-center">
            <div className="text-sm font-black text-blue-700">{stats.ON_BOARD || 0}</div>
            <div className="text-[9px] text-blue-600">صعد</div>
          </div>
        </div>

        <BoardingTimerBar timer={boardingTimer} />

        <div className="space-y-2 mb-2">
          {allOnBoard && (
            <button
              onClick={handleDispatchBoarding}
              disabled={submitting}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-[0_6px_16px_-6px_rgba(22,163,74,0.5)] active:scale-[0.98]"
            >
              <Bus size={16} /> انطلاق الباص ({stats.ON_BOARD || 0})
            </button>
          )}

          {!allOnBoard && !timerRunning && !timerEnded && (
            <button
              onClick={handleStartTimer}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1 shadow-[0_6px_16px_-6px_rgba(79,70,229,0.5)] active:scale-[0.98]"
            >
              <PlayCircle size={16} /> بدء العد التنازلي للصعود
            </button>
          )}

          {!allOnBoard && timerEnded && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs font-bold text-amber-700">
                  انتهى وقت الصعود · متبقي {pendingLoads.length} طالب خارج الباص
                </p>
              </div>
              <button
                onClick={handleDispatchBoarding}
                disabled={submitting}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 shadow-[0_6px_16px_-6px_rgba(22,163,74,0.5)] active:scale-[0.98]"
              >
                <Bus size={16} /> انطلاق الباص ({stats.ON_BOARD || 0})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Users size={16} className="text-slate-500" />
            كشف صعود الطلاب
          </h3>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {pendingLoads.length} متبقي
          </span>
        </div>

        {pendingLoads.length === 0 && (
          <div className="text-center py-4">
            <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
              <Check className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-xs text-slate-500">تم تسجيل صعود جميع الطلاب</p>
          </div>
        )}

        {pendingLoads.length > 0 && (
          <div className="space-y-1">
            {pendingLoads.map((load) => {
              const s = load.student
              const rs = load.readinessStatus || 'NO_RESPONSE'
              const rl = READINESS_LABELS[rs] || READINESS_LABELS.NO_RESPONSE
              const isHome = s?.transportMode === 'HOME'
              const tone = getStudentGenderTone(s?.gender).card
              return (
                <div
                  key={load.id || load.studentId}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${tone} ${rs === 'MISSED_BUS' ? 'opacity-60' : ''}`}
                >
                  <button
                    onClick={() => handleMarkOnBoard(load.studentId)}
                    disabled={rs === 'MISSED_BUS'}
                    className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      rs === 'MISSED_BUS' ? 'bg-slate-100 text-slate-300' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    <Square size={18} className="stroke-[3]" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-slate-800 text-xs truncate">{s?.name}</span>
                      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${rl.cls}`}>
                        {rl.label}
                      </span>
                      {isHome && (
                        <span className="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium bg-orange-100 text-orange-700">
                          توصيل منزلي
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 flex-wrap">
                      {s?.institutionName && <span className="truncate">{s.institutionName}</span>}
                      {rs === 'DELAYED' && load.delayMinutes && (
                        <span className="text-amber-600 font-medium shrink-0">
                          ⏱ {load.delayMinutes}د
                          {load.delayReason ? ` · ${load.delayReason}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {onBoardLoads.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[11px] font-bold text-blue-700 flex items-center gap-1">
                <CheckSquare size={13} />
                تم تسجيل صعودهم
              </h4>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {onBoardLoads.length} طالب
              </span>
            </div>
            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {onBoardLoads.map((load) => {
                const s = load.student
                const tone = getStudentGenderTone(s?.gender).card
                return (
                  <div
                    key={load.id || load.studentId}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${tone}`}
                  >
                    <div className="shrink-0 w-5 h-5 rounded bg-blue-500 text-white flex items-center justify-center">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    <span className="font-medium text-slate-700 text-[11px] truncate flex-1 min-w-0">{s?.name}</span>
                    <button
                      onClick={() => handleMarkOnBoard(load.studentId)}
                      className="shrink-0 text-[10px] text-slate-400 hover:text-red-500"
                      title="إلغاء"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
