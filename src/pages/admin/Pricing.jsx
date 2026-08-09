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
  const [destinations, setDestinations] = useState([])
  const [selectedZoneId, setSelectedZoneId] = useState('')
  const [selectedDestId, setSelectedDestId] = useState('')
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
  const [selectedDestPrices, setSelectedDestPrices] = useState([])
  const [showConfirm, setShowConfirm] = useState(null)

  useEffect(() => {
    initialLoad()
  }, [])

  async function initialLoad() {
    setLoading(true)
    try {
      await Promise.all([loadZones(), loadDestinations()])
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

  async function loadDestinations() {
    try {
      const data = await api.destinations.active()
      setDestinations(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (selectedZoneId) {
      loadZone(selectedZoneId)
    } else {
      setZone(null)
      setSelectedDestId('')
      setPrices({ DAILY: '', THREE_WEEKS: '', FOUR_WEEKS: '' })
      setSelectedDestPrices([])
    }
  }, [selectedZoneId])

  useEffect(() => {
    if (zone && selectedDestId) {
      const destPrices = zone.prices?.filter(p => p.destinationId === selectedDestId) || []
      setSelectedDestPrices(destPrices)
      setPrices({
        DAILY: String(destPrices.find(p => p.plan === 'DAILY')?.price ?? ''),
        THREE_WEEKS: String(destPrices.find(p => p.plan === 'THREE_WEEKS')?.price ?? ''),
        FOUR_WEEKS: String(destPrices.find(p => p.plan === 'FOUR_WEEKS')?.price ?? ''),
      })
    } else if (zone) {
      // No destination selected: clear destination-specific inputs (no defaults)
      setSelectedDestPrices([])
      setPrices({ DAILY: '', THREE_WEEKS: '', FOUR_WEEKS: '' })
    }
  }, [zone, selectedDestId])

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
    if (!selectedDestId) return alert('اختر وجهة لحفظ الأسعار')
    setSaving(true)
    try {
      const destId = selectedDestId || null
      const payload = planTypes.map(item => ({
        plan: item.key,
        price: Number(prices[item.key] || 0),
        destinationId: destId,
      }))
      await api.pricing.update(selectedZoneId, { prices: payload })
      await loadZone(selectedZoneId)
      alert('تم حفظ الأسعار بنجاح')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDestPrices(destId) {
    setShowConfirm({ type: 'destPrices', destId })
  }

  async function confirmedDeleteDestPrices() {
    const destId = showConfirm.destId
    setShowConfirm(null)
    try {
      await api.pricing.update(selectedZoneId, {
        prices: planTypes.map(item => ({
          plan: item.key,
          price: 0,
          destinationId: destId,
        })),
      })
      setSelectedDestId('')
      await loadZone(selectedZoneId)
    } catch (err) {
      alert(err.message)
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
    if (showConfirm?.type === 'destPrices') {
      await confirmedDeleteDestPrices()
    } else if (showConfirm?.type === 'zone') {
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

  // Group only by destination-specific prices (ignore default/null destination)
  const groupedPrices = zone?.prices?.reduce((acc, p) => {
    if (!p.destinationId) return acc
    const key = p.destinationId
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {}) || {}

  return (
    <div className="space-y-6">
      <PageHeader title="إدارة أسعار الاشتراكات" subtitle="تحديد الأسعار حسب المنطقة والوجهة ونوع الاشتراك" />

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

            {/* Destination selector + prices */}
            <div className="mt-4 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">الوجهة</label>
                  <select value={selectedDestId} onChange={(e) => setSelectedDestId(e.target.value)} className="input-field max-w-xs">
                    <option value="">-- اختر وجهة --</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {selectedDestId ? 'تحديد سعر خاص بهذه الوجهة' : 'اختر وجهة لحفظ الأسعار (لا توجد أسعار افتراضية للمنطقة)'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedDestId && (
                    <button onClick={() => handleDeleteDestPrices(selectedDestId)} className="btn-ghost text-red-500"><Trash2 size={16} /> حذف أسعار الوجهة</button>
                  )}
                  <button onClick={handleSavePrices} disabled={saving} className="btn-primary">
                    {saving ? 'جاري الحفظ...' : <><Save size={16} /> حفظ الأسعار للوجهة</>}
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
                          {selectedDestPrices.find(p => p.plan === plan.key) ? 'سعر خاص بالوجهة' : 'سعر غير محدد للوجهة'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          {/* Summary of all destination prices */}
          <Section title="أسعار الوجهات للمنطقة" className="lg:p-5">
            {Object.keys(groupedPrices).length === 0 ? (
              <div className="text-center py-4 text-sm text-[var(--color-text-muted)]">لا توجد أسعار خاصة بالوجهات لهذه المنطقة.</div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-white">
                <table className="min-w-full text-right">
                  <thead className="bg-[var(--color-border-light)]">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium">الوجهة</th>
                      {planTypes.map(p => <th key={p.key} className="px-4 py-3 text-sm font-medium">{p.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedPrices).map(([destId, destPrices]) => {
                      const dest = destinations.find(d => d.id === destId)
                      return (
                        <tr key={destId} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-4 text-sm font-medium">{dest?.name || '-'}</td>
                          {planTypes.map(p => (
                            <td key={p.key} className="px-4 py-4 text-sm">{destPrices.find(dp => dp.plan === p.key)?.price ?? '-'}</td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* All zones prices for selected destination */}
          {selectedDestId && (
            <Section title="أسعار المناطق حسب الوجهة" className="lg:p-5">
              <div className="overflow-x-auto rounded-3xl border border-[var(--color-border)] bg-white">
                <table className="min-w-full text-right">
                  <thead className="bg-[var(--color-border-light)]">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium">المنطقة</th>
                      {planTypes.map(p => <th key={p.key} className="px-4 py-3 text-sm font-medium">{p.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map(z => {
                      // find destination-specific prices for this zone
                      const destPrices = (z.prices || []).filter(p => String(p.destinationId) === String(selectedDestId))
                      return (
                        <tr key={z.id} className="border-t border-[var(--color-border)]">
                          <td className="px-4 py-4 text-sm font-medium">{z.name}</td>
                          {planTypes.map(p => {
                            const row = destPrices.find(dp => dp.plan === p.key)
                            const value = row ? row.price : (p.key === 'DAILY' ? z.dailyPrice : p.key === 'THREE_WEEKS' ? z.threeWeeksPrice : z.fourWeeksPrice)
                            return (
                              <td key={p.key} className="px-4 py-4 text-sm">{(value === undefined || value === null) ? '-' : value}</td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
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
        title={showConfirm?.type === 'zone' ? 'تأكيد حذف المنطقة' : 'تأكيد حذف الأسعار'}
        danger
      >
        {showConfirm?.type === 'zone'
          ? 'هل أنت متأكد من حذف هذه المنطقة وجميع أسعارها؟'
          : 'هل تريد حذف أسعار هذه الوجهة للمنطقة؟'}
      </ConfirmModal>
    </div>
  )
}
