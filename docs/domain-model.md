# Domain model

This is the proposed Phase 1 Convex model. It preserves approved behavior without freezing implementation details prematurely. All IDs are Convex document IDs unless marked external. All business records carry `createdAt`, `createdBy`, `updatedAt`, and `updatedBy` where meaningful. Records with operational history use `archivedAt`/`deactivatedAt` rather than deletion.

## Conventions

- **Money:** integer `amountMinor` plus ISO 4217 `currency`; never floating point. Currency exponent/formatting is validated centrally.
- **Time:** UTC epoch milliseconds. User, location, or organization IANA timezone controls display. Lead-time comparisons use UTC elapsed calendar time.
- **Reasons:** required nonblank structured fields for release, reassignment, override, exception, rejection, cancellation decisions, and corrections.
- **Status:** controlled literal unions validated by Convex validators and domain transition functions.
- **Snapshots:** requests and audit events retain relevant previous/new values so later configuration changes do not rewrite history.

## Identity and configuration

### `users`

Fields: `clerkUserId`, display name, normalized email, visible role, department/location defaults, timezone, active/deactivated metadata, last-seen metadata, and protected-principal marker stored/derived server-side. Historical records reference user IDs after deactivation.

Indexes: `by_clerk_user_id` (unique by invariant), `by_active_role`, `by_department_active`, `by_normalized_email`. Ordinary management queries must exclude protected principals before counts or pagination.

### `departments`

Fields: name, code, optional cost-center reference, active/archive metadata.

Indexes: `by_active_name`, `by_code`.

### `locations`

Fields: name, address/instructions, IANA timezone, active/archive metadata.

Indexes: `by_active_name`.

### `categories`

Fields: name, description, active flag, display order. No production list is fixed in Phase 0.

Indexes: `by_active_display_order`, `by_normalized_name`.

### `categoryRules`

Fields: `categoryId`, rule version, minimum lead-time value/unit (`minutes|hours|days`), effective interval, active flag, and future edit/cancellation configuration references. Store normalized minutes for comparison plus original value/unit for display.

Indexes: `by_category_active`, `by_category_effective_from`.

### `systemSettings`

Versioned settings for permitted receptionist transitions, edit cutoff, cancellation outcomes, attachment limits, reporting timezone, and other approved configurable policies. Sensitive secrets and the Overlord bootstrap ID do not belong here.

Indexes: `by_key_version`, `by_key_active`.

## Orders and fulfillment

### `orders`

Fields include:

- immutable human-readable `orderNumber`;
- `requesterUserId`, `createdByUserId`, `requestedForUserId`;
- `departmentId`, optional cost-center snapshot;
- exactly one `categoryId` and applied category-rule snapshot/version;
- purpose/event, `locationId`, delivery instructions;
- `requiredAt`, `displayTimezone`, `submittedAt`;
- priority, late/exception/missing-information indicators;
- estimated `amountMinor` and `currency`;
- `assignedAgentId`, `assignedAt` as current projection;
- controlled order status and derived fulfillment summary;
- cancellation, receipt-confirmation, completion, archive/version metadata.

Indexes: `by_order_number`, `by_requester_created_at`, `by_requested_for_created_at`, `by_status_required_at`, `by_assignee_status_required_at`, `by_category_status_required_at`, `by_department_status_required_at`, `by_location_status_required_at`, `by_required_at`, and bounded report-oriented creation/completion indexes. Compound status/due indexes support bucket views; app logic supplies deterministic priority and ID tie-breakers.

### `orderItems`

Fields: `orderId`, name, specification, quantity in a validated representation, unit, preferred vendor, estimated money, actual-cost summary projection, substitution permission, controlled item status, fulfilled quantity, notes, display order, version/archive metadata.

Indexes: `by_order_display_order`, `by_order_status`, `by_status_updated_at`.

### `assignmentEvents`

Append-only claim/release/reassignment history: `orderId`, from/to agent, action, actor, timestamp, required reason where applicable. The current assignment is projected on `orders` for efficient bucket reads.

Indexes: `by_order_created_at`, `by_agent_created_at`.

### `statusEvents`

Append-only domain timeline: entity type/ID, from/to status, actor, transition command, conditions/snapshot, reason, timestamp. This is operational history; `auditEvents` is the broader security/compliance record.

Indexes: `by_entity_created_at`, `by_order_created_at`, `by_actor_created_at`.

## Collaboration and files

### `comments`

Fields: `orderId`, optional item/thread parent, author, visibility (`shared|internal`), body, edit/supersession metadata. Shared comments include requester; internal comments exclude requesters but include receptionist, purchasing, and administrators.

Indexes: `by_order_visibility_created_at`, `by_parent_created_at`.

### `attachments`

Fields: order/item/comment/receipt association, uploader, purpose, Convex storage ID, sanitized name, server-validated media type and byte size, checksum if available, status (`pending|active|quarantined|superseded|archived`), timestamps.

Indexes: `by_parent_status`, `by_storage_id`, `by_uploader_created_at`.

## Purchasing and receipt

### `purchaseTransactions`

Fields: `orderId`, vendor, purchase timestamp, `amountMinor`, currency, purchaser, optional reference/notes, lifecycle (`draft|finalized|corrected|refunded`), receipt-evidence exception metadata, correction linkage.

Indexes: `by_order_purchased_at`, `by_purchaser_purchased_at`, `by_vendor_purchased_at`, `by_status_purchased_at`.

### `purchaseTransactionItems`

Join table linking transactions to items with purchased quantity and allocated amount in minor units. This supports multiple purchases per item and multi-item transactions.

Indexes: `by_transaction`, `by_item`.

### `receipts`

Fields: `orderId`, vendor, purchase date, total minor amount/currency, proof attachment ID, purchaser, optional receipt number/notes, verification and supersession metadata. A finalized ordinary purchase requires authorized active proof.

Indexes: `by_order_purchase_date`, `by_vendor_purchase_date`, `by_proof_attachment`.

### `receiptItems`

Join table linking one receipt to one or more order items and optionally a transaction, including quantity/amount allocation.

Indexes: `by_receipt`, `by_item`, `by_transaction`.

### `receivingEvents`

Append-only receipt of goods: order/item, receiver, timestamp, location, quantity, notes, optional evidence, and correction linkage. Supports partial receipt.

Indexes: `by_order_received_at`, `by_item_received_at`, `by_receiver_received_at`.

### `receiptConfirmations`

Requester decisions: order, confirmer, outcome (`correct|missing|incorrect|damaged|incomplete`), details, timestamp, resolution link, and privileged completion override metadata.

Indexes: `by_order_created_at`, `by_requester_created_at`, `by_outcome_created_at`.

## Requests and decisions

### `changeRequests`

Order, requester/actor, material field snapshots before/requested, reason, status, decision maker/reason/timestamps, applied event. Direct clarification does not masquerade as a material change.

Indexes: `by_order_created_at`, `by_status_created_at`, `by_requester_created_at`.

### `exceptionRequests`

Type (`late|budget|other_configured`), order, triggering rule/snapshot, requester, status, decision maker/reason/timestamps. Phase 0 defines no budget thresholds.

Indexes: `by_status_created_at`, `by_order_type`, `by_decider_created_at`.

### `cancellationRequests`

Order, requester, stage snapshot, reason, status, decision maker/reason, timestamps. Purchased-item outcomes are separate child records so financial history is explicit.

Indexes: `by_order_created_at`, `by_status_created_at`, `by_requester_created_at`.

### `cancellationItemOutcomes`

Cancellation request, item, configured outcome (`returned|refunded|retained|non_refundable|configured_other`), quantities, amounts/currency, notes, resolver/timestamp, transaction/refund links.

Indexes: `by_cancellation_request`, `by_item`, `by_outcome_created_at`.

## Notifications, budgets, and audit

### `notifications`

Recipient, event/type, authorized entity reference, deduplication key, created/read timestamps. Content is minimal and reauthorization occurs on deep-link target access.

Indexes: `by_recipient_read_created_at`, `by_recipient_created_at`, `by_deduplication_key`.

### `budgetAllocations`

Future-ready owner scope (`department|user|event|general`), period, amount/currency, active/version metadata. It does not enforce or consume budget until policy is approved.

Indexes: `by_scope_period`, `by_period_active`.

### `auditEvents`

Append-only actor, action, entity type/ID, timestamp, request/correlation metadata, redacted-safe prior/new values, required reason, and protected-actor marker. No normal update/delete functions exist. Payload allowlists exclude secrets, invitation links, signed URLs, and excessive sensitive data.

Indexes: `by_entity_created_at`, `by_actor_created_at`, `by_action_created_at`, `by_created_at`, plus bounded reporting indexes as proven necessary.

## Relationships and invariants

- An order has exactly one category and many items.
- Each item belongs to exactly one order; transaction/receipt joins must reference items from that order.
- Current assignment/status/cost summaries are projections validated against append-only histories.
- An item can have many transaction, receipt, receiving, and resolution records.
- A receipt can cover many items; an item can appear on many receipts.
- Ordinary completion requires a correct requester confirmation; privileged override requires reason and audit.
- Deactivation never removes historical attribution.
- Cross-record invariants are enforced in Convex mutations, not by clients.

## Retention

Orders, items, financial records, status/assignment history, decisions, confirmations, and audit records are retained and corrected through append-only reversal/correction events. Configuration and users are deactivated/versioned. Attachment retention duration and legal/finance requirements are unresolved; until approved, files linked to financial/audit history must not be automatically destroyed.

