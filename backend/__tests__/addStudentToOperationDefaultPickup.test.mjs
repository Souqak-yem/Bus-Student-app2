import { PrismaClient } from '@prisma/client'
import { addStudentToOperation } from '../src/services/operationService.js'
import { getLocalDate } from '../src/utils/dateUtils.js'

const prisma = new PrismaClient()

async function main() {
  const today = getLocalDate()
  const admin = await prisma.user.upsert({
    where: { username: 'default-pickup-admin' },
    update: {},
    create: {
      username: 'default-pickup-admin',
      password: 'pass',
      name: 'Default Pickup Admin',
      role: 'admin',
      status: 'active',
    },
  })

  const driver = await prisma.user.upsert({
    where: { username: 'default-pickup-driver' },
    update: {},
    create: {
      username: 'default-pickup-driver',
      password: 'pass',
      name: 'Default Pickup Driver',
      role: 'driver',
      status: 'active',
    },
  })

  const sourceBus = await prisma.bus.create({
    data: {
      busNumber: `DEF-SRC-${Date.now()}`,
      plateNumber: `DEF-SRC-${Date.now()}`,
      capacity: 10,
      status: 'active',
      driverId: driver.id,
    },
  })

  const targetBus = await prisma.bus.create({
    data: {
      busNumber: `DEF-TGT-${Date.now()}`,
      plateNumber: `DEF-TGT-${Date.now()}`,
      capacity: 10,
      status: 'active',
      driverId: driver.id,
    },
  })

  const student = await prisma.student.create({
    data: {
      name: `DefaultPickup_${Date.now()}`,
      status: 'active',
      transportMode: 'LINE',
    },
  })

  await prisma.busStudent.create({
    data: {
      busId: sourceBus.id,
      studentId: student.id,
      isActive: true,
      pickupTime: '07:30',
    },
  })

  const dailySubscription = await prisma.subscription.create({
    data: {
      studentId: student.id,
      type: 'DAILY',
      status: 'active',
      startDate: today,
      endDate: today,
      amount: 1,
    },
  })

  await prisma.dailyExecutionDate.create({
    data: {
      subscriptionId: dailySubscription.id,
      executionDate: today,
    },
  })

  await prisma.dailyOperation.upsert({
    where: { operationDate: today },
    update: {},
    create: {
      operationDate: today,
      createdById: admin.id,
    },
  })

  const assignment = await addStudentToOperation(targetBus.id, student.id, admin.id)

  if (assignment.pickupTime !== '07:30') {
    console.error('Expected default pickupTime 07:30 but got', assignment.pickupTime)
    process.exitCode = 1
  } else {
    console.log('PASS: default pickupTime applied from default bus template:', assignment.pickupTime)
  }

  await prisma.assignment.deleteMany({ where: { studentId: student.id, date: today } })
  await prisma.dailyExecutionDate.deleteMany({ where: { subscriptionId: dailySubscription.id } })
  await prisma.subscription.delete({ where: { id: dailySubscription.id } })
  await prisma.busStudent.deleteMany({ where: { studentId: student.id } })
  await prisma.student.delete({ where: { id: student.id } })
  await prisma.bus.deleteMany({ where: { id: { in: [sourceBus.id, targetBus.id] } } })
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, driver.id] } } })
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exitCode = 1
})
