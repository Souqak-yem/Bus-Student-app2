import { useState } from 'react'
import {
  HelpCircle,
  CreditCard,
  Sunrise,
  Sunset,
  AlertTriangle,
  Headphones,
  ShoppingCart,
  CheckCircle2,
  Clock,
  MapPin,
  Bus,
  UserCheck,
  GraduationCap,
  Users,
  Timer,
  AlertOctagon,
  Phone,
  MessageCircle,
  ChevronLeft,
  Check,
  FileText,
  Calendar,
} from 'lucide-react'

const GUIDE_TABS = [
  { key: 'subscription', label: 'الاشتراكات', icon: CreditCard, color: 'indigo' },
  { key: 'morning', label: 'رحلة الذهاب', icon: Sunrise, color: 'amber' },
  { key: 'return', label: 'رحلة العودة', icon: Sunset, color: 'violet' },
  { key: 'emergency', label: 'الحالات الطارئة', icon: AlertTriangle, color: 'red' },
  { key: 'support', label: 'الدعم والتواصل', icon: Headphones, color: 'emerald' },
]

const COLOR_MAP = {
  indigo: {
    bgSoft: 'bg-indigo-50',
    bgMedium: 'bg-indigo-100',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    textSoft: 'text-indigo-600',
    chip: 'bg-indigo-600',
  },
  amber: {
    bgSoft: 'bg-amber-50',
    bgMedium: 'bg-amber-100',
    border: 'border-amber-200',
    text: 'text-amber-700',
    textSoft: 'text-amber-600',
    chip: 'bg-amber-500',
  },
  violet: {
    bgSoft: 'bg-violet-50',
    bgMedium: 'bg-violet-100',
    border: 'border-violet-200',
    text: 'text-violet-700',
    textSoft: 'text-violet-600',
    chip: 'bg-violet-600',
  },
  red: {
    bgSoft: 'bg-red-50',
    bgMedium: 'bg-red-100',
    border: 'border-red-200',
    text: 'text-red-700',
    textSoft: 'text-red-600',
    chip: 'bg-red-600',
  },
  emerald: {
    bgSoft: 'bg-emerald-50',
    bgMedium: 'bg-emerald-100',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    textSoft: 'text-emerald-600',
    chip: 'bg-emerald-600',
  },
}

function Step({ step, title, description, color, icon: Icon, last }) {
  const c = COLOR_MAP[color]
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center pt-1">
        <div className={`w-8 h-8 rounded-xl ${c.bgMedium} flex items-center justify-center shrink-0 shadow-sm`}>
          <Icon size={14} className={c.text} />
        </div>
        {!last && <div className={`w-0.5 flex-1 mt-1 ${c.bgMedium} rounded-full`} />}
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${c.bgSoft} ${c.text}`}>خطوة {step}</span>
          <h4 className="text-xs font-bold text-slate-800">{title}</h4>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed pr-0.5">{description}</p>
      </div>
    </div>
  )
}

function QuickTip({ children, type = 'info' }) {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
  }
  const cls = styles[type] || styles.info
  return (
    <div className={`mt-2 rounded-xl border ${cls} p-2.5 text-[11px] leading-relaxed`}>
      {children}
    </div>
  )
}

function SubscriptionGuide() {
  const c = COLOR_MAP.indigo
  return (
    <div className="space-y-0.5">
      <div className={`rounded-xl border ${c.border} ${c.bgSoft} p-2.5 mb-2.5`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl ${c.bgMedium} flex items-center justify-center`}>
            <CreditCard size={14} className={c.text} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">أنواع الاشتراكات المتاحة</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">يومي · ٣ أسابيع · ٤ أسابيع</p>
          </div>
        </div>
      </div>

      <Step step={1} color="indigo" icon={Calendar} title="اختر نوع الاشتراك والأيام"
        description="من صفحة الاشتراكات، اختر ما يناسبك: يومي، ٣ أسابيع، أو ٤ أسابيع، ثم حدد الأيام الدراسية المطلوبة (من السبت إلى الخميس)." />
      <Step step={2} color="indigo" icon={ShoppingCart} title="أضف إلى السلة وراجع الطلب"
        description="سيتم إضافة طلبك إلى سلة المشتريات تلقائياً مع احتساب السعر. راجع تفاصيل الطلب جيداً قبل المتابعة." />
      <Step step={3} color="indigo" icon={FileText} title="أرسل المرجع أو سند الدفع"
        description="بعد إتمام عملية الدفع (التحويل أو الإيداع)، أدخل رقم المرجع/العملية في المربع المخصص، ثم اضغط إرسال الطلب." />
      <Step step={4} color="indigo" icon={Users} title="سيتم توجيهك للواتساب"
        description="سيتم فتح واتساب مباشرة مع مختص التسجيل مع رسالة جاهزة تحتوي تفاصيل طلبك. أرفق صورة سند الدفع ثم اضغط إرسال." last />

      <QuickTip type="info">
        <strong className={c.text}>ⓘ ملاحظة مهمة:</strong> لن يتم اعتماد طلب الاشتراك حتى يتم إرسال صورة السند لمختص التسجيل عبر واتساب.
      </QuickTip>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {[
          { label: 'قيد المراجعة', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'تم القبول', cls: 'bg-green-50 text-green-700 border-green-200' },
          { label: 'تم الرفض', cls: 'bg-red-50 text-red-700 border-red-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border ${s.cls} text-[10px] font-semibold text-center py-1.5`}>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function MorningTripGuide() {
  return (
    <div className="space-y-0.5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
            <Sunrise size={14} className="text-amber-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">مراحل رحلة الذهاب إلى الجامعة</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">قبل الصعود → التتبع → الوصول</p>
          </div>
        </div>
      </div>

      <Step step={1} color="amber" icon={Clock} title="تحديد موعد الالتقاط"
        description="في الصفحة الرئيسية ستظهر معلومات رحلة اليوم: وقت الالتقاط المتوقع، رقم الباص، نقطة الانتظار (أو العنوان إذا كان توصيل منزلي)." />
      <Step step={2} color="amber" icon={MapPin} title="التوجه إلى نقطة الانتظار"
        description="تواصل مع نقطة الانتظار المحددة قبل الوقت ب5 دقائق على الأقل. تأكد من هاتفك مشحون لتلقي التنبيهات." />
      <Step step={3} color="amber" icon={Bus} title="تلقي إشعار اقتراب الباص"
        description="عند اقتراب الباص من موقعك سيصلك إشعار خارجي ورسالة داخل التطبيق بوقت الوصول التقريبي." />
      <Step step={4} color="amber" icon={UserCheck} title="تسجيل الصعود إلى الباص"
        description="عند صعودك للباص، سيقوم السائق بتسجيل حضورك مباشرة. ستتحول حالة الرحلة إلى (تم الصعود) داخل التطبيق." />
      <Step step={5} color="amber" icon={GraduationCap} title="الوصول إلى الجامعة"
        description="بمجرد وصول الباص إلى الجامعة وتسجيل جميع الطلاب، ستنتهي رحلة الذهاب تلقائياً وستظهر صفحة رحلة العودة." last />

      <QuickTip type="success">
        <strong className="text-green-700">✓ نصيحة:</strong> شغل الإشعارات الخارجية لتتلقى فوراً تنبيهات اقتراب الباص وتغييرات الرحلة.
      </QuickTip>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
        <div className="text-[10px] font-bold text-slate-700 mb-1.5">مراحل الحالة في التطبيق:</div>
        <div className="flex items-center justify-between gap-1 text-[9px]">
          {[
            { icon: Clock, label: 'قبل الالتقاط', cls: 'bg-amber-100 text-amber-700' },
            { icon: Bus, label: 'في الطريق', cls: 'bg-blue-100 text-blue-700' },
            { icon: UserCheck, label: 'تم الصعود', cls: 'bg-green-100 text-green-700' },
            { icon: GraduationCap, label: 'الوصول', cls: 'bg-violet-100 text-violet-700' },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-lg ${s.cls} flex items-center justify-center`}>
                <s.icon size={12} />
              </div>
              <span className="text-slate-600 font-semibold text-center leading-tight">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ReturnTripGuide() {
  return (
    <div className="space-y-0.5">
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <Sunset size={14} className="text-violet-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">مراحل رحلة العودة إلى المنزل</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">طلب الرحلة → الجاهزية → الصعود → النزول</p>
          </div>
        </div>
      </div>

      <Step step={1} color="violet" icon={Bus} title="انتهاء رحلة الذهاب"
        description="بعد وصول الباص إلى الجامعة، ستظهر قسم رحلة العودة تلقائياً في الصفحة الرئيسية مع إمكانية طلب الرحلة." />
      <Step step={2} color="violet" icon={Users} title="اطلب رحلة العودة"
        description="اضغط على زر (طلب رحلة العودة) لتدخل قائمة الانتظار. سيتم إشعار المشرف فوراً بطلبك لتحديد باص العودة المناسب." />
      <Step step={3} color="violet" icon={Timer} title="أفِد بجاهزيتك عند الوصول"
        description="بعد انتهاء محاضراتك، أذكر في التطبيق أنك (جاهز) أو (سأتأخر) مع تحديد وقت التأخير. هذا يساعد المشرف على تنظيم الانطلاق." />
      <Step step={4} color="violet" icon={UserCheck} title="تسجيل الصعود للباص"
        description="عند وصولك إلى باص العودة، سيقوم السائق بتسجيل صعودك. سيظهر عداد تنازلي لباقي دقائق الانطلاق كما هو محدد من المشرف." />
      <Step step={5} color="violet" icon={MapPin} title="اتباع التتبع والنزول"
        description="يمكنك متابعة تتبع الباص في طريق العودة. سيقوم السائق بتسجيل نزولك عند نقطة التوصيل أو منزلك. تحقق من تطابق النقطة." last />

      <QuickTip type="warning">
        <strong className="text-amber-700">⚠️ تنبيه:</strong> إذا لم تؤكد جاهزيتك في الوقت المحدد، قد يؤخر انطلاق الباص أو يتم نقلك إلى باص آخر.
      </QuickTip>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
        <div className="text-[10px] font-bold text-slate-700 mb-1.5">حالات الجاهزية المتاحة:</div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          {[
            { label: 'جاهز', icon: Check, cls: 'bg-green-100 text-green-700 border-green-200' },
            { label: 'سأتأخر', icon: Clock, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
            { label: 'في الباص', icon: UserCheck, cls: 'bg-blue-100 text-blue-700 border-blue-200' },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border ${s.cls} flex flex-col items-center justify-center gap-0.5 py-1.5`}>
              <s.icon size={12} />
              <span className="font-semibold">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmergencyGuide() {
  return (
    <div className="space-y-0.5">
      <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertOctagon size={14} className="text-red-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">آلية التعامل مع الحالات الطارئة</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">عطل في الباص، حادث، أو ظروف استثنائية</p>
          </div>
        </div>
      </div>

      <Step step={1} color="red" icon={AlertTriangle} title="تلقي إشعار حالة الطوارئ"
        description="إذا حدث عطل أو حالة طارئة للباص، ستتلقى فوراً إشعاراً هاماً داخل التطبيق وخارجه يوضح نوع الحالة وباص البديل." />
      <Step step={2} color="red" icon={Bus} title="معلومات باص النقل البديل"
        description="يحتوي إشعار الطوارئ على رقم باص النقل البديل، وقت وصوله المتوقع، ونقطة التجمع المحددة من قبل المشرفين." />
      <Step step={3} color="red" icon={MapPin} title="التوجه إلى نقطة التجمع"
        description="انتقل فوراً إلى نقطة التجمع المذكورة في الإشعار، وانتظر وصول باص النقل البديل مع الالتزام بالهدوء." />
      <Step step={4} color="red" icon={CheckCircle2} title="تأكيد الصعود للباص البديل"
        description="عند صعودك لباص النقل، سيقوم السائق بتسجيل صعودك بنفس طريقة الرحلة العادية، وسيتم تحديث الحالة تلقائياً." last />

      <QuickTip type="danger">
        <strong className="text-red-700">🔴 في حالات الخطر الشديد:</strong> لا تتردد في الاتصال مباشرة بالمدير العام أو مختص التسجيل عبر قسم الدعم في نفس الصفحة.
      </QuickTip>

      <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-2.5">
        <div className="text-[10px] font-bold text-red-700 mb-1.5">أمثلة على البلاغات الطارئة:</div>
        <ul className="text-[10px] text-red-800 space-y-1 list-none space-y-1 [&>li]:pr-3 [&>li]:before:content-['▸'] [&>li]:before:text-red-500 [&>li]:before:mr-1">
          <li>عطل ميكانيكي في الباص خلال الرحلة.</li>
          <li>تأخر الباص لأكثر من ٣٠ دقيقة عن موعده.</li>
          <li>تغيير مفاجئ في سائق أو رقم الباص.</li>
          <li>ظروف جوية أو أمنية تستدعي التوقف.</li>
        </ul>
      </div>
    </div>
  )
}

function SupportGuide() {
  return (
    <div className="space-y-0.5">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Headphones size={14} className="text-emerald-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">قنوات الدعم والتواصل</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">نساعدك عبر قنوات التواصل المناسبة لكل طلب</p>
          </div>
        </div>
      </div>

      <Step step={1} color="emerald" icon={MessageCircle} title="مختص التسجيل والاشتراكات"
        description="للاستفسارات حول الاشتراكات، الأسعار، الموافقات، أو طلب تعديل البيانات الشخصية: التواصل عبر واتساب مباشرة من القسم." />
      <Step step={2} color="emerald" icon={Bus} title="مشرف الرحلات والباصات"
        description="للمشاكل أثناء الرحلة (تأخير، تغيير باص، عطل): التواصل عبر واتساب مباشرة مع إرفاق صورة أو تحديد رقم الباص." />
      <Step step={3} color="emerald" icon={Phone} title="المدير العام (للحالات الحرجة)"
        description="للشكاوى، الحالات الطارئة، أو المشاكل التي لم يتم حلها مع المختصين: الاتصال مباشرة بالمدير العام." last />

      <QuickTip type="success">
        <strong className="text-emerald-700">💡 أفضل طريقة للتواصل:</strong> أرسل رسالة عبر واتساب تحتوي اسم الطالب الكامل + رقم الجوال + وصف واضح للمشكلة.
      </QuickTip>

      <div className="mt-3 grid grid-cols-1 gap-1.5 text-[10px]">
        <div className="rounded-xl border border-emerald-200 bg-white p-2">
          <div className="font-bold text-slate-800 mb-0.5">📋 طلبات المعتادة</div>
          <p className="text-slate-600">تعديل بيانات → واتساب</p>
          <p className="text-slate-500">الشكاوى → المدير العام</p>
        </div>
      </div>
    </div>
  )
}

export default function StudentGuide({ defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState('subscription')

  const activeColor = GUIDE_TABS.find(t => t.key === activeTab)?.color || 'indigo'

  return (
    <div className="card p-3 fade-in">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex w-full items-center justify-between gap-2 text-right"
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-violet-100/80 rounded-xl flex items-center justify-center">
            <HelpCircle size={16} className="text-violet-600" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">طريقة عمل التطبيق</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs">{isOpen ? 'إخفاء' : 'عرض'}</span>
          <ChevronLeft
            size={16}
            className={`text-slate-400 transition-transform duration-300 ${isOpen ? '-rotate-90' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {GUIDE_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              const c = COLOR_MAP[tab.color]
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all min-h-[36px] ${
                    isActive
                      ? `${c.border} ${c.bgSoft} ${c.text}`
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={13} className={isActive ? c.text : 'text-slate-400'} />
                  <span className={`text-[11px] font-semibold whitespace-nowrap ${isActive ? c.text : ''}`}>{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className={`rounded-xl border ${COLOR_MAP[activeColor].border} bg-white p-3`}>
            {activeTab === 'subscription' && <SubscriptionGuide />}
            {activeTab === 'morning' && <MorningTripGuide />}
            {activeTab === 'return' && <ReturnTripGuide />}
            {activeTab === 'emergency' && <EmergencyGuide />}
            {activeTab === 'support' && <SupportGuide />}
          </div>
        </div>
      )}
    </div>
  )
}
