import assert from 'node:assert/strict'
import { normalizeDepositReference, hasDuplicateDepositReference } from '../src/services/depositReferenceService.js'

const existing = [
  { studentId: 'student-1', reference: '123' },
  { studentId: 'student-2', reference: 'ABC-99' },
]

assert.equal(normalizeDepositReference('  123  '), '123')
assert.equal(normalizeDepositReference('abc-99'), 'ABC-99')
assert.equal(hasDuplicateDepositReference('123', 'student-2', existing), true)
assert.equal(hasDuplicateDepositReference('999', 'student-2', existing), false)
assert.equal(hasDuplicateDepositReference('ABC-99', 'student-2', existing), true)

console.log('PASS: deposit reference uniqueness validation works')
