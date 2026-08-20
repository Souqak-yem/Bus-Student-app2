# تنسيقية مواصلات فلك

نظام متكامل لإدارة نقل الطلاب بالمدارس والجامعات، يشمل ثلاث بوابات (أدمن، سائق، طالب) مع دعم فوري عبر Socket.IO.

## المتطلبات

- Node.js 18+
- PostgreSQL 14+
- npm

## التشغيل السريع

### 1. إعداد قاعدة البيانات

```bash
# إنشاء قاعدة بيانات PostgreSQL
createdb transport_app

# نسخ ملف البيئة وتعديل الإعدادات
cp backend/.env.example backend/.env
```

عدل `DATABASE_URL` في `backend/.env` ليتناسب مع إعدادات PostgreSQL لديك.

### 2. تشغيل Backend

```bash
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed  # بيانات تجريبية
npm run dev
```

### 3. تشغيل Frontend

```bash
# من المجلد الرئيسي
npm install
npm run dev
```

### 4. الدخول للنظام

- **الأدمن:** `admin1` / `123`
- **السائق:** `سامر33` / `0500000001`

## النشر للإنتاج

راجع [DEPLOYMENT.md](./DEPLOYMENT.md) لخطوات النشر الكاملة.

## البنية

```
├── backend/         # Express API + Socket.IO + Prisma
│   ├── src/
│   │   ├── routes/     # 34 route files
│   │   ├── services/   # 16 service files
│   │   ├── middleware/  # Auth (JWT) + authorization
│   │   └── index.js    # Entry point
│   └── prisma/         # Schema + migrations + seed
├── src/             # React (Vite) frontend
│   ├── pages/         # 42 page components
│   │   ├── admin/     # 32 admin pages
│   │   ├── driver/    # 3 driver pages
│   │   ├── student/   # 4 student pages
│   │   └── auth/      # Login + change password
│   ├── components/    # Shared UI components
│   ├── context/       # Auth + Notification contexts
│   └── lib/           # API client + Socket + IndexedDB + utilities
└── public/           # PWA manifest + service worker + assets
```

## متغيرات البيئة

### Frontend (`VITE_`)
| المتغير | الوصف | الافتراضي |
|---------|-------|-----------|
| `VITE_API_URL` | رابط API | `http://localhost:3000/api` |
| `VITE_SOCKET_URL` | رابط Socket.IO | `http://localhost:3000` |

### Backend
| المتغير | الوصف | مطلوب |
|---------|-------|-------|
| `DATABASE_URL` | رابط PostgreSQL | ✅ |
| `JWT_SECRET` | مفتاح JWT السري | ✅ |
| `PORT` | منفذ الخادم | ❌ (3000) |
| `NODE_ENV` | بيئة التشغيل | ❌ (development) |
| `CORS_ORIGIN` | النطاقات المسموحة (مفصولة بفاصلة) | ❌ |
| `RATE_LIMIT_MAX` | حد الطلبات لكل 15 دقيقة | ❌ (200) |
| `ADMIN_INITIAL_PASSWORD` | كلمة مرور المشرف الأولى (للمستخدمين الجدد) | ❌ |
