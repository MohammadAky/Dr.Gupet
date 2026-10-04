# جست‌وجو و صفحه‌بندی عمومی دارو به DTO متصل نیست

**وضعیت:** باز؛ در API واقعی آزمایشی مبتنی بر `0160b12` بازتولید شد؛ کنترلر/سرویس در `a7126ce` تغییر نکرده‌اند.  
**اثر:** بالا؛ صفحه‌بندی و فیلتر معتبر صفحهٔ دارو هم پاسخ 500 می‌دهند، نه فقط ورودی نامعتبر.

## شواهد — ۲۰۲۶-۱۰-۰۴

در `backend/src/modules/medicines/medicines.controller.ts`، متد `findAll` از `@Query() query: PaginationQueryDto & any` استفاده می‌کند. این نوع در runtime کلاس DTO نیست؛ ValidationPipe تبدیل و اعتبارسنجی مورد انتظار را انجام نمی‌دهد. فایل `dto/medicine-query.dto.ts` نیز فعلاً کلاس اجرایی ندارد. در سرویس، `take: limit` و `where.requiresPrescription` مستقیماً از query می‌آیند؛ رشتهٔ HTTP به Prisma می‌رسد.

آزمون خواندنی روی API واقعی SQLite از مسیر Apache:

| درخواست | انتظار | مشاهده |
| --- | --- | --- |
| `GET /api/v1/medicines?page=1&limit=12` | 200 با meta عددی | 500 / INTERNAL_ERROR |
| `GET /api/v1/medicines?requiresPrescription=true` | 200 | 500 / INTERNAL_ERROR |
| `GET /api/v1/medicines?requiresPrescription=false` | 200 | 500 / INTERNAL_ERROR |
| `GET /api/v1/medicines?petTypeId=1` | 200 | 500 / INTERNAL_ERROR |
| `GET /api/v1/medicines?page=0` | 400 / VALIDATION_ERROR | 500 / INTERNAL_ERROR |
| `GET /api/v1/medicines?limit=51` | 400 / VALIDATION_ERROR | 500 / INTERNAL_ERROR |
| `GET /api/v1/medicines?requiresPrescription=maybe` | 400 / VALIDATION_ERROR | 500 / INTERNAL_ERROR |
| query ناشناخته یا `q` با ۱۰۱ حرف | 400 | 200 |

پاسخ عمومی stack trace نداشت؛ افشای اطلاعات یا دورزدن هویت از این آزمون نتیجه نمی‌شود. داده و سورس بک‌اند تغییر نکردند. ناسازگاری `mode` با SQLite پروندهٔ مستقل `.issue/18` است و حذف آن در کپی آزمایشی، این مشکل DTO را حل نکرده است.

## اصلاح درخواستی از مالک بک‌اند

1. کلاس واقعی `MedicineQueryDto` مبتنی بر `PaginationQueryDto` تعریف و در کنترلر استفاده شود.
2. `q` رشته با سقف طول، شناسهٔ پت صحیح مثبت و boolean با تبدیل صریح فقط `true/false` اعتبارسنجی شوند. کلیدهای ناشناخته طبق قرارداد query رد شوند.
3. صفحه، limit و فیلترها در سرویس از DTO تبدیل‌شده دریافت شوند؛ جست‌وجوی فارسی/عربی و صفحه‌بندی با SQLite رسمی تست شوند.
4. تست HTTP از ValidationPipe واقعی تا Prisma واقعی نوشته شود؛ فراخوانی مستقیم سرویس با اعداد/boolean در تست واحد، مشکل رشتهٔ query را آشکار نمی‌کند.

## پذیرش

- تمام queryهای معتبر جدول، با صفحهٔ خالی و غیرخالی، 200 و meta صحیح بدهند.
- ورودی نامعتبر 400 بدهد؛ درخواست معتبر یا خطای اعتبارسنجی 500 نشود.
- صفحهٔ دارو در سایت Apache با فیلتر/صفحه‌بندی و جست‌وجوی هدر قابل استفاده باشد.
- هیچ قیمت/موجودی یا داروی غیرفعال در پاسخ عمومی نشت نکند؛ قرارداد disclaimer جزئیات حفظ شود.
