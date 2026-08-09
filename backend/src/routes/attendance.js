import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { advanceTrackingAfterAttendance, startMorningTrip, completeMorningTrip } from '../services/trackingService.js'
import { createAndBroadcast } from '../services/notificationService.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const { date, busId, studentId, status } = req.query
    const where = {}

    if (date) where.date = new Date(date)
    if (busId) where.busId = busId
    if (studentId) where.studentId = studentId
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
    const today = getLocalDate()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const records = await prisma.attendance.findMany({
      where: { busId: req.params.busId, date: { gte: today, lt: tomorrow } },
      include: { student: { select: { id: true, name: true, phone: true, parentPhone: true, parentName: true, zone: true } } },
    })

    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/student/:studentId', async (req, res) => {
  try {
    const records = await prisma.attendance.findMany({
      where: { studentId: req.params.studentId },
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
    const { studentId, busId, date, status, contacted, contactTime, notes } = req.body

    if (!studentId || !busId) {
      return res.status(400).json({ error: 'الطالب والحافلة مطلوبان' })
    }

    const attendanceDate = date ? getLocalDate(date) : getLocalDate()

    const record = await prisma.attendance.upsert({
      where: {
        studentId_date: {
          studentId,
          date: attendanceDate,
        },
      },
      update: { status, contacted, contactTime, notes, busId },
      create: {
        studentId,
        busId,
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
      where: { busId, tripType: { not: 'RETURN' }, operation: { operationDate: { gte: today, lt: tomorrow } } },
      select: { id: true },
    })
    if (!activeBus) {
      // Fallback: try to find the most recent activeBus for this bus (in case of slight date mismatch)
      activeBus = await prisma.activeBus.findFirst({
        where: { busId, tripType: { not: 'RETURN' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (activeBus) {
        console.warn('[attendance] activeBus not found for today range, falling back to recent activeBus', activeBus.id)
      }
    }
    if (activeBus) {
      advanceTrackingAfterAttendance(activeBus.id, studentId).catch(() => {})
    }

    if (status === 'late') {
      prisma.bus.findUnique({ where: { id: busId }, select: { plateNumber: true, busNumber: true } }).then(bus => {
        const busLabel = bus?.plateNumber || bus?.busNumber || 'غير معروف'
        prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } }).then(admins => {
          const todayStr = new Date().toISOString().slice(0, 10)
          for (const admin of admins) {
            createAndBroadcast({
              userId: admin.id,
              type: 'student_late',
              title: 'تسجيل تأخر طالب',
              message: `تم تسجيل تأخر الطالب ${record.student.name} في الباص ${busLabel}`,
              dedupKey: `student_late_${admin.id}_${studentId}_${todayStr}`,
            }).catch(() => {})
          }
        })
      })
    }

    res.status(201).json(record)
  } catch (error) {
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'الطالب أو الحافلة غير موجودة' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.post('/start-morning/:busId', async (req, res) => {
  try {
    const state = await startMorningTrip(req.params.busId)
    res.json({ message: 'تم بدء الرحلة', state })
  } catch (error) {
    // Treat known business errors as client errors (400) so UI can handle them gracefully
    if (error.message.includes('غير موجود') || error.message.includes('قيد التنفيذ') || error.message.includes('منتهية') || error.message.includes('لا يوجد تشغيل')) {
      return res.status(400).json({ error: error.message })
    }
    console.error('[start-morning] unexpected error:', error)
    res.status(500).json({ error: error.message })
  }
})

router.post('/complete-morning/:busId', async (req, res) => {
  try {
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

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'بيانات غير صالحة' })
    }

    const result = await Promise.all(
      records.map((r) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: r.studentId, date: new Date(r.date) } },
          update: { status: r.status, contacted: r.contacted, contactTime: r.contactTime, notes: r.notes },
          create: { studentId: r.studentId, busId: r.busId, date: new Date(r.date), status: r.status || 'present', contacted: r.contacted || false, contactTime: r.contactTime },
        })
      )
    )

    res.status(201).json({ count: result.length })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
