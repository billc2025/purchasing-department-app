# Phase 5 — Receiving, confirmations, changes, exceptions, and cancellation

## Implemented lifecycle

- Receptionists, the assigned purchasing agent, Super Admin, and Overlord can record full or partial receipt per item.
- Each receiving event records item, receiver, timestamp, location, quantity, notes, and optional evidence. Events are append-only.
- The order becomes `received` only after every fulfillable purchased quantity has been received. Partial receipt keeps the order active as `partially_fulfilled`.
- Full receipt creates an in-app notification for the requester. Ordinary completion requires the requester to confirm `correct`.
- Missing, incorrect, damaged, or incomplete outcomes require details and move the order to `receipt_issue_reported` rather than closing it.
- Super Admin and Overlord can complete on behalf of the requester only with a required override reason. The confirmation and override are audited.
- An assigned purchasing agent, Super Admin, or Overlord can resume a documented issue into `in_transit` for resolution.

## Material changes

- Drafts continue to use the draft editor.
- Direct editing of an unassigned submitted order is available only through the guarded `updateUnassignedOrder` command and only when an active `material_change_cutoff_minutes` setting exists and the order is outside that cutoff.
- After assignment, material purpose or needed-by changes use a formal request. Original values, requested values, requester reason, decision, decision maker, and timestamps are retained.
- Super Admin and Overlord decide formal changes with a required reason.
- Shared comments remain available as clarifications and do not masquerade as material changes.

No direct-edit cutoff value is invented by the application. Until an administrator creates the setting, submitted orders use the formal change-request path.

## Exceptions

- Late exceptions are decided only by Super Admin or Overlord with a required reason and a stored rule snapshot.
- A budget exception can be routed only when finalized purchase transactions already exceed the recorded order budget. No percentage or monetary threshold is invented.
- Budget decisions are restricted to Super Admin and Overlord and preserve their trigger snapshot and decision history.

## Cancellation

- A requester or Overlord can directly cancel a draft or unassigned order with a reason.
- Cancellation after assignment creates a formal request and snapshots the prior order state.
- Super Admin or Overlord can approve or reject with a required reason. Rejection restores the snapshotted state.
- Approval after purchase activity requires one explicit outcome for every purchased item: returned, refunded, retained, or non-refundable.
- Cancellation clears assignment, preserves purchase/receipt history, records item outcomes, and never hard-deletes the order.
- The former Overlord shortcut is restricted to draft/unassigned orders so it cannot bypass post-purchase financial resolution.

## Security and assumptions

- Admin remains read-only for operational lifecycle commands.
- Receiving evidence is limited to 8 MB and stored separately from purchase receipts.
- `receipt_issue_reported` resumes to `in_transit`; the reason documents the resolution plan and prevents a silent rewind.
- Notification delivery is in-app. Email/push delivery remains a Phase 7 integration concern.
- Completion and cancellation are named server commands; clients cannot submit arbitrary status values.

## Phase 6 handoff

Reporting can use `receivingEvents`, `receiptConfirmations`, `changeRequests`, `exceptionRequests`, `cancellationRequests`, `cancellationItemOutcomes`, `notifications`, `statusEvents`, and `auditEvents` as authoritative history. Phase 6 must define date dimensions and denominators before presenting receipt, confirmation, exception, cancellation, and completion metrics.
