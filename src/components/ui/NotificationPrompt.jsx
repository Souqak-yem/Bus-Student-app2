import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Check, Bus, CreditCard, AlertTriangle, Clock, DollarSign, FileText, ArrowLeft, ArrowRight, Users, Play, CalendarCheck, RefreshCw, Info, AlertOctagon, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { subscribeToPush, setPushNotificationsEnabled, DEFAULT_NOTIFICATION_PREFS, getPushStatus } from '../../lib/pushManager'

const APPEAR_DELAY_MS = 2000

const FEATURE_ICONS = [
  { icon: Bus, label: 'حالة الباصات' },
  { icon: CreditCard, label: 'حالة الاشتراك' },
  { icon: AlertTriangle, label: 'البلاغات الطارئة' },
  { icon: Clock, label: 'مواعيد الرحلات' },
  { icon: DollarSign, label: 'تذكيرات الدفع' },
  { icon: CalendarCheck, label: 'جدول العمليات' },
]

const CLOSED_DURATION_MS = 3200

function translateFailure(result) {
  const reason = result?.reason
  const phase = result?.phase
  const message = result?.message
  const status = result?.status

  switch (reason) {
    case 'unsupported':
      return {
        icon: Info,
        type: 'warning',
        title: 'متصفحك غير مدعوم',
        lines: [
          'متصفحك الحالي لا يدعم خدمة الإشعارات الخارجية.',
          'جرّب استخدام أحدث إصدار من Chrome أو Edge أو Safari.',
        ],
      }
    case 'disabled':
      return {
        icon: Bell,
        type: 'info',
        title: 'الإشعارات معطّلة',
        lines: ['مفتاح الإشعارات في الإعدادات المحلية مطفّأ.'],
      }
    case 'denied':
      return {
        icon: ShieldAlert,
        type: 'warning',
        title: 'تم رفض إذن الإشعارات',
        lines: [
          'المتصفح رفض إذن الإشعارات.',
          'افتح إعدادات الموقع في المتصفح ثم أعد تفعيل الإشعارات ثم أعد المحاولة.',
        ],
      }
    case 'default':
      return {
        icon: Info,
        type: 'warning',
        title: 'إذن الإشعارات غير مُحدّد',
        lines: [
          'عند ظهور نافذة إذن الإشعارات قم بالضغط على السماح (Allow).',
          'بعد الموافقة سوف يبدأ الجهاز في استقبال التنبيهات.',
        ],
      }
    case 'vapid-not-configured':
      return {
        icon: AlertOctagon,
        type: 'error',
        title: 'الخادم غير مهيّأ للإشعارات',
        lines: [
          'مفاتيح VAPID غير مهيأة على الخادم Production.',
          'يرجى إعلام إدارة التطبيق.',
        ],
      }
    case 'sw_failure':
      return {
        icon: RefreshCw,
        type: 'error',
        title: 'فشل تهيئة خدمة العمل',
        lines: [
          message || 'تعذّر تشغيل خدمة العمل في الخلفية خلال المهلة المحددة.',
          'أعد تحميل الصفحة ثم جرب مرة أخرى.',
        ],
      }
    case 'client_subscribe_failed':
      return {
        icon: AlertOctagon,
        type: 'error',
        title: 'فشل تسجيل الإشعارات',
        lines: [
          'المتصفح رفض تسجيل الاشتراك.',
          'احتمال عدم مطابقة مفتاح VAPID العام أو أن الاتصال غير آمن (HTTPS).',
          message ? `التفاصيل: ${message}` : null,
        ].filter(Boolean),
      }
    case 'server_sync_failed':
      return {
        icon: AlertTriangle,
        type: 'error',
        title: 'فشل حفظ الإشتراك في الخادم',
        lines: [
          'تم إنشاء الاشتراك في المتصفح لكن فشل حفظه في قاعدة بيانات الخادم.',
          status ? `كود الخطأ: ${status}` : null,
          message ? `التفاصيل: ${message}` : null,
        ].filter(Boolean),
      }
    case 'invalid_subscription_payload':
      return {
        icon: AlertOctagon,
        type: 'error',
        title: 'بيانات الاشتراك غير مكتملة',
        lines: ['البيانات المستلمة من المتصفح غير صالحة. أعد المحاولة.'],
      }
    default:
      return {
        icon: AlertTriangle,
        type: 'warning',
        title: 'لم يكتمل التفعيل',
        lines: [
          phase ? `المرحلة: ${phase}` : null,
          reason ? `السبب: ${reason}` : null,
          message ? `التفاصيل: ${message}` : null,
          'جرّب تحديث الصفحة ثم إعادة المحاولة.',
        ].filter(Boolean),
      }
  }
}

export default function NotificationPrompt() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [failureInfo, setFailureInfo] = useState(null)
  const [autoCloseAt, setAutoCloseAt] = useState(null)
  const timerRef = useRef(null)
  const closeTimerRef = useRef(null)

  const checkAndShow = useCallback(async () => {
    if (!user) return
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return

    try {
      const { hasSeenNotificationPrompt } = await api.notifications.getPrefs()
      if (hasSeenNotificationPrompt) return
    } catch {
      return
    }

    timerRef.current = setTimeout(() => {
      setShow(true)
    }, APPEAR_DELAY_MS)
  }, [user])

  useEffect(() => {
    checkAndShow()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [checkAndShow])

  const markSeenOnly = useCallback(async () => {
    try {
      await api.notifications.markPromptSeen()
    } catch {
      /* silent */
    }
  }, [])

  const handleEnable = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setFailureInfo(null)
    setAutoCloseAt(null)
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)

    try {
      setPushNotificationsEnabled(true)
      await api.notifications.savePrefs(DEFAULT_NOTIFICATION_PREFS)
      await api.notifications.markPromptSeen()
      const result = await subscribeToPush()

      if (result?.success) {
        const subsCount =
          (typeof result.totalSubscriptions === 'number' && result.totalSubscriptions > 0)
            ? result.totalSubscriptions
            : 'جاهز'
        setToast({
          type: 'success',
          message:
            result.wasExistingClientSide || result.wasExistingServerSide
              ? `الإشعارات مفعّلة (عدد الأجهزة: ${subsCount}) ✅`
              : 'تم تفعيل الإشعارات الخارجية بنجاح ✅',
        })
        setAutoCloseAt(Date.now() + CLOSED_DURATION_MS)
        closeTimerRef.current = setTimeout(() => {
          setShow(false)
          setToast(null)
          setFailureInfo(null)
        }, CLOSED_DURATION_MS)
      } else {
        console.warn('[NotificationPrompt] subscribeToPush returned failure:', result)
        setFailureInfo({ ...translateFailure(result), result })
        setAutoCloseAt(null)
        try {
          const st = await getPushStatus()
          if (st) {
            setFailureInfo((prev) => ({
              ...(prev || {}),
              status: st,
            }))
          }
        } catch {}
      }
    } catch (err) {
      console.error('[NotificationPrompt] handleEnable threw:', err?.message || err)
      setFailureInfo({
        ...translateFailure({ reason: 'exception', message: err?.message, phase: 'unhandled' }),
        result: { error: true },
      })
    } finally {
      setBusy(false)
    }
  }, [busy])

  const retryNow = useCallback(async () => {
    await handleEnable()
  }, [handleEnable])

  const handleDismiss = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await markSeenOnly()
    } catch {
      /* silent */
    } finally {
      setBusy(false)
      setShow(false)
      setFailureInfo(null)
      setToast(null)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [busy, markSeenOnly])

  if (!show) return null

  const isFailure = !!failureInfo
  const FailureIcon = failureInfo?.icon || AlertTriangle

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[950] flex items-center justify-center p-4"
          onClick={handleDismiss}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.5)',
            }}
          >
            <button
              onClick={handleDismiss}
              disabled={busy}
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors z-10 disabled:opacity-50"
              aria-label="إغلاق"
            >
              <X size={16} className="text-slate-500" />
            </button>

            {!isFailure ? (
              <>
                <div className="px-5 pt-6 pb-3 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.1, bounce: 0.5 }}
                    className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30"
                  >
                    <Bell size={28} className="text-white" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-slate-800">ابقَ على اطلاع!</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    فعّل الإشعارات لتصلك تنبيهات فورية عن:
                  </p>
                </div>

                <div className="px-5 pb-2">
                  <div className="grid grid-cols-3 gap-2">
                    {FEATURE_ICONS.map(({ icon: Icon, label }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <Icon size={18} className="text-blue-600" />
                        <span className="text-[10px] text-slate-600 font-medium text-center leading-tight">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="px-5 pt-6 pb-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.05, bounce: 0.4 }}
                  className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-lg ${
                    failureInfo.type === 'error'
                      ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30'
                      : failureInfo.type === 'warning'
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30'
                      : 'bg-gradient-to-br from-sky-500 to-indigo-500 shadow-sky-500/30'
                  }`}
                >
                  <FailureIcon size={26} className="text-white" />
                </motion.div>
                <h3 className="text-base font-bold text-slate-800 text-center">{failureInfo.title}</h3>
                <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                  {failureInfo.lines?.map((line, idx) => (
                    <p key={idx} className="text-[12px] leading-relaxed text-slate-600">
                      • {line}
                    </p>
                  ))}
                </div>

                {failureInfo.status && (
                  <div className="mt-3 grid grid-cols-4 gap-1 text-[10px]">
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <div className="text-slate-400 font-medium">مدعوم</div>
                      <div className="font-bold text-slate-700 mt-0.5">
                        {failureInfo.status.supported ? 'نعم' : 'لا'}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <div className="text-slate-400 font-medium">الإذن</div>
                      <div className="font-bold text-slate-700 mt-0.5">
                        {failureInfo.status.permission}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <div className="text-slate-400 font-medium">VAPID</div>
                      <div className="font-bold text-slate-700 mt-0.5">
                        {failureInfo.status.vapidAvailable ? 'نعم' : 'لا'}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <div className="text-slate-400 font-medium">أجهزة</div>
                      <div className="font-bold text-slate-700 mt-0.5">
                        {failureInfo.status.serverSubscriptionCount || 0}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 pt-3 pb-5 space-y-2">
              {!isFailure ? (
                <>
                  <motion.button
                    whileHover={{ scale: busy ? 1 : 1.01 }}
                    whileTap={{ scale: busy ? 1 : 0.98 }}
                    onClick={handleEnable}
                    disabled={busy}
                    className="w-full py-3 rounded-xl bg-gradient-to-l from-blue-600 to-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {busy && !toast ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : toast?.type === 'success' ? (
                      <Check size={16} />
                    ) : (
                      <Bell size={16} />
                    )}
                    {toast ? toast.message : 'نعم، فعّل الإشعارات'}
                  </motion.button>

                  <button
                    onClick={handleDismiss}
                    disabled={busy}
                    className="w-full py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    ليس الآن
                  </button>
                </>
              ) : (
                <>
                  <motion.button
                    whileHover={{ scale: busy ? 1 : 1.02 }}
                    whileTap={{ scale: busy ? 1 : 0.98 }}
                    onClick={retryNow}
                    disabled={busy}
                    className={`w-full py-3 rounded-xl font-semibold text-sm shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 text-white ${
                      failureInfo.type === 'error'
                        ? 'bg-gradient-to-l from-rose-600 to-red-500 shadow-red-500/25 hover:shadow-red-500/40'
                        : failureInfo.type === 'warning'
                        ? 'bg-gradient-to-l from-orange-600 to-amber-500 shadow-amber-500/25 hover:shadow-amber-500/40'
                        : 'bg-gradient-to-l from-indigo-600 to-sky-500 shadow-indigo-500/25 hover:shadow-indigo-500/40'
                    }`}
                  >
                    {busy ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    {busy ? 'جاري المحاولة...' : 'إعادة المحاولة الآن'}
                  </motion.button>

                  <button
                    onClick={handleDismiss}
                    disabled={busy}
                    className="w-full py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    إغلاق (أُكمل لاحقاً)
                  </button>
                </>
              )}

              <p className="text-[10px] text-slate-400 text-center pt-1">
                يمكنك تغيير تفضيلات الإشعارات في أي وقت من صفحة الإعدادات.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
