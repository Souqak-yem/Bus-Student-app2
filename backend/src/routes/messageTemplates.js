import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()
router.use(authenticate)

function validateTemplatePayload(body, { allowPartial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('بيانات النموذج غير صالحة')
  }

  const payload = {}
  const allowedKeys = new Set(['key', 'name', 'message', 'isActive'])
  const providedKeys = Object.keys(body)

  for (const key of providedKeys) {
    if (!allowedKeys.has(key)) {
      throw new Error(`حقل غير مسموح: ${key}`)
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'key')) {
    const value = String(body.key ?? '').trim()
    if (!value || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
      throw new Error('مفتاح النموذج غير صالح')
    }
    payload.key = value
  }

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const value = String(body.name ?? '').trim()
    if (!value || value.length > 200) {
      throw new Error('اسم النموذج غير صالح')
    }
    payload.name = value
  }

  if (Object.prototype.hasOwnProperty.call(body, 'message')) {
    if (typeof body.message !== 'string') {
      throw new Error('نص الرسالة غير صالح')
    }
    if (body.message.length > 5000) {
      throw new Error('نص الرسالة طويل جداً')
    }
    payload.message = body.message
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') {
      throw new Error('حالة التفعيل غير صالحة')
    }
    payload.isActive = body.isActive
  }

  if (!allowPartial && Object.keys(payload).length === 0) {
    throw new Error('لا توجد بيانات صالحة لإرسالها')
  }

  return payload
}

router.get('/', async (req, res) => {
  try {
    const templates = await prisma.messageTemplate.findMany({
      where: { isActive: true },
    })
    res.json(templates)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const data = validateTemplatePayload(req.body)
    const template = await prisma.messageTemplate.create({ data })
    res.status(201).json(template)
  } catch (error) {
    if (error.message.startsWith('حقل غير مسموح') || error.message.includes('غير صالح') || error.message.includes('لا توجد بيانات')) {
      return res.status(400).json({ error: error.message })
    }
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const data = validateTemplatePayload(req.body, { allowPartial: true })
    const template = await prisma.messageTemplate.update({
      where: { id: req.params.id },
      data,
    })
    res.json(template)
  } catch (error) {
    if (error.message.startsWith('حقل غير مسموح') || error.message.includes('غير صالح') || error.message.includes('لا توجد بيانات')) {
      return res.status(400).json({ error: error.message })
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'النموذج غير موجود' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await prisma.messageTemplate.delete({
      where: { id: req.params.id },
    })
    res.json({ message: 'تم حذف النموذج' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
