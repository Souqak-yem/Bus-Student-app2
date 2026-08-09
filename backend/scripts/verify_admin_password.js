import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

try {
  const user = await prisma.user.findUnique({
    where: { username: 'admin' },
    select: { id: true, username: true, password: true },
  })

  if (!user) {
    console.log(JSON.stringify({ found: false }))
    process.exit(0)
  }

  const valid = await bcrypt.compare('123', user.password)
  console.log(JSON.stringify({ found: true, username: user.username, valid }, null, 2))
} finally {
  await prisma.$disconnect()
}
