import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { effectiveRole, requireActiveUser } from "./lib/authorization";
import {
  computeLeadTime,
  normalizeText,
  validateAttachment,
  validateBilling,
  validateItems,
} from "./lib/orderValidation";
import { normalizeReason } from "./lib/bucket";
import { billingResponsibilityValidator } from "./schema";

const itemValidator = v.object({
  name: v.string(),
  specification: v.string(),
  quantity: v.number(),
  unit: v.string(),
  preferredVendor: v.optional(v.string()),
  estimatedAmountMinor: v.number(),
  substitutionAllowed: v.boolean(),
  notes: v.optional(v.string()),
});
const draftArgs = {
  orderId: v.optional(v.id("orders")),
  requestedForUserId: v.id("users"),
  departmentId: v.optional(v.id("departments")),
  billingResponsibility: billingResponsibilityValidator,
  clientBillingReference: v.optional(v.string()),
  billingNotes: v.optional(v.string()),
  categoryId: v.id("categories"),
  purpose: v.string(),
  locationId: v.id("locations"),
  deliveryInstructions: v.optional(v.string()),
  requiredAt: v.number(),
  displayTimezone: v.string(),
  estimatedAmountMinor: v.number(),
  currency: v.string(),
  comments: v.optional(v.string()),
  items: v.array(itemValidator),
};

async function authorizeRequestedFor(
  ctx: any,
  actor: any,
  requestedForUserId: string,
) {
  const target = await ctx.db.get(requestedForUserId);
  if (
    !target ||
    !target.isActive ||
    (target.isProtectedPrincipal && target._id !== actor._id)
  )
    throw new Error("Requested-for user not found");
  const role = effectiveRole(actor);
  if (
    requestedForUserId !== actor._id &&
    !["receptionist", "admin", "super_admin", "overlord"].includes(role)
  )
    throw new Error("Access denied");
  return target;
}

async function activeRule(ctx: any, categoryId: string) {
  const category = await ctx.db.get(categoryId);
  if (!category?.isActive) throw new Error("Category unavailable");
  const rule = await ctx.db
    .query("categoryRules")
    .withIndex("by_category_active", (q: any) =>
      q.eq("categoryId", categoryId).eq("isActive", true),
    )
    .unique();
  if (!rule) throw new Error("Category lead-time rule unavailable");
  return rule;
}

export const eligibleRequestedForUsers = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveUser(ctx);
    const role = effectiveRole(actor);
    if (!["receptionist", "admin", "super_admin", "overlord"].includes(role))
      return [{ id: actor._id, displayName: actor.displayName }];
    const users = await ctx.db.query("users").take(100);
    const visibleUsers = users
      .filter((user) => user.isActive && !user.isProtectedPrincipal)
      .map((user) => ({ id: user._id, displayName: user.displayName }));
    return actor.isProtectedPrincipal
      ? [{ id: actor._id, displayName: "Myself" }, ...visibleUsers]
      : visibleUsers;
  },
});

export const leadTimePreview = queryGeneric({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    await requireActiveUser(ctx);
    const rule = await activeRule(ctx, args.categoryId);
    const now = Date.now();
    return {
      serverNow: now,
      earliestCompliantAt: now + rule.normalizedLeadTimeMinutes * 60_000,
      leadTimeValue: rule.leadTimeValue,
      leadTimeUnit: rule.leadTimeUnit,
    };
  },
});

export const saveDraft = mutationGeneric({
  args: draftArgs,
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const target = await authorizeRequestedFor(
      ctx,
      actor,
      args.requestedForUserId,
    );
    const rule = await activeRule(ctx, args.categoryId);
    const items = validateItems(args.items);
    const clientBillingReference = validateBilling(
      args.billingResponsibility,
      args.clientBillingReference,
    );
    const now = Date.now();
    if (
      !Number.isSafeInteger(args.estimatedAmountMinor) ||
      args.estimatedAmountMinor < 0
    )
      throw new Error("Estimate must use non-negative integer minor units");
    const timing = computeLeadTime(
      now,
      args.requiredAt,
      rule.normalizedLeadTimeMinutes,
    );
    const values = {
      requesterUserId: target._id,
      requestedForUserId: target._id,
      departmentId: args.departmentId,
      billingResponsibility: args.billingResponsibility,
      clientBillingReference,
      billingNotes: normalizeText(args.billingNotes ?? "", 500) || undefined,
      categoryId: args.categoryId,
      categoryRuleVersion: rule.version,
      leadTimeMinutesSnapshot: rule.normalizedLeadTimeMinutes,
      purpose: normalizeText(args.purpose, 500),
      locationId: args.locationId,
      deliveryInstructions:
        normalizeText(args.deliveryInstructions ?? "", 500) || undefined,
      requiredAt: args.requiredAt,
      displayTimezone: normalizeText(args.displayTimezone, 80),
      earliestCompliantAt: timing.earliestCompliantAt,
      isLate: timing.isLate,
      estimatedAmountMinor: args.estimatedAmountMinor,
      currency: normalizeText(args.currency, 3).toUpperCase(),
      comments: normalizeText(args.comments ?? "", 2000) || undefined,
      updatedAt: now,
    };
    let orderId = args.orderId;
    let action = "order.draft_updated";
    if (orderId) {
      const existing = await ctx.db.get(orderId);
      if (
        !existing ||
        existing.status !== "draft" ||
        (existing.createdByUserId !== actor._id &&
          existing.requestedForUserId !== actor._id)
      )
        throw new Error("Draft not found");
      await ctx.db.patch(orderId, values);
      for (const oldItem of await ctx.db
        .query("orderItems")
        .withIndex("by_order_display_order", (q: any) =>
          q.eq("orderId", orderId),
        )
        .collect())
        await ctx.db.delete(oldItem._id);
    } else {
      orderId = await ctx.db.insert("orders", {
        ...values,
        orderNumber: `DRAFT-${now}`,
        createdByUserId: actor._id,
        status: "draft",
        createdAt: now,
      });
      await ctx.db.patch(orderId, {
        orderNumber: `PH-${new Date(now).getUTCFullYear()}-${String(orderId).slice(-6).toUpperCase()}`,
      });
      action = "order.draft_created";
    }
    for (let index = 0; index < items.length; index++)
      await ctx.db.insert("orderItems", {
        orderId,
        ...items[index],
        displayOrder: index,
        status: "requested",
        createdAt: now,
        updatedAt: now,
      });
    await appendAuditEvent(ctx, actor, {
      action,
      entityType: "order",
      entityId: orderId,
      newValues: {
        itemCount: items.length,
        billingResponsibility: args.billingResponsibility,
      },
    });
    return orderId;
  },
});

export const submit = mutationGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (
      !order ||
      order.status !== "draft" ||
      (order.createdByUserId !== actor._id &&
        order.requestedForUserId !== actor._id)
    )
      throw new Error("Draft not found");
    validateBilling(order.billingResponsibility, order.clientBillingReference);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (q: any) =>
        q.eq("orderId", args.orderId),
      )
      .collect();
    if (!items.length) throw new Error("At least one item is required");
    const now = Date.now();
    const timing = computeLeadTime(
      now,
      order.requiredAt,
      order.leadTimeMinutesSnapshot,
    );
    const status = timing.isLate ? "exception_pending" : "unassigned";
    await ctx.db.patch(args.orderId, {
      status,
      submittedAt: now,
      earliestCompliantAt: timing.earliestCompliantAt,
      isLate: timing.isLate,
      updatedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "order.submitted",
      entityType: "order",
      entityId: args.orderId,
      newValues: {
        status,
        isLate: timing.isLate,
        billingResponsibility: order.billingResponsibility,
      },
    });
    return { status, isLate: timing.isLate };
  },
});

function canRead(actor: any, order: any) {
  const role = effectiveRole(actor);
  return (
    order.requestedForUserId === actor._id ||
    order.createdByUserId === actor._id ||
    [
      "receptionist",
      "purchasing_agent",
      "admin",
      "super_admin",
      "overlord",
    ].includes(role)
  );
}
export const listMine = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveUser(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_requested_for_created_at", (q: any) =>
        q.eq("requestedForUserId", actor._id),
      )
      .order("desc")
      .take(100);
    return orders.map((order) => ({
      id: order._id,
      orderNumber: order.orderNumber,
      purpose: order.purpose,
      status: order.status,
      requiredAt: order.requiredAt,
      isLate: order.isLate,
      billingResponsibility: order.billingResponsibility,
      clientBillingReference: order.clientBillingReference,
      estimatedAmountMinor: order.estimatedAmountMinor,
      currency: order.currency,
    }));
  },
});
export const detail = queryGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || !canRead(actor, order)) throw new Error("Order not found");
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (q: any) =>
        q.eq("orderId", args.orderId),
      )
      .collect();
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_order_status", (q: any) =>
        q.eq("orderId", args.orderId).eq("status", "active"),
      )
      .collect();
    return {
      ...order,
      items,
      permissions: {
        canOverlordCancel:
          effectiveRole(actor) === "overlord" && order.status !== "cancelled",
      },
      attachments: attachments.map((file) => ({
        id: file._id,
        fileName: file.fileName,
        mediaType: file.mediaType,
        byteSize: file.byteSize,
      })),
    };
  },
});

export const cancelByOverlord = mutationGeneric({
  args: { orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    if (effectiveRole(actor) !== "overlord") throw new Error("Access denied");
    const reason = normalizeReason(args.reason);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "cancelled")
      throw new Error("Order is already cancelled");
    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      assignedAgentId: undefined,
      assignedAt: undefined,
      updatedAt: now,
    });
    if (order.assignedAgentId) {
      await ctx.db.insert("assignmentEvents", {
        orderId: args.orderId,
        fromAgentId: order.assignedAgentId,
        action: "cleared_on_cancel",
        actorUserId: actor._id,
        reason,
        createdAt: now,
      });
    }
    await appendAuditEvent(ctx, actor, {
      action: "order.cancelled_by_overlord",
      entityType: "order",
      entityId: args.orderId,
      reason,
      priorValues: {
        status: order.status,
        assignedAgentId: order.assignedAgentId,
      },
      newValues: { status: "cancelled" },
    });
    return { status: "cancelled" as const };
  },
});
export const generateUploadUrl = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    return ctx.storage.generateUploadUrl();
  },
});
export const attachReferenceImage = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    itemId: v.optional(v.id("orderItems")),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (
      !order ||
      order.status !== "draft" ||
      (order.createdByUserId !== actor._id &&
        order.requestedForUserId !== actor._id)
    )
      throw new Error("Draft not found");
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) throw new Error("Upload not found");
    validateAttachment(metadata.contentType ?? "", metadata.size);
    const id = await ctx.db.insert("attachments", {
      orderId: args.orderId,
      itemId: args.itemId,
      uploaderUserId: actor._id,
      storageId: args.storageId,
      fileName: normalizeText(args.fileName, 180),
      mediaType: metadata.contentType!,
      byteSize: metadata.size,
      purpose: "reference_image",
      status: "active",
      createdAt: Date.now(),
    });
    await appendAuditEvent(ctx, actor, {
      action: "attachment.added",
      entityType: "attachment",
      entityId: id,
      newValues: {
        orderId: args.orderId,
        mediaType: metadata.contentType,
        byteSize: metadata.size,
      },
    });
    return id;
  },
});
export const removeAttachment = mutationGeneric({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const file = await ctx.db.get(args.attachmentId);
    const order = file ? await ctx.db.get(file.orderId) : null;
    if (
      !file ||
      !order ||
      order.status !== "draft" ||
      (order.createdByUserId !== actor._id &&
        order.requestedForUserId !== actor._id)
    )
      throw new Error("Attachment not found");
    await ctx.db.patch(args.attachmentId, {
      status: "removed",
      removedAt: Date.now(),
    });
    await ctx.storage.delete(file.storageId);
    await appendAuditEvent(ctx, actor, {
      action: "attachment.removed",
      entityType: "attachment",
      entityId: args.attachmentId,
    });
    return null;
  },
});
export const attachmentUrl = queryGeneric({
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const file = await ctx.db.get(args.attachmentId);
    const order = file ? await ctx.db.get(file.orderId) : null;
    if (!file || file.status !== "active" || !order || !canRead(actor, order))
      throw new Error("Attachment not found");
    return ctx.storage.getUrl(file.storageId);
  },
});
