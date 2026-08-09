import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

// Get all BusStudent records with student + bus info (for frontend filtering)
router.get('/all', authorize('admin'), async (req, res) => {
  try {
    const records = await prisma.busStudent.findMany({
      where: { isActive: true },
      include: {
        student: { select: { id: true, name: true } },
        bus: { select: { id: true, busNumber: true } },
      },
    })
    res.json(records)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/bus/:busId', authorize('admin'), async (req, res) => {
  try {
    const { busId } = req.params
    const busStudents = await prisma.busStudent.findMany({
      where: { busId, isActive: true },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json(busStudents)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { busId, studentId, pickupTime } = req.body

    // Check if student is already assigned to ANY bus template
    const existing = await prisma.busStudent.findUnique({
      where: { studentId },
      include: { bus: { select: { busNumber: true, driver: { select: { name: true } }, driverName: true } } },
    })
    if (existing) {
      const busInfo = existing.bus?.busNumber || 'غير معروف'
      const driverInfo = existing.bus?.driver?.name || existing.bus?.driverName || ''
      const msg = driverInfo
        ? `هذا الطالب مضاف مسبقاً إلى الباص رقم (${busInfo}) بقيادة السائق ${driverInfo}. يجب حذفه أو نقله أولاً.`
        : `هذا الطالب مضاف مسبقاً إلى الباص رقم (${busInfo}). يجب حذفه أو نقله أولاً.`
      return res.status(409).json({ error: msg })
    }

    const busStudent = await prisma.busStudent.create({
      data: { busId, studentId, pickupTime: pickupTime || '07:00' },
    })
    res.status(201).json(busStudent)
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'هذا الطالب مضاف مسبقاً إلى باص آخر. يجب حذفه أو نقله أولاً.' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.put('/:busId/:studentId', authorize('admin'), async (req, res) => {
  try {
    const { pickupTime } = req.body
    const busStudent = await prisma.busStudent.update({
      where: { studentId: req.params.studentId },
      data: { pickupTime },
    })
    res.json(busStudent)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'الطالب غير موجود في الحافلة' })
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:busId/:studentId', authorize('admin'), async (req, res) => {
  try {
    const { studentId } = req.params
    await prisma.busStudent.update({
      where: { studentId },
      data: { isActive: false },
    })
    res.json({ message: 'تم حذف الطالب من قالب الحافلة' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Bulk adjust pickup times for all template students in a bus
router.patch('/bulk-pickup-time/:busId', authorize('admin'), async (req, res) => {
  try {
    const { busId } = req.params
    const { adjustment, minutes } = req.body
    if (!adjustment || !['add', 'subtract'].includes(adjustment) || !minutes) {
      return res.status(400).json({ error: 'نوع التعديل وعدد الدقائق مطلوبان' })
    }
    const mins = parseInt(minutes)
    if (isNaN(mins) || mins < 1 || mins > 120) {
      return res.status(400).json({ error: 'الدقائق غير صالحة (1-120)' })
    }

    const records = await prisma.busStudent.findMany({ where: { busId, isActive: true } })
    let updated = 0
    for (const rec of records) {
      const current = rec.pickupTime || '07:00'
      const [h, m] = current.split(':').map(Number)
      const totalMinutes = h * 60 + m + (adjustment === 'add' ? mins : -mins)
      const newH = ((totalMinutes % 1440) + 1440) % 1440
      const newTime = `${String(Math.floor(newH / 60)).padStart(2, '0')}:${String(newH % 60).padStart(2, '0')}`
      await prisma.busStudent.update({ where: { id: rec.id }, data: { pickupTime: newTime } })
      updated++
    }
    res.json({ message: `تم تعديل وقت ${updated} طالب`, updated })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Transfer student from current bus to another bus atomically
router.post('/transfer', authorize('admin'), async (req, res) => {
  try {
    const { studentId, fromBusId, toBusId, pickupTime } = req.body

    const result = await prisma.$transaction(async (tx) => {
      const old = await tx.busStudent.findUnique({ where: { studentId } })
      if (!old) {
        throw new Error('الطالب غير موجود في أي باص')
      }

      if (old.busId === toBusId) {
        throw new Error('الطالب موجود بالفعل في الباص الهدف')
      }

      const updated = await tx.busStudent.update({
        where: { studentId },
        data: {
          busId: toBusId,
          pickupTime: pickupTime || old.pickupTime,
          isActive: true,
        },
      })

      return updated
    })

    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

export default router
