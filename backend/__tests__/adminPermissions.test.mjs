import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_PAGE_CATALOG,
  normalizeAdminPermissions,
  canAccessAdminPage,
} from '../src/utils/adminPermissions.js'
import { toLocalDateKey, formatLocalDate, parseLocalDate, serializeLocalDate, toDbDate } from '../src/utils/dateUtils.js'

test('admin page catalog contains expected pages', () => {
  assert.ok(ADMIN_PAGE_CATALOG.length > 0)
  assert.ok(ADMIN_PAGE_CATALOG.some(page => page.key === 'dashboard'))
  assert.ok(ADMIN_PAGE_CATALOG.some(page => page.key === 'students'))
})

test('permissions are normalized and page access is enforced', () => {
  const allPages = normalizeAdminPermissions(['dashboard', 'students', 'buses'])
  assert.deepEqual(allPages, ['dashboard', 'students', 'buses'])

  assert.equal(canAccessAdminPage({ adminPermissions: ['dashboard', 'students'] }, '/admin'), true)
  assert.equal(canAccessAdminPage({ adminPermissions: ['dashboard', 'students'] }, '/admin/students'), true)
  assert.equal(canAccessAdminPage({ adminPermissions: ['dashboard'] }, '/admin/buses'), false)
  assert.equal(canAccessAdminPage({ adminPermissions: [] }, '/admin'), true)
  assert.equal(canAccessAdminPage({ role: 'admin' }, '/admin/buses'), true)
  assert.equal(canAccessAdminPage({ role: 'admin', adminPermissions: ['buses'] }, '/admin/students'), false)
  assert.equal(canAccessAdminPage({ role: 'admin', adminPermissions: ['financialControl'] }, '/admin/financial-control?tab=summary'), true)
  assert.equal(canAccessAdminPage({ role: 'admin', adminPermissions: ['financialControl'] }, '/admin/operations/today?tab=live'), false)
})

test('local date keys remain stable for weekly subscription checks', () => {
  const date = new Date(2026, 7, 13, 12, 0, 0)
  assert.equal(toLocalDateKey(date), '2026-08-13')
  assert.equal(toLocalDateKey(new Date(2026, 7, 14, 12, 0, 0)), '2026-08-14')
})

test('daily subscription dates are serialized without UTC drift', () => {
  const localDate = new Date(2026, 7, 19, 12, 0, 0)
  const serialized = serializeLocalDate(localDate)
  assert.equal(serialized, '2026-08-19')
  assert.equal(formatLocalDate(parseLocalDate(serialized)), '2026-08-19')
})

test('db date values preserve the same calendar day after persistence', () => {
  const dbDate = toDbDate(new Date(2026, 7, 20, 0, 0, 0))
  assert.equal(dbDate.toISOString(), '2026-08-20T12:00:00.000Z')
  assert.equal(formatLocalDate(parseLocalDate(dbDate)), '2026-08-20')
})
