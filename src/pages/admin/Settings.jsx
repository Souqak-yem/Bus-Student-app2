import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Shield, LogOut, KeyRound, Clock, Save, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import { api } from '../../lib/api'

const roleLabels = { admin: 'مشرف', driver: 'سائق', student: 'طالب' }

export default function AdminSettings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [boardingMinutes, setBoardingMinutes] = useState(15)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="إعدادات النظام والحساب" />

      {user?.role === 'admin' && (
        <Section title="إعدادات رحلة العودة">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Clock size={20} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="font-semibold text-slate-800 text-sm block mb-1">
                  Default Boarding Timer
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  مدة العداد الافتراضية لتسجيل صعود الطلاب في رحلة العودة (بالدقائق). يمكن تعديلها بين 1 و 120 دقيقة.
                </p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 max-w-[180px]">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={boardingMinutes}
                      onChange={(e) => setBoardingMinutes(e.target.value)}
                      className="w-full px-3 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      دقيقة
                    </span>
                  </div>
                  <button
                    onClick={saveBoardingMinutes}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all min-h-[40px] ${
                      saved
                        ? 'bg-green-600 text-white'
                        : 'bg-[var(--color-primary)] text-white hover:brightness-110 disabled:opacity-50'
                    }`}
                  >
                    {saved ? (
                      <><Check size={14} /> تم الحفظ</>
                    ) : (
                      <><Save size={14} /> {saving ? 'جاري...' : 'حفظ'}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>
      )}

      <Section>
        <div className="divide-y">
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-lighter)] flex items-center justify-center">
              <User size={20} className="text-[var(--color-primary-dark)]" />
            </div>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{user?.phone || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center">
              <Shield size={20} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="font-semibold">نوع الحساب</p>
              <p className="text-xs text-[var(--color-text-muted)] capitalize">{roleLabels[user?.role] || user?.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <KeyRound size={20} className="text-blue-600" />
            </div>
            <div>
              <button onClick={() => navigate('/settings/change-password')} className="font-semibold text-[var(--color-primary)] hover:underline text-sm">
                تغيير كلمة المرور
              </button>
              <p className="text-xs text-[var(--color-text-muted)]">تحديث كلمة المرور الخاصة بك</p>
            </div>
          </div>
          <div className="pt-4">
            <button onClick={handleLogout} className="btn-ghost text-[var(--color-danger)]">
              <LogOut size={16} /> تسجيل الخروج
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}
