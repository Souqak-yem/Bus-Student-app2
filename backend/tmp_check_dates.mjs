import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const rows = await prisma.subscription.findMany({
    where: { type: 'DAILY', status: 'active' },
    select: {
      id: true,
      studentId: true,
      startDate: true,
      endDate: true,
      executionDates: {
        orderBy: { executionDate: 'asc' },
        select: { executionDate: true },
      },
    },
    take: 20,
  })

  console.log(JSON.stringify(rows, null, 2))
} finally {
  await prisma.$disconnect()
}
