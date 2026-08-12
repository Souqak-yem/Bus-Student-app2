export function getStudentGenderTone(gender) {
  const normalized = String(gender ?? '').toUpperCase()

  if (normalized === 'MALE') {
    return {
      card: 'border-blue-200 bg-blue-50/80',
      soft: 'bg-blue-100 text-blue-800 border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
      avatar: 'bg-blue-100 text-blue-700',
      subtle: 'text-blue-700',
    }
  }

  if (normalized === 'FEMALE') {
    return {
      card: 'border-pink-200 bg-pink-50/80',
      soft: 'bg-pink-100 text-pink-800 border-pink-200',
      badge: 'bg-pink-100 text-pink-800',
      avatar: 'bg-pink-100 text-pink-700',
      subtle: 'text-pink-700',
    }
  }

  return {
    card: 'border-slate-200 bg-white',
    soft: 'bg-slate-100 text-slate-700 border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
    avatar: 'bg-slate-100 text-slate-700',
    subtle: 'text-slate-700',
  }
}
