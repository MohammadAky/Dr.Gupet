# [کم] راهنمای API مدیریت، POST سفارش و کاربر را ذکر می‌کند اما کنترلرها ندارند

## شواهد

- `backend/README.md:244` برای کاربران `GET/POST/PATCH/DELETE /admin/users...` نوشته است؛ `backend/src/modules/users/admin-users.controller.ts` فقط GET، PATCH، DELETE و PATCH restore دارد.
- `backend/README.md:246` برای سفارش‌ها `GET/POST/PATCH /admin/orders...` نوشته است؛ `backend/src/modules/orders/admin-orders.controller.ts` فقط GET، PATCH transition/tracking و POST روی `:id/cancel` و `:id/refund` دارد. مسیر `POST /admin/orders` وجود ندارد.

## اثر و معیار رفع

توسعه‌دهندهٔ فرانت ممکن است فرم ایجاد دستی کاربر یا سفارش را بر پایهٔ راهنما بسازد و با 404 روبه‌رو شود. جدول قرارداد را با مسیرهای واقعی هماهنگ کنید؛ اگر ایجاد دستی لازم است، آن را به عنوان API جدید با قواعد اعتبارسنجی و مجوز جداگانه تعریف و تست کنید. در این فاز، فرانت مسیرهای بدون کنترلر را فراخوانی نمی‌کند.
