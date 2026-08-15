import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

import attendanceRouter from '../src/routes/attendance.js'
import busRouter from '../src/routes/buses.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-security-phase-6-secret'

const prisma = new PrismaClient()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/buses', busRouter)
  return app
}

function signToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET)
}

async function createUserWithStudent(role, name, extra = {}) {
  const student = await prisma.student.create({
    data: {
      name,
      phone: `+966${Math.floor(Math.random() * 900000000) + 100000000}`,
      gender: 'MALE',
      ...extra.student,
    },
  })

  const username = `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const user = await prisma.user.create({
    data: {
      username,
      password: 'test-password',
      name,
      role,
      status: 'active',
      studentId: role === 'student' ? student.id : undefined,
      ...extra.user,
    },
  })

  return { student, user }
}

async function createBusWithDriver(driverUser, suffix = 'A') {
  const bus = await prisma.bus.create({
    data: {
      busNumber: `SEC-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      capacity: 30,
      status: 'active',
      driverId: driverUser.id,
      driverName: driverUser.name,
    },
  })
  return bus
}

async function setupAttendanceFixture() {
  const adminUser = await prisma.user.create({
    data: {
      username: `admin-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Admin A',
      role: 'admin',
      status: 'active',
    },
  })

  const { student: studentA, user: studentUserA } = await createUserWithStudent('student', 'Student A')
  const { student: studentB, user: studentUserB } = await createUserWithStudent('student', 'Student B')

  const driverUserA = await prisma.user.create({
    data: {
      username: `driver-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Driver A',
      role: 'driver',
      status: 'active',
    },
  })

  const driverUserB = await prisma.user.create({
    data: {
      username: `driver-att2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Driver B',
      role: 'driver',
      status: 'active',
    },
  })

  const ownBus = await createBusWithDriver(driverUserA, 'OWN')
  const otherBus = await createBusWithDriver(driverUserB, 'OTHER')

  const assignment = await prisma.assignment.create({
    data: {
      studentId: studentA.id,
      busId: ownBus.id,
      date: new Date(),
      period: 'MORNING',
      line: 'JEBALI',
      pickupTime: '07:30',
    },
  })

  await prisma.busStudent.create({
    data: {
      busId: ownBus.id,
      studentId: studentA.id,
      isActive: true,
      pickupTime: '07:30',
    },
  })

  const attendance = await prisma.attendance.create({
    data: {
      studentId: studentA.id,
      busId: ownBus.id,
      date: new Date(),
      status: 'present',
    },
  })

  return {
    app: buildApp(),
    adminUser,
    studentA,
    studentB,
    studentUserA,
    studentUserB,
    driverUserA,
    driverUserB,
    ownBus,
    otherBus,
    assignment,
    attendance,
  }
}

async function requestJson(app, path, token, init = {}) {
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const { port } = server.address()
  const headers = { ...(init.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: init.method || 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const text = await response.text()
    let json
    try { json = text ? JSON.parse(text) : null } catch { json = text }
    return { status: response.status, body: json }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

async function setupBusFixture() {
  const adminUser = await prisma.user.create({
    data: {
      username: `bus-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Bus Admin',
      role: 'admin',
      status: 'active',
    },
  })

  const { student: student, user: studentUser } = await createUserWithStudent('student', 'Bus Student')
  const driverUser = await prisma.user.create({
    data: {
      username: `bus-driver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Bus Driver',
      role: 'driver',
      status: 'active',
    },
  })
  const otherDriverUser = await prisma.user.create({
    data: {
      username: `bus-driver-other-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Other Driver',
      role: 'driver',
      status: 'active',
    },
  })

  const ownBus = await createBusWithDriver(driverUser, 'BUS-OWN')
  const otherBus = await createBusWithDriver(otherDriverUser, 'BUS-OTHER')

  await prisma.assignment.create({
    data: {
      studentId: student.id,
      busId: ownBus.id,
      date: new Date(),
      period: 'MORNING',
      line: 'JEBALI',
      pickupTime: '07:30',
    },
  })

  await prisma.busStudent.create({
    data: {
      busId: ownBus.id,
      studentId: student.id,
      isActive: true,
      pickupTime: '07:30',
    },
  })

  return {
    app: buildApp(),
    adminUser,
    student,
    studentUser,
    driverUser,
    otherDriverUser,
    ownBus,
    otherBus,
  }
}

test('ATTENDANCE 1: unauthenticated access is rejected', async () => {
  const { app } = await setupAttendanceFixture()
  const response = await requestJson(app, '/api/attendance/student/unknown')
  assert.equal(response.status, 401)
})

test('ATTENDANCE 2: student can access own attendance', async () => {
  const { app, studentA, studentUserA } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/student/${studentA.id}`, signToken({ id: studentUserA.id, role: 'student', studentId: studentA.id }))
  assert.equal(response.status, 200)
})

test('ATTENDANCE 3: student cannot access another student attendance', async () => {
  const { app, studentA, studentB, studentUserA } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/student/${studentB.id}`, signToken({ id: studentUserA.id, role: 'student', studentId: studentA.id }))
  assert.equal(response.status, 403)
})

test('ATTENDANCE 4: driver can access attendance for own bus/student', async () => {
  const { app, studentA, driverUserA, ownBus } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/today/${ownBus.id}`, signToken({ id: driverUserA.id, role: 'driver' }))
  assert.equal(response.status, 200)
})

test('ATTENDANCE 5: driver cannot access another drivers bus', async () => {
  const { app, driverUserA, otherBus } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/today/${otherBus.id}`, signToken({ id: driverUserA.id, role: 'driver' }))
  assert.equal(response.status, 403)
})

test('ATTENDANCE 6: driver cannot access unrelated student', async () => {
  const { app, driverUserA, ownBus, studentB } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/student/${studentB.id}`, signToken({ id: driverUserA.id, role: 'driver' }))
  assert.equal(response.status, 403)
})

test('ATTENDANCE 7: admin can access attendance', async () => {
  const { app, adminUser, studentA } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/student/${studentA.id}`, signToken({ id: adminUser.id, role: 'admin' }))
  assert.equal(response.status, 200)
})

test('ATTENDANCE 8: forged studentId is rejected', async () => {
  const { app, studentA, studentUserA } = await setupAttendanceFixture()
  const response = await requestJson(app, `/api/attendance/student/${studentA.id}x`, signToken({ id: studentUserA.id, role: 'student', studentId: studentA.id }))
  assert.equal(response.status, 403)
})

test('ATTENDANCE 9: forged busId is rejected', async () => {
  const { app, driverUserA } = await setupAttendanceFixture()
  const response = await requestJson(app, '/api/attendance/today/not-a-real-bus', signToken({ id: driverUserA.id, role: 'driver' }))
  assert.equal(response.status, 403)
})

test('ATTENDANCE 10: authorization failure happens before mutation', async () => {
  const { app, studentA, studentB, studentUserA } = await setupAttendanceFixture()
  const beforeCount = await prisma.attendance.count({ where: { studentId: studentB.id } })
  const response = await requestJson(app, '/api/attendance', signToken({ id: studentUserA.id, role: 'student', studentId: studentA.id }), {
    method: 'POST',
    body: {
      studentId: studentB.id,
      busId: (await prisma.bus.findFirst())?.id,
      date: new Date().toISOString(),
      status: 'late',
    },
  })
  const afterCount = await prisma.attendance.count({ where: { studentId: studentB.id } })
  assert.equal(response.status, 403)
  assert.equal(afterCount, beforeCount)
})

test('BUSES 11: unauthenticated access is rejected', async () => {
  const { app } = await setupBusFixture()
  const response = await requestJson(app, '/api/buses')
  assert.equal(response.status, 401)
})

test('BUSES 12: admin can list buses', async () => {
  const { app, adminUser } = await setupBusFixture()
  const response = await requestJson(app, '/api/buses', signToken({ id: adminUser.id, role: 'admin' }))
  assert.equal(response.status, 200)
})

test('BUSES 13: driver can only list own buses', async () => {
  const { app, driverUser, ownBus, otherBus } = await setupBusFixture()
  const response = await requestJson(app, '/api/buses', signToken({ id: driverUser.id, role: 'driver' }))
  assert.equal(response.status, 200)
  const list = response.body
  assert.ok(Array.isArray(list))
  assert.ok(list.some(bus => bus.id === ownBus.id))
  assert.ok(!list.some(bus => bus.id === otherBus.id))
})

test('BUSES 14: driver cannot request another drivers bus', async () => {
  const { app, driverUser, otherBus } = await setupBusFixture()
  const response = await requestJson(app, `/api/buses/${otherBus.id}`, signToken({ id: driverUser.id, role: 'driver' }))
  assert.equal(response.status, 403)
})

test('BUSES 15: student only gets permitted bus data', async () => {
  const { app, student, studentUser, ownBus, otherBus } = await setupBusFixture()
  const response = await requestJson(app, '/api/buses', signToken({ id: studentUser.id, role: 'student', studentId: student.id }))
  assert.equal(response.status, 200)
  const list = response.body
  assert.ok(Array.isArray(list))
  assert.ok(list.some(bus => bus.id === ownBus.id))
  assert.ok(!list.some(bus => bus.id === otherBus.id))
})

test('BUSES 16: student cannot request unrelated bus', async () => {
  const { app, student, studentUser, otherBus } = await setupBusFixture()
  const response = await requestJson(app, `/api/buses/${otherBus.id}`, signToken({ id: studentUser.id, role: 'student', studentId: student.id }))
  assert.equal(response.status, 403)
})

process.on('exit', async () => {
  await prisma.$disconnect().catch(() => {})
})
