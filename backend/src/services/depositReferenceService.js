import { prisma } from '../lib/prisma.js'

export function normalizeDepositReference(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ').toUpperCase()
}

export function hasDuplicateDepositReference(reference, candidateStudentId, existingRecords = []) {
  const normalized = normalizeDepositReference(reference)
  if (!normalized) return false

  return existingRecords.some(item => {
    const recordReference = normalizeDepositReference(item?.reference || item?.depositReference)
    if (!recordReference || recordReference !== normalized) return false
    return true
  })
}

export async function findDuplicateDepositReference(reference, prismaClient = prisma, options = {}) {
  const normalized = normalizeDepositReference(reference)
  if (!normalized) return null

  const { excludeId, excludeSource } = options

  const [payments, carts, enrollments] = await Promise.all([
    prismaClient.payment.findMany({
      where: { reference: { not: null } },
      select: { id: true, reference: true, subscription: { select: { studentId: true } } },
    }),
    prismaClient.cart.findMany({
      where: { depositReference: { not: null } },
      select: { id: true, studentId: true, depositReference: true, status: true },
    }),
    prismaClient.campaignEnrollment.findMany({
      where: { depositReference: { not: null } },
      select: { id: true, studentId: true, depositReference: true, receiptStatus: true },
    }),
  ])

  const all = [
    ...payments.map(item => ({ source: 'payment', id: item.id, studentId: item.subscription?.studentId || null, reference: item.reference })),
    ...carts.map(item => ({ source: 'cart', id: item.id, studentId: item.studentId, reference: item.depositReference })),
    ...enrollments.map(item => ({ source: 'enrollment', id: item.id, studentId: item.studentId, reference: item.depositReference })),
  ]

  const match = all.find(item => {
    if (normalizeDepositReference(item.reference) !== normalized) return false
    if (excludeSource && excludeSource === item.source && excludeId && item.id === excludeId) return false
    return true
  })

  return match || null
}

export async function assertDepositReferenceIsUnique(reference, prismaClient = prisma, options = {}) {
  const normalized = normalizeDepositReference(reference)
  if (!normalized) return

  const existing = await findDuplicateDepositReference(normalized, prismaClient, options)
  if (existing) {
    throw new Error(`رقم الإيداع "${normalized}" مستخدم مسبقاً، الرجاء إدخال رقم مختلف.`)
  }
}
