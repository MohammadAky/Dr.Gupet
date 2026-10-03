# [بالا] مسیر پرداخت mock و آدرس درگاه واقعی در حالت فعلی کار نمی‌کنند

## شواهد

- `backend/src/modules/payments/gateways/mock.gateway.ts:10-16` لینک `/payments/mock-pay` فقط `orderId` و `amount` دارد؛ `paymentId` در آن نیست.
- `backend/src/modules/payments/payments.callback.controller.ts:42-55` در mock-pay، `paymentId` query را می‌خواند و به callback می‌فرستد؛ مقدارِ لینک فعلی `undefined` می‌شود. callback در `:21-31` آن را `Number(...)` می‌کند.
- `backend/src/modules/payments/gateways/zarinpal.gateway.ts:18-21` URLهای request/verify به صورت `.../pg/rest青岛市` ثبت شده‌اند؛ `:33,61` خود کد نیز این دو API را TODO می‌نامد. این مسیر باید با قرارداد رسمی درگاه تصحیح و تست شود.
- `backend/src/modules/payments/payments.service.ts:23-24`: عبارت `zarinpalSandbox || true` حتی مقدار `false` تنظیم‌شده را به `true` تبدیل می‌کند.

## بازتولید در محیط ایزوله

با driver mock، `POST /payments/start` بزنید و `paymentUrl` برگشتی را باز کنید: لینک فاقد `paymentId` است و redirect با `paymentId=undefined` به callback می‌رسد. با driver `zarinpal` و `ZARINPAL_SANDBOX=false`، شیء درگاه همچنان sandbox را انتخاب می‌کند؛ request/verify نیز URL دارای پسوند نامعتبر بالا را می‌سازند.

## اثر و معیار رفع

پرداخت آزمایشی از مسیر طبیعی کامل نمی‌شود و پرداخت واقعی آمادهٔ پذیرش نیست. لینک mock باید به رکورد پرداخت/شناسهٔ اختصاصی آن وصل شود. آدرس‌ها، قالب request و verify درگاه واقعی طبق مستندات جاری و با تست sandbox تأیید شوند؛ انتخاب false باید واقعاً محیط غیر sandbox را فعال کند. هیچ پرداختی را صرف redirect موفق فرض نکنید.
