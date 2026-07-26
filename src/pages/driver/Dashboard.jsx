import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { connectSocket, joinBusRoom, leaveBusRoom, onTrackingUpdate, offTrackingUpdate, onEmergencyReportUpdate, offEmergencyReportUpdate, joinDriverBusRoom, leaveDriverBusRoom, onDriverOperationUpdate, offDriverOperationUpdate } from '../../lib/socket'
import { useNotifications } from '../../context/NotificationContext'
import { AlertTriangle, MessageCircle, Phone, Send, Check, Clock, X, SkipForward, UserCheck, GraduationCap, MapPin, User } from 'lucide-react'

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

const WHATSAPP_MSG = encodeURIComponent(
  'السلام عليكم، أنا قريب من موقعك، يرجى التواجد في نقطة الانتظار. شكراً.'
)

export default function DriverDashboard() {
  const { user } = useAuth()
  const { addNotification } = useNotifications()
  const [busData, setBusData] = useState(null)
  const [students, setStudents] = useState([])
  const [attendance, setAttendance] = useState({})
  const [tripStatus, setTripStatus] = useState('idle')
  const [loading, setLoading] = useState(true)
  const [noOperation, setNoOperation] = useState(false)
  const [noBus, setNoBus] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState(1)
  const [activeBusId, setActiveBusId] = useState(null)
  const [busRecordId, setBusRecordId] = useState(null)
  const [selectedSaturdayBusId, setSelectedSaturdayBusId] = useState(null)
  const [saturdayBuses, setSaturdayBuses] = useState([])
  const [isSaturdayMode, setIsSaturdayMode] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const todayObj = new Date()
  const isSaturdayDate = todayObj.getDay() === 6

  const loadData = useCallback(async () => {
    try {
      if (isSaturdayDate) {
        const saturdayResult = await api.saturday.driverDashboard().catch(() => null)
        setIsSaturdayMode(true)

        if (!saturdayResult?.operationExists || saturdayResult?.buses?.length === 0) {
          setNoOperation(true)
          setLoading(false)
          return
        }

        const buses = saturdayResult.buses || []
        setSaturdayBuses(buses)

        const currentBusId = selectedSaturdayBusId || buses[0]?.id
        const selectedBus = buses.find(b => b.id === currentBusId) || buses[0]
        setSelectedSaturdayBusId(selectedBus?.id)

        if (selectedBus) {
          const formattedStudents = selectedBus.loads.map(load => ({
            student: load.student,
            pickupTime: load.pickupTime,
            assignment: { id: load.id }
          }))
          setStudents(formattedStudents)
          setBusRecordId(selectedBus.bus?.id)
          setActiveBusId(selectedBus.id)

          const syntheticBusData = {
            bus: selectedBus.bus,
            driver: selectedBus.driver,
            busStatus: selectedBus.status,
            activeBusId: selectedBus.id,
          }
          setBusData(syntheticBusData)
        }

        setLoading(false)
        return
      }

      const op = await api.operations.getToday()
      if (!op.exists) {
        setNoOperation(true)
        setLoading(false)
        return
      }

      const myBuses = await api.buses.list({ driverId: user.id, status: 'active' }).catch(() => [])
      const myBus = myBuses[0]
      if (!myBus) {
        setNoBus(true)
        setLoading(false)
        return
      }

      const myBusData = op.buses.find(b => b.bus.id === myBus.id)
      if (!myBusData) {
        setNoBus(true)
        setLoading(false)
        return
      }

      setBusData(myBusData)
      const toMinutes = (time) => {
        if (!time) return 24 * 60
        const [h, m] = String(time).split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return 24 * 60
        return h * 60 + m
      }
      const sorted = (myBusData.students || []).slice().sort((a, b) => {
        const aTime = a.pickupTime || a.templatePickupTime || null
        const bTime = b.pickupTime || b.templatePickupTime || null
        return toMinutes(aTime) - toMinutes(bTime)
      })
      setStudents(sorted)
      setActiveBusId(myBusData.activeBusId)
      setBusRecordId(myBusData.bus.id)

      if (myBusData.busStatus === 'ARRIVED') {
        setTripStatus('completed')
      } else if (myBusData.busStatus === 'DEPARTED') {
        setTripStatus('in_progress')
        if (myBusData.activeBusId) {
          try {
            const trackingState = await api.tracking.get(myBusData.activeBusId)
            const currentIdx = trackingState?.students?.findIndex(s => s.trackingStatus === 'CURRENT')
            if (currentIdx >= 0) setCurrentIndex(currentIdx)
          } catch (err) {
            console.warn('Failed to restore current student index:', err)
          }
        }
      } else if (myBusData.busStatus === 'CANCELLED') {
        setTripStatus('cancelled')
      }

      try {
        const attRecords = await api.attendance.today(myBus.id)
        const attMap = {}
        attRecords.forEach(a => { attMap[a.studentId] = a })
        setAttendance(attMap)
      } catch (err) {
        console.error('Failed to load attendance:', err)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [user.id, isSaturdayDate, selectedSaturdayBusId])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) connectSocket(token)
    loadData()
  }, [loadData])

  useEffect(() => {
    if (activeBusId) {
      joinBusRoom(activeBusId)
      if (busRecordId) joinDriverBusRoom(busRecordId)
      onTrackingUpdate((state) => {
        if (state.activeBusId === activeBusId) {
          if (state.busStatus === 'ARRIVED' || (!state.currentStudent && state.allDone)) {
            setTripStatus('completed')
          }
        }
      })
      onDriverOperationUpdate((payload) => {
        if (payload.type === 'driver_bus_removed' || payload.type === 'driver_trip_cancelled') {
          setTripStatus('cancelled')
        }
        loadData()
        if (payload.priority === 'CRITICAL' && payload.title) {
          addNotification(payload.title, payload.message || '', 'warning')
        }
      })
      return () => {
        leaveBusRoom(activeBusId)
        if (busRecordId) leaveDriverBusRoom(busRecordId)
        offTrackingUpdate()
        offDriverOperationUpdate()
      }
    }
  }, [activeBusId, busRecordId, loadData, addNotification])

  async function handleMarkStatus(status) {
    const student = students[currentIndex]?.student
    if (!student || submitting) return
    setSubmitting(true)
    try {
      await api.attendance.mark({
        studentId: student.id,
        busId: busData.bus.id,
        date: today,
        status,
      })
      setAttendance(prev => ({ ...prev, [student.id]: { studentId: student.id, status } }))

      if (currentIndex < students.length - 1) {
        setDirection(1)
        setCurrentIndex(prev => prev + 1)
      } else {
        await api.attendance.completeMorning(busData.bus.id)
        setTripStatus('completed')
      }
    } catch (err) {
      console.error(err)
      alert(err.message || 'فشل تسجيل الحالة')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSkip() {
    const student = students[currentIndex]?.student
    if (!student || submitting || !activeBusId) return
    setSubmitting(true)
    try {
      await api.tracking.skip(activeBusId, student.id)
      setDirection(1)
      setCurrentIndex(prev => prev + 1)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUnskip(studentId) {
    if (!activeBusId) return
    try {
      await api.tracking.unskip(activeBusId, studentId)
      setCurrentIndex(students.findIndex(s => s.student?.id === studentId))
      setDirection(-1)
    } catch (err) {
      console.error(err)
    }
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      setDirection(-1)
      setCurrentIndex(prev => prev - 1)
    }
  }

  async function handleStartTrip() {
    try {
      await api.attendance.startMorning(busData.bus.id)
      setCurrentIndex(0)
      setDirection(1)
      setTripStatus('in_progress')
    } catch (err) {
      alert(err.message || 'فشل بدء الرحلة')
    }
  }

  function handleEndTrip() {
    setTripStatus('idle')
    setCurrentIndex(0)
  }

  const [currentIndex, setCurrentIndex] = useState(0)

  // Emergency Report State
  const [reportStatus, setReportStatus] = useState(null) // null | { status, reason, ... }
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('MECHANICAL')
  const [reportNotes, setReportNotes] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  // Load driver's report status
  useEffect(() => {
    if (busData?.bus?.id) {
      api.emergency.getDriverReport(busData.bus.id).then(setReportStatus).catch(() => {})
    }
  }, [busData?.bus?.id])

  // Listen for report status updates
  useEffect(() => {
    onEmergencyReportUpdate((update) => {
      if (update.status === 'APPROVED' || update.status === 'REJECTED') {
        setReportStatus(prev => prev ? { ...prev, ...update } : update)
      }
    })
    return () => offEmergencyReportUpdate()
  }, [])

  async function handleSendReport() {
    if (!busData?.bus?.id) return
    setReportSubmitting(true)
    try {
      const result = await api.emergency.createReport(busData.bus.id, reportReason, reportNotes)
      setReportStatus({ status: 'PENDING_REVIEW', reason: reportReason, notes: reportNotes, id: result.id })
      setShowReportModal(false)
      setReportNotes('')
    } catch (err) {
      alert(err.message)
    } finally {
      setReportSubmitting(false)
    }
  }

  const currentStudent = students[currentIndex]?.student
  const isHomeDelivery = currentStudent?.transportMode === 'HOME'
  const studentPhone = currentStudent?.phone
  const studentWhatsapp = currentStudent?.whatsapp

  const completedCount = students.filter(s => attendance[s.student?.id]?.status === 'present').length
  const lateCount = students.filter(s => attendance[s.student?.id]?.status === 'late').length
  const absentCount = students.filter(s => attendance[s.student?.id]?.status === 'absent').length
  const processedCount = completedCount + lateCount + absentCount

  const skippedStudents = activeBusId ? [] : []

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm">جاري التحميل...</div>
      </div>
    )
  }

  if (noOperation) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-sm text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800">لم يتم إنشاء تشغيل اليوم بعد.</h2>
        </div>
      </div>
    )
  }

  if (noBus || !busData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-sm text-center">
          <p className="text-base text-slate-500">لا توجد حافلة مخصصة لك في تشغيل اليوم.</p>
        </div>
      </div>
    )
  }

  const bus = busData.bus
  const driverName = busData.driver?.name || bus.driverName || 'غير محدد'

  const handleSwitchSaturdayBus = (busId) => {
    setSelectedSaturdayBusId(busId)
    setCurrentIndex(0)
    setTripStatus('idle')
    setAttendance({})
  }

  if (tripStatus === 'idle') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl p-4">
          {isSaturdayMode && saturdayBuses.length > 1 && (
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-600 mb-2">اختر الباص:</label>
              <select
                value={selectedSaturdayBusId || ''}
                onChange={(e) => handleSwitchSaturdayBus(e.target.value)}
                className="w-full border border-slate-200 rounded-lg py-2.5 px-3 text-sm bg-white"
              >
                {saturdayBuses.map(b => (
                  <option key={b.id} value={b.id}>
                    باص {b.bus?.busNumber || b.bus?.plateNumber || 'بدون رقم'} - {b.studentCount || b.loads?.length || 0} طالب
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-slate-800">باص {bus.busNumber}{isSaturdayMode ? ' (السبت)' : ''}</h1>
              <p className="text-xs text-slate-500">السائق: {driverName}</p>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
              navigator.onLine ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}>
              <span className={`w-1 h-1 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-yellow-500'}`} />
              {navigator.onLine ? 'متصل' : 'غير متصل'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-slate-800">{students.length}</p>
              <p className="text-[10px] text-slate-500">الطلاب</p>
            </div>
          </div>
          <button
            onClick={handleStartTrip}
            className="w-full bg-[var(--color-primary)] text-white py-4 rounded-xl font-bold text-base hover:brightness-110 transition-all min-h-[52px]"
          >
            بدء الرحلة
          </button>
        </div>

        {/* Emergency report button - idle */}
        <EmergencyReportCard reportStatus={reportStatus} busId={busData?.bus?.id}
          onReport={() => { setReportReason('MECHANICAL'); setReportNotes(''); setShowReportModal(true) }} />

        <ReportModal visible={showReportModal} reason={reportReason} notes={reportNotes} submitting={reportSubmitting}
          onReasonChange={setReportReason} onNotesChange={setReportNotes}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleSendReport} />
      </div>
    )
  }

  if (tripStatus === 'cancelled') {
    return (
      <div className="max-w-lg mx-auto">
        {isSaturdayMode && saturdayBuses.length > 1 && (
          <div className="bg-white rounded-xl p-4 mb-2">
            <label className="block text-xs font-bold text-slate-600 mb-2">اختر الباص:</label>
            <select
              value={selectedSaturdayBusId || ''}
              onChange={(e) => handleSwitchSaturdayBus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2.5 px-3 text-sm bg-white"
            >
              {saturdayBuses.map(b => (
                <option key={b.id} value={b.id}>
                  باص {b.bus?.busNumber || b.bus?.plateNumber || 'بدون رقم'} - {b.studentCount || b.loads?.length || 0} طالب
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <X className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-1">تم إلغاء الرحلة</h2>
          <p className="text-sm text-slate-500">تم إلغاء رحلة اليوم لهذا الباص من قبل الإدارة</p>
        </div>
        <EmergencyReportCard reportStatus={reportStatus} busId={busData?.bus?.id}
          onReport={() => { setReportReason('MECHANICAL'); setReportNotes(''); setShowReportModal(true) }} />
        <ReportModal visible={showReportModal} reason={reportReason} notes={reportNotes} submitting={reportSubmitting}
          onReasonChange={setReportReason} onNotesChange={setReportNotes}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleSendReport} />
      </div>
    )
  }

  if (tripStatus === 'completed') {
    const completedCount = students.filter(s => attendance[s.student?.id]?.status === 'present').length
    const lateCount = students.filter(s => attendance[s.student?.id]?.status === 'late').length
    const absentCount = students.filter(s => attendance[s.student?.id]?.status === 'absent').length
    return (
      <div className="max-w-lg mx-auto">
        {isSaturdayMode && saturdayBuses.length > 1 && (
          <div className="bg-white rounded-xl p-4 mb-2">
            <label className="block text-xs font-bold text-slate-600 mb-2">اختر الباص:</label>
            <select
              value={selectedSaturdayBusId || ''}
              onChange={(e) => handleSwitchSaturdayBus(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2.5 px-3 text-sm bg-white"
            >
              {saturdayBuses.map(b => (
                <option key={b.id} value={b.id}>
                  باص {b.bus?.busNumber || b.bus?.plateNumber || 'بدون رقم'} - {b.studentCount || b.loads?.length || 0} طالب
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-base font-bold text-slate-800 mb-3">انتهت رحلة اليوم</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-lg font-bold text-green-700">{completedCount}</p>
              <p className="text-[10px] text-green-600">حاضر</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <p className="text-lg font-bold text-orange-700">{lateCount}</p>
              <p className="text-[10px] text-orange-600">متأخر</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-lg font-bold text-red-700">{absentCount}</p>
              <p className="text-[10px] text-red-600">غائب</p>
            </div>
          </div>
        </div>

        {/* Emergency report card - completed */}
        <EmergencyReportCard reportStatus={reportStatus} busId={busData?.bus?.id}
          onReport={() => { setReportReason('MECHANICAL'); setReportNotes(''); setShowReportModal(true) }} />

        <ReportModal visible={showReportModal} reason={reportReason} notes={reportNotes} submitting={reportSubmitting}
          onReasonChange={setReportReason} onNotesChange={setReportNotes}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleSendReport} />
      </div>
    )
  }

  const remaining = students.length - (currentIndex + 1)
  const pickupLocation = isHomeDelivery
    ? (currentStudent?.homeAddress || null)
    : (currentStudent?.pickupLocation || currentStudent?.address || null)

  return (
    <div className="max-w-lg mx-auto space-y-2 pb-4">
      {/* Saturday bus selector */}
      {isSaturdayMode && saturdayBuses.length > 1 && (
        <div className="bg-white rounded-xl p-4">
          <label className="block text-xs font-bold text-slate-600 mb-2">اختر الباص:</label>
          <select
            value={selectedSaturdayBusId || ''}
            onChange={(e) => handleSwitchSaturdayBus(e.target.value)}
            className="w-full border border-slate-200 rounded-lg py-2.5 px-3 text-sm bg-white"
          >
            {saturdayBuses.map(b => (
              <option key={b.id} value={b.id}>
                باص {b.bus?.busNumber || b.bus?.plateNumber || 'بدون رقم'} - {b.studentCount || b.loads?.length || 0} طالب
              </option>
            ))}
          </select>
        </div>
      )}
      {/* Progress bar */}
      <div className="bg-white rounded-xl px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">باص {bus.busNumber}{isSaturdayMode ? ' (السبت)' : ''}</span>
          <div className="text-left">
            <p className="text-xs font-bold text-[var(--color-primary)]">
              {currentIndex + 1} / {students.length}
            </p>
            <p className="text-[10px] text-slate-400">المتبقي: {remaining}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
          <div className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / students.length) * 100}%` }} />
        </div>
      </div>

      {/* Student card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: direction * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -60 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-xl p-3"
        >
          {/* Header */}
          <div className="mb-2">
            <h2 className="text-lg font-bold text-slate-800 text-center">
              {currentStudent?.name}
            </h2>
            {currentStudent?.institutionName && (
              <p className="text-xs text-slate-500 text-center mt-0.5">
                {currentStudent.institutionName}
              </p>
            )}
          </div>

          {/* Details row */}
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <Clock size={12} className="text-slate-500" />
              <span className="text-xs text-slate-700">{formatTime(students[currentIndex]?.pickupTime) || '--'}</span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 max-w-[50%]">
              <MapPin size={12} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-700 truncate">{pickupLocation || 'غير محدد'}</span>
            </div>
            {isHomeDelivery && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-orange-50 text-orange-700">
                منزلي
              </span>
            )}
          </div>

          {/* Communication icons */}
          {studentPhone && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <a href={`tel:${studentPhone}`}
                className="w-9 h-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors"
                title="اتصال">
                <Phone size={16} />
              </a>
              {studentWhatsapp ? (
                <a href={`https://wa.me/${studentWhatsapp.replace(/^0/, '966')}?text=${WHATSAPP_MSG}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-green-600 text-white hover:bg-green-700 flex items-center justify-center transition-colors"
                  title="واتساب">
                  <MessageCircle size={16} />
                </a>
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center cursor-not-allowed"
                  title="واتساب غير متاح">
                  <MessageCircle size={16} />
                </div>
              )}
              <a href={`sms:${studentPhone}`}
                className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
                title="رسالة">
                <Send size={16} />
              </a>
            </div>
          )}

          {/* Status buttons - sticky at bottom */}
          <div className="space-y-1.5">
            <button onClick={() => handleMarkStatus('present')} disabled={submitting}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 min-h-[48px]">
              <Check size={18} className="inline ml-1 -mt-0.5" /> تم الصعود
            </button>
            <div className="flex gap-1.5">
              <button onClick={() => handleMarkStatus('late')} disabled={submitting}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 min-h-[48px]">
                <Clock size={16} className="inline ml-1 -mt-0.5" /> متأخر
              </button>
              <button onClick={() => handleMarkStatus('absent')} disabled={submitting}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 min-h-[48px]">
                <X size={16} className="inline ml-1 -mt-0.5" /> غائب
              </button>
            </div>
            <button onClick={handleSkip} disabled={submitting}
              className="w-full bg-slate-200 text-slate-600 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-300 transition-all disabled:opacity-50 min-h-[44px]">
              <SkipForward size={14} className="inline ml-1 -mt-0.5" /> تجاوز
            </button>
          </div>

          {currentIndex > 0 && (
            <button onClick={handlePrevious}
              className="mt-2 w-full text-center text-xs text-slate-400 py-1.5 hover:text-slate-600 transition-colors">
              السابق
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Student list */}
      <div className="bg-white rounded-xl p-3">
        <h3 className="text-xs font-bold text-slate-700 mb-1.5">قائمة الطلاب ({students.length})</h3>
        <div className="space-y-0.5">
          {students.map((s, i) => {
            const att = attendance[s.student?.id]
            const isCurrent = i === currentIndex
            const isDone = att?.status === 'present' || att?.status === 'late'
            const isAbsent = att?.status === 'absent'
            let dotClass = 'bg-slate-300'
            let label = 'بانتظار'
            if (isDone) { dotClass = 'bg-green-500'; label = 'تم الصعود' }
            else if (isAbsent) { dotClass = 'bg-red-400'; label = 'غائب' }
            else if (isCurrent) { dotClass = 'bg-yellow-500'; label = 'الحالي' }

            return (
              <div key={s.student?.id || i} className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs ${isCurrent ? 'bg-yellow-50' : ''}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                <span className="flex-1 truncate text-slate-700">{s.student?.name}</span>
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Emergency report - in progress */}
      <EmergencyReportCard reportStatus={reportStatus} busId={busData?.bus?.id}
        onReport={() => { setReportReason('MECHANICAL'); setReportNotes(''); setShowReportModal(true) }} />

      <ReportModal visible={showReportModal} reason={reportReason} notes={reportNotes} submitting={reportSubmitting}
        onReasonChange={setReportReason} onNotesChange={setReportNotes}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSendReport} />
    </div>
  )
}

/* ─── Emergency Report Card ─── */
function EmergencyReportCard({ reportStatus, onReport }) {
  const hasActiveEmergency = false // TODO: Wire with actual active emergency check if needed

  if (hasActiveEmergency) return null

  if (!reportStatus) {
    return (
      <button onClick={onReport} className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 bg-red-50/50 text-red-600 text-sm font-semibold hover:bg-red-50 transition-all">
        <AlertTriangle className="w-4 h-4" />
        الإبلاغ عن مشكلة
      </button>
    )
  }

  const labels = {
    PENDING_REVIEW: { text: 'قيد المراجعة', bg: 'bg-yellow-100', border: 'border-yellow-300', textColor: 'text-yellow-800', dot: 'bg-yellow-500' },
    APPROVED: { text: 'تمت الموافقة', bg: 'bg-blue-100', border: 'border-blue-300', textColor: 'text-blue-800', dot: 'bg-blue-500' },
    REJECTED: { text: 'مرفوض', bg: 'bg-red-100', border: 'border-red-300', textColor: 'text-red-800', dot: 'bg-red-500' },
    CLOSED: { text: 'مغلق', bg: 'bg-slate-100', border: 'border-slate-300', textColor: 'text-slate-800', dot: 'bg-slate-500' },
  }
  const s = labels[reportStatus.status] || labels.PENDING_REVIEW

  return (
    <div className={`mt-3 p-3 rounded-xl border-2 ${s.border} ${s.bg}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={`w-4 h-4 ${s.textColor}`} />
        <span className={`text-xs font-bold ${s.textColor}`}>بلاغ: {s.text}</span>
        <span className={`w-2 h-2 rounded-full mr-auto ${s.dot}`} />
      </div>
      {reportStatus.reason && <p className="text-[11px] text-slate-600 mt-1">السبب: {reportStatus.reason === 'MECHANICAL' ? 'عطل ميكانيكي' : reportStatus.reason === 'ACCIDENT' ? 'حادث' : reportStatus.reason === 'MEDICAL' ? 'حالة طبية' : reportStatus.reason === 'SECURITY' ? 'أمني' : reportStatus.reason === 'OTHER' ? 'أخرى' : reportStatus.reason}</p>}
      {reportStatus.notes && <p className="text-[11px] text-slate-500 mt-0.5">{reportStatus.notes}</p>}
      {reportStatus.rejectionReason && <p className="text-[11px] text-red-600 mt-0.5">سبب الرفض: {reportStatus.rejectionReason}</p>}
    </div>
  )
}

/* ─── Report Modal ─── */
function ReportModal({ visible, reason, notes, submitting, onReasonChange, onNotesChange, onClose, onSubmit }) {
  if (!visible) return null
  const reasons = [
    { value: 'MECHANICAL', label: 'عطل ميكانيكي' },
    { value: 'ACCIDENT', label: 'حادث' },
    { value: 'MEDICAL', label: 'حالة طبية' },
    { value: 'SECURITY', label: 'أمني' },
    { value: 'OTHER', label: 'أخرى' },
  ]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          الإبلاغ عن مشكلة
        </h2>
        <div className="mb-3">
          <label className="text-xs text-slate-600 mb-1 block">نوع المشكلة</label>
          <select value={reason} onChange={e => onReasonChange(e.target.value)} className="w-full border border-slate-200 rounded-lg py-2.5 px-3 text-xs bg-white appearance-none">
            {reasons.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="text-xs text-slate-600 mb-1 block">ملاحظات إضافية (اختياري)</label>
          <textarea value={notes} onChange={e => onNotesChange(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-lg py-2 px-3 text-xs resize-none" placeholder="أضف تفاصيل..." />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium">إلغاء</button>
          <button onClick={onSubmit} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50 min-h-[44px]">
            {submitting ? 'جاري الإرسال...' : 'إرسال البلاغ'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
