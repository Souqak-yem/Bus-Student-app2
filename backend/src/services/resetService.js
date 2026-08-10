import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma.js'
import { createAuditLog } from '../lib/audit.js'
import { generateRandomPassword, requireDev } from '../utils/secrets.js'

export async function resetOperations(userId, ip) {
  await prisma.$transaction(async (tx) => {
    await tx.busLoad.deleteMany()
    await tx.returnQueue.deleteMany()
    await tx.activeBus.deleteMany()
    await tx.attendance.deleteMany()
    await tx.assignment.deleteMany()
    await tx.busStudentOrder.deleteMany()
    await tx.dailyOperation.deleteMany()
    await tx.emergencyLog.deleteMany()
    await tx.emergencyReport.deleteMany()
    await tx.studentTransfer.deleteMany({ where: { type: 'TEMPORARY' } })
  })

  await createAuditLog({
    userId, action: 'RESET_OPERATIONS', entityType: 'System',
    reason: 'إعادة تهيئة بيانات التشغيل اليومية', newValue: { ip },
  })
}

export async function resetSubscriptions(userId, ip) {
  await prisma.$transaction(async (tx) => {
    await tx.dailyExecutionDate.deleteMany({
      where: { subscription: { status: 'expired', type: 'DAILY' } },
    })
    await tx.payment.deleteMany({
      where: { subscription: { status: 'expired', type: 'DAILY' } },
    })
    await tx.subscription.deleteMany({ where: { status: 'expired', type: 'DAILY' } })
    await tx.campaignEnrollment.deleteMany()
    await tx.campaign.deleteMany()
  })

  await createAuditLog({
    userId, action: 'RESET_SUBSCRIPTIONS', entityType: 'System',
    reason: 'إعادة تعيين بيانات الاشتراكات', newValue: { ip },
  })
}

export async function resetNotifications(userId, ip) {
  const count = await prisma.notification.count()
  await prisma.notification.deleteMany()

  await createAuditLog({
    userId, action: 'RESET_NOTIFICATIONS', entityType: 'System',
    reason: 'إعادة ضبط الإشعارات', newValue: { count, ip },
  })

  return count
}

export async function resetLogs(userId, ip) {
  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany()
  })

  await createAuditLog({
    userId, action: 'RESET_LOGS', entityType: 'System',
    reason: 'إعادة ضبط السجلات', newValue: { ip },
  })
}

export async function resetSystemFull(userId, ip, adminId) {
  await prisma.$transaction(async (tx) => {
    // NOTE: preserve system configuration records
    // - destinations
    // - pricing areas
    // - pricing rows
    await tx.busLoad.deleteMany()
    await tx.returnQueue.deleteMany()
    await tx.saturdayBusLoad.deleteMany()
    await tx.saturdayBoardingTimer.deleteMany()
    await tx.saturdayAssignment.deleteMany()
    await tx.saturdayReturnQueue.deleteMany()
    await tx.saturdayActiveBus.deleteMany()
    await tx.saturdayOperation.deleteMany()
    await tx.activeBus.deleteMany()
    await tx.attendance.deleteMany()
    await tx.assignment.deleteMany()
    await tx.busStudentOrder.deleteMany()
    await tx.dailyOperation.deleteMany()
    await tx.emergencyLog.deleteMany()
    await tx.emergencyReport.deleteMany()
    await tx.studentTransfer.deleteMany()
    await tx.dailyExecutionDate.deleteMany()
    await tx.payment.deleteMany()
    await tx.subscription.deleteMany()
    await tx.campaignEnrollment.deleteMany()
    await tx.campaign.deleteMany()
    await tx.studentFinancial.deleteMany()
    await tx.weeklySheetStudent.deleteMany()
    await tx.weeklySheetVersion.deleteMany()
    await tx.weeklySheet.deleteMany()
    await tx.busStudent.deleteMany()
    await tx.notification.deleteMany()
    await tx.auditLog.deleteMany()
    await tx.bus.deleteMany()
    await tx.student.deleteMany()
    await tx.user.deleteMany({ where: { role: { not: 'admin' } } })
    if (adminId) {
      await tx.user.deleteMany({
        where: { role: 'admin', id: { not: adminId } },
      })
    }
  })

  await createAuditLog({
    userId, action: 'RESET_SYSTEM_FULL', entityType: 'System',
    reason: 'إعادة ضبط النظام بالكامل (وضع التجربة)',
    newValue: { ip, timestamp: new Date().toISOString() },
  })
}

export async function seedDemoData(userId) {
  requireDev('Cannot seed demo data in production')
  return await prisma.$transaction(async (tx) => {
    const adminUser = await tx.user.findFirst({ where: { role: 'admin' } })
    if (!adminUser) throw new Error('لا يوجد أدمن')

    await tx.notification.deleteMany({ where: { type: 'demo_seed' } })
    await tx.busLoad.deleteMany({ where: { activeBus: { operation: { notes: 'demo_seed' } } } })
    await tx.returnQueue.deleteMany({ where: { operation: { notes: 'demo_seed' } } })
    await tx.activeBus.deleteMany({ where: { operation: { notes: 'demo_seed' } } })
    await tx.attendance.deleteMany({ where: { bus: { busNumber: { startsWith: 'تجريبي-' } } } })
    await tx.assignment.deleteMany({ where: { bus: { busNumber: { startsWith: 'تجريبي-' } } } })
    await tx.dailyOperation.deleteMany({ where: { notes: 'demo_seed' } })
    await tx.busStudent.deleteMany({ where: { bus: { busNumber: { startsWith: 'تجريبي-' } } } })
    await tx.bus.deleteMany({ where: { busNumber: { startsWith: 'تجريبي-' } } })
    await tx.user.deleteMany({ where: { username: { startsWith: 'driver_demo_' } } })
    await tx.student.deleteMany({ where: { name: { startsWith: 'طالب تجريبي' } } })

    const pricingAreas = await tx.pricingArea.findMany()
    const zone = pricingAreas[0]?.name || 'المنطقة العامة'

    const studentData = []
    for (let i = 1; i <= 30; i++) {
      studentData.push({
        name: `طالب تجريبي ${i}`,
        phone: `091${String(100000000 + i).slice(1)}`,
        zone,
        major: i % 2 === 0 ? 'هندسة' : 'طب',
        level: String((i % 4) + 1),
        institutionName: i % 2 === 0 ? 'جامعة الفاتح' : 'جامعة طرابلس',
        offDays: i % 7 === 0 ? ['FRIDAY'] : [],
        transportMode: i % 5 === 0 ? 'HOME' : 'LINE',
        status: 'active',
      })
    }
    await tx.student.createMany({ data: studentData })
    const students = await tx.student.findMany({ take: 30, orderBy: { createdAt: 'desc' } })

    const driverData = []
    for (let i = 1; i <= 6; i++) {
      driverData.push({
        username: `driver_demo_${i}`,
        password: bcrypt.hashSync(generateRandomPassword(), 10),
        name: `سائق تجريبي ${i}`,
        phone: `092${String(100000000 + i).slice(1)}`,
        role: 'driver',
        status: 'active',
      })
    }
    await tx.user.createMany({ data: driverData })
    const drivers = await tx.user.findMany({ where: { username: { startsWith: 'driver_demo_' } } })

    const busData = []
    for (let i = 1; i <= 8; i++) {
      busData.push({
        busNumber: `تجريبي-${i}`,
        plateNumber: `د-${String(1000 + i)}`,
        capacity: 20 + (i % 10),
        status: 'active',
        driverId: drivers[i % drivers.length]?.id || drivers[0]?.id,
        driverName: drivers[i % drivers.length]?.name || '',
        primaryPhone: `093${String(100000000 + i).slice(1)}`,
      })
    }
    await tx.bus.createMany({ data: busData })
    const buses = await tx.bus.findMany({ where: { busNumber: { startsWith: 'تجريبي-' } } })

    let busIdx = 0
    for (const student of students) {
      const bus = buses[busIdx % buses.length]
      await tx.busStudent.create({
        data: { busId: bus.id, studentId: student.id, pickupTime: '07:00', isActive: true },
      })
      busIdx++
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const operation = await tx.dailyOperation.create({
      data: {
        operationDate: today,
        createdById: adminUser.id,
        status: 'OPEN',
        notes: 'demo_seed',
      },
    })

    let sortOrder = 0
    for (const student of students) {
      const bs = await tx.busStudent.findUnique({ where: { studentId: student.id } })
      if (!bs) continue
      await tx.assignment.create({
        data: {
          studentId: student.id,
          busId: bs.busId,
          date: today,
          period: 'MORNING',
          pickupTime: '07:00',
          status: 'scheduled',
          isGenerated: true,
          sortOrder: sortOrder++,
        },
      })
    }

    for (const bus of buses) {
      await tx.activeBus.create({
        data: {
          operationId: operation.id,
          busId: bus.id,
          driverId: bus.driverId || drivers[0].id,
          capacitySnapshot: bus.capacity,
          status: 'AVAILABLE',
        },
      })
    }

    for (let i = 0; i < 10; i++) {
      const s = students[i]
      await tx.returnQueue.create({
        data: {
          operationId: operation.id,
          studentId: s.id,
          status: 'WAITING',
        },
      })
    }

    for (let i = 0; i < 10; i++) {
      const s = students[i]
      const bs = await tx.busStudent.findUnique({ where: { studentId: s.id } })
      if (!bs) continue
      await tx.attendance.create({
        data: {
          studentId: s.id,
          busId: bs.busId,
          date: today,
          status: i < 8 ? 'present' : 'absent',
        },
      })
    }

    for (let i = 0; i < 5; i++) {
      const s = students[i]
      await tx.notification.create({
        data: {
          userId: adminUser.id,
          type: 'demo_seed',
          title: 'بيانات تجريبية',
          message: 'تم إنشاء بيانات تجريبية للنظام',
        },
      })
    }

    return {
      students: students.length,
      drivers: drivers.length,
      buses: buses.length,
      assignments: students.length,
      attendances: 10,
      notifications: 5,
      returnQueue: 10,
    }
  })
}
