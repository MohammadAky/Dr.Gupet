# Frontend implementation checklist

Use this as the working queue; `Roadmap-Frontend.md` §6 contains the full phase requirements and §12 is the official status board. Do not mark a phase complete in this file instead of recording its acceptance evidence in the roadmap.

## Priority 0 — synchronize and verify foundations (F0)

- [x] Refresh against GitHub `main`; preserve local changes and note the exact HEAD used for this pass (`f175c145092eea767a7850df450c6cbe11aa6df4` on 2026-09-25).
- [ ] Reconcile the existing React application with F0 acceptance. Verify scripts, lint setup, typecheck, build, tests, configuration, API client, RTL shell, and the `/health` smoke path. Record any missing item rather than assuming that existing code satisfies F0.
- [x] Add or update a reproducible development runbook and decisions for the existing native-form stack, design, privacy and quality-tool choices. Live health/CORS evidence remains open; mocks do not close it.

## Priority 1 — visual foundation (F1)

- [ ] Verify the implementation of `DESIGN_SYSTEM.md`: supplied logo, deep green/gold palette, self-hosted Vazirmatn, spacing/type/focus tokens, RTL and mobile layout. Current worktree already contains these foundations; record visual and accessibility evidence before checking this item.
- [ ] Build reusable UI states and primitives required by Roadmap F1 without business logic in the primitives. The dev-only gallery and focused keyboard/contrast checks exist; a complete accessibility walkthrough is still open.
- [x] Complete the shared header, navigation, footer, mobile bottom navigation and responsive shell. Existing routes and auth guards remain; the cart badge is hidden from guests and identity changes clear private query cache.
- [ ] Make a local page preview for owner review. Review the Pinterest layout reference visually; draw new project artwork and record asset provenance.

## Priority 2 — page presentation, in roadmap order (F2–F10)

- [ ] F2 authentication/session: visual states for OTP request, cooldown, verification, failure, and logout; preserve refresh rotation and redirect safety.
- [ ] F3 profile/addresses: private-data states, validation, edit flows, and the ten-address/default rules.
- [ ] F4 pets: registration/edit/detail, tag and date presentation, loading/empty/error states.
- [ ] F5 catalog: home hero, category and product cards, list filters/pagination, detail and variant states; server remains authoritative for stock and price.
- [ ] F6 recommendations, F7 favorites, F8 cart/coupons, F9 checkout/payments/orders, F10 medicine/pharmacy information: style each existing journey without adding unsupported backend features. Preserve the medicine informational disclaimer and never show medicine sales or stock.
- [ ] For each phase, review its exact Roadmap acceptance, run the checks, log evidence, and keep backend-dependent checks open until live verification.

## Priority 3 — privacy, rights, and release quality (F11 plus cross-cutting checks)

- [ ] Audit every external request, script, embed, font, storage key, and telemetry path. Keep non-essential services disabled. Verify the English two-choice first-visit notice per DEC-011; do not treat either choice as consent to a future vendor. Before public release, resolve the persistent disclosure and rights-access gaps created by the owner's removal of `/privacy`.
- [ ] Recheck the current asset inventory in `DESIGN_SYSTEM.md`, every later addition, and the distributed Vazirmatn OFL notice. Keep Victor G/EJ Li stock photographs under their nonexclusive Unsplash rights; use owner-only rights text for original material and obtain operator identity/contact for the public legal notice.
- [ ] Verify responsive screens (including 360 px), RTL, keyboard/screen-reader semantics, contrast, reduced motion, performance, and no secret or personal-data leakage in browser logs/URLs.
- [ ] Run the full Roadmap §12.3 regression checklist, commands, and live API cases that are available. Log limitations, update official phase evidence, and show the local preview for approval **before** commit/push/publication.

## Phase evidence record (copy into Roadmap §12 when verified)

For each acceptance item record: phase and criterion; commit-independent local change or screenshot path; command/test/manual steps and result; backend or environment used; unresolved failure and owner. An unchecked item stays open. Do not use this checklist to claim that an untested phase has passed.
