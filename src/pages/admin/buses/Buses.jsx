import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Bus, Users, Phone } from 'lucide-react'
import { api } from '../../../lib/api'
import PageHeader from '../../../components/ui/PageHeader'
import StatusBadge from '../../../components/ui/StatusBadge'
import DataTable from '../../../components/ui/DataTable'
import ResponsiveKpiGrid from '../../../components/ui/ResponsiveKpiGrid'
import { SkeletonCard } from '../../../components/ui/Skeleton'
import ConfirmModal from '../../../components/ui/ConfirmModal'

const emptyForm = { busNumber: '', capacity: '', vehicleType: '', color: '', driverId: '', driverName: '', primaryPhone: '', secondaryPhone: '' }

function getSuggestedVehicleType(capacity) {
  const parsed = Number(capacity)
  if (!Number.isFinite(parsed) || parsed <= 0) return ''
  if (parsed <= 10) return 'فوكسي'
  if (parsed <= 20) return 'هايس'
  return 'كوستر'
}

export default function AdminBuses() {
  const [buses, setBuses] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [showConfirm, setShowConfirm] = useState(null)

  async function load() {
    try {
      const [busesData, driversData] = await Promise.all([
        api.buses.list({}),
        api.users.list({ role: 'driver', status: 'active' }).catch(() => []),
      ])
      setBuses(busesData)
      setDrivers(driversData)
    } catch (err) { console.error(err)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const normalize = (value) => value?.trim().replace(/\s+/g, ' ').toLowerCase() || ''
      const normalizedDriverName = normalize(form.driverName)
      const exactDriver = drivers.find((driver) => normalize(driver.name) === normalizedDriverName)
      let selectedDriver = exactDriver

      if (!selectedDriver && normalizedDriverName) {
        const partialMatches = drivers.filter((driver) => normalize(driver.name).includes(normalizedDriverName))
        if (partialMatches.length === 1) selectedDriver = partialMatches[0]
      }

      const payload = {
        ...form,
        driverName: form.driverName || null,
        driverId: normalizedDriverName ? (selectedDriver ? selectedDriver.id : form.driverId || '') : '',
      }

      if (editing) { await api.buses.update(editing, payload) }
      else { await api.buses.create(payload) }
      setForm(emptyForm); setEditing(null); setShowForm(false); load()
    } catch (err) { alert(err.message) }
  }

  function handleEdit(b) {
    setForm({
      busNumber: b.busNumber || '', capacity: String(b.capacity),
      vehicleType: b.vehicleType || '', color: b.color || '',
      driverId: b.driverId || '', driverName: b.driverName || b.driver?.name || '', primaryPhone: b.primaryPhone || '', secondaryPhone: b.secondaryPhone || '',
    })
    setEditing(b.id); setShowForm(true)
  }

  async function handleDelete(id) {
    setShowConfirm(id)
  }

  async function handleConfirmed() {
    const id = showConfirm
    setShowConfirm(null)
    try { await api.buses.delete(id); load() } catch (err) { alert(err.message) }
  }

  const columns = [
    { key: 'busNumber', label: 'رقم الباص', render: (r) => <Link to={`/admin/buses/${r.id}`} className="link">{r.busNumber}</Link> },
    { key: 'vehicleType', label: 'نوع المركبة', hideOnMobile: true, render: (r) => r.vehicleType || '-' },
    { key: 'capacity', label: 'السعة', hideOnMobile: true },
    { key: 'students', label: 'الطلاب', hideOnMobile: true, render: (r) => <span className="text-xs font-medium text-[var(--color-text-muted)]">{r.templateStudents?.length ?? r._count?.templateStudents ?? 0}</span> },
    { key: 'driver', label: 'السائق', render: (r) => r.driver?.name || r.driverName || '-' },
    { key: 'phone', label: 'الجوال', hideOnMobile: true, render: (r) => <span className="dir=ltr text-xs">{r.primaryPhone || r.driver?.phone || '-'}</span> },
    { key: 'status', label: 'الحالة', render: (r) => <StatusBadge status={r.status === 'active' ? 'active' : 'maintenance'} /> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => handleEdit(r)} className="btn-ghost btn-sm text-xs">تعديل</button>
        <button onClick={() => handleDelete(r.id)} className="btn-ghost btn-sm text-xs text-[var(--color-danger)]">حذف</button>
      </div>
    )},
  ]

  if (loading) {
    return (
      <div>
        <PageHeader title="الحافلات" subtitle="إدارة الحافلات وتعيين السائقين" />
        <ResponsiveKpiGrid>{[1,2,3].map(i => <SkeletonCard key={i} />)}</ResponsiveKpiGrid>
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-4 sm:p-6 mt-6"><div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}</div></div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="الحافلات" subtitle="إدارة الحافلات وتعيين السائقين">
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> إضافة حافلة</button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={buses}
        mobileCards
        searchPlaceholder="بحث برقم الباص أو اسم السائق..."
        emptyTitle="لا يوجد حافلات"
        emptyDescription="لم يتم إضافة أي حافلة بعد. أضف حافلة جديدة للبدء."
        emptyAction={() => setShowForm(true)}
        emptyActionText="إضافة حافلة"
        onRowClick={(row) => window.location.href = `/admin/buses/${row.id}`}
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
                    <Bus size={14} className="text-[var(--color-text-muted)]" />
                    <span className="text-sm font-medium">{row.busNumber || 'باص'}</span>
                  </div>
                  <StatusBadge status={row.status === 'active' ? 'active' : 'maintenance'} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1"><Users size={10} /> {row.driver?.name || row.driverName || 'بدون سائق'}</span>
                  {row.primaryPhone && <span className="flex items-center gap-1"><Phone size={10} /> {row.primaryPhone}</span>}
                  <span>{`السعة: ${row.capacity || 0}`}</span>
                </div>
                <div className="flex gap-1">
                  <Link to={`/admin/buses/${row.id}`} className="btn-ghost btn-sm text-xs">عرض</Link>
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(row) }} className="btn-ghost btn-sm text-xs">تعديل</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id) }} className="btn-ghost btn-sm text-xs text-[var(--color-danger)]">حذف</button>
                </div>
              </div>
            </td>
          </>
        )}
      />

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal-overlay" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="modal-content max-w-[min(95vw,1000px)] lg:max-w-[1080px]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
                <h2 className="text-lg font-bold">{editing ? 'تعديل حافلة' : 'إضافة حافلة جديدة'}</h2>
                <button onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }} className="p-2 rounded-lg hover:bg-[var(--color-border-light)]"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="اسم السائق">
                    <input
                      list="driver-names"
                      value={form.driverName}
                      onChange={(e) => {
                        const value = e.target.value
                        const selectedDriver = drivers.find((driver) => driver.name === value)
                        setForm({
                          ...form,
                          driverName: value,
                          driverId: selectedDriver ? selectedDriver.id : '',
                        })
                      }}
                      className="input-field"
                      placeholder="أدخل اسم السائق"
                    />
                    <datalist id="driver-names">
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.name} />
                      ))}
                    </datalist>
                  </FormField>
                  <FormField label="رقم الباص" required>
                    <input value={form.busNumber} onChange={(e) => setForm({ ...form, busNumber: e.target.value })} className="input-field" required />
                  </FormField>
                  <FormField label="السعة" required>
                    <input
                      type="number"
                      min="1"
                      value={form.capacity}
                      onChange={(e) => {
                        const nextCapacity = e.target.value
                        const suggestedType = getSuggestedVehicleType(nextCapacity)
                        setForm((prev) => {
                          const previousSuggestedType = getSuggestedVehicleType(prev.capacity)
                          const shouldAutoSelect = !prev.vehicleType || prev.vehicleType === previousSuggestedType
                          return {
                            ...prev,
                            capacity: nextCapacity,
                            vehicleType: shouldAutoSelect && suggestedType ? suggestedType : prev.vehicleType,
                          }
                        })
                      }}
                      className="input-field"
                      required
                    />
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">إذا كانت السعة 1-10 يتم اختيار "فوكسي" تلقائياً، و11-20 "هايس"، وأكثر من 20 "كوستر".</p>
                  </FormField>
                  <FormField label="نوع المركبة">
                    <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })} className="select-field">
                      <option value="">اختر نوع المركبة</option>
                      <option value="كوستر">كوستر</option>
                      <option value="هايس">هايس</option>
                      <option value="فوكسي">فوكسي</option>
                    </select>
                  </FormField>
                  <FormField label="اللون">
                    <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="input-field" />
                  </FormField>
                  <FormField label="جوال رئيسي">
                    <input value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })} className="input-field" />
                  </FormField>
                  <FormField label="جوال ثانوي">
                    <input value={form.secondaryPhone} onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })} className="input-field" />
                  </FormField>
                </div>
                <div className="flex gap-2 pt-3 border-t border-[var(--color-border)] sticky bottom-0 bg-white -mx-3 sm:-mx-6 px-3 sm:px-6 pb-0 max-sm:pb-[80px] mt-4">
                  <button type="submit" className="btn-primary flex-1 sm:flex-none justify-center min-h-[44px]">{editing ? 'حفظ' : 'إضافة'}</button>
                  <button type="button" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm) }} className="btn-ghost flex-1 sm:flex-none justify-center min-h-[44px]">إلغاء</button>
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
        title="تأكيد حذف الحافلة"
        danger
      >
        هل أنت متأكد من حذف هذه الحافلة؟
      </ConfirmModal>
    </div>
  )
}

function FormField({ label, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{label}{required && <span className="text-[var(--color-danger)] mr-0.5">*</span>}</label>
      {children}
    </div>
  )
}
