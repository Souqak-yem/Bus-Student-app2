import { prisma } from './src/lib/prisma.js'
import { signToken } from './src/services/authService.js'

const admins = await prisma.user.findMany({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, take: 1 })
console.log('admins', admins.length)
if (admins.length > 0) {
  console.log('admin token generated')
}
await prisma.$disconnect()
