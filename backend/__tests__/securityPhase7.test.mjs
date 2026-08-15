import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

import messageTemplateRouter from '../src/routes/messageTemplates.js'
import attendanceRouter from '../src/routes/attendance.js'
import assignmentRouter from '../src/routes/assignments.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-security-phase-7-secret'

const prisma = new PrismaClient()

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/message-templates', messageTemplateRouter)
  app.use('/api/attendance', attendanceRouter)
  app.use('/api/assignments', assignmentRouter)
  return app
}

function signToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET)
}

async function createStudentAndBus() {
  const student = await prisma.student.create({
    data: {
      name: 'Phase7 Student',
      phone: `+966${Math.floor(Math.random() * 900000000) + 100000000}`,
      gender: 'MALE',
    },
  })

  const admin = await prisma.user.create({
    data: {
      username: `phase7-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Phase7 Admin',
      role: 'admin',
      status: 'active',
    },
  })

  const driver = await prisma.user.create({
    data: {
      username: `phase7-driver-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      password: 'test-password',
      name: 'Phase7 Driver',
      role: 'driver',
      status: 'active',
    },
  })

  const bus = await prisma.bus.create({
    data: {
      busNumber: `P7-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      capacity: 30,
      status: 'active',
      driverId: driver.id,
      driverName: driver.name,
    },
  })

  return { student, admin, bus }
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
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = text }
    return { status: response.status, body: json }
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

test('PHASE7 1: message template endpoint rejects mass-assignment fields', async () => {
  const app = buildApp()
  const response = await requestJson(app, '/api/message-templates', signToken({ id: 'admin-123', role: 'admin' }), {
    method: 'POST',
    body: {
      key: 'welcome-message',
      name: 'Welcome',
      message: 'Hello',
      isActive: true,
      role: 'admin',
      userId: 'evil-user',
    },
  })

  assert.equal(response.status, 400)
})

test('PHASE7 2: attendance rejects invalid enum values before write', async () => {
  const { student, admin, bus } = await createStudentAndBus()
  const app = buildApp()

  const response = await requestJson(app, '/api/attendance', signToken({ id: admin.id, role: 'admin' }), {
    method: 'POST',
    body: {
      studentId: student.id,
      busId: bus.id,
      date: new Date().toISOString(),
      status: 'hijacked',
      contacted: 'yes',
      contactTime: 'invalid',
      notes: 'hello',
    },
  })

  assert.equal(response.status, 400)
})

test('PHASE7 3: assignment batch rejects invalid IDs and enum values', async () => {
  const app = buildApp()
  const response = await requestJson(app, '/api/assignments/batch', signToken({ id: 'admin-123', role: 'admin' }), {
    method: 'POST',
    body: {
      busId: 'not-a-uuid',
      date: '2025-03-12',
      period: 'INVALID',
      line: 'NOPE',
      studentIds: ['bad-id', 'still-bad'],
    },
  })

  assert.equal(response.status, 400)
})

process.on('exit', async () => {
  await prisma.$disconnect().catch(() => {})
})
