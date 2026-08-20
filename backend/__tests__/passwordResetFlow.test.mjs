import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

import authRouter from '../src/routes/auth.js'
import adminRouter from '../src/routes/admin.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret'

const prisma = new PrismaClient()

function buildAuthApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api/admin', adminRouter)
  return app
}

async function requestJson(app, path, body, token) {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const text = await response.text()
    let json = null
    try { json = text ? JSON.parse(text) : null } catch { json = text }
    return { status: response.status, body: json }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('forgot password request is created only for a matching student account', async () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const admin = await prisma.user.create({
    data: {
      username: `admin-notification-${suffix}`,
      password: await bcrypt.hash('admin-pass-123', 10),
      name: 'Admin Notification',
      role: 'admin',
      status: 'active',
    },
  })

  const student = await prisma.student.create({
    data: {
      name: 'طالب اختبار',
      phone: '0500000001',
      whatsapp: '0500000001',
      parentName: 'ولي الأمر الأول',
      parentPhone: '0550000001',
      parentRelation: 'أب',
      address: 'عنوان',
      zone: 'المنطقة',
      major: 'العلوم',
      level: 'الثالث',
      institutionName: 'المدرسة',
      gender: 'MALE',
    },
  })

  const user = await prisma.user.create({
    data: {
      username: `طالب${suffix}`,
      password: await bcrypt.hash('old-pass-123', 10),
      name: 'طالب اختبار',
      phone: '0500000001',
      role: 'student',
      status: 'active',
      studentId: student.id,
      mustChangePassword: false,
    },
  })

  try {
    const app = buildAuthApp()
    const res = await requestJson(app, '/api/auth/forgot-password', {
      username: `طالب${suffix}`,
      phone: '0500000001',
      parentName: 'ولي الأمر الأول',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.requested, true)
    assert.equal(res.body.status, 'PENDING')

    const pendingLog = await prisma.auditLog.findFirst({
      where: { action: 'PASSWORD_RESET_REQUEST', entityType: 'PASSWORD_RESET_REQUEST' },
      orderBy: { createdAt: 'desc' },
    })

    assert.ok(pendingLog)
    assert.equal(pendingLog.newValue.username, `طالب${suffix}`)

    const notification = await prisma.notification.findFirst({
      where: {
        userId: admin.id,
        type: 'password_reset_request',
        targetRoute: '/admin/manage/password-reset-requests',
        data: { path: ['requestId'], equals: res.body.requestId },
      },
    })
    assert.ok(notification)
    assert.equal(notification.isRead, false)
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
    await prisma.student.delete({ where: { id: student.id } }).catch(() => {})
    await prisma.user.delete({ where: { id: admin.id } }).catch(() => {})
  }
})

test('admin approve resets the password and forces change on next login', async () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const student = await prisma.student.create({
    data: {
      name: 'طالب موافقة',
      phone: '0500000002',
      whatsapp: '0500000002',
      parentName: 'ولي الأمر الثاني',
      parentPhone: '0550000002',
      parentRelation: 'أم',
      address: 'عنوان',
      zone: 'المنطقة',
      major: 'العلوم',
      level: 'الثالث',
      institutionName: 'المدرسة',
      gender: 'FEMALE',
    },
  })

  const user = await prisma.user.create({
    data: {
      username: `موافقة${suffix}`,
      password: await bcrypt.hash('old-pass-456', 10),
      name: 'طالب موافقة',
      phone: '0500000002',
      role: 'student',
      status: 'active',
      studentId: student.id,
      mustChangePassword: false,
    },
  })

  const app = buildAuthApp()
  const requestRes = await requestJson(app, '/api/auth/forgot-password', {
    username: `موافقة${suffix}`,
    phone: '0500000002',
    parentName: 'ولي الأمر الثاني',
  })

  assert.equal(requestRes.status, 200)

  const log = await prisma.auditLog.findFirst({
    where: {
      action: 'PASSWORD_RESET_REQUEST',
      entityType: 'PASSWORD_RESET_REQUEST',
      newValue: { path: ['username'], string_contains: `موافقة${suffix}` },
    },
    orderBy: { createdAt: 'desc' },
  })

  assert.ok(log)

  const adminToken = await prisma.user.create({
    data: {
      username: `admin-reset-${suffix}`,
      password: await bcrypt.hash('admin-pass-123', 10),
      name: 'Admin Reset',
      role: 'admin',
      status: 'active',
    },
  })

  const token = jwt.sign({ id: adminToken.id, role: 'admin', username: adminToken.username, name: adminToken.name, adminPermissions: [] }, process.env.JWT_SECRET, { expiresIn: '1h' })

  const approveRes = await requestJson(app, `/api/admin/password-reset-requests/${log.id}/approve`, {}, token)
  assert.equal(approveRes.status, 200)
  assert.equal(approveRes.body.approved, true)

  const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
  assert.equal(updatedUser.mustChangePassword, true)

  await prisma.user.delete({ where: { id: adminToken.id } }).catch(() => {})
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
  await prisma.student.delete({ where: { id: student.id } }).catch(() => {})
})

process.on('exit', async () => {
  await prisma.$disconnect().catch(() => {})
})
