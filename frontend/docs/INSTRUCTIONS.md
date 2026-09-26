# Frontend implementation instructions

This document is shared guidance for human contributors and AI agents. It does not supersede `Roadmap-Frontend.md`, which owns the F0–F11 checklist and acceptance, or `DECISIONS.md`, which records accepted technical decisions.

## Before any edit

1. Check GitHub `main` and its HEAD, compare the checkout to it, and inspect both tracked and untracked local changes. Use an isolated frontend worktree if needed to protect existing edits. The remote repository is authoritative; local files alone are not.
2. Read the active phase in `Roadmap-Frontend.md` and its Status/Progress log; read `DECISIONS.md` and the relevant current source. The roadmap's old statement that no frontend exists is historical: assess actual code before updating status.
3. Identify the next incomplete acceptance item. Do only that phase's scope; independent agents may research or verify separate areas, but integration remains aligned with the same phase gate.

## Boundaries and coding

- Do not modify `backend/`. Route missing API behavior to the backend owner through `BE-REQ-*` in Roadmap §7 and keep any frontend fallback visible and testable.
- Preserve DEC-002's separation: visual work may replace styles and wrap components, while API, feature and form logic are changed only to satisfy a verified frontend bug or accepted decision. All requests flow through `src/api/client.ts`.
- Keep the server authoritative for payable totals, stock, coupon validity, and shipping. Label local estimates as such. Keep query parameters shareable, data states explicit, and user-facing strings in Persian, except the owner's English first-visit cookie notice in DEC-011.
- Do not invent dependencies, API fields, product claims, legal identity, shipping promises, or consent defaults. Resolve a genuine new architectural choice in `DECISIONS.md`; record an unavailable backend dependency rather than simulating success.
- Never include secrets in client code or committed environment files. A `VITE_*` value is public by design. Do not log phone numbers, OTPs, tokens, addresses, or pet profiles for analytics or debugging.

## Design, privacy, and rights

- Follow `DESIGN_SYSTEM.md` and the project design skill. The submitted logo and color values are owner direction; reference sites are inspiration only. A component is reusable only after its specific license and dependencies are checked.
- Self-host Vazirmatn with its SIL OFL notice. `@fontsource/vazirmatn` is currently bundled locally; check release packaging for the notice. For every production image, animation, icon, and font, retain an asset-provenance entry in `DESIGN_SYSTEM.md` (source, permitted use, attribution, location). The two current portraits are nonexclusive Unsplash-licensed work by Victor G and EJ Li; do not claim exclusive brand ownership. Use original or licensed pet imagery; do not copy a Pinterest image into the site.
- Follow DEC-011 for the local first-visit notice: English, floating, two equally prominent `Accept Cookies` and `Deny Cookies` actions, with no footer privacy link, `/privacy` route, settings, or Save control. Neither response enables a vendor. Do not load analytics, advertising, or marketing cookies/scripts without a new disclosure and valid opt-in; none are currently configured. The removed persistent policy leaves public-release privacy disclosure work open, including operator identity/contact, backend and gateway cookies, retention, and user rights.
- Copyright wording may cover only Dr. Gupet's original content. Third-party creators retain their rights; document any required credit.

## Evidence and handoff

- Run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` when available, plus the active phase's manual acceptance. Distinguish mock/API-unavailable results from live integration. Check 360 px mobile, RTL, keyboard focus, contrast, long Persian text, and `prefers-reduced-motion` for visual changes.
- Update Roadmap §12 Status and append-only Progress log only from evidence, and record relevant decision or `BE-REQ` changes. A passing build alone is not visual acceptance or a security guarantee.
- Prepare a local preview and a short evidence report for the owner. Do not commit, push, open a PR, or publish before the owner approves the local result.
