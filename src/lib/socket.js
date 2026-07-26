import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
let socket = null
let reconnectCallbacks = []

export function getSocket() {
  return socket
}

export function connectSocket(token) {
  if (socket?.connected) return socket
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
  socket.on('reconnect', () => {
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
  if (socket?.connected) {
    socket.emit('tracking:join', activeBusId)
  }
}

export function leaveBusRoom(activeBusId) {
  if (socket?.connected) {
    socket.emit('tracking:leave', activeBusId)
  }
}

export function onTrackingUpdate(callback) {
  if (socket) {
    socket.off('tracking:update')
    socket.on('tracking:update', callback)
  }
}

export function offTrackingUpdate() {
  if (socket) {
    socket.off('tracking:update')
  }
}

export function onNotificationNew(callback) {
  if (socket) {
    socket.off('notification:new')
    socket.on('notification:new', callback)
  }
}

export function offNotificationNew() {
  if (socket) {
    socket.off('notification:new')
  }
}

export function joinNotificationRoom() {
  if (socket?.connected) {
    socket.emit('notification:join')
  }
}

export function onEmergencyReport(callback) {
  if (socket) {
    socket.off('emergency:new-report')
    socket.on('emergency:new-report', callback)
  }
}

export function offEmergencyReport() {
  if (socket) {
    socket.off('emergency:new-report')
  }
}

export function onEmergencyReportUpdate(callback) {
  if (socket) {
    socket.off('emergency:report-update')
    socket.on('emergency:report-update', callback)
  }
}

export function offEmergencyReportUpdate() {
  if (socket) {
    socket.off('emergency:report-update')
  }
}

export function onUnreadCount(callback) {
  if (socket) {
    socket.off('notification:unread-count')
    socket.on('notification:unread-count', callback)
  }
}

export function offUnreadCount() {
  if (socket) {
    socket.off('notification:unread-count')
  }
}

export function onNotificationRead(callback) {
  if (socket) {
    socket.off('notification:read')
    socket.on('notification:read', callback)
  }
}

export function offNotificationRead() {
  if (socket) {
    socket.off('notification:read')
  }
}

export function onNotificationReadAll(callback) {
  if (socket) {
    socket.off('notification:read-all')
    socket.on('notification:read-all', callback)
  }
}

export function offNotificationReadAll() {
  if (socket) {
    socket.off('notification:read-all')
  }
}

export function onNotificationDeleted(callback) {
  if (socket) {
    socket.off('notification:deleted')
    socket.on('notification:deleted', callback)
  }
}

export function offNotificationDeleted() {
  if (socket) {
    socket.off('notification:deleted')
  }
}

export function onNotificationDeletedAll(callback) {
  if (socket) {
    socket.off('notification:deleted-all')
    socket.on('notification:deleted-all', callback)
  }
}

export function offNotificationDeletedAll() {
  if (socket) {
    socket.off('notification:deleted-all')
  }
}

export function onMissedNotifications(callback) {
  if (socket) {
    socket.off('notification:missed-list')
    socket.on('notification:missed-list', callback)
  }
}

export function offMissedNotifications() {
  if (socket) {
    socket.off('notification:missed-list')
  }
}

export function emitGetMissedNotifications(since) {
  if (socket?.connected) {
    socket.emit('notification:get-missed', since)
  }
}

export function joinDriverBusRoom(busId) {
  if (socket?.connected) {
    socket.emit('driver_bus:join', busId)
  }
}

export function leaveDriverBusRoom(busId) {
  if (socket?.connected) {
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

export function onSaturdayUpdate(callback) {
  if (socket) {
    socket.off('saturday:update')
    socket.on('saturday:update', callback)
  }
}

export function offSaturdayUpdate() {
  if (socket) {
    socket.off('saturday:update')
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
