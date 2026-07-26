import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

const DISMISSED_KEY = 'mashawerk_sw_update_dismissed'

function getVersionId() {
  return `${__APP_VERSION__}-${__BUILD_HASH__}`
}

export default function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updating, setUpdating] = useState(false)

  const handleUpdate = useCallback(async () => {
    setUpdating(true)
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    localStorage.removeItem(DISMISSED_KEY)
    window.location.reload()
  }, [])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, getVersionId())
    setUpdateAvailable(false)
  }, [])

  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem(DISMISSED_KEY) === getVersionId()) return
      setUpdateAvailable(true)
    }
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          initial={{ y: -60 }}
          animate={{ y: 0 }}
          exit={{ y: -60 }}
          className="fixed top-0 left-0 right-0 z-[200] bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-center gap-3 text-sm text-blue-800"
          dir="rtl"
        >
          <RefreshCw className="w-4 h-4" />
          <span>يتوفر إصدار جديد من التطبيق</span>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {updating ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            تحديث الآن
          </button>
          <button
            onClick={handleDismiss}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 flex items-center justify-center transition-colors"
          >
            <X size={12} className="text-blue-600" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
