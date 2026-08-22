import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, Bus, User, Copy, Check } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const DISPLAY_SETTINGS_KEY = 'studentDisplaySettings'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const isDarkMode = false
  const { login } = useAuth()
  const navigate = useNavigate()

  const versionText = `الإصدار: ${__APP_VERSION__}\nBuild: ${__BUILD_HASH__}\nالتاريخ: ${__BUILD_TIME__}`

  const handleCopyVersion = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(versionText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }, [versionText])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      const { user, mustChangePassword } = await login(username.trim(), password)
      if (mustChangePassword) {
        navigate('/settings/change-password', { replace: true })
      } else {
        navigate(`/${user.role}`, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
      <div className={`rounded-2xl shadow-xl p-6 sm:p-8 border transition-colors ${isDarkMode ? 'bg-slate-900/95 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/full-logo.svg" alt="شعار الشركة" className="w-60 h-60 sm:w-72 sm:h-72 lg:w-80 lg:h-80 mx-auto mb-2 object-contain" />
          <p className={`-mt-10 text-sm ${isDarkMode ? 'text-slate-300' : 'text-[var(--color-text-muted)]'}`}>نظام النقل الذكي</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-200' : 'text-[var(--color-text)]'}`}>اسم المستخدم</label>
            <div className="relative">
              <User size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-400' : 'text-[var(--color-text-muted)]'}`} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسم المستخدم"
                className={`input-field pr-9 text-base ${isDarkMode ? 'placeholder:text-slate-400' : ''}`}
                required
                autoFocus
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-[var(--color-text)]'}`}>كلمة المرور</label>
              <Link to="/forgot-password" className="text-xs font-medium text-[var(--color-primary)] hover:underline">
                نسيت كلمة المرور؟
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className={`input-field pl-9 text-base ${isDarkMode ? 'placeholder:text-slate-400' : ''}`}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-100' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              className={`text-sm p-3 rounded-xl border ${isDarkMode ? 'bg-red-950/60 text-red-200 border-red-800' : 'bg-red-50 text-[var(--color-danger)] border-red-100'}`}>
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="btn-primary w-full justify-center py-2.5"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                جاري تسجيل الدخول...
              </span>
            ) : (
              <span className="flex items-center gap-2"><LogIn size={16} /> تسجيل الدخول</span>
            )}
          </button>
        </form>

        <div className={`mt-4 text-center text-sm ${isDarkMode ? 'text-slate-300' : 'text-[var(--color-text-secondary)]'}`}>
          <span>ليس لديك حساب؟</span>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="text-[var(--color-primary)] font-semibold mr-2 hover:underline"
          >
            سجل كطالب
          </button>
        </div>
      </div>

      <button
        onClick={handleCopyVersion}
        className={`flex items-center justify-center gap-1.5 mx-auto mt-4 text-xs transition-colors cursor-pointer ${isDarkMode ? 'text-slate-300 hover:text-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        title="اضغط للنسخ"
      >
        <span>الإصدار {__APP_VERSION__} &middot; Build {__BUILD_HASH__}</span>
        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      </button>
    </motion.div>
  )
}
