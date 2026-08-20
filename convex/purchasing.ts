import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { notifyUser } from "./lib/notifications";
import {
  effectiveRole,
  requireActiveUser,
  requireRole,
} from "./lib/authorization";
import {
  bucketFilters,
  compareBucketOrders,
  matchesBucketFilter,
  normalizeReason,
  type BucketFilter,
} from "./lib/bucket";

const filterValidator = v.union(
  ...bucketFilters.map((filter) => v.literal(filter)),
);

const bucketReaderRoles = [
  "receptionist",
  "purchasing_agent",
  "admin",
  "super_admin",
] as const;

function currentStateError(status?: string) {
  return new ConvexError({
    code: "ORDER_STATE_CHANGED",
    message: status
      ? `This order is currently ${status.replaceAll("_", " ")}. Refresh the bucket and try again.`
      : "This order is no longer available. Refresh the bucket and try again.",
  });
}

export const listBucket = queryGeneric({
  args: {
    filter: filterValidator,
    search: v.optional(v.string()),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
    todayStart: v.number(),
    todayEnd: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), bucketReaderRoles);
    const now = Date.now();
    const search = (args.search ?? "").trim().toLocaleLowerCase().slice(0, 100);
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    const limit = Math.min(50, Math.max(1, Math.floor(args.limit ?? 25)));
    const [orders, categories, users, locations] = await Promise.all([
      ctx.db.query("orders").take(250),
      ctx.db.query("categories").take(100),
      ctx.db.query("users").take(100),
      ctx.db.query("locations").take(100),
    ]);
    const categoryById = new Map(
      categories.map((category) => [category._id, category.name]),
    );
    const viewerIsOverlord = effectiveRole(actor) === "overlord";
    const userById = new Map(
      users.map((user) => [
        user._id,
        user.isProtectedPrincipal && !viewerIsOverlord
          ? "System Administrator"
          : user.displayName,
      ]),
    );
    const locationById = new Map(
      locations.map((location) => [location._id, location.name]),
    );
    const filtered = orders
      .filter((order) =>
        matchesBucketFilter(
          {
            id: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            requiredAt: order.requiredAt,
            isLate: order.isLate,
            assignedAgentId: order.assignedAgentId,
          },
          args.filter as BucketFilter,
          actor._id,
          now,
          args.todayStart,
          args.todayEnd,
        ),
      )
      .sort((left, right) =>
        compareBucketOrders(
          { ...left, id: left._id },
          { ...right, id: right._id },
          now,
        ),
      );

    const hydrated = filtered.map((order) => ({
      id: order._id,
      orderNumber: order.orderNumber,
      purpose: order.purpose,
      requiredAt: order.requiredAt,
      category: categoryById.get(order.categoryId) ?? "Unavailable category",
      requester: userById.get(order.requestedForUserId) ?? "Unavailable user",
      location: locationById.get(order.locationId) ?? "Unavailable location",
      assignee: order.assignedAgentId
        ? userById.get(order.assignedAgentId)
        : undefined,
      assignedAgentId: order.assignedAgentId,
      status: order.status,
      isLate: order.isLate,
      hasMissingInformation:
        order.hasMissingInformation ?? order.status === "waiting_for_requester",
    }));
    const searched = search
      ? hydrated.filter((row) =>
          [
            row.orderNumber,
            row.purpose,
            row.category,
            row.requester,
            row.location,
            row.assignee ?? "",
          ].some((value) => value.toLocaleLowerCase().includes(search)),
        )
      : hydrated;
    const rows = searched.slice(offset, offset + limit);
    const role = effectiveRole(actor);
    return {
      rows,
      total: searched.length,
      hasMore: offset + rows.length < searched.length,
      serverNow: now,
      actorId: actor._id,
      permissions: {
        canClaim: role === "purchasing_agent" || role === "overlord",
        canReassign: role === "super_admin" || role === "overlord",
        readOnly: role === "receptionist" || role === "admin",
      },
    };
  },
});

export const listAssignableAgents = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = requireRole(await requireActiveUser(ctx), ["super_admin"]);
    const agents = await ctx.db
      .query("users")
      .withIndex("by_active_role", (query: any) =>
        query.eq("isActive", true).eq("role", "purchasing_agent"),
      )
      .take(100);
    return agents
      .filter((agent) => !agent.isProtectedPrincipal && agent._id !== actor._id)
      .map((agent) => ({ id: agent._id, displayName: agent.displayName }));
  },
});

export const claim = mutationGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), [
      "purchasing_agent",
    ]);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "unassigned" || order.assignedAgentId)
      throw currentStateError(order?.status);
    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      status: "assigned",
      assignedAgentId: actor._id,
      assignedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentEvents", {
      orderId: args.orderId,
      toAgentId: actor._id,
      action: "claimed",
      actorUserId: actor._id,
      createdAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "order.claimed",
      entityType: "order",
      entityId: args.orderId,
      newValues: { assignedAgentId: actor._id, status: "assigned" },
    });
    await notifyUser(ctx, {
      userId: order.requestedForUserId,
      order,
      type: "order_assigned",
      message: `Order ${order.orderNumber} was assigned to purchasing.`,
      eventKey: String(now),
    });
    return { status: "assigned" as const, assignedAgentId: actor._id };
  },
});

export const release = mutationGeneric({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), [
      "purchasing_agent",
    ]);
    const reason = normalizeReason(args.reason);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "assigned" || !order.assignedAgentId)
      throw currentStateError(order?.status);
    if (
      effectiveRole(actor) !== "overlord" &&
      order.assignedAgentId !== actor._id
    )
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Only the assigned agent can release this order",
      });
    const now = Date.now();
    const fromAgentId = order.assignedAgentId;
    await ctx.db.patch(args.orderId, {
      status: "unassigned",
      assignedAgentId: undefined,
      assignedAt: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentEvents", {
      orderId: args.orderId,
      fromAgentId,
      action: "released",
      actorUserId: actor._id,
      reason,
      createdAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "order.released",
      entityType: "order",
      entityId: args.orderId,
      reason,
      priorValues: { assignedAgentId: fromAgentId, status: order.status },
      newValues: { status: "unassigned" },
    });
    return { status: "unassigned" as const };
  },
});

export const reassign = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    targetAgentId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), ["super_admin"]);
    const reason = normalizeReason(args.reason);
    const [order, target] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.targetAgentId),
    ]);
    if (!order || order.status !== "assigned" || !order.assignedAgentId)
      throw currentStateError(order?.status);
    if (
      !target ||
      !target.isActive ||
      target.role !== "purchasing_agent" ||
      target.isProtectedPrincipal
    )
      throw new ConvexError({
        code: "INVALID_ASSIGNEE",
        message: "Select an active purchasing agent",
      });
    if (target._id === order.assignedAgentId)
      throw new ConvexError({
        code: "NO_CHANGE",
        message: "Order is already assigned to that agent",
      });
    const now = Date.now();
    const fromAgentId = order.assignedAgentId;
    await ctx.db.patch(args.orderId, {
      assignedAgentId: target._id,
      assignedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentEvents", {
      orderId: args.orderId,
      fromAgentId,
      toAgentId: target._id,
      action: "reassigned",
      actorUserId: actor._id,
      reason,
      createdAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "order.reassigned",
      entityType: "order",
      entityId: args.orderId,
      reason,
      priorValues: { assignedAgentId: fromAgentId },
      newValues: { assignedAgentId: target._id },
    });
    return { status: "assigned" as const, assignedAgentId: target._id };
  },
});
