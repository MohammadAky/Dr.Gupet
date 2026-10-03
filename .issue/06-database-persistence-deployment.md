# [بالا] تنظیمات پایگاه‌داده و ماندگاری داده با راهنمای استقرار ناسازگارند

## شواهد

- `backend/prisma/schema.prisma:8-11` provider را `sqlite` تعیین می‌کند؛ مهاجرت `backend/prisma/migrations/20261001095815_init/migration.sql:2-4` از `AUTOINCREMENT` و قالب SQLite استفاده می‌کند.
- `backend/.env.example:6` مقدار `DATABASE_URL="file:./dev.db"` دارد.
- `backend/README.md:8-16,135-156` راه‌اندازی را با PostgreSQL 16 توضیح می‌دهد؛ `backend/docker-compose.yml:4-16` PostgreSQL را بالا می‌آورد اما backend service/volume برای SQLite ندارد.
- `backend/Dockerfile:24-51` تصویر production را با `npx prisma migrate deploy` بالا می‌آورد؛ `/app/uploads` می‌سازد ولی volume یا mount برای فایل دیتابیس/آپلود تعریف نمی‌کند.

## بازتولید در محیط ایزوله

راهنمای README را با URL PostgreSQL دنبال کنید: Prisma با provider SQLite این URL را نمی‌پذیرد. اگر به‌جای آن `.env.example` استفاده شود، دیتابیس در فایل داخل filesystem کانتینر ساخته می‌شود؛ با جایگزینی کانتینر، فایل دیتابیس و `/app/uploads` مگر با mount بیرونی از دست می‌روند.

## اثر و معیار رفع

استقرار طبق راهنما شکست می‌خورد یا دادهٔ کاربران/سفارش‌ها و تصاویر در انتشار بعدی حذف می‌شود. مالک بک‌اند باید یک پایگاه‌دادهٔ نهایی انتخاب کند، schema/migrations/env/README و Docker را یکسان کند، و ماندگاری و backup را با restart/recreate واقعی تأیید کند. تا این آزمون، انتشار عمومی داده‌دار مسدود بماند.
