import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Trash2, AlertTriangle, Ban, CheckCircle, DollarSign, Bus, FileText, Users, ArrowLeft, ArrowRight, Clock, RefreshCw, Navigation, MapPin, Play, X, Loader2, UserPlus, UserMinus, ListOrdered, XCircle, Lock, CalendarCheck, Home } from 'lucide-react'
import { api } from '../../lib/api'
import { useNotifications } from '../../context/NotificationContext'
import { onStudentUpdate, offStudentUpdate, onNotificationRead, offNotificationRead, onNotificationReadAll, offNotificationReadAll, onNotificationDeleted, offNotificationDeleted, onNotificationDeletedAll, offNotificationDeletedAll } from '../../lib/socket'

const PAGE_SIZE = 20

const ICON_MAP = {
  AlertTriangle, Ban, CheckCircle, DollarSign, Bus, FileText, Users,
  ArrowLeft, ArrowRight, Clock, RefreshCw, Navigation, MapPin, Play, Bell,
  UserPlus, UserMinus, ListOrdered, XCircle, Lock, CalendarCheck, Home,
}

const PRIORITY_CONFIG = {
  CRITICAL: { icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-600', label: 'حرج' },
  WARNING: { icon: AlertTriangle, bg: 'bg-orange-50', color: 'text-orange-600', label: 'تنبيه' },
  INFO: { icon: Bell, bg: 'bg-blue-50', color: 'text-blue-600', label: 'معلومة' },
}

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'unread', label: 'غير مقروء' },
  { key: 'read', label: 'مقروء' },
  { key: 'CRITICAL', label: 'حرج' },
  { key: 'WARNING', label: 'تنبيه' },
  { key: 'INFO', label: 'معلومة' },
]

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [hasMore, setHasMore] = useState(false)
  const navigate = useNavigate()
  const sentinelRef = useRef(null)
  const { refreshUnreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications()

  const notificationsLenRef = useRef(0)
  notificationsLenRef.current = notifications.length

  const fetchNotifications = useCallback(async (append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      let params = {}
      if (activeFilter === 'unread') params.filter = 'unread'
      else if (activeFilter === 'read') params.filter = 'read'
      else if (['CRITICAL', 'WARNING', 'INFO'].includes(activeFilter)) params.priority = activeFilter
      params.limit = PAGE_SIZE
      if (append) params.offset = notificationsLenRef.current

      const result = await api.notifications.list(params)
      const items = result.notifications || result
      if (append) {
        setNotifications(prev => [...prev, ...items])
      } else {
        setNotifications(items)
      }
      const loadedCount = append ? notificationsLenRef.current + items.length : items.length
      setTotal(result.total || items.length || 0)
      setHasMore((result.total || items.length || 0) > loadedCount)
    } catch (e) { /* silent */ }
    if (append) setLoadingMore(false)
    else setLoading(false)
  }, [activeFilter])

  useEffect(() => {
    fetchNotifications(false)
  }, [fetchNotifications])

  useEffect(() => {
    onStudentUpdate(() => fetchNotifications(false))
    return () => offStudentUpdate()
  }, [fetchNotifications])

  useEffect(() => {
    const unsubRead = onNotificationRead(({ id }) => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    })
    const unsubReadAll = onNotificationReadAll(() => {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    })
    const unsubDeleted = onNotificationDeleted(({ id }) => {
      setNotifications(prev => prev.filter(n => n.id !== id))
      setTotal(prev => Math.max(0, prev - 1))
    })
    const unsubDeletedAll = onNotificationDeletedAll(() => {
      setNotifications([])
      setTotal(0)
    })
    return () => {
      offNotificationRead(); offNotificationReadAll()
      offNotificationDeleted(); offNotificationDeletedAll()
    }
  }, [])

  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchNotifications(true)
      }
    }, { rootMargin: '200px' })
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, fetchNotifications])

  function getTimeAgo(dateStr) {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `منذ ${diffMins} د`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `منذ ${diffHours} س`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `منذ ${diffDays} ي`
    return date.toLocaleDateString('ar-SA')
  }

  function handleNotificationClick(notif) {
    if (!notif.isRead) markAsRead(notif.id)
    if (notif.targetRoute) {
      navigate(notif.targetRoute, { replace: false, state: { fromNotification: true } })
    }
  }

  async function handleReadAll() {
    await markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  async function handleDeleteAll() {
    await deleteAllNotifications()
    setNotifications([])
    setTotal(0)
  }

  function handleDeleteOne(e, notif) {
    e.stopPropagation()
    deleteNotification(notif.id)
    setNotifications(prev => prev.filter(n => n.id !== notif.id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">الإشعارات</h2>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <>
              <button onClick={handleReadAll}
                className="text-xs text-primary font-medium flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-primary-lighter transition-colors">
                <CheckCheck size={12} /> قراءة الكل
              </button>
              <button onClick={handleDeleteAll}
                className="text-xs text-red-500 font-medium flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 size={12} /> حذف الكل
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
        {FILTERS.map(f => (
          <button key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`text-xs px-2.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all ${
              activeFilter === f.key
                ? 'gradient-primary text-white shadow-[0_3px_10px_-3px_rgba(37,99,235,0.6)]'
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <Bell size={28} className="text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">لا توجد إشعارات</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-1.5">
            {notifications.map(notif => {
              const cfg = PRIORITY_CONFIG[notif.priority] || PRIORITY_CONFIG.INFO
              const Icon = ICON_MAP[notif.data?.icon] || cfg.icon || Bell
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`card p-3 transition-all cursor-pointer ${
                    notif.isRead
                      ? 'opacity-70 hover:opacity-100'
                      : `shadow-card ${cfg.bg}`
                  } ${!notif.isRead ? `border-r-2 border-r-${cfg.color.replace('text-', '')}` : ''}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                      <Icon size={16} className={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold truncate ${notif.isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                          {notif.title}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">{getTimeAgo(notif.createdAt)}</span>
                          <button onClick={(e) => handleDeleteOne(e, notif)}
                            className="p-0.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                      {notif.message && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
                      )}
                    </div>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </div>
                </motion.div>
              )
            })}
            {hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                {loadingMore ? (
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                ) : (
                  <button onClick={() => fetchNotifications(true)}
                    className="text-xs text-primary font-medium hover:underline">
                    عرض المزيد
                  </button>
                )}
              </div>
            )}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
