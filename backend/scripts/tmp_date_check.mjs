import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const today = new Date()
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

console.log('today local', today.toString())
console.log('start local', start.toString(), start.toISOString())
console.log('end local', end.toString(), end.toISOString())

const rows = await prisma.payment.findMany({
  where: {
    date: { gte: start, lt: end },
    subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
  },
  select: { id: true, amount: true, date: true },
})
console.log('rows by local range', rows)

const rows2 = await prisma.payment.findMany({
  where: {
    date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())), lt: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()+1)) },
    subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
  },
  select: { id: true, amount: true, date: true },
})
console.log('rows by utc range', rows2)

const agg1 = await prisma.payment.aggregate({
  _sum: { amount: true },
  where: {
    date: { gte: start, lt: end },
    subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
  },
})
const agg2 = await prisma.payment.aggregate({
  _sum: { amount: true },
  where: {
    date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())), lt: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()+1)) },
    subscription: { status: { in: ['active', 'expired', 'cancelled'] } },
  },
})
console.log('agg1', agg1)
console.log('agg2', agg2)

await prisma.$disconnect()
