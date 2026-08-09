import express from 'express'
import { prisma } from '../lib/prisma.js'
import { getLocalDate } from '../utils/dateUtils.js'
import { advanceTrackingAfterAttendance, getTrackingState } from '../services/trackingService.js'

const router = express.Router()

// Temporary debug endpoint (UNPROTECTED) - triggers the attendance->tracking broadcast flow.
// Query params: studentId (required), activeBusId OR busId (one required)
router.get('/broadcast-attendance', async (req, res, next) => {
  try {
    const { studentId, activeBusId, busId } = req.query
    if (!studentId) return res.status(400).json({ error: 'studentId is required' })

    let resolvedActiveBusId = activeBusId
    if (!resolvedActiveBusId) {
      if (!busId) return res.status(400).json({ error: 'either activeBusId or busId is required' })
      const today = getLocalDate()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      let activeBus = await prisma.activeBus.findFirst({
        where: { busId, operation: { operationDate: { gte: today, lt: tomorrow } } },
        orderBy: { id: 'desc' },
      })
      if (!activeBus) {
        activeBus = await prisma.activeBus.findFirst({ where: { busId }, orderBy: { id: 'desc' } })
      }
      if (!activeBus) return res.status(404).json({ error: 'activeBus not found for busId' })
      resolvedActiveBusId = activeBus.id
    }

    await advanceTrackingAfterAttendance(resolvedActiveBusId, Number(studentId))
    const state = await getTrackingState(resolvedActiveBusId)
    res.json({ ok: true, activeBusId: resolvedActiveBusId, state })
  } catch (err) {
    next(err)
  }
})

export default router
