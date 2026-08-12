import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const students = await prisma.user.findMany({ where: { role: 'student' }, take: 10 })
  console.log('student users count:', students.length)
  console.log(JSON.stringify(students.map(u => ({ id: u.id, username: u.username, studentId: u.studentId, status: u.status })), null, 2))

  const campaigns = await prisma.campaign.findMany({ take: 10 })
  console.log('campaigns count:', campaigns.length)
  console.log(JSON.stringify(campaigns.map(c => ({ id: c.id, type: c.type, title: c.title, enableExtraRegistrationFee: c.enableExtraRegistrationFee, extraRegistrationFee: c.extraRegistrationFee, discountAmount: c.discountAmount, discountExpiry: c.discountExpiry, extraFeeStart: c.extraFeeStart })), null, 2))

  await prisma.$disconnect()
}

main().catch(async e => { console.error('ERROR', e); await prisma.$disconnect(); process.exit(1) })
