import assert from 'node:assert/strict'
import { normalizeDepositReference, hasDuplicateDepositReference, assertDepositReferenceIsUnique } from '../src/services/depositReferenceService.js'

const existing = [
  { studentId: 'student-1', reference: '123' },
  { studentId: 'student-2', reference: 'ABC-99' },
]

assert.equal(normalizeDepositReference('  123  '), '123')
assert.equal(normalizeDepositReference('abc-99'), 'ABC-99')
assert.equal(hasDuplicateDepositReference('123', 'student-2', existing), true)
assert.equal(hasDuplicateDepositReference('999', 'student-2', existing), false)
assert.equal(hasDuplicateDepositReference('ABC-99', 'student-2', existing), true)

const fakePrisma = {
  payment: { findMany: async () => [{ id: 'p1', reference: '123', subscription: { studentId: 'student-1' } }] },
  cart: { findMany: async () => [] },
  campaignEnrollment: { findMany: async () => [] },
}

await assert.rejects(
  () => assertDepositReferenceIsUnique('123', fakePrisma),
  /رقم الإيداع هذا تم إدخاله مسبقاً، يرجى التأكد/,
)

const sameCartPrisma = {
  payment: { findMany: async () => [] },
  cart: { findMany: async () => [{ id: 'cart-2', studentId: 'student-9', depositReference: '123', status: 'PENDING' }] },
  campaignEnrollment: { findMany: async () => [] },
}

await assert.doesNotReject(() =>
  assertDepositReferenceIsUnique('123', sameCartPrisma, { excludeId: 'cart-2', excludeSource: 'cart' }),
)

console.log('PASS: deposit reference uniqueness validation works')
