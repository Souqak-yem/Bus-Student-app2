import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download } from 'lucide-react'

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true ||
    document.referrer?.includes('android-app://')
  )
}

export default function PWAInstallButton({ mobile = false }) {
  const [visible, setVisible] = useState(false)
  const [installed, setInstalled] = useState(() => isStandalone())

  const handleCanInstall = useCallback(() => {
    if (isStandalone()) {
      setInstalled(true)
      setVisible(false)
      return
    }
    setVisible(true)
  }, [])

  const handleInstalled = useCallback(() => {
    setInstalled(true)
    setVisible(false)
  }, [])

  const handleRequestInstall = useCallback(() => {
    const event = new CustomEvent('pwa:request-install')
    window.dispatchEvent(event)
  }, [])

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true)
      setVisible(false)
      return
    }

    window.addEventListener('pwa:can-install', handleCanInstall)
    window.addEventListener('pwa:installed', handleInstalled)

    const standaloneHandler = () => {
      if (isStandalone()) {
        setInstalled(true)
        setVisible(false)
      }
    }
    window.addEventListener('appinstalled', standaloneHandler)

    return () => {
      window.removeEventListener('pwa:can-install', handleCanInstall)
      window.removeEventListener('pwa:installed', handleInstalled)
      window.removeEventListener('appinstalled', standaloneHandler)
    }
  }, [handleCanInstall, handleInstalled])

  if (installed) return null

  if (mobile) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRequestInstall}
            className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors shrink-0"
            title="تثبيت التطبيق"
            aria-label="تثبيت التطبيق"
          >
            <Download size={17} className="text-blue-600" />
          </motion.button>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRequestInstall}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 backdrop-blur-sm text-blue-600 text-xs font-semibold transition-colors"
        >
          <Download size={14} />
          تثبيت التطبيق
        </motion.button>
      )}
    </AnimatePresence>
  )
}
