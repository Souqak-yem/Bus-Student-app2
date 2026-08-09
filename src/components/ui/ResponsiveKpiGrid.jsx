export default function ResponsiveKpiGrid({ children, className = '' }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 ${className}`}>
      {children}
    </div>
  )
}
