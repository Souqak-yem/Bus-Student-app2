import { prisma } from './src/lib/prisma.js'
import { getLocalDate } from './src/utils/dateUtils.js'

const today = getLocalDate()
const op = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
console.log('OP', op?.id || 'NONE')
const active = await prisma.activeBus.findMany({
  where: { operationId: op?.id, status: { not: 'CANCELLED' } },
  include: { bus: { select: { id: true, busNumber: true, status: true, capacity: true, driver: { select: { name: true } } } } },
  orderBy: [{ busId: 'asc' }],
})
console.log('ACTIVE_BUSES')
console.log(JSON.stringify(active, null, 2))

const assignments = await prisma.assignment.findMany({
  where: { date: today, period: 'MORNING' },
  include: { bus: { select: { id: true, busNumber: true, status: true, capacity: true, driver: { select: { name: true } } } } },
  orderBy: [{ busId: 'asc' }, { sortOrder: 'asc' }],
})
console.log('ASSIGNMENTS')
console.log(JSON.stringify(assignments, null, 2))

await prisma.$disconnect()
