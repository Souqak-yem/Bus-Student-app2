import jwt from 'jsonwebtoken'
import { prisma } from '../src/lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'bus-students-jwt-secret-2026'
const base = 'http://localhost:3002'

async function api(path, token, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  let payload
  try { payload = text ? JSON.parse(text) : null } catch { payload = text }
  return { status: res.status, body: payload }
}

const adminUser = { id: 'a4c593ff-84ec-4ba6-ae96-bead9eb8ee7b', username: 'admin1', name: 'admin1', role: 'admin' }
const studentA = { id: '5491f835-c879-4135-92ae-f6e85bc8a3f0', username: 'عمر.بامسق', name: 'عمر صالح مبارك بامسق', role: 'student', studentId: '851adea0-67c9-49a5-9d5b-b45d8a128271' }
const studentB = { id: 'b4d5674d-1a5c-42bf-af17-b0daaf73d2ea', username: 'سعيد.باربيد', name: 'سعيد باربيد', role: 'student', studentId: '6fe09d91-1737-454a-a139-b06a83522e82' }
const driverA = { id: '648df439-2f85-474d-b63e-1b5b76c0ebee', username: 'هشام15', name: 'هشام', role: 'driver' }

const adminToken = jwt.sign(adminUser, JWT_SECRET)
const studentAToken = jwt.sign(studentA, JWT_SECRET)
const studentBToken = jwt.sign(studentB, JWT_SECRET)
const driverAToken = jwt.sign(driverA, JWT_SECRET)

const students = await prisma.student.findMany({ select: { id: true, name: true }, orderBy: { createdAt: 'desc' } })
const assignments = await prisma.assignment.findMany({
  select: {
    id: true,
    studentId: true,
    busId: true,
    bus: { select: { driverId: true, busNumber: true } },
    student: { select: { name: true } },
  },
  orderBy: { createdAt: 'desc' },
  take: 100,
})
const subscriptions = await prisma.subscription.findMany({
  select: { id: true, studentId: true, status: true, type: true },
  orderBy: { createdAt: 'desc' },
  take: 100,
})

const myAssignment = assignments.find(a => a.studentId === studentA.studentId) || assignments[0]
const otherAssignment = assignments.find(a => a.studentId !== studentA.studentId && a.studentId !== studentB.studentId) || assignments[1] || assignments[0]
const mySub = subscriptions.find(s => s.studentId === studentA.studentId) || subscriptions[0]
const otherSub = subscriptions.find(s => s.studentId !== studentA.studentId) || subscriptions[1] || subscriptions[0]

const tests = []

tests.push({ name: 'Student A own student record', expected: 200, actual: (await api(`/api/students/${studentA.studentId}`, studentAToken)).status })
tests.push({ name: 'Student A other student record', expected: 403, actual: (await api(`/api/students/${studentB.studentId}`, studentAToken)).status })
tests.push({ name: 'Admin other student record', expected: 200, actual: (await api(`/api/students/${studentB.studentId}`, adminToken)).status })

tests.push({ name: 'Student A own assignment', expected: 200, actual: (await api(`/api/assignments/${myAssignment.id}`, studentAToken)).status })
tests.push({ name: 'Student A other assignment', expected: 403, actual: (await api(`/api/assignments/${otherAssignment.id}`, studentAToken)).status })
tests.push({ name: 'Driver A own bus assignment', expected: 200, actual: (await api(`/api/assignments/${myAssignment.id}`, driverAToken)).status })
tests.push({ name: 'Driver A other bus assignment', expected: 403, actual: (await api(`/api/assignments/${otherAssignment.id}`, driverAToken)).status })
tests.push({ name: 'Admin any assignment', expected: 200, actual: (await api(`/api/assignments/${otherAssignment.id}`, adminToken)).status })

tests.push({ name: 'Student A own subscription', expected: 200, actual: (await api(`/api/subscriptions/${mySub.id}`, studentAToken)).status })
tests.push({ name: 'Student A other subscription', expected: 403, actual: (await api(`/api/subscriptions/${otherSub.id}`, studentAToken)).status })
tests.push({ name: 'Admin other subscription', expected: 200, actual: (await api(`/api/subscriptions/${otherSub.id}`, adminToken)).status })

tests.push({ name: 'Student A unauthenticated student record', expected: 401, actual: (await api(`/api/students/${studentB.studentId}`, null)).status })
tests.push({ name: 'Student A unauthenticated assignment', expected: 401, actual: (await api(`/api/assignments/${otherAssignment.id}`, null)).status })
tests.push({ name: 'Student A unauthenticated subscription', expected: 401, actual: (await api(`/api/subscriptions/${otherSub.id}`, null)).status })

console.log(JSON.stringify({
  fixtures: {
    studentA,
    studentB,
    adminUser,
    driverA,
    students,
    assignments: assignments.slice(0, 10),
    subscriptions: subscriptions.slice(0, 10),
    chosen: {
      myAssignment,
      otherAssignment,
      mySub,
      otherSub,
    },
  },
  results: tests,
}, null, 2))

await prisma.$disconnect()
