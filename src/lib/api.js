const defaultApiUrl = (() => {
  if (typeof window !== 'undefined' && window.location.origin) {
    return `${window.location.origin}/api`
  }

  return '/api'
})()

const API_URL = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, '')

function getToken() {
  return localStorage.getItem("token");
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers, cache: 'no-store' });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || "حدث خطأ" };
  }

  if (res.status === 401) {
    if (endpoint !== "/auth/login") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new Error(data.error || "غير مصرح به");
  }

  if (!res.ok) throw new Error(data.error || "حدث خطأ");
  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) =>
    request(endpoint, { method: "POST", body: JSON.stringify(body) }),
  put: (endpoint, body) =>
    request(endpoint, { method: "PUT", body: JSON.stringify(body) }),
  patch: (endpoint, body) =>
    request(endpoint, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: "DELETE" }),

  auth: {
    login: (username, password) =>
      api.post("/auth/login", { username, password }),
    forgotPassword: (data) => api.post('/auth/forgot-password', data),
    me: () => api.get("/auth/me"),
    changePassword: (currentPassword, newPassword) =>
      api.post("/auth/change-password", { currentPassword, newPassword }),
  },

  users: {
    list: (params) => api.get(`/users?${new URLSearchParams(params)}`),
    get: (id) => api.get(`/users/${id}`),
    create: (data) => api.post("/users", data),
    update: (id, data) => api.put(`/users/${id}`, data),
    delete: (id) => api.delete(`/users/${id}`),
    resetPassword: (id) => api.post(`/users/${id}/reset-password`),
    forceChangePassword: (id) => api.post(`/users/${id}/force-change-password`),
    generateUsername: (id) => api.post(`/users/${id}/generate-username`),
    updateStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  },

  students: {
    list: (params) => api.get(`/students?${new URLSearchParams(params)}`),
    get: (id) => api.get(`/students/${id}`),
    create: (data) => api.post("/students", data),
    update: (id, data) => api.put(`/students/${id}`, data),
    delete: (id) => api.delete(`/students/${id}`),
  },

  buses: {
    list: (params) => api.get(`/buses?${new URLSearchParams(params)}`),
    get: (id) => api.get(`/buses/${id}`),
    create: (data) => api.post("/buses", data),
    update: (id, data) => api.put(`/buses/${id}`, data),
    delete: (id) => api.delete(`/buses/${id}`),
  },

  assignments: {
    list: (params) => api.get(`/assignments?${new URLSearchParams(params)}`),
    get: (id) => api.get(`/assignments/${id}`),
    create: (data) => api.post("/assignments", data),
    createBatch: (data) => api.post("/assignments/batch", data),
    update: (id, data) => api.put(`/assignments/${id}`, data),
    templateStudents: (busId, date) =>
      api.get(
        `/assignments/bus/${busId}/template-students?${new URLSearchParams({ date })}`,
      ),
    delete: (id) => api.delete(`/assignments/${id}`),
  },

  subscriptions: {
    list: (params) => api.get(`/subscriptions?${new URLSearchParams(params)}`),
    get: (id) => api.get(`/subscriptions/${id}`),
  },

  attendance: {
    list: (params) => api.get(`/attendance?${new URLSearchParams(params)}`),
    today: (busId) => api.get(`/attendance/today/${busId}`),
    student: (studentId) => api.get(`/attendance/student/${studentId}`),
    mark: (data) => api.post("/attendance", data),
    batch: (records) => api.post("/attendance/batch", { records }),
    startMorning: (busId) => api.post(`/attendance/start-morning/${busId}`),
    completeMorning: (busId) => api.post(`/attendance/complete-morning/${busId}`),
  },

  dashboard: {
    stats: () => api.get("/dashboard/stats"),
    recentPayments: () => api.get("/dashboard/recent-payments"),
  },

  return: {
    operation: {
      get: () => api.get('/return/operation'),
      create: (data) => api.post('/return/operation', data),
      close: (id) => api.patch(`/return/operation/${id}/close`),
    },
    queue: {
      list: () => api.get('/return/queue'),
      add: (studentId, notes) => api.post('/return/queue', { studentId, notes }),
      remove: (id) => api.delete(`/return/queue/${id}`),
    },
    activeBuses: {
      list: () => api.get('/return/active-buses'),
      add: (busId) => api.post('/return/active-buses', { busId }),
      updateStatus: (id, status) => api.patch(`/return/active-buses/${id}/status`, { status }),
      remove: (id) => api.delete(`/return/active-buses/${id}`),
    },
    loads: {
      add: (activeBusId, studentId, exceptionReason) =>
        api.post('/return/load', { activeBusId, studentId, exceptionReason }),
      remove: (activeBusId, studentId) =>
        api.delete(`/return/load/${activeBusId}/${studentId}`),
      transfer: (studentId, fromActiveBusId, toActiveBusId, exceptionReason) =>
        api.post('/return/load/transfer', { studentId, fromActiveBusId, toActiveBusId, exceptionReason }),
      dropoff: (activeBusId, studentId) =>
        api.patch(`/return/load/${activeBusId}/${studentId}/dropoff`, {}),
    },
    reorder: (activeBusId, studentIds) =>
      api.post(`/return/active-buses/${activeBusId}/reorder`, { studentIds }),
    dispatch: (activeBusId, line, studentIds) =>
      api.post(`/return/active-buses/${activeBusId}/dispatch`, { line, studentIds }),
    dispatchByDriver: (activeBusId) =>
      api.post(`/return/active-buses/${activeBusId}/dispatch-by-driver`, {}),
    complete: (activeBusId) =>
      api.patch(`/return/active-buses/${activeBusId}/complete`, {}),
    departed: () => api.get('/return/departed'),
  },

  busStudents: {
    list: (busId) => api.get(`/bus-students/bus/${busId}`),
    listAll: () => api.get('/bus-students/all'),
    add: (busId, studentId, pickupTime) => api.post('/bus-students', { busId, studentId, pickupTime }),
    remove: (busId, studentId) =>
      api.delete(`/bus-students/${busId}/${studentId}`),
    update: (busId, studentId, data) =>
      api.put(`/bus-students/${busId}/${studentId}`, data),
    transfer: (studentId, fromBusId, toBusId, pickupTime) =>
      api.post('/bus-students/transfer', { studentId, fromBusId, toBusId, pickupTime }),
    bulkPickupTime: (busId, adjustment, minutes) =>
      api.patch(`/bus-students/bulk-pickup-time/${busId}`, { adjustment, minutes }),
  },

  tempTransfers: {
    active: () => api.get('/temp-transfers/active'),
    forBus: (busId) => api.get(`/temp-transfers/bus/${busId}`),
    create: (studentId, fromBusId, toBusId, durationDays) =>
      api.post('/temp-transfers', { studentId, fromBusId, toBusId, durationDays }),
    cancel: (id) => api.delete(`/temp-transfers/${id}`),
    expire: () => api.post('/temp-transfers/expire'),
  },

  destinations: {
    list: () => api.get("/destinations"),
    active: () => api.get("/destinations/active"),
    get: (id) => api.get(`/destinations/${id}`),
    create: (data) => api.post("/destinations", data),
    update: (id, data) => api.put(`/destinations/${id}`, data),
    delete: (id) => api.delete(`/destinations/${id}`),
  },

  pricing: {
    list: () => api.get("/pricing"),
    all: () => api.get("/pricing/all"),
    zones: () => api.get("/pricing/zones"),
    zone: (id) => api.get(`/pricing/zones/${id}`),
    create: (data) => api.post("/pricing", data),
    update: (id, data) => api.put(`/pricing/${id}`, data),
    updateZone: (id, data) => api.put(`/pricing/zones/${id}`, data),
    delete: (id) => api.delete(`/pricing/${id}`),
    copy: (sourceZoneId, targetZoneId) =>
      api.post("/pricing/copy", { sourceZoneId, targetZoneId }),
    getPrice: (zoneId, plan) =>
      api.get(`/pricing/price?${new URLSearchParams({ zoneId, plan })}`),
    calculate: (campaignId) => api.get(`/pricing/calculate?campaignId=${campaignId}`),
  },

  campaigns: {
    list: () => api.get("/campaigns"),
    active: () => api.get("/campaigns/active"),
    create: (data) => api.post("/campaigns", data),
    update: (id, data) => api.put(`/campaigns/${id}`, data),
    delete: (id) => api.delete(`/campaigns/${id}`),
  },

  enrollments: {
    list: (params) => api.get(`/enrollments?${new URLSearchParams(params)}`),
    create: (data) => api.post("/enrollments", data),
    approve: (id) => api.patch(`/enrollments/${id}/approve`, {}),
    reject: (id, reason) => api.patch(`/enrollments/${id}/reject`, { reason }),
    delete: (id) => api.delete(`/enrollments/${id}`),
  },

  approvals: {
    list: () => api.get('/approvals'),
    approveSubscription: (id, data) => api.post(`/approvals/subscriptions/${id}/approve`, data || {}),
    rejectSubscription: (id, reason) => api.post(`/approvals/subscriptions/${id}/reject`, { reason }),
    addSubscriptionNow: (id, busId) => api.post(`/approvals/subscriptions/${id}/add-now`, { busId }),
  },

  transfers: {
    list: (params) => api.get(`/transfers?${new URLSearchParams(params)}`),
    create: (data) => api.post("/transfers", data),
    cancel: (id) => api.delete(`/transfers/${id}`),
  },

  audit: {
    list: (params) => api.get(`/audit?${new URLSearchParams(params)}`),
  },

  sheets: {
    bus: (busId) => api.get(`/sheets/bus/${busId}`),
  },

  operations: {
    generate: (busIds) => api.post('/operations/generate', { busIds }),
    getToday: () => api.get('/operations/today'),
    getAvailableBuses: () => api.get('/operations/today/available-buses'),
    getBusDetail: (busId) => api.get(`/operations/today/bus/${busId}`),
    updateBusLine: (busId, line) => api.patch(`/operations/today/bus/${busId}/line`, { line }),
    addStudent: (busId, studentId, pickupTime) => api.post(`/operations/today/bus/${busId}/assignments`, { studentId, pickupTime }),
    removeStudent: (busId, assignmentId) => api.delete(`/operations/today/bus/${busId}/assignments/${assignmentId}`),
    updateAssignment: (busId, assignmentId, data) => api.put(`/operations/today/bus/${busId}/assignments/${assignmentId}`, data),
    updateStatus: (id, status) =>
      api.patch(`/assignments/${id}/status`, { status }),
    addBuses: (busIds) => api.post('/operations/today/add-buses', { busIds }),
    removeBus: (busId) => api.delete(`/operations/today/bus/${busId}`),
    transferStudent: (fromBusId, toBusId, studentId) =>
      api.post(`/operations/today/bus/${fromBusId}/transfer`, { toBusId, studentId }),
    transferAllStudents: (fromBusId, toBusId) =>
      api.post(`/operations/today/bus/${fromBusId}/transfer-all`, { toBusId }),
    bulkPickupTime: (busId, adjustment, minutes) =>
      api.patch(`/operations/today/bus/${busId}/bulk-pickup-time`, { adjustment, minutes }),
    completeMorning: (busId) =>
      api.post(`/operations/today/bus/${busId}/complete-morning`),
    cancelTrip: (busId) =>
      api.post(`/operations/today/bus/${busId}/cancel`),
    close: () => api.post('/operations/today/close'),
    getHistory: () => api.get("/operations/history"),
  },

  tracking: {
    get: (activeBusId) => api.get(`/tracking/${activeBusId}`),
    skip: (activeBusId, studentId) => api.post('/tracking/skip', { activeBusId, studentId }),
    unskip: (activeBusId, studentId) => api.post('/tracking/unskip', { activeBusId, studentId }),
  },

  emergency: {
    buses: () => api.get("/emergency/buses"),
    declareBreakdown: (busId, reason) => api.post("/emergency/breakdown", { busId, reason }),
    autoTransfer: (fromBusId, toBusIds, reason) => api.post("/emergency/auto-transfer", { fromBusId, toBusIds, reason }),
    manualTransfer: (fromBusId, transfers, reason) => api.post("/emergency/manual-transfer", { fromBusId, transfers, reason }),
    replaceBus: (fromBusId, toBusId, reason) => api.post("/emergency/replace-bus", { fromBusId, toBusId, reason }),
    logs: () => api.get("/emergency/logs"),
    // V2: Emergency Reports
    createReport: (busId, reason, notes) => api.post("/emergency/report", { busId, reason, notes }),
    getPendingReports: () => api.get("/emergency/reports/pending"),
    approveReport: (id) => api.post(`/emergency/reports/${id}/approve`),
    rejectReport: (id, rejectionReason) => api.post(`/emergency/reports/${id}/reject`, { rejectionReason }),
    getDriverReport: (busId) => api.get(`/emergency/report/${busId}`),
  },

  weeklySheets: {
    generate: (weekStart) => api.post("/weekly-sheets/generate", { weekStart }),
    getForWeek: (weekStart) => api.get(`/weekly-sheets/week/${weekStart}`),
    get: (id) => api.get(`/weekly-sheets/${id}`),
    delete: (id) => api.delete(`/weekly-sheets/${id}`),
    getQR: (id) => api.get(`/weekly-sheets/${id}/qr`),
    getVersions: (id) => api.get(`/weekly-sheets/${id}/versions`),
    archiveSearch: (params) =>
      api.get(`/weekly-sheets/archive/search?${new URLSearchParams(params)}`),
  },

  cart: {
    get: () => api.get('/student/cart'),
    addItem: (data) => api.post('/student/cart/items', data),
    removeItem: (itemId) => api.delete(`/student/cart/items/${itemId}`),
    submit: (receiptImage, depositReference) => api.post('/student/cart/submit', { receiptImage, depositReference }),
    approvals: {
      list: () => api.get('/approvals/carts'),
      get: (id) => api.get(`/approvals/carts/${id}`),
      approve: (id) => api.post(`/approvals/carts/${id}/approve`),
      reject: (id, reason) => api.post(`/approvals/carts/${id}/reject`, { reason }),
    },
  },

  studentPortal: {
    getDashboard: () => api.get("/student-portal/dashboard"),
    getAssignments: () => api.get("/student-portal/assignments"),
    getSubscriptions: () => api.get("/student-portal/subscriptions"),
    getWeeklySchedule: () => api.get("/student-portal/weekly-schedule"),
    getPricing: () => api.get("/student-portal/pricing"),
    joinReturnQueue: () => api.post("/student-portal/return-queue/join"),
    notifyNext: () => api.post("/student-portal/notify-next"),
    register: (data) => api.post("/student-portal/register", data),
    getRegistrationData: () => api.get("/student-portal/registration-data"),
    requests: (params) => api.get(`/student-portal/requests?${new URLSearchParams(params)}`),
    approveRequest: (id, data) => api.post(`/student-portal/requests/${id}/approve`, data),
    rejectRequest: (id, reason) => api.post(`/student-portal/requests/${id}/reject`, { reason }),
    subscriptionRequest: (data) => api.post("/student-portal/subscription-request", data),
    campaignPrice: (campaignId) => api.get(`/student-portal/campaign-price/${campaignId}`),
  },

  financial: {
    dashboard: () => api.get("/financial/dashboard"),
    students: (params) => api.get(`/financial/students?${new URLSearchParams(params)}`),
    detail: (studentId) => api.get(`/financial/students/${studentId}`),
    suspend: (studentId, reason) => api.post(`/financial/students/${studentId}/suspend`, { reason }),
    reactivate: (studentId) => api.post(`/financial/students/${studentId}/reactivate`),
    grantGrace: (studentId, endDate, reason) => api.post(`/financial/students/${studentId}/grace-period`, { endDate, reason }),
    cancelGrace: (studentId) => api.post(`/financial/students/${studentId}/cancel-grace-period`),
    sendReminder: (studentId) => api.post(`/financial/students/${studentId}/send-reminder`),
  },

  notifications: {
    list: (params) => api.get(`/notifications${params ? `?${new URLSearchParams(params)}` : ''}`),
    unreadCount: () => api.get("/notifications/unread-count"),
    markRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllRead: () => api.patch("/notifications/read-all"),
    deleteNotification: (id) => api.delete(`/notifications/${id}`),
    deleteAll: () => api.delete("/notifications"),
    checkUnassignedDaily: () => api.post("/notifications/check-unassigned-daily"),
  },

  messageTemplates: {
    list: () => api.get("/message-templates"),
  },

  admin: {
    resetData: () => api.post("/admin/reset-data"),
    passwordResetRequests: {
      list: () => api.get('/admin/password-reset-requests'),
      approve: (id) => api.post(`/admin/password-reset-requests/${id}/approve`, {}),
      reject: (id, reason) => api.post(`/admin/password-reset-requests/${id}/reject`, { reason }),
    },
  },

  dailyExceptions: {
    get: () => api.get("/daily-exceptions"),
  },

  dailySubscriptions: {
    manage: () => api.get("/daily-subscriptions/manage"),
  },

  push: {
    vapidKey: () => api.get("/push/vapid-public-key"),
    subscribe: (subscription, userAgent) => api.post("/push/subscribe", { subscription, userAgent }),
    unsubscribe: (endpoint) => api.post("/push/unsubscribe", { endpoint }),
  },

  busStudentOrder: {
    get: (busId, date) =>
      api.get(`/bus-student-order/bus/${busId}${date ? `?date=${date}` : ""}`),
    reorder: (busId, studentIds, isTemporary, saveAsDefault) =>
      api.post(`/bus-student-order/bus/${busId}/reorder`, {
        studentIds,
        isTemporary,
        saveAsDefault,
      }),
  },

  returnReadiness: {
    settings: {
      getDefaultBoardingMinutes: () => api.get('/return-readiness/settings/default-boarding-minutes'),
      setDefaultBoardingMinutes: (minutes) => api.post('/return-readiness/settings/default-boarding-minutes', { minutes }),
      get: (key) => api.get(`/return-readiness/settings/${key}`),
      set: (key, value, valueType, description) => api.put(`/return-readiness/settings/${key}`, { value, valueType, description }),
    },
    student: {
      dashboard: () => api.get('/return-readiness/student/dashboard'),
      ready: (activeBusId) => api.post('/return-readiness/student/ready', { activeBusId }),
      delayed: (activeBusId, delayMinutes, delayReason) => api.post('/return-readiness/student/delayed', { activeBusId, delayMinutes, delayReason }),
      arrived: (activeBusId) => api.post('/return-readiness/student/arrived', { activeBusId }),
    },
    driver: {
      checklist: () => api.get('/return-readiness/driver/checklist'),
      onBoard: (activeBusId, studentId) => api.post('/return-readiness/driver/on-board', { activeBusId, studentId }),
      onBoardBatch: (activeBusId, studentIds) => api.post('/return-readiness/driver/on-board/batch', { activeBusId, studentIds }),
      startTimer: (activeBusId) => api.post(`/return-readiness/driver/start-timer/${activeBusId}`),
      stopTimer: (activeBusId) => api.post(`/return-readiness/driver/stop-timer/${activeBusId}`),
    },
    admin: {
      startTimer: (activeBusId) => api.post(`/return-readiness/admin/start-timer/${activeBusId}`),
      stopTimer: (activeBusId) => api.post(`/return-readiness/admin/stop-timer/${activeBusId}`),
      tick: () => api.post('/return-readiness/admin/tick'),
      stats: (activeBusId) => api.get(`/return-readiness/admin/stats/${activeBusId}`),
      activeBusesReadiness: () => api.get('/return-readiness/admin/active-buses-readiness'),
      announceAssign: (activeBusId, studentId) => api.post('/return-readiness/admin/load-assign-announce', { activeBusId, studentId }),
    },
  },
};
