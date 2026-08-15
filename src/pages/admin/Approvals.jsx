import { useState, useEffect, useMemo } from 'react'
import { CheckCircle, XCircle, Eye, X, ZoomIn, ZoomOut, ExternalLink, CalendarDays, Clock, DollarSign, History, ClipboardList, Filter, ShoppingCart, Copy, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { getStudentGenderTone } from '../../lib/studentGender'
import { formatCurrency, formatNumber } from '../../lib/format'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import MobileCard from '../../components/ui/MobileCard'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ar-SA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('ar-SA', { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })}`
}

const DAY_NAMES_AR = {
  SATURDAY: 'السبت',
  SUNDAY: 'الأحد',
  MONDAY: 'الإثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
}

function getSubscriptionTypeLabel(type) {
  if (type === 'subscription_3weeks') return 'اشتراك ٣ أسابيع'
  if (type === 'subscription_4weeks') return 'اشتراك ٤ أسابيع'
  return type || '-'
}

function StatusBadge({ status, type }) {
  const config = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'مقبول' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'مقبول' },
    expired: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'منتهي' },
    rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'مرفوض' },
    cancelled: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'ملغي' },
  }
  const s = type === 'campaign' && status === 'active' ? 'approved' : status
  const c = config[s] || { bg: 'bg-slate-100', text: 'text-slate-600', label: status }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function SubscriptionTypeBadge({ type }) {
  const label = type === 'DAILY' ? 'يومي' : type === 'subscription_3weeks' ? '٣ أسابيع' : type === 'subscription_4weeks' ? '٤ أسابيع' : type || '-'
  const cls = type === 'DAILY' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function CopyReferenceButton({ value }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (err) {
      console.error('copy failed', err)
    }
  }

  if (!value) return null

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
      title="نسخ رقم الإيداع"
    >
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
      {copied ? 'تم النسخ' : 'نسخ'}
    </button>
  )
}

function ReferenceDisplay({ value }) {
  if (!value) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="mb-1 text-[10px] font-semibold text-slate-500">رقم الإيداع / المرجع</div>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 break-all text-[11px] font-medium text-slate-700">{value}</span>
        <CopyReferenceButton value={value} />
      </div>
    </div>
  )
}

export default function AdminApprovals() {
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [dailySubscriptions, setDailySubscriptions] = useState([])
  const [campaignHistory, setCampaignHistory] = useState([])
  const [dailyHistory, setDailyHistory] = useState([])
  const [activeTab, setActiveTab] = useState('pending')
  const [historyTab, setHistoryTab] = useState('daily')
  const [campaignSearch, setCampaignSearch] = useState('')
  const [dailySearch, setDailySearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectType, setRejectType] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showAddNowModal, setShowAddNowModal] = useState(false)
  const [addNowBuses, setAddNowBuses] = useState([])
  const [addNowSubId, setAddNowSubId] = useState(null)
  const [selectedAddBus, setSelectedAddBus] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [errorCountdown, setErrorCountdown] = useState(0)
  const [suspensionModal, setSuspensionModal] = useState(null)
  const [dailyCarts, setDailyCarts] = useState([])
  const [weeklyCarts, setWeeklyCarts] = useState([])
  const [mixedCarts, setMixedCarts] = useState([])
  const [cartsHistory, setCartsHistory] = useState([])
  const [cartDetail, setCartDetail] = useState(null)

  useEffect(() => {
    Promise.all([
      api.approvals.list(),
      api.cart.approvals.list(),
    ])
      .then(([res, cartRes]) => {
        setEnrollments(res.enrollments || [])
        setDailySubscriptions(res.dailySubscriptions || [])
        setDailyHistory(res.dailyHistory || [])
        setCampaignHistory(res.campaignHistory || [])
        setDailyCarts(cartRes.dailyCarts || [])
        setWeeklyCarts(cartRes.weeklyCarts || [])
        setMixedCarts(cartRes.mixedCarts || [])
        setCartsHistory(cartRes.history || [])
      })
      .catch((err) => { console.error(err); setErrorMsg(err.message || 'خطأ'); setErrorCountdown(5) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!errorMsg) return
    setErrorCountdown(5)
    const interval = setInterval(() => {
      setErrorCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setErrorMsg(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [errorMsg])

  async function handleApprove(id) {
    setActionLoading(true)
    try {
      await api.enrollments.approve(id)
      setEnrollments(prev => prev.filter(e => e.id !== id))
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message)
    } finally { setActionLoading(false) }
  }

  async function handleApproveDaily(id) {
    setActionLoading(true)
    try {
      const res = await api.approvals.approveSubscription(id)
      if (res.needsSuspensionResolution) {
        setSuspensionModal({ subId: id, studentId: res.studentId, studentName: res.studentName })
        return
      }
      setDailySubscriptions(prev => prev.filter(d => d.id !== id))
      if (res.canAddNow && Array.isArray(res.buses) && res.buses.length > 0) {
        setAddNowSubId(id)
        setAddNowBuses(res.buses)
        setSelectedAddBus('')
        setShowAddNowModal(true)
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message)
    } finally { setActionLoading(false) }
  }

  async function handleReactivateAndApprove() {
    if (!suspensionModal) return
    setActionLoading(true)
    try {
      const res = await api.approvals.approveSubscription(suspensionModal.subId, { resolveSuspension: 'reactivate' })
      setDailySubscriptions(prev => prev.filter(d => d.id !== suspensionModal.subId))
      setSuspensionModal(null)
      if (res.canAddNow && Array.isArray(res.buses) && res.buses.length > 0) {
        setAddNowSubId(suspensionModal.subId)
        setAddNowBuses(res.buses)
        setSelectedAddBus('')
        setShowAddNowModal(true)
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message)
    } finally { setActionLoading(false) }
  }

  async function handleApproveOnly() {
    if (!suspensionModal) return
    setActionLoading(true)
    try {
      const res = await api.approvals.approveSubscription(suspensionModal.subId, { resolveSuspension: 'keep' })
      setDailySubscriptions(prev => prev.filter(d => d.id !== suspensionModal.subId))
      setSuspensionModal(null)
      if (res.canAddNow && Array.isArray(res.buses) && res.buses.length > 0) {
        setAddNowSubId(suspensionModal.subId)
        setAddNowBuses(res.buses)
        setSelectedAddBus('')
        setShowAddNowModal(true)
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message)
    } finally { setActionLoading(false) }
  }

  function removeCartFromAll(id) {
    setDailyCarts(prev => prev.filter(c => c.id !== id))
    setWeeklyCarts(prev => prev.filter(c => c.id !== id))
    setMixedCarts(prev => prev.filter(c => c.id !== id))
  }

  async function handleApproveCart(cartId) {
    setActionLoading(true)
    try {
      await api.cart.approvals.approve(cartId)
      removeCartFromAll(cartId)
      setCartDetail(null)
    } catch (err) {
      const msg = err.response?.data?.error || err.message
      setErrorMsg(msg)
      setErrorCountdown(5)
    } finally { setActionLoading(false) }
  }

  async function handleRejectCart(cartId, reason) {
    setActionLoading(true)
    try {
      await api.cart.approvals.reject(cartId, reason)
      removeCartFromAll(cartId)
      setCartDetail(null)
      setShowRejectModal(false)
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message)
    } finally { setActionLoading(false) }
  }

  function openReject(id, type = 'enrollment') {
    setRejectTarget(id)
    setRejectType(type)
    setRejectReason('')
    setShowRejectModal(true)
  }

  async function handleRejectConfirm() {
    if (!rejectTarget) return
    setActionLoading(true)
    try {
      if (rejectType === 'daily') {
        await api.approvals.rejectSubscription(rejectTarget, rejectReason)
        setDailySubscriptions(prev => prev.filter(d => d.id !== rejectTarget))
      } else if (rejectType === 'cart') {
        await api.cart.approvals.reject(rejectTarget, rejectReason)
        removeCartFromAll(rejectTarget)
        setCartDetail(null)
      } else {
        await api.enrollments.reject(rejectTarget, rejectReason)
        setEnrollments(prev => prev.filter(e => e.id !== rejectTarget))
      }
      setShowRejectModal(false)
      setRejectType(null)
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message)
    } finally { setActionLoading(false) }
  }

  const filteredEnrollments = useMemo(() => {
    if (!campaignSearch.trim()) return enrollments
    const q = campaignSearch.trim().toLowerCase()
    return enrollments.filter(row => {
      const studentName = row.student?.name || ''
      const campaignName = row.campaign?.title || row.campaign?.name || ''
      return studentName.toLowerCase().includes(q) || campaignName.toLowerCase().includes(q)
    })
  }, [enrollments, campaignSearch])

  const filteredDailySubscriptions = useMemo(() => {
    if (!dailySearch.trim()) return dailySubscriptions
    const q = dailySearch.trim().toLowerCase()
    return dailySubscriptions.filter(row => {
      const studentName = row.student?.name || ''
      let days = []
      try { days = JSON.parse(row.selectedDays || '[]') } catch { days = [] }
      const dayLabels = days.map(d => DAY_NAMES_AR[d] || d).join('، ')
      return studentName.toLowerCase().includes(q) || dayLabels.toLowerCase().includes(q)
    })
  }, [dailySubscriptions, dailySearch])

  const filteredHistory = useMemo(() => {
    let source
    if (historyTab === 'daily') source = dailyHistory
    else if (historyTab === 'campaign') source = campaignHistory
    else source = cartsHistory
    if (!historySearch.trim()) return source
    const q = historySearch.trim().toLowerCase()
    return source.filter(row => {
      const studentName = row.student?.name || ''
      return studentName.toLowerCase().includes(q)
    })
  }, [dailyHistory, campaignHistory, cartsHistory, historySearch, historyTab])

  const campaignColumns = useMemo(() => [
    {
      key: 'student',
      label: 'الطالب',
      render: (row) => <div className="font-medium text-slate-800">{row.student?.name || '-'}</div>,
    },
    {
      key: 'campaign',
      label: 'الحملة',
      render: (row) => (
        <div className="space-y-0.5 text-sm">
          <div className="font-medium text-slate-800">{row.campaign?.title || row.campaign?.name || '-'}</div>
          <div className="text-slate-400">{getSubscriptionTypeLabel(row.campaign?.type)}</div>
        </div>
      ),
    },
    {
      key: 'period',
      label: 'فترة الاشتراك',
      render: (row) => {
        const start = row.campaign?.startDate
        const end = row.campaign?.endDate
        return (
          <div className="text-sm text-slate-700">
            <div>من: {formatDate(start)}</div>
            <div>إلى: {formatDate(end)}</div>
          </div>
        )
      },
    },
    {
      key: 'pricing',
      label: 'التسعير',
      render: (row) => {
        const base = Number(row.baseAmount) + Number(row.surcharge)
        const disc = Number(row.discount)
        const efType = row.extraFeeType
        const efAmount = Number(row.extraFeeAmount || 0)
        const efLabel = efType === 'NEW_STUDENT' ? 'طالب جديد' : efType === 'LATE_REGISTRATION' ? 'طالب متأخر' : null
        return (
          <div className="text-xs space-y-0.5">
            <div className="text-slate-400">الأساسي: {formatNumber(base)}</div>
            {disc > 0 && <div className="text-green-600">الخصم: {formatNumber(disc)}</div>}
            {efType && efAmount > 0 && (
              <div className="text-amber-600">
                {efLabel}: +{formatNumber(efAmount)}
              </div>
            )}
            <div className="font-medium text-slate-800">النهائي: {formatNumber(row.finalAmount)}</div>
          </div>
        )
      },
    },
    {
      key: 'receipt',
      label: 'السند / المرجع',
      render: (row) => {
        const reference = row.depositReference || row.payments?.[0]?.reference || row.reference || ''
        return (
          <div className="space-y-1.5">
            {row.receiptImage ? (
              <button
                onClick={() => {
                  setSelectedReceipt(row.receiptImage)
                  setZoomLevel(1)
                }}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]"
              >
                <Eye size={14} /> عرض السند
              </button>
            ) : <span className="text-slate-400">لا يوجد سند</span>}
            {reference && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-600 break-all">{reference}</span>
                <CopyReferenceButton value={reference} />
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'createdAt',
      label: 'تاريخ الطلب',
      render: (row) => <div className="text-sm text-slate-700">{formatDateTime(row.createdAt)}</div>,
    },
    {
      key: 'actions',
      label: 'الإجراءات',
      render: (row) => (
        <div className="flex gap-1">
          <button onClick={() => handleApprove(row.id)} disabled={actionLoading} className="btn-ghost btn-sm text-green-600" title="قبول"><CheckCircle size={16} /></button>
          <button onClick={() => openReject(row.id)} className="btn-ghost btn-sm text-[var(--color-danger)]" title="رفض"><XCircle size={16} /></button>
        </div>
      ),
    },
  ], [actionLoading])

  const historyColumns = useMemo(() => [
    {
      key: 'student',
      label: 'الطالب',
      render: (row) => <div className="font-medium text-slate-800">{row.student?.name || '-'}</div>,
    },
    {
      key: 'type',
      label: 'نوع الاشتراك',
      render: (row) => <SubscriptionTypeBadge type={row.type || row.campaign?.type} />,
    },
    {
      key: 'period',
      label: 'الفترة',
      render: (row) => {
        if (row.type === 'DAILY') {
          const dates = row.executionDates || []
          if (dates.length > 0) {
            return (
              <div className="text-xs text-slate-600">
                <div>من: {formatDate(dates[0].executionDate)}</div>
                <div>إلى: {formatDate(dates[dates.length - 1].executionDate)}</div>
              </div>
            )
          }
          return <span className="text-xs text-slate-400">-</span>
        }
        return (
          <div className="text-xs text-slate-600">
            <div>من: {formatDate(row.campaign?.startDate)}</div>
            <div>إلى: {formatDate(row.campaign?.endDate)}</div>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => {
        const status = row.type === 'DAILY' ? row.status : row.receiptStatus === 'APPROVED' ? 'approved' : 'rejected'
        return <StatusBadge status={status} type={row.type === 'DAILY' ? 'daily' : 'campaign'} />
      },
    },
    {
      key: 'processedAt',
      label: 'تاريخ المعالجة',
      render: (row) => {
        const date = row.updatedAt || row.approvedAt
        return <div className="text-xs text-slate-600">{formatDateTime(date)}</div>
      },
    },
  ], [])

  return (
    <div>
      <PageHeader title="طلبات الاشتراكات" subtitle="مراجعة طلبات الاشتراكات" />

      {/* Main Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
            activeTab === 'pending'
              ? 'bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
          }`}
        >
          <ClipboardList size={16} />
          الطلبات المعلقة
          {(enrollments.length + dailySubscriptions.length + dailyCarts.length + weeklyCarts.length + mixedCarts.length) > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {enrollments.length + dailySubscriptions.length + dailyCarts.length + weeklyCarts.length + mixedCarts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
          }`}
        >
          <History size={16} />
          سجل الطلبات
        </button>
      </div>

      {/* ─── PENDING TAB ─── */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {/* Daily Subscriptions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">الاشتراكات اليومية</h2>
                <p className="text-sm text-slate-500">الطلبات اليومية المعلقة</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{filteredDailySubscriptions.length + dailyCarts.length} طلب</span>
                <input value={dailySearch} onChange={(e) => setDailySearch(e.target.value)} placeholder="بحث..." className="input-field w-full min-w-[220px]" />
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <MobileCard key={i} index={i} className="bg-white border border-slate-100 p-4 rounded-xl"><div className="skeleton h-4 w-full rounded" /></MobileCard>)}</div>
            ) : filteredDailySubscriptions.length === 0 && dailyCarts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays size={36} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 mb-1">لا توجد طلبات اشتراك يومي معلقة</h3>
                <p className="text-xs text-slate-400">جميع الطلبات اليومية تمت معالجتها</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDailySubscriptions.length > 0 && (
                  <>
                    <div className="space-y-2 lg:hidden">
                      {filteredDailySubscriptions.map((row, idx) => (
                        <DailyRequestCard key={row.id} row={row} index={idx}
                          actionLoading={actionLoading}
                          onApprove={() => handleApproveDaily(row.id)}
                          onReject={() => openReject(row.id, 'daily')}
                          onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                      ))}
                    </div>
                    <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {filteredDailySubscriptions.map((row, idx) => (
                        <DailyRequestDesktopRow key={row.id} row={row} index={idx}
                          actionLoading={actionLoading}
                          onApprove={() => handleApproveDaily(row.id)}
                          onReject={() => openReject(row.id, 'daily')}
                          onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                      ))}
                    </div>
                  </>
                )}
                {dailyCarts.length > 0 && (
                  <>
                    <div className="space-y-2 lg:hidden">
                      {dailyCarts.map((cart, idx) => (
                        <CartCard key={cart.id} cart={cart} index={idx}
                          actionLoading={actionLoading}
                          onApprove={handleApproveCart}
                          onReject={(id) => { setRejectTarget(id); setRejectType('cart'); setRejectReason(''); setShowRejectModal(true) }}
                          onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                      ))}
                    </div>
                    <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {dailyCarts.map((cart, idx) => (
                        <CartDesktopRow key={cart.id} cart={cart} index={idx}
                          actionLoading={actionLoading}
                          onApprove={handleApproveCart}
                          onReject={(id) => { setRejectTarget(id); setRejectType('cart'); setRejectReason(''); setShowRejectModal(true) }}
                          onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Weekly Subscriptions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">الاشتراكات الأسبوعية</h2>
                <p className="text-sm text-slate-500">اشتراكات ٣ و ٤ أسابيع</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{filteredEnrollments.length + weeklyCarts.length} طلب</span>
                <input value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} placeholder="بحث..." className="input-field w-full min-w-[220px]" />
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <MobileCard key={i} index={i} className="bg-white border border-slate-100 p-4 rounded-xl"><div className="skeleton h-4 w-full rounded" /></MobileCard>)}</div>
            ) : filteredEnrollments.length === 0 && weeklyCarts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList size={36} className="text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 mb-1">لا توجد طلبات اشتراك أسبوعي معلقة</h3>
                <p className="text-xs text-slate-400">جميع الطلبات الأسبوعية تمت معالجتها</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEnrollments.length > 0 && (
                  <DataTable
                    columns={campaignColumns}
                    data={filteredEnrollments}
                    loading={false}
                    mobileCards
                    emptyTitle=""
                    emptyDescription=""
                  />
                )}
                {weeklyCarts.length > 0 && (
                  <>
                    <div className="space-y-2 lg:hidden">
                      {weeklyCarts.map((cart, idx) => (
                        <CartCard key={cart.id} cart={cart} index={idx}
                          actionLoading={actionLoading}
                          onApprove={handleApproveCart}
                          onReject={(id) => { setRejectTarget(id); setRejectType('cart'); setRejectReason(''); setShowRejectModal(true) }}
                          onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                      ))}
                    </div>
                    <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {weeklyCarts.map((cart, idx) => (
                        <CartDesktopRow key={cart.id} cart={cart} index={idx}
                          actionLoading={actionLoading}
                          onApprove={handleApproveCart}
                          onReject={(id) => { setRejectTarget(id); setRejectType('cart'); setRejectReason(''); setShowRejectModal(true) }}
                          onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Mixed Carts */}
          {mixedCarts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-amber-500" />
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">طلبات السلة المختلطة</h2>
                    <p className="text-sm text-slate-500">طلبات تحتوي على اشتراكات يومية وأسبوعية معاً</p>
                  </div>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">{mixedCarts.length} طلب</span>
              </div>
                  <>
                <div className="space-y-2 lg:hidden">
                  {mixedCarts.map((cart, idx) => (
                    <CartCard key={cart.id} cart={cart} index={idx}
                      actionLoading={actionLoading}
                      onApprove={handleApproveCart}
                      onReject={(id) => { setRejectTarget(id); setRejectType('cart'); setRejectReason(''); setShowRejectModal(true) }}
                      onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                  ))}
                </div>
                <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {mixedCarts.map((cart, idx) => (
                    <CartDesktopRow key={cart.id} cart={cart} index={idx}
                      actionLoading={actionLoading}
                      onApprove={handleApproveCart}
                      onReject={(id) => { setRejectTarget(id); setRejectType('cart'); setRejectReason(''); setShowRejectModal(true) }}
                      onViewReceipt={(img) => { setSelectedReceipt(img); setZoomLevel(1) }} />
                  ))}
                </div>
              </>
            </div>
          )}
        </div>
      )}

      {/* ─── HISTORY TAB ─── */}
      {activeTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">سجل الطلبات</h2>
              <p className="text-sm text-slate-500">جميع الطلبات السابقة والمعالجة</p>
            </div>
            <div className="flex items-center gap-2">
              <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="بحث باسم الطالب..." className="input-field w-full min-w-[200px]" />
            </div>
          </div>

          {/* History type tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setHistoryTab('daily')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                historyTab === 'daily'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter size={12} />
              الاشتراكات اليومية
              <span className="text-[10px] opacity-60">({dailyHistory.length})</span>
            </button>
            <button
              onClick={() => setHistoryTab('campaign')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                historyTab === 'campaign'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter size={12} />
              الحملات التخفيضية
              <span className="text-[10px] opacity-60">({campaignHistory.length})</span>
            </button>
            <button
              onClick={() => setHistoryTab('cart')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                historyTab === 'cart'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShoppingCart size={12} />
              سلة الاشتراكات
              <span className="text-[10px] opacity-60">({cartsHistory.length})</span>
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <MobileCard key={i} index={i} className="bg-white border border-slate-100 p-4 rounded-xl"><div className="skeleton h-4 w-full rounded" /></MobileCard>)}</div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History size={36} className="text-slate-300 mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">لا توجد طلبات سابقة</h3>
              <p className="text-xs text-slate-400">سيظهر هنا سجل الطلبات بعد معالجتها</p>
            </div>
          ) : historyTab === 'daily' ? (
            <div className="space-y-2">
              {filteredHistory.map((row, idx) => (
                <HistoryDailyCard key={row.id} row={row} index={idx} />
              ))}
            </div>
          ) : historyTab === 'cart' ? (
            <div className="space-y-2">
              {filteredHistory.map((cart, idx) => (
                <MobileCard key={cart.id} index={idx} className="bg-white border border-slate-200 p-3 rounded-xl">
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
                        {cart.student?.name?.[0] || '?'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">{cart.student?.name || '-'}</h3>
                          <StatusBadge status={cart.status === 'APPROVED' ? 'approved' : 'rejected'} type="campaign" />
                        </div>
                        <p className="text-[10px] text-slate-400">{formatDateTime(cart.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">{cart.items.length} عناصر - الإجمالي: {formatCurrency(cart.totalAmount)}</div>
                  {cart.approvedBy && <div className="text-[10px] text-slate-400 mt-1">بواسطة: {cart.approvedBy.name}</div>}
                </MobileCard>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">الطالب</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">نوع الاشتراك</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">الفترة</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">المبلغ</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">الحالة</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">تاريخ المعالجة</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500">بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">{row.student?.name || '-'}</td>
                      <td className="px-3 py-3"><SubscriptionTypeBadge type={row.campaign?.type} /></td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        من: {formatDate(row.campaign?.startDate)}<br />
                        إلى: {formatDate(row.campaign?.endDate)}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-800">{formatCurrency(row.finalAmount)}</td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.receiptStatus === 'APPROVED' ? 'approved' : 'rejected'}
                          type="campaign"
                        />
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{formatDateTime(row.updatedAt)}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{row.approvedBy?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content max-w-[min(95vw,720px)] lg:max-w-[960px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800">سبب الرفض</h3>
            <p className="text-sm text-slate-500 mb-3">أدخل سبب رفض الاشتراك ثم أكد.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="input-field h-28 w-full" />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowRejectModal(false)} className="btn-ghost">إلغاء</button>
              <button onClick={handleRejectConfirm} disabled={actionLoading} className="btn-primary">تأكيد الرفض</button>
            </div>
          </div>
        </div>
      )}

      {/* Suspension Resolution Modal */}
      {suspensionModal && (
        <div className="modal-overlay" onClick={() => setSuspensionModal(null)}>
          <div className="modal-content max-w-[min(95vw,620px)] lg:max-w-[900px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800">الطالب موقوف مالياً</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              هذا الطالب موقوف حالياً بسبب عدم السداد.
              <br />
              هل تريد إعادة تفعيله مع اعتماد هذا الاشتراك؟
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <button onClick={handleReactivateAndApprove} disabled={actionLoading}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50">
                اعتماد الاشتراك وإعادة التفعيل
              </button>
              <button onClick={handleApproveOnly} disabled={actionLoading}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-medium text-xs hover:bg-slate-200 transition-all disabled:opacity-50">
                اعتماد الاشتراك فقط مع إبقائه موقوفاً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Now Modal */}
      {showAddNowModal && (
        <div className="modal-overlay" onClick={() => setShowAddNowModal(false)}>
          <div className="modal-content max-w-[min(95vw,620px)] lg:max-w-[900px] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800">إضافة الآن</h3>
            <p className="text-sm text-slate-500 mb-3">اختر باص اليوم لإضافة الطالب فوراً.</p>
            <div className="mb-3">
              <label className="block text-sm text-slate-500 mb-1">اختر باص اليوم</label>
              <select value={selectedAddBus} onChange={(e) => setSelectedAddBus(e.target.value)} className="select-field w-full">
                <option value="">اختر باص</option>
                {addNowBuses.map(b => (
                  <option key={b.id} value={b.id}>{b.busNumber} · {b.driver?.name || 'بدون سائق'} · السعة: {b.capacity}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddNowModal(false)} className="btn-ghost">لاحقاً</button>
              <button onClick={async () => {
                if (!selectedAddBus || !addNowSubId) return
                setActionLoading(true)
                try {
                  await api.approvals.addSubscriptionNow(addNowSubId, selectedAddBus)
                  setShowAddNowModal(false)
                  setAddNowSubId(null)
                } catch (err) {
                  setErrorMsg(err.response?.data?.error || err.message)
                } finally { setActionLoading(false) }
              }} className="btn-primary">إضافة الآن</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorMsg && (
        <div className="modal-overlay" onClick={() => setErrorMsg(null)}>
          <div className="modal-content max-w-[min(95vw,640px)] p-6 border border-red-200 bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-red-700">تنبيه</h3>
              <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-slate-600" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-right">
              <p className="text-base font-bold text-red-700 leading-relaxed">{errorMsg}</p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                onClick={() => setErrorMsg(null)}
                className="btn-ghost text-slate-500"
              >
                إغلاق
              </button>
              <button
                onClick={() => setErrorMsg(null)}
                disabled={errorCountdown > 0}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all ${errorCountdown > 0 ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {errorCountdown > 0 ? `تأكيد (${errorCountdown}s)` : 'تأكيد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div className="modal-overlay" onClick={() => setSelectedReceipt(null)}>
          <div className="modal-content max-w-5xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="font-semibold text-slate-800">معاينة السند</h3>
                <p className="text-sm text-slate-500">يمكنك تكبير الصورة أو فتحها كاملة قبل الموافقة</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setZoomLevel(prev => Math.max(1, Number((prev - 0.25).toFixed(2))))} className="btn-ghost btn-sm" title="تصغير"><ZoomOut size={16} /></button>
                <button onClick={() => setZoomLevel(prev => Math.min(2.5, Number((prev + 0.25).toFixed(2))))} className="btn-ghost btn-sm" title="تكبير"><ZoomIn size={16} /></button>
                <button onClick={() => window.open(selectedReceipt, '_blank', 'noopener,noreferrer')} className="btn-ghost btn-sm" title="فتح كامل"><ExternalLink size={16} /></button>
                <button onClick={() => setSelectedReceipt(null)} className="btn-ghost btn-sm" title="إغلاق"><X size={16} /></button>
              </div>
            </div>
            <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-4">
              <img
                src={selectedReceipt}
                alt="سند الاشتراك"
                className="max-h-[70vh] max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-lg"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Daily Request Card ─── */
function DailyRequestCard({ row, index, actionLoading, onApprove, onReject, onViewReceipt }) {
  console.log('Render DailyRequestCard', row?.id)
  let days = []
  try { days = JSON.parse(row.selectedDays || '[]') } catch { days = [] }
  const weeks = row.durationWeeks || 1
  const execDates = row.executionDates || []
  const dailyAmount = execDates.length > 0 ? Math.round(Number(row.amount) / execDates.length) : 0
  const receipt = row.payments?.[0]?.reference
  const receiptDate = row.payments?.[0]?.date
  const zoneName = row.student?.zone || '-'
  const destName = row.student?.destination?.name || null

  return (
    <MobileCard index={index} className={`border p-3 rounded-xl ${getStudentGenderTone(row.student?.gender).card}`}>
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--color-primary-lighter)] flex items-center justify-center text-sm font-bold text-[var(--color-primary-dark)] shrink-0">
            {row.student?.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 truncate">{row.student?.name || '-'}</h3>
              <SubscriptionTypeBadge type="DAILY" />
            </div>
            <p className="text-[10px] text-slate-400">رقم الطلب: #{row.id?.slice(-6)?.toUpperCase() || '-'}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 w-full mb-1">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} className="text-slate-400" />
          <span className="font-medium">{days.map(d => DAY_NAMES_AR[d] || d).join('، ')}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} className="text-slate-400" />
          {weeks} {weeks === 1 ? 'أسبوع' : 'أسابيع'}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={12} className="text-slate-400" />
          {execDates.length} يوم
        </span>
      </div>

      <div className="text-[10px] text-slate-500 mb-1.5">
        المنطقة: {zoneName}{destName ? ` · الوجهة: ${destName}` : ''}
        {receiptDate && <> · تاريخ السند: {formatDate(receiptDate)}</>}
      </div>

      <div className="flex items-center justify-between w-full mb-3 py-1.5 px-2 bg-slate-50 rounded-lg">
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <DollarSign size={12} className="text-slate-400" />
          {formatNumber(dailyAmount)} ريال × {execDates.length} يوم
        </span>
        <span className="text-xs font-bold text-slate-800">
          الإجمالي: {formatCurrency(row.amount)}
        </span>
      </div>

      {paymentReference && <div className="mb-2 w-full"><ReferenceDisplay value={paymentReference} /></div>}
      <div className="flex items-center gap-1.5 w-full flex-wrap">
        {receipt ? (
          <button onClick={() => onViewReceipt(receipt)}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-xs font-medium text-[var(--color-primary)] min-h-[36px]">
            <Eye size={14} /> عرض السند
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 px-2">لا يوجد سند</span>
        )}
        <div className="mr-auto flex gap-1">
          <button onClick={onApprove} disabled={actionLoading}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-medium disabled:opacity-50 min-h-[36px]">
            <CheckCircle size={14} /> قبول
          </button>
          <button onClick={onReject}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors min-h-[36px]">
            <XCircle size={14} /> رفض
          </button>
        </div>
      </div>
    </MobileCard>
  )
}

function DailyRequestDesktopRow({ row, actionLoading, onApprove, onReject, onViewReceipt }) {
  console.log('Render DailyRequestDesktopRow', row?.id)
  let days = []
  try { days = JSON.parse(row.selectedDays || '[]') } catch { days = [] }
  const weeks = row.durationWeeks || 1
  const execDates = row.executionDates || []
  const dailyAmount = execDates.length > 0 ? Math.round(Number(row.amount) / execDates.length) : 0
  const receipt = row.payments?.[0]?.reference
  const paymentReference = row.depositReference || row.payments?.[0]?.reference || ''
  const receiptDate = row.payments?.[0]?.date
  const zoneName = row.student?.zone || '-'
  const destName = row.student?.destination?.name || null

  return (
    <div className={`border rounded-3xl p-5 shadow-sm h-full flex flex-col justify-between ${getStudentGenderTone(row.student?.gender).card}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-lighter)] flex items-center justify-center text-base font-bold text-[var(--color-primary-dark)] shrink-0">
              {row.student?.name?.[0] || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">{row.student?.name || '-'}</h3>
              <p className="text-sm text-slate-500 truncate">طلب #{row.id?.slice(-6)?.toUpperCase() || '-'}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
            يومي
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-2 text-xs text-slate-500">أيام التشغيل</div>
            <div className="font-medium text-slate-900">{days.map(d => DAY_NAMES_AR[d] || d).join('، ') || '-'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-2 text-xs text-slate-500">المدة</div>
            <div className="font-medium text-slate-900">{weeks} {weeks === 1 ? 'أسبوع' : 'أسابيع'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-2 text-xs text-slate-500">عدد الأيام</div>
            <div className="font-medium text-slate-900">{execDates.length} يوم</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-2 text-xs text-slate-500">المنطقة</div>
            <div className="font-medium text-slate-900">{zoneName}{destName ? ` · ${destName}` : ''}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <DollarSign size={14} className="text-slate-500" />
            <span className="font-medium text-slate-900">{formatNumber(dailyAmount)} ريال × {execDates.length} يوم</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-900">الإجمالي: {formatCurrency(row.amount)}</div>
          {receiptDate && <div className="mt-1 text-[11px] text-slate-500">تاريخ السند: {formatDate(receiptDate)}</div>}
        </div>
      </div>

      {paymentReference && <div className="mt-4 w-full"><ReferenceDisplay value={paymentReference} /></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {receipt ? (
          <button onClick={() => onViewReceipt(receipt)}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 px-4 py-2 text-sm font-medium text-[var(--color-primary)]">
            <Eye size={16} /> عرض السند
          </button>
        ) : (
          <span className="text-sm text-slate-500">لا يوجد سند</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={onApprove} disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <CheckCircle size={16} /> قبول
          </button>
          <button onClick={onReject}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
            <XCircle size={16} /> رفض
          </button>
        </div>
      </div>
    </div>
  )
}

function CartDesktopRow({ cart, actionLoading, onApprove, onReject, onViewReceipt }) {
  console.log('Render CartDesktopRow', cart?.id)
  const hasDaily = cart.items.some(item => item.type === 'DAILY')
  const hasWeekly = cart.items.some(item => item.type !== 'DAILY')
  const cartTypeLabel = hasDaily && hasWeekly ? 'مختلط' : hasDaily ? 'يومي' : 'أسبوعي'
  const cartTypeCls = hasDaily && hasWeekly ? 'bg-amber-100 text-amber-700' : hasDaily ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
  const statusLabel = cart.status === 'APPROVED' ? 'مقبول' : cart.status === 'REJECTED' ? 'مرفوض' : 'قيد المراجعة'
  const statusCls = cart.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : cart.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
  const receiptDate = cart.submittedAt ? formatDateTime(cart.submittedAt) : null

  return (
    <div className={`border rounded-3xl p-4 shadow-sm h-full flex flex-col ${getStudentGenderTone(cart.student?.gender).card}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-base font-bold text-emerald-700 shrink-0">
              {cart.student?.name?.[0] || '?'}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">{cart.student?.name || '-'}</h3>
              <p className="text-sm text-slate-500 truncate">طلب #{cart.id?.slice(-6)?.toUpperCase() || '-'}</p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cartTypeCls}`}>{cartTypeLabel}</span>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500">تفاصيل الطلب</div>
              <h4 className="text-sm font-semibold text-slate-900">{cartTypeLabel} · {cart.items.length} عنصر</h4>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cartTypeCls}`}>{cartTypeLabel}</span>
          </div>

          <div className="space-y-3">
            {cart.items.map(item => (
              <CartItemDetail key={item.id} item={item} />
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-slate-700">
          <div className="text-[11px] text-slate-500 mb-1">المجموع النهائي</div>
          <div className="text-2xl font-semibold text-emerald-800">{formatNumber(cart.totalAmount)} ريال</div>
        </div>
      </div>

      {cart.depositReference && <div className="mt-4 w-full"><ReferenceDisplay value={cart.depositReference} /></div>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {cart.receiptImage ? (
          <button onClick={() => onViewReceipt(cart.receiptImage)}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
            <Eye size={16} /> عرض السند
          </button>
        ) : (
          <span className="text-sm text-slate-500">لا يوجد سند</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={() => onApprove(cart.id)} disabled={actionLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <CheckCircle size={16} /> قبول
          </button>
          <button onClick={() => onReject(cart.id)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
            <XCircle size={16} /> رفض
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── History Daily Card ─── */
function HistoryDailyCard({ row, index }) {
  let days = []
  try { days = JSON.parse(row.selectedDays || '[]') } catch { days = [] }
  const execDates = row.executionDates || []

  return (
    <MobileCard index={index} className={`border p-3 rounded-xl ${getStudentGenderTone(row.student?.gender).card}`}>
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700 shrink-0">
            {row.student?.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">{row.student?.name || '-'}</h3>
              <StatusBadge status={row.status} type="daily" />
            </div>
            <p className="text-[10px] text-slate-400">رقم الطلب: #{row.id?.slice(-6)?.toUpperCase() || '-'} · {formatDateTime(row.updatedAt)}</p>
          </div>
        </div>
        <SubscriptionTypeBadge type="DAILY" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 w-full">
        {days.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} className="text-slate-400" />
            <span>{days.map(d => DAY_NAMES_AR[d] || d).join('، ')}</span>
          </span>
        )}
        {execDates.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} className="text-slate-400" />
            من: {formatDate(execDates[0].executionDate)} - إلى: {formatDate(execDates[execDates.length - 1].executionDate)}
          </span>
        )}
        {Number(row.amount) > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            {formatCurrency(row.amount)}
          </span>
        )}
      </div>
    </MobileCard>
  )
}

/* ─── Cart Item Detail ─── */
function CartItemDetail({ item }) {
  const data = item.data || {}
  const isDaily = item.type === 'DAILY'
  const zoneName = item.zone?.name || '-'
  const destName = item.destination?.name || null

  if (isDaily) {
    const selectedDays = Array.isArray(data.selectedDays) ? data.selectedDays : []
    const weeksCount = data.weeksCount || 1
    const computedDates = Array.isArray(data.computedDates) ? data.computedDates : []

    return (
      <div className="bg-white rounded-lg border border-purple-100 p-2.5 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
              يومي
            </span>
            <span className="text-[10px] text-slate-400">{weeksCount} {weeksCount === 1 ? 'أسبوع' : 'أسابيع'}</span>
          </div>
        </div>

        {/* Details section */}
        <div>
          <h4 className="text-[10px] font-semibold text-slate-500 mb-1">تفاصيل الاشتراك</h4>
          <div className="space-y-0.5 text-[11px] text-slate-700">
            {selectedDays.length > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">الأيام:</span>
                <span className="font-medium">{selectedDays.map(d => DAY_NAMES_AR[d] || d).join('، ')}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">عدد الأيام:</span>
              <span className="font-medium">{computedDates.length || `${selectedDays.length * weeksCount} يوم`}</span>
            </div>
            {computedDates.length > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">من:</span>
                  <span className="font-medium">{formatDate(new Date(computedDates[0]))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">إلى:</span>
                  <span className="font-medium">{formatDate(new Date(computedDates[computedDates.length - 1]))}</span>
                </div>
              </>
            )}
            {computedDates.length > 0 && (
              <div className="pt-1 mt-1 border-t border-slate-100">
                <span className="text-slate-500 text-[10px]">جميع التواريخ:</span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {computedDates.map((d, i) => (
                    <span key={i} className="text-[9px] bg-slate-50 px-1 py-0.5 rounded text-slate-600 border border-slate-100">
                      {formatDate(new Date(d))}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pricing section */}
        <div className="pt-1.5 border-t border-slate-100">
          <h4 className="text-[10px] font-semibold text-slate-500 mb-1">التسعير</h4>
          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">المبلغ:</span>
              <span className="font-medium">{formatNumber(item.amount)} ريال</span>
            </div>
            {item.homeDeliveryFee && Number(item.homeDeliveryFee) > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">رسوم التوصيل:</span>
                <span className="font-medium text-amber-600">+{formatNumber(item.homeDeliveryFee)} ريال</span>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="text-[10px] text-slate-400">
          المنطقة: {zoneName}{destName ? ` · الوجهة: ${destName}` : ''}
        </div>
      </div>
    )
  }

  /* THREE_WEEKS / FOUR_WEEKS */
  const planLabel = item.type === 'FOUR_WEEKS' ? '٤ أسابيع' : '٣ أسابيع'
  const planCls = item.type === 'FOUR_WEEKS' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'
  const snapStart = data.startDate ? new Date(data.startDate) : null
  const snapEnd = data.endDate ? new Date(data.endDate) : null
  const campaignTitle = data.campaignTitle || null
  const surcharge = item.homeDeliveryFee ? Number(item.homeDeliveryFee) : 0
  const baseAmount = data.baseAmount != null
    ? Number(data.baseAmount)
    : Number(item.amount) - surcharge
  const discount = Number(data.discount || 0)
  const extraFeeType = data.extraFeeType || null
  const extraFeeAmount = Number(data.extraFeeAmount || 0)
  const extraFeeLabel = extraFeeType === 'NEW_STUDENT' ? 'رسوم طالب جديد' : extraFeeType === 'LATE_REGISTRATION' ? 'رسوم طالب متأخر' : null
  const weeksCount = data.weeksCount || (item.type === 'THREE_WEEKS' ? 3 : 4)

  return (
    <div className="bg-white rounded-lg border border-blue-100 p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${planCls}`}>
            {planLabel}
          </span>
          {campaignTitle && <span className="text-[10px] text-slate-500">- {campaignTitle}</span>}
        </div>
      </div>

      {/* Details section */}
      <div>
        <h4 className="text-[10px] font-semibold text-slate-500 mb-1">تفاصيل الاشتراك</h4>
        <div className="space-y-0.5 text-[11px] text-slate-700">
          {snapStart && (
            <div className="flex justify-between">
              <span className="text-slate-500">من:</span>
              <span className="font-medium">{formatDate(snapStart)}</span>
            </div>
          )}
          {snapEnd && (
            <div className="flex justify-between">
              <span className="text-slate-500">إلى:</span>
              <span className="font-medium">{formatDate(snapEnd)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">المدة:</span>
            <span className="font-medium">{weeksCount} {weeksCount === 1 ? 'أسبوع' : 'أسابيع'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">أيام التشغيل:</span>
            <span className="font-medium">الأحد - الخميس</span>
          </div>
        </div>
      </div>

      {/* Pricing section */}
      <div className="pt-1.5 border-t border-slate-100">
        <h4 className="text-[10px] font-semibold text-slate-500 mb-1">التسعير</h4>
        <div className="space-y-0.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">الأساسي:</span>
            <span className="font-medium">{formatNumber(baseAmount)} ريال</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">الخصم:</span>
              <span className="font-medium text-green-600">-{formatNumber(discount)} ريال</span>
            </div>
          )}
          {extraFeeType && extraFeeAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">{extraFeeLabel}:</span>
              <span className="font-medium text-amber-600">+{formatNumber(extraFeeAmount)} ريال</span>
            </div>
          )}
          {surcharge > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">رسوم التوصيل:</span>
              <span className="font-medium text-amber-600">+{formatNumber(surcharge)} ريال</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-slate-800 pt-0.5 border-t border-slate-100 mt-0.5">
            <span>المجموع:</span>
            <span>{formatNumber(item.amount)} ريال</span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="text-[10px] text-slate-400">
        المنطقة: {zoneName}{destName ? ` · الوجهة: ${destName}` : ''}
      </div>
    </div>
  )
}

/* ─── Cart Approval Card ─── */
function CartCard({ cart, index, actionLoading, onApprove, onReject, onViewReceipt }) {
  console.log('Render CartCard', cart?.id)
  const hasDaily = cart.items.some(item => item.type === 'DAILY')
  const hasWeekly = cart.items.some(item => item.type !== 'DAILY')
  const cartTypeLabel = hasDaily && hasWeekly ? 'مختلط' : hasDaily ? 'يومي' : 'أسبوعي'
  const cartTypeCls = hasDaily && hasWeekly ? 'bg-amber-100 text-amber-700' : hasDaily ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'

  return (
    <MobileCard index={index} className={`border p-3 rounded-xl ${getStudentGenderTone(cart.student?.gender).card}`}>
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700 shrink-0">
            {cart.student?.name?.[0] || '?'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-800 truncate">{cart.student?.name || '-'}</h3>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${cartTypeCls}`}>
                {cartTypeLabel}
              </span>
              <span className="text-[10px] text-slate-400">({cart.items.length})</span>
            </div>
            <p className="text-[10px] text-slate-400">رقم الطلب: #{cart.id?.slice(-6)?.toUpperCase() || '-'}</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 mb-2">
        {cart.items.map(item => (
          <CartItemDetail key={item.id} item={item} />
        ))}
      </div>

      {/* Date info */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 mb-2 px-0.5">
        <div className="inline-flex items-center gap-1">
          <CalendarDays size={11} />
          <span>تاريخ الطلب: {formatDateTime(cart.createdAt)}</span>
        </div>
        {cart.submittedAt && (
          <div className="inline-flex items-center gap-1">
            <Clock size={11} />
            <span>تاريخ السند: {formatDateTime(cart.submittedAt)}</span>
          </div>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between w-full mb-3 py-1.5 px-2 bg-emerald-50 rounded-lg">
        <span className="text-xs text-slate-500">الإجمالي</span>
        <span className="text-sm font-bold text-emerald-700">{formatNumber(cart.totalAmount)} ريال</span>
      </div>

      {/* Actions */}
      {cart.depositReference && <div className="mb-2 w-full"><ReferenceDisplay value={cart.depositReference} /></div>}
      <div className="flex items-center gap-1.5 w-full flex-wrap">
        {cart.receiptImage ? (
          <button onClick={() => onViewReceipt(cart.receiptImage)}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-50 text-xs font-medium text-emerald-700 min-h-[36px]">
            <Eye size={14} /> عرض السند
          </button>
        ) : (
          <span className="text-[10px] text-slate-400 px-2">لا يوجد سند</span>
        )}
        <div className="mr-auto flex gap-1">
          <button onClick={() => onApprove(cart.id)} disabled={actionLoading}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50 min-h-[36px]">
            <CheckCircle size={14} /> قبول
          </button>
          <button onClick={() => onReject(cart.id)}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition-colors min-h-[36px]">
            <XCircle size={14} /> رفض
          </button>
        </div>
      </div>
    </MobileCard>
  )
}

