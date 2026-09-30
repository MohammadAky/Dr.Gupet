# درخواست‌های تغییر اسکیما

تغییر در `backend/prisma/schema.prisma` فقط با ثبت درخواست در این فایل (چه، چرا، تأثیر) انجام می‌شود. مرجع قواعد: [`../README.md`](../README.md) بخش ۹.

## ADMIN-001 — جداول پنل ادمین و فیلدهای استرداد سفارش

- **Status: RESOLVED** — اعمال شد (۲۰۲۶-۰۹-۳۰).
- تاریخ درخواست: 2026-09-30

### شرح
پنل ادمین به ثبت تغییرات (Audit)، تنظیمات عملیاتی قابل تغییر توسط ادمین، و نشانه‌گذاری استرداد سفارش نیاز داشت.

### راه‌حل اعمال‌شده
- مدل `AdminAuditLog` (adminId, action, entity, entityId, summary, ip, createdAt) اضافه شد.
- مدل `Setting` (key/value) اضافه شد؛ سه کلید `SHIPPING_FLAT_COST`، `FREE_SHIPPING_THRESHOLD` و `ORDER_EXPIRE_MINUTES` در صورت وجود مقدار در جدول، بر مقادیر env مقدم‌اند.
- فیلدهای `refundedAt` و `refundNote` به مدل `Order` اضافه شد (نشانه‌گذاری استرداد؛ جابه‌جایی مالی خارج از سیستم).

## ADMIN-002 — اصلاح رابطهٔ Medicine ↔ PetType

- **Status: RESOLVED** — اعمال شد (۲۰۲۶-۰۹-۳۰).

### شرح
اسکیما با خطای validate پریسما مواجه بود: `PetType.medicines` رابطهٔ مقابل نداشت و جدول واسط `MedicinePetType` نیمه‌کاره بود؛ کدهای موجود انتظار رابطهٔ مستقیم `petTypes` (نوع PetType[]) را داشتند.

### راه‌حل اعمال‌شده
- رابطهٔ مستقیم (implicit many-to-many) بین `Medicine` و `PetType` برقرار شد؛ جدول واسط ناقص `MedicinePetType` حذف شد.

## SCHEMA-001 — فیلد Product.minPrice برای قرارداد کاتالوگ

- **Status: RESOLVED** — فیلد در اسکیما اضافه شد.
- تاریخ درخواست: 2026-09-21

### شرح
قرارداد کاتالوگ به `Product.minPrice` نرمال‌شده برای مرتب‌سازی قیمت و `ProductVariantsService.recalculateMinPrice` نیاز داشت، اما فیلد در مدل `Product` وجود نداشت.

### راه‌حل اعمال‌شده
- فیلد `minPrice Int @default(0)` به مدل `Product` اضافه شد (مشاهده در `backend/prisma/schema.prisma`).
- مقدار از ارزان‌ترین واریانت فعال هر محصول محاسبه و هنگام تغییر واریانت‌ها/seed بازمحاسبه می‌شود.
