import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const loads = await prisma.saturdayBusLoad.findMany({
    orderBy: { assignedAt: 'desc' },
    take: 50,
    include: { student: true, activeBus: { include: { bus: true } } }
  })
  console.log(JSON.stringify(loads, null, 2))
} finally {
  await prisma.$disconnect()
}
