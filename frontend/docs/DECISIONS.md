# Decisions Record — Dr. Gupet Frontend

## DEC-001: Architecture & Technology Stack
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** Vite + React 19 + TypeScript (strict) + React Router v7 + TanStack Query v5 + Zod v3.
- **Why:** Vite port 5173 matches backend defaults (`CORS_ORIGINS` & `FRONTEND_PAYMENT_RESULT_URL`). React ecosystem has full RTL and Jalali support. TanStack Query manages server state, caching and cart invalidations.
- **Consequences:** All network calls flow through `src/api/client.ts`. Direct `fetch` inside components is forbidden.

## DEC-002: Division of Concerns (Functionality vs Visual Design)
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** This frontend implementation owns all business logic, routing, auth/session rotation, API synchronization, validation, and semantic markup. Visual design, theme styling, colors, and design system components are deferred to a dedicated design LLM/designer.
- **Why:** Clear boundaries prevent mixing visual regressions with business logic bugs.
- **Consequences:** `src/styles.css` is a structural placeholder only. The design LLM can replace or wrap components without changing `src/api/*`, `src/features/*`, or form logic.

## DEC-003: Token Storage & Refresh Strategy
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** `accessToken` in memory only (never written to web storage). `refreshToken` stored in `localStorage`.
- **Why:** Server rotates refresh tokens in Redis on every use and revokes previous tokens. Storing refresh token allows session persistence across reloads while minimizing access token exposure to XSS.
- **Consequences:** Single-flight refresh gate in `src/api/single-flight.ts` guarantees that N parallel 401s trigger exactly one refresh call.

## DEC-004: Money & Integer Representation
- **Status:** ACCEPTED
- **Date:** 2026-09-24
- **Decision:** All monetary values are integers in Toman. Server is the single source of truth; client only renders values using `formatToman()` with Persian thousands separator (`\u066C`).
- **Consequences:** Client never computes payable amounts. In cart, shipping is displayed as a clearly-marked estimate.
