import { prisma } from '../lib/prisma.js'
import { createAuditLog } from '../lib/audit.js'
import { broadcastEmergencyReport, broadcastReportUpdate, notifyStudent } from './socketService.js'
import { createAndBroadcast } from './notificationService.js'
import { getLocalDate } from '../utils/dateUtils.js'

export function buildEmergencyBusList({ assignments = [], activeBuses = [], busRecords = [] }) {
  const activeStatusMap = new Map(activeBuses.map(ab => [ab.busId, ab.status]))
  const busMap = new Map()

  for (const activeBus of activeBuses) {
    const busId = activeBus?.busId
    if (!busId) continue

    const busInfo = activeBus.bus || null
    if (!busMap.has(busId)) {
      busMap.set(busId, {
        busId,
        busNumber: busInfo?.busNumber || busInfo?.bus?.busNumber || null,
        capacity: busInfo?.capacity || busInfo?.bus?.capacity || null,
        driver: busInfo?.driver || busInfo?.bus?.driver || null,
        studentCount: 0,
        students: [],
        status: activeStatusMap.get(busId) || 'AVAILABLE',
      })
    }
  }

  for (const record of busRecords) {
    if (!record?.busId) continue
    if (!busMap.has(record.busId)) {
      busMap.set(record.busId, {
        busId: record.busId,
        busNumber: record.busNumber,
        capacity: record.capacity,
        driver: record.driver,
        studentCount: 0,
        students: [],
        status: activeStatusMap.get(record.busId) || 'AVAILABLE',
      })
    } else {
      const existing = busMap.get(record.busId)
      if (!existing.busNumber) existing.busNumber = record.busNumber
      if (!existing.capacity) existing.capacity = record.capacity
      if (!existing.driver) existing.driver = record.driver
    }
  }

  for (const a of assignments) {
    const bus = a.bus
    if (!busMap.has(bus.id)) {
      busMap.set(bus.id, {
        busId: bus.id,
        busNumber: bus.busNumber,
        capacity: bus.capacity,
        driver: bus.driver,
        studentCount: 0,
        students: [],
        status: activeStatusMap.get(bus.id) || 'AVAILABLE',
      })
    }

    const bd = busMap.get(bus.id)
    bd.studentCount++
    bd.students.push({
      assignmentId: a.id,
      studentId: a.studentId,
      studentName: a.student.name,
      sortOrder: a.sortOrder,
      status: a.status,
    })
  }

  return Array.from(busMap.values()).map(b => ({
    ...b,
    remainingCapacity: (b.capacity || 0) - (b.studentCount || 0),
    fillPercent: b.capacity > 0 ? Math.round(((b.studentCount || 0) / b.capacity) * 100) : 0,
  }))
}

export async function getEmergencyBuses() {
  const today = getLocalDate()

  const assignments = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING' },
    include: {
      student: { select: { id: true, name: true } },
      bus: { select: { id: true, busNumber: true, capacity: true, driver: { select: { id: true, name: true, phone: true } } } }
    },
    orderBy: [{ busId: 'asc' }, { sortOrder: 'asc' }]
  })

  const activeBuses = await prisma.activeBus.findMany({
    where: { operation: { operationDate: today }, status: { not: 'CANCELLED' } },
    include: {
      bus: {
        select: {
          id: true,
          busNumber: true,
          capacity: true,
          driver: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: [{ busId: 'asc' }],
  })

  const activeBusIds = activeBuses.map(ab => ab.busId)
  const busRecords = activeBusIds.length > 0 ? await prisma.bus.findMany({
    where: { id: { in: activeBusIds }, status: 'active' },
    select: {
      id: true,
      busNumber: true,
      capacity: true,
      driver: { select: { id: true, name: true, phone: true } },
    },
  }) : []

  return buildEmergencyBusList({ assignments, activeBuses, busRecords })
}

export async function declareBreakdown(busId, userId, reason) {
  const today = getLocalDate()

  const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  if (!operation) throw new Error('لا يوجد تشغيل لليوم')

  const activeBus = await prisma.activeBus.findFirst({
    where: { operationId: operation.id, busId, status: { not: 'CANCELLED' } }
  })

  if (activeBus) {
    if (activeBus.status === 'BROKEN_DOWN') throw new Error('الباص معطل بالفعل')
    if (activeBus.status === 'REPLACED') throw new Error('تم استبدال هذا الباص بالفعل')
    await prisma.activeBus.update({
      where: { id: activeBus.id },
      data: { status: 'BROKEN_DOWN' }
    })
  }

  const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { busNumber: true } })

  await prisma.emergencyLog.create({
    data: {
      busId, busNumber: bus?.busNumber, action: 'DECLARE_BREAKDOWN', reason,
      performedById: userId, details: { reason }
    }
  })

  await createAuditLog({
    userId, action: 'EMERGENCY_BREAKDOWN', entityType: 'Bus', entityId: busId,
    newValue: { busNumber: bus?.busNumber, reason, status: 'BROKEN_DOWN' },
    reason: `إعلان تعطل الباص رقم ${bus?.busNumber || busId}`
  })

  await notifyAdmins(userId, 'emergency_breakdown',
    `إعلان تعطل الباص رقم ${bus?.busNumber || ''}`,
    `تم إعلان تعطل الباص رقم ${bus?.busNumber || ''} بسبب ${getReasonText(reason)}`
  )

  const breakdownStudents = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING', busId },
    select: { studentId: true },
  })
  for (const bs of breakdownStudents) {
    const breakdownUser = await prisma.user.findUnique({ where: { studentId: bs.studentId }, select: { id: true } })
    if (breakdownUser?.id) {
      notifyStudent({
        userId: breakdownUser.id, type: 'student_emergency_breakdown', title: 'عطل في الباص',
        message: `يوجد عطل في الباص رقم ${bus?.busNumber || ''}. يرجى انتظار التعليمات.`,
        targetRoute: '/student',
        priority: 'CRITICAL',
      })
    }
  }

  return { busId, busNumber: bus?.busNumber, status: 'BROKEN_DOWN', reason }
}

export async function autoTransferStudents(fromBusId, toBusIds, userId, reason) {
  const today = getLocalDate()

  if (!toBusIds || toBusIds.length === 0) throw new Error('يجب اختيار باص واحد على الأقل')

  const fromAssignments = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING', busId: fromBusId },
    orderBy: { sortOrder: 'asc' },
    include: { student: { select: { name: true } } }
  })

  if (fromAssignments.length === 0) throw new Error('لا يوجد طلاب في الباص المعطل')

  const targetBuses = await prisma.bus.findMany({
    where: { id: { in: toBusIds }, status: 'active' },
    select: { id: true, busNumber: true, capacity: true }
  })
  if (targetBuses.length === 0) throw new Error('لا توجد باصات نشاط متاحة للنقل')

  const capacityMap = new Map()
  for (const tb of targetBuses) {
    const currentCount = await prisma.assignment.count({
      where: { date: today, period: 'MORNING', busId: tb.id }
    })
    const available = tb.capacity - currentCount
    if (available <= 0) continue
    capacityMap.set(tb.id, { busNumber: tb.busNumber, available, totalCapacity: tb.capacity, currentCount })
  }

  if (capacityMap.size === 0) throw new Error('لا توجد مقاعد متاحة في الباصات المختارة')

  const totalAvailable = Array.from(capacityMap.values()).reduce((sum, c) => sum + c.available, 0)
  if (totalAvailable < fromAssignments.length) {
    const deficit = fromAssignments.length - totalAvailable
    throw new Error(`المقاعد غير كافية. تحتاج ${deficit} مقعد(اً) إضافي(اً)`)
  }

  const busCapacityList = Array.from(capacityMap.entries())
  const transfers = []
  let busIndex = 0
  const busUsage = new Map(busCapacityList.map(([id, info]) => [id, { ...info, used: 0 }]))

  for (const assignment of fromAssignments) {
    while (busIndex < busCapacityList.length) {
      const [targetId, info] = busCapacityList[busIndex]
      const usage = busUsage.get(targetId)
      if (usage.used < usage.available) {
        transfers.push({
          assignmentId: assignment.id,
          studentId: assignment.studentId,
          studentName: assignment.student.name,
          fromBusId,
          toBusId: targetId,
          toBusNumber: info.busNumber,
        })
        usage.used++
        break
      }
      busIndex++
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const t of transfers) {
      await tx.assignment.delete({ where: { id: t.assignmentId } })
    }

    const targetBusNumbers = [...new Set(transfers.map(t => t.toBusNumber))]
    const targetCapacity = new Map(targetBuses.map(b => [b.id, b.capacity]))

    const sortOrders = new Map()
    for (const t of transfers) {
      if (!sortOrders.has(t.toBusId)) {
        const maxOrder = await tx.assignment.aggregate({
          where: { date: today, period: 'MORNING', busId: t.toBusId },
          _max: { sortOrder: true }
        })
        sortOrders.set(t.toBusId, (maxOrder._max.sortOrder ?? -1) + 1)
      }

      await tx.assignment.create({
        data: {
          studentId: t.studentId, busId: t.toBusId, date: today, period: 'MORNING',
          line: 'JEBALI', status: 'scheduled', isGenerated: false,
          sortOrder: sortOrders.get(t.toBusId)++
        }
      })
    }
  })

  const fromBus = await prisma.bus.findUnique({ where: { id: fromBusId }, select: { busNumber: true } })

  const busUsageResult = {}
  for (const [id, usage] of busUsage) {
    if (usage.used > 0) {
      busUsageResult[id] = { busNumber: usage.busNumber, used: usage.used, remaining: usage.available - usage.used }
    }
  }

  // Clean up return trip data for the broken bus
  const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  if (operation) {
    const brokenActiveBus = await prisma.activeBus.findFirst({
      where: { operationId: operation.id, busId: fromBusId, status: { not: 'CANCELLED' } },
    })
    if (brokenActiveBus) {
      const brokenLoads = await prisma.busLoad.findMany({
        where: { activeBusId: brokenActiveBus.id },
        select: { studentId: true },
      })
      if (brokenLoads.length > 0) {
        await prisma.busLoad.deleteMany({ where: { activeBusId: brokenActiveBus.id } })
        const brokenStudentIds = brokenLoads.map(l => l.studentId)
        await prisma.returnQueue.updateMany({
          where: { operationId: operation.id, studentId: { in: brokenStudentIds } },
          data: { status: 'WAITING' },
        })
      }
    }
  }

  const emergencyDetails = {
    reason: reason || 'MECHANICAL',
    fromBusNumber: fromBus?.busNumber,
    totalStudents: fromAssignments.length,
    transferredCount: transfers.length,
    targetBuses: busUsageResult
  }

  await prisma.emergencyLog.create({
    data: {
      busId: fromBusId, busNumber: fromBus?.busNumber,
      action: 'AUTO_TRANSFER', reason: reason || 'MECHANICAL',
      performedById: userId, details: emergencyDetails
    }
  })

  const targetList = Object.values(busUsageResult).map(u => `${u.busNumber} (${u.used})`).join('، ')
  await createAuditLog({
    userId, action: 'EMERGENCY_AUTO_TRANSFER', entityType: 'Bus', entityId: fromBusId,
    newValue: emergencyDetails,
    reason: `نقل تلقائي ${transfers.length} طالب من الباص ${fromBus?.busNumber} إلى ${targetList}`
  })

  const students = transfers.map(t => ({ studentName: t.studentName, toBusNumber: t.toBusNumber }))
  await notifyAdmins(userId, 'emergency_transfer',
    `اكتمل النقل التلقائي - الباص ${fromBus?.busNumber || ''}`,
    `تم نقل ${transfers.length} طالب من الباص ${fromBus?.busNumber || ''}`
  )
  await notifyAffectedStudents(transfers, userId)

  return {
    success: true,
    fromBus: fromBus?.busNumber,
    totalStudents: fromAssignments.length,
    transferredCount: transfers.length,
    targetBuses: busUsageResult,
    students
  }
}

export async function manualTransferStudents(fromBusId, transfers, userId, reason) {
  const today = getLocalDate()

  if (!transfers || transfers.length === 0) throw new Error('يجب نقل طالب واحد على الأقل')

  const fromBus = await prisma.bus.findUnique({ where: { id: fromBusId }, select: { busNumber: true } })

  const result = { transferred: [], errors: [], total: transfers.length }

  await prisma.$transaction(async (tx) => {
    for (const t of transfers) {
      const assignment = await tx.assignment.findUnique({
        where: { studentId_date_period: { studentId: t.studentId, date: today, period: 'MORNING' } }
      })

      if (!assignment) {
        result.errors.push({ studentId: t.studentId, reason: 'لا يوجد رحلة للطالب اليوم' })
        continue
      }
      if (assignment.busId !== fromBusId) {
        result.errors.push({ studentId: t.studentId, reason: 'الطالب ليس في الباص المعطل' })
        continue
      }

      const targetBus = await tx.bus.findUnique({ where: { id: t.toBusId }, select: { capacity: true, busNumber: true } })
      if (!targetBus) {
        result.errors.push({ studentId: t.studentId, reason: 'الباص الهدف غير موجود' })
        continue
      }

      const currentCount = await tx.assignment.count({
        where: { date: today, period: 'MORNING', busId: t.toBusId }
      })
      if (currentCount + 1 > targetBus.capacity) {
        result.errors.push({ studentId: t.studentId, reason: `الباص ${targetBus.busNumber} ممتلئ` })
        continue
      }

      const existingInTarget = await tx.assignment.findUnique({
        where: { studentId_date_period: { studentId: t.studentId, date: today, period: 'MORNING' } }
      })
      if (existingInTarget && existingInTarget.busId === t.toBusId) {
        result.errors.push({ studentId: t.studentId, reason: 'الطالب موجود بالفعل في الباص الهدف' })
        continue
      }

      const student = await tx.student.findUnique({ where: { id: t.studentId }, select: { name: true } })

      await tx.assignment.delete({ where: { id: assignment.id } })

      const maxOrder = await tx.assignment.aggregate({
        where: { date: today, period: 'MORNING', busId: t.toBusId },
        _max: { sortOrder: true }
      })

      await tx.assignment.create({
        data: {
          studentId: t.studentId, busId: t.toBusId, date: today, period: 'MORNING',
          line: 'JEBALI', status: 'scheduled', isGenerated: false,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        }
      })

      result.transferred.push({
        studentId: t.studentId, studentName: student?.name || '',
        fromBusId, toBusId: t.toBusId, toBusNumber: targetBus.busNumber
      })
    }
  })

  if (result.transferred.length > 0) {
    const emergencyDetails = {
      reason: reason || 'MANUAL',
      fromBusNumber: fromBus?.busNumber,
      totalRequested: transfers.length,
      transferredCount: result.transferred.length,
      errorCount: result.errors.length,
      transfers: result.transferred.map(t => ({ studentName: t.studentName, toBusNumber: t.toBusNumber }))
    }

    await prisma.emergencyLog.create({
      data: {
        busId: fromBusId, busNumber: fromBus?.busNumber,
        action: 'MANUAL_TRANSFER', reason: reason || 'MANUAL',
        performedById: userId, details: emergencyDetails
      }
    })

    const targetList = [...new Set(result.transferred.map(t => t.toBusNumber))].join('، ')
    await createAuditLog({
      userId, action: 'EMERGENCY_MANUAL_TRANSFER', entityType: 'Bus', entityId: fromBusId,
      newValue: emergencyDetails,
      reason: `نقل يدوي ${result.transferred.length} طالب من الباص ${fromBus?.busNumber} إلى ${targetList}`
    })

    await notifyAffectedStudents(result.transferred, userId)
  }

  return result
}

export async function replaceBus(fromBusId, toBusId, userId, reason) {
  const today = getLocalDate()

  if (fromBusId === toBusId) throw new Error('لا يمكن استبدال الباص بنفسه')

  const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  if (!operation) throw new Error('لا يوجد تشغيل لليوم')

  const fromBus = await prisma.bus.findUnique({ where: { id: fromBusId }, select: { busNumber: true, capacity: true } })
  const toBus = await prisma.bus.findUnique({ where: { id: toBusId }, select: { busNumber: true, capacity: true, driver: true } })
  if (!fromBus || !toBus) throw new Error('الباص غير موجود')

  const fromActiveBus = await prisma.activeBus.findFirst({
    where: { operationId: operation.id, busId: fromBusId, status: { not: 'CANCELLED' } }
  })
  if (fromActiveBus) {
    await prisma.activeBus.update({ where: { id: fromActiveBus.id }, data: { status: 'REPLACED' } })
  }

  await prisma.$transaction(async (tx) => {
    const assignments = await tx.assignment.findMany({
      where: { date: today, period: 'MORNING', busId: fromBusId }
    })

    const studentCount = await tx.assignment.count({
      where: { date: today, period: 'MORNING', busId: toBusId }
    })
    if (studentCount + assignments.length > toBus.capacity) {
      throw new Error(`سعة الباص ${toBus.busNumber} غير كافية. متاح ${toBus.capacity - studentCount} مقعد`)
    }

    await tx.assignment.updateMany({
      where: { date: today, period: 'MORNING', busId: fromBusId },
      data: { busId: toBusId }
    })

    const existsToActive = await tx.activeBus.findFirst({
      where: { operationId: operation.id, busId: toBusId, status: { not: 'CANCELLED' } }
    })
    if (!existsToActive) {
      const driverId = toBus.driver?.id || null
      if (driverId) {
        await tx.activeBus.create({
          data: {
            operationId: operation.id, busId: toBusId, driverId,
            capacitySnapshot: toBus.capacity
          }
        })
      }
    }

    const fromActiveBusId = fromActiveBus?.id
    if (toBus.driver && fromActiveBusId) {
      const existingLoads = await tx.busLoad.findMany({
        where: { activeBusId: fromActiveBusId }
      })
      if (existingLoads.length > 0) {
        let toActiveBus = existsToActive || await tx.activeBus.findFirst({
          where: { operationId: operation.id, busId: toBusId, status: { not: 'CANCELLED' } }
        })
        if (toActiveBus) {
          await tx.busLoad.updateMany({
            where: { activeBusId: fromActiveBusId },
            data: { activeBusId: toActiveBus.id }
          })
        }
      }
    }
  })

  const emergencyDetails = { reason: reason || 'REPLACEMENT', fromBusNumber: fromBus.busNumber, toBusNumber: toBus.busNumber }

  await prisma.emergencyLog.create({
    data: {
      busId: fromBusId, busNumber: fromBus.busNumber,
      action: 'REPLACEMENT', reason: reason || 'REPLACEMENT',
      performedById: userId, details: emergencyDetails
    }
  })

  await createAuditLog({
    userId, action: 'EMERGENCY_REPLACE_BUS', entityType: 'Bus', entityId: fromBusId,
    newValue: emergencyDetails,
    reason: `استبدال الباص ${fromBus.busNumber} بالباص ${toBus.busNumber}`
  })

  const replaceStudents = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING', busId: toBusId },
    select: { studentId: true },
  })
  for (const rs of replaceStudents) {
    const replaceUser = await prisma.user.findUnique({ where: { studentId: rs.studentId }, select: { id: true } })
    if (replaceUser?.id) {
      notifyStudent({
        userId: replaceUser.id, type: 'student_bus_changed', title: 'تم تغيير الباص',
        message: `تم استبدال الباص ${fromBus.busNumber} بالباص ${toBus.busNumber}`,
        targetRoute: '/student',
        dedupKey: `student_bus_changed_${rs.studentId}_${today.getTime()}`,
      })
    }
  }

  return {
    success: true,
    fromBus: fromBus.busNumber,
    toBus: toBus.busNumber,
  }
}

export async function getEmergencyLogs() {
  const logs = await prisma.emergencyLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { performedBy: { select: { id: true, name: true } } }
  })

  return logs.map(log => ({
    id: log.id,
    busId: log.busId,
    busNumber: log.busNumber,
    action: log.action,
    reason: log.reason,
    details: log.details,
    performedBy: log.performedBy,
    createdAt: log.createdAt,
  }))
}

async function notifyAdmins(userId, type, title, message) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' } })
    for (const admin of admins) {
      await createAndBroadcast({
        userId: admin.id,
        type,
        title,
        message,
        dedupKey: `${type}_${admin.id}`,
      })
    }
  } catch (e) {
    // silent
  }
}

async function notifyAffectedStudents(transfers) {
  try {
    for (const t of transfers) {
      const user = await prisma.user.findUnique({ where: { studentId: t.studentId } })
      if (user) {
        notifyStudent({
          userId: user.id,
          type: 'student_emergency_transferred',
          title: 'تم نقلك إلى باص آخر',
          message: `تم نقلك إلى الباص رقم ${t.toBusNumber} بسبب تعطل الباص الأساسي`,
          targetRoute: '/student',
          priority: 'CRITICAL',
        })
      }
    }
  } catch (e) {
    // silent
  }
}

function getReasonText(reason) {
  const map = { MECHANICAL: 'عطل ميكانيكي', ACCIDENT: 'حادث', DRIVER_ABSENT: 'اعتذار السائق', OTHER: 'أخرى' }
  return map[reason] || reason
}

// ─── Emergency Reports (V2) ───

export async function createEmergencyReport(busId, driverId, reason, notes) {
  const today = getLocalDate()

  const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  if (!operation) throw new Error('لا يوجد تشغيل لليوم')

  const activeBus = await prisma.activeBus.findFirst({
    where: { operationId: operation.id, busId, status: { not: 'CANCELLED' } }
  })
  if (activeBus && (activeBus.status === 'ARRIVED')) throw new Error('لا يمكن الإبلاغ بعد انتهاء الرحلة')

  const existingReport = await prisma.emergencyReport.findFirst({
    where: { busId, status: { in: ['PENDING_REVIEW', 'APPROVED'] } }
  })
  if (existingReport) {
    if (existingReport.status === 'PENDING_REVIEW') throw new Error('يوجد بلاغ قيد المراجعة لهذا الباص')
    if (existingReport.status === 'APPROVED') throw new Error('يوجد حالة طوارئ نشطة لهذا الباص')
  }

  const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { busNumber: true } })
  const driver = await prisma.user.findUnique({ where: { id: driverId }, select: { name: true } })

  const report = await prisma.emergencyReport.create({
    data: { busId, driverId, reason, notes: notes || null }
  })

  await createAuditLog({
    userId: driverId, action: 'EMERGENCY_REPORT_CREATED', entityType: 'Bus', entityId: busId,
    newValue: { busNumber: bus?.busNumber, reason, notes },
    reason: `إبلاغ عن طارئ للباص ${bus?.busNumber || busId} - ${getReportReasonText(reason)}`
  })

  // Notify all admins via Socket.IO
  broadcastEmergencyReport({
    id: report.id,
    busId,
    busNumber: bus?.busNumber,
    driverName: driver?.name,
    reason,
    notes,
    status: 'PENDING_REVIEW',
    createdAt: report.createdAt,
  })

  // Create notifications for all admins
  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' } })
    for (const admin of admins) {
      await createAndBroadcast({
        userId: admin.id,
        type: 'emergency_breakdown',
        title: `🚨 بلاغ طارئ - باص ${bus?.busNumber || ''}`,
        message: `أبلغ السائق ${driver?.name || ''} عن ${getReportReasonText(reason)} للباص ${bus?.busNumber || ''}${notes ? `\nملاحظة: ${notes}` : ''}`,
      })
    }
  } catch (e) { /* silent */ }

  return { id: report.id, status: 'PENDING_REVIEW', busNumber: bus?.busNumber }
}

export async function getPendingReports() {
  const reports = await prisma.emergencyReport.findMany({
    where: { status: { in: ['PENDING_REVIEW', 'APPROVED'] } },
    orderBy: { createdAt: 'desc' },
    include: { reviewedBy: { select: { id: true, name: true } } }
  })

  return Promise.all(reports.map(async (r) => {
    const bus = await prisma.bus.findUnique({ where: { id: r.busId }, select: { busNumber: true } })
    const driver = await prisma.user.findUnique({ where: { id: r.driverId }, select: { name: true, phone: true } })
    return {
      id: r.id,
      busId: r.busId,
      busNumber: bus?.busNumber,
      driverName: driver?.name,
      driverPhone: driver?.phone,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      rejectionReason: r.rejectionReason,
      reviewedBy: r.reviewedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }))
}

export async function approveReport(reportId, adminId) {
  const report = await prisma.emergencyReport.findUnique({ where: { id: reportId } })
  if (!report) throw new Error('البلاغ غير موجود')
  if (report.status !== 'PENDING_REVIEW') throw new Error('هذا البلاغ تمت معالجته بالفعل')

  const updated = await prisma.emergencyReport.update({
    where: { id: reportId },
    data: { status: 'APPROVED', reviewedById: adminId }
  })

  await createAuditLog({
    userId: adminId, action: 'EMERGENCY_REPORT_APPROVED', entityType: 'Bus', entityId: report.busId,
    newValue: { reportId, status: 'APPROVED' },
    reason: 'اعتماد بلاغ الطوارئ'
  })

  // Notify driver
  try {
    const bus = await prisma.bus.findUnique({ where: { id: report.busId }, select: { busNumber: true } })
    await createAndBroadcast({
      userId: report.driverId,
      type: 'emergency_breakdown',
      title: 'تم اعتماد بلاغك',
      message: `تم اعتماد بلاغ الطوارئ للباص ${bus?.busNumber || ''}`,
    })
    broadcastReportUpdate(report.driverId, { status: 'APPROVED', reportId })
  } catch (e) { /* silent */ }

  return { id: updated.id, status: 'APPROVED' }
}

export async function rejectReport(reportId, adminId, rejectionReason) {
  const report = await prisma.emergencyReport.findUnique({ where: { id: reportId } })
  if (!report) throw new Error('البلاغ غير موجود')
  if (report.status !== 'PENDING_REVIEW') throw new Error('هذا البلاغ تمت معالجته بالفعل')

  const updated = await prisma.emergencyReport.update({
    where: { id: reportId },
    data: { status: 'REJECTED', reviewedById: adminId, rejectionReason }
  })

  await createAuditLog({
    userId: adminId, action: 'EMERGENCY_REPORT_REJECTED', entityType: 'Bus', entityId: report.busId,
    newValue: { reportId, status: 'REJECTED', rejectionReason },
    reason: `رفض بلاغ الطوارئ - ${rejectionReason}`
  })

  // Notify driver
  try {
    const bus = await prisma.bus.findUnique({ where: { id: report.busId }, select: { busNumber: true } })
    await createAndBroadcast({
      userId: report.driverId,
      type: 'emergency_breakdown',
      title: 'تم رفض البلاغ',
      message: `تم رفض بلاغ الطوارئ للباص ${bus?.busNumber || ''}\nالسبب: ${rejectionReason}`,
    })
    broadcastReportUpdate(report.driverId, { status: 'REJECTED', reportId, rejectionReason })
  } catch (e) { /* silent */ }

  return { id: updated.id, status: 'REJECTED' }
}

export async function getDriverReportStatus(busId, driverId) {
  const report = await prisma.emergencyReport.findFirst({
    where: { busId, driverId },
    orderBy: { createdAt: 'desc' }
  })
  if (!report) return null
  return {
    id: report.id,
    status: report.status,
    reason: report.reason,
    notes: report.notes,
    rejectionReason: report.rejectionReason,
    createdAt: report.createdAt,
  }
}

function getReportReasonText(reason) {
  const map = { MECHANICAL: 'عطل ميكانيكي', ACCIDENT: 'حادث', TRAFFIC: 'ازدحام شديد', ROAD_CLOSED: 'إغلاق طريق', OTHER: 'أخرى' }
  return map[reason] || reason
}
