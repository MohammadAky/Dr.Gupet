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

## DEC-027: Interaction continuity and restrained polish

- **Status:** OWNER-REQUESTED; LOCAL IMPLEMENTATION IN PROGRESS
- **Date:** 2026-10-10
- **Decision:** Address the complete design/interaction review in the existing customer and admin stacks without new dependencies. Retain the current licensed pet photography; the owner cancelled the cursor-following dog concept. Use session-scoped, in-memory checkout intent for coupon text, note and selected address; revalidate every financial preview against the current cart and identity. Never persist an accepted discount or payable amount as trusted state. Preserve sanitized return destinations through authentication and address creation.
- **Components:** Reuse existing accessible dialog primitives for contextual confirmation and optional product-image inspection; add shared safe image fallback and form-validation helpers. Keep network requests in each app's existing central API client. Use localized numeric input, stable loading shells, immediate keyboard interaction and reduced-motion equivalents. No tracking, third-party scripts, or cookie/privacy-interface changes.
- **Navigation and loading:** Admin sections may use allowlisted URL fragments and browser history while retaining RAM-only authentication. Protect edited drafts from accidental section departure. Customer route components may be lazy-loaded through React and the existing router, with an accessible loading boundary and no artificial delay. These improvements do not authorize token persistence or architecture/dependency replacement.
- **Local API preview:** The Vite development server proxies `/api` and `/uploads` to the local backend on port 3000 by default; an optional development-only `DRGUPET_LOCAL_API_TARGET` selects the local source preview, following DEC-025's existing same-origin API contract. The example uses `/api/v1`; existing absolute API bases remain supported. This development proxy does not configure a production host or change API authentication.
- **Consequences:** Test session changes, stale responses, cancellation, keyboard/focus handling and safe input conversion. Backend contract fixes are separately scoped and verified; local unit tests do not establish SMS/payment or VPS acceptance. Present the integrated local result and a full change report before any commit, push, PR or publication.

- **Owner clarification (2026-10-11):** Hero animals belong in one shared generated scene, replacing the separate tiles. Use responsive self-hosted WebP derivatives and record exact provenance/prompt in DESIGN_SYSTEM. Keep category IDs server-backed. Make signup/recovery/back actions visibly clickable, password visibility controls eye/eye-off icons in both apps, and remove duplicate profile shortcut cards while preserving AccountNav.
- **Admin facts and backend ownership:** Use existing aggregate/report endpoints for order work queues, current stock attention, sales and selected-period customer registrations. Do not infer visits, online presence, conversion or abandonment. The missing broader customer-activity contract is documented in `.issue/32` for the backend developer. After the owner's backend-handoff instruction, new backend concerns become issue notes; already completed local backend changes remain separately documented and unapproved for release.

## DEC-028: Owner-directed banner landing — local review candidate, 2026-10-12

The owner replaces the previous editorial homepage with this exact order: announcement, existing menu, viewport-filling desktop slide banner (smaller mobile), horizontal circular pet types, real best sellers, clinics by explicit visitor location, pharmacies, medicines, existing footer. No journey/discovery/closing sections remain. Three generated fictional illustrated sample campaigns replace photographic hero art. Titles and actions are HTML; sample packaging is not a catalog claim.

Use native React/CSS controls and existing dependencies; keyboard/reduced-motion changes are immediate and rotation stays user-controlled. Each slide defines desktop/mobile focal points; aspect-preserving cover crops never stretch an image. Native canvas crop export is a requested admin authoring function, not a new graphics dependency.

`frontend/src/features/landing/content.ts` is a dependency-free versioned sample contract shared by customer rendering and the narrowly scoped admin landing draft editor. Until the API in `.issue/33` exists, the editor offers draft preview/import/export and actual image crop exports, without claiming publication or writing into unrelated money settings. No cross-origin local-storage CMS, development-only publication service, trackers, or backend source edits are introduced.

The existing public catalog cannot rank paid sales. Preserve a truthful unavailable best-seller state rather than relabeling newest or an ADMIN-only report. Location is requested only on the visitor's explicit action, is session-only, and does not enter storage or analytics. A bounded fetched clinic subset is labelled honestly; full nearest ordering before pagination remains a backend contract gate. Existing account/auth/cart/payment behavior is preserved. Prior polish verification remains historical; new candidate requires its own focused and browser evidence and owner approval before commit/push/deployment.

### Owner refinements, 2026-10-13

The latest owner direction supersedes the first mobile banner mock: mobile text/CTA overlap the same illustrated banner frame with a soft tonal blend; no separate copy/image stack. Remove autoplay and play/pause entirely. Two native previous/next arrows flank centered slide dots; pointer changes crossfade260ms with220ms/6px text entry, keyboard and reduced-motion changes remain immediate. Keep controls clear of the existing floating theme action.

Dog/cat/bird category circles now use original generated illustrated portraits and center safely on mobile. Future pet types retain the existing generic fallback and horizontal overflow; actual IDs still come from the public API.

At the owner's explicit coach-presentation request, each of the four lower sections has six build-time sample cards. `LandingContent.sections` carries titles, demo flags, image/description/link/optional sample price/badge and ordered items. Default presentation is explicitly labelled sample design. Sample prices are not financial quotes and no sample adds items to cart or invokes clinical/payment actions. Products/medicines and centers all use horizontal native-touch/mouse-drag/keyboard carousels:2 visible at mobile/tablet,4 at wide desktop. The admin draft editor includes all sections, validates imports and exports the complete configuration; it still cannot publish without the ADMIN CMS API in issue33. No sample records are seeded into the database.

### Latest owner-approved hero behavior, 2026-10-13

The owner's later approval supersedes the earlier manual-only banner instruction above. The same image/copy/CTA banner now supports horizontal touch swipes and mouse dragging, with previous/next arrows and centered dots retained. Native vertical scrolling and pinch zoom remain available. Horizontal intent is accepted after 10px; CTA/controls retain their normal click behavior. Adjacent cyclic panels follow the pointer directly, then use a critically damped spring with release velocity; the first/last boundary follows the same path as every other transition. Keyboard and reduced-motion selection remain immediate. There is no new motion dependency or change to the CMS/API architecture.

Initial automatic rotation advances every seven seconds and wraps the actual enabled slide count, rather than assuming three. Hover, a hidden document, an offscreen banner, an active pointer, and reduced motion pause automatic rotation. The visitor's first deliberate arrow/dot/swipe interaction or keyboard focus stops further automatic rotation for that component visit; manual controls continue to loop. This supplies a user-controlled stopping mechanism without restoring the visible play/pause button the owner removed. Automatic changes use `aria-live="off"`; manual changes use a polite announcement. Resizing, slide-set changes, lost capture, cancellation, and live reduced-motion changes discard obsolete gestures/animation state. The existing admin configuration accepts up to 12 slides; that bound remains explicit, and the renderer handles any enabled count within it, including zero/one.

## DEC-029: Persisted presentation records and nearby center grids

- **Date:** 2026-10-13
- **Authority:** The owner approved the design, requested two-column static clinic/pharmacy grids and permission-based nearest facilities, explicitly requested backend-persisted samples shared by landing/catalog/detail pages, and authorized commit, push and VPS deployment after these corrections. This supersedes the earlier frontend-only/backend-note restriction for this narrow functionality. It does not authorize unrelated backend changes or broad demo seeds.
- **Layout:** Products and medicines retain carousels. Clinics and pharmacies use ordinary two-column grids at all reviewed widths. Existing real clinics are preserved and used; no fictional clinic records are added. Persisted sample cards link to the same public detail records that their directory/catalog pages expose.
- **Location:** Ask through an explicit user action and browser permission. Send coordinates only in request bodies to the existing API for whole-directory distance ordering before pagination; no coordinates in URLs, browser persistence, analytics or query-key caches. Public nearby endpoints must validate finite bounds and exclude unlocated or fictional facilities. Distances are approximate straight-line distances. Denial/timeout/empty eligible results retain a useful ordinary directory view.
- **Data:** An explicitly invoked, guarded, idempotent operator importer adds clearly labelled fictional presentation products, medicine information and pharmacies without overwriting real records. Sample products have zero purchasable stock and clear sample copy; samples are not sales statistics, clinical advice or verified facilities. Existing public APIs expose markers so all screens can show the same distinction. No new dependency or schema migration is required for the planned extension.
- **Release:** Preserve local/server differences and database/build backups, test locally, preview the requested corrections, push the approved source, then deploy that exact SHA. The importer is never called by startup, `prisma:seed`, migrations or `update.sh`; production presentation data is a separate deliberate operator action. Credentials/configuration remain private. The existing landing CMS editor remains an unpublished draft until its separate publication contract is implemented.

## DEC-030: Owner-directed VPS workflow, Persian date input, and eight-character passwords

- **Status:** OWNER-AUTHORIZED 2026-10-13; verification recorded in the release report.
- **Decision:** The owner explicitly requested implementation, checks, builds, GitHub push, and release on the VPS for this change. Work occurs in a backed-up isolated VPS worktree; machine-local project source and runtime are not modified. This scoped instruction supersedes the local-preview gate for this release.
- **Date inputs:** Replace every browser-native Gregorian date/date-time picker (pet birthday and administrator coupon boundaries) with dependency-free Persian-calendar controls. Month/year navigation, Saturday-first days, keyboard navigation, clear, and inline disclosure remain responsive and accessible. Customer and administrator implementations mirror the same small calendar code and tests because their SPA build roots remain separate; no dependency or shared-build architecture is introduced.
- **Contract:** Keep Gregorian ISO date-only pet birthdays and ISO UTC instants in API payloads/storage. Only presentation/selection uses Jalali. Dates and coupon wall-time use `Asia/Tehran`, including historical timezone rules. An unchanged coupon retains its original seconds/milliseconds; actual date/time edits intentionally create a new minute-precision instant. Date-only birthdays preserve their exact API day; future dates are blocked against the current Tehran day. Persian leap-day validation uses the runtime's Persian calendar.
- **Passwords:** Owner-approved minimum changes from twelve to eight Unicode characters everywhere a new password is accepted, for customers and administrators. Existing password login is not forced through a new-password length rule. The existing maximum of 72 UTF-8 bytes, bcrypt cost, credential secrecy, OTP ownership checks, confirmation, session invalidation and role checks remain unchanged.

## DEC-031: Lightweight WebP delivery without changing application structure

- **Date:** 2026-10-13
- **Status:** OWNER-APPROVED 2026-10-13; commit, push and VPS publication explicitly authorized after required verification.
- **Decision:** Serve versioned raster artwork as WebP, retain original source/provenance in private operator backups, and preserve vector UI icons as SVG. Keep existing same-origin image validation, product/sample safeguards and component/API structure. The 1280px JPEG logo is unnecessarily large for its 48–58px display: a 256px lossless WebP derivative preserves shape/color with ample high-density headroom; source remains privately backed up.
- **Backend dependency:** Adopt exact `sharp` 0.35.5 only in the existing upload service. Native encoding/decoding is needed because changing a filename does not convert JPEG/PNG bytes. Existing multipart endpoint, authentication, original-upload-byte quotas and `{url}` response remain intact. Decode validated JPEG/PNG/WebP, cap total decoded pixels at 40 million, preserve orientation/alpha, constrain output to 1920px per frame without enlargement, strip metadata and emit WebP quality 82. Bounded animated WebP input keeps frames rather than silently flattening; animated orientation is not transformed. Writes/cleanup use asynchronous filesystem I/O. Oversized/corrupt/unsupported content fails before quota consumption and file persistence.
- **Compatibility:** [Official Sharp installation](https://sharp.pixelplumbing.com/install/) documents Node-API v9 / Node >=20.9, Windows x64 and Linux x64 musl >=1.2.5 prebuilt binaries. Node20 Alpine production and local Node24 are supported provided optional platform dependencies remain installed; Linux Docker installation must be verified before deployment. [Constructor](https://sharp.pixelplumbing.com/api-constructor/) and [output](https://sharp.pixelplumbing.com/api-output/) define decoder bounds, animation and WebP options. This adds no browser dependency, schema migration, new architecture or automatic startup data rewrite.
- **Legacy images:** Inventory uploads and referenced URLs read-only first. Only an explicitly reviewed, database-and-upload-backup-first migration may rewrite legacy JPEG/PNG URL references; retain originals and a reversible old/new manifest, validate trusted upload paths and use compare-and-swap updates. Do not fetch arbitrary image URLs or modify production media during this local review.

## DEC-032: Domain-specific robots policy with shared administrator artwork

- **Date:** 2026-10-13
- **Decision:** Keep the administrator's existing `publicDir` pointing to the shared frontend artwork. A build-only Vite asset hook emits `admin/public/robots.txt` as the administrator output's `robots.txt`, replacing the customer file copied from that shared directory. Customer public browsing remains crawlable except account/checkout paths; administrator crawling is entirely disallowed.
- **Evidence and limits:** Source-file presence is insufficient: the initial admin build copied the customer `Allow: /` policy. Verify the generated bytes and served `text/plain` body after this override. The hook adds no runtime dependency, routing change or duplicated image directory; robots remains crawler guidance rather than authentication or access control. Production role checks and administrator `noindex` behavior remain unchanged.

## DEC-033: Owner-requested atomic administrator CSV import and suspension-before-deletion

- **Date / status:** 2026-10-14; OWNER-APPROVED for publication after the final deletion-discoverability correction. Owner explicitly requested CSV product import, a blank template, required name/price, empty optional numeric values as zero, and deletion after suspension. This narrowly authorizes the required backend contract; unrelated core changes remain separate issues.
- **CSV:** Parse UTF-8/BOM, quotes and Persian/Arabic numerals without a dependency. Preview at most 100 rows before an explicit import action. Required trimmed name and integer Toman price (explicit zero allowed); optional stock, comparison price and import weight default to zero. Empty optional text stays empty, not the string `0`. Real brand/category/species references are selected once per batch; foreign keys cannot default to zero. Optional activation defaults to false. Weight zero is allowed only for imported drafts; active rows require positive weight and the ordinary variant DTO remains unchanged.
- **Backend:** Dedicated ADMIN endpoint validates references, bounds, normalized identifiers and duplicates, then creates the entire batch, variants and consistent minimum prices in one transaction. It never overwrites existing products. Invalid rows or a race fail the batch rather than leave a partial import. Existing request clients, ownership/role enforcement and money unit remain authoritative; no new dependency or schema is planned.
- **Users:** Suspend and refetch the stored status before offering deletion. Both USER and ADMIN share the leading account-access region before credentials/history. Server checks BLOCKED in the protected transaction; self/last-admin protections remain. Deletion is recoverable soft deletion and retains order history; it is not permanent erasure. No production account is modified during local review.

## DEC-034: Account-scoped administrator navigation order

- **Date / status:** 2026-10-14; OWNER-APPROVED for publication, including removal of the two visible usage paragraphs on the final sidebar.
- **Decision:** Permit free ordering of the 11 allowlisted administrator sections via separate drag handles in an explicit customization mode. Default order keeps existing group headings; custom order uses one accurately labelled management list. Pointer/touch drag and keyboard pickup/move/drop/cancel must not navigate or discard current form drafts; drawer focus, inert behavior and ADMIN role checks remain intact.
- **Persistence:** Store versioned section IDs only under the authenticated account ID in the same browser. Deduplicate/filter unknown IDs, append future sections and retain usable RAM state if storage is denied. No token, username, location or other private field is stored. This is not cross-device server persistence; a future personal preferences endpoint must derive the account from authentication rather than reuse global financial settings.
- **Refresh:** Replace only the visible overview-refresh label with an icon; preserve its callback, pending state, Persian accessible name/title and 44px target. No change to dashboard data sources or fetching architecture.

## DEC-035: Local commerce gallery, glass material and causal cart feedback

- **Date / status:** 2026-10-14; LOCAL IMPLEMENTATION, publication requires owner preview/approval. Scope is persisted in COMMERCE_REDESIGN_WORKLOG.md.
- **Gallery:** Keep the first image primary. The administrator's hover selection moves an existing nonprimary image to gallery position one in a parent-locked transaction; public card endpoints expose nullable `hoverImage`. Reuse ordered ProductImage records rather than introduce a separate image relation/schema. Thumbnails use the same persisted gallery; fine-pointer detail zoom is 1.5× and never crops the resting image. No stock/photo invention for an image missing in the API.
- **Material:** Add one shared, bounded material stylesheet using current brand tokens; crisp content sits above a translucent highlight, with no per-card listing blur or animation of blur. Maintain solid fallbacks and explicit selected/focus/error states for contrast and reduced transparency. No dependency adoption or application structure replacement.
- **Owner material refinement:** The supplied glassmorphism reference informs translucent tint and a bright static edge, not copied artwork or advertising. Customer login is a single centered card on every breakpoint; remove the decorative story column from the DOM and override only its internal form's legacy dark background. Material rules must not alter input/button geometry or ownership of sticky positioning. Mobile keeps a tint/highlight with no stacked blur; reduced transparency/contrast uses solid surfaces.
- **Quantity / shipping:** Preserve the API's quantity maximum of 20. Text/inputMode numeric and suggestions normalize Persian/Arabic digits; invalid drafts remain visible. Default free shipping becomes 6,000,000 Toman in server and fallback settings; existing administrator overrides and the pre-discount items-total rule remain authoritative. The progress indicator never creates a coupon or overrides order amounts.
- **Feedback:** A small transient, in-page cart-add signal may connect successful product mutation to the visible basket target. It stores no user/image state persistently and performs no network requests. Flight/pulse occurs only after confirmed success for the current account/route; reduced motion and keyboard actions use quiet status feedback. Bound outstanding animation lifetime and clear on identity/route/unmount changes. Checkout mutation/retry, stock and sample guards remain intact.

## DEC-036: Owner visual refinement, admin OTP boundary and visit popup

- **Date / status:** 2026-10-16; local review only, no release approval. Owner explicitly extends this phase to the admin OTP boundary and a shared popup configuration.
- **Material:** Supersede the opaque inner-control treatment in DEC-035. One translucent surface with static rim/reflection and a restrained stationary backdrop supports crisp text and floating controls in both themes. Avoid nested dark panels, continuous decoration, external rendering libraries and animated blur. Keep accessible solid/contrast fallbacks and natural Persian tracking.
- **Interaction:** A rightward banner drag advances; a leftward drag goes back. The shipping indicator belongs above the full-width checkout journey. Cart feedback follows confirmed success and stays interruptible, bounded and reduced-motion aware.
- **Password:** New-password checks for eight characters, an uppercase Latin letter and a digit are live guidance; existing API acceptance/UTF-8 safety remains authoritative. Current-password forms request no automatic fill, start empty and require direct interaction; browser password-manager policies remain outside application control. Login keeps standard password-manager semantics.
- **Popup:** Reuse the existing MySQL Setting table through dedicated validated ADMIN read/write and public read endpoints; widen its `value` from VARCHAR to TEXT with a required migration so full content fits without truncation. No dependency. Configuration contains enabled, title, plain-text body and optional first-party image. Public output exposes only this content. Display on the homepage once per visit, as selected by the owner; a tab-session dismissal flag survives reload/navigation, clears with that browser session, and is not tracking or an account identifier. Storage denial falls back to memory. Never interrupt checkout, login or the first-visit cookie choice. Reuse the accessible dialog and existing upload/client paths; public feature stays disabled until configured.
- **Admin OTP:** Dedicated admin request/verify routes check an existing active undeleted ADMIN before sending or issuing a session; customer OTP/registration remains separate and available. This addresses the admin form's send boundary, not every possible security risk. Existing production reference vocabulary is applied only with the standalone named-target operator and backup requirements; never add startup/demo seeds.

## DEC-037: Mixed product CSV with reviewed row references

- **Date / status:** 2026-10-16; owner-requested local candidate, production remains subject to preview approval.
- **Contract:** Preserve the legacy shared brand/category/species as optional fallbacks. A row may provide its own IDs, or explicit brand/category names plus an existing species ID. Row references override the shared fallback. Supplying both a name and an ID for the same row reference is invalid. The existing ADMIN guard, 100-row/body limits, atomic batch, duplicate SKU/slug checks and published-product positive-weight rule remain authoritative.
- **Classification:** The admin may suggest brand/category/species from explicit words in imported names/descriptions. These are visible editable suggestions, not hidden authoritative product facts. Ambiguous or missing animal/reference choices stay unresolved until the owner selects them. No invented weight, origin, stock, price or species. CSV headers may explicitly provide reference names/IDs instead of suggestions.
- **Creation:** During the explicitly confirmed batch only, exact normalized unique existing names are reused; absent brands/categories are created inside the same transaction. Categories remain compatible with the selected species. Inactive, ambiguous or conflicting references reject the batch; never silently reactivate, relabel, randomly suffix or reuse another species' category. Species are never auto-created.
- **Publication:** The «نمایش» alias and `isActive` accept case-insensitive `T/F`, `true/false` and existing digit values. An omitted value remains unpublished. The preview displays and permits correction of each publication choice. Actual API input remains a boolean; no implicit string-to-boolean coercion on the server.
- **Product list:** Quick delete sits beside View and reuses the existing confirmation and backend history safeguards. No unattended deletion of imported or existing owner data is authorized by this UI addition.

## DEC-038: Final glass controls and owner-approved synchronized release

- **Date / authorization:** 2026-10-16. The owner approved the visual candidate, requested the remaining arrow/spacing/alignment/menu corrections and explicitly instructed commit, push and exact-revision VPS publication afterward. The later back-to-top instruction supersedes its instant-scroll behavior: use a bounded 360ms easing, interruptible by user input, with direct completion for reduced motion. The cart-add animation remains owner-approved and unchanged.
- **Controls:** Use a shared dependency-free glass listbox for visible customer selection surfaces, including search filters, pet fields and calendar navigation. The whole trigger has one continuous surface and a decorative centered rounded chevron. A hidden native backing select preserves form/change validation behavior; the visible combobox has the label, focus, expanded/selected state and keyboard controls. Portals avoid clipping in glass panels; dismissal, repositioning and viewport bounds retain accessibility and mobile operation. This is a small component pattern in the existing SPA, not a new UI library.
- **Data approval:** The owner supplied `products.csv` from the PetLovely_mashhad Telegram channel, approved publishing complete rows and keeping incomplete products as drafts, and explicitly approved «نیازمند تکمیل» for unresolved brand/species. Keep source names, prices, stock, text, identifiers and positive weights; never infer an accessory's shipping weight or attach unprovided pictures. Review-only inactive reference placeholders identify unresolved draft fields without inventing a manufacturer/species or exposing them in public reference lists. Active publication requires active compatible references and positive variant weights. A separate backed-up operator may import the reviewed batch atomically; it is not a seed, startup task or public bypass.
- **Release:** Preserve SQL, uploads, served builds, previous image and SHA before changes. Build customer/admin/backend from the same committed revision, verify actual served assets/revision and API behavior, and apply only required migrations. SMS signup temporarily shares the existing login template/configuration; recovery template604019 remains separate. Real delivery and payment acceptance must not be inferred from mocked tests or health checks.
