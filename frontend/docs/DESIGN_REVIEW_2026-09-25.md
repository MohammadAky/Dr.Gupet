# Frontend design review — 2026-09-25

Scope: local `frontend/design-system` worktree based on GitHub `main` `f175c145092eea767a7850df450c6cbe11aa6df4`. The owner approved this preview for commit and push. This is a visual and interaction review, not phase acceptance or a live-data review. No backend file was changed.

## What was inspected

- Production preview at 320, 360, 499, 768, and 1280 px, including home, products, medicines, pharmacies, login, guest cart, and redirects from protected routes.
- Development-only `/dev/ui` gallery at mobile width: buttons/states, fields, alerts, tabs, dialog examples, and navigation sections exist. Prior keyboard checks covered gallery dialog Escape/focus restoration and RTL tab-arrow movement; a complete screen-reader/contrast/zoom walkthrough is still open.
- Header, footer, mobile bottom navigation, first-visit cookie notice, and error states when the backend is unavailable.

## Review findings, in roadmap order

- [x] **F1 shell — owner correction verified.** At 499 px the hamburger is immediately to the right of the circular logo (`menu x=426`, logo image `x=373`), and the menu opens (`aria-expanded=true`, navigation visible). The same order fits at 360 and 320 px without horizontal overflow. The health-information promo heading renders at weight 700. Logo/palette/Vazirmatn remain consistent with the visual contract.
- [x] **First-visit notice — owner correction verified.** English floating notice uses only `Accept Cookies` and `Deny Cookies`, with equal-width, equal-weight buttons at 360 px; reduced-motion CSS shortens its entrance animation. No footer privacy link, `/privacy` route, settings form, or optional tracking provider remains. Both choices record only the current notice response (DEC-011).
- [ ] **F1 accessibility acceptance remains open.** The development gallery's tabs changed selection and focus with ArrowLeft; the modal exposed `aria-modal=true`, focused its close button, wrapped Shift+Tab/Tab between first and last controls, and restored trigger focus on Escape. Ten computed text/background combinations ranged from 5.62:1 (field hint on cream) to 14.57:1 (primary/secondary action). Complete keyboard/screen-reader order, actual 200% browser zoom, automated contrast, and long-copy checks are still required. Do not mark F1 complete from these focused checks.
- [ ] **F5 catalog filter layout — high visual priority when F5 resumes.** At 360 px, the search label/input/button and the category/brand/age/size/sort labels and selects wrap into crowded rows; price labels and fields nearly touch. The same inline arrangement remains dense at 768 and 1280 px. Group each label with its own control, use a responsive grid with full-width controls on mobile, and verify keyboard focus and filter behavior. Preserve URL-backed filters and server-authoritative prices.
- [ ] **F8 guest cart — medium visual priority when F8 resumes.** The guest state is readable but contains only a sentence. Consider a clear login action and explanatory empty-state treatment once the roadmap reaches F8; do not invent cart data.
- [ ] **F10 medicine/pharmacy filter layout — high visual priority when F10 resumes.** At 360 px, medicine search, prescription checkbox and button crowd together; city/province fields and the 24-hour checkbox/button do the same. Apply the same labelled-field pattern as F5, while preserving the information-only medicine disclaimer and no price/stock claims.
- [ ] **F0/live-data gate.** `GET http://127.0.0.1:3000/api/v1/health` refused connection. Product cards, loaded medicine/pharmacy rows and details, OTP, authenticated profile/pets/cart/checkout/orders, and payment states cannot receive final visual acceptance from this preview. Protected routes currently redirect to login as expected.
- [x] **F0 formatter gate.** The frontend source was formatted; `npx prettier --check src` passes alongside lint, build and tests. This does not close the separate live `/health` gate.
- [ ] **F11/public privacy gate.** The owner removed the persistent policy/settings UI for the local preview. No optional tracker is active, but actual backend/payment cookies, operator identity/contact, retention/processors, and jurisdiction-specific disclosure and revisit requirements still need resolution before public launch. A two-button notice alone is not a legal-compliance guarantee.

## Current verification

`npm run lint`, `npm run build` (including TypeScript check), and `npm test -- --maxWorkers=1 --no-file-parallelism` passed after the latest owner corrections: 91 tests in 16 files. `git diff --check` passed, and no `backend/` diff exists. The earlier dependency audit reported zero known moderate-or-higher advisories; this does not establish the absence of security defects.

Next action under `Roadmap-Frontend.md`: obtain the backend owner's runnable `/health` endpoint to close F0, finish F1 accessibility evidence, then resolve the recorded form-layout findings in their F5/F10 phases. The owner approved commit and push of this preview; public release is a separate gate.
