# Decisions Record — Dr. Gupet Frontend

## DEC-001: Architecture & Technology Stack
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** Vite + React 19 + TypeScript (strict) + React Router v7 + TanStack Query v5 + Zod. The installed, verified local dependency is Zod v4; this differs from the earlier v3 note and is recorded here rather than silently described as v3.
- **Why:** Vite port 5173 matches backend defaults (`CORS_ORIGINS` & `FRONTEND_PAYMENT_RESULT_URL`). React ecosystem has full RTL and Jalali support. TanStack Query manages server state, caching and cart invalidations.
- **Consequences:** All network calls flow through `src/api/client.ts`. Direct `fetch` inside components is forbidden.

## DEC-002: Division of Concerns (Functionality vs Visual Design)
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** This frontend implementation owns all business logic, routing, auth/session rotation, API synchronization, validation, and semantic markup. The owner subsequently assigned visual design and styling to the frontend team using the supplied brand identity and visual references.
- **Why:** Clear boundaries prevent mixing visual regressions with business logic bugs.
- **Consequences:** The visual layer uses `src/styles.css` and `src/styles/*`; behavior and API contracts remain governed by the roadmap and backend interface.

## DEC-003: Token Storage & Refresh Strategy
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** `accessToken` in memory only (never written to web storage). `refreshToken` stored in `localStorage`.
- **Why:** Server rotates refresh tokens in Redis on every use and revokes previous tokens. Storing refresh token allows session persistence across reloads while minimizing access token exposure to XSS.
- **Consequences:** A single-flight refresh gate prevents concurrent 401s and React StrictMode bootstrap replay from sending the same rotating token twice. Identity changes clear the account-agnostic TanStack Query cache. A refresh token in JavaScript-readable storage remains an XSS-sensitive tradeoff that needs deployment security review before public launch.

## DEC-004: Money & Integer Representation
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** All monetary values are integers in Toman. Server is the single source of truth; client only renders values using `formatToman()` with Persian thousands separator (`\u066C`).
- **Consequences:** Client never computes payable amounts. In cart, shipping is displayed as a clearly-marked estimate.

## DEC-005: Owner-supplied visual direction and preview gate
- **Status:** CURRENT VISUAL PREVIEW APPROVED 2026-09-25; phase acceptance pending
- **Date:** 2026-09-25
- **Decision:** Use the owner-supplied logo, `#122F12`, `#D49F28`, and self-hosted Vazirmatn. The Pinterest/21st.dev/motion references inform composition and interaction only; external design assets are not copied. Store visual tokens in `src/styles/tokens.css` and asset rights in `docs/DESIGN_SYSTEM.md`.
- **Consequences:** The owner approved the earlier preview with «نمونه تا اینجا تاییده» and, after the requested menu and cookie corrections, approved the current design and explicitly authorized commit and push on 2026-09-25. This does not close F0/F1 acceptance or authorize a public release. Avoid claims of exclusive ownership over separately licensed photographs; present material later visual changes for review.

## DEC-006: Frontend quality-tool compatibility
- **Status:** IMPLEMENTED FOR LOCAL REVIEW
- **Date:** 2026-09-25
- **Decision:** Use TypeScript 5.9 with the current `typescript-eslint` peer range, ESLint flat config, and Prettier configuration/format script. The pre-existing checkout had TypeScript 7 and no lint script; that combination could not install the current `typescript-eslint` without forcing unsupported peer dependencies.
- **Consequences:** `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, and `prettier --check src` must pass together. Prettier uses `endOfLine: auto` so Windows CRLF and Unix LF checkouts are both accepted without rewriting unrelated files. This is a frontend-only dependency change.

## DEC-007: Optional analytics and advertising
- **Status:** SUPERSEDED BY DEC-011; provider decision open
- **Date:** 2026-09-25
- **Decision:** Store explicit, independently selectable preferences for analytics and advertising, default both to off, and load no optional tracking vendors. Any future provider requires a fresh privacy review, disclosure, consent version change, and checks that scripts cannot load before consent.
- **Consequences:** The former category controls and privacy page were removed from the local UI under DEC-011. Business identity, contact details, retention periods, backend and gateway cookies must still be verified before public release.

## DEC-008: OTP phone privacy in the browser
- **Status:** IMPLEMENTED FOR LOCAL REVIEW
- **Date:** 2026-09-25
- **Decision:** Carry the normalized phone number from OTP request to verification through router state and temporary session storage, not a URL query parameter. Clear it after successful verification or a deliberate return to change the number. Set a document-wide `no-referrer` policy.
- **Consequences:** A page reload in the same tab can still complete the OTP step. Browser history and outbound referrers no longer carry the phone number. The removed privacy page no longer discloses this temporary storage; public privacy disclosures remain a release gate.

## DEC-009: Keep the existing native form architecture

- **Status:** IMPLEMENTED FOR LOCAL REVIEW
- **Date:** 2026-09-25
- **Decision:** The current GitHub frontend uses React forms plus Zod validation. Keep those existing flows rather than adding the roadmap's proposed React Hook Form dependency during the visual/foundation pass.
- **Consequences:** New form behavior still follows the roadmap's validation and Persian error rules. A later form-library migration needs its own evidence and decision.

## DEC-010: English privacy notice and cookie controls

- **Status:** SUPERSEDED BY DEC-011
- **Date:** 2026-09-25
- **Decision:** The owner specifically requested English copy for the cookie banner and `/privacy` page, including first-layer `Accept Cookies` and `Deny Cookies` actions. This is a deliberate exception to the site's general Persian-copy rule. Both choices are one click away and equally prominent; optional categories remain off without an affirmative choice and can be changed later on `/privacy`.
- **Consequences:** The consent UI is scoped with `lang="en"` and `dir="ltr"` inside the Persian RTL shell. No optional vendor is installed. The legal/operator fields, backend and payment-provider cookies, and actual production disclosures still require review before publication.

## DEC-011: Two-choice first-visit notice and right-side mobile menu

- **Status:** OWNER-DIRECTED FOR LOCAL REVIEW
- **Date:** 2026-09-25
- **Decision:** Put the mobile menu button immediately to the right of the circular logo, shifting the logo left. Show an English, floating first-visit cookie notice with only equally prominent `Accept Cookies` and `Deny Cookies` buttons. Remove the footer privacy link, `/privacy` route, category settings, checkboxes, and Save control from the site UI.
- **Consequences:** Both buttons save only the user's response to this notice in `drgupet.cookieNotice.v2`; neither enables an optional vendor or grants permission to introduce one later. Future tracking requires a new notice, disclosure, version, and opt-in before loading. The notice explains essential storage, but the owner-requested removal leaves no persistent public policy or preference-revisit path. This cannot be presented as complete privacy-law compliance; operator identity, actual backend/payment cookies, retention/processors, jurisdiction-specific policy and any required user rights mechanism remain unresolved launch gates.

## DEC-012: Main-only frontend workflow

- **Status:** OWNER-DIRECTED
- **Date:** 2026-09-26
- **Decision:** Develop in the local `main` checkout and do not create another branch unless the owner explicitly requests it. Refresh and inspect GitHub `main` before each development phase, preserve local work, and show a local preview with test results before committing or pushing to `main`.
- **Consequences:** The roadmap's earlier branch-per-phase and PR proposal is superseded. Owner approval of a prior preview does not authorize a later change; each new local result is presented before its commit and push.

## DEC-013: Stable local font assets

- **Status:** IMPLEMENTED FOR LOCAL REVIEW
- **Date:** 2026-09-26
- **Decision:** Keep Vazirmatn weights 400/500/600/700 and the package's exact Arabic, Latin Extended and Latin CSS ranges, but serve unchanged WOFF2/WOFF files copied from `@fontsource/vazirmatn` 5.3.0 under `public/fonts/vazirmatn/`. Import the local `src/styles/fonts.css` instead of CSS that resolves font URLs through `node_modules` during development.
- **Why:** The owner's Firefox screenshot showed font sanitizer errors while the local dependency install was being replaced. Fixed public asset URLs avoid partially installed package paths and give the browser fresh URLs after the interrupted install.
- **Consequences:** The existing SIL OFL notice remains at `public/licenses/Vazirmatn-OFL.txt`. Font assets must be updated together with the CSS and license when the package version changes. This does not resolve API requests when the backend is offline.

## DEC-014: Public clinic directory and searchable filters

- **Status:** OWNER-DIRECTED FOR LOCAL REVIEW
- **Date:** 2026-09-27
- **Decision:** Add public clinic list/detail to the frontend MVP using the backend's existing `GET /clinics` endpoints. Keep booking and admin CRUD out of this frontend scope. Use a reusable, keyboard-accessible searchable dropdown for catalog and directory filters, with free-text city/province entry and local suggestions. No new dependency.
- **Consequences:** Roadmap F10 now includes clinics. Backend `is24h` parsing and admin visibility issues remain with the backend owner. Frontend visual and live API acceptance are separate.

## DEC-015: Local account preview while OTP is unavailable

- **Status:** SUPERSEDED BY DEC-020 ON 2026-10-02
- **Date:** 2026-09-27
- **Decision:** On `localhost` / `127.0.0.1` in Vite development only, entering any nonempty phone text opens a temporary account preview without requesting or verifying an OTP. Keep the real OTP path in production builds. The preview creates no token, is not persisted across reloads, and is visibly marked as a demo.
- **Consequences:** The account shell and profile layout can be reviewed without SMS. Private API operations still require a real backend session and must not be represented as working in the preview. Remove or revisit this temporary mode when the owner provides the SMS integration.

## DEC-016: Independent admin frontend and safe local preview

- **Status:** ADMIN ARCHITECTURE RETAINED; LOCAL PREVIEW SUPERSEDED BY DEC-020; LIVE API ACCEPTANCE PENDING
- **Date:** 2026-09-30
- **Decision:** Build the new administration interface as an independent `admin/` React/Vite app, as specified in the root README. Its network calls live in its own central `admin/src/api/client.ts`; it uses the existing backend OTP endpoints and checks `GET /admin/me` before rendering private screens. Both admin tokens remain only in memory, so a reload requires login again. The visual preview uses explicit sample data only when Vite development runs on localhost and never sends admin writes.
- **Consequences:** The customer app stays separate. The admin app uses the approved brand assets and design tokens from the customer frontend, with no new image rights. The development server proxies `/api` to avoid changing backend CORS; production needs a same-origin proxy or an explicitly allowed admin origin. A live backend and admin OTP session are required before acceptance of API functionality. Security tests must cover non-admin rejection, RAM-only tokens, disabled production demo, and no new cookies.

## DEC-017: حالت روشن/تاریک و بازطراحی سایت

- **Status:** ADMIN THEME IMPLEMENTED; CUSTOMER REDESIGN IN LOCAL REVIEW
- **Date:** 2026-10-01
- **Decision:** کلید دایره‌ای ماه/خورشید در پنل ادمین و سایت اصلی ترجیح `light`/`dark` را فقط برای ظاهر در ذخیره‌سازی محلی نگه می‌دارد. مالک پس از ارسال فوری قبلی، بازطراحی سایت و پنل را دوباره در فاز فعلی خواست. CSS موقت `redesign.css` در فایل‌های موجود ادغام و حذف شد. منابع MotionSite، MotionSites AI و 21st.dev برای الگوی تعامل بررسی شدند؛ کد/تصویر ثالث وارد پروژه نشد. مهارت‌های طراحی در پوشهٔ شخصی Codex نصب شده‌اند و عضو ریپازیتوری نیستند؛ بررسی SkillSpector بنا به درخواست مالک در چت جدا ادامه می‌یابد.
- **Consequences:** هیچ وابستگی یا اسکریپت خارجی برای تم لازم نیست. قراردادهای ورود، توکن، کوکی، API و پول حفظ می‌شوند. بازطراحی فعلی پیش از کامیت و پوش به بازبینی مالک نیاز دارد.

## DEC-018: بازه‌های گزارش فروش پنل ادمین

- **Status:** IMPLEMENTED FOR LOCAL REVIEW; LIVE API ACCEPTANCE PENDING
- **Date:** 2026-10-01
- **Decision:** انتخاب «امروز»، ۷، ۱۴ یا ۳۰ روز اخیر فقط فروش و نمودار فروش را با `GET /admin/reports/sales` و محدودهٔ ISO مشخص تغییر می‌دهد. شاخص‌های وضعیت و تعداد کل کاربران از `GET /admin/dashboard` مستقل‌اند. نمونهٔ محلی هر بازه دادهٔ ساختگی جداگانه دارد. برای «امروز» نمودار یک ستون از مجموع بازه نشان می‌دهد.
- **Consequences:** بک‌اند در `3bb1b99` پارامتر `tz` را پذیرفت. کاندید فعلی فرانت محدوده را از نیمه‌شب `Asia/Tehran` می‌سازد و `tz=Asia/Tehran` را صریح می‌فرستد. محاسبهٔ بازه در تست خودکار بررسی شد؛ صحت نمودار با API زنده هنوز پذیرفته نشده است.

## DEC-019: درج مرحله‌ای محصول در پنل ادمین

- **Status:** IMPLEMENTED FOR LOCAL REVIEW; LIVE API ACCEPTANCE PENDING
- **Date:** 2026-10-01
- **Decision:** فرم ادمین بدون وابستگی تازه از API موجود برای محصول پایه، نخستین واریانت، تصویر اختیاری و برچسب استفاده می‌کند. محصول پایه را غیرفعال می‌سازد و انتشار را پس از موفقیت تمام مرحله‌های انتخابی انجام می‌دهد. شکست مرحله‌ای شناسهٔ محصول غیرفعال را به مدیر نشان می‌دهد تا در جزئیات تکمیل شود. پیش‌نمایش محلی عملیات نوشتن ندارد.
- **Consequences:** API فعلی تراکنش سراسری برای این چند endpoint ندارد. ثبت ناقص ممکن است محصول پیش‌نویس بر جای بگذارد؛ این رفتار در UI آشکار است و فروشگاه محصول ناقص را منتشر نمی‌کند. پذیرش نهایی نیازمند بک‌اند زنده، حساب `ADMIN`، آپلود واقعی و آزمون نقش/کوکی/refresh است.

## DEC-020: مسیر واقعی برای ورود و داده در همهٔ محیط‌ها

- **Status:** OWNER-DIRECTED; IMPLEMENTED FOR LOCAL REVIEW; LIVE API ACCEPTANCE PENDING
- **Date:** 2026-10-02
- **Decision:** مالک حالت نمایشی را برای ورود، داده و مدیریت حذف کرد. فرانت مشتری در لوکال هم فقط شمارهٔ معتبر را به `POST /auth/otp/request` می‌فرستد و پس از `POST /auth/otp/verify` و دریافت نشست معتبر وارد حساب می‌شود. `?demo=1` کلینیک، ورود بدون OTP و مسیر `/dev/ui` حذف شدند. پنل ادمین نیز دیگر ورود یا دادهٔ نمایشی ندارد؛ نمایش بخش خصوصی به OTP واقعی، `GET /admin/me` و نقش `ADMIN` وابسته است. پرداخت مشتری فقط آدرس HTTPS درگاه واقعی `www.zarinpal.com` را می‌پذیرد، نه درگاه ساختگی یا sandbox. حالت‌های loading/empty/error برای پاسخ واقعی API باقی می‌مانند.
- **Consequences:** ارسال پیامک، تنظیم درگاه، استقرار پایدار API و تست نوشتن/آپلود/پرداخت با دادهٔ واقعی بر عهدهٔ بک‌اند و محیط استقرار است؛ تست محلی بدون این سرویس‌ها پذیرش زنده نیست. قرارداد فعلی API از Bearer token استفاده می‌کند، بنابراین فرانت مشتری برای همهٔ fetchها `credentials: 'omit'` می‌فرستد تا حتی پشت proxy هم کوکی مرورگر به API نرود. تصمیم DEC-003 دربارهٔ refresh token در `localStorage` پابرجاست و ریسک XSS آن پیش از انتشار عمومی نیاز به بررسی است. در موبایل جستجو و سبد در نوار بالا، حساب فقط در نوار پایین، و ناوبری صفحه‌ها به‌صورت نوار افقی قابل پیمایش است؛ کلید تم شناور در پایین چپ و جدا از نوارهاست. بازبینی مالک و آزمون API زنده پیش از commit/push و انتشار لازم‌اند.

## DEC-021: منوی همبرگری موبایل و جست‌وجوی مستقل

- **Status:** OWNER-DIRECTED; IMPLEMENTED FOR LOCAL REVIEW
- **Date:** 2026-10-02
- **Decision:** مالک روشن کرد که منوی همبرگری موبایل باید باقی بماند. آیکون جست‌وجو مستقل از آن و کنار سبد خرید در نوار بالا قرار می‌گیرد؛ فیلد جست‌وجو با لمس آیکون باز می‌شود و داخل منوی همبرگری نیست. لینک‌های ناوبری در همان منوی همبرگری هستند. ورود و حساب فقط در نوار پایین موبایل دیده می‌شوند و کلید تم شناور پایین چپ باقی می‌ماند.
- **Consequences:** بخش ناوبری افقی در DEC-020 با این تصمیم جایگزین شده است. باز و بسته شدن منو و جست‌وجو، Escape، صفحه‌کلید و چیدمان موبایل باید در پیش‌نمایش بررسی شوند.

## DEC-022: پیشنهادهای دسته‌بندی‌شدهٔ جست‌وجوی سراسری

- **Status:** IMPLEMENTED LOCALLY; LIVE API ACCEPTANCE OPEN
- **Date:** 2026-10-03
- **Decision:** هدر دسکتاپ و موبایل از سه حرف Unicode، با debounce برابر ۲۵۰ میلی‌ثانیه، پیشنهادهای محصولات، داروها، داروخانه‌ها و کلینیک‌ها را نشان می‌دهد. درخواست‌ها از `shopApi` و API client موجود می‌گذرند. محصولات/داروها از `q` سرور استفاده می‌کنند؛ تا رفع `.issue/14`، مراکز از حداکثر پنج صفحهٔ ۵۰تایی واقعی با کَش دو دقیقه‌ای در حافظهٔ همان هدر و تطبیق نام خوانده می‌شوند. فرادادهٔ ناقص یا فهرست بزرگ‌تر با اطلاع محدودبودن پیشنهادها همراه است. پاسخ نسل قبلی پس از تغییر متن/مسیر/بستن پیشنهادها کنار گذاشته می‌شود.
- **Consequences:** وابستگی جدید، سرویس جست‌وجوی بیرونی، رهگیری، ذخیرهٔ عبارت جست‌وجو یا تغییر احراز هویت اضافه نشده است. گزینه‌ها متن React و مسیر داخلی ثابت با slug کدگذاری‌شده یا ID معتبر دارند. Enter بدون انتخاب، رفتار جست‌وجوی محصولات را حفظ می‌کند. جست‌وجوی کامل مراکز و ترتیب امتیاز Google به قرارداد بک‌اند وابسته‌اند؛ دادهٔ نمایشی یا نتیجهٔ ساختگی برای جایگزینی API وارد نمی‌شود.

## DEC-023: تخمین خرید و اعتبار موقت کوپن

- **Status:** IMPLEMENTED LOCALLY; LIVE PAYMENT ACCEPTANCE OPEN
- **Date:** 2026-10-04
- **Decision:** سبد و تسویه تخمین ارسال معتبر و صحیحِ غیرمنفی سرور را، شامل صفر، مقدم می‌دانند؛ در نبود آن از ثابت‌های موجود با برچسب تخمین جایگزین استفاده می‌کنند. تخفیف فقط برای همان متن کد، وضعیت مالی/موجودی سبد و نشست معتبر است. تغییر این‌ها یا پاسخ دیرهنگام، نتیجه را باطل می‌کند. تعداد سبد صحیح و بین ۱ تا ۲۰ است. ارسال سفارش با قفل همزمانی رابط انجام می‌شود؛ پس از ساخت سفارش و شکست آغاز پرداخت، تلاش بعدی فقط پرداخت همان سفارش است.
- **Consequences:** مبلغ قطعی همچنان پاسخ سفارش سرور است؛ کلاینت مبلغ به API سفارش نمی‌فرستد. ارسال رایگان بر جمع پیش از تخفیف سنجیده می‌شود. وابستگی جدید یا تغییر توکن/کوکی اضافه نشده است. تضمین سقف کوپن و اعتبار عددی سرور در `.issue/16` و `.issue/17` پیگیری می‌شود. آزمون‌های کنترل‌شده جای پرداخت زنده را نمی‌گیرند.

## DEC-024: فرادادهٔ مسیرهای SPA و نمایه‌سازی

- **Status:** IMPLEMENTATION IN LOCAL REVIEW; PUBLIC CRAWLER ACCEPTANCE OPEN
- **Date:** 2026-10-04
- **Decision:** یک کامپوننت داخلی عنوان، توضیح و robots صفحه را با مسیر هماهنگ می‌کند. نام جزئیات عمومی از کَش React Query موجود مشاهده می‌شود؛ این مشاهده درخواست شبکهٔ تازه ندارد. صفحه‌های حساب، ورود، سبد، تسویه، پرداخت، مسیر ناشناخته و نتایج دارای query از نمایه‌سازی منع می‌شوند. HTML مستقل ادمین نیز `noindex, nofollow` دارد. فراداده فقط متن است؛ HTML دادهٔ API درج نمی‌شود.
- **Consequences:** وابستگی جدید، رهگیری یا تغییر هویت اضافه نمی‌شود. robots کنترل دسترسی نیست. دامنهٔ نهایی هنوز مشخص نیست و canonical حدسی ساخته نمی‌شود. sitemap پویا و سیاست هدرهای سرور در `.issue/13` باقی‌اند. head در SPA به JavaScript وابسته است؛ پذیرش خزنده و وضعیت HTTP/فرادادهٔ اولیه روی هاست پیش از انتشار لازم است.

## DEC-025: Same-origin API base behind Apache

- **Status:** IMPLEMENTATION FOR LOCAL SERVER REVIEW
- **Date:** 2026-10-04
- **Decision:** Support a root-relative API base such as `/api/v1` in the existing central customer API client, resolved against the browser origin. Preserve absolute API bases for existing Vite development. Deployment must not require baking a machine address into the public bundle.
- **Consequences:** The XAMPP preview uses a same-origin reverse proxy. Bearer headers, `credentials: omit`, query encoding, timeout and response-envelope handling stay unchanged. No new dependency or authentication bypass is introduced. Verify relative and absolute configurations plus actual browser API requests; Apache serves build output only.

## Open owner and release decisions


- **FR-DEC-03:** Owner confirmed Ubuntu VPS deployment with `https://drgupet.ir` and `https://admin.drgupet.ir` on 2026-10-04. Use a same-origin `/api/v1` reverse proxy for each public build (DEC-025); configure the customer build's `VITE_API_BASE_URL` explicitly. Origin TLS, proxy/CORS and payment callback configuration still require the backend/operator's acceptance; Cloudflare zone activation alone is not a running website.
- **FR-DEC-06:** Browser E2E tooling remains optional for F11; automated tests and manual preview do not replace live payment/auth acceptance.
- **FR-DEC-07:** Resolved by DEC-012: `main` only until the owner asks for another branch; local preview and approval before commit or push.
- **FR-DEC-08/09:** The backend development environment and deployment environment list require confirmation from the respective owners. A local `VITE_API_BASE_URL` exists only in ignored `.env`.
- **FR-DEC-02 release rights:** The owner supplied the visual direction; authority to publish the logo, public operator identity/contact, retention details and processor disclosures remain open before a public launch.
## DEC-026: Password accounts alongside OTP

- **Status:** OWNER-REQUESTED; LOCAL IMPLEMENTATION AND ACCEPTANCE IN PROGRESS
- **Date:** 2026-10-08
- **Decision:** Add username/password login and customer registration alongside the existing OTP routes. Each account keeps exactly one required unique normalized phone and at most one unique canonical username credential. Keep credentials in a separate `PasswordCredential` relation so existing user responses cannot accidentally expose a password hash. Public registration must prove phone ownership with a real OTP before creating an account or adding its first credential to an existing OTP account; it must never overwrite an existing credential, role or profile through registration. Both login methods resolve to the same account. There is no unverified phone claim, fake phone, implicit account merge or second phone on an account.
- **Credentials:** Canonical ASCII usernames; asynchronous bcrypt using the existing dependency, with at least 12 characters and at most 72 UTF-8 bytes for passwords. Validate real DTOs, reject injected roles/unknown fields and unproved phone ownership on public registration, throttle authentication, and use a generic invalid-login response. Never put passwords in URLs, browser persistence, audit summaries, Git, or public responses.
- **Sessions and administration:** Reuse the accepted customer/admin token storage, refresh rotation, cache clearing, and current database role checks. A database session version invalidates old access and refresh tokens after password changes/resets; legacy version-zero OTP sessions remain compatible. Password recovery requires the matching username, registered phone and one-time OTP proof; its request response must not reveal account existence. Customer signup cannot create an administrator. Only an authenticated admin may provision/reset credentials for another account, with an audit entry. Bootstrap the owner's existing admin identity through a private operator step; no public bootstrap endpoint or hardcoded credential.
- **Consequences:** Initial public registration and forgotten-password recovery need OTP, while later password logins do not send SMS. A delivery-address receiver phone is separate from the single account phone. OTP remains available. Local tests and owner preview precede commit/push and deployment of the approved release. Real SMS delivery is tested on the VPS, not inferred from local mocks. The current phase does not add drug stock or availability data.
