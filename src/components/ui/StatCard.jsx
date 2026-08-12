import { motion } from 'framer-motion'

const iconColors = {
  blue: 'bg-blue-50 text-primary',
  orange: 'bg-orange-50 text-accent',
  green: 'bg-green-50 text-green-600',
  red: 'bg-red-50 text-red-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  purple: 'bg-purple-50 text-purple-600',
  indigo: 'bg-indigo-50 text-indigo-600',
}

export default function StatCard({ icon: Icon, label, value, subtitle, trend, trendLabel, color = 'blue', progress, onClick }) {
  const colorClass = iconColors[color] || iconColors.blue

  return (
    <motion.div
      whileHover={{ y: -1, boxShadow: '0 8px 18px -8px rgba(0,0,0,0.1)' }}
      className="card p-2 sm:p-5 cursor-pointer relative overflow-hidden min-h-[92px] sm:min-h-[150px] max-h-[120px] sm:max-h-none"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-1.5 sm:mb-3">
        <div className={`w-7 h-7 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl ${colorClass} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
        </div>
        {trend != null && (
          <span className={`text-[9px] sm:text-xs font-semibold flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="space-y-0 sm:space-y-1">
        <div className="text-base sm:text-2xl lg:text-[2rem] font-bold text-[var(--color-text)] leading-none">{value ?? '—'}</div>
        <div className="text-[9px] sm:text-sm text-[var(--color-text-secondary)] leading-tight">{label}</div>
        {subtitle && <div className="text-[8px] sm:text-xs text-slate-400">{subtitle}</div>}
        {trendLabel && <div className="text-[8px] sm:text-xs text-slate-400">{trendLabel}</div>}
      </div>
      {progress != null && (
        <div className="mt-1.5 sm:mt-3 h-1 sm:h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 1, delay: 0.3 }}
            className={`h-full rounded-full ${progress > 80 ? 'bg-green-500' : progress > 50 ? 'bg-yellow-500' : 'bg-primary'}`}
          />
        </div>
      )}
    </motion.div>
  )
}
