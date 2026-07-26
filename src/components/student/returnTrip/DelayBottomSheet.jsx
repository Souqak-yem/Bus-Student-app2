import { memo, useState } from 'react'
import { Clock3, X, Send, AlertTriangle, ChevronDown } from 'lucide-react'

const REASON_OPTIONS = [
  { value: 'ازدحام', label: 'ازدحام المرور' },
  { value: 'محاضرة', label: 'داخل المحاضرة' },
  { value: 'أبحث', label: 'أبحث عن الباص' },
  { value: 'طابور', label: 'في طابور طويل' },
  { value: 'آخر', label: 'سبب آخر' },
]

const DURATION_OPTIONS = [
  { value: '5',  label: '٥ دقائق',  mins: 5  },
  { value: '10', label: '١٠ دقائق', mins: 10 },
  { value: '15', label: '١٥ دقيقة', mins: 15 },
  { value: '20', label: '٢٠ دقيقة', mins: 20 },
]

function DelayBottomSheetImpl({ open, onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [duration, setDuration] = useState('5')
  const [customMinutes, setCustomMinutes] = useState('')
  const [useCustomMinutes, setUseCustomMinutes] = useState(false)

  if (!open) return null

  const handleReset = () => {
    setReason('')
    setCustomReason('')
    setDuration('5')
    setCustomMinutes('')
    setUseCustomMinutes(false)
  }

  const handleClose = () => {
    onClose?.()
    handleReset()
  }

  const handleSubmit = () => {
    const finalMinutes = useCustomMinutes
      ? (Number(customMinutes) > 0 ? Number(customMinutes) : 30)
      : DURATION_OPTIONS.find(d => d.value === duration)?.mins || 5

    const finalReasonRaw = reason === 'آخر' ? customReason.trim() : reason
    const finalReason = finalReasonRaw || undefined

    onSubmit?.(finalMinutes, finalReason)
    handleReset()
  }

  const isReady = !submitting && (useCustomMinutes ? Number(customMinutes) > 0 : true)

  return (
    <div className="rt-bottom-sheet-backdrop" onClick={handleClose} role="dialog" aria-modal="true" aria-label="تأخير الصعود">
      <div className="rt-bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rt-bottom-sheet-handle" aria-hidden />

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-amber-600" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-tight">سأتأخر عن موعد الصعود</h3>
              <p className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">سيتم إشعار المشرف والسائق بحالتك فوراً</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 active:bg-slate-200 flex items-center justify-center shrink-0 transition-colors rt-tap-min"
            aria-label="إغلاق"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-3.5 mb-3.5">
          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 flex items-center gap-1">
              <ChevronDown size={12} className="text-slate-400" /> سبب التأخير
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReason(opt.value)}
                  className={`rt-option-tile rt-btn-min ${reason === opt.value ? 'rt-option-tile--selected' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {reason === 'آخر' && (
              <div className="mt-2 rt-anim-slide-down">
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  rows={2}
                  maxLength={140}
                  placeholder="اكتب سبب التأخير هنا..."
                  className="w-full px-2.5 py-2 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 resize-none"
                />
                <p className="text-[9.5px] text-slate-400 mt-1 text-left">{customReason.length}/140</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-extrabold text-slate-700 mb-1.5 flex items-center gap-1">
              <Clock3 size={12} className="text-slate-400" /> مدة التأخير المتوقعة
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setDuration(opt.value); setUseCustomMinutes(false) }}
                  className={`rt-option-tile rt-btn-min ${!useCustomMinutes && duration === opt.value ? 'rt-option-tile--selected' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setUseCustomMinutes(true)}
                className={`rt-option-tile rt-btn-min ${useCustomMinutes ? 'rt-option-tile--selected' : ''}`}
              >
                تحديد...
              </button>
            </div>
            {useCustomMinutes && (
              <div className="mt-2 flex items-center gap-2 rt-anim-slide-down">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="٣٠"
                  className="w-24 px-2.5 py-2 text-[13px] font-bold text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400 tabular-nums"
                />
                <span className="text-[12px] font-bold text-slate-600">دقيقة</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pb-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rt-btn-min rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-[12px] font-extrabold transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isReady}
            className="rt-btn-min rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-[12px] font-extrabold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {submitting ? (
              'جاري الإرسال...'
            ) : (
              <>
                <Send size={14} strokeWidth={2.5} /> إرسال للمشرف
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export const DelayBottomSheet = memo(DelayBottomSheetImpl)
