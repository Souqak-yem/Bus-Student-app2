import { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Clock, AlertTriangle, Phone, Volume2 } from 'lucide-react'

const NOTIFY_AT = {
  10: { label: '١٠ دقائق متبقية', type: 'info' },
  5:  { label: '٥ دقائق فقط متبقية', type: 'warn' },
  2:  { label: '٢ دقيقة! توجه للباص فوراً', type: 'warn-lg' },
}

function vibrate(pattern = [80, 60, 80]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch {}
}

function showNotification({ title, body, tag, silent = false }) {
  try {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    new Notification(title, { body, tag, silent, icon: '/favicon.ico' })
  } catch {}
}

function BoardingCountdownImpl({ timer, onEnded, onSupervisorCall, supervisorPhone }) {
  const [now, setNow] = useState(() => new Date())
  const notifierRef = useRef({})
  const endedFiredRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const calc = useMemo(() => {
    if (!timer?.startedAt) return null
    const startedAt = new Date(timer.startedAt)
    const effectiveNow = new Date(Date.now())

    const durationMin = Number(timer.durationMinutes) || 15
    const durationMs = durationMin * 60 * 1000
    const endMs = startedAt.getTime() + durationMs
    const remainingMs = Math.max(0, endMs - effectiveNow.getTime())
    const elapsedMs = Math.max(0, durationMs - remainingMs)
    const pct = durationMs > 0 ? Math.max(0, Math.min(100, (elapsedMs / durationMs) * 100)) : 0
    const mm = Math.floor(remainingMs / 60000)
    const ss = Math.floor((remainingMs % 60000) / 1000)
    const totalSec = Math.floor(remainingMs / 1000)
    const isEnded = remainingMs <= 0 || !!timer.endedAt

    return {
      remainingMs, mm, ss, pct, isEnded, totalSec,
      minLeft: Math.ceil(remainingMs / 60000),
    }
  }, [timer, now])

  // Notifications + vibration triggers on minute milestones
  useEffect(() => {
    if (!calc || calc.isEnded) return
    for (const [minStr, meta] of Object.entries(NOTIFY_AT)) {
      const threshold = Number(minStr) * 60
      const notifyKey = `min_${minStr}`
      if (
        calc.totalSec > 0 &&
        calc.totalSec <= threshold &&
        calc.totalSec > threshold - 1.5 &&
        !notifierRef.current[notifyKey]
      ) {
        notifierRef.current[notifyKey] = true
        showNotification({
          title: `⏳ تنبيه رحلة العودة`,
          body: meta.label,
          tag: notifyKey,
        })
        if (Number(minStr) === 2) vibrate([120, 80, 120, 80, 180])
        else vibrate([70, 50, 70])
      }
    }
    // Last 60 seconds → vibration once per minute threshold
    if (calc.totalSec <= 60 && calc.totalSec > 59 && !notifierRef.current['last_min']) {
      notifierRef.current['last_min'] = true
      vibrate([150, 100, 150, 100, 150])
      showNotification({ title: '⚠️ آخر دقيقة للصعود', body: 'يرجى الصعود فوراً', tag: 'last_min' })
    }
    // Last 15 seconds → strong vibration
    if (calc.totalSec <= 15 && calc.totalSec > 14 && !notifierRef.current['last_15s']) {
      notifierRef.current['last_15s'] = true
      vibrate([200, 80, 200, 80, 200, 80, 300])
    }
  }, [calc])

  // Fire ended callback once
  useEffect(() => {
    if (calc?.isEnded && !endedFiredRef.current) {
      endedFiredRef.current = true
      onEnded?.()
    }
  }, [calc?.isEnded, onEnded])

  // Reset notifier cache when timer resets (new startedAt)
  useEffect(() => {
    notifierRef.current = {}
    endedFiredRef.current = false
  }, [timer?.startedAt])

  if (!calc) return null

  if (calc.isEnded) {
    return (
      <div className="rounded-xl p-3 border border-red-200 bg-gradient-to-br from-red-50 to-white rt-anim-notification-pop">
        <div className="flex items-start gap-2.5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-600" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="text-[13px] font-black text-red-900 leading-tight">⛔ انتهى وقت التجمع</h3>
            <p className="text-[11px] text-red-800/85 mt-0.5 leading-snug">
              لقد انتهى وقت تسجيل الصعود. يرجى التواصل مع المشرف فوراً للحصول على تعليمات.
            </p>
            {supervisorPhone && (
              <a
                href={`tel:${supervisorPhone}`}
                className="mt-2 inline-flex items-center justify-center gap-1.5 w-full sm:w-auto rt-btn-min px-3 rounded-lg bg-red-600 active:bg-red-700 text-white text-[11.5px] font-extrabold"
              >
                <Phone size={14} strokeWidth={2.5} /> اتصال بالمشرف
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  const critical = calc.totalSec <= 15
  const warn = calc.totalSec <= 120
  const soft = calc.totalSec <= 300

  const numberColor = critical
    ? 'rt-countdown-critical rt-anim-shake'
    : warn
      ? 'text-red-600'
      : soft
        ? 'text-amber-600'
        : 'text-indigo-700'

  const progressColor = critical
    ? 'bg-gradient-to-r from-red-500 to-red-600 rt-progress-striped'
    : warn
      ? 'bg-gradient-to-r from-amber-500 to-red-500'
      : soft
        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
        : 'bg-gradient-to-r from-indigo-500 to-violet-500'

  const cardBg = warn ? 'bg-gradient-to-br from-red-50 via-white to-amber-50 border-amber-200' : 'bg-gradient-to-br from-indigo-50 via-white to-violet-50 border-indigo-100'

  return (
    <div className={`rounded-xl p-2.5 sm:p-3 border ${cardBg} rt-anim-slide-down`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${warn ? 'bg-red-100' : 'bg-indigo-100'}`}>
            <Clock size={12} className={warn ? 'text-red-600' : 'text-indigo-600'} strokeWidth={2.8} />
          </div>
          <span className={`text-[11px] font-black ${warn ? 'text-red-800' : 'text-indigo-800'}`}>
            العد التنازلي للصعود
          </span>
          {critical && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-black bg-red-600 text-white rt-anim-pulse-ring relative">
              <Volume2 size={10} /> حرج
            </span>
          )}
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${warn ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'}`}>
          زمن: {timer.durationMinutes || 15} د
        </span>
      </div>

      <div className="text-center py-0.5">
        <span className={`rt-countdown-digit-mono text-4xl sm:text-5xl font-black tracking-wider ${numberColor} ${critical ? 'rt-anim-digit' : ''}`}>
          {String(calc.mm).padStart(2, '0')}
          <span className={critical ? 'opacity-80' : ''}>:</span>
          {String(calc.ss).padStart(2, '0')}
        </span>
      </div>

      <div className="mt-1.5 w-full h-2 rounded-full bg-white overflow-hidden ring-1 ring-slate-200/70">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${progressColor}`}
          style={{ width: `${calc.pct}%` }}
        />
      </div>

      <p className={`text-center text-[10.5px] font-bold mt-1.5 ${warn ? 'text-red-800/90' : 'text-indigo-700'}`}>
        وصل الباص إلى الجامعة · قم بالتوجه للباص الآن
      </p>
    </div>
  )
}

export const BoardingCountdown = memo(BoardingCountdownImpl)
