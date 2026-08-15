import { prisma } from '../src/lib/prisma.js'

const users = await prisma.user.findMany({
  select: { id: true, username: true, name: true, role: true, studentId: true },
  orderBy: { createdAt: 'desc' },
  take: 200,
})

const students = await prisma.student.findMany({
  select: { id: true, name: true, phone: true, zone: true },
  orderBy: { createdAt: 'desc' },
  take: 200,
})

const drivers = await prisma.user.findMany({
  where: { role: 'driver' },
  select: { id: true, username: true, name: true, studentId: true },
  take: 200,
})

const assignments = await prisma.assignment.findMany({
  select: { id: true, studentId: true, busId: true, date: true, status: true },
  orderBy: { createdAt: 'desc' },
  take: 200,
})

const subscriptions = await prisma.subscription.findMany({
  select: { id: true, studentId: true, status: true, type: true },
  orderBy: { createdAt: 'desc' },
  take: 200,
})

const buses = await prisma.bus.findMany({
  select: { id: true, busNumber: true, driverId: true },
  take: 200,
})

console.log(JSON.stringify({ users, students, drivers, buses, assignments, subscriptions }, null, 2))
await prisma.$disconnect()
