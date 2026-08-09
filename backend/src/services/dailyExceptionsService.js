import { prisma } from '../lib/prisma.js'
import { getLocalDate, formatLocalDate } from '../utils/dateUtils.js'
import { createAndBroadcast } from './notificationService.js'

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export async function getTodayExceptions() {
  const today = getLocalDate()
  const dayName = DAY_NAMES[today.getDay()]

  const activeDailySubs = await prisma.subscription.findMany({
    where: {
      type: 'DAILY',
      status: 'active',
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      student: {
        select: { id: true, name: true, zone: true, phone: true, offDays: true, pickupLocation: true, transportMode: true },
      },
      executionDates: {
        where: { executionDate: today },
        take: 1,
      },
    },
  })

  const todayAssignmentIds = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING' },
    select: { studentId: true },
  })
  const assignedIds = new Set(todayAssignmentIds.map(a => a.studentId))

  const dailySubsWithMeta = activeDailySubs.map(sub => ({
    id: sub.id,
    studentId: sub.studentId,
    student: sub.student,
    amount: sub.amount,
    executionDates: sub.executionDates,
    hasTodayExecution: sub.executionDates.length > 0,
    isOffDay: Array.isArray(sub.student.offDays) && sub.student.offDays.includes(dayName),
    isAssigned: assignedIds.has(sub.studentId),
  }))

  const unassigned = dailySubsWithMeta.filter(s => !s.isAssigned)

  const dailySubStudentIds = new Set(activeDailySubs.map(s => s.studentId))
  const allStudents = await prisma.student.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, zone: true, phone: true, offDays: true },
  })
  const todayOffStudents = allStudents.filter(s => {
    const offDays = s.offDays || []
    return Array.isArray(offDays) && offDays.includes(dayName) && !dailySubStudentIds.has(s.id)
  })

  let unassignedWithDefaults = unassigned
  if (unassigned.length > 0) {
    const busStudents = await prisma.busStudent.findMany({
      where: { studentId: { in: unassigned.map(s => s.studentId) }, isActive: true },
      include: { bus: { select: { id: true, busNumber: true } } },
    })
    const busStudentMap = new Map(busStudents.map(bs => [bs.studentId, bs]))
    unassignedWithDefaults = unassigned.map(s => ({
      ...s,
      defaultBus: busStudentMap.get(s.studentId)?.bus || null,
      pickupTime: busStudentMap.get(s.studentId)?.pickupTime || null,
    }))
  }

  return {
    dailySubscriptions: unassignedWithDefaults,
    todayOffStudents,
    overrideCount: dailySubsWithMeta.filter(s => s.isOffDay).length,
    unassignedCount: unassignedWithDefaults.length,
  }
}

export async function checkAndNotifyUnassignedDailySubscriptions(adminId) {
  const today = getLocalDate()
  const dateKey = formatLocalDate(today)

  const { unassignedCount: dailyUnassigned } = await getTodayExceptions()

  if (dailyUnassigned > 0) {
    const existing = await prisma.notification.findFirst({
      where: { userId: adminId, type: 'unassigned_daily_subscription', createdAt: { gte: today } },
    })
    if (!existing) {
      await createAndBroadcast({
        userId: adminId,
        type: 'unassigned_daily_subscription',
        title: 'طلاب غير موزعين في الاشتراكات اليومية',
        message: `يوجد ${dailyUnassigned} طالب باشتراك يومي غير موزعين اليوم`,
        priority: 'WARNING',
        dedupKey: `unassigned_daily_${dateKey}_${adminId}`,
      })
    }
  }
  return { dailyUnassigned }
}
