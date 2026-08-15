import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

export function canAccessSubscriptionRecord(user, subscription) {
  if (!user || !subscription) return false
  if (user.role === 'admin') return true
  if (user.role === 'student') return subscription.studentId === user.studentId
  return false
}

router.get('/', async (req, res) => {
  try {
    const { status, studentId, type } = req.query
    const where = {}

    if (req.user.role === 'student') {
      where.studentId = req.user.studentId
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى الاشتراكات' })
    }

    if (status) where.status = status
    if (studentId) where.studentId = studentId
    if (type) where.type = type

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, zone: true, phone: true } },
        payments: { orderBy: { date: 'desc' } },
        executionDates: { orderBy: { executionDate: 'asc' } },
      },
      orderBy: { startDate: 'desc' },
    })

    res.json(subscriptions)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: req.params.id },
      include: {
        student: true,
        payments: { orderBy: { date: 'desc' } },
        executionDates: { orderBy: { executionDate: 'asc' } },
      },
    })

    if (!sub) {
      return res.status(404).json({ error: 'الاشتراك غير موجود' })
    }

    if (!canAccessSubscriptionRecord(req.user, sub)) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا الاشتراك' })
    }

    res.json(sub)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
