import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try {
  const bus = await prisma.bus.findFirst({ where: { busNumber: '15' } })
  console.log('bus:', JSON.stringify(bus, null,2))
  if (!bus) process.exit(0)
  const activeBuses = await prisma.activeBus.findMany({ where: { busId: bus.id }, include: { operation: true } })
  console.log('activeBuses:', JSON.stringify(activeBuses, null,2))
  const satActive = await prisma.saturdayActiveBus.findMany({ where: { busId: bus.id }, include: { saturdayOperation: true } })
  console.log('saturdayActiveBuses:', JSON.stringify(satActive, null,2))
  const assignments = await prisma.assignment.findMany({ where: { busId: bus.id }, orderBy: { date: 'desc' }, take: 20 })
  console.log('assignments:', JSON.stringify(assignments, null,2))
} finally { await prisma.$disconnect() }
