import { effectiveRole } from "./authorization";

export type NotificationType =
  | "order_submitted"
  | "order_assigned"
  | "information_requested"
  | "comment_attention"
  | "status_changed"
  | "exception_decided"
  | "purchase_recorded"
  | "in_transit"
  | "confirmation_required"
  | "receipt_confirmed"
  | "receipt_issue"
  | "cancellation"
  | "deadline_approaching"
  | "deadline_overdue";

export function canReadOrder(user: any, order: any) {
  return (
    user._id === order.requestedForUserId ||
    user._id === order.createdByUserId ||
    [
      "receptionist",
      "purchasing_agent",
      "admin",
      "super_admin",
      "overlord",
    ].includes(effectiveRole(user))
  );
}

export async function notifyUser(
  ctx: any,
  input: {
    userId: any;
    order: any;
    type: NotificationType;
    message: string;
    eventKey: string;
  },
) {
  const user = await ctx.db.get(input.userId);
  if (!user?.isActive || !canReadOrder(user, input.order)) return null;
  const dedupeKey = `${input.order._id}:${input.type}:${input.eventKey}`;
  const existing = await ctx.db
    .query("notifications")
    .withIndex("by_user_dedupe", (q: any) =>
      q.eq("userId", input.userId).eq("dedupeKey", dedupeKey),
    )
    .unique();
  if (existing) return existing._id;
  return ctx.db.insert("notifications", {
    userId: input.userId,
    orderId: input.order._id,
    type: input.type,
    message: input.message,
    link: `/app/orders/${input.order._id}`,
    dedupeKey,
    createdAt: Date.now(),
  });
}

export async function notifyOperationalRoles(
  ctx: any,
  input: {
    order: any;
    type: NotificationType;
    message: string;
    eventKey: string;
    roles?: string[];
  },
) {
  const roles = input.roles ?? ["purchasing_agent", "admin", "super_admin"];
  const users = await ctx.db.query("users").take(500);
  await Promise.all(
    users
      .filter(
        (user: any) => user.isActive && roles.includes(effectiveRole(user)),
      )
      .map((user: any) => notifyUser(ctx, { ...input, userId: user._id })),
  );
}
