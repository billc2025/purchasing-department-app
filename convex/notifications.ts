import {
  internalMutationGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { canReadOrder, notifyUser } from "./lib/notifications";
import { requireActiveUser } from "./lib/authorization";

export const center = queryGeneric({
  args: { includeRead: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created_at", (q: any) => q.eq("userId", actor._id))
      .order("desc")
      .take(50);
    const result = [];
    for (const row of rows) {
      if (!args.includeRead && row.readAt) continue;
      const order = await ctx.db.get(row.orderId);
      if (!order || !canReadOrder(actor, order)) continue;
      result.push({ ...row, orderNumber: order.orderNumber });
    }
    return result;
  },
});

export const markRead = mutationGeneric({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const row = await ctx.db.get(args.notificationId);
    if (!row || row.userId !== actor._id)
      throw new Error("Notification not found");
    if (!row.readAt) await ctx.db.patch(row._id, { readAt: Date.now() });
    return null;
  },
});

export const markAllRead = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveUser(ctx);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created_at", (q: any) => q.eq("userId", actor._id))
      .take(200);
    const now = Date.now();
    for (const row of rows)
      if (!row.readAt) await ctx.db.patch(row._id, { readAt: now });
    await appendAuditEvent(ctx, actor, {
      action: "notifications.marked_read",
      entityType: "notification_center",
      entityId: String(actor._id),
      newValues: { count: rows.filter((row: any) => !row.readAt).length },
    });
    return null;
  },
});

export const generateDeadlineAlerts = internalMutationGeneric({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_required_at")
      .take(1000);
    let created = 0;
    for (const order of orders) {
      if (
        ["draft", "completed", "cancelled", "rejected"].includes(order.status)
      )
        continue;
      const approaching =
        order.requiredAt > now && order.requiredAt <= now + 24 * 60 * 60 * 1000;
      const overdue = order.requiredAt <= now;
      if (!approaching && !overdue) continue;
      const type = overdue ? "deadline_overdue" : "deadline_approaching";
      const message = overdue
        ? `Order ${order.orderNumber} is past its required-by date.`
        : `Order ${order.orderNumber} is due within 24 hours.`;
      const recipients = new Set(
        [order.requestedForUserId, order.assignedAgentId].filter(Boolean),
      );
      for (const userId of recipients) {
        const id = await notifyUser(ctx, {
          userId,
          order,
          type,
          message,
          eventKey: type,
        });
        if (id) created += 1;
      }
    }
    return { created };
  },
});
