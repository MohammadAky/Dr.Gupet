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
- **Consequences:** `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` must pass together. This is a frontend-only dependency change.

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

## Open owner and release decisions


- **FR-DEC-03:** Deployment target, public URLs, backend CORS origin and payment callback URL are unknown; local preview only.
- **FR-DEC-06:** Browser E2E tooling remains optional for F11; automated tests and manual preview do not replace live payment/auth acceptance.
- **FR-DEC-07:** The roadmap proposes phase branches and PRs, but the owner's explicit local-preview approval gate applies before any commit, push or PR.
- **FR-DEC-08/09:** The backend development environment and deployment environment list require confirmation from the respective owners. A local `VITE_API_BASE_URL` exists only in ignored `.env`.
- **FR-DEC-02 release rights:** The owner supplied the visual direction; authority to publish the logo, public operator identity/contact, retention details and processor disclosures remain open before a public launch.
