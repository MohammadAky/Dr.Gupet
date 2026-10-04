# [بالا] مسیر setup پیش‌فرض‌های توسعه و خروجی فرانت نامعتبر را به استقرار عمومی می‌برد

## نسخه و مرز بررسی — ۲۰۲۶-۱۰-۰۴

کد `main` در `4cf0f77` و اسکریپت‌ها بررسی شدند؛ تنظیم خصوصی VPS، DNS و nginx زنده با این بررسی احراز نشده‌اند. `bash -n` فقط صحت نحو shell را نشان می‌دهد.

## شواهد

### تنظیمات bootstrap

- `scripts/setup.sh:75-109` نمونهٔ env را کپی می‌کند و secretها، شمارهٔ seed و URLها را عوض می‌کند؛ `NODE_ENV`، driverهای واقعی و `OTP_DEV_CODE` را برای production انتخاب/پاک نمی‌کند.
- `backend/.env.example:1,18,23,32,45` به‌ترتیب development، کد ثابت توسعه، console SMS، mock payment و TRUST_PROXY خالی دارد. `backend/docker-compose.yml:51-52` همان env را به سرویس می‌دهد.
- `backend/src/modules/auth/otp/otp.service.ts:32,54-55` کد ثابت را خارج production استفاده می‌کند؛ hardening در `backend/src/config/env.validation.ts:151-170` فقط وقتی NODE_ENV واقعاً production باشد الزام می‌شود. تغییر secret به‌تنهایی این حالت توسعه را برطرف نمی‌کند.

### build مشتری و مسیر SSL

- `scripts/setup.sh:138-139` و `scripts/update.sh:95-96` build را بدون آماده‌سازی `VITE_API_BASE_URL` اجرا می‌کنند. `frontend/src/lib/env.ts:1-4` در نبود متغیر خطا می‌دهد؛ `frontend/.env.example:1` نیز آدرس localhost دارد. در build عمومی باید base معتبر استقرار، مثلاً `/api/v1` برای proxy هم‌مبدأ، به‌صورت build-time فراهم شود.
- `scripts/ssl.sh:33,75,79` root پیش‌فرض `/opt/drgupet` را برای distها می‌گیرد؛ `scripts/setup.sh:148-152` مسیر واقعی ROOT_DIR را با `--root` منتقل نمی‌کند. clone در مسیر متفاوت می‌تواند nginx را به خروجی ناموجود وصل کند.

### دروازهٔ E2E اعلام‌شده

- `backend/package.json:19` به `test/jest-e2e.json` ارجاع دارد، اما این فایل/پوشه در نسخهٔ بررسی‌شده موجود نیست.
- اجرای `npm run test:e2e -- --runInBand` در کپی پاک ایزوله، پیش از اجرای تست با خطای حل مسیر config و exit code 1 متوقف شد. هیچ تست E2E در این اجرا انجام نشد.
- ۲۷ سوییت/۱۷۷ تست واحد در گزارش build پاک پاس شدند؛ Prisma/Redis/SMS در آن‌ها mock هستند و پذیرش MySQL/OTP/ماندگاری/پرداخت زنده محسوب نمی‌شوند.

## اثر و معیار رفع

این یافته دربارهٔ مسیر راه‌اندازی تازه است؛ ناامن‌بودن تنظیم فعلی سرور از آن نتیجه گرفته نمی‌شود. مالک استقرار باید production را صریح الزام کند، کد ثابت را خالی و SMS/پرداخت واقعی را با اعتبارسنجی لازم تنظیم کند، و TRUST_PROXY را فقط برای proxyهای شناخته‌شده تعیین کند. build فرانت باید base صحیح داشته باشد و درخواست‌های مرورگر به localhost بازدیدکننده نروند. SSL باید ROOT_DIR واقعی را بگیرد.

پذیرش: bootstrap ایزوله با env تازه و بدون دادهٔ نمایشی، رد پیکربندی ناقص، build و درخواست مرورگر از دامنهٔ درست، clone در مسیر متفاوت، سپس E2E واقعی روی MySQL/Redis ایزوله با هویت USER/ADMIN، ایجاد/ویرایش/آپلود، رد دسترسی نامجاز، ارسال مجدد OTP و ماندگاری پس از restart/restore. آزمون پرداخت واقعی یا sandbox باید جدا و با تنظیم مجاز ثبت شود.

**وضعیت:** باز؛ تغییر اسکریپت‌ها/بک‌اند و انتشار انجام نشده است.

## دامنه‌های تأییدشده و Cloudflare — ۲۰۲۶-۱۰-۰۴

مالک drgupet.ir و admin.drgupet.ir را اعلام کرد. بررسی خواندنی اتصال رسمی Cloudflare: zone فعال؛ A دامنهٔ اصلی و ادمین به 188.121.125.248 با proxied=false اشاره دارند. CNAME موجود www.gupet.ir.drgupet.ir است، نه www.drgupet.ir؛ پیش از انتخاب www اصلاح/تأیید شود. SSL حالت full، always_use_https خاموش و حداقل TLS برابر 1.0 بود؛ وقتی رکوردها DNS-only هستند این تنظیمات جای TLS origin را نمی‌گیرند. هیچ DNS یا تنظیم Cloudflare در این مرحله تغییر نکرد. HTTPS دامنه‌ها و HTTP سرور در بررسی اتصال پاسخ‌گو نبودند؛ فعال‌شدن zone شاهد لایو بودن نیست. مالک بک‌اند استقرار Ubuntu را انجام می‌دهد؛ بعد از آن TLS/proxy و نبود mock/fixed OTP در production پذیرفته شوند.
