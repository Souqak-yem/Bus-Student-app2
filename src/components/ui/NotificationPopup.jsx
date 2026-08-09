import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Bell, CheckCircle, DollarSign, Bus, FileText, Users, ArrowLeft, ArrowRight, Clock, Ban, RefreshCw, Navigation, MapPin, Play, X, UserPlus, UserMinus, ListOrdered, XCircle, Lock, CalendarCheck, Home, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../context/NotificationContext'

const ICON_MAP = {
  AlertTriangle, Bell, CheckCircle, DollarSign, Bus, FileText,
  Users, ArrowLeft, ArrowRight, Clock, Ban, RefreshCw, Navigation, MapPin, Play,
  UserPlus, UserMinus, ListOrdered, XCircle, Lock, CalendarCheck, Home, ShoppingCart,
}

const PRIORITY_STYLES = {
  CRITICAL: { border: 'border-red-500', bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-800' },
  WARNING: { border: 'border-orange-400', bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-800' },
  INFO: { border: 'border-blue-400', bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-800' },
}

const POPUP_DURATION = { CRITICAL: 0, WARNING: 6, INFO: 4 }
const ANIM_DURATION = 0.3

export default function NotificationPopup({ notification }) {
  const [exiting, setExiting] = useState(false)
  const [canDismiss, setCanDismiss] = useState(false)
  const navigate = useNavigate()
  const { dismissPopup } = useNotifications()
  const style = PRIORITY_STYLES[notification.priority] || PRIORITY_STYLES.INFO
  const IconComponent = ICON_MAP[notification.data?.icon] || Bell
  const touchStartY = useRef(0)
  const [offsetY, setOffsetY] = useState(0)
  const animDuration = POPUP_DURATION[notification.priority] || POPUP_DURATION.INFO
  const isCritical = notification.priority === 'CRITICAL'

  useEffect(() => {
    const timer = setTimeout(() => setCanDismiss(true), ANIM_DURATION * 1000)
    return () => clearTimeout(timer)
  }, [])

  function handleClick() {
    if (notification.targetRoute) {
      navigate(notification.targetRoute, { replace: false, state: { fromNotification: true } })
    }
    setExiting(true)
    setTimeout(() => dismissPopup(notification._popupId), 300)
  }

  function handleDismiss() {
    if (!canDismiss) return
    setExiting(true)
    setTimeout(() => dismissPopup(notification._popupId), 200)
  }

  function handleTouchStart(e) {
    if (!canDismiss) return
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchMove(e) {
    if (!canDismiss) return
    const diff = e.touches[0].clientY - touchStartY.current
    if (diff < 0) setOffsetY(diff)
  }

  function handleTouchEnd() {
    if (!canDismiss) return
    if (offsetY < -80) handleDismiss()
    setOffsetY(0)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -60, scale: 0.95 }}
      animate={exiting ? { opacity: 0, y: -60, scale: 0.95 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={{ y: offsetY }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      className={`fixed top-4 left-4 right-4 z-[100] max-w-sm mx-auto cursor-pointer select-none ${style.border} border-r-4 bg-white rounded-2xl shadow-pop overflow-hidden`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`w-10 h-10 rounded-2xl ${style.bg} flex items-center justify-center shrink-0`}>
          <IconComponent size={20} className={style.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-bold ${style.text} line-clamp-1`}>{notification.title}</p>
            <button onClick={(e) => { e.stopPropagation(); handleDismiss() }}
              className={`p-0.5 rounded-full hover:bg-slate-200 transition-colors shrink-0 ${!canDismiss ? 'opacity-50' : ''}`}>
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notification.message}</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {new Date(notification.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
      {!isCritical && (
        <div className={`h-1 ${style.bg} rounded-full mx-4 mb-3 overflow-hidden`}>
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: animDuration, ease: 'linear' }}
            className={`h-full ${style.border.replace('border-', 'bg-')}`}
          />
        </div>
      )}
    </motion.div>
  )
}
