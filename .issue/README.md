# ممیزی خواندنی بک‌اند — ۲۰۲۶-۱۰-۰۲

این فایل‌ها پیش‌نویس issue برای مالک بک‌اند هستند. شواهد از کد `main` در commit `b040f48` گردآوری شده‌اند؛ بک‌اند و دادهٔ زنده ویرایش یا اجرا نشده‌اند. شدت‌های زیر بر اساس اثرِ محتمل در استقرار عمومی هستند و پیش از انتشار باید با تست یکپارچه در محیط ایزوله تأیید شوند.

| فایل | شدت | موضوع |
| --- | --- | --- |
| `01-mock-payment-public-callback.md` | بحرانی | امکان موفق‌کردن پرداخت بدون درگاه وقتی driver آزمایشی فعال است |
| `02-order-payment-state-race.md` | بالا | پرداخت پس از لغو/انقضا و ریسک بازگشت دوبارهٔ موجودی |
| `03-otp-throttle-not-active.md` | بالا | دکوراتورهای محدودکنندهٔ OTP بدون guard و نبود سقف سراسری ارسال |
| `04-real-sms-driver-missing.md` | بالا | درایورهای واقعی SMS پیاده‌سازی نشده‌اند |
| `05-payment-gateway-flows-broken.md` | بالا | جریان mock شناسهٔ پرداخت ندارد؛ آدرس/انتخاب sandbox درگاه واقعی نامعتبر است |
| `06-database-persistence-deployment.md` | بالا | SQLite اجرا می‌شود اما راهنما PostgreSQL می‌گوید و volume API وجود ندارد |
| `07-upload-unbounded.md` | متوسط | هر کاربر واردشده می‌تواند فایل‌های نامحدود ذخیره کند |
| `08-pharmacy-duty-unmanageable.md` | متوسط | وضعیت کشیک در قرارداد مدیریت تعریف نشده و هنگام ایجاد ذخیره نمی‌شود |
| `09-report-csv-formula-injection.md` | متوسط | خروجی CSV نام محصول آغازشونده با فرمول را خنثی نمی‌کند |
| `10-admin-contract-documentation-drift.md` | کم | راهنمای بک‌اند POST ایجاد کاربر/سفارش را ذکر می‌کند اما کنترلرها ندارند |
| `11-cross-tab-logout-session-policy.md` | پیگیری | سیاست خروج میان تب‌ها و ابطال access token؛ رفتار قدیمی، نیازمند تصمیم و پذیرش زنده |

در این ممیزی، CORS محدود به فهرست origin است و مسیرهای ادمین `@Roles('ADMIN')` دارند؛ یافته‌ای بر مبنای «دورزدن مستقیم نقش ادمین» ثبت نشده است. نبود بک‌اند/درگاه/SMS زنده یعنی هیچ ادعای آزمون پرداخت یا OTP انتهابه‌انتها مطرح نیست.

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
| `06-database-persistence-deployment.md` | ✅ | هم‌راستاسازی مستندات با SQLite؛ docker-compose با volume برای `dev.db` + `uploads`؛ اصلاح entrypoint (`dist/src/main`) |
| `07-upload-unbounded.md` | ✅ | سهمیهٔ روزانهٔ per-user (تعداد + بایت) در Redis با rollback؛ محدودیت حجم از `UPLOAD_MAX_MB` (اعتبارسنجی ۱–۱۰)؛ `@Throttle`؛ پاکسازی فایل ناقص |
| `08-pharmacy-duty-unmanageable.md` | ✅ | `onDuty` در DTO/سرویس create و update؛ map صریح فیلدهای مجاز (بدون عبور body خام) |
| `09-report-csv-formula-injection.md` | ✅ | خنثی‌سازی `=+-@` (حتی بعد از whitespace) با پیشوند `'` در `toCsv` |
| `10-admin-contract-documentation-drift.md` | ✅ | `POST /admin/users` (شماره + نقش، یکتا) پیاده شد؛ جدول README اصلاح شد (`POST /admin/orders` وجود ندارد) |
| `11-cross-tab-logout-session-policy.md` | ✅ | تصمیم: logout فقط نشست refresh را می‌بندد؛ access token تا سررسید طبیعی (≤۱۵ دقیقه) معتبر است؛ `BLOCKED`/حذف‌شده در هر درخواست ۴۰۱ می‌گیرد؛ همگام‌سازی تب‌ها وظیفهٔ فرانت‌اند — مستند و تست شد |

### تکمیل‌های هم‌زمان
- **APIهای جستجو:** `search`/`isActive` برای `admin/{brands,categories,pet-types,breeds,tags}` و `q` برای `clinics`/`pharmacies` عمومی (+ قرارداد موجود `search/q` در products/medicines/orders/users/coupons/payments).
- **پنل ادمین (query-driven):** قرارداد همهٔ فراخوانی‌های `admin/src` با بک‌اند منطبق شد؛ فرم «افزودن کاربر» به `admin/src/Users.tsx` اضافه شد؛ `jsdom` برای اجرای تست‌های admin روی Node 20 pin شد.
