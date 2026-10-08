# Dr. Gupet — دکتر گوپت

فروشگاه آنلاین حیوانات خانگی (محصولات، دارو/داروخانه، کلینیک) — مونوریپو با **بک‌اند NestJS**، **فرانت‌اند React**، **پنل ادمین مستقل**، **MySQL 8** و **Redis**؛ مستقر با **Docker Compose** و **SSL (Let's Encrypt)**.

---

## فهرست

1. [معرفی محصول](#۱-معرفی-محصول)
2. [امکانات MVP](#۲-امکانات-mvp)
3. [استک فنی](#۳-استک-فنی)
4. [ساختار مخزن](#۴-ساختار-مخزن)
5. [Docker چیست و چرا؟ — توضیح کامل](#۵-docker-چیست-و-چرا--توضیح-کامل)
6. [استقرار روی سرور — قدم‌به‌قدم](#۶-استقرار-روی-سرور--قدمبهقدم)
7. [اسکریپت‌های عملیاتی (`scripts/`)](#۷-اسکریپتهای-عملیاتی-scripts)
8. [SSL — فعال‌سازی HTTPS](#۸-ssl--فعالسازی-https)
9. [متغیرهای محیطی](#۹-متغیرهای-محیطی)
10. [توسعهٔ محلی](#۱۰-توسعهٔ-محلی)
11. [قراردادهای سراسری API](#۱۱-قراردادهای-سراسری-api)
12. [نمای API](#۱۲-نمای-api)
13. [معماری OTP و SMS](#۱۳-معماری-otp-و-sms)
14. [قواعد کسب‌وکار](#۱۴-قواعد-کسبوکار)
15. [API پنل ادمین](#۱۵-api-پنل-ادمین)
16. [استراتژی تست](#۱۶-استراتژی-تست)
17. [نگهداری، بکاپ و عیب‌یابی](#۱۷-نگهداری-بکاپ-و-عیبیابی)
18. [وضعیت و مسیر توسعه](#۱۸-وضعیت-و-مسیر-توسعه)
19. [مستندات](#۱۹-مستندات)
20. [واژه‌نامه](#۲۰-واژهنامه-فارسی--انگلیسی)
21. [مجوز](#۲۱-مجوز-و-حقوق)

---

## ۱. معرفی محصول

دکتر گوپت یک فروشگاه اینترنتی برای صاحبان حیوانات خانگی است: خرید غذا و لوازم، مشاهدهٔ داروها و داروخانه‌های دارای آن‌ها، و یافتن کلینیک‌های دامپزشکی. سیستم به ازای هر پت (نوع، نژاد، سن، وزن، عقیم‌بودن و آلرژن‌ها) محصول مناسب پیشنهاد می‌دهد. مالکیت محصول/کاربر/سفارش در همهٔ مسیرها اعمال می‌شود.

## ۲. امکانات MVP

**مشتری:** ورود با نام کاربری/رمز عبور یا OTP (پیامک)، ثبت‌نام و بازیابی رمز با تأیید موبایل، پروفایل و آدرس‌ها، پت‌ها (با تگ آلرژن/رژیمی)، کاتالوگ (جست‌وجو/فیلتر/جزئیات)، پیشنهاد هوشمند، علاقه‌مندی‌ها، سبد خرید، کوپن، تسویه و پرداخت (Zarinpal / mock)، سفارش‌ها، دارو/داروخانه/کلینیک (فقط اطلاع‌رسانی).

**ادمین (اپ مستقل):** ورود با نام کاربری/رمز یا OTP و کنترل نقش `ADMIN`، افزودن حساب مدیر و تعیین/بازنشانی اطلاعات ورود، داشبورد KPI، گزارش‌ها + CSV، مدیریت کاربران/کاتالوگ/سفارش/پرداخت/کوپن/دارو/داروخانه/کلینیک، تنظیمات، لاگ تغییرات — همه با جست‌وجو/فیلتر/صفحه‌بندی (query-driven).

**خارج از MVP:** دامپزشک/نوبت‌دهی، پرونده پزشکی، نسخه، پانسیون، گفتگو، اشتراک، نظرات، بلاگ.

## ۳. استک فنی

| بخش | انتخاب |
|---|---|
| بک‌اند | NestJS 10 (TypeScript strict)، Prisma 5 با **MySQL 8** (`utf8mb4`)، Redis 7 (OTP/کش/refresh)، JWT، Swagger در `/docs`، helmet، throttler سراسری |
| پرداخت | Zarinpal (WebGate کلاسیک، URLهای قابل‌override) + درایور `mock` (فقط توسعه)؛ callback امضاشده (HMAC)، `Status==='OK'` الزامی، گذارهای اتمیک |
| پیامک | ماژول `sms` با درایورهای `console` / `sms.ir` (`verify` + `bulk`)؛ لاگ تحویل `SmsLog` + `GET /admin/sms/logs` |
| فرانت‌اند | React 19 + Vite، TypeScript strict، React Router 7، TanStack Query 5، Zod، Tailwind 4، Vitest |
| پنل ادمین | اپ مستقل React/RTL (پورت ۵۱۷۴ در توسعه) |
| رابط کاربری | فارسی/راست‌چین (RTL)، فونت وزیرمتن، تاریخ جلالی در نمایش |
| زیرساخت | **Docker Compose** (MySQL 8.4 + Redis 7 + بک‌اند)، nginx + certbot روی سرور، اسکریپت‌های `scripts/` |

## ۴. ساختار مخزن

```text
Dr.Gupet/
├── scripts/                  # اسکریپت‌های عملیاتی سرور (setup / update / ssl)
│   └── nginx/                # قالب پیکربندی nginx برای ssl.sh
├── backend/                  # API (NestJS + Prisma + MySQL)
│   ├── docker-compose.yml    # پشتهٔ production: mysql + redis + backend
│   ├── Dockerfile            # ایمیج چندمرحله‌ای (build → production)
│   ├── prisma/               # schema.prisma، migrations، seed.ts
│   ├── src/                  # ماژول‌های برنامه (جزئیات: پایین همین بخش)
│   └── docs/                 # CHANGELOG، SMS_IR_API، TEST_CHECKLIST و…
├── frontend/                 # وب‌اپ مشتری (React/Vite) → خروجی frontend/dist
├── admin/                    # پنل ادمین (React/Vite) → خروجی admin/dist
└── .issue/                   # وضعیت ممیزی امنیتی/کیفی (فایل‌های STATUS)
```

ساختار داخلی `backend/src`:

```text
src/
├── main.ts                   # bootstrap (prefix /api/v1، ValidationPipe، Swagger، helmet)
├── config/                   # app, jwt, redis, sms, payment, otp + env.validation.ts
├── common/                   # guards (JwtAuthGuard سراسری + RolesGuard)، filters،
│                             # decorators (@CurrentUser,@Roles,@Public)، utils، constants
├── prisma/ · redis/          # PrismaService و RedisService (تنها راه‌های ارتباط با زیرساخت)
├── sms/                      # SmsService + درایورها + لاگ تحویل (SmsLog)
├── upload/ · health/         # آپلود تصویر (سهمیه‌دار) و GET /health
├── admin/                    # داشبورد، گزارش‌ها (CSV)، audit، settings
└── modules/                  # auth, users, addresses, pets, pet-types, breeds, tags,
                              # brands, categories, products, favorites, cart, coupons,
                              # orders, payments, medicines, pharmacies, clinics
```

هر ماژول: `<name>.module.ts` + `<name>.controller.ts` + `<name>.service.ts` + `dto/`. کنترلرها نازک‌اند؛ منطق کسب‌وکار فقط در سرویس‌هاست.

## ۵. Docker چیست و چرا؟ — توضیح کامل

### ۵.۱ مفاهیم در یک نگاه

| مفهوم | یعنی چه | در این پروژه |
|---|---|---|
| **Image** | یک «اسنپ‌شات» آماده از برنامه + همهٔ وابستگی‌هایش (Node، کتابخانه‌ها) | ایمیج بک‌اند از `backend/Dockerfile` ساخته می‌شود؛ MySQL و Redis ایمیج‌های آمادهٔ رسمی‌اند |
| **Container** | نمونهٔ در حال اجرای یک image — ایزوله، مثل یک سرور کوچک | `pet_backend`، `pet_mysql`، `pet_redis` |
| **Volume** | فضای ذخیره‌سازی ماندگار **بیرون** از کانتینر | `mysql_data` (داده‌های دیتابیس)، `redis_data`، `backend/uploads` (فایل‌های آپلودی) |
| **Network** | شبکهٔ خصوصی بین کانتینرهای یک compose | سرویس‌ها همدیگر را با **نام سرویس** صدا می‌زنند: `mysql:3306`، `redis:6379` |
| **docker-compose.yml** | فایل «توصیف پشته»: چه سرویس‌هایی، با چه ایمیجی، چه پورت‌ها/volume‌ها/وابستگی‌هایی | `backend/docker-compose.yml` |

### ۵.۲ وقتی `docker compose up -d` می‌زنید چه می‌شود؟

1. **ساخت ایمیج بک‌اند** از `Dockerfile` (مرحلهٔ build: نصب وابستگی‌ها، `prisma generate`، `nest build` → مرحلهٔ production: فقط وابستگی‌های اجرایی + `dist`). لایه‌های Docker کش می‌شوند؛ اگر `package.json` عوض نشده باشد، ساخت بعدی **چند ثانیه** است.
2. **بالا آمدن MySQL و Redis** با healthcheck (هر ۱۰ ثانیه ping).
3. **بالا آمدن بک‌اند** فقط بعد از سالم‌شدن MySQL/Redis (`depends_on: service_healthy`).
4. داخل کانتینر بک‌اند، اول **`prisma migrate deploy`** اجرا می‌شود (مهاجرت‌های دیتابیس خودکار) و بعد `node dist/src/main`.
5. nginx سرور (بیرون از Docker) درخواست‌های `https://domain` را به `127.0.0.1:3000` (کانتینر بک‌اند) می‌رساند.

### ۵.۳ چرا کارها را ساده می‌کند؟

- **تکرارپذیری مطلق:** همان ایمیج روی لپ‌تاپ، سرور تست و production یکسان اجرا می‌شود؛ «روی سرور من کار می‌کرد» از بین می‌رود.
- **جداسازی وابستگی‌ها:** Node و MySQL داخل کانتینرند؛ سرور فقط به Docker نیاز دارد (نه نصب Node/MySQL دستی با همهٔ دردسرهایش).
- **یک فرمان:** بالا آوردن/پایین آوردن/تازه‌سازی کل پشته با یک دستور؛ بدون ترتیب دستی سرویس‌ها.
- **ماندگاری داده:** کانتینرها ephemeral (نابودشدنی)‌اند اما داده در volumeهاست — بازساخت کانتینر = **صفر از دست رفتن داده**.
- **به‌روزرسانی امن:** `update.sh` فقط کانتینر تغییرکرده را می‌سازد و جایگزین می‌کند؛ مهاجرت دیتابیس خودکار اجرا می‌شود.
- **بازگشت ساده:** اگر نسخهٔ جدید بد بود، برگرداندن ایمیج قبلی و `up -d` کافی است.

### ۵.۴ چه چیزی را Docker حل **نمی‌کند**؟

- **DNS** → خودتان رکورد A دامنه را به IP سرور بدهید.
- **SSL** → با nginx + certbot (اسکریپت `ssl.sh`) انجام می‌شود.
- **بکاپ** → volume `mysql_data` را باید دوره‌ای بکاپ گرفت (بخش ۱۷).
- **مانیتورینگ/لاگ مرکزی** → `docker compose logs` حداقل است؛ برای production جدی ELK/Loki اضافه کنید.

### ۵.۵ فرمان‌های پرکاربرد Docker

| فرمان | کار |
|---|---|
| `docker compose -f backend/docker-compose.yml ps` | وضعیت کانتینرها |
| `docker compose -f backend/docker-compose.yml logs -f backend` | لاگ زندهٔ بک‌اند |
| `docker compose -f backend/docker-compose.yml restart backend` | ری‌استارت فقط بک‌اند |
| `docker compose -f backend/docker-compose.yml up -d` | اجرای پشته (ساخت/تازه‌سازی خودکار) |
| `docker compose -f backend/docker-compose.yml exec backend sh` | واردشدن به کانتینر |
| `docker compose -f backend/docker-compose.yml exec backend npm run prisma:seed` | اجرای seed |
| `docker compose -f backend/docker-compose.yml down` | خاموشی کامل (داده‌ها در volume می‌مانند) |

> همه‌جا می‌توانید به‌جای این فرمان بلند، از اسکریپت‌های `scripts/` استفاده کنید.

## ۶. استقرار روی سرور — قدم‌به‌قدم

### چارچوب یکپارچگی نسخه — الزامی برای فرانت و بک‌اند

روند انتشار: **توسعه و تست در لوکال → ارائهٔ نتیجه و تأیید مالک → کامیت و پوش روی `main` → استقرار همان SHA تأییدشده روی VPS → تست سایت واقعی**. لوکال، GitHub و VPS باید در پایان انتشار به همان نسخهٔ کد و build تعلق داشته باشند؛ تفاوت تنظیم خصوصی هر محیط مجاز است و فایل `.env` هرگز به Git منتقل نمی‌شود.

پیش از انتشار، تغییرات ثبت‌نشدهٔ لوکال و سرور با diff و پشتیبان حفظ و تطبیق داده شوند؛ آن‌ها را با pull/reset یا کپی build پنهان نکنید. از دیتابیس و نسخهٔ قبلی build پشتیبان بگیرید، فقط migration لازم را اعمال کنید و seed نمایشی را در production اجرا نکنید. مسیر واقعی root در Nginx را بررسی کنید: ساخت `dist` در checkout به‌تنهایی نسخهٔ منتشرشده در مسیر release دیگری را عوض نمی‌کند. SHA، مسیر build، نتیجهٔ migration و تست سلامت/OTP/نقش‌ها در تحویل انتشار ثبت شوند؛ تغییر کد مستقیم روی VPS بخشی از روند عادی نیست.

> 📄 **راهنمای کامل و گام‌به‌قدم دیپلوی (انگلیسی، مناسب اجرا روی سرور): [`DEPLOY.md`](DEPLOY.md)** — شامل جدول سخت‌افزار (روی سرور ۱GB/۱هسته‌ای هم کار می‌کند)، DNS، عیب‌یابی و بکاپ. اسکریپت‌های `scripts/` کاملاً انگلیسی و non-interactive‌اند (هرگز منتظر تایپ شما نمی‌مانند).

**پیش‌نیاز:** یک سرور Ubuntu/Debian با IP عمومی و دسترسی `sudo` (حداقل ۱GB رم / ۱ هسته — `setup.sh` روی سرورهای کم‌حافظه خودش swap اضافه می‌کند؛ ۲GB رم توصیه می‌شود).

**۱) دریافت کد:**
```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/MohammadAky/Dr.Gupet.git /opt/drgupet
cd /opt/drgupet
```

**۲) راه‌اندازی اولیه (یک‌بار) — با ویزارد تعاملی:**
```bash
sudo ./scripts/setup.sh
```
اسکریپت **قدم‌به‌قدم می‌پرسد**: دامنهٔ فروشگاه، دامنهٔ پنل ادمین، ایمیل، شمارهٔ ادمین، سرویس پیامک و وضعیت پرداخت — و تنظیمات را در فایل خصوصی `backend/.env` می‌نویسد. Docker و nginx و certbot را نصب می‌کند، secretهای قوی تولید می‌کند، پشته را بالا می‌آورد و SSL را فعال می‌کند. برای دامنهٔ عمومی، SMS واقعی و پرداخت `disabled` یا درگاه اصلی لازم است؛ درایورهای نمایشی و seed فقط برای محیط محلی هستند. در production، ادمین اولیه و داده‌های تأییدشده باید جداگانه و با روش بررسی‌شده ثبت شوند. وجود `.env` قبلی اجرای نصب اولیه را متوقف می‌کند. فلگ‌ها (`--domain`، `--phone` و…) یا `--non-interactive` جایگزین تنظیمات لازم production نیستند.

**۳) رکورد DNS:** برای `shop.example.com` و `admin.example.com` رکورد **A** به IP سرور بدهید (پیش از اجرای `ssl.sh`).

**۴) بعد از هر تغییر کد:**
```bash
sudo ./scripts/update.sh --revision FULL_APPROVED_GIT_SHA --with-front
```

**۵) بررسی:**
```bash
curl https://shop.example.com/api/v1/health     # باید پاسخ سلامت بدهد
```

## ۷. اسکریپت‌های عملیاتی (`scripts/`)

| اسکریپت | کی اجرا شود | چه می‌کند |
|---|---|---|
| `setup.sh` | فقط **یک‌بار**، ابتدای کار | ساخت خصوصی `.env`، نصب و build؛ وجود `.env` قبلی اجرای مجدد را متوقف می‌کند. دامنهٔ عمومی فقط production با SMS واقعی و پرداخت `disabled` یا درگاه اصلی؛ seed نمایشی فقط محلی |
| `update.sh` | انتشار نسخهٔ تأییدشده | الزام SHA کامل `--revision` منتشرشده روی `origin/main`، checkout پاک و پیشروی fast-forward؛ پشتیبان خصوصی MySQL و ایمیج/build قبلی، build و بررسی سلامت؛ تغییر فرانت نیازمند `--with-front` |
| `ssl.sh` | موقع فعال‌سازی/تمدید دستی SSL | نصب nginx/certbot، رندر قالب `scripts/nginx/site.conf.template` برای دامنه‌ها، صدور گواهی Let's Encrypt با redirect خودکار HTTP→HTTPS، تست تمدید خودکار |

نکته‌های مهم:
- `setup.sh` ویزارد نصب اولیه است؛ برای سرور دارای `.env` از `update.sh --revision` استفاده کنید و تنظیم خصوصی را جدا مدیریت کنید. پرداخت `disabled` پیش‌فرض امن پیش از دریافت درگاه است؛ OTP ثابت پاک می‌شود و دامنهٔ عمومی با درایور توسعه یا درگاه sandbox منتشر نمی‌شود. ساخت هر دو SPA با `VITE_API_BASE_URL=/api/v1` است.
- اگر بک‌اند بالا نیاید (crash-loop)، اسکریپت **خودش وضعیت کانتینر و آخرین لاگ‌ها را چاپ می‌کند** و با پیام دقیق می‌ایستد — مثلاً `NODE_ENV=production` بدون کلیدهای واقعی smsir/زرین‌پال.
- اگر DNS هنوز به سرور اشاره نکرده باشد، مرحلهٔ SSL **تمیز رد می‌شود** (به‌جای گیر کردن) و می‌گوید بعداً `ssl.sh` را اجرا کنید.
- روی سرورهای ۱ هسته‌ای/۱GB، ساخت اول ایمیج و build فرانت‌ها ۵ تا ۲۰ دقیقه طول می‌کشد — طبیعی است؛ `setup.sh` برای جلوگیری از OOM خودش swap می‌سازد.
- seed نمایشی در production ممنوع است؛ تغییر دادهٔ واقعی نیاز به migration یا درج تأییدشده دارد. فلگ `--seed` صرفاً برای محیط محلی باقی مانده است.
- هر سه اسکریپت **root** می‌خواهند (`sudo`).
- مسیر کد مهم نیست — `setup.sh` خودش مسیر ریشهٔ پروژه را به `ssl.sh` پاس می‌دهد؛ اگر `ssl.sh` را تنها اجرا می‌کنید و کد جایی غیر از `/opt/drgupet` است، `--root /root/Dr.Gupet` بدهید.
- اگر pull ایمیج‌های mysql/redis با خطای **403 Forbidden** مواجه شد (محدودیت داکرهاب)، بخش «Docker Hub blocked (403)» در [`DEPLOY.md`](DEPLOY.md) را ببینید (mirror / docker save-load).

## ۸. SSL — فعال‌سازی HTTPS

```bash
sudo ./scripts/ssl.sh --domain shop.example.com --email you@example.com \
     [--admin-domain admin.example.com]
```

- گواهی **رایگان Let's Encrypt** صادر و روی nginx نصب می‌شود؛ `http://` خودکار به `https://` ریدایرکت می‌شود.
- **تمدید خودکار:** پکیج certbot یک تایمر systemd می‌گذارد که هر ۱۲ ساعت چک می‌کند؛ نیازی به کار دستی نیست (`certbot renew --dry-run` برای تست).
- اگر بعداً دامنهٔ پنل را اضافه کردید، همان دستور را با `--admin-domain` دوباره بزنید.
- چون هر دو دامنه از یک سرور nginx به `/api` پروکسی می‌شوند، **مشکل CORS اصلاً پیش نمی‌آید**؛ فقط اگر جای دیگری API را صدا زدید `CORS_ORIGINS` را در `.env` کامل کنید.

## ۹. متغیرهای محیطی

فایل: `backend/.env` (از `backend/.env.example` ساخته می‌شود؛ `env.validation.ts` در startup همه را اعتبارسنجی می‌کند — نبود/نامعتبری یعنی خطای سریع).

| متغیر | توضیح |
|---|---|
| `NODE_ENV` | `production` روی سرور (در production درایورهای mock/console رد می‌شوند) |
| `PORT` | پورت بک‌اند (۳۰۰۰) |
| `PUBLIC_BASE_URL` | آدرس عمومی API — برای URL فایل‌های آپلودی (`https://shop.example.com`) |
| `CORS_ORIGINS` | فهرست originهای مجاز (با ویرگول) |
| `DATABASE_URL` | `mysql://user:pass@host:3306/pet_db` (در compose به‌صورت خودکار به سرویس `mysql` اشاره می‌کند) |
| `REDIS_URL` | آدرس Redis (در compose: `redis://redis:6379`) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | سکرت توکن‌ها — توسط `setup.sh` تولید می‌شوند |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | عمر توکن‌ها (پیش‌فرض `15m` / `30d`) |
| `OTP_TTL_SECONDS` · `OTP_RESEND_COOLDOWN_SECONDS` · `OTP_MAX_PER_HOUR` · `OTP_MAX_VERIFY_ATTEMPTS` · `OTP_DEV_CODE` | سیاست OTP (بخش ۱۳) |
| `OTP_HASH_SECRET` | سکرت اختصاصی هش OTP — **در production الزامی** |
| `SMS_DRIVER` | `console` (توسعه) \| `smsir` (production) |
| `SMS_API_KEY` · `SMS_IR_TEMPLATE_ID` · `SMS_IR_PARAM_NAME` · `SMS_IR_BASE_URL` · `SMS_IR_LINE_NUMBER` | تنظیمات sms.ir (رفرنس: `backend/docs/SMS_IR_API.md`) |
| `SMS_NOTIFY_PAYMENT_SUCCESS` | `false` → پیامک موفقیت پرداخت خاموش |
| `PAYMENT_DRIVER` | `mock` (توسعه) \| `zarinpal` (درگاه واقعی) \| `disabled` (پرداخت و ثبت سفارش غیرفعال؛ production مجاز) |
| `ZARINPAL_MERCHANT_ID` · `ZARINPAL_SANDBOX` · `ZARINPAL_API_BASE` · `ZARINPAL_STARTPAY_BASE` | درگاه زرین‌پال (Sandbox=true برای تست) |
| `PAYMENT_CALLBACK_URL` | `https://shop.example.com/api/v1/payments/callback` |
| `FRONTEND_PAYMENT_RESULT_URL` | صفحهٔ نتیجهٔ پرداخت در فرانت (`https://shop.example.com/payment/result`) |
| `UPLOAD_DIR` · `UPLOAD_MAX_MB` (۱–۱۰) · `UPLOAD_DAILY_COUNT_LIMIT` · `UPLOAD_DAILY_BYTES_LIMIT` | آپلود و سهمیهٔ روزانهٔ هر کاربر |
| `SHIPPING_FLAT_COST` · `FREE_SHIPPING_THRESHOLD` · `ORDER_EXPIRE_MINUTES` | قواعد سفارش (جدول settings دیتابیس بر env مقدم است) |
| `ADMIN_SEED_PHONE` | شمارهٔ ادمین اولیه (در seed ساخته می‌شود) |
| `TRUST_PROXY` | تعداد hop پروکسی (پشت nginx: `1`) — برای IP درست در throttle/لاگ |
| `MYSQL_PASSWORD` · `MYSQL_ROOT_PASSWORD` | فقط برای interpolation در docker-compose (توسط `setup.sh` تولید می‌شوند) |

**الزام‌های production** (bootstrap بدون آن‌ها عمداً fail می‌کند): `SMS_DRIVER=smsir` + `SMS_API_KEY` + `SMS_IR_TEMPLATE_ID`، `OTP_HASH_SECRET`، و `PAYMENT_DRIVER=zarinpal` با `ZARINPAL_MERCHANT_ID` یا `PAYMENT_DRIVER=disabled`. حالت `disabled` برای انتشار اولیه پیش از دریافت مجوز درگاه است: ورود و APIهای عمومی/مدیریتی فعال می‌مانند، اما checkout، آغاز پرداخت، callback و عملیات نوشتن پرداخت پیش از هر تغییر دیتابیس با `PAYMENT_UNAVAILABLE` و HTTP 503 رد می‌شوند. این حالت هیچ پرداخت آزمایشی را فعال نمی‌کند؛ تأیید قالب SMS برای ورود واقعی همچنان لازم است.

## ۱۰. توسعهٔ محلی

**بک‌اند:**
```bash
cd backend
docker compose up -d mysql redis   # یا فقط: docker compose up -d
npm ci && cp .env.example .env
npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed
npm run start:dev                  # http://localhost:3000/api/v1  ·  Swagger: /docs
```

**فرانت‌اند:** `cd frontend && npm ci && npm run dev` → `http://localhost:5173/`

**پنل ادمین:** `cd admin && npm ci && npm run dev` → `http://localhost:5174/` — بک‌اند باید بالا باشد؛ ورود با رمز به ارسال پیامک وابسته نیست. فقط حسابی که `GET /admin/me` نقش `ADMIN` بدهد وارد می‌شود. توکن‌ها در حافظهٔ تب‌اند (با refresh خودکار)؛ API بدون کوکی است. ادمین در dev، `/api` را به بک‌اند پروکسی می‌کند؛ مشتری از `VITE_API_BASE_URL` استفاده می‌کند.

**اسکریپت‌های تست:** `npm test` (واحد)، `npm run test:e2e` (نیازمند MySQL/Redis واقعی)، `npm run lint`.

## ۱۱. قراردادهای سراسری API

- پیشوند: `/api/v1`؛ منابع جمع و kebab-case (`/pet-types`، `/cart/items`)؛ تاریخ‌ها ISO-8601 UTC (تبدیل جلالی وظیفهٔ فرانت).
- Auth: `Authorization: Bearer <accessToken>`؛ همه‌جا JwtAuthGuard سراسری؛ مسیرهای عمومی با `@Public()`.

**پاسخ موفق:**
```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
```
(`meta` فقط برای لیست‌های صفحه‌بندی‌شده.)

**پاسخ خطا:**
```json
{ "success": false, "error": { "code": "OUT_OF_STOCK", "message": "موجودی کافی نیست" } }
```

- **نشست و خروج:** `POST /auth/logout` فقط نشست refresh (Redis) را باطل می‌کند؛ access token تا سررسید طبیعی (≤۱۵ دقیقه) معتبر است؛ حساب‌های `BLOCKED`/حذف‌شده در هر درخواست ۴۰۱ می‌گیرند؛ همگام‌سازی بین تب‌ها وظیفهٔ فرانت است.
- **نرخ محدودسازی:** سراسری ۱۰۰/دقیقه per-IP؛ `otp/*` و `upload/image` هر کدام ۱۰/دقیقه.
- **شماره موبایل:** `phone.util.ts` (تنها مرجع): نرمال‌سازی به `09XXXXXXXXX`؛ ارقام فارسی/عربی، `+98`، `0098`، `98`، بدون صفر، فاصله/خط تیره پذیرفته می‌شود؛ جست‌وجوی نام‌ها با `normalizeFa()`.
- **پول:** تومان، ذخیره `Int`؛ `money.util.ts` فقط لایهٔ درگاه (`tomanToRial`).
- **صفحه‌بندی:** `page`/`limit` با `DEFAULT_PAGE_LIMIT=20`، `MAX_PAGE_LIMIT=50`.

## ۱۲. نمای API

| گروه | مسیرها |
|---|---|
| auth | `POST /auth/otp/request` · `POST /auth/otp/verify` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` |
| ورود با رمز | `POST /auth/password/login` · `POST /auth/password/register/request-otp` · `POST /auth/password/register` · `POST /auth/password/change` |
| بازیابی رمز | `POST /auth/password/forgot/request` · `POST /auth/password/forgot/reset` |
| مدیریت اطلاعات ورود | `POST /admin/users/password-account` (حساب جدید) · `POST /admin/users/:id/password-account` (حساب موجود)؛ فقط `ADMIN` و با ثبت رویداد |
| کاربر | `GET/PATCH /users/me`، `GET/POST/PATCH/DELETE /users/me/addresses...` (+default)، پت‌ها (`/pets...` + tags) |
| کاتالوگ | `GET /products` (جست‌وجو/فیلتر)، `GET /products/:slug`، `/brands`، `/categories`، `/pet-types`، `/breeds`، `/tags` |
| پیشنهاد | `GET /recommendations?petId=` |
| علاقه‌مندی | `GET/POST/DELETE /favorites...` |
| سبد | `GET /cart`، `POST /cart/items`، `PATCH/DELETE /cart/items/:id`، `DELETE /cart` |
| کوپن | `POST /coupons/validate` |
| سفارش | `POST /orders`، `GET /orders`، `GET /orders/:id`، `POST /orders/:id/cancel` |
| پرداخت | `POST /payments/start`، `GET /payments/callback` (امضاشده)، `GET /payments/mock-pay` (فقط توسعه) |
| دارو/داروخانه | `GET /medicines...`، `GET /pharmacies...` (فیلتر `q`/city/province/is24h/onDuty)، `GET /clinics...` |
| آپلود | `POST /upload/image` (سهمیه‌دار، JPEG/PNG/WebP) |
| سلامت | `GET /health` |

## ۱۳. معماری OTP و SMS

### حساب مشترک برای رمز عبور و OTP

هر حساب دقیقاً یک شمارهٔ موبایل نرمال‌شده و یکتا دارد. `PasswordCredential` برای هر کاربر حداکثر یک نام کاربری یکتا نگه می‌دارد؛ نام کاربری ۳ تا ۳۲ حرف انگلیسی کوچک/رقم/نقطه/زیرخط است و هنگام دریافت trim/lowercase می‌شود. حساب‌های قدیمی OTP تا تعیین نخستین نام کاربری، با همان شماره قابل استفاده‌اند. ثبت‌نام `{username,password,phone,code,firstName?,lastName?}` پس از تأیید OTP، حساب جدید `USER` می‌سازد یا فقط نخستین اطلاعات ورود را به حساب همان شماره اضافه می‌کند؛ نام، نقش، تاریخچه و رمز موجود را بازنویسی نمی‌کند. ثبت‌نام عمومی نقش مدیر نمی‌پذیرد.

رمز با bcrypt هزینهٔ ۱۲ هش می‌شود؛ حداقل ۱۲ نویسه و حداکثر ۷۲ بایت UTF-8 دارد. رمز/هش در پاسخ عمومی، لاگ تغییرات، URL یا ذخیره‌سازی مرورگر قرار نمی‌گیرد. ورود `{username,password}` همان قرارداد نشست OTP را برمی‌گرداند. تغییر رمز `{currentPassword,newPassword}` نشست تازه می‌دهد و با افزایش `sessionVersion`، access/refresh قبلی را باطل می‌کند؛ حساب مسدود یا حذف‌شده نمی‌تواند وارد شود.

بازیابی با `{username,phone}` پاسخ عمومی یکسان می‌دهد و فقط برای جفت منطبق کد می‌فرستد. ارسال بازیابی در همان فرایند و بدون انتظار پاسخ سرویس پیامک انجام می‌شود تا زمان پاسخ API وجود حساب را آشکار نکند؛ صف پایدار نیست و پاسخ موفق به معنی تحویل پیامک نیست. تأیید `{username,phone,code,newPassword}` کد یک‌بارمصرف را مصرف و همهٔ نشست‌های قبلی را باطل می‌کند. ارسال عادی OTP و ثبت‌نام همچنان منتظر پذیرش سرویس پیامک می‌مانند.

ایجاد حساب مدیر از ثبت‌نام عمومی ممکن نیست. مدیر احرازشده از بخش کاربران حساب جدید با موبایل یکتا می‌سازد یا برای شناسهٔ صریح کاربر اطلاعات ورود تعیین می‌کند. راه‌اندازی نخستین مدیر با `npm run auth:provision` و متغیرهای خصوصی `PASSWORD_ACCOUNT_*` مستند در `backend/scripts/provision-password-account.ts` انجام می‌شود؛ این دستور seed، مرحلهٔ خودکار استقرار یا endpoint عمومی نیست. رمز را در آرگومان shell، چت یا Git نگذارید.

**مرز مسئولیت:** `OtpService` (`modules/auth/otp/`) فقط سیاست کد است — تولید، هش، تایید یک‌بارمصرف، سقف‌ها؛ `SmsService` (`src/sms/`) فقط تحویل پیام — facade بی‌طرف با درایورهای `console`/`smsir`.

| لایهٔ سیاست | محدوده | مقدار |
|---|---|---|
| `ThrottlerGuard` سراسری | هر IP | ۱۰۰ درخواست/دقیقه |
| `@Throttle` مسیرهای `otp/*` | هر IP | ۱۰/دقیقه |
| cooldown ارسال (`SET NX` اتمیک) | هر شماره | `OTP_RESEND_COOLDOWN_SECONDS` |
| سقف درخواست ساعتی | هر شماره | `OTP_MAX_PER_HOUR` |
| سقف تلاش تایید | هر کد | `OTP_MAX_VERIFY_ATTEMPTS` |

کدها فقط به‌صورت HMAC با **`OTP_HASH_SECRET`** (جدا از JWT) ذخیره می‌شوند؛ مصرف کد با `DEL` اتمیک (دقیقاً یک برنده در همزمانی)؛ شکست ارسال پیامک، کد و cooldown را دور می‌ریزد. هر ارسال در `SmsLog` (`SENT`/`FAILED` + `messageId`) ثبت و در `GET /admin/sms/logs` نمایش داده می‌شود.

**ارسال OTP:** فقط `POST https://api.sms.ir/v1/send/verify` با `mobile`، `templateId` عددی و `parameters` شامل نام دقیق متغیر قالب و کد؛ `lineNumber` مربوط به اطلاع‌رسانی bulk است و پیش‌نیاز OTP نیست. درایور آدرس پایهٔ غیررسمی و redirect را پیش از ارسال کلید رد می‌کند. `SmsLog.SENT` پذیرش سرویس‌دهنده است، نه اثبات تحویل روی گوشی؛ تست واقعی پیامک روی VPS/HTTPS انجام می‌شود. تست واحد در لوکال هیچ پیامک واقعی نمی‌فرستد.

## ۱۴. قواعد کسب‌وکار

**تسویهٔ سفارش (`POST /orders`) — یک تراکنش:** سبد → بررسی مالکیت آدرس و فعال‌بودن واریانت‌ها → `itemsTotal` از قیمت فعلی واریانت → اعمال کوپن → `shippingCost` (رایگان بالای `FREE_SHIPPING_THRESHOLD`) → `finalAmount` (هرگز منفی نشود) → **کسر اتمیک موجودی** (`updateMany` شرطی؛ شکست → `OUT_OF_STOCK`) → ایجاد Order (`PENDING_PAYMENT`) + اسنپ‌شات اقلام/آدرس + خالی‌کردن سبد.

**جریان وضعیت:** `PENDING_PAYMENT →(پرداخت) PAID → PROCESSING → SHIPPED → DELIVERED`؛ لغو/انقضا فقط از `PENDING_PAYMENT` (برگشت موجودی، دقیقاً یک‌بار). پرداخت دیررسیده پس از لغو → مسیر بازبینی/استرداد (`refundNote`) نه `PAID`.

**کوپن:** ناموجود/غیرفعال → `COUPON_INVALID`؛ خارج از بازه → `COUPON_EXPIRED`؛ زیر `minOrderAmount` → `COUPON_MIN_AMOUNT`؛ سقف کل/هرکاربر → `COUPON_LIMIT_REACHED`. `PERCENT` با سقف `maxDiscount` (floor)؛ `FIXED` → مبلغ ثابت؛ هرگز بیشتر از `itemsTotal`.

**پرداخت:** `POST /payments/start` → `Payment(INITIATED)` + `paymentUrl`؛ callback **امضاشده (HMAC روی paymentId+orderId)** و فقط با `Status==='OK'` + verify سمت سرور؛ idempotent؛ گذار اتمیک پرداخت/سفارش؛ شکست درگاه → `FAILED` و سفارش قابل تلاش مجدد. **هرگز** سفارش را فقط با query string پرداخت‌شده اعلام نکنید.

**پیشنهاد محصول:** lifeStage از `birthDate` (`<12m` توله/بچه، `≥84m` مسن)؛ sizeClass سگ از `weightKg` (`<10` کوچک، `10–25` متوسط، `>25` درشت)؛ فیلتر: محصول فعالِ دارای موجودی، هم‌نوع پت، lifeStage/sizeClass منطبق یا `ANY`، سازگاری عقیم‌بودن، و حذف محصولات دارای تگ `CONTAINS` متناقض با آلرژن‌های پت. رتبه‌بندی: تطبیق تگ‌های `DIET` نزولی. (heuristic — نه توصیهٔ دامپزشکی.)

**ثابت‌ها (`common/constants`):** `MAX_ADDRESSES_PER_USER=10`، `MAX_PETS_PER_USER=10`، `MAX_CART_ITEM_QTY=20`، `LOW_STOCK_THRESHOLD=5`، بازه‌های سنی/وزنی پت، `DEFAULT_PAGE_LIMIT=20`، `MAX_PAGE_LIMIT=50`.

**مدل دامنه (راهنمای سریع):** `ProductVariant` حامل وزن/قیمت/موجودی/SKU است (سبد و سفارش به آن ارجاع می‌دهند)؛ `OrderItem` و `addressSnapshot` اسنپ‌شات‌اند؛ سبد قیمت ذخیره نمی‌کند؛ داروخانه↔دارو بدون قیمت/موجودی (`PharmacyMedicine` + `lastConfirmedAt`). مرجع کامل: `backend/prisma/schema.prisma`.

## ۱۵. API پنل ادمین

همهٔ مسیرها زیر `admin/`، فقط نقش `ADMIN` (Guard سراسری + `@Roles('ADMIN')`)؛ هر تغییر در `AdminAuditLog`. جزئیات در Swagger (تگ‌های `Admin - *`).

| گروه | مسیرها |
|---|---|
| هسته | `GET /admin/me`، `GET /admin/dashboard` (KPI/نمودار/سفارش‌های اخیر/پرفروش‌ها، پارامتر `tz`) |
| گزارش‌ها | `GET /admin/reports/{sales, top-products, low-stock, users, coupons}` + نسخه‌های `.csv` (با خنثی‌سازی فرمول) |
| تنظیمات | `GET/PUT /admin/settings`، `DELETE /admin/settings/:key` |
| لاگ‌ها | `GET /admin/audit-logs` · `GET /admin/sms/logs` (فیلتر phone/kind/status) |
| کاربران | `GET/POST/PATCH/DELETE /admin/users...` + `PATCH /admin/users/:id/restore` |
| کاتالوگ | `admin/products` (+ `variants`/`images`/`tags`)، `admin/brands`، `admin/categories`، `admin/pet-types`، `admin/breeds`، `admin/tags` — همه با `search`/`isActive` |
| سفارش‌ها | `GET/PATCH /admin/orders...` — `:id/transition`، `:id/tracking`، `:id/cancel`، `:id/refund` (ساخت سفارش فقط از `POST /orders`) |
| پرداخت‌ها | `GET /admin/payments...` — `:id/reconcile`، `:id/mark-failed` |
| کوپن‌ها | CRUD `/admin/coupons` + آمار مصرف |
| دارو/داروخانه/کلینیک | CRUD `/admin/medicines`، `/admin/pharmacies` (+ لینک دارو، `onDuty`)، `/admin/clinics` |

## ۱۶. استراتژی تست

- **واحد (Jest) — ۲۷ سوییت / ۱۷۷ تست:** OTP (هش، سقف‌ها، همزمانی)، جریان `requestOtp`، درایورهای SMS + لاگ `SmsLog`، سخت‌سازی callback پرداخت، cancel/expire اتمیک، سهمیهٔ آپلود، `POST /admin/users`، CSV injection، جستجوها، سبد/پت/آدرس/علاقه‌مندی، ابزارها.
- **E2E (Supertest):** MySQL (دیتابیس تستی) + Redis واقعی؛ `PAYMENT_DRIVER=mock` و `SMS_DRIVER=console`.
- سناریوهای حتمی: خرید کامل؛ جداسازی مالکیت؛ همزمانی آخرین موجودی؛ سقف کوپن؛ idempotency کال‌بک؛ دسترسی غیرمجاز/مسدود.
- چک‌لیست دستی: [`backend/docs/TEST_CHECKLIST.md`](backend/docs/TEST_CHECKLIST.md).

## ۱۷. نگهداری، بکاپ و عیب‌یابی

**بکاپ (مهم‌ترین کار دوره‌ای):**
```bash
# هر شب با cron — مثال:
docker exec pet_mysql mysqldump -u pet -p"$MYSQL_PASSWORD" pet_db | gzip > /backups/db-$(date +%F).sql.gz
tar czf /backups/uploads-$(date +%F).tar.gz -C /opt/drgupet/backend uploads
```
بکاپ‌ها را خارج از سرور نگه دارید (S3/سیستم دیگر). بازیابی: `gunzip < db.sql.gz | docker exec -i pet_mysql mysql -u pet -p pet_db`.

**لاگ‌ها:** `docker compose -f backend/docker-compose.yml logs --since=24h backend` · لاگ nginx در `/var/log/nginx/`.

**عیب‌یابی سریع:**

| علامت | بررسی |
|---|---|
| سایت بالا نمی‌آید | `docker compose ... ps` · `systemctl status nginx` · `nginx -t` |
| خطای ۵۰۲ از nginx | کانتینر بک‌اند بالا نیست → `logs backend` |
| بک‌اند restart می‌شود | لاگ startup: معمولاً نبود متغیر الزامی `.env` (پیام `env.validation`) |
| پیامک نمی‌رود | `GET /admin/sms/logs` (وضعیت/کد درگاه) · `SMS_API_KEY`/`SMS_IR_TEMPLATE_ID` |
| کد OTP نمی‌آید | سقف‌ها (بخش ۱۳) · ردیف `SmsLog` نوع OTP |
| فایل آپلود ۴۰۴ | `UPLOAD_DIR` و volume `uploads` · `PUBLIC_BASE_URL` |
| مهاجرت دیتابیس نرفت | `docker compose ... logs backend` (ابتدای لاگ: `prisma migrate deploy`) |
| گواهی SSL | `certbot renew --dry-run` · `journalctl -u certbot.timer` |

## ۱۸. وضعیت و مسیر توسعه

**بک‌اند (MVP v1):** Bootstrap، زیرساخت، کاربر/آدرس، مرجع‌ها، پت، کاتالوگ، پیشنهاد، علاقه‌مندی، سبد، کوپن، سفارش، دارو/داروخانه، کلینیک، seed/ابزار ادمین — ✅ · احراز هویت، پرداخت، Hardening/تحویل، API پنل ادمین — 🚧 (کد کامل؛ پذیرش زنده باقی است).

**فرانت‌اند (F0–F11) و پنل ادمین (A0–A5):** مسیرهای اصلی پیاده‌اند و با بک‌اند کار می‌کنند؛ پذیرش نهایی (به‌ویژه با API زنده و بررسی بصری/دسترس‌پذیری) با مالک پروژه است.

**گام فعلی:** ورود با نام کاربری/رمز در لوکال، پیش‌نمایش و تأیید مالک، سپس کامیت/پوش و استقرار نسخهٔ تأییدشده. پرداخت واقعی تا دریافت مجوز و شناسهٔ درگاه باز می‌ماند؛ آزمایش sandbox فقط در محیط جداگانهٔ محلی مجاز است.

### ورود با نام کاربری و رمز — ۲۰۲۶-۱۰-۰۸

این مرحله با اجازهٔ صریح مالک برای بک‌اند و دیتابیس انجام شد؛ تغییرات زیر هنوز انتشار VPS محسوب نمی‌شوند. تصمیم فنی `DEC-026` و migration افزایشی `20261008000000_password_accounts` مرجع این مرحله‌اند.

- [x] موبایل اجباری/یکتا حفظ شد؛ اطلاعات ورود در جدول جدا با `userId` و نام کاربری یکتا نگهداری می‌شود. قبل از migration در MySQL 8 محلی پشتیبان گرفته شد؛ migration واقعی موفق بود.
- [x] ثبت‌نام مشتری با تأیید OTP، اتصال نخستین نام کاربری به حساب OTP موجود، ورود با رمز و بازیابی رمز با همان موبایل پیاده شد؛ ثبت‌نام نمی‌تواند رمز/نقش/پروفایل موجود را بازنویسی کند.
- [x] تغییر و بازیابی رمز با افزایش نسخهٔ نشست، access/refresh قبلی را باطل می‌کند؛ پاسخ‌ها و رویدادهای مدیریتی رمز/هش را نمایش نمی‌دهند.
- [x] ورود با رمز و OTP در هر دو رابط، فرم ثبت‌نام/بازیابی/تغییر رمز مشتری و ایجاد/تعیین اطلاعات ورود کاربران از پنل مدیر پیاده شد؛ bootstrap مدیر فقط با ابزار خصوصی اپراتور انجام می‌شود.
- [x] پذیرش HTTP محلی با **MySQL و Redis واقعی: ۱۸ سناریو موفق**؛ رد ناشناس و نقش `USER` در مسیر مدیر، اطلاعات تکراری و rollback، مصرف یک‌بارهٔ OTP، حساب مشترک دو روش ورود، ابطال access/refresh و حساب مسدود/حذف‌شده. فقط سرویس ارسال SMS در این آزمون جایگزین کنترل‌شده بود؛ محدودیت HTTP برای اجرای چند سناریو در یک نوبت افزایش یافت و سهمیهٔ داخلی سرویس‌ها حفظ شد. هیچ `Set-Cookie` در پاسخ‌های بررسی‌شده صادر نشد.
- [x] پذیرش هم‌زمانی با **MySQL و Redis واقعی: ۵ سناریو موفق**؛ رقابت نام کاربری/موبایل تکراری، تعیین هم‌زمان اطلاعات ورود حساب موجود، مصرف یک‌بارهٔ کد و rotation تک‌برنده. تعارض تراکنش `P2034` به پاسخ عمومی ۴۰۹ تبدیل شد؛ cleanup رکوردهای آزمون تأیید شد و پیامک واقعی ارسال نشد.
- [x] بک‌اند: **۳۶ سوییت / ۳۰۱ تست** موفق؛ پس از اصلاح تعارض تراکنش، سوییت رمز **۲۶/۲۶** (شامل یک تست جدید) و build مجدداً موفق شدند. فرانت مشتری: **۳۵ فایل / ۲۰۷ تست** موفق؛ آزمون رگرسیون تایمر پس از آن جداگانه موفق شد. build، typecheck و lint هر دو رابط موفق؛ هشدار حجم chunk مشتری همچنان باز است.
- [x] ادمین: اجرای کامل اولیه **۲۳ تست موفق** و یک timeout راه‌اندازی worker داشت؛ اجرای بعدی auth/App با یک worker، **۱۸/۱۸** موفق شد (۱۱ تست مشترک، مجموع ۳۰ مورد متمایز). بازبینی بصری فرم‌های مشتری/ادمین و خطاهای فرم خالی انجام شد؛ ورود واقعی حساب مدیر خصوصی در API لوکال و `GET /admin/me` موفق بود. این حساب و رمز خصوصی به VPS یا Git منتقل نشده‌اند.
- [x] بازبینی پیش‌نمایش لوکال و تأیید صریح مالک برای کامیت/پوش و استقرار در ۲۰۲۶-۱۰-۰۸.
- [ ] استقرار همین نسخه پس از تأیید و پذیرش ورود/بازیابی با پیامک واقعی روی VPS؛ نتیجهٔ محلی شاهد تحویل SMS نیست.
- [ ] داروخانه‌های دامپزشکی مشهد: دادهٔ تحقیق باید پیش از درج عمومی بررسی شود؛ در این مرحله دارو/موجودی دارو اضافه نمی‌شود. محصولات طبق آخرین تصمیم از پنل ادمین با مشخصات/قیمت/موجودی تأییدشده وارد می‌شوند.

### پذیرش فرانت پیش از استقرار — ۲۰۲۶-۱۰-۰۴

مبنای این بازبینی `main` در `4cf0f77` و قرارداد **MySQL 8** است. دامنه‌های تأییدشدهٔ مالک: `drgupet.ir` و `admin.drgupet.ir`؛ فعال‌بودن zone در Cloudflare به‌معنی استقرار و پاسخ‌گویی سایت نیست. مالک پیش‌نمایش و کامیت/پوش این اصلاحات را در ۲۰۲۶-۱۰-۰۴ تأیید کرد؛ پذیرش عملیاتی موارد باز زیر مستقل است.

تنظیم خصوصی پیامک برای `SMS_DRIVER=smsir` و `SMS_IR_TEMPLATE_ID=448272` آماده شده است. مقدار واقعی `SMS_API_KEY` و فایل `.env` عضو کامیت نیستند؛ مالک استقرار باید کلید را جداگانه در تنظیم خصوصی VPS وارد کند. نام پارامتر الگو باید مطابق قالب تأییدشدهٔ سرویس‌دهنده باشد.

- [x] ارسال مجدد OTP ادمین با cooldown پاسخ سرور، نمایش خطا و جلوگیری از ارسال/تأیید هم‌زمان.
- [x] جلوگیری از ارسال تکراری و پاسخ دیرهنگام پس از خروج از صفحهٔ ورود/تأیید مشتری؛ رفتار توکن و API حفظ شد.
- [x] دکمهٔ ورود خوانا در حالت روشن/تاریک و حالت focus؛ کارت و جزئیات کلینیک با تصاویر نمادین و اطلاعات واقعی API.
- [x] فرانت: **۱۹۸ تست در ۳۲ فایل**، lint، typecheck و build موفق. ادمین: **۲۵ تست در ۶ فایل** و همان سه gate موفق. این تست‌ها با mock جای پذیرش پیامک/پرداخت واقعی را نمی‌گیرند.
- [x] بک‌اند همین نسخه در محیط ایزوله: build و **۱۷۷ تست واحد در ۲۷ سوییت** موفق؛ تست واقعی مهاجرت MySQL، ارتباط ۲۸ مدل، rollback، متن فارسی، محدودیت یکتا، بکاپ/بازیابی و ماندگاری پس از restart موفق.
- [x] ده کلینیک تحقیق‌شده در **MySQL محلی آزمایشی** ثبت شدند؛ اجرای دوباره درج، صفر رکورد اضافه کرد. فهرست و ده جزئیات از API پاسخ موفق دادند. هیچ کلینیک صرفاً به‌خاطر امتیاز Google تأییدشده اعلام نشد.
- [x] درخواست ناشناس به مسیرهای خصوصی کاربر/پت/ادمین/لاگ پیامک، ۴۰۱ گرفت. کلید پیامک و تنظیمات خصوصی وارد مخزن نشده‌اند؛ کد backend در این مرحله ویرایش نشده است.
- [ ] پذیرش ورود واقعی کاربر و ادمین، resend و لاگ تحویل پیامک پس از تأیید قالب SMS.ir. طبق اعلام مالک، قالب **448272** تا راه‌اندازی سایت و تأیید سرویس‌دهنده آمادهٔ ارسال واقعی نیست؛ نام پارامتر الگو نیز باید با سرویس‌دهنده تطبیق داده شود.
- [ ] استقرار Ubuntu، TLS، proxy و کنترل دامنه‌ها؛ تنظیم build با `VITE_API_BASE_URL=/api/v1` برای هر دو SPA. اعتبارسنجی پیکربندی startup، seed سازگار و امن، مسیر build و gate مفقود E2E در `.issue/STATUS.md` پیگیری می‌شود.
- [ ] انتقال دادهٔ ده کلینیک به MySQL سرور با بکاپ و درج بدون تکرار توسط مالک بک‌اند. کامیت فرانت، دادهٔ MySQL محلی را به VPS منتقل نمی‌کند؛ دادهٔ تحقیق و ابزار استخراج عضو مخزن نیستند.
- [ ] پرداخت واقعی تا دریافت درگاه باز است. مالک فقط **تست پرداخت آزمایشی در محیط محلی** را مجاز کرده؛ این مجوز تغییری در محدودیت production یا پذیرش URL درگاه واقعی مشتری ایجاد نمی‌کند.

طبق دستور جدید مالک، محصولات تأمین‌کننده فعلاً ثبت نمی‌شوند و بعداً از پنل ادمین وارد خواهند شد. تصاویر کارت کلینیک‌ها نمادین‌اند و عکس واقعی مراکز نیستند؛ امتیاز/رتبه‌بندی Google همچنان به قرارداد `.issue/15` وابسته است. هشدار فعلی build فرانت دربارهٔ chunk بالای ۵۰۰ کیلوبایت مانع build نیست و رفع آن در این مرحله تغییر معماری ضروری محسوب نشد.

بازبینی HTTP همین API محلی: محصولات، داروخانه‌ها، کلینیک‌ها و مرجع‌ها پاسخ ۲۰۰ دادند؛ `GET /medicines?page=1&limit=20` هنوز **۵۰۰** می‌دهد (`.issue/21`). در این درخواست‌ها و رد دسترسی ناشناس، هدر `Set-Cookie` دیده نشد؛ این شاهد جای پذیرش کامل نشست authenticated پس از آماده‌شدن SMS.ir را نمی‌گیرد.

## ۱۹. مستندات

| سند | محتوا |
|---|---|
| [`DEPLOY.md`](DEPLOY.md) | راهنمای دیپلوی گام‌به‌قدم سرور (انگلیسی) |
| [`backend/docs/SMS_IR_API.md`](backend/docs/SMS_IR_API.md) | مرجع کامل REST پیامک sms.ir (برای توسعه بدون دسترسی وب) |
| [`backend/docs/CHANGELOG.md`](backend/docs/CHANGELOG.md) | تغییرات نسخه‌ها |
| [`backend/docs/TEST_CHECKLIST.md`](backend/docs/TEST_CHECKLIST.md) | چک‌لیست تست دستی/پذیرش |
| [`frontend/docs/DECISIONS.md`](frontend/docs/DECISIONS.md) | تصمیم‌های فنی فرانت |
| [`frontend/docs/DESIGN_SYSTEM.md`](frontend/docs/DESIGN_SYSTEM.md) | سیستم طراحی و دارایی‌ها |
| `backend/docs/SCHEMA_CHANGE_REQUESTS.md` | درخواست‌های تغییر مدل دامنه |
| `.issue/STATUS.md` | وضعیت ممیزی‌ها و رفع یافته‌ها |

## ۲۰. واژه‌نامه (فارسی ↔ انگلیسی)

| فارسی | English | فارسی | English |
|---|---|---|---|
| سبد خرید | Cart | واریانت/گونهٔ محصول | Product Variant |
| کوپن/تخفیف | Coupon | مرحلهٔ زندگی (توله/بالغ/مسن) | Life Stage |
| سفارش | Order | کلاس سایز (کوچک/متوسط/درشت) | Size Class |
| پرداخت | Payment | عقیم‌سازی | Neutering |
| درگاه پرداخت | Payment Gateway | آلرژن | Allergen |
| کال‌بک/بازگشت درگاه | Callback | رژیم غذایی | Diet |
| تسویه | Checkout | علاقه‌مندی | Favorite |
| موجودی | Stock | تحویل/ارسال | Delivery / Shipping |
| لغو سفارش | Order Cancellation | استرداد وجه | Refund |
| شمارهٔ سفارش | Order Number | کد رهگیری | Tracking Code |
| موبایل/شماره تماس | Phone Number | یک‌بارمصرف | One-Time (OTP) |
| داروخانه | Pharmacy | کلینیک | Clinic |
| برند | Brand | دسته‌بندی | Category |

## ۲۱. مجوز و حقوق

مالکیت و حقوق مادی و معنوی این پروژه متعلق به **محمد (MohammadAky)** است. استفاده، تغییر و انتشار فقط با اجازهٔ مالک.
