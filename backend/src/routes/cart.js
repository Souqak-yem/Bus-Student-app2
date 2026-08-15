import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { hasActiveSameTypeSubscription } from '../services/subscriptionService.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { createAndBroadcast } from '../services/notificationService.js'
import { calculateFinalSubscriptionPrice } from '../services/pricingService.js'
import { assertDepositReferenceIsUnique } from '../services/depositReferenceService.js'

const router = Router()
router.use(authenticate)

async function resolveStudentId(user) {
  if (user.studentId) return user.studentId
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  return dbUser?.studentId
}

async function getOrCreateDraftCart(studentId) {
  let cart = await prisma.cart.findFirst({
    where: { studentId, status: 'DRAFT' },
    include: {
      items: {
        include: { zone: { select: { id: true, name: true } }, destination: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!cart) {
    cart = await prisma.cart.create({
      data: { studentId, totalAmount: 0 },
      include: {
        items: {
          include: { zone: { select: { id: true, name: true } }, destination: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  }
  return cart
}

async function recalcTotal(cartId) {
  const items = await prisma.cartItem.findMany({ where: { cartId }, select: { amount: true } })
  const total = items.reduce((sum, i) => sum + Number(i.amount), 0)
  await prisma.cart.update({ where: { id: cartId }, data: { totalAmount: total } })
  return total
}

router.post('/items', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { type, zoneId, destinationId, amount, homeDeliveryFee, data } = req.body

    if (!type || !amount || amount <= 0) {
      return res.status(400).json({ error: 'بيانات غير صالحة' })
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })

    const itemData = data || {}
    let conflict
    if (type === 'DAILY') {
      const dates = itemData.computedDates
        ? itemData.computedDates.map(d => new Date(d))
        : null
      conflict = await hasActiveSameTypeSubscription(studentId, type, { dates })
    } else {
      const weeksCount = itemData.weeksCount || (type === 'THREE_WEEKS' ? 3 : 4)
      const today = getLocalDate()
      const newStart = new Date(today)
      const newEnd = new Date(today)
      newEnd.setDate(newEnd.getDate() + weeksCount * 7 - 1)
      conflict = await hasActiveSameTypeSubscription(studentId, type, { startDate: newStart, endDate: newEnd })
    }
    if (conflict) {
      const msg = type === 'DAILY'
        ? 'لديك اشتراك يومي في أحد هذه الأيام، يرجى مراجعة التواريخ المختارة'
        : 'لديك اشتراك أسبوعي يتداخل مع فترة الاشتراك المطلوبة'
      return res.status(400).json({ error: msg })
    }

    let savedData = { ...itemData }
    if (type !== 'DAILY' && itemData.campaignId) {
      const [campaign, zonePricing] = await Promise.all([
        prisma.campaign.findUnique({ where: { id: itemData.campaignId } }),
        student.zone
          ? prisma.pricingArea.findUnique({
              where: { name: student.zone },
              include: { prices: { where: { destinationId: student.destinationId || null } } },
            })
          : null,
      ])
      if (campaign && zonePricing) {
        const calculated = await calculateFinalSubscriptionPrice(student, campaign, zonePricing)
        if (Math.abs(Number(calculated.finalAmount) - Number(amount)) > 1) {
          return res.status(400).json({ error: 'تغير السعر، يرجى تحديث الصفحة' })
        }
        savedData = {
          ...savedData,
          priceSnapshot: {
            basePrice: calculated.basePrice,
            discount: calculated.discount,
            additionalFee: calculated.extraFee.amount,
            feeType: calculated.extraFee.type,
            finalAmount: calculated.finalAmount,
          },
        }
      }
    }

    const cart = await getOrCreateDraftCart(studentId)

    const item = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        type,
        zoneId: zoneId || null,
        destinationId: destinationId || null,
        amount,
        homeDeliveryFee: homeDeliveryFee || null,
        data: savedData,
      },
      include: { zone: { select: { id: true, name: true } }, destination: { select: { id: true, name: true } } },
    })

    const total = await recalcTotal(cart.id)
    res.status(201).json({ item, cart: { ...cart, totalAmount: total } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/items/:itemId', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const item = await prisma.cartItem.findUnique({
      where: { id: req.params.itemId },
      include: { cart: { select: { studentId: true } } },
    })
    if (!item) return res.status(404).json({ error: 'العنصر غير موجود' })
    if (item.cart.studentId !== studentId) return res.status(403).json({ error: 'غير مصرح' })

    const cartId = item.cartId
    await prisma.cartItem.delete({ where: { id: req.params.itemId } })

    const remaining = await prisma.cartItem.count({ where: { cartId } })
    if (remaining === 0) {
      await prisma.cart.delete({ where: { id: cartId } })
      return res.json({ cart: null })
    }

    const total = await recalcTotal(cartId)
    res.json({ cart: { id: cartId, totalAmount: total } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.json({ cart: null })

    const cart = await prisma.cart.findFirst({
      where: { studentId, status: 'DRAFT' },
      include: {
        items: {
          include: { zone: { select: { id: true, name: true } }, destination: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    res.json({ cart })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/submit', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { receiptImage, depositReference } = req.body

    const cart = await prisma.cart.findFirst({
      where: { studentId, status: 'DRAFT' },
      include: { items: true },
    })
    if (!cart) return res.status(400).json({ error: 'السلة فارغة' })
    if (cart.items.length === 0) return res.status(400).json({ error: 'السلة فارغة' })
    if (!receiptImage) return res.status(400).json({ error: 'يرجى رفع صورة سند التحويل' })
    if (!depositReference || !String(depositReference).trim()) return res.status(400).json({ error: 'يرجى إدخال رقم الإيداع أو المرجع' })

    try {
      await assertDepositReferenceIsUnique(depositReference, prisma)
    } catch (err) {
      return res.status(409).json({ error: err.message })
    }

    const updated = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        status: 'PENDING',
        receiptImage,
        depositReference: String(depositReference).trim(),
        submittedAt: new Date(),
      },
    })

    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })
    for (const admin of admins) {
      await createAndBroadcast({
        userId: admin.id,
        type: 'cart_submitted',
        title: 'طلب سلة اشتراكات',
        message: `طلب سلة اشتراكات بقيمة ${Number(updated.totalAmount).toLocaleString()} ريال`,
        dedupKey: `cart_submitted_${admin.id}_${cart.id}`,
      })
    }

    res.status(201).json({ cart: updated })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
