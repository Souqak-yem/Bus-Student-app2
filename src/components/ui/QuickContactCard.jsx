import { Phone, MessageCircle } from 'lucide-react'
import { useWhatsAppRedirect } from '../../context/WhatsAppContext'

const contacts = [
  {
    id: 'registration',
    title: 'مختص التسجيل',
    type: 'whatsapp',
    icon: MessageCircle,
    phone: '967734904945',
  },
  {
    id: 'manager',
    title: 'المدير العام',
    type: 'phone-group',
    phones: [
      {
        label: 'الاتصال الأول',
        phone: '+967778966422',
        href: 'tel:+967778966422',
        color: 'blue',
      },
      {
        label: 'الاتصال الثاني',
        phone: '+967730622881',
        href: 'tel:+967730622881',
        color: 'orange',
      },
    ],
  },
]

export default function QuickContactCard() {
  const openWhatsApp = useWhatsAppRedirect()
  const registration = contacts.find((c) => c.type === 'whatsapp')
  const manager = contacts.find((c) => c.type === 'phone-group')

  return (
    <div className="card px-4 py-3 flex items-center gap-0">
      {/* Registration - WhatsApp */}
      <button
        type="button"
        onClick={() => openWhatsApp(registration.phone)}
        aria-label={`تواصل مع ${registration.title} عبر واتساب`}
        title={registration.title}
        className="flex-1 flex flex-col items-center gap-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:rounded-lg"
      >
        <span className="text-[11px] font-semibold text-slate-700 leading-none">{registration.title}</span>
        <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 group-active:bg-green-200 transition-colors duration-150">
          <MessageCircle size={16} className="text-green-600" />
        </div>
      </button>

      {/* Divider */}
      <div className="w-px h-9 bg-slate-200 mx-3 shrink-0" />

      {/* Manager - Phones */}
      <div className="flex-1 flex flex-col items-center gap-1">
        <span className="text-[11px] font-semibold text-slate-700 leading-none">{manager.title}</span>
        <div className="flex items-center gap-1.5">
          {manager.phones.map((phone, idx) => (
            <a
              key={idx}
              href={phone.href}
              aria-label={`الاتصال بـ ${manager.title}`}
              title={phone.label}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                phone.color === 'blue'
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 active:bg-blue-200 focus-visible:ring-blue-400'
                  : 'bg-orange-50 text-orange-600 hover:bg-orange-100 active:bg-orange-200 focus-visible:ring-orange-400'
              }`}
            >
              <Phone size={14} />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
