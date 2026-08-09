import { PrismaClient } from '../node_modules/.prisma/client/index.js'
;(async () => {
  const prisma = new PrismaClient()
  try {
    const r = await prisma.busStudent.findUnique({ where: { studentId: process.argv[2] } })
    console.log(JSON.stringify(r, null, 2))
  } catch (e) {
    console.error(e)
  } finally {
    await prisma.$disconnect()
  }
})()
