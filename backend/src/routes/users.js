import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { hashPassword, generateStudentUsername, generateDriverUsername, ensureUniqueUsername, authAudit } from '../services/authService.js'
import { generateRandomPassword, getAdminInitialPassword } from '../utils/secrets.js'
import { normalizeAdminPermissions } from '../utils/adminPermissions.js'

const router = Router()
router.use(authenticate)

router.get('/', authorize('admin'), async (req, res) => {
  try {
    const { role, status, search } = req.query
    const where = {}
    if (role) where.role = role
    if (status) where.status = status
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ]
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, username: true, name: true, phone: true,
        role: true, status: true, adminPermissions: true, mustChangePassword: true,
        failedAttempts: true, lockedUntil: true,
        lastLogin: true, lastIp: true,
        studentId: true,
        createdAt: true,
        student: { select: { id: true, name: true } },
        buses: { select: { id: true, busNumber: true }, take: 1 },
      },
    })

    res.json(users)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', authorize('admin'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, username: true, name: true, phone: true,
        role: true, status: true, adminPermissions: true, mustChangePassword: true,
        failedAttempts: true, lockedUntil: true,
        lastLogin: true, lastIp: true, studentId: true,
        createdAt: true, updatedAt: true,
        student: { select: { id: true, name: true } },
        buses: { select: { id: true, busNumber: true } },
      },
    })
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { username, name, phone, password, adminPermissions } = req.body
    if (!username || !name || !password) {
      return res.status(400).json({ error: 'اسم المستخدم والاسم وكلمة المرور مطلوبون' })
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' })
    }

    const normalizedPermissions = normalizeAdminPermissions(adminPermissions)
    const hashed = await hashPassword(password)
    const role = 'admin'
    const mustChangePassword = false

    const createData = {
      username,
      name,
      password: hashed,
      role,
      adminPermissions: normalizedPermissions,
      mustChangePassword,
    }

    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      createData.phone = String(phone).trim()
    }

    const user = await prisma.user.create({
      data: createData,
    })

    await authAudit('USER_CREATED', req.user.id, { username, role, adminPermissions: normalizedPermissions })

    res.status(201).json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      adminPermissions: user.adminPermissions,
      mustChangePassword: user.mustChangePassword,
    })
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' })
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { username, name, phone, status } = req.body
    const data = {}
    if (username !== undefined) data.username = username
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (status !== undefined) data.status = status

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, name: true, phone: true, role: true, status: true },
    })

    await authAudit('USER_UPDATED', req.user.id, { username: user.username })

    res.json(user)
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' })
    if (error.code === 'P2025') return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.patch('/:id/status', authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' })
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status, failedAttempts: status === 'active' ? 0 : undefined, lockedUntil: status === 'active' ? null : undefined },
      select: { id: true, username: true, status: true },
    })

    await authAudit('USER_STATUS_CHANGED', req.user.id, { username: user.username, status })

    res.json(user)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, username: true, role: true, name: true, status: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' })
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'لا يمكن حذف حساب المدير الرئيسي' })
    }

    if (user.role === 'driver') {
      const linkedBuses = await prisma.bus.count({ where: { driverId: user.id } })
      const linkedActiveBuses = await prisma.activeBus.count({ where: { driverId: user.id } })

      if (linkedBuses > 0 || linkedActiveBuses > 0) {
        return res.status(400).json({ error: 'لا يمكن حذف السائق لأنه مرتبط بحافلات أو عمليات نشطة. أوقف الربط أولاً أو اجعل الحساب غير نشط.' })
      }
    }

    await prisma.$transaction(async (tx) => {
      if (user.role === 'driver') {
        await tx.bus.updateMany({
          where: { driverId: user.id },
          data: { driverId: null, driverName: null },
        })
      }

      await tx.user.delete({ where: { id: user.id } })
    })

    await authAudit('USER_DELETED', req.user.id, { username: user.username, role: user.role })

    res.json({ message: 'تم حذف المستخدم بنجاح' })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.post('/:id/reset-password', authorize('admin'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

    let defaultPassword
    if (user.role === 'admin') {
      defaultPassword = getAdminInitialPassword()
    } else if (user.role === 'student' && user.studentId) {
      const student = await prisma.student.findUnique({ where: { id: user.studentId } })
      defaultPassword = student?.phone || generateRandomPassword()
    } else if (user.role === 'driver') {
      defaultPassword = user.phone || generateRandomPassword()
    } else {
      defaultPassword = generateRandomPassword()
    }

    const hashed = await hashPassword(defaultPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: true, failedAttempts: 0, lockedUntil: null },
    })

    await authAudit('PASSWORD_RESET', req.user.id, { username: user.username })

    res.json({ message: 'تم إعادة تعيين كلمة المرور', temporaryPassword: defaultPassword })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.post('/:id/force-change-password', authorize('admin'), async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { mustChangePassword: true },
    })
    await authAudit('PASSWORD_FORCE_CHANGE', req.user.id, { userId: req.params.id })
    res.json({ message: 'تم فرض تغيير كلمة المرور' })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

router.post('/:id/generate-username', authorize('admin'), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

    let baseUsername
    if (user.role === 'student' && user.studentId) {
      const student = await prisma.student.findUnique({ where: { id: user.studentId } })
      baseUsername = generateStudentUsername(student?.name || user.name)
    } else if (user.role === 'driver') {
      const bus = await prisma.bus.findFirst({ where: { driverId: user.id } })
      baseUsername = generateDriverUsername(user.name, bus?.busNumber || '')
    } else {
      return res.status(400).json({ error: 'يمكن توليد اسم المستخدم للطلاب والسائقين فقط' })
    }

    const username = await ensureUniqueUsername(baseUsername)

    await prisma.user.update({ where: { id: user.id }, data: { username } })
    await authAudit('USERNAME_GENERATED', req.user.id, { userId: user.id, username })

    res.json({ username })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المستخدم غير موجود' })
    res.status(500).json({ error: error.message })
  }
})

export default router
