import { api } from './api'

const PUSH_NOTIFICATIONS_KEY = 'studentPushNotifications'

export function isPushNotificationsEnabled() {
  const stored = localStorage.getItem(PUSH_NOTIFICATIONS_KEY)
  return stored !== 'off'
}

export function setPushNotificationsEnabled(enabled) {
  localStorage.setItem(PUSH_NOTIFICATIONS_KEY, enabled ? 'on' : 'off')
  return enabled
}

const PUBLIC_KEY_CACHE = { key: null, available: false }

async function getVapidPublicKey() {
  if (PUBLIC_KEY_CACHE.key) return PUBLIC_KEY_CACHE
  try {
    const res = await api.get('/push/vapid-public-key')
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

  if (typeof localStorage !== 'undefined' && localStorage.getItem('studentPushNotifications') === 'off') {
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

  if (existingSubscription) {
    const subJson = existingSubscription.toJSON()
    await api.post('/push/subscribe', {
      subscription: {
        endpoint: subJson.endpoint,
        keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
      },
      userAgent: navigator.userAgent,
    })
    return { success: true, subscribed: true }
  }

  const subscription = await readyRegistration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })

  const subJson = subscription.toJSON()
  await api.post('/push/subscribe', {
    subscription: {
      endpoint: subJson.endpoint,
      keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
    },
    userAgent: navigator.userAgent,
  })

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
      await api.post('/push/unsubscribe', { endpoint })
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
