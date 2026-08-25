import { Router } from 'express'
import { authenticate, authenticateOptional } from '../middleware/auth.js'
import { saveSubscription, removeSubscription, getVapidPublicKey, hasVapidKeys } from '../services/pushNotificationService.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/vapid-public-key', (_req, res) => {
  const available = hasVapidKeys()
  const key = getVapidPublicKey()
  if (!available || !key) {
    console.warn('[Push] vapid-public-key endpoint hit but VAPID keys are NOT configured.')
    return res.status(501).json({ error: 'VAPID keys not configured', vapidAvailable: false, publicKey: null })
  }
  res.json({ publicKey: key, vapidAvailable: true, lastPart: key.slice(-12) })
})

router.post('/subscribe', authenticate, async (req, res) => {
  const userId = req.user.id
  const { subscription, deviceType, userAgent } = req.body
  console.log(
    `[Push Route] subscribe POST user=${userId} device=${deviceType || 'unknown'} has_endpoint=${!!subscription?.endpoint}`
  )
  try {
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.warn(
        `[Push Route] subscribe INVALID user=${userId}: endpoint=${!!subscription?.endpoint} p256dh=${!!subscription?.keys?.p256dh} auth=${!!subscription?.keys?.auth}`
      )
      return res.status(400).json({
        error: 'بيانات الاشتراك غير مكتملة',
        errorCode: 'INCOMPLETE_SUBSCRIPTION',
      })
    }
    const result = await saveSubscription(userId, subscription, deviceType, userAgent)
    const subscriptionCount = await prisma.pushSubscription.count({ where: { userId } })
    console.log(
      `[Push Route] subscribe SUCCESS user=${userId} sub=${result.id} wasExisting=${result.wasExisting} total_subs=${subscriptionCount}`
    )
    res.json({
      success: true,
      message: 'تم الاشتراك في الإشعارات',
      id: result.id,
      wasExisting: result.wasExisting === true,
      totalSubscriptions: subscriptionCount,
    })
  } catch (error) {
    console.error('[Push Route] subscribe FAILED user=' + userId + ':', error?.message || error)
    res.status(500).json({
      error: 'فشل الاشتراك في الإشعارات',
      errorCode: 'SUBSCRIBE_FAILED',
      errorDetail: process.env.NODE_ENV === 'production' ? undefined : error?.message,
    })
  }
})

router.post('/unsubscribe', authenticateOptional, async (req, res) => {
  const userId = req.user?.id || null
  const { endpoint } = req.body
  console.log(
    `[Push Route] unsubscribe POST user=${userId || 'anonymous'} endpoint_provided=${!!endpoint}`
  )
  try {
    let deletedCount = 0
    if (endpoint) {
      const result = await removeSubscription(endpoint)
      deletedCount = result?.count || 0
    } else if (userId) {
      const result = await prisma.pushSubscription.deleteMany({ where: { userId } })
      deletedCount = result.count
    } else {
      console.warn(`[Push Route] unsubscribe BLOCKED: no endpoint and no authenticated user`)
      return res.status(400).json({
        error: 'يجب توفير الـ endpoint أو تسجيل الدخول',
        errorCode: 'MISSING_IDENTIFIER',
      })
    }
    const remaining = userId
      ? await prisma.pushSubscription.count({ where: { userId } })
      : 0
    console.log(
      `[Push Route] unsubscribe SUCCESS user=${userId || 'anonymous'} deleted=${deletedCount} remaining=${remaining}`
    )
    res.json({
      success: true,
      message: 'تم إلغاء الاشتراك في الإشعارات',
      deletedCount,
      remaining,
    })
  } catch (error) {
    console.error('[Push Route] unsubscribe FAILED user=' + (userId || 'anonymous') + ':', error?.message || error)
    res.status(500).json({
      error: 'فشل إلغاء الاشتراك في الإشعارات',
      errorCode: 'UNSUBSCRIBE_FAILED',
    })
  }
})

router.get('/status', authenticate, async (req, res) => {
  const userId = req.user.id
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, createdAt: true, deviceType: true },
  })
  const vapidAvailable = hasVapidKeys()
  res.json({
    userId,
    vapidAvailable,
    subscriptions: subs,
    count: subs.length,
  })
})

export default router
