import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getTodayOperation, addStudentToOperation } from '../services/operationService.js'
import { reactivateStudent, reconcileSubscriptionPayments } from '../services/financialService.js'
import { createSubscriptionNotification, isSubscriptionActiveForDate, parseSubscriptionNotes, getExecutionDates } from '../services/subscriptionService.js'
import { canStudentOperateOnDate } from '../services/studentService.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { broadcastDailyExceptionsUpdate } from '../services/socketService.js'

const router = Router()
router.use(authenticate)

router.get('/', authorize('admin'), async (req, res) => {
  try {
    const enrollments = await prisma.campaignEnrollment.findMany({
      where: { receiptStatus: 'PENDING' },
      include: {
        campaign: { select: { id: true, title: true, name: true, type: true, startDate: true, endDate: true } },
        student: { select: { id: true, name: true, user: { select: { id: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const dailySubscriptions = await prisma.subscription.findMany({
      where: { notes: { contains: 'daily_request' }, status: 'pending' },
      include: { student: { select: { id: true, name: true, zone: true, user: { select: { id: true } }, offDays: true, destination: { select: { name: true } } } },
        payments: { orderBy: { date: 'desc' } },
        executionDates: { orderBy: { executionDate: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const dailyHistory = await prisma.subscription.findMany({
      where: { notes: { contains: 'daily_request' }, status: { not: 'pending' } },
      include: { student: { select: { id: true, name: true } },
        executionDates: { orderBy: { executionDate: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    const campaignHistory = await prisma.campaignEnrollment.findMany({
      where: { receiptStatus: { not: 'PENDING' } },
      include: {
        campaign: { select: { id: true, title: true, name: true, type: true, startDate: true, endDate: true } },
        student: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    res.json({ enrollments, dailySubscriptions, dailyHistory, campaignHistory })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscriptions/:id/approve', authorize('admin'), async (req, res) => {
  try {
    const subId = req.params.id
    const subscription = await prisma.subscription.findUnique({
      where: { id: subId },
      include: { student: true, executionDates: { orderBy: { executionDate: 'asc' } } },
    })
    if (!subscription) return res.status(404).json({ error: 'الاشتراك غير موجود' })
    if (subscription.type !== 'DAILY') return res.status(400).json({ error: 'هذا الإجراء خاص بالاشتراكات اليومية' })
    if (subscription.status !== 'pending') return res.status(400).json({ error: 'هذا الطلب غير قابل للموافقة' })

    const today = getLocalDate()

    const execDates = subscription.executionDates
    if (!execDates || execDates.length === 0) {
      return res.status(400).json({ error: 'لا توجد تواريخ تنفيذ لهذا الاشتراك' })
    }

    const firstDate = getLocalDate(execDates[0].executionDate)
    const lastDate = getLocalDate(execDates[execDates.length - 1].executionDate)

    // Check if student is suspended due to non-payment
    const finRecord = await prisma.studentFinancial.findUnique({
      where: { studentId: subscription.studentId },
    })
    if (finRecord?.isSuspended && finRecord.suspensionReason === null) {
      const { resolveSuspension } = req.body
      if (!resolveSuspension) {
        return res.json({
          needsSuspensionResolution: true,
          studentId: subscription.studentId,
          studentName: subscription.student.name,
        })
      }
      if (resolveSuspension === 'reactivate') {
        await reactivateStudent(subscription.studentId, req.user.id)
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: subId },
      data: {
        status: 'active',
        startDate: firstDate,
        endDate: lastDate,
        executionDate: null,
      },
    })

    const existingPayment = await prisma.payment.findFirst({ where: { subscriptionId: updated.id } })
    if (!existingPayment && Number(updated.amount || 0) > 0) {
      await prisma.payment.create({
        data: {
          subscriptionId: updated.id,
          amount: updated.amount,
          date: new Date(),
          method: 'transfer',
          reference: 'موافقة المشرف',
          notes: 'تمت الموافقة على اشتراك يومي',
        },
      })
    }

    await reconcileSubscriptionPayments(updated.id)

    const todayStr = today.getTime()
    const hasTodayExecDate = execDates.some(ed => getLocalDate(ed.executionDate).getTime() === todayStr)

    // Auto-add via BusStudent + offer canAddNow shortcut for unassigned students
    let canAddNow = false
    let buses = []
    if (hasTodayExecDate) {
      const canOperate = await canStudentOperateOnDate(updated.studentId, today)
      if (canOperate) {
        const existing = await prisma.assignment.findUnique({
          where: { studentId_date_period: { studentId: updated.studentId, date: today, period: 'MORNING' } },
        })
        if (!existing) {
          // Student has a permanent bus → auto-add silently
          const busStudent = await prisma.busStudent.findFirst({
            where: { studentId: updated.studentId, isActive: true },
          })
          if (busStudent) {
            try {
              await addStudentToOperation(busStudent.busId, updated.studentId, req.user.id)
            } catch (addErr) { /* best-effort */ }
          }

          // If still unassigned (no BusStudent or add failed), offer shortcut
          const stillUnassigned = await prisma.assignment.findUnique({
            where: { studentId_date_period: { studentId: updated.studentId, date: today, period: 'MORNING' } },
          })
          if (!stillUnassigned) {
            const op = await getTodayOperation()
            if (op?.exists) {
              canAddNow = true
              buses = op.buses.map(b => ({ id: b.bus.id, busNumber: b.bus.busNumber, driver: b.driver, capacity: b.bus.capacity }))
            }
          }
        }
      }
    }

    try {
      const user = await prisma.user.findUnique({ where: { studentId: updated.studentId } })
      if (user?.id) {
        await createSubscriptionNotification(user.id, 'subscription_approved', 'تم قبول الاشتراك', 'تمت الموافقة على اشتراكك', { subscriptionId: updated.id })
      }
    } catch (notifErr) {
      console.error('Notification failed (non-critical):', notifErr)
    }

    broadcastDailyExceptionsUpdate({ type: 'subscription_approved', timestamp: new Date().toISOString() })

    res.json({ subscription: { ...updated, executionDates: execDates }, canAddNow, buses })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscriptions/:id/reject', authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body
    const subId = req.params.id
    const subscription = await prisma.subscription.findUnique({ where: { id: subId }, include: { student: true } })
    if (!subscription) return res.status(404).json({ error: 'الاشتراك غير موجود' })

    if (subscription.type !== 'DAILY') return res.status(400).json({ error: 'هذا الإجراء خاص بالاشتراكات اليومية' })
    if (subscription.status !== 'pending') return res.status(400).json({ error: 'هذا الطلب غير قابل للرفض' })

    const updated = await prisma.subscription.update({ where: { id: subId }, data: { status: 'rejected' } })

    try {
      const user = await prisma.user.findUnique({ where: { studentId: updated.studentId } })
      if (user?.id) {
        await createSubscriptionNotification(user.id, 'subscription_rejected', 'تم رفض الاشتراك', `تم رفض اشتراكك${reason ? ` (السبب: ${reason})` : ''}`, { subscriptionId: updated.id })
      }
    } catch (notifErr) {
      console.error('Notification failed (non-critical):', notifErr)
    }

    res.json({ subscription: updated })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscriptions/:id/add-now', authorize('admin'), async (req, res) => {
  try {
    const subId = req.params.id
    const { busId } = req.body
    if (!busId) return res.status(400).json({ error: 'الحافلة الهدف مطلوبة' })

    const sub = await prisma.subscription.findUnique({ where: { id: subId } })
    if (!sub) return res.status(404).json({ error: 'الاشتراك غير موجود' })
    if (sub.type !== 'DAILY') return res.status(400).json({ error: 'هذا الإجراء خاص بالاشتراكات اليومية' })
    if (sub.status !== 'active') return res.status(400).json({ error: 'الاشتراك غير مفعل.' })

    const today = getLocalDate()
    const start = getLocalDate(sub.startDate)
    const end = getLocalDate(sub.endDate)
    if (start > today || today > end) return res.status(400).json({ error: 'الاشتراك غير صالح لتاريخ اليوم.' })
    if (!isSubscriptionActiveForDate(sub, today)) return res.status(400).json({ error: 'الاشتراك غير صالح لهذا اليوم.' })

    const canOperate = await canStudentOperateOnDate(sub.studentId, today)
    if (!canOperate) {
      return res.status(400).json({ error: 'الطالب لا يمكنه التشغيل اليوم' })
    }

    // Delegate to operation service which enforces duplicates, capacity and operation existence
    const assignment = await addStudentToOperation(busId, sub.studentId, req.user.id)
    res.status(201).json({ assignment })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
