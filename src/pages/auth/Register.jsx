import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import PageHeader from '../../components/ui/PageHeader'
import ConfirmModal from '../../components/ui/ConfirmModal'

const offDayOptions = [
  { value: 'SATURDAY', label: 'السبت' },
  { value: 'SUNDAY', label: 'الأحد' },
  { value: 'MONDAY', label: 'الإثنين' },
  { value: 'TUESDAY', label: 'الثلاثاء' },
  { value: 'WEDNESDAY', label: 'الأربعاء' },
  { value: 'THURSDAY', label: 'الخميس' },
]

const emptyForm = {
  name: '',
  phone: '',
  whatsapp: '',
  parentName: '',
  parentPhone: '',
  parentRelation: '',
  address: '',
  zone: '',
  destinationId: '',
  major: '',
  level: '',
  offDays: [],
  transportMode: '',
  pickupLocation: '',
  homeAddress: '',
}

export default function Register() {
  const [form, setForm] = useState(emptyForm)
  const [data, setData] = useState({ zones: [], destinations: [] })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [touched, setTouched] = useState({})
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const navigate = useNavigate()

  const errors = useMemo(() => {
    const errs = {}

    if (!form.name.trim()) errs.name = 'اسم الطالب مطلوب'
    if (!form.phone.trim()) errs.phone = 'رقم الجوال مطلوب'
    else if (!/^[0-9]+$/.test(form.phone.trim())) errs.phone = 'استخدم أرقاماً فقط'

    if (!form.whatsapp.trim()) errs.whatsapp = 'رقم الواتساب مطلوب'
    else if (!/^[0-9]+$/.test(form.whatsapp.trim())) errs.whatsapp = 'استخدم أرقاماً فقط'

    if (!form.zone) errs.zone = 'المنطقة مطلوبة'
    if (!form.destinationId) errs.destinationId = 'الوجهة مطلوبة'
    if (!form.address.trim()) errs.address = 'العنوان مطلوب'
    if (!form.major.trim()) errs.major = 'التخصص مطلوب'
    if (!form.level) errs.level = 'المستوى مطلوب'
    if (!form.parentName.trim()) errs.parentName = 'اسم ولي الأمر مطلوب'

    if (!form.parentPhone.trim()) errs.parentPhone = 'هاتف ولي الأمر مطلوب'
    else if (!/^[0-9]+$/.test(form.parentPhone.trim())) errs.parentPhone = 'استخدم أرقاماً فقط'

    if (!form.parentRelation.trim()) errs.parentRelation = 'صلة القرابة مطلوبة'
    if (!form.transportMode) errs.transportMode = 'نوع التوصيل مطلوب'

    if (form.transportMode === 'LINE' && !form.pickupLocation.trim()) errs.pickupLocation = 'نقطة الانتظار مطلوبة'
    if (form.transportMode === 'HOME' && !form.homeAddress.trim()) errs.homeAddress = 'عنوان المنزل مطلوب'

    return errs
  }, [form])

  useEffect(() => {
    async function load() {
      try {
        const registrationData = await api.studentPortal.getRegistrationData()
        setData(registrationData)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function toggleOffDay(value) {
    setForm((prev) => {
      const offDays = prev.offDays.includes(value)
        ? prev.offDays.filter((day) => day !== value)
        : [...prev.offDays, value]
      return { ...prev, offDays }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    setTouched({
      name: true,
      phone: true,
      whatsapp: true,
      zone: true,
      destinationId: true,
      address: true,
      major: true,
      level: true,
      parentName: true,
      parentPhone: true,
      parentRelation: true,
      transportMode: true,
      pickupLocation: true,
      homeAddress: true,
    })

    if (Object.keys(errors).length > 0) {
      setError('يرجى إكمال الحقول المطلوبة')
      return
    }

    setError('')
    setShowSubmitConfirm(true)
  }

  async function confirmSubmit() {
    setShowSubmitConfirm(false)
    setSubmitting(true)

    try {
      await api.studentPortal.register(form)
      setSuccess(true)
      setForm(emptyForm)
      setTouched({})
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 lg:py-12 px-4 sm:px-6">
      <PageHeader title="تسجيل طالب جديد" subtitle="املأ البيانات وسيتم مراجعة الطلب من قبل الإدارة" />

      <div className="bg-white rounded-3xl shadow-xl border border-[var(--color-border)] overflow-hidden">
        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="space-y-4">
              <div className="h-6 w-3/5 skeleton rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-12 skeleton rounded-xl" />
                ))}
              </div>
            </div>
          ) : success ? (
            <div className="rounded-3xl border border-green-200 bg-green-50 p-6 text-right text-sm text-green-900 space-y-4">
              <p className="font-semibold text-lg">تم إرسال طلب التسجيل بنجاح</p>
              <p>شكراً لك، سيتم مراجعة طلبك من قبل الإدارة. سنتواصل معك عبر الواتساب عند الموافقة أو الرفض.</p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn-primary"
              >
                العودة إلى تسجيل الدخول
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6 text-right">
                {error && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">اسم الطالب</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onBlur={() => handleBlur('name')}
                    placeholder="اسم الطالب"
                    className="input-field w-full"
                  />
                  {touched.name && errors.name && <p className="text-[12px] text-red-600 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">رقم الجوال</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    onBlur={() => handleBlur('phone')}
                    placeholder="05xxxxxxxx"
                    className="input-field w-full"
                  />
                  {touched.phone && errors.phone && <p className="text-[12px] text-red-600 mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">الواتساب</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    onBlur={() => handleBlur('whatsapp')}
                    placeholder="رقم الواتساب"
                    className="input-field w-full"
                  />
                  {touched.whatsapp && errors.whatsapp && <p className="text-[12px] text-red-600 mt-1">{errors.whatsapp}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">المنطقة</label>
                  <select
                    value={form.zone}
                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                    onBlur={() => handleBlur('zone')}
                    className="input-field w-full"
                  >
                    <option value="">اختر المنطقة</option>
                    {data.zones.map((zone) => (
                      <option key={zone.id} value={zone.name}>{zone.name}</option>
                    ))}
                  </select>
                  {touched.zone && errors.zone && <p className="text-[12px] text-red-600 mt-1">{errors.zone}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">الوجهة</label>
                  <select
                    value={form.destinationId}
                    onChange={(e) => setForm({ ...form, destinationId: e.target.value })}
                    onBlur={() => handleBlur('destinationId')}
                    className="input-field w-full"
                  >
                    <option value="">اختر الوجهة</option>
                    {data.destinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>{destination.name}</option>
                    ))}
                  </select>
                  {touched.destinationId && errors.destinationId && <p className="text-[12px] text-red-600 mt-1">{errors.destinationId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">التخصص</label>
                  <input
                    type="text"
                    value={form.major}
                    onChange={(e) => setForm({ ...form, major: e.target.value })}
                    onBlur={() => handleBlur('major')}
                    placeholder="التخصص"
                    className="input-field w-full"
                  />
                  {touched.major && errors.major && <p className="text-[12px] text-red-600 mt-1">{errors.major}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">المستوى</label>
                  <select
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    onBlur={() => handleBlur('level')}
                    className="input-field w-full"
                  >
                    <option value="">اختر المستوى</option>
                    <option value="الأول">الأول</option>
                    <option value="الثاني">الثاني</option>
                    <option value="الثالث">الثالث</option>
                    <option value="الرابع">الرابع</option>
                    <option value="الخامس">الخامس</option>
                    <option value="السادس">السادس</option>
                  </select>
                  {touched.level && errors.level && <p className="text-[12px] text-red-600 mt-1">{errors.level}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">العنوان</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => {
                      const address = e.target.value
                      setForm((prev) => ({
                        ...prev,
                        address,
                        pickupLocation: prev.transportMode === 'LINE' && !prev.pickupLocation.trim() ? address : prev.pickupLocation,
                      }))
                    }}
                    onBlur={() => handleBlur('address')}
                    placeholder="مكان السكن"
                    className="input-field w-full"
                  />
                  {touched.address && errors.address && <p className="text-[12px] text-red-600 mt-1">{errors.address}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">اسم ولي الأمر</label>
                  <input
                    type="text"
                    value={form.parentName}
                    onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                    onBlur={() => handleBlur('parentName')}
                    placeholder="اسم ولي الأمر"
                    className="input-field w-full"
                  />
                  {touched.parentName && errors.parentName && <p className="text-[12px] text-red-600 mt-1">{errors.parentName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">جوال ولي الأمر</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.parentPhone}
                    onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                    onBlur={() => handleBlur('parentPhone')}
                    placeholder="رقم ولي الأمر"
                    className="input-field w-full"
                  />
                  {touched.parentPhone && errors.parentPhone && <p className="text-[12px] text-red-600 mt-1">{errors.parentPhone}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">القرابة</label>
                <input
                  type="text"
                  value={form.parentRelation}
                  onChange={(e) => setForm({ ...form, parentRelation: e.target.value })}
                  onBlur={() => handleBlur('parentRelation')}
                  placeholder="صلة القرابة"
                  className="input-field w-full"
                />
                {touched.parentRelation && errors.parentRelation && <p className="text-[12px] text-red-600 mt-1">{errors.parentRelation}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">نوع التوصيل</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        transportMode: 'LINE',
                        homeAddress: '',
                        pickupLocation: prev.pickupLocation || prev.address,
                      }))
                    }
                    className={`flex-1 p-4 rounded-xl border-2 text-right transition-all ${
                      form.transportMode === 'LINE'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-lighter)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.transportMode === 'LINE' ? 'text-[var(--color-primary-dark)]' : ''}`}>
                      توصيل على الخط
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">نقطة تجميع ثابتة</p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        transportMode: 'HOME',
                        pickupLocation: '',
                      }))
                    }
                    className={`flex-1 p-4 rounded-xl border-2 text-right transition-all ${
                      form.transportMode === 'HOME'
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-lighter)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary-light)]'
                    }`}
                  >
                    <p className={`font-medium text-sm ${form.transportMode === 'HOME' ? 'text-[var(--color-primary-dark)]' : ''}`}>
                      توصيل منزلي
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">توصيل إلى باب المنزل</p>
                  </button>
                </div>
                {touched.transportMode && errors.transportMode && <p className="text-[12px] text-red-600 mt-1">{errors.transportMode}</p>}
              </div>

              {form.transportMode === 'LINE' && (
                <div className="mt-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">نقطة الانتظار</label>
                  <input
                    type="text"
                    value={form.pickupLocation}
                    onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })}
                    onBlur={() => handleBlur('pickupLocation')}
                    placeholder="نقطة التجميع على الخط"
                    className="input-field w-full"
                  />
                  {touched.pickupLocation && errors.pickupLocation && <p className="text-[12px] text-red-600 mt-1">{errors.pickupLocation}</p>}
                </div>
              )}

              {form.transportMode === 'HOME' && (
                <div className="mt-3 p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-3">
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">عنوان المنزل</label>
                  <textarea
                    value={form.homeAddress}
                    onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                    onBlur={() => handleBlur('homeAddress')}
                    placeholder="عنوان التوصيل بالمنزل"
                    className="input-field w-full min-h-[100px]"
                  />
                  {touched.homeAddress && errors.homeAddress && <p className="text-[12px] text-red-600 mt-1">{errors.homeAddress}</p>}
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">يرجى كتابة عنوان المنزل بدقة</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">سيتم إرسال تسعير التوصيل المنزلي لاحقًا</p>
                </div>
              )}

              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <p className="text-sm font-semibold mb-3">أيام العطلة (اختياري)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {offDayOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleOffDay(option.value)}
                      className={`text-xs sm:text-sm text-center py-2 px-2 sm:px-3 rounded-xl border transition-colors ${form.offDays.includes(option.value)
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'bg-white text-[var(--color-text)] border-[var(--color-border)]'}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
                  {submitting ? 'جاري الإرسال...' : 'إرسال طلب التسجيل'}
                </button>
                <button type="button" onClick={() => navigate('/login')} className="btn-ghost w-full sm:w-auto">
                  العودة إلى تسجيل الدخول
                </button>
              </div>
            </form>

            <ConfirmModal
              show={showSubmitConfirm}
              onClose={() => setShowSubmitConfirm(false)}
              onConfirm={confirmSubmit}
              title="تأكيد إرسال الطلب"
              confirmText="تأكيد"
              cancelText="إلغاء"
              loading={submitting}
            >
              <p className="mb-3">هل أنت متأكد أنك تريد إرسال طلب التسجيل الآن؟</p>
              <p className="text-sm text-slate-500">يرجى التأكد من أن جميع المعلومات صحيحة قبل المتابعة.</p>
            </ConfirmModal>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
