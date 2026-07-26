import { memo } from 'react'
import { Bus, Phone, MessageCircle, Users, Clock, Building2, ChevronRight, User, UserRound } from 'lucide-react'

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = String(timeStr).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return ''
  const ampm = h < 12 ? 'ص' : 'م'
  const hr = h % 12 || 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

function DriverAvatar({ driver }) {
  const name = driver?.name || 'السائق'
  const letter = name.trim().charAt(0) || 'س'
  if (driver?.photoUrl) {
    return (
      <img
        src={driver.photoUrl}
        alt={name}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-slate-100"
        loading="lazy"
      />
    )
  }
  return (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm ring-2 ring-slate-100">
      <span className="font-extrabold text-sm">{letter}</span>
    </div>
  )
}

function ReturnBusCardImpl({ bus, driver, readiness, readinessStats, pickupPoint, expectedDeparture, currentUniversity, nextUniversity }) {
  const busNumber = bus?.busNumber || bus?.plateNumber || '---'
  const plate = bus?.plateNumber && bus?.plateNumber !== busNumber ? bus.plateNumber : null
  const capacity = bus?.capacity || 0
  const onBoardCount = readinessStats?.onBoard || 0
  const remaining = capacity > 0 ? Math.max(0, capacity - onBoardCount) : null

  const phone = driver?.phone || driver?.primaryPhone || bus?.primaryPhone || bus?.driverPhone || null
  const whatsappPhone = phone ? String(phone).replace(/\D/g, '') : null

  const statsReady = readinessStats?.ready ?? 0
  const statsTotal = readinessStats?.total ?? 0
  const statsReadyPct = statsTotal > 0 ? Math.min(100, Math.round((statsReady / statsTotal) * 100)) : 0

  return (
    <div className="rt-card-surface overflow-hidden rt-anim-slide-down">
      <div className="px-3 py-2.5 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <Bus size={22} className="text-white" strokeWidth={2.4} />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-white rounded-lg px-1.5 py-0.5 border border-slate-200 shadow-sm">
              <span className="text-[9px] font-black text-slate-700">#{busNumber}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-extrabold text-slate-900">باص العودة رقم {busNumber}</h3>
            </div>
            {plate && <p className="text-[10px] text-slate-500 font-medium mt-0.5">اللوحة: {plate}</p>}
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1 min-w-0">
                <User size={11} className="text-slate-400 shrink-0" />
                <span className="text-[10.5px] text-slate-600 font-medium truncate">{driver?.name || 'يتم تحديد السائق'}</span>
              </div>
            </div>
          </div>
          <DriverAvatar driver={driver} />
        </div>

        <div className="grid grid-cols-3 gap-1.5 mt-2.5">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center justify-center gap-1 bg-green-500 active:bg-green-600 text-white rounded-lg py-2 text-[10.5px] font-extrabold transition-colors rt-btn-min"
              aria-label="اتصال بالسائق"
            >
              <Phone size={13} strokeWidth={2.5} /> اتصال
            </a>
          )}
          {whatsappPhone && (
            <a
              href={`https://wa.me/${whatsappPhone.startsWith('00') ? whatsappPhone.slice(2) : whatsappPhone.startsWith('0') ? `966${whatsappPhone.slice(1)}` : whatsappPhone}?text=${encodeURIComponent('السلام عليكم، بخصوص رحلة العودة')}`}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center justify-center gap-1 bg-emerald-500 active:bg-emerald-600 text-white rounded-lg py-2 text-[10.5px] font-extrabold transition-colors rt-btn-min"
              aria-label="واتساب"
            >
              <MessageCircle size={13} strokeWidth={2.5} /> واتساب
            </a>
          )}
          {!phone && !whatsappPhone ? (
            <div className="flex items-center justify-center gap-1 bg-slate-100 text-slate-400 rounded-lg py-2 text-[10.5px] font-bold col-span-3">
              <Phone size={12} /> غير متوفر رقم تواصل
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <p className="text-[9.5px] text-slate-400 font-bold tracking-wide uppercase mb-0.5">الموجود حالياً</p>
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-blue-500" />
            <span className="text-sm font-extrabold text-slate-800 tabular-nums">{onBoardCount} طالب</span>
          </div>
        </div>
        {remaining !== null && (
          <div>
            <p className="text-[9.5px] text-slate-400 font-bold tracking-wide uppercase mb-0.5">المقاعد المتبقية</p>
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-slate-200" aria-hidden />
              <span className={`text-sm font-extrabold tabular-nums ${remaining > 2 ? 'text-green-600' : remaining > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                {remaining} مقعد{remaining === 1 ? '' : 'اً'}
              </span>
            </div>
          </div>
        )}
        {expectedDeparture && (
          <div>
            <p className="text-[9.5px] text-slate-400 font-bold tracking-wide uppercase mb-0.5">موعد الانطلاق</p>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-500" />
              <span className="text-sm font-extrabold text-slate-800 tabular-nums">{formatTime(expectedDeparture)}</span>
            </div>
          </div>
        )}
        {pickupPoint && (
          <div className="min-w-0">
            <p className="text-[9.5px] text-slate-400 font-bold tracking-wide uppercase mb-0.5">نقطة التجمع</p>
            <div className="flex items-center gap-1.5 min-w-0">
              <Building2 size={13} className="text-violet-500 shrink-0" />
              <span className="text-[12px] font-bold text-slate-700 truncate">{pickupPoint}</span>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-3 space-y-2">
        {(currentUniversity || nextUniversity) && (
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-2">
            <div className="grid grid-cols-2 gap-2">
              {currentUniversity && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                    <Building2 size={11} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 leading-none">الجامعة الحالية</p>
                    <p className="text-[10.5px] font-extrabold text-slate-700 truncate leading-tight mt-0.5">{currentUniversity}</p>
                  </div>
                </div>
              )}
              {nextUniversity && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-green-100 flex items-center justify-center shrink-0">
                    <ChevronRight size={11} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-slate-400 leading-none">التالية</p>
                    <p className="text-[10.5px] font-extrabold text-green-700 truncate leading-tight mt-0.5">{nextUniversity}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {statsTotal > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-500">جاهزية زملائك</span>
              <span className="text-[10px] font-extrabold text-slate-700 tabular-nums">{statsReady}/{statsTotal}</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all duration-500 ${statsReadyPct >= 80 ? 'bg-green-500' : statsReadyPct >= 50 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                style={{ width: `${statsReadyPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const ReturnBusCard = memo(ReturnBusCardImpl)
