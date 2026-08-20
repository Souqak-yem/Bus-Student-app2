import crypto from 'node:crypto'
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { safeError } from '../utils/secrets.js'
import {
  hashPassword, comparePassword, signToken,
  handleLoginAttempt, isAccountLocked, authAudit,
  findUserByLoginUsername, normalizeUsernameForLogin,
  normalizePhoneForComparison, generateTemporaryPassword,
} from '../services/authService.js'
import { expireSubscriptions } from '../services/subscriptionService.js'
import { createAndBroadcast } from '../services/notificationService.js'

const router = Router()

router.post('/forgot-password', async (req, res) => {
  try {
    const { username, phone, parentName } = req.body
    const normalizedUsername = normalizeUsernameForLogin(username)
    const normalizedPhone = normalizePhoneForComparison(phone)
    const normalizedParentName = String(parentName || '').trim()

    if (!normalizedUsername || !normalizedPhone || !normalizedParentName) {
      return res.status(400).json({ error: 'اسم المستخدم ورقم الهاتف واسم ولي الأمر مطلوبون' })
    }

    const user = await findUserByLoginUsername(normalizedUsername)
    if (!user || user.role !== 'student') {
      return res.status(400).json({ error: 'بيانات الطالب غير صحيحة' })
    }

    const student = await prisma.student.findUnique({ where: { id: user.studentId } })
    if (!student) {
      return res.status(400).json({ error: 'بيانات الطالب غير صحيحة' })
    }

    const phoneMatches = normalizePhoneForComparison(student.phone || student.whatsapp || '') === normalizedPhone
    const parentMatches = String(student.parentName || '').trim().localeCompare(normalizedParentName, undefined, { sensitivity: 'base' }) === 0

    if (!phoneMatches || !parentMatches) {
      return res.status(400).json({ error: 'بيانات الطالب غير صحيحة' })
    }

    const requestId = crypto.randomUUID()
    const requestData = {
      id: requestId,
      username: user.username,
      userId: user.id,
      studentId: student.id,
      studentName: student.name,
      phone: user.phone || student.phone || '',
      parentName: student.parentName || '',
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
    }

    await prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET_REQUEST',
        entityType: 'PASSWORD_RESET_REQUEST',
        entityId: requestId,
        oldValue: null,
        newValue: requestData,
        reason: 'PASSWORD_RESET_REQUESTED',
      },
    })

    const admins = await prisma.user.findMany({
      where: { role: 'admin', status: 'active' },
      select: { id: true },
    })

    await Promise.all(admins.map((admin) => createAndBroadcast({
      userId: admin.id,
      type: 'password_reset_request',
      title: 'طلب استعادة كلمة مرور جديد',
      message: `طلب الطالب ${student.name || user.username} استعادة كلمة المرور. يرجى مراجعة البيانات والموافقة أو الرفض.`,
      targetRoute: '/admin/manage/password-reset-requests',
      data: { requestId, username: user.username, studentName: student.name },
      dedupKey: `password_reset_request_${requestId}_${admin.id}`,
    })))

    return res.json({
      requested: true,
      status: 'PENDING',
      message: 'تم إرسال طلب استعادة كلمة المرور إلى الإدارة وسيتم مراجعة الطلب وتأكيده عبر الواتساب المسجل.',
      requestId,
    })
  } catch (error) {
    console.error('FORGOT_PASSWORD_ERROR:', error)
    return res.status(500).json({ error: 'فشل إرسال طلب استعادة كلمة المرور' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const normalizedUsername = normalizeUsernameForLogin(username)

    if (!normalizedUsername || !password) {
      return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' })
    }

    const user = await findUserByLoginUsername(normalizedUsername)
    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' })
    }

    if (isAccountLocked(user)) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      return res.status(429).json({ error: `الحساب مقفل. حاول بعد ${remaining} دقيقة` })
    }

    const valid = await comparePassword(password, user.password)
    const ip = req.ip || req.connection?.remoteAddress || ''

    if (!valid) {
      await handleLoginAttempt(user.id, false, ip)
      await authAudit('LOGIN_FAILED', user.id, { ip })
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' })
    }

    if (user.status !== 'active') {
      return res.status(401).json({ error: 'الحساب غير نشط' })
    }

    await handleLoginAttempt(user.id, true, ip)
    await authAudit('LOGIN_SUCCESS', user.id, { ip })
    await expireSubscriptions()

    const token = signToken(user)

    let profile = null
    if (user.role === 'student' && user.studentId) {
      const student = await prisma.student.findUnique({
        where: { id: user.studentId },
        select: { id: true, name: true, zone: true, transportMode: true },
      })
      if (student) profile = student
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        adminPermissions: user.adminPermissions || [],
        mustChangePassword: user.mustChangePassword,
      },
      profile,
    })
  } catch (error) {
    console.error('LOGIN ERROR:', error)
    safeError(res, error, 'auth/login')
  }
})

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

    const valid = await comparePassword(currentPassword, user.password)
    if (!valid) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' })
    }

    const hashed = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false },
    })

    await authAudit('PASSWORD_CHANGED', user.id)

    const token = signToken({ ...user, mustChangePassword: false })

    res.json({ message: 'تم تغيير كلمة المرور بنجاح', token })
  } catch (error) {
    safeError(res, error, 'auth/change-password')
  }
})

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, username: true, name: true, phone: true,
        role: true, status: true, adminPermissions: true, mustChangePassword: true,
        lastLogin: true, studentId: true,
      },
    })
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.json(user)
  } catch (error) {
    safeError(res, error, 'auth/me')
  }
})

export default router
