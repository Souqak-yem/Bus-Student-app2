import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import * as notificationService from '../services/notificationService.js'
import { checkAndNotifyUnassignedDailySubscriptions } from '../services/dailyExceptionsService.js'

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

export default router
