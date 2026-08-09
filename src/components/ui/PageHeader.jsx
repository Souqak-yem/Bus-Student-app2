import { motion } from 'framer-motion'

export default function PageHeader({ title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full items-center justify-between flex-wrap gap-3 mb-4 sm:mb-6 lg:items-end"
    >
      <div>
        <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[var(--color-text)] text-balance flex items-center gap-2">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </motion.div>
  )
}
