import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, MessageSquare, Search, XCircle, Eye } from 'lucide-react'
import { api } from '../../lib/api'
import DataTable from '../../components/ui/DataTable'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmModal from '../../components/ui/ConfirmModal'

const statusOptions = [
  { value: '', label: 'كل الطلبات' },
  { value: 'PENDING', label: 'قيد الانتظار' },
  { value: 'APPROVED', label: 'مقبول' },
  { value: 'REJECTED', label: 'مرفوض' },
]

const dayLabels = {
  SUNDAY: 'الأحد',
  MONDAY: 'الاثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
  FRIDAY: 'الجمعة',
  SATURDAY: 'السبت',
}

function sanitizeWhatsappNumber(value) {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `966${digits.slice(1)}`
  return digits
}

export default function AdminStudentRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [message, setMessage] = useState('')
  const [previewTarget, setPreviewTarget] = useState(null)
  const [previewPrices, setPreviewPrices] = useState({ daily: '', threeWeeks: '', fourWeeks: '' })
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadRequests()
  }, [searchText, statusFilter])

  async function loadRequests() {
    setLoading(true)
    try {
      const params = { status: statusFilter }
      if (searchText.trim()) params.search = searchText.trim()
      const data = await api.studentPortal.requests(params)
      setRequests(data)
    } catch (err) {
      console.error(err)
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openWhatsApp(number, text) {
    const phone = sanitizeWhatsappNumber(number)
    if (!phone) return
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank')
  }

  function openPreview(request) {
    setPreviewTarget(request)
    setPreviewPrices({ daily: '', threeWeeks: '', fourWeeks: '' })
  }

  async function handleApprove(request) {
    setConfirmTarget(request)
  }

  async function confirmApprove() {
    if (!confirmTarget) return
    setProcessing(true)
    try {
      const payload = {}
      if (confirmTarget.transportMode === 'HOME') {
        if (previewPrices.daily.trim()) payload.homeDeliveryFeeDaily = Number(previewPrices.daily)
        if (previewPrices.threeWeeks.trim()) payload.homeDeliveryFeeThreeWeeks = Number(previewPrices.threeWeeks)
        if (previewPrices.fourWeeks.trim()) payload.homeDeliveryFeeFourWeeks = Number(previewPrices.fourWeeks)
      }
      const result = await api.studentPortal.approveRequest(confirmTarget.id, payload)
      setRequests((prev) => prev.map((item) => item.id === confirmTarget.id ? { ...item, status: 'APPROVED' } : item))
      setMessage(`تمت الموافقة على طلب ${confirmTarget.name}`)
      const phone = confirmTarget.whatsapp || confirmTarget.phone
      const text = `مرحبا ${confirmTarget.name}، تمت الموافقة على طلب التسجيل الخاص بك. اسم المستخدم: ${result.credentials.username}، كلمة المرور: ${result.credentials.password}. يرجى تغيير كلمة المرور بعد أول تسجيل دخول.`
      openWhatsApp(phone, text)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setProcessing(false)
      setConfirmTarget(null)
    }
  }

  async function handleReject(request) {
    setRejectTarget(request)
    setRejectReason('')
  }

  async function confirmReject() {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      setMessage('يرجى كتابة سبب الرفض')
      return
    }
    setProcessing(true)
    try {
      await api.studentPortal.rejectRequest(rejectTarget.id, rejectReason.trim())
      setRequests((prev) => prev.map((item) => item.id === rejectTarget.id ? { ...item, status: 'REJECTED' } : item))
      setMessage(`تم رفض طلب ${rejectTarget.name}`)
      const phone = rejectTarget.whatsapp || rejectTarget.phone
      const text = `مرحبا ${rejectTarget.name}، نأسف لإبلاغك أنه تم رفض طلب التسجيل الخاص بك. السبب: ${rejectReason.trim()}`
      openWhatsApp(phone, text)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setProcessing(false)
      setRejectTarget(null)
    }
  }

  function renderActions(request) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openPreview(request)}
          className="btn-primary btn-sm flex items-center gap-2"
        >
          <Eye size={14} /> معاينة
        </button>
      </div>
    )
  }

  const columns = [
    { key: 'name', label: 'اسم الطالب', render: (r) => r.name },
    { key: 'transportMode', label: 'التوصيل', render: (r) => <StatusBadge status={r.transportMode === 'HOME' ? 'home' : 'line'} /> },
    { key: 'zone', label: 'المنطقة', hideOnMobile: true },
    { key: 'destination', label: 'الوجهة', hideOnMobile: true, render: (r) => r.destination?.name || '-' },
    { key: 'status', label: 'الحالة', render: (r) => <StatusBadge status={r.status.toLowerCase()} /> },
    { key: 'actions', label: 'الإجراءات', render: renderActions },
  ]

  function getRequestSummary(request) {
    const offDaysLabel = request.offDays?.length
      ? request.offDays.map((day) => dayLabels[day] || day).join('، ')
      : '-'

    return [
      { label: 'اسم الطالب', value: request.name || '-' },
      { label: 'رقم الجوال', value: request.phone || '-' },
      { label: 'واتساب', value: request.whatsapp || '-' },
      { label: 'ولي الأمر', value: request.parentName || '-' },
      { label: 'صلة القرابة', value: request.parentRelation || '-' },
      { label: 'المنطقة', value: request.zone || '-' },
      { label: 'الوجهة', value: request.destination?.name || '-' },
      { label: 'التخصص', value: request.major || '-' },
      { label: 'المستوى', value: request.level || '-' },
      { label: 'العنوان', value: request.address || '-' },
      { label: 'نوع التوصيل', value: request.transportMode === 'HOME' ? 'توصيل منزلي' : 'توصيل على الخط' },
      { label: request.transportMode === 'LINE' ? 'نقطة الانتظار' : 'عنوان المنزل', value: request.transportMode === 'LINE' ? request.pickupLocation || '-' : request.homeAddress || '-' },
      { label: 'أيام العطلة', value: offDaysLabel },
      { label: 'الحالة', value: request.status === 'PENDING' ? 'قيد الانتظار' : request.status === 'APPROVED' ? 'مقبول' : 'مرفوض' },
    ]
  }

  function getWhatsAppText(request) {
    return `مرحبا ${request.name}، هذا بخصوص طلب التسجيل الخاص بك. الرجاء التواصل معنا إذا كان لديك أي استفسار.`
  }

  function getHomeDeliveryText(request) {
    return `مرحبا ${request.name}، تم استلام طلب التوصيل المنزلي إلى ${request.homeAddress || 'العنوان غير محدد'}. سنرسل لك السعر حال توفره.`
  }

  return (
    <div className="space-y-4">
      <PageHeader title="طلبات التسجيل" subtitle="راجع ووافق أو ارفض طلبات التسجيل الجديدة" />

      <div className="bg-white rounded-3xl shadow-xl border border-[var(--color-border)] p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-[var(--color-text-secondary)]">استخدم الفلاتر للعثور على طلبات محددة.</div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو رقم الهاتف"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="input-field pr-10 w-full"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field w-full sm:w-52"
              >
                {statusOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin/students')}
            className="btn-ghost btn-sm"
          >
            <ArrowRight size={16} /> إدارة الطلاب
          </button>
        </div>

        {message && (
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text)] mb-4">
            {message}
          </div>
        )}

        <DataTable
          columns={columns}
          data={requests}
          loading={loading}
          searchable={false}
          mobileCards
          emptyTitle="لا توجد طلبات"
          emptyDescription="لا توجد طلبات تسجيل تطابق معايير البحث الحالية."
        />
      </div>

      <ConfirmModal
        show={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={confirmApprove}
        title="تأكيد الموافقة"
        confirmText="موافقة"
        cancelText="إلغاء"
        loading={processing}
      >
        <p>هل أنت متأكد من قبول طلب التسجيل للطالب {confirmTarget?.name}؟</p>
      </ConfirmModal>

      <ConfirmModal
        show={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={confirmReject}
        title="رفض الطلب"
        confirmText="رفض"
        cancelText="إلغاء"
        loading={processing}
        danger
      >
        <div className="space-y-3">
          <p>أدخل سبب رفض طلب التسجيل لـ {rejectTarget?.name}.</p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="مثلاً: بيانات غير مكتملة أو غير متاحة"
            className="input-field w-full min-h-[120px]"
          />
        </div>
      </ConfirmModal>

      <Modal
        show={!!previewTarget}
        onClose={() => setPreviewTarget(null)}
        title={`عرض طلب ${previewTarget?.name || ''}`}
        wide
        footer={previewTarget && (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            {previewTarget.transportMode === 'HOME' && (
              <button
                type="button"
                onClick={() => openWhatsApp(previewTarget.whatsapp || previewTarget.phone, getHomeDeliveryText(previewTarget))}
                className="btn-ghost btn-sm"
              >
                إرسال تسعير التوصيل
              </button>
            )}
            <button
              type="button"
              onClick={() => openWhatsApp(previewTarget.whatsapp || previewTarget.phone, getWhatsAppText(previewTarget))}
              className="btn-ghost btn-sm"
            >
              رسائل واتساب
            </button>
            {previewTarget.status === 'PENDING' && (
              <>
                <button
                  type="button"
                  onClick={() => { setConfirmTarget(previewTarget); setPreviewTarget(null) }}
                  className="btn-primary btn-sm"
                >
                  قبول
                </button>
                <button
                  type="button"
                  onClick={() => { setRejectTarget(previewTarget); setPreviewTarget(null) }}
                  className="btn-ghost btn-sm text-[var(--color-danger)]"
                >
                  رفض
                </button>
              </>
            )}
          </div>
        )}
      >
        {previewTarget && (
          <div className="text-right space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {getRequestSummary(previewTarget).map((field) => (
                <div key={field.label} className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)] mb-2">{field.label}</p>
                  <p className="text-sm sm:text-base">{field.value}</p>
                </div>
              ))}
            </div>

            {previewTarget.transportMode === 'HOME' && (
              <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-sm font-semibold mb-3">أسعار التوصيل المنزلي</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-2">اليومي</label>
                    <input
                      type="number"
                      value={previewPrices.daily}
                      onChange={(e) => setPreviewPrices({ ...previewPrices, daily: e.target.value })}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-2">٣ أسابيع</label>
                    <input
                      type="number"
                      value={previewPrices.threeWeeks}
                      onChange={(e) => setPreviewPrices({ ...previewPrices, threeWeeks: e.target.value })}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--color-text-secondary)] mb-2">٤ أسابيع</label>
                    <input
                      type="number"
                      value={previewPrices.fourWeeks}
                      onChange={(e) => setPreviewPrices({ ...previewPrices, fourWeeks: e.target.value })}
                      className="input-field w-full"
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
                  إذا تركت أي من هذه الحقول فارغاً فلن يتم إرسال إشعار الأسعار لهذا الحقل.
                </p>
              </div>
            )}

            {previewTarget.rejectionReason && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <p className="font-semibold">سبب الرفض</p>
                <p>{previewTarget.rejectionReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
