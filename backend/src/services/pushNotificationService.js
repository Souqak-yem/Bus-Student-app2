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

export async function sendPushToUser(userId, payload) {
  if (!hasVapidKeys()) return

  const [user, subscriptions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { notificationPrefs: true },
    }),
    prisma.pushSubscription.findMany({
      where: { userId },
    }),
  ])

  if (!subscriptions.length) return

  if (user?.notificationPrefs && typeof user.notificationPrefs === 'object') {
    const typePrefs = user.notificationPrefs[payload.type] || user.notificationPrefs.default
    if (typePrefs && typePrefs.push === false) return
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

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, data).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } })
        } else {
          console.error(`[Push] send failed for ${sub.endpoint.slice(0, 30)}...:`, err.statusCode || err.message)
        }
      })
    )
  )

  return results
}

export async function saveSubscription(userId, subscription, deviceType, userAgent) {
  const { endpoint, keys } = subscription

  const existing = await prisma.pushSubscription.findFirst({
    where: { OR: [{ endpoint }, { userId, p256dh: keys.p256dh }] },
  })

  if (existing) {
    return prisma.pushSubscription.update({
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
  }

  return prisma.pushSubscription.create({
    data: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      deviceType: deviceType || null,
      userAgent: userAgent || null,
    },
  })
}

export async function removeSubscription(endpoint) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } })
}
