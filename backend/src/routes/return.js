import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { notifyAndBroadcastToBus, notifyStudent } from '../services/socketService.js'

const router = Router()
router.use(authenticate)

function todayRange() {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

const VALID_TRANSITIONS = {
  AVAILABLE: ['LOADING', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'],
  LOADING: ['BOARDING', 'AVAILABLE', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'],
  BOARDING: ['BOARDING_TIME_ENDED', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'],
  BOARDING_TIME_ENDED: ['DEPARTED', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'],
  DEPARTED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: [],
  CANCELLED: [],
  BROKEN_DOWN: ['REPLACED', 'CANCELLED'],
  REPLACED: [],
}

function canTransition(from, to) {
  if (from === to) return true
  return VALID_TRANSITIONS[from]?.includes(to) || false
}

router.get('/operation', async (req, res) => {
  try {
    const { today, tomorrow } = todayRange()
    let op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    res.json(op)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/operation', authorize('admin'), async (req, res) => {
  try {
    const { today, tomorrow } = todayRange()
    const existing = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (existing) {
      return res.status(400).json({ error: 'يوجد تشغيل لليوم بالفعل' })
    }
    const op = await prisma.dailyOperation.create({
      data: { operationDate: today, createdById: req.user.id, notes: req.body.notes },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    res.status(201).json(op)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/operation/:id/close', authorize('admin'), async (req, res) => {
  try {
    const op = await prisma.dailyOperation.update({
      where: { id: req.params.id },
      data: { status: 'CLOSED' },
    })
    res.json(op)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/active-buses', async (req, res) => {
  try {
    const { today, tomorrow } = todayRange()
    const op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (!op) return res.json([])
    const buses = await prisma.activeBus.findMany({
      where: { operationId: op.id, tripType: 'RETURN', status: { notIn: ['BROKEN_DOWN', 'REPLACED'] }, returnCompletedAt: null },
      include: {
        bus: { select: { id: true, plateNumber: true, capacity: true, model: true, busNumber: true } },
        driver: { select: { id: true, name: true, phone: true } },
        loads: {
          include: { student: { select: { id: true, name: true, transportMode: true, homeAddress: true, homeDeliveryFee: true, homeNotes: true, institutionName: true, pickupLocation: true, address: true, phone: true, whatsapp: true } } },
          orderBy: [{ sortOrder: 'asc' }, { assignedAt: 'asc' }],
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(buses.map(b => ({
      ...b,
      occupiedSeats: b.loads.length,
      remainingSeats: b.capacitySnapshot - b.loads.length,
      fillPercent: b.capacitySnapshot > 0 ? Math.round((b.loads.length / b.capacitySnapshot) * 100) : 0,
    })))
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses', authorize('admin'), async (req, res) => {
  try {
    const { busId } = req.body
    if (!busId) return res.status(400).json({ error: 'الحافلة مطلوبة' })

    const { today, tomorrow } = todayRange()
    let op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (!op) {
      op = await prisma.dailyOperation.create({
        data: { operationDate: today, createdById: req.user.id },
      })
    }
    if (op.status === 'CLOSED') {
      return res.status(400).json({ error: 'التشغيل مغلق لهذا اليوم' })
    }

    const bus = await prisma.bus.findUnique({ where: { id: busId }, include: { driver: true } })
    if (!bus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    if (!bus.driver) return res.status(400).json({ error: 'الحافلة لا تملك سائقاً' })

    const existing = await prisma.activeBus.findFirst({
      where: { operationId: op.id, busId, tripType: 'RETURN', status: { not: 'CANCELLED' }, returnCompletedAt: null },
    })
    if (existing) return res.status(400).json({ error: 'هذه الحافلة موجودة بالفعل في التشغيل' })

    const active = await prisma.activeBus.create({
      data: {
        operationId: op.id, busId, driverId: bus.driverId,
        tripType: 'RETURN', line: null, capacitySnapshot: bus.capacity,
      },
      include: {
        bus: { select: { id: true, plateNumber: true, capacity: true, model: true, busNumber: true } },
        driver: { select: { id: true, name: true, phone: true } },
        loads: { include: { student: { select: { id: true, name: true, transportMode: true, homeAddress: true, homeDeliveryFee: true, homeNotes: true } } } },
      },
    })
    res.status(201).json({ ...active, occupiedSeats: 0, remainingSeats: active.capacitySnapshot, fillPercent: 0 })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/active-buses/:id/status', authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body
    const activeBus = await prisma.activeBus.findUnique({
      where: { id: req.params.id },
      include: { loads: true },
    })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة في التشغيل' })

    if (!canTransition(activeBus.status, status)) {
      return res.status(400).json({ error: `لا يمكن الانتقال من ${activeBus.status} إلى ${status}` })
    }

    const updated = await prisma.activeBus.update({
      where: { id: req.params.id },
      data: { status },
    })

    if (status === 'DEPARTED') {
      const studentIds = activeBus.loads.map(l => l.studentId)
      await Promise.all([
        prisma.busLoad.updateMany({
          where: { activeBusId: req.params.id },
          data: { departedAt: new Date() },
        }),
        prisma.returnQueue.updateMany({
          where: { operationId: activeBus.operationId, studentId: { in: studentIds } },
          data: { status: 'DEPARTED' },
        }),
      ])
    }

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/active-buses/:id', authorize('admin'), async (req, res) => {
  try {
    const ab = await prisma.activeBus.findUnique({ where: { id: req.params.id }, select: { busId: true } })
    await prisma.activeBus.delete({ where: { id: req.params.id } })
    if (ab) {
      notifyAndBroadcastToBus(ab.busId, {
        type: 'driver_return_bus_removed', title: 'تم إلغاء رحلة العودة', message: 'تم إلغاء رحلة العودة لهذا الباص',
        priority: 'CRITICAL',
      })
    }
    res.json({ message: 'تم إزالة الحافلة من التشغيل' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/queue', async (req, res) => {
  try {
    const { today, tomorrow } = todayRange()
    const op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (!op) return res.json([])
    const queue = await prisma.returnQueue.findMany({
      where: { operationId: op.id, status: 'WAITING' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            phone: true,
            whatsapp: true,
            zone: true,
            transportMode: true,
            homeAddress: true,
            pickupLocation: true,
            address: true,
            homeDeliveryFee: true,
            homeNotes: true,
            parentPhone: true,
          },
        },
      },
      orderBy: { enteredAt: 'asc' },
    })
    res.json(queue)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/queue', authorize('admin'), async (req, res) => {
  try {
    const { studentId, notes } = req.body
    if (!studentId) return res.status(400).json({ error: 'الطالب مطلوب' })

    const { today, tomorrow } = todayRange()
    let op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (!op) {
      op = await prisma.dailyOperation.create({
        data: { operationDate: today, createdById: req.user.id },
      })
    }
    if (op.status === 'CLOSED') {
      return res.status(400).json({ error: 'التشغيل مغلق' })
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })

    const hasMorningAssignment = await prisma.assignment.findFirst({
      where: { studentId, date: { gte: today, lt: tomorrow }, period: 'MORNING' },
    })
    if (!hasMorningAssignment) return res.status(400).json({ error: 'الطالب ليس لديه رحلة صباحية اليوم' })

    const existing = await prisma.returnQueue.findFirst({
      where: { operationId: op.id, studentId, status: { not: 'DEPARTED' } },
    })
    if (existing) return res.status(400).json({ error: 'الطالب موجود بالفعل في قائمة الانتظار' })

    const entry = await prisma.returnQueue.create({
      data: {
        operationId: op.id, studentId,
        preferredLine: student.zone ? (student.zone.includes('الروضة') || student.zone.includes('النزهة') ? 'JEBALI' : 'BAHRY') : undefined,
        transportMode: student.transportMode,
        notes,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            phone: true,
            whatsapp: true,
            zone: true,
            transportMode: true,
            homeAddress: true,
            pickupLocation: true,
            address: true,
            homeDeliveryFee: true,
            homeNotes: true,
            parentPhone: true,
          },
        },
      },
    })
    const queueStudentUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
    if (queueStudentUser?.id) {
      notifyStudent({
        userId: queueStudentUser.id, type: 'student_return_queue_added', title: 'تمت إضافتك لقائمة الانتظار',
        message: 'تمت إضافتك لقائمة انتظار رحلة العودة',
        targetRoute: '/student',
      })
    }
    res.status(201).json(entry)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/queue/:id', authorize('admin'), async (req, res) => {
  try {
    await prisma.returnQueue.update({
      where: { id: req.params.id },
      data: { status: 'DEPARTED' },
    })
    res.json({ message: 'تم إزالة الطالب من قائمة الانتظار' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/load', authorize('admin'), async (req, res) => {
  try {
    const { activeBusId, studentId, exceptionReason } = req.body
    if (!activeBusId || !studentId) {
      return res.status(400).json({ error: 'الحافلة والطالب مطلوبان' })
    }

    const activeBus = await prisma.activeBus.findUnique({
      where: { id: activeBusId },
      include: { loads: true },
    })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })

    if (activeBus.status !== 'AVAILABLE' && activeBus.status !== 'LOADING' && activeBus.status !== 'ARRIVED') {
      return res.status(400).json({ error: 'لا يمكن التحميل على هذه الحافلة حالياً' })
    }

    if (activeBus.loads.length >= activeBus.capacitySnapshot) {
      return res.status(400).json({ error: 'الباص ممتلئ' })
    }

    if (activeBus.status === 'AVAILABLE' || activeBus.status === 'ARRIVED') {
      await prisma.activeBus.update({ where: { id: activeBusId }, data: { status: 'LOADING' } })
    }

    const existingLoad = await prisma.busLoad.findFirst({
      where: { activeBusId, studentId },
    })
    if (existingLoad) {
      return res.status(400).json({ error: 'الطالب موجود بالفعل في هذه الحافلة' })
    }

    const otherLoads = await prisma.busLoad.findMany({
      where: {
        studentId,
        activeBus: { operationId: activeBus.operationId },
        NOT: { activeBusId },
      },
    })
    for (const ol of otherLoads) {
      await prisma.busLoad.delete({ where: { id: ol.id } })
      const remaining = await prisma.busLoad.count({ where: { activeBusId: ol.activeBusId } })
      if (remaining === 0) {
        await prisma.activeBus.update({
          where: { id: ol.activeBusId },
          data: { status: 'AVAILABLE' },
        })
      }
    }

    const queueEntry = await prisma.returnQueue.findFirst({
      where: { studentId, operationId: activeBus.operationId, status: { not: 'DEPARTED' } },
    })

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true, zone: true } })
    let reason = exceptionReason
    if (activeBus.line && student?.zone) {
      const studentLine = student.zone.includes('الروضة') || student.zone.includes('النزهة') ? 'JEBALI' : 'BAHRY'
      if (activeBus.line !== studentLine) {
        reason = reason || `طالب ${studentLine === 'JEBALI' ? 'جبلي' : 'بحري'} داخل باص ${activeBus.line === 'JEBALI' ? 'جبلي' : 'بحري'}`
      }
    }

    const maxSort = await prisma.busLoad.aggregate({
      where: { activeBusId },
      _max: { sortOrder: true },
    })
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1

    const load = await prisma.busLoad.create({
      data: {
        activeBusId, studentId, assignedById: req.user.id,
        exceptionReason: reason,
        sortOrder: nextSort,
      },
      include: { student: { select: { id: true, name: true, transportMode: true, homeAddress: true, homeDeliveryFee: true, homeNotes: true, institutionName: true, pickupLocation: true, address: true, phone: true, whatsapp: true } } },
    })

    if (queueEntry) {
      await prisma.returnQueue.update({ where: { id: queueEntry.id }, data: { status: 'ASSIGNED' } })
    }

    const loadStudentUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
    if (loadStudentUser?.id) {
      const busForLoad = await prisma.bus.findUnique({ where: { id: activeBus.busId }, select: { busNumber: true } })
      notifyStudent({
        userId: loadStudentUser.id, type: 'student_return_assigned', title: 'تم إسنادك لباص العودة',
        message: `تم إسنادك إلى باص ${busForLoad?.busNumber || ''} لرحلة العودة`,
        targetRoute: '/student',
      })
    }

    res.status(201).json(load)
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'الطالب موجود بالفعل في هذه الحافلة' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.delete('/load/:activeBusId/:studentId', authorize('admin'), async (req, res) => {
  try {
    const load = await prisma.busLoad.findFirst({
      where: { activeBusId: req.params.activeBusId, studentId: req.params.studentId },
    })
    if (!load) return res.status(404).json({ error: 'غير موجود' })

    await prisma.busLoad.delete({ where: { id: load.id } })

    await prisma.returnQueue.updateMany({
      where: { studentId: req.params.studentId, status: 'ASSIGNED' },
      data: { status: 'WAITING' },
    })

    const loadRemovedUser = await prisma.user.findUnique({ where: { studentId: req.params.studentId }, select: { id: true } })
    if (loadRemovedUser?.id) {
      notifyStudent({
        userId: loadRemovedUser.id, type: 'student_return_queue_cancelled', title: 'تم إلغاء إسنادك',
        message: 'تم إلغاء إسنادك لباص العودة وإعادتك لقائمة الانتظار',
        targetRoute: '/student',
      })
    }

    const remaining = await prisma.busLoad.count({ where: { activeBusId: req.params.activeBusId } })
    if (remaining === 0) {
      await prisma.activeBus.update({ where: { id: req.params.activeBusId }, data: { status: 'AVAILABLE' } })
    }

    res.json({ message: 'تم إزالة الطالب من الحافلة' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses/:id/reorder', authorize('admin'), async (req, res) => {
  try {
    const { studentIds } = req.body
    if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds مطلوب' })

    const updates = studentIds.map((studentId, idx) =>
      prisma.busLoad.updateMany({
        where: { activeBusId: req.params.id, studentId },
        data: { sortOrder: idx },
      })
    )
    await Promise.all(updates)
    res.json({ message: 'تم حفظ الترتيب' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses/:id/dispatch', authorize('admin'), async (req, res) => {
  try {
    const { line, studentIds } = req.body
    const activeBus = await prisma.activeBus.findUnique({ where: { id: req.params.id }, include: { loads: true, bus: { select: { id: true, busNumber: true } } } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })

    const finalLine = line || activeBus.line
    if (!['BOARDING_TIME_ENDED'].includes(activeBus.status)) {
      return res.status(400).json({ error: 'لا يمكن الانطلاق إلا بعد انتهاء وقت الصعود (BOARDING_TIME_ENDED)' })
    }

    await prisma.activeBus.update({
      where: { id: req.params.id },
      data: { line: finalLine, status: 'DEPARTED' },
    })

    notifyAndBroadcastToBus(activeBus.busId, {
      activeBusId: req.params.id,
      type: 'driver_return_dispatched', title: 'انطلقت رحلة العودة', message: `تم انطلاق رحلة العودة${finalLine === 'JEBALI' ? ' (جبلي)' : finalLine === 'BAHRY' ? ' (بحري)' : ''}`,
      priority: 'INFO',
    })

    if (Array.isArray(studentIds)) {
      const updates = studentIds.map((studentId, idx) =>
        prisma.busLoad.updateMany({
          where: { activeBusId: req.params.id, studentId },
          data: { sortOrder: idx },
        })
      )
      await Promise.all(updates)
    }

    const studentIdsInBus = activeBus.loads?.map(l => l.studentId) || []
    if (studentIdsInBus.length > 0) {
      await Promise.all([
        prisma.busLoad.updateMany({
          where: { activeBusId: req.params.id },
          data: { departedAt: new Date() },
        }),
        prisma.returnQueue.updateMany({
          where: { operationId: activeBus.operationId, studentId: { in: studentIdsInBus } },
          data: { status: 'DEPARTED' },
        }),
      ])
    }

    const dispatchLoads = activeBus.loads || []
    for (const dl of dispatchLoads) {
      const dispatchUser = await prisma.user.findUnique({ where: { studentId: dl.studentId }, select: { id: true } })
      if (dispatchUser?.id) {
        notifyStudent({
          userId: dispatchUser.id, type: 'student_return_trip_started', title: 'انطلقت رحلة العودة',
          message: 'انطلق باص العودة',
          targetRoute: '/student',
          dedupKey: `student_return_trip_started_${dl.studentId}`,
        })
      }
    }

    res.json({ message: 'تم انطلاق الباص', status: 'DEPARTED', line: finalLine })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses/:id/dispatch-by-driver', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح' })
    }
    const activeBus = await prisma.activeBus.findUnique({
      where: { id: req.params.id },
      include: { loads: true, bus: { select: { id: true, busNumber: true } } },
    })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })

    if (req.user.role === 'driver' && String(activeBus.driverId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    }

    if (!['BOARDING_TIME_ENDED', 'BOARDING', 'LOADING'].includes(activeBus.status)) {
      return res.status(400).json({ error: 'لا يمكن الانطلاق إلا إذا كان الباص في مرحلة الصعود أو ما قبلها' })
    }

    const now = new Date()
    await prisma.activeBus.update({
      where: { id: req.params.id },
      data: { status: 'DEPARTED' },
    })

    notifyAndBroadcastToBus(activeBus.busId, {
      activeBusId: req.params.id,
      type: 'driver_return_dispatched',
      title: '🚍 انطلقت رحلة العودة',
      message: `انطلق باص العودة رقم ${activeBus.bus?.busNumber || ''} الآن.`,
      priority: 'INFO',
    })

    const studentIdsInBus = activeBus.loads?.map(l => l.studentId) || []
    if (studentIdsInBus.length > 0) {
      await Promise.all([
        prisma.busLoad.updateMany({
          where: { activeBusId: req.params.id },
          data: { departedAt: now },
        }),
        prisma.returnQueue.updateMany({
          where: { operationId: activeBus.operationId, studentId: { in: studentIdsInBus } },
          data: { status: 'DEPARTED' },
        }),
      ])
    }

    const dispatchLoads = activeBus.loads || []
    for (const dl of dispatchLoads) {
      const dispatchUser = await prisma.user.findUnique({ where: { studentId: dl.studentId }, select: { id: true } })
      if (dispatchUser?.id) {
        notifyStudent({
          userId: dispatchUser.id, type: 'student_return_trip_started', title: 'انطلقت رحلة العودة',
          message: 'انطلق باص العودة الآن.',
          targetRoute: '/student',
          dedupKey: `student_return_trip_started_${dl.studentId}_${now.getTime()}`,
        })
      }
    }

    res.json({ message: 'تم انطلاق الباص من قبل السائق', status: 'DEPARTED', activeBusId: req.params.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/load/:activeBusId/:studentId/dropoff', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' })
    const { activeBusId, studentId } = req.params
    const activeBus = await prisma.activeBus.findUnique({ where: { id: activeBusId }, select: { driverId: true, status: true } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    if (req.user.role === 'driver' && activeBus.driverId !== req.user.id) return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    if (activeBus.status !== 'DEPARTED') return res.status(400).json({ error: 'لا يمكن إنزال الطلاب إلا بعد انطلاق الباص' })

    const load = await prisma.busLoad.findFirst({
      where: { activeBusId, studentId },
    })
    if (!load) return res.status(404).json({ error: 'الطالب غير موجود في هذه الحافلة' })

    const updated = await prisma.busLoad.update({
      where: { id: load.id },
      data: { droppedOffAt: new Date() },
    })

    const busForNotify = await prisma.activeBus.findUnique({ where: { id: activeBusId }, select: { busId: true } })
    if (busForNotify) {
      notifyAndBroadcastToBus(busForNotify.busId, {
        type: 'driver_student_dropped_off', title: 'تم إنزال طالب', message: 'تم إنزال طالب من رحلة العودة',
        data: { activeBusId, studentId },
      })
    }

    const dropoffUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
    if (dropoffUser?.id) {
      notifyStudent({
        userId: dropoffUser.id, type: 'student_dropped_off', title: 'وصلت إلى وجهتك',
        message: 'تم إنزالك من باص العودة. شكراً لاستخدامك الخدمة.',
        targetRoute: '/student',
      })
    }

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/active-buses/:id/complete', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' })
    const activeBus = await prisma.activeBus.findUnique({
      where: { id: req.params.id },
    })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    if (req.user.role === 'driver' && activeBus.driverId !== req.user.id) return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    if (activeBus.returnCompletedAt) return res.status(400).json({ error: 'رحلة العودة منتهية بالفعل' })

    const updated = await prisma.activeBus.update({
      where: { id: req.params.id },
      data: { returnCompletedAt: new Date() },
    })

    notifyAndBroadcastToBus(activeBus.busId, {
      type: 'driver_return_completed', title: 'انتهت رحلة العودة', message: 'تم إنهاء رحلة العودة بنجاح',
      priority: 'INFO',
    })

    const completeLoads = await prisma.busLoad.findMany({
      where: { activeBusId: req.params.id, droppedOffAt: null },
      select: { studentId: true },
    })
    for (const cl of completeLoads) {
      const completeUser = await prisma.user.findUnique({ where: { studentId: cl.studentId }, select: { id: true } })
      if (completeUser?.id) {
        notifyStudent({
          userId: completeUser.id, type: 'student_trip_ended', title: 'انتهت رحلتك',
          message: 'انتهت رحلة العودة. شكراً لاستخدامك الخدمة.',
          targetRoute: '/student',
        })
      }
    }

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/departed', async (req, res) => {
  try {
    const { today, tomorrow } = todayRange()
    const op = await prisma.dailyOperation.findFirst({
      where: { operationDate: { gte: today, lt: tomorrow } },
    })
    if (!op) return res.json([])
    const buses = await prisma.activeBus.findMany({
      where: { operationId: op.id, tripType: 'RETURN', status: 'DEPARTED' },
      include: {
        bus: { select: { id: true, plateNumber: true, model: true } },
        driver: { select: { id: true, name: true, phone: true } },
        loads: {
          include: {
            student: { select: { id: true, name: true, transportMode: true, homeAddress: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
    res.json(buses)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
