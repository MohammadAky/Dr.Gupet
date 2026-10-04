# ممیزی خواندنی بک‌اند — ۲۰۲۶-۱۰-۰۲

این فایل‌ها پیش‌نویس issue برای مالک بک‌اند هستند. شواهد از کد `main` در commit `b040f48` گردآوری شده‌اند؛ بک‌اند و دادهٔ زنده ویرایش یا اجرا نشده‌اند. شدت‌های زیر بر اساس اثرِ محتمل در استقرار عمومی هستند و پیش از انتشار باید با تست یکپارچه در محیط ایزوله تأیید شوند.

| فایل | شدت | موضوع |
| --- | --- | --- |
| `01-mock-payment-public-callback.md` | بحرانی | امکان موفق‌کردن پرداخت بدون درگاه وقتی driver آزمایشی فعال است |
| `02-order-payment-state-race.md` | بالا | پرداخت پس از لغو/انقضا و ریسک بازگشت دوبارهٔ موجودی |
| `03-otp-throttle-not-active.md` | بالا | دکوراتورهای محدودکنندهٔ OTP بدون guard و نبود سقف سراسری ارسال |
| `04-real-sms-driver-missing.md` | بالا | SMS.ir پیاده‌سازی شده؛ پیکربندی امن، جبران همزمانی و پذیرش واقعی OTP باز است |
| `05-payment-gateway-flows-broken.md` | بالا | جریان mock شناسهٔ پرداخت ندارد؛ آدرس/انتخاب sandbox درگاه واقعی نامعتبر است |
| `06-database-persistence-deployment.md` | بالا | طرح SQLite با تنظیم/کلاینت توسعهٔ PostgreSQL ناسازگار است؛ ماندگاری استقرار روشن نیست |
| `07-upload-unbounded.md` | متوسط | هر کاربر واردشده می‌تواند فایل‌های نامحدود ذخیره کند |
| `08-pharmacy-duty-unmanageable.md` | متوسط | وضعیت کشیک در قرارداد مدیریت تعریف نشده و هنگام ایجاد ذخیره نمی‌شود |
| `09-report-csv-formula-injection.md` | متوسط | خروجی CSV نام محصول آغازشونده با فرمول را خنثی نمی‌کند |
| `10-admin-contract-documentation-drift.md` | کم | راهنمای بک‌اند POST ایجاد کاربر/سفارش را ذکر می‌کند اما کنترلرها ندارند |
| `11-cross-tab-logout-session-policy.md` | پیگیری | سیاست خروج میان تب‌ها و ابطال access token؛ رفتار قدیمی، نیازمند تصمیم و پذیرش زنده |
| `12-product-variant-unit-and-size-contract.md` | بالا | نبود قرارداد واحد بسته/تعداد/طعم برای ورود اقلام واقعی و ابهام دادهٔ موجودی/قیمت |
| `13-public-sitemap-and-indexing.md` | متوسط | نقشهٔ سایت پویای عمومی، محدودهٔ نمایه‌سازی و اتصال به Search Console |
| `14-directory-name-search.md` | متوسط | جست‌وجوی نام کلینیک و داروخانه در API عمومی؛ رفع محدودیت پیشنهادهای سراسری |
| `15-clinic-rating-and-ranking.md` | متوسط | قرارداد امتیاز Google، تعداد نظر، تاریخ منبع و ترتیب پایدار کلینیک‌ها |
| `16-coupon-redemption-concurrency.md` | بالا | اعمال اتمیک سقف مصرف کوپن در سفارش‌های همزمان |
| `17-integer-cart-and-money-settings.md` | متوسط | رد تعداد کسری سبد و تنظیمات مالی منفی/کسری در سرور |
| `18-sqlite-search-filter-contract.md` | بالا | فیلتر mode با SQLite معتبر نیست؛ جست‌وجوی عملیاتی 500 می‌دهد |
| `19-care-write-validation.md` | متوسط | بدنهٔ نوشتن کلینیک/دارو DTO معتبر ندارد |
| `20-production-entrypoint-mismatch.md` | بالا | start:prod و Docker با مسیر خروجی build هماهنگ نیستند |
| `21-public-medicine-query-validation.md` | بالا | query معتبر صفحه‌بندی/فیلتر دارو 500 می‌دهد؛ DTO کنترلر اجرا نمی‌شود |

در این ممیزی، CORS محدود به فهرست origin است و مسیرهای ادمین `@Roles('ADMIN')` دارند؛ یافته‌ای بر مبنای «دورزدن مستقیم نقش ادمین» ثبت نشده است. نبود بک‌اند/درگاه/SMS زنده یعنی هیچ ادعای آزمون پرداخت یا OTP انتهابه‌انتها مطرح نیست.

پرونده‌های ۱۲ تا ۱۵ در ۲۰۲۶-۱۰-۰۳ بر اساس قرارداد کد `main` در commit `865f29b` و نیازهای جدید کاتالوگ/انتشار/جست‌وجو/مراکز افزوده شده‌اند؛ عنوان و تاریخ ممیزی ۰۱ تا ۱۱ را تغییر نمی‌دهند. این پرونده‌ها پیاده‌سازی بک‌اند یا آزمون زنده را ادعا نمی‌کنند.

بازبینی ۲۰۲۶-۱۰-۰۴ روی `0160b12`: پروندهٔ ۰۴ بر اساس ماژول جدید SMS.ir اصلاح شد؛ قرارداد فرانت OTP تغییر نکرد. آزمون‌های کنترل‌شدهٔ تازهٔ بک‌اند در محیط محلی پیش از اجرا به ناسازگاری ESM/CJS در Jest برخورد کردند؛ ارسال واقعی، ورود زنده و پاس‌شدن آن‌ها ادعا نمی‌شود. بک‌اند ویرایش نشده است.

راه‌اندازی آزمایشی Apache/Node/Redis و SQLite مستقل در ۲۰۲۶-۱۰-۰۴ انجام شد. موارد ۱۸ و ۲۰ با اجرای کپی آزمایشی و ۱۹/تشخیص فایل ۰۷ با بازبینی ثابت ثبت شدند؛ مخزن backend تغییر نکرد. فقط کپی محلی برای سازگاری SQLite و bind داخلی تغییر کرد؛ این تغییر محلی جای رفع رسمی را نمی‌گیرد.

---

## وضعیت رفع — ۲۰۲۶-۱۰-۰۴ (بک‌اند)

همهٔ ۱۱ یافته در بک‌اند رفع شدند؛ پوشش تست واحد به ۲۴ سوییت/۱۵۹ تست رسید (`backend`: `npm test`). سرویس جستجو (بخش جدید) و قرارداد کامل پنل ادمین نیز تکمیل شد.

| فایل | وضعیت | رفع |
| --- | --- | --- |
| `01-mock-payment-public-callback.md` | ✅ | الزام `Status==='OK'`؛ امضای HMAC روی callback (`paymentId+sig`)؛ `mock-pay` فقط خارج از production + مالکیت سفارش؛ ردّ driver ناشناخته/mock در production؛ `verify()` mock فقط `mock-*` |
| `02-order-payment-state-race.md` | ✅ | گذار اتمیک `updateMany({status:'PENDING_PAYMENT'})` در cancel/expire؛ آزادسازی موجودی فقط بعد از claim موفق؛ پرداخت دیررسیده → `refundNote` + مسیر بازبینی (نه PAID)؛ claim اتمیک پرداخت |
| `03-otp-throttle-not-active.md` | ✅ | ثبت سراسری `ThrottlerGuard`؛ cooldown اتمیک با `SET NX EX`؛ سقف IP با `TRUST_PROXY`؛ تست ۴۲۹/همزمانی |
| `04-real-sms-driver-missing.md` | ✅ | درایور sms.ir (`send/verify` + `send/bulk`) با timeout/retry گذرا؛ اعتبارسنجی startup در production؛ دورریزی OTP هنگام شکست ارسال |
| `05-payment-gateway-flows-broken.md` | ✅ | لینک mock با `paymentId`؛ URLهای کلاسیک WebGate زرین‌پال (`PaymentRequest.json`/`PaymentVerification.json`/`StartPay`) با override از env؛ رفع باگ `zarinpalSandbox \|\| true` |
| `06-database-persistence-deployment.md` | ✅ | ابتدا هم‌راستاسازی با SQLite؛ سپس **برای استقرار production به MySQL 8 مهاجرت شد** — `provider = "mysql"`، مهاجرت پایهٔ یکپارچه (`20261004000000_init`)، `@db.Text` برای فیلدهای بلند، حذف `mode: 'insensitive'` (ناسازگار با MySQL)، docker-compose با سرویس `mysql:8.4` + volume، اصلاح entrypoint (`dist/src/main`) |
| `07-upload-unbounded.md` | ✅ | سهمیهٔ روزانهٔ per-user (تعداد + بایت) در Redis با rollback؛ محدودیت حجم از `UPLOAD_MAX_MB` (اعتبارسنجی ۱–۱۰)؛ `@Throttle`؛ پاکسازی فایل ناقص |
| `08-pharmacy-duty-unmanageable.md` | ✅ | `onDuty` در DTO/سرویس create و update؛ map صریح فیلدهای مجاز (بدون عبور body خام) |
| `09-report-csv-formula-injection.md` | ✅ | خنثی‌سازی `=+-@` (حتی بعد از whitespace) با پیشوند `'` در `toCsv` |
| `10-admin-contract-documentation-drift.md` | ✅ | `POST /admin/users` (شماره + نقش، یکتا) پیاده شد؛ جدول README اصلاح شد (`POST /admin/orders` وجود ندارد) |
| `11-cross-tab-logout-session-policy.md` | ✅ | تصمیم: logout فقط نشست refresh را می‌بندد؛ access token تا سررسید طبیعی (≤۱۵ دقیقه) معتبر است؛ `BLOCKED`/حذف‌شده در هر درخواست ۴۰۱ می‌گیرد؛ همگام‌سازی تب‌ها وظیفهٔ فرانت‌اند — مستند و تست شد |

### تکمیل‌های هم‌زمان
- **APIهای جستجو:** `search`/`isActive` برای `admin/{brands,categories,pet-types,breeds,tags}` و `q` برای `clinics`/`pharmacies` عمومی (+ قرارداد موجود `search/q` در products/medicines/orders/users/coupons/payments).
- **پنل ادمین (query-driven):** قرارداد همهٔ فراخوانی‌های `admin/src` با بک‌اند منطبق شد؛ فرم «افزودن کاربر» به `admin/src/Users.tsx` اضافه شد؛ `jsdom` برای اجرای تست‌های admin روی Node 20 pin شد.


> گزارش فوق ادعای مالک بک‌اند در commit a7126ce است؛ هر رفع باید با بازبینی و آزمون زندهٔ همان نسخه پذیرفته شود. runtime فعلی XAMPP هنوز روی نسخهٔ قبلی است و تیک‌های بالا جای پذیرش زنده را نمی‌گیرند.

## بازبینی مستقل source و عملیات — ۲۰۲۶-۱۰-۰۴، 4cf0f77

این بخش وضعیت کد بررسی‌شده را ثبت می‌کند و متن/تیک‌های تاریخی بالا را به پذیرش زنده ارتقا نمی‌دهد. build پاک و Prisma generate موفق بودند؛ ۲۷ سوییت/۱۷۷ تست واحد کنترل‌شده پاس شدند، اما Prisma/Redis/SMS در آن‌ها mock هستند. نحو سه اسکریپت با `bash -n` معتبر بود؛ این check اجرای امن deployment نیست. در این بازبینی seed، payload مخرب و تغییر VPS اجرا نشده‌اند. نتیجهٔ MySQL/OTP/CRUD واقعی باید به‌صورت جدا با شواهد محیط ثبت شود.

| پرونده | وضعیت بازبینی | شواهد / پذیرش باقی‌مانده |
| --- | --- | --- |
| 06 | source همسان؛ پذیرش داده باز | MySQL schema/migration/Compose جای ناسازگاری SQLite/PostgreSQL را گرفت؛ انتقال داده، recreate و backup/restore واقعی هنوز از این ممیزی ثابت نشده‌اند |
| 07 | **رفع جزئی، باز** | سهمیه/حد تنظیمی/throttle/cleanup پیاده‌اند؛ magic ناقص و عدم تطبیق MIME باقی است؛ پروندهٔ ۲۴ نیز parser را پوشش می‌دهد |
| 18 | source اصلاح؛ پذیرش MySQL باز | mode حذف شد؛ تطبیق جست‌وجوی فارسی و فیلترها با دادهٔ واقعی/Client تازه لازم است |
| 19 | **باز** | create/update کلینیک/دارو هنوز DTO کلاس ندارند؛ clinic update ورودی را مستقیم به Prisma می‌دهد |
| 20 | source entrypoint اصلاح؛ پذیرش container باز | Docker/start:prod اکنون dist/src/main دارند و build همین مسیر را ساخت؛ روشن‌شدن تصویر deployment واقعی از این build نتیجه گرفته نمی‌شود |
| [22-mysql-seed-and-live-catalog.md](22-mysql-seed-and-live-catalog.md) | **بالا، باز** | SQL ناسازگار MySQL قبل ایجاد ادمین؛ seed خودکار دادهٔ نمایشی فعال و care تکرارشونده وارد می‌کند |
| [23-live-deployment-and-acceptance-gates.md](23-live-deployment-and-acceptance-gates.md) | **بالا، باز** | setup پیش‌فرض توسعه، build API base و SSL root؛ test:e2e config غایب و command واقعاً پیش از تست با exit 1 متوقف شد |
| [24-multer-parser-resource-exhaustion.md](24-multer-parser-resource-exhaustion.md) | **بالا، باز** | Multer 2.0.2 متأثر از اطلاعیهٔ نگهدارنده، parser فقط fileSize دارد؛ exploit زنده اجرا نشده است |

پرونده‌های ۱۲/۱۵ دربارهٔ واحد/مشخصات واقعی محصول و عکس/امتیاز/منبع کلینیک همچنان قرارداد لازم برای ورود کامل داده هستند. امتیاز Google تأیید مالک یا عکس واقعی مرکز محسوب نمی‌شود. تنظیم خصوصی استقرار و کلیدها در این گزارش درج نمی‌شوند.

**فرضیهٔ ردشده:** در آزمایش Compose 2 با رمزهای ساختگی، بارگذاری خودکار env از پوشهٔ فایل Compose هنگام اجرا از root کار کرد. نبود `--env-file` به‌تنهایی باگ interpolation احراز‌شده نیست و به عنوان issue جدید ثبت نشده است؛ مقدارهای fallback در نبود env نیازمند بررسی تنظیم استقرار هستند.

## پذیرش محلی MySQL و محدودهٔ تحویل فرانت — ۲۰۲۶-۱۰-۰۴

روی 4cf0f77، MySQL 8.4.11 واقعی با مهاجرت پایه اجرا شد؛ روابط ۲۸ مدل، متن فارسی، مبالغ، uniqueness، cascade و rollback تست شدند. بکاپ در دیتابیس جدا بازیابی و ماندگاری پس از restart ثابت شد. ده کلینیک تحقیق‌شده با isVerified=false وارد MySQL محلی شدند؛ اجرای دوم صفر درج و ده skip داشت. فهرست و ده جزئیات ۲۰۰ دادند؛ جست‌وجوی آرامیس موفق بود. این‌ها پذیرش سرور Ubuntu یا تمام فیلترهای فارسی نیستند. هیچ پیامک واقعی، تغییر VPS یا دورزدن OTP انجام نشد.

درخواست‌های ناشناس به admin/me، users/me، pets، admin/clinics و admin/sms/logs همگی ۴۰۱ شدند. در درخواست‌های خواندنی بررسی‌شده هدر Set-Cookie نبود؛ پذیرش نشست authenticated هنوز انجام نشده است. فرانت/ادمین ورود واقعی و Bearer contract را حفظ کرده‌اند. قالب SMS.ir شمارهٔ 448272 طبق اعلام مالک تا راه‌اندازی سایت و تأیید سرویس‌دهنده آماده نیست. پرداخت mock فقط در تست محلی با اجازهٔ صریح مالک فعال است؛ نه در production.

پروندهٔ ۲۱ روی MySQL جدید دوباره با GET /medicines?page=1&limit=20 پاسخ ۵۰۰ داد؛ محصولات، داروخانه‌ها، کلینیک‌ها و مرجع‌ها پاسخ ۲۰۰ دارند. پروندهٔ ۰۶ از نظر مهاجرت/بکاپ/ماندگاری محلی شاهد دارد؛ انتقال دیتابیس به VPS هنوز انجام نشده است. پروندهٔ ۱۸ از نظر حذف mode و جست‌وجوی نمونه شاهد دارد؛ پذیرش جامع جست‌وجو در deployment باز است.

فرانت ۱۹۸ تست / ۳۲ فایل، ادمین ۲۵ تست / ۶ فایل و lint/typecheck/build موفق دارند؛ بک‌اند ۱۷۷ تست واحد کنترل‌شده / ۲۷ suite دارد. تست‌های mock جای پیامک/پرداخت واقعی را نمی‌گیرند. تمام داده‌های تحقیق و تنظیم خصوصی خارج مخزن‌اند؛ کامیت کد، دادهٔ ده کلینیک را به سرور منتقل نمی‌کند. محصولات بنا به دستور جدید مالک فعلاً وارد نمی‌شوند.
