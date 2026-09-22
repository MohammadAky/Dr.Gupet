# Pet System Backend - Test Checklist

بر اساس فایل evaluation.md

---

## بخش ۱ — Bootstrap و سلامت سیستم

### S1.1 — Health check
```bash
curl -s $BASE/health
```
**انتظار:** `{ "success": true, "data": { "status": "ok" } }`
- [ ] `success` و `data` هر دو حضور دارند

### S1.2 — Route ناشناخته
```bash
curl -s $BASE/does-not-exist
```
**انتظار:** `{ "success": false, "statusCode": 404, "code": "NOT_FOUND" }`
- [ ] stack trace یا پیام خام Prisma/NestJS وجود ندارد

### S1.3 — Swagger در dev
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/docs
```
**انتظار:** `200`
- [ ] در production باید `404` باشد

---

## بخش ۲ — Auth و OTP

### S2.1 — درخواست OTP با شماره معتبر
```bash
curl -s -X POST $BASE/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"09120000001"}'
```
**انتظار:** `{ "success": true, "data": { "expiresIn": 120 } }`
- [ ] `expiresIn` عدد ثانیه است
- [ ] در dev لاگ کد OTP در stdout

### S2.2 — درخواست OTP با شماره نامعتبر
```bash
curl -s -X POST $BASE/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"0912abc1234"}'
```
**انتظار:** `statusCode: 400`, `code: "VALIDATION_ERROR"`
- [ ] پیام خطا به فارسی است

### S2.3 — OTP غلط
```bash
curl -s -X POST $BASE/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"09120000001","code":"00000"}'
```
**انتظار:** `statusCode: 401`, `code: "OTP_INVALID"`
- [ ] بعد از ۵ بار تلاش غلط، کد expire شود
- [ ] بار ششم `OTP_EXPIRED` می‌دهد

### S2.4 — Cooldown مجدد ارسال OTP
```bash
# درخواست اول
curl -s -X POST $BASE/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"09120000002"}'
# بلافاصله دوباره
curl -s -X POST $BASE/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"09120000002"}'
```
**انتظار دومی:** `statusCode: 429`, `code: "OTP_RATE_LIMITED"`

### S2.5 — ثبت‌نام و ورود با OTP صحیح (کاربر جدید)
```bash
curl -s -X POST $BASE/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"09130000001"}'

curl -s -X POST $BASE/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"09130000001","code":"12345"}'
```
**انتظار:**
- [ ] `isNewUser: true` برای اولین ورود
- [ ] `role` یا `status` کاربران دیگر در پاسخ وجود ندارد

### S2.6 — دسترسی بدون token
```bash
curl -s $BASE/users/me
```
**انتظار:** `statusCode: 401`, `code: "UNAUTHORIZED"`

### S2.7 — Refresh token
```bash
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'
```
**انتظار:** جفت token جدید
- [ ] استفاده از refresh token قدیمی باز هم token نمی‌دهد (rotate شده)

### S2.8 — Logout
```bash
curl -s -X POST $BASE/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken>"}'

curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<همان refreshToken>"}'
```
**انتظار دومی:** `401 UNAUTHORIZED`

---

## بخش ۳ — پروفایل و آدرس

### S3.1 — مشاهده پروفایل
```bash
curl -s $BASE/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
- [ ] فیلدهای `role` و `status` کاربران دیگر لیک نمی‌شود

### S3.2 — ویرایش پروفایل
```bash
curl -s -X PATCH $BASE/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"علی","lastName":"رضایی"}'
```
- [ ] ارسال `{"phone":"09999999999"}` تغییری ایجاد نمی‌کند

### S3.3 — ثبت آدرس
```bash
curl -s -X POST $BASE/addresses \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "خونه",
    "receiverName": "علی رضایی",
    "receiverPhone": "09130000001",
    "province": "تهران",
    "city": "تهران",
    "fullAddress": "خیابان آزادی، پلاک ۱۲"
  }'
```
- [ ] اولین آدرس خودکار `isDefault: true` می‌شود

### S3.4 — Isolation بین دو کاربر
```bash
curl -s -X PATCH $BASE/addresses/<id_آدرس_کاربر_دوم> \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"هک"}'
```
**انتظار:** `404 NOT_FOUND` (نه `403 FORBIDDEN`)
- [ ] واقعاً `404` است نه `403`

---

## بخش ۴ — پت

### S4.1 — ثبت پت
```bash
curl -s -X POST $BASE/pets \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "رکس",
    "petTypeId": 1,
    "breedId": 2,
    "birthDate": "2022-03-15",
    "gender": "MALE",
    "isNeutered": false,
    "weightKg": 8.5
  }'
```
- [ ] `breedId` متعلق به `petTypeId` دیگری → `400`

### S4.2 — تعیین تگ‌های پت
```bash
curl -s -X PUT $BASE/pets/$PET_ID/tags \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"allergenTagIds":[1,2],"dietTagIds":[10,11]}'
```
- [ ] ارسال allergenTagId در dietTagIds → `400`
- [ ] تگ‌های قبلی کاملاً جایگزین می‌شوند (نه اضافه)

### S4.3 — محاسبه lifeStage
```bash
curl -s -X POST $BASE/pets \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"بچه‌گربه","petTypeId":2,"birthDate":"2026-06-01","gender":"FEMALE","isNeutered":false}'
```
**انتظار:** `lifeStage: "PUPPY_KITTEN"`

---

## بخش ۵ — کاتالوگ و پیشنهاد محصول

### S5.1 — لیست محصولات با فیلتر
```bash
curl -s "$BASE/products?petTypeId=1&lifeStage=ADULT&inStock=true&page=1&limit=5"
```
- [ ] `meta` شامل `total`، `page`، `limit`، `totalPages` است
- [ ] `stock` عددی در هیچ‌کدام وجود ندارد (فقط `inStock: boolean`)

### S5.2 — جستجو با حروف عربی
```bash
curl -s "$BASE/products?q=رويال%20كنين"   # با ي و ك عربی
curl -s "$BASE/products?q=رویال%20کنین"   # با ی و ک فارسی
```
- [ ] هر دو نتیجه یکسانی می‌دهند

### S5.3 — جزئیات محصول
```bash
curl -s "$BASE/products/<slug-محصول>"
```
- [ ] `variants` بر اساس `weightGram` مرتب شده‌اند
- [ ] Variantهای `isActive: false` در پاسخ نیستند

### S5.4 — پیشنهاد محصول برای پت
```bash
curl -s "$BASE/products/recommendations?petId=$PET_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
- [ ] محصولات حاوی آلرژن‌های پت در نتیجه نیستند
- [ ] `matchedTags` در هر آیتم هست
- [ ] اگر `petId` متعلق به کاربر دیگری باشد → `404`

---

## بخش ۶ — سبد خرید

### S6.1 — اضافه کردن به سبد
```bash
curl -s -X POST $BASE/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"variantId":1,"quantity":2}'

curl -s -X POST $BASE/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"variantId":1,"quantity":3}'
```
- [ ] بعد از درخواست دوم quantity جمع می‌شود (۵)

### S6.2 — مشاهده سبد
```bash
curl -s $BASE/cart \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
- [ ] `unitPrice` و `total` از قیمت فعلی Variant محاسبه شده‌اند
- [ ] `stock` عددی دیده نمی‌شود

### S6.3 — افزودن بیش از موجودی
```bash
curl -s -X POST $BASE/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"variantId":2,"quantity":100}'
```
**انتظار:** `400`, `code: "OUT_OF_STOCK"`

---

## بخش ۷ — کوپن و پرداخت

### S7.1 — اعتبارسنجی کوپن
```bash
curl -s -X POST $BASE/coupons/validate \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"WELCOME20"}'
```
**انتظار:**
```json
{
  "success": true,
  "data": {
    "code": "WELCOME20",
    "discountAmount": 50000,
    "finalAmount": <itemsTotal - 50000 + shippingCost>
  }
}
```
- [ ] `discountAmount` از `maxDiscount` تجاوز نمی‌کند

### S7.2 — جریان کامل checkout
```bash
curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addressId":'$ADDRESS_ID',"couponCode":"WELCOME20","note":"زود برسه"}'
```
**انتظار:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderNumber": "PT-...",
    "status": "PENDING_PAYMENT",
    "finalAmount": <عدد>,
    "addressSnapshot": { "city": "تهران", ... }
  }
}
```
- [ ] سبد خرید بعد از checkout خالی شده
- [ ] `addressSnapshot` کپی کامل آدرس است
- [ ] `finalAmount` روی سرور محاسبه شده

### S7.3 — شروع پرداخت (mock)
```bash
curl -s -X POST $BASE/payments/start \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":'$ORDER_ID'}'
```
**انتظار:** `{ "success": true, "data": { "paymentUrl": "http://..." } }`
- [ ] کاربر دیگری نمی‌تواند برای سفارش این کاربر payment شروع کند

### S7.4 — Callback پرداخت موفق
```bash
curl -s "$BASE/payments/callback?Authority=<authority>&Status=OK"
```
- [ ] redirect به `FRONTEND_PAYMENT_RESULT_URL?orderNumber=...&status=success`
- [ ] وضعیت سفارش `PAID` شده

### S7.5 — Idempotency پرداخت
```bash
curl -s "$BASE/payments/callback?Authority=<همان_authority>&Status=OK"
curl -s "$BASE/payments/callback?Authority=<همان_authority>&Status=OK"
```
- [ ] موجودی دو بار کم نشده
- [ ] دو ردیف Payment موفق ایجاد نشده

---

## بخش ۸ — منطق‌های حساس

### S8.1 — موجودی اتمیک (مهم‌ترین تست)
```bash
# دو checkout همزمان برای همان variant با موجودی ۱
curl -s -X POST $BASE/orders ... &
curl -s -X POST $BASE/orders ... &
wait
```
- [ ] دقیقاً یکی موفق و دیگری `OUT_OF_STOCK`
- [ ] موجودی در دیتابیس `0` است (نه منفی)

### S8.2 — انقضای سفارش و بازگشت موجودی
- [ ] موجودی به همان عدد اول برگشت
- [ ] وضعیت سفارش `CANCELED` شده
- [ ] کوپن استفاده‌شده دوباره قابل استفاده است

### S8.3 — لغو سفارش توسط کاربر
```bash
curl -s -X POST $BASE/orders/$ORDER_ID/cancel \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```
- [ ] سفارش `PAID` شده قابل لغو نیست → `ORDER_INVALID_STATE`

### S8.4 — مبلغ پرداخت باید با سفارش match کند
- [ ] اگر `gateway.verify()` مبلغی متفاوت برگرداند، سفارش PAID نمی‌شود

---

## بخش ۹ — داروخانه و دارو

### S9.1 — جستجوی دارو
```bash
curl -s "$BASE/medicines?q=آموكسي"     # با ك عربی
curl -s "$BASE/medicines?q=آموکسی"     # با ک فارسی
```
- [ ] هر دو نتیجه یکسانی می‌دهند

### S9.2 — جزئیات دارو
```bash
curl -s "$BASE/medicines/1"
```
- [ ] `disclaimer` در پاسخ هست
- [ ] `price` یا `stock` در پاسخ نیست
- [ ] `lastConfirmedAt` برای هر داروخانه نمایش داده می‌شود

---

## چک‌لیست نهایی

| بخش | عنوان | نتیجه |
|---|---|---|
| S1 | Bootstrap و health | ☐ قبول / ☐ مردود |
| S2 | Auth و OTP | ☐ قبول / ☐ مردود |
| S3 | پروفایل و آدرس | ☐ قبول / ☐ مردود |
| S4 | پت و تگ‌ها | ☐ قبول / ☐ مردود |
| S5 | کاتالوگ و پیشنهاد | ☐ قبول / ☐ مردود |
| S6 | سبد خرید | ☐ قبول / ☐ مردود |
| S7 | checkout و پرداخت | ☐ قبول / ☐ مردود |
| S8 | منطق‌های حساس | ☐ قبول / ☐ مردود |
| S9 | دارو و داروخانه | ☐ قبول / ☐ مردود |

**سیستم آماده production است اگر همه بخش‌ها قبول شده باشند.**
اگر S8 (موجودی اتمیک، idempotency پرداخت) مردود باشد، **قبل از هر چیز دیگری** باید رفع شود.