export const ADMIN_PAGE_CATALOG = [
  { key: 'dashboard', label: 'لوحة التحكم', path: '/admin' },
  { key: 'studentRequests', label: 'طلبات التسجيل', path: '/admin/student-requests' },
  { key: 'students', label: 'الطلاب', path: '/admin/students' },
  { key: 'buses', label: 'الباصات', path: '/admin/buses' },
  { key: 'operations', label: 'تشغيل اليوم', path: '/admin/operations/today' },
  { key: 'emergency', label: 'مركز الطوارئ', path: '/admin/emergency' },
  { key: 'destinations', label: 'الوجهات', path: '/admin/destinations' },
  { key: 'subscriptions', label: 'الاشتراكات', path: '/admin/subscriptions' },
  { key: 'dailySubscriptions', label: 'إدارة اليومي', path: '/admin/subscriptions/daily' },
  { key: 'financialControl', label: 'الإدارة المالية', path: '/admin/financial-control' },
  { key: 'reports', label: 'الكشوف الأسبوعية', path: '/admin/reports/weekly-sheets' },
  { key: 'manageUsers', label: 'إدارة المستخدمين', path: '/admin/manage/users' },
  { key: 'manageSettings', label: 'الإعدادات', path: '/admin/manage/settings' },
  { key: 'manageSystem', label: 'إدارة النظام', path: '/admin/manage/system' },
  { key: 'controlTransfers', label: 'التحويلات', path: '/admin/control/transfers' },
  { key: 'controlAudit', label: 'التدقيق', path: '/admin/control/audit' },
]

const PATH_TO_KEY = {
  '/admin': 'dashboard',
  '/admin/student-requests': 'studentRequests',
  '/admin/students': 'students',
  '/admin/buses': 'buses',
  '/admin/operations': 'operations',
  '/admin/operations/today': 'operations',
  '/admin/operations/return': 'operations',
  '/admin/emergency': 'emergency',
  '/admin/destinations': 'destinations',
  '/admin/subscriptions': 'subscriptions',
  '/admin/subscriptions/daily': 'dailySubscriptions',
  '/admin/financial-control': 'financialControl',
  '/admin/reports': 'reports',
  '/admin/reports/weekly-sheets': 'reports',
  '/admin/manage/users': 'manageUsers',
  '/admin/manage/settings': 'manageSettings',
  '/admin/manage/system': 'manageSystem',
  '/admin/control/transfers': 'controlTransfers',
  '/admin/control/audit': 'controlAudit',
}

export function normalizeAdminPermissions(rawPermissions) {
  if (!Array.isArray(rawPermissions)) return []
  return [...new Set(rawPermissions
    .filter(Boolean)
    .map(value => String(value).trim())
    .filter(Boolean))]
}

export function normalizeAdminPagePath(pagePath) {
  if (!pagePath) return '/admin'
  return String(pagePath).split('?')[0].split('#')[0] || '/admin'
}

export function getFirstAllowedAdminPath(user) {
  if (!user || user.role !== 'admin') return '/admin'

  const hasExplicitPermissions = Object.prototype.hasOwnProperty.call(user, 'adminPermissions')
  const permissions = normalizeAdminPermissions(user.adminPermissions)

  if (!hasExplicitPermissions || !Array.isArray(user.adminPermissions) || permissions.length === 0) {
    return '/admin'
  }

  const firstAllowed = ADMIN_PAGE_CATALOG.find(page => permissions.includes(page.key))
  return firstAllowed ? firstAllowed.path : '/admin'
}

export function canAccessAdminPage(user, pagePathOrKey) {
  if (!user) return false

  const userRole = user.role || 'admin'
  if (userRole !== 'admin') return false

  const hasExplicitPermissions = Object.prototype.hasOwnProperty.call(user, 'adminPermissions')
  const permissions = normalizeAdminPermissions(user.adminPermissions)

  if (!hasExplicitPermissions || !Array.isArray(user.adminPermissions)) {
    return true
  }

  if (permissions.length === 0) {
    return false
  }

  const normalizedPath = normalizeAdminPagePath(pagePathOrKey)
  const lookupKey = typeof pagePathOrKey === 'string'
    ? PATH_TO_KEY[normalizedPath] || normalizedPath
    : pagePathOrKey

  return permissions.includes(lookupKey)
}
