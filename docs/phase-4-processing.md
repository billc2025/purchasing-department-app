# Phase 4 processing and purchasing records

Phase 4 adds named server commands for purchasing work after assignment. Clients never write `orders.status` or `orderItems.status` directly. Each accepted command validates the current state, effective role, assignment ownership, and prerequisites before changing data. Successful transitions append both `statusEvents` and `auditEvents` records.

## Processing flow

1. The assigned purchasing agent starts review on an `assigned` order.
2. Each item independently moves through review, information-needed, approved, substituted, or unavailable outcomes.
3. Information requests create a shared requester-visible message and place the order in `waiting_for_requester`. The assigned agent acknowledges the supplied information before review resumes.
4. Purchasing approval requires every item to be resolved as approved, substituted, or unavailable.
5. Beginning purchasing converts approved items to `ordered`; substituted and unavailable outcomes remain explicit.
6. Finalized purchase allocations derive item purchased quantities, actual costs, and the overall `purchasing`, `partially_fulfilled`, or `purchased` state.
7. Purchased items may be dispatched independently. A fully purchased order becomes `in_transit` only when all purchased items are dispatched.

Receiving quantities and requester confirmation remain Phase 5 responsibilities.

## Comment-channel isolation

`orderComments.channel` is server-controlled:

- `shared` is visible to the requester/creator and authorized operational roles.
- `internal` is visible only to receptionists, purchasing agents, administrators, Super Admins, and the protected owner.

Requester queries filter internal rows before projection. Audit records retain channel metadata but not comment bodies.

## Purchase evidence and reconciliation

A finalized purchase stores vendor, purchase time, integer-minor-unit amount, currency, purchasing actor, receipt metadata, optional receipt number/notes, and one or more item allocations. Allocations must belong to the same order, reconcile exactly to the transaction total, and cannot cumulatively exceed requested quantities.

Ordinary purchasing-agent finalization requires an unused server-verified JPEG, PNG, WebP, or PDF receipt no larger than 8 MB. Only a Super Admin or the protected owner may finalize without proof, and a non-empty exception reason is mandatory and audited. Uploaded storage IDs cannot be reused as another receipt or reference attachment.

Actual order cost is the sum of finalized transactions. Item actual cost is the sum of its allocations. Currency must match the order currency; no floating-point currency values are persisted.

## Schema additions

- Expanded controlled `orderItems.status` values plus optional purchased quantity, actual amount, substitution, and unavailable outcome fields.
- `orderComments` for separated shared/internal conversations.
- `purchaseTransactions` and `purchaseAllocations` for many-to-many receipt/item relationships.
- `statusEvents` for append-only command history alongside material `auditEvents`.

All new fields on existing rows are optional, so the development deployment requires no destructive data migration or reseeding.
