import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export default function Modal({ show, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [show])

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={`bg-white w-full flex flex-col max-h-[calc(100vh-40px)] md:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-pop ${
              wide ? 'sm:max-w-[95vw] lg:max-w-[1100px]' : 'sm:max-w-[90vw] lg:max-w-[900px]'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 shrink-0 gap-3">
                <div className="min-w-0">{title}</div>
                <button onClick={() => onClose?.()} className="p-1.5 rounded-lg hover:bg-slate-100 -mr-1 shrink-0">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4">
              {children}
            </div>
            {footer && (
              <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 sm:px-6 py-3 sm:py-4 z-10 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
