# [متوسط] اعتبارسنجی بدنهٔ نوشتن دارو و کلینیک در قرارداد اجرا نمی‌شود

## شواهد ثابت — ۲۰۲۶-۱۰-۰۴، main در 0160b12

- backend/src/modules/clinics/admin-clinics.controller.ts و backend/src/modules/medicines/admin-medicines.controller.ts بدنهٔ create/update را به صورت object یا Partial TypeScript تعریف کرده‌اند، نه DTO کلاس با class-validator.
- ValidationPipe سراسری در backend/src/main.ts برای این نوع‌های پاک‌شده در runtime نمی‌تواند whitelist، forbidNonWhitelisted و محدودیت فیلدها را مانند DTO اعمال کند.
- clinics.service.ts در update، body را مستقیم به data در Prisma می‌دهد؛ مرز فیلدهای ویرایش‌پذیر باید صریح باشد.

## معیار رفع و پذیرش

DTOهای ایجاد/ویرایش با اعتبارسنجی رشتهٔ غیرخالی و طول، boolean واقعی، مختصات معتبر، شناسهٔ صحیح و فهرست محدود تعریف شوند؛ ورودی ناشناخته و نوع نامعتبر با 400 امن رد شوند. در service تنها فیلدهای مجاز map شوند. با حساب مدیر ایزوله، مقدار خالی/نوع اشتباه/فیلد اضافه را بررسی کنید و از عدم تغییر داده و عدم نشت خطای ORM مطمئن شوید.

دسترسی ناشناس به هر دو مسیر در محیط واقعی آزمایشی 401 بود؛ دورزدن نقش ادعا نشده است. پذیرش اعتبارسنجی نوشتن پس از OTP واقعی هنوز باز است؛ یافته از کد است و به‌عنوان exploit زنده گزارش نمی‌شود. بک‌اند مخزن ویرایش نشده است.

## بازبینی در 4cf0f77 — باز

`backend/src/modules/clinics/admin-clinics.controller.ts:37-50,98-111` و `backend/src/modules/medicines/admin-medicines.controller.ts:55-67,86-98` همچنان object/Partial محو‌شوندهٔ TypeScript دارند. `backend/src/modules/clinics/clinics.service.ts:147-150` نیز data دریافتی را مستقیم به Prisma update می‌دهد. وجود ValidationPipe در `backend/src/main.ts:35-40` برای بدنهٔ Object جای DTO تزئین‌شده را نمی‌گیرد.

افزودن فهرست/جزئیات ادمین و تست visibility تغییر واقعی و مفید است، ولی اعتبارسنجی بدنهٔ create/update را اثبات نمی‌کند. شواهد فعلی ثابت‌اند؛ ارسال ورودی malformed با ادمین و عدم تغییر رکورد/عدم نشت خطای ORM هنوز معیار پذیرش است. ادعای بسته‌شدن این پرونده از تیک کلی STATUS نباید برداشت شود.
