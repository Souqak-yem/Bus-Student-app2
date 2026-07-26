import { memo } from 'react'
import { Check, Clock3, MapPinned, Users } from 'lucide-react'

function AnimatedCheck() {
  return (
    <div className="rt-checkmark-circle-anim w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <circle cx="28" cy="28" r="26" fill="#DCFCE7" stroke="#86EFAC" strokeWidth="2" />
        <circle cx="28" cy="28" r="19" fill="#22C55E" />
        <path
          className="rt-checkmark-path"
          d="M17 28 L24.5 35.5 L39 20"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  )
}

function ReadinessConfirmationImpl({ readiness, readyCount, totalCount }) {
  const status = readiness?.status || 'NO_RESPONSE'
  const readyPct = totalCount > 0 ? Math.min(100, Math.round((readyCount / totalCount) * 100)) : 0

  if (status === 'READY') {
    return (
      <div className="rt-card-header-gradient-green rounded-xl p-3 rt-anim-scale-in">
        <div className="flex items-start gap-2.5">
          <AnimatedCheck />
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[13px] font-black text-green-900 leading-tight">✅ تم تأكيد جاهزيتك</h3>
            <p className="text-[11px] text-green-800/85 mt-0.5 leading-snug">
              تم إرسال حالتك للمشرف والسائق. يرجى التوجه إلى نقطة التجمع قبل وصول الباص.
            </p>
            {totalCount > 0 && (
              <div className="mt-2 rounded-lg bg-white/70 border border-green-100 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-extrabold text-green-800 flex items-center gap-1">
                    <Users size={11} /> زملاؤك في هذا الباص
                  </span>
                  <span className="text-[10px] font-black text-green-900 tabular-nums">{readyCount}/{totalCount} جاهز</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-green-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-green-400 to-green-600 transition-all duration-700"
                    style={{ width: `${readyPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'DELAYED') {
    return (
      <div className="rt-card-header-gradient-amber rounded-xl p-3 rt-anim-scale-in">
        <div className="flex items-start gap-2.5">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto shrink-0 rt-anim-badge-bounce">
            <Clock3 size={28} className="text-amber-600" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[13px] font-black text-amber-900 leading-tight">⏱ تم إبلاغ تأخيرك</h3>
            <p className="text-[11px] text-amber-800/85 mt-0.5 leading-snug">
              {readiness?.delayMinutes ? `سأتأخر حوالي ${readiness.delayMinutes} دقيقة. ` : ''}
              تم إرسال تنبيه للمشرف والسائق. عندما تصل إلى نقطة التجمع اضغط: وصلت.
            </p>
            {readiness?.delayReason && (
              <p className="mt-1.5 inline-block max-w-full text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md truncate">
                السبب: {readiness.delayReason}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

export const ReadinessConfirmation = memo(ReadinessConfirmationImpl)
