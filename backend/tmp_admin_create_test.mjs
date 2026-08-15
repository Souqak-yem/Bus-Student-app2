import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

try {
  const username = `tmp_admin_${Date.now()}`
  const password = 'TestPass123!'

  const user = await prisma.user.create({
    data: {
      username,
      name: 'Temp Admin',
      password: await bcrypt.hash(password, 10),
      role: 'admin',
      adminPermissions: ['dashboard', 'students'],
      mustChangePassword: false,
    },
  })

  console.log(JSON.stringify({
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: user.adminPermissions,
  }))

  await prisma.user.delete({ where: { id: user.id } })
  console.log('DELETE_OK')
} finally {
  await prisma.$disconnect()
}
