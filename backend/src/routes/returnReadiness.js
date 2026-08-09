import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getLocalDate } from '../utils/dateUtils.js'
import {
  studentMarkReady,
  studentMarkDelayed,
  studentArrivedAtPickup,
  driverMarkOnBoard,
  startBoardingTimer,
  stopBoardingTimer,
  tickBoardingTimers,
  getDefaultBoardingMinutes,
  setDefaultBoardingMinutes,
  getAppSetting,
  setAppSetting,
  getReturnDashboardForStudent,
  getBoardingChecklistForDriver,
  getReturnReadinessStats,
} from '../services/returnReadinessService.js'
import {
  notifyStudent,
} from '../services/socketService.js'

const router = Router()
router.use(authenticate)

async function resolveStudentId(user) {
  if (user.studentId) return user.studentId
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  return dbUser?.studentId
}

function todayRange() {
  const today = getLocalDate()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  return { today, tomorrow }
}

router.get('/settings/default-boarding-minutes', authorize('admin'), async (req, res) => {
  try {
    const minutes = await getDefaultBoardingMinutes()
    res.json({ minutes })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/settings/default-boarding-minutes', authorize('admin'), async (req, res) => {
  try {
    const { minutes } = req.body
    const value = await setDefaultBoardingMinutes(minutes)
    res.json({ minutes: value })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/settings/:key', authorize('admin'), async (req, res) => {
  try {
    const value = await getAppSetting(req.params.key)
    res.json({ key: req.params.key, value })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/settings/:key', authorize('admin'), async (req, res) => {
  try {
    const { value, valueType, description } = req.body
    const saved = await setAppSetting(req.params.key, value, valueType || 'string', description)
    res.json({ key: saved.key, value: saved.value })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/student/dashboard', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })
    const data = await getReturnDashboardForStudent(studentId)
    res.json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/student/ready', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const { activeBusId } = req.body
    if (!activeBusId) return res.status(400).json({ error: 'activeBusId مطلوب' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })
    const result = await studentMarkReady(studentId, activeBusId)
    if (!result) return res.status(404).json({ error: 'الطالب غير مضاف إلى هذا الباص' })
    res.json({ status: 'READY' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/student/delayed', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const { activeBusId, delayMinutes, delayReason } = req.body
    if (!activeBusId) return res.status(400).json({ error: 'activeBusId مطلوب' })
    if (!delayMinutes || ![5, 10, 15, -1].includes(Number(delayMinutes))) {
      return res.status(400).json({ error: 'مدة التأخير غير صالحة' })
    }
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })
    const finalDelayMin = Number(delayMinutes) === -1 ? 20 : Number(delayMinutes)
    const result = await studentMarkDelayed(studentId, activeBusId, finalDelayMin, delayReason)
    if (!result) return res.status(404).json({ error: 'الطالب غير مضاف إلى هذا الباص' })
    res.json({ status: 'DELAYED', delayMinutes: finalDelayMin, delayReason: delayReason || null })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/student/arrived', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const { activeBusId } = req.body
    if (!activeBusId) return res.status(400).json({ error: 'activeBusId مطلوب' })
    const studentId = await resolveStudentId(req.user)
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })
    const result = await studentArrivedAtPickup(studentId, activeBusId)
    if (!result) return res.status(404).json({ error: 'الطالب غير مضاف إلى هذا الباص' })
    res.json({ status: 'READY' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/driver/checklist', async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'غير مصرح' })
    const data = await getBoardingChecklistForDriver(req.user.id)
    res.json(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/driver/on-board', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' })
    const { activeBusId, studentId } = req.body
    if (!activeBusId || !studentId) return res.status(400).json({ error: 'activeBusId و studentId مطلوبان' })
    const result = await driverMarkOnBoard(studentId, activeBusId, req.user.id)
    if (!result) return res.status(404).json({ error: 'غير موجود' })
    res.json({ status: 'ON_BOARD' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/driver/on-board/batch', async (req, res) => {
  try {
    if (req.user.role !== 'driver' && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' })
    const { activeBusId, studentIds } = req.body
    if (!activeBusId || !Array.isArray(studentIds)) return res.status(400).json({ error: 'بيانات غير صالحة' })
    const results = []
    for (const studentId of studentIds) {
      try {
        const r = await driverMarkOnBoard(studentId, activeBusId, req.user.id)
        if (r) results.push(studentId)
      } catch { /* silent */ }
    }
    res.json({ marked: results.length, studentIds: results })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/driver/start-timer/:activeBusId', async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'غير مصرح' })
    const activeBus = await prisma.activeBus.findUnique({
      where: { id: req.params.activeBusId },
      select: { driverId: true, status: true },
    })
    if (!activeBus) return res.status(404).json({ error: 'الباص غير موجود' })
    if (activeBus.driverId !== req.user.id) return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    if (!['LOADING', 'AVAILABLE'].includes(activeBus.status)) {
      return res.status(400).json({ error: 'لا يمكن بدء العداد إلا في مرحلة التحميل' })
    }
    const timer = await startBoardingTimer(req.params.activeBusId)
    if (!timer) return res.status(400).json({ error: 'تعذر تشغيل العداد' })
    res.json({ started: true, timer })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/driver/stop-timer/:activeBusId', async (req, res) => {
  try {
    if (req.user.role !== 'driver') return res.status(403).json({ error: 'غير مصرح' })
    const activeBus = await prisma.activeBus.findUnique({
      where: { id: req.params.activeBusId },
      select: { driverId: true },
    })
    if (!activeBus) return res.status(404).json({ error: 'الباص غير موجود' })
    if (activeBus.driverId !== req.user.id) return res.status(403).json({ error: 'ليس سائق هذا الباص' })
    await stopBoardingTimer(req.params.activeBusId)
    res.json({ stopped: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/admin/start-timer/:activeBusId', authorize('admin'), async (req, res) => {
  try {
    const timer = await startBoardingTimer(req.params.activeBusId)
    if (!timer) return res.status(400).json({ error: 'تعذر تشغيل العداد' })
    res.json({ started: true, timer })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/admin/stop-timer/:activeBusId', authorize('admin'), async (req, res) => {
  try {
    await stopBoardingTimer(req.params.activeBusId)
    res.json({ stopped: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/admin/tick', authorize('admin'), async (req, res) => {
  try {
    await tickBoardingTimers()
    res.json({ ticked: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/admin/stats/:activeBusId', async (req, res) => {
  try {
    const stats = await getReturnReadinessStats(req.params.activeBusId)
    res.json(stats)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/admin/active-buses-readiness', authorize('admin'), async (req, res) => {
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
          include: {
            student: { select: { id: true, name: true, transportMode: true, homeAddress: true, homeDeliveryFee: true, homeNotes: true, institutionName: true, pickupLocation: true, address: true, phone: true, whatsapp: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { assignedAt: 'asc' }],
        },
        boardingTimer: true,
      },
      orderBy: { createdAt: 'asc' },
    })
    res.json(buses.map(b => ({
      ...b,
      occupiedSeats: b.loads.length,
      remainingSeats: b.capacitySnapshot - b.loads.length,
      fillPercent: b.capacitySnapshot > 0 ? Math.round((b.loads.length / b.capacitySnapshot) * 100) : 0,
    })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/admin/load-assign-announce', authorize('admin'), async (req, res) => {
  try {
    const { activeBusId, studentId } = req.body
    if (!activeBusId || !studentId) return res.status(400).json({ error: 'بيانات غير صالحة' })
    const activeBus = await prisma.activeBus.findUnique({
      where: { id: activeBusId },
      include: { bus: { select: { busNumber: true, plateNumber: true } } },
    })
    if (!activeBus) return res.status(404).json({ error: 'الباص غير موجود' })
    const user = await prisma.user.findUnique({ where: { studentId }, select: { id: true } })
    if (user?.id) {
      await notifyStudent({
        userId: user.id,
        type: 'student_return_assigned_readiness',
        title: `تم تخصيصك للباص رقم ${activeBus.bus?.busNumber || activeBus.bus?.plateNumber || ''}`,
        message: 'يمكنك الآن الإشارة إلى جاهزيتك من داخل التطبيق (أنا جاهز / سأتأخر).',
        targetRoute: '/student',
        priority: 'HIGH',
        dedupKey: `assigned_${studentId}_${activeBusId}`,
        data: { activeBusId, busNumber: activeBus.bus?.busNumber },
      })
    }
    res.json({ announced: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
