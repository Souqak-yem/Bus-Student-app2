import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Megaphone, Plus, X, Calendar, Users, Search, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import MobileCard from '../../components/ui/MobileCard'
import DiscountExpiryBadge from '../../components/ui/DiscountExpiryBadge'
import { SkeletonCard } from '../../components/ui/Skeleton'
import ConfirmModal from '../../components/ui/ConfirmModal'

const emptyForm = { title: '', description: '', type: 'subscription_3weeks', startDate: '', endDate: '', hasEarlyDiscount: false, discountAmount: '', discountStart: '', discountExpiry: '', enableExtraRegistrationFee: false, extraRegistrationFee: '2000', extraFeeStart: '' }

export default function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(null)

  async function load() {
    try {
      const data = await api.campaigns.list()
      setCampaigns(Array.isArray(data) ? data : [])
    } catch (err) { console.error(err)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const payload = {
        ...form,
        hasEarlyDiscount: form.hasEarlyDiscount,
        discountAmount: form.hasEarlyDiscount ? form.discountAmount : '',
        discountStart: form.hasEarlyDiscount ? form.discountStart : '',
        discountExpiry: form.hasEarlyDiscount ? form.discountExpiry : '',
        enableExtraRegistrationFee: form.enableExtraRegistrationFee,
        extraRegistrationFee: form.enableExtraRegistrationFee ? form.extraRegistrationFee : '',
        extraFeeStart: form.enableExtraRegistrationFee ? form.extraFeeStart : '',
      }
      if (editing) { await api.campaigns.update(editing, payload) }
      else { await api.campaigns.create(payload) }
      setForm(emptyForm); setEditing(null); setShowForm(false); load()
    } catch (err) { alert(err.message) }
  }

  function handleEdit(c) {
    setForm({
      title: c.title, description: c.description || '', type: c.type,
      startDate: c.startDate?.split('T')[0] || '', endDate: c.endDate?.split('T')[0] || '',
      hasEarlyDiscount: c.hasEarlyDiscount || false,
      discountAmount: String(c.discountAmount || ''),
      discountStart: c.discountStart ? c.discountStart.slice(0, 16) : '',
      discountExpiry: c.discountExpiry ? c.discountExpiry.slice(0, 16) : '',
      enableExtraRegistrationFee: c.enableExtraRegistrationFee || false,
      extraRegistrationFee: String(c.extraRegistrationFee || '2000'),
      extraFeeStart: c.extraFeeStart ? c.extraFeeStart.slice(0, 16) : '',
    })
    setEditing(c.id); setShowForm(true)
  }

  async function handleDelete(id) {
    setShowConfirm(id)
  }

  async function handleConfirmed() {
    const id = showConfirm
    setShowConfirm(null)
    try { await api.campaigns.delete(id); load() } catch (err) { alert(err.message) }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return campaigns
    const q = search.trim().toLowerCase()
    return campaigns.filter(c => (c.title || '').toLowerCase().includes(q))
  }, [campaigns, search])

  function formatDate(d) {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('ar-SA')
  }

  function getStatus(c) {
    const now = new Date()
    const end = c.endDate ? new Date(c.endDate) : null
    if (end && end < now) return { label: 'منتهية', color: 'bg-slate-100 text-slate-600', icon: XCircle }
    return { label: 'نشطة', color: 'bg-green-100 text-green-700', icon: CheckCircle }
  }

  function getTypeLabel(t) {
    if (t === 'subscription_3weeks') return 'اشتراك ٣ أسابيع'
    if (t === 'subscription_4weeks') return 'اشتراك ٤ أسابيع'
    return t || '-'
  }

  return (
    <div>
      <PageHeader title="الحملات" subtitle="إدارة حملات التسعير والعروض">
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> حملة جديدة</button>
      </PageHeader>

      {/* Search */}
      <div className="relative mb-3 max-w-xs">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم الحملة..."
          className="input-field pr-9 py-2 text-sm w-full" />
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-xl border border-slate-200">
          <Megaphone size={40} className="text-slate-300 mb-3" />
          <h3 className="text-sm font-semibold text-slate-700 mb-1">لا توجد حملات</h3>
          <p className="text-xs text-slate-400 mb-4">لم يتم إنشاء أي حملات بعد</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">حملة جديدة</button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c, idx) => {
            const status = getStatus(c)
            const StatusIcon = status.icon
            return (
              <MobileCard key={c.id} index={idx} className="bg-white border border-slate-200 p-3 rounded-xl h-full lg:flex-col lg:justify-between">
                {/* Top: title + status */}
                <div className="flex items-center justify-between w-full mb-2">
                  <h3 className="text-sm font-bold text-slate-800 truncate ml-2">{c.title}</h3>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                    <StatusIcon size={10} />
                    {status.label}
                  </span>
                </div>
                {/* Middle: type, period, students */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 w-full mb-3">
                  <span className="inline-flex items-center gap-1">
                    <Megaphone size={12} className="text-slate-400" />
                    {getTypeLabel(c.type)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {formatDate(c.startDate)} → {formatDate(c.endDate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} className="text-slate-400" />
                    {c.approvedEnrollmentsCount ?? 0} طالب
                  </span>
                  {c.hasEarlyDiscount && c.discountExpiry && (
                    <DiscountExpiryBadge expiry={c.discountExpiry} />
                  )}
                </div>
                {/* Description if any */}
                {c.description && (
                  <p className="text-[10px] text-slate-500 w-full mb-2 line-clamp-2">{c.description}</p>
                )}
                {/* Bottom: actions */}
                <div className="flex items-center gap-1.5 w-full border-t border-slate-100 pt-2">
                  <button onClick={() => handleEdit(c)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                    <Edit2 size={12} /> تعديل
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg border border-red-200 text-xs text-red-600 font-medium hover:bg-red-50 transition-colors">
                    <Trash2 size={12} /> حذف
                  </button>
                </div>
              </MobileCard>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-content max-w-[min(95vw,860px)] lg:max-w-[980px]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-bold">{editing ? 'تعديل حملة' : 'حملة جديدة'}</h2>
                <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }} className="p-1.5 rounded-lg hover:bg-[var(--color-border-light)]"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <FormField label="عنوان الحملة" required>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" required />
                </FormField>
                <FormField label="الوصف">
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="textarea-field" rows={2} />
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <FormField label="النوع" required>
                      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="select-field w-full">
                        <option value="subscription_3weeks">اشتراك ٣ أسابيع</option>
                        <option value="subscription_4weeks">اشتراك ٤ أسابيع</option>
                      </select>
                    </FormField>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="تاريخ البداية" required>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" required />
                  </FormField>
                  <FormField label="تاريخ النهاية" required>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" required />
                  </FormField>
                </div>
                {(form.type === 'subscription_3weeks' || form.type === 'subscription_4weeks') && (
                  <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm">الخصم المبكر (اختياري)</h4>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.hasEarlyDiscount} onChange={(e) => setForm({ ...form, hasEarlyDiscount: e.target.checked })} className="w-4 h-4" />
                      تفعيل الخصم المبكر
                    </label>
                    {form.hasEarlyDiscount && (
                      <div className="space-y-3 pr-6">
                        <FormField label="قيمة الخصم (ريال)">
                          <input type="number" value={form.discountAmount} onChange={(e) => setForm({ ...form, discountAmount: e.target.value })} className="input-field" />
                        </FormField>
                        <div className="grid grid-cols-2 gap-3">
                          <FormField label="بداية الخصم">
                            <input type="datetime-local" value={form.discountStart} onChange={(e) => setForm({ ...form, discountStart: e.target.value })} className="input-field" />
                          </FormField>
                          <FormField label="نهاية الخصم">
                            <input type="datetime-local" value={form.discountExpiry} onChange={(e) => setForm({ ...form, discountExpiry: e.target.value })} className="input-field" />
                          </FormField>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {(form.type === 'subscription_3weeks' || form.type === 'subscription_4weeks') && (
                  <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm">الرسوم الإضافية (اختياري)</h4>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.enableExtraRegistrationFee} onChange={(e) => setForm({ ...form, enableExtraRegistrationFee: e.target.checked })} className="w-4 h-4" />
                      تفعيل الرسوم الإضافية
                    </label>
                    {form.enableExtraRegistrationFee && (
                      <div className="space-y-3 pr-6">
                        <FormField label="قيمة الرسوم (ريال)">
                          <input type="number" value={form.extraRegistrationFee} onChange={(e) => setForm({ ...form, extraRegistrationFee: e.target.value })} className="input-field" />
                        </FormField>
                        <FormField label="تاريخ بدء الرسوم (اختياري)">
                          <input type="datetime-local" value={form.extraFeeStart} onChange={(e) => setForm({ ...form, extraFeeStart: e.target.value })} className="input-field" />
                          <p className="text-xs text-slate-400 mt-1">اترك فارغًا لبدء فوري من تاريخ التفعيل</p>
                        </FormField>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button type="submit" className="btn-primary">{editing ? 'حفظ' : 'إنشاء'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }} className="btn-ghost">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        show={!!showConfirm}
        onClose={() => setShowConfirm(null)}
        onConfirm={handleConfirmed}
        title="تأكيد حذف الحملة"
        danger
      >
        هل أنت متأكد من حذف هذه الحملة؟
      </ConfirmModal>
    </div>
  )
}

function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{label}{required && <span className="text-[var(--color-danger)] mr-0.5">*</span>}</label>
      {children}
    </div>
  )
}
