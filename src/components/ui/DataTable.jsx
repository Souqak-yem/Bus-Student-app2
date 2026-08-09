import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, ChevronDown, Eye, EyeOff } from 'lucide-react'

export default function DataTable({
  columns = [],
  data = [],
  loading,
  searchable = true,
  searchPlaceholder = 'بحث...',
  pagination = true,
  pageSize = 20,
  onRowClick,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyActionText,
  bulkActions,
  selectedRows,
  onSelectionChange,
  renderRow,
  keyExtractor = (row) => row.id,
  mobileCards = false,
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState(columns.reduce((a, c) => ({ ...a, [c.key]: true }), {}))
  const [showColMenu, setShowColMenu] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const val = col.accessor ? col.accessor(row) : row[col.key]
        return val != null && String(val).toLowerCase().includes(q)
      })
    )
  }, [data, search, columns])

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = pagination ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered

  const visibleCols = columns.filter(c => visibleColumns[c.key] !== false)

  function toggleCol(key) {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  /** Returns responsive hide classes for a column: hideOnMobile / hideOnTablet */
  function colHiddenClass(col) {
    let cls = ''
    if (col.hideOnMobile) cls += ' max-sm:hidden'
    if (col.hideOnTablet) cls += ' hidden md:table-cell'
    return cls
  }

  if (loading) {
    return (
      <div className="card p-4 sm:p-6">
        <div className="space-y-3">
          <div className="flex gap-4 p-3">
            {columns.slice(0, 5).map((_, i) => (
              <div key={i} className="skeleton h-4 flex-1 rounded" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex gap-4 p-3 border-t border-[var(--color-border-light)]">
              {columns.slice(0, 5).map((_, c) => (
                <div key={c} className="skeleton h-4 flex-1 rounded" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!filtered.length) {
    return (
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
          <div className="w-12 h-12 text-[var(--color-text-muted)] mb-4 opacity-50">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text)] mb-2">{emptyTitle || 'لا توجد بيانات'}</h3>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xs">{emptyDescription || ''}</p>
          {emptyAction && emptyActionText && (
            <button onClick={emptyAction} className="btn-primary mt-4">{emptyActionText}</button>
          )}
        </div>
      </div>
    )
  }

  const cardView = mobileCards

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border-b border-[var(--color-border)] bg-slate-50/50">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {searchable && (
            <div className="relative w-full sm:max-w-sm">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="input-field pr-9 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {bulkActions && selectedRows?.length > 0 && bulkActions}
          <div className="relative">
            <button onClick={() => setShowColMenu(!showColMenu)} className="btn-ghost btn-sm">
              <Eye size={14} />
              <span>الأعمدة</span>
              <ChevronDown size={12} />
            </button>
            {showColMenu && (
              <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-[var(--color-border)] py-1 z-20 min-w-[160px]" onMouseLeave={() => setShowColMenu(false)}>
                {columns.map(col => (
                  <button key={col.key} onClick={() => toggleCol(col.key)} className="w-full text-right px-3 py-1.5 text-sm hover:bg-[var(--color-border-light)] flex items-center gap-2">
                    {visibleColumns[col.key] !== false ? <EyeOff size={14} /> : <Eye size={14} />}
                    {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table / Card View */}
      <div className={`${cardView ? 'max-sm:overflow-x-visible' : ''} overflow-x-auto`}>
        <table className="w-full border-collapse border-spacing-0">
          <thead className={`${cardView ? 'max-sm:hidden' : ''}`}>
            <tr>
              {visibleCols.map(col => (
                <th key={col.key} className={`text-right px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider border-b border-[var(--color-border)] whitespace-nowrap bg-slate-50/90 sticky top-0 z-10${colHiddenClass(col)}`} style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((row, idx) => (
              <motion.tr
                key={keyExtractor(row)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${cardView ? 'max-sm:block max-sm:border max-sm:rounded-xl max-sm:p-3 max-sm:mb-2 max-sm:bg-white max-sm:border-[var(--color-border)]' : ''} ${!cardView ? 'hover:bg-[var(--color-border-light)]' : ''} transition-colors`}
              >
                {renderRow
                  ? renderRow(row, visibleCols)
                  : visibleCols.map(col => (
                      <td key={col.key} className={`px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-b border-[var(--color-border-light)]${colHiddenClass(col)} ${cardView ? 'max-sm:flex max-sm:justify-between max-sm:items-center max-sm:py-2 max-sm:border-b max-sm:border-[var(--color-border-light)] last:max-sm:border-b-0 max-sm:gap-2' : ''}`} data-label={col.label}>
                        {cardView && (
                          <span className="hidden max-sm:inline font-semibold text-[10px] sm:text-xs text-[var(--color-text-secondary)] whitespace-nowrap shrink-0">{col.label}</span>
                        )}
                        <span className="text-right">{col.render ? col.render(row) : row[col.key] ?? '-'}</span>
                      </td>
                    ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-muted)] order-2 sm:order-1">
            {filtered.length} نتيجة · صفحة {page} من {totalPages}
          </span>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-ghost btn-sm disabled:opacity-30"
            >
              السابق
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = i + 1
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`btn-sm min-h-[36px] ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-ghost btn-sm disabled:opacity-30"
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
