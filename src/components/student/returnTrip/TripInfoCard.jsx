import { memo } from 'react'
import { MapPin, Clock, Users, UserCheck } from 'lucide-react'

function TripInfoCardImpl({ pickupPoint, departureTime, readyCount, totalCount, onBoardCount }) {
  const remaining = totalCount > 0 ? Math.max(0, totalCount - readyCount) : 0
  const readyPct = totalCount > 0 ? Math.min(100, Math.round((readyCount / totalCount) * 100)) : 0

  const items = []

  if (pickupPoint) {
    items.push({
      icon: MapPin,
      iconBg: 'bg-violet-100 text-violet-700',
      label: 'نقطة التجمع',
      value: pickupPoint,
    })
  }

  if (departureTime) {
    items.push({
      icon: Clock,
      iconBg: 'bg-blue-100 text-blue-700',
      label: 'موعد الانطلاق',
      value: departureTime,
    })
  }

  items.push({
    icon: UserCheck,
    iconBg: 'bg-green-100 text-green-700',
    label: 'أكدوا جاهزيتهم',
    value: `${readyCount} طالب`,
    extra: totalCount > 0 ? `${readyPct}%` : null,
  })

  items.push({
    icon: Users,
    iconBg: 'bg-amber-100 text-amber-700',
    label: 'المتبقون',
    value: `${remaining} طالب${remaining === 1 ? '' : 'اً'}`,
    extra: onBoardCount > 0 ? `تم الصعود: ${onBoardCount}` : null,
  })

  return (
    <div className="rt-card-surface p-2.5 rt-anim-fade-in">
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div
              key={i}
              className="rounded-lg border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-2 flex items-start gap-2"
            >
              <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${item.iconBg}`}>
                <Icon size={14} strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-wide leading-none mb-1">{item.label}</p>
                <p className="text-[11.5px] font-extrabold text-slate-800 truncate leading-tight">{item.value}</p>
                {item.extra && <p className="text-[9.5px] font-bold text-slate-500 mt-0.5 tabular-nums">{item.extra}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {totalCount > 0 && (
        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-slate-500">نسبة الجاهزية</span>
            <span className="text-[10px] font-black text-slate-700 tabular-nums">{readyPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white overflow-hidden ring-1 ring-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${readyPct >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' : readyPct >= 50 ? 'bg-gradient-to-r from-indigo-400 to-indigo-600' : 'bg-gradient-to-r from-amber-400 to-amber-600'}`}
              style={{ width: `${readyPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export const TripInfoCard = memo(TripInfoCardImpl)
