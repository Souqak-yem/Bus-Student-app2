import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Bus, Users, Clock, RefreshCw, Search, Check, Trash2, Play, Calendar, AlertCircle, ChevronDown, ChevronUp, AlertTriangle, MapPin } from 'lucide-react'
import { api } from '../../lib/api'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import StatusBadge from '../../components/ui/StatusBadge'
import KpiCard from '../../components/ui/KpiCard'
import { SkeletonCard } from '../../components/ui/Skeleton'
import ResponsiveKpiGrid from '../../components/ui/ResponsiveKpiGrid'
import BusOperationDetail from './BusOperationDetail'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { onDailyExceptionsUpdate, offDailyExceptionsUpdate } from '../../lib/socket'

export default function AdminDailyOperation() {
  const [operation, setOperation] = useState(null)
  const [buses, setBuses] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedBus, setSelectedBus] = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [availableBuses, setAvailableBuses] = useState([])
  const [selectedBusIds, setSelectedBusIds] = useState([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [search, setSearch] = useState('')
  const [exceptions, setExceptions] = useState(null)
  const [exceptionsLoading, setExceptionsLoading] = useState(false)
  const [showExceptions, setShowExceptions] = useState(false)
  const [exceptionStudentForBus, setExceptionStudentForBus] = useState(null)
  const [showConfirm, setShowConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.operations.getToday()
      if (data?.buses) {
        setOperation(data)
        setBuses(data.buses)
      } else {
        const fallback = await api.operations.getToday()
        setOperation(fallback)
        setBuses(fallback?.buses || [])
      }
      loadExceptions()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    onDailyExceptionsUpdate(() => { load() })
    return () => offDailyExceptionsUpdate()
  }, [load])

  async function loadExceptions() {
    setExceptionsLoading(true)
    try {
      const data = await api.dailyExceptions.get()
      setExceptions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setExceptionsLoading(false)
    }
  }

  function handleExceptionSelectBus(studentId) {
    setExceptionStudentForBus(studentId)
  }

  async function handleExceptionConfirmBus(busId) {
    const studentId = exceptionStudentForBus
    if (!studentId) return
    try {
      await api.operations.addStudent(busId, studentId)
      setExceptionStudentForBus(null)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  function handleGenerateWithCheck() {
    handleGenerate()
  }

  function handleAddBusesWithCheck() {
    handleAddBuses()
  }

  useEffect(() => { load() }, [load])

  async function openCreateDialog() {
    setLoadingAvailable(true)
    setShowCreateDialog(true)
    setSelectedBusIds([])
    try {
      const data = await api.operations.getAvailableBuses()
      setAvailableBuses(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setAvailableBuses([])
    } finally {
      setLoadingAvailable(false)
    }
  }

  async function handleAddBuses() {
    const busIds = selectedBusIds
      .filter(id => typeof id === 'string' && id.trim() !== '')
      .map(id => id.trim())

    if (busIds.length === 0) return
    setGenerating(true)
    try {
      await api.operations.addBuses(busIds)
      setShowCreateDialog(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function toggleBus(busId) {
    setSelectedBusIds(prev =>
      prev.includes(busId)
        ? prev.filter(id => id !== busId)
        : [...prev, busId]
    )
  }

  function selectAll() {
    if (selectedBusIds.length === availableBuses.length) {
      setSelectedBusIds([])
    } else {
      setSelectedBusIds(availableBuses.map(b => b.id))
    }
  }

  async function handleGenerate() {
    if (selectedBusIds.length === 0) return
    setGenerating(true)
    try {
      await api.operations.generate(selectedBusIds)
      setShowCreateDialog(false)
      await load()
    } catch (err) {
      alert(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRemoveBus(busId, busNumber) {
    setShowConfirm({ busId, busNumber })
  }

  async function handleConfirmed() {
    const { busId } = showConfirm
    setShowConfirm(null)
    try {
      await api.operations.removeBus(busId)
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  const expectedStudents = availableBuses
    .filter(b => selectedBusIds.includes(b.id))
    .reduce((sum, b) => sum + (b.templateStudentCount || 0), 0)

  const hasTodayOffStudents = Boolean(exceptions?.todayOffStudents?.length)

  const filtered = search
    ? buses.filter(b =>
        (b.bus?.busNumber || '').includes(search) ||
        (b.driver?.name || '').includes(search)
      )
    : buses

  const totalStudents = buses.reduce((s, b) => s + (b.studentCount || b.students?.length || 0), 0)
  const departedCount = buses.filter(b => b.completionStatus === 'IN_PROGRESS' || b.students?.some?.(s => s.status === 'in_progress')).length
  const waitingCount = buses.filter(b => b.completionStatus === 'PENDING' || b.completionStatus === 'NO_STUDENTS').length
  const unassignedStudents = operation?.eligibleStudents || []

  if (loading) {
    return (
      <div>
        <PageHeader title="تشغيل اليوم" subtitle="إدارة عمليات اليوم" />
        <ResponsiveKpiGrid>{[1,2,3].map(i => <SkeletonCard key={i} />)}</ResponsiveKpiGrid>
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-4 sm:p-6 mt-6"><div className="space-y-3">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}</div></div>
      </div>
    )
  }

  const hasOperation = operation?.exists !== false && buses.length > 0

  if (!hasOperation) {
    return (
      <div>
        <PageHeader title="تشغيل اليوم" subtitle="إدارة عمليات اليوم" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center min-h-[60vh]"
        >
          <div className="card p-10 text-center max-w-md w-full">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-lighter)] flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-[var(--color-primary-dark)]" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold mb-2">تشغيل اليوم</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              لم يتم إنشاء تشغيل لهذا اليوم بعد. اختر الباصات التي ستعمل اليوم لبدء التشغيل.
            </p>
            <button onClick={openCreateDialog} className="btn-primary btn-lg">
              <RefreshCw size={18} />
              إنشاء تشغيل اليوم
            </button>
          </div>
        </motion.div>

        <CreateOperationDialog
          show={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          availableBuses={availableBuses}
          loading={loadingAvailable}
          selectedBusIds={selectedBusIds}
          onToggle={toggleBus}
          onSelectAll={selectAll}
          expectedStudents={expectedStudents}
          generating={generating}
          onGenerate={handleGenerateWithCheck}
          showConfirm={showConfirm}
          setShowConfirm={setShowConfirm}
          handleConfirmed={handleConfirmed}
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="تشغيل اليوم" subtitle={operation?.operation?.operationDate ? new Date(operation.operation.operationDate).toLocaleDateString('ar-SA') : new Date().toLocaleDateString('ar-SA')}>
        <button onClick={openCreateDialog} className="btn-primary">
          <RefreshCw size={16} />
          إضافة باصات
        </button>
      </PageHeader>

      <ResponsiveKpiGrid className="mb-6">
        <KpiCard title="الباصات العاملة" value={buses.length} icon={Bus} color="primary" />
        <KpiCard title="الطلاب" value={totalStudents} icon={Users} color="info" />
        <KpiCard title="غير موزعين" value={unassignedStudents.length} icon={AlertTriangle} color="warning" subtitle="بحاجة للتوزيع على باص" />
        <KpiCard title="باصات منطلقة" value={departedCount} icon={Bus} color="success" />
        <KpiCard title="باصات في الانتظار" value={waitingCount} icon={Clock} color="warning" />
        {!exceptionsLoading && exceptions && (
          <KpiCard title="إجازات اليوم" value={exceptions.todayOffStudents?.length || 0} icon={Clock} color="info" subtitle={exceptions.overrideCount > 0 ? `${exceptions.overrideCount} تجاوز` : 'بدون تجاوزات'} />
        )}
      </ResponsiveKpiGrid>

      {!exceptionsLoading && hasTodayOffStudents && (
        <div className="mb-4">
          <button
            onClick={() => setShowExceptions(prev => !prev)}
            className="flex items-center gap-2 w-full text-right px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
          >
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="font-semibold text-amber-800 flex-1">
              {exceptions.overrideCount > 0 ? 'استثناءات اليوم' : 'إجازات اليوم'}
              <span className="mr-2 text-sm font-normal">
                {exceptions.overrideCount > 0 ? `· ${exceptions.overrideCount} تجاوز إجازة` : `· ${exceptions.todayOffStudents.length} طالب`}
              </span>
            </span>
            {showExceptions ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
          </button>
        </div>
      )}

      {showExceptions && !exceptionsLoading && exceptions && exceptions.todayOffStudents?.length > 0 && (
        <div className="mb-6">
          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
            {exceptions.todayOffStudents.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3 px-3 sm:px-4">
                <div>
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="mr-3 text-[11px] text-[var(--color-text-muted)]">{s.zone}</span>
                  {s.phone && <span className="mr-3 text-[11px] text-[var(--color-text-muted)]">{s.phone}</span>}
                </div>
                <StatusBadge status="pending" label="إجازة" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative mb-4 w-full max-w-full">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text" placeholder="بحث باص أو سائق..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="input-field pr-9 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((bd, idx) => (
              <motion.div
                key={bd.bus?.id || idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="card p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      bd.completionStatus === 'IN_PROGRESS' ? 'bg-[var(--color-success-light)] text-green-600' :
                      bd.completionStatus === 'COMPLETED' ? 'bg-blue-100 text-blue-600' :
                      'bg-[var(--color-primary-lighter)] text-[var(--color-primary-dark)]'
                    }`}>
                      <Bus size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{bd.bus?.busNumber}</span>
                        <StatusBadge status={bd.bus?.status === 'active' ? 'active' : 'maintenance'} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-sm text-[var(--color-text-muted)]">
                        <span><Users size={14} className="inline" /> {bd.studentCount}/{bd.bus?.capacity}</span>
                        {bd.driver?.name && <span>{bd.driver.name}</span>}
                      </div>
                    </div>
                  </div>
                  <StatusBadge
                    status={
                      bd.completionStatus === 'IN_PROGRESS' ? 'in_progress' :
                      bd.completionStatus === 'COMPLETED' ? 'completed' :
                      bd.completionStatus === 'NO_STUDENTS' ? 'pending' :
                      'scheduled'
                    }
                    label={
                      bd.completionStatus === 'IN_PROGRESS' ? 'قيد التشغيل' :
                      bd.completionStatus === 'COMPLETED' ? 'مكتملة' :
                      bd.completionStatus === 'NO_STUDENTS' ? 'بدون طلاب' :
                      'مجدولة'
                    }
                  />
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                    <span>نسبة الامتلاء</span>
                    <span>{bd.fillPercent || 0}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--color-border-light)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(bd.fillPercent || 0, 100)}%`,
                        backgroundColor: (bd.fillPercent || 0) >= 90 ? '#DC2626' :
                          (bd.fillPercent || 0) >= 70 ? '#D97706' : '#16A34A'
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedBus(bd.bus?.id)}
                    className="btn-primary btn-sm flex-1"
                  >
                    <Play size={14} /> فتح الرحلة
                  </button>
                  <button
                    onClick={() => handleRemoveBus(bd.bus?.id, bd.bus?.busNumber)}
                    className="btn-ghost btn-sm text-[var(--color-danger)] hover:bg-red-50"
                    title="إزالة من تشغيل اليوم"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle size={32} className="mx-auto mb-2 text-[var(--color-text-muted)]" strokeWidth={1.5} />
              <p className="text-sm text-[var(--color-text-muted)]">لا توجد نتائج للبحث</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Users size={18} />
              غير موزعين ({unassignedStudents.length})
            </h3>
          </div>

          {unassignedStudents.length === 0 && (
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-green-600" strokeWidth={1.5} />
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">جميع الطلاب موزعون</p>
            </div>
          )}

          <div className="space-y-2 max-h-[70vh] overflow-y-auto scrollbar-thin pl-1">
            {unassignedStudents.map((s, idx) => (
              <motion.div
                key={s.studentId}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`card p-3 border ${getStudentGenderTone(s.student?.gender).card}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getStudentGenderTone(s.student?.gender).avatar}`}>
                    {s.student?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-0.5">{s.student?.name}</div>
                    <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <MapPin size={10} />
                      <span>{s.student?.zone}</span>
                    </div>
                    {s.suggestedBusNumber && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        الباص المقترح: {s.suggestedBusNumber}
                      </div>
                    )}
                    {s.pickupTime && (
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        الوقت: {s.pickupTime}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleExceptionSelectBus(s.studentId)}
                    className="btn-primary btn-sm shrink-0"
                  >
                    <Bus size={12} /> توزيع
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <CreateOperationDialog
        show={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        availableBuses={availableBuses}
        loading={loadingAvailable}
        selectedBusIds={selectedBusIds}
        onToggle={toggleBus}
        onSelectAll={selectAll}
        expectedStudents={expectedStudents}
        generating={generating}
        onGenerate={handleAddBusesWithCheck}
        mode="add"
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        handleConfirmed={handleConfirmed}
      />

      {selectedBus && (
        <BusOperationDetail
          busId={selectedBus}
          onClose={() => setSelectedBus(null)}
          onRefresh={load}
          initialShowAdd={!!exceptionStudentForBus}
        />
      )}

      <Modal
        show={!!exceptionStudentForBus}
        onClose={() => setExceptionStudentForBus(null)}
        title={`توزيع ${unassignedStudents.find(s => s.studentId === exceptionStudentForBus)?.student?.name || 'الطالب'} على باص`}
        footer={
          <button onClick={() => setExceptionStudentForBus(null)} className="btn-ghost min-h-[44px]">إلغاء</button>
        }
        wide
      >
        <p className="text-sm text-[var(--color-text-muted)] mb-4">اختر الباص لإضافة الطالب إليه مباشرة:</p>
        <div className="space-y-2">
          {buses.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">لا توجد باصات في التشغيل</p>}
          {buses.map(bd => (
            <button
              key={bd.bus?.id}
              onClick={() => handleExceptionConfirmBus(bd.bus?.id)}
              className="w-full text-right px-4 py-3.5 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-primary-lighter)] hover:border-[var(--color-primary-light)] transition-all flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-lighter)] flex items-center justify-center shrink-0">
                <Bus size={18} className="text-[var(--color-primary-dark)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{bd.bus?.busNumber}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{bd.studentCount}/{bd.bus?.capacity}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)] mt-0.5">
                  <span>{bd.driver?.name || 'بدون سائق'}</span>
                  <span>الخط: {bd.line === 'JEBALI' ? 'جبالي' : 'بحري'}</span>
                  <span>المقاعد المتبقية: {(bd.bus?.capacity || 0) - (bd.studentCount || 0)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}

function CreateOperationDialog({
  show, onClose, availableBuses, loading, selectedBusIds,
  onToggle, onSelectAll, expectedStudents, generating, onGenerate,
  mode = 'create',
  showConfirm, setShowConfirm, handleConfirmed,
}) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? availableBuses.filter(b =>
        (b.busNumber || '').includes(search) ||
        (b.driver?.name || '').includes(search)
      )
    : availableBuses

  return (
    <>
    <Modal
      show={show}
      onClose={onClose}
      title={
        <div>
          <h2 className="text-lg font-bold">{mode === 'add' ? 'إضافة باصات للتشغيل' : 'إنشاء تشغيل اليوم'}</h2>
          <p className="text-xs text-gray-500">اختر الباصات التي ستعمل اليوم</p>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500">
            {expectedStudents === 0 && selectedBusIds.length > 0 ? (
              <span className="text-amber-600 font-medium">لا يوجد طلاب مؤهلون في الباصات المختارة</span>
            ) : (
              <>تم اختيار {selectedBusIds.length} باص · {expectedStudents} طالب مؤهل</>
            )}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost min-h-[44px]">إلغاء</button>
            <button
              onClick={onGenerate}
              disabled={generating || selectedBusIds.length === 0}
              className="btn-primary min-h-[44px]"
            >
              <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
              {generating ? 'جاري...' : mode === 'add' ? 'إضافة الباصات' : 'إنشاء التشغيل'}
            </button>
          </div>
        </div>
      }
      wide
    >
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : availableBuses.length === 0 ? (
        <div className="text-center py-8">
          <AlertCircle size={32} className="mx-auto mb-2 text-gray-400" strokeWidth={1.5} />
          <p className="text-sm text-gray-500">جميع الباصات النشطة مشغولة اليوم</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={onSelectAll}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {selectedBusIds.length === availableBuses.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              <span className="text-xs text-gray-500">
                تم اختيار <strong className="text-blue-700">{selectedBusIds.length}</strong> باص
                  {selectedBusIds.length > 0 && (
                    <> · <strong>{expectedStudents}</strong> طالب مؤهل</>
                  )}
              </span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" placeholder="بحث..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="input-field pr-7 py-1 text-xs w-40"
              />
            </div>
          </div>

          <div className="space-y-1">
            {filtered.map(b => {
              const checked = selectedBusIds.includes(b.id)
              const noEligible = (b.templateStudentCount || 0) === 0
              return (
                <button
                  key={b.id}
                  onClick={() => onToggle(b.id)}
                  className={`w-full text-right px-3 py-3 rounded-xl border transition-all max-sm:flex-col max-sm:gap-2 ${
                    checked
                      ? noEligible ? 'border-amber-400 bg-amber-50' : 'border-blue-600 bg-blue-50'
                      : noEligible ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      checked
                        ? noEligible ? 'border-amber-500 bg-amber-500' : 'border-blue-600 bg-blue-600'
                        : 'border-gray-400'
                    }`}>
                      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      noEligible ? 'bg-amber-50' : 'bg-blue-50'
                    }`}>
                      <Bus size={18} className={noEligible ? 'text-amber-600' : 'text-blue-800'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold">{b.busNumber || 'باص'}</span>
                        <StatusBadge status={b.status === 'active' ? 'active' : 'maintenance'} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mr-11">
                    {noEligible ? (
                      <span className="text-amber-600 font-medium">لا يوجد طلاب مؤهلون اليوم</span>
                    ) : (
                      <span>{b.templateStudentCount} طالب مؤهل</span>
                    )}
                    <span>السعة: {b.capacity}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

    </Modal>

      <ConfirmModal
        show={!!showConfirm}
        onClose={() => setShowConfirm(null)}
        onConfirm={handleConfirmed}
        title="تأكيد إزالة الباص"
        danger
      >
        إزالة الباص {showConfirm?.busNumber} من تشغيل اليوم؟
        <br />
        <span className="text-xs text-gray-400">(هذا لا يؤثر على الباص أو القالب)</span>
      </ConfirmModal>
    </>
  )
}
