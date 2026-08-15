import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import fetch from 'node-fetch'

const prisma = new PrismaClient()

async function main() {
  const studentUser = await prisma.user.findFirst({ where: { role: 'student' } })
  console.log('student user', studentUser ? { id: studentUser.id, username: studentUser.username, studentId: studentUser.studentId, role: studentUser.role } : null)
  if (!studentUser) {
    throw new Error('no student user found')
  }
  const student = await prisma.student.findUnique({ where: { id: studentUser.studentId } })
  console.log('student record', student)
  const campaign = await prisma.campaign.findUnique({ where: { id: 'f7888b97-4369-4688-b98d-9c506079e224' } })
  console.log('campaign record', campaign)
  const token = jwt.sign({ id: studentUser.id, username: studentUser.username, name: studentUser.name, role: studentUser.role, mustChangePassword: studentUser.mustChangePassword, studentId: studentUser.studentId }, process.env.JWT_SECRET, { expiresIn: '7d' })
  console.log('using auth token for student portal request')
  const url = 'http://localhost:3002/api/student-portal/campaign-price/f7888b97-4369-4688-b98d-9c506079e224'
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log('status', res.status)
  const text = await res.text()
  console.log('body', text)
  if (res.ok) {
    console.log('json', JSON.parse(text))
  }
  const zonePricing = await prisma.pricingArea.findUnique({ where: { name: student.zone }, include: { prices: { where: { destinationId: student.destinationId || null } } } })
  console.log('zonePricing', zonePricing)
}

main().catch(async (err) => { console.error('ERR', err); await prisma.$disconnect(); process.exit(1) })
