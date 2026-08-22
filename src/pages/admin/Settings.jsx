import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Shield, LogOut, KeyRound, Clock, Save, Check, Eye, EyeOff, Type } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { applyDisplaySettings, getDisplaySettings, saveDisplaySettings } from '../../lib/displaySettings'

export default function AdminSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [boardingMinutes, setBoardingMinutes] = useState(15)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [fontSize, setFontSize] = useState('normal')

  useEffect(() => {
    setFontSize(getDisplaySettings().fontSize || 'normal')
  }, [])

  function changeFontSize(nextFontSize) {
    setFontSize(nextFontSize)
    applyDisplaySettings(saveDisplaySettings({ ...getDisplaySettings(), fontSize: nextFontSize }))
  }

  useEffect(() => {
    if (user?.role !== 'admin') return
    api.returnReadiness.settings.getDefaultBoardingMinutes()
      .then((r) => r?.minutes && setBoardingMinutes(r.minutes))
      .catch(() => {})
  }, [user?.role])

  async function saveBoardingMinutes() {
    setSaving(true)
    setSaved(false)
    try {
      const val = Math.max(1, Math.min(120, Number(boardingMinutes) || 15))
      await api.returnReadiness.settings.setDefaultBoardingMinutes(val)
      setBoardingMinutes(val)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('جميع الحقول مطلوبة')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة غير مطابقة')
      return
    }

    setSubmitting(true)
    try {
      await api.auth.changePassword(currentPassword, newPassword)
      setPasswordSuccess('تم تغيير كلمة المرور بنجاح')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      setPasswordError(e.message || 'تعذر تغيير كلمة المرور')
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="space-y-2">
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center">
            <Type size={16} className="text-[var(--color-primary)]" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">حجم الخط</h3>
        </div>
        <div className="flex gap-2 text-xs">
          {Object.entries({ small: 'صغير', normal: 'عادي', large: 'كبير' }).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => changeFontSize(key)}
              className={`flex-1 rounded-xl border px-2 py-2 transition-colors ${fontSize === key ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="card p-3 fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 bg-indigo-100/80 rounded-xl flex items-center justify-center">
              <Clock size={16} className="text-indigo-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">إعدادات رحلة العودة</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <label className="block text-[10px] text-slate-500 mb-1">مدة العداد الافتراضية</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={boardingMinutes}
                    onChange={(e) => setBoardingMinutes(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                    dir="ltr"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">دقيقة</span>
                </div>
                <button
                  type="button"
                  onClick={saveBoardingMinutes}
                  disabled={saving}
                  className="min-w-[80px] rounded-xl bg-[var(--color-primary)] text-white px-3 py-2 text-[10px] font-medium disabled:opacity-50"
                >
                  {saving ? 'جاري...' : saved ? 'تم الحفظ' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-3 fade-in">
        <button
          type="button"
          onClick={() => setShowPasswordForm((prev) => !prev)}
          className="flex w-full items-center justify-between gap-2 text-right"
        >
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[var(--color-accent-lighter)] rounded-xl flex items-center justify-center">
              <KeyRound size={16} className="text-[var(--color-accent-dark)]" />
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
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowCurrent((prev) => !prev)} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowNew((prev) => !prev)} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">تأكيد كلمة المرور الجديدة</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10"
                dir="ltr"
              />
            </div>

            {passwordError && <p className="text-red-500 text-xs">{passwordError}</p>}
            {passwordSuccess && <p className="text-green-700 text-xs bg-green-50 border border-green-100 p-2 rounded-xl">{passwordSuccess}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full gradient-primary text-white py-2.5 rounded-xl text-xs font-medium disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all"
            >
              <Save size={14} />
              {submitting ? 'جاري...' : 'حفظ التغييرات'}
            </button>
          </form>
        )}
      </div>

      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center">
            <User size={16} className="text-[var(--color-primary)]" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{user?.name}</p>
            <p className="text-[10px] text-slate-500">{user?.phone || ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
          <div className="w-9 h-9 bg-violet-100/80 rounded-xl flex items-center justify-center">
            <Shield size={16} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-slate-500">نوع الحساب</div>
            <div className="text-xs font-medium text-slate-700">{user?.role === 'admin' ? 'مشرف' : user?.role === 'driver' ? 'سائق' : 'مستخدم'}</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-50/70 border border-red-100 text-red-600 py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 min-h-[44px] hover:bg-red-50 active:scale-[0.98] transition-all"
      >
        <LogOut size={14} />
        تسجيل الخروج
      </button>
    </div>
  )
}
