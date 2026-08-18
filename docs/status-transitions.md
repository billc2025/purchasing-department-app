# Status transitions

Clients invoke named commands; they never submit arbitrary status values. Every successful transition records actor, command, previous/new status, entity, timestamp, and relevant conditions in `statusEvents` and records sensitive/material changes in `auditEvents`. Rejected attempts return a safe current-state error and may be security-logged where appropriate.

Role abbreviations: **REQ** requester (own order), **REC** receptionist, **PA** assigned purchasing agent unless stated, **ADM** admin, **SA** super admin, **OVR** Overlord. Admin has reporting/configuration authority but no implicit operational transition authority. Overlord may perform every transition, subject to required reasons and invariant-preserving correction workflows.

## Order transition matrix

| From | Command → To | Allowed roles | Required conditions | Audit/reason |
| --- | --- | --- | --- | --- |
| `draft` | submit compliant → `unassigned` | REQ; REC on behalf; OVR | Valid order/items; server lead-time compliant | Audit submission and rule snapshot |
| `draft` | submit late → `exception_pending` | REQ; REC on behalf; OVR | Valid order/items; server lead-time violation | Audit late trigger and rule snapshot |
| `draft` | cancel → `cancelled` | REQ; authorized creator; OVR | Not submitted/purchased | Audit; cancellation reason required by final UI policy |
| `exception_pending` | approve → `unassigned` | SA, OVR | Pending valid exception | Decision reason required; audit |
| `exception_pending` | reject → `rejected` | SA, OVR | Pending valid exception | Decision reason required; audit |
| `unassigned` | claim → `assigned` | PA for self, OVR | Atomic; no current assignment; eligible | Assignment + audit |
| `unassigned` | direct cancel → `cancelled` | REQ, OVR | No purchase activity; cancellation policy permits | Reason and audit |
| `assigned` | start review → `in_review` | assigned PA, OVR | Current assignment | Audit/status event |
| `assigned` | release → `unassigned` | assigned PA, OVR | Eligible; no conflicting purchase state | Reason required; assignment + audit |
| `assigned` | reassign → `assigned` | SA, OVR | Target active purchasing agent | Reason required; assignment + audit |
| `assigned`/`in_review` | request info → `waiting_for_requester` | assigned PA, OVR | Specific information request recorded | Audit; notification |
| `waiting_for_requester` | information supplied → `in_review` | REQ (response), assigned PA, OVR | Requested clarification supplied/acknowledged | Audit/status event |
| `in_review` | approve purchasing → `approved_to_purchase` | assigned PA, OVR | Required review complete; exceptions approved | Audit |
| `in_review` | reject → `rejected` | PA where policy allows, SA, OVR | No purchase; reason supplied | Reason and audit |
| `approved_to_purchase` | begin purchase → `purchasing` | assigned PA, OVR | Current assignment | Audit |
| `purchasing` | derive partial → `partially_fulfilled` | system via authorized PA/REC/OVR item event | Some, not all fulfillment; item invariants valid | Audit source item/receipt event |
| `purchasing`/`partially_fulfilled` | all purchased → `purchased` | system via assigned PA/OVR transaction | Required purchase records and receipt proof/privileged exception | Audit purchases/derivation |
| `purchased`/`partially_fulfilled` | dispatch → `in_transit` | assigned PA, OVR | Eligible purchased quantities shipped | Audit |
| `purchasing`/`purchased`/`in_transit`/`partially_fulfilled` | record receipt → `received` or remain partial | REC, assigned PA, SA, OVR | Receiving quantities valid; all required items resolved for `received` | Audit receiving event |
| `received` | confirm correct → `completed` | REQ, OVR | Requester owns order and confirms; or privileged override | Confirmation audit; override reason required |
| `received` | report issue → `receipt_issue_reported` | REQ, REC on recorded issue, OVR | Outcome is missing/incorrect/damaged/incomplete | Details and audit |
| `receipt_issue_reported` | resolution resumes → documented active state | assigned PA, SA, OVR | Resolution identifies correct target state from item facts | Reason and audit; no silent rewind |
| eligible active state after assignment | request cancellation → `cancellation_requested` | REQ, REC on behalf where authorized, OVR | Direct cancel no longer allowed | Request reason and audit |
| `cancellation_requested` | approve → `cancelled` | SA, OVR | All purchased items have configured financial outcomes | Decision reason and audit |
| `cancellation_requested` | reject → prior snapshotted state | SA, OVR | Original state still valid | Decision reason and audit |
| `completed`/`cancelled`/`rejected` | correct record → invariant-valid state | SA, OVR | Dedicated correction/reversal; never ordinary edit | Reason, linked correction, audit |

`submitted` is retained as a conceptual/event state but is normally resolved transactionally to `unassigned` or `exception_pending`. If implemented as a persisted status for asynchronous validation, only a server process may leave it, and it must not become a general client transition.

Order status is derived or validated from item, assignment, exception, receiving, cancellation, and confirmation facts. A transition cannot claim `received` or `completed` merely because a client requests it.

## Item transition matrix

| From | Command → To | Allowed roles | Required conditions | Audit/reason |
| --- | --- | --- | --- | --- |
| `requested` | begin review → `under_review` | assigned PA, OVR | Parent assigned/in review | Status/audit event |
| `requested`/`under_review` | request info → `information_needed` | assigned PA, OVR | Question recorded | Audit; notification |
| `information_needed` | resume review → `under_review` | assigned PA, OVR | Information supplied/acknowledged | Audit |
| `under_review` | approve → `approved` | assigned PA, OVR | Specification sufficient; applicable exceptions approved | Audit |
| `under_review`/`approved` | unavailable → `unavailable` | assigned PA, OVR | Vendor/review evidence and reason | Reason and audit |
| `approved` | order → `ordered` | assigned PA, OVR | Purchase process started | Audit |
| `approved`/`ordered` | record purchase → `purchased` | assigned PA, OVR | Valid transaction allocation and required receipt proof/exception | Financial audit |
| `approved`/`ordered` | substitute → `substituted` | assigned PA, OVR | Substitution allowed or approved; replacement details | Reason/details and audit |
| `purchased`/`substituted` | dispatch → `in_transit` | assigned PA, OVR | Purchased quantity shipped | Audit |
| `purchased`/`in_transit`/`substituted` | receive part → `partially_fulfilled` | REC, assigned PA, SA, OVR | Positive quantity ≤ outstanding | Receiving audit |
| `purchased`/`in_transit`/`substituted`/`partially_fulfilled` | receive all → `received` | REC, assigned PA, SA, OVR | Fulfilled quantity equals approved/resolved quantity | Receiving audit |
| eligible pre-purchase state | cancel → `cancelled` | via authorized order cancellation, OVR | Cancellation approved/directly eligible | Reason and audit |
| `ordered`/`purchased`/`in_transit`/`partially_fulfilled` | cancel resolution → `returned` | SA, OVR; PA where configured | Approved cancellation; return recorded | Outcome, reason, audit |
| `returned`/`purchased` | refund → `refunded` | assigned PA, SA, OVR | Refund transaction/amount recorded | Financial audit |
| terminal item state | correct → invariant-valid state | SA, OVR | Dedicated reversal/correction only | Reason, linked correction, audit |

## Cross-cutting guards

- Purchasing agents act on assigned orders except atomic self-claim; they cannot assign another agent.
- Receptionists may record receipt and only configured reception transitions; they cannot claim, assign, or approve exceptions.
- Admin has no implied ability to operate orders or discover Overlord.
- SA reassignment, overrides, and corrections require reasons. SA cannot discover or modify Overlord.
- Material requester changes after assignment use `changeRequests`; they do not mutate state directly.
- After purchase begins, cancellation requires a request/decision and explicit outcomes for purchased items.
- All quantities, transaction allocations, receipt allocations, and totals must reconcile before derived transitions.

## Illegal-transition tests

For every command, tests must cover unauthenticated, inactive, wrong-role, wrong-owner/assignee, stale state, missing reason, missing prerequisite, forged role/ID, and valid paths. Property/table-driven tests should assert that every unlisted `(from, command, role)` combination fails without partial writes or audit gaps.

## Deferred policy points

The exact receptionist status allowlist, category/status edit cutoff, final post-purchase cancellation authority, and budget exception triggers remain versioned configuration/future decisions. No default threshold or hidden transition is authorized by this matrix.

