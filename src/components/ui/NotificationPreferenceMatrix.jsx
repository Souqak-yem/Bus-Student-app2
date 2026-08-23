import { useState, useEffect, useCallback } from 'react'
import { Bell, MessageSquare, Mail, Save, Check, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'
import { NOTIFICATION_CATEGORIES, buildDefaultNotificationPrefs, isPushNotificationsEnabled, requestPermission, setPushNotificationsEnabled, subscribeToPush, unsubscribeFromPush } from '../../lib/pushManager'

const CHANNELS = [
  { key: 'inApp', label: 'داخل التطبيق', icon: MessageSquare, description: 'تظهر داخل تطبيق الويب' },
  { key: 'push', label: 'إشعارات خارجية', icon: Bell, description: 'تظهر في المتصفح والهواتف' },
  { key: 'email', label: 'البريد الإلكتروني', icon: Mail, description: 'قادم قريباً', disabled: true },
]

export default function NotificationPreferenceMatrix() {
  const [prefs, setPrefs] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(isPushNotificationsEnabled)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(false)
  const [expandedCat, setExpandedCat] = useState({})

  const loadPrefs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.notifications.getPrefs()
      const serverPrefs = res?.prefs
      const defaults = buildDefaultNotificationPrefs()
      const merged = { ...defaults, ...(serverPrefs || {}) }
      Object.keys(defaults).forEach((k) => {
        if (!merged[k]) merged[k] = defaults[k]
      })
      setPrefs(merged)
    } catch (_err) {
      setPrefs(buildDefaultNotificationPrefs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  function toggleChannel(catType, channelKey) {
    if (!prefs) return
    const nextPrefs = { ...prefs }
    if (!nextPrefs[catType]) nextPrefs[catType] = { inApp: true, push: true, email: false }
    nextPrefs[catType] = { ...nextPrefs[catType], [channelKey]: !nextPrefs[catType][channelKey] }
    setPrefs(nextPrefs)
  }

  function toggleCategoryAll(category, channelKey, value) {
    if (!prefs) return
    const nextPrefs = { ...prefs }
    category.types.forEach((type) => {
      nextPrefs[type] = { ...(nextPrefs[type] || { inApp: true, push: true, email: false }), [channelKey]: value }
    })
    setPrefs(nextPrefs)
  }

  function getCategorySummary(category, channelKey) {
    if (!prefs) return { enabled: 0, total: category.types.length }
    let enabled = 0
    category.types.forEach((t) => {
      if (prefs[t]?.[channelKey]) enabled++
    })
    return { enabled, total: category.types.length }
  }

  async function savePrefs() {
    if (!prefs) return
    setSaving(true)
    try {
      await api.notifications.savePrefs(prefs)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2000)
    } catch (err) {
      alert(err?.message || 'تعذر حفظ التفضيلات')
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefaults() {
    const def = buildDefaultNotificationPrefs()
    setPrefs(def)
  }

  const handlePushToggle = async () => {
    if (pushBusy) return
    const nextValue = !pushEnabled
    setPushBusy(true)
    setPushMessage('')
    try {
      if (nextValue) {
        const permission = await requestPermission()
        if (permission !== 'granted') {
          setPushMessage('يجب السماح بالإشعارات من المتصفح لتفعيل الإشعارات الخارجية.')
          setPushEnabled(false)
          setPushNotificationsEnabled(false)
          return
        }
        await subscribeToPush()
        setPushNotificationsEnabled(true)
        setPushEnabled(true)
        setPushMessage('تم تفعيل الإشعارات الخارجية.')
      } else {
        await unsubscribeFromPush()
        setPushNotificationsEnabled(false)
        setPushEnabled(false)
        setPushMessage('تم إيقاف الإشعارات الخارجية، بينما تبقى الإشعارات داخل التطبيق مفعلة.')
      }
    } catch (error) {
      setPushMessage(error?.message || 'تعذر تحديث إعدادات الإشعارات.')
      setPushEnabled(isPushNotificationsEnabled())
    } finally {
      setPushBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-blue-100/80 rounded-xl flex items-center justify-center">
            <RefreshCw size={16} className="text-blue-600 animate-spin" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">جاري تحميل التفضيلات...</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-3 fade-in space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-100/80 rounded-xl flex items-center justify-center">
            <Bell size={16} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">تفضيلات الإشعارات</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={resetToDefaults}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            title="استعادة الافتراضية"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={savePrefs}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-primary text-white text-xs font-semibold disabled:opacity-60 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : savedToast ? <Check size={14} /> : <Save size={14} />}
            {savedToast ? 'تم الحفظ' : saving ? 'جاري...' : 'حفظ'}
          </button>
        </div>
      </div>

      {/* Push master toggle */}
      <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-2.5">
        <button
          type="button"
          onClick={handlePushToggle}
          disabled={pushBusy}
          className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full transition-colors ${pushEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${pushEnabled ? 'left-9' : 'left-1'}`} />
        </button>
        <div className="flex-1 text-right">
          <div className="text-xs font-bold text-slate-700">الإشعارات الخارجية (Push)</div>
          <div className="text-[10px] text-slate-500">التحكم العام في الإشعارات الخارجية على جهازك</div>
        </div>
      </div>
      {pushMessage && (
        <p className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-2 py-1.5">{pushMessage}</p>
      )}

      {/* Channel header legend */}
      <div className="grid grid-cols-12 gap-2 px-2 pt-1 border-b border-slate-100 pb-2">
        <div className="col-span-6 text-[10px] font-bold text-slate-400">النوع / الفئة</div>
        {CHANNELS.map((ch) => (
          <div key={ch.key} className="col-span-2 text-center">
            <div className={`text-[10px] font-bold ${ch.disabled ? 'text-slate-300' : 'text-slate-400'}`}>{ch.label}</div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {NOTIFICATION_CATEGORIES.map((cat) => {
          const isExpanded = !!expandedCat[cat.key]
          return (
            <div key={cat.key} className="rounded-xl border border-slate-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCat((prev) => ({ ...prev, [cat.key]: !isExpanded }))}
                className="w-full flex items-center gap-2 p-2 bg-slate-50/60 hover:bg-slate-50 transition-colors"
              >
                <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                <span className="text-xs font-bold text-slate-700 flex-1 text-right">{cat.label}</span>
                <span className="text-[10px] text-slate-400">{cat.types.length} نوع</span>
              </button>

              {/* Category-level quick toggles */}
              <div className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 border-b border-slate-100 bg-white">
                <div className="col-span-6 text-[10px] font-semibold text-slate-500 text-right pr-4">تشغيل/إيقاف الكل للفئة</div>
                {CHANNELS.map((ch) => {
                  const { enabled, total } = getCategorySummary(cat, ch.key)
                  const allOn = enabled === total
                  return (
                    <div key={ch.key} className="col-span-2 flex flex-col items-center gap-0.5">
                      <button
                        type="button"
                        disabled={ch.disabled}
                        onClick={() => toggleCategoryAll(cat, ch.key, !allOn)}
                        className={`w-7 h-4 rounded-full relative transition-colors ${ch.disabled ? 'bg-slate-200' : allOn ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${allOn ? 'left-3.5' : 'left-0.5'}`} />
                      </button>
                      <span className={`text-[9px] ${ch.disabled ? 'text-slate-300' : 'text-slate-400'}`}>{enabled}/{total}</span>
                    </div>
                  )
                })}
              </div>

              {/* Per-type rows */}
              {isExpanded && (
                <div className="divide-y divide-slate-50 bg-white">
                  {cat.types.map((typeKey) => (
                    <div key={typeKey} className="grid grid-cols-12 gap-2 items-center px-2 py-1.5">
                      <div className="col-span-6 text-[10px] text-slate-600 text-right pr-4 truncate" title={typeKey}>
                        {typeKey.replace(/_/g, ' ')}
                      </div>
                      {CHANNELS.map((ch) => {
                        const val = !!prefs?.[typeKey]?.[ch.key]
                        return (
                          <div key={ch.key} className="col-span-2 flex items-center justify-center">
                            <button
                              type="button"
                              disabled={ch.disabled}
                              onClick={() => toggleChannel(typeKey, ch.key)}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                                ch.disabled ? 'bg-slate-200 opacity-50' : val ? 'bg-blue-600' : 'bg-slate-200'
                              }`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${val ? 'left-5' : 'left-0.5'}`} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-slate-400 text-center pt-1">
        يمكنك التحكم في كل نوع إشعار على حدة، وبعض القنوات غير متاحة حالياً.
      </p>
    </div>
  )
}
