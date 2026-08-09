import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getLocalDate } from '../utils/dateUtils.js'
import {
  generateTodayOperations,
  getTodayOperation,
  getBusOperationDetail,
  getAvailableBuses,
  updateBusLine,
  addStudentToOperation,
  removeStudentFromOperation,
  updateAssignment,
  removeBusFromOperation,
  transferStudentBetweenBuses,
  transferAllStudentsFromBus,
  addBusesToOperation,
  getOperationHistory,
} from '../services/operationService.js'
import { completeMorningTrip, cancelMorningTrip } from '../services/trackingService.js'
import { notifyAndBroadcastToBus, broadcastDailyExceptionsUpdate } from '../services/socketService.js'

const router = Router()
router.use(authenticate)

router.post('/generate', authorize('admin'), async (req, res) => {
  try {
    const { busIds } = req.body
    if (!busIds || !Array.isArray(busIds) || busIds.length === 0) {
      return res.status(400).json({ error: 'يجب اختيار باص واحد على الأقل' })
    }
    const result = await generateTodayOperations(req.user.id, busIds)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.get('/today', async (req, res) => {
  try {
    const data = await getTodayOperation()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/today/available-buses', authorize('admin'), async (req, res) => {
  try {
    const data = await getAvailableBuses()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/today/bus/:busId', async (req, res) => {
  try {
    const data = await getBusOperationDetail(req.params.busId)
    res.json(data)
  } catch (error) {
    res.status(error.message.includes('غير موجودة') ? 404 : 500).json({ error: error.message })
  }
})

router.patch('/today/bus/:busId/line', authorize('admin'), async (req, res) => {
  try {
    const { line } = req.body
    if (!line || !['JEBALI', 'BAHRY'].includes(line)) {
      return res.status(400).json({ error: 'خط غير صالح' })
    }
    const result = await updateBusLine(req.params.busId, req.user.id, line)
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_bus_line_changed', title: 'تم تعديل خط السير', message: `تم تعديل خط سير الباص إلى ${line === 'JEBALI' ? 'جبلي' : 'بحري'}`,
      priority: 'INFO',
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/today/bus/:busId/assignments', authorize('admin'), async (req, res) => {
  try {
    const { studentId, pickupTime } = req.body
    if (!studentId) return res.status(400).json({ error: 'الطالب مطلوب' })
    const assignment = await addStudentToOperation(req.params.busId, studentId, req.user.id)
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_student_added', title: 'تم إضافة طالب', message: `تم إضافة الطالب ${student?.name || ''} إلى رحلتك`,
      data: { studentId, studentName: student?.name },
    })
    broadcastDailyExceptionsUpdate({ type: 'student_added', timestamp: new Date().toISOString() })
    res.status(201).json(assignment)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.delete('/today/bus/:busId/assignments/:assignmentId', authorize('admin'), async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.assignmentId }, include: { student: { select: { name: true } } } })
    await removeStudentFromOperation(req.params.assignmentId, req.user.id)
    if (assignment?.student) {
      notifyAndBroadcastToBus(req.params.busId, {
        type: 'driver_student_removed', title: 'تم إزالة طالب', message: `تم إزالة الطالب ${assignment.student.name} من رحلتك`,
        data: { studentId: assignment.studentId, studentName: assignment.student.name },
      })
    }
    broadcastDailyExceptionsUpdate({ type: 'student_removed', timestamp: new Date().toISOString() })
    res.json({ message: 'تم حذف الطالب من تشغيل اليوم' })
  } catch (error) {
    res.status(error.message.includes('غير موجودة') ? 404 : 500).json({ error: error.message })
  }
})

router.put('/today/bus/:busId/assignments/:assignmentId', authorize('admin'), async (req, res) => {
  try {
    const updated = await updateAssignment(req.params.busId, req.params.assignmentId, req.user.id, req.body)
    const changedFields = Object.keys(req.body)
    if (changedFields.includes('pickupTime')) {
      notifyAndBroadcastToBus(req.params.busId, {
        type: 'driver_pickup_time_changed', title: 'تم تعديل وقت الصعود', message: 'تم تعديل وقت صعود أحد الطلاب في رحلتك',
        data: { assignmentId: req.params.assignmentId, changes: req.body },
      })
    }
    if (changedFields.includes('sortOrder')) {
      notifyAndBroadcastToBus(req.params.busId, {
        type: 'driver_order_changed', title: 'تم تعديل الترتيب', message: 'تم تعديل ترتيب الطلاب في رحلتك',
        data: { assignmentId: req.params.assignmentId, changes: req.body },
      })
    }
    res.json(updated)
  } catch (error) {
    res.status(error.message.includes('غير موجودة') ? 404 : 500).json({ error: error.message })
  }
})

router.post('/today/add-buses', authorize('admin'), async (req, res) => {
  try {
    const { busIds } = req.body
    if (!busIds || !Array.isArray(busIds) || busIds.length === 0) {
      return res.status(400).json({ error: 'يجب اختيار باص واحد على الأقل' })
    }
    const result = await addBusesToOperation(req.user.id, busIds)
    for (const busId of busIds) {
      notifyAndBroadcastToBus(busId, {
        type: 'driver_bus_added', title: 'تم إضافة باصك للتشغيل', message: 'تمت إضافة باصك إلى تشغيل اليوم',
        priority: 'INFO',
      })
    }
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.delete('/today/bus/:busId', authorize('admin'), async (req, res) => {
  try {
    const result = await removeBusFromOperation(req.params.busId, req.user.id)
    broadcastDailyExceptionsUpdate({ type: 'bus_removed', timestamp: new Date().toISOString() })
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_bus_removed', title: 'تم إلغاء تشغيل باصك', message: 'تم إلغاء تشغيل هذا الباص لتاريخ اليوم',
      priority: 'CRITICAL',
    })
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/today/close', authorize('admin'), async (req, res) => {
  res.status(400).json({ error: 'لا يوجد دعم لإغلاق تشغيل اليوم' })
})

router.patch('/today/bus/:busId/bulk-pickup-time', authorize('admin'), async (req, res) => {
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

    const today = getLocalDate()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const assignments = await prisma.assignment.findMany({
      where: { date: today, period: 'MORNING', busId },
    })
    let updated = 0
    for (const a of assignments) {
      const current = a.pickupTime || '07:00'
      const [h, m] = current.split(':').map(Number)
      const totalMinutes = h * 60 + m + (adjustment === 'add' ? mins : -mins)
      const newH = ((totalMinutes % 1440) + 1440) % 1440
      const newTime = `${String(Math.floor(newH / 60)).padStart(2, '0')}:${String(newH % 60).padStart(2, '0')}`
      await prisma.assignment.update({ where: { id: a.id }, data: { pickupTime: newTime } })
      updated++
    }
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_pickup_time_changed', title: 'تم تعديل أوقات الصعود', message: `تم تعديل وقت صعود ${updated} طالب${adjustment === 'add' ? ' بتأخير' : ' بتقديم'} ${minutes} دقيقة`,
      data: { adjustment, minutes, updated },
    })
    res.json({ message: `تم تعديل وقت ${updated} طالب لليوم فقط`, updated })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/today/bus/:busId/transfer', authorize('admin'), async (req, res) => {
  try {
    const { toBusId, studentId } = req.body
    if (!toBusId || !studentId) {
      return res.status(400).json({ error: 'الحافلة الهدف والطالب مطلوبان' })
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } })
    const result = await transferStudentBetweenBuses(req.params.busId, toBusId, studentId, req.user.id)
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_student_transferred_out', title: 'تم نقل طالب', message: `تم نقل الطالب ${student?.name || ''} من رحلتك إلى باص آخر`,
      data: { studentId, studentName: student?.name, toBusId },
    })
    notifyAndBroadcastToBus(toBusId, {
      type: 'driver_student_transferred_in', title: 'تم نقل طالب إليك', message: `تم نقل الطالب ${student?.name || ''} إلى رحلتك`,
      data: { studentId, studentName: student?.name, fromBusId: req.params.busId },
    })
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/today/bus/:busId/transfer-all', authorize('admin'), async (req, res) => {
  try {
    const { toBusId } = req.body
    if (!toBusId) {
      return res.status(400).json({ error: 'الحافلة الهدف مطلوبة' })
    }
    const result = await transferAllStudentsFromBus(req.params.busId, toBusId, req.user.id)
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_all_transferred', title: 'تم تحويل جميع الطلاب', message: 'تم تحويل جميع طلاب رحلتك إلى باص آخر',
      priority: 'CRITICAL',
    })
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

router.post('/today/bus/:busId/complete-morning', authorize('admin'), async (req, res) => {
  try {
    const state = await completeMorningTrip(req.params.busId)
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_trip_completed', title: 'انتهت رحلة الصباح', message: 'تم إنهاء رحلة الصباح لهذا الباص',
      priority: 'INFO',
    })
    res.json({ message: 'تم إنهاء رحلة الذهاب', state })
  } catch (error) {
    if (error.message.includes('مسبقاً') || error.message.includes('غير موجود')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
})

router.post('/today/bus/:busId/cancel', authorize('admin'), async (req, res) => {
  try {
    const state = await cancelMorningTrip(req.params.busId)
    notifyAndBroadcastToBus(req.params.busId, {
      type: 'driver_trip_cancelled', title: 'تم إلغاء الرحلة', message: 'تم إلغاء رحلة الصباح لهذا الباص',
      priority: 'CRITICAL',
    })
    res.json({ message: 'تم إلغاء الرحلة', state })
  } catch (error) {
    if (error.message.includes('غير موجود') || error.message.includes('منتهية') || error.message.includes('ملغية')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
})

router.get('/history', async (req, res) => {
  try {
    const data = await getOperationHistory()
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
