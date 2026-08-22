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
  firstName: '',
  fatherName: '',
  grandfatherName: '',
  familyName: '',
  phone: '',
  whatsapp: '',
  parentName: '',
  parentPhone: '',
  parentRelation: '',
  address: '',
  zone: '',
  destinationId: '',
  institutionName: '',
  major: '',
  level: '',
  offDays: [],
  gender: '',
  transportMode: '',
  pickupLocation: '',
  homeAddress: '',
}

const arabicNamePattern = /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g
const arabicTextPattern = /[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g
const repeatedCharPattern = /(.)\1\1+/g

function sanitizeArabicText(value, allowSpaces = true) {
  const cleaned = value
    .replace(/\u200F|\u200E/g, '')
    .replace(arabicTextPattern, '')

  if (!allowSpaces) {
    return cleaned.replace(/\s+/g, '').replace(repeatedCharPattern, '$1$1')
  }

  return cleaned.replace(/\s{2,}/g, ' ')
}

function sanitizeArabicName(value) {
  return sanitizeArabicText(value, true)
    .replace(/[0-9]/g, '')
    .replace(/^\s+/, '')
    .replace(/\s{2,}/g, ' ')
}

export default function Register() {
  const [form, setForm] = useState(emptyForm)
  const [data, setData] = useState({ zones: [], destinations: [] })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [inputError, setInputError] = useState('')
  const [success, setSuccess] = useState(false)
  const [touched, setTouched] = useState({})
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const navigate = useNavigate()

  const errors = useMemo(() => {
    const errs = {}

    if (!form.firstName.trim()) errs.firstName = 'الاسم الأول مطلوب'
    else if (!/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/.test(form.firstName)) errs.firstName = 'استخدم الحروف العربية فقط'
    else if (/(.)\1\1/.test(form.firstName)) errs.firstName = 'لا يسمح بتكرار الحرف أكثر من مرتين'

    if (!form.fatherName.trim()) errs.fatherName = 'اسم الأب مطلوب'
    else if (!/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/.test(form.fatherName)) errs.fatherName = 'استخدم الحروف العربية فقط'
    else if (/(.)\1\1/.test(form.fatherName)) errs.fatherName = 'لا يسمح بتكرار الحرف أكثر من مرتين'

    if (!form.grandfatherName.trim()) errs.grandfatherName = 'اسم الجد مطلوب'
    else if (!/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/.test(form.grandfatherName)) errs.grandfatherName = 'استخدم الحروف العربية فقط'
    else if (/(.)\1\1/.test(form.grandfatherName)) errs.grandfatherName = 'لا يسمح بتكرار الحرف أكثر من مرتين'

    if (!form.familyName.trim()) errs.familyName = 'اللقب مطلوب'
    else if (!/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/.test(form.familyName)) errs.familyName = 'استخدم الحروف العربية فقط'
    else if (/(.)\1\1/.test(form.familyName)) errs.familyName = 'لا يسمح بتكرار الحرف أكثر من مرتين'

    if (!form.phone.trim()) errs.phone = 'رقم الجوال مطلوب'
    else if (!/^[0-9]+$/.test(form.phone.trim())) errs.phone = 'استخدم أرقاماً فقط'

    if (!form.whatsapp.trim()) errs.whatsapp = 'رقم الواتساب مطلوب'
    else if (!/^[0-9]+$/.test(form.whatsapp.trim())) errs.whatsapp = 'استخدم أرقاماً فقط'

    if (!form.zone) errs.zone = 'المنطقة مطلوبة'
    if (!form.destinationId) errs.destinationId = 'الوجهة مطلوبة'
    if (!form.institutionName.trim()) errs.institutionName = 'الكلية مطلوبة'
    if (!form.address.trim()) errs.address = 'العنوان مطلوب'
    if (!form.major.trim()) errs.major = 'التخصص مطلوب'
    if (!form.level) errs.level = 'المستوى مطلوب'
    if (!form.parentName.trim()) errs.parentName = 'اسم ولي الأمر مطلوب'

    if (!form.parentPhone.trim()) errs.parentPhone = 'هاتف ولي الأمر مطلوب'
    else if (!/^[0-9]+$/.test(form.parentPhone.trim())) errs.parentPhone = 'استخدم أرقاماً فقط'

    if (!form.parentRelation.trim()) errs.parentRelation = 'صلة القرابة مطلوبة'
    if (!form.gender) errs.gender = 'الجنس مطلوب'
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

  function updateTextField(field, value, options = {}) {
    const { allowSpaces = true } = options
    const sanitized = allowSpaces ? sanitizeArabicText(value, true) : sanitizeArabicName(value)
    const whitespaceNormalized = value.replace(/\s+/g, ' ').replace(/^\s+/, '')

    if (sanitized !== value && sanitized !== whitespaceNormalized) setInputError('لا يمكن كتابة رموز أو أحرف غير عربية أو إيموجي')
    else setInputError('')

    setForm((prev) => ({ ...prev, [field]: sanitized }))
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
      firstName: true,
      fatherName: true,
      grandfatherName: true,
      familyName: true,
      phone: true,
      whatsapp: true,
      zone: true,
      destinationId: true,
      institutionName: true,
      address: true,
      major: true,
      level: true,
      parentName: true,
      parentPhone: true,
      parentRelation: true,
      gender: true,
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

    const registrationPayload = {
      ...form,
      name: [form.firstName, form.fatherName, form.grandfatherName, form.familyName].filter(Boolean).join(' '),
    }

    try {
      await api.studentPortal.register(registrationPayload)
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
              <form onSubmit={handleSubmit} className="flex flex-col space-y-6 text-right">
                {(error || inputError) && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {inputError || error}
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4 order-1">
                <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">الاسم الأول</label>
          <input
            type="text"
            value={form.firstName}
            onChange={(e) => updateTextField('firstName', e.target.value, { allowSpaces: false })}
            onBlur={() => handleBlur('firstName')}
            placeholder="الاسم"
            className="input-field w-full"
          />
          {touched.firstName && errors.firstName && <p className="text-[12px] text-red-600 mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">اسم الأب</label>
          <input
            type="text"
            value={form.fatherName}
            onChange={(e) => updateTextField('fatherName', e.target.value, { allowSpaces: false })}
            onBlur={() => handleBlur('fatherName')}
            placeholder="اسم الأب"
            className="input-field w-full"
          />
          {touched.fatherName && errors.fatherName && <p className="text-[12px] text-red-600 mt-1">{errors.fatherName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 order-1">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">اسم الجد</label>
          <input
            type="text"
            value={form.grandfatherName}
            onChange={(e) => updateTextField('grandfatherName', e.target.value, { allowSpaces: false })}
            onBlur={() => handleBlur('grandfatherName')}
            placeholder="اسم الجد"
            className="input-field w-full"
          />
          {touched.grandfatherName && errors.grandfatherName && <p className="text-[12px] text-red-600 mt-1">{errors.grandfatherName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text)] mb-1">اللقب</label>
          <input
            type="text"
            value={form.familyName}
            onChange={(e) => updateTextField('familyName', e.target.value, { allowSpaces: false })}
            onBlur={() => handleBlur('familyName')}
            placeholder="اللقب"
            className="input-field w-full"
          />
          {touched.familyName && errors.familyName && <p className="text-[12px] text-red-600 mt-1">{errors.familyName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 order-2">
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, gender: 'MALE' }))}
          className={`min-h-[52px] rounded-xl border-2 font-semibold transition-all ${form.gender === 'MALE'
            ? 'border-blue-500 bg-blue-200 text-blue-900'
            : 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
        >
          ذكر
        </button>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, gender: 'FEMALE' }))}
          className={`min-h-[52px] rounded-xl border-2 font-semibold transition-all ${form.gender === 'FEMALE'
            ? 'border-pink-500 bg-pink-200 text-pink-900'
            : 'border-pink-300 bg-pink-100 text-pink-700 hover:bg-pink-200'}`}
        >
          أنثى
        </button>
      </div>
      {touched.gender && errors.gender && <p className="text-[12px] text-red-600 mt-1">{errors.gender}</p>}

      <div className="grid grid-cols-2 gap-4 order-3">
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

              </div>

              <div className="grid grid-cols-2 gap-4 order-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">الجامعة</label>
                  <select
                    value={form.destinationId}
                    onChange={(e) => setForm({ ...form, destinationId: e.target.value })}
                    onBlur={() => handleBlur('destinationId')}
                    className="input-field w-full"
                  >
                    <option value="">اختر الجامعة</option>
                    {data.destinations.map((destination) => (
                      <option key={destination.id} value={destination.id}>{destination.name}</option>
                    ))}
                  </select>
                  {touched.destinationId && errors.destinationId && <p className="text-[12px] text-red-600 mt-1">{errors.destinationId}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">الكلية</label>
                  <input
                    type="text"
                    value={form.institutionName}
                    onChange={(e) => updateTextField('institutionName', e.target.value, { allowSpaces: true })}
                    onBlur={() => handleBlur('institutionName')}
                    placeholder="اسم الكلية"
                    className="input-field w-full"
                  />
                  {touched.institutionName && errors.institutionName && <p className="text-[12px] text-red-600 mt-1">{errors.institutionName}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">التخصص</label>
                  <input
                    type="text"
                    value={form.major}
                    onChange={(e) => updateTextField('major', e.target.value, { allowSpaces: true })}
                    onBlur={() => handleBlur('major')}
                    placeholder="التخصص"
                    className="input-field w-full"
                  />
                  {touched.major && errors.major && <p className="text-[12px] text-red-600 mt-1">{errors.major}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 order-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">المستوى</label>
                  <select
                    value={form.level}
                    onChange={(e) => updateTextField('level', e.target.value)}
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

              </div>

              <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 order-6">
                <p className="text-sm font-semibold mb-3">أيام العطلة (اختياري)</p>
                <div className="grid grid-cols-3 gap-2">
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

              <div className="order-7">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">المنطقة</label>
                <select
                  value={form.zone}
                  onChange={(e) => updateTextField('zone', e.target.value)}
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

              <div className="order-8">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">العنوان</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => {
                    const nextValue = e.target.value
                    updateTextField('address', nextValue, { allowSpaces: true })
                    if (form.transportMode === 'LINE' && !form.pickupLocation.trim()) {
                      setForm((prev) => ({ ...prev, pickupLocation: nextValue }))
                    }
                  }}
                  onBlur={() => handleBlur('address')}
                  placeholder="مكان السكن"
                  className="input-field w-full"
                />
                {touched.address && errors.address && <p className="text-[12px] text-red-600 mt-1">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4 order-9">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">اسم ولي الأمر</label>
                  <input
                    type="text"
                    value={form.parentName}
                    onChange={(e) => updateTextField('parentName', e.target.value, { allowSpaces: true })}
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

              <div className="order-9">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">القرابة</label>
                <input
                  type="text"
                  value={form.parentRelation}
                  onChange={(e) => updateTextField('parentRelation', e.target.value, { allowSpaces: true })}
                  onBlur={() => handleBlur('parentRelation')}
                  placeholder="صلة القرابة"
                  className="input-field w-full"
                />
                {touched.parentRelation && errors.parentRelation && <p className="text-[12px] text-red-600 mt-1">{errors.parentRelation}</p>}
              </div>

              <div className="order-10">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">نوع التوصيل</label>
                <div className="flex flex-row flex-wrap gap-3">
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
                <div className="order-11 mt-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">نقطة الانتظار</label>
                  <input
                    type="text"
                    value={form.pickupLocation}
                    onChange={(e) => updateTextField('pickupLocation', e.target.value)}
                    onBlur={() => handleBlur('pickupLocation')}
                    placeholder="نقطة التجميع على الخط"
                    className="input-field w-full"
                  />
                  {touched.pickupLocation && errors.pickupLocation && <p className="text-[12px] text-red-600 mt-1">{errors.pickupLocation}</p>}
                </div>
              )}

              {form.transportMode === 'HOME' && (
                <div className="order-11 mt-3 p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-3">
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-1">عنوان المنزل</label>
                  <textarea
                    value={form.homeAddress}
                    onChange={(e) => updateTextField('homeAddress', e.target.value)}
                    onBlur={() => handleBlur('homeAddress')}
                    placeholder="عنوان التوصيل بالمنزل"
                    className="input-field w-full min-h-[100px]"
                  />
                  {touched.homeAddress && errors.homeAddress && <p className="text-[12px] text-red-600 mt-1">{errors.homeAddress}</p>}
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">يرجى كتابة عنوان المنزل بدقة</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">سيتم إرسال تسعير التوصيل المنزلي لاحقًا</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 order-12">
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
