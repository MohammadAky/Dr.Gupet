# Dr. Gupet — دکتر گوپت

> پلتفرم فروش و سلامت حیوانات خانگی — غذای خشک، پروفایل پت، پیشنهاد هوشمند محصول، اطلاعات دارو/داروخانه و فهرست کلینیک‌ها.
>
> مخزن: [MohammadAky/Dr.Gupet](https://github.com/MohammadAky/Dr.Gupet) · شاخه: `main`

**خلاصه فارسی:** این README دروازهٔ ورود به پروژه است: معرفی محصول، استک فنی، راه‌اندازی، قراردادهای کلیدی و **مسیر توسعه** (وضعیت فازها و گام‌های بعدی). مرجع فنی کامل بک‌اند در [`backend/README.md`](backend/README.md) و راهنمای فرانت‌اند در [`frontend/README.md`](frontend/README.md) است.

---

## ۱. معرفی محصول

Dr. Gupet یک فروشگاه اینترنتیِ ویژهٔ حیوانات خانگی (عمدتاً سگ و گربه) با قابلیت‌های سلامت‌محور است. محور اصلی MVP اول، **فروش غذای خشک** است؛ در کنار آن، صاحب حیوان می‌تواند پت‌هایش را ثبت کند، بر اساس پروفایل هر پت پیشنهاد محصول بگیرد، سفارش و پرداخت آنلاین انجام دهد و از اطلاعات دارو، داروخانه و کلینیک‌ها به‌صورت اطلاع‌رسانی بهره ببرد.

نسخهٔ فعلی فقط **پنل کاربر (User)** را شامل می‌شود. داده‌های کاتالوگ (برند، محصول، داروخانه، دارو) از طریق seed و ابزار ادمین وارد می‌شوند، نه API اختصاصی ادمین.

## ۲. امکانات MVP

| حوزه | قابلیت |
|---|---|
| احراز هویت | ورود با شماره موبایل + OTP (بدون رمز عبور)، JWT با access/refresh |
| پروفایل | ویرایش پروفایل، مدیریت آدرس‌ها (حداکثر ۱۰ آدرس، آدرس پیش‌فرض) |
| پت‌ها | ثبت و مدیریت حیوان خانگی (نوع، نژاد، تولد، جنسیت، عقیم‌بودن، وزن، آلرژی‌ها، نیازهای غذایی) |
| فروشگاه | مرور، فیلتر و جستجوی محصولات؛ جزئیات محصول با واریانت‌های وزنی؛ علاقه‌مندی‌ها |
| پیشنهاد | «محصولات مناسب پت من» بر اساس پروفایل پت |
| سبد و سفارش | سبد خرید، کد تخفیف، ثبت سفارش، پرداخت آنلاین، پیگیری سفارش |
| دارو و داروخانه | **فقط اطلاع‌رسانی:** فهرست داروها و داروخانه‌های حاضر — بدون قیمت، موجودی و سفارش |
| کلینیک‌ها | فهرست عمومی کلینیک‌ها + جستجو/فیلتر (نوبت‌دهی خارج از MVP) |

**خارج از MVP (ساخته نشود):** دامپزشک/نوبت‌دهی، پرونده پزشکی و واکسیناسیون، نسخه، پانسیون، مربی، سرپرستی، گفتگو، اشتراک، نظرات، بلاگ، استعلام هویت، موجودی/قیمت داروخانه.

## ۳. استک فنی

| بخش | انتخاب |
|---|---|
| بک‌اند | NestJS 10 (TypeScript strict)، PostgreSQL 16، Prisma 5، Redis 7 (OTP/کش/refresh)، JWT، Swagger در `/docs`، helmet، throttler |
| پرداخت | درگاه Zarinpal + درایور `mock` برای توسعه |
| پیامک | درایور `console` برای توسعه + درایورهای kavenegar / smsir |
| فرانت‌اند | React 19 + Vite، TypeScript strict، React Router 7، TanStack Query 5، Zod، Tailwind 4، Vitest |
| رابط کاربری | فارسی/راست‌چین (RTL)، فونت وزیرمتن (Self-hosted)، تاریخ جلالی در نمایش |
| زیرساخت | Docker Compose (Postgres + Redis)، Dockerfile چندمرحله‌ای بک‌اند |

## ۴. ساختار مخزن

```text
Dr.Gupet/
├── README.md                # همین فایل: معرفی، راه‌اندازی، مسیر توسعه
├── AGENTS.md                # راهنمای همکاری برای ایجنت‌های هوش مصنوعی
├── backend/                 # API (NestJS + Prisma)
│   ├── README.md            # مرجع فنی بک‌اند: قراردادها، قواعد کسب‌وکار، API
│   ├── docs/                # CHANGELOG، چک‌لیست تست، درخواست‌های تغییر اسکیما
│   ├── prisma/              # schema.prisma + seed.ts + migrations
│   └── src/                 # ماژول‌های auth, users, pets, products, orders, ...
└── frontend/                # وب‌اپ کاربر (React + Vite)
    ├── README.md            # راهنمای اجرا و بررسی فرانت‌اند
    ├── docs/                # DECISIONS (تصمیم‌های فنی)، DESIGN_SYSTEM (برند و دارایی‌ها)
    └── src/                 # صفحات، کامپوننت‌ها، api client، استایل‌ها
```

## ۵. راه‌اندازی سریع

**پیش‌نیازها:** Node.js 20+، npm، Docker (برای Postgres و Redis).

### ۵.۱ بک‌اند

```bash
cd backend
docker compose up -d              # PostgreSQL 16 + Redis 7
npm ci
cp .env.example .env              # مقادیر را برای محیط خود تنظیم کنید
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed               # داده‌های نمونه (idempotent)
npm run start:dev                 # API روی http://localhost:3000/api/v1
```

- Swagger: `http://localhost:3000/docs` (فقط در محیط غیر production)
- Health: `GET /api/v1/health`
- ثبت‌نام ادمین از `ADMIN_SEED_PHONE` در `.env` انجام می‌شود.

متغیرهای محیطی کامل در [`backend/README.md`](backend/README.md#۵-محیط-اجرایی) و نمونهٔ آن در `backend/.env.example` مستند شده‌اند. رمز، توکن و کلید هرگز در کد یا مخزن قرار نمی‌گیرند.

### ۵.۲ فرانت‌اند

```bash
cd frontend
npm ci
cp .env.example .env              # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm run dev                       # http://localhost:5173
```

جزئیات (پورت‌ها، پیش‌نمایش production، نکات حریم خصوصی) در [`frontend/README.md`](frontend/README.md).

### ۵.۳ بررسی‌ها و تست

```bash
# بک‌اند
cd backend && npm run build && npm run lint && npm test && npm run test:e2e

# فرانت‌اند
cd frontend && npm run lint && npm run typecheck && npm run build && npm test
```

چک‌لیست تست دستی/پذیرش API در [`backend/docs/TEST_CHECKLIST.md`](backend/docs/TEST_CHECKLIST.md) است.

## ۶. قراردادهای کلیدی

- **پوشش پاسخ (Envelope):** موفق → `{ "success": true, "data": ... }` (با `meta` صفحه‌بندی برای لیست‌ها)؛ خطا → `{ "success": false, "statusCode": 400, "code": "...", "message": "..." }`.
- **پیام خطا فارسی، کد خطا انگلیسی و پایدار** (مثل `OTP_INVALID`، `OUT_OF_STOCK`). فهرست کامل کدها در [`backend/README.md`](backend/README.md).
- **پول:** مبلغ همیشه **تومان و عدد صحیح**؛ هرگز float؛ محاسبهٔ مبلغ فقط سمت سرور از دیتابیس.
- **مالکیت:** همهٔ کوئری‌های دادهٔ کاربر باید `userId` داشته باشند؛ نبود یا عدم مالکیت → `404` (نه `403`).
- **حذف نرم:** کوئری‌ای روی `User` و `Pet` باید `deletedAt: null` داشته باشد.
- **زبان:** شناسه‌ها و کد انگلیسی؛ متن‌های کاربرنما فارسی؛ تاریخ‌ها در API میلادی/ISO و تبدیل جلالی وظیفهٔ فرانت‌اند.
- **متن فارسی:** نرمال‌سازی `ي→ی`، `ك→ک` و ارقام فارسی/عربی در جستجو و شماره موبایل (`09XXXXXXXXX`).
- **فرانت‌اند:** همهٔ فراخوانی‌های شبکه فقط از `frontend/src/api/client.ts`؛ توکن دسترسی فقط در حافظهٔ RAM؛ RTL با CSS logical properties.

## ۷. نمای API (پیشوند `/api/v1`)

| Method | Path | Auth | Method | Path | Auth |
|---|---|---|---|---|---|
| GET | `/health` | عمومی | GET/DELETE | `/cart` | کاربر |
| POST | `/auth/otp/request` | عمومی | POST | `/cart/items` | کاربر |
| POST | `/auth/otp/verify` | عمومی | PATCH/DELETE | `/cart/items/:id` | کاربر |
| POST | `/auth/refresh` | عمومی | POST | `/coupons/validate` | کاربر |
| POST | `/auth/logout` | کاربر | POST/GET | `/orders` | کاربر |
| GET/PATCH | `/users/me` | کاربر | GET | `/orders/:id` | کاربر |
| GET/POST | `/addresses` | کاربر | POST | `/orders/:id/cancel` | کاربر |
| PATCH/DELETE | `/addresses/:id` | کاربر | POST | `/payments/start` | کاربر |
| PATCH | `/addresses/:id/default` | کاربر | GET | `/payments/callback` | عمومی |
| POST | `/upload/image` | کاربر | GET | `/medicines`, `/medicines/:id` | عمومی |
| GET | `/pet-types`, `/pet-types/:id/breeds`, `/tags` | عمومی | GET | `/pharmacies`, `/pharmacies/:id` | عمومی |
| GET/POST | `/pets` | کاربر | GET | `/clinics`, `/clinics/:id` | عمومی |
| GET/PATCH/DELETE | `/pets/:id` | کاربر | GET | `/brands`, `/categories` | عمومی |
| PUT | `/pets/:id/tags` | کاربر | GET | `/products`, `/products/:slug` | عمومی |
| GET | `/favorites` | کاربر | GET | `/products/recommendations` | کاربر |
| PUT/DELETE | `/favorites/:productId` | کاربر | | | |

قراردادهای کامل پاسخ، قواعد کسب‌وکار (تسویهٔ سفارش، کوپن، پرداخت، پیشنهاد) و مدل دامنه در [`backend/README.md`](backend/README.md) آمده است.

## ۸. مسیر توسعه

> وضعیت‌ها بر اساس آخرین بازبینی (۲۰۲۶-۰۹-۲۷) ثبت شده‌اند. نمادها: ✅ پیاده‌سازی‌شده · 🚧 در جریان (پذیرش نهایی باز) · ⬜ در صف.

### ۸.۱ بک‌اند — فازهای ۰ تا ۱۵ (MVP v1)

| فاز | عنوان | وضعیت |
|---|---|---|
| 0 | Bootstrap (NestJS، Docker، اعتبارسنجی env) | ✅ |
| 1 | زیرساخت و کد مشترک (Prisma، Redis، Guardها، Filterها) | ✅ |
| 2 | احراز هویت (OTP + JWT) | ✅ |
| 3 | کاربران و آدرس‌ها | ✅ |
| 4 | آپلود و داده‌های مرجع (pet-types، breeds، tags) | ✅ |
| 5 | پت‌ها | ✅ |
| 6 | کاتالوگ (برند، دسته، محصول و واریانت‌ها) | ✅ |
| 7 | پیشنهاد محصول | ✅ |
| 8 | علاقه‌مندی‌ها | ✅ |
| 9 | سبد خرید | ✅ |
| 10 | کوپن‌ها | ✅ |
| 11 | سفارش و تسویه | ✅ |
| 12 | پرداخت (Zarinpal + mock) | ✅ |
| 13 | دارو و داروخانه (فقط اطلاع‌رسانی) | ✅ |
| 14 | Seed و ابزار ادمین | ✅ |
| 15 | Hardening و تحویل (Dockerfile، تست E2E) | ✅ |
| + | ماژول کلینیک‌ها (اضافه‌شده پس از MVP) | ✅ |

همهٔ فازها پیاده‌سازی شده‌اند؛ **پذیرش زنده (Live acceptance) و رفع باگ‌های ثبت‌شده در Issues باز است** — به «گام‌های بعدی» مراجعه کنید.

### ۸.۲ فرانت‌اند — فازهای F0 تا F11

| فاز | عنوان | وضعیت |
|---|---|---|
| F0 | Bootstrap و بنیادها (Vite، مسیرها، API client) | 🚧 |
| F1 | سیستم طراحی و شِل برنامه (هدر، فوتر، ناوبری موبایل) | 🚧 |
| F2 | احراز هویت و نشست (OTP، refresh، خروج) | 🚧 |
| F3 | پروفایل و آدرس‌ها | 🚧 |
| F4 | پت‌ها | ⬜ |
| F5 | کاتالوگ (خانه، لیست، جزئیات) | 🚧 |
| F6 | پیشنهادها | ⬜ |
| F7 | علاقه‌مندی‌ها | ⬜ |
| F8 | سبد خرید و کوپن‌ها | ⬜ |
| F9 | تسویه، پرداخت و سفارش‌ها | ⬜ |
| F10 | دارو، داروخانه و کلینیک‌ها (فقط اطلاع‌رسانی) | 🚧 |
| F11 | کیفیت، کارایی و تحویل | ⬜ |

فازهای 🚧 کد قابل استفاده دارند اما پذیرش نهایی‌شان (به‌ویژه با بک‌اند زنده) تأیید نشده است. مسیرهای اصلی (خانه، محصولات، دارو، داروخانه، کلینیک، ورود، سبد مهمان) قابل پیش‌نمایش محلی هستند.

### ۸.۳ گام‌های بعدی (اولویت‌دار)

1. **راه‌اندازی بک‌اند زنده** و اجرای پذیرش دستی [`backend/docs/TEST_CHECKLIST.md`](backend/docs/TEST_CHECKLIST.md) + تست‌های E2E.
2. **رفع ایسیوهای باز** ([#3](https://github.com/MohammadAky/Dr.Gupet/issues/3) تا [#6](https://github.com/MohammadAky/Dr.Gupet/issues/6)): ناهماهنگی هویت JWT، فیلتر تگ محصول، پارس `is24h`، خواندن رکوردهای غیرفعال کلینیک در ادمین.
3. **تکمیل فازهای فرانت‌اند:** F4 و F6–F9 و F11 از صفر؛ بستن پذیرش F0–F3، F5 و F10 با شاهد (تست زنده + بازبینی مالک).
4. **دسترس‌پذیری:** بازبینی کامل صفحه‌خوان، زوم ۲۰۰٪، reduced-motion و کنتراست (تکمیل F1/F11).
5. **آماده‌سازی انتشار عمومی:** افشای حریم خصوصی پایدار (هویت اپراتور، کوکی‌های backend/درگاه پرداخت، مدت نگهداری، حقوق کاربر)، تأیید حق انتشار لوگو، محیط استقرار و CORS/callback واقعی.

### ۸.۴ بعد از MVP (آینده)

پنل ادمین اختصاصی · دامپزشک/کلینیک/نوبت‌دهی · پرونده پزشکی و واکسیناسیون · نسخه · پنل داروخانه با موجودی و قیمت · پانسیون · سرپرستی و مربی · گفتگو · نظرات و گزارش · بلاگ · اشتراک · بازگشت وجه. معماری فعلی (`role` روی `User` و کلید `userId`) افزودن این ماژول‌ها را بدون بازنویسی ممکن می‌کند.

## ۹. مستندات

| فایل | موضوع |
|---|---|
| [`backend/README.md`](backend/README.md) | مرجع فنی بک‌اند: قراردادها، مدل دامنه، قواعد کسب‌وکار، متغیرهای محیطی |
| [`backend/docs/CHANGELOG.md`](backend/docs/CHANGELOG.md) | تاریخچهٔ تغییرات فازهای بک‌اند |
| [`backend/docs/TEST_CHECKLIST.md`](backend/docs/TEST_CHECKLIST.md) | چک‌لیست تست دستی و پذیرش API |
| [`backend/docs/SCHEMA_CHANGE_REQUESTS.md`](backend/docs/SCHEMA_CHANGE_REQUESTS.md) | ثبت درخواست‌های تغییر اسکیمای دیتابیس |
| [`frontend/README.md`](frontend/README.md) | راهنمای اجرا، بررسی و نکات فرانت‌اند |
| [`frontend/docs/DECISIONS.md`](frontend/docs/DECISIONS.md) | تصمیم‌های فنی پذیرفته‌شده (DEC-001 تا DEC-015) |
| [`frontend/docs/DESIGN_SYSTEM.md`](frontend/docs/DESIGN_SYSTEM.md) | سیستم طراحی، برند و اثبات منبع دارایی‌ها |
| [`AGENTS.md`](AGENTS.md) | قواعد همکاری برای ایجنت‌های هوش مصنوعی |

## ۱۰. واژه‌نامه (فارسی ↔ انگلیسی)

| فارسی | English | یادداشت |
|---|---|---|
| پت / حیوان خانگی | Pet | |
| نوع پت | PetType | سگ، گربه |
| نژاد | Breed | اختیاری روی پت |
| غذای خشک | Dry food | محصول اصلی MVP |
| واریانت / وزن محصول | ProductVariant | یک ردیف برای هر وزن |
| برچسب آلرژن | ALLERGEN tag | ماده‌ای که پت ممکن است حساسیت داشته باشد |
| برچسب رژیمی | DIET tag | بدون غله، کنترل وزن و … |
| عقیم | Neutered/spayed | `isNeutered` |
| مرحله زندگی | LifeStage | توله/بچه‌گربه، بالغ، مسن |
| کد تخفیف | Coupon | |
| سبد خرید | Cart | |
| سفارش | Order | |
| درگاه پرداخت | Payment gateway | Zarinpal در MVP |
| داروخانه | Pharmacy | فقط اطلاع‌رسانی در MVP |
| دارو | Medicine | فقط اطلاع‌رسانی در MVP |
| کلینیک | Clinic | فهرست عمومی |

## ۱۱. مجوز و حقوق

- کد این مخزن مالکیت [MohammadAky](https://github.com/MohammadAky) است (`UNLICENSED` مگر ذکر خلاف).
- فونت وزیرمتن با مجوز SIL OFL 1.1 توزیع می‌شود (متن مجوز در `frontend/public/licenses/Vazirmatn-OFL.txt`).
- تصاویر پرترهٔ سگ و گربه عکس‌های استوک Unsplash (اثر Victor G و EJ Li) با مجوز Unsplash هستند و مالکیت انحصاری Dr. Gupet محسوب نمی‌شوند.
- فهرست کامل منبع و مجوز دارایی‌ها در [`frontend/docs/DESIGN_SYSTEM.md`](frontend/docs/DESIGN_SYSTEM.md) نگهداری می‌شود.
