import { prisma } from '../src/lib/prisma.js'

const sid = '851adea0-67c9-49a5-9d5b-b45d8a128271'
const assignments = await prisma.assignment.findMany({
  where: { studentId: sid },
  select: { id: true, studentId: true, busId: true, status: true },
  orderBy: { createdAt: 'desc' },
})
const subscriptions = await prisma.subscription.findMany({
  where: { studentId: sid },
  select: { id: true, studentId: true, status: true, type: true },
  orderBy: { createdAt: 'desc' },
})
console.log(JSON.stringify({ sid, assignments, subscriptions }, null, 2))
await prisma.$disconnect()
