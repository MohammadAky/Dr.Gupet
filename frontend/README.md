# Dr. Gupet frontend

Persian RTL customer site for the MVP described in the root `README.md`. The frontend implementation follows `Roadmap-Frontend.md` and `docs/DECISIONS.md`. Shared agent guidance is in the root `AGENTS.md`; the design system and current asset provenance are in `docs/DESIGN_SYSTEM.md`.

## Local setup

Use Node.js and npm compatible with the checked-in lockfile. The current development machine has Node 24 and npm 11; the repository does not yet prove a complete clean-clone matrix. In PowerShell, from `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173/`. `VITE_API_BASE_URL` in `.env.example` points to `http://localhost:3000/api/v1`; `src/lib/env.ts` requires it at startup. Vite is configured for port 5173. Never put a secret in a `VITE_*` variable: those values are public in the browser bundle. Do not commit `.env`.

The backend is a separate owner's responsibility. It is unavailable in this local design pass, so product/API data and the home `/health` status may show error or empty states. This is not evidence of a successful end-to-end transaction. Do not change `backend/` to make the preview work; report backend requirements in the Roadmap's `BE-REQ-*` list.

## Checks and preview

```powershell
npm run lint
npm run typecheck
npm run build
npm test
npm run preview
```

Run the checks from `frontend/`. `npm run preview` serves a prior build on port 5173; stop the dev server first if it occupies that port. The test command uses Vitest and does not replace live-backend verification. Check the active phase's specific criteria in Roadmap §6 and record results in §12 only after execution.

The home, product, auth, profile, pet, cart, checkout, order, medicine, pharmacy, and `/privacy` routes exist in this worktree. Some require a running API and signed-in session. The visual pass currently emphasizes the shell, home, and shared presentation; do not infer visual acceptance for every route from the presence of its component.

## Design, storage, and rights

The app imports local `@fontsource/vazirmatn` font files; green `#122F12` and gold `#D49F28` tokens are defined in `src/styles/tokens.css`. The exact local image files, sources, photographers, and license terms are recorded in `docs/DESIGN_SYSTEM.md`. The dog and cat portraits are Unsplash-licensed stock photography; they are not exclusive Dr. Gupet-owned artwork. The user-provided logo is at `public/brand/logo.jpg`.

The frontend stores a refresh token in `localStorage`, a pending payment-order reference in `sessionStorage`, and optional privacy choices in `localStorage`. The `/privacy` page and consent controls describe these. No analytics or advertising vendor script is currently wired into the frontend; choices alone do not load one. Browser/network verification of server or payment-gateway cookies remains outstanding.

The `/privacy` text is a **local-preview draft**. A public release requires the operator's legal identity, contact route, data retention details, and review against the actual backend/payment behavior. Copyright text may apply only to original Dr. Gupet material; the stock photos and font keep their own licenses. Local preview must be approved by the owner before any commit, push, PR, or publication.
