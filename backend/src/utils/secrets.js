import crypto from 'crypto'

export function safeError(res, error, context = '') {
  const message = process.env.NODE_ENV === 'production' ? 'خطأ داخلي في الخادم' : error.message
  if (context) console.error(`[${context}]`, error.message || error)
  res.status(error.status || 500).json({ error: message })
}

export function generateRandomPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars[crypto.randomInt(chars.length)]
  }
  return password
}

export function requireDev(message = 'This operation is only allowed in development mode') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message)
  }
}

export function getAdminInitialPassword() {
  const envPassword = process.env.ADMIN_INITIAL_PASSWORD
  if (envPassword) return envPassword
  throw new Error('ADMIN_INITIAL_PASSWORD environment variable is required')
}
