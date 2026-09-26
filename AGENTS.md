# Dr. Gupet agent instructions

## Source and ownership

- GitHub `MohammadAky/Dr.Gupet` `main` is the project source of truth. Before a development phase, inspect the current remote head and incoming changes; preserve uncommitted local work. A local checkout is a workspace, not evidence that GitHub has the same state.
- This task owns **frontend only**. Never edit, format, migrate, generate into, or include files from `backend/` in a frontend change. Report backend dependencies in `Roadmap-Frontend.md` §7 as `BE-REQ-*` for the backend owner. `BUG-ISSUES-BACKEND.md` is a backend-owner queue, not frontend work.
- For frontend work, read `Roadmap-Frontend.md` §§0–6, §10, and §12, then `frontend/docs/DECISIONS.md`, `frontend/docs/INSTRUCTIONS.md`, `frontend/docs/IMPLEMENT_FRONTEND.md`, and `frontend/docs/DESIGN_SYSTEM.md`. The roadmap owns scope, phase order, and acceptance; the decisions record owns accepted technical choices; these new documents explain how to implement and review them. Product/API facts come from the root `README.md` and the current API contract. If current code and historical roadmap prose disagree, verify the implementation and record evidence before changing phase status.
- The project design skill is `.agents/skills/dr-gupet-frontend-design/SKILL.md`. Use it for visual frontend changes. Shared, versioned project instructions take precedence over a machine-local design skill.

## Working agreement

- Advance F0–F11 one phase at a time. Do not mark a phase done until its acceptance criteria have evidence. Record failed or blocked checks honestly in the roadmap's Status and append-only Progress log. Do not claim a live backend test from a mock.
- Keep network calls in `frontend/src/api/client.ts`; preserve accepted auth, API, money, and validation behavior when styling pages. New dependencies or changed architecture need a decision entry before adoption.
- User-facing copy is Persian except the owner-directed English first-visit cookie notice (DEC-011); the interface is RTL, and code identifiers are English. Apply the project's design tokens, accessibility rules, privacy controls, and asset-provenance rules.
- Preview the finished local frontend for the owner and receive approval **before any commit, push, PR, or publication**. Record test results and outstanding limitations with the preview. This explicit owner instruction overrides the roadmap's default commit-per-phase timing.
