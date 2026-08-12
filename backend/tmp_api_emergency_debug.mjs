import { prisma } from './src/lib/prisma.js'
import { signToken } from './src/services/authService.js'

const admins = await prisma.user.findMany({ where: { role: 'admin' }, orderBy: { createdAt: 'asc' }, take: 1 })
const admin = admins[0]
if (!admin) {
  console.log('NO_ADMIN')
  await prisma.$disconnect()
  process.exit(0)
}
const token = signToken(admin)
console.log('TOKEN_OK')
const res = await fetch('http://localhost:3002/api/emergency/buses', {
  headers: { Authorization: `Bearer ${token}` },
})
console.log('STATUS', res.status)
const json = await res.json()
console.log(JSON.stringify(json, null, 2))
await prisma.$disconnect()
