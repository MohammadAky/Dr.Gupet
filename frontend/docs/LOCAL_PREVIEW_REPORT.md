# Dr. Gupet frontend — local preview evidence (2026-09-25)

This is the owner-approved frontend preview snapshot. GitHub `MohammadAky/Dr.Gupet` `origin/main` was refreshed and remained at `f175c145092eea767a7850df450c6cbe11aa6df4`. The isolated worktree is `D:\Dr.Gupet-frontend-design` on `frontend/design-system`; no file under `backend/` was changed. After the requested menu and cookie-notice corrections, the owner explicitly approved the current design and authorized commit and push on 2026-09-25. This is not acceptance of the remaining phase or release gates.

## Preview

- Production build: `http://127.0.0.1:5174/` (local loopback only).
- Development UI gallery: `http://127.0.0.1:5173/dev/ui`. The same route renders 404 in the production build.
- If a local preview process is no longer running: from `frontend/`, run `npm ci`, copy `.env.example` to ignored `.env`, then `npm run dev -- --host 127.0.0.1` or `npm run preview -- --host 127.0.0.1 --port 5174` after `npm run build`.
- The backend at `127.0.0.1:3000` is currently unavailable. Catalog/health areas deliberately show Persian retry/error states rather than invented product data.

## Implemented in this review

- Owner-supplied logo, exact `#122F12`/`#D49F28` palette, self-hosted Vazirmatn, responsive RTL home, shared header/footer/mobile bottom navigation, and a development-only UI component gallery. Font notice is distributed at `/licenses/Vazirmatn-OFL.txt`; image/rights provenance is in `DESIGN_SYSTEM.md`.
- English floating first-visit cookie notice per DEC-011, with only equally prominent Accept/Deny buttons. The footer link, `/privacy` page and category settings were removed by owner direction. Both choices only record the response to this notice; no analytics or advertising vendor is integrated or authorized for future use. OTP phone is no longer in a URL; it is kept temporarily in same-tab storage, and document referrers are disabled.
- Frontend identity fixes: one in-flight refresh rotation during StrictMode replay/concurrent 401s, account-cache clearing at identity changes, immediate local-session clearing on logout even when server revocation is slow, and a guest cart badge that never reads the previous account's cache. Malformed HTTP success envelopes now fail explicitly.
- Owner's focused visual corrections: mobile menu button sits immediately to the right of the circular logo, shifting the logo left; the health-information promo heading renders at weight 700.
- Existing frontend flow fixes: URL-driven catalog draft inputs, safe retry after a pet was created but its tag write failed, real recommendation pagination, and preservation of order ID/number before payment redirects and retries. Gateway callback text alone is not treated as payment proof.

## Verification

| Check | Local result |
|---|---|
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass; production artifact includes Vazirmatn OFL notice |
| `npx prettier --check src` | Pass after formatting the frontend source |
| `npm test -- --maxWorkers=1 --no-file-parallelism` | 91 passed across 16 files, including refresh replay, identity cache, immediate logout clearing, cookie Accept/Deny, malformed envelope, catalog URL state, pet retry and recommendations pagination. The first concurrent run timed out starting four workers while lint/typecheck/build ran; the bounded rerun passed. |
| `npm audit --audit-level=moderate` | 0 reported vulnerabilities (known dependency advisories only) |
| `git diff --check` and backend diff | Pass; no `backend/` file changed |
| Browser preview | Home and gallery viewed at 360 px and 768 px without horizontal overflow; desktop home viewed; gallery dialog Escape/focus restoration and RTL tab-arrow behavior checked; production `/dev/ui` was 404. Latest 499/360 px review verified menu immediately right of circular logo, responsive opening, promo weight 700, two-button English floating notice, no privacy link and no horizontal overflow. |
| `GET http://127.0.0.1:3000/api/v1/health` | Connection refused; live API/CORS success not verified |

## Remaining acceptance gates, in roadmap order

1. **F0:** run the real backend health/CORS smoke and capture both success and failure evidence. The backend belongs to its separate owner; do not edit `backend/` from this worktree.
2. **F1:** complete the full keyboard/screen-reader, long Persian text, 200% zoom, reduced-motion and automated contrast walkthrough. The current visual direction has owner approval; the technical acceptance remains open.
3. **F2–F10:** the GitHub frontend contains routes/logic, but the roadmap's phase acceptance and live OTP, profile, catalog, cart, payment and order journeys are not verified here. Do not infer acceptance from the 91 automated tests.
4. **F11/public release:** run live browser network/cookie/header and payment redirect checks, review the refresh-token-in-localStorage XSS tradeoff and deployment CSP, complete the operator's legal identity/contact/retention/processor disclosures, and confirm publication rights for the supplied logo. The owner removed the persistent privacy page and settings from this preview; jurisdiction-specific disclosure and revisit requirements remain unresolved before publication. A formal exhaustive security scan was not completed in this environment; `npm audit` and focused source/tests cannot establish that no vulnerability exists.

Status remains **F0/F1 in progress** in `Roadmap-Frontend.md` §12. The owner approved committing and pushing this preview; further phase acceptance and publication remain separate decisions.
