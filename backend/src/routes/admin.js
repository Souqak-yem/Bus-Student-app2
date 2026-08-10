import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  resetOperations,
  resetSubscriptions,
  resetNotifications,
  resetLogs,
  resetSystemFull,
  seedDemoData,
} from '../services/resetService.js'

const router = Router()

router.use(authenticate)
router.use(authorize('admin'))

router.post('/reset-data', async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
    })

    if (!admins.length) {
      return res.status(500).json({ error: 'لا يوجد حساب أدمن! تم إحباط العملية.' })
    }

    const admin = admins[0]

    // Preserve system configuration tables: destinations, pricing areas, and pricing rows.
    await prisma.emergencyReport.deleteMany()
    await prisma.emergencyLog.deleteMany()
    await prisma.busLoad.deleteMany()
    await prisma.returnQueue.deleteMany()
    await prisma.saturdayBusLoad.deleteMany()
    await prisma.saturdayBoardingTimer.deleteMany()
    await prisma.saturdayAssignment.deleteMany()
    await prisma.saturdayReturnQueue.deleteMany()
    await prisma.saturdayActiveBus.deleteMany()
    await prisma.saturdayOperation.deleteMany()
    await prisma.activeBus.deleteMany()
    await prisma.dailyOperation.deleteMany()
    await prisma.dailyExecutionDate.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.subscription.deleteMany()
    await prisma.attendance.deleteMany()
    await prisma.assignment.deleteMany()
    await prisma.studentTransfer.deleteMany()
    await prisma.busStudentOrder.deleteMany()
    await prisma.busStudent.deleteMany()
    await prisma.campaignEnrollment.deleteMany()
    await prisma.campaign.deleteMany()
    await prisma.weeklySheetVersion.deleteMany()
    await prisma.weeklySheetStudent.deleteMany()
    await prisma.weeklySheet.deleteMany()
    await prisma.studentFinancial.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.student.deleteMany()
    await prisma.bus.deleteMany()
    await prisma.user.deleteMany({ where: { role: { not: 'admin' } } })

    if (admins.length > 1) {
      await prisma.user.deleteMany({
        where: { role: 'admin', id: { not: admin.id } },
      })
    }

    await prisma.user.update({
      where: { id: admin.id },
      data: { status: 'active', failedAttempts: 0, lockedUntil: null },
    })

    res.json({ success: true, message: 'تم مسح جميع البيانات بنجاح' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'فشلت عملية مسح البيانات' })
  }
})

router.post('/reset-operations', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    await resetOperations(req.user.id, ip)
    res.json({ success: true, message: 'تم إعادة تهيئة بيانات التشغيل اليومية بنجاح' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'فشلت عملية إعادة التهيئة' })
  }
})

router.post('/reset-subscriptions', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    await resetSubscriptions(req.user.id, ip)
    res.json({ success: true, message: 'تم إعادة تعيين بيانات الاشتراكات بنجاح' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'فشلت عملية إعادة تعيين الاشتراكات' })
  }
})

router.post('/reset-notifications', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const count = await resetNotifications(req.user.id, ip)
    res.json({ success: true, message: `تم حذف ${count} إشعار بنجاح` })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'فشلت عملية حذف الإشعارات' })
  }
})

router.post('/reset-logs', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    await resetLogs(req.user.id, ip)
    res.json({ success: true, message: 'تم إعادة ضبط السجلات بنجاح' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'فشلت عملية إعادة ضبط السجلات' })
  }
})

router.post('/reset-system', async (req, res) => {
  try {
    const confirm = req.body.confirm
    const expected = req.body.lang === 'ar' ? 'إعادة ضبط النظام' : 'RESET'
    if (confirm !== expected) {
      return res.status(400).json({ error: `تأكيد إعادة الضبط غير صحيح. اكتب "${expected}" للتأكيد.` })
    }

    const admins = await prisma.user.findMany({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
    })
    if (!admins.length) {
      return res.status(500).json({ error: 'لا يوجد حساب أدمن! تم إحباط العملية.' })
    }

    const admin = admins[0]
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    await resetSystemFull(req.user.id, ip, admin.id)

    await prisma.user.update({
      where: { id: admin.id },
      data: { status: 'active', failedAttempts: 0, lockedUntil: null },
    })

    res.json({ success: true, message: 'تم إعادة ضبط النظام بالكامل بنجاح' })
  } catch (err) {
    console.error('reset-system error:', err.stack || err)
    res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'فشلت عملية إعادة ضبط النظام' : (err.message || 'فشلت عملية إعادة ضبط النظام') })
  }
})

router.post('/seed-demo', async (req, res) => {
  try {
    const result = await seedDemoData(req.user.id)
    res.json({
      success: true,
      message: 'تم إنشاء البيانات التجريبية بنجاح',
      data: result,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'فشلت عملية إنشاء البيانات التجريبية' })
  }
})

export default router
