import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, Save, Eye, EyeOff, KeyRound, Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'

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

  return (
    <div className="space-y-2">
      {/* Profile info */}
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-[var(--color-primary)]/10 rounded-xl flex items-center justify-center">
            <User size={16} className="text-[var(--color-primary)]" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">المعلومات الشخصية</h3>
        </div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between py-1">
            <span className="text-slate-500">الاسم:</span>
            <span className="text-slate-700 font-medium">{user?.name}</span>
          </div>
          <div className="flex justify-between py-1 border-t border-slate-100">
            <span className="text-slate-500">اسم المستخدم:</span>
            <span className="text-slate-700">{user?.username}</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="card p-3 fade-in">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 bg-amber-100/70 rounded-xl flex items-center justify-center">
            <KeyRound size={16} className="text-amber-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">تغيير كلمة المرور</h3>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-2">
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
