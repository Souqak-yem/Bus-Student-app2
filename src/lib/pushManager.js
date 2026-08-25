import { api } from './api'

const PUSH_NOTIFICATIONS_KEY = 'appPushNotifications'
const LEGACY_PUSH_KEY = 'studentPushNotifications'
const SUBSCRIPTION_STATE_KEY = 'appPushSubscriptionState'
const SW_READY_TIMEOUT_MS = 15_000
const LOG_PREFIX = '[PushManager]'

export const NOTIFICATION_CATEGORIES = [
  { key: 'subscription', label: 'الاشتراكات', types: ['subscription_request', 'subscription_approved', 'subscription_rejected', 'student_subscription_requested', 'student_subscription_approved', 'student_subscription_rejected', 'student_subscription_resubmission_requested', 'student_subscription_reactivated', 'student_subscription_activated_with_trip', 'student_subscription_activated_suspended', 'student_subscription_expiring_soon', 'student_subscription_expired', 'student_payment_reminder', 'student_home_delivery_price', 'student_grace_period_started', 'student_grace_period_ended', 'student_account_suspended', 'student_account_reactivated', 'payment_reminder', 'subscription_expired', 'subscription_expiring_soon', 'cart_submitted', 'cart_rejected'] },
  { key: 'operation', label: 'الرحلات اليومية', types: ['operation_created', 'morning_trip_started', 'morning_trip_completed', 'return_trip_started', 'return_trip_completed', 'student_operation_created', 'student_added_to_trip', 'student_removed_from_trip', 'student_bus_changed', 'student_driver_changed', 'student_pickup_time_changed', 'student_pickup_location_changed', 'student_order_changed', 'student_late'] },
  { key: 'tracking', label: 'التتبع والحضور', types: ['tracking_next', 'tracking_arrived', 'bus_near', 'student_trip_started', 'student_bus_near', 'student_attendance_marked', 'student_marked_absent', 'student_arrived_university', 'student_return_trip_started', 'student_loaded_for_return', 'student_dropped_off', 'student_trip_ended'] },
  { key: 'return', label: 'رحلة العودة', types: ['student_in_queue', 'bus_full', 'student_unassigned', 'student_return_queue_added', 'student_return_assigned', 'student_return_bus_changed', 'student_return_bus_full', 'student_return_cancelled', 'student_return_queue_cancelled', 'driver_return_dispatched', 'driver_return_completed', 'driver_return_bus_removed', 'driver_student_dropped_off', 'driver_return_student_added', 'driver_return_student_removed', 'driver_return_trip_ready'] },
  { key: 'emergency', label: 'البلاغات الطارئة', types: ['emergency_breakdown', 'emergency_declared', 'emergency_transfer_completed', 'emergency_resolved', 'emergency_transfer', 'driver_emergency_declared', 'driver_emergency_resolved', 'student_emergency_breakdown', 'student_emergency_wait', 'student_emergency_transferred', 'student_emergency_meeting_point_changed', 'student_emergency_resolved'] },
  { key: 'finance', label: 'المالية', types: ['student_overdue', 'grace_period_started', 'grace_period_ended', 'student_suspended', 'student_reactivated'] },
  { key: 'transfers', label: 'التحويلات', types: ['transfer_requested', 'transfer_approved', 'driver_student_transferred_in', 'driver_student_transferred_out', 'driver_all_transferred'] },
  { key: 'driver', label: 'السائق', types: ['driver_student_added', 'driver_student_removed', 'driver_pickup_time_changed', 'driver_order_changed', 'driver_bus_line_changed', 'driver_bus_added', 'driver_bus_removed', 'driver_trip_cancelled', 'driver_trip_started', 'driver_trip_completed', 'driver_bus_replaced', 'driver_password_changed'] },
  { key: 'admin', label: 'المشرفين', types: ['student_registration_request', 'password_reset_request', 'weekly_sheets_created', 'unassigned_daily_subscription'] },
]

export function buildDefaultNotificationPrefs(overrides = {}) {
  const prefs = {}
  NOTIFICATION_CATEGORIES.forEach(({ types }) => {
    types.forEach((type) => {
      prefs[type] = { inApp: true, push: true, email: false }
    })
  })
  prefs.default = { inApp: true, push: true, email: false }
  return { ...prefs, ...overrides }
}

export const DEFAULT_NOTIFICATION_PREFS = buildDefaultNotificationPrefs()

export function getCategoryForType(type) {
  const found = NOTIFICATION_CATEGORIES.find((cat) => cat.types.includes(type))
  return found || NOTIFICATION_CATEGORIES[NOTIFICATION_CATEGORIES.length - 1]
}

export function isPushNotificationsEnabled() {
  if (typeof localStorage === 'undefined') return true
  const legacy = localStorage.getItem(LEGACY_PUSH_KEY)
  if (legacy !== null) {
    localStorage.setItem(PUSH_NOTIFICATIONS_KEY, legacy)
    localStorage.removeItem(LEGACY_PUSH_KEY)
  }
  const stored = localStorage.getItem(PUSH_NOTIFICATIONS_KEY)
  return stored !== 'off'
}

export function setPushNotificationsEnabled(enabled) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PUSH_NOTIFICATIONS_KEY, enabled ? 'on' : 'off')
    if (localStorage.getItem(LEGACY_PUSH_KEY) !== null) {
      localStorage.removeItem(LEGACY_PUSH_KEY)
    }
  }
  return enabled
}

export function getDeviceType() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  const platform = (navigator.platform || '').toLowerCase()

  const isMobile = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTablet = /(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua) ||
    (platform === 'ipad') ||
    (platform === 'macintel' && 'ontouchend' in document && Math.max(window.screen.width, window.screen.height) < 1400)

  if (isTablet) return 'tablet'
  if (isMobile) return 'mobile'
  return 'desktop'
}

const PUBLIC_KEY_CACHE = { key: null, available: false, fetchedAt: 0 }

async function getVapidPublicKey({ forceRefresh = false } = {}) {
  const now = Date.now()
  if (!forceRefresh && PUBLIC_KEY_CACHE.key && now - PUBLIC_KEY_CACHE.fetchedAt < 10 * 60_000) {
    return PUBLIC_KEY_CACHE
  }
  try {
    const res = await api.push.vapidKey()
    PUBLIC_KEY_CACHE.key = res.publicKey
    PUBLIC_KEY_CACHE.available = !!res.vapidAvailable
    PUBLIC_KEY_CACHE.fetchedAt = now
    return PUBLIC_KEY_CACHE
  } catch (err) {
    console.warn(LOG_PREFIX, 'getVapidPublicKey fetch failed:', err?.message || err)
    return { key: null, available: false, error: err?.message || 'network_error' }
  }
}

export async function getPushStatus() {
  const base = {
    supported: false,
    permission: 'unsupported' in window ? 'unsupported' : 'default',
    swRegistered: false,
    clientSubscription: null,
    serverSubscriptionCount: 0,
    vapidAvailable: false,
    localStorageEnabled: isPushNotificationsEnabled(),
  }

  if (typeof window === 'undefined') return base
  base.supported = 'serviceWorker' in navigator && 'PushManager' in window
  if (!base.supported) return base

  base.permission = 'Notification' in window ? Notification.permission : 'unsupported'

  try {
    const { available } = await getVapidPublicKey()
    base.vapidAvailable = !!available
  } catch {}

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    base.swRegistered = !!reg
    if (reg) {
      try {
        const sub = await reg.pushManager.getSubscription()
        base.clientSubscription = !!sub
          ? {
              endpoint: sub.endpoint?.slice(0, 50) + '...',
            }
          : null
      } catch (err) {
        console.warn(LOG_PREFIX, 'getPushStatus getSubscription failed:', err?.message)
      }
    }
  } catch (err) {
    console.warn(LOG_PREFIX, 'getPushStatus getRegistration failed:', err?.message)
  }

  try {
    const st = await api.push.status().catch(() => null)
    if (st) {
      base.serverSubscriptionCount = st.count || 0
    }
  } catch {}

  return base
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch (err) {
    console.error(LOG_PREFIX, 'requestPermission threw:', err?.message || err)
    return 'thrown'
  }
}

function readPersistedState() {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STATE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writePersistedState(state) {
  try {
    localStorage.setItem(SUBSCRIPTION_STATE_KEY, JSON.stringify(state))
  } catch {}
}

async function waitForSwReady({ timeoutMs = SW_READY_TIMEOUT_MS } = {}) {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker غير مدعوم في المتصفح')

  let registration = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!registration) {
    console.log(LOG_PREFIX, 'No SW found; registering /sw.js')
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      console.log(LOG_PREFIX, 'SW registered:', registration.scope)
    } catch (regErr) {
      console.error(LOG_PREFIX, 'SW register FAILED:', regErr?.message || regErr)
      throw new Error('فشل تسجيل خدمة العمل (Service Worker): ' + (regErr?.message || String(regErr)))
    }
  }

  const readyPromise = navigator.serviceWorker.ready
  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      reject(new Error(`انتهت مهلة انتظار جاهزية خدمة العمل (${Math.round(timeoutMs / 1000)} ثانية)`))
    }, timeoutMs)
  })

  try {
    const ready = await Promise.race([readyPromise, timeoutPromise])
    if (!ready) throw new Error('serviceWorker.ready رجع فارغ')
    return ready
  } catch (err) {
    console.error(LOG_PREFIX, 'waitForSwReady failed:', err?.message || err)
    throw err
  }
}

const SUBSCRIBE_ERROR = {
  UNSUPPORTED: 'unsupported',
  DISABLED_BY_USER: 'disabled',
  PERMISSION_DENIED: 'denied',
  PERMISSION_DEFAULT: 'default',
  PERMISSION_UNSUPPORTED: 'unsupported_permission',
  VAPID_NOT_CONFIGURED: 'vapid-not-configured',
  SW_FAILURE: 'sw_failure',
  CLIENT_SUBSCRIBE_FAILED: 'client_subscribe_failed',
  SERVER_SYNC_FAILED: 'server_sync_failed',
  INVALID_SUBSCRIPTION_PAYLOAD: 'invalid_subscription_payload',
}

export async function subscribeToPush({ forceResubscribe = false } = {}) {
  const t0 = performance.now()
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.UNSUPPORTED,
      phase: 'capability_check',
    }
  }

  if (!isPushNotificationsEnabled()) {
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.DISABLED_BY_USER,
      phase: 'local_toggle_check',
    }
  }

  let permission
  try {
    permission = await requestPermission()
  } catch (permErr) {
    return {
      success: false,
      subscribed: false,
      reason: 'permission_request_threw',
      phase: 'permission_request',
      message: permErr?.message,
    }
  }
  if (permission !== 'granted') {
    const reasonMap = {
      denied: SUBSCRIBE_ERROR.PERMISSION_DENIED,
      default: SUBSCRIBE_ERROR.PERMISSION_DEFAULT,
      unsupported: SUBSCRIBE_ERROR.PERMISSION_UNSUPPORTED,
    }
    return {
      success: false,
      subscribed: false,
      reason: reasonMap[permission] || permission,
      phase: 'permission_check',
    }
  }

  const { key, available } = await getVapidPublicKey({ forceRefresh: true })
  if (!available || !key) {
    console.error(LOG_PREFIX, 'VAPID NOT AVAILABLE on server.')
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.VAPID_NOT_CONFIGURED,
      phase: 'vapid_check',
    }
  }

  let readyRegistration
  try {
    readyRegistration = await waitForSwReady()
  } catch (swErr) {
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.SW_FAILURE,
      phase: 'sw_ready',
      message: swErr?.message,
    }
  }

  const deviceType = getDeviceType()
  const userAgent = navigator.userAgent

  let subscription
  try {
    subscription = await readyRegistration.pushManager.getSubscription()
  } catch (err) {
    console.error(LOG_PREFIX, 'getSubscription() threw:', err?.message)
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.CLIENT_SUBSCRIBE_FAILED,
      phase: 'get_subscription',
      message: err?.message,
    }
  }

  let wasExistingClientSide = !!subscription

  if (subscription && forceResubscribe) {
    console.log(LOG_PREFIX, 'forceResubscribe=true; unsubscribing existing client subscription first.')
    try {
      await subscription.unsubscribe()
      subscription = null
      wasExistingClientSide = false
    } catch (unsubErr) {
      console.warn(LOG_PREFIX, 'forceResubscribe unsubscribe failed (continuing):', unsubErr?.message)
    }
  }

  if (!subscription) {
    try {
      subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
      console.log(LOG_PREFIX, 'Client-side Push subscription created.')
    } catch (err) {
      console.error(
        LOG_PREFIX,
        'pushManager.subscribe() FAILED. Common causes: invalid VAPID key, permission not granted, missing SW scope, or secure-context issues.',
        err?.message || err
      )
      return {
        success: false,
        subscribed: false,
        reason: SUBSCRIBE_ERROR.CLIENT_SUBSCRIBE_FAILED,
        phase: 'subscribe_client',
        message: err?.message,
        name: err?.name,
      }
    }
  } else {
    console.log(LOG_PREFIX, 'Client-side Push subscription already exists; will sync to server.')
  }

  const subJson = subscription.toJSON()
  if (!subJson?.endpoint || !subJson?.keys?.p256dh || !subJson?.keys?.auth) {
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.INVALID_SUBSCRIPTION_PAYLOAD,
      phase: 'payload_check',
    }
  }

  let serverResponse
  try {
    serverResponse = await api.push.subscribe(
      {
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      },
      deviceType,
      userAgent
    )
  } catch (serverErr) {
    console.error(
      LOG_PREFIX,
      'api.push.subscribe FAILED (server rejected the subscription):',
      serverErr?.message || serverErr
    )
    return {
      success: false,
      subscribed: false,
      reason: SUBSCRIBE_ERROR.SERVER_SYNC_FAILED,
      phase: 'subscribe_server',
      message: serverErr?.message,
      status: serverErr?.status,
    }
  }

  const elapsed = (performance.now() - t0).toFixed(0)
  const finalState = {
    subscribedAt: Date.now(),
    deviceType,
    endpointStart: subJson.endpoint.slice(0, 40),
    serverId: serverResponse?.id || null,
    totalSubscriptions: serverResponse?.totalSubscriptions || null,
    wasExistingClientSide,
    wasExistingServerSide: serverResponse?.wasExisting === true,
    elapsedMs: Number(elapsed),
  }
  writePersistedState(finalState)

  console.log(
    LOG_PREFIX,
    `subscribeToPush DONE in ${elapsed}ms. clientExisting=${wasExistingClientSide} serverExisting=${serverResponse?.wasExisting} totalSubs=${serverResponse?.totalSubscriptions || 'N/A'}`
  )

  return {
    success: true,
    subscribed: true,
    serverSubscriptionId: serverResponse?.id || null,
    totalSubscriptions: serverResponse?.totalSubscriptions || null,
    wasExistingClientSide,
    wasExistingServerSide: serverResponse?.wasExisting === true,
    elapsedMs: Number(elapsed),
  }
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, reason: 'unsupported' }
  }

  let endpoint = null
  let clientUnsubscribed = false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      endpoint = subscription.endpoint
      await subscription.unsubscribe()
      clientUnsubscribed = true
    }
  } catch (err) {
    console.warn(LOG_PREFIX, 'Client-side unsubscribe failed:', err?.message)
  }

  let serverDeleted = 0
  try {
    const result = await api.push.unsubscribe(endpoint).catch(() => null)
    serverDeleted = result?.deletedCount || 0
  } catch (err) {
    console.warn(LOG_PREFIX, 'Server-side unsubscribe failed:', err?.message)
  }

  try {
    localStorage.removeItem(SUBSCRIPTION_STATE_KEY)
  } catch {}

  return {
    success: true,
    clientUnsubscribed,
    serverDeleted,
  }
}

function urlBase64ToUint8Array(base64String) {
  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const output = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      output[i] = rawData.charCodeAt(i)
    }
    return output
  } catch (err) {
    console.error(LOG_PREFIX, 'urlBase64ToUint8Array INVALID VAPID PUBLIC KEY base64 input:', base64String?.slice(0, 30), err?.message)
    throw err
  }
}

export function getLastSubscriptionState() {
  return readPersistedState()
}
