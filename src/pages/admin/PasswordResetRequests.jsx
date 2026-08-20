import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, XCircle, Clock3, Search, UserCheck, UserX } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'

export default function PasswordResetRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  async function load() {
    try {
      const data = await api.admin.passwordResetRequests.list()
      setRequests(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim()
    if (!term) return requests
    return requests.filter((row) => {
      const haystack = `${row.username || ''} ${row.studentName || ''} ${row.phone || ''} ${row.parentName || ''}`.toLowerCase()
      return haystack.includes(term.toLowerCase())
    })
  }, [requests, search])

  function openWhatsAppMessage(link, message) {
    if (!link) {
      alert('لا يوجد رقم واتساب صالح لهذا الطلب')
      return
    }

    const separator = link.includes('?') ? '&' : '?'
    window.location.assign(`${link}${separator}text=${encodeURIComponent(message)}`)
  }

  async function handleApprove(id) {
    setActionLoading(id)
    try {
      const result = await api.admin.passwordResetRequests.approve(id)
      openWhatsAppMessage(result.whatsappLink, result.message)
      await load()
    } catch (error) {
      alert(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id) {
    const reason = window.prompt('سبب الرفض؟', 'بيانات الطالب غير متطابقة')
    if (reason === null) return
    setActionLoading(id)
    try {
      const result = await api.admin.passwordResetRequests.reject(id, reason)
      openWhatsAppMessage(result.whatsappLink, result.message)
      await load()
    } catch (error) {
      alert(error.message)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="طلبات استعادة كلمة المرور" subtitle="مراجعة الطلبات قبل إعطاء كلمة مرور مؤقتة" />

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-3 shadow-sm">
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم المستخدم أو الطالب أو الهاتف"
            className="input-field pr-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-text-muted)]">
          جاري تحميل الطلبات...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-6 text-center text-sm text-[var(--color-text-muted)]">
          لا توجد طلبات لإستعادة كلمة المرور.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => (
            <div key={request.id} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--color-text)]">{request.username || '—'}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${request.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : request.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {request.status === 'PENDING' ? <Clock3 size={12} /> : request.status === 'APPROVED' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {request.status === 'PENDING' ? 'قيد المراجعة' : request.status === 'APPROVED' ? 'موافق' : 'مرفوض'}
                    </span>
                  </div>

                  <div className="grid gap-1 text-sm text-[var(--color-text-secondary)] md:grid-cols-2">
                    <div><strong>اسم الطالب:</strong> {request.studentName || '—'}</div>
                    <div><strong>رقم الهاتف:</strong> {request.phone || '—'}</div>
                    <div><strong>اسم ولي الأمر:</strong> {request.parentName || '—'}</div>
                    <div><strong>تاريخ الطلب:</strong> {request.requestedAt ? new Date(request.requestedAt).toLocaleString('ar-SA') : '—'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${request.userExists ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {request.userExists ? <UserCheck size={12} /> : <UserX size={12} />}
                      {request.userExists ? 'اسم المستخدم موجود' : 'اسم المستخدم غير موجود'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${request.phoneMatches ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {request.phoneMatches ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {request.phoneMatches ? 'رقم الهاتف مطابق' : 'رقم الهاتف غير مطابق'}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${request.parentMatches ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {request.parentMatches ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {request.parentMatches ? 'اسم ولي الأمر مطابق' : 'اسم ولي الأمر غير مطابق'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(request.id)}
                    disabled={actionLoading === request.id || request.status !== 'PENDING'}
                    className="btn-primary btn-sm inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle size={14} /> موافقة
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(request.id)}
                    disabled={actionLoading === request.id || request.status !== 'PENDING'}
                    className="btn-ghost btn-sm inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle size={14} /> رفض
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
