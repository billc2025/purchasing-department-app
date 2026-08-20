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

Invite users from Clerk; public registration must remain disabled. In Purchasing Hub, open **Settings → Users and roles**, select **Open Clerk**, and send the invitation from Clerk. The verified Clerk webhook provisions accepted invitations as Requesters.

After the user accepts and appears in **Users and roles**, choose the approved role, enter the business reason, and select **Save role**. Admins can assign Requester, Receptionist, and Purchasing Agent. Super Admins and the protected owner can assign any visible role. Users cannot modify themselves, and every role change is audited.

Deactivation preserves historical records but blocks every protected backend call.

The protected Overlord cannot be viewed, edited, assigned, or deactivated through ordinary administration. A configuration mismatch must be resolved through the protected deployment procedure.

## Order approvals

Every requester submission enters **Pending approval** and is hidden from the purchasing bucket. Super Admins and the protected Overlord review these requests under **Approvals** and must enter a reason before choosing **Approve**, **Return for changes**, or **Reject**.

Approval releases the order to the unassigned purchasing bucket. Returning it restores an editable draft and notifies the requester; rejection retains the record without releasing it. The reviewer cannot decide an order they requested or created, including when the reviewer is the protected Overlord. Another authorized reviewer must handle that order. Late required-by dates are shown in the queue and an approval records the late exception in the same audited decision.

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

- Review pending approvals, exceptions, waiting-for-requester, overdue, and receipt-issue queues.
- Confirm unassigned work has coverage.
- Review notification failures and Clerk webhook errors in Convex logs.
- Investigate proof exceptions and budget/cancellation decisions through audit history.
- Never use **Reset test orders** outside the development deployment.

## Incident response

Deactivate a compromised visible user, preserve logs, rotate affected Clerk sessions/secrets, and notify the system owner. For suspected protected-account compromise, stop privileged operations and rotate `OVERLORD_CLERK_USER_ID` through the approved recovery process.
