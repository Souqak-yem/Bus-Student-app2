import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { prisma } from '../src/lib/prisma.js'

const BASE = 'http://localhost:3000/api'

async function tokenFor(role) {
  const user = await prisma.user.findFirst({ where: { role }, select: { id: true, username: true, role: true } })
  return { user, token: jwt.sign({ id: user.id, username: user.username, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' }) }
}

async function call(name, url, opts) {
  try {
    const r = await fetch(BASE + url, opts)
    const body = await r.text()
    console.log(`${name} -> ${r.status} ${body.slice(0, 160).replace(/\n/g, ' ')}`)
  } catch (e) {
    console.log(`${name} -> NETWORK FAIL ${e.message}`)
  }
}

const admin = await tokenFor('admin')
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }

await call('return/operation GET', '/return/operation', { headers: H })
await call('return/active-buses GET', '/return/active-buses', { headers: H })
await call('return/queue GET', '/return/queue', { headers: H })
await call('return-readiness/student/dashboard GET', '/return-readiness/student/dashboard?operationDay=NORMAL', { headers: H })
await call('operations/today GET', '/operations/today', { headers: H })
await call('operations/today?operationDay=SATURDAY', '/operations/today?operationDay=SATURDAY', { headers: H })

await prisma.$disconnect()
