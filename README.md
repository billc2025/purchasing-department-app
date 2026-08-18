# Purchasing Hub

Purchasing Hub is an internal purchasing-request and fulfillment system for fewer than 50 users. Employees submit multi-item orders, purchasing agents claim and fulfill work, receptionists record receipt, requesters confirm outcomes, and administrators manage configuration and reporting. Reliability, server-enforced permissions, traceability, and ease of use take priority over feature breadth.

This repository currently contains the application scaffold and **Phase 0 architecture only**. Product workflows begin in Phase 1 after explicit approval. The controlling specification is [`Purchasing_Hub_Codex_Build_Package.md`](Purchasing_Hub_Codex_Build_Package.md).

## Approved stack

| Area | Choice |
| --- | --- |
| Web | Next.js 16.3.1 App Router, React 19.2.8, strict TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui 4.18.0 |
| Authentication | Clerk, invitation-only |
| Backend, database, real time | Convex queries, mutations, actions, and subscriptions |
| Files | Convex File Storage initially |
| Validation | Convex validators at backend boundaries; Zod where appropriate |
| Tests | Vitest and Playwright |
| Delivery | GitHub Actions and Vercel |

Clerk, Convex, Vitest, and Playwright are approved architectural dependencies but are intentionally not installed or configured until their implementation phases. No Express API, PostgreSQL, Prisma, or parallel backend is planned.

## Local setup outline

Prerequisites are Node.js 20 or newer and npm. Phase 1 will confirm the exact supported runtime and add service-specific setup.

```bash
npm install
npm run dev
```

The scaffold is then available at `http://localhost:3000`. No external service is configured in Phase 0.

## Environment-variable names

Values must be different for development, preview, and production and must never be committed. Exact names will be confirmed against the versions selected in Phase 1.

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_APP_URL`
- `OVERLORD_CLERK_USER_ID`
- `APP_ENV`

Only variables deliberately prefixed with `NEXT_PUBLIC_` may be exposed to the browser. Clerk secrets, Convex deployment credentials, webhook secrets, and the Overlord bootstrap identity are server-only.

## Architecture documents

- [`docs/architecture.md`](docs/architecture.md) — system boundaries and request flow
- [`docs/domain-model.md`](docs/domain-model.md) — proposed Convex data model and indexes
- [`docs/status-transitions.md`](docs/status-transitions.md) — controlled order and item state machines
- [`docs/security-model.md`](docs/security-model.md) — threat model, authorization, redaction, and tests
- [`docs/implementation-roadmap.md`](docs/implementation-roadmap.md) — Phases 1–8 and dependencies

## Current constraints

- Phase 0 contains no product features, Clerk tenant, Convex deployment, Vercel project, or CI workflow.
- Production categories, budget thresholds, budget enforcement, cancellation authority after purchase, and edit cutoffs remain explicit configuration/future decisions.
- The hidden Overlord is a server-resolved capability and must never appear in ordinary role/user APIs or client bundles.

