import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { createSubscriptionNotification } from '../services/subscriptionService.js'
import { createAndBroadcast } from '../services/notificationService.js'
import { calculateFinalSubscriptionPrice } from '../services/pricingService.js'
import { assertDepositReferenceIsUnique } from '../services/depositReferenceService.js'

const router = Router()
router.use(authenticate)

function resolveStudentId(user) {
  if (user.studentId) return user.studentId
  return null
}

router.get('/', async (req, res) => {
  try {
    const { campaignId, studentId, receiptStatus } = req.query
    const where = {}
    if (campaignId) where.campaignId = campaignId
    if (studentId) where.studentId = studentId
    if (receiptStatus) where.receiptStatus = receiptStatus
    if (req.user.role === 'student') {
      const sid = resolveStudentId(req.user)
      if (sid) where.studentId = sid
    }
    const enrollments = await prisma.campaignEnrollment.findMany({
      where,
      include: {
        campaign: { select: { id: true, name: true, title: true, type: true, startDate: true, endDate: true, enableExtraRegistrationFee: true, extraRegistrationFee: true } },
        student: { select: { id: true, name: true, zone: true, transportMode: true } },
        area: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(enrollments)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    let { campaignId, studentId, areaId, baseAmount, surcharge, discount, finalAmount, receiptImage, depositReference } = req.body
    if (!campaignId || !studentId || baseAmount == null || finalAmount == null) {
      return res.status(400).json({ error: 'البيانات غير كاملة' })
    }
    if (!receiptImage) return res.status(400).json({ error: 'يرجى رفع صورة سند التحويل' })
    if (!depositReference || !String(depositReference).trim()) return res.status(400).json({ error: 'يرجى إدخال رقم الإيداع أو المرجع' })
    try {
      await assertDepositReferenceIsUnique(depositReference, prisma)
    } catch (err) {
      return res.status(409).json({ error: err.message })
    }
    if (req.user.role === 'student') {
      const sid = resolveStudentId(req.user)
      if (!sid || sid !== studentId) return res.status(403).json({ error: 'غير مصرح' })
    }

    const [campaign, student] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.student.findUnique({ where: { id: studentId } }),
    ])
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })

    const zonePricing = student.zone
      ? await prisma.pricingArea.findUnique({
          where: { name: student.zone },
          include: { prices: { where: { destinationId: null } } },
        })
      : null

    const calculated = await calculateFinalSubscriptionPrice(student, campaign, zonePricing)
    const extraFee = { type: calculated.extraFee.type, amount: calculated.extraFee.amount, label: calculated.extraFee.label }

    const existingEnrollments = await prisma.campaignEnrollment.findMany({
      where: { campaignId, studentId },
      orderBy: { createdAt: 'desc' },
    })

    if (existingEnrollments.length > 0) {
      const latest = existingEnrollments[0]
      if (latest.receiptStatus === 'PENDING') {
        return res.status(400).json({ error: 'يوجد طلب قيد المراجعة بالفعل لهذا الاشتراك' })
      }
      if (latest.receiptStatus === 'APPROVED') {
        return res.status(400).json({ error: 'تمت الموافقة على طلب سابق لهذا الاشتراك' })
      }
    }

    const enrollment = await prisma.campaignEnrollment.create({
      data: {
        campaignId, studentId, areaId: areaId || null,
        baseAmount, surcharge: surcharge || 0, discount: discount || 0,
        extraFeeType: extraFee.type,
        extraFeeAmount: extraFee.amount || null,
        finalAmount,
        receiptImage: receiptImage || null,
        depositReference: String(depositReference).trim(),
      },
      include: {
        campaign: { select: { name: true, title: true } },
        student: { select: { name: true, id: true } },
      },
    })

    try {
      const studentUser = await prisma.user.findUnique({ where: { studentId: enrollment.studentId }, select: { id: true } })
      if (studentUser?.id) {
        await createSubscriptionNotification(
          studentUser.id,
          'student_subscription_requested',
          'تم إرسال طلب الاشتراك',
          `تم إرسال طلب اشتراكك في حملة "${enrollment.campaign.title}" بنجاح`,
          { enrollmentId: enrollment.id }
        )
      }

      const adminUsers = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })
      if (adminUsers.length > 0) {
        for (const admin of adminUsers) {
          await createAndBroadcast({
            userId: admin.id,
            type: 'subscription_request',
            title: 'طلب اشتراك جديد',
            message: `طلب اشتراك في حملة "${enrollment.campaign.title}" من ${enrollment.student.name}`,
            dedupKey: `subscription_request_${admin.id}_${enrollment.id}`,
          })
        }
      }
    } catch (notifErr) {
      console.error('Enrollment notification failed (non-critical):', notifErr)
    }

    res.status(201).json(enrollment)
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'الطالب مسجل بالفعل في هذه الحملة' })
    res.status(500).json({ error: error.message })
  }
})

router.patch('/:id/approve', authorize('admin'), async (req, res) => {
  try {
    let enrollment
    await prisma.$transaction(async (tx) => {
      enrollment = await tx.campaignEnrollment.update({
        where: { id: req.params.id },
        data: { receiptStatus: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
        include: {
          student: { select: { id: true, name: true, user: { select: { id: true } } } },
          campaign: { select: { name: true, title: true, type: true, startDate: true, endDate: true, enableExtraRegistrationFee: true, extraRegistrationFee: true } },
        },
      })

      if (enrollment.campaign.type === 'subscription_3weeks' || enrollment.campaign.type === 'subscription_4weeks') {
        const subType = enrollment.campaign.type === 'subscription_3weeks' ? 'THREE_WEEKS' : 'FOUR_WEEKS'
        let notes = `اشتراك عبر حملة: ${enrollment.campaign.title}`
        if (enrollment.extraFeeType && enrollment.extraFeeAmount) {
          notes += ` | ${enrollment.extraFeeType === 'NEW_STUDENT' ? 'رسوم طالب جديد' : 'رسوم طالب متأخر'}: ${Number(enrollment.extraFeeAmount).toLocaleString()} ريال`
        }
        const sub = await tx.subscription.create({
          data: {
            studentId: enrollment.studentId,
            type: subType,
            startDate: enrollment.campaign.startDate,
            endDate: enrollment.campaign.endDate,
            amount: enrollment.finalAmount,
            paidAmount: enrollment.finalAmount,
            paymentStatus: 'paid',
            status: 'active',
            homeDeliveryFee: enrollment.surcharge > 0 ? enrollment.surcharge : null,
            notes,
          },
        })
        await tx.payment.create({
          data: {
            subscriptionId: sub.id,
            amount: enrollment.finalAmount,
            date: new Date(),
            method: 'transfer',
            reference: enrollment.depositReference || enrollment.receiptImage || 'غير محدد',
            notes: enrollment.receiptImage || 'موافقة على الاشتراك',
          },
        })
      }
    })

    try {
      if (enrollment.student.user?.id) {
        await createSubscriptionNotification(
          enrollment.student.user.id,
          'subscription_approved',
          'تم قبول الاشتراك',
          `تمت الموافقة على طلب اشتراكك في حملة "${enrollment.campaign.title}"`,
          { enrollmentId: enrollment.id }
        )
      }
    } catch (notifErr) {
      console.error('Notification failed (non-critical):', notifErr)
    }

    res.json(enrollment)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'التسجيل غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.patch('/:id/reject', authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body
    const enrollment = await prisma.campaignEnrollment.update({
      where: { id: req.params.id },
      data: { receiptStatus: 'REJECTED', rejectionReason: reason || null },
      include: {
        student: { select: { id: true, name: true, user: { select: { id: true } } } },
        campaign: { select: { title: true } },
      },
    })

    try {
      if (enrollment.student.user?.id) {
        await createSubscriptionNotification(
          enrollment.student.user.id,
          'subscription_rejected',
          'تم رفض الاشتراك',
          `تم رفض طلب اشتراكك في حملة "${enrollment.campaign.title}"${reason ? ` (السبب: ${reason})` : ''}`,
          { enrollmentId: enrollment.id }
        )
      }
    } catch (notifErr) {
      console.error('Notification failed (non-critical):', notifErr)
    }

    res.json(enrollment)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'التسجيل غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await prisma.campaignEnrollment.delete({ where: { id: req.params.id } })
    res.json({ message: 'تم حذف التسجيل' })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'التسجيل غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

export default router
