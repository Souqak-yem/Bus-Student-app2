import { io } from 'socket.io-client'

const SOCKET_URL = (
  import.meta.env.VITE_SOCKET_URL
  || 'https://bus-student-app2-production.up.railway.app'
).replace(/\/$/, '')
let socket = null
let reconnectCallbacks = []

export function getSocket() {
  return socket
}

export function connectSocket(token) {
  if (socket?.connected) return socket
  if (socket) {
    socket.auth = { token }
    socket.connect()
    console.debug('[socket] reconnecting to', SOCKET_URL)
    return socket
  }
  console.debug('[socket] connecting to', SOCKET_URL)
  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })
  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message)
  })
  socket.on('connect', () => {
    console.debug('[socket] connected', socket.id)
  })
  socket.on('reconnect', () => {
    console.debug('[socket] reconnected', socket.id)
    reconnectCallbacks.forEach(cb => cb())
  })
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  reconnectCallbacks = []
}

export function onReconnect(callback) {
  reconnectCallbacks.push(callback)
  return () => {
    reconnectCallbacks = reconnectCallbacks.filter(cb => cb !== callback)
  }
}

export function joinBusRoom(activeBusId) {
  if (socket) {
    socket.emit('tracking:join', activeBusId)
  }
}

export function leaveBusRoom(activeBusId) {
  if (socket) {
    socket.emit('tracking:leave', activeBusId)
  }
}

export function onTrackingUpdate(callback) {
  if (socket) {
    socket.on('tracking:update', callback)
  }
}

export function offTrackingUpdate(callback) {
  if (socket) {
    if (callback) socket.off('tracking:update', callback)
    else socket.off('tracking:update')
  }
}

export function onNotificationNew(callback) {
  if (socket) {
    socket.on('notification:new', callback)
  }
}

export function offNotificationNew(callback) {
  if (socket) {
    if (callback) socket.off('notification:new', callback)
    else socket.off('notification:new')
  }
}

export function joinNotificationRoom() {
  if (socket) {
    socket.emit('notification:join')
  }
}

export function onEmergencyReport(callback) {
  if (socket) {
    socket.on('emergency:new-report', callback)
  }
}

export function offEmergencyReport(callback) {
  if (socket) {
    if (callback) socket.off('emergency:new-report', callback)
    else socket.off('emergency:new-report')
  }
}

export function onEmergencyReportUpdate(callback) {
  if (socket) {
    socket.on('emergency:report-update', callback)
  }
}

export function offEmergencyReportUpdate(callback) {
  if (socket) {
    if (callback) socket.off('emergency:report-update', callback)
    else socket.off('emergency:report-update')
  }
}

export function onUnreadCount(callback) {
  if (socket) {
    socket.on('notification:unread-count', callback)
  }
}

export function offUnreadCount(callback) {
  if (socket) {
    if (callback) socket.off('notification:unread-count', callback)
    else socket.off('notification:unread-count')
  }
}

export function onNotificationRead(callback) {
  if (socket) {
    socket.on('notification:read', callback)
  }
}

export function offNotificationRead(callback) {
  if (socket) {
    if (callback) socket.off('notification:read', callback)
    else socket.off('notification:read')
  }
}

export function onNotificationReadAll(callback) {
  if (socket) {
    socket.on('notification:read-all', callback)
  }
}

export function offNotificationReadAll(callback) {
  if (socket) {
    if (callback) socket.off('notification:read-all', callback)
    else socket.off('notification:read-all')
  }
}

export function onNotificationDeleted(callback) {
  if (socket) {
    socket.on('notification:deleted', callback)
  }
}

export function offNotificationDeleted(callback) {
  if (socket) {
    if (callback) socket.off('notification:deleted', callback)
    else socket.off('notification:deleted')
  }
}

export function onNotificationDeletedAll(callback) {
  if (socket) {
    socket.on('notification:deleted-all', callback)
  }
}

export function offNotificationDeletedAll(callback) {
  if (socket) {
    if (callback) socket.off('notification:deleted-all', callback)
    else socket.off('notification:deleted-all')
  }
}

export function onMissedNotifications(callback) {
  if (socket) {
    socket.on('notification:missed-list', callback)
  }
}

export function offMissedNotifications(callback) {
  if (socket) {
    if (callback) socket.off('notification:missed-list', callback)
    else socket.off('notification:missed-list')
  }
}

export function emitGetMissedNotifications(since) {
  if (socket) {
    socket.emit('notification:get-missed', since)
  }
}

export function joinDriverBusRoom(busId) {
  if (socket) {
    socket.emit('driver_bus:join', busId)
  }
}

export function leaveDriverBusRoom(busId) {
  if (socket) {
    socket.emit('driver_bus:leave', busId)
  }
}

export function onDriverOperationUpdate(callback) {
  if (socket) {
    socket.off('driver:operation-update')
    socket.on('driver:operation-update', callback)
  }
}

export function offDriverOperationUpdate() {
  if (socket) {
    socket.off('driver:operation-update')
  }
}

export function onStudentUpdate(callback) {
  if (socket) {
    socket.off('student:update')
    socket.on('student:update', callback)
  }
}

export function offStudentUpdate() {
  if (socket) {
    socket.off('student:update')
  }
}

export function onDailyExceptionsUpdate(callback) {
  if (socket) {
    socket.off('dailyExceptions:update')
    socket.on('dailyExceptions:update', callback)
  }
}

export function offDailyExceptionsUpdate() {
  if (socket) {
    socket.off('dailyExceptions:update')
  }
}

export function onReadinessUpdate(callback) {
  if (socket) {
    socket.off('readiness:update')
    socket.on('readiness:update', callback)
  }
}

export function offReadinessUpdate() {
  if (socket) {
    socket.off('readiness:update')
  }
}

export function onAdminReadinessUpdate(callback) {
  if (socket) {
    socket.off('readiness:admin-update')
    socket.on('readiness:admin-update', callback)
  }
}

export function offAdminReadinessUpdate() {
  if (socket) {
    socket.off('readiness:admin-update')
  }
}

export function onBoardingTimerUpdate(callback) {
  if (socket) {
    socket.off('boarding-timer:update')
    socket.on('boarding-timer:update', callback)
  }
}

export function offBoardingTimerUpdate() {
  if (socket) {
    socket.off('boarding-timer:update')
  }
}

export function onAdminBoardingTimerUpdate(callback) {
  if (socket) {
    socket.off('boarding-timer:admin-update')
    socket.on('boarding-timer:admin-update', callback)
  }
}

export function offAdminBoardingTimerUpdate() {
  if (socket) {
    socket.off('boarding-timer:admin-update')
  }
}

export function onReadinessStats(callback) {
  if (socket) {
    socket.off('readiness:stats')
    socket.on('readiness:stats', callback)
  }
}

export function offReadinessStats() {
  if (socket) {
    socket.off('readiness:stats')
  }
}

export function onAdminReadinessStats(callback) {
  if (socket) {
    socket.off('readiness:admin-stats')
    socket.on('readiness:admin-stats', callback)
  }
}

export function offAdminReadinessStats() {
  if (socket) {
    socket.off('readiness:admin-stats')
  }
}
