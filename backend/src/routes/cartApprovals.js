import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { createSubscriptionNotification, setExecutionDates, hasActiveSameTypeSubscription } from '../services/subscriptionService.js'
import { reactivateStudent, reconcileSubscriptionPayments } from '../services/financialService.js'
import { getLocalDate, resolveDailyExecutionDates } from '../utils/dateUtils.js'
import { broadcastDailyExceptionsUpdate } from '../services/socketService.js'
import { createAndBroadcast } from '../services/notificationService.js'
import { assertDepositReferenceIsUnique } from '../services/depositReferenceService.js'

const router = Router()
router.use(authenticate)

router.get('/', authorize('admin'), async (req, res) => {
  try {
    const carts = await prisma.cart.findMany({
      where: { status: 'PENDING' },
      include: {
        student: { select: { id: true, name: true, zone: true, phone: true } },
        items: {
          include: { zone: { select: { id: true, name: true } }, destination: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })

    const dailyCarts = carts.filter(c => c.items.every(item => item.type === 'DAILY'))
    const weeklyCarts = carts.filter(c => c.items.every(item => item.type !== 'DAILY'))
    const mixedCarts = carts.filter(c => {
      const hasDaily = c.items.some(item => item.type === 'DAILY')
      const hasWeekly = c.items.some(item => item.type !== 'DAILY')
      return hasDaily && hasWeekly
    })

    const history = await prisma.cart.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED'] } },
      include: {
        student: { select: { id: true, name: true } },
        approvedBy: { select: { name: true } },
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })

    res.json({ dailyCarts, weeklyCarts, mixedCarts, history })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', authorize('admin'), async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { id: req.params.id },
      include: {
        student: { select: { id: true, name: true, zone: true, phone: true } },
        items: {
          include: { zone: { select: { id: true, name: true } }, destination: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!cart) return res.status(404).json({ error: 'السلة غير موجودة' })
    res.json({ cart })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:id/approve', authorize('admin'), async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { id: req.params.id },
      include: {
        student: true,
        items: true,
      },
    })
    if (!cart) return res.status(404).json({ error: 'السلة غير موجودة' })
    if (cart.status !== 'PENDING') return res.status(400).json({ error: 'السلة غير معلقة' })

    if (cart.items.length === 0) return res.status(400).json({ error: 'السلة فارغة' })
    if (cart.depositReference) {
      try {
        await assertDepositReferenceIsUnique(cart.depositReference, prisma)
      } catch (err) {
        return res.status(409).json({ error: err.message })
      }
    }

    const subscriptions = []

    for (const item of cart.items) {
      const type = item.type
      const itemData = (item.data || {})
      const homeDeliveryFee = item.homeDeliveryFee ? Number(item.homeDeliveryFee) : null

      if (type === 'DAILY') {
        const selectedDays = itemData.selectedDays || []
        const weeksCount = itemData.weeksCount || 1
        let dates, firstDate, lastDate, weekCount
        if (itemData.computedDates && Array.isArray(itemData.computedDates) && itemData.computedDates.length > 0) {
          dates = itemData.computedDates.map(d => new Date(d))
          dates.sort((a, b) => a - b)
          firstDate = dates[0]
          lastDate = dates[dates.length - 1]
          weekCount = dates.length
        } else {
          const result = resolveDailyExecutionDates({ selectedDays, durationWeeks: weeksCount })
          dates = result.dates
          firstDate = result.startDate
          lastDate = result.endDate
          weekCount = result.weekCount
        }
        if (dates.length === 0) {
          throw new Error('لا توجد تواريخ للاشتراك اليومي')
        }

        const conflict = await hasActiveSameTypeSubscription(cart.studentId, 'DAILY', { dates })
        if (conflict) {
          throw new Error('لديك اشتراك يومي في أحد هذه الأيام، يرجى مراجعة التواريخ المختارة')
        }

        const sub = await prisma.subscription.create({
          data: {
            studentId: cart.studentId,
            type: 'DAILY',
            startDate: firstDate,
            endDate: lastDate,
            amount: item.amount,
            paidAmount: item.amount,
            paymentStatus: 'paid',
            status: 'active',
            homeDeliveryFee,
            durationWeeks: weeksCount,
            selectedDays: JSON.stringify(selectedDays),
            notes: JSON.stringify({ type: 'daily_request', selectedDays, durationWeeks: weeksCount, cartId: cart.id }),
          },
        })

        await setExecutionDates(sub.id, dates)
        if (cart.receiptImage || cart.depositReference) {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              amount: sub.amount,
              date: new Date(),
              method: 'transfer',
              reference: String(cart.depositReference || cart.receiptImage || 'غير محدد').trim(),
              notes: cart.receiptImage || 'موافقة على اشتراك يومي',
            },
          })
        }
        await reconcileSubscriptionPayments(sub.id)
        subscriptions.push(sub)
      } else {
        const weeksCount = itemData.weeksCount || (type === 'THREE_WEEKS' ? 3 : 4)
        const snapshot = itemData.priceSnapshot
        const startDate = itemData.startDate ? new Date(itemData.startDate) : new Date(getLocalDate())
        const endDate = itemData.endDate ? new Date(itemData.endDate) : new Date(startDate)
        if (!itemData.endDate) endDate.setDate(endDate.getDate() + weeksCount * 7 - 1)

        const conflict = await hasActiveSameTypeSubscription(cart.studentId, type, { startDate, endDate })
        if (conflict) {
          throw new Error('لديك اشتراك أسبوعي يتداخل مع فترة الاشتراك المطلوبة')
        }

        const notesObj = { type: 'cart_item', cartId: cart.id, priceSnapshot: snapshot || {} }
        const feeType = snapshot?.feeType || itemData.extraFeeType
        const feeAmount = snapshot?.additionalFee || itemData.extraFeeAmount
        if (feeType && feeAmount) {
          notesObj.extraFeeType = feeType
          notesObj.extraFeeAmount = feeAmount
        }
        const sub = await prisma.subscription.create({
          data: {
            studentId: cart.studentId,
            type,
            startDate,
            endDate,
            amount: item.amount,
            paidAmount: item.amount,
            paymentStatus: 'paid',
            status: 'active',
            homeDeliveryFee,
            durationWeeks: weeksCount,
            notes: JSON.stringify(notesObj),
          },
        })

        if (cart.receiptImage || cart.depositReference) {
          await prisma.payment.create({
            data: {
              subscriptionId: sub.id,
              amount: sub.amount,
              date: new Date(),
              method: 'transfer',
              reference: String(cart.depositReference || cart.receiptImage || 'غير محدد').trim(),
              notes: cart.receiptImage || 'موافقة على اشتراك سلة',
            },
          })
        }
        await reconcileSubscriptionPayments(sub.id)
        subscriptions.push(sub)
      }
    }

    await prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date() },
    })

    const user = await prisma.user.findUnique({ where: { studentId: cart.studentId } })
    if (user?.id) {
      await createSubscriptionNotification(
        user.id,
        'subscription_approved',
        'تم قبول طلب الاشتراكات',
        `تمت الموافقة على طلب السلة بقيمة ${Number(cart.totalAmount).toLocaleString()} ريال`,
        { cartId: cart.id }
      )
    }

    broadcastDailyExceptionsUpdate({ type: 'cart_approved', timestamp: new Date().toISOString() })

    res.json({ subscriptions, cart: { ...cart, status: 'APPROVED' } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/:id/reject', authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body
    const cart = await prisma.cart.findUnique({
      where: { id: req.params.id },
      include: { student: true },
    })
    if (!cart) return res.status(404).json({ error: 'السلة غير موجودة' })
    if (cart.status !== 'PENDING') return res.status(400).json({ error: 'السلة غير معلقة' })

    await prisma.cart.update({
      where: { id: cart.id },
      data: { status: 'REJECTED', rejectionReason: reason || null },
    })

    const user = await prisma.user.findUnique({ where: { studentId: cart.studentId } })
    if (user?.id) {
      await createAndBroadcast({
        userId: user.id,
        type: 'cart_rejected',
        title: 'تم رفض طلب الاشتراكات',
        message: `تم رفض طلب السلة${reason ? ` (السبب: ${reason})` : ''}`,
        dedupKey: `cart_rejected_${user.id}_${cart.id}`,
      })
    }

    res.json({ cart: { ...cart, status: 'REJECTED', rejectionReason: reason } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
