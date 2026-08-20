export const PRIORITY = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
}

export const NOTIFICATION_CONFIG = {
  // Operation
  operation_created: { priority: PRIORITY.INFO, icon: 'CalendarCheck', route: '/admin/operations/today' },
  morning_trip_started: { priority: PRIORITY.INFO, icon: 'Play', route: '/admin/operations/today' },
  morning_trip_completed: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/admin/operations/today' },
  return_trip_started: { priority: PRIORITY.INFO, icon: 'ArrowLeft', route: '/admin/operations/return' },
  return_trip_completed: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/admin/operations/return' },

  // Subscriptions
  subscription_request: { priority: PRIORITY.WARNING, icon: 'FileText', route: '/admin/subscriptions?tab=approvals' },
  subscription_approved: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student/subscriptions' },
  subscription_rejected: { priority: PRIORITY.WARNING, icon: 'Ban', route: '/student/subscriptions' },

  // Finance
  student_overdue: { priority: PRIORITY.WARNING, icon: 'DollarSign', route: '/admin/financial-control' },
  grace_period_started: { priority: PRIORITY.INFO, icon: 'Clock', route: '/admin/financial-control' },
  grace_period_ended: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/admin/financial-control' },
  student_suspended: { priority: PRIORITY.CRITICAL, icon: 'Ban', route: '/admin/financial-control' },
  student_reactivated: { priority: PRIORITY.INFO, icon: 'RefreshCw', route: '/admin/financial-control' },
  payment_reminder: { priority: PRIORITY.WARNING, icon: 'DollarSign', route: '/student/subscriptions' },
  subscription_expired: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/admin/financial-control' },
  subscription_expiring_soon: { priority: PRIORITY.WARNING, icon: 'Clock', route: '/admin/financial-control' },

  // Emergency
  emergency_breakdown: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/admin/emergency' },
  emergency_declared: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/admin/emergency' },
  emergency_transfer_completed: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/admin/emergency' },
  emergency_resolved: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/admin/emergency' },

  // Transfers
  transfer_requested: { priority: PRIORITY.WARNING, icon: 'ArrowRight', route: '/admin/control/transfers' },
  transfer_approved: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/admin/control/transfers' },

  // Return
  student_in_queue: { priority: PRIORITY.WARNING, icon: 'Users', route: '/admin/operations/return' },
  bus_full: { priority: PRIORITY.WARNING, icon: 'Bus', route: '/admin/operations/return' },
  student_unassigned: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/admin/operations/return' },

  // Cart
  cart_submitted: { priority: PRIORITY.WARNING, icon: 'ShoppingCart', route: '/admin/subscriptions?tab=approvals' },
  cart_rejected: { priority: PRIORITY.WARNING, icon: 'Ban', route: '/student/subscriptions' },

  // Student registration requests
  student_registration_request: { priority: PRIORITY.WARNING, icon: 'UserPlus', route: '/admin/student-requests' },

  // Password reset requests
  password_reset_request: { priority: PRIORITY.WARNING, icon: 'Lock', route: '/admin/manage/password-reset-requests' },

  // Emergency Transfer
  emergency_transfer: { priority: PRIORITY.CRITICAL, icon: 'ArrowRight', route: '/admin/emergency' },

  // Sheets
  weekly_sheets_created: { priority: PRIORITY.INFO, icon: 'FileText', route: '/admin/reports/weekly-sheets' },

  // Daily subscriptions - unassigned
  unassigned_daily_subscription: { priority: PRIORITY.WARNING, icon: 'AlertTriangle', route: '/admin/subscriptions/daily?tab=daily' },

  // Generic info (fallback for ad-hoc notifications)
  info: { priority: PRIORITY.INFO, icon: 'Bell', route: null },

  // Tracking
  tracking_next: { priority: PRIORITY.INFO, icon: 'Navigation', route: null },
  tracking_arrived: { priority: PRIORITY.INFO, icon: 'MapPin', route: null },
  bus_near: { priority: PRIORITY.INFO, icon: 'Bus', route: null },

  // Driver - Operation
  driver_student_added: { priority: PRIORITY.WARNING, icon: 'UserPlus', route: '/driver' },
  driver_student_removed: { priority: PRIORITY.WARNING, icon: 'UserMinus', route: '/driver' },
  driver_student_transferred_in: { priority: PRIORITY.WARNING, icon: 'ArrowRight', route: '/driver' },
  driver_student_transferred_out: { priority: PRIORITY.WARNING, icon: 'ArrowLeft', route: '/driver' },
  driver_all_transferred: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/driver' },
  driver_pickup_time_changed: { priority: PRIORITY.WARNING, icon: 'Clock', route: '/driver' },
  driver_order_changed: { priority: PRIORITY.WARNING, icon: 'ListOrdered', route: '/driver' },
  driver_bus_line_changed: { priority: PRIORITY.INFO, icon: 'MapPin', route: '/driver' },
  driver_bus_added: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/driver' },
  driver_bus_removed: { priority: PRIORITY.CRITICAL, icon: 'XCircle', route: '/driver' },
  driver_trip_cancelled: { priority: PRIORITY.CRITICAL, icon: 'Ban', route: '/driver' },
  driver_trip_started: { priority: PRIORITY.INFO, icon: 'Play', route: '/driver' },
  driver_trip_completed: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/driver' },
  driver_emergency_declared: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/driver' },
  driver_emergency_resolved: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/driver' },
  driver_bus_replaced: { priority: PRIORITY.CRITICAL, icon: 'RefreshCw', route: '/driver' },
  driver_return_student_added: { priority: PRIORITY.WARNING, icon: 'UserPlus', route: '/driver/return' },
  driver_return_student_removed: { priority: PRIORITY.WARNING, icon: 'UserMinus', route: '/driver/return' },
  driver_return_trip_ready: { priority: PRIORITY.INFO, icon: 'ArrowLeft', route: '/driver/return' },
  driver_password_changed: { priority: PRIORITY.INFO, icon: 'Lock', route: null },

  // Driver - Return
  driver_return_dispatched: { priority: PRIORITY.INFO, icon: 'ArrowLeft', route: '/driver/return' },
  driver_return_completed: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/driver/return' },
  driver_return_bus_removed: { priority: PRIORITY.CRITICAL, icon: 'XCircle', route: '/driver/return' },
  driver_student_dropped_off: { priority: PRIORITY.INFO, icon: 'MapPin', route: '/driver/return' },

  // 🔹 Student - Subscription
  student_subscription_requested: { priority: PRIORITY.INFO, icon: 'FileText', route: '/student/subscriptions' },
  student_subscription_approved: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student/subscriptions' },
  student_subscription_rejected: { priority: PRIORITY.WARNING, icon: 'Ban', route: '/student/subscriptions' },
  student_subscription_resubmission_requested: { priority: PRIORITY.WARNING, icon: 'RefreshCw', route: '/student/subscriptions' },
  student_subscription_reactivated: { priority: PRIORITY.INFO, icon: 'RefreshCw', route: '/student/subscriptions' },
  student_subscription_activated_with_trip: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student/subscriptions' },
  student_subscription_activated_suspended: { priority: PRIORITY.INFO, icon: 'Clock', route: '/student/subscriptions' },
  student_subscription_expiring_soon: { priority: PRIORITY.WARNING, icon: 'Clock', route: '/student/subscriptions' },
  student_subscription_expired: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/student/subscriptions' },
  student_payment_reminder: { priority: PRIORITY.WARNING, icon: 'DollarSign', route: '/student/subscriptions' },
  student_home_delivery_price: { priority: PRIORITY.INFO, icon: 'DollarSign', route: '/student/notifications' },
  student_grace_period_started: { priority: PRIORITY.INFO, icon: 'Clock', route: '/student/subscriptions' },
  student_grace_period_ended: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/student/subscriptions' },
  student_account_suspended: { priority: PRIORITY.CRITICAL, icon: 'Ban', route: '/student/subscriptions' },
  student_account_reactivated: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student/subscriptions' },

  // 🔹 Student - Daily Operation
  student_operation_created: { priority: PRIORITY.INFO, icon: 'CalendarCheck', route: '/student' },
  student_added_to_trip: { priority: PRIORITY.INFO, icon: 'UserPlus', route: '/student' },
  student_removed_from_trip: { priority: PRIORITY.WARNING, icon: 'UserMinus', route: '/student' },
  student_bus_changed: { priority: PRIORITY.WARNING, icon: 'Bus', route: '/student' },
  student_driver_changed: { priority: PRIORITY.WARNING, icon: 'Users', route: '/student' },
  student_pickup_time_changed: { priority: PRIORITY.INFO, icon: 'Clock', route: '/student' },
  student_pickup_location_changed: { priority: PRIORITY.INFO, icon: 'MapPin', route: '/student' },
  student_order_changed: { priority: PRIORITY.INFO, icon: 'ListOrdered', route: '/student' },

  // 🔹 Admin - Tracking
  student_late: { priority: PRIORITY.WARNING, icon: 'Clock', route: '/admin/operations/today' },

  // 🔹 Student - Tracking
  student_trip_started: { priority: PRIORITY.INFO, icon: 'Play', route: '/student' },
  student_bus_near: { priority: PRIORITY.INFO, icon: 'Bus', route: '/student' },
  student_attendance_marked: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student' },
  student_marked_absent: { priority: PRIORITY.WARNING, icon: 'XCircle', route: '/student' },
  student_arrived_university: { priority: PRIORITY.INFO, icon: 'MapPin', route: '/student' },
  student_return_trip_started: { priority: PRIORITY.INFO, icon: 'ArrowLeft', route: '/student' },
  student_loaded_for_return: { priority: PRIORITY.INFO, icon: 'UserCheck', route: '/student' },
  student_dropped_off: { priority: PRIORITY.INFO, icon: 'Home', route: '/student' },
  student_trip_ended: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student' },

  // 🔹 Student - Return Trip
  student_return_queue_added: { priority: PRIORITY.INFO, icon: 'Users', route: '/student' },
  student_return_assigned: { priority: PRIORITY.INFO, icon: 'Bus', route: '/student' },
  student_return_bus_changed: { priority: PRIORITY.WARNING, icon: 'RefreshCw', route: '/student' },
  student_return_bus_full: { priority: PRIORITY.WARNING, icon: 'AlertTriangle', route: '/student' },
  student_return_cancelled: { priority: PRIORITY.CRITICAL, icon: 'Ban', route: '/student' },
  student_return_queue_cancelled: { priority: PRIORITY.WARNING, icon: 'XCircle', route: '/student' },

  // 🔹 Student - Emergency
  student_emergency_breakdown: { priority: PRIORITY.CRITICAL, icon: 'AlertTriangle', route: '/student' },
  student_emergency_wait: { priority: PRIORITY.CRITICAL, icon: 'Clock', route: '/student' },
  student_emergency_transferred: { priority: PRIORITY.CRITICAL, icon: 'Bus', route: '/student' },
  student_emergency_meeting_point_changed: { priority: PRIORITY.CRITICAL, icon: 'MapPin', route: '/student' },
  student_emergency_resolved: { priority: PRIORITY.INFO, icon: 'CheckCircle', route: '/student' },

  // Default fallback
  default: { priority: PRIORITY.INFO, icon: 'Bell', route: null },
}

export function getNotificationDefaults(type) {
  return NOTIFICATION_CONFIG[type] || NOTIFICATION_CONFIG.default
}
