# Purchasing Hub
## Architecture, Development Roadmap, and Codex Build Instructions

Version: 1.0  
Working repository name: `purchasing-department-app`  
Target users: Fewer than 50  

---

## 1. How to use this package

Use the prompts in order. Give Codex only one phase at a time. Do not ask it to build the full application in a single run.

For every phase:

1. Start from the latest approved `main` branch.
2. Create a dedicated phase branch.
3. Paste the applicable prompt into Codex.
4. Let Codex inspect the repository before modifying it.
5. Review the implementation summary, tests, and unresolved items.
6. Test the feature manually.
7. Commit and merge only after the acceptance criteria pass.
8. Deploy the approved `main` branch through Vercel.

If Codex discovers a conflict with an earlier phase, it must explain the conflict and propose the smallest safe correction. It must not silently redesign approved functionality.

---

## 2. Product vision

Purchasing Hub is an internal purchasing-request and fulfillment application. Employees submit orders, purchasing agents claim and process them, receptionists assist with visibility and receipt, and requesters follow progress through completion.

The application must provide:

- A straightforward order-submission experience.
- A prioritized, real-time purchasing bucket.
- Item-level purchasing and fulfillment tracking.
- Configurable category and lead-time rules.
- Controlled assignments, approvals, changes, and cancellations.
- Required receipt capture and cost reporting.
- Requester confirmation of receipt.
- Administrative reporting and exports.
- Complete server-side authorization and auditability.
- A hidden system-owner role called Overlord.

The first release should prioritize reliability, permissions, traceability, and ease of use over unnecessary complexity.

---

## 3. Approved technology stack

- Framework: Next.js with App Router
- Language: TypeScript in strict mode
- Frontend: React
- Components: shadcn/ui
- Styling: Tailwind CSS
- Authentication: Clerk with invitation-only email access
- Backend and database: Convex
- Real-time updates: Convex subscriptions
- Initial file storage: Convex File Storage
- Validation: Zod where appropriate, plus Convex validators at backend boundaries
- Unit and integration tests: Vitest
- End-to-end tests: Playwright
- Source control: GitHub
- Hosting: Vercel
- CI: GitHub Actions

Use compatible stable versions. Record important version choices in the README. Do not add a separate Express API, PostgreSQL database, Prisma layer, or another backend unless an approved architectural change requires it.

---

## 4. Roles and authorization

Authorization must be enforced inside Convex queries, mutations, and actions. Hiding a button in React is not authorization.

### Requester

- Create orders for themselves.
- Add multiple items to one order.
- View their own orders and shared comments.
- Upload reference images and clarifications.
- Request permitted changes or cancellation.
- Confirm correct receipt or report an issue.

### Receptionist

- View all operational orders, budgets, shared comments, and internal notes.
- Create an order on behalf of another user.
- Add comments and attachments.
- Update only authorized reception statuses.
- Mark an order or item as received.
- Cannot claim or assign purchasing work.
- Cannot approve exceptions.

### Purchasing Agent

- View the entire purchasing bucket.
- Claim an unassigned order for themselves.
- Cannot assign an order to another purchasing agent.
- Release their own assignment with a required reason.
- Review and process assigned orders.
- Update order and item statuses.
- Record vendors, purchases, costs, receipts, substitutions, refunds, and fulfillment.
- Request additional information.

### Admin

- Manage operational configuration allowed by policy.
- Manage categories, locations, departments, and reporting settings.
- Access dashboards, reports, and exports.
- Manage ordinary users within approved limits.
- Cannot view, create, assign, modify, or discover the Overlord role.

### Super Admin

- All visible administrative capabilities.
- Reassign orders when required.
- Approve late requests, budget exceptions, and approved override types.
- Correct operational records through audited reversal or correction actions.
- Cannot discover, edit, deactivate, or assign the Overlord.

### Overlord

- Hidden system owner with all permissions.
- Can perform every action available to any other role.
- Can manage roles, settings, users, approvals, reports, and system configuration.
- Has an Overlord-only control panel.
- Cannot be created or assigned through the normal UI.
- Cannot be discovered through ordinary role lists, user-management queries, filters, client bundles, or frontend API responses.
- Cannot be edited or deactivated by any non-Overlord user.
- The initial Overlord identity must be bootstrapped using a protected server-side configuration, such as a deployment environment value matched to a Clerk user ID.
- Overlord actions remain in the immutable audit log. Non-Overlord viewers see the actor as `System Administrator`; the Overlord sees the true actor.

Do not rely on a client-supplied role. Resolve the authenticated Clerk identity to a server-controlled user record and authorize every protected operation on the server.

---

## 5. Core business rules

### Orders and items

- One order belongs to exactly one category.
- One order may contain multiple items.
- Items within an order may come from different vendors or locations.
- Each item has its own fulfillment status.
- An order may be partially fulfilled.
- Overall order status is derived or validated against the item states where applicable.

### Assignment

- Purchasing agents can claim only unassigned orders for themselves.
- Claiming must be atomic so two agents cannot claim the same order.
- Purchasing agents cannot assign work to someone else.
- Super Admin and Overlord may reassign with a required reason.
- An agent may release their own order to the bucket with a required reason.

### Category lead time

- Each category has a configurable minimum lead time.
- Lead time uses continuous calendar time.
- Weekends and holidays are included.
- Lead-time units can include minutes, hours, and days.
- Example initial categories: Food Delivery, minimum one hour; Event Purchase, minimum three calendar days.
- Categories may be added, modified, activated, or deactivated by authorized administrators.
- A late submission is not silently accepted. It is labeled as an exception and routed for approval.
- Super Admin and Overlord may approve late-request and budget exceptions.

### Editing

- Draft: full requester editing.
- Submitted and unassigned: full requester editing, subject to audit history.
- Assigned but not purchased: safe clarifications are allowed; material changes become change requests.
- Purchasing started or partially purchased: comments, images, and clarifications only; material changes require approval.
- Purchased or in transit: no direct editing.
- Received: requester can confirm receipt or report an issue.
- Completed: read-only except for privileged correction workflows.
- Material changes include category, quantity, budget, required time, and delivery location.
- The eventual edit cutoff must be configurable and may consider status and time remaining before the required date.

### Receipt and completion

- Receipts are required for recorded purchases.
- Receipt data includes vendor, purchase date, amount, currency, uploaded proof, purchaser, notes, and related items.
- One receipt may cover several items.
- An item may have multiple purchase or receipt records.
- Receptionist can mark an order or item received.
- Requester must confirm correct receipt before ordinary completion.
- Requester may report missing, incorrect, damaged, or incomplete items.
- Privileged completion without requester confirmation requires a reason and an audit entry.

### Cancellation

- Requester can cancel a draft or eligible unassigned order.
- After assignment, requester submits a cancellation request.
- After purchasing begins, requester cannot cancel directly.
- Super Admin and Overlord can approve post-purchase cancellation until the final policy is configured.
- Purchased items must be resolved as returned, refunded, retained, non-refundable, or another configured outcome.
- All cancellation decisions require a reason and audit history.

### Budget

- The first release captures estimated budgets and actual costs.
- The schema must accommodate future allocations for departments, users, events, or general budgets.
- Budget allocation enforcement is not required until the final policy is approved.
- Do not invent approval thresholds.

---

## 6. Recommended domain model

Codex should refine this model during Phase 1 without changing the approved behavior.

### Principal tables

- `users`
- `roles` or controlled role values
- `departments`
- `locations`
- `categories`
- `categoryRules`
- `orders`
- `orderItems`
- `assignments` or assignment fields plus history
- `statusEvents`
- `comments`
- `attachments`
- `purchaseTransactions`
- `receipts`
- `receiptItems`
- `changeRequests`
- `exceptionRequests`
- `cancellationRequests`
- `receiptConfirmations`
- `notifications`
- `budgetAllocations` as a future-ready foundation
- `auditEvents`
- `systemSettings`

Every business record should include appropriate creation and update timestamps. Important records should use archival or deactivation instead of destructive deletion.

### Order fields

- Human-readable order number
- Requester user ID
- Created-by user ID
- Requested-for user ID
- Department and optional cost-center reference
- Category ID
- Business purpose or event name
- Delivery location and instructions
- Required date/time stored in UTC and displayed in the user's timezone
- Submitted date/time
- Priority and exception indicators
- Estimated overall budget and currency
- Assigned agent ID
- Assignment timestamp
- Order status
- Fulfillment summary
- Cancellation and completion metadata

### Item fields

- Order ID
- Item name
- Description/specification
- Quantity and unit
- Preferred vendor if known
- Estimated budget
- Actual-cost summary
- Substitution allowed
- Item status
- Fulfilled quantity
- Notes

Use integer minor currency units rather than floating-point values for money.

---

## 7. Status model

Use controlled transition functions. Do not allow clients to write arbitrary status strings.

Suggested order statuses:

- `draft`
- `submitted`
- `exception_pending`
- `unassigned`
- `assigned`
- `in_review`
- `waiting_for_requester`
- `approved_to_purchase`
- `purchasing`
- `partially_fulfilled`
- `purchased`
- `in_transit`
- `received`
- `receipt_issue_reported`
- `completed`
- `cancellation_requested`
- `cancelled`
- `rejected`

Suggested item statuses:

- `requested`
- `under_review`
- `information_needed`
- `approved`
- `ordered`
- `purchased`
- `in_transit`
- `received`
- `partially_fulfilled`
- `substituted`
- `unavailable`
- `returned`
- `refunded`
- `cancelled`

Codex must create a documented transition matrix by role and test illegal transitions.

---

## 8. Purchasing bucket priority

The default bucket should prioritize operational urgency, not submission time alone:

1. Overdue active orders.
2. Orders closest to their required date and time.
3. Approved urgent or late-request exceptions.
4. Unassigned orders.
5. Remaining active orders by required date and time.

Views and filters should include:

- Unassigned
- Assigned to Me
- All Active
- Due Today
- Upcoming
- Waiting for Requester
- Exception Pending
- Ready for Reception
- Partially Fulfilled
- Overdue
- Completed
- Cancelled

Every bucket card or row should clearly show order number, required time, time remaining, category, requester, location, assignment, status, late indicator, and missing-information indicator.

---

## 9. Audit and security requirements

- Audit sensitive and material actions: creation, edits, assignment, release, reassignment, status changes, approvals, rejections, cost changes, receipt uploads, refunds, cancellations, confirmation, user changes, role changes, and settings changes.
- Audit events are append-only. Corrections create new events.
- Record actor, action, entity, entity ID, timestamp, relevant prior/new values, and reason where required.
- Redact or replace the Overlord identity for non-Overlord viewers.
- Validate attachment type and size on the server.
- Use signed or authorized file access; do not expose unrestricted storage identifiers.
- Prevent insecure direct object references by checking access on every record fetch.
- Apply least privilege to Convex functions.
- Do not expose sensitive configuration to the browser.
- No public Clerk sign-up.
- Deactivated users retain historical attribution but lose access.
- Never log secrets, tokens, invitation links, or full sensitive attachment URLs.

---

# PHASED CODEX INSTRUCTIONS

## Phase 0 — Architecture and repository plan

### Copy-and-paste Codex prompt

> You are the lead software architect for Purchasing Hub. Do not implement product features in this phase.
>
> Read all repository instructions, including any `AGENTS.md`, and inspect the current repository. Use the approved product specification in `Purchasing_Hub_Codex_Build_Package.md` as the source of truth. If that file is not present, ask me to add it before proceeding.
>
> Produce a concrete technical design for a Next.js App Router, TypeScript, Clerk, Convex, Tailwind, shadcn/ui, GitHub, and Vercel application. The system supports fewer than 50 internal users. Preserve all approved role, Overlord-invisibility, order, item, assignment, lead-time, receipt, cancellation, reporting, audit, and security requirements.
>
> Create or update documentation only:
>
> 1. `README.md` with purpose, stack, local setup outline, and environment-variable names without values.
> 2. `docs/architecture.md` with boundaries, request flow, authentication/authorization design, Overlord bootstrap design, real-time behavior, storage, and deployment.
> 3. `docs/domain-model.md` with proposed Convex tables, fields, indexes, relationships, retention approach, money/date handling, and future budget support.
> 4. `docs/status-transitions.md` containing an order and item transition matrix, allowed roles, required conditions, and audit requirements.
> 5. `docs/security-model.md` with threat model, server-side authorization policy, data-access matrix, attachment controls, audit redaction, and test strategy.
> 6. `docs/implementation-roadmap.md` mapping Phases 1–8 to deliverables and dependencies.
>
> Explicitly list any assumptions. Do not invent unresolved budget thresholds, category lists, or cancellation policy. Model those as configuration or clearly marked future decisions. Run documentation checks if the repository has them. Finish with a summary of files changed, key decisions, risks, and questions that truly block Phase 1.

### Acceptance criteria

- No product features are implemented.
- Architecture matches the approved stack.
- Backend authorization and hidden Overlord behavior are explicitly designed.
- Domain indexes support requester views, bucket sorting, assignments, statuses, due dates, categories, and reports.
- Status transitions are documented rather than left as arbitrary strings.
- Unresolved policies remain configurable.

---

## Phase 1 — Foundation, authentication, schema, and authorization

### Copy-and-paste Codex prompt

> Implement Phase 1 of Purchasing Hub. First read `AGENTS.md`, the build package, and all Phase 0 documents. Inspect the current code and Git status. Work only on this phase and preserve existing approved behavior.
>
> Build the project foundation using Next.js App Router, strict TypeScript, Tailwind CSS, shadcn/ui, Clerk, and Convex. Configure invitation-only authentication with no public sign-up route. Implement the initial Convex schema, indexes, authenticated user synchronization, deactivation handling, and centralized server-side authorization helpers.
>
> Implement roles: requester, receptionist, purchasing agent, admin, super admin, and hidden Overlord. Bootstrap the Overlord through a protected server-side environment value mapped to the authenticated Clerk user ID. Never send `overlord` in ordinary role-list or user-management responses. Non-Overlord users must be unable to discover, assign, edit, deactivate, or filter for that role. Do not treat hidden UI as security; enforce every restriction in Convex.
>
> Build a minimal authenticated application shell with role-aware navigation, access-denied and inactive-account states, a user profile area, and placeholder dashboards. Add seed or development setup for safe non-production test users without embedding secrets.
>
> Implement append-only audit-event primitives and actor-redaction rules. Add tests covering unauthenticated access, each role boundary, Overlord concealment, protected user management, and server rejection of forged client roles.
>
> Add `.env.example` containing names and explanations only. Update setup documentation. Run formatting, linting, type checking, unit tests, and production build. Fix issues introduced by this phase. Finish with changed files, commands run and results, manual setup steps for Clerk and Convex, security notes, and remaining Phase 2 dependencies. Do not claim external services are configured unless you actually verified them.

### Acceptance criteria

- Application loads for an invited active user.
- Public registration is unavailable.
- Convex functions reject unauthorized calls.
- Each visible role receives only its permitted shell/navigation.
- Overlord is bootstrapped outside normal UI and concealed from all non-Overlord responses.
- Audit primitives work and cannot be updated or deleted through normal functions.
- Lint, types, tests, and production build pass.

---

## Phase 2 — Order creation, multiple items, attachments, and lead-time validation

### Copy-and-paste Codex prompt

> Implement Phase 2 of Purchasing Hub. Read the repository instructions and approved architecture first. Inspect existing code and tests before editing. Do not weaken Phase 1 authorization.
>
> Implement categories, category rules, departments, and locations with authorized administrative management. A category has a configurable calendar-time minimum lead time expressed in minutes, hours, or days. Include development seed examples for Food Delivery at one hour and Event Purchase at three calendar days, clearly identified as editable sample data.
>
> Build a responsive multi-step order form. Requesters create orders for themselves; receptionists and authorized administrators can create on behalf of another visible user. An order has exactly one category and may contain multiple items. Capture requester/requested-for, department or optional cost center, purpose/event, category, required date and time, location, delivery instructions, estimated budget, currency, comments, and item details. Each item captures name, description/specification, quantity, unit, preferred vendor, estimated budget, substitution permission, notes, and reference images.
>
> Support draft saving, review, submission, validation errors, attachment upload, removal before submission, and accessible progress states. Store timestamps in UTC and display them in the user's selected/default timezone. Store monetary values in integer minor units.
>
> Calculate lead-time compliance on the server using continuous calendar time. Late requests enter `exception_pending`; compliant submitted requests enter the active unassigned workflow. Display the minimum requirement and earliest compliant required time before submission. Never trust a client-computed deadline.
>
> Implement My Orders and order-detail pages with correct ownership rules. Create audit events for creation, draft edits, submission, and attachments. Add server and UI tests for multi-item orders, one-category enforcement, calendar-time boundaries, late requests, on-behalf-of rules, file validation, unauthorized reads, and timezone behavior.
>
> Run lint, types, tests, and production build. Finish with results, manual test instructions, screenshots if supported, and Phase 3 handoff notes.

### Acceptance criteria

- Requester can draft and submit a valid multi-item order.
- Receptionist can submit on behalf of a user.
- An order cannot mix categories.
- Lead-time validation is server-authoritative and includes weekends.
- Late submissions route to exception review.
- Unauthorized users cannot access another requester's order.
- Attachments are validated and access controlled.

---

## Phase 3 — Purchasing bucket, atomic claiming, and prioritization

### Copy-and-paste Codex prompt

> Implement Phase 3 of Purchasing Hub. Preserve all existing authorization and order-submission behavior.
>
> Build the real-time general purchasing bucket using Convex subscriptions. Purchasing agents can see all eligible operational orders and atomically claim an unassigned order only for themselves. They cannot assign another agent. If two agents attempt to claim the same order, exactly one succeeds and the other receives a clear current-state message.
>
> Allow the assigned agent to release an eligible order with a required reason. Allow Super Admin and Overlord to reassign with a required reason. Receptionists can view the bucket but cannot claim, release, or assign orders.
>
> Implement default priority: overdue first, then closest required date/time, approved urgent/late exceptions, unassigned orders, and remaining active orders by required date/time. Add views and filters for Unassigned, Assigned to Me, All Active, Due Today, Upcoming, Waiting for Requester, Exception Pending, Ready for Reception, Partially Fulfilled, Overdue, Completed, and Cancelled.
>
> Create an accessible table for desktop and useful cards for narrow screens. Show order number, countdown/time remaining, category, requester, location, assignment, status, late flag, and missing-information flag. Add search and stable pagination or bounded loading appropriate for fewer than 50 users.
>
> Audit all claim, release, and reassignment actions. Add concurrency tests, permission tests, priority-order tests, real-time update tests where practical, and receptionist read-only tests.
>
> Run lint, types, tests, and production build. Report verification evidence and Phase 4 handoff notes.

### Acceptance criteria

- Bucket updates without manual refresh.
- Atomic claiming prevents double assignment.
- Purchasing agents cannot assign another agent.
- Receptionists have read-only assignment access.
- Priority and filters behave deterministically.
- Releasing or reassigning requires a reason and creates an audit event.

---

## Phase 4 — Processing workflow, item statuses, comments, purchases, and receipts

### Copy-and-paste Codex prompt

> Implement Phase 4 of Purchasing Hub. Start by reviewing the documented transition matrix and current tests. Do not allow arbitrary status writes.
>
> Implement server-controlled order and item status transitions with role checks, prerequisites, and audit events. Build the assigned-agent workspace for reviewing items, requesting information, updating item progress, recording substitutions, marking unavailable items, and handling partial fulfillment.
>
> Implement shared comments visible to requester, receptionist, purchasing team, and administrators. Implement internal notes visible only to receptionist, purchasing agent, Admin, Super Admin, and Overlord. Clearly label the two channels and enforce visibility on the server.
>
> Implement purchase transactions and required receipt capture. Record vendor, purchase date/time, amount in minor units, currency, purchasing agent, related items and quantities, receipt image/file, optional receipt number, and notes. Support one receipt covering multiple items and multiple transactions for one item. Do not allow a purchase transaction to be finalized without required receipt evidence unless a Super Admin or Overlord uses an audited exception.
>
> Calculate item and order cost summaries without floating-point arithmetic. Support ordered, purchased, unavailable, substituted, partially fulfilled, in-transit, and related outcomes. Make overall order status consistent with item statuses while allowing documented privileged corrections.
>
> Add tests for transitions, partial fulfillment, comment visibility, internal-note isolation, receipt requirements, currency calculations, unauthorized transaction edits, and audit completeness.
>
> Run lint, types, tests, and production build. Summarize changes, tests, migrations or seed changes, and Phase 5 prerequisites.

### Acceptance criteria

- Only valid role-specific transitions succeed.
- Every item can progress independently.
- Overall partial fulfillment is accurately represented.
- Receipt proof is required for ordinary purchase completion.
- Shared and internal notes have server-enforced visibility.
- Cost totals use minor currency units and reconcile to transactions.

---

## Phase 5 — Receiving, requester confirmation, changes, exceptions, and cancellation

### Copy-and-paste Codex prompt

> Implement Phase 5 of Purchasing Hub without redesigning the approved status model.
>
> Allow receptionists and authorized purchasing/administrative roles to mark eligible items or orders as received. Record who received them, when, location, quantities, notes, and optional evidence. Support partial receipt.
>
> Notify the requester in-app that confirmation is required. Build confirmation options for received correctly, missing items, incorrect items, damaged items, and incomplete order. An issue must reopen or route the order to the documented issue state rather than completing it. Ordinary completion requires requester confirmation. Super Admin or Overlord may complete without requester confirmation only with a required reason and audit event.
>
> Implement formal change requests for material changes after assignment. Preserve original values, requested values, requester reason, decision, decision-maker, and timestamps. Enforce direct-edit rules based on order state and a configurable time-to-due cutoff. Clarifications, shared comments, and new reference attachments remain available where allowed.
>
> Implement late-request and budget-exception approval queues for Super Admin and Overlord. Do not invent budget thresholds; accept an exception only when generated by existing rules or explicit authorized routing.
>
> Implement cancellation behavior: direct cancellation for eligible drafts/unassigned orders, cancellation request after assignment, and privileged approval after purchase begins. Require resolution of purchased items as returned, refunded, retained, non-refundable, or configured outcome. Do not hard-delete cancelled orders.
>
> Add tests for partial receipt, confirmation, issue reporting, privileged override, edit cutoff, change-request history, approvals, rejected exceptions, and every cancellation boundary.
>
> Run lint, types, tests, and production build. Report results and Phase 6 handoff notes.

### Acceptance criteria

- Receptionist can record full or partial receipt.
- Requester confirmation is required for ordinary completion.
- Receipt issues do not close the order.
- Material post-assignment edits use a traceable request.
- Exception approvals are role-restricted.
- Post-purchase cancellations preserve financial and item resolution history.

---

## Phase 6 — Admin dashboard, reports, and exports

### Copy-and-paste Codex prompt

> Implement Phase 6 of Purchasing Hub. Reporting must use authoritative server-side data and respect roles. Admin, Super Admin, and Overlord can access reports. The Overlord identity and role must remain concealed in all non-Overlord report data and filters.
>
> Build an administrative dashboard with filters for date range, relevant date type, requester, department/cost center, purchasing agent, category, status, location, assignment state, exception state, timeliness, estimated cost, and actual cost.
>
> Distinguish creation date, required-by date, assignment date, purchase date, receipt date, confirmation date, and completion date. Clearly label which date drives each report.
>
> Implement report cards and tables for total orders, orders by category/department/requester, agent workload, assignment time, processing time, completion time, on-time percentage, overdue orders, exceptions, partial fulfillment, substitutions/unavailable items, estimated versus actual cost, vendor spending, receipt completeness, requester confirmation time, cancellations, refunds, and non-refundable costs.
>
> Define all metrics in `docs/reporting-definitions.md`, including denominators, exclusions, timezone rules, incomplete records, and how partially fulfilled/cancelled orders are treated. Avoid misleading averages when data is missing.
>
> Implement secure CSV export of filtered detail and summary data. Implement XLSX export only if it can be added cleanly with a well-maintained dependency; otherwise document it as the next enhancement and keep CSV production-ready. Protect against spreadsheet formula injection by sanitizing exported cells. Stream or generate exports server-side and audit report exports.
>
> Provide empty, loading, error, and no-permission states. Add tests for metric calculations, date filters, cost reconciliation, role access, redaction, formula-injection defense, and export accuracy.
>
> Run lint, types, tests, and production build. Report results and Phase 7 handoff notes.

### Acceptance criteria

- Admin can filter and export accurate reports.
- Metric definitions are documented.
- Different operational dates are not conflated.
- Exports match active filters and resist formula injection.
- Overlord information is absent from non-Overlord reports.

---

## Phase 7 — Notifications and configurable administration

### Copy-and-paste Codex prompt

> Implement Phase 7 of Purchasing Hub. Build reliable in-app notifications for order submission, assignment, information requests, comments requiring attention, status changes, exception decisions, purchase, in-transit, receipt, receipt confirmation, reported issues, cancellation, and approaching/overdue deadlines.
>
> Notifications must link to authorized records, support read/unread state, avoid exposing order information to unauthorized users, and be deduplicated where repeated backend operations could occur. Build a notification center and useful role-specific unread indicators.
>
> Complete authorized configuration screens for categories and lead times, departments, optional cost centers, locations, permitted receptionist statuses, edit-cutoff settings, cancellation outcomes, and other already-approved configurable policies. Validate configuration changes and audit them.
>
> Include a future-ready budget-allocation management foundation for department, user, event, and general allocations, but do not automatically consume or enforce budgets until explicit business rules are approved. Clearly label incomplete budget enforcement as not active.
>
> Add tests for notification recipients, authorization, deduplication, deep links, configuration validation, and audit history. Run lint, types, tests, and production build. Report results and Phase 8 readiness.

### Acceptance criteria

- Users receive relevant in-app notifications only.
- Deep links do not bypass authorization.
- Authorized configuration does not require code changes.
- Budget foundation exists without pretending enforcement is active.
- Configuration changes are validated and audited.

---

## Phase 8 — Hardening, accessibility, CI/CD, and release

### Copy-and-paste Codex prompt

> Perform Phase 8 release hardening for Purchasing Hub. Do not add unrelated product features.
>
> Review the complete repository, architecture, threat model, status matrix, and acceptance criteria. Run a permission audit of every Convex query, mutation, action, file-access path, export, and administrative route. Confirm that no browser-supplied role or record ID bypasses server authorization. Specifically attempt to discover or modify the hidden Overlord from non-Overlord contexts and add regression tests for every finding.
>
> Complete responsive and accessibility review: keyboard navigation, focus handling, labels, status announcements, color contrast, table/card usability, error recovery, loading states, and narrow-screen order entry. Target WCAG 2.1 AA where practical.
>
> Add or complete GitHub Actions for install, formatting check, lint, TypeScript, unit/integration tests, and production build. Configure Playwright smoke tests for critical flows using safe test-environment assumptions. Do not commit credentials.
>
> Review performance and indexes for bucket queries, order details, audit history, notifications, and reports. Remove obvious N+1 patterns and unbounded reads. Review attachment limits and retention behavior.
>
> Create `docs/deployment.md`, `docs/release-checklist.md`, `docs/admin-guide.md`, and `docs/user-guide.md`. Document Clerk invitation setup, Convex configuration, Vercel environment-variable names, GitHub/Vercel connection, production deployment, rollback, backup/export considerations, and first-Overlord bootstrap. Never put secret values in documentation.
>
> Run the full verification suite and production build. Provide a release report containing pass/fail results, known limitations, unresolved business decisions, security findings and fixes, required manual service configuration, and a go/no-go recommendation. Do not state that Clerk, Convex, GitHub, or Vercel is configured unless verified directly.

### Acceptance criteria

- CI validates formatting, lint, types, tests, and production build.
- Critical end-to-end flows have smoke coverage.
- No known role or record-access bypass remains.
- Overlord concealment has explicit regression coverage.
- Application is accessible and usable on desktop and mobile layouts.
- Deployment, admin, user, release, and rollback documentation is complete.

---

## 10. Required manual test journeys before launch

1. Invite and activate one user for every visible role.
2. Confirm public sign-up is unavailable.
3. Confirm non-Overlord users cannot discover the Overlord.
4. Submit a compliant Food Delivery order with multiple items and images.
5. Submit a late Event Purchase order and approve the exception.
6. Have two agents attempt to claim the same order.
7. Release and reassign an order with recorded reasons.
8. Request additional information and respond as requester.
9. Purchase items from two vendors with separate receipts.
10. Mark one item unavailable and verify partial fulfillment.
11. Receive items through the receptionist workflow.
12. Report an incorrect or damaged item as requester.
13. Confirm receipt and complete an order.
14. Request a material change after assignment.
15. Request cancellation after a purchase and resolve the financial outcome.
16. Run an Admin report and compare the export to source orders.
17. Deactivate a user and verify access is removed while history remains.
18. Attempt protected actions by manipulating URLs and client requests.

---

## 11. Environment-variable checklist

Codex should confirm exact names against the chosen library versions. Expected categories include:

- Clerk publishable key
- Clerk secret key
- Clerk webhook signing secret if used
- Convex deployment URL
- Convex deployment credentials used only by the appropriate environment
- Application base URL
- Protected Overlord Clerk user ID
- Optional environment indicator for development/staging/production

Maintain separate development, preview, and production values. Never commit real values.

---

## 12. Branch and release convention

Suggested branches:

- `phase/0-architecture`
- `phase/1-foundation-auth`
- `phase/2-order-entry`
- `phase/3-purchasing-bucket`
- `phase/4-processing-receipts`
- `phase/5-receiving-exceptions`
- `phase/6-reporting`
- `phase/7-notifications-config`
- `phase/8-release-hardening`

Each pull request should contain:

- Phase objective
- Main changes
- Schema/configuration changes
- Screenshots for visual changes
- Automated test results
- Manual test results
- Security considerations
- Known limitations
- Rollback considerations

---

## 13. Decisions intentionally deferred

These items do not block the build because the design keeps them configurable:

- Complete production category list
- Exact lead time for every future category
- Final department, user, event, and cost-center budget policy
- Automatic budget-allocation consumption
- Budget approval thresholds
- Final cancellation authority matrix after purchasing begins
- Exact requester edit cutoff by category/status
- External email or Microsoft Teams notifications
- PDF leadership-report format

Codex must not silently choose these policies. Any temporary behavior must be clearly documented and reversible through configuration or a later approved phase.

