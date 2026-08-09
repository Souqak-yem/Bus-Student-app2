import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus, MapPin, ShieldCheck, ChevronLeft } from 'lucide-react'

const slides = [
  {
    title: 'مواصلاتك أصبحت أسهل',
    desc: 'احجز اشتراكك وتابع رحلتك اليومية بكل سهولة مع مشوارك',
    icon: Bus,
    accent: '#3B82F6',
    gradients: ['#EFF6FF', '#DBEAFE'],
    bgMain: ['#0B1E4A', '#1A3D8F'],
    decorColor: '#60A5FA',
    image: (
      <svg width="240" height="240" viewBox="0 0 240 240" fill="none" className="w-48 h-48 sm:w-56 sm:h-56">
        <circle cx="120" cy="120" r="112" fill="url(#s1_bg)" />
        <circle cx="120" cy="120" r="96" fill="rgba(255,255,255,0.68)" />
        <g filter="url(#s1_shadow)">
          <rect x="76" y="40" width="88" height="160" rx="22" fill="url(#s1_phone)" />
          <rect x="84" y="56" width="72" height="128" rx="16" fill="rgba(255,255,255,0.70)" />
          <rect x="103" y="48" width="34" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
          <rect x="92" y="70" width="56" height="40" rx="14" fill="rgba(59,130,246,0.13)" />
          <rect x="96" y="76" width="30" height="8" rx="4" fill="rgba(11,30,74,0.25)" />
          <rect x="96" y="88" width="42" height="8" rx="4" fill="rgba(11,30,74,0.18)" />
          <rect x="92" y="120" width="56" height="52" rx="16" fill="rgba(255,255,255,0.78)" />
          <rect x="98" y="128" width="44" height="10" rx="5" fill="rgba(11,30,74,0.14)" />
          <rect x="98" y="144" width="32" height="8" rx="4" fill="rgba(11,30,74,0.10)" />
          <rect x="98" y="156" width="38" height="8" rx="4" fill="rgba(11,30,74,0.10)" />
          <g transform="translate(148 128)">
            <rect x="-18" y="10" width="36" height="22" rx="6" fill="url(#s1_bus)" />
            <rect x="-12" y="2" width="24" height="10" rx="4" fill="#F59E0B" opacity="0.95" />
            <rect x="-10" y="6" width="10" height="4" rx="2" fill="#0B1E4A" opacity="0.25" />
            <rect x="2" y="6" width="10" height="4" rx="2" fill="#0B1E4A" opacity="0.25" />
            <circle cx="-8" cy="32" r="3.2" fill="#334155" opacity="0.9" />
            <circle cx="8" cy="32" r="3.2" fill="#334155" opacity="0.9" />
          </g>
        </g>
        <path d="M34 172 C60 160, 86 168, 104 184 C122 200, 148 206, 206 188" stroke="rgba(59,130,246,0.35)" strokeWidth="8" strokeLinecap="round" />
        <circle cx="46" cy="170" r="4" fill="rgba(59,130,246,0.35)" />
        <circle cx="198" cy="190" r="4" fill="rgba(59,130,246,0.35)" />
        <defs>
          <linearGradient id="s1_bg" x1="28" y1="20" x2="216" y2="228" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(96,165,250,0.55)" />
            <stop offset="0.55" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(167,139,250,0.45)" />
          </linearGradient>
          <linearGradient id="s1_phone" x1="76" y1="40" x2="164" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.45)" />
            <stop offset="0.6" stopColor="rgba(255,255,255,0.20)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>
          <linearGradient id="s1_bus" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#FCD34D" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
          <filter id="s1_shadow" x="56" y="26" width="128" height="196" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="rgba(0,0,0,0.25)" />
          </filter>
        </defs>
      </svg>
    ),
  },
  {
    title: 'تابع رحلتك لحظة بلحظة',
    desc: 'اعرف موقع الباص وتواصل مع السائق مباشرة عند الحاجة',
    icon: MapPin,
    accent: '#10B981',
    gradients: ['#ECFDF5', '#D1FAE5'],
    bgMain: ['#064E3B', '#065F46'],
    decorColor: '#34D399',
    image: (
      <svg width="240" height="240" viewBox="0 0 240 240" fill="none" className="w-48 h-48 sm:w-56 sm:h-56">
        <circle cx="120" cy="120" r="112" fill="url(#s2_bg)" />
        <circle cx="120" cy="120" r="96" fill="rgba(255,255,255,0.66)" />
        <g filter="url(#s2_shadow)">
          <rect x="74" y="38" width="92" height="164" rx="22" fill="url(#s2_phone)" />
          <rect x="82" y="56" width="76" height="132" rx="16" fill="rgba(255,255,255,0.74)" />
          <path d="M92 78 C114 62, 128 74, 142 92 C156 110, 166 122, 154 142 C142 162, 112 166, 96 152 C80 138, 76 108, 92 78 Z" fill="rgba(16,185,129,0.12)" />
          <path d="M96 150 C114 138, 128 144, 140 156 C152 168, 162 170, 154 184" stroke="rgba(16,185,129,0.45)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 10" />
          <path d="M102 118 C116 100, 134 112, 146 96" stroke="rgba(16,185,129,0.38)" strokeWidth="6" strokeLinecap="round" />
          <g transform="translate(0 0)">
            <path d="M120 72C105 72 92 84 92 98C92 118 120 152 120 152C120 152 148 118 148 98C148 84 135 72 120 72Z" fill="url(#s2_pin)" />
            <circle cx="120" cy="98" r="12" fill="white" opacity="0.95" />
            <circle cx="120" cy="98" r="4" fill="#10B981" opacity="0.95" />
            <circle cx="120" cy="98" r="24" stroke="rgba(16,185,129,0.22)" strokeWidth="2" />
          </g>
          <g transform="translate(146 156)">
            <rect x="-20" y="-10" width="40" height="22" rx="8" fill="rgba(16,185,129,0.16)" />
            <rect x="-12" y="-4" width="24" height="10" rx="5" fill="rgba(11,30,74,0.12)" />
            <circle cx="-8" cy="12" r="3.2" fill="#334155" opacity="0.9" />
            <circle cx="8" cy="12" r="3.2" fill="#334155" opacity="0.9" />
          </g>
        </g>
        <circle cx="50" cy="70" r="4" fill="rgba(16,185,129,0.35)" />
        <circle cx="196" cy="170" r="4" fill="rgba(16,185,129,0.35)" />
        <defs>
          <linearGradient id="s2_bg" x1="26" y1="18" x2="218" y2="230" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(52,211,153,0.55)" />
            <stop offset="0.6" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="1" stopColor="rgba(16,185,129,0.42)" />
          </linearGradient>
          <linearGradient id="s2_phone" x1="74" y1="38" x2="166" y2="202" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.48)" />
            <stop offset="0.62" stopColor="rgba(255,255,255,0.20)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>
          <linearGradient id="s2_pin" x1="120" y1="72" x2="120" y2="152" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" />
            <stop offset="1" stopColor="#10B981" />
          </linearGradient>
          <filter id="s2_shadow" x="52" y="24" width="136" height="204" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="rgba(0,0,0,0.25)" />
          </filter>
        </defs>
      </svg>
    ),
  },
  {
    title: 'رحلة آمنة ومنظمة',
    desc: 'نظام متكامل لإدارة المواصلات الجامعية بكل احترافية',
    icon: ShieldCheck,
    accent: '#8B5CF6',
    gradients: ['#F5F3FF', '#EDE9FE'],
    bgMain: ['#3B0764', '#5B21B6'],
    decorColor: '#A78BFA',
    image: (
      <svg width="240" height="240" viewBox="0 0 240 240" fill="none" className="w-48 h-48 sm:w-56 sm:h-56">
        <circle cx="120" cy="120" r="112" fill="url(#s3_bg)" />
        <circle cx="120" cy="120" r="96" fill="rgba(255,255,255,0.66)" />
        <g filter="url(#s3_shadow)">
          <rect x="74" y="38" width="92" height="164" rx="22" fill="url(#s3_phone)" />
          <rect x="82" y="56" width="76" height="132" rx="16" fill="rgba(255,255,255,0.76)" />
          <path d="M120 68L164 88V122C164 150 144 176 120 184C96 176 76 150 76 122V88L120 68Z" fill="url(#s3_shield)" />
          <path d="M104 126 L116 138 L140 112" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="92" y="72" width="56" height="10" rx="5" fill="rgba(11,30,74,0.10)" />
          <rect x="92" y="90" width="40" height="8" rx="4" fill="rgba(11,30,74,0.08)" />
          <rect x="92" y="102" width="46" height="8" rx="4" fill="rgba(11,30,74,0.08)" />
        </g>
        <path d="M54 78 C72 64, 90 66, 102 80" stroke="rgba(139,92,246,0.35)" strokeWidth="6" strokeLinecap="round" />
        <path d="M186 170 C170 184, 152 180, 140 166" stroke="rgba(167,139,250,0.35)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="56" cy="76" r="4" fill="rgba(167,139,250,0.45)" />
        <circle cx="184" cy="172" r="4" fill="rgba(139,92,246,0.45)" />
        <defs>
          <linearGradient id="s3_bg" x1="24" y1="18" x2="220" y2="232" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(167,139,250,0.55)" />
            <stop offset="0.58" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="1" stopColor="rgba(139,92,246,0.46)" />
          </linearGradient>
          <linearGradient id="s3_phone" x1="74" y1="38" x2="166" y2="202" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.48)" />
            <stop offset="0.62" stopColor="rgba(255,255,255,0.20)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
          </linearGradient>
          <linearGradient id="s3_shield" x1="120" y1="68" x2="120" y2="184" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A78BFA" />
            <stop offset="1" stopColor="#8B5CF6" />
          </linearGradient>
          <filter id="s3_shadow" x="52" y="24" width="136" height="204" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="rgba(0,0,0,0.25)" />
          </filter>
        </defs>
      </svg>
    ),
  },
]

const bgColors = [
  'linear-gradient(160deg, #0B1E4A 0%, #1A3D8F 35%, #2563EB 70%, #3B82F6 100%)',
  'linear-gradient(160deg, #064E3B 0%, #065F46 35%, #059669 70%, #10B981 100%)',
  'linear-gradient(160deg, #3B0764 0%, #5B21B6 35%, #7C3AED 70%, #8B5CF6 100%)',
]

const decorShapes = [
  [
    'M-20,-20 Q40,0 0,60 Q-40,120 -100,100 Q-160,80 -120,20 Z',
    'M160,180 Q120,140 140,100 Q160,60 200,80 Q240,100 220,140 Z',
  ],
  [
    'M-30,-30 Q30,-10 10,50 Q-10,110 -80,90 Q-150,70 -110,10 Z',
    'M140,170 Q100,130 120,90 Q140,50 180,70 Q220,90 200,130 Z',
  ],
  [
    'M-40,-20 Q20,0 0,60 Q-20,120 -90,100 Q-160,80 -130,20 Z',
    'M150,190 Q110,150 130,110 Q150,70 190,90 Q230,110 210,150 Z',
  ],
]

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState(1)
  const touchStart = useRef(null)
  const [slideTilt, setSlideTilt] = useState({ x: 0, y: 0 })

  const goNext = useCallback(() => {
    if (current < slides.length - 1) {
      setDirection(1)
      setCurrent(prev => prev + 1)
    } else {
      onComplete()
    }
  }, [current, onComplete])

  const goPrev = useCallback(() => {
    if (current > 0) {
      setDirection(-1)
      setCurrent(prev => prev - 1)
    }
  }, [])

  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (!touchStart.current) return
    const diff = touchStart.current - e.changedTouches[0].clientX
    const threshold = 50
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        setDirection(1)
        setCurrent(prev => Math.min(prev + 1, slides.length - 1))
      } else {
        setDirection(-1)
        setCurrent(prev => Math.max(prev - 1, 0))
      }
    }
    touchStart.current = null
  }, [])

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8
    setSlideTilt({ x, y })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setSlideTilt({ x: 0, y: 0 })
  }, [])

  const progress = useMemo(() => ((current + 1) / slides.length) * 100, [current])

  const slideVariants = {
    enter: (dir) => ({ x: dir > 0 ? 320 : -320, opacity: 0, scale: 0.92 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir) => ({ x: dir > 0 ? -320 : 320, opacity: 0, scale: 0.92 }),
  }

  const slide = slides[current]
  const isLast = current === slides.length - 1
  const isFirst = current === 0

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden" dir="rtl">
      <div
        className="absolute inset-0 transition-all duration-700 ease-in-out"
        style={{ background: bgColors[current] }}
      />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Decorative curved shapes */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06]">
        {decorShapes[current].map((d, i) => (
          <path key={i} d={d} fill="white" opacity="0.5" />
        ))}
      </svg>

      {/* Glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[400px] h-[400px] rounded-full opacity-[0.08] blur-3xl"
          style={{ background: slide?.decorColor }}
        />
        <div className="absolute -bottom-48 -left-48 w-[500px] h-[500px] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: slide?.decorColor }}
        />
        {/* Corner accent */}
        <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.04] blur-2xl"
          style={{ background: `radial-gradient(circle at top right, ${slide?.decorColor}, transparent)` }}
        />
      </div>

      {/* Progress bar */}
      <div className="relative z-20 pt-3 sm:pt-4 px-6 sm:px-8">
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: slide?.accent }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-white/30 font-medium">
            {current + 1} / {slides.length}
          </span>
          {!isLast && (
            <button onClick={onComplete} className="text-[10px] text-white/40 hover:text-white/70 transition-colors">
              تخطي
            </button>
          )}
        </div>
      </div>

      {/* Slide content */}
      <div
        className="relative z-10 flex-1 flex items-center justify-center overflow-hidden px-4 sm:px-6"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 1 }}
            style={{ perspective: '800px' }}
            className="flex flex-col items-center text-center w-full max-w-sm"
          >
            {/* Image area */}
            <motion.div
              style={{
                rotateX: slideTilt.y,
                rotateY: slideTilt.x,
                transition: 'rotateX 0.1s, rotateY 0.1s',
              }}
              className="relative mb-6 sm:mb-8"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="absolute left-1/2 top-1/2 z-0 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl pointer-events-none sm:h-56 sm:w-56"
                style={{
                  background: slide?.accent,
                  opacity: 0.12,
                }}
              />
              <div className="relative z-10">{slide.image}</div>
            </motion.div>

            {/* Floating decorative dots */}
            <div className="absolute top-[18%] right-[12%] pointer-events-none opacity-30">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-2 h-2 rounded-full" style={{ background: slide?.decorColor }} />
              </motion.div>
            </div>
            <div className="absolute bottom-[35%] left-[10%] pointer-events-none opacity-20">
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: slide?.decorColor }} />
              </motion.div>
            </div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 leading-tight"
            >
              {slide.title}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
              className="text-sm sm:text-base text-white/70 leading-relaxed max-w-xs mx-auto"
            >
              {slide.desc}
            </motion.p>

            {/* Subtle tagline */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
              className="mt-5 px-4 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <span className="text-xs text-white/40" style={{ letterSpacing: '0.02em' }}>
                {current === 0 && 'انطلق مع مشوارك'}
                {current === 1 && 'ابقَ على اطلاع دائم'}
                {current === 2 && 'سلامتك أولاً'}
              </span>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 px-6 pb-6 sm:pb-8 flex flex-col items-center gap-5">
        {/* Dots */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3"
        >
          {slides.map((_, i) => {
            const isActive = i === current
            return (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i) }}
                className="relative flex items-center h-5"
              >
                {isActive ? (
                  <motion.div
                    layoutId="activeDot"
                    className="h-2.5 rounded-full"
                    style={{
                      width: '28px',
                      background: slide?.accent,
                      boxShadow: `0 0 8px ${slide?.accent}40`,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  />
                ) : (
                  <div
                    className="h-2 w-2 rounded-full transition-all duration-300 hover:scale-125"
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                    }}
                  />
                )}
              </button>
            )
          })}
        </motion.div>

        {/* Navigation buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex items-center gap-3 w-full max-w-xs"
        >
          {!isFirst && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={goPrev}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-sm font-medium text-white/60 border border-white/15 hover:bg-white/10 hover:text-white/80 transition-all duration-200"
            >
              <ChevronLeft size={18} className="rotate-180" />
              السابق
            </motion.button>
          )}

          {isFirst && <div className="flex-1" />}

          <motion.button
            onClick={goNext}
            whileTap={{ scale: 0.96 }}
            className={`group flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all duration-200 relative overflow-hidden ${
              isFirst ? 'shadow-lg' : ''
            }`}
            style={{
              background: isLast
                ? `linear-gradient(135deg, ${slide?.accent}, ${slide?.accent}dd)`
                : 'rgba(255,255,255,0.12)',
              boxShadow: isLast
                ? `0 4px 20px ${slide?.accent}40`
                : 'none',
            }}
          >
            {/* Shimmer on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-500" />
            {isLast ? (
              <>
                ابدأ الآن
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="rotate-180">
                  <path d="M2 8H14M14 8L8 2M14 8L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            ) : (
              <>
                التالي
                <ChevronLeft size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </motion.button>

          {isFirst && <div className="flex-1" />}
        </motion.div>
      </div>
    </div>
  )
}
