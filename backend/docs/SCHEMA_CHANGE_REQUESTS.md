# Schema change requests

## SCHEMA-001 — Product.minPrice required by the catalog contract

- Status: PROPOSED — no schema change applied.
- Date: 2026-09-21
- Baseline: 7beae2fd7390eb0069be36cd386827e7b453bea8
- Priority: resolve before Phase 6 acceptance; Phases 0–5 can proceed independently.

### Evidence
The root README requires denormalized Product.minPrice for price sorting and ProductVariantsService.recalculateMinPrice (line 421), and requires recalculation in the seed (line 524).
The Product model in backend/prisma/schema.prisma (lines 249–279) has no minPrice field.

### Requested decision
Explicitly authorize adding an integer Toman minPrice field with a defined value/nullable policy for products without active variants, or explicitly revise the README contract to use a computed alternative. Do not silently substitute an implementation.

### Proposed impact if the field is approved
- Add a migration and regenerate the Prisma client.
- Backfill each product from the cheapest active variant; define the no-active-variant case first.
- Recalculate on variant creation, price changes, activation/deactivation and seed execution.
- Ensure admin-tool actions call the same recalculation logic.
- Test price sorting, response shape, variant changes and idempotent seed execution.
- Decide whether an index is needed from actual query patterns; avoid speculative indexes.

### Acceptance checklist
- [ ] Explicit instruction resolving the contract/schema mismatch is recorded.
- [ ] Behavior for no active variants and backfill is documented.
- [ ] Approved migration and implementation are reviewed.
- [ ] Catalog and seed tests pass.
- [ ] README and development checklist reflect the resolved decision.

