import { useState, useEffect, useRef, useMemo } from 'react'
import { Bus, Clock, MapPin, Phone, Check, X, Bell, ArrowLeft, Users, MessageCircle, LogIn, AlertCircle, CheckCircle2, Clock3, MapPinned, CheckCheck, CalendarDays } from 'lucide-react'
import { api } from '../../lib/api'
import { connectSocket, joinBusRoom, leaveBusRoom, onTrackingUpdate, offTrackingUpdate, onNotificationNew, offNotificationNew, joinNotificationRoom, onStudentUpdate, offStudentUpdate, onReadinessUpdate, offReadinessUpdate, onBoardingTimerUpdate, offBoardingTimerUpdate, onReconnect } from '../../lib/socket'
import ConfirmModal from '../../components/ui/ConfirmModal'
import QuickContactCard from '../../components/ui/QuickContactCard'
import { ReturnTripViewWrapper } from '../../components/student/returnTrip/index.js'

const Stage = {
  NO_TRIP: 'NO_TRIP',
  BEFORE_PICKUP: 'BEFORE_PICKUP',
  PICKUP_IN_PROGRESS: 'PICKUP_IN_PROGRESS',
  BOARDED: 'BOARDED',
  ABSENT: 'ABSENT',
  MORNING_COMPLETED: 'MORNING_COMPLETED',
}

const TrackingStatus = {
  PICKED_UP: 'PICKED_UP',
  CURRENT: 'CURRENT',
  PENDING: 'PENDING',
  ABSENT: 'ABSENT',
  SKIPPED: 'SKIPPED',
}

const READINESS_LABELS = {
  NO_RESPONSE: { label: 'لم يرد', cls: 'bg-red-100 text-red-700 border-red-200' },
  READY: { label: 'جاهز', cls: 'bg-green-100 text-green-700 border-green-200' },
  DELAYED: { label: 'سأتأخر', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  ON_BOARD: { label: 'في الباص', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  MISSED_BUS: { label: 'فات الباص', cls: 'bg-slate-200 text-slate-600 border-slate-300' },
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':').map(Number)
  const isAM = hours < 12
  const displayHours = hours % 12 || 12
  const period = isAM ? 'ص' : 'م'
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}
function localDateStr(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const dotColors = {
  [TrackingStatus.PICKED_UP]: 'bg-green-500',
  [TrackingStatus.CURRENT]: 'bg-yellow-500',
  [TrackingStatus.PENDING]: 'bg-slate-300',
  [TrackingStatus.ABSENT]: 'bg-red-400',
  [TrackingStatus.SKIPPED]: 'bg-orange-400',
}

const labelColors = {
  [TrackingStatus.PICKED_UP]: 'text-green-700 bg-green-50',
  [TrackingStatus.CURRENT]: 'text-yellow-700 bg-yellow-50',
  [TrackingStatus.PENDING]: 'text-slate-400',
  [TrackingStatus.ABSENT]: 'text-red-600 bg-red-50',
  [TrackingStatus.SKIPPED]: 'text-orange-600 bg-orange-50',
}

const statusLabels = {
  [TrackingStatus.PICKED_UP]: 'تم الصعود',
  [TrackingStatus.CURRENT]: 'عند هذا الطالب',
  [TrackingStatus.PENDING]: 'لم يصل',
  [TrackingStatus.ABSENT]: 'غائب',
  [TrackingStatus.SKIPPED]: 'تم تجاوزه',
}

export default function Home() {
  const [data, setData] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [weeklySchedule, setWeeklySchedule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const notifiedRef = useRef(false)
  const activeBusIdRef = useRef(null)
  const [activeBusId, setActiveBusId] = useState(null)
  const studentIdRef = useRef(null)
  const [returnReadiness, setReturnReadiness] = useState(null)

  const load = async () => {
    try {
      api.studentPortal.getWeeklySchedule().then(setWeeklySchedule).catch(() => {})

      const d = await api.studentPortal.getDashboard()
      setData(d)
      setLoading(false)

      if (d.todayAssignment && d.student) {
        studentIdRef.current = d.student.id

        const op = await api.operations.getToday()
        if (op?.buses) {
          const myBus = op.buses.find(b => b.bus.id === d.todayAssignment.busId)
          if (myBus) {
            const abId = myBus.activeBusId
            activeBusIdRef.current = abId
            setActiveBusId(abId)
            try {
              console.debug('[student] joining bus room', abId)
              const tr = await api.tracking.get(abId)
              setTracking(tr)
            } catch (e) { console.debug('[student] tracking get failed', e) }
          }
        }
      }

      if (d.operationStage === Stage.MORNING_COMPLETED) {
        try {
          const rd = await api.returnReadiness.student.dashboard().catch(() => null)
          setReturnReadiness(rd)
          if (rd?.activeBusId) {
            activeBusIdRef.current = rd.activeBusId
            joinBusRoom(rd.activeBusId)
          }
        } catch {}
      }
    } catch (e) {
      if (loading) setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      connectSocket(token)
    }
    load()
    joinNotificationRoom()
    onNotificationNew((notification) => {
      if (notification.title || notification.message) {
        load()
      }
    })
    onStudentUpdate(() => {
      load()
    })
    onReadinessUpdate((payload) => {
      if (payload?.activeBusId && payload?.studentId && payload.studentId === studentIdRef.current) {
        setReturnReadiness((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            readiness: {
              ...(prev.readiness || {}),
              status: payload.status,
              delayMinutes: payload.delayMinutes,
              delayReason: payload.delayReason,
              onBoardAt: payload.onBoardAt,
              updatedAt: payload.updatedAt,
            }
          }
        })
      }
    })
    onBoardingTimerUpdate((payload) => {
      if (payload?.activeBusId && payload.activeBusId === activeBusIdRef.current) {
        setReturnReadiness((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            timer: {
              startedAt: payload.startedAt,
              durationMinutes: payload.durationMinutes,
              endedAt: payload.endedAt,
              serverNow: payload.serverNow,
            }
          }
        })
      }
    })
    const interval = setInterval(load, 10000)
    return () => {
      clearInterval(interval)
      offStudentUpdate()
      if (activeBusIdRef.current) {
        leaveBusRoom(activeBusIdRef.current)
      }
      offTrackingUpdate()
      offNotificationNew()
      offReadinessUpdate()
      offBoardingTimerUpdate()
    }
  }, [])

  useEffect(() => {
    if (activeBusId) {
      joinBusRoom(activeBusId)
      activeBusIdRef.current = activeBusId
      console.debug('[student] joined bus room on effect', activeBusId)
      const trackingHandler = (state) => {
        if (state.activeBusId === activeBusId) {
          console.debug('[student] received tracking update', state)
          setTracking(state)
          if (state.busStatus === 'ARRIVED') {
            load()
            return
          }
          if (studentIdRef.current && state.students?.some(s => s.studentId === studentIdRef.current && [TrackingStatus.PICKED_UP, TrackingStatus.CURRENT].includes(s.trackingStatus))) {
            load()
          }
        }
      }
      onTrackingUpdate(trackingHandler)
      const unsubReconnect = onReconnect(() => {
        if (activeBusIdRef.current) {
          console.debug('[student] socket reconnected, rejoining', activeBusIdRef.current)
          joinBusRoom(activeBusIdRef.current)
        }
      })

      return () => {
        offTrackingUpdate(trackingHandler)
        if (activeBusIdRef.current) leaveBusRoom(activeBusIdRef.current)
        if (unsubReconnect) unsubReconnect()
      }
    }
  }, [activeBusId])

  const [showReturnConfirm, setShowReturnConfirm] = useState(false)

  const handleJoinReturnQueue = () => {
    setShowReturnConfirm(true)
  }

  const handleConfirmReturn = async () => {
    setShowReturnConfirm(false)
    setJoining(true)
    try {
      await api.studentPortal.joinReturnQueue()
      load()
    } catch (e) {
      alert(e.message)
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 text-sm fade-in">
        <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center">
          <Bus size={20} className="text-white animate-pulse" />
        </div>
        جاري التحميل...
      </div>
    )
  }

  const { student, todayAssignment, busStudents, returnQueueStatus, returnBusInfo, operationStage } = data || {}
  const bus = todayAssignment?.bus
  const stage = operationStage || Stage.NO_TRIP
  const isReturnStage = stage === Stage.MORNING_COMPLETED

  const presentCount = tracking ? tracking.pickedUpCount : (busStudents || []).filter(s => s.attendance === 'present').length
  const totalCount = tracking ? tracking.total : (busStudents?.length || 0)

  const firstName = student?.name?.trim().split(/\s+/)[0]

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden gradient-primary rounded-2xl p-4 text-white shadow-[0_10px_26px_-12px_rgba(37,99,235,0.65)] fade-in">
        <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 right-8 w-28 h-28 rounded-full bg-white/[0.07]" />
        <div className="absolute top-3 left-16 w-10 h-10 rounded-xl bg-white/10 rotate-12" />
        <h2 className="relative text-lg font-bold">مرحباً {firstName}</h2>
        <p className="relative text-xs text-white/75 mt-0.5">نتمنى لك يوماً سعيداً</p>
      </div>

      {!isReturnStage && weeklySchedule?.days?.length > 0 && <WeeklySchedule days={weeklySchedule.days} />}

      {!isReturnStage && <QuickContactCard />}

      {stage === Stage.NO_TRIP && (
        <div className="card p-6 text-center fade-in">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <Bus size={30} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-semibold">لا توجد رحلة مقررة اليوم</p>
          <p className="text-xs text-slate-400 mt-1">سيتم إشعارك عند تحديد رحلة</p>
        </div>
      )}

      {(stage === Stage.BEFORE_PICKUP || stage === Stage.PICKUP_IN_PROGRESS) && (
        <>
          <MorningTripCard
            bus={bus}
            todayAssignment={todayAssignment}
            student={student}
            busStudents={busStudents}
            tracking={tracking}
            presentCount={presentCount}
            totalCount={totalCount}
            stage={stage}
            showReturnConfirm={showReturnConfirm}
            setShowReturnConfirm={setShowReturnConfirm}
            joining={joining}
            handleConfirmReturn={handleConfirmReturn}
          />
          <div className="card p-3 opacity-50 pointer-events-none select-none fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <ArrowLeft size={15} />
              </div>
              <span>ستظهر رحلة العودة بعد انتهاء رحلة الذهاب</span>
            </div>
          </div>
        </>
      )}

      {stage === Stage.BOARDED && (
        <>
          <MorningTripCard
            bus={bus}
            todayAssignment={todayAssignment}
            student={student}
            busStudents={busStudents}
            tracking={tracking}
            presentCount={presentCount}
            totalCount={totalCount}
            stage={stage}
            showReturnConfirm={showReturnConfirm}
            setShowReturnConfirm={setShowReturnConfirm}
            joining={joining}
            handleConfirmReturn={handleConfirmReturn}
          />
          <div className="card p-3 border border-green-100 text-center fade-in">
            <div className="flex items-center justify-center gap-2">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Check size={16} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-green-700">تم تسجيل حضورك</div>
                <div className="text-xs text-green-600">في انتظار الوصول إلى الجامعة</div>
              </div>
            </div>
          </div>
          <div className="card p-3 opacity-50 pointer-events-none select-none fade-in">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <ArrowLeft size={15} />
              </div>
              <span>ستظهر رحلة العودة بعد انتهاء رحلة الذهاب</span>
            </div>
          </div>
        </>
      )}

      {stage === Stage.ABSENT && (
        <div className="card p-6 text-center fade-in">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <X size={24} className="text-red-400" />
          </div>
          <p className="text-sm text-slate-600 font-semibold">تم تسجيل غيابك اليوم</p>
        </div>
      )}

      {stage === Stage.MORNING_COMPLETED && (
        <ReturnTripViewWrapper
          student={student}
          returnBusInfo={returnBusInfo}
          returnQueueStatus={returnQueueStatus}
          showReturnConfirm={showReturnConfirm}
          setShowReturnConfirm={setShowReturnConfirm}
          joining={joining}
          handleConfirmReturn={handleConfirmReturn}
          returnReadiness={returnReadiness}
          setReturnReadiness={setReturnReadiness}
        />
      )}
    </div>
  )
}

function WeeklySchedule({ days }) {
  const todayStr = localDateStr()

  return (
    <div className="card p-3 fade-in">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 gradient-primary rounded-xl flex items-center justify-center">
            <CalendarDays size={15} className="text-white" />
          </div>
          جدولي الأسبوعي
        </h3>
        <span className="text-[10px] text-slate-400">السبت → الخميس</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mx-auto max-w-fit">
        {days.map((d) => {
          const isToday = d.date === todayStr
          const subscribed = d.status === 'subscribed'
          const off = d.status === 'off'
          return (
            <div
              key={d.date}
              className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-2 border transition-all ${
                subscribed ? 'bg-blue-50 border-blue-200' : off ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
              } ${isToday ? 'ring-2 ring-[var(--color-primary)] ring-offset-1' : ''}`}
            >
              <span className={`text-[10px] font-medium ${isToday ? 'text-[var(--color-primary)] font-bold' : 'text-slate-500'}`}>
                {d.dayLabel}
              </span>
              <span className="text-sm font-bold text-slate-800">{d.dayNumber}</span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${
                subscribed ? 'bg-blue-500' : off ? 'bg-red-400' : 'bg-green-500'
              }`}>
                {off ? <X size={13} className="text-white" strokeWidth={3} /> : <Check size={13} className="text-white" strokeWidth={3} />}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-center gap-3 mt-2.5 text-[9px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> دوام
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> إجازة
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> اشتراك يومي
        </span>
      </div>
    </div>
  )
}

function MorningCompletedView({ student, returnBusInfo, returnQueueStatus, showReturnConfirm, setShowReturnConfirm, joining, handleConfirmReturn, returnReadiness, setReturnReadiness, activeBusIdRef }) {
  const rd = returnReadiness
  const readiness = rd?.readiness
  const timer = rd?.timer
  const bus = rd?.bus
  const driver = rd?.driver

  if (returnBusInfo?.droppedOffAt) {
    return (
      <div className="card p-3 border border-green-100 fade-in">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
            <Check size={16} className="text-green-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-green-700">تم إيصالك إلى وجهتك</div>
            <div className="text-xs text-green-600">شكراً لاستخدامك الخدمة</div>
          </div>
        </div>
      </div>
    )
  }

  if (rd?.activeBusId || returnBusInfo) {
    return <ReturnReadinessCard readiness={readiness} timer={timer} bus={bus} driver={driver} rd={rd} setReturnReadiness={setReturnReadiness} activeBusIdRef={activeBusIdRef} />
  }

  if (returnQueueStatus) {
    return (
      <>
        <div className="card p-3 border border-green-100 mb-2 fade-in">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <Check size={16} className="text-green-600" />
            </div>
            <div>
              <div className="text-sm font-semibold text-green-700">تم الوصول إلى الجامعة</div>
              <div className="text-xs text-green-600">انتهت رحلة الذهاب</div>
            </div>
          </div>
        </div>
        <div className="card p-3 border border-amber-100 fade-in">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
              <Bell size={16} className="text-amber-500" />
            </div>
            <div>
              <div className="text-sm font-semibold text-amber-700">أنت في قائمة انتظار العودة</div>
              <div className="text-xs text-amber-600">في انتظار التخصيص</div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="card p-3 border border-green-100 mb-2 fade-in">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
            <Check size={16} className="text-green-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-green-700">تم الوصول إلى الجامعة</div>
            <div className="text-xs text-green-600">انتهت رحلة الذهاب</div>
          </div>
        </div>
      </div>
      <button
        onClick={() => setShowReturnConfirm(true)}
        disabled={joining}
        className="w-full gradient-primary text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50 min-h-[48px] shadow-[0_6px_18px_-8px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-all"
      >
        {joining ? 'جاري...' : 'طلب رحلة العودة'}
      </button>
      <ConfirmModal
        show={showReturnConfirm}
        onClose={() => setShowReturnConfirm(false)}
        onConfirm={handleConfirmReturn}
        title="تأكيد طلب رحلة العودة"
        loading={joining}
      >
        <p>هل أنت متأكد من طلب رحلة العودة؟</p>
        <p className="text-xs text-slate-400 mt-2">بعد التأكيد، سيتم إضافتك إلى قائمة انتظار رحلة العودة وإشعار المشرف.</p>
      </ConfirmModal>
    </>
  )
}

function ReturnReadinessCard({ readiness, timer, bus, driver, rd, setReturnReadiness, activeBusIdRef }) {
  const [showDelayDialog, setShowDelayDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const status = readiness?.status || 'NO_RESPONSE'
  const activeBusId = rd?.activeBusId

  const statusLabel = READINESS_LABELS[status] || READINESS_LABELS.NO_RESPONSE

  const markReady = async () => {
    if (!activeBusId) return
    setSubmitting(true)
    try {
      await api.returnReadiness.student.ready(activeBusId)
      setReturnReadiness((prev) => ({
        ...prev,
        readiness: { ...(prev?.readiness || {}), status: 'READY', updatedAt: new Date().toISOString() }
      }))
    } catch (e) { alert(e.message) }
    finally { setSubmitting(false) }
  }

  const markDelayed = async (delayMinutes, delayReason) => {
    if (!activeBusId) return
    setSubmitting(true)
    try {
      const finalMin = delayMinutes === 'MORE' ? -1 : Number(delayMinutes)
      const finalDelayDisplay = delayMinutes === 'MORE' ? 20 : Number(delayMinutes)
      await api.returnReadiness.student.delayed(activeBusId, finalMin, delayReason)
      setReturnReadiness((prev) => ({
        ...prev,
        readiness: { ...(prev?.readiness || {}), status: 'DELAYED', delayMinutes: finalDelayDisplay, delayReason: delayReason || null, updatedAt: new Date().toISOString() }
      }))
      setShowDelayDialog(false)
    } catch (e) { alert(e.message) }
    finally { setSubmitting(false) }
  }

  const markArrived = async () => {
    if (!activeBusId) return
    setSubmitting(true)
    try {
      await api.returnReadiness.student.arrived(activeBusId)
      setReturnReadiness((prev) => ({
        ...prev,
        readiness: { ...(prev?.readiness || {}), status: 'READY', updatedAt: new Date().toISOString() }
      }))
    } catch (e) { alert(e.message) }
    finally { setSubmitting(false) }
  }

  const isOnBoard = status === 'ON_BOARD'
  const showTimer = timer && !timer.endedAt && !isOnBoard

  return (
    <div className="space-y-2">
      <JourneySequence readiness={readiness} timer={timer} busStatus={rd?.busStatus} />

      <div className="card p-3 fade-in">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-800">تفاصيل باص العودة</h3>
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusLabel.cls}`}>
            {statusLabel.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center shrink-0">
            <Bus size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800">باص رقم {bus?.busNumber || bus?.plateNumber || '---'}</div>
            <div className="text-xs text-slate-500">السائق: {driver?.name || '---'}</div>
          </div>
        </div>
        <div className="flex gap-1.5">
          {driver?.phone && (
            <a href={`tel:${driver.phone}`}
              className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white py-2 rounded-lg text-xs font-medium min-h-[36px]">
              <Phone size={12} /> اتصال
            </a>
          )}
        </div>
      </div>

      {isOnBoard ? (
        <div className="gradient-success rounded-2xl p-4 text-center text-white shadow-[0_10px_24px_-12px_rgba(34,197,94,0.6)] fade-in">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCheck size={24} className="text-white" />
          </div>
          <div className="text-sm font-bold text-white">✅ تم تسجيل صعودك إلى الباص</div>
          <div className="text-xs text-white/85 mt-1">رحلة سعيدة! في الطريق إلى وجهتك</div>
        </div>
      ) : status === 'MISSED_BUS' ? (
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-center fade-in">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
            <AlertCircle size={24} className="text-slate-500" />
          </div>
          <div className="text-sm font-bold text-slate-800">⛔ فاتك الباص</div>
          <div className="text-xs text-slate-600 mt-1">انتهى وقت تسجيل الصعود. يرجى مراجعة الإدارة.</div>
        </div>
      ) : (
        <>
          {showTimer && <BoardingTimerView timer={timer} />}

          <div className="card p-3 fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">جاهزية رحلة العودة</h3>
            </div>

            {status === 'READY' ? (
              <div className="bg-gradient-to-b from-green-50 to-white border border-green-200 rounded-xl p-3 text-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={20} className="text-green-600" />
                </div>
                <div className="text-sm font-bold text-green-800">أنت جاهز للصعود</div>
                <div className="text-xs text-green-700 mt-0.5">في انتظار وصول الباص وتسجيل الصعود</div>
              </div>
            ) : status === 'DELAYED' ? (
              <div className="space-y-2">
                <div className="bg-gradient-to-b from-amber-50 to-white border border-amber-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                      <Clock3 size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-amber-800">سأتأخر</div>
                      {readiness?.delayMinutes && <div className="text-xs text-amber-700">مدة التأخير المتوقعة: {readiness.delayMinutes} دقيقة</div>}
                      {readiness?.delayReason && <div className="text-xs text-amber-700 mt-0.5">السبب: {readiness.delayReason}</div>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={markArrived}
                  disabled={submitting}
                  className="w-full gradient-success text-white py-2.5 rounded-xl text-sm font-bold hover:brightness-105 transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5 shadow-[0_6px_16px_-8px_rgba(34,197,94,0.6)] active:scale-[0.98]"
                >
                  <MapPinned size={16} /> وصلت إلى نقطة التجمع
                </button>
                <button
                  onClick={markReady}
                  disabled={submitting}
                  className="w-full bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-medium hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  عدل الحالة إلى: أنا جاهز
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={markReady}
                    disabled={submitting}
                    className="gradient-success text-white py-3 rounded-2xl text-sm font-bold hover:brightness-105 transition-all disabled:opacity-50 min-h-[48px] flex flex-col items-center justify-center gap-0.5 shadow-[0_8px_20px_-10px_rgba(34,197,94,0.65)] active:scale-[0.98]"
                  >
                    <span className="text-base">🟢</span>
                    <span>أنا جاهز</span>
                  </button>
                  <button
                    onClick={() => setShowDelayDialog(true)}
                    disabled={submitting}
                    className="gradient-warning text-white py-3 rounded-2xl text-sm font-bold hover:brightness-105 transition-all disabled:opacity-50 min-h-[48px] flex flex-col items-center justify-center gap-0.5 shadow-[0_8px_20px_-10px_rgba(245,158,11,0.6)] active:scale-[0.98]"
                  >
                    <span className="text-base">🟡</span>
                    <span>سأتأخر</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center">يرجى الإشارة إلى جاهزيتك حتى يتم إبلاغ المشرف والسائق</p>
              </div>
            )}
          </div>
        </>
      )}

      {showDelayDialog && (
        <DelayDialog onClose={() => setShowDelayDialog(false)} onSubmit={markDelayed} submitting={submitting} />
      )}
    </div>
  )
}

function DelayDialog({ onClose, onSubmit, submitting }) {
  const [delayMinutes, setDelayMinutes] = useState('5')
  const [delayReason, setDelayReason] = useState('')
  const options = [
    { value: '5', label: '5 دقائق' },
    { value: '10', label: '10 دقائق' },
    { value: '15', label: '15 دقيقة' },
    { value: 'MORE', label: 'أكثر' },
  ]

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center fade-in" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-4 shadow-pop scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock3 size={16} className="text-amber-600" />
            </div>
            سأتأخر عن موعد الصعود
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">مدة التأخير المتوقعة</label>
          <div className="grid grid-cols-2 gap-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDelayMinutes(opt.value)}
                className={`py-2 rounded-xl text-xs font-medium transition-all border ${
                  delayMinutes === opt.value
                    ? 'bg-amber-500 text-white border-amber-500 shadow-[0_4px_12px_-4px_rgba(245,158,11,0.6)]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            السبب <span className="text-slate-400 font-normal">(اختياري)</span>
          </label>
          <textarea
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            rows={3}
            placeholder="اكتب سبب التأخير هنا..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => onSubmit(delayMinutes, delayReason.trim())}
            disabled={submitting}
            className="gradient-warning text-white py-2.5 rounded-xl text-sm font-bold hover:brightness-105 transition-all disabled:opacity-50 shadow-[0_4px_12px_-4px_rgba(245,158,11,0.5)] active:scale-[0.98]"
          >
            {submitting ? 'جاري الحفظ...' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BoardingTimerView({ timer }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(i)
  }, [])

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
  const isEnded = remainingMs <= 0 || timer.endedAt

  return (
    <div className="rounded-2xl p-3 bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 text-white border border-indigo-400/40 shadow-[0_12px_28px_-12px_rgba(79,70,229,0.7)] fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock size={16} className="text-indigo-200" />
          <span className="text-xs font-bold text-white">العد التنازلي لتسجيل الصعود</span>
        </div>
        <span className="text-[10px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-full">
          الوقت المحدد: {timer.durationMinutes || 15} د
        </span>
      </div>
      <div className="text-center mb-2">
        <span className={`text-4xl font-black font-mono tracking-wider rt-countdown-digit-mono ${
          remainingMs <= 60000 ? 'text-red-300 animate-pulse' : remainingMs <= 5 * 60000 ? 'text-amber-300' : 'text-white'
        }`}>
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </span>
      </div>
      <div className="w-full bg-white/25 rounded-full h-2 overflow-hidden mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-1000 ${isEnded ? 'bg-red-400' : remainingMs <= 5 * 60000 ? 'bg-amber-400' : 'bg-white'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-indigo-100 text-center font-medium">
        وصل الباص إلى الجامعة · قم بالتوجه للباص فوراً
      </p>
    </div>
  )
}

function JourneySequence({ readiness, timer, busStatus }) {
  const status = readiness?.status || 'NO_RESPONSE'
  const isAssigned = true
  const isReady = status === 'READY' || status === 'ON_BOARD' || status === 'MISSED_BUS'
  const isDelayed = status === 'DELAYED'
  const busArrived = !!timer
  const isOnBoard = status === 'ON_BOARD'
  const busDeparted = busStatus === 'DEPARTED'
  const isDroppedOff = false

  const steps = [
    { key: 'assigned', label: 'تم تخصيصك للباص', done: isAssigned, active: !isReady && !isDelayed && isAssigned, icon: Bus, color: 'slate' },
    { key: 'ready', label: isDelayed ? 'سأتأخر' : 'أنا جاهز', done: isReady || isDelayed, active: !busArrived && !isReady && !isDelayed, icon: CheckCircle2, color: isDelayed ? 'amber' : 'green' },
    { key: 'bus_coming', label: 'الباص في الطريق', done: busArrived || busDeparted || isOnBoard, active: false, icon: Bus, color: 'slate' },
    { key: 'bus_arrived', label: 'وصل الباص', done: busArrived || busDeparted || isOnBoard, active: false, icon: MapPin, color: 'indigo' },
    { key: 'countdown', label: 'العد التنازلي', done: busDeparted || isOnBoard, active: busArrived && !busDeparted && !isOnBoard, icon: Clock, color: 'indigo' },
    { key: 'on_board', label: 'تم تسجيل صعودك', done: isOnBoard || busDeparted, active: false, icon: CheckCheck, color: 'blue' },
    { key: 'on_way', label: 'في الطريق', done: busDeparted || isOnBoard, active: busDeparted && !isDroppedOff, icon: Bus, color: 'blue' },
    { key: 'dropped_off', label: 'تم الإنزال', done: isDroppedOff, active: false, icon: Check, color: 'green' },
  ]

  const filteredSteps = steps.filter(s => {
    if (!busArrived && !busDeparted && !isOnBoard) {
      return ['assigned', 'ready'].includes(s.key)
    }
    if (!busDeparted && !isOnBoard) {
      return ['assigned', 'ready', 'bus_coming', 'bus_arrived', 'countdown'].includes(s.key)
    }
    if (!isDroppedOff) {
      return ['assigned', 'ready', 'bus_coming', 'bus_arrived', 'countdown', 'on_board', 'on_way'].includes(s.key)
    }
    return true
  })

  return (
    <div className="card p-3 fade-in">
      <h3 className="text-[11px] font-bold text-slate-700 mb-2 flex items-center gap-1">
        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center">
          <MapPin size={11} className="text-slate-500" />
        </div>
        تسلسل رحلة العودة
      </h3>
      <div className="space-y-0.5">
        {filteredSteps.map((step, idx) => {
          const Icon = step.icon
          const isLast = idx === filteredSteps.length - 1
          const colorCls = step.done
            ? step.color === 'amber' ? 'bg-amber-500 border-amber-500 text-white'
              : step.color === 'green' ? 'bg-green-500 border-green-500 text-white'
              : step.color === 'blue' ? 'bg-blue-500 border-blue-500 text-white'
              : step.color === 'indigo' ? 'bg-indigo-500 border-indigo-500 text-white'
              : 'bg-slate-500 border-slate-500 text-white'
            : step.active ? 'ring-2 ring-[var(--color-primary)] ring-offset-2 bg-white border-[var(--color-primary)] text-[var(--color-primary)] rt-anim-timeline-glow'
            : 'bg-white border-slate-200 text-slate-300'
          const lineCls = step.done ? (step.color === 'amber' ? 'bg-amber-300' : step.color === 'green' ? 'bg-green-300' : step.color === 'blue' ? 'bg-blue-300' : 'bg-indigo-300') : 'bg-slate-100'
          const labelCls = step.done ? (step.color === 'amber' ? 'text-amber-800' : step.color === 'green' ? 'text-green-800' : step.color === 'blue' ? 'text-blue-800' : 'text-indigo-800') : step.active ? 'text-[var(--color-primary)] font-bold' : 'text-slate-400'
          return (
            <div key={step.key} className="flex items-start gap-2">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${colorCls}`}>
                  <Icon size={12} strokeWidth={2.5} />
                </div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[14px] my-0.5 ${lineCls}`} />}
              </div>
              <div className="pt-1 pb-2 min-h-[30px]">
                <p className={`text-[11px] font-medium transition-all ${labelCls}`}>{step.label}</p>
                {step.active && <p className="text-[9px] text-[var(--color-primary)] mt-0.5">المرحلة الحالية</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MorningTripCard({ bus, todayAssignment, student, busStudents, tracking, presentCount, totalCount, stage, showReturnConfirm, setShowReturnConfirm, joining, handleConfirmReturn }) {
  const isStudentNext = tracking?.nextStudent?.studentId === student?.id
  const isStudentCurrent = tracking?.currentStudent?.studentId === student?.id
  const rawStudents = tracking?.students || busStudents?.map(s => ({
    ...s,
    trackingStatus: s.attendance === 'present' || s.attendance === 'late' ? TrackingStatus.PICKED_UP
      : s.attendance === 'absent' ? TrackingStatus.ABSENT
      : TrackingStatus.PENDING,
  })) || []

  const toMinutes = (time) => {
    if (!time) return 24 * 60
    const [h, m] = String(time).split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return 24 * 60
    return h * 60 + m
  }
  const displayStudents = [...rawStudents].sort((a, b) => {
    const aTime = a.pickupTime || null
    const bTime = b.pickupTime || null
    return toMinutes(aTime) - toMinutes(bTime)
  })

  const myIdx = displayStudents.findIndex(s => s.studentId === student?.id)
  const currentIdx = displayStudents.findIndex(s => s.trackingStatus === TrackingStatus.CURRENT)
  const remaining = currentIdx >= 0 ? myIdx - currentIdx : -1

  return (
    <>
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center shrink-0">
            <Bus size={17} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-800">باص رقم {bus?.busNumber}</div>
            <div className="text-xs text-slate-500 truncate">السائق: {bus?.driver?.name || bus?.driverName}</div>
          </div>
          <div className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {presentCount}/{totalCount}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
          {todayAssignment?.pickupTime && (
            <span className="flex items-center gap-1">
              <Clock size={10} className="text-[var(--color-primary)]" />
              {formatTime(todayAssignment.pickupTime)}
            </span>
          )}
          {student?.pickupLocation && (
            <span className="flex items-center gap-1 truncate max-w-[60%]">
              <MapPin size={10} className="text-[var(--color-primary)] shrink-0" />
              <span className="truncate">{student.pickupLocation}</span>
            </span>
          )}
        </div>

        <div className="flex gap-1.5 mb-3">
          {bus?.primaryPhone && (
            <a href={`tel:${bus.primaryPhone}`}
              className="flex-1 flex items-center justify-center gap-1 gradient-success text-white py-2 rounded-xl text-xs font-semibold shadow-[0_4px_12px_-6px_rgba(34,197,94,0.5)] hover:brightness-105 transition-all active:scale-[0.98]">
              <Phone size={11} /> {bus.primaryPhone}
            </a>
          )}
          {bus?.secondaryPhone && (
            <a href={`tel:${bus.secondaryPhone}`}
              className="flex-1 flex items-center justify-center gap-1 gradient-info text-white py-2 rounded-xl text-xs font-semibold shadow-[0_4px_12px_-6px_rgba(59,130,246,0.5)] hover:brightness-105 transition-all active:scale-[0.98]">
              <Phone size={11} /> {bus.secondaryPhone}
            </a>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span className="font-medium">تقدم الباص</span>
          <span className="text-[var(--color-primary)] font-bold">
            {totalCount > 0 ? `${Math.round((presentCount / totalCount) * 100)}%` : '0%'}
          </span>
        </div>
        <div className="progress-track mb-3">
          <div className="progress-fill" style={{ width: totalCount > 0 ? `${(presentCount / totalCount) * 100}%` : '0%' }} />
        </div>

        {/* current/next header removed — address shown per-row below */}

        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1.6fr_1.4fr_0.9fr] gap-2 text-[10px] text-slate-500 uppercase tracking-wide px-2">
            <span>الاسم والحالة</span>
            <span>العنوان</span>
            <span className="text-left">الوقت</span>
          </div>

          {displayStudents.map((s) => {
            const isMe = s.studentId === student?.id
            const ts = s.trackingStatus
            const address = s.pickupLocation || s.homeAddress || '-'
            const studentTime = s.pickupTime ? formatTime(s.pickupTime) : 'غير محدد'

            return (
              <div
                key={s.studentId}
                className={`grid gap-2 py-2 px-2 rounded-xl transition-all ${
                  ts === TrackingStatus.CURRENT && isMe ? 'ring-2 ring-yellow-300 bg-yellow-50 shadow-sm' :
                  ts === TrackingStatus.CURRENT ? 'bg-yellow-50' :
                  ts === TrackingStatus.PICKED_UP ? 'bg-green-50/50' : 'bg-slate-50'
                } sm:grid-cols-[1.6fr_1.4fr_0.9fr] sm:items-center`}
              >
                <div className="min-w-0">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[ts] || 'bg-slate-300'}`} />
                      <span className="text-xs text-slate-700 truncate font-medium">
                        {s.name}
                        {isMe && <span className="mr-1 text-[10px] text-slate-400">(أنت)</span>}
                      </span>
                    </div>
                    <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded-full font-medium ${labelColors[ts] || 'text-slate-400'}`}>
                      {statusLabels[ts] || 'في الانتظار'}
                    </span>
                    <span className="block text-[11px] text-slate-500 sm:hidden truncate">
                      {address}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:block text-[11px] text-slate-600 truncate">
                  {address}
                </div>

                <div className="text-[11px] text-slate-600 text-right sm:text-left">
                  {studentTime}
                </div>
              </div>
            )
          })}
          {displayStudents.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">لا يوجد طلاب في هذا الباص</p>
          )}
        </div>

        {isStudentCurrent && (
          <div className="mt-2 text-center">
            <span className="inline-block bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm fade-in">
              الباص عندك الآن
            </span>
          </div>
        )}
        {isStudentNext && (
          <div className="mt-2 text-center">
            <span className="inline-block bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm fade-in">
              أنت التالي
            </span>
          </div>
        )}
        {!isStudentCurrent && !isStudentNext && remaining > 0 && (
          <div className="mt-2 text-center">
            <span className="inline-block bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-medium fade-in">
              بقي {remaining === 1 ? 'طالب واحد' : remaining === 2 ? 'طالبان' : `${remaining} طلاب`} قبل وصول الباص
            </span>
          </div>
        )}
      </div>

      <ConfirmModal
        show={showReturnConfirm}
        onClose={() => setShowReturnConfirm(false)}
        onConfirm={handleConfirmReturn}
        title="تأكيد طلب رحلة العودة"
        loading={joining}
      >
        <p>هل أنت متأكد من طلب رحلة العودة؟</p>
        <p className="text-xs text-slate-400 mt-2">بعد التأكيد، سيتم إضافتك إلى قائمة انتظار رحلة العودة وإشعار السائق.</p>
      </ConfirmModal>
    </>
  )
}
