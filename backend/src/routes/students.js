import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { hashPassword, generateStudentUsername, ensureUniqueUsername } from '../services/authService.js'
import { createAndBroadcast } from '../services/notificationService.js'
import { generateRandomPassword } from '../utils/secrets.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req, res) => {
  try {
    const { zone, status, search, transportMode, destinationId, gender } = req.query
    const where = {}

    if (zone) where.zone = zone
    if (status) where.status = status
    if (transportMode) where.transportMode = transportMode
    if (destinationId) where.destinationId = destinationId
    if (gender) where.gender = gender
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { parentPhone: { contains: search } },
      ]
    }

    const students = await prisma.student.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assignments: true, subscriptions: true } },
        destination: true,
      },
    })

    res.json(students)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/destinations-summary', authorize('admin'), async (req, res) => {
  try {
    const summary = await prisma.destination.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { students: { where: { status: 'active' } } } } },
    })
    res.json(summary)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        destination: true,
        assignments: {
          include: { bus: { include: { driver: { select: { name: true } } } } },
          orderBy: { date: 'desc' },
          take: 20,
        },
        subscriptions: {
          include: { payments: { orderBy: { date: 'desc' } } },
          orderBy: { startDate: 'desc' },
        },
      },
    })

    if (!student) {
      return res.status(404).json({ error: 'الطالب غير موجود' })
    }

    res.json(student)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, phone, whatsapp, parentName, parentRelation, parentPhone, address, zone, destinationId, major, level, institutionName, offDays, pickupLocation, gender, transportMode, homeAddress, homeDeliveryFee, homeDeliveryFeeDaily, homeDeliveryFeeThreeWeeks, homeDeliveryFeeFourWeeks, homeNotes, homeDeliveryActive } = req.body

    if (!name) {
      return res.status(400).json({ error: 'اسم الطالب مطلوب' })
    }
    if (!gender || !['MALE', 'FEMALE'].includes(gender)) {
      return res.status(400).json({ error: 'الجنس مطلوب' })
    }

    const student = await prisma.student.create({
      data: {
        name, phone, whatsapp, parentName, parentRelation, parentPhone,
        address, zone, destinationId: destinationId || null, major, level, institutionName,
        offDays: offDays || [],
        pickupLocation,
        gender,
        transportMode: transportMode || 'LINE',
        homeAddress,
        homeDeliveryFee: homeDeliveryFee ? Number(homeDeliveryFee) : 0,
        homeDeliveryFeeDaily: homeDeliveryFeeDaily ? Number(homeDeliveryFeeDaily) : 0,
        homeDeliveryFeeThreeWeeks: homeDeliveryFeeThreeWeeks ? Number(homeDeliveryFeeThreeWeeks) : 0,
        homeDeliveryFeeFourWeeks: homeDeliveryFeeFourWeeks ? Number(homeDeliveryFeeFourWeeks) : 0,
        homeNotes,
        homeDeliveryActive: homeDeliveryActive || false,
      },
    })

    let username = ''
    let defaultPassword = phone || generateRandomPassword()
    try {
      const baseUsername = generateStudentUsername(name)
      username = await ensureUniqueUsername(baseUsername)
      const hashedPassword = await hashPassword(defaultPassword)
      await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          name,
          phone: phone || '',
          role: 'student',
          mustChangePassword: true,
          studentId: student.id,
        },
      })
    } catch (err) {
    }

    res.status(201).json({ ...student, credentials: { username, password: defaultPassword } })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, phone, whatsapp, parentName, parentRelation, parentPhone, address, zone, destinationId, major, level, institutionName, offDays, pickupLocation, gender, status, transportMode, homeAddress, homeDeliveryFee, homeDeliveryFeeDaily, homeDeliveryFeeThreeWeeks, homeDeliveryFeeFourWeeks, homeNotes, homeDeliveryActive } = req.body

    const existingStudent = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    })
    if (!existingStudent) return res.status(404).json({ error: 'الطالب غير موجود' })

    const parseOptionalPrice = (value) => {
      if (value === undefined || value === null || value === '') return undefined
      const num = Number(value)
      return Number.isNaN(num) ? undefined : num
    }

    const parsedDaily = parseOptionalPrice(homeDeliveryFeeDaily)
    const parsedThree = parseOptionalPrice(homeDeliveryFeeThreeWeeks)
    const parsedFour = parseOptionalPrice(homeDeliveryFeeFourWeeks)

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        name, phone, whatsapp, parentName, parentRelation, parentPhone,
        address, zone, destinationId: destinationId !== undefined ? (destinationId || null) : undefined,
        major, level, institutionName, status, pickupLocation,
        gender: gender !== undefined ? gender : undefined,
        offDays: offDays !== undefined ? offDays : undefined,
        transportMode,
        homeAddress,
        homeDeliveryFee: homeDeliveryFee != null ? Number(homeDeliveryFee) : undefined,
        homeDeliveryFeeDaily: parsedDaily !== undefined ? parsedDaily : undefined,
        homeDeliveryFeeThreeWeeks: parsedThree !== undefined ? parsedThree : undefined,
        homeDeliveryFeeFourWeeks: parsedFour !== undefined ? parsedFour : undefined,
        homeNotes,
        homeDeliveryActive,
      },
      include: { user: true },
    })

    const hadPriorPrice = (existingStudent.homeDeliveryFeeDaily != null && Number(existingStudent.homeDeliveryFeeDaily) > 0)
      || (existingStudent.homeDeliveryFeeThreeWeeks != null && Number(existingStudent.homeDeliveryFeeThreeWeeks) > 0)
      || (existingStudent.homeDeliveryFeeFourWeeks != null && Number(existingStudent.homeDeliveryFeeFourWeeks) > 0)

    const hasNewPrice = (parsedDaily != null && Number(parsedDaily) > 0)
      || (parsedThree != null && Number(parsedThree) > 0)
      || (parsedFour != null && Number(parsedFour) > 0)

    const priceChanged = (parsedDaily != null && Number(parsedDaily) > 0 && Number(existingStudent.homeDeliveryFeeDaily || 0) !== Number(parsedDaily))
      || (parsedThree != null && Number(parsedThree) > 0 && Number(existingStudent.homeDeliveryFeeThreeWeeks || 0) !== Number(parsedThree))
      || (parsedFour != null && Number(parsedFour) > 0 && Number(existingStudent.homeDeliveryFeeFourWeeks || 0) !== Number(parsedFour))

    if (student.transportMode === 'HOME' && hasNewPrice && priceChanged && student.user?.id) {
      const dailyText = parsedDaily ? parsedDaily : ''
      const threeText = parsedThree ? parsedThree : ''
      const fourText = parsedFour ? parsedFour : ''
      await createAndBroadcast({
        userId: student.user.id,
        type: 'student_home_delivery_price',
        title: 'تم تحديد سعر التوصيل المنزلي الخاص بك',
        message: `تم تحديد سعر التوصيل المنزلي الخاص بك وهو كالتالي: اليومي (${dailyText}) 3 أسابيع (${threeText}) 4 أسابيع (${fourText})`,
        targetRoute: '/student/notifications',
      })
    }

    res.json(student)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الطالب غير موجود' })
    }
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const studentId = req.params.id

    await prisma.$transaction(async (tx) => {
      await tx.returnQueue.deleteMany({ where: { studentId } })
      await tx.busLoad.deleteMany({ where: { studentId } })
      await tx.campaignEnrollment.deleteMany({ where: { studentId } })
      await tx.studentTransfer.deleteMany({ where: { studentId } })
      await tx.student.delete({ where: { id: studentId } })
    })

    res.json({ message: 'تم حذف الطالب بنجاح' })
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'الطالب غير موجود' })
    }
    res.status(500).json({ error: error.message })
  }
})

export default router
