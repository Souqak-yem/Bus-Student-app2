import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { createAuditLog } from '../lib/audit.js'

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return process.env.JWT_SECRET
}
const MAX_FAILED_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 15

export async function hashPassword(password) {
  return bcrypt.hash(password, 10)
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      adminPermissions: user.adminPermissions || [],
      mustChangePassword: user.mustChangePassword,
      studentId: user.studentId,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  )
}

export function generateStudentUsername(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  const first = parts[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  return `${first}.${last}`
}

export function generateDriverUsername(driverName, busNumber) {
  const cleanName = String(driverName || '').trim().replace(/\s+/g, '')
  const cleanBusNumber = String(busNumber || '').trim()
  return `${cleanName}${cleanBusNumber}`
}

export function normalizeUsernameForLogin(value) {
  if (typeof value !== 'string') return null

  const trimmed = value.normalize('NFKC').trim()
  if (!trimmed) return null

  const canonical = trimmed.replace(/\s*\.\s*/g, '.').replace(/\s+/g, '')
  if (!canonical || !/^[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*$/u.test(canonical)) {
    return null
  }

  return canonical
}

export async function findUserByLoginUsername(rawUsername) {
  const username = normalizeUsernameForLogin(rawUsername)
  if (!username) return null

  return prisma.user.findUnique({ where: { username } })
}

export async function ensureUniqueUsername(baseUsername) {
  let username = baseUsername
  let counter = 2
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${counter}`
    counter++
  }
  return username
}

export async function handleLoginAttempt(userId, success, ip) {
  if (success) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lastLogin: new Date(), lastIp: ip, lockedUntil: null },
    })
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const newAttempts = (user?.failedAttempts || 0) + 1
    const updateData = { failedAttempts: newAttempts }
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
    }
    await prisma.user.update({ where: { id: userId }, data: updateData })
  }
}

export function isAccountLocked(user) {
  if (!user.lockedUntil) return false
  if (new Date() > user.lockedUntil) return false
  return true
}

export async function authAudit(action, userId, details = {}) {
  await createAuditLog({
    userId,
    action,
    entityType: 'USER',
    entityId: userId,
    newValue: details,
  })
}
