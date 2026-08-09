import { useState, useEffect, useCallback, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, X, ExternalLink } from 'lucide-react'
import { getSocket, onEmergencyReport, offEmergencyReport, connectSocket, joinNotificationRoom } from '../../lib/socket'
import { useNotifications } from '../../context/NotificationContext'
import NotificationPopup from '../ui/NotificationPopup'
import Sidebar from './Sidebar'
import TopNavbar from './TopNavbar'
import MobileBottomNav from './MobileBottomNav'
import MobileDrawer from './MobileDrawer'

export default function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileDrawer, setMobileDrawer] = useState(false)
  const [alert, setAlert] = useState(null)
  const [unreadEmergencyCount, setUnreadEmergencyCount] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const audioRef = useRef(null)
  const soundTimeoutRef = useRef(null)
  const { popups } = useNotifications()

  function toggleSidebar() {
    setSidebarCollapsed(prev => !prev)
  }

  useEffect(() => {
    setMobileDrawer(false)
  }, [location.pathname])

  // Connect socket and listen for emergency reports
  const stopAlertSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (soundTimeoutRef.current) {
      clearTimeout(soundTimeoutRef.current)
      soundTimeoutRef.current = null
    }
  }, [])

  const playAlertSound = useCallback(() => {
    try {
      stopAlertSound()
      const audio = new Audio('/sounds/emergency-alarm.wav')
      audio.loop = true
      audio.volume = 0.5
      audio.play().catch(() => {})
      audioRef.current = audio
      soundTimeoutRef.current = setTimeout(() => {
        stopAlertSound()
      }, 5000)
    } catch (e) { /* silent */ }
  }, [stopAlertSound])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      connectSocket(token)
      joinNotificationRoom()
    }

    onEmergencyReport((report) => {
      setAlert(report)
      setUnreadEmergencyCount(prev => prev + 1)
      playAlertSound()
    })

    return () => {
      offEmergencyReport()
      stopAlertSound()
    }
  }, [playAlertSound, stopAlertSound])

  function handleOpenReport() {
    if (alert) {
      stopAlertSound()
      navigate('/admin/emergency')
      setAlert(null)
    }
  }

  return (
    <div className="min-h-screen surface-wash flex flex-col lg:flex-row">
      {/* Desktop sidebar — always visible lg+ */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen pb-16 lg:pb-0">
        <TopNavbar onMenuToggle={() => setMobileDrawer(true)} />

        {/* Emergency alert bar */}
        <AnimatePresence>
          {alert && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-red-600 text-white overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse shrink-0">
                  <Bell size={16} className="sm:w-5 sm:h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold truncate">
                    🚨 بلاغ طارئ - باص {alert.busNumber}
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-100 truncate">
                    السائق: {alert.driverName} | {alert.reason === 'MECHANICAL' ? 'عطل ميكانيكي' : alert.reason === 'ACCIDENT' ? 'حادث' : alert.reason === 'TRAFFIC' ? 'ازدحام' : alert.reason === 'ROAD_CLOSED' ? 'إغلاق طريق' : alert.notes || 'أخرى'}
                  </p>
                </div>
                <button onClick={handleOpenReport}
                  className="bg-white text-red-600 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap hover:bg-red-50 transition-colors flex items-center gap-1">
                  <ExternalLink size={14} /> فتح
                </button>
                <button onClick={() => { stopAlertSound(); setAlert(null) }}
                  className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-6 overflow-x-hidden">
          <div className="w-full max-w-[1600px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname.split('/').slice(0, 3).join('/')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Notification popups */}
      <AnimatePresence>
        {popups.map(p => (
          <NotificationPopup key={p._popupId} notification={p} />
        ))}
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <MobileBottomNav onMore={() => setMobileDrawer(true)} />

      {/* Mobile drawer (More) */}
      <MobileDrawer open={mobileDrawer} onClose={() => setMobileDrawer(false)} />
    </div>
  )
}
