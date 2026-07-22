import { prisma } from '../lib/prisma.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { broadcastTrackingUpdate, notifyStudent, notifyStudentsOnBus } from './socketService.js'
import { updateAssignmentsStatusByBus } from './operationService.js'
import { createAndBroadcast } from './notificationService.js'

async function findUserIdByStudentId(studentId) {
  const user = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
  return user?.id
}

export const TrackingStatus = {
  PICKED_UP: 'PICKED_UP',
  CURRENT: 'CURRENT',
  PENDING: 'PENDING',
  ABSENT: 'ABSENT',
  SKIPPED: 'SKIPPED',
  ALL_DONE: 'ALL_DONE',
}

function todayRange() {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

function parseSkippedIds(raw) {
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function getTrackingState(activeBusId) {
  const activeBus = await prisma.activeBus.findUnique({
    where: { id: activeBusId },
    select: { skippedStudentIds: true, busId: true, status: true },
  })
  if (!activeBus) return null

  const skipIds = parseSkippedIds(activeBus.skippedStudentIds)
  const { today, tomorrow } = todayRange()

  const assignments = await prisma.assignment.findMany({
    where: {
      busId: activeBus.busId,
      date: { gte: today, lt: tomorrow },
      period: 'MORNING',
      status: { not: 'cancelled' },
    },
    include: {
      student: { select: { id: true, name: true, phone: true, transportMode: true, pickupLocation: true, homeAddress: true, institutionName: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  const assignmentsSorted = [...assignments].sort((a, b) => {
    const toMin = (t) => {
      if (!t) return 24 * 60
      const [h, m] = String(t).split(':').map(Number)
      return (h || 0) * 60 + (m || 0)
    }
    return toMin(a.pickupTime) - toMin(b.pickupTime)
  })

  const attendances = await prisma.attendance.findMany({
    where: {
      busId: activeBus.busId,
      date: { gte: today, lt: tomorrow },
    },
  })
  const attendanceMap = {}
  for (const a of attendances) {
    attendanceMap[a.studentId] = a.status
  }

  let currentFound = false
  const students = assignmentsSorted.map((a, idx) => {
    const attStatus = attendanceMap[a.student.id]
    let trackingStatus

    if (attStatus === 'present' || attStatus === 'late') {
      trackingStatus = TrackingStatus.PICKED_UP
    } else if (attStatus === 'absent') {
      trackingStatus = TrackingStatus.ABSENT
    } else if (skipIds.includes(a.student.id)) {
      trackingStatus = TrackingStatus.SKIPPED
    } else if (!currentFound) {
      trackingStatus = TrackingStatus.CURRENT
      currentFound = true
    } else {
      trackingStatus = TrackingStatus.PENDING
    }

    return {
      studentId: a.student.id,
      name: a.student.name,
      phone: a.student.phone,
      transportMode: a.student.transportMode,
      pickupLocation: a.student.pickupLocation || a.student.homeAddress,
      institutionName: a.student.institutionName,
      sortOrder: a.sortOrder || idx,
      pickupTime: a.pickupTime || null,
      attendanceStatus: attStatus || null,
      trackingStatus,
    }
  })

  const total = students.length
  const alreadyArrived = activeBus.status === 'ARRIVED'
  const pickedUpCount = alreadyArrived ? total : students.filter(s => s.trackingStatus === TrackingStatus.PICKED_UP).length
  const allDone = alreadyArrived || (total > 0 && !students.some(s =>
    s.trackingStatus === TrackingStatus.CURRENT || s.trackingStatus === TrackingStatus.PENDING || s.trackingStatus === TrackingStatus.SKIPPED
  ))

  const currentStudent = alreadyArrived ? null : (students.find(s => s.trackingStatus === TrackingStatus.CURRENT) || null)
  const nextStudentIdx = currentStudent ? students.indexOf(currentStudent) + 1 : null
  const nextStudent = alreadyArrived ? null : (nextStudentIdx !== null && nextStudentIdx < students.length
    ? students[nextStudentIdx]
    : null
  )

  return {
    activeBusId,
    students,
    currentStudent,
    nextStudent,
    pickedUpCount,
    total,
    allDone,
    busStatus: activeBus.status,
  }
}

export async function skipStudent(activeBusId, studentId) {
  const activeBus = await prisma.activeBus.findUnique({
    where: { id: activeBusId },
    select: { skippedStudentIds: true },
  })
  if (!activeBus) throw new Error('Active bus not found')

  const skipIds = parseSkippedIds(activeBus.skippedStudentIds)
  if (!skipIds.includes(studentId)) {
    skipIds.push(studentId)
  }

  await prisma.activeBus.update({
    where: { id: activeBusId },
    data: { skippedStudentIds: JSON.stringify(skipIds) },
  })

  const state = await getTrackingState(activeBusId)
  broadcastTrackingUpdate(activeBusId, state)
  await checkAndSendNotifications(state, activeBusId)
  return state
}

export async function unskipStudent(activeBusId, studentId) {
  const activeBus = await prisma.activeBus.findUnique({
    where: { id: activeBusId },
    select: { skippedStudentIds: true },
  })
  if (!activeBus) throw new Error('Active bus not found')

  let skipIds = parseSkippedIds(activeBus.skippedStudentIds)
  skipIds = skipIds.filter(id => id !== studentId)

  await prisma.activeBus.update({
    where: { id: activeBusId },
    data: { skippedStudentIds: JSON.stringify(skipIds) },
  })

  const state = await getTrackingState(activeBusId)
  broadcastTrackingUpdate(activeBusId, state)
  return state
}

export async function advanceTrackingAfterAttendance(activeBusId, studentId) {
  const state = await getTrackingState(activeBusId)
  broadcastTrackingUpdate(activeBusId, state)
  await checkAndSendNotifications(state, activeBusId)
}

export async function startMorningTrip(busId) {
  const { today, tomorrow } = todayRange()

  let activeBus = await prisma.activeBus.findFirst({
    where: { busId, tripType: { not: 'RETURN' }, operation: { operationDate: { gte: today, lt: tomorrow } } },
  })
  if (!activeBus) {
    const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
    if (!operation) throw new Error('لا يوجد تشغيل لليوم')
    const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { capacity: true, driverId: true } })
    if (!bus) throw new Error('الباص غير موجود')
    activeBus = await prisma.activeBus.create({
      data: {
        operationId: operation.id, busId, driverId: bus.driverId,
        tripType: 'MORNING', capacitySnapshot: bus.capacity, status: 'DEPARTED',
      },
    })
  } else {
    if (activeBus.status === 'DEPARTED' || activeBus.status === 'ARRIVED') {
      throw new Error('الرحلة قيد التنفيذ أو منتهية مسبقاً')
    }
    await prisma.activeBus.update({
      where: { id: activeBus.id },
      data: { status: 'DEPARTED' },
    })
  }

  await updateAssignmentsStatusByBus(busId, 'in_progress')

  const state = await getTrackingState(activeBus.id)
  broadcastTrackingUpdate(activeBus.id, state)

  notifyStudentsOnBus(busId, {
    type: 'student_trip_started', title: 'انطلقت رحلة الصباح', message: 'انطلق باصك إلى الجامعة',
  })

  return state
}

export async function cancelMorningTrip(busId) {
  const { today, tomorrow } = todayRange()

  const activeBus = await prisma.activeBus.findFirst({
    where: { busId, tripType: { not: 'RETURN' }, operation: { operationDate: { gte: today, lt: tomorrow } } },
  })
  if (!activeBus) throw new Error('الباص غير موجود في تشغيل اليوم')
  if (activeBus.status === 'ARRIVED' || activeBus.status === 'CANCELLED') {
    throw new Error('لا يمكن إلغاء رحلة منتهية أو ملغية مسبقاً')
  }

  const attendances = await prisma.attendance.findMany({
    where: { busId, date: { gte: today, lt: tomorrow } },
  })
  const attendedStudentIds = new Set(attendances.map(a => a.studentId))

  const unmarkedWhere = {
    busId, date: { gte: today, lt: tomorrow },
    period: 'MORNING', status: { not: 'cancelled' },
  }
  if (attendedStudentIds.size > 0) {
    unmarkedWhere.studentId = { notIn: [...attendedStudentIds] }
  }
  const unmarkedAssignments = await prisma.assignment.findMany({
    where: unmarkedWhere,
    select: { studentId: true },
  })

  if (unmarkedAssignments.length > 0) {
    await prisma.attendance.createMany({
      data: unmarkedAssignments.map(a => ({
        studentId: a.studentId,
        busId,
        date: today,
        status: 'absent',
      })),
      skipDuplicates: true,
    })
    notifyAbsentStudents(busId, unmarkedAssignments.map(a => a.studentId))
  }

  await prisma.activeBus.update({
    where: { id: activeBus.id },
    data: { status: 'CANCELLED' },
  })

  await updateAssignmentsStatusByBus(busId, 'cancelled')

  notifyStudentsOnBus(busId, {
    type: 'student_trip_ended', title: 'تم إلغاء الرحلة', message: 'تم إلغاء رحلة الصباح',
  })

  const state = await getTrackingState(activeBus.id)
  broadcastTrackingUpdate(activeBus.id, state)
  return state
}

export async function completeMorningTrip(busId) {
  const { today, tomorrow } = todayRange()

  let activeBus = await prisma.activeBus.findFirst({
    where: { busId, tripType: { not: 'RETURN' }, operation: { operationDate: { gte: today, lt: tomorrow } } },
  })
  if (!activeBus) {
    const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
    if (!operation) throw new Error('لا يوجد تشغيل لليوم')
    const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { capacity: true, driverId: true } })
    if (!bus) throw new Error('الباص غير موجود')
    activeBus = await prisma.activeBus.create({
      data: {
        operationId: operation.id, busId, driverId: bus.driverId,
        tripType: 'MORNING', capacitySnapshot: bus.capacity, status: 'ARRIVED',
      },
    })
    await updateAssignmentsStatusByBus(busId, 'completed')
    const state = await getTrackingState(activeBus.id)
    broadcastTrackingUpdate(activeBus.id, state)

    notifyStudentsOnBus(busId, {
      type: 'student_arrived_university', title: 'وصلت إلى الجامعة', message: 'وصل باصك إلى الجامعة بنجاح',
    })

    prisma.bus.findUnique({ where: { id: busId }, select: { plateNumber: true, busNumber: true } }).then(b => {
      const busLabel = b?.plateNumber || b?.busNumber || 'غير معروف'
      prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } }).then(admins => {
        for (const admin of admins) {
          createAndBroadcast({
            userId: admin.id,
            type: 'morning_trip_completed',
            title: 'انتهت رحلة صباحية',
            message: `انتهت رحلة الباص ${busLabel} الصباحية`,
            dedupKey: `morning_trip_completed_${admin.id}_${busId}_${getLocalDate().toISOString().slice(0, 10)}`,
          }).catch(() => {})
        }
      })
    })

    return state
  }
  if (activeBus.status === 'ARRIVED') {
    return await getTrackingState(activeBus.id)
  }

  const attendances = await prisma.attendance.findMany({
    where: { busId, date: { gte: today, lt: tomorrow } },
  })
  const attendedStudentIds = new Set(attendances.map(a => a.studentId))

  const unmarkedWhere = {
    busId, date: { gte: today, lt: tomorrow },
    period: 'MORNING', status: { not: 'cancelled' },
  }
  if (attendedStudentIds.size > 0) {
    unmarkedWhere.studentId = { notIn: [...attendedStudentIds] }
  }
  const unmarkedAssignments = await prisma.assignment.findMany({
    where: unmarkedWhere,
    select: { studentId: true },
  })

  if (unmarkedAssignments.length > 0) {
    await prisma.attendance.createMany({
      data: unmarkedAssignments.map(a => ({
        studentId: a.studentId,
        busId,
        date: today,
        status: 'absent',
      })),
      skipDuplicates: true,
    })
    notifyAbsentStudents(busId, unmarkedAssignments.map(a => a.studentId))
  }

  await prisma.activeBus.update({
    where: { id: activeBus.id },
    data: { status: 'ARRIVED' },
  })

  await updateAssignmentsStatusByBus(busId, 'completed')

  const state = await getTrackingState(activeBus.id)
  broadcastTrackingUpdate(activeBus.id, state)

  notifyStudentsOnBus(busId, {
    type: 'student_arrived_university', title: 'وصلت إلى الجامعة', message: 'وصل باصك إلى الجامعة بنجاح',
  })

  prisma.bus.findUnique({ where: { id: busId }, select: { plateNumber: true, busNumber: true } }).then(bus => {
    const busLabel = bus?.plateNumber || bus?.busNumber || 'غير معروف'
    prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } }).then(admins => {
      for (const admin of admins) {
        createAndBroadcast({
          userId: admin.id,
          type: 'morning_trip_completed',
          title: 'انتهت رحلة صباحية',
          message: `انتهت رحلة الباص ${busLabel} الصباحية`,
          dedupKey: `morning_trip_completed_${admin.id}_${busId}_${getLocalDate().toISOString().slice(0, 10)}`,
        }).catch(() => {})
      }
    })
  })

  return state
}

async function notifyAbsentStudents(busId, unmarkedStudentIds) {
  for (const studentId of unmarkedStudentIds) {
    const userId = await findUserIdByStudentId(studentId)
    if (userId) {
      notifyStudent({
        userId, type: 'student_marked_absent', title: 'تم تسجيل غيابك',
        message: 'تم تسجيل غيابك في رحلة اليوم',
        targetRoute: '/student',
      })
    }
  }

}

async function checkAndSendNotifications(state, activeBusId) {
  if (!state?.currentStudent) return
  const { today, tomorrow } = todayRange()

  if (state.nextStudent) {
    const nextUser = await prisma.user.findUnique({
      where: { studentId: state.nextStudent.studentId },
    })
    if (nextUser) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: nextUser.id,
          type: 'tracking_next',
          createdAt: { gte: today, lt: tomorrow },
          data: { path: ['activeBusId'], equals: activeBusId },
        },
      })
      if (!existing) {
        await createAndBroadcast({
          userId: nextUser.id,
          type: 'tracking_next',
          title: 'الباص اقترب منك',
          message: 'أنت التالي. يرجى الاستعداد.',
          data: { activeBusId },
        })
      }
    }
  }

  if (state.currentStudent) {
    const currentUser = await prisma.user.findUnique({
      where: { studentId: state.currentStudent.studentId },
    })
    if (currentUser) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: currentUser.id,
          type: 'tracking_arrived',
          createdAt: { gte: today, lt: tomorrow },
          data: { path: ['activeBusId'], equals: activeBusId },
        },
      })
      if (!existing) {
        await createAndBroadcast({
          userId: currentUser.id,
          type: 'tracking_arrived',
          title: 'الباص وصل',
          message: 'الباص وصل إلى نقطة الاستلام الخاصة بك.',
          data: { activeBusId },
        })
      }
    }
  }
}
