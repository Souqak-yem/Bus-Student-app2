import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sun, Bus, Users, ArrowLeft, Play, StopCircle, Check, X, Trash2, RefreshCw, AlertTriangle, MapPin, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { getSocket, onReconnect } from '../../lib/socket'
import ConfirmModal from '../../components/ui/ConfirmModal'

export default function SaturdayOperation() {
  const navigate = useNavigate()
  const [operation, setOperation] = useState(null)
  const [subscribers, setSubscribers] = useState([])
  const [availableBuses, setAvailableBuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedBusIds, setSelectedBusIds] = useState([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [addStudentModal, setAddStudentModal] = useState(null)
  const [assigningStudent, setAssigningStudent] = useState(false)
  const [pickupTime, setPickupTime] = useState('')
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState(null)
  const [confirmRemoveBus, setConfirmRemoveBus] = useState(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  useEffect(() => {
    const socket = getSocket()
    if (socket) {
      socket.on('saturday:update', handleSocketUpdate)
      return () => socket.off('saturday:update')
    }
    const unsub = onReconnect(() => { load() })
    return unsub
  }, [])

  function handleSocketUpdate(data) {
    if (data?.type === 'operation_closed') {
      setOperation(null)
      return
    }
    load()
  }

  const load = useCallback(async () => {
    try {
      const [subRes, opRes] = await Promise.allSettled([
        api.saturday.subscriptions(),
        api.saturday.operation(),
      ])
      if (subRes.status === 'fulfilled') {
        setSubscribers(subRes.value.subscribers || [])
        if (subRes.value.operation) setOperation(subRes.value.operation)
      }
      if (opRes.status === 'fulfilled' && opRes.value.operation) {
        setOperation(opRes.value.operation)
      }
      if (subRes.status === 'fulfilled' && !subRes.value.operation && opRes.status === 'fulfilled' && !opRes.value.operation) {
        setOperation(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleOpenCreate() {
    setLoadingAvailable(true)
    setShowCreateDialog(true)
    setSelectedBusIds([])
    try {
      const data = await api.saturday.availableBuses()
      setAvailableBuses(data.buses || [])
    } catch (err) {
      console.error(err)
      setAvailableBuses([])
    } finally {
      setLoadingAvailable(false)
    }
  }

  function toggleBus(busId) {
    setSelectedBusIds(prev =>
      prev.includes(busId) ? prev.filter(id => id !== busId) : [...prev, busId]
    )
  }

  function selectAll() {
    if (selectedBusIds.length === availableBuses.length) {
      setSelectedBusIds([])
    } else {
      setSelectedBusIds(availableBuses.map(b => b.id))
    }
  }

  async function handleCreate() {
    if (selectedBusIds.length === 0) return
    setCreating(true)
    try {
      const result = await api.saturday.create(selectedBusIds)
      setOperation(result.operation)
      setShowCreateDialog(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleAddStudent(busId, studentId) {
    setAssigningStudent(true)
    try {
      await api.saturday.addStudent(busId, studentId, pickupTime || undefined)
      setAddStudentModal(null)
      setPickupTime('')
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setAssigningStudent(false)
    }
  }

  async function handleRemoveStudent(busId, studentId, name) {
    setConfirmRemoveStudent({ busId, studentId, name })
  }

  async function confirmedRemoveStudent() {
    const { busId, studentId } = confirmRemoveStudent
    setConfirmRemoveStudent(null)
    try {
      await api.saturday.removeStudent(busId, studentId)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleClose() {
    setShowCloseConfirm(true)
  }

  async function handleConfirmedClose() {
    setShowCloseConfirm(false)
    setClosing(true)
    try {
      await api.saturday.close()
      setOperation(null)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setClosing(false)
    }
  }

  async function handleRemoveBus(busId, busNumber) {
    setConfirmRemoveBus({ busId, busNumber })
  }

  async function confirmedRemoveBus() {
    const { busId } = confirmRemoveBus
    setConfirmRemoveBus(null)
    try {
      await api.saturday.removeBus(busId)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const assignedStudentIds = new Set(
    operation?.buses?.flatMap(b => b.loads?.map(l => l.studentId) || []) || []
  )
  const unassigned = subscribers.filter(s => !assignedStudentIds.has(s.student?.id))
  const allAssignedCount = assignedStudentIds.size

  if (loading) {
    return (
      <div>
        <PageHeader title="تشغيل السبت" subtitle="جاري التحميل..." />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      {!operation ? (
        <NoOperationView
          navigate={navigate}
          subscribers={subscribers}
          onStartCreate={handleOpenCreate}
          loadingAvailable={loadingAvailable}
          showCreateDialog={showCreateDialog}
          onCloseCreate={() => setShowCreateDialog(false)}
          availableBuses={availableBuses}
          selectedBusIds={selectedBusIds}
          onToggleBus={toggleBus}
          onSelectAll={selectAll}
          creating={creating}
          onCreate={handleCreate}
        />
      ) : (
        <div>
          <PageHeader
            title="تشغيل السبت"
            subtitle={`${operation.buses?.length || 0} باصات · ${allAssignedCount} طالب`}
          >
            <button onClick={() => navigate('/admin/subscriptions/daily?tab=saturday')} className="btn-ghost btn-sm">
              <ArrowLeft size={16} /> رجوع
            </button>
            <button onClick={load} className="btn-ghost btn-sm">
              <RefreshCw size={16} /> تحديث
            </button>
            <button
              onClick={handleClose}
              disabled={closing}
              className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
            >
              <StopCircle size={16} />
              {closing ? 'جاري الإنهاء...' : 'إنهاء التشغيل'}
            </button>
          </PageHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Bus size={18} />
                  الباصات العاملة ({operation.buses?.length || 0})
                </h3>
                <button onClick={handleOpenCreate} className="btn-primary btn-sm">
                  <Plus size={14} /> إضافة باص
                </button>
              </div>

              {(!operation.buses || operation.buses.length === 0) && (
                <div className="card p-8 text-center">
                  <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" strokeWidth={1.5} />
                  <p className="text-sm text-[var(--color-text-muted)]">لم يتم إضافة أي باصات بعد</p>
                </div>
              )}

              <div className="space-y-3">
                {operation.buses?.map((bd, idx) => {
                  const capacity = bd.capacitySnapshot || bd.bus?.capacity || 0
                  const used = bd.loads?.length || 0
                  const remaining = capacity - used
                  const isFull = remaining <= 0
                  return (
                    <motion.div
                      key={bd.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="card p-0 overflow-hidden"
                    >
                      <div className="bg-[var(--color-primary-lighter)] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                            <Bus size={16} className="text-[var(--color-primary-dark)]" />
                          </div>
                          <div>
                            <div className="font-bold">{bd.bus?.busNumber}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{bd.driver?.name || 'بدون سائق'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium ${isFull ? 'text-red-600' : 'text-green-700'}`}>
                            {used}/{capacity}
                          </span>
                          <button
                            onClick={() => handleRemoveBus(bd.busId, bd.bus?.busNumber)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-[var(--color-text-muted)] hover:text-red-600 transition-colors"
                            title="حذف الباص"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {bd.loads?.length > 0 ? (
                        <div className="divide-y divide-[var(--color-border)]">
                          {bd.loads.map(ld => (
                            <div key={ld.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--color-border-light)] transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
                                  {ld.student?.name?.[0] || '?'}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium">{ld.student?.name}</span>
                                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                    <span>{ld.student?.zone}</span>
                                    {ld.pickupTime && <span>· {ld.pickupTime}</span>}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveStudent(bd.busId, ld.studentId, ld.student?.name)}
                                className="p-1.5 rounded-lg hover:bg-red-100 text-[var(--color-text-muted)] hover:text-red-600 transition-colors shrink-0"
                                title="حذف الطالب"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-3 text-sm text-[var(--color-text-muted)] text-center">
                          لا يوجد طلاب على هذا الباص
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Users size={18} />
                  غير موزعين ({unassigned.length})
                </h3>
              </div>

              {unassigned.length === 0 && (
                <div className="card p-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <Check size={24} className="text-green-600" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">جميع الطلاب موزعون</p>
                </div>
              )}

              <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pl-1">
                {unassigned.map((sub, idx) => {
                  const bs = sub.student?.busStudents?.[0]
                  return (
                    <motion.div
                      key={sub.subscriptionId}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="card p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
                          {sub.student?.name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium mb-0.5">{sub.student?.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                            <MapPin size={10} />
                            <span>{sub.student?.zone}</span>
                          </div>
                          {bs && (
                            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              الباص الأساسي: {bs.bus?.busNumber}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setAddStudentModal(sub)}
                          className="btn-primary btn-sm shrink-0"
                        >
                          <Plus size={12} /> إضافة
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          <ConfirmModal
            show={!!confirmRemoveStudent}
            onClose={() => setConfirmRemoveStudent(null)}
            onConfirm={confirmedRemoveStudent}
            title="تأكيد حذف الطالب"
            danger
          >
            حذف {confirmRemoveStudent?.name} من الباص؟
          </ConfirmModal>

          <ConfirmModal
            show={!!confirmRemoveBus}
            onClose={() => setConfirmRemoveBus(null)}
            onConfirm={confirmedRemoveBus}
            title="تأكيد حذف الباص"
            danger
          >
            حذف الباص {confirmRemoveBus?.busNumber} من تشغيل السبت؟
            <br />
            <span className="text-xs text-gray-400">سيتم إعادة جميع طلابه إلى قائمة غير الموزعين.</span>
          </ConfirmModal>

          <ConfirmModal
            show={showCloseConfirm}
            onClose={() => setShowCloseConfirm(false)}
            onConfirm={handleConfirmedClose}
            title="إنهاء تشغيل السبت"
            loading={closing}
            danger
          >
            إنهاء تشغيل السبت؟
            <br />
            <span className="text-xs text-gray-400">لن يتمكن الطلاب من تعديل التوزيع بعد الإنهاء.</span>
          </ConfirmModal>

          <AddStudentModal
            student={addStudentModal}
            operation={operation}
            onClose={() => { setAddStudentModal(null); setPickupTime('') }}
            onAssign={handleAddStudent}
            loading={assigningStudent}
            pickupTime={pickupTime}
            onPickupTimeChange={setPickupTime}
          />

          <CreateOperationDialog
            show={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            availableBuses={availableBuses}
            loading={loadingAvailable}
            selectedBusIds={selectedBusIds}
            onToggle={toggleBus}
            onSelectAll={selectAll}
            creating={creating}
            onCreate={handleCreate}
            isAdding
          />
        </div>
      )}
    </div>
  )
}

function NoOperationView({
  navigate, subscribers, onStartCreate, loadingAvailable, showCreateDialog,
  onCloseCreate, availableBuses, selectedBusIds, onToggleBus,
  onSelectAll, creating, onCreate,
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="تشغيل السبت" subtitle="إدارة تشغيل يوم السبت">
        <button onClick={() => window.history.back()} className="btn-ghost btn-sm">
          <ArrowLeft size={16} /> رجوع
        </button>
      </PageHeader>

      {subscribers.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
            <Sun size={32} className="text-purple-600" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold mb-2">لا يوجد مشتركون للسبت</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            لا يوجد طلاب لديهم اشتراك يوم السبت لهذا الأسبوع
          </p>
          <button onClick={() => navigate('/admin/subscriptions/daily?tab=saturday')} className="btn-primary">
            عرض الاشتراكات
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                <Users size={24} className="text-purple-600" strokeWidth={1.5} />
              </div>
              <div>
                <div className="font-bold text-lg">{subscribers.length} طالب</div>
                <div className="text-sm text-[var(--color-text-muted)]">لديهم اشتراك يوم السبت</div>
              </div>
            </div>

            <button
              onClick={onStartCreate}
              className="w-full py-4 rounded-2xl bg-gradient-to-l from-purple-600 to-purple-500 text-white font-bold text-lg shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Play size={22} />
              بدء تشغيل السبت
            </button>
          </div>

          <div className="card p-4">
            <h3 className="font-bold mb-3">المشتركون</h3>
            <div className="space-y-2">
              {subscribers.map((sub, idx) => {
                const bs = sub.student?.busStudents?.[0]
                return (
                  <div key={sub.subscriptionId} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[var(--color-border-light)]">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
                      {sub.student?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{sub.student?.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                        <span>{sub.student?.zone}</span>
                        {sub.student?.destination?.name && <><span>|</span><span>{sub.student.destination.name}</span></>}
                        {bs && <><span>|</span><span>باص {bs.bus?.busNumber}</span></>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <CreateOperationDialog
            show={showCreateDialog}
            onClose={onCloseCreate}
            availableBuses={availableBuses}
            loading={loadingAvailable}
            selectedBusIds={selectedBusIds}
            onToggle={onToggleBus}
            onSelectAll={onSelectAll}
            creating={creating}
            onCreate={onCreate}
          />
        </div>
      )}
    </div>
  )
}

function CreateOperationDialog({
  show, onClose, availableBuses, loading, selectedBusIds,
  onToggle, onSelectAll, creating, onCreate, isAdding,
}) {
  return (
    <Modal
      show={show}
      onClose={onClose}
      title={isAdding ? 'إضافة باصات للتشغيل' : 'اختر باصات تشغيل السبت'}
      wide
    >
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
        </div>
      ) : availableBuses.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-500" strokeWidth={1.5} />
          <p className="text-sm text-[var(--color-text-muted)]">لا توجد باصات نشطة</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">
              تم اختيار {selectedBusIds.length} من {availableBuses.length}
            </span>
            <button onClick={onSelectAll} className="btn-ghost btn-xs">
              {selectedBusIds.length === availableBuses.length ? 'إلغاء الكل' : 'اختر الكل'}
            </button>
          </div>

          {availableBuses.map(bd => {
            const selected = selectedBusIds.includes(bd.id)
            return (
              <button
                key={bd.id}
                onClick={() => onToggle(bd.id)}
                className={`w-full text-right px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                  selected
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-border-light)]'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                  selected ? 'border-purple-600 bg-purple-600' : 'border-gray-300'
                }`}>
                  {selected && <Check size={12} className="text-white" />}
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  selected ? 'bg-purple-100 text-purple-700' : 'bg-[var(--color-border-light)] text-[var(--color-text-muted)]'
                }`}>
                  <Bus size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{bd.busNumber}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{bd.driver?.name || 'بدون سائق'}</div>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">سعة {bd.capacity}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={onClose} className="btn-ghost flex-1 min-h-[44px]">إلغاء</button>
        <button
          onClick={onCreate}
          disabled={selectedBusIds.length === 0 || creating}
          className="btn-primary flex-1 min-h-[44px]"
        >
          {creating ? (
            <><RefreshCw size={16} className="animate-spin" /> جاري الإضافة...</>
          ) : (
            <><Play size={16} /> {isAdding ? 'إضافة' : 'إنشاء التشغيل'} ({selectedBusIds.length} باصات)</>
          )}
        </button>
      </div>
    </Modal>
  )
}

function AddStudentModal({ student, operation, onClose, onAssign, loading, pickupTime, onPickupTimeChange }) {
  return (
    <Modal
      show={!!student}
      onClose={onClose}
      title={`إضافة ${student?.student?.name || ''} إلى باص`}
      wide
    >
      {student && (
        <div className="space-y-4">
          <div className="card p-3 bg-[var(--color-border-light)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                {student.student?.name?.[0] || '?'}
              </div>
              <div>
                <div className="font-bold">{student.student?.name}</div>
                <div className="text-xs text-[var(--color-text-muted)]">{student.student?.zone}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">وقت التوصيل (اختياري)</label>
            <input
              type="text"
              value={pickupTime}
              onChange={e => onPickupTimeChange(e.target.value)}
              placeholder="مثال: 7:30 ص"
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
            <p className="text-sm font-medium">اختر الباص:</p>
            {operation?.buses?.map(bd => {
              const capacity = bd.capacitySnapshot || bd.bus?.capacity || 0
              const used = bd.loads?.length || 0
              const remaining = capacity - used
              const isFull = remaining <= 0
              return (
                <button
                  key={bd.id}
                  onClick={() => !isFull && onAssign(bd.id, student.student?.id)}
                  disabled={isFull || loading}
                  className={`w-full text-right px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
                    isFull ? 'border-red-200 bg-red-50 opacity-60 cursor-not-allowed' : 'border-[var(--color-border)] hover:bg-purple-50 hover:border-purple-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-lighter)] flex items-center justify-center shrink-0">
                    <Bus size={16} className="text-[var(--color-primary-dark)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold">{bd.bus?.busNumber}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{bd.driver?.name || 'بدون سائق'}</div>
                  </div>
                  <span className={isFull ? 'text-red-600 text-xs font-medium' : 'text-green-700 text-xs font-medium'}>
                    {isFull ? 'ممتلئ' : `متبقي ${remaining}`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button onClick={onClose} className="btn-ghost flex-1 min-h-[44px]">إلغاء</button>
      </div>
    </Modal>
  )
}
