import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Users as UsersIcon, UserPlus, Search, Filter, Shield, Bus,
  GraduationCap, RefreshCw, CheckCircle, XCircle, Trash2, Clock, MoreHorizontal,
} from 'lucide-react'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import DataTable from '../../components/ui/DataTable'
import StatusBadge from '../../components/ui/StatusBadge'
import Section from '../../components/ui/Section'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmModal from '../../components/ui/ConfirmModal'

const roleIcons = { admin: Shield, driver: Bus, student: GraduationCap }
const roleLabels = { admin: 'مشرف', driver: 'سائق', student: 'طالب' }
const roleColors = { admin: 'danger', driver: 'info', student: 'success' }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ username: '', name: '', password: '', adminPermissions: [] })
  const [actionLoading, setActionLoading] = useState(null)

  async function load() {
    try {
      const params = {}
      if (filterRole) params.role = filterRole
      if (filterStatus) params.status = filterStatus
      if (searchTerm) params.search = searchTerm
      const data = await api.users.list(params)
      setUsers(data)
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filterRole, filterStatus, searchTerm])

  async function handleCreate(e) {
    e.preventDefault()
    try {
      await api.users.create({
        ...createForm,
        role: 'admin',
      })
      setShowCreate(false)
      setCreateForm({ username: '', name: '', password: '', adminPermissions: [] })
      load()
    } catch (err) { alert(err.message) }
  }


  async function handleDeleteUser(id) {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return
    setActionLoading(id)
    try {
      await api.users.delete(id)
      load()
    } catch (err) { alert(err.message) } finally { setActionLoading(null) }
  }

  async function handleToggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    try { await api.users.updateStatus(id, newStatus); load() } catch (err) { alert(err.message) }
  }

  async function handleGenerateUsername(id) {
    try {
      const result = await api.users.generateUsername(id)
      alert(`تم إنشاء اسم المستخدم: ${result.username}`)
      load()
    } catch (err) { alert(err.message) }
  }

  const columns = useMemo(() => [
    {
      key: 'username', label: 'اسم المستخدم',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-border-light)] flex items-center justify-center">
            {roleIcons[row.role] ? <Shield size={14} className="text-[var(--color-text-muted)]" /> : <Shield size={14} />}
          </div>
          <div>
            <p className="font-medium text-sm">{row.username}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">{row.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', label: 'الدور',
      render: (row) => <StatusBadge status={roleColors[row.role]} label={roleLabels[row.role] || row.role} />,
    },
    {
      key: 'status', label: 'الحالة',
      render: (row) => <StatusBadge status={row.status === 'active' ? 'success' : 'error'} label={row.status === 'active' ? 'نشط' : row.status === 'suspended' ? 'موقوف' : 'غير نشط'} />,
    },
    {
      key: 'mustChangePassword', label: 'تغيير كلمة المرور', hideOnMobile: true,
      render: (row) => row.mustChangePassword
        ? <span className="badge-accent text-xs">مطلوب</span>
        : <span className="text-xs text-[var(--color-text-muted)]">تم</span>,
    },
    {
      key: 'lastLogin', label: 'آخر دخول', hideOnMobile: true,
      render: (row) => row.lastLogin
        ? <span className="text-xs text-[var(--color-text-muted)]">{new Date(row.lastLogin).toLocaleString('ar-SA')}</span>
        : <span className="text-xs text-[var(--color-text-muted)]">-</span>,
    },
    {
      key: 'linked', label: 'مرتبط بـ', hideOnMobile: true,
      render: (row) => {
        if (row.student) return <span className="text-xs">{row.student.name}</span>
        return <span className="text-xs text-[var(--color-text-muted)]">-</span>
      },
    },
    {
      key: 'actions', label: '',
      render: (row) => (
        <div className="flex gap-1">
          <button onClick={() => handleToggleStatus(row.id, row.status)} className="btn-ghost btn-sm" title={row.status === 'active' ? 'إيقاف' : 'تفعيل'}>
            {row.status === 'active' ? <XCircle size={14} className="text-[var(--color-danger)]" /> : <CheckCircle size={14} className="text-green-600" />}
          </button>
          {row.role !== 'admin' && (
            <>
              <button onClick={() => handleGenerateUsername(row.id)} className="btn-ghost btn-sm" title="توليد اسم مستخدم">
                <RefreshCw size={14} />
              </button>
              <button onClick={() => handleDeleteUser(row.id)} className="btn-ghost btn-sm" title="حذف المستخدم" disabled={actionLoading === row.id}>
                <Trash2 size={14} className="text-[var(--color-danger)]" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ], [actionLoading])

  return (
    <div>
      <PageHeader title="المستخدمين" subtitle="إدارة حسابات المستخدمين">
        <button onClick={() => setShowCreate(true)} className="btn-primary"><UserPlus size={16} /> إضافة مشرف</button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end mb-4">
        <div className="min-w-[140px] flex-1 sm:flex-none">
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">الدور</label>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="select-field text-sm">
            <option value="">الكل</option>
            <option value="admin">مشرف</option>
            <option value="driver">سائق</option>
            <option value="student">طالب</option>
          </select>
        </div>
        <div className="min-w-[140px] flex-1 sm:flex-none">
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">الحالة</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select-field text-sm">
            <option value="">الكل</option>
            <option value="active">نشط</option>
            <option value="suspended">موقوف</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>
        <div className="w-full sm:flex-1 sm:w-auto">
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">بحث</label>
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="اسم المستخدم أو الاسم..." className="input-field pr-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content max-w-[min(95vw,760px)] lg:max-w-[920px] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">إضافة مشرف جديد</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">الاسم</label>
                <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">اسم المستخدم</label>
                <input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">كلمة المرور</label>
                <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="input-field" required />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">الصلاحيات</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-surface-soft)]">
                  {[
                    { key: 'dashboard', label: 'لوحة التحكم' },
                    { key: 'students', label: 'الطلاب' },
                    { key: 'buses', label: 'الباصات' },
                    { key: 'operations', label: 'التشغيل' },
                    { key: 'emergency', label: 'مركز الطوارئ' },
                    { key: 'destinations', label: 'الوجهات' },
                    { key: 'subscriptions', label: 'الاشتراكات' },
                    { key: 'financialControl', label: 'الإدارة المالية' },
                    { key: 'reports', label: 'الكشوف الأسبوعية' },
                    { key: 'manageUsers', label: 'إدارة المستخدمين' },
                    { key: 'manageSettings', label: 'الإعدادات' },
                    { key: 'manageSystem', label: 'إدارة النظام' },
                    { key: 'controlTransfers', label: 'التحويلات' },
                    { key: 'controlAudit', label: 'التدقيق' },
                  ].map((page) => {
                    const checked = createForm.adminPermissions.includes(page.key)
                    return (
                      <label key={page.key} className="flex items-center gap-2 rounded-lg px-2 py-2 bg-white border border-[var(--color-border)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const value = e.target.checked
                            setCreateForm((prev) => ({
                              ...prev,
                              adminPermissions: value
                                ? [...prev.adminPermissions, page.key]
                                : prev.adminPermissions.filter((item) => item !== page.key),
                            }))
                          }}
                        />
                        <span className="text-sm">{page.label}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">اختر الصفحات التي يسمح لهذا المشرف بالوصول إليها.</p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-[var(--color-border)] sticky bottom-0 bg-white -mx-3 sm:-mx-6 px-3 sm:px-6 pb-0 max-sm:pb-[80px] mt-4">
                <button type="submit" className="btn-primary flex-1 sm:flex-none justify-center min-h-[44px]">إضافة</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1 sm:flex-none justify-center min-h-[44px]">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={users} loading={loading}
        emptyTitle="لا توجد نتائج" emptyDescription="لم يتم العثور على مستخدمين"
        emptyAction={filterRole || filterStatus || searchTerm ? { label: 'مسح الفلتر', onClick: () => { setFilterRole(''); setFilterStatus(''); setSearchTerm('') } } : undefined} />

    </div>
  )
}
