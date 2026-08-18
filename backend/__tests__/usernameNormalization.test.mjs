import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

import authRouter from '../src/routes/auth.js'
import {
  generateDriverUsername,
  generateStudentUsername,
  normalizeUsernameForLogin,
  findUserByLoginUsername,
} from '../src/services/authService.js'

const prisma = new PrismaClient()

function buildAuthApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  return app
}

async function requestJson(app, path, body) {
  const server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

test('1. أبو فارس + 33 produces أبوفارس33', () => {
  assert.equal(generateDriverUsername('أبو فارس', '33'), 'أبوفارس33')
})

test('2. driver name is not shortened to first token only', () => {
  assert.notEqual(generateDriverUsername('أبو فارس', '33'), 'أبو33')
  assert.equal(generateDriverUsername('محمد أحمد', '12'), 'محمدأحمد12')
})

test('3. student usernames with a space after dot normalize to the same username', () => {
  assert.equal(normalizeUsernameForLogin('عمر.بامسق'), normalizeUsernameForLogin('عمر. بامسق'))
})

test('4. leading and trailing spaces do not cause unnecessary failure', () => {
  assert.equal(normalizeUsernameForLogin('  عمر. بامسق  '), 'عمر.بامسق')
})

test('5. normalization does not allow access to another account', async () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const realUsername = `عمر.${suffix}`
  const otherUsername = `عمر.${suffix}2`

  const realUser = await prisma.user.create({
    data: {
      username: realUsername,
      password: await bcrypt.hash('safe-password-123', 10),
      name: 'عمر صالح بامسق',
      role: 'student',
      status: 'active',
    },
  })

  const otherUser = await prisma.user.create({
    data: {
      username: otherUsername,
      password: await bcrypt.hash('other-password-456', 10),
      name: 'عمر آخر',
      role: 'student',
      status: 'active',
    },
  })

  try {
    const result = await findUserByLoginUsername(`عمر. ${suffix}`)
    assert.equal(result?.id, realUser.id)
    assert.notEqual(result?.id, otherUser.id)

    const safeMiss = await findUserByLoginUsername(`عمر. ${suffix}2`)
    assert.equal(safeMiss?.id, otherUser.id)

    const malformed = await findUserByLoginUsername(`عمر. ${suffix}!!!`)
    assert.equal(malformed, null)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [realUser.id, otherUser.id] } } })
  }
})

test('6. invalid usernames are rejected', () => {
  assert.equal(normalizeUsernameForLogin('   '), null)
  assert.equal(normalizeUsernameForLogin(''), null)
  assert.equal(normalizeUsernameForLogin('!!!'), null)
})

test('7. stored usernames remain unchanged when lookup is normalized', async () => {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const storedUsername = `عمر.${suffix}`

  const user = await prisma.user.create({
    data: {
      username: storedUsername,
      password: await bcrypt.hash('existing-user-password', 10),
      name: 'عمر صالح بامسق',
      role: 'student',
      status: 'active',
    },
  })

  try {
    const before = (await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } })).username
    const resolved = await findUserByLoginUsername(`  عمر. ${suffix}  `)
    assert.equal(resolved?.username, storedUsername)
    const after = (await prisma.user.findUnique({ where: { id: user.id }, select: { username: true } })).username
    assert.equal(after, before)
  } finally {
    await prisma.user.delete({ where: { id: user.id } })
  }
})

test('8. normal login still works for students and drivers', async () => {
  const app = buildAuthApp()
  const studentSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const driverSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  const student = await prisma.user.create({
    data: {
      username: `عمر.${studentSuffix}`,
      password: await bcrypt.hash('student-pass-123', 10),
      name: 'عمر صالح بامسق',
      role: 'student',
      status: 'active',
    },
  })

  const driver = await prisma.user.create({
    data: {
      username: `أبوفارس${driverSuffix}`,
      password: await bcrypt.hash('driver-pass-456', 10),
      name: 'أبو فارس',
      role: 'driver',
      status: 'active',
    },
  })

  try {
    const studentResponse = await requestJson(app, '/api/auth/login', {
      username: `  عمر. ${studentSuffix}  `,
      password: 'student-pass-123',
    })
    assert.equal(studentResponse.status, 200)
    assert.equal(studentResponse.body.user.username, `عمر.${studentSuffix}`)

    const driverResponse = await requestJson(app, '/api/auth/login', {
      username: ` أبو فارس${driverSuffix} `,
      password: 'driver-pass-456',
    })
    assert.equal(driverResponse.status, 200)
    assert.equal(driverResponse.body.user.username, `أبوفارس${driverSuffix}`)
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [student.id, driver.id] } } })
  }
})

process.on('exit', async () => {
  await prisma.$disconnect().catch(() => {})
})
