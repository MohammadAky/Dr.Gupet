# [بالا] محدودکنندهٔ HTTP برای OTP فعال نشده است

## شواهد

- `backend/src/app.module.ts:52-62` فقط `ThrottlerModule` را تنظیم می‌کند؛ در `:96-104` دو `APP_GUARD` موجود فقط `JwtAuthGuard` و `RolesGuard` هستند. در کل `backend/src` هیچ `ThrottlerGuard` ثبت نشده است.
- `backend/src/modules/auth/auth.controller.ts:16-29` دکوراتورهای `@Throttle` روی درخواست و تأیید OTP دارد، ولی بدون guard اجرا نمی‌شوند.
- `backend/src/modules/auth/otp.service.ts:28-60` فقط شمارهٔ مقصد را با cooldown و شمارش ساعتی کنترل می‌کند؛ برای درخواست‌های چندین شماره از یک مبدأ سقف مستقل ندارد. بررسی cooldown و ثبت آن نیز چند فرمان Redis جداست.

## بازتولید در محیط ایزوله

با SMS mock و Redis، بیش از ۱۰ درخواست OTP در یک دقیقه از یک IP به شماره‌های متفاوت بفرستید. هیچ guard سراسری برای خواندن `@Throttle` وجود ندارد؛ فقط سقف هر شماره اعمال می‌شود. دو درخواست همزمان برای یک شماره نیز می‌توانند هر دو از `exists(cooldownKey)` عبور کنند، چون ثبت cooldown بعد از تولید OTP است.

## اثر و معیار رفع

هزینه و مزاحمت پیامکی و بار روی API قابل افزایش است. `ThrottlerGuard` را ثبت و رفتار 429 را با تست HTTP اثبات کنید؛ سقف مستقل برای IP/هویت و سقف شماره را نگه دارید. claim اتمیک cooldown در Redis و تست درخواست‌های همزمان لازم است. اگر پشت reverse proxy هستید، IP واقعی را فقط از proxy مورد اعتماد بخوانید.
