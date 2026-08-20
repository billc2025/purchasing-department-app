# Phase 7 — Notifications and Configuration

## Scope

Phase 7 adds secure in-app notifications, auditable operational configuration, and a deliberately inactive budget-allocation planning foundation. It does not implement later phases or enforce allocation limits.

## Notification design

- Notifications belong to one user and one order.
- Every notification carries an authorized deep link to the order and a deterministic deduplication key.
- The notification-center query rechecks order authorization before returning an alert. A stale or unauthorized alert is therefore not exposed.
- Users can mark one or all alerts as read. Unread counts are shown in the global application header.
- Events cover submission, assignment, information requests, shared comments requiring attention, status changes, purchase/in-transit progress, exception decisions, receipt confirmation/issues, cancellation, and deadlines.
- A scheduled Convex job evaluates deadlines hourly. It creates one approaching alert (within 24 hours) or one overdue alert per order and recipient.
- The protected principal follows the same access rules while remaining hidden from ordinary identity listings.

## Configuration design

The Settings workspace is limited to `admin`, `super_admin`, and the protected Overlord principal. Mutations validate inputs and append audit events.

Configurable records and policies:

- purchasing categories and versioned lead-time rules;
- departments and optional cost-center references;
- delivery/receiving locations and time zones;
- material-change edit cutoff in minutes;
- order statuses in which receptionists may record receipt;
- permitted financial outcomes for approved cancellations.

Policy updates are append-only versions in `systemSettings`: the prior version is deactivated and retained for auditability.

## Budget-allocation foundation

`budgetAllocations` supports general, department, user, and event planning scopes. Records store minor-unit amounts and currency. `enforcementActive` is schema-constrained to `false`.

These allocations are not read by order submission, budget exceptions, purchasing, or reporting calculations. The interface labels them **planning only — enforcement inactive**. Activating consumption or enforcement requires a future approved phase, transition rules, and migration design.

## Security and privacy

- Server-side authorization is required for every query and mutation.
- Notification ownership is checked for read actions.
- Deep-link records are returned only after current authorization is re-evaluated.
- Configuration screens do not grant configuration authority; the server independently enforces it.
- Non-protected administrators cannot use allocation results to discover the protected principal's user identifier.
- No credentials or secret values are stored in configuration or source control.

## Operational assumptions

- “Approaching” means due within 24 hours; “overdue” begins at the required-by timestamp.
- The default material-change cutoff is displayed as 30 minutes until explicitly saved. Existing direct-edit behavior still requires a saved setting.
- Default receptionist receipt statuses match the existing safe workflow: purchasing, purchased, in transit, and partially fulfilled.
- Default cancellation outcomes remain returned, refunded, retained, and non-refundable.
- In-app notifications are the Phase 7 delivery channel. Email, SMS, and push delivery are future integrations.
