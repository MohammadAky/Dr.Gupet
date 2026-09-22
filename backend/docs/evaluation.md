# ارزیابی بکند Pet System — MVP v1

> **نحوه استفاده:** سوالات به ترتیب اجرا شوند. هر بخش روی یک لایه از جریان متمرکز است.  
> پیش از شروع: `docker compose up -d` و `BASE=http://localhost:3000/api/v1`.

---

## بخش ۱ — Bootstrap و سلامت سیستم

### S1.1 — Health check

```bash
curl -s $BASE/health
```

**انتظار:**
```json
{ "success": true, "data": { "status": "ok" } }
```

❓ آیا پاسخ دقیقاً این envelope را دارد؟ `success` و `data` هر دو حضور دارند؟

---

### S1.2 — Route ناشناخته

```bash
curl -s $BASE/does-not-exist
```

**انتظار:**
```json
{ "success": false, "statusCode": 404, "code": "NOT_FOUND", "message": "..." }
```

❓ آیا stack trace یا پیام خام Prisma/NestJS در `message` وجود دارد؟ (نباید باشد)

---

### S1.3 — Swagger در dev

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/docs
```

**انتظار:** `200`

❓ اگر `NODE_ENV=production` باشد، همین درخواست باید `404` بدهد.

---

## بخش ۲ — Auth و OTP

### S2.1 — درخواست OTP با شماره معتبر

```bash
curl -s -X POST $BASE/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"09120000001"}'
```

**انتظار:**
```json
{ "success": true, "data": { "expiresIn": 120 } }
```

❓ آیا `expiresIn` عدد ثانیه است (نه رشته)؟ آیا در stdout لاگ کد OTP را می‌بینید (در dev)؟

---

### S2.2 — درخواست OTP با شماره نامعتبر

```bash
curl -s -X POST $BASE/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"0912abc1234"}'
```

**انتظار:** `statusCode: 400`, `code: "VALIDATION_ERROR"`

❓ آیا پیام خطا به **فارسی** است؟

---

### S2.3 — OTP غلط

```bash
curl -s -X POST $BASE/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"09120000001","code":"00000"}'
```

**انتظار:** `statusCode: 401`, `code: "OTP_INVALID"`

❓ بعد از ۵ بار تلاش غلط، کد باید expire شود. آیا بار ششم `OTP_EXPIRED` می‌دهد؟

---

### S2.4 — Cooldown مجدد ارسال OTP

```bash
# درخواست اول
curl -s -X POST $BASE/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"09120000002"}'
# بلافاصله دوباره
curl -s -X POST $BASE/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"09120000002"}'
```

**انتظار دومی:** `statusCode: 429`, `code: "OTP_RATE_LIMITED"`

---

### S2.5 — ثبت‌نام و ورود با OTP صحیح (کاربر جدید)

```bash
# 1. درخواست OTP
curl -s -X POST $BASE/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"09130000001"}'

# 2. تأیید (از لاگ کد را بخوانید، یا از OTP_DEV_CODE=12345 استفاده کنید)
curl -s -X POST $BASE/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"09130000001","code":"12345"}'
```

**انتظار:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "isNewUser": true,
    "user": { "id": 1, "phone": "09130000001", "firstName": null }
  }
}
```

❓ آیا `isNewUser: true` برای اولین ورود است؟ آیا `role` یا `status` کاربران دیگر در پاسخ وجود دارد؟

> **متغیر را ذخیره کنید:** `ACCESS_TOKEN=<مقدار accessToken>`

---

### S2.6 — دسترسی بدون token

```bash
curl -s $BASE/users/me
```

**انتظار:** `statusCode: 401`, `code: "UNAUTHORIZED"`

---

### S2.7 — Refresh token

```bash
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken از S2.5>"}'
```

**انتظار:** جفت token جدید. 

❓ آیا بعد از refresh، استفاده از **refresh token قدیمی** باز هم token می‌دهد؟ (نباید — باید rotate شده باشد)

---

### S2.8 — Logout

```bash
curl -s -X POST $BASE/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refreshToken جدید از S2.7>"}'

# و بعد سعی کنید دوباره refresh کنید
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

❓ آیا فیلدهای `role` و `status` در پاسخ هستند؟ (ممکن است عمداً برگردانده شده باشند، ولی باید مطمئن شوید که `status` کاربران **دیگر** هیچ‌وقت لیک نمی‌شود)

---

### S3.2 — ویرایش پروفایل

```bash
curl -s -X PATCH $BASE/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"علی","lastName":"رضایی"}'
```

❓ آیا ارسال `{"phone":"09999999999"}` در همین endpoint **تغییری ایجاد نمی‌کند**؟ (phone نباید قابل ویرایش باشد)

---

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

> **متغیر:** `ADDRESS_ID=<id از پاسخ>`

❓ آیا اولین آدرس به‌طور خودکار `isDefault: true` می‌شود؟

---

### S3.4 — Isolation بین دو کاربر

```bash
# ابتدا یک کاربر دیگر بسازید (S2.5 با شماره 09130000002) و آدرسش را بگیرید
# حالا با token کاربر اول سعی کنید آدرس کاربر دوم را ویرایش کنید:
curl -s -X PATCH $BASE/addresses/<id_آدرس_کاربر_دوم> \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"هک"}'
```

**انتظار:** `404 NOT_FOUND` (نه `403 FORBIDDEN`)

❓ آیا واقعاً `404` است؟ اگر `403` است، یعنی وجود آدرس لیک شده — باید `404` باشد.

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

> **متغیر:** `PET_ID=<id>`

❓ آیا `breedId` متعلق به `petTypeId` دیگری → `400` می‌دهد؟

---

### S4.2 — تعیین تگ‌های پت (آلرژن و رژیم)

```bash
curl -s -X PUT $BASE/pets/$PET_ID/tags \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"allergenTagIds":[1,2],"dietTagIds":[10,11]}'
```

❓ اگر یک `allergenTagId` را در `dietTagIds` هم ارسال کنیم، `400` می‌دهد؟

❓ بعد از ارسال مجدد با تگ‌های جدید، آیا تگ‌های قبلی کاملاً **جایگزین** می‌شوند (نه اضافه)؟

---

### S4.3 — محاسبه lifeStage

```bash
# پت توله (زیر ۱۲ ماه)
curl -s -X POST $BASE/pets \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"بچه‌گربه","petTypeId":2,"birthDate":"2026-06-01","gender":"FEMALE","isNeutered":false}'
```

❓ آیا در پاسخ `lifeStage: "PUPPY_KITTEN"` است؟ (نه فیلد خام `birthDate` بدون محاسبه)

---

## بخش ۵ — کاتالوگ و پیشنهاد محصول

### S5.1 — لیست محصولات با فیلتر

```bash
# فیلتر ترکیبی: سگ، بالغ، موجود
curl -s "$BASE/products?petTypeId=1&lifeStage=ADULT&inStock=true&page=1&limit=5"
```

❓ آیا `meta` شامل `total`، `page`، `limit`، `totalPages` است؟  
❓ آیا `stock` عددی در هیچ‌کدام از محصولات وجود دارد؟ (نباید — فقط `inStock: boolean`)

---

### S5.2 — جستجو با حروف عربی

```bash
# فرض: محصولی با نام "رویال کنین" در دیتابیس هست
curl -s "$BASE/products?q=رويال%20كنين"   # با ي و ك عربی
curl -s "$BASE/products?q=رویال%20کنین"   # با ی و ک فارسی
```

❓ هر دو جستجو نتیجه یکسانی می‌دهند؟

---

### S5.3 — جزئیات محصول

```bash
curl -s "$BASE/products/<slug-محصول>"
```

❓ آیا `variants` بر اساس `weightGram` مرتب شده‌اند (کمترین به بیشترین)؟  
❓ آیا Variantهای `isActive: false` در پاسخ هستند؟ (نباید)

---

### S5.4 — پیشنهاد محصول برای پت

```bash
curl -s "$BASE/products/recommendations?petId=$PET_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

❓ آیا محصولاتی که حاوی آلرژن‌های پت هستند در نتیجه وجود دارند؟ (نباید)  
❓ آیا `matchedTags` در هر آیتم هست؟  
❓ اگر `petId` متعلق به کاربر دیگری باشد → `404`؟

---

## بخش ۶ — سبد خرید

### S6.1 — اضافه کردن به سبد

```bash
curl -s -X POST $BASE/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"variantId":1,"quantity":2}'

# اضافه کردن دوباره همان variant
curl -s -X POST $BASE/cart/items \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"variantId":1,"quantity":3}'
```

❓ آیا بعد از درخواست دوم، quantity **جمع** می‌شود (۵) نه یک CartItem جدید؟

---

### S6.2 — مشاهده سبد

```bash
curl -s $BASE/cart \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

❓ آیا `unitPrice` و `total` هر آیتم از **قیمت فعلی Variant** محاسبه شده‌اند (نه مقداری که موقع add ذخیره شده)؟  
❓ آیا `stock` عددی دیده می‌شود؟ (نباید)

---

### S6.3 — افزودن بیش از موجودی

```bash
# فرض: variantId=2 فقط ۳ تا موجودی دارد
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
# ابتدا seed یک کوپن PERCENT (مثلاً کد WELCOME20، ۲۰٪، حداکثر ۵۰۰۰۰) باید وجود داشته باشد
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

❓ آیا `discountAmount` از `maxDiscount` تجاوز نمی‌کند حتی اگر ۲۰٪ سبد بیشتر باشد؟

---

### S7.2 — جریان کامل checkout

```bash
# گام ۱: ثبت سفارش
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

> **متغیر:** `ORDER_ID=<id>`

❓ آیا سبد خرید بعد از checkout **خالی** شده؟  
❓ آیا `addressSnapshot` کپی کامل آدرس است (نه فقط id)؟  
❓ آیا `finalAmount` روی سرور محاسبه شده (نه از body درخواست)؟

---

### S7.3 — شروع پرداخت (mock)

```bash
curl -s -X POST $BASE/payments/start \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orderId":'$ORDER_ID'}'
```

**انتظار:**
```json
{ "success": true, "data": { "paymentUrl": "http://..." } }
```

❓ آیا کاربر دیگری می‌تواند برای سفارش این کاربر payment شروع کند؟ (نباید)

---

### S7.4 — Callback پرداخت موفق (mock driver)

```bash
# URL را از paymentUrl بگیرید و callback را شبیه‌سازی کنید
curl -s "$BASE/payments/callback?Authority=<authority>&Status=OK"
```

❓ آیا redirect به `FRONTEND_PAYMENT_RESULT_URL?orderNumber=...&status=success` انجام می‌شود؟  
❓ وضعیت سفارش الان `PAID` است؟

```bash
curl -s $BASE/orders/$ORDER_ID \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

### S7.5 — Idempotency پرداخت

```bash
# همان callback را دوبار ارسال کنید
curl -s "$BASE/payments/callback?Authority=<همان_authority>&Status=OK"
curl -s "$BASE/payments/callback?Authority=<همان_authority>&Status=OK"
```

❓ آیا موجودی دو بار کم شد؟ (نباید — باید idempotent باشد)  
❓ آیا دو ردیف Payment موفق در دیتابیس ایجاد شد؟ (نباید)

---

## بخش ۸ — منطق‌های حساس

### S8.1 — موجودی اتمیک (مهم‌ترین تست)

```bash
# یک variant با موجودی ۱ پیدا کنید یا seed کنید
# دو checkout همزمان برای همان variant ارسال کنید:
curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN_1" \
  -H "Content-Type: application/json" \
  -d '{"addressId":'$ADDRESS_ID_1',"note":"کاربر ۱"}' &

curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $ACCESS_TOKEN_2" \
  -H "Content-Type: application/json" \
  -d '{"addressId":'$ADDRESS_ID_2',"note":"کاربر ۲"}' &

wait
```

❓ آیا **دقیقاً یکی** موفق و دیگری `OUT_OF_STOCK` می‌گیرد؟  
❓ موجودی در دیتابیس `0` است (نه منفی)؟

---

### S8.2 — انقضای سفارش و بازگشت موجودی

```bash
# موجودی variant را قبل از checkout یادداشت کنید
# سفارش ثبت کنید ولی پرداخت نکنید
# منتظر بمانید تا job انقضا اجرا شود (یا ORDER_EXPIRE_MINUTES را موقتاً ۱ کنید)
# بعد موجودی همان variant را بررسی کنید
```

❓ آیا موجودی به همان عدد اول برگشت؟  
❓ آیا وضعیت سفارش `CANCELED` شده؟  
❓ آیا کوپن استفاده‌شده در آن سفارش دوباره قابل استفاده است؟

---

### S8.3 — لغو سفارش توسط کاربر

```bash
# یک سفارش PENDING_PAYMENT جدید بسازید
curl -s -X POST $BASE/orders/$ORDER_ID/cancel \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

❓ آیا سفارش `PAID` شده قابل لغو است؟ (نباید، باید `ORDER_INVALID_STATE` بدهد)

---

### S8.4 — مبلغ پرداخت باید با سفارش match کند

```bash
# سعی کنید یک سفارش ۱۰۰۰۰۰ تومانی را با مبلغ ۱ ریال verify کنید
# این تست را در یک gateway test یا unit test بررسی کنید
```

❓ آیا اگر `gateway.verify()` مبلغی متفاوت برگرداند، سفارش **PAID نمی‌شود**؟

---

## بخش ۹ — داروخانه و دارو

### S9.1 — جستجوی دارو

```bash
curl -s "$BASE/medicines?q=آموكسي"     # با ك عربی
curl -s "$BASE/medicines?q=آموکسی"     # با ک فارسی
```

❓ هر دو نتیجه یکسانی می‌دهند؟

---

### S9.2 — جزئیات دارو

```bash
curl -s "$BASE/medicines/1"
```

❓ آیا `disclaimer` در پاسخ هست؟  
❓ آیا `price` یا `stock` در هیچ‌کجای پاسخ وجود دارد؟ (نباید)  
❓ آیا `lastConfirmedAt` برای هر داروخانه نمایش داده می‌شود؟

---

## چک‌لیست نهایی ارزیابی

در پایان هر بخش این جدول را تکمیل کنید:

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
