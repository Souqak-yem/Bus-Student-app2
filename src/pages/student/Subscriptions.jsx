import { useState, useEffect, useMemo, useCallback } from 'react'
import { NavLink, Navigate, useLocation } from 'react-router-dom'
import { CalendarDays, CreditCard, Clock, FileText, Upload, ShoppingCart, Trash2 } from 'lucide-react'
import { resolveDailyExecutionDates, serializeLocalDate, parseLocalDate } from '../../../backend/src/utils/dateUtils.js'
import { api } from '../../lib/api'
import { formatCurrency, formatNumber } from '../../lib/format'
import ConfirmModal from '../../components/ui/ConfirmModal'
import DiscountExpiryBadge from '../../components/ui/DiscountExpiryBadge'

const PLAN_LABELS = {
  DAILY: 'يومي',
  THREE_WEEKS: 'ثلاثة أسابيع',
  FOUR_WEEKS: 'أربعة أسابيع',
}

const STATUS_LABELS = {
  pending: 'قيد المراجعة',
  active: 'نشط',
  expired: 'منتهي',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
}

const DAY_NAMES_AR = {
  SATURDAY: 'السبت',
  SUNDAY: 'الأحد',
  MONDAY: 'الإثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
}

const WEEKDAYS = [
  { value: 'SATURDAY', label: 'السبت' },
  { value: 'SUNDAY', label: 'الأحد' },
  { value: 'MONDAY', label: 'الإثنين' },
  { value: 'TUESDAY', label: 'الثلاثاء' },
  { value: 'WEDNESDAY', label: 'الأربعاء' },
  { value: 'THURSDAY', label: 'الخميس' },
]

const asLocalDate = (value) => {
  if (value == null) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return parseLocalDate(value)
  }
  const parsed = parseLocalDate(value)
  if (parsed) return parsed
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function convertImageToWebP(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('ملف غير صالح'))
      return
    }

    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const maxSize = 1600
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))

        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

        const toDataUrl = () => canvas.toDataURL('image/webp', 0.82)
        const result = toDataUrl()
        URL.revokeObjectURL(url)
        resolve(result)
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('فشل قراءة الصورة'))
    }

    image.src = url
  })
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([])
  const [pricing, setPricing] = useState([])
  const [student, setStudent] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [campaignPrices, setCampaignPrices] = useState({})
  const [loading, setLoading] = useState(true)

  const [dailyWeeks, setDailyWeeks] = useState(1)
  const [dailyDays, setDailyDays] = useState([])
  const [dailyAddingToCart, setDailyAddingToCart] = useState(false)
  const [dailySuccess, setDailySuccess] = useState('')
  const [dailyError, setDailyError] = useState('')

  const [campaignEnrolling, setCampaignEnrolling] = useState(null)
  const [campaignSubmitting, setCampaignSubmitting] = useState(false)
  const [campaignSuccess, setCampaignSuccess] = useState('')
  const [campaignError, setCampaignError] = useState('')

  const [cart, setCart] = useState(null)
  const [cartReceipt, setCartReceipt] = useState('')
  const [cartDepositReference, setCartDepositReference] = useState('')
  const [cartSubmitting, setCartSubmitting] = useState(false)
  const [cartSuccess, setCartSuccess] = useState('')
  const [cartError, setCartError] = useState('')

  const [destPricing, setDestPricing] = useState([])
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  const handleCartSubmit = useCallback(() => {
    setCartError('')
    setCartSuccess('')
    if (!cartReceipt) {
      setCartError('يرجى رفع صورة سند التحويل')
      return
    }
    if (!cartDepositReference.trim()) {
      setCartError('يرجى إدخال رقم الإيداع أو المرجع')
      return
    }
    setShowSubmitConfirm(true)
  }, [cartReceipt, cartDepositReference])

  useEffect(() => {
    let cancelled = false
    async function loadData() {
      const results = await Promise.allSettled([
        api.studentPortal.getSubscriptions(),
        api.studentPortal.getPricing(),
        api.studentPortal.getDashboard(),
        api.campaigns.active(),
        api.enrollments.list({}),
        api.cart.get(),
      ])
      if (cancelled) return
      const [subsResult, pricesResult, dashResult, campsResult, enrsResult, cartResult] = results
      if (subsResult.status === 'fulfilled') setSubscriptions(subsResult.value)
      if (pricesResult.status === 'fulfilled') setPricing(pricesResult.value)
      if (dashResult.status === 'fulfilled') {
        const studentData = dashResult.value.student
        setStudent(studentData)
        if (studentData?.destinationId) {
          try {
            const dp = await api.studentPortal.getPricingByDestination(studentData.destinationId)
            if (dp) setDestPricing(dp)
          } catch (_) {}
        }
      }
      if (campsResult.status === 'fulfilled') {
        const camps = campsResult.value
        const subCamps = (Array.isArray(camps) ? camps : []).filter(
          c => c.type === 'subscription_3weeks' || c.type === 'subscription_4weeks'
        )
        setCampaigns(subCamps)
        const priceMap = {}
        await Promise.allSettled(subCamps.map(async (c) => {
          try {
            const p = await api.studentPortal.campaignPrice(c.id)
            priceMap[c.id] = {
              basePrice: p.basePrice,
              discount: p.discountAmount,
              discountedPrice: Math.max(0, p.basePrice - p.discountAmount),
              surcharge: p.surcharge || 0,
              hasDiscount: p.hasDiscount,
              extraFee: {
                type: p.feeType,
                amount: p.feeAmount,
                label: p.feeLabel,
              },
              finalAmount: p.finalAmount,
            }
          } catch {}
        }))
        setCampaignPrices(priceMap)
      }
      if (enrsResult.status === 'fulfilled') {
        setEnrollments(Array.isArray(enrsResult.value) ? enrsResult.value : [])
      }
      if (cartResult.status === 'fulfilled' && cartResult.value.cart) {
        setCart(cartResult.value.cart)
      }
      setLoading(false)
    }
    loadData()
    return () => { cancelled = true }
  }, [])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // Plan types that student already has an active subscription for → filter out those campaigns
  const subscribedPlans = useMemo(() => {
    const plans = new Set()
    ;(Array.isArray(subscriptions) ? subscriptions : []).filter(s => s.status === 'active').forEach(s => {
      if (s.type === 'THREE_WEEKS') plans.add('subscription_3weeks')
      if (s.type === 'FOUR_WEEKS') plans.add('subscription_4weeks')
    })
    return plans
  }, [subscriptions])

  const activeCampaigns = useMemo(() => {
    return campaigns.filter(c => asLocalDate(c.startDate) <= today && !subscribedPlans.has(c.type))
  }, [campaigns, today, subscribedPlans])
  const upcomingCampaigns = useMemo(() => {
    return campaigns.filter(c => asLocalDate(c.startDate) > today && !subscribedPlans.has(c.type))
  }, [campaigns, today, subscribedPlans])

  const zone = student?.zone
  const destId = student?.destinationId
  const zonePricing = useMemo(() => {
    if (!zone) return null
    return pricing.find(z => z.name === zone) || null
  }, [zone, pricing])

  const destZonePricing = useMemo(() => {
    if (!zone || !destId) return null
    return destPricing.find(z => z.name === zone) || null
  }, [zone, destId, destPricing])

  const location = useLocation()

  const dailyPrice = useMemo(() => {
    const zp = destZonePricing
    if (!zp) return 0
    const p = zp.prices?.find(pr => pr.plan === 'DAILY')
    return p ? Number(p.price) : 0
  }, [zonePricing, destZonePricing])

  const weeklyPrices = useMemo(() => {
    const zp = destZonePricing
    if (!zp) return { THREE_WEEKS: 0, FOUR_WEEKS: 0 }
    const three = zp.prices?.find(pr => pr.plan === 'THREE_WEEKS')
    const four = zp.prices?.find(pr => pr.plan === 'FOUR_WEEKS')
    return {
      THREE_WEEKS: three ? Number(three.price) : 0,
      FOUR_WEEKS: four ? Number(four.price) : 0,
    }
  }, [zonePricing, destZonePricing])

  const dailyHomeFee = useMemo(() => {
    if (!student?.homeDeliveryActive || !zonePricing) return 0
    if (dailyWeeks === 1 && student.homeDeliveryFeeDaily != null && Number(student.homeDeliveryFeeDaily) > 0) {
      return Number(student.homeDeliveryFeeDaily)
    }
    if (dailyWeeks === 3 && student.homeDeliveryFeeThreeWeeks != null && Number(student.homeDeliveryFeeThreeWeeks) > 0) {
      return Number(student.homeDeliveryFeeThreeWeeks)
    }
    if (dailyWeeks === 4 && student.homeDeliveryFeeFourWeeks != null && Number(student.homeDeliveryFeeFourWeeks) > 0) {
      return Number(student.homeDeliveryFeeFourWeeks)
    }
    return Number(zonePricing.homeNearSurcharge || 0)
  }, [student, zonePricing])

  const { dates: computedDates } = useMemo(() => {
    if (!dailyDays.length) return { dates: [], startDate: null, endDate: null, weekCount: 0 }
    return resolveDailyExecutionDates({ selectedDays: dailyDays, durationWeeks: dailyWeeks })
  }, [dailyDays, dailyWeeks])

  const dailyTotal = useMemo(() => {
    return (dailyPrice + dailyHomeFee) * computedDates.length
  }, [dailyPrice, dailyHomeFee, computedDates])

  function toggleDay(day) {
    setDailyDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
    setDailyError('')
    setDailySuccess('')
  }

  const handleAddDailyToCart = async () => {
    setDailyError('')
    setDailySuccess('')
    if (!dailyDays.length) {
      setDailyError('يرجى اختيار يوم واحد على الأقل')
      return
    }
    if (computedDates.length === 0) {
      setDailyError('لا توجد تواريخ صالحة')
      return
    }
    setDailyAddingToCart(true)
    try {
      await api.cart.addItem({
        type: 'DAILY',
        zoneId: zonePricing?.id || null,
        destinationId: student?.destinationId || null,
        amount: dailyTotal,
        homeDeliveryFee: dailyHomeFee > 0 ? dailyHomeFee : null,
        data: {
          selectedDays: dailyDays,
          weeksCount: dailyWeeks,
          computedDates: computedDates.map(d => serializeLocalDate(d)),
        },
      })
      setDailySuccess('تمت إضافة الاشتراك اليومي إلى السلة')
      setDailyDays([])
      setDailyWeeks(1)
      const cartRes = await api.cart.get()
      setCart(cartRes.cart)
    } catch (e) {
      setDailyError(e.message)
    } finally {
      setDailyAddingToCart(false)
    }
  }

  const handleAddCampaignToCart = async (campaign) => {
    setCampaignError('')
    setCampaignSuccess('')
    setCampaignSubmitting(true)
    try {
      let price = campaignPrices[campaign.id]
      if (!price) {
        const p = await api.studentPortal.campaignPrice(campaign.id)
        price = {
          basePrice: p.basePrice,
          discount: p.discountAmount,
          discountedPrice: Math.max(0, p.basePrice - p.discountAmount),
          surcharge: p.surcharge || 0,
          hasDiscount: p.hasDiscount,
          extraFee: { type: p.feeType, amount: p.feeAmount, label: p.feeLabel },
          finalAmount: p.finalAmount,
        }
      }
      const plan = campaign.type === 'subscription_3weeks' ? 'THREE_WEEKS' : 'FOUR_WEEKS'
      const weeksCount = plan === 'THREE_WEEKS' ? 3 : 4
      const snapStart = asLocalDate(campaign.startDate)
      const snapEnd = asLocalDate(campaign.endDate)
      const itemData = {
        weeksCount,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        baseAmount: price.basePrice,
        discount: price.discount,
        startDate: serializeLocalDate(snapStart),
        endDate: serializeLocalDate(snapEnd),
      }
      if (price.extraFee?.type && price.extraFee?.amount) {
        itemData.extraFeeType = price.extraFee.type
        itemData.extraFeeAmount = price.extraFee.amount
      }
      await api.cart.addItem({
        type: plan,
        zoneId: zonePricing?.id || null,
        destinationId: student?.destinationId || null,
        amount: price.finalAmount,
        homeDeliveryFee: price.surcharge > 0 ? price.surcharge : null,
        data: itemData,
      })
      setCampaignSuccess(`تمت إضافة "${campaign.title}" إلى السلة`)
      setCampaignEnrolling(null)
      const cartRes = await api.cart.get()
      setCart(cartRes.cart)
    } catch (e) {
      setCampaignError(e.message)
    } finally {
      setCampaignSubmitting(false)
    }
  }

  function getCampaignPrice(campaign) {
    return campaignPrices[campaign.id]
  }

  function getExistingEnrollment(campaignId) {
    return enrollments.find(e => e.campaignId === campaignId && e.studentId === student?.id)
  }

  const activeDailySubscriptions = subscriptions.filter(s => s.type === 'DAILY' && s.status === 'active')
  const activeWeeklySubscriptions = subscriptions.filter(s => s.type !== 'DAILY' && s.status === 'active')
  const nonActiveSubscriptions = subscriptions.filter(s => s.status !== 'active')
  const sortedAreaPrices = useMemo(() => {
    return [...pricing].sort((a, b) => {
      const aPrice = Number(a.prices?.find(p => p.plan === 'FOUR_WEEKS')?.price || 0)
      const bPrice = Number(b.prices?.find(p => p.plan === 'FOUR_WEEKS')?.price || 0)
      return bPrice - aPrice
    })
  }, [pricing])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400 text-base font-medium fade-in">
        <div className="w-10 h-10 rounded-2xl gradient-primary flex items-center justify-center">
          <CreditCard size={20} className="text-white animate-pulse" />
        </div>
        جاري التحميل...
      </div>
    )
  }

  const tabItems = [
    { key: 'daily', label: 'اليومي' },
    { key: 'weekly', label: 'الأسبوعي' },
    { key: 'current', label: 'الأسعار' },
    { key: 'history', label: 'السجل' },
  ]

  function StatusBadge({ status }) {
    const colors = {
      expired: 'bg-red-100 text-red-600',
      cancelled: 'bg-yellow-100 text-yellow-600',
      pending: 'bg-orange-100 text-orange-600',
      rejected: 'bg-red-100 text-red-600',
      active: 'bg-green-100 text-green-600',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
        {STATUS_LABELS[status] || status}
      </span>
    )
  }

  function DailySubscriptionCard({ sub }) {
    return (
      <div className="card p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
              <CalendarDays size={18} className="text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-800">اشتراك يومي</div>
              <div className="text-xs text-slate-500 truncate mt-0.5">
                <Clock size={12} className="inline ml-1" />
                {asLocalDate(sub.startDate).toLocaleDateString('ar-SA')} - {asLocalDate(sub.endDate).toLocaleDateString('ar-SA')}
              </div>
            </div>
          </div>
          <StatusBadge status={sub.status} />
        </div>
      </div>
    )
  }

  function CampaignCard({ campaign, isUpcoming }) {
    const plan = campaign.type === 'subscription_3weeks' ? 'THREE_WEEKS' : 'FOUR_WEEKS'
    const price = getCampaignPrice(campaign)
    const isEnrolling = campaignEnrolling === campaign.id
    const existingEnrollment = getExistingEnrollment(campaign.id)
    const hasActiveDiscount = price?.hasDiscount || false
    const displayOriginal = existingEnrollment
      ? Number(existingEnrollment.baseAmount)
      : (price?.basePrice || 0)
    const displayPrice = existingEnrollment
      ? (Number(existingEnrollment.baseAmount) - Number(existingEnrollment.discount || 0))
      : (price?.discountedPrice || 0)

    return (
      <div className={`card p-4 ${isUpcoming ? 'border-amber-300 bg-gradient-to-b from-amber-50/60 to-white' : hasActiveDiscount ? 'border-green-300 bg-gradient-to-b from-green-50/60 to-white' : ''}`}>
        {/* Header: title + badges */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-bold text-slate-800 leading-snug">{campaign.title}</h4>
          <div className="flex gap-1.5 shrink-0">
            {isUpcoming && (
              <span className="bg-amber-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                قادمة
              </span>
            )}
            {hasActiveDiscount && !existingEnrollment && !isUpcoming && (
              <span className="bg-green-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                خصم مبكر
              </span>
            )}
            {campaign.hasEarlyDiscount && campaign.discountExpiry && (
              <DiscountExpiryBadge expiry={campaign.discountExpiry} />
            )}
          </div>
        </div>

        {/* Description */}
        {campaign.description && (
          <p className="text-xs text-slate-500 mb-2 leading-relaxed">{campaign.description}</p>
        )}

        {/* Details grid */}
        <div className="space-y-1.5 text-xs text-slate-600 mb-2">
          {/* Period with calendar icon */}
          <div className="flex items-center gap-2 bg-slate-50/80 border border-slate-100 rounded-xl p-2.5">
            <CalendarDays size={16} className="text-slate-400 shrink-0" />
            <span className="font-medium text-slate-700">
              {asLocalDate(campaign.startDate).toLocaleDateString('ar-SA')}
            </span>
            <span className="text-slate-300">—</span>
            <span className="font-medium text-slate-700">
              {asLocalDate(campaign.endDate).toLocaleDateString('ar-SA')}
            </span>
          </div>

          {/* Plan type */}
          <div className="flex justify-between items-center px-2">
            <span className="text-slate-500">نوع الاشتراك</span>
            <span className="font-medium text-slate-700">{PLAN_LABELS[plan]}</span>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 my-1" />

          {/* Price section */}
          {hasActiveDiscount ? (
            <>
              <div className="flex justify-between items-center px-2">
                <span className="text-slate-500">السعر الأصلي</span>
                <span className="text-sm line-through text-slate-400">{formatNumber(displayOriginal)} ريال</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="font-medium text-slate-700">السعر بعد الخصم</span>
                <span className="text-sm font-bold text-green-600">{formatNumber(displayPrice)} ريال</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between items-center px-2">
              <span className="font-medium text-slate-700">سعر الاشتراك</span>
              <span className="text-sm font-bold text-[var(--color-primary)]">{formatNumber(displayOriginal)} ريال</span>
            </div>
          )}

          {/* Surcharge */}
          {(existingEnrollment ? Number(existingEnrollment.surcharge || 0) : Number(price?.surcharge || 0)) > 0 && (
            <div className="flex justify-between items-center px-2">
              <span className="text-slate-500">رسوم التوصيل المنزلي</span>
              <span className="text-xs font-medium text-slate-700">+{formatNumber(existingEnrollment ? existingEnrollment.surcharge : price?.surcharge)} ريال</span>
            </div>
          )}

          {/* Extra fee */}
          {(() => {
            const efType = existingEnrollment ? existingEnrollment.extraFeeType : (price?.extraFee?.type || null)
            const efAmount = existingEnrollment ? Number(existingEnrollment.extraFeeAmount || 0) : (price?.extraFee?.amount || 0)
            const efLabel = existingEnrollment
              ? (efType === 'NEW_STUDENT' ? 'رسوم طالب جديد' : efType === 'LATE_REGISTRATION' ? 'رسوم طالب متأخر' : null)
              : price?.extraFee?.label || null
            if (efType && efAmount > 0) {
              return (
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-500">{efLabel}</span>
                  <span className="text-xs font-medium text-amber-600">+{formatNumber(efAmount)} ريال</span>
                </div>
              )
            }
            return null
          })()}

          {/* Total */}
          <div className="flex justify-between items-center bg-gradient-to-l from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl px-3 py-2.5 mt-1">
            <span className="text-sm font-bold text-slate-800">الإجمالي</span>
            <span className="text-base font-extrabold text-[var(--color-primary)]">
              {formatNumber(existingEnrollment ? existingEnrollment.finalAmount : (price?.finalAmount || 0))} <span className="text-xs font-medium">ريال</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        {existingEnrollment && !isEnrolling ? (
          existingEnrollment.receiptStatus === 'REJECTED' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 space-y-2">
              <div className="font-bold">تم رفض الطلب</div>
              {existingEnrollment.rejectionReason && (
                <div><span className="font-medium">السبب:</span> {existingEnrollment.rejectionReason}</div>
              )}
              <button onClick={() => { setCampaignEnrolling(campaign.id); setCampaignError(''); setCampaignSuccess('') }}
                className="w-full gradient-primary py-2.5 rounded-xl text-sm font-bold text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all">
                إعادة تقديم الطلب
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-center">
              <span className="font-medium text-slate-700">
                {existingEnrollment.receiptStatus === 'PENDING' ? '✅ طلب قيد الانتظار' :
                 existingEnrollment.receiptStatus === 'APPROVED' ? '✅ تمت الموافقة على طلبك' : ''}
              </span>
            </div>
          )
        ) : isEnrolling ? (
          <div className="space-y-2">
            {campaignError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{campaignError}</p>}
            {campaignSuccess && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg font-medium">{campaignSuccess}</p>}
            <div className="flex gap-2">
              <button onClick={() => handleAddCampaignToCart(campaign)} disabled={campaignSubmitting}
                className="flex-1 gradient-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all">
                {campaignSubmitting ? 'جاري...' : 'إضافة إلى السلة'}
              </button>
              <button onClick={() => { setCampaignEnrolling(null); setCampaignError(''); setCampaignSuccess('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {campaignError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{campaignError}</p>}
            {campaignSuccess && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg font-medium">{campaignSuccess}</p>}
            <button onClick={() => handleAddCampaignToCart(campaign)} disabled={campaignSubmitting}
              className="w-full gradient-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 min-h-[44px] shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)] active:scale-[0.98] transition-all">
              {campaignSubmitting ? 'جاري...' : 'إضافة إلى السلة'}
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderDailyTab() {
    return (
      <div className="space-y-3">
        {/* Active daily subscriptions */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">الاشتراكات اليومية النشطة</h3>
          {activeDailySubscriptions.length > 0 ? (
            <div className="space-y-2">
              {activeDailySubscriptions.map(sub => (
                <DailySubscriptionCard key={sub.id} sub={sub} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">لا توجد اشتراكات يومية نشطة</p>
          )}
        </div>

        {/* New daily request */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-4">طلب اشتراك يومي جديد</h3>
          <div className="space-y-3">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">المدة</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map(w => (
                  <button key={w} onClick={() => setDailyWeeks(w)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                      dailyWeeks === w
                        ? 'gradient-primary text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}>
                    {w === 1 ? 'أسبوع' : `${w} أسابيع`}
                  </button>
                ))}
              </div>
            </div>

            {/* Days selection */}
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">الأيام</label>
              <div className="grid grid-cols-3 gap-2">
                {WEEKDAYS.map(day => (
                  <button key={day.value} onClick={() => toggleDay(day.value)}
                    className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                      dailyDays.includes(day.value)
                        ? 'gradient-primary text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {computedDates.length > 0 && (
              <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 space-y-2 fade-in">
                <div className="text-sm font-bold text-slate-700">ملخص الطلب</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>المدة:</span>
                    <span className="font-semibold">{dailyWeeks === 1 ? 'أسبوع واحد' : `${dailyWeeks} أسابيع`}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>الأيام:</span>
                    <span className="font-semibold truncate max-w-[65%]">{dailyDays.map(d => DAY_NAMES_AR[d]).join('، ')}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-xs text-slate-500 mb-1.5">التواريخ ({computedDates.length}):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {computedDates.map((d, i) => (
                      <span key={i} className="text-xs bg-white px-2 py-1 rounded-lg text-slate-600 border border-slate-100 font-medium">
                        {DAY_NAMES_AR[['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][d.getDay()]]}
                        {' '}{d.toLocaleDateString('en-GB')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-200">
                  <span className="text-sm">الإجمالي:</span>
                  <span className="text-base text-[var(--color-primary)]">{formatNumber(dailyTotal)} ريال</span>
                </div>
                {dailyHomeFee > 0 && (
                  <div className="text-xs text-slate-400">* شامل رسوم التوصيل المنزلي {formatNumber(dailyHomeFee)} ريال لكل يوم</div>
                )}
              </div>
            )}

            {dailyError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{dailyError}</p>}
            {dailySuccess && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg font-medium">{dailySuccess}</p>}

            <button onClick={handleAddDailyToCart} disabled={dailyAddingToCart || computedDates.length === 0}
              className="w-full gradient-primary text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50 min-h-[48px] shadow-[0_6px_16px_-8px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-all">
              {dailyAddingToCart ? 'جاري الإضافة...' : 'إضافة إلى السلة'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderWeeklyTab() {
    return (
      <div className="space-y-2">
        {/* Active weekly subs compact */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3">الاشتراكات الأسبوعية النشطة</h3>
          {activeWeeklySubscriptions.length > 0 ? (
            <div className="space-y-2">
              {activeWeeklySubscriptions.map(sub => (
                <div key={sub.id} className="card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                        <CreditCard size={18} className="text-[var(--color-primary)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800">{PLAN_LABELS[sub.type] || sub.type}</div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          <Clock size={12} className="inline ml-1" />
                          {(asLocalDate(sub.startDate)?.toLocaleDateString('ar-SA') ?? '')} - {(asLocalDate(sub.endDate)?.toLocaleDateString('ar-SA') ?? '')}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={sub.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">لا توجد اشتراكات أسبوعية نشطة</p>
          )}
        </div>

        {/* Campaigns - Active */}
        {activeCampaigns.length > 0 && (
          <div className="bg-white rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3">الحملات النشطة</h3>
            <div className="space-y-3">
              {activeCampaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} />)}
            </div>
          </div>
        )}

        {/* Campaigns - Upcoming */}
        {upcomingCampaigns.length > 0 && (
          <div className="card p-4 border border-amber-300 bg-gradient-to-b from-amber-50/60 to-white">
            <h3 className="text-sm font-bold text-amber-700 mb-3">الحملات القادمة</h3>
            <div className="space-y-3">
              {upcomingCampaigns.map(campaign => <CampaignCard key={campaign.id} campaign={campaign} isUpcoming />)}
            </div>
          </div>
        )}

        {campaigns.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm text-slate-400">لا توجد حالياً حملات اشتراك مفتوحة</p>
          </div>
        )}
      </div>
    )
  }

  function renderCurrentTab() {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">
          {destId ? 'أسعار الاشتراكات حسب وجهتي' : 'أسعار الاشتراكات حسب المنطقة'}
        </h3>
        <div className="overflow-x-auto -mx-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-slate-600">
                <th className="px-4 py-2.5 text-right font-bold">المنطقة</th>
                <th className="px-4 py-2.5 text-right font-bold">4 أسابيع</th>
                <th className="px-4 py-2.5 text-right font-bold">3 أسابيع</th>
                <th className="px-4 py-2.5 text-right font-bold">يومي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(destId ? destPricing : sortedAreaPrices).length > 0 ? (destId ? destPricing : sortedAreaPrices).map(zone => {
                // Prefer destination-specific prices; fall back to zone defaults when missing
                const dailyEntry = zone.prices?.find(p => p.plan === 'DAILY' && String(p.destinationId) === String(destId))
                const threeEntry = zone.prices?.find(p => p.plan === 'THREE_WEEKS' && String(p.destinationId) === String(destId))
                const fourEntry = zone.prices?.find(p => p.plan === 'FOUR_WEEKS' && String(p.destinationId) === String(destId))
                const dailyPrice = dailyEntry ? Number(dailyEntry.price) : (zone.dailyPrice != null ? Number(zone.dailyPrice) : null)
                const threeWeeksPrice = threeEntry ? Number(threeEntry.price) : (zone.threeWeeksPrice != null ? Number(zone.threeWeeksPrice) : null)
                const fourWeeksPrice = fourEntry ? Number(fourEntry.price) : (zone.fourWeeksPrice != null ? Number(zone.fourWeeksPrice) : null)
                const isMyZone = zone.name === zonePricing?.name || zone.id === zonePricing?.id
                const isDestPrice = Boolean(zone.prices?.some(p => String(p.destinationId) === String(destId)))
                return (
                  <tr key={zone.id} className={isMyZone ? 'bg-blue-50' : ''}>
                    <td className={`px-4 py-3 text-sm font-bold ${isMyZone ? 'text-[var(--color-primary)]' : 'text-slate-700'}`}>
                      {zone.name || 'غير محددة'}
                      {isMyZone && <span className="mr-1.5 text-[10px] text-slate-400 font-medium">(منطقتي)</span>}
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDestPrice ? 'text-green-600 font-extrabold' : isMyZone ? 'text-[var(--color-primary)] font-bold' : 'text-slate-700'}`}>
                      {(fourWeeksPrice != null) ? formatNumber(fourWeeksPrice) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{(threeWeeksPrice != null) ? formatNumber(threeWeeksPrice) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{(dailyPrice != null) ? formatNumber(dailyPrice) : '-'}</td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">لا توجد بيانات أسعار متاحة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-slate-400">* الأسعار بالريال اليمني</div>
      </div>
    )
  }

  function renderHistoryTab() {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">سجل الاشتراكات</h3>
        {nonActiveSubscriptions.length > 0 ? (
          <div className="space-y-2">
            {nonActiveSubscriptions.map(sub => (
              <div key={sub.id} className="card p-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                      <FileText size={16} className="text-slate-500 shrink-0" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800">{PLAN_LABELS[sub.type] || sub.type}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {asLocalDate(sub.startDate).toLocaleDateString('ar-SA')} - {asLocalDate(sub.endDate).toLocaleDateString('ar-SA')}
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>المبلغ: <span className="font-bold text-slate-800">{formatNumber(sub.amount)} ريال</span></span>
                  {sub.homeDeliveryFee != null && Number(sub.homeDeliveryFee) > 0 && (
                    <span>التوصيل: <span className="font-bold text-slate-800">{formatNumber(sub.homeDeliveryFee)} ريال</span></span>
                  )}
                  <span>المدفوع: <span className="font-bold text-green-600">{formatNumber(sub.paidAmount)} ريال</span></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">لا توجد اشتراكات محفوظة في السجل</p>
        )}
      </div>
    )
  }

  async function handleConfirmSubmit() {
    setShowSubmitConfirm(false)
    setCartSubmitting(true)
    try {
      await api.cart.submit(cartReceipt, cartDepositReference)
      setCartSuccess('تم إرسال طلب السلة بنجاح، بانتظار الموافقة')
      setCart(null)
      setCartReceipt('')
      setCartDepositReference('')
    } catch (e) {
      setCartError(e.message)
    } finally {
      setCartSubmitting(false)
    }
  }

  async function handleRemoveItem(itemId) {
    const res = await api.cart.removeItem(itemId)
    if (res.cart) {
      const cartRes = await api.cart.get()
      setCart(cartRes.cart)
    } else {
      setCart(null)
    }
  }

  return (
    <div className="space-y-2">
      {cart && (
        <div className="card border-2 border-[var(--color-primary)]/40 p-4 fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
              <ShoppingCart size={20} className="text-[var(--color-primary)]" />
            </div>
            <h3 className="text-sm font-bold text-[var(--color-primary)]">سلة الاشتراكات</h3>
            <span className="text-xs text-slate-400">({(cart.items || []).length} {(cart.items || []).length === 1 ? 'عنصر' : 'عناصر'})</span>
          </div>

          <div className="space-y-2">
            {(cart.items || []).map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 px-3 bg-slate-50/80 border border-slate-100 rounded-xl">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">
                    {item.type === 'DAILY' ? 'اشتراك يومي' : item.type === 'FOUR_WEEKS' ? 'اشتراك 4 أسابيع' : item.type === 'THREE_WEEKS' ? 'اشتراك 3 أسابيع' : item.type}
                    {item.data?.campaignTitle && <span className="text-slate-500 font-medium"> - {item.data.campaignTitle}</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {item.data?.selectedDays?.length > 0 && (
                      <span>{item.data.selectedDays.map(d => DAY_NAMES_AR[d]).join('، ')} · </span>
                    )}
                    {item.data?.weeksCount && <span>{item.data.weeksCount} {item.data.weeksCount === 1 ? 'أسبوع' : 'أسابيع'} · </span>}
                    <span className="font-medium text-slate-700">{formatNumber(item.amount)} ريال</span>
                  </div>
                </div>
                <button onClick={() => handleRemoveItem(item.id)} className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200">
            <span className="text-sm font-bold text-slate-800">الإجمالي</span>
            <span className="text-base font-extrabold text-[var(--color-primary)]">{formatNumber(cart.totalAmount)} <span className="text-xs font-medium">ريال</span></span>
          </div>

          {cartSuccess ? (
            <p className="mt-3 text-sm text-green-600 bg-green-50 p-3 rounded-xl font-medium">{cartSuccess}</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">رقم الإيداع / المرجع</label>
                <input
                  type="text"
                  value={cartDepositReference}
                  onChange={(e) => setCartDepositReference(e.target.value.trimStart())}
                  placeholder="أدخل رقم الإيداع أو المرجع"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-3 cursor-pointer hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors">
                  <Upload size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-500 font-medium">{cartReceipt ? 'تغيير صورة السند' : 'إرفاق صورة سند التحويل'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const webpDataUrl = await convertImageToWebP(file)
                      setCartReceipt(webpDataUrl)
                    } catch (error) {
                      setCartError('تعذر معالجة الصورة، حاول صورة أخرى')
                    }
                  }} />
                </label>
                {cartReceipt && <img src={cartReceipt} alt="السند" className="mt-2 max-h-24 rounded-xl border border-slate-200 shadow-sm" />}
              </div>
              {cartError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{cartError}</p>}
              <button onClick={handleCartSubmit} disabled={cartSubmitting || !cartReceipt || !cartDepositReference.trim()}
                className="w-full gradient-primary text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50 min-h-[48px] shadow-[0_6px_16px_-8px_rgba(37,99,235,0.6)] active:scale-[0.98] transition-all">
                {cartSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1 bg-white/80 border border-slate-200/80 rounded-2xl p-1.5 shadow-card backdrop-blur">
        {tabItems.map((tab) => (
          <NavLink key={tab.key} to={`/student/subscriptions/${tab.key}`} end
            className={({ isActive }) =>
              `rounded-xl py-2.5 text-sm font-bold text-center transition-all ${
                isActive
                  ? 'gradient-primary text-white shadow-[0_4px_12px_-4px_rgba(37,99,235,0.5)]'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`
            }>
            {tab.label}
          </NavLink>
        ))}
      </div>

      {(() => {
        const validTabs = tabItems.map(item => item.key)
        const normalizedPath = location.pathname.replace(/\/+$/, '')
        const pathParts = normalizedPath.split('/').filter(Boolean)
        const lastSegment = pathParts[pathParts.length - 1]
        const currentTab = validTabs.includes(lastSegment) ? lastSegment : 'daily'

        const isBaseStudentSubscriptionsPath = normalizedPath === '/student/subscriptions'
        if (isBaseStudentSubscriptionsPath) {
          return <Navigate to="daily" replace />
        }

        if (currentTab === 'daily') return renderDailyTab()
        if (currentTab === 'weekly') return renderWeeklyTab()
        if (currentTab === 'current') return renderCurrentTab()
        if (currentTab === 'history') return renderHistoryTab()
        return renderDailyTab()
      })()}

      <ConfirmModal
        show={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleConfirmSubmit}
        title="تأكيد إرسال طلب الاشتراك"
        loading={cartSubmitting}
      >
        <p className="mb-3">سيتم إرسال طلب الاشتراك التالي للموافقة:</p>
        <div className="space-y-2 mb-3">
          {cart?.items?.map((item, idx) => (
            <div key={item.id || idx} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="text-sm font-bold text-slate-800">
                {item.type === 'DAILY' ? 'اشتراك يومي' : item.type === 'FOUR_WEEKS' ? 'اشتراك 4 أسابيع' : item.type === 'THREE_WEEKS' ? 'اشتراك 3 أسابيع' : item.type}
                {item.data?.campaignTitle && <span className="text-slate-500 font-medium"> - {item.data.campaignTitle}</span>}
              </div>
              <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                {item.data?.startDate && (
                  <p><span className="text-slate-400">من:</span> {(asLocalDate(item.data.startDate)?.toLocaleDateString('ar-SA') ?? '')} <span className="text-slate-400">إلى:</span> {(asLocalDate(item.data.endDate)?.toLocaleDateString('ar-SA') ?? '')}</p>
                )}
                {item.data?.selectedDays?.length > 0 && (
                  <p><span className="text-slate-400">الأيام:</span> {item.data.selectedDays.map(d => DAY_NAMES_AR[d]).join('، ')}</p>
                )}
                {item.data?.weeksCount && <p><span className="text-slate-400">المدة:</span> {item.data.weeksCount} {item.data.weeksCount === 1 ? 'أسبوع' : 'أسابيع'}</p>}
              </div>
              <div className="text-xs font-bold text-[var(--color-primary)] mt-1">{formatNumber(item.amount)} ريال</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-gradient-to-l from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-xl p-3">
          <span className="text-sm font-bold text-slate-800">الإجمالي</span>
          <span className="text-sm font-extrabold text-[var(--color-primary)]">{formatNumber(cart?.totalAmount)} <span className="text-xs">ريال</span></span>
        </div>
        <p className="text-xs text-slate-400 mt-3">بإرسال الطلب، توافق على شروط الاشتراك في الخدمة.</p>
      </ConfirmModal>
    </div>
  )
}
