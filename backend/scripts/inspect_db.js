import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

try {
  const tables = await prisma.$queryRaw`select table_name from information_schema.tables where table_schema='public' order by table_name`
  console.log('tables:', tables)
  const migrations = await prisma.$queryRaw`select * from public._prisma_migrations limit 20`
  console.log('prisma_migrations:', migrations)
} catch (error) {
  console.error('error', error)
} finally {
  await prisma.$disconnect()
}
