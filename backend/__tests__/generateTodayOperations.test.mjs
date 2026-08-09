import { PrismaClient } from '@prisma/client'
import { generateTodayOperations } from '../src/services/operationService.js'
import { getLocalDate } from '../src/utils/dateUtils.js'

const prisma = new PrismaClient()

async function main() {
  const today = getLocalDate()
  const suffix = Date.now()

  console.log('=== Test: generateTodayOperations auto-assigns template students ===')

  const admin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (!admin) {
    console.error('SKIP: No admin user found in DB')
    await prisma.$disconnect()
    return
  }

  let driver = await prisma.user.findFirst({ where: { role: 'driver' } })
  let createdDriver = false
  if (!driver) {
    driver = await prisma.user.create({
      data: {
        username: `gen-driver-${suffix}`,
        password: 'driver-password',
        name: `Gen Driver ${suffix}`,
        role: 'driver',
        status: 'active',
      }
    })
    createdDriver = true
    console.log(`Created test driver user: ${driver.id}`)
  }

  const bus = await prisma.bus.create({
    data: {
      busNumber: `GEN-BUS-${suffix}`,
      plateNumber: `GEN-${suffix}`,
      capacity: 10,
      status: 'active',
      driverId: driver.id,
    }
  })
  console.log(`Created test bus: ${bus.id}`)

  const weeklyStudent = await prisma.student.create({
    data: {
      name: `GEN_WEEKLY_${suffix}`,
      status: 'active',
      transportMode: 'LINE',
    }
  })
  const dailyStudent = await prisma.student.create({
    data: {
      name: `GEN_DAILY_${suffix}`,
      status: 'active',
      transportMode: 'LINE',
    }
  })
  console.log(`Created weekly student: ${weeklyStudent.id}`)
  console.log(`Created daily student: ${dailyStudent.id}`)

  const weeklyBusStudent = await prisma.busStudent.upsert({
    where: { studentId: weeklyStudent.id },
    create: {
      busId: bus.id,
      studentId: weeklyStudent.id,
      isActive: true,
      pickupTime: '06:10',
    },
    update: {
      busId: bus.id,
      isActive: true,
      pickupTime: '06:10',
    },
  })

  const dailyBusStudent = await prisma.busStudent.upsert({
    where: { studentId: dailyStudent.id },
    create: {
      busId: bus.id,
      studentId: dailyStudent.id,
      isActive: true,
      pickupTime: '06:20',
    },
    update: {
      busId: bus.id,
      isActive: true,
      pickupTime: '06:20',
    },
  })

  const dailySubscription = await prisma.subscription.create({
    data: {
      studentId: dailyStudent.id,
      type: 'DAILY',
      startDate: today,
      endDate: today,
      amount: 1,
      status: 'active',
    },
  })
  await prisma.dailyExecutionDate.create({
    data: {
      subscriptionId: dailySubscription.id,
      executionDate: today,
    },
  })
  console.log(`Created daily subscription: ${dailySubscription.id}`)

  const dayOfWeek = today.getDay()
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    console.error('SKIP: Today is Friday or Saturday; template student auto-assignment is not expected.')
    await cleanup({
      busId: bus.id,
      weeklyStudentId: weeklyStudent.id,
      dailyStudentId: dailyStudent.id,
      subscriptionId: dailySubscription.id,
      createdDriver,
    })
    return
  }

  const existingOperation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
  if (existingOperation) {
    const returnBuses = await prisma.activeBus.findMany({
      where: {
        operationId: existingOperation.id,
        tripType: 'RETURN',
        status: { not: 'CANCELLED' },
      },
      select: { id: true },
    })
    if (returnBuses.length > 0) {
      console.log('Removing existing RETURN active buses from today to allow generateTodayOperations test')
      await prisma.activeBus.deleteMany({
        where: {
          operationId: existingOperation.id,
          tripType: 'RETURN',
          status: { not: 'CANCELLED' },
        },
      })
    }
  }

  await prisma.assignment.deleteMany({
    where: {
      date: today,
      period: 'MORNING',
      studentId: { in: [weeklyStudent.id, dailyStudent.id] },
    },
  })

  console.log('Running generateTodayOperations...')
  const result = await generateTodayOperations(admin.id, [bus.id])
  console.log('Result:', result)

  const assignments = await prisma.assignment.findMany({
    where: {
      date: today,
      period: 'MORNING',
      studentId: { in: [weeklyStudent.id, dailyStudent.id] },
    },
    select: { studentId: true, busId: true, isGenerated: true },
  })

  const weeklyAssigned = assignments.some(a => a.studentId === weeklyStudent.id)
  const dailyAssigned = assignments.some(a => a.studentId === dailyStudent.id)

  console.log(`Weekly student assigned: ${weeklyAssigned}`)
  console.log(`Daily subscriber assigned: ${dailyAssigned}`)

  const pass = weeklyAssigned && !dailyAssigned

  if (pass) {
    console.log('\n✓ PASS: Weekly template student was assigned and daily subscriber was not auto-assigned.')
  } else {
    console.error('\n✗ FAIL: Expected only the weekly template student to be auto-assigned.')
    if (!weeklyAssigned) console.error('  - Weekly template student was not assigned.')
    if (dailyAssigned) console.error('  - Daily subscriber was incorrectly assigned.')
    process.exitCode = 1
  }

  await cleanup({
    busId: bus.id,
    weeklyStudentId: weeklyStudent.id,
    dailyStudentId: dailyStudent.id,
    subscriptionId: dailySubscription.id,
    createdDriver,
  })
}

async function cleanup({ busId, weeklyStudentId, dailyStudentId, subscriptionId, createdDriver }) {
  const today = getLocalDate()

  await prisma.assignment.deleteMany({
    where: {
      date: today,
      period: 'MORNING',
      studentId: { in: [weeklyStudentId, dailyStudentId] },
    },
  })
  await prisma.activeBus.deleteMany({ where: { busId } })
  await prisma.dailyExecutionDate.deleteMany({ where: { subscriptionId } })
  await prisma.subscription.delete({ where: { id: subscriptionId } })
  await prisma.bus.delete({ where: { id: busId } })
  await prisma.student.deleteMany({ where: { id: { in: [weeklyStudentId, dailyStudentId] } } })
  if (createdDriver) {
    await prisma.user.delete({ where: { id: driver.id } })
  }

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('Test error:', error)
  await prisma.$disconnect()
  process.exitCode = 1
})
