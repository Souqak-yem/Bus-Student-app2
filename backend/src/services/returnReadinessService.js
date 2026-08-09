import { prisma } from '../lib/prisma.js'
import {
  broadcastReadinessUpdate,
  broadcastBoardingTimerUpdate,
  broadcastReturnReadinessStats,
  broadcastDriverOperationUpdate,
  notifyAndBroadcastToBus,
  notifyStudent,
} from './socketService.js'

const DEFAULT_BOARDING_MINUTES = 15

const NOTIFICATION_MILESTONES = [
  { key: 'start', fraction: 0, field: 'notifiedStartSent' },
  { key: 'fiveMin', elapsedMin: 5, field: 'notifiedFiveMin', fallbackFraction: 1 / 3 },
  { key: 'before5', remainingMin: 5, field: 'notifiedBefore5', fallbackFraction: 2 / 3 },
  { key: 'before1', remainingMin: 1, field: 'notifiedBefore1', fallbackFraction: 9 / 10 },
  { key: 'end', fraction: 1, field: 'notifiedEnd' },
]

function milestoneShouldTrigger(milestone, elapsedMin, remainingMin, durationMin) {
  switch (milestone.key) {
    case 'start':
      return elapsedMin >= 0
    case 'fiveMin': {
      if (durationMin >= milestone.elapsedMin * 2) return elapsedMin >= milestone.elapsedMin
      const threshold = (milestone.fallbackFraction || 1 / 3) * durationMin
      return elapsedMin >= threshold
    }
    case 'before5': {
      if (durationMin >= milestone.remainingMin * 2) return remainingMin <= milestone.remainingMin
      const threshold = (1 - (milestone.fallbackFraction || 2 / 3)) * durationMin
      return remainingMin <= threshold
    }
    case 'before1': {
      if (durationMin >= milestone.remainingMin * 3) return remainingMin <= milestone.remainingMin
      const threshold = (1 - (milestone.fallbackFraction || 9 / 10)) * durationMin
      return remainingMin <= threshold
    }
    case 'end':
      return remainingMin <= 0
    default:
      return false
  }
}

export async function getDefaultBoardingMinutes() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: 'defaultBoardingMinutes' },
  })
  if (setting?.value) {
    const parsed = Number(setting.value)
    if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed)
  }
  return DEFAULT_BOARDING_MINUTES
}

export async function setDefaultBoardingMinutes(minutes) {
  const value = String(Math.max(1, Math.min(120, Number(minutes) || DEFAULT_BOARDING_MINUTES)))
  await prisma.appSetting.upsert({
    where: { key: 'defaultBoardingMinutes' },
    update: { value, valueType: 'number', description: 'Default boarding countdown timer in minutes for return trip' },
    create: { key: 'defaultBoardingMinutes', value, valueType: 'number', description: 'Default boarding countdown timer in minutes for return trip' },
  })
  return Number(value)
}

export async function getAppSetting(key) {
  const s = await prisma.appSetting.findUnique({ where: { key } })
  if (!s) return null
  if (s.valueType === 'number') return s.value ? Number(s.value) : null
  if (s.valueType === 'boolean') return s.value === 'true'
  if (s.valueType === 'json') {
    try { return JSON.parse(s.value || '{}') } catch { return {} }
  }
  return s.value
}

export async function setAppSetting(key, value, valueType = 'string', description) {
  const raw = valueType === 'json' ? JSON.stringify(value) : String(value)
  return prisma.appSetting.upsert({
    where: { key },
    update: { value: raw, valueType, ...(description ? { description } : {}) },
    create: { key, value: raw, valueType, description },
  })
}

export async function updateStudentReadiness(studentId, activeBusId, status, payload = {}) {
  const load = await prisma.busLoad.findFirst({
    where: { studentId, activeBusId },
    include: { activeBus: { include: { bus: true, driver: { select: { id: true, name: true } } } } },
  })
  if (!load) return null

  const now = new Date()
  const update = { readinessStatus: status, readinessUpdatedAt: now }

  if (status === 'DELAYED') {
    const { delayMinutes, delayReason } = payload
    update.delayMinutes = Number(delayMinutes) || null
    update.delayReason = delayReason || null
  } else {
    if (status !== 'ON_BOARD') {
      update.delayMinutes = null
      update.delayReason = null
    }
  }

  const updated = await prisma.busLoad.update({
    where: { id: load.id },
    data: update,
    include: {
      student: { select: { id: true, name: true, user: { select: { id: true } } } },
    },
  })

  broadcastReadinessUpdate(activeBusId, {
    busLoadId: load.id,
    studentId,
    status,
    delayMinutes: update.delayMinutes,
    delayReason: update.delayReason,
    updatedAt: now.toISOString(),
  })

  await emitStatsForActiveBus(activeBusId)
  return updated
}

export async function studentMarkReady(studentId, activeBusId) {
  return updateStudentReadiness(studentId, activeBusId, 'READY')
}

export async function studentMarkDelayed(studentId, activeBusId, delayMinutes, delayReason) {
  return updateStudentReadiness(studentId, activeBusId, 'DELAYED', { delayMinutes, delayReason })
}

export async function studentArrivedAtPickup(studentId, activeBusId) {
  return updateStudentReadiness(studentId, activeBusId, 'READY')
}

export async function driverMarkOnBoard(studentId, activeBusId, driverId) {
  const load = await prisma.busLoad.findFirst({ where: { studentId, activeBusId } })
  if (!load) return null

  const now = new Date()
  const updated = await prisma.busLoad.update({
    where: { id: load.id },
    data: { readinessStatus: 'ON_BOARD', readinessUpdatedAt: now, onBoardAt: now },
    include: {
      student: { select: { id: true, name: true, user: { select: { id: true } } } },
    },
  })

  broadcastReadinessUpdate(activeBusId, {
    busLoadId: load.id,
    studentId,
    status: 'ON_BOARD',
    updatedAt: now.toISOString(),
    onBoardAt: now.toISOString(),
  })

  const userId = updated.student?.user?.id
  if (userId) {
    try {
      const { createAndBroadcast } = await import('./notificationService.js')
      await createAndBroadcast({
        userId,
        type: 'student_return_onboard',
        title: '✅ تم تسجيل صعودك إلى الباص',
        message: 'تم تسجيل صعودك إلى باص العودة بنجاح. رحلة سعيدة!',
        priority: 'INFO',
        targetRoute: '/student',
        dedupKey: `student_return_onboard_${studentId}_${now.getTime()}`,
      })
    } catch { /* silent */ }
  }

  await emitStatsForActiveBus(activeBusId)
  return updated
}

export async function startBoardingTimer(activeBusId) {
  const activeBus = await prisma.activeBus.findUnique({
    where: { id: activeBusId },
    include: {
      bus: { select: { id: true, busNumber: true } },
      driver: { select: { id: true, name: true } },
      loads: {
        include: {
          student: {
            include: { user: { select: { id: true } } },
          },
        },
      },
    },
  })
  if (!activeBus) return null
  if (['DEPARTED', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'].indexOf(activeBus.status) !== -1) return null

  const minutes = await getDefaultBoardingMinutes()
  const now = new Date()

  const existing = await prisma.returnBoardingTimer.findUnique({ where: { activeBusId } })
  if (existing?.endedAt) return null

  await prisma.activeBus.update({
    where: { id: activeBusId },
    data: { status: 'BOARDING' },
  })

  const timer = await prisma.returnBoardingTimer.upsert({
    where: { activeBusId },
    update: { startedAt: now, durationMinutes: minutes, endedAt: null, notifiedStartSent: false, notifiedFiveMin: false, notifiedBefore5: false, notifiedBefore1: false, notifiedEnd: false },
    create: { activeBusId, startedAt: now, durationMinutes: minutes },
    include: { activeBus: true },
  })

  broadcastBoardingTimerUpdate(activeBusId, {
    activeBusId,
    startedAt: now.toISOString(),
    durationMinutes: minutes,
    endedAt: null,
    serverNow: now.toISOString(),
    status: 'BOARDING',
  })

  broadcastDriverOperationUpdate(activeBus.bus?.id, {
    type: 'return:boarding-started',
    activeBusId,
    status: 'BOARDING',
    startedAt: now.toISOString(),
    durationMinutes: minutes,
  })

  try {
    notifyAndBroadcastToBus(activeBus.bus?.id, {
      activeBusId,
      type: 'driver_return_boarding_started',
      title: '🚍 بدء وقت الصعود',
      message: `بدأ العد التنازلي (${minutes} دقيقة) لباص ${activeBus.bus?.busNumber || ''}.`,
      priority: 'HIGH',
    }).catch(() => {})
  } catch { /* silent */ }

  const loads = activeBus.loads || []
  for (const l of loads) {
    const userId = l.student?.user?.id
    if (!userId) continue
    try {
      notifyStudent({
        userId,
        type: 'student_return_boarding_started',
        title: '🚍 بدء وقت الصعود',
        message: `وصل باص العودة رقم ${activeBus.bus?.busNumber || ''}. بقي ${minutes} دقيقة للانطلاق!`,
        priority: 'HIGH',
        targetRoute: '/student',
        dedupKey: `student_boarding_start_${activeBusId}_${l.studentId}`,
      }).catch(() => {})
    } catch { /* silent */ }
  }

  sendNotificationMilestone(activeBusId, 'start').catch(() => {})
  return timer
}

export async function stopBoardingTimer(activeBusId) {
  const timer = await prisma.returnBoardingTimer.findUnique({ where: { activeBusId } })
  if (!timer) return null

  const updated = await prisma.returnBoardingTimer.update({
    where: { id: timer.id },
    data: { endedAt: new Date() },
  })

  broadcastBoardingTimerUpdate(activeBusId, {
    activeBusId,
    endedAt: new Date().toISOString(),
    forced: true,
  })

  return updated
}

export async function sendNotificationMilestone(activeBusId, milestoneKey) {
  const timer = await prisma.returnBoardingTimer.findUnique({
    where: { activeBusId },
    include: {
      activeBus: {
        include: {
          loads: {
            include: {
              student: {
                include: {
                  user: { select: { id: true } }
                }
              }
            }
          }
        }
      }
    }
  })
  if (!timer || timer.endedAt) return

  const milestone = NOTIFICATION_MILESTONES.find(function (m) { return m.key === milestoneKey })
  if (!milestone) return

  if (timer[milestone.field]) return

  await prisma.returnBoardingTimer.update({
    where: { id: timer.id },
    data: { [milestone.field]: true },
  })

  const titleResult = milestoneTitle(milestoneKey, timer.durationMinutes)
  const titleTemplate = titleResult.titleTemplate
  const bodyTemplate = titleResult.bodyTemplate
  const loads = timer.activeBus.loads

  const moduleNS = await import('./notificationService.js')
  const createAndBroadcast = moduleNS.createAndBroadcast
  for (const load of loads) {
    if (['ON_BOARD', 'MISSED_BUS'].indexOf(load.readinessStatus) !== -1) continue
    const userId = load.student && load.student.user ? load.student.user.id : null
    if (!userId) continue
    try {
      await createAndBroadcast({
        userId: userId,
        type: 'boarding_' + milestoneKey,
        title: titleTemplate,
        message: bodyTemplate,
        priority: milestoneKey === 'end' ? 'CRITICAL' : 'INFO',
        targetRoute: '/student',
        dedupKey: 'boarding_' + milestoneKey + '_' + activeBusId + '_' + load.studentId,
      })
    } catch (e2) {
      // silent
    }
  }
}

export function milestoneTitle(key, durationMin) {
  switch (key) {
    case 'start':
      return { titleTemplate: 'بدء تسجيل الصعود', bodyTemplate: `وصل باص العودة. يبدأ الآن العد التنازلي (${durationMin} دقيقة) لتسجيل الصعود.` }
    case 'fiveMin':
      return { titleTemplate: 'تذكير: مضي 5 دقائق', bodyTemplate: 'مضي جزء كبير من الوقت. يرجى التوجه للباص فوراً.' }
    case 'before5':
      return { titleTemplate: 'تنبيه: قرب انتهاء الوقت', bodyTemplate: 'باقي وقت قليل على انتهاء تسجيل الصعود. توجه إلى الباص الآن.' }
    case 'before1':
      return { titleTemplate: 'تنبيه أخير: دقيقة واحدة', bodyTemplate: 'باقي لحظات فقط على إغلاق الباب. تعال الآن! سيتم اعتبارك فائت في حال عدم الحضور.' }
    case 'end':
      return { titleTemplate: 'انتهى وقت الصعود', bodyTemplate: 'انتهى وقت تسجيل الصعود. يرجى مراجعة الإدارة إذا فاتك الباص.' }
    default:
      return { titleTemplate: 'تنبيه الصعود', bodyTemplate: 'تنبيه متعلق بوقت تسجيل الصعود.' }
  }
}

export async function tickBoardingTimers() {
  const timers = await prisma.returnBoardingTimer.findMany({
    where: { endedAt: null },
  })

  const now = new Date()

  for (const timer of timers) {
    const startedAt = new Date(timer.startedAt)
    const endMs = startedAt.getTime() + timer.durationMinutes * 60 * 1000
    const elapsedMs = now.getTime() - startedAt.getTime()
    const remainingMs = endMs - now.getTime()
    const elapsedMin = elapsedMs / 60000
    const remainingMin = remainingMs / 60000
    const durationMin = timer.durationMinutes

    const fiveMin = NOTIFICATION_MILESTONES.find(m => m.key === 'fiveMin')
    const before5 = NOTIFICATION_MILESTONES.find(m => m.key === 'before5')
    const before1 = NOTIFICATION_MILESTONES.find(m => m.key === 'before1')
    const endM = NOTIFICATION_MILESTONES.find(m => m.key === 'end')

    if (fiveMin && !timer.notifiedFiveMin && milestoneShouldTrigger(fiveMin, elapsedMin, remainingMin, durationMin)) {
      sendNotificationMilestone(timer.activeBusId, 'fiveMin').catch(() => {})
    }
    if (before5 && !timer.notifiedBefore5 && milestoneShouldTrigger(before5, elapsedMin, remainingMin, durationMin)) {
      sendNotificationMilestone(timer.activeBusId, 'before5').catch(() => {})
    }
    if (before1 && !timer.notifiedBefore1 && milestoneShouldTrigger(before1, elapsedMin, remainingMin, durationMin)) {
      sendNotificationMilestone(timer.activeBusId, 'before1').catch(() => {})
    }
    if (endM && !timer.notifiedEnd && milestoneShouldTrigger(endM, elapsedMin, remainingMin, durationMin)) {
      await sendNotificationMilestone(timer.activeBusId, 'end')
      await finalizeMissedBus(timer.activeBusId)
      try {
        const ab = await prisma.activeBus.findUnique({
          where: { id: timer.activeBusId },
          select: { id: true, status: true, busId: true, bus: { select: { id: true, busNumber: true } } },
        })
        if (ab && ab.status === 'BOARDING') {
          await prisma.activeBus.update({
            where: { id: timer.activeBusId },
            data: { status: 'BOARDING_TIME_ENDED' },
          })
          broadcastDriverOperationUpdate(ab.busId, {
            type: 'return:boarding-time-ended',
            activeBusId: timer.activeBusId,
            status: 'BOARDING_TIME_ENDED',
          })
          try {
            notifyAndBroadcastToBus(ab.busId, {
              activeBusId: timer.activeBusId,
              type: 'driver_return_boarding_ended',
              title: '⏰ انتهى وقت الصعود',
              message: `انتهى وقت تجميع الطلاب لباص ${ab.bus?.busNumber || ''}. اضغط \"انطلاق الباص\" للبدء أو اتصال بالمشرف.`,
              priority: 'HIGH',
            }).catch(() => {})
          } catch { /* silent */ }
        }
      } catch { /* silent */ }
    }

    broadcastBoardingTimerUpdate(timer.activeBusId, {
      activeBusId: timer.activeBusId,
      startedAt: timer.startedAt.toISOString(),
      durationMinutes: timer.durationMinutes,
      serverNow: now.toISOString(),
      endedAt: timer.endedAt ? timer.endedAt.toISOString() : null,
    })
  }
}

export async function finalizeMissedBus(activeBusId) {
  const pending = await prisma.busLoad.findMany({
    where: {
      activeBusId,
      readinessStatus: { notIn: ['ON_BOARD', 'MISSED_BUS'] },
    },
  })
  if (pending.length === 0) return

  const now = new Date()
  const { createAndBroadcast } = await import('./notificationService.js')
  const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })

  for (const load of pending) {
    await prisma.busLoad.update({
      where: { id: load.id },
      data: { readinessStatus: 'MISSED_BUS', readinessUpdatedAt: now },
    })

    broadcastReadinessUpdate(activeBusId, {
      busLoadId: load.id,
      studentId: load.studentId,
      status: 'MISSED_BUS',
      updatedAt: now.toISOString(),
    })

    try {
      const userRow = await prisma.user.findUnique({ where: { studentId: load.studentId }, select: { id: true } })
      if (userRow) {
        await createAndBroadcast({
          userId: userRow.id,
          type: 'student_return_missed',
          title: '⛔ فاتك الباص',
          message: 'انتهى وقت تسجيل الصعود وتم اعتبارك فائتاً للباص. يرجى مراجعة الإدارة.',
          priority: 'CRITICAL',
          targetRoute: '/student',
          dedupKey: `missed_bus_${load.studentId}_${now.getTime()}`,
        })
      }
    } catch { /* silent */ }

    for (const admin of admins) {
      try {
        await createAndBroadcast({
          userId: admin.id,
          type: 'admin_missed_bus',
          title: 'طالب فات الباص',
          message: `طالب بمعرف ${load.studentId} فات صعود باص العودة (الباص: ${activeBusId}).`,
          priority: 'WARNING',
          targetRoute: '/admin/return',
          dedupKey: `admin_missed_${load.studentId}_${activeBusId}`,
          data: { studentId: load.studentId, activeBusId },
        })
      } catch { /* silent */ }
    }
  }

  await emitStatsForActiveBus(activeBusId)
}

export async function getReturnReadinessStats(activeBusId) {
  const loads = await prisma.busLoad.findMany({
    where: { activeBusId },
    select: { readinessStatus: true },
  })
  const counts = { READY: 0, DELAYED: 0, NO_RESPONSE: 0, ON_BOARD: 0, MISSED_BUS: 0, total: loads.length }
  for (const l of loads) counts[l.readinessStatus || 'NO_RESPONSE'] = (counts[l.readinessStatus || 'NO_RESPONSE'] || 0) + 1
  return counts
}

export async function emitStatsForActiveBus(activeBusId) {
  const stats = await getReturnReadinessStats(activeBusId)
  broadcastReturnReadinessStats(activeBusId, stats)
  return stats
}

export async function getReturnDashboardForStudent(studentId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const op = await prisma.dailyOperation.findFirst({
    where: { operationDate: { gte: today, lt: tomorrow } },
  })
  if (!op) return { operationExists: false, bus: null, readiness: null, timer: null, sequence: [] }

  const load = await prisma.busLoad.findFirst({
    where: {
      studentId,
      activeBus: {
        operationId: op.id,
        tripType: 'RETURN',
      },
    },
    include: {
      activeBus: {
        include: {
          bus: { select: { id: true, busNumber: true, plateNumber: true, model: true } },
          driver: { select: { id: true, name: true, phone: true } },
          boardingTimer: true,
        },
      },
    },
  })

  const queueEntry = await prisma.returnQueue.findFirst({
    where: { operationId: op.id, studentId, status: { not: 'DEPARTED' } },
    orderBy: { enteredAt: 'desc' },
  })

  if (!load) {
    return {
      operationExists: true,
      bus: null,
      readiness: null,
      timer: null,
      queueStatus: queueEntry ? queueEntry.status : null,
    }
  }

  const readinessStats = await getReturnReadinessStats(load.activeBus.id)

  return {
    operationExists: true,
    busLoadId: load.id,
    bus: load.activeBus.bus,
    driver: load.activeBus.driver,
    activeBusId: load.activeBus.id,
    readiness: {
      status: load.readinessStatus || 'NO_RESPONSE',
      delayMinutes: load.delayMinutes,
      delayReason: load.delayReason,
      onBoardAt: load.onBoardAt ? load.onBoardAt.toISOString() : null,
      updatedAt: load.readinessUpdatedAt ? load.readinessUpdatedAt.toISOString() : null,
      assignedAt: load.assignedAt.toISOString(),
      droppedOffAt: load.droppedOffAt ? load.droppedOffAt.toISOString() : null,
    },
    timer: load.activeBus.boardingTimer
      ? {
        startedAt: load.activeBus.boardingTimer.startedAt.toISOString(),
        durationMinutes: load.activeBus.boardingTimer.durationMinutes,
        endedAt: load.activeBus.boardingTimer.endedAt ? load.activeBus.boardingTimer.endedAt.toISOString() : null,
        serverNow: new Date().toISOString(),
      }
      : null,
    busStatus: load.activeBus.status,
    readinessStats,
  }
}

export async function getBoardingChecklistForDriver(driverId) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const op = await prisma.dailyOperation.findFirst({
    where: { operationDate: { gte: today, lt: tomorrow } },
  })
  if (!op) return { operationExists: false, buses: [] }

  const buses = await prisma.activeBus.findMany({
    where: { operationId: op.id, tripType: 'RETURN', driverId, status: { notIn: ['CANCELLED', 'BROKEN_DOWN', 'REPLACED'] }, returnCompletedAt: null },
    include: {
      bus: { select: { id: true, busNumber: true, plateNumber: true, capacity: true, model: true } },
      loads: {
        include: {
          student: { select: { id: true, name: true, phone: true, whatsapp: true, transportMode: true, homeAddress: true, pickupLocation: true, address: true, institutionName: true, homeDeliveryFee: true, homeNotes: true } },
        },
        orderBy: [{ readinessStatus: 'desc' }, { sortOrder: 'asc' }, { assignedAt: 'asc' }],
      },
      boardingTimer: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const now = new Date()
  return {
    operationExists: true,
    buses: buses.map(b => ({
      id: b.id,
      bus: b.bus,
      status: b.status,
      loads: b.loads.map(l => ({
        id: l.id,
        student: l.student,
        studentId: l.studentId,
        sortOrder: l.sortOrder,
        readinessStatus: l.readinessStatus || 'NO_RESPONSE',
        delayMinutes: l.delayMinutes,
        delayReason: l.delayReason,
        onBoardAt: l.onBoardAt ? l.onBoardAt.toISOString() : null,
      })),
      boardingTimer: b.boardingTimer ? {
        startedAt: b.boardingTimer.startedAt.toISOString(),
        durationMinutes: b.boardingTimer.durationMinutes,
        endedAt: b.boardingTimer.endedAt ? b.boardingTimer.endedAt.toISOString() : null,
        serverNow: now.toISOString(),
      } : null,
    })),
  }
}

export { DEFAULT_BOARDING_MINUTES }
