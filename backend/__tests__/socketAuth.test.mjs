import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canAccessActiveBusRoom,
  canAccessDriverBusRoom,
  authorizeSocketRoomJoin,
  socketAuthMiddleware,
} from '../src/services/socketService.js'

test('socketAuthMiddleware rejects missing token', () => {
  let called = false
  const next = (err) => {
    called = true
    assert.equal(err?.message, 'No token')
  }

  socketAuthMiddleware({ handshake: { auth: {} } }, next)
  assert.equal(called, true)
})

test('student cannot access another active bus room', async () => {
  const fakeDb = {
    activeBus: {
      findUnique: async ({ where }) => where.id === 'active-bus-1'
        ? { id: 'active-bus-1', busId: 'bus-1', driverId: 'driver-1', operationId: 'op-1', tripType: 'MORNING' }
        : null,
    },
    busLoad: {
      findFirst: async ({ where }) => (where.activeBusId === 'active-bus-1' && where.studentId === 'student-1') ? { id: 'load-1' } : null,
    },
    dailyOperation: {
      findUnique: async ({ where }) => where.id === 'op-1' ? { id: 'op-1', operationDate: new Date('2026-08-15') } : null,
    },
    assignment: {
      findFirst: async ({ where }) => where.studentId === 'student-1' && where.busId === 'bus-1' ? { id: 'assignment-1' } : null,
    },
  }

  const user = { role: 'student', studentId: 'student-2' }
  assert.equal(await canAccessActiveBusRoom(user, 'active-bus-1', fakeDb), false)
})

test('student can access their own active bus room', async () => {
  const user = { role: 'student', studentId: 'student-1' }
  const fakeDb = {
    activeBus: {
      findUnique: async ({ where }) => where.id === 'active-bus-1'
        ? { id: 'active-bus-1', busId: 'bus-1', driverId: 'driver-1', operationId: 'op-1', tripType: 'MORNING' }
        : null,
    },
    busLoad: {
      findFirst: async ({ where }) => where.activeBusId === 'active-bus-1' && where.studentId === 'student-1' ? { id: 'load-1' } : null,
    },
    dailyOperation: { findUnique: async () => null },
    assignment: { findFirst: async () => null },
  }

  assert.equal(await canAccessActiveBusRoom(user, 'active-bus-1', fakeDb), true)
})

test('driver cannot access another driver bus room', async () => {
  const user = { role: 'driver', id: 'driver-2' }
  const fakeDb = {
    bus: {
      findUnique: async ({ where }) => where.id === 'bus-1' ? { id: 'bus-1', driverId: 'driver-1' } : null,
    },
    activeBus: {
      findFirst: async ({ where }) => null,
    },
  }

  assert.equal(await canAccessDriverBusRoom(user, 'bus-1', fakeDb), false)
})

test('driver can access their own bus room', async () => {
  const user = { role: 'driver', id: 'driver-1' }
  const fakeDb = {
    bus: {
      findUnique: async ({ where }) => where.id === 'bus-1' ? { id: 'bus-1', driverId: 'driver-1' } : null,
    },
    activeBus: {
      findFirst: async () => null,
    },
  }

  assert.equal(await canAccessDriverBusRoom(user, 'bus-1', fakeDb), true)
})

test('admin keeps access to bus and tracking rooms', async () => {
  const user = { role: 'admin', id: 'admin-1' }
  assert.equal(await canAccessActiveBusRoom(user, 'active-bus-1', { activeBus: { findUnique: async () => null } }), true)
  assert.equal(await canAccessDriverBusRoom(user, 'bus-1', { bus: { findUnique: async () => null } }), true)
  assert.equal(await authorizeSocketRoomJoin(user, 'tracking', 'active-bus-1', {}), true)
})

test('arbitrary room IDs are rejected for non-admin users', async () => {
  const user = { role: 'student', studentId: 'student-1' }
  const fakeDb = {
    activeBus: { findUnique: async () => null },
    bus: { findUnique: async () => null },
    busLoad: { findFirst: async () => null },
    dailyOperation: { findUnique: async () => null },
    assignment: { findFirst: async () => null },
  }

  assert.equal(await authorizeSocketRoomJoin(user, 'tracking', 'active-bus-999', fakeDb), false)
  assert.equal(await authorizeSocketRoomJoin(user, 'driver_bus', 'bus-999', fakeDb), false)
  assert.equal(await authorizeSocketRoomJoin(user, 'user', 'another-user', fakeDb), false)
})
