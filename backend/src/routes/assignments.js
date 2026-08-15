import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

const VALID_PERIODS = new Set(['MORNING', 'RETURN'])
const VALID_LINES = new Set(['JEBALI', 'BAHRY'])

function sanitizeId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} مطلوب`)
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} غير صالح`)
  }
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 128) {
    throw new Error(`${fieldName} غير صالح`)
  }
  return trimmed
}

function sanitizeOptionalTime(value, fieldName) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`${fieldName} غير صالح`)
  const trimmed = value.trim()
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) throw new Error(`${fieldName} غير صالح`)
  return trimmed
}

function sanitizeOptionalNotes(value) {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('ملاحظات الرحلة غير صالحة')
  if (value.length > 2000) throw new Error('ملاحظات الرحلة طويلة جداً')
  return value.trim()
}

function parseAssignmentDate(value) {
  if (value === undefined || value === null || value === '') {
    throw new Error('التاريخ مطلوب')
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('تاريخ الرحلة غير صالح')
  }
  return date
}

function normalizeAssignmentPayload(body, { requireDate = true } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('بيانات الرحلة غير صالحة')
  }

  const studentId = sanitizeId(body.studentId, 'الطالب')
  const busId = sanitizeId(body.busId, 'الحافلة')
  const date = requireDate ? parseAssignmentDate(body.date) : (body.date !== undefined ? parseAssignmentDate(body.date) : undefined)
  const period = body.period !== undefined ? String(body.period).trim().toUpperCase() : 'MORNING'
  const line = body.line !== undefined ? String(body.line).trim().toUpperCase() : 'JEBALI'

  if (!VALID_PERIODS.has(period)) throw new Error('فترة الرحلة غير صالحة')
  if (!VALID_LINES.has(line)) throw new Error('خط الرحلة غير صالح')

  const pickupTime = sanitizeOptionalTime(body.pickupTime, 'وقت الصعود')
  const dropoffTime = sanitizeOptionalTime(body.dropoffTime, 'وقت النزول')
  const notes = sanitizeOptionalNotes(body.notes)

  return { studentId, busId, date, period, line, pickupTime, dropoffTime, notes }
}

export function canAccessAssignmentRecord(user, assignment) {
  if (!user || !assignment) return false
  if (user.role === 'admin') return true
  if (user.role === 'student') return assignment.studentId === user.studentId
  if (user.role === 'driver') return assignment.bus?.driverId === user.id || assignment.bus?.driver?.id === user.id
  return false
}

router.get('/', async (req, res) => {
  try {
    const { date, busId, studentId, status, period, line } = req.query
    const where = {}

    if (req.user.role === 'student') {
      where.studentId = req.user.studentId
    } else if (req.user.role === 'driver') {
      where.bus = { driverId: req.user.id }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى الرحلات' })
    }

    if (date) {
      const d = new Date(date)
      where.date = d
    }
    if (busId) where.busId = busId
    if (studentId) where.studentId = studentId
    if (status) where.status = status
    if (period) where.period = period
    if (line) where.line = line

    const assignments = await prisma.assignment.findMany({
      where,
      include: {
        student: { select: { id: true, name: true, zone: true, phone: true, transportMode: true, homeAddress: true, homeNotes: true } },
        bus: {
          include: {
            driver: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { pickupTime: 'asc' }],
    })

    res.json(assignments)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        student: true,
        bus: { include: { driver: { select: { id: true, name: true, phone: true } } } },
      },
    })

    if (!assignment) {
      return res.status(404).json({ error: 'الرحلة غير موجودة' })
    }

    if (!canAccessAssignmentRecord(req.user, assignment)) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى هذه الرحلة' })
    }

    res.json(assignment)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/bus/:busId/template-students', async (req, res) => {
  try {
    const { busId } = req.params;
    const { date } = req.query;
    const busStudents = await prisma.busStudent.findMany({
      where: { busId, isActive: true },
      include: { student: true }
    });

    if (date) {
      const d = new Date(date);
      const existingAssignments = await prisma.assignment.findMany({
        where: { date: d, busId },
        select: { studentId: true }
      });
      const existingIds = new Set(existingAssignments.map(a => a.studentId));
      const available = busStudents.filter(bs => !existingIds.has(bs.studentId));
      return res.json(available.map(bs => bs.student));
    }

    res.json(busStudents.map(bs => bs.student));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const payload = normalizeAssignmentPayload(req.body)
    const { studentId, busId, date, period, line, pickupTime, dropoffTime, notes } = payload

    const assignment = await prisma.assignment.create({
      data: {
        studentId,
        busId,
        date,
        period,
        line,
        pickupTime,
        dropoffTime,
        notes,
      },
      include: {
        student: true,
        bus: { include: { driver: { select: { name: true } } } },
      },
    })

    res.status(201).json(assignment)
  } catch (error) {
    if (error.message.includes('مطلوب') || error.message.includes('غير صالح') || error.message.includes('بيانات الرحلة')) {
      return res.status(400).json({ error: error.message })
    }
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'هذا الطالب لديه رحلة مسجلة في هذا التاريخ والفترة بالفعل',
      })
    }
    res.status(500).json({ error: error.message })
  }
})

router.post('/batch', authorize('admin'), async (req, res) => {
  try {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'بيانات غير صالحة' })
    }

    const busId = sanitizeId(body.busId, 'الحافلة')
    const date = parseAssignmentDate(body.date)
    const period = body.period !== undefined ? String(body.period).trim().toUpperCase() : 'MORNING'
    const line = body.line !== undefined ? String(body.line).trim().toUpperCase() : 'JEBALI'
    if (!VALID_PERIODS.has(period)) throw new Error('فترة الرحلة غير صالحة')
    if (!VALID_LINES.has(line)) throw new Error('خط الرحلة غير صالح')

    const studentIds = body.studentIds
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'قائمة الطلاب مطلوبة' })
    }

    const normalizedStudentIds = [...new Set(studentIds.map((id) => sanitizeId(id, 'معرف الطالب')))]
    const pickupTime = sanitizeOptionalTime(body.pickupTime, 'وقت الصعود')
    const dropoffTime = sanitizeOptionalTime(body.dropoffTime, 'وقت النزول')

    const created = []
    for (const studentId of normalizedStudentIds) {
      try {
        const assignment = await prisma.assignment.create({
          data: {
            studentId,
            busId,
            date,
            period,
            line,
            pickupTime,
            dropoffTime,
          },
        })
        created.push(assignment)
      } catch (e) {
        // skip duplicates at the row level
      }
    }

    res.status(201).json({ created: created.length, total: normalizedStudentIds.length })
  } catch (error) {
    if (error.message.includes('مطلوب') || error.message.includes('غير صالح') || error.message.includes('بيانات')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'بيانات الرحلة غير صالحة' })
    }

    const updateData = {}
    if (body.studentId !== undefined) updateData.studentId = sanitizeId(body.studentId, 'الطالب')
    if (body.busId !== undefined) updateData.busId = sanitizeId(body.busId, 'الحافلة')
    if (body.date !== undefined) updateData.date = parseAssignmentDate(body.date)
    if (body.period !== undefined) {
      const period = String(body.period).trim().toUpperCase()
      if (!VALID_PERIODS.has(period)) throw new Error('فترة الرحلة غير صالحة')
      updateData.period = period
    }
    if (body.line !== undefined) {
      const line = String(body.line).trim().toUpperCase()
      if (!VALID_LINES.has(line)) throw new Error('خط الرحلة غير صالح')
      updateData.line = line
    }
    if (body.pickupTime !== undefined) updateData.pickupTime = sanitizeOptionalTime(body.pickupTime, 'وقت الصعود')
    if (body.dropoffTime !== undefined) updateData.dropoffTime = sanitizeOptionalTime(body.dropoffTime, 'وقت النزول')
    if (body.notes !== undefined) updateData.notes = sanitizeOptionalNotes(body.notes)

    const assignment = await prisma.assignment.update({
      where: { id: req.params.id },
      data: updateData,
    })

    res.json(assignment)
  } catch (error) {
    if (error.message.includes('مطلوب') || error.message.includes('غير صالح') || error.message.includes('بيانات الرحلة')) {
      return res.status(400).json({ error: error.message })
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الرحلة غير موجودة' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    const allowed = ['scheduled', 'in_progress', 'completed', 'cancelled']

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' })
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { bus: { select: { driverId: true } } },
    })

    if (!assignment) {
      return res.status(404).json({ error: 'الرحلة غير موجودة' })
    }

    const isAdmin = req.user.role === 'admin'
    const isDriverOwner = req.user.role === 'driver' && assignment.bus?.driverId === req.user.id
    if (!isAdmin && !isDriverOwner) {
      return res.status(403).json({ error: 'لا تملك صلاحية تحديث حالة هذه الرحلة' })
    }

    const updated = await prisma.assignment.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        student: { select: { name: true } },
        bus: { select: { plateNumber: true } },
      },
    })

    res.json(updated)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الرحلة غير موجودة' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await prisma.assignment.delete({ where: { id: req.params.id } })
    res.json({ message: 'تم حذف الرحلة بنجاح' })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الرحلة غير موجودة' })
    }
    res.status(500).json({ error: error.message })
  }
})

export default router
