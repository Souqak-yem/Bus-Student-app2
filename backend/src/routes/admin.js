import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { hashPassword, generateTemporaryPassword } from '../services/authService.js'
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

function normalizeWhatsAppUrl(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('00') ? digits.slice(2) : digits.startsWith('0') ? `966${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}

router.get('/password-reset-requests', async (req, res) => {
  try {
    const requests = await prisma.auditLog.findMany({
      where: { action: 'PASSWORD_RESET_REQUEST', entityType: 'PASSWORD_RESET_REQUEST' },
      orderBy: { createdAt: 'desc' },
    })

    const payload = await Promise.all(requests.map(async (request) => {
      const data = request.newValue || {}
      const user = data.username ? await prisma.user.findUnique({ where: { username: data.username }, include: { student: true } }) : null
      const usernameExists = Boolean(user)
      const phoneMatches = !!(user && user.phone && String(user.phone).replace(/\D/g, '') === String(data.phone || '').replace(/\D/g, ''))
      const parentMatches = !!(user && user.student && String(user.student.parentName || '').trim().localeCompare(String(data.parentName || '').trim(), undefined, { sensitivity: 'base' }) === 0)
      const whatsappLink = normalizeWhatsAppUrl(user?.phone || user?.student?.whatsapp || data.phone)

      return {
        id: request.id,
        status: data.status || 'PENDING',
        username: data.username || '',
        phone: data.phone || '',
        parentName: data.parentName || '',
        studentName: data.studentName || '',
        requestedAt: data.requestedAt,
        userExists: usernameExists,
        phoneMatches,
        parentMatches,
        whatsappLink,
      }
    }))

    res.json(payload)
  } catch (error) {
    console.error('PASSWORD_RESET_REQUESTS_ERROR:', error)
    res.status(500).json({ error: 'فشل جلب طلبات استعادة كلمة المرور' })
  }
})

router.post('/password-reset-requests/:id/approve', async (req, res) => {
  try {
    const request = await prisma.auditLog.findUnique({ where: { id: req.params.id } })
    if (!request || request.action !== 'PASSWORD_RESET_REQUEST' || request.entityType !== 'PASSWORD_RESET_REQUEST') {
      return res.status(404).json({ error: 'طلب استعادة كلمة المرور غير موجود' })
    }

    const payload = request.newValue || {}
    const user = await prisma.user.findUnique({ where: { username: payload.username }, include: { student: true } })
    if (!user || user.role !== 'student') {
      return res.status(404).json({ error: 'حساب الطالب غير موجود' })
    }

    const tempPassword = generateTemporaryPassword()
    const hashed = await hashPassword(tempPassword)

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: true, failedAttempts: 0, lockedUntil: null },
    })

    const whatsappLink = normalizeWhatsAppUrl(user.phone || user.student?.whatsapp || payload.phone)
    const message = `مرحبا ${user.username}، هذه كلمة المرور المؤقتة لتسجيل دخولك: ${tempPassword}. يرجى تغيير كلمة المرور بعد تسجيل الدخول.`

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PASSWORD_RESET_REQUEST_APPROVED',
        entityType: 'PASSWORD_RESET_REQUEST',
        entityId: req.params.id,
        newValue: {
          requestId: req.params.id,
          username: user.username,
          tempPassword,
          status: 'APPROVED',
          approvedBy: req.user.id,
          whatsappLink,
          sentMessage: message,
        },
        reason: 'PASSWORD_RESET_APPROVED',
      },
    })

    await prisma.auditLog.update({
      where: { id: req.params.id },
      data: { newValue: { ...payload, status: 'APPROVED', approvedBy: req.user.id } },
    })

    res.json({
      approved: true,
      username: user.username,
      temporaryPassword: tempPassword,
      whatsappLink,
      message,
    })
  } catch (error) {
    console.error('PASSWORD_RESET_APPROVE_ERROR:', error)
    res.status(500).json({ error: 'فشل الموافقة على طلب استعادة كلمة المرور' })
  }
})

router.post('/password-reset-requests/:id/reject', async (req, res) => {
  try {
    const request = await prisma.auditLog.findUnique({ where: { id: req.params.id } })
    if (!request || request.action !== 'PASSWORD_RESET_REQUEST' || request.entityType !== 'PASSWORD_RESET_REQUEST') {
      return res.status(404).json({ error: 'طلب استعادة كلمة المرور غير موجود' })
    }

    const payload = request.newValue || {}
    const whatsappLink = normalizeWhatsAppUrl(payload.phone)
    const reason = String(req.body.reason || 'البيانات التي أدخلتها غير صحيحة').trim() || 'البيانات التي أدخلتها غير صحيحة'
    const message = `تم رفض طلب استعادة كلمة المرور لاسم المستخدم ${payload.username}. السبب: ${reason}. يرجى التأكد من صحة البيانات عبر واتساب ثم إعادة المحاولة.`

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'PASSWORD_RESET_REQUEST_REJECTED',
        entityType: 'PASSWORD_RESET_REQUEST',
        entityId: req.params.id,
        newValue: {
          requestId: req.params.id,
          username: payload.username,
          status: 'REJECTED',
          reason,
          whatsappLink,
          sentMessage: message,
        },
        reason: 'PASSWORD_RESET_REJECTED',
      },
    })

    await prisma.auditLog.update({
      where: { id: req.params.id },
      data: { newValue: { ...payload, status: 'REJECTED', reason } },
    })

    res.json({
      rejected: true,
      username: payload.username,
      whatsappLink,
      message,
    })
  } catch (error) {
    console.error('PASSWORD_RESET_REJECT_ERROR:', error)
    res.status(500).json({ error: 'فشل رفض طلب استعادة كلمة المرور' })
  }
})

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
