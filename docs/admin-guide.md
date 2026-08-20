# Administrator guide

## Roles

- **Requester:** creates and tracks orders, answers questions, and confirms receipt.
- **Receptionist:** monitors operational orders and records permitted receipts.
- **Purchasing agent:** claims and processes orders assigned to them.
- **Admin:** reporting, ordinary configuration, and approved user administration.
- **Super Admin:** visible privileged decisions, reassignment, configuration, reporting, and visible-user administration.
- **Protected Overlord:** server-configured recovery/owner capability. It is intentionally absent from role lists and ordinary user management.

Roles are enforced by Convex, not by hidden buttons. Never use browser metadata as an authorization source.

## Invitations and users

Invite users from Clerk; public registration must remain disabled. The verified Clerk webhook provisions invited accounts as requesters. Assign elevated visible roles only through an approved administrative procedure. Deactivation preserves historical records but blocks every protected backend call.

The protected Overlord cannot be viewed, edited, assigned, or deactivated through ordinary administration. A configuration mismatch must be resolved through the protected deployment procedure.

## Operational configuration

Open **Settings** to manage:

- categories and lead-time rules;
- departments and optional cost-center references;
- receiving locations and time zones;
- direct-edit cutoff;
- statuses in which reception may record delivery;
- cancellation financial outcomes.

Changes are validated and audited. Review changes with purchasing operations before saving. Budget allocations are planning records only: enforcement is inactive and orders do not consume them.

## Reports and exports

Admins, Super Admins, and the protected owner can access Reports. Always select the intended date dimension and filters. CSV exports neutralize spreadsheet formulas but remain confidential. Report safety limits require a narrower date range when the result set is too large.

## Daily checks

- Review exception, waiting-for-requester, overdue, and receipt-issue queues.
- Confirm unassigned work has coverage.
- Review notification failures and Clerk webhook errors in Convex logs.
- Investigate proof exceptions and budget/cancellation decisions through audit history.
- Never use **Reset test orders** outside the development deployment.

## Incident response

Deactivate a compromised visible user, preserve logs, rotate affected Clerk sessions/secrets, and notify the system owner. For suspected protected-account compromise, stop privileged operations and rotate `OVERLORD_CLERK_USER_ID` through the approved recovery process.
