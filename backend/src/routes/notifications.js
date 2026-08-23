import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import * as notificationService from '../services/notificationService.js'
import { checkAndNotifyUnassignedDailySubscriptions } from '../services/dailyExceptionsService.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
router.use(authenticate)

router.post('/check-unassigned-daily', authorize('admin'), async (req, res) => {
  try {
    const summary = await checkAndNotifyUnassignedDailySubscriptions(req.user.id)
    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const { filter, priority, limit, offset } = req.query
    const result = await notificationService.listNotifications(req.user.id, {
      filter,
      priority,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/unread-count', async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id)
    res.json({ count })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id)
    res.json(notification)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'الإشعار غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.patch('/read-all', async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id)
    res.json({ message: 'تمت قراءة جميع الإشعارات' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id)
    res.json({ message: 'تم حذف الإشعار' })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'الإشعار غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.delete('/', async (req, res) => {
  try {
    await notificationService.deleteAllNotifications(req.user.id)
    res.json({ message: 'تم حذف جميع الإشعارات' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/prefs', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { notificationPrefs: true, hasSeenNotificationPrompt: true },
    })
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.json({
      prefs: user.notificationPrefs || null,
      hasSeenNotificationPrompt: user.hasSeenNotificationPrompt || false,
    })
  } catch (error) {
    console.error('[Notifications] GET /prefs failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.put('/prefs', async (req, res) => {
  try {
    const { prefs } = req.body
    if (typeof prefs !== 'object' || prefs === null) {
      return res.status(400).json({ error: 'بيانات التفضيلات غير صالحة' })
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { notificationPrefs: prefs },
    })
    res.json({ message: 'تم حفظ تفضيلات الإشعارات', prefs })
  } catch (error) {
    console.error('[Notifications] PUT /prefs failed:', error)
    res.status(500).json({ error: error.message })
  }
})

router.patch('/prompt-seen', async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { hasSeenNotificationPrompt: true },
    })
    res.json({ message: 'تم تعليم ظهور طلب الإذن' })
  } catch (error) {
    console.error('[Notifications] PATCH /prompt-seen failed:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
