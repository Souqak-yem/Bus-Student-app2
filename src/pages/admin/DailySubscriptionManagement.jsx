import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bus, MapPin, Calendar, AlertTriangle, Check, RefreshCw, X } from 'lucide-react'
import { api } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { onDailyExceptionsUpdate, offDailyExceptionsUpdate } from '../../lib/socket'

export default function DailySubscriptionManagement() {
  const [dailySubs, setDailySubs] = useState([])
  const [buses, setBuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [busesLoading, setBusesLoading] = useState(false)
  const [busPickupTimes, setBusPickupTimes] = useState({})

  useEffect(() => {
    onDailyExceptionsUpdate(() => { load() })
    return () => offDailyExceptionsUpdate()
  }, [])

  async function load() {
    const calls = [api.dailySubscriptions.manage(), api.operations.getToday()]
    const [dailyRes, opRes] = await Promise.allSettled(calls)
    if (dailyRes.status === 'fulfilled') {
      setDailySubs(dailyRes.value.dailySubscriptions || [])
    }
    if (opRes.status === 'fulfilled') {
      setBuses(opRes.value?.buses || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleOpenAssign(studentId) {
    const sub = dailySubs.find(item => item.studentId === studentId)
    setSelectedSub(studentId)
    setBusPickupTimes({ default: sub?.pickupTime || '' })
    setBusesLoading(true)
    try {
      const op = await api.operations.getToday()
      setBuses(op?.buses || [])
    } catch {
      setBuses([])
    } finally {
      setBusesLoading(false)
    }
  }

  async function handleConfirmBus(busId, pickupTime) {
    const studentId = selectedSub
    if (!studentId) return
    setAssigningId(studentId)
    try {
      await api.operations.addStudent(busId, studentId, pickupTime)
      setSelectedSub(null)
      setBusPickupTimes({})
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setAssigningId(null)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="إدارة الاشتراكات اليومية" subtitle="الطلاب ذوو الاشتراكات اليومية غير الموزعين" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="إدارة الاشتراكات اليومية" subtitle="جميع الاشتراكات غير الموزعة">
        <button onClick={load} className="btn-ghost btn-sm">
          <RefreshCw size={16} /> تحديث
        </button>
      </PageHeader>

      <DailyTab
        subscriptions={dailySubs}
        buses={buses}
        busesLoading={busesLoading}
        assigningId={assigningId}
        selectedSub={selectedSub}
        onOpenAssign={handleOpenAssign}
        onConfirmBus={handleConfirmBus}
        onClose={() => setSelectedSub(null)}
        busPickupTimes={busPickupTimes}
        setBusPickupTimes={setBusPickupTimes}
      />
    </div>
  )
}

function DailyTab({ subscriptions, buses, busesLoading, assigningId, selectedSub, onOpenAssign, onConfirmBus, onClose, busPickupTimes, setBusPickupTimes }) {
  if (subscriptions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[40vh]"
      >
        <div className="card p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold mb-2">جميع الطلاب موزعون</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            لا يوجد طلاب باشتراك يومي غير موزعين على باصات اليوم
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subscriptions.map((sub, idx) => {
          const isAssigning = assigningId === sub.studentId
          const bs = sub.defaultBus
          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg">{sub.student.name}</span>
                    {sub.isOffDay && <StatusBadge status="in_progress" label="تجاوز إجازة" />}
                  </div>

                  <div className="space-y-1 text-sm text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} />
                      <span>{sub.student.zone || 'بدون منطقة'}</span>
                      {sub.student.destinationName && (
                        <><span className="text-[var(--color-border)]">|</span><span>{sub.student.destinationName}</span></>
                      )}
                    </div>

                    {bs ? (
                      <div className="flex items-center gap-2">
                        <Bus size={14} />
                        <span>الباص الأساسي: {bs.busNumber}</span>
                        {sub.pickupTime && <span>· {sub.pickupTime}</span>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle size={14} />
                        <span>لا يوجد باص افتراضي</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      <span>{new Date(sub.createdAt).toLocaleDateString('ar-SA')}</span>
                      {sub.amount && <><span className="text-[var(--color-border)]">|</span><span>{Number(sub.amount).toFixed(2)} ر.س</span></>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status="warning" label="غير مربوط" />
                  <button
                    onClick={() => onOpenAssign(sub.studentId)}
                    disabled={isAssigning}
                    className="btn-primary btn-sm"
                  >
                    {isAssigning ? <RefreshCw size={14} className="animate-spin" /> : <Bus size={14} />}
                    إضافة لباص
                  </button>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <Modal
        show={!!selectedSub}
        onClose={onClose}
        title="اختر باص لإضافة الطالب"
        footer={<button onClick={onClose} className="btn-ghost min-h-[44px]">إلغاء</button>}
        wide
      >
        {busesLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-20 w-full rounded-xl" />)}
          </div>
        ) : buses.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" strokeWidth={1.5} />
            <p className="text-sm text-[var(--color-text-muted)]">لا توجد باصات عاملة اليوم</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">يجب إنشاء تشغيل اليوم أولاً</p>
          </div>
        ) : (
          <div className="space-y-2">
            {buses.map(bd => {
              const capacity = bd.bus?.capacity || 0
              const used = bd.studentCount || 0
              const remaining = capacity - used
              const isFull = remaining <= 0
              const fillPercent = capacity > 0 ? Math.round((used / capacity) * 100) : 0
              const currentStudent = subscriptions.find(sub => sub.studentId === selectedSub)
              const defaultPickup = currentStudent?.pickupTime || busPickupTimes.default || ''
              const localPickup = busPickupTimes[bd.bus?.id] ?? defaultPickup
              return (
                <div
                  key={bd.bus?.id}
                  className={`w-full text-right px-4 py-3.5 rounded-xl border transition-all flex items-center gap-3 ${
                    isFull ? 'border-red-200 bg-red-50 opacity-60' : 'border-[var(--color-border)] bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isFull ? 'bg-red-100 text-red-500' : 'bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)]'
                  }`}>
                    <Bus size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold">{bd.bus?.busNumber}</span>
                      <span className={`text-xs font-medium ${isFull ? 'text-red-600' : 'text-green-600'}`}>
                        {isFull ? 'ممتلئ' : `متبقي ${remaining}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)] mb-2">
                      <span>{bd.driver?.name || 'بدون سائق'}</span>
                      <span>{used} / {capacity}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--color-border-light)] overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(fillPercent, 100)}%`,
                        backgroundColor: isFull ? '#DC2626' : fillPercent >= 80 ? '#D97706' : '#16A34A',
                      }} />
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <span>وقت الطالب</span>
                        <input
                          type="time"
                          value={localPickup}
                          onChange={(e) => setBusPickupTimes(prev => ({ ...prev, [bd.bus?.id]: e.target.value }))}
                          className="input-field px-2 py-1 text-xs w-28"
                          disabled={isFull}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => !isFull && onConfirmBus(bd.bus?.id, localPickup)}
                          disabled={isFull}
                          className="btn-primary btn-sm"
                        >
                          تأكيد
                        </button>
                        <button
                          onClick={() => !isFull && onConfirmBus(bd.bus?.id, '')}
                          disabled={isFull}
                          className="btn-ghost btn-sm"
                        >
                          تحديد لاحقاً
                        </button>
                      </div>
                    </div>
                  </div>
                  {isFull && <X size={16} className="text-red-400 shrink-0" />}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
