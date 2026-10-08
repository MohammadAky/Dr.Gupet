# Dr. Gupet — agent instructions

## Source and ownership

- GitHub `MohammadAky/Dr.Gupet` `main` is the project source of truth. Before a development phase, inspect the current remote head and incoming changes; preserve uncommitted local work. A local checkout is a workspace, not evidence that GitHub has the same state.
- The repository is a monorepo: `backend/` (NestJS API) and `frontend/` (React SPA). Keep each change scoped to the side it belongs to; report backend needs from frontend work (and vice versa) instead of silently editing the other side.
- Product scope, setup, server deployment (Docker + `scripts/`), the API contract and business rules live in the root `README.md` (the single project README). Frontend conventions live in `frontend/docs/DECISIONS.md` (accepted technical decisions) and `frontend/docs/DESIGN_SYSTEM.md` (visual contract and asset provenance). If current code and documentation disagree, verify the implementation and record evidence before changing status.
- For visual frontend changes, use the personal Codex skill `dr-gupet-frontend-design` when available. Its guidance lives outside this repository. The versioned repository documents and owner instructions remain authoritative.

## Working agreement

- For every development phase in this project, delegate independent implementation, audit, and verification tasks to subagents. Resume with the same delegation pattern after an interruption or usage-limit reset; the primary agent integrates and verifies their output.
- Advance phases one at a time along the root README «مسیر توسعه». Do not mark a phase done until its acceptance criteria have evidence. Record failed or blocked checks honestly. Do not claim a live backend test from a mock.
- Keep network calls in `frontend/src/api/client.ts`; preserve accepted auth, API, money, and validation behavior when styling pages. New dependencies or changed architecture need a decision entry in `frontend/docs/DECISIONS.md` before adoption.
- User-facing copy is Persian except the owner-directed English first-visit cookie notice (DEC-011); the interface is RTL, and code identifiers are English. Apply the project's design tokens, accessibility rules, privacy controls, and asset-provenance rules.
- Never commit secrets, tokens, `.env` files, or machine-local paths. `.env.example` documents variables; real values stay ignored.
- Preview the finished work for the owner and receive approval **before any commit, push, PR, or publication**. Record test results and outstanding limitations with the preview. This explicit owner instruction overrides any default commit-per-phase timing.

## Release consistency

- Keep the local checkout, GitHub `main`, and VPS on the same owner-approved release revision. Before reconciliation, inspect their differences, preserve uncommitted work, and save diffs and backups before replacing files or builds.
- Test changes locally, present the results for owner approval, then commit and push the approved changes to `main`. Deploy that exact Git SHA and build frontend, admin, and backend from it; verify the deployed revision instead of assuming a pull or restart synchronized the release.
- Back up the database before deployment and apply required migrations only. Never run demo seeds automatically during a production release.
- Keep secrets in each environment's private configuration; never synchronize `.env` files or credentials through Git.
- After deployment, verify health, customer and admin authentication, SMS provider behavior, and role access against the live release. Record failed, blocked, and untested checks honestly; mocks do not establish live acceptance.
- Make source changes in the local review workflow; do not make unattended edits directly to live source. Preserve the previous release SHA and builds for rollback, and confirm database compatibility before restoring them.
