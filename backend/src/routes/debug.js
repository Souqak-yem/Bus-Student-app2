import express from 'express'
import { prisma } from '../lib/prisma.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { advanceTrackingAfterAttendance, getTrackingState } from '../services/trackingService.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = express.Router()

router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Route not found' })
  }
  next()
})

router.use(authenticate)
router.use(authorize('admin'))

// Temporary debug endpoint reserved for development only. It is intentionally unavailable in production.
// Query params: studentId (required), activeBusId OR busId (one required)
router.get('/broadcast-attendance', async (req, res, next) => {
  try {
    const { studentId, activeBusId, busId } = req.query
    const studentIdNum = Number(studentId)
    const activeBusIdNum = activeBusId !== undefined ? Number(activeBusId) : undefined
    const busIdNum = busId !== undefined ? Number(busId) : undefined

    if (!studentId || !Number.isFinite(studentIdNum) || studentIdNum <= 0) {
      return res.status(400).json({ error: 'studentId must be a positive integer' })
    }

    let resolvedActiveBusId = activeBusIdNum
    if (activeBusId !== undefined && (!Number.isFinite(activeBusIdNum) || activeBusIdNum <= 0)) {
      return res.status(400).json({ error: 'activeBusId must be a positive integer' })
    }

    if (!resolvedActiveBusId) {
      if (!busId || !Number.isFinite(busIdNum) || busIdNum <= 0) {
        return res.status(400).json({ error: 'either activeBusId or busId is required' })
      }
      const today = getLocalDate()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      let activeBus = await prisma.activeBus.findFirst({
        where: { busId: busIdNum, operation: { operationDate: { gte: today, lt: tomorrow } } },
        orderBy: { id: 'desc' },
      })
      if (!activeBus) {
        activeBus = await prisma.activeBus.findFirst({ where: { busId: busIdNum }, orderBy: { id: 'desc' } })
      }
      if (!activeBus) return res.status(404).json({ error: 'activeBus not found for busId' })
      resolvedActiveBusId = activeBus.id
    }

    const activeBusExists = await prisma.activeBus.findUnique({ where: { id: resolvedActiveBusId }, select: { id: true } })
    if (!activeBusExists) {
      return res.status(404).json({ error: 'activeBus not found' })
    }

    await advanceTrackingAfterAttendance(resolvedActiveBusId, studentIdNum)
    const state = await getTrackingState(resolvedActiveBusId)
    res.json({ ok: true, activeBusId: resolvedActiveBusId, state })
  } catch (err) {
    next(err)
  }
})

export default router
