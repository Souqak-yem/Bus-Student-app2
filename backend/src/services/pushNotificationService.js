import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import webpush from 'web-push'
import { prisma } from '../lib/prisma.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const VAPID_FILE = process.env.VAPID_FILE_PATH ? path.resolve(process.env.VAPID_FILE_PATH) : path.resolve(currentDir, '../../.vapid.json')
const isProduction = process.env.NODE_ENV === 'production'

let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

function configureVapidKeys(publicKey, privateKey) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@mashawerk.app',
    publicKey,
    privateKey
  )
  VAPID_PUBLIC_KEY = publicKey
  VAPID_PRIVATE_KEY = privateKey
}

function ensureVapidKeys() {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    configureVapidKeys(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
    return
  }

  if (isProduction) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables are required in production')
  }

  if (fs.existsSync(VAPID_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'))
      if (saved?.publicKey && saved?.privateKey) {
        configureVapidKeys(saved.publicKey, saved.privateKey)
        return
      }
    } catch {}
  }

  const generated = webpush.generateVAPIDKeys()
  configureVapidKeys(generated.publicKey, generated.privateKey)

  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify({ publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }, null, 2))
  } catch {}
}

ensureVapidKeys()

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY
}

export function hasVapidKeys() {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
}

export const PUSH_SKIP_REASON = {
  VAPID_NOT_CONFIGURED: 'vapid_not_configured',
  NO_SUBSCRIPTIONS: 'no_subscriptions',
  PUSH_DISABLED_BY_PREFS: 'push_disabled_by_prefs',
  USER_NOT_FOUND: 'user_not_found',
}

export async function sendPushToUser(userId, payload) {
  const notificationId = payload?.id || 'anonymous'
  const notificationType = payload?.type || 'unknown'

  if (!hasVapidKeys()) {
    console.warn(
      `[Push] SKIP user=${userId} notif=${notificationId} type=${notificationType} — reason=${PUSH_SKIP_REASON.VAPID_NOT_CONFIGURED}`
    )
    return {
      sent: false,
      skipped: true,
      skipReason: PUSH_SKIP_REASON.VAPID_NOT_CONFIGURED,
      deliveredCount: 0,
      totalCount: 0,
      failedCount: 0,
      results: [],
    }
  }

  let user = null
  let subscriptions = []
  try {
    ;[user, subscriptions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { notificationPrefs: true },
      }),
      prisma.pushSubscription.findMany({
        where: { userId },
      }),
    ])
  } catch (dbErr) {
    console.error(
      `[Push] DB_ERROR user=${userId} notif=${notificationId} type=${notificationType}:`,
      dbErr?.message || dbErr
    )
    return {
      sent: false,
      skipped: false,
      error: 'db_error',
      deliveredCount: 0,
      totalCount: 0,
      failedCount: 0,
      results: [],
    }
  }

  if (!subscriptions.length) {
    console.warn(
      `[Push] SKIP user=${userId} notif=${notificationId} type=${notificationType} — reason=${PUSH_SKIP_REASON.NO_SUBSCRIPTIONS} (no rows in push_subscriptions for this user)`
    )
    return {
      sent: false,
      skipped: true,
      skipReason: PUSH_SKIP_REASON.NO_SUBSCRIPTIONS,
      deliveredCount: 0,
      totalCount: 0,
      failedCount: 0,
      results: [],
    }
  }

  let pushDisabledByPrefs = false
  if (user?.notificationPrefs && typeof user.notificationPrefs === 'object') {
    const typePrefs = user.notificationPrefs[payload.type] || user.notificationPrefs.default
    if (typePrefs && typePrefs.push === false) {
      pushDisabledByPrefs = true
    }
  }

  if (pushDisabledByPrefs) {
    console.warn(
      `[Push] SKIP user=${userId} notif=${notificationId} type=${notificationType} — reason=${PUSH_SKIP_REASON.PUSH_DISABLED_BY_PREFS} (type=${notificationType} push=false in prefs)`
    )
    return {
      sent: false,
      skipped: true,
      skipReason: PUSH_SKIP_REASON.PUSH_DISABLED_BY_PREFS,
      deliveredCount: 0,
      totalCount: subscriptions.length,
      failedCount: 0,
      results: [],
    }
  }

  const iconPath = '/app-icon.svg'
  const badgePath = '/app-icon.svg'

  const data = JSON.stringify({
    title: payload.title,
    message: payload.message,
    body: payload.message,
    type: payload.type,
    priority: payload.priority,
    targetRoute: payload.targetRoute,
    notificationId: payload.id,
    icon: iconPath,
    badge: badgePath,
    data: {
      ...(payload.data || {}),
      url: payload.targetRoute || '/',
      notificationId: payload.id,
    },
    createdAt: payload.createdAt,
  })

  const expiredSubIds = []
  let deliveredCount = 0
  let failedCount = 0

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const result = await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          data
        )
        deliveredCount += 1
        return {
          subId: sub.id,
          endpointStart: sub.endpoint.slice(0, 30),
          status: 'delivered',
          statusCode: result?.statusCode,
        }
      } catch (err) {
        const code = err?.statusCode
        const isGone = code === 410 || code === 404
        if (isGone) {
          console.warn(
            `[Push] EXPIRED sub=${sub.id} user=${userId} notif=${notificationId} — status=${code} (Gone/Not Found). Endpoint no longer valid; removing from DB.`
          )
          expiredSubIds.push(sub.id)
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } })
          } catch (delErr) {
            console.error(
              `[Push] Failed to delete expired sub=${sub.id}:`,
              delErr?.message || delErr
            )
          }
          failedCount += 1
          return {
            subId: sub.id,
            endpointStart: sub.endpoint.slice(0, 30),
            status: 'expired',
            statusCode: code,
          }
        } else {
          console.error(
            `[Push] SEND_FAIL sub=${sub.id} user=${userId} notif=${notificationId} endpoint=${sub.endpoint.slice(0, 40)}...: status=${code || 'none'} msg=${err?.message || err}`
          )
          failedCount += 1
          return {
            subId: sub.id,
            endpointStart: sub.endpoint.slice(0, 30),
            status: 'failed',
            statusCode: code,
            error: err?.message || String(err),
          }
        }
      }
    })
  )

  if (deliveredCount > 0 || failedCount > 0) {
    const level = deliveredCount === subscriptions.length ? 'info' : 'warn'
    const logFn = level === 'info' ? console.log : console.warn
    logFn(
      `[Push] SUMMARY user=${userId} notif=${notificationId} type=${notificationType} — total=${subscriptions.length} delivered=${deliveredCount} failed=${failedCount} expired=${expiredSubIds.length}`
    )
  }

  return {
    sent: deliveredCount > 0,
    skipped: false,
    deliveredCount,
    failedCount,
    expiredCount: expiredSubIds.length,
    totalCount: subscriptions.length,
    expiredSubIds,
    results,
  }
}

export async function saveSubscription(userId, subscription, deviceType, userAgent) {
  const { endpoint, keys } = subscription

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    const msg = `[Push] saveSubscription INVALID_INPUT user=${userId}: missing endpoint/keys`
    console.error(msg)
    throw new Error('بيانات اشتراك الإشعارات غير مكتملة')
  }

  console.log(
    `[Push] saveSubscription user=${userId} device=${deviceType || 'unknown'} endpoint=${endpoint.slice(0, 50)}...`
  )

  const existing = await prisma.pushSubscription.findFirst({
    where: { OR: [{ endpoint }, { userId, p256dh: keys.p256dh }] },
  })

  if (existing) {
    console.log(
      `[Push] saveSubscription UPDATE existing=${existing.id} for user=${userId}`
    )
    const updated = await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceType: deviceType || null,
        userAgent: userAgent || existing.userAgent,
      },
    })
    return { ...updated, wasExisting: true }
  }

  const created = await prisma.pushSubscription.create({
    data: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      deviceType: deviceType || null,
      userAgent: userAgent || null,
    },
  })
  console.log(
    `[Push] saveSubscription NEW sub=${created.id} created for user=${userId}`
  )
  return { ...created, wasExisting: false }
}

export async function removeSubscription(endpoint, userId) {
  if (!endpoint && !userId) return
  const where = endpoint ? { endpoint } : { userId }
  const deleted = await prisma.pushSubscription.deleteMany({ where })
  console.log(
    `[Push] removeSubscription: endpoint=${endpoint ? endpoint.slice(0, 30) + '...' : 'N/A'} userId=${userId || 'N/A'} — deleted=${deleted.count}`
  )
  return deleted
}
