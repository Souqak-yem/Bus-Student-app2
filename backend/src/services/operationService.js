import { prisma } from '../lib/prisma.js'
import { createAuditLog } from '../lib/audit.js'
import { getLocalDate, formatLocalDate } from '../utils/dateUtils.js'
import { canStudentOperateOnDate } from './studentService.js'
import { getStudentOperationStage, Stage } from './operationStage.js'
import { getStudentIdsToExclude, computeFinancialStatus } from './financialService.js'
import { notifyStudent } from './socketService.js'

async function findUserIdByStudentId(studentId) {
  const user = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
  return user?.id
}

export async function generateTodayOperations(userId, busIds) {
  if (!busIds || !Array.isArray(busIds) || busIds.length === 0) {
    throw new Error('يجب اختيار باص واحد على الأقل')
  }

  const today = getLocalDate()

  const existingOperation = await prisma.dailyOperation.findUnique({
    where: { operationDate: today }
  })

  if (existingOperation) {
    const existingBuses = await prisma.activeBus.count({
      where: { operationId: existingOperation.id, tripType: 'RETURN', status: { not: 'CANCELLED' } }
    })
    if (existingBuses > 0) {
      throw new Error('تم إنشاء عمليات اليوم مسبقًا')
    }
  }

  const buses = await prisma.bus.findMany({
    where: { id: { in: busIds }, status: 'active' },
    include: { driver: true }
  })

  if (buses.length === 0) {
    throw new Error('لا توجد باصات نشطة مطابقة للاختيار')
  }

  return await prisma.$transaction(async (tx) => {
    let operation = existingOperation
    if (!operation) {
      operation = await tx.dailyOperation.create({
        data: { operationDate: today, createdById: userId, status: 'OPEN' }
      })
    }

    let addedBuses = 0
    let assignmentsCreated = 0

    for (const bus of buses) {
      const existing = await tx.activeBus.findFirst({
        where: { operationId: operation.id, busId: bus.id, tripType: 'RETURN', status: { not: 'CANCELLED' } }
      })
      if (!existing && bus.driver) {
        await tx.activeBus.create({
          data: {
            operationId: operation.id,
            busId: bus.id,
            driverId: bus.driverId,
            tripType: 'RETURN',
            line: null,
            capacitySnapshot: bus.capacity,
          }
        })
        addedBuses++
      }

      const financiallyExcluded = await getStudentIdsToExclude()
      const templateStudents = await tx.busStudent.findMany({
        where: { busId: bus.id, isActive: true },
        orderBy: [{ pickupTime: 'asc' }, { createdAt: 'asc' }],
      })

      let currentCount = await tx.assignment.count({
        where: { date: today, period: 'MORNING', busId: bus.id }
      })
      const maxOrder = await tx.assignment.aggregate({
        where: { date: today, period: 'MORNING', busId: bus.id },
        _max: { sortOrder: true }
      })
      let nextSortOrder = (maxOrder._max.sortOrder ?? -1) + 1

      for (const ts of templateStudents) {
        if (currentCount >= bus.capacity) break
        if (financiallyExcluded.has(ts.studentId)) continue
        if (await hasActiveDailySubscriptionForDate(ts.studentId, today)) continue
        if (!await canStudentOperateOnDate(ts.studentId, today)) continue

        const existingAssignment = await tx.assignment.findUnique({
          where: { studentId_date_period: { studentId: ts.studentId, date: today, period: 'MORNING' } }
        })
        if (existingAssignment) continue

        await tx.assignment.create({
          data: {
            studentId: ts.studentId,
            busId: bus.id,
            date: today,
            period: 'MORNING',
            line: 'JEBALI',
            pickupTime: ts.pickupTime || undefined,
            status: 'scheduled',
            isGenerated: true,
            sortOrder: nextSortOrder++,
          }
        })
        currentCount++
        assignmentsCreated++
      }
    }

    await createAuditLog({
      userId,
      action: 'GENERATE_OPERATION',
      entityType: 'DailyOperation',
      entityId: operation.id,
      newValue: { date: formatLocalDate(today), buses: buses.length, created: assignmentsCreated },
      reason: 'إنشاء عمليات اليوم مع توزيع تلقائي لطلاب القالب الأسبوعي/الافتراضي'
    })

    const totalAssigned = await tx.assignment.count({
      where: { date: today, period: 'MORNING' }
    })

    return {
      operationId: operation.id,
      busesProcessed: buses.length,
      assignmentsCreated,
      totalAssigned,
      addedBuses,
    }
  })
}

async function getTodayOperationBusIds() {
  const today = getLocalDate()
  const assignmentBusIds = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING' },
    select: { busId: true },
    distinct: ['busId']
  })
  const op = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  const busIds = new Set(assignmentBusIds.map(b => b.busId))
  if (op) {
    const activeBusIds = await prisma.activeBus.findMany({
      where: { operationId: op.id, tripType: 'RETURN', status: { not: 'CANCELLED' } },
      select: { busId: true },
      distinct: ['busId']
    })
    for (const ab of activeBusIds) busIds.add(ab.busId)
  }
  return busIds
}

async function hasDailySubscriptionForDate(studentId, date, tx = prisma) {
  const count = await tx.dailyExecutionDate.count({
    where: {
      subscription: { studentId, type: 'DAILY', status: 'active' },
      executionDate: date,
    },
  })
  return count > 0
}

async function hasActiveDailySubscriptionForDate(studentId, date, tx = prisma) {
  const count = await tx.subscription.count({
    where: {
      studentId,
      type: 'DAILY',
      status: 'active',
      startDate: { lte: date },
      endDate: { gte: date },
    },
  })
  return count > 0
}

export async function getAvailableBuses() {
  const today = getLocalDate()

  const excludedIds = await getTodayOperationBusIds()

  const buses = await prisma.bus.findMany({
    where: {
      status: 'active',
      NOT: { id: { in: [...excludedIds] } }
    },
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      templateStudents: {
        where: { isActive: true },
        select: { studentId: true }
      },
      outgoingTransfers: {
        where: { isActive: true, startDate: { lte: today }, endDate: { gte: today } },
        select: { studentId: true }
      }
    },
    orderBy: { busNumber: 'asc' }
  })

  const financiallyExcluded = await getStudentIdsToExclude()

  return await Promise.all(buses.map(async (b) => {
    const busOutgoing = new Set(b.outgoingTransfers.map(t => t.studentId))
    let eligibleCount = 0

    for (const bs of b.templateStudents) {
      if (busOutgoing.has(bs.studentId)) continue
      if (financiallyExcluded.has(bs.studentId)) continue
      if (await hasActiveDailySubscriptionForDate(bs.studentId, today)) continue
      const canOperate = await canStudentOperateOnDate(bs.studentId, today)
      if (canOperate) eligibleCount++
    }

    return {
      id: b.id,
      busNumber: b.busNumber,
      plateNumber: b.plateNumber,
      capacity: b.capacity,
      vehicleType: b.vehicleType,
      status: b.status,
      driver: b.driver,
      templateStudentCount: eligibleCount,
    }
  }))
}

export async function getTodayOperation() {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const operation = await prisma.dailyOperation.findUnique({
    where: { operationDate: today }
  })

  const assignments = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING' },
    include: {
      student: { select: { id: true, name: true, zone: true, transportMode: true, offDays: true, pickupLocation: true, institutionName: true, phone: true, whatsapp: true, homeAddress: true, address: true } },
      bus: {
        include: {
          driver: { select: { id: true, name: true, phone: true } },
          _count: { select: { templateStudents: true } }
        }
      }
    },
    orderBy: [{ busId: 'asc' }, { sortOrder: 'asc' }]
  })

  // Build template pickup time fallback map (BusStudent)
  const busIds = [...new Set(assignments.map(a => a.busId))]
  const templateStudents = busIds.length > 0 ? await prisma.busStudent.findMany({
    where: { busId: { in: busIds }, isActive: true },
    select: { studentId: true, busId: true, pickupTime: true }
  }) : []
  const templateMap = new Map(templateStudents.map(ts => [`${ts.busId}:${ts.studentId}`, ts.pickupTime]))

  const busMap = new Map()
  for (const a of assignments) {
    if (!busMap.has(a.busId)) {
      const bus = a.bus
      busMap.set(a.busId, {
        bus: { id: bus.id, busNumber: bus.busNumber, plateNumber: bus.plateNumber, capacity: bus.capacity, vehicleType: bus.vehicleType, status: bus.status },
        driver: bus.driver,
        templateStudentCount: bus._count.templateStudents,
        students: [],
        line: a.line,
      })
    }
    const bd = busMap.get(a.busId)
    bd.students.push({
      id: a.id,
      student: a.student,
      pickupTime: a.pickupTime || templateMap.get(`${a.busId}:${a.studentId}`) || null,
      sortOrder: a.sortOrder,
      status: a.status,
      isGenerated: a.isGenerated,
    })
  }

  // Include operation buses that have no assignments yet (created via generate/add-buses)
  const returnActiveBuses = operation ? await prisma.activeBus.findMany({
    where: { operationId: operation.id, tripType: 'RETURN', status: { not: 'CANCELLED' } },
    include: {
      bus: {
        select: {
          id: true, busNumber: true, plateNumber: true, capacity: true, vehicleType: true, status: true,
          driver: { select: { id: true, name: true, phone: true } },
          _count: { select: { templateStudents: true } },
        }
      }
    },
  }) : []

  for (const ab of returnActiveBuses) {
    if (!busMap.has(ab.busId)) {
      busMap.set(ab.busId, {
        bus: ab.bus,
        driver: ab.bus.driver,
        templateStudentCount: ab.bus._count.templateStudents,
        students: [],
        line: 'JEBALI',
      })
    }
  }

  const activeBuses = operation ? await prisma.activeBus.findMany({
    where: { operationId: operation.id, tripType: { not: 'RETURN' } },
    select: { id: true, busId: true, status: true }
  }) : []
  const activeBusByBusId = {}
  for (const ab of activeBuses) {
    activeBusByBusId[ab.busId] = ab
  }

  const buses = Array.from(busMap.values()).map(b => {
    const ab = activeBusByBusId[b.bus.id]
    return {
      ...b,
      activeBusId: ab?.id || null,
      busStatus: ab?.status || null,
      studentCount: b.students.length,
      remainingCapacity: b.bus.capacity - b.students.length,
      fillPercent: b.bus.capacity > 0 ? Math.round((b.students.length / b.bus.capacity) * 100) : 0,
      completionStatus: b.students.length === 0 ? 'NO_STUDENTS'
        : b.students.every(s => s.status === 'completed') ? 'COMPLETED'
        : b.students.some(s => s.status === 'in_progress') ? 'IN_PROGRESS'
        : 'PENDING',
    }
  })

  const eligibleStudents = operation ? await computeEligibleStudents([...busMap.keys()], today) : []

  return {
    exists: operation !== null,
    operation,
    buses,
    eligibleStudents,
  }
}

const ELIGIBLE_STUDENT_SELECT = {
  id: true, name: true, zone: true, phone: true, offDays: true, institutionName: true,
  destination: { select: { id: true, name: true } },
}

async function computeEligibleStudents(busIds, today) {
  const unassigned = new Set()
  const result = []

  const buses = await prisma.bus.findMany({
    where: { id: { in: busIds } },
    include: {
      templateStudents: {
        where: { isActive: true },
        include: { student: { select: ELIGIBLE_STUDENT_SELECT } },
        orderBy: { pickupTime: 'asc' },
      },
      incomingTransfers: {
        where: { isActive: true, startDate: { lte: today }, endDate: { gte: today } },
        include: { student: { select: ELIGIBLE_STUDENT_SELECT } },
      },
      outgoingTransfers: {
        where: { isActive: true, startDate: { lte: today }, endDate: { gte: today } },
        select: { studentId: true },
      },
    },
  })

  const excludedIds = await getStudentIdsToExclude()

  const assignedAssignments = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING' },
    select: { studentId: true },
  })
  const assignedIds = new Set(assignedAssignments.map(a => a.studentId))

  for (const bus of buses) {
    const busOutgoing = new Set(bus.outgoingTransfers.map(t => t.studentId))

    for (const bs of bus.templateStudents) {
      if (unassigned.has(bs.studentId)) continue
      if (busOutgoing.has(bs.studentId)) continue
      if (excludedIds.has(bs.studentId)) continue
      if (assignedIds.has(bs.studentId)) continue
      if (await hasActiveDailySubscriptionForDate(bs.studentId, today)) continue
      const canOperate = await canStudentOperateOnDate(bs.studentId, today)
      if (!canOperate) continue
      unassigned.add(bs.studentId)
      result.push({
        studentId: bs.studentId,
        student: bs.student,
        suggestedBusId: bus.id,
        suggestedBusNumber: bus.busNumber,
        pickupTime: bs.pickupTime,
        source: 'template',
      })
    }

    for (const t of bus.incomingTransfers) {
      if (unassigned.has(t.studentId)) continue
      if (excludedIds.has(t.studentId)) continue
      if (assignedIds.has(t.studentId)) continue
      const canOperate = await canStudentOperateOnDate(t.studentId, today)
      if (!canOperate) continue
      unassigned.add(t.studentId)
      result.push({
        studentId: t.studentId,
        student: t.student,
        suggestedBusId: bus.id,
        suggestedBusNumber: bus.busNumber,
        pickupTime: null,
        source: 'transfer',
      })
    }
  }

  // Active daily subscriptions for today that are not yet covered
  const dailySubs = await prisma.subscription.findMany({
    where: {
      type: 'DAILY',
      status: 'active',
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      student: { select: ELIGIBLE_STUDENT_SELECT },
      executionDates: { where: { executionDate: today }, take: 1 },
    },
  })

  const dailySubStudentIds = dailySubs
    .filter(s => s.executionDates.length > 0)
    .filter(s => !assignedIds.has(s.studentId))
    .filter(s => !unassigned.has(s.studentId))
    .map(s => s.studentId)

  let busStudentMap = new Map()
  if (dailySubStudentIds.length > 0) {
    const busStudents = await prisma.busStudent.findMany({
      where: { studentId: { in: dailySubStudentIds }, isActive: true },
      include: { bus: { select: { id: true, busNumber: true } } },
    })
    busStudentMap = new Map(busStudents.map(bs => [bs.studentId, bs]))
  }

  for (const sub of dailySubs) {
    if (sub.executionDates.length === 0) continue
    if (assignedIds.has(sub.studentId)) continue
    if (unassigned.has(sub.studentId)) continue
    if (excludedIds.has(sub.studentId)) continue
    const bs = busStudentMap.get(sub.studentId)
    unassigned.add(sub.studentId)
    result.push({
      studentId: sub.studentId,
      student: sub.student,
      suggestedBusId: bs?.bus?.id || null,
      suggestedBusNumber: bs?.bus?.busNumber || null,
      pickupTime: bs?.pickupTime || null,
      source: 'daily',
    })
  }

  return result
}

export async function getBusOperationDetail(busId) {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const bus = await prisma.bus.findUnique({
    where: { id: busId },
    include: { driver: true }
  })
  if (!bus) throw new Error('الحافلة غير موجودة')

  // Get today's active buses for transfer dialog
  const operation = await prisma.dailyOperation.findUnique({
    where: { operationDate: today }
  })

  let todayActiveBuses = []
  if (operation) {
    todayActiveBuses = await prisma.assignment.findMany({
      where: { date: today, period: 'MORNING', busId: { not: busId } },
      select: { busId: true },
      distinct: ['busId']
    })
    const activeBusIds = todayActiveBuses.map(a => a.busId)
    const activeBusesData = await prisma.bus.findMany({
      where: { id: { in: activeBusIds } },
      select: { id: true, busNumber: true, plateNumber: true, capacity: true, driver: { select: { name: true } } }
    })
    todayActiveBuses = activeBusesData
  }

  const assignments = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING', busId },
    include: {
      student: {
        select: {
          id: true, name: true, phone: true, whatsapp: true, parentName: true, parentPhone: true,
          zone: true, address: true, major: true, level: true, institutionName: true, offDays: true, pickupLocation: true,
          transportMode: true, homeAddress: true, homeNotes: true, status: true
        }
      }
    },
    orderBy: { sortOrder: 'asc' }
  })

  const studentIds = assignments.map(a => a.studentId)

  const [attendances, subscriptions] = await Promise.all([
    prisma.attendance.findMany({ where: { date: today, busId } }),
    prisma.subscription.findMany({
      where: { studentId: { in: studentIds }, status: 'active', startDate: { lte: today }, endDate: { gte: today } }
    }),
  ])

  const attMap = Object.fromEntries(attendances.map(a => [a.studentId, a]))
  const subMap = Object.fromEntries(subscriptions.map(s => [s.studentId, s]))

  const templateStudents = await prisma.busStudent.findMany({
    where: { busId, isActive: true },
    select: { studentId: true, pickupTime: true }
  })
  const templateMap = new Map(templateStudents.map(ts => [ts.studentId, ts.pickupTime]))

  const availableStudents = await prisma.student.findMany({
    where: { status: 'active', NOT: { id: { in: studentIds } } },
    select: { id: true, name: true, zone: true, major: true, level: true, institutionName: true, phone: true }
  })

  const hasAnyAttendance = attendances.length > 0
  const activeBus = operation ? await prisma.activeBus.findFirst({
    where: { busId, operationId: operation.id, tripType: { not: 'RETURN' } }
  }) : null
  const isMorningCompleted = activeBus?.status === 'ARRIVED'

  const returnQueueEntries = operation ? await prisma.returnQueue.findMany({
    where: { operationId: operation.id, studentId: { in: studentIds } }
  }) : []
  const returnQueueMap = Object.fromEntries(returnQueueEntries.map(rq => [rq.studentId, rq]))

  const busLoads = operation ? await prisma.busLoad.findMany({
    where: { studentId: { in: studentIds }, activeBus: { operationId: operation.id } },
    include: { activeBus: { include: { bus: { select: { busNumber: true } } } } }
  }) : []
  const busLoadMap = Object.fromEntries(busLoads.map(bl => [bl.studentId, bl]))

  const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
  const todayDayName = DAY_NAMES[today.getDay()]

  const students = await Promise.all(assignments.map(async (a) => {
    const att = attMap[a.studentId]
    const rq = returnQueueMap[a.studentId]
    const bl = busLoadMap[a.studentId]
    const sub = subMap[a.studentId]
    const { status: financialStatus } = await computeFinancialStatus(a.studentId, today)

    let stage = Stage.BEFORE_PICKUP
    if (!att) {
      stage = hasAnyAttendance ? Stage.PICKUP_IN_PROGRESS : Stage.BEFORE_PICKUP
    } else if (att.status === 'absent') {
      stage = Stage.ABSENT
    } else if (att.status === 'present' || att.status === 'late') {
      stage = isMorningCompleted ? Stage.MORNING_COMPLETED : Stage.BOARDED
    }
    if (rq && (rq.status === 'ASSIGNED' || rq.status === 'DEPARTED')) {
      stage = 'RETURN_ASSIGNED'
    } else if (rq && rq.status === 'WAITING') {
      stage = 'RETURN_REQUESTED'
    }

    return {
      assignment: { id: a.id, pickupTime: a.pickupTime, sortOrder: a.sortOrder, status: a.status, isGenerated: a.isGenerated, notes: a.notes },
      student: a.student,
      attendance: att || null,
      subscription: sub ? {
        paymentStatus: sub.paymentStatus,
        type: sub.type,
        endDate: sub.endDate
      } : null,
      isDailySubscription: sub?.type === 'DAILY' || false,
      isTodayException: sub?.type === 'DAILY' && (Array.isArray(a.student.offDays) && a.student.offDays.includes(todayDayName)) || false,
      isTemplate: templateMap.has(a.studentId),
      templatePickupTime: templateMap.get(a.studentId) || null,
      stage,
      returnQueueStatus: rq?.status || null,
      returnBusNumber: bl?.activeBus?.bus?.busNumber || null,
      financialStatus,
    }
  }))

  return {
    bus,
    operationDate: formatLocalDate(today),
    line: assignments[0]?.line || 'JEBALI',
    students,
    availableStudents,
    templateStudentCount: templateStudents.length,
    todayActiveBuses,
  }
}

export async function updateBusLine(busId, userId, line) {
  const today = getLocalDate()

  const result = await prisma.assignment.updateMany({
    where: { date: today, period: 'MORNING', busId, status: { in: ['scheduled', 'in_progress'] } },
    data: { line }
  })

  await createAuditLog({
    userId, action: 'UPDATE_BUS_LINE', entityType: 'Bus', entityId: busId,
    newValue: { line }, reason: 'تغيير خط الحافلة في تشغيل اليوم'
  })

  return { updated: result.count }
}

export async function addStudentToOperation(busId, studentId, userId) {
  const today = getLocalDate()

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } })
  if (!student) throw new Error('الطالب غير موجود')

  const canOperate = await canStudentOperateOnDate(studentId, today)
  if (!canOperate) throw new Error('الطالب غير متاح للتشغيل اليوم')

  const excludedIds = await getStudentIdsToExclude()
  if (excludedIds.has(studentId)) {
    throw new Error('الطالب موقوف مالياً ولا يمكن إضافته للتشغيل')
  }

  const existing = await prisma.assignment.findUnique({
    where: { studentId_date_period: { studentId, date: today, period: 'MORNING' } }
  })
  if (existing) throw new Error('الطالب لديه رحلة مسجلة اليوم بالفعل')

  // Ensure today's operation exists
  const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  if (!operation) throw new Error('لا يوجد تشغيل لليوم')

  // Capacity check for target bus
  const targetBus = await prisma.bus.findUnique({ where: { id: busId }, select: { capacity: true } })
  if (!targetBus) throw new Error('الحافلة غير موجودة')
  const currentCount = await prisma.assignment.count({ where: { date: today, period: 'MORNING', busId } })
  if (currentCount + 1 > targetBus.capacity) throw new Error('لا توجد مقاعد كافية في الباص المحدد')

  const maxOrder = await prisma.assignment.aggregate({
    where: { date: today, period: 'MORNING', busId },
    _max: { sortOrder: true }
  })

  const assignment = await prisma.assignment.create({
    data: {
      studentId, busId, date: today, period: 'MORNING', line: 'JEBALI',
      status: 'scheduled', isGenerated: false, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1
    },
    include: {
      student: { select: { id: true, name: true, zone: true, phone: true, major: true, level: true, institutionName: true, offDays: true, pickupLocation: true, transportMode: true, status: true } }
    }
  })

  await createAuditLog({
    userId, action: 'ADD_STUDENT_OPERATION', entityType: 'Assignment', entityId: assignment.id,
    newValue: { studentId, busId, date: formatLocalDate(today) }, reason: 'إضافة طالب لتشغيل اليوم'
  })

  const studentUser = await findUserIdByStudentId(studentId)
  if (studentUser) {
    const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { busNumber: true } })
    notifyStudent({
      userId: studentUser, type: 'student_added_to_trip', title: 'تمت إضافتك لرحلة اليوم',
      message: `تمت إضافتك إلى باص ${bus?.busNumber || ''}`,
      targetRoute: '/student',
    })
  }

  return assignment
}

export async function removeStudentFromOperation(assignmentId, userId) {
  const today = getLocalDate()

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } })
  if (!assignment) throw new Error('الرحلة غير موجودة')

  await prisma.assignment.delete({ where: { id: assignmentId } })

  await createAuditLog({
    userId, action: 'REMOVE_STUDENT_OPERATION', entityType: 'Assignment', entityId: assignmentId,
    oldValue: { studentId: assignment.studentId, busId: assignment.busId },
    reason: 'حذف طالب من تشغيل اليوم'
  })

  const studentUser = await findUserIdByStudentId(assignment.studentId)
  if (studentUser) {
    notifyStudent({
      userId: studentUser, type: 'student_removed_from_trip', title: 'تم إلغاء رحلتك اليوم',
      message: 'تم حذف رحلتك من تشغيل اليوم',
      targetRoute: '/student',
    })
  }
}

export async function updateAssignment(busId, assignmentId, userId, data) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, busId }
  })
  if (!assignment) throw new Error('الرحلة غير موجودة في هذه الحافلة')

  const updated = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      pickupTime: data.pickupTime !== undefined ? data.pickupTime : undefined,
      sortOrder: data.sortOrder !== undefined ? data.sortOrder : undefined,
      notes: data.notes !== undefined ? data.notes : undefined,
      status: data.status !== undefined ? data.status : undefined,
    },
    include: { student: { select: { id: true, name: true } } }
  })

  await createAuditLog({
    userId, action: 'UPDATE_ASSIGNMENT', entityType: 'Assignment', entityId: assignmentId,
    oldValue: { pickupTime: assignment.pickupTime, sortOrder: assignment.sortOrder, status: assignment.status },
    newValue: { pickupTime: updated.pickupTime, sortOrder: updated.sortOrder, status: updated.status },
    reason: 'تعديل رحلة في تشغيل اليوم'
  })

  const studentUser = await findUserIdByStudentId(updated.studentId)
  if (studentUser) {
    if (data.pickupTime !== undefined && data.pickupTime !== assignment.pickupTime) {
      notifyStudent({
        userId: studentUser, type: 'student_pickup_time_changed', title: 'تعديل وقت الصعود',
        message: `تم تعديل وقت صعودك إلى ${data.pickupTime}`,
        targetRoute: '/student',
      })
    }
    if (data.sortOrder !== undefined && data.sortOrder !== assignment.sortOrder) {
      notifyStudent({
        userId: studentUser, type: 'student_order_changed', title: 'تعديل ترتيب الصعود',
        message: 'تم تعديل ترتيب صعودك في الباص',
        targetRoute: '/student',
      })
    }
  }

  return updated
}

export async function addBusesToOperation(userId, busIds) {
  if (!busIds || !Array.isArray(busIds) || busIds.length === 0) {
    throw new Error('يجب اختيار باص واحد على الأقل')
  }

  const today = getLocalDate()

  return await prisma.$transaction(async (tx) => {
    let operation = await tx.dailyOperation.findUnique({
      where: { operationDate: today }
    })

    if (!operation) {
      throw new Error('لا يوجد تشغيل لليوم. أنشئ تشغيلاً أولاً.')
    }

    if (operation.status === 'CLOSED') {
      throw new Error('التشغيل مغلق لهذا اليوم')
    }

    // Filter out buses already in operation
    const existingBusIds = await tx.assignment.findMany({
      where: { date: today, period: 'MORNING' },
      select: { busId: true },
      distinct: ['busId']
    })
    const existingActiveBusIds = await tx.activeBus.findMany({
      where: { operationId: operation.id, tripType: 'RETURN', status: { not: 'CANCELLED' } },
      select: { busId: true },
      distinct: ['busId']
    })
    const existingSet = new Set([
      ...existingBusIds.map(b => b.busId),
      ...existingActiveBusIds.map(ab => ab.busId),
    ])
    const newBusIds = busIds.filter(id => !existingSet.has(id))

    if (newBusIds.length === 0) {
      throw new Error('جميع الباصات المختارة موجودة بالفعل في التشغيل')
    }

    const buses = await tx.bus.findMany({
      where: { id: { in: newBusIds }, status: 'active' },
      include: { driver: true }
    })

    // Create ActiveBus for return
    let addedBuses = 0
    for (const bus of buses) {
      const existingActive = await tx.activeBus.findFirst({
        where: { operationId: operation.id, busId: bus.id, tripType: 'RETURN', status: { not: 'CANCELLED' } }
      })
      if (!existingActive && bus.driver) {
        await tx.activeBus.create({
          data: {
            operationId: operation.id,
            busId: bus.id,
            driverId: bus.driverId,
            tripType: 'RETURN',
            line: null,
            capacitySnapshot: bus.capacity,
          }
        })
        addedBuses++
      }

      const financiallyExcluded = await getStudentIdsToExclude()
      const templateStudents = await tx.busStudent.findMany({
        where: { busId: bus.id, isActive: true },
        orderBy: [{ pickupTime: 'asc' }, { createdAt: 'asc' }],
      })

      let currentCount = await tx.assignment.count({
        where: { date: today, period: 'MORNING', busId: bus.id }
      })
      const maxOrder = await tx.assignment.aggregate({
        where: { date: today, period: 'MORNING', busId: bus.id },
        _max: { sortOrder: true }
      })
      let nextSortOrder = (maxOrder._max.sortOrder ?? -1) + 1

      for (const ts of templateStudents) {
        if (currentCount >= bus.capacity) break
        if (financiallyExcluded.has(ts.studentId)) continue
        if (await hasActiveDailySubscriptionForDate(ts.studentId, today)) continue
        if (!await canStudentOperateOnDate(ts.studentId, today)) continue

        const existingAssignment = await tx.assignment.findUnique({
          where: { studentId_date_period: { studentId: ts.studentId, date: today, period: 'MORNING' } }
        })
        if (existingAssignment) continue

        await tx.assignment.create({
          data: {
            studentId: ts.studentId,
            busId: bus.id,
            date: today,
            period: 'MORNING',
            line: 'JEBALI',
            pickupTime: ts.pickupTime || undefined,
            status: 'scheduled',
            isGenerated: true,
            sortOrder: nextSortOrder++,
          }
        })
        currentCount++
        assignmentsCreated++
      }
    }

    await createAuditLog({
      userId,
      action: 'ADD_BUSES_TO_OPERATION',
      entityType: 'DailyOperation',
      entityId: operation.id,
      newValue: { date: formatLocalDate(today), busesAdded: buses.length, created: assignmentsCreated },
      reason: 'إضافة باصات إلى تشغيل اليوم مع توزيع تلقائي لطلاب القالب الأسبوعي/الافتراضي'
    })

    const result = {
      operationId: operation.id,
      busesAdded: buses.length,
      assignmentsCreated,
      addedBuses,
    }

    return result
  })
}

export async function removeBusFromOperation(busId, userId) {
  const today = getLocalDate()

  const affectedStudents = await prisma.assignment.findMany({
    where: { date: today, period: 'MORNING', busId },
    select: { studentId: true },
  })

  return await prisma.$transaction(async (tx) => {
    const assignmentCount = await tx.assignment.deleteMany({
      where: { date: today, period: 'MORNING', busId }
    })

    const operation = await tx.dailyOperation.findUnique({
      where: { operationDate: today }
    })

    if (operation) {
      const activeBuses = await tx.activeBus.findMany({
        where: { operationId: operation.id, busId },
        select: { id: true },
      })
      const activeBusIds = activeBuses.map(ab => ab.id)
      if (activeBusIds.length > 0) {
        await tx.busLoad.deleteMany({
          where: { activeBusId: { in: activeBusIds } },
        })
      }
      await tx.activeBus.deleteMany({
        where: { operationId: operation.id, busId }
      })
    }

    await createAuditLog({
      userId, action: 'REMOVE_BUS_OPERATION', entityType: 'Bus', entityId: busId,
      newValue: { date: formatLocalDate(today) },
      reason: 'حذف باص من تشغيل اليوم'
    })

    for (const a of affectedStudents) {
      const studentUser = await findUserIdByStudentId(a.studentId)
      if (studentUser) {
        notifyStudent({
          userId: studentUser, type: 'student_removed_from_trip', title: 'تم إلغاء رحلتك اليوم',
          message: 'تم إلغاء رحلة اليوم لهذا الباص',
          targetRoute: '/student',
        })
      }
    }

    return { deletedAssignments: assignmentCount.count }
  })
}

export async function transferStudentBetweenBuses(fromBusId, toBusId, studentId, userId) {
  const today = getLocalDate()

  return await prisma.$transaction(async (tx) => {
    const existingAssignment = await tx.assignment.findUnique({
      where: { studentId_date_period: { studentId, date: today, period: 'MORNING' } }
    })
    if (!existingAssignment) throw new Error('الطالب ليس لديه رحلة اليوم')
    if (existingAssignment.busId !== fromBusId) throw new Error('الطالب ليس في هذه الحافلة')

    if (fromBusId === toBusId) {
      throw new Error('لا يمكن نقل الطالب إلى نفس الباص')
    }

    const targetBus = await tx.bus.findUnique({ where: { id: toBusId } })
    if (!targetBus) throw new Error('الحافلة الهدف غير موجودة')

    const currentTargetCount = await tx.assignment.count({
      where: { date: today, period: 'MORNING', busId: toBusId }
    })
    if (currentTargetCount + 1 > targetBus.capacity) {
      throw new Error('لا توجد مقاعد كافية في الحافلة الهدف')
    }

    const alreadyInTarget = await tx.assignment.findUnique({
      where: { studentId_date_period: { studentId, date: today, period: 'MORNING' } }
    })

    await tx.assignment.delete({ where: { id: existingAssignment.id } })

    const maxOrder = await tx.assignment.aggregate({
      where: { date: today, period: 'MORNING', busId: toBusId },
      _max: { sortOrder: true }
    })

    const newAssignment = await tx.assignment.create({
      data: {
        studentId, busId: toBusId, date: today, period: 'MORNING',
        line: 'JEBALI', status: 'scheduled', isGenerated: false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        pickupTime: existingAssignment.pickupTime
      }
    })

    await createAuditLog({
      userId, action: 'TRANSFER_STUDENT_TODAY', entityType: 'Assignment', entityId: newAssignment.id,
      oldValue: { fromBusId, toBusId, studentId },
      reason: 'نقل طالب بين الباصات في تشغيل اليوم'
    })

    const studentUser = await findUserIdByStudentId(studentId)
    if (studentUser) {
      const toBus = await prisma.bus.findUnique({ where: { id: toBusId }, select: { busNumber: true } })
      notifyStudent({
        userId: studentUser, type: 'student_bus_changed', title: 'تغيير الباص',
        message: `تم نقلك إلى باص ${toBus?.busNumber || ''}`,
        targetRoute: '/student',
        dedupKey: `student_bus_changed_${studentId}_${today.getTime()}`,
      })
    }

    return newAssignment
  })
}

export async function transferAllStudentsFromBus(fromBusId, toBusId, userId) {
  if (fromBusId === toBusId) throw new Error('لا يمكن نقل الطلاب إلى نفس الباص')

  const today = getLocalDate()

  return await prisma.$transaction(async (tx) => {
    const fromAssignments = await tx.assignment.findMany({
      where: { date: today, period: 'MORNING', busId: fromBusId },
      select: { id: true, studentId: true, pickupTime: true }
    })

    if (fromAssignments.length === 0) throw new Error('لا يوجد طلاب في هذا الباص')

    const toBus = await tx.bus.findUnique({ where: { id: toBusId }, select: { capacity: true } })
    if (!toBus) throw new Error('الحافلة الهدف غير موجودة')

    const currentTargetCount = await tx.assignment.count({
      where: { date: today, period: 'MORNING', busId: toBusId }
    })

    if (currentTargetCount + fromAssignments.length > toBus.capacity) {
      throw new Error('لا توجد مقاعد كافية في الباص المحدد')
    }

    const maxOrder = await tx.assignment.aggregate({
      where: { date: today, period: 'MORNING', busId: toBusId },
      _max: { sortOrder: true }
    })
    let nextSort = (maxOrder._max.sortOrder ?? -1) + 1

    for (const a of fromAssignments) {
      await tx.assignment.create({
        data: {
          studentId: a.studentId,
          busId: toBusId,
          date: today,
          period: 'MORNING',
          line: 'JEBALI',
          pickupTime: a.pickupTime,
          status: 'scheduled',
          isGenerated: false,
          sortOrder: nextSort++
        }
      })
    }

    const fromIds = fromAssignments.map(a => a.id)
    await tx.assignment.deleteMany({ where: { id: { in: fromIds } } })

    const operation = await tx.dailyOperation.findUnique({ where: { operationDate: today } })
    if (operation) {
      const fromActiveBus = await tx.activeBus.findFirst({
        where: { operationId: operation.id, busId: fromBusId, tripType: 'RETURN', status: { not: 'CANCELLED' } }
      })
      const toActiveBus = await tx.activeBus.findFirst({
        where: { operationId: operation.id, busId: toBusId, tripType: 'RETURN', status: { not: 'CANCELLED' } }
      })
      if (fromActiveBus && toActiveBus) {
        await tx.busLoad.updateMany({
          where: { activeBusId: fromActiveBus.id },
          data: { activeBusId: toActiveBus.id }
        })
      }
    }

    await createAuditLog({
      userId, action: 'TRANSFER_ALL_STUDENTS', entityType: 'Bus', entityId: fromBusId,
      oldValue: { fromBusId, toBusId, count: fromAssignments.length },
      reason: 'نقل جميع الطلاب من باص إلى آخر في تشغيل اليوم'
    })

    const targetBusRecord = await prisma.bus.findUnique({ where: { id: toBusId }, select: { busNumber: true } })
    for (const a of fromAssignments) {
      const studentUser = await findUserIdByStudentId(a.studentId)
      if (studentUser) {
        notifyStudent({
          userId: studentUser, type: 'student_bus_changed', title: 'تغيير الباص',
          message: `تم نقلك إلى باص ${targetBusRecord?.busNumber || ''}`,
          targetRoute: '/student',
          dedupKey: `student_bus_changed_${a.studentId}_${today.getTime()}`,
        })
      }
    }

    return { transferred: fromAssignments.length }
  })
}

export async function updateAssignmentsStatusByBus(busId, status) {
  const { today, tomorrow } = (() => {
    const d = getLocalDate()
    const t = new Date(d)
    t.setDate(t.getDate() + 1)
    return { today: d, tomorrow: t }
  })()
  await prisma.assignment.updateMany({
    where: { busId, date: { gte: today, lt: tomorrow }, period: 'MORNING', status: { not: 'cancelled' } },
    data: { status },
  })
}

export async function getOperationHistory() {
  const operations = await prisma.dailyOperation.findMany({
    orderBy: { operationDate: 'desc' },
    take: 30,
    include: { createdBy: { select: { name: true } } }
  })

  const result = []
  for (const op of operations) {
    const stats = await prisma.assignment.groupBy({
      by: ['busId', 'line'],
      where: { date: op.operationDate, period: 'MORNING' },
      _count: { id: true }
    })

    const busIds = [...new Set(stats.map(s => s.busId))]
    const buses = await prisma.bus.findMany({
      where: { id: { in: busIds } },
      select: { id: true, busNumber: true, plateNumber: true, capacity: true, vehicleType: true, driver: { select: { name: true } } }
    })

    const totalStudents = stats.reduce((sum, s) => sum + s._count.id, 0)
    const lineCount = {}
    for (const s of stats) {
      lineCount[s.line] = (lineCount[s.line] || 0) + s._count.id
    }

    result.push({
      date: op.operationDate,
      status: op.status,
      createdBy: op.createdBy,
      busCount: busIds.length,
      studentCount: totalStudents,
      lines: lineCount,
      buses
    })
  }

  return result
}
