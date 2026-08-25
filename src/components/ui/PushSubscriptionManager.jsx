import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  subscribeToPush,
  isPushNotificationsEnabled,
  getPushStatus,
} from '../../lib/pushManager'

const CHECK_INTERVAL_IDEAL_MS = 2 * 60_000
const CHECK_INTERVAL_RELAXED_MS = 10 * 60_000
const MIN_ATTEMPT_GAP_MS = 15_000
const LOG_PREFIX = '[PushSubscriptionManager]'

export default function PushSubscriptionManager() {
  const { user } = useAuth()
  const lastAttemptRef = useRef(0)
  const lastCheckRef = useRef(0)
  const mountedRef = useRef(true)
  const userIdRef = useRef(null)

  const runEnsure = useCallback(
    async ({ force = false, reason = 'unspecified' } = {}) => {
      if (!user) return
      if (typeof Notification === 'undefined') return
      if (Notification.permission !== 'granted') {
        console.debug(LOG_PREFIX, `skip: permission=${Notification.permission}`)
        return
      }
      if (!isPushNotificationsEnabled()) {
        console.debug(LOG_PREFIX, 'skip: localStorage push toggle is off')
        return
      }

      const now = Date.now()
      if (!force && lastAttemptRef.current && now - lastAttemptRef.current < MIN_ATTEMPT_GAP_MS) {
        console.debug(LOG_PREFIX, `skip: throttled (min gap ${MIN_ATTEMPT_GAP_MS}ms). reason=${reason}`)
        return
      }
      lastAttemptRef.current = now

      let status = null
      try {
        status = await getPushStatus()
        console.debug(LOG_PREFIX, `status check reason=${reason}:`, {
          serverSubs: status.serverSubscriptionCount,
          clientSub: !!status.clientSubscription,
          swRegistered: status.swRegistered,
          vapidAvailable: status.vapidAvailable,
        })
      } catch (statusErr) {
        console.warn(LOG_PREFIX, 'getPushStatus threw (continuing anyway):', statusErr?.message)
      }

      const hasServerSub = status ? status.serverSubscriptionCount > 0 : null
      const hasClientSub = status ? !!status.clientSubscription : null
      const vapidOk = status ? status.vapidAvailable : true
      const swOk = status ? status.swRegistered : true

      const needsPush = !hasServerSub || !hasClientSub || !vapidOk || !swOk

      if (hasServerSub && hasClientSub && vapidOk && swOk) {
        console.log(LOG_PREFIX, `everything OK (serverSubs=${status.serverSubscriptionCount}, clientSub=true). reason=${reason}`)
        return
      }

      console.log(LOG_PREFIX, `action required: serverSubs=${hasServerSub} clientSub=${hasClientSub} vapid=${vapidOk} sw=${swOk}. Force-resubscribing. reason=${reason}`)

      try {
        const result = await subscribeToPush({ forceResubscribe: !hasServerSub && hasClientSub ? false : force })
        if (result?.success) {
          console.log(
            LOG_PREFIX,
            `subscribed successfully! serverSubs=${result.totalSubscriptions || 'N/A'} existingClient=${result.wasExistingClientSide} existingServer=${result.wasExistingServerSide} elapsed=${result.elapsedMs}ms`
          )
        } else {
          console.warn(
            LOG_PREFIX,
            `subscribe attempt FAILED. phase=${result?.phase || 'N/A'} reason=${result?.reason || 'N/A'} message=${result?.message || 'N/A'} name=${result?.name || 'N/A'}`
          )
        }
      } catch (err) {
        console.error(LOG_PREFIX, 'subscribeToPush THREW (should not happen):', err?.message || err)
      }
    },
    [user]
  )

  useEffect(() => {
    mountedRef.current = true

    if (userIdRef.current && userIdRef.current !== user?.id) {
      console.log(LOG_PREFIX, 'user id changed; resetting attempt windows.')
      lastAttemptRef.current = 0
      lastCheckRef.current = 0
    }
    userIdRef.current = user?.id || null

    const initTimer = setTimeout(() => runEnsure({ reason: 'mount' }), 1500)

    let visibilityTimer = null
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        clearTimeout(visibilityTimer)
        visibilityTimer = setTimeout(() => runEnsure({ reason: 'visibility' }), 1200)
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    let onlineTimer = null
    const onlineHandler = () => {
      clearTimeout(onlineTimer)
      onlineTimer = setTimeout(() => runEnsure({ reason: 'online' }), 2000)
    }
    window.addEventListener('online', onlineHandler)

    let intervalTimer = setInterval(() => {
      if (!mountedRef.current) return
      runEnsure({ reason: 'interval_bg' })
    }, CHECK_INTERVAL_RELAXED_MS)

    let aggressiveTimer = null
    const runAggressive = () => {
      if (!mountedRef.current) return
      runEnsure({ reason: 'interval_bg_aggressive' })
        .then(() => {
          aggressiveTimer = setTimeout(runAggressive, CHECK_INTERVAL_IDEAL_MS)
        })
        .catch(() => {
          aggressiveTimer = setTimeout(runAggressive, CHECK_INTERVAL_RELAXED_MS)
        })
    }
    aggressiveTimer = setTimeout(runAggressive, 30_000)

    return () => {
      mountedRef.current = false
      clearTimeout(initTimer)
      clearTimeout(visibilityTimer)
      clearTimeout(onlineTimer)
      clearTimeout(aggressiveTimer)
      clearInterval(intervalTimer)
      document.removeEventListener('visibilitychange', visibilityHandler)
      window.removeEventListener('online', onlineHandler)
    }
  }, [runEnsure, user?.id])

  return null
}
