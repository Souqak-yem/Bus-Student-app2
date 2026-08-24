import { useState, useRef, useCallback, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'

const STEPS = [
  {
    image: '/images/ios-install/step1.jpg',
    title: 'الخطوة 1',
    text: 'افتح الموقع باستخدام متصفح Safari.',
  },
  {
    image: '/images/ios-install/step2.jpg',
    title: 'الخطوة 2',
    text: 'اضغط زر المشاركة أسفل الشاشة.',
  },
  {
    image: '/images/ios-install/step3.jpg',
    title: 'الخطوة 3',
    text: 'اختر "إضافة إلى الشاشة الرئيسية".',
  },
  {
    image: '/images/ios-install/step4.jpg',
    title: 'الخطوة 4',
    text: 'اضغط "إضافة" وسيتم تثبيت التطبيق على جهازك.',
  },
]

export default function IOSInstallGuide({ open, onClose, onFinished }) {
  const [step, setStep] = useState(0)
  const [imageLoaded, setImageLoaded] = useState({})
  const containerRef = useRef(null)
  const touchStartX = useRef(0)

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) setStep(step + 1)
  }, [step])

  const goPrev = useCallback(() => {
    if (step > 0) setStep(step - 1)
  }, [step])

  const handleFinish = useCallback(() => {
    onFinished?.()
    onClose?.()
  }, [onFinished, onClose])

  useEffect(() => {
    if (!open) return
    setStep(0)
    setImageLoaded({})
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') goNext()
      else if (e.key === 'ArrowRight') goPrev()
      else if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, goNext, goPrev, onClose])

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext()
      else goPrev()
    }
  }

  const handleImageLoad = (idx) => {
    setImageLoaded((prev) => ({ ...prev, [idx]: true }))
  }

  if (!open) return null

  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center"
      onClick={onClose}
      dir="rtl"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Bottom Sheet */}
      <div
        ref={containerRef}
        className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
          border: '1px solid rgba(255,255,255,0.5)',
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors z-10"
        >
          <X size={16} className="text-slate-400" />
        </button>

        {/* Header */}
        <div className="px-5 pt-5 pb-2 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center mb-2 shadow-lg">
            <span className="text-white text-lg font-bold">م</span>
          </div>
          <h3 className="text-sm font-bold text-slate-800">تثبيت تطبيق مواصلاتك</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">اتبع الخطوات التالية لإضافة التطبيق إلى الشاشة الرئيسية</p>
        </div>

        {/* Step content with fade+slide transition */}
        <div className="px-5 py-3">
          <div className="relative overflow-hidden rounded-xl bg-white/60 border border-white/40 min-h-[280px] sm:min-h-[320px]">
            {/* Image */}
            <div className="w-full flex items-center justify-center p-4">
              {!imageLoaded[step] && (
                <div className="w-full h-[180px] sm:h-[220px] rounded-lg bg-slate-100 animate-pulse" />
              )}
              <img
                src={current.image}
                alt={current.title}
                loading="lazy"
                onLoad={() => handleImageLoad(step)}
                className={`w-full max-h-[180px] sm:max-h-[220px] object-contain rounded-lg transition-all duration-250 ${
                  imageLoaded[step] ? 'opacity-100' : 'opacity-0 absolute'
                }`}
                style={{
                  transform: `translateX(${0}px)`,
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}
              />
            </div>

            {/* Text */}
            <div className="px-4 pb-4 text-center">
              <div className="inline-block px-3 py-1 rounded-full bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)] text-[11px] font-semibold mb-2">
                {current.title}
              </div>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{current.text}</p>
            </div>
          </div>
        </div>

        {/* Page indicators */}
        <div className="flex items-center justify-center gap-2 pb-3">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`block rounded-full transition-all duration-250 ${
                i === step
                  ? 'w-5 h-2 bg-[var(--color-primary)]'
                  : 'w-2 h-2 bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="px-5 pb-5 flex items-center gap-3">
          {!isFirst && (
            <button
              onClick={goPrev}
              className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
            >
              <ChevronRight size={16} />
              السابق
            </button>
          )}
          {isFirst && <div className="flex-1" />}

          {isLast ? (
            <button
              onClick={handleFinish}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              تم
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              التالي
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
