import { prisma } from '../lib/prisma.js'
import { broadcastNotification, broadcastUnreadCount, broadcastNotificationRead, broadcastNotificationReadAll, broadcastNotificationDeleted, broadcastNotificationDeletedAll } from './socketService.js'
import { getNotificationDefaults, PRIORITY } from '../config/notificationConfig.js'
import { sendPushToUser } from './pushNotificationService.js'
import { canAccessAdminPage, normalizeAdminPermissions } from '../utils/adminPermissions.js'

const DEDUP_WINDOW_MS = 30 * 1000

function isAdminNotificationVisibleToUser(user, notification) {
  if (!user || user.role !== 'admin') return true
  if (!Array.isArray(user.adminPermissions)) return true

  const permissions = normalizeAdminPermissions(user.adminPermissions)
  if (permissions.length === 0) return true

  const route = notification?.targetRoute || notification?.data?.route || null
  if (!route) return false

  return canAccessAdminPage(user, route)
}

export async function createAndBroadcast({ userId, type, title, message, data, priority, targetRoute, icon, dedupKey }) {
  if (dedupKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        dedupKey,
        createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
      },
    })
    if (existing) return existing
  }

  const defaults = getNotificationDefaults(type)
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      priority: priority || defaults.priority,
      targetRoute: targetRoute !== undefined ? targetRoute : defaults.route,
      dedupKey: dedupKey || null,
      data: { ...(data || {}), icon: icon || defaults.icon },
    },
  })

  broadcastNotification(userId, notification)
  broadcastUnreadCount(userId)

  Promise.resolve()
    .then(() => sendPushToUser(userId, notification))
    .then((pushResult) => {
      if (pushResult?.expiredCount && pushResult.expiredCount > 0) {
        console.warn(
          `[NotificationService] user=${userId} notif=${notification.id} type=${notification.type} push expiredCount=${pushResult.expiredCount} — subscriptions invalidated and removed.`
        )
      }
      if (pushResult?.skipped && pushResult.skipReason) {
        console.warn(
          `[NotificationService] user=${userId} notif=${notification.id} type=${notification.type} push skipped reason=${pushResult.skipReason}`
        )
      }
    })
    .catch((pushErr) => {
      console.error(
        `[NotificationService] user=${userId} notif=${notification.id} type=${notification.type} sendPushToUser THREW (should not happen):`,
        pushErr?.message || pushErr
      )
    })

  return notification
}

export async function getUnreadCount(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, adminPermissions: true },
  })

  const where = { userId, isRead: false }
  const notifications = await prisma.notification.findMany({
    where,
    select: { id: true, targetRoute: true, data: true },
  })

  const visible = user?.role === 'admin' && Array.isArray(user.adminPermissions) && normalizeAdminPermissions(user.adminPermissions).length > 0
    ? notifications.filter((notification) => isAdminNotificationVisibleToUser(user, notification))
    : notifications

  return visible.length
}

export async function listNotifications(userId, { filter, priority: priorityFilter, limit, offset } = {}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, adminPermissions: true },
  })

  const where = { userId }
  if (filter === 'unread') where.isRead = false
  else if (filter === 'read') where.isRead = true
  if (priorityFilter) where.priority = priorityFilter

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit || 100,
      skip: offset || 0,
    }),
    prisma.notification.count({ where }),
  ])

  const filteredNotifications = user?.role === 'admin' && Array.isArray(user.adminPermissions) && normalizeAdminPermissions(user.adminPermissions).length > 0
    ? notifications.filter((notification) => isAdminNotificationVisibleToUser(user, notification))
    : notifications

  return { notifications: filteredNotifications, total: filteredNotifications.length }
}

export async function markAsRead(id, userId) {
  const notification = await prisma.notification.update({
    where: { id, userId },
    data: { isRead: true },
  })
  broadcastNotificationRead(userId, id)
  broadcastUnreadCount(userId)
  return notification
}

export async function markAllAsRead(userId) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  })
  broadcastNotificationReadAll(userId)
  broadcastUnreadCount(userId)
}

export async function deleteNotification(id, userId) {
  await prisma.notification.delete({ where: { id, userId } })
  broadcastNotificationDeleted(userId, id)
  broadcastUnreadCount(userId)
}

export async function deleteAllNotifications(userId) {
  await prisma.notification.deleteMany({ where: { userId } })
  broadcastNotificationDeletedAll(userId)
  broadcastUnreadCount(userId)
}

export async function getUnreadCountsForAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true },
  })
  const results = await Promise.all(
    admins.map(async (admin) => ({
      userId: admin.id,
      count: await prisma.notification.count({ where: { userId: admin.id, isRead: false } }),
    }))
  )
  return results
}
