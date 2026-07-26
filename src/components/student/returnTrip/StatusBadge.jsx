import { memo } from 'react'
import { CheckCircle2, Clock3, Bus, Navigation, MapPinCheckInside, CircleAlert } from 'lucide-react'

const STATUS_META = {
  NO_RESPONSE: {
    label: 'في انتظار الرد',
    icon: CircleAlert,
    bgCls: 'bg-slate-50 border-slate-200 text-slate-600',
    dotCls: 'bg-slate-400',
    wrapperBg: 'rt-card-header-gradient-gray',
  },
  READY: {
    label: 'جاهز',
    icon: CheckCircle2,
    bgCls: 'bg-green-50 border-green-200 text-green-700',
    dotCls: 'bg-green-500',
    wrapperBg: 'rt-card-header-gradient-green',
  },
  DELAYED: {
    label: 'سأتأخر',
    icon: Clock3,
    bgCls: 'bg-amber-50 border-amber-200 text-amber-700',
    dotCls: 'bg-amber-500',
    wrapperBg: 'rt-card-header-gradient-amber',
  },
  ON_BOARD: {
    label: 'تم الصعود',
    icon: Bus,
    bgCls: 'bg-blue-50 border-blue-200 text-blue-700',
    dotCls: 'bg-blue-500',
    wrapperBg: 'rt-card-header-gradient-blue',
  },
  IN_TRANSIT: {
    label: 'في الطريق',
    icon: Navigation,
    bgCls: 'bg-purple-50 border-purple-200 text-purple-700',
    dotCls: 'bg-purple-500',
    wrapperBg: 'rt-card-header-gradient-purple',
  },
  ARRIVED: {
    label: 'وصلت',
    icon: MapPinCheckInside,
    bgCls: 'bg-green-50 border-green-200 text-green-700',
    dotCls: 'bg-green-600',
    wrapperBg: 'rt-card-header-gradient-green',
  },
  MISSED_BUS: {
    label: 'فات الباص',
    icon: CircleAlert,
    bgCls: 'bg-slate-50 border-slate-200 text-slate-700',
    dotCls: 'bg-slate-500',
    wrapperBg: 'rt-card-header-gradient-gray',
  },
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    if (Number.isNaN(d.getTime())) return ''
    let h = d.getHours()
    const m = d.getMinutes()
    const ampm = h < 12 ? 'ص' : 'م'
    h = h % 12 || 12
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return '' }
}

function StatusBadgeImpl({ status, updatedAt, showTime = false, size = 'md', pulse = false }) {
  const meta = STATUS_META[status] || STATUS_META.NO_RESPONSE
  const Icon = meta.icon
  const sizeCls = size === 'sm' ? 'px-2 py-1 text-[10px]' : size === 'lg' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]'

  return (
    <div className={`rt-status-pill ${meta.bgCls} ${sizeCls} rt-anim-badge-bounce`} title={meta.label}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotCls} ${pulse ? 'rt-anim-pulse-ring relative' : ''}`} aria-hidden />
      <Icon size={size === 'sm' ? 11 : 13} strokeWidth={2.5} className="shrink-0" />
      <span className="font-extrabold">{meta.label}</span>
      {showTime && updatedAt && (
        <span className="opacity-75 mr-1 text-[10px] font-medium">· {formatTime(updatedAt)}</span>
      )}
    </div>
  )
}

export const StatusBadge = memo(StatusBadgeImpl)
export { STATUS_META, formatTime }
