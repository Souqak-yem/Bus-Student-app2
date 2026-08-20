import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '../../lib/api'

export default function ForgotPassword() {
  const [form, setForm] = useState({ username: '', phone: '', parentName: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.username.trim() || !form.phone.trim() || !form.parentName.trim()) {
      setError('جميع الحقول مطلوبة')
      return
    }

    setSubmitting(true)
    try {
      const result = await api.auth.forgotPassword(form)
      setSuccess(result.message || 'تم إرسال الطلب بنجاح')
      setForm({ username: '', phone: '', parentName: '' })
    } catch (err) {
      setError(err.message || 'فشل إرسال الطلب')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">استعادة كلمة المرور</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">أدخل اسم المستخدم ورقم الهاتف واسم ولي الأمر</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">اسم المستخدم</label>
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="input-field"
              placeholder="اسم المستخدم"
              autoComplete="username"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">رقم الهاتف</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
              placeholder="0500000000"
              inputMode="numeric"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">اسم ولي الأمر</label>
            <input
              value={form.parentName}
              onChange={(e) => setForm({ ...form, parentName: e.target.value })}
              className="input-field"
              placeholder="اسم ولي الأمر"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 size={16} className="mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
            {submitting ? 'جاري إرسال الطلب...' : 'إرسال الطلب'}
          </button>

          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[var(--color-primary)] hover:underline">
            <ArrowLeft size={14} /> العودة إلى تسجيل الدخول
          </Link>
        </form>
      </div>
    </motion.div>
  )
}
