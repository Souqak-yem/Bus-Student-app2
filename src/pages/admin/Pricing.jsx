import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Plus, Copy, X, Trash2, Save } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import ResponsiveKpiGrid from '../../components/ui/ResponsiveKpiGrid'
import { SkeletonCard } from '../../components/ui/Skeleton'
import ConfirmModal from '../../components/ui/ConfirmModal'

const planTypes = [
  { key: 'DAILY', label: 'يومي' },
  { key: 'THREE_WEEKS', label: '3 أسابيع' },
  { key: 'FOUR_WEEKS', label: '4 أسابيع' },
]

const emptyNewZone = { name: '', dailyPrice: '', threeWeeksPrice: '', fourWeeksPrice: '' }

export default function AdminPricing() {
  const [zones, setZones] = useState([])
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [zone, setZone] = useState(null)
  const [zoneName, setZoneName] = useState('')
  const [prices, setPrices] = useState({ DAILY: '', THREE_WEEKS: '', FOUR_WEEKS: '' })
  const [loading, setLoading] = useState(true)
  const [zoneLoading, setZoneLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingZone, setAddingZone] = useState(false)
  const [newZone, setNewZone] = useState(emptyNewZone)
  const [copySourceId, setCopySourceId] = useState('')
  const [copyTargetId, setCopyTargetId] = useState('')
  const [copying, setCopying] = useState(false)
  const [showConfirm, setShowConfirm] = useState(null)

  useEffect(() => {
    initialLoad()
  }, [])

  async function initialLoad() {
    setLoading(true)
    try {
      await loadZones()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function loadZones() {
    const data = await api.pricing.list()
    setZones(data)
    if (data.length > 0) {
      setSelectedZoneId(data[0].id)
    }
  }

  useEffect(() => {
    if (selectedZoneId) {
      loadZone(selectedZoneId)
    } else {
      setZone(null)
      setPrices({ DAILY: '', THREE_WEEKS: '', FOUR_WEEKS: '' })
    }
  }, [selectedZoneId])

  useEffect(() => {
    if (!zone) return
    setPrices({
      DAILY: zone.dailyPrice != null ? String(zone.dailyPrice) : '',
      THREE_WEEKS: zone.threeWeeksPrice != null ? String(zone.threeWeeksPrice) : '',
      FOUR_WEEKS: zone.fourWeeksPrice != null ? String(zone.fourWeeksPrice) : '',
    })
  }, [zone])

  async function loadZone(id) {
    setZoneLoading(true)
    try {
      const data = await api.pricing.zone(id)
      setZone(data)
      setZoneName(data.name || '')
    } catch (err) {
      console.error(err)
      setZone(null)
    } finally {
      setZoneLoading(false)
    }
  }

  function handleFieldChange(plan, value) {
    setPrices(prev => ({ ...prev, [plan]: value }))
  }

  async function handleSaveZoneInfo() {
    if (!selectedZoneId) return
    setSaving(true)
    try {
      await api.pricing.updateZone(selectedZoneId, { name: zoneName })
      await loadZones()
      alert('تم تحديث اسم المنطقة')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSavePrices() {
    if (!selectedZoneId) return
    setSaving(true)
    try {
      await api.pricing.updateZone(selectedZoneId, {
        dailyPrice: prices.DAILY === '' ? null : Number(prices.DAILY),
        threeWeeksPrice: prices.THREE_WEEKS === '' ? null : Number(prices.THREE_WEEKS),
        fourWeeksPrice: prices.FOUR_WEEKS === '' ? null : Number(prices.FOUR_WEEKS),
      })
      await loadZone(selectedZoneId)
      alert('تم حفظ الأسعار بنجاح')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateZone(e) {
    e.preventDefault()
    setLoading(true)
    try {
      // Create zone without default prices (only name)
      await api.pricing.create({
        name: newZone.name,
      })
      setNewZone(emptyNewZone)
      setAddingZone(false)
      await loadZones()
      alert('تم إنشاء المنطقة بنجاح')
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteZone() {
    if (!selectedZoneId) return
    setShowConfirm({ type: 'zone' })
  }

  async function confirmedDeleteZone() {
    setShowConfirm(null)
    setSaving(true)
    try {
      await api.pricing.delete(selectedZoneId)
      setSelectedZoneId('')
      await loadZones()
      alert('تم حذف المنطقة بنجاح')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmed() {
    if (showConfirm?.type === 'zone') {
      await confirmedDeleteZone()
    }
  }

  async function handleCopyPrices() {
    if (!copySourceId || !copyTargetId) return alert('اختر المصدر والهدف')
    if (copySourceId === copyTargetId) return alert('لا يمكن النسخ إلى نفس المنطقة')
    setCopying(true)
    try {
      await api.pricing.copy(copySourceId, copyTargetId)
      if (copyTargetId === selectedZoneId) await loadZone(selectedZoneId)
      alert('تم نسخ الأسعار بنجاح')
    } catch (err) {
      alert(err.message)
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="إدارة أسعار الاشتراكات" subtitle="تحديد الأسعار حسب المنطقة ونوع الاشتراك" />

      {/* Zone selector and actions */}
      <Section className="lg:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-muted)]">اختر المنطقة لتعديل أسعارها.</p>
            <select value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="input-field max-w-xs">
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setAddingZone(true)} className="btn-primary"><Plus size={16} /> إضافة منطقة</button>
            <button onClick={handleCopyPrices} disabled={copying || zones.length < 2} className="btn-ghost"><Copy size={16} /> نسخ الأسعار</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-sm font-medium mb-1">نسخ من</label>
            <select value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)} className="input-field">
              <option value="">اختر المصدر</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">إلى</label>
            <select value={copyTargetId} onChange={(e) => setCopyTargetId(e.target.value)} className="input-field">
              <option value="">اختر الهدف</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {loading ? (
        <ResponsiveKpiGrid>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</ResponsiveKpiGrid>
      ) : !selectedZoneId ? (
        <Section><div className="text-center py-8 text-sm text-[var(--color-text-muted)]">لا توجد مناطق. أضف منطقة جديدة للبدء.</div></Section>
      ) : zoneLoading ? (
        <ResponsiveKpiGrid>{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</ResponsiveKpiGrid>
      ) : (
        <>
          {/* Zone info */}
          <Section className="lg:p-5">
            <div className="bg-[var(--color-border-light)] p-4 rounded-2xl">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold">المنطقة:</label>
                  <input value={zoneName} onChange={(e) => setZoneName(e.target.value)} className="input-field max-w-xs" />
                  <button onClick={handleSaveZoneInfo} disabled={saving} className="btn-sm btn-primary"><Save size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleDeleteZone} disabled={saving} className="btn-ghost text-[var(--color-danger)]"><Trash2 size={16} /> حذف المنطقة</button>
                </div>
              </div>
            </div>

            {/* Zone prices */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">أسعار المنطقة</label>
                  <p className="text-xs text-[var(--color-text-muted)]">تُطبق هذه الأسعار على جميع الطلاب في المنطقة.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSavePrices} disabled={saving} className="btn-primary">
                    {saving ? 'جاري الحفظ...' : <><Save size={16} /> حفظ أسعار المنطقة</>}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-white">
                <table className="min-w-full text-right">
                  <thead className="bg-[var(--color-border-light)]">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium">نوع الاشتراك</th>
                      <th className="px-4 py-3 text-sm font-medium">السعر</th>
                      <th className="px-4 py-3 text-sm font-medium">المصدر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planTypes.map(plan => (
                      <tr key={plan.key} className="border-t border-[var(--color-border)]">
                        <td className="px-4 py-4 text-sm font-medium">{plan.label}</td>
                        <td className="px-4 py-4">
                          <input type="number" className="input-field w-full max-w-[200px]" value={prices[plan.key]} onChange={e => handleFieldChange(plan.key, e.target.value)} />
                        </td>
                        <td className="px-4 py-4 text-sm text-[var(--color-text-muted)]">
                          سعر موحد للمنطقة
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

        </>
      )}

      {addingZone && (
        <div className="modal-overlay" onClick={() => setAddingZone(false)}>
          <div className="modal-content max-w-[min(95vw,960px)] lg:max-w-[1040px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold">إضافة منطقة جديدة</h2>
              <button onClick={() => setAddingZone(false)} className="p-2 rounded-lg hover:bg-[var(--color-border-light)]"><X size={20} /></button>
            </div>
            <form className="p-5 space-y-4" onSubmit={handleCreateZone}>
              <div>
                <label className="block text-sm font-medium mb-1">اسم المنطقة</label>
                <input required value={newZone.name} onChange={e => setNewZone({ ...newZone, name: e.target.value })} className="input-field w-full" />
              </div>
              {/* No default prices on zone creation - only name is required */}
              <div className="flex gap-2 pt-3 border-t border-[var(--color-border)]">
                <button type="button" onClick={() => setAddingZone(false)} className="btn-ghost flex-1 sm:flex-none justify-center min-h-[44px]">إلغاء</button>
                <button type="submit" className="btn-primary flex-1 sm:flex-none justify-center min-h-[44px]">حفظ المنطقة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        show={!!showConfirm}
        onClose={() => setShowConfirm(null)}
        onConfirm={handleConfirmed}
        title="تأكيد حذف المنطقة"
        danger
      >
        هل أنت متأكد من حذف هذه المنطقة وجميع أسعارها؟
      </ConfirmModal>
    </div>
  )
}
