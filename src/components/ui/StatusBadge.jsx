export default function StatusBadge({ status, label, size = 'sm' }) {
  const map = {
    active: { cls: 'badge-green', default: 'نشط' },
    inactive: { cls: 'badge-red', default: 'غير نشط' },
    paid: { cls: 'badge-green', default: 'مسدد' },
    partial: { cls: 'badge-orange', default: 'جزئي' },
    pending: { cls: 'badge-orange', default: 'قيد الانتظار' },
    approved: { cls: 'badge-green', default: 'معتمد' },
    rejected: { cls: 'badge-red', default: 'مرفوض' },
    scheduled: { cls: 'badge-blue', default: 'مجدول' },
    in_progress: { cls: 'badge-orange', default: 'قيد التشغيل' },
    completed: { cls: 'badge-green', default: 'مكتمل' },
    cancelled: { cls: 'badge-red', default: 'ملغي' },
    open: { cls: 'badge-blue', default: 'مفتوح' },
    closed: { cls: 'badge-gray', default: 'مغلق' },
    available: { cls: 'badge-green', default: 'متاح' },
    departed: { cls: 'badge-blue', default: 'منطلق' },
    full: { cls: 'badge-orange', default: 'ممتلئ' },
    maintenance: { cls: 'badge-orange', default: 'صيانة' },
    morning: { cls: 'badge-blue', default: 'صباحي' },
    evening: { cls: 'badge-purple', default: 'مسائي' },
    jebali: { cls: 'badge-blue', default: 'جبالي' },
    bahry: { cls: 'badge-green', default: 'بحري' },
    home: { cls: 'badge-orange', default: 'توصيل منزل' },
    line: { cls: 'badge-blue', default: 'خط عام' },
    transfer: { cls: 'badge-purple', default: 'تحويل' },
    male: { cls: 'badge-blue', default: 'ذكر' },
    female: { cls: 'badge-pink', default: 'أنثى' },
  }

  const m = map[status]
  return (
    <span className={m?.cls || 'badge-gray'}>
      {label || m?.default || status}
    </span>
  )
}
