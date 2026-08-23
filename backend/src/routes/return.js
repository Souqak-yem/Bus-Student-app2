import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { notifyAndBroadcastToBus, notifyStudent, broadcastTrackingUpdate } from '../services/socketService.js'
import { getTrackingState } from '../services/trackingService.js'

const router = Router()
router.use(authenticate)

function todayRange() {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

const STUDENT_FULL = {
  select: {
    id: true, name: true, zone: true, transportMode: true, homeAddress: true,
    homeDeliveryFee: true, homeNotes: true, institutionName: true, pickupLocation: true,
    address: true, phone: true, whatsapp: true, gender: true,
    destination: { select: { id: true, name: true } },
  },
}

const BUS_SELECT = { select: { id: true, busNumber: true, plateNumber: true, model: true } }
const DRIVER_SELECT = { select: { id: true, name: true, phone: true } }

async function findTodayOperation() {
  const { today, tomorrow } = todayRange()
  return prisma.dailyOperation.findFirst({ where: { operationDate: { gte: today, lt: tomorrow } } })
}

async function getTodayOperationOrThrow() {
  const op = await findTodayOperation()
  if (!op) throw new Error('لا يوجد تشغيل لليوم')
  return op
}

async function createOperation(userId, notes) {
  const { today } = todayRange()
  return prisma.dailyOperation.create({ data: { operationDate: today, createdById: userId, notes } })
}

async function closeOperation(id) {
  return prisma.dailyOperation.update({ where: { id }, data: { status: 'CLOSED' } })
}

async function findActiveBusesForReturn() {
  const op = await findTodayOperation()
  if (!op) return []
  return prisma.activeBus.findMany({
    where: { operationId: op.id, tripType: 'RETURN', status: { notIn: ['CANCELLED', 'BROKEN_DOWN', 'REPLACED'] } },
    include: { bus: BUS_SELECT, driver: DRIVER_SELECT, loads: { include: { student: STUDENT_FULL } }, boardingTimer: true },
    orderBy: { createdAt: 'asc' },
  })
}

async function createActiveReturnBus(userId, busId) {
  const op = await getTodayOperationOrThrow()
  const bus = await prisma.bus.findUnique({ where: { id: busId }, select: { driverId: true, capacity: true } })
  if (!bus) throw new Error('الحافلة غير موجودة')
  const existing = await prisma.activeBus.findFirst({ where: { operationId: op.id, busId, tripType: 'RETURN' } })
  if (existing) throw new Error('هذه الحافلة موجودة بالفعل في رحلة العودة')
  return prisma.activeBus.create({
    data: { operationId: op.id, busId, driverId: bus.driverId || userId, tripType: 'RETURN', capacitySnapshot: bus.capacity, status: 'AVAILABLE' },
    include: { bus: BUS_SELECT, driver: DRIVER_SELECT, loads: true },
  })
}

async function deleteActiveBus(id) {
  const ab = await prisma.activeBus.findUnique({ where: { id }, select: { busId: true } })
  if (ab) await prisma.activeBus.delete({ where: { id } })
  return ab
}

async function findQueueWaiting() {
  const op = await findTodayOperation()
  if (!op) return []
  return prisma.returnQueue.findMany({
    where: { operationId: op.id, status: 'WAITING' },
    include: { student: STUDENT_FULL },
    orderBy: { enteredAt: 'asc' },
  })
}

async function createQueueEntry(studentId, notes, createdById) {
  const op = await getTodayOperationOrThrow()
  return prisma.returnQueue.create({
    data: { operationId: op.id, studentId, notes, status: 'WAITING' },
    include: { student: STUDENT_FULL },
  })
}

async function updateQueueStatus(id, status) {
  return prisma.returnQueue.update({ where: { id }, data: { status } })
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
    const op = await findTodayOperation()
    res.json(op)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/operation', authorize('admin'), async (req, res) => {
  try {
    const existing = await findTodayOperation()
    if (existing) return res.status(400).json({ error: 'يوجد تشغيل لليوم بالفعل' })
    const op = await createOperation(req.user.id, req.body.notes)
    res.status(201).json(op)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/operation/:id/close', authorize('admin'), async (req, res) => {
  try {
    const op = await closeOperation(req.params.id)
    res.json(op)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/active-buses', async (req, res) => {
  try {
    const buses = await findActiveBusesForReturn()
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
    const active = await createActiveReturnBus(req.user.id, busId)
    res.status(201).json({ ...active, occupiedSeats: 0, remainingSeats: active.capacitySnapshot, fillPercent: 0 })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/active-buses/:id/line', authorize('admin'), async (req, res) => {
  try {
    const { line } = req.body
    if (!['JEBALI', 'BAHRY'].includes(line)) return res.status(400).json({ error: 'الخط غير صالح' })
    const activeBus = await prisma.activeBus.findUnique({ where: { id: req.params.id }, select: { status: true } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة في التشغيل' })
    if (['DEPARTED', 'ARRIVED', 'CANCELLED', 'BROKEN_DOWN', 'REPLACED'].includes(activeBus.status)) {
      return res.status(400).json({ error: 'لا يمكن تعديل الخط بعد انطلاق الرحلة' })
    }
    const updated = await prisma.activeBus.update({ where: { id: req.params.id }, data: { line } })
    res.json({ id: updated.id, line: updated.line })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/active-buses/:id/status', authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body
    const activeBus = await prisma.activeBus.findUnique({ where: { id: req.params.id }, include: { loads: true } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة في التشغيل' })
    if (!canTransition(activeBus.status, status)) return res.status(400).json({ error: `لا يمكن الانتقال من ${activeBus.status} إلى ${status}` })
    const updated = await prisma.activeBus.update({ where: { id: req.params.id }, data: { status } })
    if (status === 'DEPARTED') {
      const studentIds = activeBus.loads.map(l => l.studentId)
      await Promise.all([
        prisma.busLoad.updateMany({ where: { activeBusId: req.params.id }, data: { departedAt: new Date() } }),
        prisma.returnQueue.updateMany({ where: { operationId: activeBus.operationId, studentId: { in: studentIds } }, data: { status: 'DEPARTED' } }),
      ])
    }
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/active-buses/:id', authorize('admin'), async (req, res) => {
  try {
    const ab = await deleteActiveBus(req.params.id)
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
    const queue = await findQueueWaiting()
    res.json(queue)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/queue', authorize('admin'), async (req, res) => {
  try {
    const { studentId, notes } = req.body
    if (!studentId) return res.status(400).json({ error: 'الطالب مطلوب' })
    const entry = await createQueueEntry(studentId, notes, req.user.id)
    const queueStudentUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
    if (queueStudentUser?.id) {
      notifyStudent({ userId: queueStudentUser.id, type: 'student_return_queue_added', title: 'تمت إضافتك لقائمة الانتظار', message: 'تمت إضافتك لقائمة انتظار رحلة العودة', targetRoute: '/student' })
    }
    res.status(201).json(entry)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/queue/:id', authorize('admin'), async (req, res) => {
  try {
    await updateQueueStatus(req.params.id, 'DEPARTED')
    res.json({ message: 'تم إزالة الطالب من قائمة الانتظار' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/load', authorize('admin'), async (req, res) => {
  try {
    const { activeBusId, studentId, exceptionReason } = req.body
    if (!activeBusId || !studentId) return res.status(400).json({ error: 'الحافلة والطالب مطلوبان' })
    const activeBus = await prisma.activeBus.findUnique({ where: { id: activeBusId }, include: { loads: true } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    if (!['AVAILABLE', 'LOADING', 'ARRIVED'].includes(activeBus.status)) return res.status(400).json({ error: 'لا يمكن التحميل على هذه الحافلة حالياً' })
    if (activeBus.loads.length >= activeBus.capacitySnapshot) return res.status(400).json({ error: 'الباص ممتلئ' })
    if (['AVAILABLE', 'ARRIVED'].includes(activeBus.status)) await prisma.activeBus.update({ where: { id: activeBusId }, data: { status: 'LOADING' } })
    const existingLoad = await prisma.busLoad.findFirst({ where: { activeBusId, studentId } })
    if (existingLoad) return res.status(400).json({ error: 'الطالب موجود بالفعل في هذه الحافلة' })
    const otherLoads = await prisma.busLoad.findMany({ where: { studentId, activeBus: { operationId: activeBus.operationId }, NOT: { activeBusId } } })
    for (const ol of otherLoads) {
      await prisma.busLoad.delete({ where: { id: ol.id } })
      const remaining = await prisma.busLoad.count({ where: { activeBusId: ol.activeBusId } })
      if (remaining === 0) await prisma.activeBus.update({ where: { id: ol.activeBusId }, data: { status: 'AVAILABLE' } })
    }
    const queueEntry = await prisma.returnQueue.findFirst({ where: { studentId, operationId: activeBus.operationId, status: { not: 'DEPARTED' } } })
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true, zone: true } })
    let reason = exceptionReason
    if (activeBus.line && student?.zone) {
      const studentLine = student.zone.includes('الروضة') || student.zone.includes('النزهة') ? 'JEBALI' : 'BAHRY'
      if (activeBus.line !== studentLine) reason = reason || `طالب ${studentLine === 'JEBALI' ? 'جبلي' : 'بحري'} داخل باص ${activeBus.line === 'JEBALI' ? 'جبلي' : 'بحري'}`
    }
    const maxSort = await prisma.busLoad.aggregate({ where: { activeBusId }, _max: { sortOrder: true } })
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1
    const load = await prisma.busLoad.create({ data: { activeBusId, studentId, assignedById: req.user.id, exceptionReason: reason, sortOrder: nextSort }, include: { student: STUDENT_FULL } })
    if (queueEntry) await prisma.returnQueue.update({ where: { id: queueEntry.id }, data: { status: 'ASSIGNED' } })
    const loadStudentUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
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
    const load = await prisma.busLoad.findFirst({ where: { activeBusId: req.params.activeBusId, studentId: req.params.studentId } })
    if (!load) return res.status(404).json({ error: 'غير موجود' })
    await prisma.busLoad.delete({ where: { id: load.id } })
    await prisma.returnQueue.updateMany({ where: { studentId: req.params.studentId, status: 'ASSIGNED' }, data: { status: 'WAITING' } })
    const loadRemovedUser = await prisma.user.findUnique({ where: { studentId: req.params.studentId }, select: { id: true } })
    if (loadRemovedUser?.id) notifyStudent({ userId: loadRemovedUser.id, type: 'student_return_queue_cancelled', title: 'تم إلغاء إسنادك', message: 'تم إلغاء إسنادك لباص العودة وإعادتك لقائمة الانتظار', targetRoute: '/student' })
    const remaining = await prisma.busLoad.count({ where: { activeBusId: req.params.activeBusId } })
    if (remaining === 0) await prisma.activeBus.update({ where: { id: req.params.activeBusId }, data: { status: 'AVAILABLE' } })
    res.json({ message: 'تم إزالة الطالب من الحافلة' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/load/transfer', authorize('admin'), async (req, res) => {
  try {
    const { studentId, fromActiveBusId, toActiveBusId, exceptionReason } = req.body
    if (!studentId || !fromActiveBusId || !toActiveBusId) return res.status(400).json({ error: 'studentId و fromActiveBusId و toActiveBusId مطلوبان' })

    const fromLoad = await prisma.busLoad.findFirst({ where: { activeBusId: fromActiveBusId, studentId } })
    if (!fromLoad) return res.status(404).json({ error: 'الطالب غير موجود في الحافلة المصدر' })

    const [fromBus, toBus, targetActiveBus] = await Promise.all([
      prisma.bus.findUnique({ where: { id: (await prisma.activeBus.findUnique({ where: { id: fromActiveBusId }, select: { busId: true } })).busId }, select: { busNumber: true } }),
      prisma.bus.findUnique({ where: { id: (await prisma.activeBus.findUnique({ where: { id: toActiveBusId }, select: { busId: true } })).busId }, select: { busNumber: true } }),
      prisma.activeBus.findUnique({ where: { id: toActiveBusId }, include: { loads: true } }),
    ])

    await prisma.busLoad.delete({ where: { id: fromLoad.id } })
    await prisma.returnQueue.updateMany({ where: { studentId, status: 'ASSIGNED' }, data: { status: 'WAITING' } })
    const remaining = await prisma.busLoad.count({ where: { activeBusId: fromActiveBusId } })
    if (remaining === 0) await prisma.activeBus.update({ where: { id: fromActiveBusId }, data: { status: 'AVAILABLE' } })

    const maxSort = await prisma.busLoad.aggregate({ where: { activeBusId: toActiveBusId }, _max: { sortOrder: true } })
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1
    const newLoad = await prisma.busLoad.create({ data: { activeBusId: toActiveBusId, studentId, assignedById: req.user.id, exceptionReason, sortOrder: nextSort }, include: { student: STUDENT_FULL } })
    if (toBus && newLoad) {
      await prisma.returnQueue.updateMany({ where: { studentId, status: 'WAITING' }, data: { status: 'ASSIGNED' } })
      const loadStudentUser = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
      if (loadStudentUser?.id) {
        await notifyStudent({
          userId: loadStudentUser.id,
          type: 'student_return_bus_changed',
          title: 'تم تحويلك إلى باص آخر',
          message: `تم نقل الطالب إلى باص العودة ${toBus.busNumber || 'الجديد'}`,
          targetRoute: '/student',
          dedupKey: `student_return_bus_changed_${studentId}`,
        })
      }
    }

    res.status(200).json(newLoad)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses/:id/reorder', authorize('admin'), async (req, res) => {
  try {
    const { studentIds } = req.body
    if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds مطلوب' })
    const updates = studentIds.map((studentId, idx) => prisma.busLoad.updateMany({ where: { activeBusId: req.params.id, studentId }, data: { sortOrder: idx } }))
    await Promise.all(updates)
    res.json({ message: 'تم حفظ الترتيب' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses/:id/dispatch', authorize('admin'), async (req, res) => {
  try {
    const { line, studentIds } = req.body
    const activeBus = await prisma.activeBus.findUnique({ where: { id: req.params.id }, include: { loads: true, bus: BUS_SELECT } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    const finalLine = line || activeBus.line
    if (!['BOARDING_TIME_ENDED'].includes(activeBus.status)) return res.status(400).json({ error: 'لا يمكن الانطلاق إلا بعد انتهاء وقت الصعود (BOARDING_TIME_ENDED)' })
    await prisma.activeBus.update({ where: { id: req.params.id }, data: { line: finalLine, status: 'DEPARTED' } })
    notifyAndBroadcastToBus(activeBus.busId, { activeBusId: req.params.id, type: 'driver_return_dispatched', title: 'انطلقت رحلة العودة', message: `تم انطلاق رحلة العودة${finalLine === 'JEBALI' ? ' (جبلي)' : finalLine === 'BAHRY' ? ' (بحري)' : ''}`, priority: 'INFO' })
    if (Array.isArray(studentIds)) {
      const updates = studentIds.map((studentId, idx) => prisma.busLoad.updateMany({ where: { activeBusId: req.params.id, studentId }, data: { sortOrder: idx } }))
      await Promise.all(updates)
    }
    const studentIdsInBus = activeBus.loads?.map(l => l.studentId) || []
    if (studentIdsInBus.length > 0) {
      await Promise.all([
        prisma.busLoad.updateMany({ where: { activeBusId: req.params.id }, data: { departedAt: new Date() } }),
        prisma.returnQueue.updateMany({ where: { operationId: activeBus.operationId, studentId: { in: studentIdsInBus } }, data: { status: 'DEPARTED' } }),
      ])
    }
    const dispatchLoads = activeBus.loads || []
    for (const dl of dispatchLoads) {
      const dispatchUser = await prisma.user.findUnique({ where: { studentId: dl.studentId }, select: { id: true } })
      if (dispatchUser?.id) notifyStudent({ userId: dispatchUser.id, type: 'student_return_trip_started', title: 'انطلقت رحلة العودة', message: 'انطلق باص العودة', targetRoute: '/student', dedupKey: `student_return_trip_started_${dl.studentId}` })
    }
    res.json({ message: 'تم انطلاق الباص', status: 'DEPARTED', line: finalLine })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/active-buses/:id/dispatch-by-driver', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' })
    const activeBus = await prisma.activeBus.findUnique({ where: { id: req.params.id }, include: { loads: true, bus: BUS_SELECT } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    if (req.user.role === 'driver' && String(activeBus.driverId) !== String(req.user.id)) return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    if (!['BOARDING_TIME_ENDED', 'BOARDING', 'LOADING'].includes(activeBus.status)) return res.status(400).json({ error: 'لا يمكن الانطلاق إلا إذا كان الباص في مرحلة الصعود أو ما قبلها' })
    const now = new Date()
    await prisma.activeBus.update({ where: { id: req.params.id }, data: { status: 'DEPARTED' } })
    notifyAndBroadcastToBus(activeBus.busId, { activeBusId: req.params.id, type: 'driver_return_dispatched', title: '🚍 انطلقت رحلة العودة', message: `انطلق باص العودة رقم ${activeBus.bus?.busNumber || ''} الآن.`, priority: 'INFO' })
    const studentIdsInBus = activeBus.loads?.map(l => l.studentId) || []
    if (studentIdsInBus.length > 0) await Promise.all([ prisma.busLoad.updateMany({ where: { activeBusId: req.params.id }, data: { departedAt: now } }), prisma.returnQueue.updateMany({ where: { operationId: activeBus.operationId, studentId: { in: studentIdsInBus } }, data: { status: 'DEPARTED' } }) ])
    const dispatchLoads = activeBus.loads || []
    for (const dl of dispatchLoads) {
      const dispatchUser = await prisma.user.findUnique({ where: { studentId: dl.studentId }, select: { id: true } })
      if (dispatchUser?.id) notifyStudent({ userId: dispatchUser.id, type: 'student_return_trip_started', title: 'انطلقت رحلة العودة', message: 'انطلق باص العودة الآن.', targetRoute: '/student', dedupKey: `student_return_trip_started_${dl.studentId}_${now.getTime()}` })
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
    const activeBus = await prisma.activeBus.findUnique({ where: { id: activeBusId }, select: { driverId: true, status: true, busId: true } })
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

    // Broadcast updated tracking state to any clients subscribed to this active bus
    try {
      const state = await getTrackingState(activeBusId)
      if (state) broadcastTrackingUpdate(activeBusId, state)
    } catch (e) {
      // best-effort
    }

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.patch('/active-buses/:id/complete', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' })
    const activeBus = await prisma.activeBus.findUnique({ where: { id: req.params.id } })
    if (!activeBus) return res.status(404).json({ error: 'الحافلة غير موجودة' })
    if (req.user.role === 'driver' && activeBus.driverId !== req.user.id) return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    if (activeBus.returnCompletedAt) return res.status(400).json({ error: 'رحلة العودة منتهية بالفعل' })
    const updated = await prisma.activeBus.update({ where: { id: req.params.id }, data: { returnCompletedAt: new Date() } })
    notifyAndBroadcastToBus(activeBus.busId, { type: 'driver_return_completed', title: 'انتهت رحلة العودة', message: 'تم إنهاء رحلة العودة بنجاح', priority: 'INFO' })
    const completeLoads = await prisma.busLoad.findMany({ where: { activeBusId: req.params.id, droppedOffAt: null }, select: { studentId: true } })
    for (const cl of completeLoads) {
      const completeUser = await prisma.user.findUnique({ where: { studentId: cl.studentId }, select: { id: true } })
      if (completeUser?.id) notifyStudent({ userId: completeUser.id, type: 'student_trip_ended', title: 'انتهت رحلتك', message: 'انتهت رحلة العودة. شكراً لاستخدامك الخدمة.', targetRoute: '/student' })
    }
    try { const state = await getTrackingState(req.params.id); if (state) broadcastTrackingUpdate(req.params.id, state) } catch (e) { }
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/departed', async (req, res) => {
  try {
    const { today, tomorrow } = todayRange()
    const op = await prisma.dailyOperation.findFirst({ where: { operationDate: { gte: today, lt: tomorrow } } })
    if (!op) return res.json([])
    const buses = await prisma.activeBus.findMany({
      where: { operationId: op.id, tripType: 'RETURN', status: 'DEPARTED' },
      include: {
        bus: { select: { id: true, plateNumber: true, model: true } },
        driver: { select: { id: true, name: true, phone: true } },
        loads: {
          include: {
            student: { select: { id: true, name: true, zone: true, address: true, pickupLocation: true, transportMode: true, homeAddress: true } },
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
