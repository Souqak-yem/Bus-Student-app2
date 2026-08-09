import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
  try {
    const since = new Date(Date.now() - 5 * 60 * 1000) // last 5 minutes
    const satLoads = await prisma.saturdayBusLoad.findMany({ where: { assignedAt: { gte: since } }, include: { activeBus: true, student: true }, orderBy: { assignedAt: 'desc' } })
    const assignments = await prisma.assignment.findMany({ where: { createdAt: { gte: since } }, include: { bus: true, student: true }, orderBy: { createdAt: 'desc' } })
    console.log('since:', since.toISOString())
    console.log('recent saturday loads:', JSON.stringify(satLoads, null,2))
    console.log('recent daily assignments:', JSON.stringify(assignments, null,2))
  } finally { await prisma.$disconnect() }
}
run()
