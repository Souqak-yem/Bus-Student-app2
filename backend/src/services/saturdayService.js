import { prisma } from '../lib/prisma.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { broadcastSaturdayUpdate, notifyStudent } from './socketService.js'
import { createAndBroadcast } from './notificationService.js'

export async function getSaturdaySubscribers(date = getLocalDate()) {
  const dayName = 'SATURDAY'
  const subs = await prisma.subscription.findMany({
    where: {
      type: 'DAILY',
      status: 'active',
      selectedDays: { contains: dayName },
    },
    include: {
      student: {
        include: {
          destination: { select: { id: true, name: true } },
          busStudents: {
            where: { isActive: true },
            include: { bus: { select: { id: true, busNumber: true } } },
          },
        },
      },
      executionDates: {
        where: { executionDate: date, status: { not: 'expired' } },
        orderBy: { executionDate: 'asc' },
      },
    },
  })

  return subs
    .filter(s => s.executionDates.length > 0)
    .map(s => ({
      subscriptionId: s.id,
      studentId: s.studentId,
      student: s.student,
      amount: s.amount,
      executionDate: s.executionDates[0]?.executionDate,
    }))
}

export async function getOrCreateSaturdayOperation(date = getLocalDate(), createdById) {
  let op = await prisma.saturdayOperation.findUnique({
    where: { operationDate: date },
    include: {
      buses: {
        include: {
          bus: { select: { id: true, busNumber: true, capacity: true } },
          driver: { select: { id: true, name: true } },
          loads: {
            include: {
              student: {
                select: {
                  id: true, name: true, zone: true,
                  destination: { select: { id: true, name: true } },
                  busStudents: {
                    where: { isActive: true },
                    include: { bus: { select: { id: true, busNumber: true } } },
                  },
                },
              },
            },
            orderBy: { assignedAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!op && createdById) {
    op = await prisma.saturdayOperation.create({
      data: { operationDate: date, createdById },
      include: {
        buses: {
          include: {
            bus: { select: { id: true, busNumber: true, capacity: true } },
            driver: { select: { id: true, name: true } },
            loads: {
              include: {
                student: {
                  select: {
                    id: true, name: true, zone: true,
                    destination: { select: { id: true, name: true } },
                    busStudents: {
                      where: { isActive: true },
                      include: { bus: { select: { id: true, busNumber: true } } },
                    },
                  },
                },
              },
              orderBy: { assignedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  }

  return op
}

export async function createSaturdayOperation(date, busIds, createdById) {
  const busesData = await prisma.bus.findMany({
    where: { id: { in: busIds }, status: 'active' },
    include: { driver: { select: { id: true, name: true } } },
  })

  const missing = busIds.filter(id => !busesData.find(b => b.id === id))
  if (missing.length > 0) {
    throw new Error(`الباصات غير موجودة: ${missing.join(', ')}`)
  }

  let existingOp = await prisma.saturdayOperation.findUnique({ where: { operationDate: date } })

  const result = await prisma.$transaction(async (tx) => {
    let operation = existingOp

    if (!operation) {
      operation = await tx.saturdayOperation.create({
        data: { operationDate: date, createdById },
      })
    }

    const existingBuses = await tx.saturdayActiveBus.findMany({
      where: { operationId: operation.id },
      select: { busId: true },
    })
    const existingBusIds = new Set(existingBuses.map(b => b.busId))

    let addedCount = 0
    for (const bus of busesData) {
      if (existingBusIds.has(bus.id)) continue

      await tx.saturdayActiveBus.create({
        data: {
          operationId: operation.id,
          busId: bus.id,
          driverId: bus.driverId,
          capacitySnapshot: bus.capacity,
        },
      })
      addedCount++

      if (bus.driver?.id) {
        await createAndBroadcast({
          userId: bus.driver.id,
          type: 'saturday_duty',
          title: 'تكليف رحلة سبت',
          message: `تم تكليفك برحلة يوم السبت للباص ${bus.busNumber}`,
          dedupKey: `saturday_duty_${bus.driver.id}_${date.toISOString()}`,
        })
      }
    }

    if (addedCount === 0 && existingOp) {
      throw new Error('جميع الباصات مضافة مسبقاً')
    }

    return tx.saturdayOperation.findUnique({
      where: { id: operation.id },
      include: {
        buses: {
          include: {
            bus: { select: { id: true, busNumber: true, capacity: true } },
            driver: { select: { id: true, name: true } },
            loads: {
              include: {
                student: {
                  select: {
                    id: true, name: true, zone: true,
                    destination: { select: { id: true, name: true } },
                    busStudents: {
                      where: { isActive: true },
                      include: { bus: { select: { id: true, busNumber: true } } },
                    },
                  },
                },
              },
              orderBy: { assignedAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  })

  broadcastSaturdayUpdate({ type: 'operation_created', operation: result, timestamp: new Date().toISOString() })
  return result
}

export async function addStudentToSaturdayBus(activeBusId, studentId, pickupTime) {
  const activeBus = await prisma.saturdayActiveBus.findUnique({
    where: { id: activeBusId },
    include: { loads: true, bus: { select: { busNumber: true } } },
  })
  if (!activeBus) throw new Error('الباص غير موجود في تشغيل السبت')

  if (activeBus.loads.length >= activeBus.capacitySnapshot) {
    throw new Error('الباص ممتلئ')
  }

  const existing = activeBus.loads.find(l => l.studentId === studentId)
  if (existing) throw new Error('الطالب موجود بالفعل في هذا الباص')

  const load = await prisma.$transaction(async (tx) => {
    const satLoad = await tx.saturdayBusLoad.create({
      data: { activeBusId, studentId, pickupTime: pickupTime || null },
      include: {
        student: {
          select: {
            id: true, name: true, zone: true,
            destination: { select: { id: true, name: true } },
            busStudents: {
              where: { isActive: true },
              include: { bus: { select: { id: true, busNumber: true } } },
            },
          },
        },
      },
    })

    const driverBus = await tx.saturdayActiveBus.findUnique({
      where: { id: activeBusId },
      include: { driver: { select: { id: true } } },
    })

    if (driverBus?.driver?.id) {
      const student = await tx.student.findUnique({ where: { id: studentId }, select: { name: true } })
      await createAndBroadcast({
        userId: driverBus.driver.id,
        type: 'saturday_student_added',
        title: 'إضافة طالب',
        message: `تم إضافة ${student?.name || 'طالب'} إلى باصك`,
        dedupKey: `saturday_student_added_${driverBus.driver.id}_${studentId}`,
      })
    }

    const studentUser = await tx.user.findUnique({ where: { studentId }, select: { id: true } })
    if (studentUser?.id) {
      const busNumber = activeBus.bus?.busNumber || ''
      const pickupMsg = pickupTime ? ` في الساعة ${pickupTime}` : ''
      await createAndBroadcast({
        userId: studentUser.id,
        type: 'saturday_student_added_to_student',
        title: 'إضافة لرحلة السبت',
        message: `تمت إضافتك إلى باص رقم ${busNumber}${pickupMsg}`,
        targetRoute: '/student',
        dedupKey: `saturday_student_added_to_student_${studentId}_${activeBusId}`,
      })
    }

    return satLoad
  })

  broadcastSaturdayUpdate({
    type: 'student_added',
    activeBusId,
    studentId,
    load,
    timestamp: new Date().toISOString(),
  })

  return load
}

export async function removeStudentFromSaturdayBus(activeBusId, studentId) {
  const load = await prisma.saturdayBusLoad.findUnique({
    where: { activeBusId_studentId: { activeBusId, studentId } },
  })
  if (!load) throw new Error('الطالب غير موجود في هذا الباص')

  await prisma.saturdayBusLoad.delete({ where: { id: load.id } })

  broadcastSaturdayUpdate({
    type: 'student_removed',
    activeBusId,
    studentId,
    timestamp: new Date().toISOString(),
  })
}

export async function updateSaturdayPickupTime(activeBusId, studentId, pickupTime) {
  const load = await prisma.saturdayBusLoad.update({
    where: { activeBusId_studentId: { activeBusId, studentId } },
    data: { pickupTime },
  })

  broadcastSaturdayUpdate({
    type: 'pickup_time_updated',
    activeBusId,
    studentId,
    pickupTime,
    timestamp: new Date().toISOString(),
  })

  return load
}

export async function closeSaturdayOperation(date = getLocalDate()) {
  const op = await prisma.saturdayOperation.findUnique({ where: { operationDate: date } })
  if (!op) throw new Error('لا يوجد تشغيل سبت لهذا التاريخ')

  const closed = await prisma.saturdayOperation.update({
    where: { id: op.id },
    data: { status: 'CLOSED' },
  })

  broadcastSaturdayUpdate({ type: 'operation_closed', date, timestamp: new Date().toISOString() })
  return closed
}

export async function removeSaturdayBus(operationId, busId) {
  const sab = await prisma.saturdayActiveBus.findUnique({
    where: { operationId_busId: { operationId, busId } },
  })
  if (!sab) throw new Error('الباص غير موجود في تشغيل السبت')

  await prisma.saturdayActiveBus.delete({ where: { id: sab.id } })

  broadcastSaturdayUpdate({
    type: 'bus_removed',
    operationId,
    busId,
    timestamp: new Date().toISOString(),
  })
}
