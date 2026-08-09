import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const today = new Date()
  today.setHours(0,0,0,0)
  const op = await prisma.saturdayOperation.findUnique({
    where: { operationDate: today },
    include: {
      buses: { include: { bus: true, loads: { include: { student: true } } } }
    }
  })
  console.log(JSON.stringify({ today: today.toISOString().slice(0,10), op }, null, 2))
} finally {
  await prisma.$disconnect()
}
