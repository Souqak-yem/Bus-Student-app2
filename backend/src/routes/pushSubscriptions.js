import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { saveSubscription, removeSubscription, getVapidPublicKey, hasVapidKeys } from '../services/pushNotificationService.js'

const router = Router()

router.get('/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey()
  if (!key) {
    return res.status(501).json({ error: 'VAPID keys not configured', vapidAvailable: false })
  }
  res.json({ publicKey: key, vapidAvailable: true })
})

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription, deviceType, userAgent } = req.body
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'بيانات الاشتراك غير مكتملة' })
    }
    const result = await saveSubscription(req.user.id, subscription, deviceType, userAgent)
    res.json({ message: 'تم الاشتراك في الإشعارات', id: result.id })
  } catch (error) {
    console.error('[Push] subscribe failed:', error)
    res.status(500).json({ error: 'فشل الاشتراك في الإشعارات' })
  }
})

router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body
    if (endpoint) {
      await removeSubscription(endpoint)
    } else {
      const { prisma } = await import('../lib/prisma.js')
      await prisma.pushSubscription.deleteMany({ where: { userId: req.user.id } })
    }
    res.json({ message: 'تم إلغاء الاشتراك في الإشعارات' })
  } catch (error) {
    console.error('[Push] unsubscribe failed:', error)
    res.status(500).json({ error: 'فشل إلغاء الاشتراك في الإشعارات' })
  }
})

export default router
