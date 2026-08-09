import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KpiCard({ title, value, subtitle, trend, trendValue, icon: Icon, color = 'primary', loading, onClick }) {
  const colors = {
    primary: { bg: 'var(--color-primary-lighter)', text: 'var(--color-primary-dark)' },
    accent: { bg: 'var(--color-accent-lighter)', text: 'var(--color-accent-dark)' },
    success: { bg: 'var(--color-success-light)', text: '#16A34A' },
    warning: { bg: 'var(--color-warning-light)', text: '#D97706' },
    danger: { bg: 'var(--color-danger-light)', text: '#DC2626' },
    info: { bg: 'var(--color-info-light)', text: 'var(--color-primary-dark)' },
  }
  const c = colors[color] || colors.primary

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? '#16A34A' : trend === 'down' ? '#DC2626' : 'var(--color-text-muted)'

  if (loading) {
    return (
      <div className="card p-2 sm:p-3 lg:p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-7 sm:h-9 w-7 sm:w-9 rounded-xl" />
        </div>
        <div className="skeleton h-6 sm:h-7 lg:h-8 w-16 rounded mt-1" />
        <div className="skeleton h-2 w-20 rounded mt-1.5" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`card p-2 sm:p-3 lg:p-4 relative overflow-hidden transition-shadow duration-200 hover:shadow-pop ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <span className="absolute inset-x-0 top-0 h-1 opacity-60" style={{ background: c.text }} />
      <div className="flex items-start justify-between mb-1.5 sm:mb-2">
        <span className="text-[10px] sm:text-xs lg:text-sm text-[var(--color-text-secondary)] font-medium leading-tight">{title}</span>
        <div className="w-6 sm:w-8 lg:w-9 h-6 sm:h-8 lg:h-9 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0" style={{ background: c.bg }}>
          {Icon && <Icon className="!w-3 sm:!w-[14px] lg:!w-4 !h-3 sm:!h-[14px] lg:!h-4" style={{ color: c.text }} strokeWidth={1.5} />}
        </div>
      </div>
      <div className="text-base sm:text-xl lg:text-2xl font-bold leading-tight tracking-tight" style={{ color: c.text }}>
        {value ?? '-'}
      </div>
      {(trend || subtitle) && (
        <div className="flex items-center gap-1.5 mt-1">
          {trend && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] lg:text-xs font-medium" style={{ color: trendColor }}>
              <TrendIcon className="!w-[10px] sm:!w-[11px] lg:!w-3 !h-[10px] sm:!h-[11px] lg:!h-3" />
              {trendValue}
            </span>
          )}
          {subtitle && <span className="text-[9px] sm:text-[10px] lg:text-xs text-[var(--color-text-muted)]">{subtitle}</span>}
        </div>
      )}
    </motion.div>
  )
}
