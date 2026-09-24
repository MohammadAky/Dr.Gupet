# لیست باگ‌های بک‌اند (Backend Bug Report)

> **تاریخ گزارش:** ۲۴ سپتامبر ۲۰۲۶ (بر اساس کامیت `d3f99bc` در شاخه `main`)  
> **مخزن:** `https://github.com/MohammadAky/Dr.Gupet`  
> **هدف:** گزارش خطاهایی که در کد موجود بک‌اند وجود دارد (نه موارد پیاده‌سازی‌نشده) جهت رفع توسط مسئول بک‌اند.

---

## ۱. باگ‌های بحرانی (باعث خطای کامپایل یا شکست قطعی اجرا می‌شوند)

### باگ ۱: خطای نوع داده و فقدان فیلد `minPrice` در مدل Product (شناسه: SCHEMA-001)
- **محل در کد:**
  - `backend/prisma/seed.ts` (خطوط ۱۴۵، ۱۶۱، ۱۷۷)
  - `backend/src/modules/products/product-variants.service.ts` (خط ۲۴)
  - `backend/src/modules/products/products.service.ts` (خطوط ۱۱۲، ۱۱۳)
- **شرح باگ:**
  در اسکریپت `seed.ts` و در متد `recalculateMinPrice`، فیلد `minPrice` روی مدل `Product` فراخوانی و مقداردهی می‌شود:
  ```typescript
  // prisma/seed.ts:145
  await prisma.product.upsert({
    create: { ..., minPrice: 890000 },
  });
  // product-variants.service.ts:24
  await this.prisma.product.update({
    where: { id: productId },
    data: { minPrice: cheapest?.price || 0 },
  });
  ```
  اما در فایل `backend/prisma/schema.prisma` (خطوط ۲۴۹ تا ۲۷۹)، مدل `Product` **اصلاً فیلدی به نام `minPrice` ندارد**.
- **نتیجه:** اجرای `tsc` خطای قطعی `TS2353` می‌دهد و اسکریپت `seed` یا متد مرتب‌سازی بر اساس قیمت (`sort=price_asc / price_desc`) در صورت کامپایل هم در زمان اجرا روی پایگاه‌داده خطا می‌اندازد.
- **راه حل پیشنهادی:** یا فیلد `minPrice Int @default(0)` به همراه ایندکس و مایگریشن به `schema.prisma` اضافه شود، یا مقداردهی‌های مستقیم آن از سرویس و seed حذف شده و به صورت داینامیک محاسبه شود.

---

### باگ ۲: ایمپورت اشتباه دکوراتور `Throttle` در ماژول احراز هویت
- **محل در کد:**
  `backend/src/modules/auth/auth.controller.ts` (خط ۹):
  ```typescript
  import { Throttle } from '@nestjs/common';
  ```
- **شرح باگ:**
  دکوراتور `@Throttle` در پکیج `@nestjs/common` وجود ندارد؛ این دکوراتور متعلق به پکیج `@nestjs/throttler` است.
- **نتیجه:** خطای کامپایل قطعی:
  `error TS2305: Module '"@nestjs/common"' has no exported member 'Throttle'.`
- **راه حل پیشنهادی:** تغییر مسیر ایمپورت به:
  ```typescript
  import { Throttle } from '@nestjs/throttler';
  ```

---

### باگ ۳: ارجاع به فیلد ناموجود `lastConfirmedAt` روی PharmacySelect
- **محل در کد:**
  `backend/src/modules/medicines/medicines.service.ts` (خطوط ۸۳ و ۱۰۳)
- **شرح باگ:**
  فیلد `lastConfirmedAt` روی جدول رابط `PharmacyMedicine` تعریف شده است، اما در کوئری دارو، داخل بلوک `pharmacy.select` درخواست داده شده است:
  ```typescript
  // medicines.service.ts:83
  select: {
    id: true,
    name: true,
    city: true,
    address: true,
    phone: true,
    is24h: true,
    isVerified: true,
    lastConfirmedAt: true, // این فیلد در مدل Pharmacy وجود ندارد!
  }
  ```
- **نتیجه:** خطای تایپ `TS2353: Object literal may only specify known properties, and 'lastConfirmedAt' does not exist in type 'PharmacySelect'`.
- **راه حل پیشنهادی:** فیلد `lastConfirmedAt` باید از رکورد رابطه `pm.lastConfirmedAt` خوانده شود، نه از داخل آبجکت `pharmacy`.

---

### باگ ۴: ارجاع به `name` در جایی که داخل Select تعریف نشده در ثبت سفارش
- **محل در کد:**
  `backend/src/modules/orders/orders.service.ts` (خط ۱۳۳)
- **شرح باگ:**
  در متد `checkout`، ابتدا اقلام سبد خرید واکشی می‌شوند:
  ```typescript
  // orders.service.ts:50-55
  include: {
    variant: {
      include: { product: { select: { isActive: true } } }, // فقط isActive درخواست شده
    },
  }
  ```
  سپس در زمان ایجاد OrderItem (خط ۱۳۳):
  ```typescript
  productName: item.variant.product.name || 'Product',
  ```
  چون `name` در `select` کوئری بالا قید نشده، فیلد `name` روی `product` اصلاً لود نشده است و تایپ‌اسکریپت خطای `TS2339` می‌دهد و در زمان اجرا `undefined` می‌شود (و به fallback نامطلوب 'Product' تبدیل می‌شود).
- **راه حل پیشنهادی:** فیلد `name: true` به `select` مربوط به `product` اضافه شود:
  ```typescript
  select: { isActive: true, name: true }
  ```

---

### باگ ۵: ناسازگاری متد `useStaticAssets` با تایپ پیش‌فرض اپلیکیشن در `main.ts`
- **محل در کد:**
  `backend/src/main.ts` (خطوط ۹ و ۳۷)
- **شرح باگ:**
  اپلیکیشن با `NestFactory.create(AppModule)` ساخته شده است که تایپ `INestApplication` برمی‌گرداند. متد `useStaticAssets` متد اختصاصی Express است و روی تایپ جنریک `INestApplication` تعریف نشده است:
  ```typescript
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  ```
- **نتیجه:** خطای کامپایل `TS2339: Property 'useStaticAssets' does not exist on type 'INestApplication<any>'`.
- **راه حل پیشنهادی:** اضافه کردن جنریک `<NestExpressApplication>` به فراخوانی `create` و ایمپورت آن از پلتفرم مربوطه.

---

### باگ ۶: فقدان تایپ‌های Express Multer در کنترلر و سرویس Upload
- **محل در کد:**
  - `backend/src/upload/upload.controller.ts` (خط ۳۰)
  - `backend/src/upload/upload.service.ts` (خط ۳۹)
- **شرح باگ:**
  نوع داده آرگومان فایل `Express.Multer.File` قرار داده شده، در حالی که پکیج `@types/multer` در وابستگی‌های `package.json` نصب نشده است.
- **نتیجه:** خطای کامپایل:
  `error TS2694: Namespace 'global.Express' has no exported member 'Multer'.`
- **راه حل پیشنهادی:** افزودن پکیج `@types/multer` به عنوان devDependency.

---

## ۲. باگ‌های قرارداد و منطق عملکردی (Logic & Contract Bugs)

### باگ ۷: رفتار اشتباه بولین در کوئری فیلتر محصولات (`inStock`)
- **محل در کد:**
  `backend/src/modules/products/dto/product-query.dto.ts` (خط ۵۹)
- **شرح باگ:**
  برای فیلد `inStock` از دکوراتور `@Type(() => Boolean)` استفاده شده است. در جاوااسکریپت، تبدیل رشته به بولین با این روش باعث می‌شود رشته `'false'` هم به مقدار بولی `true` تبدیل شود (`Boolean('false') === true`).
- **نتیجه:** اگر کلاینت `?inStock=false` بفرستد، سرور آن را `true` تفسیر کرده و فقط کالاهای موجود را برمی‌گرداند!
- **راه حل پیشنهادی:** استفاده از `@Transform(({ value }) => value === 'true' || value === true || value === '1')`.

---

### باگ ۸: عدم ارسال شناسه عددی سفارش در Callback درگاه پرداخت
- **محل در کد:**
  `backend/src/modules/payments/payments.callback.controller.ts` (خط ۳۸)
- **شرح باگ:**
  در متد ریدایرکت نهایی به فرانت‌اند:
  ```typescript
  const redirectUrl = `${frontendUrl}?orderNumber=${result.orderNumber}&status=${result.success ? 'success' : 'failed'}`;
  ```
  فقط `orderNumber` در کوئری ارسال می‌شود، در حالی که اندپوینت دریافت جزئیات سفارش `GET /api/v1/orders/:id` فقط بر اساس شناسه عددی (`id`) کار می‌کند و اندپوینتی برای دریافت سفارش بر اساس `orderNumber` وجود ندارد.
- **نتیجه:** فرانت‌اند بعد از بازگشت از درگاه نمی‌تواند مستقیماً سفارش را لود کند (مگر اینکه لیست سفارش‌ها را اسکن کند).
- **راه حل پیشنهادی:** ارسال `orderId` در پارامترهای ریدایرکت:
  `?orderId=${result.orderId}&orderNumber=${result.orderNumber}&status=...`

---

### باگ ۹: عدم تعیین نسخه‌های وابستگی‌ها در `package.json` بک‌اند
- **محل در کد:**
  `backend/package.json`
- **شرح باگ:**
  تمام نسخه‌ها به صورت رشته خالی `""` رها شده‌اند. این امر باعث می‌شود دستور `npm install` در سال ۲۰۲۶ نسخه `prisma@8.0.0-rc.15` (پلتفرم جدید پریزما که دستور `generate` ندارد) و `typescript@6.0.3` و `@nestjs/core@12.x` را نصب کند که با کدهای پروژه ناسازگارند و کامپایل را می‌شکنند.
- **راه حل پیشنهادی:** قفل کردن نسخه‌های سازگار (مثلاً `prisma@^6.19.0`, `@prisma/client@^6.19.0`, `typescript@^5.7.0`) و کامیت کردن `package-lock.json`.

---

## ۳. جمع‌بندی
این ۹ مورد **خطاهای قطعی و باگ‌های کدی** هستند که مانع از اجرای صحیح یا کامپایل پروژه می‌شوند. همه موارد همراه با فایل و شماره خطوط مستند شده‌اند تا همکار محترم بک‌اند بتواند به راحتی آن‌ها را تصحیح نماید.

