import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { advanceTrackingAfterAttendance, startMorningTrip, completeMorningTrip } from '../services/trackingService.js'
import { createAndBroadcast } from '../services/notificationService.js'
import { broadcastStudentUpdate } from '../services/socketService.js'

const router = Router()
router.use(authenticate)

const VALID_ATTENDANCE_STATUS = new Set(['present', 'absent', 'late'])

function normalizeAttendancePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('بيانات الحضور غير صالحة')
  }

  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : body.studentId
  const busId = typeof body.busId === 'string' ? body.busId.trim() : body.busId

  if (!studentId || typeof studentId !== 'string' || studentId.length > 128) {
    throw new Error('معرف الطالب غير صالح')
  }
  if (!busId || typeof busId !== 'string' || busId.length > 128) {
    throw new Error('معرف الحافلة غير صالح')
  }

  const status = body.status !== undefined ? String(body.status).trim() : 'present'
  if (!VALID_ATTENDANCE_STATUS.has(status)) {
    throw new Error('حالة الحضور غير صالحة')
  }

  if (body.contacted !== undefined && typeof body.contacted !== 'boolean') {
    throw new Error('حالة الاتصال غير صالحة')
  }

  if (body.contactTime !== undefined) {
    if (typeof body.contactTime !== 'string') {
      throw new Error('وقت الاتصال غير صالح')
    }
    const contactTime = body.contactTime.trim()
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(contactTime)) {
      throw new Error('وقت الاتصال غير صالح')
    }
  }

  if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 2000)) {
    throw new Error('ملاحظات الحضور غير صالحة')
  }

  const dateValue = body.date !== undefined ? new Date(body.date) : new Date()
  if (Number.isNaN(dateValue.getTime())) {
    throw new Error('تاريخ الحضور غير صالح')
  }

  return {
    studentId,
    busId,
    date: dateValue,
    status,
    contacted: body.contacted !== undefined ? body.contacted : false,
    contactTime: body.contactTime !== undefined ? body.contactTime.trim() : undefined,
    notes: body.notes !== undefined ? body.notes : undefined,
  }
}

async function canAccessStudentAttendance(user, studentId) {
  if (!user || !studentId) return false
  if (user.role === 'admin') return true
  if (user.role === 'student') return user.studentId === studentId
  if (user.role === 'driver') {
    const allowed = await prisma.assignment.findFirst({
      where: { studentId, bus: { driverId: user.id } },
      select: { id: true },
    })
    if (allowed) return true

    const busStudent = await prisma.busStudent.findFirst({
      where: { studentId, isActive: true, bus: { driverId: user.id } },
      select: { id: true },
    })
    return !!busStudent
  }
  return false
}

async function canAccessBusAttendance(user, busId) {
  if (!user || !busId) return false
  if (user.role === 'admin') return true
  if (user.role === 'driver') {
    const bus = await prisma.bus.findUnique({
      where: { id: busId },
      select: { id: true, driverId: true },
    })
    return !!bus && bus.driverId === user.id
  }
  return false
}

async function canAccessStudentBusRelation(user, studentId, busId) {
  if (!user || !studentId || !busId) return false
  if (user.role === 'admin') return true
  if (user.role === 'student') return user.studentId === studentId
  if (user.role === 'driver') {
    const ownBus = await prisma.bus.findUnique({
      where: { id: busId },
      select: { id: true, driverId: true },
    })
    if (!ownBus || ownBus.driverId !== user.id) return false

    const assignment = await prisma.assignment.findFirst({
      where: { studentId, busId },
      select: { id: true },
    })
    if (assignment) return true

    const busStudent = await prisma.busStudent.findFirst({
      where: { studentId, busId, isActive: true },
      select: { id: true },
    })
    return !!busStudent
  }
  return false
}

function denyAccess(res, message = 'لا تملك صلاحية الوصول إلى هذا السجل') {
  return res.status(403).json({ error: message })
}

router.get('/', async (req, res) => {
  try {
    const { date, busId, studentId, status } = req.query
    const where = {}

    if (req.user.role === 'student') {
      if (studentId && studentId !== req.user.studentId) return denyAccess(res)
      where.studentId = req.user.studentId
    } else if (req.user.role === 'driver') {
      if (busId) {
        const bus = await prisma.bus.findUnique({ where: { id: String(busId) }, select: { id: true, driverId: true } })
        if (!bus || bus.driverId !== req.user.id) return denyAccess(res)
        where.busId = String(busId)
      } else {
        where.bus = { driverId: req.user.id }
      }
      if (studentId) {
        const allowed = await canAccessStudentAttendance(req.user, String(studentId))
        if (!allowed) return denyAccess(res)
        where.studentId = String(studentId)
      }
    } else if (req.user.role !== 'admin') {
      return denyAccess(res)
    }

    if (date) where.date = new Date(date)
    if (status) where.status = status

    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, phone: true, parentPhone: true, zone: true } },
        bus: { select: { id: true, plateNumber: true } },
      },
      orderBy: [{ date: 'desc' }, { student: { name: 'asc' } }],
    })

    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/today/:busId', async (req, res) => {
  try {
    if (req.user.role === 'student') return denyAccess(res)
    if (req.user.role !== 'admin' && req.user.role !== 'driver') return denyAccess(res)

    const busId = req.params.busId
    if (req.user.role === 'driver') {
      const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { id: true, driverId: true } })
      if (!bus || bus.driverId !== req.user.id) return denyAccess(res)
    }

    const today = getLocalDate()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const records = await prisma.attendance.findMany({
      where: { busId, date: { gte: today, lt: tomorrow } },
      include: { student: { select: { id: true, name: true, phone: true, parentPhone: true, parentName: true, zone: true } } },
    })

    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/student/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId

    if (req.user.role === 'student') {
      if (studentId !== req.user.studentId) return denyAccess(res)
    } else if (req.user.role === 'driver') {
      const allowed = await canAccessStudentAttendance(req.user, studentId)
      if (!allowed) return denyAccess(res)
    } else if (req.user.role !== 'admin') {
      return denyAccess(res)
    }

    const records = await prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 30,
    })
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const payload = normalizeAttendancePayload(req.body)
    const { studentId, busId, date, status, contacted, contactTime, notes } = payload

    if (req.user.role === 'student') return denyAccess(res)
    if (req.user.role === 'driver') {
      const allowed = await canAccessStudentBusRelation(req.user, String(studentId), String(busId))
      if (!allowed) return denyAccess(res)
    } else if (req.user.role !== 'admin') {
      return denyAccess(res)
    }

    const student = await prisma.student.findUnique({ where: { id: String(studentId) }, select: { id: true } })
    const bus = await prisma.bus.findUnique({ where: { id: String(busId) }, select: { id: true } })
    if (!student || !bus) return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذا السجل' })

    const attendanceDate = date ? getLocalDate(date) : getLocalDate()

    const record = await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId: String(studentId),
          date: attendanceDate,
        },
      },
      update: { status, contacted, contactTime, notes, busId: String(busId) },
      create: {
        studentId: String(studentId),
        busId: String(busId),
        date: attendanceDate,
        status: status || 'present',
        contacted: contacted || false,
        contactTime,
        notes,
      },
      include: { student: { select: { name: true } } },
    })

    const { today, tomorrow } = (() => {
      const today = getLocalDate()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return { today, tomorrow }
    })()
    let activeBus = await prisma.activeBus.findFirst({
      where: { busId: String(busId), tripType: { not: 'RETURN' }, operation: { operationDate: { gte: today, lt: tomorrow } } },
      select: { id: true },
    })
    if (!activeBus) {
      activeBus = await prisma.activeBus.findFirst({
        where: { busId: String(busId), tripType: { not: 'RETURN' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (activeBus) {
        console.warn('[attendance] activeBus not found for today range, falling back to recent activeBus', activeBus.id)
      }
    }
    if (activeBus) {
      advanceTrackingAfterAttendance(activeBus.id, String(studentId)).catch(() => {})
    }

    const studentUser = await prisma.user.findUnique({ where: { studentId: String(studentId) }, select: { id: true } })
    if (studentUser) {
      broadcastStudentUpdate(studentUser.id, { type: 'attendance_updated', studentId: String(studentId), status: record.status })
    }

    if (status === 'late') {
      prisma.bus.findUnique({ where: { id: String(busId) }, select: { plateNumber: true, busNumber: true } }).then(bus => {
        const busLabel = bus?.plateNumber || bus?.busNumber || 'غير معروف'
        prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } }).then(admins => {
          const todayStr = new Date().toISOString().slice(0, 10)
          for (const admin of admins) {
            createAndBroadcast({
              userId: admin.id,
              type: 'student_late',
              title: 'تسجيل تأخر طالب',
              message: `تم تسجيل تأخر الطالب ${record.student.name} في الباص ${busLabel}`,
              dedupKey: `student_late_${admin.id}_${String(studentId)}_${todayStr}`,
            }).catch(() => {})
          }
        })
      })
    }

    res.status(201).json(record)
  } catch (error) {
    if (error.message && (
      error.message.includes('غير صالح') ||
      error.message.includes('مطلوب') ||
      error.message.includes('بيانات الحضور') ||
      error.message.includes('معرف الطالب') ||
      error.message.includes('معرف الحافلة')
    )) {
      return res.status(400).json({ error: error.message })
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'الطالب أو الحافلة غير موجودة' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.post('/start-morning/:busId', async (req, res) => {
  try {
    if (req.user.role === 'student') return denyAccess(res)
    if (req.user.role === 'driver') {
      const bus = await prisma.bus.findUnique({ where: { id: req.params.busId }, select: { id: true, driverId: true } })
      if (!bus || bus.driverId !== req.user.id) return denyAccess(res)
    } else if (req.user.role !== 'admin') {
      return denyAccess(res)
    }

    const state = await startMorningTrip(req.params.busId)
    res.json({ message: 'تم بدء الرحلة', state })
  } catch (error) {
    if (error.message.includes('غير موجود') || error.message.includes('قيد التنفيذ') || error.message.includes('منتهية') || error.message.includes('لا يوجد تشغيل')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('[start-morning] unexpected error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/complete-morning/:busId', async (req, res) => {
  try {
    if (req.user.role === 'student') return denyAccess(res)
    if (req.user.role === 'driver') {
      const bus = await prisma.bus.findUnique({ where: { id: req.params.busId }, select: { id: true, driverId: true } })
      if (!bus || bus.driverId !== req.user.id) return denyAccess(res)
    } else if (req.user.role !== 'admin') {
      return denyAccess(res)
    }

    const state = await completeMorningTrip(req.params.busId)
    res.json({ message: 'تم إنهاء رحلة الذهاب', state })
  } catch (error) {
    if (error.message.includes('مسبقاً') || error.message.includes('غير موجود')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
})

router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'بيانات غير صالحة' })
    }

    const validatedRecords = records.map((record) => normalizeAttendancePayload(record))

    if (req.user.role === 'student') return denyAccess(res)
    if (req.user.role === 'driver') {
      for (const record of validatedRecords) {
        const allowed = await canAccessStudentBusRelation(req.user, String(record.studentId), String(record.busId))
        if (!allowed) return denyAccess(res)
      }
    } else if (req.user.role !== 'admin') {
      return denyAccess(res)
    }

    const result = await Promise.all(
      validatedRecords.map((r) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: String(r.studentId), date: getLocalDate(r.date) } },
          update: { status: r.status, contacted: r.contacted, contactTime: r.contactTime, notes: r.notes, busId: String(r.busId) },
          create: { studentId: String(r.studentId), busId: String(r.busId), date: getLocalDate(r.date), status: r.status || 'present', contacted: r.contacted || false, contactTime: r.contactTime, notes: r.notes },
        })
      )
    )

    const studentIds = [...new Set(records.map(r => String(r.studentId)))]
    const users = await prisma.user.findMany({ where: { studentId: { in: studentIds } }, select: { id: true, studentId: true } })
    for (const user of users) {
      broadcastStudentUpdate(user.id, { type: 'attendance_batch_updated', studentIds })
    }

    res.status(201).json({ count: result.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
