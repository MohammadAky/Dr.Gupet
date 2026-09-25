# Frontend development checklist and local evidence

This is a reproducible runbook and evidence register, not a replacement for `Roadmap-Frontend.md` §§6 and 12. Checked items below mean **file-inspection evidence** only; commands and live API outcomes need their own recorded runs. Current isolated worktree began from GitHub `main` commit `f175c145092eea767a7850df450c6cbe11aa6df4`. The owner approved this preview for commit and push; refresh the remote head before each later phase.

The current cross-page visual findings and their phase-ordered queue are in `DESIGN_REVIEW_2026-09-25.md`.

## Local runbook (PowerShell)

- [x] `frontend/package.json` and `package-lock.json` exist; package scripts include `dev`, `lint`, `typecheck`, `build`, `preview`, and `test` (source inspection in this worktree).
- [x] `frontend/.env.example` documents `VITE_API_BASE_URL=http://localhost:3000/api/v1`; `src/lib/env.ts` fails at startup when it is absent.
- [x] Vite development and preview ports are 5173 in `frontend/vite.config.ts`.
- [x] From `frontend/`, `npm ci` succeeded; `.env.example` was copied to ignored `.env`; Vite served `http://127.0.0.1:5173/`. Home, login and privacy were visually inspected in the in-app browser. No screenshot file was exported.
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, and bounded `npm test -- --maxWorkers=1 --no-file-parallelism` passed on 2026-09-25 after the owner's focused corrections; exact totals are recorded in `LOCAL_PREVIEW_REPORT.md`. `npm run preview -- --port 5174` served the production build, where `/dev/ui` rendered 404. Phase acceptance remains gated by the criteria below.
- [ ] With a live backend, verify home `/health`, CORS, auth, catalog, and the active phase's API cases. The backend is currently unavailable for this local design pass; mocked/unit results must not be recorded as live integration success.

## F0/F1 acceptance evidence to collect

- [x] Frontend routes, API client, tokens CSS, Vazirmatn imports, and brand images exist by source inspection; the owner removed the `/privacy` route under DEC-011. This alone does **not** close F0 or F1.
- [ ] Confirm F0's full acceptance in Roadmap §6, including `/health` result plus unreachable-state screenshots. Lint, typecheck, build, tests and `npx prettier --check src` pass on this frontend worktree. Keep live-only criteria open while the API cannot run.
- [x] F1 primitives, shared Header/Footer, mobile bottom navigation, global ToastProvider, and `/dev/ui` gallery exist; `rg` found no API/feature imports in `components/ui`. Browser checks verified dialog focus/Escape restoration and RTL left-arrow tab movement. The production build does not expose `/dev/ui`. The owner-requested 499/360 px menu placement immediately right of the circular logo, opening behavior, and bold health-promo title were verified; full keyboard and contrast walkthrough remains open.
- [ ] Complete the home and shell review at 360 px, 768 px, desktop, RTL, long Persian text, 200% zoom, keyboard focus, and reduced motion. Current 360/768/desktop home and 360/768 gallery views had no horizontal overflow. A 360 px consent panel and fixed mobile navigation remained separately usable. A focused 2026-09-25 gallery check verified tab ArrowLeft selection/focus, modal Escape/restored focus, Shift+Tab/Tab focus loop, and ten computed text/background pairs ranging from 5.62:1 to 14.57:1. This is not a full automated contrast, screen-reader, or 200% browser-zoom review; screenshot file evidence also remains open.
- [x] Roadmap §12 now distinguishes the historical no-frontend statement from current GitHub `main`, keeps F0/F1 in progress, and appends an evidence/caveat row. No phase is marked complete without its acceptance criteria.

## Privacy, assets, release gate

- [x] `src/privacy/consent.ts` records only first-visit Accept/Deny notice choice in version 2; source inspection shows no optional vendor integration or grant to future vendors. The owner removed `/privacy` and settings under DEC-011; persistent public disclosures remain open.
- [x] OTP phone is no longer placed in the verification URL; it is kept in same-tab session storage. Public disclosure of this storage is still required before launch after the `/privacy` removal. API images are restricted to the app/API origins, and their requests use `no-referrer`.
- [x] Current local asset names and sources are recorded in `DESIGN_SYSTEM.md`: user-supplied logo, Victor G dog portrait, EJ Li cat portrait, and locally bundled Vazirmatn.
- [ ] Inspect production network requests, cookies, storage, and headers with a browser and a live backend/payment redirect. Source inspection found no optional vendor integration and `npm audit` reported zero known vulnerabilities; these checks do not replace a live network/privacy audit.
- [x] Include Vazirmatn SIL OFL copyright and license notice in `public/licenses/Vazirmatn-OFL.txt`; the footer links to it. Verify its presence in each built artifact before public release.
- [ ] Obtain and review the operator's legal identity/contact, data retention and processor details, backend/payment cookies, and authority to publish the supplied logo before public launch. Provide any persistent policy and preference-revisit mechanism required for the actual deployment; the current two-button notice alone is not a compliance guarantee.
- [x] Show the local preview to the owner. On 2026-09-25 the owner approved the current design and explicitly authorized commit and push. A PR or public release is a separate decision.
