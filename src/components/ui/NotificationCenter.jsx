import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Bell, X, CheckCheck, Trash2, AlertTriangle, Ban, CheckCircle, DollarSign, Bus, FileText, Users, ArrowLeft, ArrowRight, Clock, RefreshCw, Navigation, MapPin, Play, Filter, Loader2, UserPlus, UserMinus, ListOrdered, XCircle, Lock, CalendarCheck, ShoppingCart } from 'lucide-react'
import { api } from '../../lib/api'
import { useNotifications } from '../../context/NotificationContext'
import { onNotificationRead, offNotificationRead, onNotificationReadAll, offNotificationReadAll, onNotificationDeleted, offNotificationDeleted, onNotificationDeletedAll, offNotificationDeletedAll } from '../../lib/socket'

const PAGE_SIZE = 20

const ICON_MAP = {
  AlertTriangle, Ban, CheckCircle, DollarSign, Bus, FileText, Users,
  ArrowLeft, ArrowRight, Clock, RefreshCw, Navigation, MapPin, Play, Bell,
  UserPlus, UserMinus, ListOrdered, XCircle, Lock, CalendarCheck, ShoppingCart,
}

const PRIORITY_CONFIG = {
  CRITICAL: { icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-600', border: 'border-red-200', label: 'حرج' },
  WARNING: { icon: AlertTriangle, bg: 'bg-orange-50', color: 'text-orange-600', border: 'border-orange-200', label: 'تنبيه' },
  INFO: { icon: Bell, bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-200', label: 'معلومة' },
}

const FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'unread', label: 'غير مقروء' },
  { key: 'read', label: 'مقروء' },
  { key: 'CRITICAL', label: 'حرج' },
  { key: 'WARNING', label: 'تنبيه' },
  { key: 'INFO', label: 'معلومة' },
]

export default function NotificationCenter({ open, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [hasMore, setHasMore] = useState(false)
  const navigate = useNavigate()
  const scrollRef = useRef(null)
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
    if (open) fetchNotifications(false)
  }, [open, fetchNotifications])

  useEffect(() => {
    if (!open) return
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
  }, [open])

  useEffect(() => {
    if (!open || !scrollRef.current) return
    const el = scrollRef.current
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        fetchNotifications(true)
      }
    }, { root: el, rootMargin: '100px' })
    const sentinel = el.querySelector('.scroll-sentinel')
    if (sentinel) observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasMore, loadingMore, fetchNotifications])

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
    onClose()
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

  function handleDeleteOne(e, id) {
    e.stopPropagation()
    deleteNotification(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    setTotal(prev => Math.max(0, prev - 1))
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90]" onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-4 top-16 w-[400px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ direction: 'rtl' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-slate-700" />
                <h3 className="font-bold text-slate-800">الإشعارات</h3>
                {total > 0 && <span className="bg-red-100 text-red-600 text-[11px] font-bold px-2 py-0.5 rounded-full">{total}</span>}
              </div>
              <div className="flex items-center gap-1">
                {total > 0 && (
                  <>
                    <button onClick={handleReadAll} title="قراءة الكل"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-green-600 transition-colors">
                      <CheckCheck size={16} />
                    </button>
                    <button onClick={handleDeleteAll} title="حذف الكل"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 border-b border-slate-100 flex gap-1 overflow-x-auto scrollbar-thin">
              {FILTERS.map(f => (
                <button key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    activeFilter === f.key
                      ? 'bg-primary text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div ref={scrollRef} className="max-h-[420px] overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">لا توجد إشعارات</p>
                </div>
              ) : (
                <>
                  {notifications.map(notif => {
                    const cfg = PRIORITY_CONFIG[notif.priority] || PRIORITY_CONFIG.INFO
                    const Icon = ICON_MAP[notif.data?.icon] || cfg.icon || Bell
                    return (
                      <div key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`flex gap-3 p-3 rounded-xl transition-colors cursor-pointer group ${
                          notif.isRead
                            ? 'hover:bg-slate-50'
                            : `${cfg.bg} hover:${cfg.bg.replace('bg-', 'bg-').replace('50', '100')}`
                        } ${!notif.isRead ? `border-r-2 ${cfg.border.replace('border', 'border-r')}` : ''}`}
                      >
                        <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                          <Icon size={18} className={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-sm font-semibold truncate ${notif.isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                              {notif.title}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">{getTimeAgo(notif.createdAt)}</span>
                              <button onClick={(e) => handleDeleteOne(e, notif.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        </div>
                      </div>
                    )
                  })}
                  {hasMore && (
                    <div className="scroll-sentinel flex items-center justify-center py-4">
                      {loadingMore ? (
                        <Loader2 size={16} className="animate-spin text-slate-400" />
                      ) : (
                        <button onClick={() => fetchNotifications(true)}
                          className="text-xs text-primary font-medium hover:underline">
                          عرض المزيد
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
