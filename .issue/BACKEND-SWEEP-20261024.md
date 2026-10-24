# بازبینی و اصلاح کامل بک‌اند — ۲۴ اکتبر ۲۰۲۶

**شاخه:** `arena/13f97420-dr-gupet` (بدون کامیت/پوش/استقرار)
**دامنه:** همهٔ پرونده‌های `.issue/01-…38-…md`، با اولویت کد بک‌اند (`backend/`).

## خلاصه

| دسته | پرونده‌ها |
| --- | --- |
| در همین بازبینی پیاده و آزمون شد | **۱۹، ۲۴، ۳۵، ۳۷، ۳۸** (+ تایپ‌کردن بدنهٔ `POST/PATCH /admin/users` و تأیید ۱۰/۱۴) |
| در همین شاخه پیش‌تر (بدون کامیت) اصلاح و آزمون شده بود | **۱۶، ۱۷، ۲۲، ۲۳، ۲۷، ۳۶** |
| از قبل در source اصلاح شده بود؛ این بازبینی تأیید کرد | **۰۱، ۰۲، ۰۳، ۰۵، ۰۷، ۰۸، ۰۹، ۱۸، ۲۰، ۲۱، ۲۵، ۲۸، ۲۹، ۳۰، ۳۱** |
| نیاز به تصمیم محصول/محتوا یا قرارداد تازه (بدون تغییر کد عمدی) | **۱۱، ۱۲، ۱۳، ۱۵، ۳۲، ۳۳، ۳۴** |
| کد آماده است، پذیرش زنده (MySQL/Redis/SMS/درگاه/VPS) باقی است | **۰۴، ۰۶، ۲۳ (بخش MySQL)، ۲۶، ۳۷، ۳۸** |

## اصلاحات این دور

### ۱۹ — اعتبارسنجی بدنهٔ نوشتن دارو/کلینیک/داروخانه
- DTOهای واقعی کلاس‌محور: `backend/src/modules/clinics/dto/admin-clinic.dto.ts`،
  `backend/src/modules/medicines/dto/admin-medicine.dto.ts`،
  `backend/src/modules/pharmacies/dto/admin-pharmacy.dto.ts`.
- رشته‌ها trim و طول‌دار، boolean واقعی، مختصات `-90..90`/`-180..180` با حداکثر ۶ رقم اعشار،
  `petTypeIds` آرایهٔ صحیح ۱..۵۰ عضوی، تصویر دارو فقط `/uploads/…` یا `https://…`.
- `clinics.service.ts` دیگر بدنه را مستقیم به Prisma نمی‌دهد؛ نگاشت صریح allow-list برای create/update
  (هم‌راستا با `pharmacies.service.ts`). فیلد ناشناخته با `forbidNonWhitelisted` → ۴۰۰.
- آزمون HTTP: `backend/test/http-pipeline.e2e-spec.ts` (کلینیک/داروخانه/دارو، PATCH جزئی، ۱۳ حالت رد).

### ۲۴ — Multer آسیب‌پذیر و حد ناکافی multipart
- `multer` به **2.5.0** ارتقا یافت و با `overrides` نسخهٔ تودرتوی `@nestjs/platform-express` هم
  به 2.5.0 پین شد (`npm ls multer` → هر دو 2.5.0).
- محدودیت‌های parser: `files:1, fields:1, parts:2, fieldNameSize:64, fieldSize:256, headerPairs:20`
  به‌همراه سقف بایت `UPLOAD_MAX_MB` (`multerLimits()` در `upload.module.ts`).
- `MulterError` در `all-exceptions.filter.ts` به `413 PAYLOAD_TOO_LARGE` یا `400 VALIDATION_ERROR`
  نگاشت می‌شود (نه ۵۰۰).
- آزمون: `src/upload/upload.limits.spec.ts` (۷ تست).

### ۳۵ — ابطال نشست هنگام مسدودسازی/حذف/بازیابی کاربر
- `restoreByAdmin`، `softDeleteByAdmin` و `updateByAdmin` (تغییر role/status) مقدار
  `sessionVersion` را افزایش می‌دهند. `JwtStrategy` و `refresh` همین مقدار را با توکن مقایسه می‌کنند،
  پس توکن‌های پیش از تعلیق پس از بازیابی هم بی‌اعتبار می‌مانند. ویرایش صرفاً پروفایل نشست را باطل نمی‌کند.
- آزمون: `src/modules/users/users.admin-safety.spec.ts` (+۲ تست).

### ۳۷ — نظر و امتیاز خریدار تحویل‌گرفته (قابلیت کامل)
- مدل `ProductReview` (یکتا روی user+product، ایندکس productId+isVisible) و مایگریشن
  `prisma/migrations/20261024120000_product_reviews/`.
- `ProductReviewsService` + کنترلر: `GET /products/:slug/reviews` عمومی،
  `GET /products/:slug/review-eligibility`، `POST /products/:slug/reviews`،
  `PATCH|DELETE /products/:slug/reviews/mine`. هویت همیشه از نشست؛ خرید از سفارش
  `DELIVERED` همان محصول؛ متن HTML/کنترل‌کاراکترها پاک و ۳..۱۰۰۰ نویسه؛ رقابت روی ایندکس یکتا → ۴۰۹.
- `rating: {average, count}` به کارت‌های کاتالوگ، جزئیات محصول، علاقه‌مندی‌ها و پیشنهادها اضافه شد؛
  میانگین با یک `groupBy` برای هر صفحه (بدون N+1) و فقط از نظرهای visible؛ `average:null,count:0`
  یعنی «بدون امتیاز»، نه پنج ستاره.
- آزمون: `product-reviews.service.spec.ts` (۱۸)، `product-reviews.http.spec.ts` (۱۲)،
  `rating.util` داخل همان سوییت‌ها؛ کل محصولات/علاقه‌مندی/نظر: ۱۵۸ تست سبز.

### ۳۸ — انتقال اتمیک و idempotent سبد مهمان
- مدل `GuestTransfer` (یکتا روی `userId+requestId`، هش payload) و مایگریشن
  `prisma/migrations/20261024130000_guest_transfer/`.
- `POST /cart/guest-transfer`: `requestId` پایدار، `rows[{variantId,quantity}]` (۱..۲۰، حداکثر ۵۰ ردیف)،
  سیاست `replace`، `expectedCartVersion` اختیاری. داخل تراکنش: `SELECT … FOR UPDATE` روی سبد،
  بازخوانی موجودی/فعال‌بودن/نمونه‌بودن واریانت، حفظ اقلام دیگر حساب، ثبت نتیجهٔ requestId.
  تکرار همان requestId و همان payload → همان نتیجه با `replayed:true`؛ همان requestId با payload دیگر → ۴۰۹؛
  requestId کاربر دیگر قابل استفاده نیست؛ نسخهٔ ناهم‌خوان → ۴۰۹ با نسخهٔ فعلی.
- `GET /cart` اکنون `version` (ISO) برمی‌گرداند.
- آزمون: `guest-transfer.spec.ts` (۱۳) + گسترش `cart.dto.spec.ts` (۴ + ۱۲ حالت رد).
  مجموع تست‌های سبد: ۵۵ سبز.

### ۱۰ و ۱۴ — تأیید و تکمیل
- `POST /admin/users` واقعاً وجود دارد؛ README (که جانشین `backend/README.md` حذف‌شده است) اکنون مسیرهای
  واقعی را فهرست می‌کند و بدنهٔ create/update کاربر هم DTO گرفت (`users/dto/admin-user.dto.ts`).
- جست‌وجوی `q` برای کلینیک/داروخانه از قبل در DTO و سرویس بود؛ این دور با
  `src/modules/clinics/clinics.search.spec.ts` (۶ تست) تثبیت شد: زیررشته روی نام نرمال‌شده،
  ترکیب با شهر/استان، فقط رکورد فعال، صفحه‌بندی و نتیجهٔ خالی.

## تأیید شواهد پرونده‌های بسته‌شدهٔ قبلی

| پرونده | شاهد در source |
| --- | --- |
| ۰۱ / ۰۵ | `payments.service.ts`: درایور فقط `mock\|zarinpal\|disabled`، mock در production ممنوع، `callbackSig` HMAC + `timingSafeEqual`، callback فقط با `Status==='OK'` و verify سمت سرور؛ `zarinpal.gateway.ts` آدرس‌های درست WebGate/StartPay؛ `payment.config.ts` پیکربندی صریح |
| ۰۲ / ۲۸ | `orders.service.ts` و `admin-orders.service.ts`: claim اتمیک با `updateMany` شرطی پیش از آزادسازی موجودی؛ تست‌های `orders.cancel-expire.spec.ts` |
| ۰۳ / ۲۷ | `ThrottlerGuard` سراسری در `app.module.ts`؛ cooldown `SET NX` سپس شمارندهٔ ساعتی با بازگردانی در رد |
| ۰۷ | سهمیهٔ روزانهٔ Redis (۵۰ فایل/۵۰MB) + تشخیص magic-bytes و تبدیل WebP |
| ۰۸ | `onDuty` در create/update داروخانه + مپ صریح فیلدها |
| ۰۹ | `toCsv` با خنثی‌سازی `= + - @` و تست `reports.csv.spec.ts` |
| ۱۶ | `SELECT … FOR UPDATE` روی کوپن داخل تراکنش checkout |
| ۱۷ | `@IsInt` در DTO سبد + کران‌های تنظیمات (`SETTING_BOUNDS`) |
| ۱۸ / ۰۶ | provider روی MySQL؛ هیچ `mode: 'insensitive'` یا مسیر SQLite در `src/` نیست؛ مایگریشن‌های MySQL موجود |
| ۲۰ | `start:prod = node dist/src/main` |
| ۲۱ | `@Query() query: MedicineQueryDto` |
| ۲۲ | seed با گارد `NODE_ENV=production` + `ALLOW_DEMO_SEED` و درج idempotent داروخانه/دارو |
| ۲۵ | درایور `disabled` برای اجرای production بدون درگاه |
| ۲۹ | `birthDate: null` واقعی (پاک‌کردن تاریخ) |
| ۳۰ | `Cross-Origin-Resource-Policy: same-site` روی `/uploads` |
| ۳۱ | `addressSnapshot` به‌صورت JSON متنی ذخیره و با `parseAddressSnapshot` برگردانده می‌شود |
| ۳۶ | پاپ‌آپ فعال با هر یک از تصویر/عنوان/متن معتبر است و پیام ۴۰۰ متناسب دارد |

## تصمیم‌های باقی‌ماندهٔ محصول (کد عمداً تغییر نکرد)

- **۱۱** سیاست خروج/ابطال access token میان تب‌ها (backend امکان `sessionVersion` را دارد).
- **۱۲** واحد بسته/اندازه/طعم گونهٔ محصول (نیازمند فیلدهای schema و قرارداد کاتالوگ).
- **۱۳** sitemap پویا + robots و سیاست نمایه‌سازی دارو/مراکز (وابسته به دامنهٔ نهایی و تصمیم محتوایی).
- **۱۵** ذخیره/نمایش امتیاز Google برای کلینیک‌ها (منبع داده و سیاست نمایش تعیین نشده).
- **۳۲** قرارداد فعالیت مشتری در داشبورد ادمین.
- **۳۳** CMS محتوا، پرفروش واقعی و «نزدیک‌ترین مراکز» در لندینگ.
- **۳۴** قالب‌های مستقل پیامک و یادآوری سفارش.

## پذیرش زندهٔ باقی‌مانده (در سندباکس ممکن نیست)

MySQL/Redis/SMS/درگاه/VPS در این محیط نیست؛ `prisma generate` هم به `binaries.prisma.sh` دسترسی ندارد.
بنابراین این موارد فقط از نظر کد و تست واحد پوشش داده شده‌اند و «پذیرفته‌شده» اعلام نمی‌شوند:
۰۴ و ۲۶ (پیامک واقعی)، ۰۵ (درگاه واقعی زرین‌پال)، ۰۶/۲۳ (اجرای E2E روی MySQL واقعی)،
۲۵ (production با پرداخت غیرفعال)، ۳۷ و ۳۸ (HTTP + MySQL واقعی، رقابت هم‌زمان دو دستگاه).

## آزمون‌ها

- `npx jest` (۶۷ سوییت): **۶۳ سوییت / ۷۷۲ تست سبز**.
- ۴ سوییت `password-policy`، `auth.registration-template`، `auth.admin-otp`، `admin-query.http`
  در سندباکس به‌دلیل نبود binding نیتیو `bcrypt` بارگذاری نمی‌شوند؛ با جانشین JS همان
  **۴ سوییت / ۱۱۱ تست** سبز شد (مشکل محیط، نه کد).
- `npx jest --config test/jest-e2e.json`: **۲۵/۲۵** (پیشوند `api/v1`، ValidationPipe سراسری،
  envelope پاسخ، ۴۰۴ ساخت‌یافته، DTOهای care و نظر).
- مایگریشن‌های تازهٔ ۳۷/۳۸ با SQL دست‌نویس مطابق سبک Prisma اضافه شدند؛ `prisma validate`
  در این سندباکس به‌دلیل مسدودبودن دریافت engine اجرا نشد — پیش از استقرار باید
  `prisma migrate deploy` روی MySQL آزمایشی اجرا شود.

## آنچه ادعا نمی‌شود

هیچ کامیت/پوش/استقرار انجام نشده؛ هیچ آزمون زندهٔ SMS/درگاه/MySQL/VPS اجرا نشده؛
پرونده‌های نیازمند تصمیم محصول بسته اعلام نمی‌شوند.
