import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { History, Calendar, Bus, Users, ChevronDown, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import Section from '../../components/ui/Section'
import StatusBadge from '../../components/ui/StatusBadge'
import { SkeletonCard } from '../../components/ui/Skeleton'
import EmptyState from '../../components/ui/EmptyState'

export default function OperationHistory() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.operations.getHistory()
        setHistory(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div>
        <PageHeader title="سجل التشغيل" subtitle="تاريخ عمليات التشغيل اليومية" />
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-24 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="سجل التشغيل" subtitle="تاريخ عمليات التشغيل اليومية" />

      {history.length === 0 ? (
        <Section>
          <EmptyState icon={History} title="لا يوجد سجل تشغيل" description="لم يتم إنشاء أي عمليات تشغيل بعد" />
        </Section>
      ) : (
        <div className="space-y-2">
          {history.map((day, idx) => (
            <motion.div
              key={day.id || idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="card overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === day.id ? null : day.id)}
                className="w-full text-right p-4 flex items-center justify-between hover:bg-[var(--color-border-light)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-lighter)] flex items-center justify-center">
                    <Calendar size={20} className="text-[var(--color-primary-dark)]" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {(() => {
                        const rawDate = day.operationDate || day.date
                        if (!rawDate) return 'تاريخ غير معروف'
                        const parsed = new Date(rawDate)
                        if (Number.isNaN(parsed.getTime())) return 'تاريخ غير معروف'
                        return parsed.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      })()}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--color-text-muted)]"><Bus size={12} className="inline" /> {day.busCount || day._count?.activeBuses || 0} باص</span>
                      <span className="text-xs text-[var(--color-text-muted)]"><Users size={12} className="inline" /> {day.studentCount || 0} طالب</span>
                      <StatusBadge status={day.status?.toLowerCase()} />
                    </div>
                  </div>
                </div>
                <motion.div animate={{ rotate: expanded === day.id ? 0 : -90 }} transition={{ duration: 0.15 }}>
                  <ChevronDown size={18} className="text-[var(--color-text-muted)]" />
                </motion.div>
              </button>

              {expanded === day.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-[var(--color-border)]">
                  <div className="p-4 space-y-2">
                    {day.buses?.length === 0 && day.activeBuses?.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-muted)] text-center py-4">لا توجد تفاصيل</p>
                    ) : (
                      (day.buses || day.activeBuses || []).map(b => (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-border-light)]">
                          <div className="flex items-center gap-2">
                            <Bus size={14} className="text-[var(--color-text-muted)]" />
                            <span className="text-sm font-medium">{b.bus?.busNumber || b.busNumber || 'باص'}</span>
                            {b.driver?.name && <span className="text-xs text-[var(--color-text-muted)]">{b.driver.name}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            {b.studentCount != null && <span className="text-xs text-[var(--color-text-muted)]">{b.studentCount} طالب</span>}
                            {b.status && <StatusBadge status={b.status} />}
                          </div>
                        </div>
                      ))
                    )}
                    <div className="text-xs text-[var(--color-text-muted)] pt-2">
                      <Clock size={12} className="inline" /> آخر تحديث: {day.updatedAt ? new Date(day.updatedAt).toLocaleString('ar-SA') : '-'}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
