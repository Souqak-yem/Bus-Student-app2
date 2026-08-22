import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { createAuditLog } from '../lib/audit.js'
import { createAndBroadcast } from '../services/notificationService.js'

const router = Router()
router.use(authenticate)

function parseCampaignDateTime(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const offsetMinutes = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES ?? 180)
    const sign = offsetMinutes >= 0 ? '+' : '-'
    const absoluteMinutes = Math.abs(offsetMinutes)
    const offset = `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')}:${String(absoluteMinutes % 60).padStart(2, '0')}`
    return new Date(`${value}:00${offset}`)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

router.get('/', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        enrollments: {
          where: { receiptStatus: 'APPROVED' },
          select: { id: true },
        },
      },
    })
    const result = campaigns.map((campaign) => ({
      ...campaign,
      approvedEnrollmentsCount: campaign.enrollments.length,
    }))
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/active', async (req, res) => {
  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const campaigns = await prisma.campaign.findMany({
      where: { status: 'ACTIVE', isActive: true, endDate: { gte: today } },
      orderBy: { startDate: 'asc' },
    })
    res.json(campaigns)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { title, description, type, startDate, endDate, discountPercent, maxStudents, hasEarlyDiscount, discountAmount, discountStart, discountExpiry, enableExtraRegistrationFee, extraRegistrationFee, extraFeeStart } = req.body
    if (!title || !type || !startDate || !endDate) return res.status(400).json({ error: 'الحقول مطلوبة' })

    // validate discountPercent to avoid DB numeric overflow
    let validatedDiscountPercent = null
    if (discountPercent !== undefined && discountPercent !== null && discountPercent !== '') {
      const parsed = parseFloat(discountPercent)
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
        return res.status(400).json({ error: 'قيمة discountPercent يجب أن تكون رقماً بين 0 و 100' })
      }
      validatedDiscountPercent = parsed
    }

    const campaign = await prisma.campaign.create({
      data: {
        title,
        description,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        discountPercent: validatedDiscountPercent,
        maxStudents: maxStudents || null,
        hasEarlyDiscount: hasEarlyDiscount === true,
        discountAmount: hasEarlyDiscount && discountAmount ? parseFloat(discountAmount) : 0,
        discountStart: hasEarlyDiscount && discountStart ? parseCampaignDateTime(discountStart) : null,
        discountExpiry: hasEarlyDiscount && discountExpiry ? parseCampaignDateTime(discountExpiry) : null,
        enableExtraRegistrationFee: enableExtraRegistrationFee === true,
        extraRegistrationFee: enableExtraRegistrationFee && extraRegistrationFee ? parseFloat(extraRegistrationFee) : 2000,
        extraFeeStart: enableExtraRegistrationFee && extraFeeStart ? parseCampaignDateTime(extraFeeStart) : null,
      },
    })
    try {
      const studentUsers = await prisma.user.findMany({ where: { role: 'student' }, select: { id: true } })
      const typeLabel = type === 'subscription_3weeks' ? '٣ أسابيع' : type === 'subscription_4weeks' ? '٤ أسابيع' : type
      for (const student of studentUsers) {
        await createAndBroadcast({
          userId: student.id,
          type: 'info',
          title: 'حملة اشتراك جديدة',
          message: `تم فتح حملة "${title}" باشتراك ${typeLabel}`,
          targetRoute: '/student/subscriptions/weekly',
          dedupKey: `new_campaign_${campaign.id}`,
        })
      }
    } catch (notifErr) {
      console.error('Campaign notification failed (non-critical):', notifErr)
    }

    await createAuditLog({ userId: req.user.id, action: 'CREATE', entityType: 'Campaign', entityId: campaign.id, newValue: { title, type, startDate, endDate } })

    res.status(201).json(campaign)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'الحملة غير موجودة' })
    const { title, description, type, startDate, endDate, discountPercent, maxStudents, status, hasEarlyDiscount, discountAmount, discountStart, discountExpiry, enableExtraRegistrationFee, extraRegistrationFee, extraFeeStart } = req.body

    // validate discountPercent on update as well
    let validatedDiscountPercentUpdate = undefined
    if (discountPercent !== undefined) {
      if (discountPercent === null || discountPercent === '') {
        validatedDiscountPercentUpdate = null
      } else {
        const parsed = parseFloat(discountPercent)
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
          return res.status(400).json({ error: 'قيمة discountPercent يجب أن تكون رقماً بين 0 و 100' })
        }
        validatedDiscountPercentUpdate = parsed
      }
    }

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        type: type !== undefined ? type : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        discountPercent: validatedDiscountPercentUpdate,
        maxStudents: maxStudents !== undefined ? maxStudents : undefined,
        status: status !== undefined ? status : undefined,
        hasEarlyDiscount: hasEarlyDiscount !== undefined ? hasEarlyDiscount === true : undefined,
        discountAmount: hasEarlyDiscount !== undefined ? (hasEarlyDiscount && discountAmount ? parseFloat(discountAmount) : 0) : undefined,
        discountStart: hasEarlyDiscount !== undefined ? (hasEarlyDiscount && discountStart ? parseCampaignDateTime(discountStart) : null) : undefined,
        discountExpiry: hasEarlyDiscount !== undefined ? (hasEarlyDiscount && discountExpiry ? parseCampaignDateTime(discountExpiry) : null) : undefined,
        enableExtraRegistrationFee: enableExtraRegistrationFee !== undefined ? enableExtraRegistrationFee === true : undefined,
        extraRegistrationFee: enableExtraRegistrationFee !== undefined ? (enableExtraRegistrationFee && extraRegistrationFee ? parseFloat(extraRegistrationFee) : 2000) : undefined,
        extraFeeStart: enableExtraRegistrationFee !== undefined ? (enableExtraRegistrationFee && extraFeeStart ? parseCampaignDateTime(extraFeeStart) : null) : undefined,
      },
    })
    await createAuditLog({ userId: req.user.id, action: 'UPDATE', entityType: 'Campaign', entityId: campaign.id, oldValue: { status: existing.status }, newValue: { status: campaign.status } })
    res.json(campaign)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'الحملة غير موجودة' })
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const linkedEnrollments = await prisma.campaignEnrollment.count({ where: { campaignId: req.params.id } })
    if (linkedEnrollments > 0) {
      return res.status(400).json({ error: 'لا يمكن حذف الحملة لأن هناك طلبات مرتبطة بها' })
    }

    await prisma.campaign.delete({ where: { id: req.params.id } })
    await createAuditLog({ userId: req.user.id, action: 'DELETE', entityType: 'Campaign', entityId: req.params.id })
    res.json({ message: 'تم حذف الحملة' })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'الحملة غير موجودة' })
    res.status(500).json({ error: error.message })
  }
})

export default router
