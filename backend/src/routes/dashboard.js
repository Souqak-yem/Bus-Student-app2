import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { expireSubscriptions } from '../services/subscriptionService.js'
import { getLocalDate, snapToSaturday } from '../utils/dateUtils.js'

const router = Router()
router.use(authenticate)

function toUTC(date) {
  const d = new Date(date)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

router.get('/stats', async (req, res) => {
  try {
    await expireSubscriptions()

    const today = getLocalDate()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfterTomorrow = new Date(tomorrow)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const weekStart = toUTC(snapToSaturday(today))
    const pendingPaymentStatuses = ['unpaid', 'partial', 'overdue']

    const [
      totalStudents,
      activeStudents,
      totalBuses,
      activeBuses,
      todayMorningAssignments,
      todayBusesOperating,
      activeDrivers,
      activeSubscriptions,
      revenueAggregate,
      revenueTodayAggregate,
      revenueMonthlyAggregate,
      homeDeliveryStudents,
      monthlyHomeFees,
      waitingStudents,
      availableBuses,
      departedBuses,
      returnedStudents,
      activeCampaigns,
      pendingReceipts,
      pendingStudentRegistrations,
      activeTransfers,
      studentsWithoutSubscription,
      expiredCampaigns,
      weeklySheets,
      transfersEndingTomorrow,
      returnQueueWaiting,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: 'active' } }),
      prisma.bus.count(),
      prisma.bus.count({ where: { status: 'active' } }),
      prisma.assignment.count({
        where: { date: { gte: today, lt: tomorrow }, period: 'MORNING' },
      }),
      prisma.assignment.groupBy({
        by: ['busId'],
        where: { date: { gte: today, lt: tomorrow }, period: 'MORNING' },
        _count: { id: true },
      }).then(r => r.length),
      prisma.user.count({ where: { role: 'driver', status: 'active' } }),
      prisma.subscription.count({ where: { status: 'active' } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { subscription: { status: { in: ['active', 'expired', 'cancelled'] } } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          date: { gte: today, lt: tomorrow },
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
      prisma.student.count({ where: { transportMode: 'HOME', homeDeliveryActive: true } }),
      // Sum home delivery fees from subscriptions created this month (uses per-subscription stored fee)
      prisma.subscription.aggregate({
        _sum: { homeDeliveryFee: true },
        where: { createdAt: { gte: startOfMonth }, homeDeliveryFee: { not: null } },
      }),
      prisma.returnQueue.count({ where: { status: 'WAITING' } }).catch(() => 0),
      prisma.activeBus.count({ where: { status: { in: ['AVAILABLE', 'LOADING'] } } }).catch(() => 0),
      prisma.activeBus.count({ where: { status: 'DEPARTED' } }).catch(() => 0),
      prisma.returnQueue.count({ where: { status: 'DEPARTED' } }).catch(() => 0),
      prisma.campaign.count({ where: { status: 'ACTIVE', isActive: true } }).catch(() => 0),
      prisma.campaignEnrollment.count({ where: { receiptStatus: 'PENDING' } }).catch(() => 0),
      prisma.studentRegistrationRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
      prisma.studentTransfer.count({ where: { isActive: true } }).catch(() => 0),
      prisma.student.count({ where: { status: 'active', subscriptions: { none: { status: 'active' } } } }).catch(() => 0),
      prisma.campaign.count({ where: { status: 'EXPIRED' } }).catch(() => 0),
      prisma.weeklySheet.count({ where: { weekStart } }).catch(() => 0),
      prisma.studentTransfer.count({ where: { type: 'TEMPORARY', isActive: true, endDate: { gte: tomorrow, lt: dayAfterTomorrow } } }).catch(() => 0),
      prisma.returnQueue.count({ where: { status: 'WAITING' } }).catch(() => 0),
    ])

    const pendingPayments = await prisma.subscription.count({
      where: { status: 'active', paymentStatus: { in: pendingPaymentStatuses } },
    })

    const expectedRevenueSubs = await prisma.subscription.findMany({
      where: { status: 'active', paymentStatus: { in: pendingPaymentStatuses } },
      select: { amount: true, paidAmount: true },
    })

    const returnTrips = returnedStudents
    // `transfersEndingTomorrow` is already loaded above in the parallel Promise.all

    const assignmentCounts = await prisma.assignment.groupBy({
      by: ['busId'],
      where: { date: { gte: today, lt: tomorrow }, period: 'MORNING' },
      _count: { id: true },
    })

    const capacityMap = new Map(
      (await prisma.bus.findMany({
        where: { id: { in: assignmentCounts.map(a => a.busId) } },
        select: { id: true, capacity: true },
      })).map(bus => [bus.id, bus.capacity]),
    )

    const assignedStudents = assignmentCounts.reduce((sum, row) => sum + row._count.id, 0)
    const totalCapacity = assignmentCounts.reduce((sum, row) => sum + (capacityMap.get(row.busId) || 0), 0)
    const occupancyRate = totalCapacity ? Math.round((assignedStudents / totalCapacity) * 100) : 0
    const busesExceedingCapacity = assignmentCounts.filter(row => row._count.id > (capacityMap.get(row.busId) || 0)).length

    const expectedRevenue = expectedRevenueSubs.reduce((sum, sub) => sum + Number(sub.amount || 0) - Number(sub.paidAmount || 0), 0)

    res.json({
      totalStudents,
      activeStudents,
      homeDeliveryStudents,
      totalBuses,
      activeBuses,
      todayAssignments: todayMorningAssignments,
      studentsToday: todayMorningAssignments,
      todayBusesOperating,
      activeDrivers,
      activeSubscriptions,
      totalRevenue: Number(revenueAggregate._sum.amount || 0),
      todayRevenue: Number(revenueTodayAggregate._sum.amount || 0),
      monthlyRevenue: Number(revenueMonthlyAggregate._sum.amount || 0),
      monthlyHomeDeliveryFees: Number(monthlyHomeFees._sum.homeDeliveryFee || 0),
      waitingStudents,
      availableBuses,
      departedBuses,
      returnedStudents,
      activeCampaigns,
      activeTransfers,
      pendingReceipts,
      pendingPayments,
      expectedRevenue: Number(expectedRevenue),
      weeklySheets,
      returnTrips,
      occupancyRate,
      studentsWithoutSubscription,
      expiredCampaigns,
      busesExceedingCapacity,
      transfersEndingTomorrow,
      returnQueueWaiting,
      pendingStudentRegistrations,
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/recent-payments', async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        subscription: {
          include: { student: { select: { id: true, name: true } } },
        },
      },
    })

    res.json(payments)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/today-assignments', async (req, res) => {
  try {
    const today = getLocalDate()

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const assignments = await prisma.assignment.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: {
        student: { select: { id: true, name: true, zone: true } },
        bus: { select: { id: true, plateNumber: true } },
      },
      orderBy: { pickupTime: 'asc' },
    })

    res.json(assignments)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/monthly-revenue', async (req, res) => {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const result = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        date: { gte: startOfMonth },
        subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
      },
    })

    res.json({ month: now.getMonth() + 1, year: now.getFullYear(), revenue: Number(result._sum.amount || 0) })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
