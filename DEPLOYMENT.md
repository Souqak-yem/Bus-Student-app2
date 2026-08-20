# دليل النشر - تنسيقية مواصلات فلك

> هذا المستند يشرح خطوات نشر نظام تنسيقية مواصلات فلك في بيئة الإنتاج.

---

## جدول المحتويات

1. [متطلبات الخادم](#1-متطلبات-الخادم)
2. [نشر PostgreSQL](#2-نشر-postgresql)
3. [نشر Backend](#3-نشر-backend)
4. [نشر Frontend](#4-نشر-frontend)
5. [الإعدادات الأمنية](#5-الإعدادات-الأمنية)
6. [الصيانة والنسخ الاحتياطي](#6-الصيانة-والنسخ-الاحتياطي)
7. [استكشاف الأخطاء](#7-استكشاف-الأخطاء)

---

## 1. متطلبات الخادم

### الحد الأدنى

| المواصفة | القيمة |
|----------|--------|
| نظام التشغيل | Ubuntu 22.04+ / Debian 12+ / Windows Server 2022+ |
| المعالج | 2 cores |
| RAM | 4 GB |
| التخزين | 20 GB SSD |
| Node.js | 18.x أو أحدث |
| PostgreSQL | 14.x أو أحدث |
| Nginx (للعكس) | أحدث إصدار |

### المنافذ المطلوبة

| المنفذ | الخدمة | ملاحظة |
|--------|--------|--------|
| 3000 | Backend API | يمكن تغييره عبر `PORT` |
| 5173 | Frontend Dev | فقط للتطوير |
| 80/443 | Nginx | الواجهة العامة |
| 5432 | PostgreSQL | داخلي فقط |

---

## 2. نشر PostgreSQL

### 2.1 تثبيت PostgreSQL

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2.2 إنشاء قاعدة البيانات والمستخدم

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE transport_app;
CREATE USER busadmin WITH ENCRYPTED PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE transport_app TO busadmin;
\c transport_app
GRANT ALL ON SCHEMA public TO busadmin;
ALTER DATABASE transport_app OWNER TO busadmin;
\q
```

### 2.3 تحسين الأداء

```sql
-- في postgresql.conf
shared_buffers = '1GB'          # 25% من RAM
effective_cache_size = '3GB'    # 75% من RAM
work_mem = '32MB'               # للفرز
maintenance_work_mem = '256MB'  # للصيانة
max_connections = '100'         # حسب عدد المستخدمين
```

### 2.4 النسخ الاحتياطي

```bash
# نسخ احتياطي يومي
pg_dump -U busadmin transport_app > backup_$(date +%Y%m%d).sql

# استعادة
psql -U busadmin transport_app < backup_file.sql
```

---

## 3. نشر Backend

### 3.1 تجهيز المجلد

```bash
# نسخ الملفات إلى الخادم
scp -r backend/ user@server:/opt/bus-students/backend/
cd /opt/bus-students/backend
```

### 3.2 إعداد متغيرات البيئة

```bash
cp .env.example .env
nano .env
```

```env
DATABASE_URL=postgresql://busadmin:your-strong-password@localhost:5432/transport_app
JWT_SECRET=replace-with-strong-random-secret-64-chars-min
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
RATE_LIMIT_MAX=200
```

> **هام:** استخدم مفتاح JWT عشوائي قوي (يفضل 64 حرفًا أو أكثر).

### 3.3 تثبيت الاعتماديات وتشغيل الترحيلات

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

(اختياري) لتعبئة بيانات أولية:
```bash
npm run db:seed
```

### 3.4 تشغيل الخادم (عبر PM2)

```bash
npm install -g pm2
pm2 start src/index.js --name bus-students-backend
pm2 save
pm2 startup
```

### 3.5 عكس الوكيل (Nginx)

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    # إعادة التوجيه إلى HTTPS (اختياري مع Certbot)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;  # لمدة Socket.IO
    }
}
```

### 3.6 شهادة SSL (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com
```

---

## 4. نشر Frontend

### 4.1 بناء الواجهة

```bash
# من المجلد الرئيسي
npm install
VITE_API_URL=https://api.your-domain.com/api \
VITE_SOCKET_URL=https://api.your-domain.com \
npm run build
```

ينتج مجلد `dist/` — هذا هو الملف الثابت النهائي.

### 4.2 رفع الملفات

```bash
scp -r dist/* user@server:/var/www/bus-students/
```

### 4.3 إعداد Nginx للواجهة

```nginx
server {
    listen 80;
    server_name your-frontend-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-frontend-domain.com;
    root /var/www/bus-students;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/your-frontend-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-frontend-domain.com/privkey.pem;

    # PWA: cache service worker
    add_header Service-Worker-Allowed /;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # PWA manifest
    location /manifest.json {
        add_header Cache-Control "public, max-age=0";
    }

    # Static assets with cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA: all routes fallback to index.html
    location / {
        try_files $uri $uri/ /index.html;
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed /;
    }
}
```

### 4.4 شهادة SSL

```bash
sudo certbot --nginx -d your-frontend-domain.com
```

---

## 5. الإعدادات الأمنية

### 5.1 جدار الحماية (UFW)

```bash
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80/tcp       # HTTP
sudo ufw allow 443/tcp      # HTTPS
sudo ufw enable
```

### 5.2 إعدادات JWT

- استخدم مفتاح `JWT_SECRET` قوي (64+ حرف عشوائي)
- مدة صلاحية التوكن: 7 أيام
- قفل الحساب بعد 5 محاولات فاشلة (لمدة 15 دقيقة)

### 5.3 إعدادات CORS

في بيئة الإنتاج، `CORS_ORIGIN` يجب أن يحتوي فقط على نطاق الواجهة:
```env
CORS_ORIGIN=https://your-frontend-domain.com
```

### 5.4 حماية API

- جميع مسارات `/api/*` تتطلب JWT token عبر `authenticate` middleware
- صلاحيات الوصول عبر `authorize('admin', 'driver', 'student')`
- تحديد معدل الطلبات لمسارات `/api/auth` (200 طلب / 15 دقيقة)
- Helmet security headers مفعلة

### 5.5 أمان قاعدة البيانات

```bash
# لا تفتح PostgreSQL للإنترنت
sudo ufw deny 5432

# أو قيدها بـ localhost فقط
# في postgresql.conf
listen_addresses = 'localhost'
```

---

## 6. الصيانة والنسخ الاحتياطي

### 6.1 سكربت النسخ الاحتياطي اليومي

```bash
#!/bin/bash
# /opt/backup-db.sh
BACKUP_DIR="/backups/postgres"
DB_NAME="transport_app"
DB_USER="busadmin"
RETENTION_DAYS=30

mkdir -p $BACKUP_DIR
pg_dump -U $DB_USER $DB_NAME > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
find $BACKUP_DIR -type f -mtime +$RETENTION_DAYS -delete
```

أضفه إلى cron:
```bash
0 2 * * * /opt/backup-db.sh
```

### 6.2 تحديث النظام

```bash
# 1. تحديث الكود
cd /opt/bus-students
git pull

# 2. تحديث Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
pm2 restart bus-students-backend

# 3. تحديث Frontend
cd ..
npm install
VITE_API_URL=https://api.your-domain.com/api \
VITE_SOCKET_URL=https://api.your-domain.com \
npm run build
# انسخ dist/ إلى مجلد Nginx
```

### 6.3 مراقبة النظام

```bash
pm2 monit                 # مراقبة Backend
journalctl -u nginx -f    # مراقبة Nginx
tail -f /opt/bus-students/backend/logs/*.log
```

---

## 7. استكشاف الأخطاء

### المشكلة: "رمز الدخول غير صالح"

```bash
# تأكد من صحة JWT_SECRET في .env
# تأكد من تطابقه مع secret المستخدم عند تسجيل الدخول
```

### المشكلة: PrismaClientInitializationError

```bash
# تأكد من أن DATABASE_URL صحيح
# تأكد من أن PostgreSQL يعمل:
systemctl status postgresql
# اختبر الاتصال:
psql -U busadmin -d transport_app -h localhost
```

### المشكلة: Socket.IO لا يعمل

```bash
# تأكد من إعدادات Nginx للـ WebSocket:
# proxy_set_header Upgrade $http_upgrade;
# proxy_set_header Connection 'upgrade';
# proxy_read_timeout 86400s;
```

### المشكلة: CORS error في المتصفح

```bash
# تأكد من أن CORS_ORIGIN يحتوي على النطاق الصحيح للواجهة
# يمكن أن يحتوي على نطاقات متعددة مفصولة بفاصلة
```

---

> آخر تحديث: 2026-07-10
