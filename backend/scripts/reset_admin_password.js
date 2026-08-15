import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = '123'
  const hash = await bcrypt.hash(password, 10)

  const admins = await prisma.user.findMany({ where: { role: 'admin' } })
  if (!admins || admins.length === 0) {
    console.error('No admin users found.')
    process.exit(1)
  }

  for (const a of admins) {
    await prisma.user.update({ where: { id: a.id }, data: { password: hash, mustChangePassword: false } })
    console.log(`Reset password for admin user: ${a.username}`)
  }

  console.log('Admin password reset completed successfully')
}

main().catch(e=>{ console.error(e); process.exit(1) }).finally(()=>prisma.$disconnect())
