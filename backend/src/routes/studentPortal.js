import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { expireSubscriptions, hasActiveSameTypeSubscription, createSubscriptionNotification, setExecutionDates } from '../services/subscriptionService.js'
import { createAndBroadcast } from '../services/notificationService.js'
import { getLocalDate, formatLocalDate, resolveDailyExecutionDates } from '../utils/dateUtils.js'
import { getStudentOperationStage, Stage } from '../services/operationStage.js'
import { calculateFinalSubscriptionPrice } from '../services/pricingService.js'

const router = Router()
router.use(authenticate)

function todayRange() {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

async function resolveStudentId(user) {
  if (user.studentId) return user.studentId
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  return dbUser?.studentId
}

router.get('/dashboard', async (req, res) => {
  try {
    await expireSubscriptions()

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'غير مصرح' })
    }

    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        subscriptions: { orderBy: { endDate: 'desc' }, take: 1 },
        destination: true,
      },
    })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { today, tomorrow } = todayRange()
    const todayAssignment = await prisma.assignment.findFirst({
      where: { studentId, date: { gte: today, lt: tomorrow }, status: { not: 'cancelled' } },
      include: {
        bus: { include: { driver: { select: { id: true, name: true, phone: true } } } },
      },
    })

    let busStudents = []
    let returnQueueStatus = null
    let returnBusInfo = null
    let operationStage = Stage.NO_TRIP

    if (todayAssignment) {
      const busId = todayAssignment.busId
      const sameBusAssignments = await prisma.assignment.findMany({
        where: { busId, date: { gte: today, lt: tomorrow }, period: 'MORNING', status: { not: 'cancelled' } },
        include: {
          student: { select: { id: true, name: true, phone: true, transportMode: true, homeAddress: true, pickupLocation: true } },
        },
        orderBy: { sortOrder: 'asc' },
      })

      const attendances = await prisma.attendance.findMany({
        where: { busId, date: { gte: today, lt: tomorrow } },
      })
      const attendanceMap = {}
      for (const a of attendances) {
        attendanceMap[a.studentId] = a.status
      }

      busStudents = sameBusAssignments.map(a => ({
        studentId: a.student.id,
        name: a.student.name,
        phone: a.student.phone,
        transportMode: a.student.transportMode,
        homeAddress: a.student.homeAddress,
        pickupLocation: a.student.pickupLocation,
        sortOrder: a.sortOrder,
        pickupTime: a.pickupTime || null,
        attendance: attendanceMap[a.student.id] || null,
      }))

      const { stage } = await getStudentOperationStage(studentId)
      operationStage = stage

      const op = await prisma.dailyOperation.findFirst({
        where: { operationDate: { gte: today, lt: tomorrow } },
      })
      if (op && (stage === Stage.MORNING_COMPLETED || stage === Stage.BOARDED)) {
        returnQueueStatus = await prisma.returnQueue.findFirst({
          where: { operationId: op.id, studentId, status: { not: 'DEPARTED' } },
        })

        if (stage === Stage.MORNING_COMPLETED) {
          const returnLoad = await prisma.busLoad.findFirst({
            where: {
              studentId,
              activeBus: { operationId: op.id, status: { not: 'CANCELLED' }, tripType: 'RETURN' },
            },
            include: {
              activeBus: {
                include: {
                  bus: {
                    include: { driver: { select: { name: true, phone: true } } },
                  },
                },
              },
            },
          })
          if (returnLoad) {
            returnBusInfo = {
              busNumber: returnLoad.activeBus.bus.busNumber,
              driverName: returnLoad.activeBus.bus.driver?.name || returnLoad.activeBus.bus.driverName,
              primaryPhone: returnLoad.activeBus.bus.primaryPhone,
              secondaryPhone: returnLoad.activeBus.bus.secondaryPhone,
              droppedOffAt: returnLoad.droppedOffAt,
            }
          }
        }
      }
    }

    res.json({ student, todayAssignment, busStudents, returnQueueStatus, returnBusInfo, operationStage })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/pricing', async (req, res) => {
  try {
    const zones = await prisma.pricingArea.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { prices: { where: { destinationId: null }, orderBy: { plan: 'asc' } } },
    })
    res.json(zones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/pricing-by-destination', async (req, res) => {
  try {
    const { destinationId } = req.query
    const zones = await prisma.pricingArea.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        prices: {
          where: destinationId ? { destinationId } : { destinationId: null },
          include: { destination: true },
          orderBy: { plan: 'asc' },
        },
      },
    })
    res.json(zones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/campaign-price/:campaignId', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })

    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { campaignId } = req.params
    if (!campaignId) return res.status(400).json({ error: 'معرّف الحملة مطلوب' })

    const [campaign, student] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.student.findUnique({ where: { id: studentId } }),
    ])
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })
    if (!student.zone) return res.status(400).json({ error: 'لم يتم تحديد منطقتك بعد' })

    const zonePricing = await prisma.pricingArea.findUnique({
      where: { name: student.zone },
      include: { prices: { where: { destinationId: student.destinationId || null } } },
    })
    if (!zonePricing) return res.status(400).json({ error: 'لم يتم العثور على منطقة التسعير' })

    const price = await calculateFinalSubscriptionPrice(student, campaign, zonePricing)

    res.json({
      basePrice: price.basePrice,
      discountAmount: price.discount,
      hasDiscount: price.hasDiscount,
      feeType: price.extraFee?.type || null,
      feeLabel: price.extraFee?.label || null,
      feeAmount: price.extraFee?.amount || 0,
      surcharge: price.surcharge,
      finalAmount: price.finalAmount,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/return-queue/join', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })

    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { today, tomorrow } = todayRange()

    const { stage } = await getStudentOperationStage(studentId)

    if (stage === Stage.NO_TRIP) return res.status(400).json({ error: 'لا توجد رحلة صباحية لليوم' })
    if (stage === Stage.ABSENT) return res.status(400).json({ error: 'لا يمكن طلب العودة لأنك غائب' })
    if (stage === Stage.BEFORE_PICKUP || stage === Stage.PICKUP_IN_PROGRESS) return res.status(400).json({ error: 'لم تنته رحلة الذهاب بعد' })
    if (stage === Stage.BOARDED) return res.status(400).json({ error: 'لم تنته رحلة الذهاب بعد' })
    if (stage !== Stage.MORNING_COMPLETED) return res.status(400).json({ error: 'لا يمكن طلب العودة حالياً' })

    let op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (!op) return res.status(400).json({ error: 'التشغيل غير متاح حالياً' })
    if (op.status === 'CLOSED') return res.status(400).json({ error: 'التشغيل مغلق' })

    const existing = await prisma.returnQueue.findFirst({
      where: { operationId: op.id, studentId, status: { not: 'DEPARTED' } },
    })
    if (existing) return res.status(400).json({ error: 'أنت بالفعل في قائمة انتظار العودة' })

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })

    const attendance = await prisma.attendance.findUnique({
      where: { studentId_date: { studentId, date: today } },
    })
    if (!attendance || (attendance.status !== 'present' && attendance.status !== 'late')) {
      return res.status(400).json({ error: 'لم يتم تسجيل حضورك في رحلة الذهاب' })
    }

    const entry = await prisma.returnQueue.create({
      data: { operationId: op.id, studentId, transportMode: student.transportMode },
    })

    prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } }).then(admins => {
      if (admins.length > 0) {
        prisma.assignment.findFirst({
          where: { studentId, date: { gte: today, lt: tomorrow }, period: 'MORNING' },
          include: { bus: { select: { plateNumber: true, busNumber: true } } },
        }).then(assignment => {
          const busLabel = assignment?.bus?.plateNumber || assignment?.bus?.busNumber || ''
          const locationInfo = busLabel ? ` في الباص ${busLabel}` : ''
          for (const admin of admins) {
            createAndBroadcast({
              userId: admin.id,
              type: 'student_in_queue',
              title: 'طلب رحلة عودة',
              message: `الطالب ${student.name} طلب رحلة عودة${locationInfo}`,
              dedupKey: `student_in_queue_${admin.id}_${studentId}_${today.toISOString().slice(0, 10)}`,
            }).catch(() => {})
          }
        })
      }
    })

    res.status(201).json(entry)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/notify-next', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })

    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { today, tomorrow } = todayRange()
    const existing = await prisma.notification.findFirst({
      where: {
        userId: req.user.id,
        type: 'bus_near',
        createdAt: { gte: today, lt: tomorrow },
      },
    })
    if (existing) return res.json({ message: 'تم الإشعار مسبقاً' })

    await createAndBroadcast({
      userId: req.user.id,
      type: 'bus_near',
      title: 'الباص قريب منك',
      message: 'الباص قريب منك، يرجى التواجد في موقعك.',
      dedupKey: `bus_near_${req.user.id}_${new Date().toDateString()}`,
    })
    res.status(201).json({ message: 'تم إنشاء الإشعار' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/subscription-request', async (req, res) => {
  return res.status(400).json({ error: 'هذه الخدمة ملغية. يرجى استخدام سلة الاشتراكات لإضافة اشتراك يومي.' })
})

// Legacy endpoint — kept for backward compatibility only
router.post('/subscription-request-legacy', async (req, res) => {
  try {
    await expireSubscriptions()

    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })

    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { selectedDays, durationWeeks, receiptImage } = req.body

    if (!selectedDays || !Array.isArray(selectedDays) || selectedDays.length === 0) {
      return res.status(400).json({ error: 'يرجى اختيار يوم واحد على الأقل' })
    }
    if (!durationWeeks || durationWeeks < 1 || durationWeeks > 4) {
      return res.status(400).json({ error: 'مدة الاشتراك يجب أن تكون بين 1 و 4 أسابيع' })
    }

    const validDays = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']
    const invalidDays = selectedDays.filter(d => !validDays.includes(d))
    if (invalidDays.length > 0) {
      return res.status(400).json({ error: 'الأيام المحددة غير صالحة' })
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })
    if (!student.zone) return res.status(400).json({ error: 'لم يتم تحديد منطقتك بعد' })

    const zone = await prisma.pricingArea.findUnique({
      where: { name: student.zone },
      include: { prices: { where: { destinationId: student.destinationId || null } } },
    })
    if (!zone) return res.status(400).json({ error: 'لم يتم العثور على منطقة التسعير' })

    const existingRequest = await prisma.subscription.findFirst({
      where: { studentId, type: 'DAILY', status: 'pending' },
    })
    if (existingRequest) return res.status(400).json({ error: 'لديك طلب اشتراك يومي قيد المراجعة' })

    const pricing = zone.prices?.find(p => p.plan === 'DAILY')
    if (!pricing) return res.status(400).json({ error: 'لم يتم تحديد سعر للاشتراك اليومي' })

    const dailyPrice = Number(pricing.price)
    const { dates, weekCount, startDate: firstDate, endDate: lastDate } = resolveDailyExecutionDates({ selectedDays, durationWeeks })
    if (dates.length === 0) {
      return res.status(400).json({ error: 'لا توجد تواريخ صالحة' })
    }

    const activeSameType = await hasActiveSameTypeSubscription(studentId, 'DAILY', { dates })
    if (activeSameType) {
      return res.status(400).json({ error: 'لديك اشتراك يومي في أحد هذه الأيام، يرجى مراجعة التواريخ المختارة' })
    }
    let amount = dailyPrice * weekCount
    let homeDeliveryFee = null

    if (student.homeDeliveryActive) {
      if (durationWeeks === 1 && student.homeDeliveryFeeDaily != null) {
        homeDeliveryFee = Number(student.homeDeliveryFeeDaily)
      } else if (durationWeeks === 3 && student.homeDeliveryFeeThreeWeeks != null) {
        homeDeliveryFee = Number(student.homeDeliveryFeeThreeWeeks)
      } else if (durationWeeks === 4 && student.homeDeliveryFeeFourWeeks != null) {
        homeDeliveryFee = Number(student.homeDeliveryFeeFourWeeks)
      } else {
        homeDeliveryFee = zone.homeNearSurcharge ? Number(zone.homeNearSurcharge) : 0
      }

      amount += homeDeliveryFee * weekCount
    }

    const sub = await prisma.subscription.create({
      data: {
        studentId,
        type: 'DAILY',
        startDate: firstDate,
        endDate: lastDate,
        amount,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        status: 'pending',
        homeDeliveryFee: homeDeliveryFee || null,
        durationWeeks,
        selectedDays: JSON.stringify(selectedDays),
        notes: JSON.stringify({ type: 'daily_request', selectedDays, durationWeeks }),
      },
    })

    if (dates.length > 0) {
      await setExecutionDates(sub.id, dates)
    }

    if (receiptImage) {
      await prisma.payment.create({
        data: {
          subscriptionId: sub.id,
          amount,
          date: new Date(),
          method: 'transfer',
          reference: receiptImage,
          notes: 'بانتظار الموافقة',
        },
      })
    }

    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })
    if (admins.length > 0) {
      const dayLabels = dates.map(d => d.toLocaleDateString('ar-SA', { weekday: 'long', day: '2-digit', month: '2-digit' })).join('، ')
      for (const admin of admins) {
        await createAndBroadcast({
          userId: admin.id,
          type: 'subscription_request',
          title: 'طلب اشتراك يومي',
          message: `طلب اشتراك يومي لمدة ${durationWeeks} أسبوع، الأيام: ${selectedDays.join('، ')}، التواريخ: ${dayLabels} من ${student.name} بمبلغ ${amount} ريال`,
          dedupKey: `subscription_request_${admin.id}_${sub.id}`,
        })
      }
      await createSubscriptionNotification(
        req.user.id,
        'student_subscription_requested',
        'تم إرسال طلب الاشتراك',
        'تم إرسال طلب الاشتراك اليومي بنجاح',
        { subscriptionId: sub.id }
      )
    }

    res.status(201).json({ message: 'تم إرسال طلب الاشتراك', subscription: sub })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/assignments', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })
    const assignments = await prisma.assignment.findMany({
      where: { studentId },
      include: { bus: { include: { driver: { select: { name: true } } } } },
      orderBy: [{ date: 'desc' }, { period: 'desc' }],
    })
    res.json(assignments)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/subscriptions', async (req, res) => {
  try {
    await expireSubscriptions()

    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })
    const subscriptions = await prisma.subscription.findMany({
      where: { studentId },
      include: { payments: true, executionDates: { orderBy: { executionDate: 'asc' } } },
      orderBy: { startDate: 'desc' },
    })
    res.json(subscriptions)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
