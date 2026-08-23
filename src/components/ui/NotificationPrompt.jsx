import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Check, Bus, CreditCard, AlertTriangle, Clock, DollarSign, FileText, ArrowLeft, ArrowRight, Users, Play, CalendarCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { subscribeToPush, setPushNotificationsEnabled, DEFAULT_NOTIFICATION_PREFS } from '../../lib/pushManager'

const APPEAR_DELAY_MS = 2000

const FEATURE_ICONS = [
  { icon: Bus, label: 'حالة الباصات' },
  { icon: CreditCard, label: 'حالة الاشتراك' },
  { icon: AlertTriangle, label: 'البلاغات الطارئة' },
  { icon: Clock, label: 'مواعيد الرحلات' },
  { icon: DollarSign, label: 'تذكيرات الدفع' },
  { icon: CalendarCheck, label: 'جدول العمليات' },
]

export default function NotificationPrompt() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

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
    try {
      setPushNotificationsEnabled(true)
      await api.notifications.savePrefs(DEFAULT_NOTIFICATION_PREFS)
      await api.notifications.markPromptSeen()
      const result = await subscribeToPush()
      if (result.success) {
        setToast({ type: 'success', message: 'تم تفعيل الإشعارات بنجاح ✅' })
      } else if (result.reason === 'denied') {
        setToast({ type: 'warning', message: 'تم رفض الإذن. يمكنك تفعيله لاحقاً من إعدادات المتصفح.' })
      } else if (result.reason === 'unsupported') {
        setToast({ type: 'warning', message: 'متصفحك لا يدعم الإشعارات الخارجية.' })
      } else {
        setToast({ type: 'success', message: 'تم حفظ التفضيلات.' })
      }
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'حدث خطأ أثناء تفعيل الإشعارات.' })
    } finally {
      setBusy(false)
      setTimeout(() => {
        setShow(false)
        setToast(null)
      }, 1800)
    }
  }, [busy])

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
    }
  }, [busy, markSeenOnly])

  if (!show) return null

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
            >
              <X size={16} className="text-slate-500" />
            </button>

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

            <div className="px-5 pt-3 pb-5 space-y-2">
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
