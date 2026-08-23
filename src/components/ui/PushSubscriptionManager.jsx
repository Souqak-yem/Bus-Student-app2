import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { subscribeToPush, isPushNotificationsEnabled } from '../../lib/pushManager'

export default function PushSubscriptionManager() {
  const { user } = useAuth()
  const lastAttemptRef = useRef(null)
  const mountedRef = useRef(true)

  const ensureSubscription = useCallback(async () => {
    if (!user) return
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    if (!isPushNotificationsEnabled()) return

    const now = Date.now()
    if (lastAttemptRef.current && now - lastAttemptRef.current < 60_000) return
    lastAttemptRef.current = now

    try {
      await subscribeToPush()
    } catch (err) {
      console.warn('[PushSubscriptionManager] ensure failed:', err?.message || err)
    }
  }, [user])

  useEffect(() => {
    mountedRef.current = true
    ensureSubscription()

    let retryTimer = null
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        retryTimer = setTimeout(ensureSubscription, 1500)
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', visibilityHandler)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [ensureSubscription])

  return null
}
