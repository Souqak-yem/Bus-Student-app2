import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeftRight, Plus, X, Calendar } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import StatusBadge from '../../components/ui/StatusBadge'
import DataTable from '../../components/ui/DataTable'
import { SkeletonCard } from '../../components/ui/Skeleton'
import ConfirmModal from '../../components/ui/ConfirmModal'

const emptyForm = { studentId: '', fromBusId: '', toBusId: '', startDate: '', endDate: '', reason: '' }

export default function AdminTransfers() {
  const [transfers, setTransfers] = useState([])
  const [students, setStudents] = useState([])
  const [buses, setBuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [studentSearch, setStudentSearch] = useState('')
  const [showConfirm, setShowConfirm] = useState(null)

  async function load() {
    try {
      const [t, s, b] = await Promise.all([
        api.transfers.list({}).catch(() => []),
        api.students.list({}).catch(() => []),
        api.buses.list({}).catch(() => []),
      ])
      setTransfers(Array.isArray(t) ? t : [])
      setStudents(Array.isArray(s) ? s : [])
      setBuses(Array.isArray(b) ? b : [])
    } catch (err) { console.error(err)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filteredStudents = students.filter(s =>
    s.status === 'active' && (!studentSearch || s.name?.includes(studentSearch) || s.phone?.includes(studentSearch))
  )

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      if (editing) { await api.transfers.cancel(editing) }
      await api.transfers.create(form)
      setForm(emptyForm); setEditing(null); setShowForm(false); load()
    } catch (err) { alert(err.message) }
  }

  async function handleCancel(id) {
    setShowConfirm(id)
  }

  async function handleConfirmed() {
    const id = showConfirm
    setShowConfirm(null)
    try { await api.transfers.cancel(id); load() } catch (err) { alert(err.message) }
  }

  const columns = [
    { key: 'student', label: 'الطالب', render: (r) => r.student?.name || r.studentId },
    { key: 'from', label: 'من باص', render: (r) => r.fromBus?.busNumber || r.fromBusId },
    { key: 'to', label: 'إلى باص', render: (r) => r.toBus?.busNumber || r.toBusId },
    { key: 'dates', label: 'المدة', hideOnMobile: true, render: (r) => `${r.startDate ? new Date(r.startDate).toLocaleDateString('ar-SA') : ''} - ${r.endDate ? new Date(r.endDate).toLocaleDateString('ar-SA') : ''}` },
    { key: 'status', label: 'الحالة', render: (r) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} label={r.isActive ? 'نشط' : 'ملغي'} /> },
    { key: 'reason', label: 'السبب', hideOnMobile: true },
    { key: 'actions', label: '', render: (r) => r.isActive ? <button onClick={(e) => { e.stopPropagation(); handleCancel(r.id) }} className="btn-ghost btn-sm text-xs text-[var(--color-danger)]">إلغاء</button> : null },
  ]

  return (
    <div>
      <PageHeader title="التحويلات" subtitle="إدارة التحويلات المؤقتة بين الباصات">
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> تحويل جديد</button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={transfers}
        mobileCards
        searchPlaceholder="بحث باسم الطالب أو رقم الباص..."
        emptyTitle="لا توجد تحويلات"
        emptyDescription="لم يتم إنشاء أي تحويلات بعد"
        emptyAction={() => setShowForm(true)}
        emptyActionText="تحويل جديد"
        renderRow={(row, visibleCols) => (
          <>
            {visibleCols.map(col => (
              <td key={col.key} className="max-sm:hidden px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-[var(--color-border-light)]">
                {col.render ? col.render(row) : row[col.key] ?? '-'}
              </td>
            ))}
            <td className="sm:hidden block p-0 border-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight size={12} className="text-[var(--color-text-muted)]" />
                    <span className="text-sm font-medium">{row.student?.name || row.studentId}</span>
                  </div>
                  <StatusBadge status={row.isActive ? 'active' : 'inactive'} label={row.isActive ? 'نشط' : 'ملغي'} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span>من: {row.fromBus?.busNumber || row.fromBusId}</span>
                  <span>إلى: {row.toBus?.busNumber || row.toBusId}</span>
                  {row.startDate && <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(row.startDate).toLocaleDateString('ar-SA')}</span>}
                  {row.endDate && <span>- {new Date(row.endDate).toLocaleDateString('ar-SA')}</span>}
                </div>
                <div className="flex gap-1">
                  {row.isActive && (
                    <button onClick={(e) => { e.stopPropagation(); handleCancel(row.id) }} className="btn-ghost btn-sm text-xs text-[var(--color-danger)]">إلغاء</button>
                  )}
                </div>
              </div>
            </td>
          </>
        )}
      />

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => { setShowForm(false); setForm(emptyForm) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-content max-w-[min(95vw,860px)] lg:max-w-[980px]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-bold">تحويل طالب</h2>
                <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="p-2 rounded-lg hover:bg-[var(--color-border-light)]"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <FormField label="الطالب" required>
                  <input type="text" placeholder="بحث..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="input-field mb-2" />
                  <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className="select-field" size={4}>
                    <option value="">اختر طالباً</option>
                    {filteredStudents.map(s => <option key={s.id} value={s.id}>{s.name} - {s.zone || ''}</option>)}
                  </select>
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="من باص" required>
                    <select value={form.fromBusId} onChange={(e) => setForm({ ...form, fromBusId: e.target.value })} className="select-field" required>
                      <option value="">اختر</option>
                      {buses.map(b => <option key={b.id} value={b.id}>{b.busNumber}</option>)}
                    </select>
                  </FormField>
                  <FormField label="إلى باص" required>
                    <select value={form.toBusId} onChange={(e) => setForm({ ...form, toBusId: e.target.value })} className="select-field" required>
                      <option value="">اختر</option>
                      {buses.map(b => <option key={b.id} value={b.id}>{b.busNumber}</option>)}
                    </select>
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="تاريخ البداية" required>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="input-field" required />
                  </FormField>
                  <FormField label="تاريخ النهاية" required>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="input-field" required />
                  </FormField>
                </div>
                <FormField label="السبب">
                  <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="textarea-field" rows={2} />
                </FormField>
                <div className="flex gap-2 pt-3 border-t border-[var(--color-border)] sticky bottom-0 bg-white -mx-3 sm:-mx-5 px-3 sm:px-5 pb-0 max-sm:pb-[80px] mt-4">
                  <button type="submit" className="btn-primary flex-1 sm:flex-none justify-center min-h-[44px]">إنشاء التحويل</button>
                  <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm) }} className="btn-ghost flex-1 sm:flex-none justify-center min-h-[44px]">إلغاء</button>
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
        title="تأكيد إلغاء التحويل"
        danger
      >
        هل أنت متأكد من إلغاء هذا التحويل؟
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
