import { api } from './api'

const PUSH_NOTIFICATIONS_KEY = 'appPushNotifications'
const LEGACY_PUSH_KEY = 'studentPushNotifications'

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

const PUBLIC_KEY_CACHE = { key: null, available: false }

async function getVapidPublicKey() {
  if (PUBLIC_KEY_CACHE.key) return PUBLIC_KEY_CACHE
  try {
    const res = await api.push.vapidKey()
    PUBLIC_KEY_CACHE.key = res.publicKey
    PUBLIC_KEY_CACHE.available = res.vapidAvailable
    return PUBLIC_KEY_CACHE
  } catch {
    return { key: null, available: false }
  }
}

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, reason: 'unsupported' }
  }

  if (!isPushNotificationsEnabled()) {
    return { success: false, reason: 'disabled' }
  }

  const permission = await requestPermission()
  if (permission !== 'granted') {
    return { success: false, reason: permission }
  }

  const { key, available } = await getVapidPublicKey()
  if (!available || !key) {
    return { success: false, reason: 'vapid-not-configured' }
  }

  let registration = await navigator.serviceWorker.getRegistration('/sw.js')
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  }
  const readyRegistration = await navigator.serviceWorker.ready
  const existingSubscription = await readyRegistration.pushManager.getSubscription()
  const deviceType = getDeviceType()
  const userAgent = navigator.userAgent

  if (existingSubscription) {
    const subJson = existingSubscription.toJSON()
    await api.push.subscribe(
      {
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      },
      deviceType,
      userAgent,
    )
    return { success: true, subscribed: true }
  }

  const subscription = await readyRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })

  const subJson = subscription.toJSON()
  await api.push.subscribe(
    {
      endpoint: subJson.endpoint,
      keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
    },
    deviceType,
    userAgent,
  )

  return { success: true, subscribed: true }
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false }
  }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    try {
      await api.push.unsubscribe(endpoint)
    } catch {}
  }

  return { success: true }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}
