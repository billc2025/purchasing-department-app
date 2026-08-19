# Purchasing Hub

Purchasing Hub is an internal purchasing-request and fulfillment system for fewer than 50 users. Employees submit multi-item orders, purchasing agents claim and fulfill work, receptionists record receipt, requesters confirm outcomes, and administrators manage configuration and reporting. Reliability, server-enforced permissions, traceability, and ease of use take priority over feature breadth.

Each order also records who ultimately bears its cost: the identified client is billed, or the organization absorbs it internally. This classification is required at order entry and protected from silent reclassification after submission.

This repository contains the approved architecture, Phase 1 authentication/authorization foundation, Phase 2 order-entry workflow, and Phase 3 real-time purchasing bucket. The controlling specification is [`Purchasing_Hub_Codex_Build_Package.md`](Purchasing_Hub_Codex_Build_Package.md).

## Approved stack

| Area                         | Choice                                                         |
| ---------------------------- | -------------------------------------------------------------- |
| Web                          | Next.js 16.3.1 App Router, React 19.2.8, strict TypeScript 5   |
| UI                           | Tailwind CSS 4, shadcn/ui 4.18.0                               |
| Authentication               | Clerk, invitation-only                                         |
| Backend, database, real time | Convex queries, mutations, actions, and subscriptions          |
| Files                        | Convex File Storage initially                                  |
| Validation                   | Convex validators at backend boundaries; Zod where appropriate |
| Tests                        | Vitest and Playwright                                          |
| Delivery                     | GitHub Actions and Vercel                                      |

Clerk, Convex, Zod, and Vitest are installed for Phase 1. Playwright remains a Phase 8 dependency. No Express API, PostgreSQL, Prisma, or parallel backend is planned.

## Local setup outline

Prerequisites are Node.js 20 or newer and npm.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

The application is then available at `http://localhost:3000`. Without service values it renders a safe setup-required state instead of attempting authentication.

## Clerk and Convex development setup

1. Create a Clerk development application and disable public sign-up. Provision users by invitation only.
2. Activate Clerk's Convex integration and note the Clerk issuer/frontend API domain.
3. Run `npx convex dev` and select/create the Purchasing Hub development project. This replaces the pre-deployment API bridge with official typed files under `convex/_generated` and sets `CONVEX_DEPLOYMENT` locally.
4. In the Convex development deployment, set `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `OVERLORD_CLERK_USER_ID` with `npx convex env set`. Do not prefix them with `NEXT_PUBLIC_`.
5. Copy `.env.example` to `.env.local` and provide only the development values. Never commit `.env.local`.
6. Configure `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` and ensure no sign-up route or self-service registration is enabled.
7. Configure Clerk `user.created` and `user.updated` events to the deployed Convex `/clerk-webhook` HTTP endpoint. The signature-verified handler provisions new invited users as requesters and preserves existing server-controlled roles. Unknown identities fail closed with `ACCOUNT_NOT_PROVISIONED`.

The first Overlord identity is matched exclusively against the protected Convex deployment value. Its stored visible role remains an ordinary role-shaped value so the hidden role is absent from ordinary schemas and client role lists.

## Phase 2 development data

An authorized administrator or the protected system owner can select **Add sample data** on the application dashboard. This idempotently creates editable development examples for Food Delivery (one hour), Event Purchase (three continuous calendar days), General Operations, and Main Office. They are samples, not fixed production policy.

Phase 2 accepts JPEG, PNG, and WebP reference images up to 8 MB. File metadata is verified from Convex storage on the server. Draft attachments may be removed; access to active attachments follows order authorization.

The storage model supports associating an attachment with an individual order item, but the current upload UI associates reference images with the order. Per-item upload controls remain a documented follow-up gap.

## Phase 3 purchasing bucket

Receptionists, purchasing agents, administrators, Super Admins, and the protected system owner can monitor a bounded real-time operational bucket. Purchasing agents claim only for themselves; assigned agents release with a reason; Super Admins and the protected owner reassign to active purchasing agents with a reason. Convex mutations serialize assignment changes, and append-only assignment and audit events preserve the history.

Priority is deterministic: overdue active work, late/exception work, unassigned work, then remaining active work; each group sorts by required time, order number, and stable ID. The UI includes the specification's operational filters, search, 25-row bounded pages, desktop tables, and mobile cards.

## Environment-variable names

Values must be different for development, preview, and production and must never be committed. Exact names will be confirmed against the versions selected in Phase 1.

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_APP_URL`
- `OVERLORD_CLERK_USER_ID`
- `CLERK_JWT_ISSUER_DOMAIN`
- `APP_ENV`

Only variables deliberately prefixed with `NEXT_PUBLIC_` may be exposed to the browser. Clerk secrets, Convex deployment credentials, webhook secrets, and the Overlord bootstrap identity are server-only.

## Architecture documents

- [`docs/architecture.md`](docs/architecture.md) — system boundaries and request flow
- [`docs/domain-model.md`](docs/domain-model.md) — proposed Convex data model and indexes
- [`docs/status-transitions.md`](docs/status-transitions.md) — controlled order and item state machines
- [`docs/security-model.md`](docs/security-model.md) — threat model, authorization, redaction, and tests
- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md) — Phases 1–8 and dependencies

## Current constraints

- The Clerk development tenant and Convex development deployment are configured. Vercel and CI remain deferred.
- Production categories, budget thresholds, budget enforcement, cancellation authority after purchase, and edit cutoffs remain explicit configuration/future decisions.
- The hidden Overlord is a server-resolved capability and must never appear in ordinary role/user APIs or client bundles.

## Overlord bootstrap recovery

For development or production rotation, an existing authorized system owner updates `OVERLORD_CLERK_USER_ID` in the matching Convex deployment, runs the protected reconciliation procedure, confirms the new identity, and records an audit event before retiring the prior Clerk account. Until the protected reconciliation command is implemented and tested with an authorized deployment, recovery is a release blocker and must not be approximated through ordinary user management.
