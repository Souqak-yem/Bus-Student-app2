import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Save, Eye, EyeOff, KeyRound, MessageCircle, Loader2, Bell, BellOff, Palette, Type, SunMedium } from 'lucide-react'
import QuickContactCard from '../../components/ui/QuickContactCard'
import { applyDisplaySettings, getDisplaySettings, saveDisplaySettings as persistDisplaySettings } from '../../lib/displaySettings'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { isPushNotificationsEnabled, requestPermission, setPushNotificationsEnabled, subscribeToPush, unsubscribeFromPush } from '../../lib/pushManager'

const REGISTRATION_CONTACT_PHONE = '967734904945'
const COLOR_SWATCHES = [
  { name: 'أزرق', value: '#2563EB' },
  { name: 'أزرق داكن', value: '#1D4ED8' },
  { name: 'أخضر', value: '#10B981' },
  { name: 'أخضر زيتوني', value: '#3F8F6B' },
  { name: 'وردي', value: '#EC4899' },
  { name: 'وردي داكن', value: '#BE185D' },
  { name: 'أرجواني', value: '#8B5CF6' },
  { name: 'بنفسجي', value: '#7C3AED' },
  { name: 'برتقالي', value: '#F97316' },
  { name: 'برتقالي محمّر', value: '#EA580C' },
  { name: 'أصفر ذهبي', value: '#F59E0B' },
  { name: 'أسود', value: '#1F2937' },
  { name: 'رمادي داكن', value: '#475569' },
  { name: 'سماوي', value: '#06B6D4' },
  { name: 'أحمر', value: '#EF4444' },
  { name: 'أحمر قلوي', value: '#DC2626' },
]

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const num = Number.parseInt(full, 16)
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function mixColor(hex, targetHex, weight) {
  const base = hexToRgb(hex)
  const target = hexToRgb(targetHex)
  const mix = (start, end) => Math.round(start + (end - start) * weight)
  const toHex = (value) => value.toString(16).padStart(2, '0')
  return `#${toHex(mix(base.r, target.r))}${toHex(mix(base.g, target.g))}${toHex(mix(base.b, target.b))}`
}

function formatTransportMode(value) {
  if (!value) return '—'
  const map = {
    LINE: 'على الخط',
    HOME: 'توصيل منزلي',
  }
  return map[value] || value
}

function formatGender(value) {
  if (!value) return '—'
  const map = {
    MALE: 'ذكر',
    FEMALE: 'أنثى',
  }
  return map[value] || value
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [showProfileDetails, setShowProfileDetails] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showSupportContact, setShowSupportContact] = useState(false)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showDisplaySettings, setShowDisplaySettings] = useState(false)
  const [themeMode, setThemeMode] = useState('light')
  const [fontSize, setFontSize] = useState('normal')
  const [appColor, setAppColor] = useState('#2563EB')
  const [pushEnabled, setPushEnabled] = useState(isPushNotificationsEnabled)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState('')

  useEffect(() => {
    const saved = getDisplaySettings()
    const nextTheme = saved.theme || 'light'
    const nextFontSize = saved.fontSize || 'normal'
    const nextColor = saved.appColor || '#2563EB'

    setThemeMode(nextTheme)
    setFontSize(nextFontSize)
    setAppColor(nextColor)
    applyDisplaySettings(saved)
  }, [])

  const saveDisplaySettings = (nextFontSize, nextColor) => {
    const settings = { theme: 'light', fontSize: nextFontSize, appColor: nextColor }
    persistDisplaySettings(settings)
  }

  useEffect(() => {
    if (!user?.studentId) {
      setProfileLoading(false)
      return
    }

    let active = true
    api.students.get(user.studentId)
      .then((student) => {
        if (active) setProfile(student)
      })
      .catch(() => {
        if (active) setProfile(null)
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [user?.studentId])

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('جميع الحقول مطلوبة')
      return
    }
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة غير مطابقة')
      return
    }

    setSubmitting(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      setSuccess('تم تغيير كلمة المرور بنجاح')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
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

  const requestEditMessage = `السلام عليكم، أريد طلب تعديل بياناتي الشخصية`

  const requestEditLink = `https://wa.me/${REGISTRATION_CONTACT_PHONE}?text=${encodeURIComponent(requestEditMessage)}`

  const profileFields = [
    { label: 'الاسم', value: profile?.name || user?.name || '—' },
    { label: 'رقم الجوال', value: profile?.phone || user?.phone || '—' },
    { label: 'الواتساب', value: profile?.whatsapp || '—' },
    { label: 'المنطقة', value: profile?.zone || '—' },
    { label: 'الوجهة', value: profile?.destination?.name || '—' },
    { label: 'التخصص', value: profile?.major || '—' },
    { label: 'المستوى', value: profile?.level || '—' },
    { label: 'العنوان', value: profile?.address || '—' },
    { label: 'اسم ولي الأمر', value: profile?.parentName || '—' },
    { label: 'جوال ولي الأمر', value: profile?.parentPhone || '—' },
    { label: 'القرابة', value: profile?.parentRelation || '—' },
    { label: 'نوع التوصيل', value: formatTransportMode(profile?.transportMode) },
    { label: 'نقطة الانتظار', value: profile?.pickupLocation || '—' },
    { label: 'عنوان المنزل', value: profile?.homeAddress || '—' },
    { label: 'الجنس', value: formatGender(profile?.gender) },
  ]

  const homeDeliveryFields = profile?.transportMode === 'HOME'
    ? [
        { label: 'رسوم التوصيل اليومي', value: profile?.homeDeliveryFeeDaily != null ? `${Number(profile.homeDeliveryFeeDaily)} ر.ي` : '—' },
        { label: 'رسوم التوصيل ٣ أسابيع', value: profile?.homeDeliveryFeeThreeWeeks != null ? `${Number(profile.homeDeliveryFeeThreeWeeks)} ر.ي` : '—' },
        { label: 'رسوم التوصيل ٤ أسابيع', value: profile?.homeDeliveryFeeFourWeeks != null ? `${Number(profile.homeDeliveryFeeFourWeeks)} ر.ي` : '—' },
        { label: 'حالة التوصيل المنزلي', value: profile?.homeDeliveryActive ? 'نشط' : 'غير نشط' },
      ]
    : []

  const visibleProfileFields = [...profileFields, ...homeDeliveryFields]

  return (
    <div className="space-y-2">
      {/* Profile info */}
      <div className="card p-3 fade-in">
        <button
          type="button"
          onClick={() => setShowProfileDetails((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center">
              <User size={16} className="text-[var(--color-primary)]" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">المعلومات الشخصية</h3>
          </div>
          <div className="flex items-center gap-2">
            {profileLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            <span className="text-slate-400 text-xs">{showProfileDetails ? 'إخفاء' : 'عرض'}</span>
          </div>
        </button>

        {showProfileDetails && (
          <div className="mt-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              {visibleProfileFields.map((field, index) => (
                <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
                  <div className="text-[10px] text-slate-500 mb-1">{field.label}</div>
                  <div className="text-slate-700 text-left break-words leading-relaxed">{field.value}</div>
                </div>
              ))}
            </div>

            <a
              href={requestEditLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 text-green-700 px-3 py-2.5 text-xs font-medium hover:bg-green-100 transition-colors"
            >
              <MessageCircle size={14} />
              طلب تعديل البيانات
            </a>
          </div>
        )}
      </div>

      {/* Notification preferences */}
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-blue-100/80 rounded-xl flex items-center justify-center">
            {pushEnabled ? <Bell size={16} className="text-blue-600" /> : <BellOff size={16} className="text-blue-600" />}
          </div>
          <h3 className="text-sm font-bold text-slate-800">الإشعارات</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
            <div>
              <div className="text-xs font-medium text-slate-700">الإشعارات داخل التطبيق</div>
              <div className="text-[10px] text-slate-500">مفعلة دائمًا داخل التطبيق</div>
            </div>
            <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-1 text-[10px] font-semibold">مفعلة</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
            <button
              type="button"
              onClick={handlePushToggle}
              disabled={pushBusy}
              className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full transition-colors ${pushEnabled ? 'bg-[var(--color-primary)]' : 'bg-slate-300'}`}
              aria-label={pushEnabled ? 'إيقاف الإشعارات الخارجية' : 'تفعيل الإشعارات الخارجية'}
            >
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${pushEnabled ? 'left-9' : 'left-1'}`} />
            </button>
            <div className="flex-1 text-right">
              <div className="text-xs font-medium text-slate-700">الإشعارات الخارجية</div>
              <div className="text-[10px] text-slate-500">تظهر في المتصفح/الهواتف عند الموافقة</div>
            </div>
          </div>

          {pushMessage && (
            <p className="text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-2 py-1.5">{pushMessage}</p>
          )}
        </div>
      </div>

      {/* Display settings */}
      <div className="card p-3 fade-in">
        <button
          type="button"
          onClick={() => setShowDisplaySettings((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center">
              <Palette size={16} className="text-[var(--color-primary)]" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">إعدادات العرض</h3>
          </div>
          <span className="text-slate-400 text-xs">{showDisplaySettings ? 'إخفاء' : 'عرض'}</span>
        </button>

        {showDisplaySettings && (
          <div className="mt-3 space-y-3 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium">
                <Type size={14} className="text-[var(--color-primary)]" />
                حجم الخط
              </div>
              <div className="flex gap-2">
                {Object.entries({ small: 'صغير', normal: 'عادي', large: 'كبير' }).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFontSize(key)
                      saveDisplaySettings(key, appColor)
                    }}
                    className={`flex-1 rounded-xl border px-2 py-1.5 transition-colors ${fontSize === key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium">
                <SunMedium size={14} className="text-[var(--color-primary)]" />
                الوضع الافتراضي
              </div>
              <div className="text-[10px] text-slate-500">الوضع الفاتح</div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="flex items-center gap-2 mb-2 text-slate-700 font-medium">
                <Palette size={14} className="text-[var(--color-primary)]" />
                لون التطبيق
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={color.name}
                    onClick={() => {
                      const nextColor = color.value
                      setAppColor(nextColor)
                      saveDisplaySettings(fontSize, nextColor)
                    }}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${appColor.toLowerCase() === color.value.toLowerCase() ? 'scale-110 border-slate-900 shadow-sm' : 'border-white'}`}
                    style={{ backgroundColor: color.value }}
                    aria-label={`اختيار اللون ${color.name}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="card p-3 fade-in">
        <button
          type="button"
          onClick={() => setShowPasswordForm((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-amber-100/70 rounded-xl flex items-center justify-center">
              <KeyRound size={16} className="text-amber-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">تغيير كلمة المرور</h3>
          </div>
          <span className="text-slate-400 text-xs">{showPasswordForm ? 'إخفاء' : 'عرض'}</span>
        </button>

        {showPasswordForm && (
          <form onSubmit={handleChangePassword} className="space-y-2 mt-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">كلمة المرور الحالية</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                  dir="ltr" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">كلمة المرور الجديدة</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                  dir="ltr" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">تأكيد كلمة المرور الجديدة</label>
              <input type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                dir="ltr" />
            </div>

            {error && <p className="text-red-500 text-xs">{error}</p>}
            {success && <p className="text-green-700 text-xs bg-green-50 border border-green-100 p-2 rounded-xl">{success}</p>}

            <button type="submit" disabled={submitting}
              className="w-full gradient-primary text-white py-2.5 rounded-xl text-xs font-medium disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all">
              <Save size={14} />
              {submitting ? 'جاري...' : 'حفظ التغييرات'}
            </button>
          </form>
        )}
      </div>

      {/* How it works */}
      <div className="card p-3 fade-in">
        <button
          type="button"
          onClick={() => setShowHowItWorks((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-violet-100/80 rounded-xl flex items-center justify-center">
              <span className="text-[15px] text-violet-600 font-bold">?</span>
            </div>
            <h3 className="text-sm font-bold text-slate-800">طريقة عمل التطبيق</h3>
          </div>
          <span className="text-slate-400 text-xs">{showHowItWorks ? 'إخفاء' : 'عرض'}</span>
        </button>

        {showHowItWorks && (
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="font-bold text-slate-800 mb-1">1. اختر اشتراكك</div>
              <p>من قائمة الاشتراكات يمكنك اختيار الاشتراك اليومي أو الأسبوعي أو عرض الأسعار الحالية.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="font-bold text-slate-800 mb-1">2. أضف إلى السلة</div>
              <p>بعد اختيار المدة والأيام المناسبة، أضف الطلب إلى السلة ثم أرسل السند أو المرجع.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="font-bold text-slate-800 mb-1">3. تابع الحالة</div>
              <p>يمكنك متابعة حالة الاشتراك من قسم السجل ومعرفة ما إذا تم قبوله أو رفضه أو قيد المراجعة.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="font-bold text-slate-800 mb-1">4. استخدم التواصل السريع</div>
              <p>إذا احتجت المساعدة، يمكنك التواصل مباشرة مع مختص التسجيل أو المدير العام من نفس الصفحة.</p>
            </div>
          </div>
        )}
      </div>

      {/* Support contact */}
      <div className="card p-3 fade-in">
        <button
          type="button"
          onClick={() => setShowSupportContact((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-green-100/80 rounded-xl flex items-center justify-center">
              <MessageCircle size={16} className="text-green-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">الدعم والتواصل</h3>
          </div>
          <span className="text-slate-400 text-xs">{showSupportContact ? 'إخفاء' : 'عرض'}</span>
        </button>

        {showSupportContact && (
          <div className="mt-3">
            <QuickContactCard />
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full bg-red-50/70 border border-red-100 text-red-600 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 min-h-[44px] hover:bg-red-50 active:scale-[0.98] transition-all">
        <LogOut size={14} />
        تسجيل الخروج
      </button>
    </div>
  )
}
