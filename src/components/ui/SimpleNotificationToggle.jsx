import { useState, useEffect, useCallback } from 'react'
import { Bell, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { NOTIFICATION_CATEGORIES, buildDefaultNotificationPrefs, isPushNotificationsEnabled, requestPermission, setPushNotificationsEnabled, subscribeToPush, unsubscribeFromPush } from '../../lib/pushManager'

export default function SimpleNotificationToggle() {
  const [pushEnabled, setPushEnabled] = useState(() => isPushNotificationsEnabled())
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [serverEnabled, setServerEnabled] = useState(true)

  const loadPrefs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.notifications.getPrefs()
      const serverPrefs = res?.prefs
      if (serverPrefs && typeof serverPrefs === 'object') {
        const allTypes = []
        NOTIFICATION_CATEGORIES.forEach(({ types }) => types.forEach((t) => allTypes.push(t)))
        let pushOnCount = 0
        let pushTotalCount = 0
        allTypes.forEach((t) => {
          const tp = serverPrefs[t]
          if (tp) {
            pushTotalCount++
            if (tp.push !== false) pushOnCount++
          }
        })
        const def = serverPrefs.default
        if (def) {
          pushTotalCount++
          if (def.push !== false) pushOnCount++
        }
        const mostlyOn = pushTotalCount === 0 ? true : pushOnCount >= pushTotalCount / 2
        setServerEnabled(mostlyOn)
      } else {
        setServerEnabled(true)
      }
    } catch (_err) {
      setServerEnabled(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  async function saveAllPushPrefs(enabled) {
    const defaults = buildDefaultNotificationPrefs()
    const nextPrefs = {}
    Object.keys(defaults).forEach((type) => {
      nextPrefs[type] = { ...defaults[type], push: enabled }
    })
    await api.notifications.savePrefs(nextPrefs)
  }

  const handlePushToggle = async () => {
    if (pushBusy) return
    const nextValue = !pushEnabled
    setPushBusy(true)
    setPushMessage('')
    try {
      try {
        await api.notifications.markPromptSeen()
      } catch {}
      if (nextValue) {
        const permission = await requestPermission()
        if (permission !== 'granted') {
          setPushMessage('يجب السماح بالإشعارات من المتصفح لتفعيل الإشعارات الخارجية.')
          setPushEnabled(false)
          setPushNotificationsEnabled(false)
          return
        }
        await subscribeToPush()
        await saveAllPushPrefs(true)
        setPushNotificationsEnabled(true)
        setPushEnabled(true)
        setServerEnabled(true)
        setPushMessage('تم تفعيل جميع الإشعارات الخارجية بنجاح.')
      } else {
        await unsubscribeFromPush()
        await saveAllPushPrefs(false)
        setPushNotificationsEnabled(false)
        setPushEnabled(false)
        setServerEnabled(false)
        setPushMessage('تم إيقاف جميع الإشعارات الخارجية. تظل الإشعارات داخل التطبيق مفعلة.')
      }
    } catch (error) {
      setPushMessage(error?.message || 'تعذر تحديث إعدادات الإشعارات.')
      setPushEnabled(isPushNotificationsEnabled())
    } finally {
      setPushBusy(false)
      setTimeout(() => setPushMessage(''), 4000)
    }
  }

  if (loading) {
    return (
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-100/80 rounded-xl flex items-center justify-center">
            <RefreshCw size={16} className="text-blue-600 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">جاري تحميل إعدادات الإشعارات...</h3>
        </div>
      </div>
    )
  }

  const effectiveOn = pushEnabled || serverEnabled

  return (
    <div className="card p-3 fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-100/80 rounded-xl flex items-center justify-center">
            <Bell size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">تفضيلات الإشعارات</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {effectiveOn ? 'سيتم استلام جميع الإشعارات الخارجية' : 'الإشعارات الخارجية متوقفة'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePushToggle}
          disabled={pushBusy}
          className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full transition-colors disabled:opacity-70 ${effectiveOn ? 'bg-blue-600' : 'bg-slate-300'}`}
          aria-label={effectiveOn ? 'إيقاف الإشعارات الخارجية' : 'تفعيل الإشعارات الخارجية'}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${effectiveOn ? 'left-9' : 'left-1'}`} />
        </button>
      </div>

      {pushMessage && (
        <p className="mt-3 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-2">{pushMessage}</p>
      )}
    </div>
  )
}
