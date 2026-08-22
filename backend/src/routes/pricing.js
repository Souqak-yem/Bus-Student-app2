import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { getPrice, ensurePricingRows, calculateFinalSubscriptionPrice } from '../services/pricingService.js'

const router = Router()
router.use(authenticate)

const DEFAULT_PLAN_PRICES = {
  DAILY: 0,
  THREE_WEEKS: 0,
  FOUR_WEEKS: 0,
}

async function loadZoneWithPrices(id) {
  return prisma.pricingArea.findUnique({
    where: { id },
    include: { prices: { include: { destination: true } } },
  })
}

router.get('/', async (req, res) => {
  try {
    const { zoneId } = req.query
    if (zoneId) {
      const prices = await prisma.pricing.findMany({
        where: { zoneId, destinationId: null },
        include: { zone: true },
      })
      return res.json(prices)
    }
    const zones = await prisma.pricingArea.findMany({
      orderBy: { name: 'asc' },
      include: { prices: { include: { destination: true } } },
    })
    res.json(zones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/all', authorize('admin'), async (req, res) => {
  try {
    const zones = await prisma.pricingArea.findMany({
      orderBy: { name: 'asc' },
      include: { prices: { include: { destination: true } } },
    })
    res.json(zones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/zones', authorize('admin'), async (req, res) => {
  try {
    const zones = await prisma.pricingArea.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    })
    res.json(zones)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/zones/:id', authorize('admin'), async (req, res) => {
  try {
    const zone = await loadZoneWithPrices(req.params.id)
    if (!zone) return res.status(404).json({ error: 'المنطقة غير موجودة' })
    res.json(zone)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/calculate', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'غير مصرح' })
    const studentId = req.user.studentId
    if (!studentId) return res.status(404).json({ error: 'الطالب غير موجود' })

    const { campaignId } = req.query
    if (!campaignId) return res.status(400).json({ error: 'معرّف الحملة مطلوب' })

    const [campaign, student] = await Promise.all([
      prisma.campaign.findUnique({ where: { id: campaignId } }),
      prisma.student.findUnique({ where: { id: studentId } }),
    ])
    if (!campaign) return res.status(404).json({ error: 'الحملة غير موجودة' })
    if (!student) return res.status(404).json({ error: 'الطالب غير موجود' })
    if (!student.zone) return res.status(400).json({ error: 'لم يتم تحديد منطقتك بعد' })

    const zonePricing = await prisma.pricingArea.findUnique({
      where: { name: student.zone },
      include: { prices: { where: { destinationId: null } } },
    })
    if (!zonePricing) return res.status(400).json({ error: 'لم يتم العثور على منطقة التسعير' })

    const price = await calculateFinalSubscriptionPrice(student, campaign, zonePricing)
    res.json(price)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/price', async (req, res) => {
  try {
    const { zoneName, zoneId, plan } = req.query
    if (!plan) return res.status(400).json({ error: 'نوع الاشتراك مطلوب' })

    let id = zoneId
    if (zoneName && !id) {
      const zone = await prisma.pricingArea.findUnique({ where: { name: zoneName } })
      if (zone) id = zone.id
    }

    const price = await getPrice(id, null, plan)
    res.json({ price })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      dailyPrice,
      threeWeeksPrice,
      fourWeeksPrice,
      homeNearSurcharge,
      homeMediumSurcharge,
      homeFarSurcharge,
      prices,
    } = req.body

    if (!name) return res.status(400).json({ error: 'اسم المنطقة مطلوب' })

    const area = await prisma.pricingArea.create({
      data: {
        name,
        dailyPrice: dailyPrice != null ? Number(dailyPrice) : null,
        threeWeeksPrice: threeWeeksPrice != null ? Number(threeWeeksPrice) : null,
        fourWeeksPrice: fourWeeksPrice != null ? Number(fourWeeksPrice) : null,
        homeNearSurcharge: homeNearSurcharge != null ? Number(homeNearSurcharge) : null,
        homeMediumSurcharge: homeMediumSurcharge != null ? Number(homeMediumSurcharge) : null,
        homeFarSurcharge: homeFarSurcharge != null ? Number(homeFarSurcharge) : null,
      },
    })

    const plans = ['DAILY', 'THREE_WEEKS', 'FOUR_WEEKS']
    await Promise.all(plans.map((plan) => {
      const price = (prices || []).find((p) => p.plan === plan)?.price ?? DEFAULT_PLAN_PRICES[plan]
      return prisma.pricing.create({
        data: { zoneId: area.id, destinationId: null, plan, price: Number(price) },
      })
    }))

    const zone = await loadZoneWithPrices(area.id)
    res.status(201).json(zone)
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'المنطقة موجودة مسبقاً' })
    res.status(500).json({ error: error.message })
  }
})

router.put('/zones/:id', authorize('admin'), async (req, res) => {
  try {
    const {
      name,
      dailyPrice,
      threeWeeksPrice,
      fourWeeksPrice,
      homeNearSurcharge,
      homeMediumSurcharge,
      homeFarSurcharge,
      isActive,
    } = req.body

    await prisma.pricingArea.update({
      where: { id: req.params.id },
      data: {
        name,
        dailyPrice: dailyPrice !== undefined ? (dailyPrice != null ? Number(dailyPrice) : null) : undefined,
        threeWeeksPrice: threeWeeksPrice !== undefined ? (threeWeeksPrice != null ? Number(threeWeeksPrice) : null) : undefined,
        fourWeeksPrice: fourWeeksPrice !== undefined ? (fourWeeksPrice != null ? Number(fourWeeksPrice) : null) : undefined,
        homeNearSurcharge: homeNearSurcharge !== undefined ? (homeNearSurcharge != null ? Number(homeNearSurcharge) : null) : undefined,
        homeMediumSurcharge: homeMediumSurcharge !== undefined ? (homeMediumSurcharge != null ? Number(homeMediumSurcharge) : null) : undefined,
        homeFarSurcharge: homeFarSurcharge !== undefined ? (homeFarSurcharge != null ? Number(homeFarSurcharge) : null) : undefined,
        isActive,
      },
    })

    const zone = await loadZoneWithPrices(req.params.id)
    res.json(zone)
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المنطقة غير موجودة' })
    res.status(500).json({ error: error.message })
  }
})

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { prices } = req.body
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'مصفوفة الأسعار مطلوبة' })

    await Promise.all(prices.map(async (item) => {
      if (!item.plan) return
      const priceValue = item.price != null ? Number(item.price) : DEFAULT_PLAN_PRICES[item.plan]
      await prisma.pricing.upsert({
        where: { zone_dest_plan_unique: { zoneId: req.params.id, destinationId: 'NONE', plan: item.plan } },
        create: { zoneId: req.params.id, destinationId: null, plan: item.plan, price: priceValue },
        update: { price: priceValue },
      })
    }))

    const zone = await loadZoneWithPrices(req.params.id)
    res.json(zone)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.post('/copy', authorize('admin'), async (req, res) => {
  try {
    const { sourceZoneId, targetZoneId } = req.body
    if (!sourceZoneId || !targetZoneId) return res.status(400).json({ error: 'مطلوب مصدر وهدف' })
    if (sourceZoneId === targetZoneId) return res.status(400).json({ error: 'لا يمكن النسخ إلى نفس المنطقة' })

    const source = await loadZoneWithPrices(sourceZoneId)
    if (!source) return res.status(404).json({ error: 'المنطقة المصدر غير موجودة' })

    const target = await prisma.pricingArea.findUnique({ where: { id: targetZoneId } })
    if (!target) return res.status(404).json({ error: 'المنطقة الهدف غير موجودة' })

    await prisma.pricing.deleteMany({ where: { zoneId: targetZoneId } })
    await prisma.pricing.createMany({
      data: source.prices.map((item) => ({
        zoneId: targetZoneId,
        destinationId: item.destinationId,
        plan: item.plan,
        price: item.price,
      })),
    })
    await prisma.pricingArea.update({
      where: { id: targetZoneId },
      data: {
        dailyPrice: source.dailyPrice,
        threeWeeksPrice: source.threeWeeksPrice,
        fourWeeksPrice: source.fourWeeksPrice,
        homeNearSurcharge: source.homeNearSurcharge,
        homeMediumSurcharge: source.homeMediumSurcharge,
        homeFarSurcharge: source.homeFarSurcharge,
      },
    })

    const updated = await loadZoneWithPrices(targetZoneId)
    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await prisma.pricing.deleteMany({ where: { zoneId: req.params.id } })
    await prisma.pricingArea.delete({ where: { id: req.params.id } })
    res.json({ message: 'تم حذف المنطقة' })
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'المنطقة غير موجودة' })
    res.status(500).json({ error: error.message })
  }
})

export default router
