import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const payments = await prisma.payment.findMany({
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: { id: true, amount: true, date: true, subscriptionId: true, reference: true }
})

for (const payment of payments) {
  const sub = await prisma.subscription.findUnique({
    where: { id: payment.subscriptionId },
    select: { id: true, type: true, status: true, amount: true, paidAmount: true, paymentStatus: true }
  })
  console.log(JSON.stringify({ payment, sub }, null, 2))
}

await prisma.$disconnect()
