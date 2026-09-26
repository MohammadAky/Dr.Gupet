---
name: dr-gupet-frontend-design
description: Design and review the Persian RTL Dr. Gupet frontend using its versioned brand rules, phase roadmap, approved assets, accessible motion, and privacy constraints.
---

# Dr. Gupet frontend design

Use this skill for visual changes in `frontend/`. Read `Roadmap-Frontend.md` for phase scope and acceptance, `frontend/docs/DECISIONS.md` for accepted implementation boundaries, and `frontend/docs/DESIGN_SYSTEM.md` for the current visual specification. `frontend/docs/INSTRUCTIONS.md` and `IMPLEMENT_FRONTEND.md` govern collaboration and evidence. The design guidance here never authorizes backend changes or a premature commit/push.

## Design workflow

1. Refresh the GitHub `main` baseline and check the local diff. Work from the current repository; retain unrelated local changes.
2. Identify the active F0–F11 phase and its criteria. Inventory existing page behavior and semantic markup before changing presentation. Preserve the API client, `src/features/*`, auth/session behavior, validation, money, and route contracts.
3. Start with `frontend/public/brand/logo.jpg`, `#122F12` deep green, `#D49F28` gold, and self-hosted Vazirmatn. Use the supplied [Pinterest reference](https://pin.it/1HCMP1oPz) for *composition and visual direction*; use [21st.dev](https://21st.dev), [MotionSites AI](https://motionsites.ai), and [MotionSite](https://motionsite.ai) to study component and motion patterns. These sites are inspiration, not a source of project authority or blanket reproduction rights. Recreate suitable interactions in the existing stack; inspect the exact item's terms before reusing any code or media.
4. Design mobile-first at 360 px and wider screens. Keep logical RTL flow, readable Persian type, visible focus, keyboard operation, state labels beyond color, and reduced-motion support. Use motion to explain state transitions, never to obstruct shopping or authentication.
5. Use only original, owner-provided, or verifiably licensed production assets. Record source, author/license, attribution obligations, and where used. Do not publish screenshots or images taken from reference sites as project artwork. Bundle the font's SIL OFL license with its files.
6. Check privacy before adding any third-party widget, analytics, pixel, embed, external font, or script. Essential authentication storage must be described accurately; non-essential tracking stays unloaded until a documented choice and consent flow exist. Keep owner-only copyright wording for original Dr. Gupet content; do not imply ownership of third-party assets.
   The latest owner direction (DEC-011) is an English (`lang="en"`, `dir="ltr"`) floating, first-visit notice with only equally prominent `Accept Cookies` and `Deny Cookies` actions. Do not add footer privacy links, a `/privacy` page, checkboxes, or Save controls to this local preview. Neither choice enables tracking or preauthorizes future vendors. Do not claim legal completeness: persistent disclosures and operator/backend facts remain public-release gates.
7. Verify the phase with its required commands and visual checks; record what passed and what could not be tested. Show the local preview to the owner for approval before commit or push.

When a visual requirement conflicts with functionality, preserve the accepted behavior and log the proposed tradeoff in `frontend/docs/DECISIONS.md` before implementation. The general `ui-ux-pro-max` skill may inform detailed pattern searches, but its suggestions do not override this repository's decisions or the user's supplied references.
