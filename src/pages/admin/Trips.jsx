import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus, Plus, X, Search, Calendar, Filter } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import Section from '../../components/ui/Section'
import ConfirmModal from '../../components/ui/ConfirmModal'

const statusMap = {
  scheduled: 'مجدولة', in_progress: 'قيد التنفيذ', completed: 'مكتملة', cancelled: 'ملغية',
}
const statusColors = {
  scheduled: 'info', in_progress: 'warning', completed: 'success', cancelled: 'error',
}
const lineOptions = [
  { value: '', label: 'اختر الخط' },
  { value: 'JEBALI', label: 'جبلي' },
  { value: 'BAHRY', label: 'بحري' },
]
const periodOptions = [
  { value: 'MORNING', label: 'صباح' },
  { value: 'RETURN', label: 'رجوع' },
]

export default function AdminTrips() {
  const [assignments, setAssignments] = useState([])
  const [students, setStudents] = useState([])
  const [buses, setBuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [filterLine, setFilterLine] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ busId: '', date: '', period: 'MORNING', line: 'JEBALI', pickupTime: '', dropoffTime: '' })
  const [templateStudents, setTemplateStudents] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [extraIds, setExtraIds] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showConfirm, setShowConfirm] = useState(null)

  async function load() {
    try {
      const params = { date }
      if (filterLine) params.line = filterLine
      if (filterPeriod) params.period = filterPeriod
      const [assignData, studentData, busData] = await Promise.all([
        api.assignments.list(params),
        api.students.list({ status: 'active' }),
        api.buses.list({ status: 'active' }),
      ])
      setAssignments(assignData)
      setStudents(studentData)
      setBuses(busData)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date, filterLine, filterPeriod])

  async function loadTemplate(busId) {
    if (!busId) { setTemplateStudents([]); setSelectedIds(new Set()); setExtraIds(new Set()); return }
    try {
      const records = await api.busStudents.list(busId)
      const tStudents = records.map(r => r.student)
      setTemplateStudents(tStudents)
      setSelectedIds(new Set(tStudents.map(s => s.id)))
      setExtraIds(new Set())
    } catch { setTemplateStudents([]); setSelectedIds(new Set()); setExtraIds(new Set()) }
  }

  useEffect(() => { loadTemplate(form.busId) }, [form.busId])

  const nonTemplateStudents = useMemo(() => {
    const templateIds = new Set(templateStudents.map(s => s.id))
    return students.filter(s => !templateIds.has(s.id))
  }, [students, templateStudents])

  function toggleStudent(id) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  function toggleExtra(id) {
    setExtraIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); setSelectedIds(p => { const n = new Set(p); n.delete(id); return n }) }
      else { next.add(id); setSelectedIds(p => { const n = new Set(p); n.add(id); return n }) }
      return next
    })
  }

  async function handleBatchSubmit(e) {
    e.preventDefault()
    if (!form.busId || !form.date) return
    const finalIds = [...selectedIds]
    if (finalIds.length === 0) { alert('يجب اختيار طالب واحد على الأقل'); return }
    setSubmitting(true)
    try {
      const result = await api.assignments.createBatch({
        busId: form.busId, date: form.date, period: form.period, line: form.line,
        pickupTime: form.pickupTime || undefined, dropoffTime: form.dropoffTime || undefined,
        studentIds: finalIds,
      })
      setForm({ busId: '', date: '', period: 'MORNING', line: 'JEBALI', pickupTime: '', dropoffTime: '' })
      setTemplateStudents([]); setSelectedIds(new Set()); setExtraIds(new Set())
      setShowForm(false); load()
      alert(`تم إنشاء ${result.created} رحلة بنجاح${result.created < finalIds.length ? ` (تخطي ${finalIds.length - result.created} مكرر)` : ''}`)
    } catch (err) { alert(err.message) } finally { setSubmitting(false) }
  }

  async function handleStatusChange(id, status) {
    try { await api.assignments.updateStatus(id, status); load() } catch (err) { alert(err.message) }
  }

  async function handleDelete(id) {
    setShowConfirm(id)
  }

  async function handleConfirmed() {
    const id = showConfirm
    setShowConfirm(null)
    try { await api.assignments.delete(id); load() } catch (err) { alert(err.message) }
  }

  function openForm() {
    setForm({ busId: '', date, period: 'MORNING', line: 'JEBALI', pickupTime: '', dropoffTime: '' })
    setTemplateStudents([]); setSelectedIds(new Set()); setExtraIds(new Set()); setEditing(null); setShowForm(true)
  }

  const columns = useMemo(() => [
    { key: 'student', label: 'الطالب', render: (row) => row.student?.name || '-' },
    { key: 'bus', label: 'الحافلة', render: (row) => row.bus?.busNumber || '-' },
    { key: 'driver', label: 'السائق', render: (row) => row.bus?.driver?.name || '-' },
    { key: 'line', label: 'الخط', render: (row) => <StatusBadge status={row.line === 'JEBALI' ? 'jebali' : 'bahry'} label={row.line === 'JEBALI' ? 'جبلي' : 'بحري'} /> },
    { key: 'period', label: 'الفترة', render: (row) => row.period === 'MORNING' ? 'صباح' : 'رجوع' },
    { key: 'pickupTime', label: 'التوصيل', render: (row) => row.pickupTime || '-' },
    { key: 'status', label: 'الحالة', render: (row) => (
      <select value={row.status} onChange={(e) => handleStatusChange(row.id, e.target.value)}
        className="badge text-xs cursor-pointer bg-transparent">
        {Object.entries(statusMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    )},
    { key: 'actions', label: '', render: (row) => (
      <button onClick={() => handleDelete(row.id)} className="btn-ghost btn-sm text-[var(--color-danger)]">حذف</button>
    )},
  ], [])

  if (loading) {
    return (
      <div>
        <PageHeader title="الرحلات" subtitle="جدولة ومتابعة الرحلات اليومية" />
        <Section loading />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="الرحلات" subtitle="جدولة ومتابعة الرحلات اليومية">
        <button onClick={openForm} className="btn-primary"><Plus size={16} /> إضافة رحلة</button>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-2 items-end mb-4">
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">الخط</label>
          <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)} className="select-field">
            <option value="">الكل</option>
            <option value="JEBALI">جبلي</option>
            <option value="BAHRY">بحري</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">الفترة</label>
          <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="select-field">
            <option value="">الكل</option>
            <option value="MORNING">صباح</option>
            <option value="RETURN">رجوع</option>
          </select>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div className="modal-content max-w-[min(95vw,1160px)] lg:max-w-[1200px] p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">إنشاء رحلة جديدة</h2>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="p-1 rounded hover:bg-[var(--color-border-light)]"><X size={18} /></button>
            </div>
            <form onSubmit={handleBatchSubmit} className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">الخط</label>
                  <select value={form.line} onChange={(e) => setForm({ ...form, line: e.target.value })} className="select-field" required>
                    {lineOptions.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الفترة</label>
                  <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className="select-field" required>
                    {periodOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">التاريخ</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">الحافلة</label>
                  <select value={form.busId} onChange={(e) => setForm({ ...form, busId: e.target.value })} className="select-field" required>
                    <option value="">اختر حافلة</option>
                    {buses.map((b) => <option key={b.id} value={b.id}>{b.busNumber}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">وقت التوصيل</label>
                  <input type="time" value={form.pickupTime} onChange={(e) => setForm({ ...form, pickupTime: e.target.value })} className="input-field" />
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold">طلاب قالب الحافلة</h3>
                  <span className="badge">{templateStudents.length} طالب</span>
                </div>
                {!form.busId ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">اختر حافلة أولاً</p>
                ) : templateStudents.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">لا يوجد طلاب في قالب هذه الحافلة</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y">
                    {templateStudents.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-border-light)] cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleStudent(s.id)} className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/50" />
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-[var(--color-text-muted)] mr-auto">{s.zone || ''}</span>
                      </label>
                    ))}
                  </div>
                )}

                {form.busId && nonTemplateStudents.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm text-[var(--color-primary)] cursor-pointer font-medium select-none">
                      إضافة طلاب إضافيين ({extraIds.size > 0 ? `مختار ${extraIds.size}` : 'اختياري'})
                    </summary>
                    <div className="max-h-36 overflow-y-auto border border-[var(--color-border)] rounded-lg divide-y mt-2">
                      {nonTemplateStudents.map(s => (
                        <label key={s.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--color-border-light)] cursor-pointer text-sm">
                          <input type="checkbox" checked={extraIds.has(s.id)} onChange={() => toggleExtra(s.id)} className="rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]/50" />
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-[var(--color-text-muted)] mr-auto">{s.zone || ''}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="text-sm text-[var(--color-text-muted)]">
                  <span className="font-bold text-[var(--color-primary)]">{selectedIds.size}</span> طالب سيتم إنشاء رحلة لهم
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null) }} className="btn-ghost">إلغاء</button>
                  <button type="submit" disabled={submitting || selectedIds.size === 0} className="btn-primary">
                    {submitting ? 'جاري الإنشاء...' : 'إنشاء الرحلة'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={assignments} loading={loading}
        emptyTitle="لا توجد رحلات" emptyDescription="لم يتم إنشاء أي رحلات بعد" emptyAction={{ label: 'إضافة رحلة', onClick: openForm }} />

      <ConfirmModal
        show={!!showConfirm}
        onClose={() => setShowConfirm(null)}
        onConfirm={handleConfirmed}
        title="تأكيد الحذف"
        danger
      >
        هل أنت متأكد من حذف هذه الرحلة؟
      </ConfirmModal>
    </div>
  )
}
