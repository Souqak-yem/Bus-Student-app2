import { memo } from 'react'
import { Bus, CheckCircle2, Clock3, MapPin, Flag, MapPinCheckInside, Navigation, CheckCheck } from 'lucide-react'

function buildSteps({ readiness, timer, busStatus, isDroppedOff, assignedAt, readyAt, busArrivedAt, onBoardAt, departedAt, droppedOffAt }) {
  const status = readiness?.status || 'NO_RESPONSE'
  const isDelayed = status === 'DELAYED'
  const isReady = status === 'READY' || status === 'ON_BOARD' || status === 'MISSED_BUS'
  const busArrived = !!timer && !timer.endedAt
  const timerEnded = !!timer?.endedAt
  const isOnBoard = status === 'ON_BOARD'
  const busDeparted = busStatus === 'DEPARTED'

  const steps = [
    {
      key: 'assigned',
      title: 'تم تخصيصك للباص',
      subtitle: assignedAt ? `في ${assignedAt}` : 'تم تخصيص باص لك للعودة',
      icon: Bus,
      palette: 'blue',
      done: true,
      active: !isReady && !isDelayed,
      time: assignedAt,
    },
    {
      key: 'ready',
      title: isDelayed ? 'تم إبلاغ التأخير' : 'أكدت جاهزيتك',
      subtitle: isDelayed
        ? (readiness?.delayMinutes ? `تأخير ${readiness.delayMinutes} دقيقة` : readiness?.delayReason || 'تم إرسال سبب التأخير')
        : (readyAt ? `حالتك أُرسلت للمشرف والسائق` : 'سيتم إبلاغ الطاقم'),
      icon: isDelayed ? Clock3 : CheckCircle2,
      palette: isDelayed ? 'amber' : 'green',
      done: isReady || isDelayed,
      active: false,
      time: readyAt || (isDelayed ? readiness?.updatedAt : null),
    },
    {
      key: 'bus_coming',
      title: 'الباص في الطريق',
      subtitle: 'يتحرك الباص نحو الجامعة',
      icon: Navigation,
      palette: 'indigo',
      done: busArrived || timerEnded || isOnBoard || busDeparted,
      active: false,
      time: null,
    },
    {
      key: 'bus_arrived',
      title: 'وصل الباص إلى نقطة التجمع',
      subtitle: busArrivedAt ? `وصل في ${busArrivedAt}` : 'تم الإعلان عن وصول الباص',
      icon: MapPin,
      palette: 'indigo',
      done: busArrived || timerEnded || isOnBoard || busDeparted,
      active: false,
      time: busArrivedAt || (busArrived ? timer?.startedAt : null),
    },
    {
      key: 'countdown',
      title: 'عدّاد الصعود المفتوح',
      subtitle: timer ? 'ابحث عن باصك وصعد فوراً' : 'سيبدأ العداد عند وصول الباص',
      icon: Clock3,
      palette: 'violet',
      done: isOnBoard || busDeparted || (timerEnded && status !== 'ON_BOARD'),
      active: busArrived && !isOnBoard && !busDeparted,
      time: busArrived ? timer?.startedAt : null,
    },
    {
      key: 'on_board',
      title: 'تم صعودك إلى الباص',
      subtitle: onBoardAt ? `سُجل صعودك في ${onBoardAt}` : 'سيسجل السائق صعودك',
      icon: CheckCheck,
      palette: 'blue',
      done: isOnBoard || busDeparted,
      active: false,
      time: onBoardAt || readiness?.onBoardAt,
    },
    {
      key: 'on_way',
      title: 'الرحلة انطلقت',
      subtitle: busDeparted ? 'في طريقها إلى الوجهات' : 'في انتظار انطلاق الرحلة',
      icon: Bus,
      palette: 'purple',
      done: busDeparted || isDroppedOff,
      active: busDeparted && !isDroppedOff,
      time: departedAt,
    },
    {
      key: 'dropped_off',
      title: 'تم الوصول',
      subtitle: isDroppedOff ? 'تم إيصالك إلى وجهتك' : 'في الطريق إلى موقع الإنزال',
      icon: MapPinCheckInside,
      palette: 'green',
      done: isDroppedOff,
      active: false,
      time: droppedOffAt,
    },
  ]

  // Filter: Only show relevant steps based on journey progress to reduce clutter
  if (!busArrived && !timerEnded && !isOnBoard && !busDeparted && !isDroppedOff) {
    return steps.filter(s => ['assigned', 'ready', 'bus_coming'].includes(s.key))
  }
  if (!busDeparted && !isDroppedOff) {
    return steps.filter(s => ['assigned', 'ready', 'bus_coming', 'bus_arrived', 'countdown', 'on_board'].includes(s.key))
  }
  return steps
}

const paletteMap = {
  blue:   { doneBg: 'bg-blue-500',      doneText: 'text-blue-700',     doneLine: 'bg-blue-300',      ring: 'ring-blue-500' },
  green:  { doneBg: 'bg-green-500',     doneText: 'text-green-800',    doneLine: 'bg-green-300',     ring: 'ring-green-500' },
  amber:  { doneBg: 'bg-amber-500',     doneText: 'text-amber-800',    doneLine: 'bg-amber-300',     ring: 'ring-amber-500' },
  indigo: { doneBg: 'bg-indigo-500',    doneText: 'text-indigo-800',   doneLine: 'bg-indigo-300',    ring: 'ring-indigo-500' },
  violet: { doneBg: 'bg-violet-500',    doneText: 'text-violet-800',   doneLine: 'bg-violet-300',    ring: 'ring-violet-500' },
  purple: { doneBg: 'bg-purple-500',    doneText: 'text-purple-800',   doneLine: 'bg-purple-300',    ring: 'ring-purple-500' },
}

function formatTimeShort(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    let h = d.getHours()
    const m = d.getMinutes()
    const ampm = h < 12 ? 'ص' : 'م'
    h = h % 12 || 12
    return `${h}:${String(m).padStart(2, '0')} ${ampm}`
  } catch { return '' }
}

function ReturnTripTimelineImpl(ctx) {
  const steps = buildSteps(ctx)

  return (
    <div className="rt-card-surface p-2.5 sm:p-3 rt-anim-fade-in">
      <div className="flex items-center justify-between px-1 pt-0.5 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Flag size={12} className="text-[var(--color-primary)]" />
          </div>
          <h3 className="text-[11px] font-extrabold text-slate-800 tracking-wide">تسلسل رحلة العودة</h3>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">{steps.filter(s => s.done).length}/{steps.length}</span>
      </div>

      <div className="space-y-0.5 pr-0.5">
        {steps.map((step, idx) => {
          const Icon = step.icon
          const palette = paletteMap[step.palette] || paletteMap.blue
          const isLast = idx === steps.length - 1
          const timeStr = formatTimeShort(step.time)

          const iconCls = step.done
            ? `${palette.doneBg} text-white border-transparent`
            : step.active
              ? `bg-white text-[var(--color-primary)] border-[var(--color-primary)] ring-2 ${palette.ring} ring-offset-2 rt-anim-timeline-glow`
              : 'bg-white text-slate-300 border-slate-200'

          const lineCls = step.done ? palette.doneLine : 'bg-slate-100'

          const titleCls = step.done
            ? palette.doneText
            : step.active
              ? 'text-[var(--color-primary-dark)] font-extrabold'
              : 'text-slate-400'

          const subCls = step.done ? 'text-slate-500' : step.active ? 'text-[var(--color-primary)]/70' : 'text-slate-300'

          return (
            <div key={step.key} className="rt-timeline-step flex items-start gap-2.5">
              <div className="flex flex-col items-center">
                <div className={`rt-timeline-icon ${iconCls}`} aria-hidden>
                  <Icon size={14} strokeWidth={step.active ? 2.75 : 2.5} />
                </div>
                {!isLast && <div className={`rt-timeline-line ${step.done ? 'rt-timeline-line--done' : ''} ${lineCls}`} />}
              </div>
              <div className="flex-1 min-w-0 pt-1 pb-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[11.5px] font-bold ${titleCls} ${step.active ? 'rt-anim-slide-down' : ''}`}>
                    {step.title}
                  </p>
                  {timeStr && (
                    <span className="text-[10px] font-semibold text-slate-400 shrink-0 tabular-nums">{timeStr}</span>
                  )}
                </div>
                <p className={`text-[10.5px] leading-tight mt-0.5 ${subCls}`}>{step.subtitle}</p>
                {step.active && (
                  <span className="inline-block mt-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]">
                    الحالية
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const ReturnTripTimeline = memo(ReturnTripTimelineImpl)
