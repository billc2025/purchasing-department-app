# Reporting definitions

Phase 6 reports use server-authoritative Convex records. Admin, Super Admin, and Overlord may report. Non-Overlord reports never return the protected principal's name, email, role, or filter identifier; affected rows use **System Administrator**.

## Date filter

The selected date type is the only date used by the report's From/To range. A record without that date is excluded when a range is active.

| Selection | Authoritative value | Rule |
| --- | --- | --- |
| Creation date | `orders.createdAt` | Time the order record was created. |
| Needed-by date | `orders.requiredAt` | Requested delivery deadline. |
| Assignment date | `orders.assignedAt` | Current/latest assignment timestamp stored on the order. Missing for unassigned orders. |
| Purchase date | Earliest finalized `purchaseTransactions.purchasedAt` | First recorded purchase for the order. |
| Receipt date | Latest `receivingEvents.receivedAt` | Final recorded receiving event currently available for the order. This does not by itself assert full receipt. |
| Confirmation date | Latest `receiptConfirmations.createdAt` | Latest requester decision or privileged override. |
| Completion date | Latest `statusEvents.createdAt` whose `toStatus` is `completed` | Completion transition time; never inferred from `updatedAt`. |

Ranges are inclusive. Browser date inputs are converted to the local beginning/end of day before being sent as timestamps. Stored timestamps remain absolute UTC milliseconds and are displayed in the user's configured locale/timezone behavior.

## Cards and timing metrics

| Metric | Definition | Denominator/exclusions |
| --- | --- | --- |
| Total orders | Count of filtered orders. | Includes every current status unless filtered. |
| Estimated total | Sum of `orders.estimatedAmountMinor`. | Filtered orders; minor currency units. Mixed-currency rollups are a known limitation and must not be treated as converted totals. Current UI labels the configured application currency. |
| Actual total | Sum of finalized purchase transaction amounts for filtered orders. | Orders with no purchase contribute zero. |
| Variance | Actual total minus estimated total. | Same population as totals. |
| Average assignment time | `assignedAt - createdAt`. | Only orders with an assignment date. Missing values are excluded, never zero-filled. |
| Average processing time | first purchase date minus assignment date. | Only orders with both dates. |
| Average completion time | completion date minus creation date. | Only orders with a completion status event. |
| Average requester confirmation time | confirmation date minus latest receipt date. | Only orders with both dates. |
| On-time percentage | Orders with a receipt date on/before needed-by date divided by filtered orders having a receipt date. | Orders without receipt events are excluded. Cancelled orders are included only if they have a receipt event and remain in the active filtered population. |
| Overdue orders | Non-terminal orders with `requiredAt < serverNow`. | `completed`, `cancelled`, and `rejected` are terminal and excluded. |
| Exceptions | Orders with an exception request or current `exception_pending` state. | One order counts once even with several exceptions. |
| Partial fulfillment | Orders currently `partially_fulfilled`. | Historical partial states are not counted by this current-state card. |
| Substitutions | Filtered order items with substitution details or current `substituted` state. | Item count, not order count. |
| Unavailable items | Filtered order items currently `unavailable`. | Item count. |
| Receipt completeness | Finalized purchase transactions having uploaded receipt proof divided by all finalized purchase transactions. | Proof-exception transactions remain incomplete for this evidence metric. |
| Cancellations | Filtered orders currently `cancelled`. | Current-state count. |
| Refunded cost | Sum of recorded `amountMinor` for cancellation outcomes `refunded`. | Outcomes without an amount are excluded from the cost sum. |
| Non-refundable cost | Sum of recorded `amountMinor` for outcomes `non_refundable`. | Outcomes without an amount are excluded from the cost sum. |

All averages return unavailable when their denominator is zero. The UI shows `—` instead of a misleading zero.

## Breakdowns

- Orders by category, department, and requester count filtered orders once per grouping.
- Orders without a department appear as **No department**.
- Active agent workload counts filtered non-terminal orders with an assignee.
- Vendor spending sums finalized transaction amounts by the stored vendor name for filtered orders.
- Protected-principal workload is labeled **System Administrator** outside the Overlord session.

## Filters

Filters combine with logical AND. Estimated and actual cost limits use minor-unit server comparisons after the UI converts entered currency amounts. Assignment, exception, status, location, requester, department/cost center, agent, category, and timeliness filters operate on the hydrated authoritative order facts described above.

`on_time` excludes late-submitted and currently overdue orders. `late` uses the lead-time result stored as `orders.isLate`. `overdue` uses the server clock and current terminal status.

## CSV export

- Detail and summary CSV files are generated from the same server-side filtered report used by the dashboard.
- Every field is quoted. Values beginning with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with an apostrophe to prevent spreadsheet formula execution.
- CSV uses UTF-8 with a byte-order mark for common spreadsheet compatibility.
- Every export creates an audit event containing export type, filters, row count, actor, and timestamp.
- Detail exports keep all operational date columns distinct and store monetary values in minor units to avoid floating-point ambiguity.

## XLSX decision

Phase 6 ships production-ready CSV only. XLSX was deferred because adding a second export format and dependency does not improve the authoritative data model, while it increases formula, formatting, and maintenance surface. A future XLSX export must reuse the same filter/metric service and pass the same injection and accuracy tests.

## Partial and cancelled orders

Partial and cancelled orders remain visible unless the active filters exclude them. Their finalized purchases remain part of actual spending. They do not receive fabricated completion, receipt, or confirmation dates. Cancellation refund/non-refundable sums use only explicitly recorded item-outcome amounts.
