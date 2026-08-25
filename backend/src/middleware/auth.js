import jwt from 'jsonwebtoken'

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return process.env.JWT_SECRET
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح به' })
  }

  try {
    const decoded = jwt.verify(header.split(' ')[1], getJwtSecret())
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ error: 'رمز الدخول غير صالح' })
  }
}

export function authenticateOptional(req, _res, next) {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], getJwtSecret())
      req.user = decoded
    } catch {
      req.user = null
    }
  } else {
    req.user = null
  }
  next()
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'لا تملك صلاحية الوصول' })
    }
    next()
  }
}
