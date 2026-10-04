# [بحرانی] callback عمومی با درگاه mock می‌تواند سفارش را بدون پرداخت موفق کند

## شواهد

- `backend/src/modules/payments/payments.callback.controller.ts:16-31`: callback عمومی است؛ `Status` خالی نیز موفقیت تلقی می‌شود و `paymentId` از query می‌آید.
- `backend/src/modules/payments/gateways/mock.gateway.ts:19-24`: `verify()` همواره `success: true` برمی‌گرداند.
- `backend/src/modules/payments/payments.service.ts:18-27,79-129`: هر driver غیر از `zarinpal` به mock می‌افتد و callback با شناسهٔ پرداخت، `Payment=SUCCESS` و `Order=PAID` می‌نویسد.
- `backend/src/config/env.validation.ts:56-58` فقط رشته بودن `PAYMENT_DRIVER` را می‌سنجد؛ `backend/src/config/payment.config.ts:4` نبود مقدار را mock می‌کند.

## بازتولید در محیط ایزوله

با `PAYMENT_DRIVER=mock` یک سفارش در انتظار و رکورد پرداخت ایجاد کنید. بدون رفتن به صفحهٔ درگاه، `GET /api/v1/payments/callback?paymentId=<id>` را بدون نشست بفرستید. مسیر بدون `Status` وارد verify همواره‌موفق mock می‌شود و سفارش را پرداخت‌شده علامت می‌زند. شناسهٔ پرداخت عددی افزایشی است؛ لازم نیست درخواست‌کننده صاحب سفارش باشد.

## اثر و معیار رفع

در استقرار عمومی با driver آزمایشی، پرداخت واقعی لازم نیست و وضعیت سفارش و موجودی نامعتبر می‌شود. در production شروع سرویس با mock یا driver ناشناخته باید رد شود؛ مسیر mock-pay فقط در development/test باز باشد. callback باید به تراکنش و شناسهٔ معتبر درگاه متصل باشد؛ تست E2E باید callback ساختگی، بدون Status و متعلق به کاربر دیگر را رد کند. تا رفع، پرداخت عمومی نباید فعال شود.
