import { prisma } from '../lib/prisma.js'

const validSubscriptionStatuses = ['active', 'expired']

export async function isNewStudent(studentId) {
  // Consider student NOT new only if they have a prior *weekly* subscription.
  // Weekly plans are represented by THREE_WEEKS and FOUR_WEEKS in the schema.
  const weeklyPlans = ['THREE_WEEKS', 'FOUR_WEEKS']

  const hasWeeklySubscription = await prisma.subscription.findFirst({
    where: {
      studentId,
      status: { in: validSubscriptionStatuses },
      type: { in: weeklyPlans },
    },
  })
  if (hasWeeklySubscription) return false

  // If no prior weekly subscription found, treat as new (even if they bought daily/monthly)
  return true
}

export function isLateRegistration(campaign) {
  const now = new Date()
  return !!(campaign.extraFeeStart && now > new Date(campaign.extraFeeStart))
}

export async function computeExtraRegistrationFee(campaign, studentId) {
  if (!campaign.enableExtraRegistrationFee) {
    return { type: null, amount: 0, label: null }
  }

  const isNew = await isNewStudent(studentId)
  if (isNew) {
    return {
      type: 'NEW_STUDENT',
      amount: Number(campaign.extraRegistrationFee),
      label: 'رسوم طالب جديد',
    }
  }

  if (isLateRegistration(campaign)) {
    return {
      type: 'LATE_REGISTRATION',
      amount: Number(campaign.extraRegistrationFee),
      label: 'رسوم تسجيل متأخر',
    }
  }

  return { type: null, amount: 0, label: null }
}
