import { memo, useState, useMemo, useCallback, useEffect } from 'react'
import { Bus, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { api } from '../../../lib/api'
import { StatusBadge, STATUS_META } from './StatusBadge'
import { ReturnTripTimeline } from './ReturnTripTimeline'
import { ReturnBusCard } from './ReturnBusCard'
import { DelayBottomSheet } from './DelayBottomSheet'
import { ReadinessConfirmation } from './ReadinessConfirmation'
import { BoardingCountdown } from './BoardingCountdown'
import { TripInfoCard } from './TripInfoCard'
import ConfirmModal from '../../ui/ConfirmModal'

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = String(timeStr).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  const ampm = h < 12 ? 'ص' : 'م'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

function ReturnTripViewWrapperImpl({
  student,
  returnBusInfo,
  returnQueueStatus,
  showReturnConfirm,
  setShowReturnConfirm,
  joining,
  handleConfirmReturn,
  returnReadiness,
  setReturnReadiness,
}) {
  const rd = returnReadiness
  const readiness = rd?.readiness || {}
  const timer = rd?.timer
  const bus = rd?.bus
  const driver = rd?.driver
  const status = readiness?.status || 'NO_RESPONSE'
  const activeBusId = rd?.activeBusId
  const busStatus = rd?.busStatus
  const readinessStats = rd?.readinessStats || { ready: 0, delayed: 0, noResponse: 0, total: 0, onBoard: 0 }

  const [delayOpen, setDelayOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState(null)

  const showToast = useCallback((msg, type = 'info', duration = 3200) => {
    setToastMsg({ msg, type, id: Date.now() })
    setTimeout(() => setToastMsg((cur) => (cur && Date.now() - cur.id >= duration - 50 ? null : cur)), duration)
  }, [])

  // Auto-request Notification permission when countdown appears
  useEffect(() => {
    if (timer && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { Notification.requestPermission?.() } catch {}
    }
  }, [timer])

  const markReady = useCallback(async () => {
    if (!activeBusId || submitting) return
    setSubmitting(true)
    try {
      await api.returnReadiness.student.ready(activeBusId)
      setReturnReadiness((prev) => ({
        ...prev,
        readiness: { ...(prev?.readiness || {}), status: 'READY', updatedAt: new Date().toISOString() }
      }))
      showToast('✅ تم إرسال حالة الجاهز للمشرف والسائق', 'success')
    } catch (e) {
      showToast(`⚠️ ${e.message || 'فشل في الإرسال'}`, 'error')
    } finally { setSubmitting(false) }
  }, [activeBusId, submitting, setReturnReadiness, showToast])

  const markDelayed = useCallback(async (delayMinutes, delayReason) => {
    if (!activeBusId || submitting) return
    setSubmitting(true)
    try {
      const finalMin = delayMinutes === 'MORE' ? -1 : Number(delayMinutes)
      const finalDelayDisplay = delayMinutes === 'MORE' ? 20 : Number(delayMinutes)
      await api.returnReadiness.student.delayed(activeBusId, finalMin, delayReason || null)
      setReturnReadiness((prev) => ({
        ...prev,
        readiness: {
          ...(prev?.readiness || {}),
          status: 'DELAYED',
          delayMinutes: finalDelayDisplay,
          delayReason: delayReason || null,
          updatedAt: new Date().toISOString()
        }
      }))
      setDelayOpen(false)
      showToast('⏱ تم إرسال إشعار التأخير للمشرف والسائق', 'warn')
    } catch (e) {
      showToast(`⚠️ ${e.message || 'فشل في الإرسال'}`, 'error')
    } finally { setSubmitting(false) }
  }, [activeBusId, submitting, setReturnReadiness, showToast])

  const markArrived = useCallback(async () => {
    if (!activeBusId || submitting) return
    setSubmitting(true)
    try {
      await api.returnReadiness.student.arrived(activeBusId)
      setReturnReadiness((prev) => ({
        ...prev,
        readiness: { ...(prev?.readiness || {}), status: 'READY', updatedAt: new Date().toISOString() }
      }))
      showToast('📍 تم تسجيل وصولك إلى نقطة التجمع', 'success')
    } catch (e) {
      showToast(`⚠️ ${e.message || 'فشل في الإرسال'}`, 'error')
    } finally { setSubmitting(false) }
  }, [activeBusId, submitting, setReturnReadiness, showToast])

  const handleCountdownEnded = useCallback(() => {
    // Visual-only handler; backend decides MISSED_BUS state
    showToast('⛔ انتهى وقت التجمع. يرجى التواصل مع المشرف.', 'error', 5500)
  }, [showToast])

  // --- VISIBILITY RULES (per requirement 10) ---
  const isOnBoard = status === 'ON_BOARD'
  const isMissed = status === 'MISSED_BUS'
  const isDroppedOffFinal = !!returnBusInfo?.droppedOffAt || busStatus === 'COMPLETED'

  const statusBadgePulse = status === 'DELAYED' || (timer && (timer.durationMinutes || 15) * 60000 - (new Date((timer?.serverNow || timer?.startedAt) || 0).getTime() - new Date(timer?.startedAt || 0).getTime()) < 5 * 60000)

  // --- Context for Timeline + Derived ---
  const timelineContext = useMemo(() => ({
    readiness,
    timer,
    busStatus,
    isDroppedOff: isDroppedOffFinal,
    assignedAt: rd?.assignedAt || returnReadiness?.assignedAt || readiness?.updatedAt,
    readyAt: (status === 'READY' || status === 'ON_BOARD' || status === 'MISSED_BUS') ? readiness?.updatedAt : null,
    busArrivedAt: timer?.startedAt,
    onBoardAt: readiness?.onBoardAt,
    departedAt: rd?.departedAt,
    droppedOffAt: returnBusInfo?.droppedOffAt,
  }), [readiness, timer, busStatus, isDroppedOffFinal, rd, returnBusInfo, status, returnReadiness])

  // Hide entire section once dropped off (per req 10, 17)
  if (isDroppedOffFinal) {
    return (
      <div className="rt-card-header-gradient-green rounded-xl p-2.5 rt-anim-scale-in">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} className="text-green-600" strokeWidth={2.6} />
          </div>
          <div>
            <div className="text-[12.5px] font-black text-green-900 leading-tight">🏫 تم إيصالك إلى وجهتك</div>
            <div className="text-[10.5px] text-green-800/80 leading-tight mt-0.5">شكراً لاستخدامك الخدمة · نتمنى لك يوماً سعيداً</div>
          </div>
        </div>
      </div>
    )
  }

  // Case: No bus assigned (return queue only) — show queue status
  if (!rd?.activeBusId && !returnBusInfo) {
    return (
      <div className="space-y-2">
        <div className="rt-card-header-gradient-green rounded-xl p-2.5 rt-anim-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-green-600" strokeWidth={2.6} />
            </div>
            <div>
              <div className="text-[12.5px] font-black text-green-900 leading-tight">تم الوصول إلى الجامعة</div>
              <div className="text-[10.5px] text-green-800/80 leading-tight mt-0.5">انتهت رحلة الذهاب بنجاح</div>
            </div>
          </div>
        </div>

        {returnQueueStatus ? (
          <div className="rt-card-header-gradient-amber rounded-xl p-2.5 rt-anim-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 rt-anim-badge-bounce">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-600" aria-hidden>
                  <path d="M7 7v6l4 2" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4"/>
                </svg>
              </div>
              <div>
                <div className="text-[12.5px] font-black text-amber-900 leading-tight">أنت في قائمة انتظار العودة</div>
                <div className="text-[10.5px] text-amber-800/80 leading-tight mt-0.5">في انتظار تخصيص باص لك</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => setShowReturnConfirm(true)}
              disabled={joining || submitting}
              className="w-full rt-btn-min rounded-xl text-[12.5px] font-black text-white bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] active:opacity-90 disabled:opacity-50 shadow-sm rt-anim-fade-in flex items-center justify-center gap-1.5"
            >
              {joining ? 'جاري المعالجة...' : (<>طلب رحلة العودة <ArrowRight size={14} /></>)}
            </button>
            <ConfirmModal
              show={showReturnConfirm}
              onClose={() => setShowReturnConfirm(false)}
              onConfirm={handleConfirmReturn}
              title="تأكيد طلب رحلة العودة"
              loading={joining}
            >
              <p className="text-[12px] text-slate-700 leading-relaxed">هل أنت متأكد من طلب رحلة العودة؟</p>
              <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">بعد التأكيد، سيتم إضافتك إلى قائمة انتظار رحلة العودة وإشعار المشرف.</p>
            </ConfirmModal>
          </>
        )}
      </div>
    )
  }

  // Case: activeBusId exists → show the full return trip journey UX
  const showReadinessButtons = !isOnBoard && !isMissed && status !== 'READY' && status !== 'DELAYED'
  const showReadinessFollowUp = !isOnBoard && !isMissed && (status === 'READY' || status === 'DELAYED')
  const showTimer = timer && !timer.endedAt && !isOnBoard && !isMissed
  const wrapperPalette = STATUS_META[status]?.wrapperBg || 'rt-card-header-gradient-gray'

  return (
    <div className="space-y-2">
      <ReturnTripTimeline {...timelineContext} />

      {/* Status Hero Wrapper — subtle gradient border reflects state */}
      <div className={`rounded-xl p-2.5 ${wrapperPalette} rt-anim-slide-down`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-[11px] font-black text-slate-700 tracking-wide">حالة الطالب</h3>
          <StatusBadge
            status={status === 'ON_BOARD' ? 'ON_BOARD' : busStatus === 'DEPARTED' && status === 'ON_BOARD' ? 'IN_TRANSIT' : status}
            updatedAt={readiness?.updatedAt}
            showTime
            size="md"
            pulse={statusBadgePulse}
          />
        </div>
      </div>

      <ReturnBusCard
        bus={bus}
        driver={driver}
        readiness={readiness}
        readinessStats={readinessStats}
        pickupPoint={rd?.pickupPoint || student?.university || returnBusInfo?.pickupPoint}
        expectedDeparture={rd?.departureTime || returnBusInfo?.departureTime || bus?.departureTime}
        currentUniversity={rd?.currentUniversity}
        nextUniversity={rd?.nextUniversity}
      />

      <TripInfoCard
        pickupPoint={rd?.pickupPoint || student?.university || returnBusInfo?.pickupPoint}
        departureTime={formatTime(rd?.departureTime || returnBusInfo?.departureTime || bus?.departureTime)}
        readyCount={readinessStats?.ready || 0}
        totalCount={readinessStats?.total || 0}
        onBoardCount={readinessStats?.onBoard || 0}
      />

      {isOnBoard ? (
        <div className="rt-card-header-gradient-blue rounded-xl p-3 rt-anim-scale-in">
          <div className="flex items-start gap-2.5">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto shrink-0 rt-anim-badge-bounce">
              <Bus size={24} className="text-blue-600" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-[13px] font-black text-blue-900 leading-tight">🚌 تم تسجيل صعودك إلى الباص</div>
              <div className="text-[11px] text-blue-800/85 mt-0.5 leading-snug">
                {busStatus === 'DEPARTED' ? 'الرحلة انطلقت · في طريقها إلى الوجهة' : 'في انتظار انطلاق الرحلة · رحلة سعيدة!'}
              </div>
            </div>
          </div>
        </div>
      ) : isMissed ? (
        <div className="rt-card-header-gradient-gray rounded-xl p-3 rt-anim-scale-in">
          <div className="flex items-start gap-2.5">
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto shrink-0">
              <AlertCircle size={24} className="text-slate-500" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="text-[13px] font-black text-slate-800 leading-tight">⛔ فاتك الباص</div>
              <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">انتهى وقت تسجيل الصعود. يرجى مراجعة الإدارة.</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {showTimer && (
            <BoardingCountdown
              timer={timer}
              onEnded={handleCountdownEnded}
              onSupervisorCall={undefined}
              supervisorPhone={rd?.supervisorPhone}
            />
          )}

          {showReadinessFollowUp && (
            <ReadinessConfirmation
              readiness={readiness}
              readyCount={readinessStats?.ready || 0}
              totalCount={readinessStats?.total || 0}
            />
          )}

          <div className="rt-card-surface p-2.5 rt-anim-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11.5px] font-black text-slate-800">جاهزية رحلة العودة</h3>
              <span className="text-[9.5px] font-bold text-slate-400">اختر حالتك أدناه</span>
            </div>

            {showReadinessButtons && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={markReady}
                  disabled={submitting}
                  className="rt-btn-min rounded-xl text-[12px] font-black text-white bg-gradient-to-br from-green-500 to-green-600 active:from-green-600 active:to-green-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="text-base leading-none">🟢</span>
                  <span>أنا جاهز</span>
                </button>
                <button
                  onClick={() => setDelayOpen(true)}
                  disabled={submitting}
                  className="rt-btn-min rounded-xl text-[12px] font-black text-white bg-gradient-to-br from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="text-base leading-none">🟡</span>
                  <span>سأتأخر</span>
                </button>
              </div>
            )}

            {status === 'DELAYED' && (
              <div className="space-y-1.5 rt-anim-fade-in">
                <button
                  onClick={markArrived}
                  disabled={submitting}
                  className="w-full rt-btn-min rounded-xl bg-gradient-to-br from-green-500 to-green-600 active:from-green-600 active:to-green-700 text-white text-[12px] font-black disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  وصلت إلى نقطة التجمع
                </button>
                <button
                  onClick={markReady}
                  disabled={submitting}
                  className="w-full rt-btn-min rounded-xl bg-slate-100 active:bg-slate-200 text-slate-700 text-[11px] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  عدل الحالة إلى: أنا جاهز
                </button>
              </div>
            )}

            {status === 'READY' && !showTimer && (
              <p className="text-center text-[10px] text-slate-500 pt-0.5">
                سيتم فتح عداد الصعود فور وصول الباص إلى الجامعة
              </p>
            )}
          </div>
        </>
      )}

      {toastMsg && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-sm rt-anim-notification-pop">
          <div className={`rounded-xl px-3 py-2.5 text-[11.5px] font-black leading-snug shadow-lg ring-1 ring-black/5 ${
            toastMsg.type === 'success' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white ring-green-900/10'
              : toastMsg.type === 'error' ? 'bg-gradient-to-br from-red-500 to-red-600 text-white ring-red-900/10'
              : toastMsg.type === 'warn' ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white ring-amber-900/10'
              : 'bg-slate-900 text-white'
          }`}>
            {toastMsg.msg}
          </div>
        </div>
      )}

      <DelayBottomSheet
        open={delayOpen}
        onClose={() => setDelayOpen(false)}
        onSubmit={markDelayed}
        submitting={submitting}
      />
    </div>
  )
}

export const ReturnTripViewWrapper = memo(ReturnTripViewWrapperImpl)
