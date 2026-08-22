import { prisma } from '../lib/prisma.js'
import { computeExtraRegistrationFee } from './campaignService.js'

const DEFAULT_PLAN_PRICES = {
  DAILY: 0,
  THREE_WEEKS: 0,
  FOUR_WEEKS: 0,
}

export async function getPrice(zoneId, destinationId, plan) {
  if (!zoneId || !plan) return DEFAULT_PLAN_PRICES[plan] ?? null

  const zone = await prisma.pricingArea.findUnique({ where: { id: zoneId } })
  if (zone) {
    const fieldMap = { DAILY: 'dailyPrice', THREE_WEEKS: 'threeWeeksPrice', FOUR_WEEKS: 'fourWeeksPrice' }
    const val = zone[fieldMap[plan]]
    if (val != null) return Number(val)
  }

  const fallback = await prisma.pricing.findFirst({
    where: { zoneId, plan, destinationId: null },
  })
  if (fallback) return Number(fallback.price)

  return DEFAULT_PLAN_PRICES[plan] ?? null
}

export async function getPriceByZoneName(zoneName, destinationId, plan) {
  if (!zoneName || !plan) return DEFAULT_PLAN_PRICES[plan] ?? null
  const zone = await prisma.pricingArea.findUnique({ where: { name: zoneName } })
  if (!zone) return DEFAULT_PLAN_PRICES[plan] ?? null
  return getPrice(zone.id, destinationId, plan)
}

export function isEarlyDiscountActive(campaign) {
  if (!campaign.hasEarlyDiscount) return false
  if (!campaign.discountStart || !campaign.discountExpiry) return false
  if (!campaign.discountAmount || Number(campaign.discountAmount) <= 0) return false
  const now = new Date()
  return now >= new Date(campaign.discountStart) && now <= new Date(campaign.discountExpiry)
}

export async function calculateFinalSubscriptionPrice(student, campaign, zonePricing) {
  const plan = campaign.type === 'subscription_3weeks' ? 'THREE_WEEKS' : 'FOUR_WEEKS'
  const zonePriceField = plan === 'THREE_WEEKS' ? 'threeWeeksPrice' : 'fourWeeksPrice'
  const basePrice = zonePricing?.[zonePriceField] != null
    ? Number(zonePricing[zonePriceField])
    : Number(zonePricing?.prices?.find(p => p.plan === plan && p.destinationId === null)?.price || 0)

  let surcharge = 0
  if (student.homeDeliveryActive) {
    if (plan === 'THREE_WEEKS') {
      surcharge = student.homeDeliveryFeeThreeWeeks != null && Number(student.homeDeliveryFeeThreeWeeks) > 0
        ? Number(student.homeDeliveryFeeThreeWeeks)
        : Number(zonePricing?.homeMediumSurcharge || 0)
    } else {
      surcharge = student.homeDeliveryFeeFourWeeks != null && Number(student.homeDeliveryFeeFourWeeks) > 0
        ? Number(student.homeDeliveryFeeFourWeeks)
        : Number(zonePricing?.homeFarSurcharge || 0)
    }
  }

  const earlyDiscount = isEarlyDiscountActive(campaign)
  let discount = 0
  if (earlyDiscount) {
    discount = Number(campaign.discountAmount) || 0
  }

  const extraFee = await computeExtraRegistrationFee(campaign, student.id)
  const discountedPrice = Math.max(0, basePrice - discount)
  const finalAmount = discountedPrice + surcharge + extraFee.amount

  return {
    basePrice,
    surcharge,
    discount,
    discountedPrice,
    extraFee,
    finalAmount,
    plan,
    hasDiscount: earlyDiscount,
  }
}

export async function ensurePricingRows(zoneId, destinationId, values = {}) {
  const plans = ['DAILY', 'THREE_WEEKS', 'FOUR_WEEKS']
  await Promise.all(plans.map(async (plan) => {
    const price = values[plan] != null ? Number(values[plan]) : DEFAULT_PLAN_PRICES[plan]
    await prisma.pricing.upsert({
      where: { zone_dest_plan_unique: { zoneId, destinationId: 'NONE', plan } },
      create: { zoneId, destinationId: null, plan, price },
      update: { price },
    })
  }))
}
