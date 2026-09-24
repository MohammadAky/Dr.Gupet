# Dr. Gupet — Frontend Roadmap (MVP v1)

> **خلاصه فارسی (برای انسان‌ها):** این سند نقشه‌ی راه توسعهٔ **فرانت‌اند** پنل کاربر Dr. Gupet است و مکمل README ریشهٔ مخزن است؛ README هنوز مرجع قرارداد API و قواعد محصول است. مرجع کد فقط **GitHub** است و نقطهٔ مبنا: شاخهٔ `main` در کامیت `d3f99bc` (فازهای ۰ تا ۱۵ بک‌اند تحویل شده‌اند). فرانت‌اند در مخزن وجود ندارد و در پوشهٔ جدید `frontend/` ساخته می‌شود. هر فاز فرانت با شناسهٔ `F0..F11` تعریف شده و **هر بار فقط یک فاز** انجام می‌شود و بعد از سبز شدن معیارهای پذیرش، جدول «Status» و «Progress log» همین فایل در همان کامیت به‌روز می‌شود تا همهٔ LLMها و انسان‌ها وضعیت واقعی را ببینند. کارهای لازم سمت بک‌اند در بخش ۷ (`BE-REQ-*`) ثبت شده‌اند و **بدون دستور صریح صاحب بک‌اند اجرا نمی‌شوند**.

---

## 0. How to use this document

This file is the **single source of truth for the frontend**. It does not replace the root `README.md` (product scope, API conventions, business rules) nor `backend/docs/*`.

- **If you are an AI agent:** read §1–§6 completely, then work on **one phase (F0..F11) at a time**. Never start phase `F(n+1)` before every acceptance item of `F(n)` has a recorded evidence.
- **If you are a human:** use §6 to assign one phase at a time, then verify the phase against its *Acceptance criteria* and the *Definition of Done* in §10.
- **Before writing code:** check the `Status` table (§12), the `Progress log` (§12) and `frontend/docs/DECISIONS.md` (created in F0).
- **Scope of this document:** frontend only. Anything that requires a change in `backend/` must be written as a `BE-REQ-*` entry in §7 and reported to the backend owner. Never edit `backend/` from a frontend task.
- **Language rule (from README §3.12):** code, identifiers, file names and API fields are English; user-facing strings are Persian.

Baseline recorded when this file was written:

| Item | Value |
|---|---|
| Reference repository | `https://github.com/MohammadAky/Dr.Gupet` |
| Backend baseline commit | `d3f99bc` (`main`, "feat: implement Phase 15 - Hardening & Delivery") |
| Backend phases delivered | 0–15 (see `backend/docs/CHANGELOG.md`) |
| Frontend baseline commit | the commit that adds this file (see `git log -- Roadmap-Frontend.md`) |
| Frontend code in repo | **none yet** — `frontend/` is created in F0 |

---

## 1. Scope and boundaries

**In scope (user panel only, MVP v1 — README §1):** OTP login, profile, addresses, pets, product catalog (browse/filter/search/detail), recommendations, favorites, cart, coupons, checkout, payment redirect and result page, order list/detail/cancel, medicine & pharmacy information pages.

**Out of scope (do not build):** admin panel, any administrator CRUD, vets/clinics/appointments, medical records & vaccinations, prescriptions, boarding, sitters, trainers, adoption, chat, reviews, subscriptions, refunds, blog (README §15). Also out of scope: any change to backend files, any new backend endpoint without a `BE-REQ`.

**Hard boundaries**

1. The server is always authoritative for money, stock, coupon validity and shipping. The frontend only **displays** amounts and may compute a **clearly-marked estimate** (see BE-REQ-04).
2. Jalali (Shamsi) conversion is a frontend responsibility (README §6.1); the API returns ISO-8601 UTC strings only.
3. Every page that reads data must implement `loading`, `empty` and `error` states; no silent failures.
4. No new third-party library without a written entry in `frontend/docs/DECISIONS.md`.
5. Never commit `.env*` files; only `VITE_*` variables are allowed in client code (they are public).

## 2. Verified backend state (what the frontend talks to)

Everything below was read directly from `main` @ `d3f99bc` (controllers/services/DTOs), not from documentation. Global prefix is `/api/v1`; Swagger is available at `http://localhost:3000/docs` when `NODE_ENV !== 'production'`.

### 2.1 Endpoint inventory

| # | Method & path | Auth | Frontend phase | Notes read from code |
|---|---|---|---|---|
| 1 | `GET /health` | public | F0 | returns `{ status: "ok" }` in the success envelope |
| 2 | `POST /auth/otp/request` | public | F2 | body `{ phone }` → `{ expiresIn }` (seconds); throttled 10/min |
| 3 | `POST /auth/otp/verify` | public | F2 | body `{ phone, code }` → `{ accessToken, refreshToken, user, isNewUser }`; dev fixed code `12345` |
| 4 | `POST /auth/refresh` | public | F2 | body `{ refreshToken }` → new pair; **the old refresh token is deleted (rotation)** |
| 5 | `POST /auth/logout` | user | F2 | needs `Authorization` **and** `{ refreshToken }`; always returns `{ ok: true }` |
| 6 | `GET /users/me` | user | F3 | `{ id, firstName, lastName, phone, avatar, role, createdAt, updatedAt }` |
| 7 | `PATCH /users/me` | user | F3 | only `firstName`, `lastName`, `avatar` |
| 8 | `GET /addresses` | user | F3 | default address comes first |
| 9 | `POST /addresses` | user | F3 | max 10 per user; the first address becomes default |
| 10 | `PATCH /addresses/:id` · `PATCH /addresses/:id/default` · `DELETE /addresses/:id` | user | F3 | ownership → 404; deleting the default promotes the newest remaining |
| 11 | `POST /upload/image` | user | F3, F4 | `multipart/form-data`, field `file`, jpeg/png/webp ≤ 5 MB → `{ url }` (absolute URL) |
| 12 | `GET /pet-types` · `GET /pet-types/:id/breeds` · `GET /tags?type=ALLERGEN\|DIET` | public | F4 | tag shape: `{ id, name, slug, type }` |
| 13 | `GET /pets` · `POST /pets` · `GET/PATCH/DELETE /pets/:id` · `PUT /pets/:id/tags` | user | F4 | responses include computed `lifeStage`; `PUT .../tags` replaces the whole set |
| 14 | `GET /brands` · `GET /categories` · `GET /products` · `GET /products/:slug` | public | F5 | query contract and shapes: §2.2 |
| 15 | `GET /products/recommendations?petId=&page=&limit=` | user | F6 | product-card shape + `matchedTags: string[]`; declared **before** `:slug` (correct) |
| 16 | `GET /favorites` · `PUT /favorites/:productId` · `DELETE /favorites/:productId` | user | F7 | paginated product cards; add/remove are idempotent |
| 17 | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:id` · `DELETE /cart` | user | F8 | `POST` body `{ variantId, quantity }`; every mutation returns the fresh cart view |
| 18 | `POST /coupons/validate` | user | F8 | body `{ code }` → `{ code, discountAmount, finalAmount }`; `finalAmount` = itemsTotal − discount (**shipping excluded**) |
| 19 | `POST /orders` · `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` | user | F9 | `POST` body `{ addressId, couponCode?, note? }`; cancel only while `PENDING_PAYMENT` |
| 20 | `POST /payments/start` | user | F9 | body `{ orderId }` → `{ paymentUrl }`; redirect the browser there |
| 21 | `GET /payments/callback` · `GET /payments/mock-pay` | public | F9 | gateway redirects back to `FRONTEND_PAYMENT_RESULT_URL?orderNumber=...&status=success\|failed` |
| 22 | `GET /medicines` · `GET /medicines/:id?city=` | public | F10 | list filters `q`, `petTypeId`, `requiresPrescription`; detail adds `disclaimer` + `pharmacies[]` |
| 23 | `GET /pharmacies` · `GET /pharmacies/:id` | public | F10 | filters `city`, `province`, `is24h`; verified pharmacies first |

### 2.2 Contract facts the UI depends on

- **Envelopes.** Success: `{ "success": true, "data": ..., "meta": { page, limit, total, totalPages } }` (`meta` only for paginated lists). Error: `{ "success": false, "statusCode", "code", "message", "details?" }` — `message` is Persian and may be displayed as-is; `code` is stable English and drives UI logic.
- **Error codes in use:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `LIMIT_REACHED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_RATE_LIMITED`, `USER_BLOCKED`, `VARIANT_UNAVAILABLE`, `OUT_OF_STOCK`, `CART_EMPTY`, `COUPON_INVALID`, `COUPON_EXPIRED`, `COUPON_LIMIT_REACHED`, `COUPON_MIN_AMOUNT`, `ORDER_INVALID_STATE`, `PAYMENT_FAILED`, `INTERNAL_ERROR`.
- **Pagination.** `page` ≥ 1 (default 1); `limit` default 20, **max 50**. The frontend must never request more than 50.
- **Product card** (from `/products`, `/favorites`, `/products/recommendations`): `{ id, name, slug, brand: { id, name }, image, minPrice, inStock, lifeStage, sizeClass }`. `image` may be `null`. Stock **numbers** are never exposed.
- **Product detail** (`/products/:slug`): product fields + `images[]` (sorted by `sortOrder`), `variants[]` = `{ id, sku, weightGram, price, compareAtPrice, inStock, lowStock }` ordered by `weightGram`, `tags[]` = `{ id, name, slug, type }`, plus `category`, `petType`, `description`, `ingredientsText`.
- **Product list query** (`GET /products`): `page`, `limit`, `q` (normalized Persian search), `petTypeId`, `categorySlug` (children included), `brandId`, `lifeStage`, `sizeClass`, `tagIds` (comma-separated, matching products must have all), `minPrice`, `maxPrice`, `inStock`, `sort` = `newest | price_asc | price_desc`.
- **Cart view:** `{ items: [{ id, variantId, productName, productSlug, productImage, weightGram, unitPrice, quantity, total, available, stockProblem? }], itemsTotal }` with `stockProblem ∈ { OUT_OF_STOCK, INSUFFICIENT }`. Unavailable items are **not** removed silently — the UI must warn before checkout.
- **Orders:** `POST /orders` returns the created order (`orderNumber`, `itemsTotal`, `discountAmount`, `shippingCost`, `finalAmount`, `status`, `addressSnapshot`, `items[]` as snapshots of `productName`/`weightGram`/`unitPrice`/`quantity`/`total`). Shipping: `itemsTotal >= 1,500,000` → free, otherwise `50,000`. Pending orders expire after 30 minutes (server cron).
- **Payments (dev):** with `PAYMENT_DRIVER=mock` the returned `paymentUrl` points to `/api/v1/payments/mock-pay`, which auto-redirects to the callback and then to `/payment/result?orderNumber=...&status=success`.
- **Order status values:** `PENDING_PAYMENT`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELED`. After `PAID` only an admin changes status; the user UI offers cancel only in `PENDING_PAYMENT`.
- **Enums for labels:** `Gender` = `MALE|FEMALE`; `LifeStage` = `PUPPY_KITTEN|ADULT|SENIOR|ALL`; `SizeClass` = `SMALL|MEDIUM|LARGE|ALL`; `NeuterSuitability` = `ANY|NEUTERED_ONLY`; `TagType` = `ALLERGEN|DIET`; `CouponType` = `PERCENT|FIXED`. Persian labels live in a single frontend dictionary.
- **Uploads** are absolute URLs under `PUBLIC_BASE_URL/uploads/...`; store and render them untouched.

### 2.3 Findings that shape the frontend plan (full detail in §7)

| ID | Finding (evidence read from `main`) | Frontend impact |
|---|---|---|
| SCHEMA-001 | `Product.minPrice` is used by `products.service.ts:112-113` (price sort), written by `product-variants.service.ts:24` and the seed, but **does not exist in `prisma/schema.prisma`** | "sort by price" may fail at runtime; blocks acceptance of F5's sorting; needs a backend decision |
| BE-REQ-03 | `GET /products` is typed `PaginationQueryDto & any` (`products.controller.ts:43`) and `ProductQueryDto` is not wired; `inStock` uses `@Type(() => Boolean)` (`product-query.dto.ts:56-60`) | filters must be verified against a running server; the UI sends `inStock=true` only, never `false` |
| BE-REQ-02 | The payment callback redirects with `orderNumber` only (`payments.callback.controller.ts:38`) while `GET /orders/:id` requires the numeric `id` | the result page needs a workaround (store `orderId` before redirect) or a small backend addition |
| BE-REQ-04 | `GET /cart` returns only `itemsTotal` (no shipping/discount estimate) | the cart page must label the shipping amount as an estimate; constants must stay in sync |
| BE-REQ-05 | The product card shape omits `compareAtPrice` although README Phase 6 lists it | discount badge placement decision (card vs. detail page) |
| ENV-01 | `docker` was not found in `PATH` on this machine, `backend/.env` does not exist and `prisma generate` did not complete during this review | the dev environment must be set up and recorded before F0 acceptance (§11) |

---

## 3. Frontend stack (proposal — record the final choice before F0)

The backend README's dependency rule is reused verbatim for the frontend: install packages **without guessing versions**, commit the lockfile, and write any addition outside this table into `frontend/docs/DECISIONS.md`.

| Concern | Proposed choice | Why (evidence) |
|---|---|---|
| Build tool | Vite | `CORS_ORIGINS=http://localhost:5173` and `FRONTEND_PAYMENT_RESULT_URL=http://localhost:5173/payment/result` already assume Vite's default port |
| UI framework | React + TypeScript (strict) | largest ecosystem, best RTL/Jalali support, easiest hand-off between multiple LLM sessions |
| Language/runtime | Node LTS ≥ 20 (repo Dockerfile uses Node 20; this machine has v24) | consistency with backend delivery |
| Styling | Tailwind CSS + design tokens (CSS variables) | fast iteration, no runtime CSS cost, easy RTL |
| Server state | TanStack Query | caching, pagination, invalidation for cart badge, retries |
| Routing | React Router | URL-driven filters (`/products?...`) with shareable/deep links |
| Forms & validation | React Hook Form + Zod | mirrors backend constraints (`MaxLength`, ranges) with Persian messages |
| HTTP | `fetch` in a tiny typed client wrapper (no axios unless a decision says otherwise) | fewer dependencies; envelope + error-code handling is custom anyway |
| Jalali dates | `Intl.DateTimeFormat('fa-IR-u-ca-persian')` for display + one date-picker dependency (FR-DEC-04) | ISO strings only from the API; display is the frontend's job |
| Font | Vazirmatn, self-hosted (`@fontsource/vazirmatn`) | Persian UI, no external CDN dependency in production |
| Tests | Vitest + Testing Library + MSW (mock API) | unit tests for formatters/validators, integration tests for flows without a live backend |
| Lint/format | ESLint + Prettier (same spirit as `backend/eslint.config.mjs`, `.prettierrc`) | one style across the repo |
| E2E | Playwright — **optional, decision FR-DEC-06** | only if the team wants browser E2E in F11 |

**Decision status legend:** `PENDING` (needs the frontend owner's approval), `ACCEPTED`, `SUPERSEDED`. Accepted decisions must be copied into `frontend/docs/DECISIONS.md` in the same commit.

---

## 4. Proposed frontend repository layout (created in F0, no other top-level folders)

```text
frontend/
├── .env.example                # VITE_API_BASE_URL, VITE_APP_ENV
├── .gitignore
├── index.html
├── package.json                # + package-lock.json (committed)
├── tsconfig.json  tsconfig.node.json
├── vite.config.ts
├── eslint.config.js  .prettierrc
├── public/                     # favicon, robots.txt
├── docs/
│   ├── DECISIONS.md            # every accepted decision, ADR-style, numbered
│   └── DEVELOPMENT_CHECKLIST.md
└── src/
    ├── main.tsx  App.tsx  router.tsx
    ├── api/                    # client.ts (envelope + auth + refresh), types.ts, queryKeys.ts
    │   └── endpoints/          # auth.ts, users.ts, addresses.ts, pets.ts, catalog.ts,
    │                           # cart.ts, orders.ts, payments.ts, medicines.ts, upload.ts
    ├── components/             # ui/ (design-system primitives) + layout/ (shell, header, footer)
    ├── features/               # one folder per domain: auth, profile, addresses, pets,
    │                           # catalog, recommendations, favorites, cart, checkout, orders,
    │                           # medicines   (components + hooks + schemas live here)
    ├── pages/                  # route components only, one file per route
    ├── hooks/                  # cross-cutting hooks (usePagination, useMediaQuery, ...)
    ├── lib/                    # format.ts (Toman), jalali.ts, errors.ts, storage.ts, validators.ts
    ├── styles/                 # tokens.css, globals.css (RTL base)
    └── test/                   # setup.ts, msw/handlers.ts, fixtures/
```

Rules for the layout: routes and folders stay aligned with the API domains; a new top-level folder needs a `DECISIONS.md` entry; `pages/` never contain business logic; `features/` never import from other features (share through `components/`, `lib/` or `api/`).

---

## 5. Frontend conventions (mandatory)

1. **API client is the only place that talks to HTTP.** Every call goes through `src/api/client.ts`, which adds `Authorization` (when a session exists), parses the envelope, converts failures into a typed `ApiError { code, message, status, details? }` and triggers refresh-once-on-401 with a **single-flight** lock (parallel 401s wait for the same refresh, then retry once).
2. **Error handling.** Show the server's Persian `message` when present; otherwise map `code` → fallback Persian text from one dictionary. `USER_BLOCKED` must log the user out and explain why. `OTP_RATE_LIMITED` shows the remaining-cooldown message, never a retry storm.
3. **Money.** Display in Toman with Persian digit grouping (`toLocaleString('fa-IR')`). Never send prices; never recompute the payable amount — only render what the server returned and clearly mark any local estimate as "تخمینی".
4. **Dates.** Store ISO strings; render Jalali via `lib/jalali.ts`. A single `formatJalali(iso, 'date' | 'datetime')` helper is the only allowed formatter.
5. **Search & filters live in the URL** (`useSearchParams`): page, sort, filters. Page reload must reproduce the same list; the back button must work.
6. **Pagination** uses `page`/`limit` (≤ 50) and renders `meta.totalPages`; infinite scroll is not allowed (the API contract expects pages).
7. **Query keys** live in `api/queryKeys.ts` and are the only strings used by `useQuery`; after any cart mutation, invalidate the cart query so the header badge updates everywhere.
8. **Forms** validate with Zod schemas whose limits mirror the backend (`MaxLength`, `0.1 ≤ weightKg ≤ 200`, `Quantity 1..20`, `postalCode ≤ 10`, `title ≤ 50`, `receiverName ≤ 100`, `fullAddress ≤ 500`). Persian messages; numeric input keeps Persian digits usable (convert on submit).
9. **Phone input** accepts Persian/Arabic digits and `+98` and normalizes to `09XXXXXXXXX` client-side too (mirrors `phone.util.ts`).
10. **UI states.** Every data view implements: loading skeleton, empty state with a next action, error state with a retry button, and an offline/unreachable message.
11. **Accessibility & RTL.** `dir="rtl"` and `lang="fa"` at the root; every interactive element is keyboard reachable; images have `alt`; color is never the only signal for stock/status.
12. **Code style.** Files `kebab-case.ts(x)`, components `PascalCase`, hooks `useSomething`, English identifiers and comments, Persian only in UI strings. `any` is forbidden; no `@ts-ignore`/`eslint-disable` without a comment that references a `DECISIONS.md` id.
13. **One source for Persian labels of enums/statuses:** `lib/labels.ts`; pages import from there (no inline Persian literals for API enums).
14. **No secrets, no backend URLs hardcoded.** Only `import.meta.env.VITE_*`; a missing variable must fail loudly at startup.
15. **Tests required per phase** for: formatters (money/Jalali/phone), Zod schemas, query-string builders, and the auth refresh lock (F2). UI flows are covered by MSW integration tests where practical.

---

## 6. Frontend phases (one phase per commit/PR)

Each phase follows the same shape as the backend README: **Goal → Deliverables → Tasks → Acceptance criteria**. Evidence means a command output, a screenshot path or a recorded manual check — never "it should work".

### F0 — Bootstrap & foundations

**Goal:** a running `frontend/` app with the API client, configuration and quality gates in place; no user features yet.

**Deliverables:** the `frontend/` tree of §4 (including `docs/DECISIONS.md`, `docs/DEVELOPMENT_CHECKLIST.md`, `.env.example`, `README.md`); CI-ready npm scripts (`dev`, `build`, `preview`, `lint`, `test`, `typecheck`).

**Tasks**
1. Scaffold Vite + React + TS (strict, `noUncheckedIndexedAccess`), install the §3 dependencies **without version numbers**, commit `package-lock.json`.
2. Configure ESLint + Prettier to match backend style; add `npm run typecheck`.
3. Implement `src/api/client.ts`: base URL from `VITE_API_BASE_URL` (`http://localhost:3000/api/v1`), envelope parsing, `ApiError`, timeout, and the 401→refresh single-flight hook (refresh itself is finished in F2).
4. Implement `lib/format.ts` (Toman), `lib/jalali.ts`, `lib/phone.ts`, `lib/labels.ts` skeletons + unit tests for each.
5. Router with a public shell, `dir="rtl"`, Tailwind wiring and design tokens (`tokens.css`) with a **placeholder** palette until FR-DEC-02 is answered.
6. Add `.env.example` and a startup assertion that `VITE_API_BASE_URL` exists.
7. Record SEC/DEC entries in `frontend/docs/DECISIONS.md` (stack, token storage plan, folder rules) and complete `docs/DEVELOPMENT_CHECKLIST.md` with the local run steps verified in §11.
8. Smoke screen: `/health` call rendered on the home page with loading/error states (proves client + CORS + envelope work).

**Acceptance criteria**
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` all pass (paste outputs in the PR/commit).
- Home page shows the backend health result when the backend runs, and a clear error state when it does not (screenshot both).
- Tests exist and pass for `format`, `jalali`, `phone` helpers.
- `frontend/docs/DECISIONS.md` exists and contains the accepted stack + unanswered FR-DEC items.

### F1 — Design system & app shell

**Goal:** the reusable UI kit and the application shell that all later phases consume.

**Deliverables:** `components/ui/*` (button, input, select, checkbox, radio, textarea, badge, chip, card, modal/drawer, tabs, toast/snackbar, skeleton, empty-state, error-state, pagination, stepper, alert, breadcrumb), `components/layout/*` (header with cart badge + profile menu, footer, bottom navigation for mobile, page container), a **dev-only** gallery route `/dev/ui`, and a Persian style guide note in `frontend/docs`.

**Tasks**
1. Build the primitives with Tailwind + tokens; every component has a props interface and no business logic.
2. Persian typography scale (Vazirmatn), RTL spacing utilities, focus rings, and mobile-first breakpoints.
3. Toaster provider + `useToast()`; standardized skeleton and error/empty components used by later phases.
4. `/dev/ui` route renders every primitive in all states (disabled, loading, invalid, long text) — dev-build only.
5. Accessibility pass on the kit: keyboard order, ARIA roles for modal/drawer/tabs, color-contrast check.

**Acceptance criteria**
- Gallery route renders all primitives and states; keyboard-only walkthrough passes.
- No component imports anything from `api/` or `features/`.
- `lint`/`typecheck`/`build`/`test` green.

### F2 — Authentication & session

**Goal:** phone + OTP login with a robust session (refresh, logout, guards).

**Deliverables:** `features/auth/*`, `pages/login.tsx`, `pages/auth/verify-otp.tsx`, `api/endpoints/auth.ts`, an `AuthProvider`, `<RequireAuth>`/`<RequireGuest>` route guards, and a token store per FR-DEC-05.

**Tasks**
1. Login step 1: phone form (Persian/Arabic digits, `+98` accepted, normalized to `09XXXXXXXXX`), calls `POST /auth/otp/request`, shows `expiresIn` as a countdown and enforces the 60-second resend cooldown locally (constants from `OTP_RESEND_COOLDOWN_SECONDS`).
2. Step 2: 5-digit OTP input (single code cell component, paste support), calls `POST /auth/otp/verify`; handle `OTP_INVALID` (clear + focus), `OTP_EXPIRED` (offer resend), `OTP_RATE_LIMITED`, `USER_BLOCKED`.
3. Persist `{ accessToken, refreshToken }` per FR-DEC-05; implement the single-flight refresh in the client (`POST /auth/refresh`) and **replace both tokens** on every refresh (rotation); on refresh failure clear the session and route to `/login?next=...`.
4. Logout calls `POST /auth/logout` with the refresh token, clears state, and redirects home.
5. When `isNewUser` is true, route to a "complete your profile" hint (name/avatar → F3) instead of silently continuing.
6. Redirect back to the intended route after login (`next` query param, validated to internal paths only).
7. Header state reflects the session (guest vs. logged-in user from `GET /users/me`).
8. Tests: MSW-driven login flow (`request → verify → me`), one test proving parallel 401s trigger only **one** refresh call.

**Acceptance criteria**
- Manual end-to-end against the local backend with `OTP_DEV_CODE=12345` (screenshots of request, verify, logged-in header, logout).
- Refresh-after-expiry works: an expired access token recovers without user action (evidence: network log or test).
- The blocked-user path shows the Persian message and does not keep a session.
- `lint`/`typecheck`/`build`/`test` green.

### F3 — Profile & addresses

**Goal:** the user can maintain their identity and delivery addresses.

**Deliverables:** `pages/profile.tsx`, `pages/profile/edit.tsx`, `pages/addresses/index.tsx`, `pages/addresses/new.tsx`, `pages/addresses/[id]/edit.tsx`, `features/profile/*`, `features/addresses/*`, `api/endpoints/users.ts`, `api/endpoints/addresses.ts`, `api/endpoints/upload.ts`.

**Tasks**
1. Profile view: phone (read-only), name, avatar; edit form calls `PATCH /users/me`; avatar upload uses `POST /upload/image` (client-side type/size pre-check ≤ 5 MB, jpeg/png/webp) and stores the returned absolute URL.
2. Address book: list with the default badge first; create/edit form matching `CreateAddressDto` (`title`, `receiverName`, `receiverPhone`, `province`, `city`, `fullAddress`, `postalCode?`, optional `lat`/`lng`); Persian labels and validation mirroring backend lengths.
3. "Set as default" uses `PATCH /addresses/:id/default` and refreshes the list (server unsets others in a transaction).
4. Delete with a confirmation dialog; explain that if the deleted address was default, the newest remaining becomes default (mirror server behaviour after refetch).
5. `LIMIT_REACHED` on the 11th address shows the "حداکثر ۱۰ آدرس" message and hides the create button when `items.length >= 10`.

**Acceptance criteria**
- Create → edit → set default → delete flows verified against the backend (screenshots); default badge always unique.
- Ownership: opening another user's address id (crafted URL) shows a not-found state, not a crash (evidence: manual test with two sessions).
- `lint`/`typecheck`/`build`/`test` green; Zod schemas have unit tests.

### F4 — Pets

**Goal:** full pet management, which powers recommendations.

**Deliverables:** `pages/pets/*` (list, new, edit, detail), `features/pets/*`, `features/pets/schemas.ts`, `api/endpoints/pets.ts`, `api/endpoints/reference.ts` (pet types, breeds, tags).

**Tasks**
1. Pet list: cards with photo, name, type, breed, computed `lifeStage` (returned by the API), weight and gender; empty state pushing the user to add the first pet.
2. Create/edit form: `name`, `petTypeId` (from `GET /pet-types`), `breedId` (from `GET /pet-types/:id/breeds`, reset when the type changes), `birthDate` (Jalali picker, no future dates), `gender`, `isNeutered`, `weightKg` (0.1–200), `photo` (upload).
3. Tag editor (`PUT /pets/:id/tags`): two multi-select groups — allergens (`GET /tags?type=ALLERGEN`) and diet needs (`GET /tags?type=DIET`); saving **replaces** the whole set; show a clear "ذخیره" confirmation and refetch.
4. Pet detail: full profile + tags + "products suitable for this pet" entry point (F6).
5. Delete (soft): confirm dialog, optimistic removal, refetch the list.
6. `MAX_PETS_PER_USER` (10) surfaced from `LIMIT_REACHED`.

**Acceptance criteria**
- Breed options change with the selected type; submitting a mismatched breed is impossible from the UI (evidence: manual test + schema test).
- Tag replacement verified: removing one allergen and adding one diet tag persists exactly that set.
- Jalali birthdate round-trips correctly (evidence: unit test for the converter + manual check).
- `lint`/`typecheck`/`build`/`test` green.

### F5 — Catalog (home, list, product detail)

**Goal:** browsing/filtering/searching products and viewing a product page with variants.

**Deliverables:** `pages/index.tsx` (home), `pages/products/index.tsx`, `pages/products/[slug].tsx`, `features/catalog/*`, `api/endpoints/catalog.ts`, a `ProductCard` used by home/favorites/recommendations.

**Tasks**
1. `ProductCard` renders `{ name, brand, image (or placeholder), minPrice, inStock, lifeStage, sizeClass }`; the whole card links to `/products/:slug`.
2. Product list with **URL-synced** filters: `q` (debounced 400 ms), `petTypeId`, `categorySlug` (from `GET /categories` tree), `brandId`, `lifeStage`, `sizeClass`, `tagIds` (diet tags), price range, `inStock=true` only (BE-REQ-03), `sort` (`newest|price_asc|price_desc`), pagination via `meta`.
3. Product detail: gallery (fall back to a placeholder when `image` is null), variant selector by `weightGram` (shows `price`, `compareAtPrice` strike-through when present, `inStock`/`lowStock` badge), add-to-cart (F8 hook), favorite toggle (F7), tags ("حاوی"/"مناسب برای"), `ingredientsText`, `description`, breadcrumbs, and a "برای پت من مناسب است؟" hint linking to recommendations.
4. Home: hero placeholder, newest products (`sort=newest&limit=8`), category shortcuts, medicine entry card, and a login-aware section (guest sees login CTA).
5. All list pages implement skeletons, empty states with "پاککردن فیلترها", and an error state with retry; mobile filter drawer + desktop sidebar share one filter state hook.
6. If `sort=price_asc|price_desc` fails because of SCHEMA-001, the UI must degrade gracefully (toast + fallback `newest`) and the failure must be recorded in the PR (do **not** hide it).

**Acceptance criteria**
- Reloading a filtered URL reproduces the exact same list; back/forward navigation works.
- `inStock` filter and price range produce correct results against the backend (manual matrix with at least 5 combinations).
- Inactive products/variants never appear (spot-check with a deactivated variant in the admin/seed data).
- Price sorting status documented (works / blocked by SCHEMA-001) with evidence.
- `lint`/`typecheck`/`build`/`test` green; query-string builder unit-tested.

### F6 — Recommendations

**Goal:** "products suitable for my pet" using the backend's ranking.

**Deliverables:** `pages/pets/[id]/recommendations.tsx` (or `pages/recommendations.tsx?petId=`), `features/recommendations/*`, `api/endpoints/recommendations.ts`.

**Tasks**
1. Pet selector (default: first pet; remembers the last selection in `localStorage`).
2. Call `GET /products/recommendations?petId=&page=&limit=` and render cards with `matchedTags` as chips ("مناسب برای: بدون غلات، کنترل وزن").
3. Explain the input signals in a short info block (life stage, size, neutering, allergen exclusion) and add the required disclaimer that these are suggestions, not veterinary advice.
4. Empty state: prompt to complete the pet profile (birth date, weight, tags) when fewer than X results.
5. Guard: users without pets see a CTA to create one; `petId` of another user → not-found state.

**Acceptance criteria**
- Recommendation cards show `matchedTags` and never include a product whose `CONTAINS` tag matches one of the pet's allergens (manual verification with a seeded pet: add an allergen, confirm the product disappears).
- Switching pets refetches and updates the URL; the page is shareable via `petId`.
- `lint`/`typecheck`/`build`/`test` green.

### F7 — Favorites

**Goal:** save/unsave products and review them later.

**Deliverables:** `pages/favorites.tsx`, `features/favorites/*`, `api/endpoints/favorites.ts`, plus the reusable favorite toggle used in F5/F6.

**Tasks**
1. Toggle component (`PUT /favorites/:productId` / `DELETE ...`) with optimistic update + rollback on error; visible on cards, product detail, and recommendations.
2. Guests get an inline "برای ذخیره وارد شوید" action (favorite requires auth).
3. Favorites page: paginated product cards with the same `ProductCard`, remove action per card, empty state, and count in the header menu.
4. Invalidate the favorites query after each toggle so all visible toggles stay consistent.

**Acceptance criteria**
- Rapid repeated toggles do not leave the UI inconsistent (evidence: manual test + optimistic-rollback unit test).
- Removing the last item shows the empty state without a full page reload.
- `lint`/`typecheck`/`build`/`test` green.

### F8 — Cart & coupons

**Goal:** the cart as a reliable, always-fresh view of the server state, plus coupon preview.

**Deliverables:** `pages/cart.tsx`, `features/cart/*`, `features/coupons/*`, `api/endpoints/cart.ts`, `api/endpoints/coupons.ts`, header cart badge, "add to cart" mutations used by F5/F6/F7.

**Tasks**
1. Cart page renders exactly `{ items, itemsTotal }` from `GET /cart`: image, `productName`, `weightGram`, current `unitPrice`, quantity stepper (1..20), `total`.
2. `stockProblem` handling: `OUT_OF_STOCK` and `INSUFFICIENT` rows are highlighted with an explanatory Persian message and the checkout button is disabled while at least one row is unavailable — nothing is deleted silently.
3. Quantity changes (`PATCH /cart/items/:id`) and removals call the API, then replace the cart with the returned fresh view (no client-side arithmetic for totals).
4. Coupon box: `POST /coupons/validate`; on success show `discountAmount` and `finalAmount` (explicitly labelled "بدون هزینهٔ ارسال"), on failure map `COUPON_INVALID`, `COUPON_EXPIRED`, `COUPON_LIMIT_REACHED`, `COUPON_MIN_AMOUNT` to their Persian messages; allow removing the applied coupon locally.
5. Shipping estimate block: `itemsTotal >= 1,500,000` → "ارسال رایگان", otherwise `${50,000}` tagged as "تخمینی — مبلغ نهایی در سفارش محاسبه میشود" (BE-REQ-04).
6. Header badge reflects `items.length` and updates after every mutation; `DELETE /cart` behind a confirmation.
7. Empty cart state with a CTA back to the catalog; guests see a login prompt instead of the page.

**Acceptance criteria**
- After changing a variant price or stock on the server, the cart shows the new state on refetch (evidence: manual test using Prisma Studio / seed change).
- The checkout button is disabled exactly when any row has a `stockProblem`; re-enabling happens after the problem is fixed (evidence: screenshots).
- Coupon limit/minimum errors show the exact server message (evidence: manual test with seeded `SUMMER20` and `FLAT50K`).
- `lint`/`typecheck`/`build`/`test` green.

### F9 — Checkout, payments & orders

**Goal:** turn the cart into a paid order, then let the user track it.

**Deliverables:** `pages/checkout.tsx`, `pages/payment/result.tsx`, `pages/orders/index.tsx`, `pages/orders/[id].tsx`, `features/checkout/*`, `features/orders/*`, `api/endpoints/orders.ts`, `api/endpoints/payments.ts`.

**Tasks**
1. Checkout page: address picker (with "افزودن آدرس جدید" shortcut), coupon field (same component as F8), order note, price summary (items total, discount, shipping, payable) and a disabled state when the cart has problems or no address exists.
2. `POST /orders { addressId, couponCode?, note? }` → on success clear cart state, remember `orderId` in `sessionStorage` (workaround for BE-REQ-02), then immediately call `POST /payments/start { orderId }` and navigate the browser to `paymentUrl` (`window.location.assign`).
3. `/payment/result` page reads `?orderNumber=&status=`; because the callback returns the order **number** only, resolve the order via the remembered `orderId` (fallback: `GET /orders` first page lookup by `orderNumber`), then show success/failure; on failure offer "تلاش دوباره" (start payment again while the order is `PENDING_PAYMENT`) and "انصراف از سفارش" (cancel).
4. Show the 30-minute expiry notice (`ORDER_EXPIRE_MINUTES`) on `PENDING_PAYMENT` orders; after expiry the server cancels the order, so the UI must refetch and show `CANCELED`.
5. Orders list: paginated, newest first, each row showing `orderNumber` (mono/LTR), Jalali date, status badge, `finalAmount`; client-side filtering only over the fetched page unless the backend supplies a status filter (§7 — do not invent query params).
6. Order detail: item snapshots, address snapshot, payments state, cancel button only for `PENDING_PAYMENT` (`ORDER_INVALID_STATE` handled), and a delivery block for `shippingMethod`/`trackingCode`/`shippedAt`/`deliveredAt` when present.
7. Error handling: `CART_EMPTY`, `OUT_OF_STOCK`, `VARIANT_UNAVAILABLE`, `COUPON_*` and `ORDER_INVALID_STATE` each get a precise Persian message plus a next action; a failed checkout must never leave the UI claiming success.

**Acceptance criteria**
- Full happy path against the local backend with `PAYMENT_DRIVER=mock`: cart → checkout → mock gateway → `/payment/result?status=success` → order `PAID` visible in the orders list (evidence: screenshots + the order row from `GET /orders`).
- Failed/cancelled path: simulate a failure and confirm the order stays `PENDING_PAYMENT`, the result page shows failure, and retry works.
- Zero-stock race: with a single unit in stock, a second checkout attempt shows `OUT_OF_STOCK` (evidence: manual test or documented scenario).
- The result page works after a **hard reload** (sessionStorage fallback path) and shows a clear message if it cannot resolve the order.
- `lint`/`typecheck`/`build`/`test` green.

### F10 — Medicines & pharmacies (information only)

**Goal:** the informational medicine section with its mandatory disclaimer.

**Deliverables:** `pages/medicines/index.tsx`, `pages/medicines/[id].tsx`, `pages/pharmacies/index.tsx`, `pages/pharmacies/[id].tsx`, `features/medicines/*`, `features/pharmacies/*`, `api/endpoints/medicines.ts`.

**Tasks**
1. Medicine list: search (`q`), pet-type filter, `requiresPrescription` filter, pagination; each card shows name, active ingredient and a "نیازمند نسخه" badge when applicable.
2. Medicine detail: description, active ingredient, pet types, the **exact** `disclaimer` string returned by the API inside a warning alert (never rewrite it), and the pharmacy list (`city` filter) sorted by the server with `isVerified`/`is24h`/`lastConfirmedAt` badges.
3. Pharmacy list/detail: `city`/`province`/`is24h` filters, `workingHours`, `lat`/`lng` external map link, `tel:` click-to-call.
4. `lastConfirmedAt` is rendered as a Jalali relative date ("آخرین تأیید: ۳ روز پیش").
5. An explicit "این بخش صرفاً اطلاعاتی است؛ قیمت و موجودی ندارد" note on both medicine and pharmacy pages.

**Acceptance criteria**
- The disclaimer rendered on the medicine detail page is identical to the API value (evidence: side-by-side check or test).
- Persian search works with `ی/ي` and `ک/ك` variants (evidence: manual searches with both spellings).
- No price/stock field is rendered anywhere in this section.
- `lint`/`typecheck`/`build`/`test` green.

### F11 — Quality, performance & delivery

**Goal:** a production-ready frontend with a repeatable release path.

**Deliverables:** performance/a11y fixes, `frontend/README.md` (run + build + deploy instructions), a completed `frontend/docs/DEVELOPMENT_CHECKLIST.md`, optional CI workflow (`.github/workflows/frontend.yml`) and optional Playwright suite (FR-DEC-06), plus the deployment decision recorded in `DECISIONS.md`.

**Tasks**
1. Route-level code splitting, image lazy loading, bundle-size report from `npm run build`.
2. Accessibility audit (keyboard, focus trap, contrast, form labels) and a mobile pass at 360 px width.
3. Error boundaries per route + global 404 / "unexpected error" pages.
4. SEO/link hygiene: per-route `<title>`/meta, `robots.txt`; note that SSR/SEO is a decision (FR-DEC-03), not a requirement.
5. Production build + env documentation; confirm with the backend owner that `CORS_ORIGINS` and `FRONTEND_PAYMENT_RESULT_URL` match the deployed origins.
6. Re-run the full regression checklist of §12 and update this roadmap's Status/Progress tables.

**Acceptance criteria**
- `npm run build` bundle size and Lighthouse numbers recorded (mobile + desktop).
- Full user journey re-run on a production build (`npm run preview`) against the local backend, including one payment success and one failure.
- Every phase status in §12 reflects reality with evidence links; unresolved items are listed explicitly (no green-washing).
- Deployment instructions in `frontend/README.md` are executable by another person/LLM without questions.

---

## 7. Backend items (report to the backend owner — do not edit `backend/` from FE work)

`BE-REQ` = a change we need in the backend. `BE-Q` = a question we need answered. Both are reported by the frontend owner to the backend owner; nothing here is implemented silently, and the frontend must ship a documented workaround until the answer arrives.

| ID | Type | What we need | Evidence (read from `main`) | Needed before | Status |
|---|---|---|---|---|---|
| SCHEMA-001 | change | Resolve the `Product.minPrice` mismatch: either add the field (with migration + backfill) or remove its usages | `product-variants.service.ts:24`, `products.service.ts:112-113`, `seed.ts`; field absent from `prisma/schema.prisma` (also recorded in `backend/docs/SCHEMA_CHANGE_REQUESTS.md`) | F5 acceptance | OPEN — waiting for the backend owner |
| BE-REQ-02 | change | Return the numeric `orderId` in the payment redirect (or add `GET /orders/by-number/:orderNumber`) so the result page can fetch the order deterministically | `payments.callback.controller.ts:38` redirects with `orderNumber` only; `GET /orders/:id` needs the id | F9 | OPEN — FE ships with the sessionStorage workaround |
| BE-REQ-03 | change/verify | Wire `ProductQueryDto` to `GET /products` (`products.controller.ts:43` currently uses `PaginationQueryDto & any`) and parse `inStock`/booleans with a real boolean transform | `product-query.dto.ts:56-60` uses `@Type(() => Boolean)` (so `inStock=false` becomes `true`) | F5 | OPEN — FE sends `inStock=true` only |
| BE-REQ-04 | question | Should `GET /cart` return a shipping/discount estimate, or stay as-is (FE renders a clearly-marked estimate from constants)? | `cart.service.ts:93-98` returns only `itemsTotal` | F8/F9 | OPEN — FE uses the estimate |
| BE-REQ-05 | question | Product cards omit `compareAtPrice` although README Phase 6 lists it. Add it to the card or keep discount info on the detail page only? | `products.service.ts:141-151` vs README Phase 6 card shape | F5 | OPEN |
| BE-REQ-06 | question | `POST /auth/refresh` rotates the refresh token (old one deleted). Confirm this is final so the FE can treat refresh as a stateful operation | `auth.service.ts:138-139` | F2 | OPEN — documented assumption in FE |
| BE-REQ-07 | question | OTP resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS=60`) is not returned by the API (only `expiresIn`). Expose it or keep the FE constant in sync? | `auth.service.ts:27-33` returns `{ expiresIn }` only | F2 | OPEN — FE hardcodes 60s + a `DECISIONS.md` note |
| BE-REQ-08 | question | `GET /orders` has no documented status filter in the controller (only pagination). Is filtering by status planned, or is client-side filtering the contract? | `orders.controller.ts:35-43` uses `PaginationQueryDto` only | F9 | OPEN — FE does not invent query params |
| BE-REQ-09 | info | Dev-only: `PAYMENT_DRIVER=mock` + `OTP_DEV_CODE=12345` are required for local QA. Confirm they are never enabled in production (env validation already blocks Swagger in production) | `payments.service.ts:19-30`, `.env.example:18,23` | F0 | CONFIRMED for dev usage |
| BE-REQ-10 | info | Uploads are served from `/uploads` **without** the `/api/v1` prefix (`main.ts:38-39`). Any reverse proxy/deployment must route `/uploads/*` to the backend so stored absolute URLs keep working | `main.ts:38-39`, `upload.service.ts:71` | F11 deployment | OPEN — needs confirmation at deployment |

**Rule for the frontend:** never fix a `BE-REQ` by changing `backend/`, and never mask a failing endpoint in the UI. If an endpoint is broken, the phase must record the failure and ship the documented fallback (see F5 note on price sorting).

---

## 8. Decisions needed from the human owner (blocking or near-blocking)

| ID | Decision | Needed for | Default if unanswered |
|---|---|---|---|
| FR-DEC-01 | Approve the stack of §3 (Vite + React + TS + Tailwind + TanStack Query + React Hook Form + Zod, `fetch` client) | F0 | the §3 proposal is treated as accepted and copied to `frontend/docs/DECISIONS.md` |
| FR-DEC-02 | Brand identity: product name spelling ("Dr. Gupet" / "دکتر گوپت"), logo, primary/secondary colors, radius, typography scale | F1 (visual layer) | neutral placeholder palette + text logo, clearly marked `TODO(decision)` in `tokens.css` |
| FR-DEC-03 | Deployment target and public URLs (static host/CDN/SSR? domain?), plus the values the backend needs in `CORS_ORIGINS` and `FRONTEND_PAYMENT_RESULT_URL` | F11 | unknown — documented as an open deployment item; local-only setup |
| FR-DEC-04 | Jalali date picker library (e.g. a maintained Persian picker) vs. a native `<input type="date">` + display-only Jalali | F3/F4 | display-only Jalali + native input until decided |
| FR-DEC-05 | Token storage: `accessToken` in memory + `refreshToken` in `localStorage`, or both in `localStorage`? (Refresh tokens live in Redis server-side, so they cannot be httpOnly cookies today) | F2 | `accessToken` in memory, `refreshToken` in `localStorage`, with an explicit XSS note in `DECISIONS.md` |
| FR-DEC-06 | Do we add Playwright browser E2E in F11? | F11 | skipped; MSW integration tests only |
| FR-DEC-07 | Git workflow: branch-per-phase + PR (recommended) or direct commits to `main` (backend precedent), and who merges | F0 onward | branch-per-phase + PR, direct commits only for documentation |
| FR-DEC-08 | Dev environment: is Docker allowed/available on the development machine? (Postgres 16 + Redis 7 are required; `docker` was not found in `PATH` during this review) | F0 acceptance | document the actual working setup (Docker or local services) in `frontend/docs/DEVELOPMENT_CHECKLIST.md` |
| FR-DEC-09 | Which environments exist (dev / staging / production) and whether the frontend gets its own `.env` per environment | F0/F11 | `VITE_API_BASE_URL` only, one local env |

Write every accepted answer into `frontend/docs/DECISIONS.md` as `DEC-<n>` with date, decision and consequences (same spirit as the backend's decision record).

---

## 9. Roles & ownership (evidence from GitHub)

Findings from the remote (read on 2026-09-24):

| Signal | Evidence | Reading |
|---|---|---|
| Repository owner | `MohammadAky` (`Mohammad Akbary`), author of `9c7fb66 first commit` | holds write access; the account that can push/merge today |
| Backend implementation commits | Phases 0–15 authored by `Developer <dev@local>` in `main` @ `d3f99bc` | backend was produced by an **AI agent identity** (sandbox author, not a GitHub account) and pushed with the owner's credentials |
| Local-only branch `codex/phase-0-bootstrap` (at `7beae2f`, ancestor of `main`) | exists only in this workspace; never pushed | leftover from the backend agent's first session; keep until its author confirms, then it can be deleted (`git branch -d`) |
| Issue #1 (open, no comments) | `درخواست دسترسی Collaborator برای KianTheGoat` by `KianTheGoat`, asking for write access "to push development branches and open pull requests" | a second collaborator without write access yet — this matches the **frontend** role, which has no code in the repo |
| Untracked local files | `backend/docs/DEVELOPMENT_CHECKLIST.fa.md`, `backend/docs/SCHEMA_CHANGE_REQUESTS.md`, `backend/package-lock.json` | produced locally (backend/agent side), not on GitHub — GitHub stays authoritative; do not commit them from frontend work |

**Working assumption (confirm in one line when replying):** frontend owner = the person driving this roadmap (git identity not configured locally; matches the collaborator request pattern), backend owner = `MohammadAky` (repo owner) working through an AI agent. Ownership column in §12 uses `FE` for all frontend phases.

Governance note: until write access is resolved (Issue #1), the frontend can only work locally; the roadmap file and every phase must be pushed through whoever holds access, or the issue must be accepted first.

---

## 10. Workflow, Definition of Done and AI hand-off

### 10.1 Git workflow

- Branches: `frontend/f<N>-<short-slug>` (e.g. `frontend/f0-bootstrap`), one phase per branch, one PR per phase (pending FR-DEC-07).
- Commit messages follow the backend's style (English, imperative, phase name):
  `feat(web): implement Phase F2 — Auth & session` / `fix(web): cart stockProblem banner` / `docs(roadmap): update frontend status after F2`.
- A PR must contain: the phase's diff, the command outputs of §10.2, the updated §12 tables, and a short "what I could not do" list.
- Never commit: `frontend/.env*`, `node_modules`, `dist`, screenshots dumps, tokens/secrets.
- Do not touch `backend/` in a frontend PR. Backend needs go through §7.

### 10.2 Definition of Done (per frontend phase)

1. All tasks of the phase are implemented (no partial "TODO later" without a recorded `TODO(decision)`).
2. `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` are green — outputs pasted in the PR.
3. Acceptance criteria of the phase each have recorded evidence (command output, screenshot path, or a test name).
4. Persian UI strings reviewed (no mixed English text in the UI; numbers/Latin identifiers marked `dir="ltr"` where needed).
5. Error paths implemented for every API call of the phase (loading/empty/error/retry).
6. `frontend/docs/DECISIONS.md` updated if any decision was taken; §7 updated if a backend item was discovered.
7. §12 `Status` and `Progress log` updated in the same commit, including anything that failed.
8. The phase's work is reproducible: a fresh clone + `npm install` + `npm run dev` reproduces the result.

### 10.3 Hand-off prompt template (for an AI model)

```text
You are implementing PHASE F<n> — <NAME> of the Dr. Gupet frontend.

Context:
- Read Roadmap-Frontend.md sections 1–6 and the "Phase F<n>" section, plus §7
  (backend items) and §10 (Definition of Done).
- Source of truth is GitHub: github.com/MohammadAky/Dr.Gupet, branch main.
  Do NOT edit backend/; if the backend must change, add a BE-REQ-* row in §7.
- The repo layout and conventions are in §4 and §5. Reuse existing components
  and the api/client.ts; never call HTTP from a component directly.

Scope:
- Implement only the tasks listed for phase F<n>.
- Do not implement later phases; do not add dependencies outside §3 without a
  DECISIONS.md entry.

Deliver:
1. The code for the listed files.
2. Tests required by the phase's acceptance criteria.
3. Outputs of: npm run lint && npm run typecheck && npm run build && npm test.
4. Updated Status and Progress log tables in Roadmap-Frontend.md.
5. A summary: files touched, decisions, evidence, and anything not completed.
```

---

## 11. Local development runbook

Verified on this machine on 2026-09-24: `node v24.21.0` available, `backend/node_modules` present, **`docker` not found in `PATH`**, `backend/.env` missing, and `npx prisma generate` failed (`.prisma/client` was never produced), `backend/prisma/migrations/` contains only `.gitkeep`. PowerShell blocks `npm.ps1`/`npx.ps1` (`ExecutionPolicy`) — use `npm.cmd`/`npx.cmd` or `cmd /c`.

> **Environment blocker (report to the backend owner):** `npx prisma generate` in this workspace returned `{"kind":"result","envelope":{"ok":false,...,"summary":"No command registered for 'generate'"}}` together with a Prisma Composer skills notice, so no Prisma Client exists here and the backend cannot boot locally yet. The backend owner must supply a verified `npm install` + `generate` + `migrate` + `seed` path; until then the frontend can only be validated against MSW mocks, and F0's "health smoke test" must be marked `⚠` instead of `☑`.

### 11.1 Backend (required for real API testing)

```bash
cd backend
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm install                   # installs and writes package-lock.json
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev             # http://localhost:3000, Swagger at /docs
```

Postgres 16 and Redis 7 must be reachable (`DATABASE_URL`, `REDIS_URL`). `docker-compose.yml` provides both (`docker compose up -d`); if Docker is unavailable on the machine (FR-DEC-08), install/point to local services instead and record the working setup in `frontend/docs/DEVELOPMENT_CHECKLIST.md`.

### 11.2 Frontend

```bash
cd frontend
Copy-Item .env.example .env   # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev                   # http://localhost:5173  (matches CORS_ORIGINS)
npm run test                  # Vitest
npm run build && npm run preview
```

### 11.3 Demo data for manual QA (from `prisma/seed.ts`)

| Item | Value |
|---|---|
| OTP login code (dev) | `12345` (`OTP_DEV_CODE`, honoured only when `NODE_ENV != production`) |
| Admin user phone | `09120000000` (`ADMIN_SEED_PHONE`, role `ADMIN`) |
| Coupons | `SUMMER20` (percent) and `FLAT50K` (fixed) |
| Shipping | flat `50,000`, free from `1,500,000` |
| Order expiry | 30 minutes |
| Sample catalog | pet types `سگ`/`گربه`, ~10 breeds each, allergen + diet tags, brands, dog/cat dry-food categories, sample products with 2–3 variants, placeholder pharmacies/medicines |

### 11.4 Mock payment walkthrough (dev)

1. Cart → checkout (`POST /orders`) → note the returned `orderId`/`orderNumber`.
2. `POST /payments/start` with that `orderId` → `{ paymentUrl }`.
3. Open `paymentUrl`: `/api/v1/payments/mock-pay` immediately redirects to the callback, which redirects to `http://localhost:5173/payment/result?orderNumber=...&status=success`.
4. `GET /orders/:id` must now show `PAID`.

---

## 12. Status board, progress log and regression checklist

> Update this section **in the same commit** as the phase work. Never mark a phase done without evidence. Mirrors README §16.

### 12.1 Status (at the time this file was created, 2026-09-24)

| Phase | Name | Owner | Status | Evidence |
|---|---|---|---|---|
| F0 | Bootstrap & foundations | FE | ☐ | — |
| F1 | Design system & app shell | FE | ☐ | — |
| F2 | Authentication & session | FE | ☐ | — |
| F3 | Profile & addresses | FE | ☐ | — |
| F4 | Pets | FE | ☐ | — |
| F5 | Catalog (home, list, detail) | FE | ☐ | — |
| F6 | Recommendations | FE | ☐ | — |
| F7 | Favorites | FE | ☐ | — |
| F8 | Cart & coupons | FE | ☐ | — |
| F9 | Checkout, payments & orders | FE | ☐ | — |
| F10 | Medicines & pharmacies | FE | ☐ | — |
| F11 | Quality, performance & delivery | FE | ☐ | — |

Legend: ☐ not started · ◐ in progress · ☑ done (evidence linked) · ⚠ done with an open caveat (list it).

### 12.2 Progress log (append-only)

| Date | Phase | Commit / PR | Evidence | By |
|---|---|---|---|---|
| 2026-09-24 | — (roadmap) | this file's commit | backend inventory and §7 findings read from `main` @ `d3f99bc` | frontend owner + AI session |

### 12.3 Frontend regression checklist (used from F5 onward, mandatory in F11)

- [ ] Guest: home, product list (filters + pagination), product detail, medicines, pharmacies.
- [ ] Login: request OTP → cooldown countdown → verify → header session → logout.
- [ ] Session: access-token expiry recovers silently; refresh failure logs out cleanly.
- [ ] Profile: edit name/avatar; 10-address limit; default-address invariant.
- [ ] Pets: create with breed cascade + Jalali birthdate + tags; edit; delete; recommendations for the pet.
- [ ] Catalog: search with `ی/ي` variants, price range, `inStock`, sorting (record SCHEMA-001 status), inactive products never visible.
- [ ] Favorites: toggle from card/detail/recommendations; list page; optimistic rollback on failure.
- [ ] Cart: add/merge, quantity limits (1..20, stock), `stockProblem` warnings, cart badge, clear cart.
- [ ] Coupons: `SUMMER20`, `FLAT50K`, invalid code, min-amount failure, per-user limit failure.
- [ ] Checkout: address + coupon + note → order; expired order (30 min) shows `CANCELED`; zero-stock race shows `OUT_OF_STOCK`.
- [ ] Payments: success and failure paths, result page after hard reload, retry payment, cancel order.
- [ ] Orders: list pagination, detail snapshots, tracking block when present.
- [ ] Medicines/pharmacies: disclaimer text identical to the API, `lastConfirmedAt` in Jalali, no price/stock anywhere.
- [ ] Mobile (360 px), RTL correctness, keyboard-only pass, Persian digits/formatting everywhere.

### 12.4 How to keep this file current

1. Update §12 tables and add a `Progress log` row **in the same commit** as the phase work.
2. If a decision is made or reversed, update §8 and `frontend/docs/DECISIONS.md` together.
3. If a backend need appears, add/adjust the §7 row and report it to the backend owner before phase acceptance.
4. Refresh the baseline commit table in §0 whenever `backend/` changes on `main` (`git log --oneline -5 origin/main`).

---

## 13. References

- `README.md` (root) — product scope (§1), backend tech stack (§2), golden rules (§3), repository layout (§4), domain model (§5), API conventions & envelopes (§6), environment (§7), backend phases (§8), business rules (§9), API summary (§10), testing (§11), pitfalls (§12), definition of done (§13), status (§16), glossary (§17).
- `backend/docs/CHANGELOG.md` — what each backend phase delivered; `backend/docs/IMPLEMENTATION_SUMMARY.md` — phase 0–1 report; `backend/docs/SCHEMA_CHANGE_REQUESTS.md` (local, untracked) — SCHEMA-001.
- `backend/src/modules/**` — the code is the contract when documentation and behaviour disagree; §2 of this file is the frontend's distilled version of it.
- GitHub: `https://github.com/MohammadAky/Dr.Gupet` — issue #1 (collaborator access request); single branch `main`.
- Backend source of truth for this document: commit `d3f99bc` (2026-09-22, "feat: implement Phase 15 - Hardening & Delivery").

### Appendix A — critical JSON examples (exact shapes)

```jsonc
// POST /auth/otp/verify  →
{ "success": true, "data": {
    "accessToken": "...", "refreshToken": "...",
    "user": { "id": 1, "firstName": null, "lastName": null, "phone": "09123456789",
              "avatar": null, "role": "USER", "status": "ACTIVE", "isPhoneVerified": true },
    "isNewUser": true } }

// GET /cart  →
{ "success": true, "data": {
    "items": [{ "id": 12, "variantId": 34, "productName": "...", "productSlug": "...",
                "productImage": "http://localhost:3000/uploads/x.webp", "weightGram": 2000,
                "unitPrice": 1250000, "quantity": 1, "total": 1250000, "available": true }],
    "itemsTotal": 1250000 } }

// GET /products?page=1&limit=20&inStock=true  →
{ "success": true,
  "data": [{ "id": 5, "name": "...", "slug": "...", "brand": { "id": 2, "name": "..." },
             "image": null, "minPrice": 890000, "inStock": true,
             "lifeStage": "ADULT", "sizeClass": "MEDIUM" }],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }

// error example  →
{ "success": false, "statusCode": 400, "code": "COUPON_MIN_AMOUNT",
  "message": "حداقل مبلغ سفارش ۱٬۰۰۰٬۰۰۰ تومان است" }
```















