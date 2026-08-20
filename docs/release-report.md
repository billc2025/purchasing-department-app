# Phase 8 release report

## Current recommendation

**NO-GO for production promotion until the manual and service-authorization gates in `release-checklist.md` are completed.** The codebase is suitable for a controlled preview after automated verification. This is an operational gate, not a known authorization bypass.

## Security review

Every public Convex function was checked for active identity, role/capability, record scope, state guards, file association, exports, and caller-specific projection. Internal webhook synchronization verifies Clerk signatures. Public record IDs do not grant access by themselves.

Phase 8 findings fixed:

1. Purchasing-bucket user hydration could reveal the protected account name. It now returns `System Administrator` to every non-Overlord.
2. Order detail and lifecycle DTOs could expose the protected account’s internal user ID. Those identifiers are now removed for non-Overlords.
3. Budget planning could target a guessed protected user ID. It now returns the same safe `User not found` result.
4. Reference-image finalization accepted an item ID without verifying that the item belonged to the order. Cross-order associations are now rejected.

Regression tests cover all four findings. No known role or record-access bypass remains.

## Performance and storage review

- Bucket, notifications, order lists, details, and event histories use indexes and bounded reads.
- Reporting intentionally uses bounded in-memory aggregation for the current under-50-user scale and fails with guidance at its safety limit.
- Order-detail hydration groups related records rather than issuing per-item reads.
- Notification fan-out and protected-ID redaction use bounded user reads appropriate to the approved scale.
- Images are limited to JPEG/PNG/WebP and 8 MB; receipt/evidence metadata is server-verified.
- Removed draft attachments delete their storage object. Final financial/receiving evidence is preserved.

## Accessibility review

The release adds a skip link, strong keyboard focus, reduced-motion behavior, notification dialog semantics, responsive header navigation, and narrow-screen landing layout. Existing forms use native labels, status/error announcements, responsive cards, and mobile layouts. Automated desktop/mobile smoke coverage checks invitation-only messaging, focus, and horizontal overflow.

Manual screen-reader, full contrast, and authenticated mobile journey checks remain release gates.

## Known limitations and unresolved decisions

- Production categories and lead times require owner configuration.
- Budget allocations are planning-only; enforcement remains inactive.
- External email/Teams notifications and PDF reports are not implemented.
- Per-item reference-image selection is supported by the data model but not exposed in the current upload UI.
- Malware scanning and final attachment/audit/financial retention periods need organizational approval.
- The first-Overlord reconciliation/recovery procedure must be verified in production.
- Authenticated Playwright flows require an approved non-production Clerk storage state; CI safely skips them when unavailable while backend integration tests continue to cover the workflows.

## External authorization status

- GitHub repository access: verified through branch pushes.
- Clerk development tenant: previously exercised, but production configuration is not verified.
- Convex development deployment: verified; production configuration is not verified.
- Vercel: not configured or verified.

Production remains NO-GO until these external and manual checks are completed and recorded.
