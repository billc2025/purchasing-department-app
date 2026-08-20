import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { notifyOperationalRoles, notifyUser } from "./lib/notifications";
import {
  effectiveRole,
  requireActiveUser,
  requireRole,
} from "./lib/authorization";
import { normalizeText } from "./lib/orderValidation";

const decisionValidator = v.union(
  v.literal("approved"),
  v.literal("returned"),
  v.literal("rejected"),
);

function reason(value: string) {
  const result = normalizeText(value, 500);
  if (result.length < 3)
    throw new Error("A reason of at least 3 characters is required");
  return result;
}

export const pending = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = requireRole(await requireActiveUser(ctx), ["super_admin"]);
    const [orders, users, categories] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("by_status_required_at", (q: any) =>
          q.eq("status", "pending_approval"),
        )
        .take(100),
      ctx.db.query("users").take(100),
      ctx.db.query("categories").take(100),
    ]);
    const isOverlord = effectiveRole(actor) === "overlord";
    const names = new Map(
      users.map((user: any) => [
        user._id,
        user.isProtectedPrincipal && !isOverlord
          ? "System Administrator"
          : user.displayName,
      ]),
    );
    const categoryNames = new Map(
      categories.map((category: any) => [category._id, category.name]),
    );
    return orders
      .sort(
        (left: any, right: any) =>
          left.requiredAt - right.requiredAt ||
          left.orderNumber.localeCompare(right.orderNumber),
      )
      .map((order: any) => ({
        id: order._id,
        orderNumber: order.orderNumber,
        purpose: order.purpose,
        requester: names.get(order.requestedForUserId) ?? "Unavailable user",
        category: categoryNames.get(order.categoryId) ?? "Unavailable category",
        requiredAt: order.requiredAt,
        estimatedAmountMinor: order.estimatedAmountMinor,
        currency: order.currency,
        isLate: order.isLate,
        canDecide:
          actor._id !== order.createdByUserId &&
          actor._id !== order.requestedForUserId,
      }));
  },
});

export const decide = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    decision: decisionValidator,
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), ["super_admin"]);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "pending_approval")
      throw new Error("Order is no longer awaiting approval");
    if (
      actor._id === order.createdByUserId ||
      actor._id === order.requestedForUserId
    )
      throw new Error("You cannot approve your own order");
    const decisionReason = reason(args.reason);
    const now = Date.now();
    const decisionId = await ctx.db.insert("orderApprovalDecisions", {
      orderId: order._id,
      reviewerUserId: actor._id,
      decision: args.decision,
      reason: decisionReason,
      wasLate: order.isLate,
      createdAt: now,
    });
    const nextStatus =
      args.decision === "approved"
        ? "unassigned"
        : args.decision === "returned"
          ? "draft"
          : "rejected";
    await ctx.db.patch(order._id, {
      status: nextStatus,
      submittedAt: args.decision === "returned" ? undefined : order.submittedAt,
      updatedAt: now,
    });
    await ctx.db.insert("statusEvents", {
      orderId: order._id,
      actorUserId: actor._id,
      entityType: "order",
      command: `director_${args.decision}`,
      fromStatus: order.status,
      toStatus: nextStatus,
      reason: decisionReason,
      createdAt: now,
    });
    if (args.decision === "approved" && order.isLate)
      await ctx.db.insert("exceptionRequests", {
        orderId: order._id,
        type: "late",
        triggerSnapshot: {
          requiredAt: order.requiredAt,
          earliestCompliantAt: order.earliestCompliantAt,
          leadTimeMinutes: order.leadTimeMinutesSnapshot,
        },
        requesterUserId: order.requestedForUserId,
        status: "approved",
        decisionMakerUserId: actor._id,
        decisionReason,
        decidedAt: now,
        createdAt: order.submittedAt ?? order.createdAt,
      });
    await appendAuditEvent(ctx, actor, {
      action: `order_approval.${args.decision}`,
      entityType: "order_approval",
      entityId: String(decisionId),
      reason: decisionReason,
      priorValues: { status: order.status },
      newValues: {
        status: nextStatus,
        lateExceptionApproved: args.decision === "approved" && order.isLate,
      },
    });
    await notifyUser(ctx, {
      userId: order.requestedForUserId,
      order,
      type: "status_changed",
      message: `Order ${order.orderNumber} was ${args.decision === "returned" ? "returned for corrections" : args.decision}.`,
      eventKey: String(decisionId),
    });
    if (args.decision === "approved")
      await notifyOperationalRoles(ctx, {
        order,
        type: "order_submitted",
        message: `Approved order ${order.orderNumber} is ready for purchasing.`,
        eventKey: String(decisionId),
        roles: ["purchasing_agent", "admin", "super_admin", "overlord"],
      });
    return { status: nextStatus };
  },
});
