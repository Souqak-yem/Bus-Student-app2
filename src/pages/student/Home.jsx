import { useState, useEffect, useRef } from 'react'
import { Bus, Clock, MapPin, Phone, Check, X, Bell, ArrowLeft, Users, MessageCircle, LogIn } from 'lucide-react'
import { api } from '../../lib/api'
import { connectSocket, joinBusRoom, leaveBusRoom, onTrackingUpdate, offTrackingUpdate, onNotificationNew, offNotificationNew, joinNotificationRoom, onStudentUpdate, offStudentUpdate } from '../../lib/socket'
import ConfirmModal from '../../components/ui/ConfirmModal'
import QuickContactCard from '../../components/ui/QuickContactCard'

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

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':').map(Number)
  const isAM = hours < 12
  const displayHours = hours % 12 || 12
  const period = isAM ? 'ص' : 'م'
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
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
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const notifiedRef = useRef(false)
  const activeBusIdRef = useRef(null)
  const studentIdRef = useRef(null)

  const load = async () => {
    try {
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
            try {
              const tr = await api.tracking.get(abId)
              setTracking(tr)
            } catch {}
          }
        }
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
    const interval = setInterval(load, 10000)
    return () => {
      clearInterval(interval)
      offStudentUpdate()
      if (activeBusIdRef.current) {
        leaveBusRoom(activeBusIdRef.current)
      }
      offTrackingUpdate()
      offNotificationNew()
    }
  }, [])

  useEffect(() => {
    if (activeBusIdRef.current) {
      joinBusRoom(activeBusIdRef.current)
      onTrackingUpdate((state) => {
        if (state.activeBusId === activeBusIdRef.current) {
          setTracking(state)
          if (state.busStatus === 'ARRIVED') {
            load()
          }
        }
      })
    }
  }, [data?.todayAssignment?.busId])

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
    return <div className="text-center py-12 text-slate-400 text-sm">جاري التحميل...</div>
  }

  const { student, todayAssignment, busStudents, returnQueueStatus, returnBusInfo, operationStage } = data || {}
  const bus = todayAssignment?.bus
  const stage = operationStage || Stage.NO_TRIP

  const presentCount = tracking ? tracking.pickedUpCount : (busStudents || []).filter(s => s.attendance === 'present').length
  const totalCount = tracking ? tracking.total : (busStudents?.length || 0)

  const firstName = student?.name?.trim().split(/\s+/)[0]

  return (
    <div className="space-y-2">
      {/* Welcome card compact */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] rounded-xl p-3 text-white">
        <h2 className="text-base font-bold">مرحباً {firstName}</h2>
        <p className="text-xs text-white/70">نتمنى لك يوماً سعيداً</p>
      </div>

      <QuickContactCard />

      {stage === Stage.NO_TRIP && (
        <div className="bg-white rounded-xl p-6 text-center">
          <Bus size={40} className="mx-auto mb-2 text-slate-200" />
          <p className="text-sm text-slate-500 font-medium">لا توجد رحلة مقررة اليوم</p>
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
          <div className="bg-white rounded-xl p-3 opacity-50 pointer-events-none select-none">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ArrowLeft size={16} />
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
          <div className="bg-white rounded-xl p-3 border border-green-100 text-center">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Check size={16} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-green-700">تم تسجيل حضورك</div>
                <div className="text-xs text-green-600">في انتظار الوصول إلى الجامعة</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-3 opacity-50 pointer-events-none select-none">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ArrowLeft size={16} />
              <span>ستظهر رحلة العودة بعد انتهاء رحلة الذهاب</span>
            </div>
          </div>
        </>
      )}

      {stage === Stage.ABSENT && (
        <div className="bg-white rounded-xl p-6 text-center">
          <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-2">
            <X size={20} className="text-red-400" />
          </div>
          <p className="text-sm text-slate-500 font-medium">تم تسجيل غيابك اليوم</p>
        </div>
      )}

      {stage === Stage.MORNING_COMPLETED && (
        <>
          <div className="bg-white rounded-xl p-3 border border-green-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Check size={16} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm font-medium text-green-700">تم الوصول إلى الجامعة</div>
                <div className="text-xs text-green-600">انتهت رحلة الذهاب</div>
              </div>
            </div>
          </div>

          {returnBusInfo?.droppedOffAt ? (
            <div className="bg-white rounded-xl p-3 border border-green-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <Check size={16} className="text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-green-700">تم إيصالك إلى وجهتك</div>
                  <div className="text-xs text-green-600">شكراً لاستخدامك الخدمة</div>
                </div>
              </div>
            </div>
          ) : returnBusInfo ? (
            <div className="bg-white rounded-xl p-3">
              <h3 className="text-xs font-bold text-slate-700 mb-2">رحلة العودة</h3>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center shrink-0">
                  <Bus size={16} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">باص رقم {returnBusInfo.busNumber}</div>
                  <div className="text-xs text-slate-500">السائق: {returnBusInfo.driverName}</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                {returnBusInfo.primaryPhone && (
                  <a href={`tel:${returnBusInfo.primaryPhone}`}
                    className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white py-2 rounded-lg text-xs font-medium">
                    <Phone size={12} /> اتصال
                  </a>
                )}
                {returnBusInfo.secondaryPhone && (
                  <a href={`https://wa.me/${returnBusInfo.secondaryPhone.replace(/[^0-9]/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 bg-emerald-500 text-white py-2 rounded-lg text-xs font-medium">
                    <MessageCircle size={12} /> واتساب
                  </a>
                )}
              </div>
            </div>
          ) : returnQueueStatus ? (
            <div className="bg-white rounded-xl p-3 border border-amber-100">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-amber-500 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-amber-700">أنت في قائمة انتظار العودة</div>
                  <div className="text-xs text-amber-600">في انتظار التخصيص</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={handleJoinReturnQueue}
                disabled={joining}
                className="w-full bg-[var(--color-primary)] text-white py-3 rounded-xl text-sm font-medium disabled:opacity-50 min-h-[44px]"
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
          )}
        </>
      )}
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
      {/* Bus info compact */}
      <div className="bg-white rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center shrink-0">
            <Bus size={16} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-800">باص رقم {bus?.busNumber}</div>
            <div className="text-xs text-slate-500 truncate">السائق: {bus?.driver?.name || bus?.driverName}</div>
          </div>
          <div className="text-xs text-slate-400 shrink-0">
            {presentCount}/{totalCount}
          </div>
        </div>

        {/* Time & location row */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
          {todayAssignment?.pickupTime && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatTime(todayAssignment.pickupTime)}
            </span>
          )}
          {student?.pickupLocation && (
            <span className="flex items-center gap-1 truncate max-w-[60%]">
              <MapPin size={10} className="shrink-0" />
              <span className="truncate">{student.pickupLocation}</span>
            </span>
          )}
        </div>

        {/* Contact buttons */}
        <div className="flex gap-1.5 mb-2">
          {bus?.primaryPhone && (
            <a href={`tel:${bus.primaryPhone}`}
              className="flex-1 flex items-center justify-center gap-1 bg-green-500 text-white py-1.5 rounded-lg text-xs font-medium">
              <Phone size={11} /> {bus.primaryPhone}
            </a>
          )}
          {bus?.secondaryPhone && (
            <a href={`tel:${bus.secondaryPhone}`}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-500 text-white py-1.5 rounded-lg text-xs font-medium">
              <Phone size={11} /> {bus.secondaryPhone}
            </a>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>تقدم الباص</span>
          <span className="text-[var(--color-primary)] font-medium">
            {totalCount > 0 ? `${Math.round((presentCount / totalCount) * 100)}%` : '0%'}
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
          <div
            className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(presentCount / totalCount) * 100}%` : '0%' }}
          />
        </div>

        {/* Student list compact */}
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1.6fr_1.4fr_0.9fr] gap-2 text-[10px] text-slate-500 uppercase tracking-wide px-2">
            <span>الاسم والحالة</span>
            <span>العنوان</span>
            <span className="text-left">الوقت</span>
          </div>

          {displayStudents.map((s) => {
            const isMe = s.studentId === student?.id
            const ts = s.trackingStatus
            const address = s.transportMode === 'HOME'
              ? (s.homeAddress || '-')
              : (s.pickupLocation || '-')
            const studentTime = s.pickupTime ? formatTime(s.pickupTime) : 'غير محدد'

            return (
              <div
                key={s.studentId}
                className={`grid gap-2 py-2 px-2 rounded-lg transition-all ${
                  ts === TrackingStatus.CURRENT && isMe ? 'ring-2 ring-yellow-300 bg-yellow-50' :
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

        {/* Position indicator */}
        {isStudentCurrent && (
          <div className="mt-1.5 text-center">
            <span className="inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-lg text-xs font-medium">
              الباص عندك الآن
            </span>
          </div>
        )}
        {isStudentNext && (
          <div className="mt-1.5 text-center">
            <span className="inline-block bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-xs font-medium">
              أنت التالي
            </span>
          </div>
        )}
        {!isStudentCurrent && !isStudentNext && remaining > 0 && (
          <div className="mt-1.5 text-center">
            <span className="inline-block bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-xs font-medium">
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
