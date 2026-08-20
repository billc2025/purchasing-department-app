# Deployment and rollback

## Environments

Use separate Clerk applications, Convex deployments, and Vercel environments for development, preview, and production. Never copy production secrets into `.env.local`, GitHub Actions, documentation, or chat. Production access should use the smallest practical team permissions.

## Required variables

Browser-visible Vercel variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (`/sign-in`)
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` (`/app`)
- `NEXT_PUBLIC_APP_URL`

Server-side Vercel variables:

- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SIGNING_SECRET` when a Vercel handler needs it

Convex deployment variables:

- `CLERK_JWT_ISSUER_DOMAIN`
- `CLERK_WEBHOOK_SIGNING_SECRET`
- `OVERLORD_CLERK_USER_ID`
- `APP_ENV` (`preview` or `production`)
- `ALLOW_DEVELOPMENT_RESET` must be absent or `false` outside development

`CONVEX_DEPLOYMENT` is local CLI deployment selection, not a browser value. Production deployment credentials belong only in the authorized deployment system.

## Clerk

1. Create or select the production Clerk application.
2. Disable public sign-up and self-service registration; invite users manually.
3. Create the Convex JWT integration and copy its issuer domain into the matching Convex environment.
4. Configure `user.created` and `user.updated` webhook events to `https://<convex-site-domain>/clerk-webhook`.
5. Store the webhook signing secret in Convex.
6. Configure the production application URL and allowed redirect URLs.
7. Invite one test account for each visible role and confirm public registration remains unavailable.

## Convex

1. Authenticate an approved operator with the Convex CLI.
2. Select the production project/deployment and run `npx convex deploy` from the reviewed release commit.
3. Add the server variables above through the Convex dashboard or `npx convex env set NAME` without placing values in shell history where organizational policy forbids it.
4. Set `OVERLORD_CLERK_USER_ID` to the approved Clerk user and run the protected reconciliation procedure before use.
5. Verify schema deployment, scheduled deadline notifications, webhook responses, file uploads, and logs.
6. Record the deployment URL and release commit in the change record.

## Vercel and GitHub

1. Import `billc2025/purchasing-department-app` into the approved Vercel team.
2. Select Next.js with the repository root and npm defaults.
3. Configure development/preview/production values separately. Mark all server values secret.
4. Require the GitHub `CI` quality and smoke jobs before merging to the production branch.
5. Deploy a preview from the release branch, complete the release checklist, then promote the reviewed commit to production.
6. Confirm the custom domain, HTTPS, Clerk redirect URLs, Content Security Policy, and the Convex production URL.

## First Overlord bootstrap

The protected identity is derived from `OVERLORD_CLERK_USER_ID`, never a browser role. Set the value in the matching Convex deployment, then reconcile the stored user marker using the approved protected procedure. Confirm that the Overlord can access protected controls and ordinary administrators cannot discover the account. If reconciliation reports `PROTECTED_IDENTITY_MISMATCH`, stop; do not modify the user through ordinary admin screens.

## Backup and export

- Take a Convex backup/export before the first production launch and before destructive migrations.
- Treat order, financial, receipt, audit, and attachment exports as confidential records.
- Define organizational retention periods before production. The application currently preserves operational evidence unless an authorized development reset is explicitly enabled.
- Test restoration into a non-production deployment and document recovery time.

## Rollback

1. Stop new production promotion and preserve logs/evidence.
2. In Vercel, promote the last known-good deployment or revert the release commit and deploy it.
3. For Convex, deploy compatible prior functions only when the current schema remains compatible. Do not destructively roll back stored data.
4. If data changed, restore only through an approved Convex backup/recovery process after impact review.
5. Rotate any potentially exposed secret, reverify Clerk/Convex integration, and document the incident.
6. Re-run smoke tests before reopening access.

Schema changes in this release are additive. A UI/function rollback can leave additional tables and fields in place safely; deletion requires a separately reviewed migration.
