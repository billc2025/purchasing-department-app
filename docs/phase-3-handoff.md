# Phase 3 handoff

## Delivered

- Real-time Convex purchasing bucket with bounded reads, reference-data maps, search, stable ordering, filters, and 25-row pages.
- Atomic self-claim for purchasing agents. A stale second claim fails with the current order state.
- Assigned-agent release and Super Admin/Overlord reassignment with required normalized reasons.
- Append-only `assignmentEvents` plus security audit events for claim, release, and reassignment.
- Receptionist and Admin read-only access; requester access fails closed.
- Responsive desktop table and narrow-screen cards with due countdown, category, requester, location, assignment, status, late/overdue, and missing-information indicators.

## Phase 4 dependencies

- Use the existing assignment projection and append-only history; do not introduce arbitrary status updates.
- Build processing commands from the approved transition matrix and require current assignment where specified.
- Add status events, item-level progress, shared comments/internal notes, purchases, allocations, receipts, and derived fulfillment states.
- Preserve billing responsibility in purchasing and financial views without creating invoicing or accounts-receivable behavior.

## Open gap carried forward

Phase 2's schema and upload mutation accept an optional item association, but the current order-entry UI uploads reference images at order level. Add per-item reference-image controls in a separately approved follow-up without weakening file validation or attachment authorization.
