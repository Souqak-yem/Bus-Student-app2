import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { api } from '../lib/api'
import { subscribeToPush, unsubscribeFromPush, isPushNotificationsEnabled } from '../lib/pushManager'
import { canAccessAdminPage } from '../lib/adminPermissions'
import {
  connectSocket, onNotificationNew, offNotificationNew,
  onUnreadCount, offUnreadCount,
  onReconnect, joinNotificationRoom,
  onNotificationRead, offNotificationRead,
  onNotificationReadAll, offNotificationReadAll,
  onNotificationDeleted, offNotificationDeleted,
  onNotificationDeletedAll, offNotificationDeletedAll,
  onMissedNotifications, offMissedNotifications,
  emitGetMissedNotifications,
} from '../lib/socket'

const NotificationContext = createContext()

const POPUP_DURATION = { INFO: 4000, WARNING: 6000, CRITICAL: Infinity }

export function NotificationProvider({ children }) {
  const { user, role } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [popups, setPopups] = useState([])
  const popupIdRef = useRef(0)
  const timersRef = useRef({})
  const lastNotifTimeRef = useRef(null)
  const popupsRef = useRef(popups)
  popupsRef.current = popups

  const playSoundRef = useRef(null)
  const lastSoundIdRef = useRef(null)
  const unassignedCheckedRef = useRef(null)

  const isVisibleForCurrentUser = useCallback((notification) => {
    if (!user || user.role !== 'admin' || !Array.isArray(user.adminPermissions)) return true
    if (user.adminPermissions.length === 0) return true
    const route = notification?.targetRoute || notification?.route || notification?.data?.route || null
    if (!route) return false
    return canAccessAdminPage(user, route)
  }, [user])

  const playNotificationSound = useCallback((priority, notifId) => {
    if (lastSoundIdRef.current === notifId) return
    lastSoundIdRef.current = notifId
    try {
      if (playSoundRef.current) {
        playSoundRef.current.pause()
        playSoundRef.current.currentTime = 0
      }
      let src = '/sounds/info.wav'
      if (priority === 'CRITICAL') src = '/sounds/emergency-alarm.wav'
      else if (priority === 'WARNING') src = '/sounds/warning.wav'
      const audio = new Audio(src)
      audio.volume = priority === 'CRITICAL' ? 0.5 : 0.3
      audio.play().catch(() => {})
      if (priority !== 'CRITICAL') {
        setTimeout(() => { audio.pause(); audio.currentTime = 0 }, 1500)
      }
      playSoundRef.current = audio
    } catch (e) { /* silent */ }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!user) return
    try {
      const { count } = await api.notifications.unreadCount()
      setUnreadCount(count)
    } catch (e) { /* silent */ }
  }, [user])

  useEffect(() => {
    if (!user) {
      unsubscribeFromPush().catch(() => {})
      return
    }

    if (user.role === 'student' && !isPushNotificationsEnabled()) {
      unsubscribeFromPush().catch(() => {})
      return
    }

    refreshUnreadCount()
    subscribeToPush().catch((err) => {
      if (err?.message !== 'disabled') {
        console.error('[Push] subscribe failed:', err)
      }
    })
  }, [user, refreshUnreadCount])

  // On admin login, check for unassigned daily subscriptions and notify
  useEffect(() => {
    if (!user || user.role !== 'admin') return
    if (unassignedCheckedRef.current === user.id) return
    unassignedCheckedRef.current = user.id
    api.notifications.checkUnassignedDaily().catch((err) => console.error('[Unassigned check] failed:', err))
  }, [user])

  useEffect(() => {
    if (!user) return

    const token = localStorage.getItem('token')
    if (token) {
      connectSocket(token)
      joinNotificationRoom()
    }

    const handleNewNotification = (notification) => {
      if (!isVisibleForCurrentUser(notification)) return
      setUnreadCount(prev => prev + 1)
      lastNotifTimeRef.current = new Date().toISOString()
      const id = ++popupIdRef.current
      const popup = { ...notification, _popupId: id }
      setPopups(prev => [...prev, popup])
      const duration = POPUP_DURATION[notification.priority] || POPUP_DURATION.INFO
      if (duration !== Infinity) {
        timersRef.current[id] = setTimeout(() => {
          setPopups(prev => prev.filter(p => p._popupId !== id))
          delete timersRef.current[id]
        }, duration)
      }
      playNotificationSound(notification.priority, notification.id)
    }

    onNotificationNew(handleNewNotification)
    onUnreadCount(() => refreshUnreadCount())

    const unsubReconnect = onReconnect(() => {
      joinNotificationRoom()
      refreshUnreadCount()
      if (lastNotifTimeRef.current) {
        emitGetMissedNotifications(lastNotifTimeRef.current)
      }
    })

    onMissedNotifications((data) => {
      const notifications = Array.isArray(data?.notifications) ? data.notifications.filter((n) => isVisibleForCurrentUser(n)) : []

      if (notifications.length > 0) {
        setUnreadCount(prev => prev + notifications.length)
        notifications.forEach(n => {
          lastNotifTimeRef.current = new Date().toISOString()
          const id = ++popupIdRef.current
          setPopups(prev => [...prev, { ...n, _popupId: id }])
          const duration = POPUP_DURATION[n.priority] || POPUP_DURATION.INFO
          if (duration !== Infinity) {
            timersRef.current[id] = setTimeout(() => {
              setPopups(prev => prev.filter(p => p._popupId !== id))
              delete timersRef.current[id]
            }, duration)
          }
        })
        if (typeof data.unreadCount === 'number') setUnreadCount(data.unreadCount)
      } else if (typeof data?.unreadCount === 'number') {
        setUnreadCount(data.unreadCount)
      }
    })

    onNotificationRead(({ id }) => {
      setPopups(prev => prev.filter(p => p.id !== id))
    })

    onNotificationReadAll(() => {
      setPopups([])
      refreshUnreadCount()
    })

    onNotificationDeleted(({ id }) => {
      setPopups(prev => prev.filter(p => p.id !== id))
      refreshUnreadCount()
    })

    onNotificationDeletedAll(() => {
      setPopups([])
      refreshUnreadCount()
    })

    return () => {
      offNotificationNew()
      offUnreadCount()
      offNotificationRead()
      offNotificationReadAll()
      offNotificationDeleted()
      offNotificationDeletedAll()
      offMissedNotifications()
      unsubReconnect()
      Object.values(timersRef.current).forEach(clearTimeout)
      timersRef.current = {}
      if (playSoundRef.current) {
        playSoundRef.current.pause()
        playSoundRef.current.currentTime = 0
        playSoundRef.current = null
      }
      lastSoundIdRef.current = null
      lastNotifTimeRef.current = null
    }
  }, [user, refreshUnreadCount])

  const dismissPopup = useCallback((popupId) => {
    if (timersRef.current[popupId]) {
      clearTimeout(timersRef.current[popupId])
      delete timersRef.current[popupId]
    }
    setPopups(prev => prev.filter(p => p._popupId !== popupId))
  }, [])

  const markAsRead = useCallback(async (id) => {
    try {
      await api.notifications.markRead(id)
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (e) { /* silent */ }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await api.notifications.markAllRead()
      setUnreadCount(0)
    } catch (e) { /* silent */ }
  }, [])

  const deleteNotification = useCallback(async (id) => {
    try {
      await api.notifications.deleteNotification(id)
      refreshUnreadCount()
    } catch (e) { /* silent */ }
  }, [refreshUnreadCount])

  const deleteAllNotifications = useCallback(async () => {
    try {
      await api.notifications.deleteAll()
      setUnreadCount(0)
    } catch (e) { /* silent */ }
  }, [])

  /** Show a local popup notification without persisting to the backend.
   *  Used by driver pages (Dashboard, ReturnTrip) for real-time alerts. */
  const addNotification = useCallback((title, message = '', priority = 'INFO') => {
    const id = ++popupIdRef.current
    const popup = {
      _popupId: id,
      id: `local-${id}`,
      title,
      message,
      priority,
      type: 'local',
      data: {},
      createdAt: new Date().toISOString(),
    }
    setPopups(prev => [...prev, popup])
    const duration = POPUP_DURATION[priority] || POPUP_DURATION.INFO
    if (duration !== Infinity) {
      timersRef.current[id] = setTimeout(() => {
        setPopups(prev => prev.filter(p => p._popupId !== id))
        delete timersRef.current[id]
      }, duration)
    }
    playNotificationSound(priority, popup.id)
  }, [playNotificationSound])

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      popups,
      dismissPopup,
      refreshUnreadCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      deleteAllNotifications,
      addNotification,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider')
  return ctx
}
