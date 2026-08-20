# Security model

## Security objectives

1. Only invited, active users access the application.
2. Every data read and write is authorized server-side against verified identity, role/capability, record scope, and current state.
3. Non-Overlords cannot discover, infer, assign, edit, deactivate, or impersonate the Overlord.
4. Financial, receipt, status, assignment, cancellation, and administrative history is complete and tamper-evident through append-only events.
5. Attachments and exports do not become public data channels.
6. Secrets, tokens, invitation links, and signed file URLs never enter source, client bundles, audit payloads, or logs.

## Threat model

| Threat | Examples | Primary controls |
| --- | --- | --- |
| Broken access control / IDOR | Guessing order or attachment IDs | Per-record Convex authorization before fetch and projection |
| Client role forgery | Sending `role: "super_admin"` | Ignore client role; resolve Clerk identity to server user |
| Hidden-owner discovery | Role lists, counts, filters, direct IDs, audits | Exclude protected principals before query pagination; dedicated redacted DTOs |
| State/financial tampering | Arbitrary status, float rounding, missing receipt | Named transitions, minor units, prerequisites, atomic audit |
| Race conditions | Two agents claim one order | Atomic Convex mutation with current-state check |
| File abuse | Malicious type, oversized upload, leaked storage ID | Server allowlists/limits, finalized metadata validation, authorized short-lived access |
| Stored content attack | Comments/names rendered as HTML | Render as text, sanitize constrained rich content, safe export encoding |
| Spreadsheet injection | Export cells beginning `=`, `+`, `-`, `@` | CSV/XLSX cell sanitization and tests |
| Secret leakage | Public env, logs, audit before/after values | Server-only variables, structured log/audit allowlists, secret scanning |
| Replay/duplicate effects | Repeated webhook/action/notification | Signature verification and idempotency/deduplication keys |
| Privilege after deactivation | Existing session remains valid | Active-user check on every protected function; short session/config policy |

The system is single-organization and internal, but insider misuse and compromised user sessions remain in scope. Availability attacks, Clerk/Convex platform compromise, and malware analysis beyond configured scanning are shared/external risks.

## Server-side authorization policy

Every public Convex query, mutation, and action follows this order:

1. obtain verified Clerk identity from context;
2. resolve exactly one server-controlled user and require active status;
3. derive capabilities, including protected Overlord status, exclusively server-side;
4. validate input with Convex validators and domain validation;
5. load records using an appropriate index, then enforce ownership/assignment/visibility;
6. execute a named command and transition guard;
7. write the business change and required append-only audit event atomically where possible;
8. return a caller-specific DTO with least data.

No generic client-accessible table CRUD, arbitrary patch object, arbitrary status setter, role setter, audit updater/deleter, or raw storage accessor is permitted. Internal functions remain internal and narrowly scoped. Actions reauthorize before and after long-running/external work when state may change.

## Data-access matrix

| Data/capability | Requester | Receptionist | Purchasing agent | Admin | Super admin | Overlord |
| --- | --- | --- | --- | --- | --- | --- |
| Own orders and shared comments | Own | All operational | All operational | Reporting/config views | All visible operational | All |
| Other requesters' operational orders | No | Read + authorized reception actions | Read; operate assigned/claimable | Reports, not implicit operation | Read + privileged operations | All |
| Internal notes | No | Read/write | Read/write | Read where operationally required | Read/write | All |
| Create order on behalf | No | Visible active users | No by role alone | Only if separately authorized | Yes where policy grants | Yes |
| Claim/release | No | No | Self-claim/self-release | No | Reassign, not agent impersonation | All |
| Exception approval | No | No | No | No | Yes | Yes |
| Categories/settings | Read active choices | Read active choices | Read active choices | Manage ordinary configuration | Manage | Manage all |
| Ordinary user management | No | No | No | Approved limits | Visible users | All |
| Overlord record/role/control panel | No | No | No | No | No | Yes |
| Reports/exports | Own data only where provided | Operational views only | Operational views only | Yes | Yes | Yes |
| True protected audit actor | No; redacted | Redacted | Redacted | Redacted | Redacted | Yes |

All “all” and “yes” entries remain constrained by purpose-specific DTOs. Admin cannot gain operational mutation rights merely because reporting exposes data. The finalized receptionist status allowlist is configuration and must be narrower than general status mutation.

## Overlord protections

- Bootstrap from protected `OVERLORD_CLERK_USER_ID`; never from client metadata or normal role management.
- Do not expose the protected role literal in ordinary API enums, frontend role options, filters, generated navigation data, reports, errors, or counts.
- Ordinary user queries exclude protected records before pagination, aggregation, and search. Direct-ID access returns the same safe not-found behavior.
- Non-Overlord cannot create, target, deactivate, edit, invite-as, or change the role of a protected principal.
- Audit storage retains true actor ID and protected marker. Non-Overlord projections show `System Administrator` and no correlating identity metadata.
- Overlord commands are still audited and validated; owner status is not an audit bypass.
- Recovery/rotation uses deployment configuration and an audited server procedure, never an ordinary admin screen.

## Attachment controls

- Define purpose-specific allowlists for reference images, receipt proof, and receiving evidence; final MIME types and size limits remain configurable.
- Validate filename, declared MIME, observed content metadata where available, byte size, association, and uploader permission on the server.
- Use randomized Convex storage IDs and keep them out of ordinary DTOs.
- Finalize uploads only after an authorized record is created; quarantine/reject mismatch and clean abandoned uploads.
- Generate short-lived access after rechecking current authorization. Never store or log signed URLs.
- Escape filenames/content-disposition, render supported images safely, and download other files rather than inline execution.
- Preserve evidence associated with financial history; replacement creates a supersession link.
- Evaluate malware scanning before production based on allowed file types and risk.

## Audit integrity and redaction

Audited actions include creation/edit, billing-responsibility classification or reclassification, assignment/release/reassignment, transitions, approvals/rejections, cost changes, receipt/upload, substitution, refund, cancellation, confirmation, user/role, export, and settings changes. Events store actor, action, entity, ID, timestamp, safe prior/new values, correlation, and required reason.

Audit events have insert-only internal primitives and no normal update/delete endpoints. Corrections append linked events. Payload schemas allowlist business fields and exclude secrets, tokens, invitations, full attachment URLs, authentication material, and unnecessarily sensitive comment/file content. Audit access itself is role-controlled and export access audited.

## Session, webhook, and environment controls

- Clerk public registration is disabled and no public sign-up UI/route is provided.
- Clerk identity is verified for each Convex call; inactive users fail regardless of existing browser state.
- Webhooks, if used, verify signatures, timestamps, event types, and idempotency before synchronization.
- Development, preview, and production use distinct credentials and protected bootstrap IDs.
- Only publishable values use `NEXT_PUBLIC_`. CI and Vercel secret stores hold server values.
- Dependency updates, lockfile review, secret scanning, and least-privilege GitHub/Vercel access are release controls.

## Security test strategy

Phase 1 establishes authorization test helpers and a role/identity matrix. Each later phase adds negative tests with the feature. Required suites include:

- unauthenticated, unknown, and inactive user rejection for every public function;
- forged role, requester, assignment, and record-ID rejection;
- all role/record-scope combinations for queries and mutations;
- Overlord concealment through lists, direct IDs, search, filters, pagination counts, exports, errors, role values, and audit views;
- attempts by Admin/SA to create, assign, edit, deactivate, or infer Overlord;
- illegal/stale transition and claim concurrency tests;
- internal/shared comment isolation;
- attachment type/size/association/download authorization and signed-URL leakage tests;
- receipt requirement, minor-unit reconciliation, correction, refund, and cancellation outcome tests;
- billing-responsibility validation, required client-reference, post-submission reclassification authorization, audit, and reporting-isolation tests;
- audit completeness, immutability, reason requirements, and redaction tests;
- CSV formula injection and report authorization tests;
- Playwright smoke tests for invitation-only access and critical role journeys.

Phase 8 performs a function-by-function permission audit and adds regression tests for every finding. Security-sensitive functions should favor table-driven denial tests so new roles/states fail closed.

## Residual risks and open decisions

- Final upload allowlists/limits, malware scanning, and retention policy require business/security approval.
- Clerk invitation/session policy and webhook use require tenant configuration in Phase 1.
- Audit retention/export access and financial record retention require organizational policy.
- Final budget thresholds, edit cutoffs, and post-purchase cancellation authority must not be inferred.
- Whether client references eventually come from a managed client directory or remain controlled snapshots requires a later business decision; Phase 2 must support the required snapshot without inventing accounts-receivable workflows.

## Phase 8 audit result

The function-by-function release audit found and fixed protected-name exposure in bucket hydration, protected internal-ID exposure in order/lifecycle DTOs, protected-ID targeting in budget planning, and missing order/item association validation during attachment finalization. Regression coverage is in `convex/security-hardening.test.ts`. No known role or record-access bypass remains; production release is still gated by the manual manipulation tests in `docs/release-checklist.md`.
