import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  RotateCcw, Bell, ClipboardList, AlertTriangle, Database, FlaskConical,
  Trash2, X, CheckCircle2, Loader2,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import { api } from '../../lib/api'

const tools = [
  {
    key: 'reset-operations',
    title: 'إعادة تهيئة بيانات التشغيل اليومية',
    description: 'يحذف التشغيل الصباحي، رحلة العودة، الحضور، التتبع، الحالات المؤقتة، الطوارئ النشطة، Queue',
    keep: 'الطلاب، السائقين، الباصات، المناطق، الأسعار',
    icon: RotateCcw,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    danger: 'medium',
    endpoint: '/admin/reset-operations',
  },
  {
    key: 'reset-subscriptions',
    title: 'إعادة تعيين بيانات الاشتراكات',
    description: 'يحذف الطلبات، الاشتراكات اليومية المنتهية، الموافقات',
    keep: 'الطلاب، الاشتراكات النشطة',
    icon: Database,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    danger: 'medium',
    endpoint: '/admin/reset-subscriptions',
  },
  {
    key: 'reset-notifications',
    title: 'إعادة ضبط الإشعارات',
    description: 'يحذف جميع الإشعارات فقط',
    keep: 'جميع البيانات الأخرى',
    icon: Bell,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    danger: 'low',
    endpoint: '/admin/reset-notifications',
  },
  {
    key: 'reset-logs',
    title: 'إعادة ضبط السجلات',
    description: 'يحذف سجل التدقيق (Audit Logs) إذا أصبحت ضخمة',
    keep: 'جميع البيانات الأخرى',
    icon: ClipboardList,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    danger: 'low',
    endpoint: '/admin/reset-logs',
  },
]

const dangerColors = {
  low: { border: 'border-slate-200', hover: 'hover:border-slate-300' },
  medium: { border: 'border-amber-200', hover: 'hover:border-amber-300' },
  high: { border: 'border-red-200', hover: 'hover:border-red-300' },
}

export default function AdminSystemManagement() {
  const [loading, setLoading] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const [resultDetails, setResultDetails] = useState(null)

  async function handleToolAction(key, endpoint) {
    if (loading) return
    setLoading(key)
    setResult(null)
    setError(null)
    setResultDetails(null)
    try {
      const res = await api.post(endpoint)
      setResult(res.message || 'تم بنجاح')
      if (res.data) setResultDetails(res.data)
    } catch (err) {
      setError(err.message || 'فشلت العملية')
    } finally {
      setLoading(null)
    }
  }

  async function handleSystemReset() {
    const expected = resetConfirm.includes('إعادة ضبط') ? 'إعادة ضبط النظام' : 'RESET'
    if (resetConfirm !== expected) return
    setLoading('reset-system')
    setResult(null)
    setError(null)
    setResultDetails(null)
    setShowResetModal(false)
    try {
      const res = await api.post('/admin/reset-system', {
        confirm: resetConfirm,
        lang: resetConfirm.includes('إعادة ضبط') ? 'ar' : 'en',
      })
      setResult(res.message || 'تم إعادة ضبط النظام بالكامل')
    } catch (err) {
      setError(err.message || 'فشلت عملية إعادة ضبط النظام')
    } finally {
      setLoading(null)
      setResetConfirm('')
    }
  }

  async function handleSeedDemo() {
    if (loading) return
    setLoading('seed-demo')
    setResult(null)
    setError(null)
    setResultDetails(null)
    try {
      const res = await api.post('/admin/seed-demo')
      setResult(res.message || 'تم إنشاء البيانات التجريبية')
      if (res.data) setResultDetails(res.data)
    } catch (err) {
      setError(err.message || 'فشلت عملية إنشاء البيانات التجريبية')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <PageHeader title="إدارة النظام" subtitle="أدوات صيانة وإعادة ضبط النظام" />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-[var(--color-danger-light)] border border-red-200 text-sm text-[var(--color-danger)] flex items-center gap-2"
        >
          <AlertTriangle size={16} />
          {error}
        </motion.div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-[var(--color-success-light)] border border-green-200 text-sm text-green-700 flex items-center gap-2"
        >
          <CheckCircle2 size={16} />
          {result}
          {resultDetails && (
            <span className="text-xs text-green-500 mr-2">
              ({Object.entries(resultDetails).map(([k, v]) => `${k}: ${v}`).join(' | ')})
            </span>
          )}
        </motion.div>
      )}

      {/* Tool Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon
          const dc = dangerColors[tool.danger]
          const isActive = loading === tool.key
          return (
            <Section key={tool.key} className={dc.border}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${tool.bgColor} flex items-center justify-center shrink-0`}>
                  <Icon size={20} className={tool.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">{tool.title}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{tool.description}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    <span className="font-medium text-green-600">يحتفظ بـ:</span> {tool.keep}
                  </p>
                  <div className="mt-3">
                    <button
                      onClick={() => handleToolAction(tool.key, tool.endpoint)}
                      disabled={!!isActive}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        tool.danger === 'low'
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : tool.danger === 'medium'
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      } disabled:opacity-50`}
                    >
                      {isActive ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      {isActive ? 'جارٍ التنفيذ...' : 'تنفيذ'}
                    </button>
                  </div>
                </div>
              </div>
            </Section>
          )
        })}
      </div>

      {/* Full System Reset */}
      <Section title="إعادة ضبط النظام بالكامل" subtitle="وضع التجربة - يحذف جميع البيانات ويبقي الأدمن والإعدادات" icon={AlertTriangle} className="mt-4 border-red-300">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-red-50 border border-red-100">
              <p className="font-semibold text-red-700 mb-1">سيتم حذف:</p>
              <ul className="space-y-0.5 text-red-600">
                <li>✓ جميع الطلاب</li>
                <li>✓ جميع السائقين</li>
                <li>✓ جميع المستخدمين (عدا الأدمن)</li>
                <li>✓ جميع العمليات والتشغيل</li>
                <li>✓ الاشتراكات والمدفوعات</li>
                <li>✓ الحملات والطلبات</li>
                <li>✓ الإشعارات والسجلات</li>
                <li>✓ الكشوف الأسبوعية</li>
                <li>✓ الحالات المالية</li>
                <li>✓ جميع البيانات التشغيلية</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-green-50 border border-green-100">
              <p className="font-semibold text-green-700 mb-1">سيتم الاحتفاظ بـ:</p>
              <ul className="space-y-0.5 text-green-600">
                <li>✓ حساب الأدمن الرئيسي</li>
                <li>✓ الوجهات</li>
                <li>✓ المناطق (Pricing Areas)</li>
                <li>✓ الأسعار (Pricing)</li>
                <li>✓ إعدادات النظام</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowResetModal(true)}
              disabled={!!loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
            >
              {loading === 'reset-system' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <AlertTriangle size={16} />
              )}
              {loading === 'reset-system' ? 'جارٍ إعادة الضبط...' : 'إعادة ضبط النظام بالكامل'}
            </button>
          </div>
        </div>
      </Section>

      {/* Seed Demo Data */}
      <Section title="إنشاء بيانات تجريبية" subtitle="ينشئ 30 طالباً، 6 سائقين، 8 باصات، تشغيل، حضور، اشتراكات وإشعارات" icon={FlaskConical} className="mt-4">
        <button
          onClick={handleSeedDemo}
          disabled={!!loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 shadow-sm"
        >
          {loading === 'seed-demo' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FlaskConical size={16} />
          )}
          {loading === 'seed-demo' ? 'جارٍ الإنشاء...' : 'إنشاء بيانات تجريبية'}
        </button>
      </Section>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setShowResetModal(false); setResetConfirm('') }}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl border border-red-200 p-6 w-full max-w-[min(95vw,760px)] lg:max-w-[840px]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-600" />
                <h3 className="text-lg font-bold text-red-700">تأكيد إعادة ضبط النظام</h3>
              </div>
              <button
                onClick={() => { setShowResetModal(false); setResetConfirm('') }}
                className="p-1 rounded-lg hover:bg-[var(--color-border-light)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              <p className="font-bold mb-1">⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!</p>
              <p>سيتم حذف جميع البيانات بما في ذلك الطلاب والسائقين والعمليات والإشعارات. لن يتم حذف حساب الأدمن الرئيسي، الوجهات، المناطق، والأسعار.</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                اكتب <span className="font-bold text-red-600">إعادة ضبط النظام</span> أو <span className="font-bold text-red-600">RESET</span> للتأكيد:
              </label>
              <input
                type="text"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder="اكتب إعادة ضبط النظام أو RESET"
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowResetModal(false); setResetConfirm('') }}
                className="flex-1 px-4 py-2 rounded-xl border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-border-light)] transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={handleSystemReset}
                disabled={resetConfirm !== 'إعادة ضبط النظام' && resetConfirm !== 'RESET'}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                تأكيد الحذف
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
