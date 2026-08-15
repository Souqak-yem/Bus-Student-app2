import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { hashPassword, generateDriverUsername, ensureUniqueUsername, authAudit } from '../services/authService.js'
import { generateRandomPassword } from '../utils/secrets.js'

const router = Router()
router.use(authenticate)

async function canAccessBusRecord(user, busId) {
  if (!user || !busId) return false
  if (user.role === 'admin') return true
  if (user.role === 'driver') {
    const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { id: true, driverId: true } })
    return !!bus && bus.driverId === user.id
  }
  if (user.role === 'student' && user.studentId) {
    const bus = await prisma.bus.findFirst({
      where: {
        id: busId,
        OR: [
          { assignments: { some: { studentId: user.studentId } } },
          { templateStudents: { some: { studentId: user.studentId, isActive: true } } },
        ],
      },
      select: { id: true },
    })
    return !!bus
  }
  return false
}

router.get('/', async (req, res) => {
  try {
    const { status, driverId } = req.query
    const where = {}

    if (req.user.role === 'admin') {
      if (status) where.status = status
      if (driverId) where.driverId = String(driverId)
    } else if (req.user.role === 'driver') {
      where.driverId = req.user.id
      if (status) where.status = status
      if (driverId && String(driverId) !== req.user.id) return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذه الحافلات' })
    } else if (req.user.role === 'student') {
      where.OR = [
        { assignments: { some: { studentId: req.user.studentId } } },
        { templateStudents: { some: { studentId: req.user.studentId, isActive: true } } },
      ]
      if (status) where.status = status
      if (driverId) return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذه الحافلات' })
    } else {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى الحافلات' })
    }

    const buses = await prisma.bus.findMany({
      where,
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        _count: { select: { assignments: true } },
        templateStudents: {
          where: { isActive: true },
          select: { id: true },
        },
      },
      orderBy: { busNumber: 'asc' },
    })

    res.json(buses)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const bus = await prisma.bus.findUnique({
      where: { id: req.params.id },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        templateStudents: {
          where: { isActive: true },
          include: { student: true },
        },
        assignments: {
          include: { student: { select: { id: true, name: true, zone: true } } },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    })

    if (!bus) {
      return res.status(404).json({ error: 'الحافلة غير موجودة' })
    }

    const allowed = await canAccessBusRecord(req.user, req.params.id)
    if (!allowed) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذه الحافلة' })
    }

    res.json(bus)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { busNumber, plateNumber, capacity, vehicleType, driverName, model, color, driverId, primaryPhone, secondaryPhone } = req.body

    if (!busNumber || !capacity) {
      return res.status(400).json({ error: 'رقم الباص والسعة مطلوبان' })
    }

    let finalDriverId = driverId
    let finalDriverName = driverName

    if (driverName && !driverId) {
      // Find or create driver user
      let existingDriver = await prisma.user.findFirst({
        where: { name: { equals: driverName, mode: 'insensitive' }, role: 'driver' }
      })

      if (!existingDriver) {
        // Create new driver user
        const baseUsername = generateDriverUsername(driverName, busNumber)
        const username = await ensureUniqueUsername(baseUsername)
        const defaultPassword = primaryPhone || generateRandomPassword()
        const hashedPassword = await hashPassword(defaultPassword)

        existingDriver = await prisma.user.create({
          data: {
            username,
            name: driverName,
            phone: primaryPhone || null,
            password: hashedPassword,
            role: 'driver',
            mustChangePassword: true
          }
        })

        await authAudit('USER_CREATED', req.user.id, { username, role: 'driver', name: driverName })
      }

      finalDriverId = existingDriver.id
      finalDriverName = existingDriver.name
    }

    const bus = await prisma.bus.create({
      data: {
        busNumber,
        plateNumber: plateNumber || null,
        capacity: Number(capacity),
        vehicleType: vehicleType || null,
        driverName: finalDriverName,
        model,
        color,
        driverId: finalDriverId,
        primaryPhone: primaryPhone || null,
        secondaryPhone: secondaryPhone || null,
      },
    })

    res.status(201).json(bus)
  } catch (error) {
    if (error.code === 'P2002') {
      const target = error.meta?.target?.[0]
      if (target === 'busNumber') return res.status(400).json({ error: 'رقم الباص موجود مسبقاً' })
      return res.status(400).json({ error: 'رقم اللوحة موجود مسبقاً' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { busNumber, plateNumber, capacity, vehicleType, driverName, model, color, driverId, status, primaryPhone, secondaryPhone } = req.body

    let finalDriverId = driverId
    let finalDriverName = driverName

    if (driverName && !driverId) {
      // Find or create driver user
      let existingDriver = await prisma.user.findFirst({
        where: { name: { equals: driverName, mode: 'insensitive' }, role: 'driver' }
      })

      if (!existingDriver) {
        const currentBus = await prisma.bus.findUnique({ where: { id: req.params.id } })
        const baseUsername = generateDriverUsername(driverName, currentBus?.busNumber || '')
        const username = await ensureUniqueUsername(baseUsername)
        const defaultPassword = primaryPhone || generateRandomPassword()
        const hashedPassword = await hashPassword(defaultPassword)

        existingDriver = await prisma.user.create({
          data: {
            username,
            name: driverName,
            phone: primaryPhone || null,
            password: hashedPassword,
            role: 'driver',
            mustChangePassword: true
          }
        })

        await authAudit('USER_CREATED', req.user.id, { username, role: 'driver', name: driverName })
      }

      finalDriverId = existingDriver.id
      finalDriverName = existingDriver.name
    }

    const bus = await prisma.bus.update({
      where: { id: req.params.id },
      data: {
        busNumber,
        plateNumber,
        capacity: capacity ? Number(capacity) : undefined,
        vehicleType: vehicleType || null,
        driverName: finalDriverName,
        model,
        color,
        driverId: finalDriverId,
        status,
        primaryPhone: primaryPhone || null,
        secondaryPhone: secondaryPhone || null,
      },
    })

    res.json(bus)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الحافلة غير موجودة' })
    }
    if (error.code === 'P2002') {
      const target = error.meta?.target?.[0]
      if (target === 'busNumber') return res.status(400).json({ error: 'رقم الباص موجود مسبقاً' })
      return res.status(400).json({ error: 'رقم اللوحة موجود مسبقاً' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await prisma.bus.delete({ where: { id: req.params.id } })
    res.json({ message: 'تم حذف الحافلة بنجاح' })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الحافلة غير موجودة' })
    }
    res.status(500).json({ error: error.message })
  }
})

export default router
