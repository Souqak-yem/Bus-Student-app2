import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

const DAY_MS = 24 * 60 * 60 * 1000

export default function DiscountExpiryBadge({ expiry }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const end = new Date(expiry)
  if (Number.isNaN(end.getTime())) return null

  const remainingMs = end.getTime() - now.getTime()
  if (remainingMs <= 0) return null

  if (remainingMs <= DAY_MS) {
    const totalSec = Math.floor(remainingMs / 1000)
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-white">
        <Clock size={11} />
        ينتهي الخصم بعد {hh}:{mm}:{ss}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap text-emerald-700">
      <Clock size={11} />
      ينتهي الخصم في {end.toLocaleDateString('ar-SA')}
    </span>
  )
}
