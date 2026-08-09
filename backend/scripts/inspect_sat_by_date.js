import { PrismaClient } from '@prisma/client'
import { resolveExecutionDate } from '../src/utils/dateUtils.js'
const prisma = new PrismaClient()
try {
  const satDate = resolveExecutionDate('SATURDAY')
  const op = await prisma.saturdayOperation.findUnique({ where: { operationDate: satDate }, include: { buses: { include: { bus: true, loads: { include: { student: true } } } } } })
  console.log('satDate', satDate.toISOString().slice(0,10))
  console.log(JSON.stringify(op, null,2))
  const active = await prisma.saturdayActiveBus.findMany({ where: { operationId: op?.id }, include: { bus: true, loads: true } })
  console.log('active buses:', JSON.stringify(active, null,2))
} finally { await prisma.$disconnect() }
