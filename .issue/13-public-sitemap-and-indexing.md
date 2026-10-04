# نقشهٔ سایت پویا و محدودهٔ نمایه‌سازی عمومی

**نوع:** نیاز بک‌اند و پیکربندی هاست برای انتشار عمومی  
**اولویت پیشنهادی:** متوسط، پیش از ثبت در Search Console  
**وضعیت:** باز؛ بررسی کد، بدون بررسی دامنه یا استقرار زنده

## شواهد پروژه

- مسیرهای عمومی SPA در `frontend/src/router.tsx` شامل `/`, `/products`, `/products/:slug`, `/medicines`, `/medicines/:id`, `/pharmacies`, `/pharmacies/:id`, `/clinics`, `/clinics/:id` هستند. مسیرهای پروفایل، حیوانات، سفارش، پرداخت و ادمین خصوصی یا تراکنشی‌اند.
- کنترلرهای عمومی بک‌اند در `backend/src/modules/products/products.controller.ts`, `backend/src/modules/medicines/medicines.controller.ts`, `backend/src/modules/pharmacies/pharmacies.controller.ts` و `backend/src/modules/clinics/clinics.controller.ts` فهرست و جزئیات را ارائه می‌کنند. سرویس‌ها اقلام `isActive: true` را نشان می‌دهند. محصول و کلینیک `updatedAt` دارند؛ مدل‌های دارو و داروخانه در `backend/prisma/schema.prisma` فعلاً `updatedAt` ندارند.
- `backend/src/main.ts` پیشوند API را `api/v1` می‌گذارد؛ در `frontend/public` فایل `robots.txt` یا sitemap وجود ندارد و در کد فعلی مولد نقشهٔ سایت پیدا نشد. خروجی عمومی باید روی **مبدأ سایت اصلی** در `/sitemap.xml` یا مسیر معادل قابل دسترس باشد، حتی اگر داده را بک‌اند از پایگاه داده تولید کند.

## درخواست اجرایی

1. بک‌اند sitemap پویا را از رکوردهای **فعال و واقعاً قابل نمایش** تولید کند، نه از یک فهرست دستی. صفحه‌های ثابت عمومی و جزئیات عمومی محصول/دارو/داروخانه/کلینیک در صورت قابل نمایه‌سازی بودن درج شوند؛ رکورد غیرفعال، حذف‌شده، خصوصی، صفحهٔ ورود/تأیید، پروفایل، سبد، پرداخت، سفارش، ادمین، صفحات فیلتر/جست‌وجوی تکراری و URLهای غیرکانونی حذف شوند. دربارهٔ نمایه‌سازی دارو و مراکز، تصمیم محتوایی صاحب محصول ثبت شود.
2. مبدأ HTTPS و مسیرهای canonical از تنظیم استقرارِ معتبر و ثابت گرفته شوند؛ از `Host`/هدر درخواست برای تولید دامنهٔ sitemap استفاده نشود. URL مطلق باشد، بخش‌های مسیر به‌درستی encode و مقادیر XML escape شوند. URLهای دامنهٔ ادمین یا localhost وارد خروجی نشوند.
3. `<lastmod>` فقط برای تغییر مهمِ واقعی صفحه و از زمان معتبر داده درج شود؛ برای دارو و داروخانه که فعلاً `updatedAt` ندارند، یا زمان تغییر معتبر افزوده شود یا `lastmod` آن‌ها حذف شود. زمان تولید sitemap را به عنوان تاریخ تغییر همهٔ صفحه‌ها جا نزنند.
4. هر فایل حداکثر **۵۰٬۰۰۰ URL یا ۵۰ مگابایتِ فشرده‌نشده** داشته باشد؛ در مقیاس بالاتر فایل‌ها شکسته و sitemap index ساخته شود. تولید باید صفحه‌بندی/کَش یا راهکار هم‌ارز داشته باشد تا با رشد داده حافظه و زمان پاسخ بی‌رویه نشود؛ پس از تغییر وضعیت عمومی رکورد، خروجی به‌روز شود.
5. هاست/فرانت `robots.txt` را در ریشهٔ مبدأ عمومی با آدرس مطلق `Sitemap: https://.../sitemap.xml` ارائه کند و مسیرها/هدر canonical و سیاست `noindex` صفحه‌های غیرعمومی را هماهنگ سازد. `robots.txt` کنترل دسترسی نیست؛ مسیرهای حساس همچنان باید با احراز هویت محافظت شوند. پس از استقرار، مالک دامنه را در Search Console تأیید و sitemap را ثبت/خطاهایش را بررسی کند. ثبت sitemap تضمین نمایه‌سازی نیست.

## خارج از این درخواست

Google Analytics و Google Ads برای نصب یا ثبت به sitemap وابسته نیستند. شناسهٔ property/حساب، هدف اندازه‌گیری، متن حریم خصوصی و سازوکار رضایتِ معتبر باید جداگانه نهایی شود. مطابق `frontend/docs/DECISIONS.md`، تصمیم ارائه‌دهنده هنوز باز است؛ اکنون هیچ اسکریپت رهگیری یا تبلیغاتی اضافه نشود. اگر بعدها اضافه شد، تنظیمات رضایت و رفتار tagها پیش از جمع‌آوری داده آزموده شوند.

## معیار پذیرش

- پس از ایجاد/غیرفعال‌کردن یک محصول آزمایشی، sitemap عمومی پس از بازهٔ به‌روزرسانی مستند تغییر کند؛ URLهای خصوصی و دامنهٔ ادمین در آن نباشند.
- XML معتبر، URLهای مطلق و canonical، escape درست، تاریخ تغییر معتبر یا عدم درج آن، حدود اندازه، رفتار چندصفحه‌ای و پاسخ `robots.txt` روی دامنهٔ نهایی آزموده شوند.
- گزارش Search Console پس از استقرار خطای خواندن sitemap نداشته باشد؛ این آزمون از محیط محلی ادعا نشود.

## منابع رسمی

- [Google Search Central: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google Search Central: Manage large sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps)
- [Google: Create and submit a robots.txt file](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt)
- [Google Analytics Help: Obtain user consent](https://support.google.com/analytics/answer/14009343?hl=en)
