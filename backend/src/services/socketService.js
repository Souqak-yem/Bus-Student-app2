import http from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return process.env.JWT_SECRET
}

function isNonEmptyId(value) {
  if (typeof value !== 'string') return false
  return value.trim().length > 0
}

export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('No token'))
  try {
    const decoded = jwt.verify(token, getJwtSecret())
    socket.user = decoded
    return next()
  } catch {
    return next(new Error('Invalid token'))
  }
}

export async function canAccessActiveBusRoom(user, activeBusId, client = prisma) {
  if (!user || !isNonEmptyId(activeBusId)) return false
  if (user.role === 'admin') return true

  const activeBus = await client.activeBus.findUnique({
    where: { id: activeBusId },
    select: { id: true, busId: true, driverId: true, operationId: true, tripType: true },
  })
  if (!activeBus) return false

  if (user.role === 'driver') {
    return activeBus.driverId === user.id
  }

  if (user.role === 'student') {
    if (!user.studentId) return false

    const busLoadMatch = await client.busLoad.findFirst({
      where: { activeBusId, studentId: user.studentId },
      select: { id: true },
    })
    if (busLoadMatch) return true

    const operation = await client.dailyOperation.findUnique({
      where: { id: activeBus.operationId },
      select: { operationDate: true },
    })
    if (!operation) return false

    const assignmentMatch = await client.assignment.findFirst({
      where: {
        busId: activeBus.busId,
        studentId: user.studentId,
        date: operation.operationDate,
        period: activeBus.tripType,
      },
      select: { id: true },
    })

    return Boolean(assignmentMatch)
  }

  return false
}

export async function canAccessDriverBusRoom(user, busId, client = prisma) {
  if (!user || !isNonEmptyId(busId)) return false
  if (user.role === 'admin') return true
  if (user.role !== 'driver') return false

  const bus = await client.bus.findUnique({
    where: { id: busId },
    select: { id: true, driverId: true },
  })
  if (!bus) return false

  if (bus.driverId === user.id) return true

  const activeBusMatch = await client.activeBus.findFirst({
    where: { busId, driverId: user.id },
    select: { id: true },
  })

  return Boolean(activeBusMatch)
}

export async function authorizeSocketRoomJoin(user, roomType, roomId, client = prisma) {
  if (!user) return false
  if (roomType === 'tracking') return canAccessActiveBusRoom(user, roomId, client)
  if (roomType === 'driver_bus') return canAccessDriverBusRoom(user, roomId, client)
  if (roomType === 'user') return user.id === roomId || user.studentId === roomId || user.role === 'admin'
  return false
}

let io = null

export function initSocketServer(app) {
  const server = http.createServer(app)
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : (process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://localhost:3000'])
  io = new Server(server, {
    cors: { origin: allowedOrigins.length ? allowedOrigins : false, methods: ['GET', 'POST'], credentials: true },
  })

  io.use(socketAuthMiddleware)

  io.on('connection', (socket) => {
    const { role, id, studentId } = socket.user

    socket.join(`user:${id}`)
    if (role === 'admin') {
      socket.join('admin:events')
    }

    socket.on('tracking:join', async (activeBusId) => {
      const allowed = await canAccessActiveBusRoom(socket.user, activeBusId)
      if (!allowed) {
        socket.emit('auth:error', { code: 'ROOM_ACCESS_DENIED', message: 'You do not have access to this bus tracking room.' })
        return
      }
      socket.join(`bus:${activeBusId}`)
    })

    socket.on('tracking:leave', (activeBusId) => {
      socket.leave(`bus:${activeBusId}`)
    })

    socket.on('notification:join', () => {
      socket.join(`user:${id}`)
    })

    socket.on('notification:get-missed', async (since) => {
      try {
        const { getUnreadCount } = await import('./notificationService.js')
        const sinceDate = new Date(since)
        const missed = await prisma.notification.findMany({
          where: { userId: id, createdAt: { gt: sinceDate } },
          orderBy: { createdAt: 'desc' },
        })
        const count = await getUnreadCount(id)
        socket.emit('notification:missed-list', { notifications: missed, unreadCount: count })
      } catch (e) { /* silent */ }
    })

    socket.on('driver_bus:join', async (busId) => {
      const allowed = await canAccessDriverBusRoom(socket.user, busId)
      if (!allowed) {
        socket.emit('auth:error', { code: 'ROOM_ACCESS_DENIED', message: 'You do not have access to this driver bus room.' })
        return
      }
      socket.join(`driver_bus:${busId}`)
    })

    socket.on('driver_bus:leave', (busId) => {
      socket.leave(`driver_bus:${busId}`)
    })

    socket.on('disconnect', () => {})
  })

  return server
}

export function getIO() {
  return io
}

export function broadcastTrackingUpdate(activeBusId, data) {
  if (!io) return
  const payload = { ...data, timestamp: new Date().toISOString() }
  try {
    // Debug log to help trace why students may not receive updates
    console.debug('[broadcastTrackingUpdate] emitting to', `bus:${activeBusId}`, 'payload keys:', Object.keys(payload))
  } catch (e) {}
  io.to(`bus:${activeBusId}`).emit('tracking:update', payload)
}

export function broadcastNotification(userId, notification) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification)
  }
}

export function broadcastUnreadCount(userId) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:unread-count')
  }
}

export function broadcastEmergencyReport(report) {
  if (io) {
    io.to('admin:events').emit('emergency:new-report', report)
  }
}

export function broadcastReportUpdate(driverId, update) {
  if (io) {
    io.to(`user:${driverId}`).emit('emergency:report-update', update)
  }
}

export function broadcastDriverOperationUpdate(busId, data) {
  if (!io) return
  const payload = { ...data, timestamp: new Date().toISOString() }
  io.to(`driver_bus:${busId}`).emit('driver:operation-update', payload)
}

export function broadcastDailyExceptionsUpdate(data) {
  if (!io) return
  const payload = { ...data, timestamp: new Date().toISOString() }
  io.to('admin:events').emit('dailyExceptions:update', payload)
}

export function broadcastStudentUpdate(studentId, data) {
  if (!io) return
  const payload = { ...data, timestamp: new Date().toISOString() }
  io.to(`user:${studentId}`).emit('student:update', payload)
}

export function broadcastNotificationRead(userId, notificationId) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:read', { id: notificationId })
  }
}

export function broadcastNotificationReadAll(userId) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:read-all')
  }
}

export function broadcastNotificationDeleted(userId, notificationId) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:deleted', { id: notificationId })
  }
}

export function broadcastNotificationDeletedAll(userId) {
  if (io) {
    io.to(`user:${userId}`).emit('notification:deleted-all')
  }
}

export async function notifyAndBroadcastToBus(busId, { type, title, message, priority, data, activeBusId }) {
  try {
    const { prisma } = await import('../lib/prisma.js')
    const { createAndBroadcast } = await import('./notificationService.js')

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const operation = await prisma.dailyOperation.findUnique({ where: { operationDate: today } })
    if (!operation) return

    const activeBus = activeBusId
      ? await prisma.activeBus.findUnique({ where: { id: activeBusId }, include: { driver: { select: { id: true } } } })
      : await prisma.activeBus.findFirst({ where: { operationId: operation.id, busId }, include: { driver: { select: { id: true } } } })

    if (activeBus?.driver?.id) {
      await createAndBroadcast({
        userId: activeBus.driver.id,
        type,
        title,
        message,
        priority: priority || 'WARNING',
        targetRoute: '/driver',
        dedupKey: `${type}_${activeBus.driver.id}`,
      })
    }

    broadcastDriverOperationUpdate(busId, { type, title, message, priority, ...data, timestamp: new Date().toISOString() })
  } catch (e) {
    // silent - notification is best-effort
  }
}

export async function notifyStudent({ userId, type, title, message, priority, data, targetRoute, dedupKey }) {
  try {
    const { createAndBroadcast } = await import('./notificationService.js')
    const notification = await createAndBroadcast({
      userId, type, title, message,
      priority: priority || 'INFO',
      targetRoute: targetRoute || '/student',
      data, dedupKey: dedupKey || `${type}_${userId}`,
    })
    broadcastStudentUpdate(userId, { type, title, message, priority, ...data, timestamp: new Date().toISOString() })
    return notification
  } catch (e) {
    // silent - best effort
  }
}

export async function notifyStudentsOnBus(busId, { type, title, message, priority, data }) {
  try {
    const { prisma } = await import('../lib/prisma.js')
    const { createAndBroadcast } = await import('./notificationService.js')

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const assignments = await prisma.assignment.findMany({
      where: { date: today, period: 'MORNING', busId },
      include: { student: { select: { id: true } } },
    })

    for (const a of assignments) {
      const userId = a.student.id
      await createAndBroadcast({
        userId, type, title, message,
        priority: priority || 'INFO',
        targetRoute: '/student',
        data, dedupKey: `${type}_${userId}`,
      })
      broadcastStudentUpdate(userId, { type, title, message, priority, ...data, timestamp: new Date().toISOString() })
    }
  } catch (e) {
    // silent - best effort
  }
}

export function broadcastReadinessUpdate(activeBusId, data) {
  if (!io) return
  const payload = { activeBusId, ...data, timestamp: new Date().toISOString() }
  io.to(`bus:${activeBusId}`).emit('readiness:update', payload)
  io.to('admin:events').emit('readiness:admin-update', payload)
}

export function broadcastBoardingTimerUpdate(activeBusId, data) {
  if (!io) return
  const payload = { activeBusId, ...data, timestamp: new Date().toISOString() }
  io.to(`bus:${activeBusId}`).emit('boarding-timer:update', payload)
  io.to('admin:events').emit('boarding-timer:admin-update', payload)
}

export function broadcastReturnReadinessStats(activeBusId, stats) {
  if (!io) return
  const payload = { activeBusId, stats, timestamp: new Date().toISOString() }
  io.to(`bus:${activeBusId}`).emit('readiness:stats', payload)
  io.to('admin:events').emit('readiness:admin-stats', payload)
}
