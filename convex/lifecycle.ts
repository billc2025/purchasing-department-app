import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { effectiveRole, requireActiveUser } from "./lib/authorization";
import { normalizeText } from "./lib/orderValidation";

const issueOutcome = v.union(
  v.literal("missing"),
  v.literal("incorrect"),
  v.literal("damaged"),
  v.literal("incomplete"),
);

function required(value: string, label: string, max = 1_000) {
  const result = normalizeText(value, max);
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function canRead(actor: any, order: any) {
  return (
    actor._id === order.requestedForUserId ||
    actor._id === order.createdByUserId ||
    [
      "receptionist",
      "purchasing_agent",
      "admin",
      "super_admin",
      "overlord",
    ].includes(effectiveRole(actor))
  );
}

function canReceive(actor: any, order: any) {
  const role = effectiveRole(actor);
  return (
    role === "overlord" ||
    role === "receptionist" ||
    role === "super_admin" ||
    (role === "purchasing_agent" && order.assignedAgentId === actor._id)
  );
}

async function statusEvent(
  ctx: any,
  actor: any,
  order: any,
  command: string,
  toStatus: string,
  item?: any,
  reason?: string,
) {
  const fromStatus = item?.status ?? order.status;
  if (fromStatus === toStatus) return;
  const now = Date.now();
  await ctx.db.patch(item?._id ?? order._id, {
    status: toStatus,
    updatedAt: now,
  });
  await ctx.db.insert("statusEvents", {
    orderId: order._id,
    itemId: item?._id,
    actorUserId: actor._id,
    entityType: item ? "order_item" : "order",
    command,
    fromStatus,
    toStatus,
    reason,
    createdAt: now,
  });
  await appendAuditEvent(ctx, actor, {
    action: `${item ? "order_item" : "order"}.${command}`,
    entityType: item ? "order_item" : "order",
    entityId: String(item?._id ?? order._id),
    reason,
    priorValues: { status: fromStatus },
    newValues: { status: toStatus },
  });
}

export const workspace = queryGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || !canRead(actor, order)) throw new Error("Order not found");
    const [
      items,
      events,
      confirmations,
      changes,
      exceptions,
      cancellations,
      locations,
    ] = await Promise.all([
      ctx.db
        .query("orderItems")
        .withIndex("by_order_display_order", (q: any) =>
          q.eq("orderId", args.orderId),
        )
        .collect(),
      ctx.db
        .query("receivingEvents")
        .withIndex("by_order_received_at", (q: any) =>
          q.eq("orderId", args.orderId),
        )
        .collect(),
      ctx.db
        .query("receiptConfirmations")
        .withIndex("by_order_created_at", (q: any) =>
          q.eq("orderId", args.orderId),
        )
        .collect(),
      ctx.db
        .query("changeRequests")
        .withIndex("by_order_created_at", (q: any) =>
          q.eq("orderId", args.orderId),
        )
        .collect(),
      ctx.db
        .query("exceptionRequests")
        .withIndex("by_order_type", (q: any) => q.eq("orderId", args.orderId))
        .collect(),
      ctx.db
        .query("cancellationRequests")
        .withIndex("by_order_created_at", (q: any) =>
          q.eq("orderId", args.orderId),
        )
        .collect(),
      ctx.db.query("locations").take(100),
    ]);
    const role = effectiveRole(actor);
    return {
      order: {
        id: order._id,
        status: order.status,
        locationId: order.locationId,
        purpose: order.purpose,
        requiredAt: order.requiredAt,
        estimatedAmountMinor: order.estimatedAmountMinor,
        currency: order.currency,
      },
      items,
      receivingEvents: events,
      confirmations,
      changeRequests: changes,
      exceptionRequests: exceptions,
      cancellationRequests: cancellations,
      locations: locations
        .filter((location) => location.isActive)
        .map((location) => ({
          id: location._id,
          name: location.name,
        })),
      permissions: {
        canReceive: canReceive(actor, order),
        canConfirm:
          order.status === "received" && actor._id === order.requestedForUserId,
        canOverrideCompletion: role === "overlord" || role === "super_admin",
        canRequestChange:
          actor._id === order.requestedForUserId &&
          !["draft", "completed", "cancelled", "rejected"].includes(
            order.status,
          ),
        canDecideChange: role === "super_admin" || role === "overlord",
        canDecideException: role === "super_admin" || role === "overlord",
        canRequestCancellation:
          (actor._id === order.requestedForUserId || role === "overlord") &&
          ![
            "completed",
            "cancelled",
            "rejected",
            "cancellation_requested",
          ].includes(order.status),
        canDecideCancellation: role === "super_admin" || role === "overlord",
        canResumeIssue:
          role === "overlord" ||
          role === "super_admin" ||
          (role === "purchasing_agent" && order.assignedAgentId === actor._id),
      },
      confirmationRequired:
        order.status === "received" && actor._id === order.requestedForUserId,
    };
  },
});

export const myNotifications = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveUser(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user_created_at", (q: any) => q.eq("userId", actor._id))
      .order("desc")
      .take(10);
    return notifications.filter((notification: any) => !notification.readAt);
  },
});

export const generateEvidenceUploadUrl = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const recordReceipt = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    itemId: v.id("orderItems"),
    quantity: v.number(),
    receivedAt: v.number(),
    locationId: v.id("locations"),
    notes: v.optional(v.string()),
    evidenceStorageId: v.optional(v.id("_storage")),
    evidenceFileName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const [order, item, location] = await Promise.all([
      ctx.db.get(args.orderId),
      ctx.db.get(args.itemId),
      ctx.db.get(args.locationId),
    ]);
    if (!order || !item || item.orderId !== order._id)
      throw new Error("Order item not found");
    if (!canReceive(actor, order)) throw new Error("Access denied");
    if (!location?.isActive)
      throw new Error("Receiving location is unavailable");
    if (
      ![
        "purchasing",
        "purchased",
        "in_transit",
        "partially_fulfilled",
      ].includes(order.status)
    )
      throw new Error(
        `Order is currently ${order.status.replaceAll("_", " ")}`,
      );
    if (
      ![
        "purchased",
        "in_transit",
        "substituted",
        "partially_fulfilled",
      ].includes(item.status)
    )
      throw new Error(`Item is currently ${item.status.replaceAll("_", " ")}`);
    if (!Number.isFinite(args.quantity) || args.quantity <= 0)
      throw new Error("Received quantity must be positive");
    const purchased = item.purchasedQuantity ?? 0;
    const received = item.receivedQuantity ?? 0;
    if (args.quantity > purchased - received)
      throw new Error(
        "Received quantity exceeds the outstanding purchased quantity",
      );
    if (
      !Number.isFinite(args.receivedAt) ||
      args.receivedAt <= 0 ||
      args.receivedAt > Date.now() + 300_000
    )
      throw new Error("Received date is invalid");
    if (args.evidenceStorageId) {
      const metadata = await ctx.db.system.get(args.evidenceStorageId);
      if (!metadata || metadata.size > 8 * 1024 * 1024)
        throw new Error("Receiving evidence is invalid or too large");
    }
    const now = Date.now();
    const nextReceived = received + args.quantity;
    await ctx.db.insert("receivingEvents", {
      orderId: order._id,
      itemId: item._id,
      receiverUserId: actor._id,
      receivedAt: args.receivedAt,
      locationId: location._id,
      quantity: args.quantity,
      notes: normalizeText(args.notes ?? "", 1_000) || undefined,
      evidenceStorageId: args.evidenceStorageId,
      evidenceFileName: args.evidenceFileName
        ? normalizeText(args.evidenceFileName, 180)
        : undefined,
      createdAt: now,
    });
    const itemStatus =
      nextReceived === purchased ? "received" : "partially_fulfilled";
    await ctx.db.patch(item._id, {
      receivedQuantity: nextReceived,
      updatedAt: now,
    });
    await statusEvent(ctx, actor, order, "receive", itemStatus, item);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (q: any) =>
        q.eq("orderId", order._id),
      )
      .collect();
    const allReceived = items
      .filter(
        (candidate: any) =>
          !["unavailable", "cancelled"].includes(candidate.status),
      )
      .every((candidate: any) =>
        candidate._id === item._id
          ? nextReceived >= (candidate.purchasedQuantity ?? 0)
          : (candidate.receivedQuantity ?? 0) >=
              (candidate.purchasedQuantity ?? 0) &&
            (candidate.purchasedQuantity ?? 0) > 0,
      );
    const orderStatus = allReceived ? "received" : "partially_fulfilled";
    await statusEvent(ctx, actor, order, "derive_from_receipt", orderStatus);
    if (allReceived) {
      await ctx.db.insert("notifications", {
        userId: order.requestedForUserId,
        orderId: order._id,
        type: "confirmation_required",
        message: `Order ${order.orderNumber} was received and requires confirmation.`,
        createdAt: now,
      });
    }
    return { itemStatus, orderStatus };
  },
});

export const confirmReceipt = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    outcome: v.union(v.literal("correct"), issueOutcome),
    details: v.optional(v.string()),
    overrideReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "received")
      throw new Error("Order is not awaiting confirmation");
    const role = effectiveRole(actor);
    const privileged = role === "overlord" || role === "super_admin";
    if (actor._id !== order.requestedForUserId && !privileged)
      throw new Error("Only the requester can confirm this order");
    const overrideReason =
      privileged && actor._id !== order.requestedForUserId
        ? required(args.overrideReason ?? "", "Override reason")
        : undefined;
    const details = normalizeText(args.details ?? "", 2_000) || undefined;
    if (args.outcome !== "correct" && !details)
      throw new Error("Issue details are required");
    await ctx.db.insert("receiptConfirmations", {
      orderId: order._id,
      confirmerUserId: actor._id,
      outcome: args.outcome,
      details,
      isPrivilegedOverride: Boolean(overrideReason),
      overrideReason,
      createdAt: Date.now(),
    });
    for (const notification of await ctx.db
      .query("notifications")
      .withIndex("by_order_created_at", (q: any) => q.eq("orderId", order._id))
      .collect()) {
      if (!notification.readAt)
        await ctx.db.patch(notification._id, { readAt: Date.now() });
    }
    const nextStatus =
      args.outcome === "correct" ? "completed" : "receipt_issue_reported";
    await statusEvent(
      ctx,
      actor,
      order,
      args.outcome === "correct" ? "confirm_correct" : "report_receipt_issue",
      nextStatus,
      undefined,
      overrideReason ?? details,
    );
    return { status: nextStatus };
  },
});

export const resumeIssue = mutationGeneric({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "receipt_issue_reported")
      throw new Error("Order has no active receipt issue");
    const role = effectiveRole(actor);
    if (!(
      role === "overlord" ||
      role === "super_admin" ||
      (role === "purchasing_agent" && order.assignedAgentId === actor._id)
    ))
      throw new Error("Access denied");
    const reason = required(args.reason, "Resolution reason");
    await statusEvent(
      ctx,
      actor,
      order,
      "resume_issue_resolution",
      "in_transit",
      undefined,
      reason,
    );
    return { status: "in_transit" as const };
  },
});

export const requestChange = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    purpose: v.optional(v.string()),
    requiredAt: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (
      !order ||
      (actor._id !== order.requestedForUserId &&
        effectiveRole(actor) !== "overlord")
    )
      throw new Error("Order not found");
    if (["draft", "completed", "cancelled", "rejected"].includes(order.status))
      throw new Error("A change request is not allowed in this state");
    const requestedValues: Record<string, unknown> = {};
    if (args.purpose !== undefined)
      requestedValues.purpose = required(args.purpose, "Purpose", 500);
    if (args.requiredAt !== undefined) {
      if (!Number.isFinite(args.requiredAt) || args.requiredAt <= Date.now())
        throw new Error("Required-by date must be in the future");
      requestedValues.requiredAt = args.requiredAt;
    }
    if (!Object.keys(requestedValues).length)
      throw new Error("Choose at least one material change");
    const id = await ctx.db.insert("changeRequests", {
      orderId: order._id,
      requesterUserId: actor._id,
      originalValues: { purpose: order.purpose, requiredAt: order.requiredAt },
      requestedValues,
      reason: required(args.reason, "Change reason"),
      status: "pending",
      createdAt: Date.now(),
    });
    await appendAuditEvent(ctx, actor, {
      action: "change_request.created",
      entityType: "change_request",
      entityId: id,
      newValues: requestedValues,
    });
    return id;
  },
});

export const updateUnassignedOrder = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    purpose: v.optional(v.string()),
    requiredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (
      !order ||
      order.status !== "unassigned" ||
      actor._id !== order.requestedForUserId
    )
      throw new Error("Direct editing is not allowed in this state");
    const cutoffSetting = await ctx.db
      .query("systemSettings")
      .withIndex("by_key_active", (q: any) =>
        q.eq("key", "material_change_cutoff_minutes").eq("isActive", true),
      )
      .unique();
    const cutoffMinutes = cutoffSetting?.value?.minutes;
    if (typeof cutoffMinutes !== "number" || cutoffMinutes < 0)
      throw new Error("Direct-edit cutoff is not configured");
    if (order.requiredAt - Date.now() <= cutoffMinutes * 60_000)
      throw new Error(
        "The configured direct-edit cutoff has passed; submit a change request",
      );
    const values: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.purpose !== undefined)
      values.purpose = required(args.purpose, "Purpose", 500);
    if (args.requiredAt !== undefined) {
      if (!Number.isFinite(args.requiredAt) || args.requiredAt <= Date.now())
        throw new Error("Required-by date must be in the future");
      values.requiredAt = args.requiredAt;
    }
    if (Object.keys(values).length === 1)
      throw new Error("Choose at least one change");
    await ctx.db.patch(order._id, values);
    await appendAuditEvent(ctx, actor, {
      action: "order.direct_edit_before_cutoff",
      entityType: "order",
      entityId: order._id,
      priorValues: { purpose: order.purpose, requiredAt: order.requiredAt },
      newValues: values,
    });
    return { status: order.status };
  },
});

export const decideChange = mutationGeneric({
  args: {
    changeRequestId: v.id("changeRequests"),
    approve: v.boolean(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    if (!["super_admin", "overlord"].includes(effectiveRole(actor)))
      throw new Error("Access denied");
    const request = await ctx.db.get(args.changeRequestId);
    if (!request || request.status !== "pending")
      throw new Error("Change request is no longer pending");
    const order = await ctx.db.get(request.orderId);
    if (!order || ["completed", "cancelled", "rejected"].includes(order.status))
      throw new Error("Order can no longer be changed");
    const reason = required(args.reason, "Decision reason");
    const now = Date.now();
    if (args.approve)
      await ctx.db.patch(order._id, {
        ...request.requestedValues,
        updatedAt: now,
      });
    await ctx.db.patch(request._id, {
      status: args.approve ? "approved" : "rejected",
      decisionMakerUserId: actor._id,
      decisionReason: reason,
      decidedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: `change_request.${args.approve ? "approved" : "rejected"}`,
      entityType: "change_request",
      entityId: request._id,
      reason,
      priorValues: request.originalValues,
      newValues: args.approve ? request.requestedValues : undefined,
    });
    return { status: args.approve ? "approved" : "rejected" };
  },
});

export const decideLateException = mutationGeneric({
  args: { orderId: v.id("orders"), approve: v.boolean(), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    if (!["super_admin", "overlord"].includes(effectiveRole(actor)))
      throw new Error("Access denied");
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "exception_pending" || !order.isLate)
      throw new Error("Late exception is no longer pending");
    const reason = required(args.reason, "Decision reason");
    const now = Date.now();
    const requestId = await ctx.db.insert("exceptionRequests", {
      orderId: order._id,
      type: "late",
      triggerSnapshot: {
        requiredAt: order.requiredAt,
        earliestCompliantAt: order.earliestCompliantAt,
        leadTimeMinutes: order.leadTimeMinutesSnapshot,
      },
      requesterUserId: order.requestedForUserId,
      status: args.approve ? "approved" : "rejected",
      decisionMakerUserId: actor._id,
      decisionReason: reason,
      decidedAt: now,
      createdAt: order.submittedAt ?? order.createdAt,
    });
    await statusEvent(
      ctx,
      actor,
      order,
      args.approve ? "approve_late_exception" : "reject_late_exception",
      args.approve ? "unassigned" : "rejected",
      undefined,
      reason,
    );
    return { requestId, status: args.approve ? "unassigned" : "rejected" };
  },
});

export const routeBudgetException = mutationGeneric({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    const role = effectiveRole(actor);
    if (!(
      role === "overlord" ||
      (role === "purchasing_agent" && order.assignedAgentId === actor._id)
    ))
      throw new Error("Access denied");
    const transactions = await ctx.db
      .query("purchaseTransactions")
      .withIndex("by_order_purchased_at", (q: any) =>
        q.eq("orderId", order._id),
      )
      .collect();
    const actualAmountMinor = transactions.reduce(
      (sum: number, transaction: any) => sum + transaction.amountMinor,
      0,
    );
    if (actualAmountMinor <= order.estimatedAmountMinor)
      throw new Error("No existing budget overage can be routed");
    const id = await ctx.db.insert("exceptionRequests", {
      orderId: order._id,
      type: "budget",
      triggerSnapshot: {
        estimatedAmountMinor: order.estimatedAmountMinor,
        actualAmountMinor,
        currency: order.currency,
      },
      requesterUserId: actor._id,
      status: "pending",
      createdAt: Date.now(),
    });
    await appendAuditEvent(ctx, actor, {
      action: "budget_exception.routed",
      entityType: "exception_request",
      entityId: id,
      reason: required(args.reason, "Routing reason"),
      newValues: { actualAmountMinor },
    });
    return id;
  },
});

export const decideBudgetException = mutationGeneric({
  args: {
    exceptionRequestId: v.id("exceptionRequests"),
    approve: v.boolean(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    if (!["super_admin", "overlord"].includes(effectiveRole(actor)))
      throw new Error("Access denied");
    const request = await ctx.db.get(args.exceptionRequestId);
    if (!request || request.type !== "budget" || request.status !== "pending")
      throw new Error("Budget exception is no longer pending");
    const reason = required(args.reason, "Decision reason");
    await ctx.db.patch(request._id, {
      status: args.approve ? "approved" : "rejected",
      decisionMakerUserId: actor._id,
      decisionReason: reason,
      decidedAt: Date.now(),
    });
    await appendAuditEvent(ctx, actor, {
      action: `budget_exception.${args.approve ? "approved" : "rejected"}`,
      entityType: "exception_request",
      entityId: request._id,
      reason,
    });
    return { status: args.approve ? "approved" : "rejected" };
  },
});

export const requestCancellation = mutationGeneric({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (
      !order ||
      (actor._id !== order.requestedForUserId &&
        effectiveRole(actor) !== "overlord")
    )
      throw new Error("Order not found");
    if (
      ["completed", "cancelled", "rejected", "cancellation_requested"].includes(
        order.status,
      )
    )
      throw new Error("Cancellation is not available in this state");
    const reason = required(args.reason, "Cancellation reason");
    if (["draft", "unassigned"].includes(order.status)) {
      await statusEvent(
        ctx,
        actor,
        order,
        "cancel",
        "cancelled",
        undefined,
        reason,
      );
      return { status: "cancelled" as const };
    }
    const id = await ctx.db.insert("cancellationRequests", {
      orderId: order._id,
      requesterUserId: actor._id,
      priorStatus: order.status,
      reason,
      status: "pending",
      createdAt: Date.now(),
    });
    await statusEvent(
      ctx,
      actor,
      order,
      "request_cancellation",
      "cancellation_requested",
      undefined,
      reason,
    );
    return { status: "cancellation_requested" as const, requestId: id };
  },
});

export const decideCancellation = mutationGeneric({
  args: {
    cancellationRequestId: v.id("cancellationRequests"),
    approve: v.boolean(),
    reason: v.string(),
    outcomes: v.array(
      v.object({
        itemId: v.id("orderItems"),
        outcome: v.union(
          v.literal("returned"),
          v.literal("refunded"),
          v.literal("retained"),
          v.literal("non_refundable"),
        ),
        amountMinor: v.optional(v.number()),
        notes: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    if (!["super_admin", "overlord"].includes(effectiveRole(actor)))
      throw new Error("Access denied");
    const request = await ctx.db.get(args.cancellationRequestId);
    if (!request || request.status !== "pending")
      throw new Error("Cancellation request is no longer pending");
    const order = await ctx.db.get(request.orderId);
    if (!order || order.status !== "cancellation_requested")
      throw new Error("Order is no longer awaiting cancellation");
    const purchasedItems = (
      await ctx.db
        .query("orderItems")
        .withIndex("by_order_display_order", (q: any) =>
          q.eq("orderId", order._id),
        )
        .collect()
    ).filter((item: any) => (item.purchasedQuantity ?? 0) > 0);
    if (
      args.approve &&
      purchasedItems.some(
        (item: any) =>
          !args.outcomes.some((outcome) => outcome.itemId === item._id),
      )
    )
      throw new Error("Every purchased item requires a financial outcome");
    const reason = required(args.reason, "Decision reason");
    const now = Date.now();
    if (args.approve) {
      for (const outcome of args.outcomes) {
        if (!purchasedItems.some((item: any) => item._id === outcome.itemId))
          throw new Error("Cancellation outcome item is invalid");
        await ctx.db.insert("cancellationItemOutcomes", {
          cancellationRequestId: request._id,
          orderId: order._id,
          itemId: outcome.itemId,
          outcome: outcome.outcome,
          amountMinor: outcome.amountMinor,
          notes: normalizeText(outcome.notes ?? "", 500) || undefined,
          createdAt: now,
        });
        const item = purchasedItems.find(
          (candidate: any) => candidate._id === outcome.itemId,
        );
        if (outcome.outcome === "returned" || outcome.outcome === "refunded")
          await statusEvent(
            ctx,
            actor,
            order,
            `cancel_${outcome.outcome}`,
            outcome.outcome,
            item,
            reason,
          );
      }
    }
    await ctx.db.patch(request._id, {
      status: args.approve ? "approved" : "rejected",
      decisionMakerUserId: actor._id,
      decisionReason: reason,
      decidedAt: now,
    });
    if (args.approve && order.assignedAgentId) {
      await ctx.db.patch(order._id, {
        assignedAgentId: undefined,
        assignedAt: undefined,
        updatedAt: now,
      });
      await ctx.db.insert("assignmentEvents", {
        orderId: order._id,
        fromAgentId: order.assignedAgentId,
        action: "cleared_on_cancel",
        actorUserId: actor._id,
        reason,
        createdAt: now,
      });
    }
    await statusEvent(
      ctx,
      actor,
      order,
      args.approve ? "approve_cancellation" : "reject_cancellation",
      args.approve ? "cancelled" : request.priorStatus,
      undefined,
      reason,
    );
    return { status: args.approve ? "cancelled" : request.priorStatus };
  },
});
