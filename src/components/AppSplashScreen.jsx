import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function AppSplashScreen({ onFinish }) {
  const [phase, setPhase] = useState('enter')

  // Store flag immediately on mount so refresh during animation doesn't re-trigger
  useEffect(() => {
    sessionStorage.setItem('mashawerk_session_splash', 'true')
  }, [])

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setPhase('exit')
      setTimeout(onFinish, 400)
    }, 2600)

    return () => clearTimeout(exitTimer)
  }, [onFinish])

  return (
    <AnimatePresence>
      {phase !== 'hidden' && (
        <motion.div
          key="app-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0B1E4A 0%, #1A3D8F 40%, #2563EB 75%, #3B82F6 100%)' }}
        >
          {/* Dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          {/* Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-[350px] h-[350px] rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-indigo-500/8 blur-3xl" />
          </div>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center"
          >
            <motion.div
              className="absolute -inset-6 z-0 rounded-[28px] blur-2xl"
              style={{ background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.20), rgba(96,165,250,0.06), transparent 70%)' }}
              animate={{ opacity: [0.35, 0.6, 0.35], scale: [0.98, 1.03, 0.98] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative z-10 flex h-32 w-32 items-center justify-center rounded-[26px] border border-white/10 bg-white/10 shadow-2xl backdrop-blur-sm sm:h-36 sm:w-36"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img src="/app-icon.svg" alt="تنسيقية مواصلات فلك" className="h-24 w-24 object-contain sm:h-28 sm:w-28" />
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.45, ease: 'easeOut' }}
            className="relative z-10 text-4xl sm:text-5xl font-black text-white mt-6 tracking-wider"
          >
            <span className="bg-gradient-to-l from-white via-blue-50 to-white bg-clip-text text-transparent drop-shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              تنسيقية مواصلات فلك
            </span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, x: 24, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, x: 0, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.45, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mt-2"
          >
            <div className="relative px-5 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm shadow-[0_12px_35px_rgba(0,0,0,0.25)] overflow-hidden">
              <div
                className="absolute inset-0 rounded-full opacity-70"
                style={{
                  background: 'linear-gradient(90deg, rgba(96,165,250,0.25), rgba(167,139,250,0.18), rgba(96,165,250,0.25))',
                }}
              />
              <span className="relative block text-white text-lg sm:text-xl font-extrabold tracking-wide">
                علينا
              </span>
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62, duration: 0.4, ease: 'easeOut' }}
            className="relative z-10 text-sm sm:text-base text-blue-100/80 mt-3 font-semibold"
          >
            رحلتك اليومية أسهل وأضمن
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.45, ease: 'easeOut' }}
            className="relative z-10 mt-6 w-[72%] max-w-sm"
          >
            <div className="relative h-[6px] rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.9, duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, rgba(96,165,250,0.9), rgba(167,139,250,0.65), rgba(96,165,250,0.9))',
                  boxShadow: '0 0 18px rgba(96,165,250,0.22)',
                }}
              />
            </div>
          </motion.div>

          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 14 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full bg-white/10"
                style={{
                  left: `${(i * 7) % 100}%`,
                  top: `${(i * 11) % 100}%`,
                }}
                animate={{ y: [0, -10, 0], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3 + (i % 4) * 0.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
              />
            ))}
          </div>

          {/* Version */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.55, duration: 0.5 }}
            className="absolute bottom-4 text-[9px] text-blue-300/30 tracking-wider"
          >
            تنسيقية مواصلات فلك
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
