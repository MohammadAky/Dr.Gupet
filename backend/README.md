# بک‌اند Dr. Gupet — مرجع فنی (MVP v1)

مرجع قراردادهای API، مدل دامنه و قواعد کسب‌وکار بک‌اند. نقشهٔ راه کل پروژه و راه‌اندازی سریع در [`README.md`](../README.md) ریشه است. وضعیت فازها: **پیاده‌سازی فازهای ۰ تا ۱۵ کامل شده است**؛ پذیرش زنده و رفع ایسیوهای باز در دست اقدام است.

---

## ۱. راه‌اندازی

```bash
docker compose up -d           # MySQL 8 + Redis 7 + بک‌اند
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate         # MySQL (مهاجرت‌های committed در prisma/migrations)
npm run prisma:seed            # seed idempotent (upsert با slug/فیلدهای یکتا)
npm run start:dev              # http://localhost:3000/api/v1
```

- Swagger در محیط توسعه: `http://localhost:3000/docs` (در production غیرفعال است).
- اسکریپت‌ها: `build`، `start`، `start:dev`، `start:prod`، `lint`، `test`، `test:e2e`، `prisma:generate`، `prisma:migrate`، `prisma:seed`، `prisma:studio`.

## ۲. ساختار کد

```text
backend/
├── prisma/
│   ├── schema.prisma          # مرجع مدل دامنه (تغییر فقط با ثبت درخواست — بخش ۸)
│   ├── seed.ts                # seed idempotent
│   └── migrations/
├── src/
│   ├── main.ts                # bootstrap (prefix /api/v1، ValidationPipe، Swagger، helmet)
│   ├── app.module.ts
│   ├── config/                # app, jwt, redis, sms, payment + env.validation.ts
│   ├── common/
│   │   ├── decorators/        # @CurrentUser, @Roles, @Public
│   │   ├── guards/            # JwtAuthGuard (سراسری), RolesGuard
│   │   ├── filters/           # AllExceptionsFilter, PrismaExceptionFilter
│   │   ├── interceptors/      # TransformResponseInterceptor
│   │   ├── dto/               # PaginationQueryDto, PaginatedResponseDto
│   │   ├── utils/             # money, slugify, order-number, phone, normalize-fa
│   │   ├── constants/         # ثابت‌های کسب‌وکار
│   │   └── interfaces/        # JwtPayload
│   ├── prisma/                # PrismaService (تنها راه ارتباط با دیتابیس)
│   ├── redis/                 # RedisService (OTP، refresh token، کش)
│   ├── sms/                   # ماژول عمومی پیامک: SmsService + درایورها (console | sms.ir)
│   ├── upload/                # آپلود تصویر
│   ├── health/                # GET /health
│   ├── admin/                 # ابزار ادمین (فاز ۱۴)
│   └── modules/               # auth, users, addresses, pet-types, breeds, pets, tags,
│                              # brands, categories, products, favorites, cart, coupons,
│                              # orders, payments, medicines, pharmacies, clinics, ...
└── test/                      # تست‌های E2E
```

هر ماژول: `<name>.module.ts`، `<name>.controller.ts`، `<name>.service.ts` و پوشهٔ `dto/`. کنترلرها نازک‌اند (ورودی → فراخوانی یک متد سرویس → خروجی)؛ همهٔ منطق کسب‌وکار در سرویس‌هاست.

## ۳. قراردادهای سراسری API

### ۳.۱ پایه

- پیشوند سراسری: `/api/v1`. نام منابع جمع و kebab-case: `/pet-types`، `/cart/items`.
- تاریخ‌ها رشته‌های ISO-8601 UTC؛ تبدیل جلالی وظیفهٔ فرانت‌اند است.
- Auth: `Authorization: Bearer <accessToken>`. **همهٔ مسیرها به‌صورت پیش‌فرض نیازمند احراز هویت‌اند** (JwtAuthGuard سراسری)؛ مسیرهای عمومی با `@Public()`.
- **نشست و خروج (issue #11):** `POST /auth/logout` فقط نشست refresh (خانوادهٔ توکن در Redis) را باطل می‌کند؛ access token صادرشده تا سررسید طبیعی خود (پیش‌فرض ≤ ۱۵ دقیقه، `JWT_ACCESS_TTL`) معتبر می‌ماند. حساب‌های `BLOCKED`/حذف‌نشانی‌شده در **هر درخواست** با ۴۰۱ رد می‌شوند (بررسی در JWT strategy). همگام‌سازی خروج بین تب‌های باز مرورگر (BroadcastChannel/storage event) بر عهدهٔ فرانت‌اند است — بک‌اند فقط نشست refresh را می‌بندد.
- **نرخ محدودسازی:** سراسری ۱۰۰ درخواست/دقیقه؛ `otp/request` و `otp/verify` و `upload/image` هر کدام ۱۰/دقیقه (`@Throttle`). افزودن `TRUST_PROXY` هنگام قرارگیری پشت reverse proxy برای IP درست کلاینت.

### ۳.۲ پوشش پاسخ

موفق:

```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }
```

(`meta` فقط برای لیست‌های صفحه‌بندی‌شده.)

خطا:

```json
{ "success": false, "statusCode": 400, "code": "VALIDATION_ERROR", "message": "اطلاعات ارسالی معتبر نیست", "details": [ { "field": "phone", "message": "..." } ] }
```

پیاده‌سازی با `TransformResponseInterceptor` (موفق) و `AllExceptionsFilter` + `PrismaExceptionFilter` (خطا؛ نگاشت Prisma `P2002` → 409 `CONFLICT`، `P2025` → 404 `NOT_FOUND`).

### ۳.۳ کدهای خطا

`VALIDATION_ERROR`، `UNAUTHORIZED`، `FORBIDDEN`، `NOT_FOUND`، `CONFLICT`، `LIMIT_REACHED`، `OTP_INVALID`، `OTP_EXPIRED`، `OTP_RATE_LIMITED`، `USER_BLOCKED`، `VARIANT_UNAVAILABLE`، `OUT_OF_STOCK`، `CART_EMPTY`، `COUPON_INVALID`، `COUPON_EXPIRED`، `COUPON_LIMIT_REACHED`، `COUPON_MIN_AMOUNT`، `ORDER_INVALID_STATE`، `PAYMENT_FAILED`، `INTERNAL_ERROR`.

کمک‌کنندهٔ `AppException(code, message, statusCode)` در `common/` را به‌جای `HttpException` خام استفاده کنید.

### ۳.۴ صفحه‌بندی و اعتبارسنجی

- `PaginationQueryDto`: `page` (پیش‌فرض 1)، `limit` (پیش‌فرض 20، حداکثر 50). `skip = (page-1)*limit`؛ `count` و `findMany` را موازی (`Promise.all`) اجرا کنید.
- ValidationPipe سراسری: `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`. هر فیلد DTO دکوراتور `class-validator` و `@ApiProperty` دارد.

### ۳.۵ متن فارسی و شماره موبایل

- `phone.util.ts`: نرمال‌سازی به `09XXXXXXXXX`. ارقام فارسی/عربی (`۰-۹`، `٠-٩`)، پیشوندهای `+98`، `0098`، `98`، شمارهٔ بدون صفر (`9121234567`) و فاصله/خط تیره پذیرفته می‌شوند؛ اعتبارسنجی با `/^09\d{9}$/`. **این تابع تنها مرجع نرمال‌سازی شماره است** — DTOهای auth (با `@Transform`)، `users.createByAdmin` و درایور sms.ir همگی از همین تابع استفاده می‌کنند.
- در جستجو و ذخیرهٔ نام‌ها حروف عربی نرمال شود: `ي → ی`، `ك → ک`، حذف کاراکترهای zero-width و tatweel (`normalizeFa()`).
- `slugify.util.ts`: حروف فارسی حفظ می‌شوند؛ whitespace → `-`؛ حروف لاتین small؛ slugها ذخیره‌شده، یکتا و بدون بازتولید پس از ایجاد.

### ۳.۶ پول و نام‌گذاری

- واحد پول **تومان**، ذخیره به‌صورت `Int`. `money.util.ts` فقط برای لایهٔ درگاه پرداخت (`tomanToRial`/`rialToToman`).
- فایل‌ها `kebab-case.ts`، کلاس‌ها `PascalCase`، DTOها با پسوند `Dto`؛ enumها از `@prisma/client`.

## ۴. مدل دامنه (خلاصه)

مرجع اصلی `prisma/schema.prisma` است. نقشهٔ سریع روابط:

```text
User 1─* Address
User 1─* Pet ──* PetTag *──1 Tag(type: ALLERGEN | DIET)
Pet *─1 PetType ; Pet *─0..1 Breed ; Breed *─1 PetType
User 1─1 Cart 1─* CartItem *─1 ProductVariant
User 1─* Favorite *─1 Product
Brand 1─* Product *─1 ProductCategory ; Product *─1 PetType
Product 1─* ProductVariant   (هر وزن: price, compareAtPrice, stock, sku)
Product 1─* ProductImage
Product *─* Tag via ProductTag(kind: CONTAINS | SUITABLE_FOR)
User 1─* Order 1─* OrderItem *─1 ProductVariant   (OrderItem اسنپ‌شات است)
Order 1─* Payment
Order 0..1─1 CouponRedemption *─1 Coupon
Medicine *─* PetType ; Medicine *─* Pharmacy via PharmacyMedicine(note, lastConfirmedAt)
Clinic   (کلینیک‌ها — فهرست عمومی)
```

تصمیم‌های مدل («بهبود» نکنید):

- **Product vs ProductVariant:** نام، برند، دسته، مرحلهٔ زندگی و… روی `Product`؛ **وزن، قیمت، موجودی و SKU روی `ProductVariant`**. سبد و سفارش به واریانت ارجاع می‌دهند.
- **تگ‌ها:** یک جدول `Tag` با `type`. روی محصول، `CONTAINS` فقط برای `ALLERGEN` و `SUITABLE_FOR` فقط برای `DIET` معتبر است — در لایهٔ سرویس اجرا می‌شود، نه دیتابیس.
- **سبد هرگز قیمت ذخیره نمی‌کند؛** مبالغ از قیمت فعلی واریانت محاسبه می‌شوند.
- **`OrderItem` و `Order.addressSnapshot` اسنپ‌شات‌اند؛** ویرایش بعدی محصول/آدرس نباید سفارش‌های گذشته را تغییر دهد.
- **داروخانه ↔ دارو بدون قیمت و موجودی؛** فقط «این داروخانه این دارو را دارد» + `lastConfirmedAt`.

## ۵. محیط اجرایی

متغیرها را `env.validation.ts` در startup اعتبارسنجی می‌کند (خطای سریع در صورت نبود/نامعتبری). نمونهٔ کامل: `backend/.env.example` — مهم‌ترین‌ها:

```dotenv
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:5173
DATABASE_URL="mysql://pet:pet@localhost:3306/pet_db"   # MySQL 8 (utf8mb4)
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=...            # هرگز در مخزن
JWT_REFRESH_SECRET=...
OTP_TTL_SECONDS=120
OTP_DEV_CODE=12345               # فقط وقتی NODE_ENV != production
SMS_DRIVER=console               # console | smsir
SMS_API_KEY=                     # کلید وب‌سرویس sms.ir (Sandbox یا Production)
SMS_IR_TEMPLATE_ID=              # templateId قالب OTP (در Sandbox: 123456)
SMS_IR_PARAM_NAME=Code           # نام پارامتر قالب بدون #
SMS_IR_BASE_URL=https://api.sms.ir/v1
SMS_IR_LINE_NUMBER=              # خط ارسال bulk (اطلاع‌رسانی پرداخت) از GET /v1/line
PAYMENT_DRIVER=mock              # mock | zarinpal
PAYMENT_CALLBACK_URL=http://localhost:3000/api/v1/payments/callback
FRONTEND_PAYMENT_RESULT_URL=http://localhost:5173/payment/result
UPLOAD_DIR=./uploads
SHIPPING_FLAT_COST=50000
FREE_SHIPPING_THRESHOLD=1500000
ORDER_EXPIRE_MINUTES=30
ADMIN_SEED_PHONE=09120000000
```

`docker compose` سرویس‌های `mysql:8.4` (db/user/password: `pet_db`/`pet`/`pet`)، `redis:7` و بک‌اند را بالا می‌آورد. دیتابیس **MySQL 8** است (charset `utf8mb4` با collation `utf8mb4_unicode_ci` برای جستجوی بدون حساسیت به حروف)؛ داده در volume `mysql_data` و فایل‌های آپلودی در `./uploads` نگهداری می‌شوند. مهاجرت‌ها با `prisma migrate deploy` روی هر بوت اعمال می‌شوند. نکته‌های MySQL در کد رعایت شده: فیلدهای متنی بلند `@db.Text` هستند و queryها از `mode: 'insensitive'` (مخصوص PostgreSQL) استفاده نمی‌کنند — حساسیت به حروف با collation سی‌آی خودِ MySQL اداره می‌شود.

## ۶. قواعد کسب‌وکار

### ۶.۱ الگوریتم تسویهٔ سفارش (`POST /orders`)

از مرحلهٔ ۳ تا ۹ در **یک تراکنش Prisma** اجرا می‌شود:

1. سبد کاربر با اقلام → واریانت‌ها → محصولات؛ خالی → `CART_EMPTY`.
2. آدرس باید متعلق به کاربر باشد (وگرنه 404)؛ ساخت `addressSnapshot`.
3. هر واریانت و محصول باید فعال باشد (`VARIANT_UNAVAILABLE`).
4. `itemsTotal = Σ قیمت واریانت × تعداد` (سمت سرور).
5. در صورت وجود `couponCode`: اجرای `CouponsService.evaluate(...)`.
6. `shippingCost = itemsTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_COST` (بر مبنای `itemsTotal` قبل از تخفیف — در کد یکسان نگه دارید).
7. `finalAmount = itemsTotal − discountAmount + shippingCost` (هرگز منفی نشود).
8. **کسر اتمیک موجودی** با `OrderStockService.reserve(tx, items)`:
   `updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` — اگر `count === 0` → `OUT_OF_STOCK` (rollback).
9. ایجاد `Order` (`status = PENDING_PAYMENT`، شمارهٔ سفارش تولیدی)، ردیف‌های `OrderItem` (اسنپ‌شات)، `CouponRedemption` و سپس خالی‌کردن سبد.

`OrderStockService.release(tx, orderItems)` برای برگشت موجودی در لغو/انقضا استفاده می‌شود.

### ۶.۲ جریان وضعیت سفارش

```text
PENDING_PAYMENT ──پرداخت موفق──▶ PAID ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED
      │                            │
   لغو/انقضا                    (فقط ادمین؛ بازگشت وجه خارج از سیستم در MVP)
      ▼
   CANCELED
```

- کاربر فقط سفارش `PENDING_PAYMENT` را لغو می‌کند؛ تغییرات بعد از `PAID` با ابزار ادمین است.
- هر تغییر وضعیت از یک helper واحد (`ORDER_INVALID_STATE` برای جهش غیرمجاز) عبور می‌کند.

### ۶.۳ قواعد کوپن (به این ترتیب)

1. ناموجود/غیرفعال → `COUPON_INVALID` · ۲. خارج از بازهٔ زمانی → `COUPON_EXPIRED` · ۳. `itemsTotal < minOrderAmount` → `COUPON_MIN_AMOUNT` · ۴. سقف کل → `COUPON_LIMIT_REACHED` · ۵. سقف هر کاربر → `COUPON_LIMIT_REACHED`.

تخفیف: `PERCENT` → `Math.floor(itemsTotal × value / 100)` با سقف `maxDiscount`؛ `FIXED` → `value`؛ در نهایت `discountAmount = min(discount, itemsTotal)`. بررسی سقف‌ها داخل تراکنش انجام می‌شود.

### ۶.۴ جریان پرداخت

1. `POST /payments/start`: سفارش متعلق به کاربر و `PENDING_PAYMENT`؛ ایجاد `Payment(INITIATED)`، فراخوانی `gateway.request(...)`، ذخیرهٔ `gatewayRef`، خروجی `{ paymentUrl }`.
2. کاربر در درگاه پرداخت می‌کند → بازگشت به `GET /payments/callback`.
3. Callback با `gatewayRef` پرداخت را پیدا می‌کند؛ **idempotent:** اگر `SUCCESS` است فقط دوباره redirect کن.
4. شکست/لغو درگاه → `FAILED`؛ سفارش `PENDING_PAYMENT` می‌ماند (قابل تلاش مجدد تا انقضا).
5. موفقیت → فراخوانی `gateway.verify(...)` (server-to-server)؛ فقط در صورت موفقیت verify، در یک تراکنش: `Payment.status = SUCCESS`، `paidAt`، `Order.status = PAID`. مبلغ verify باید برابر `order.finalAmount` باشد.
6. Redirect به `FRONTEND_PAYMENT_RESULT_URL?orderNumber=...&status=success|failed`.
7. SMS «سفارش ثبت شد» اختیاری است و هرگز نباید جریان پرداخت را بشکند.

**هرگز** سفارش را فقط بر اساس query string کال‌بک پرداخت‌شده اعلام نکنید.

### ۶.۵ الگوریتم پیشنهاد محصول

ورودی: یک پت متعلق به کاربر.

- **lifeStage** از `birthDate`: `< 12 ماه → PUPPY_KITTEN`، `≥ 84 ماه → SENIOR`، وگرنه `ADULT`؛ بدون تولد → بدون فیلتر.
- **sizeClass** (فقط سگ، از `weightKg`): `< 10 → SMALL`، `10–25 → MEDIUM`، `> 25 → LARGE`؛ بدون وزن/غیرسگ → بدون فیلتر.

فیلتر: محصول فعال با حداقل یک واریانت موجودِ فعال، هم‌نوع پت، `lifeStage IN (محاسبه‌شده, ALL)`، `sizeClass IN (محاسبه‌شده, ALL)`، اگر پت عقیم نیست `neuterSuitability = ANY` (وگرنه `ANY یا NEUTERED_ONLY`)، و **هیچ تگ `CONTAINS` که با آلرژن‌های پت تداخل دارد**.

رتبه‌بندی: تعداد تگ‌های `DIET` منطبق (`SUITABLE_FOR`) نزولی، سپس جدیدترین. خروجی `matchedTags`. این قواعد heuristic هستند، نه توصیهٔ دامپزشکی.

### ۶.۶ ثابت‌ها (`common/constants/index.ts`)

`MAX_ADDRESSES_PER_USER = 10`، `MAX_PETS_PER_USER = 10`، `MAX_CART_ITEM_QTY = 20`، `LOW_STOCK_THRESHOLD = 5`، `PUPPY_KITTEN_MAX_MONTHS = 12`، `SENIOR_MIN_MONTHS = 84`، `DOG_SMALL_MAX_KG = 10`، `DOG_MEDIUM_MAX_KG = 25`، `DEFAULT_PAGE_LIMIT = 20`، `MAX_PAGE_LIMIT = 50`، `MEDICINE_DISCLAIMER`.

### ۶.۷ معماری OTP و SMS

**مرز مسئولیت:** `OtpService` (`modules/auth/otp/`) فقط سیاست کد است — تولید، هش، تایید یک‌بارمصرف، سقف‌ها؛ هرگز با SMS کار نمی‌کند. `SmsService` (`src/sms/`) فقط تحویل پیام است — facade بی‌طرف از ارائه‌دهنده با درایورهای `console`/`smsir`. پرداخت و auth هر دو فقط `SmsService` صدا می‌زنند.

**سیاست نرخ (لایه‌های مستقل):**

| لایه | محدوده | مقدار |
|---|---|---|
| `ThrottlerGuard` سراسری | هر IP | ۱۰۰ درخواست/دقیقه |
| `@Throttle` مسیرهای `otp/*` و `upload/image` | هر IP | ۱۰/دقیقه |
| cooldown ارسال (`SET NX` اتمیک — `otp:cooldown:{phone}`) | هر شماره | `OTP_RESEND_COOLDOWN_SECONDS` |
| سقف درخواست ساعتی (`otp:count:{phone}`) | هر شماره | `OTP_MAX_PER_HOUR` در ساعت |
| سقف تلاش تایید (`otp:attempts:{phone}`) | هر کد | `OTP_MAX_VERIFY_ATTEMPTS` |

**کلیدهای Redis** در `modules/auth/otp/otp.constants.ts` متمرکزند؛ کد فقط به‌صورت HMAC ذخیره می‌شود با **`OTP_HASH_SECRET`** (جدا از secret توکن‌ها؛ در production الزامی — چرخش JWT هرگز OTP جاری را نامعتبر نمی‌کند). مصرف کد با `DEL` اتمیک است: دقیقاً یکی از درخواست‌های همزمان برنده می‌شود؛ شکست ارسال پیامک، کد و cooldown را دور می‌ریزد (سقف ساعتی برای ضدسوءاستفاده می‌ماند).

**لاگ تحویل:** هر ارسال (OTP/اعلان) در جدول `SmsLog` با وضعیت `SENT`/`FAILED`، `messageId` پیام‌رسان و خلاصهٔ خطای امن ثبت می‌شود؛ پیگیری «کد نرسید» از `GET /admin/sms/logs` (فیلتر phone/kind/status). سیاست اعلان: `SMS_NOTIFY_PAYMENT_SUCCESS=false` پیامک موفقیت پرداخت را خاموش می‌کند.

## ۷. استراتژی تست

- **تست واحد (Jest):** OtpService (هش، سقف‌ها، discard، همزمانی cooldown/verify)، جریان `requestOtp` (شکست ارسال باید OTP را دور بریزد)، انتخاب درایور `SmsService` + لاگ `SmsLog`، درایور sms.ir (payload/ retry/ خطاها با mock)، سخت‌سازی callback پرداخت (امضا/Status/race)، cancel/expire اتمیک سفارش، سهمیهٔ آپلود، `POST /admin/users`، خنثی‌سازی CSV، جستجوهای admin/public، CouponsService، OrderStockService، سبد خرید/پت/آدرس/علاقه‌مندی، ابزارهای `phone`/`slugify`/`normalizeFa`.
- **تست E2E (Supertest):** با MySQL (دیتابیس تستی اختصاصی) + Redis واقعی (docker compose)؛ `PAYMENT_DRIVER=mock` و `SMS_DRIVER=console`.
- سناریوهای حتمی: جریان کامل خرید؛ جداسازی مالکیت بین دو کاربر؛ همزمانی آخرین موجودی؛ سقف‌های کوپن؛ idempotency کال‌بک پرداخت؛ دسترسی غیرمجاز/مسدود.
- چک‌لیست تست دستی و پذیرش: [`docs/TEST_CHECKLIST.md`](docs/TEST_CHECKLIST.md).

## ۸. API پنل ادمین

همهٔ مسیرهای زیر پیشوند `admin/` دارند، فقط با نقش `ADMIN` (Guard سراسری + `@Roles('ADMIN')`) در دسترس‌اند و هر تغییر در `AdminAuditLog` ثبت می‌شود. جزئیات در Swagger (تگ‌های `Admin - *`).

| گروه | مسیرها |
|---|---|
| هسته | `GET /admin/me`، `GET /admin/dashboard` (KPI/نمودار/سفارش‌های اخیر/پرفروش‌ها) |
| گزارش‌ها | `GET /admin/reports/{sales, top-products, low-stock, users, coupons}` + نسخه‌های `.csv` |
| منطقه زمانی | پارامتر `tz` (نام IANA، پیش‌فرض `Asia/Tehran`) در dashboard و گزارش‌ها — باکت‌های روزانه (`YYYY-MM-DD`) روزهای تقویمی همان منطقه‌اند، نه روزهای UTC (issue #8) |
| تنظیمات | `GET /admin/settings`، `PUT /admin/settings`، `DELETE /admin/settings/:key` (کلیدهای مجاز: `SHIPPING_FLAT_COST`، `FREE_SHIPPING_THRESHOLD`، `ORDER_EXPIRE_MINUTES` — مقدار جدول بر env مقدم است) |
| لاگ تغییرات | `GET /admin/audit-logs` (فیلتر entity/action/adminId) |
| کاربران | `GET/POST/PATCH/DELETE /admin/users...` + `PATCH /admin/users/:id/restore` (جستجو، نقش/وضعیت، حذف نرم) |
| کاتالوگ | `admin/products` (+ `:id/variants`، `variants/:id`، `:id/images`، `images/:id`، `:id/tags`)، `admin/brands`، `admin/categories`، `admin/pet-types`، `admin/breeds`، `admin/tags` |
| سفارش‌ها | `GET/PATCH /admin/orders...` — `:id/transition` (PAID→PROCESSING→SHIPPED→DELIVERED)، `:id/tracking`، `:id/cancel` (برگشت موجودی)، `:id/refund` (نشانه‌گذاری استرداد) — ساخت سفارش فقط از `POST /orders` (کاربر) است؛ `POST /admin/orders` وجود ندارد |
| پرداخت‌ها | `GET /admin/payments...` — `:id/reconcile` (verify مجدد درگاه)، `:id/mark-failed` |
| کوپن‌ها | CRUD `/admin/coupons` + آمار مصرف (حذف کوپن استفاده‌شده → غیرفعال‌سازی) |
| دارو/داروخانه | CRUD `/admin/medicines`، CRUD `/admin/pharmacies` + `POST/DELETE /admin/pharmacies/:id/medicines/:medicineId` |
| کلینیک‌ها | CRUD `/admin/clinics` (لیست کامل شامل غیرفعال) |

نکته‌های رفتاری: حذف محصول/واریانت/برند/دسته‌ای که در سفارش یا محتوا استفاده شده، به‌جای حذف فیزیکی، غیرفعال‌سازی برمی‌گرداند؛ `minPrice` محصول پس از هر تغییر واریانت بازمحاسبه می‌شود؛ تگ‌های `CONTAINS` فقط ALLERGEN و `SUITABLE_FOR` فقط DIET پذیرفته می‌شوند.

---

## ۹. تله‌های رایج (پیش از پایان هر تغییر)

- [ ] محاسبهٔ پول با float یا اعتماد به body درخواست.
- [ ] نبود `userId` در `where` داده‌های کاربری.
- [ ] نبود `deletedAt: null` در کوئری‌های `User`/`Pet`.
- [ ] کسر موجودی با read-then-write به‌جای `updateMany` شرطی.
- [ ] پرداخت‌شدن سفارش بدون `verify` سمت سرور.
- [ ] نشت اعداد `stock` یا واریانت‌های غیرفعال در پاسخ عمومی.
- [ ] ثبت `GET /products/recommendations` بعد از `GET /products/:slug` (باید قبلش باشد).
- [ ] جستجوی نادیده‌گرفتن تفاوت `ي/ی` و `ك/ک` یا ارقام فارسی در شماره موبایل.
- [ ] ذخیرهٔ OTP به‌صورت plain text یا فعال‌بودن `OTP_DEV_CODE` در production.
- [ ] منطق کسب‌وکار داخل کنترلر؛ برگرداندن خطای خام Prisma به کلاینت.
- [ ] لیست‌های بدون سقف `limit` یا کوئری‌های N+1.
- [ ] کتابخانه/تغییر اسکیمای جدید بدون ثبت تصمیم.

## ۱۰. تغییر اسکیما

`prisma/schema.prisma` را بدون درخواست ثبت‌شده تغییر ندهید. هر نیاز، ابتدا در [`docs/SCHEMA_CHANGE_REQUESTS.md`](docs/SCHEMA_CHANGE_REQUESTS.md) (چه، چرا، تأثیر) ثبت و سپس ادامه داده می‌شود. وابستگی‌ها با `npm install <name>` (بدون شمارهٔ نسخه) و commit کردن lockfile نصب می‌شوند.

## ۱۱. تاریخچه

تغییرات فاز به فاز: [`docs/CHANGELOG.md`](docs/CHANGELOG.md). واژه‌نامهٔ فارسی/انگلیسی و جدول کامل مسیرهای API در [`README.md`](../README.md) ریشه.
