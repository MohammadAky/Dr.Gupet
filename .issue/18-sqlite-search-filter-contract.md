# [بالا] فیلترهای جست‌وجو با provider ثبت‌شدهٔ SQLite ناسازگارند

## شواهد — ۲۰۲۶-۱۰-۰۴، main در 0160b12

- backend/prisma/schema.prisma و migration_lock.toml از SQLite استفاده می‌کنند.
- ۲۲ فیلتر در سرویس‌های products، medicines، clinics، pharmacies، users، orders و coupons از mode: insensitive استفاده می‌کنند. نمونه‌ها: backend/src/modules/clinics/clinics.service.ts در findAll و findAllAdmin.
- با Prisma Client تولیدشده از همین schema و دیتابیس آزمایشیِ مستقل، اجرای فیلتر name.contains همراه mode، PrismaClientValidationError با Unknown argument mode ایجاد کرد. build به علت تایپ آزاد where این مورد را پیدا نکرد.

## اثر و معیار رفع

جست‌وجو/فیلتر در API دارای schema فعلی می‌تواند 500 بدهد. مالک بک‌اند باید provider، مهاجرت‌ها، Prisma Client و قرارداد فیلتر را هماهنگ کند؛ از type معتبر Prisma برای where استفاده و رفتار جست‌وجوی فارسی را با provider نهایی تست کند. مشکل provider کلی در پروندهٔ 06 پیگیری می‌شود.

برای تست XAMPP فقط در کپی محلیِ خارج مخزن، mode نامعتبر حذف شد؛ سپس جست‌وجوی محصول/دارو و فیلتر شهر مراکز واقعاً JSON 200 دادند. این سازگاری محلی رفع رسمی مخزن یا تضمین برابری رفتار PostgreSQL نیست؛ هیچ فایل backend مخزن ویرایش نشده است. diff محلی برای ارائه به مالک محفوظ است.
