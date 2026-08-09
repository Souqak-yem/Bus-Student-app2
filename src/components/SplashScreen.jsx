import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const STATIONS = [15, 30, 50, 68, 85]

export default function SplashScreen({ duration = 4000, onFinish }) {
  const [phase, setPhase] = useState('enter')
  const [busProgress, setBusProgress] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const frameRef = useRef(null)

  useEffect(() => {
    const splashDuration = duration
    const busTravelDuration = splashDuration * 0.94
    const stamp = performance.now()

    function tick(now) {
      const elapsed = now - stamp
      const raw = Math.min(elapsed / busTravelDuration, 1)
      // ease-in-out quad: smooth accel then decel
      const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2
      setBusProgress(eased)
      // show stations whose position the bus has reached or passed
      setVisibleCount(STATIONS.filter(s => s / 100 <= eased + 0.04).length)

      if (raw < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    const exitTimer = setTimeout(() => {
      setPhase('exit')
      setTimeout(onFinish, 500)
    }, splashDuration)

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      clearTimeout(exitTimer)
    }
  }, [duration, onFinish])

  return (
    <AnimatePresence>
      {phase !== 'hidden' && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: 'blur(4px)' }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0B1E4A 0%, #1A3D8F 35%, #2563EB 70%, #3B82F6 100%)' }}
        >
          {/* Subtle dot grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* Glow orbs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-blue-300/5 blur-2xl" />

            {/* Floating particles */}
            {[0, 1, 2, 3, 4, 5].map(i => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-white/20"
                style={{
                  top: `${15 + i * 13}%`,
                  left: `${10 + i * 16}%`,
                }}
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                  duration: 3 + i * 0.4,
                  repeat: Infinity,
                  delay: i * 0.3,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* Horizon city silhouette */}
          <div className="absolute bottom-[22%] left-0 right-0 h-16 pointer-events-none opacity-10" style={{ direction: 'ltr' }}>
            <svg viewBox="0 0 400 40" fill="white" className="w-full h-full">
              <rect x="10" y="15" width="18" height="25" rx="1" />
              <rect x="35" y="8" width="14" height="32" rx="1" />
              <rect x="55" y="20" width="22" height="20" rx="1" />
              <rect x="85" y="12" width="16" height="28" rx="1" />
              <rect x="110" y="5" width="20" height="35" rx="1" />
              <rect x="140" y="18" width="15" height="22" rx="1" />
              <rect x="165" y="10" width="25" height="30" rx="1" />
              <rect x="200" y="22" width="18" height="18" rx="1" />
              <rect x="230" y="14" width="14" height="26" rx="1" />
              <rect x="255" y="6" width="22" height="34" rx="1" />
              <rect x="290" y="16" width="16" height="24" rx="1" />
              <rect x="315" y="10" width="20" height="30" rx="1" />
              <rect x="345" y="20" width="18" height="20" rx="1" />
              <rect x="370" y="8" width="22" height="32" rx="1" />
            </svg>
          </div>

          {/* Logo area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center mb-6"
          >
            <div className="relative">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.15 }}
                className="absolute left-1/2 top-1/2 z-0 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/15 blur-2xl sm:h-52 sm:w-52"
              />

              <img
                src="/full-logo.svg"
                alt="مشوارك"
                className="relative z-10 h-28 w-28 object-contain drop-shadow-2xl sm:h-36 sm:w-36 lg:h-44 lg:w-44"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35, ease: 'easeOut' }}
              className="relative z-10 text-center mt-2"
            >
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-wider">
                مشوارك
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-blue-200/90 mt-1.5 font-medium">
                رحلتك الجامعية أسهل
              </p>
            </motion.div>
          </motion.div>

          {/* Road scene */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
            className="absolute bottom-[11%] sm:bottom-[14%] w-[88%] sm:w-[72%] max-w-xl"
          >
            {/* Road surface */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden shadow-inner">
              {/* Progress fill */}
              <div
                className="absolute top-0 right-0 h-full rounded-full transition-all duration-[80ms] ease-linear"
                style={{
                  width: `${busProgress * 100}%`,
                  background: 'linear-gradient(90deg, #60A5FA, #93C5FD)',
                  boxShadow: '0 0 8px rgba(96,165,250,0.4)',
                }}
              />
              {/* Road edge glow */}
              <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]" />
            </div>

            {/* Dashed lane markings */}
            <div className="relative flex gap-1.5 px-0.5 mt-0.5">
              {Array.from({ length: 24 }).map((_, i) => {
                const pos = (i / 24) * 100
                const lit = pos <= busProgress * 100
                return (
                  <div
                    key={i}
                    className="h-[3px] flex-1 rounded-full transition-all duration-100"
                    style={{
                      background: lit
                        ? 'linear-gradient(90deg, rgba(255,255,255,0.7), rgba(255,255,255,0.4))'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  />
                )
              })}
            </div>

            {/* Curb lines */}
            <div className="absolute -top-[3px] left-0 right-0 h-[3px] rounded-full bg-white/5" />
            <div className="absolute -bottom-[3px] left-0 right-0 h-[3px] rounded-full bg-white/5" />

            {/* Station dots */}
            {STATIONS.slice(0, visibleCount).map((left, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 350, damping: 18, mass: 0.8 }}
                className="absolute -top-[5px]"
                style={{ left: `${left}%`, marginLeft: '-7px' }}
              >
                <div
                  className="w-[14px] h-[14px] rounded-full border-[3px] transition-colors duration-200"
                  style={{
                    background: left <= busProgress * 100 ? '#3B82F6' : 'transparent',
                    borderColor: left <= busProgress * 100 ? '#93C5FD' : 'rgba(255,255,255,0.3)',
                    boxShadow: left <= busProgress * 100 ? '0 0 6px rgba(147,197,253,0.5)' : 'none',
                  }}
                />
                {/* Station glow when active */}
                {left <= busProgress * 100 && (
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full animate-ping opacity-30"
                    style={{ background: '#60A5FA' }}
                  />
                )}
              </motion.div>
            ))}

            {/* Bus */}
            <motion.div
              className="absolute -top-7 flex items-center justify-center"
              style={{ left: `${Math.min(busProgress * 100, 97)}%`, marginLeft: '-22px' }}
              animate={busProgress > 0.88 ? { y: [0, -2, 0] } : {}}
              transition={busProgress > 0.88 ? { duration: 0.4, repeat: Infinity } : {}}
            >
              {/* Bus shadow */}
              <div
                className="absolute -bottom-2 w-10 h-1.5 rounded-full bg-black/20 blur-sm"
              />

              {/* Bus SVG */}
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="drop-shadow-xl relative z-10">
                {/* Bus body */}
                <rect x="4" y="12" width="36" height="22" rx="4" fill="#FBBF24" />
                <rect x="4" y="12" width="36" height="22" rx="4" fill="url(#busGrad)" />
                {/* Roof */}
                <rect x="8" y="7" width="28" height="7" rx="3" fill="#F59E0B" />
                {/* Windshield */}
                <rect x="8" y="9" width="10" height="4" rx="1" fill="#1E3A5F" opacity="0.6" />
                <rect x="26" y="9" width="10" height="4" rx="1" fill="#1E3A5F" opacity="0.6" />
                {/* Windows */}
                <rect x="9" y="15" width="5" height="5" rx="1" fill="#1E3A5F" opacity="0.4" />
                <rect x="16" y="15" width="5" height="5" rx="1" fill="#1E3A5F" opacity="0.4" />
                <rect x="23" y="15" width="5" height="5" rx="1" fill="#1E3A5F" opacity="0.4" />
                <rect x="30" y="15" width="5" height="5" rx="1" fill="#1E3A5F" opacity="0.4" />
                {/* Stripe */}
                <rect x="4" y="20" width="36" height="3" fill="#D97706" opacity="0.5" />
                {/* Wheels */}
                <rect x="6" y="30" width="8" height="6" rx="2" fill="#1F2937" />
                <rect x="30" y="30" width="8" height="6" rx="2" fill="#1F2937" />
                <circle cx="10" cy="33" r="2.5" fill="#374151" />
                <circle cx="34" cy="33" r="2.5" fill="#374151" />
                {/* Headlight */}
                <rect x="36" y="14" width="3" height="2" rx="0.5" fill="#93C5FD" opacity={0.8 + busProgress * 0.2} />
                {/* Taillight */}
                <rect x="5" y="14" width="2" height="2" rx="0.5" fill="#EF4444" />
                <defs>
                  <linearGradient id="busGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FCD34D" />
                    <stop offset="100%" stopColor="#F59E0B" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Destination sign */}
              {busProgress > 0.2 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-900/80 text-[7px] text-white px-1.5 py-0.5 rounded whitespace-nowrap font-bold"
                >
                  الجامعة
                </motion.div>
              )}
            </motion.div>

            {/* Glow trail behind bus */}
            <div
              className="absolute -top-5 h-8 w-20 rounded-full pointer-events-none transition-all duration-100"
              style={{
                left: `${Math.max(busProgress * 100 - 15, 0)}%`,
                background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.2), rgba(96,165,250,0.05))',
                opacity: Math.min(busProgress * 1.5, 1),
              }}
            />
          </motion.div>

          {/* Bottom branding */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="absolute bottom-4 text-[10px] text-blue-300/40 font-medium tracking-wider"
          >
            تنسيقية مواصلات فلك
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
