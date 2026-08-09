import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const users = await prisma.user.findMany({
    where: { OR: [{ role: 'admin' }, { username: 'admin' }] },
    select: { id: true, username: true, role: true, status: true, mustChangePassword: true },
  })
  console.log(JSON.stringify(users, null, 2))
} finally {
  await prisma.$disconnect()
}
