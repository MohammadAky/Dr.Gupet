# درخواست‌های تغییر اسکیما

تغییر در `backend/prisma/schema.prisma` فقط با ثبت درخواست در این فایل (چه، چرا، تأثیر) انجام می‌شود. مرجع قواعد: [`../README.md`](../README.md) بخش ۹.

## SCHEMA-001 — فیلد Product.minPrice برای قرارداد کاتالوگ

- **Status: RESOLVED** — فیلد در اسکیما اضافه شد.
- تاریخ درخواست: 2026-09-21

### شرح
قرارداد کاتالوگ به `Product.minPrice` نرمال‌شده برای مرتب‌سازی قیمت و `ProductVariantsService.recalculateMinPrice` نیاز داشت، اما فیلد در مدل `Product` وجود نداشت.

### راه‌حل اعمال‌شده
- فیلد `minPrice Int @default(0)` به مدل `Product` اضافه شد (مشاهده در `backend/prisma/schema.prisma`).
- مقدار از ارزان‌ترین واریانت فعال هر محصول محاسبه و هنگام تغییر واریانت‌ها/seed بازمحاسبه می‌شود.
