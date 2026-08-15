import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_PAGE_CATALOG,
  normalizeAdminPermissions,
  canAccessAdminPage,
} from '../src/utils/adminPermissions.js'

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
  assert.equal(canAccessAdminPage({ adminPermissions: [] }, '/admin'), false)
  assert.equal(canAccessAdminPage({ role: 'admin' }, '/admin/buses'), true)
  assert.equal(canAccessAdminPage({ role: 'admin', adminPermissions: ['buses'] }, '/admin/students'), false)
  assert.equal(canAccessAdminPage({ role: 'admin', adminPermissions: ['financialControl'] }, '/admin/financial-control?tab=summary'), true)
  assert.equal(canAccessAdminPage({ role: 'admin', adminPermissions: ['financialControl'] }, '/admin/operations/today?tab=live'), false)
})
