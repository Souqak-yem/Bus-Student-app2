import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const notes = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' }, take: 50,
    where: { OR: [{ type: { contains: 'saturday' } }, { message: { contains: 'سبت' } }] }
  })
  console.log(JSON.stringify(notes, null, 2))
} finally { await prisma.$disconnect() }
