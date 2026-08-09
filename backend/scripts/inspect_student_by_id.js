import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try{
  const studentId = 'ea8d5f91-21a7-49fb-ac12-12ff5c61836e'
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  console.log('student:', JSON.stringify(student, null,2))
  if (!student) process.exit(0)
  const satLoads = await prisma.saturdayBusLoad.findMany({ where: { studentId }, include: { activeBus: true } })
  console.log('satLoads:', JSON.stringify(satLoads, null,2))
  const satAssignments = await prisma.saturdayAssignment.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 20 })
  console.log('satAssignments:', JSON.stringify(satAssignments, null,2))
  const assignments = await prisma.assignment.findMany({ where: { studentId }, orderBy: { date: 'desc' }, take: 20 })
  console.log('assignments:', JSON.stringify(assignments, null,2))
}finally{ await prisma.$disconnect() }
