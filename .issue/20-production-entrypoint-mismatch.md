# [بالا] مسیر اجرای production با خروجی build یکسان نیست

## شواهد — ۲۰۲۶-۱۰-۰۴، main در 0160b12

- backend/package.json، start:prod برابر node dist/main است؛ backend/Dockerfile نیز پس از migrate deploy همین مسیر را اجرا می‌کند.
- build پاک در محیط آزمایشی با همان package-lock و tsconfigها موفق شد، اما entrypoint واقعی dist/src/main.js بود و dist/main.js وجود نداشت.
- tsconfig.build.json فایل prisma/seed.ts را exclude نکرده و tsconfig.json نیز rootDir را روی src محدود نکرده است؛ خروجی src زیرپوشهٔ خود را نگه می‌دارد.

## معیار رفع

build پاک و entrypoint scripts/Docker هماهنگ شوند. اگر rootDir/exclude اصلاح شد، seed و تست‌ها از build سرویس جدا شوند. اجرای npm run start:prod و تصویر Docker در CI باید بالا آمدن API و health را اثبات کنند؛ مسیر حدسی در استقرار استفاده نشود.

محیط XAMPP با entrypoint واقعی dist/src/main.js اجرا شد؛ backend اصلی ویرایش نشده است. تصویر Docker خود برنامه در این نشست ساخته یا اجرا نشده و پذیرش آن ادعا نمی‌شود.
