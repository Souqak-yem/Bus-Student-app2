import { motion } from 'framer-motion'

export default function Section({ title, subtitle, icon: Icon, children, className = '', headerRight, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={`card p-4 sm:p-6 transition-shadow duration-200 hover:shadow-pop ${className}`}
    >
      {(title || headerRight) && (
        <div className="flex items-center justify-between mb-4 sm:mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className="text-[var(--color-text-secondary)]" strokeWidth={1.5} />}
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[var(--color-text)] flex items-center gap-2">{title}</h2>
              {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}
      {children}
    </motion.div>
  )
}
