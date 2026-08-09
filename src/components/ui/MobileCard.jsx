import { motion } from 'framer-motion'

export default function MobileCard({ children, className = '', index = 0, ...props }) {
  const cls = `flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl transition-colors max-sm:flex-col max-sm:gap-2 ${className}`
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`${cls} lg:min-h-full`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
