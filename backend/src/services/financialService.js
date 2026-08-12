import { prisma } from '../lib/prisma.js'
import { createAuditLog } from '../lib/audit.js'
import { createAndBroadcast } from './notificationService.js'
import { notifyStudent } from './socketService.js'
import { getLocalDate, getUtcDateRange } from '../utils/dateUtils.js'

export const FinancialStatus = {
  SETTLED: 'SETTLED',
  OVERDUE: 'OVERDUE',
  SUSPENDED: 'SUSPENDED',
  GRACE_PERIOD: 'GRACE_PERIOD',
}

const STATUS_LABELS = {
  SETTLED: 'مسدد',
  OVERDUE: 'متأخر عن السداد',
  SUSPENDED: 'موقوف',
  GRACE_PERIOD: 'لديه مهلة',
}

export function getFinancialStatusLabel(status) {
  return STATUS_LABELS[status] || status
}

export async function computeFinancialStatus(studentId, checkDate = new Date()) {
  const today = getLocalDate(checkDate)
  const fin = await prisma.studentFinancial.findUnique({ where: { studentId } })

  if (fin?.isSuspended) {
    return { status: FinancialStatus.SUSPENDED, record: fin }
  }

  if (fin?.gracePeriodEnd) {
    const gpEnd = getLocalDate(fin.gracePeriodEnd)
    if (gpEnd >= today) {
      return { status: FinancialStatus.GRACE_PERIOD, record: fin }
    }
  }

  const activeSubs = await prisma.subscription.findMany({
    where: {
      studentId,
      status: 'active',
      endDate: { gte: today },
    },
    orderBy: { endDate: 'desc' },
    include: {
      executionDates: { where: { executionDate: today }, take: 1 },
    },
  })

  let activeSub = null
  for (const sub of activeSubs) {
    if (sub.type === 'DAILY' && sub.executionDates.length === 0) continue
    activeSub = sub
    break
  }

  if (activeSub) {
    if (activeSub.paymentStatus === 'paid' || activeSub.paymentStatus === 'partial') {
      return { status: FinancialStatus.SETTLED, subscription: activeSub }
    }
    return { status: FinancialStatus.OVERDUE, subscription: activeSub }
  }

  return { status: FinancialStatus.OVERDUE, subscription: null }
}

export async function reconcileSubscriptionPayments(subscriptionId) {
  if (!subscriptionId) {
    return { updated: false, paymentCount: 0, paidAmount: 0, paymentStatus: 'unpaid' }
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { payments: true },
  })

  if (!subscription) {
    return { updated: false, paymentCount: 0, paidAmount: 0, paymentStatus: 'unpaid' }
  }

  const paymentCount = subscription.payments.length
  const paidAmount = subscription.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const normalizedAmount = Number(subscription.amount || 0)
  const paymentStatus = paidAmount <= 0
    ? 'unpaid'
    : paidAmount >= normalizedAmount
      ? 'paid'
      : 'partial'

  const currentPaidAmount = Number(subscription.paidAmount || 0)
  const currentStatus = subscription.paymentStatus || 'unpaid'

  if (paymentCount === 0 && currentPaidAmount === 0 && currentStatus === 'unpaid') {
    return { updated: false, paymentCount, paidAmount: 0, paymentStatus }
  }

  if (Math.abs(currentPaidAmount - paidAmount) > 0.01 || currentStatus !== paymentStatus) {
    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        paidAmount,
        paymentStatus,
      },
    })

    return {
      updated: true,
      paymentCount,
      paidAmount: Number(updated.paidAmount || 0),
      paymentStatus: updated.paymentStatus,
    }
  }

  return {
    updated: false,
    paymentCount,
    paidAmount: Number(subscription.paidAmount || 0),
    paymentStatus: subscription.paymentStatus,
  }
}

export async function getFinancialDashboard() {
  const today = getLocalDate()
  const { start: dayStartUtc, end: dayEndUtc } = getUtcDateRange(today)
  const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const startOfNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))

  const [allStudents, dailyRevenueAggregate, monthlyRevenueAggregate, paymentTotalAggregate, subscriptionPaidAmountAggregate] = await Promise.all([
    prisma.student.findMany({
      where: { status: 'active' },
      include: {
        subscriptions: {
          where: { status: 'active' },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
        financial: true,
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        date: { gte: dayStartUtc, lt: dayEndUtc },
        subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        date: { gte: startOfMonth, lt: startOfNextMonth },
        subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
      },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
      },
    }),
    prisma.subscription.aggregate({
      _sum: { paidAmount: true },
      where: { status: { in: ['active', 'expired', 'cancelled'] } },
    }),
  ])

  const counts = {
    total: allStudents.length,
    SETTLED: 0,
    OVERDUE: 0,
    SUSPENDED: 0,
    GRACE_PERIOD: 0,
  }

  const statusMap = {}

  for (const s of allStudents) {
    const { status } = await computeFinancialStatus(s.id, today)
    counts[status]++
    statusMap[s.id] = status
  }

  const dailyRevenue = Number(dailyRevenueAggregate._sum.amount || 0)
  const monthlyRevenue = Number(monthlyRevenueAggregate._sum.amount || 0)
  const paymentTotalRevenue = Number(paymentTotalAggregate._sum.amount || 0)
  const subscriptionPaidTotalRevenue = Number(subscriptionPaidAmountAggregate._sum.paidAmount || 0)
  const totalRevenue = Math.max(paymentTotalRevenue, subscriptionPaidTotalRevenue)

  return {
    counts,
    statusMap,
    dailyRevenue,
    todayRevenue: dailyRevenue,
    monthlyRevenue,
    totalRevenue,
  }
}

export async function getStudentsByFinancialStatus(targetStatus, checkDate = new Date()) {
  const today = getLocalDate(checkDate)
  const allStudents = await prisma.student.findMany({
    where: { status: 'active' },
    include: {
      busStudents: { where: { isActive: true }, include: { bus: { select: { id: true, busNumber: true, plateNumber: true } } } },
      destination: true,
      subscriptions: {
        orderBy: { endDate: 'desc' },
        take: 1,
        include: { payments: { orderBy: { date: 'desc' }, take: 1 } },
      },
      financial: true,
      user: { select: { id: true } },
    },
    orderBy: { name: 'asc' },
  })

  const results = []

  for (const s of allStudents) {
    const { status, record, subscription } = await computeFinancialStatus(s.id, today)
    if (targetStatus && status !== targetStatus) continue

    let delayDays = null
    if (status === FinancialStatus.OVERDUE || status === FinancialStatus.GRACE_PERIOD) {
      const subEnd = subscription?.endDate
      if (subEnd) {
        const end = getLocalDate(subEnd)
        delayDays = Math.floor((today - end) / 86400000)
        if (delayDays < 0) delayDays = 0
      }
    }

    results.push({
      id: s.id,
      name: s.name,
      phone: s.phone,
      zone: s.zone,
      major: s.major,
      institutionName: s.institutionName,
      destinationName: s.destination?.name || s.institutionName || null,
      status: s.status,
      bus: s.busStudents[0]?.bus || null,
      subscription,
      financial: record,
      user: s.user,
      financialStatus: status,
      delayDays,
      lastPaymentDate: s.subscriptions[0]?.payments[0]?.date || null,
    })
  }

  return results
}

export async function getStudentFinancialDetail(studentId, checkDate = new Date()) {
  const today = getLocalDate(checkDate)
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      busStudents: { where: { isActive: true }, include: { bus: { select: { id: true, busNumber: true } } } },
      subscriptions: { orderBy: { endDate: 'desc' }, include: { payments: { orderBy: { date: 'desc' } } } },
      financial: true,
      user: { select: { id: true } },
    },
  })
  if (!s) return null

  const { status, record, subscription } = await computeFinancialStatus(studentId, today)
  return { student: s, financialStatus: status, financialRecord: record, activeSubscription: subscription }
}

export async function suspendStudent(studentId, userId, reason) {
  let fin = await prisma.studentFinancial.findUnique({ where: { studentId } })
  if (!fin) {
    fin = await prisma.studentFinancial.create({
      data: { studentId },
    })
  }
  if (fin.isSuspended) throw new Error('الطالب موقوف بالفعل')

  await prisma.studentFinancial.update({
    where: { studentId },
    data: {
      isSuspended: true,
      suspendedAt: new Date(),
      suspendedById: userId,
      suspensionReason: reason || null,
    },
  })

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })

  await createAuditLog({
    userId,
    action: 'FINANCIAL_SUSPEND',
    entityType: 'StudentFinancial',
    entityId: studentId,
    newValue: { studentName: student?.name, reason },
    reason: `إيقاف الطالب ${student?.name || ''} مالياً${reason ? ` (${reason})` : ''}`,
  })

  const suspendUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
  if (suspendUser?.id) {
    notifyStudent({
      userId: suspendUser.id, type: 'student_account_suspended', title: 'تم إيقاف حسابك',
      message: `تم إيقاف حسابك${reason ? ` (السبب: ${reason})` : ' لعدم السداد'}. يرجى التواصل مع الإدارة.`,
      targetRoute: '/student/subscriptions',
      priority: 'CRITICAL',
    })
  }

  return { studentId, isSuspended: true, suspendedAt: new Date() }
}

export async function reactivateStudent(studentId, userId) {
  const fin = await prisma.studentFinancial.findUnique({ where: { studentId } })
  if (!fin || !fin.isSuspended) throw new Error('الطالب غير موقوف')

  await prisma.studentFinancial.update({
    where: { studentId },
    data: {
      isSuspended: false,
      suspendedAt: null,
      suspendedById: null,
      suspensionReason: null,
      reactivatedAt: new Date(),
    },
  })

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })

  await createAuditLog({
    userId,
    action: 'FINANCIAL_REACTIVATE',
    entityType: 'StudentFinancial',
    entityId: studentId,
    newValue: { studentName: student?.name },
    reason: `إعادة تفعيل الطالب ${student?.name || ''} مالياً`,
  })

  const reactUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
  if (reactUser?.id) {
    notifyStudent({
      userId: reactUser.id, type: 'student_account_reactivated', title: 'تم إعادة تفعيل حسابك',
      message: 'تم إعادة تفعيل حسابك. يمكنك الآن استخدام الخدمة.',
      targetRoute: '/student/subscriptions',
    })
  }

  return { studentId, isSuspended: false }
}

export async function grantGracePeriod(studentId, userId, endDate, reason) {
  const graceEnd = getLocalDate(endDate)
  const today = getLocalDate()

  if (graceEnd <= today) throw new Error('تاريخ انتهاء المهلة يجب أن يكون في المستقبل')

  let fin = await prisma.studentFinancial.findUnique({ where: { studentId } })
  if (!fin) {
    fin = await prisma.studentFinancial.create({ data: { studentId } })
  }
  if (fin.isSuspended) throw new Error('لا يمكن منح مهلة لطالب موقوف')

  await prisma.studentFinancial.update({
    where: { studentId },
    data: { gracePeriodEnd: graceEnd, graceReason: reason || null },
  })

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })

  await createAuditLog({
    userId,
    action: 'FINANCIAL_GRANT_GRACE',
    entityType: 'StudentFinancial',
    entityId: studentId,
    newValue: { studentName: student?.name, graceEnd, reason },
    reason: `منح مهلة للطالب ${student?.name || ''} حتى ${graceEnd.toISOString().split('T')[0]}${reason ? ` (${reason})` : ''}`,
  })

  return { studentId, gracePeriodEnd: graceEnd }
}

export async function cancelGracePeriod(studentId, userId) {
  const fin = await prisma.studentFinancial.findUnique({ where: { studentId } })
  if (!fin || !fin.gracePeriodEnd) throw new Error('لا توجد مهلة نشطة لهذا الطالب')

  await prisma.studentFinancial.update({
    where: { studentId },
    data: { gracePeriodEnd: null, graceReason: null },
  })

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })

  await createAuditLog({
    userId,
    action: 'FINANCIAL_CANCEL_GRACE',
    entityType: 'StudentFinancial',
    entityId: studentId,
    newValue: { studentName: student?.name },
    reason: `إلغاء مهلة الطالب ${student?.name || ''}`,
  })

  return { studentId, gracePeriodEnd: null }
}

export async function sendReminder(studentId, userId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { id: true } } },
  })
  if (!student) throw new Error('الطالب غير موجود')

  const user = student.user
  if (!user) throw new Error('لا يوجد حساب مستخدم للطالب')

  await createAndBroadcast({
    userId: user.id,
    type: 'payment_reminder',
    title: 'تذكير بسداد الاشتراك',
    message: 'اشتراك المواصلات الخاص بك منتهي أو متأخر. يرجى السداد في أقرب وقت لتجنب إيقاف الخدمة.',
    data: { studentId },
    dedupKey: `payment_reminder_${studentId}`,
  })

  let fin = await prisma.studentFinancial.findUnique({ where: { studentId } })
  if (!fin) {
    fin = await prisma.studentFinancial.create({ data: { studentId } })
  }

  await prisma.studentFinancial.update({
    where: { studentId },
    data: {
      lastReminderSentAt: new Date(),
      reminderCount: { increment: 1 },
    },
  })

  await createAuditLog({
    userId,
    action: 'FINANCIAL_SEND_REMINDER',
    entityType: 'StudentFinancial',
    entityId: studentId,
    newValue: { studentName: student.name },
    reason: `إرسال تنبيه سداد للطالب ${student.name}`,
  })

  return { studentId, sentAt: new Date() }
}

export async function autoExpireGracePeriods() {
  const today = getLocalDate()
  const expired = await prisma.studentFinancial.findMany({
    where: {
      gracePeriodEnd: { lt: today },
      isSuspended: false,
    },
    include: { student: { select: { name: true } } },
  })

  for (const fin of expired) {
    await prisma.studentFinancial.update({
      where: { id: fin.id },
      data: { gracePeriodEnd: null, graceReason: null },
    })

    await createAuditLog({
      userId: null,
      action: 'FINANCIAL_GRACE_EXPIRED',
      entityType: 'StudentFinancial',
      entityId: fin.studentId,
      newValue: { studentName: fin.student?.name },
      reason: `انتهت مهلة الطالب ${fin.student?.name || ''} تلقائياً`,
    })
  }

  return expired.length
}

export async function getStudentIdsToExclude() {
  const suspended = await prisma.studentFinancial.findMany({
    where: { isSuspended: true },
    select: { studentId: true },
  })
  return new Set(suspended.map(s => s.studentId))
}
