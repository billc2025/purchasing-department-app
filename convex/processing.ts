import { mutationGeneric, queryGeneric } from "convex/server";
import { ConvexError, v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import {
  effectiveRole,
  requireActiveUser,
  requireRole,
  type AuthorizedUser,
} from "./lib/authorization";
import { normalizeText } from "./lib/orderValidation";

const operationalRoles = [
  "receptionist",
  "purchasing_agent",
  "admin",
  "super_admin",
] as const;

function stateError(entity: string, status?: string) {
  throw new ConvexError({
    code: "STATE_CHANGED",
    message: status
      ? `${entity} is currently ${status.replaceAll("_", " ")}`
      : `${entity} is no longer available`,
  });
}

function requiredText(value: string, label: string, max: number) {
  const normalized = normalizeText(value, max);
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function canReadOrder(actor: AuthorizedUser, order: any) {
  const role = effectiveRole(actor);
  return (
    role === "overlord" ||
    operationalRoles.includes(role as (typeof operationalRoles)[number]) ||
    order.requestedForUserId === actor._id ||
    order.createdByUserId === actor._id
  );
}

function canReadInternal(actor: AuthorizedUser) {
  const role = effectiveRole(actor);
  return (
    role === "overlord" ||
    operationalRoles.includes(role as (typeof operationalRoles)[number])
  );
}

function requireAssignedAgent(actor: AuthorizedUser, order: any) {
  const role = effectiveRole(actor);
  if (role === "overlord") return;
  if (role !== "purchasing_agent" || order.assignedAgentId !== actor._id) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Only the assigned purchasing agent can perform this action",
    });
  }
}

async function recordStatus(
  ctx: any,
  actor: AuthorizedUser,
  input: {
    orderId: any;
    itemId?: any;
    entityType: "order" | "order_item";
    command: string;
    fromStatus: string;
    toStatus: string;
    reason?: string;
  },
) {
  await ctx.db.insert("statusEvents", {
    ...input,
    actorUserId: actor._id,
    createdAt: Date.now(),
  });
  await appendAuditEvent(ctx, actor, {
    action: `${input.entityType}.${input.command}`,
    entityType: input.entityType,
    entityId: String(input.itemId ?? input.orderId),
    reason: input.reason,
    priorValues: { status: input.fromStatus },
    newValues: { status: input.toStatus },
  });
}

async function transitionOrder(
  ctx: any,
  actor: AuthorizedUser,
  order: any,
  command: string,
  toStatus: string,
  reason?: string,
) {
  const now = Date.now();
  await ctx.db.patch(order._id, { status: toStatus, updatedAt: now });
  await recordStatus(ctx, actor, {
    orderId: order._id,
    entityType: "order",
    command,
    fromStatus: order.status,
    toStatus,
    reason,
  });
}

async function transitionItem(
  ctx: any,
  actor: AuthorizedUser,
  item: any,
  command: string,
  toStatus: string,
  reason?: string,
  values: Record<string, unknown> = {},
) {
  await ctx.db.patch(item._id, {
    ...values,
    status: toStatus,
    updatedAt: Date.now(),
  });
  await recordStatus(ctx, actor, {
    orderId: item.orderId,
    itemId: item._id,
    entityType: "order_item",
    command,
    fromStatus: item.status,
    toStatus,
    reason,
  });
}

async function getAssignedOrderAndItem(
  ctx: any,
  actor: AuthorizedUser,
  itemId: any,
) {
  const item = await ctx.db.get(itemId);
  if (!item) stateError("Item");
  const order = await ctx.db.get(item.orderId);
  if (!order) stateError("Order");
  requireAssignedAgent(actor, order);
  return { order, item };
}

async function derivePurchaseOrderStatus(
  ctx: any,
  actor: AuthorizedUser,
  order: any,
) {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order_display_order", (query: any) =>
      query.eq("orderId", order._id),
    )
    .collect();
  const fulfillable = items.filter(
    (item: any) => !["unavailable", "cancelled"].includes(item.status),
  );
  const allPurchased =
    fulfillable.length > 0 &&
    fulfillable.every(
      (item: any) => (item.purchasedQuantity ?? 0) >= item.quantity,
    );
  const anyResolved = items.some(
    (item: any) =>
      (item.purchasedQuantity ?? 0) > 0 || item.status === "unavailable",
  );
  const nextStatus = allPurchased
    ? "purchased"
    : anyResolved
      ? "partially_fulfilled"
      : "purchasing";
  if (order.status !== nextStatus) {
    await transitionOrder(
      ctx,
      actor,
      order,
      "derive_from_purchase",
      nextStatus,
    );
  }
  return nextStatus;
}

export const workspace = queryGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || !canReadOrder(actor, order)) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Order not found" });
    }
    const [items, comments, transactions, allocations, users] =
      await Promise.all([
        ctx.db
          .query("orderItems")
          .withIndex("by_order_display_order", (query: any) =>
            query.eq("orderId", args.orderId),
          )
          .collect(),
        ctx.db
          .query("orderComments")
          .withIndex("by_order_created_at", (query: any) =>
            query.eq("orderId", args.orderId),
          )
          .collect(),
        ctx.db
          .query("purchaseTransactions")
          .withIndex("by_order_purchased_at", (query: any) =>
            query.eq("orderId", args.orderId),
          )
          .collect(),
        ctx.db
          .query("purchaseAllocations")
          .withIndex("by_order", (query: any) =>
            query.eq("orderId", args.orderId),
          )
          .collect(),
        ctx.db.query("users").take(100),
      ]);
    const userNames = new Map(
      users.map((user: any) => [
        user._id,
        user.isProtectedPrincipal && !actor.isProtectedPrincipal
          ? "System Administrator"
          : user.displayName,
      ]),
    );
    const internalVisible = canReadInternal(actor);
    const visibleComments = comments
      .filter((comment: any) => comment.channel === "shared" || internalVisible)
      .map((comment: any) => ({
        id: comment._id,
        channel: comment.channel,
        body: comment.body,
        author: userNames.get(comment.authorUserId) ?? "Unavailable user",
        createdAt: comment.createdAt,
      }));
    const allocationsByTransaction = new Map<string, any[]>();
    for (const allocation of allocations) {
      const current =
        allocationsByTransaction.get(allocation.transactionId) ?? [];
      current.push(allocation);
      allocationsByTransaction.set(allocation.transactionId, current);
    }
    const itemNames = new Map(items.map((item: any) => [item._id, item.name]));
    const hydratedTransactions = await Promise.all(
      transactions.map(async (transaction: any) => ({
        id: transaction._id,
        vendor: transaction.vendor,
        purchasedAt: transaction.purchasedAt,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        purchasingAgent:
          userNames.get(transaction.purchasingAgentId) ?? "Unavailable user",
        receiptNumber: transaction.receiptNumber,
        notes: transaction.notes,
        hasReceipt: Boolean(transaction.receiptStorageId),
        usedProofException: Boolean(transaction.proofExceptionReason),
        receiptUrl:
          transaction.receiptStorageId && internalVisible
            ? await ctx.storage.getUrl(transaction.receiptStorageId)
            : null,
        allocations: (allocationsByTransaction.get(transaction._id) ?? []).map(
          (allocation: any) => ({
            itemId: allocation.itemId,
            itemName: itemNames.get(allocation.itemId) ?? "Unavailable item",
            quantity: allocation.quantity,
            amountMinor: allocation.amountMinor,
          }),
        ),
      })),
    );
    const actualAmountMinor = transactions.reduce(
      (sum: number, transaction: any) => sum + transaction.amountMinor,
      0,
    );
    const role = effectiveRole(actor);
    const isAssigned =
      role === "overlord" ||
      (role === "purchasing_agent" && order.assignedAgentId === actor._id);
    return {
      order: {
        id: order._id,
        status: order.status,
        currency: order.currency,
        estimatedAmountMinor: order.estimatedAmountMinor,
        billingResponsibility: order.billingResponsibility,
        clientBillingReference: order.clientBillingReference,
      },
      items,
      comments: visibleComments,
      transactions: hydratedTransactions,
      summary: {
        estimatedAmountMinor: order.estimatedAmountMinor,
        actualAmountMinor,
        varianceMinor: actualAmountMinor - order.estimatedAmountMinor,
      },
      permissions: {
        canProcess: isAssigned,
        canCommentShared: true,
        canCommentInternal: internalVisible,
        canUseProofException: role === "super_admin" || role === "overlord",
      },
    };
  },
});

export const addComment = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    channel: v.union(v.literal("shared"), v.literal("internal")),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || !canReadOrder(actor, order)) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Order not found" });
    }
    if (args.channel === "internal" && !canReadInternal(actor)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
    }
    const body = requiredText(args.body, "Comment", 2_000);
    const commentId = await ctx.db.insert("orderComments", {
      orderId: args.orderId,
      authorUserId: actor._id,
      channel: args.channel,
      body,
      createdAt: Date.now(),
    });
    await appendAuditEvent(ctx, actor, {
      action: `order_comment.${args.channel}_created`,
      entityType: "order_comment",
      entityId: commentId,
      newValues: { orderId: args.orderId, channel: args.channel },
    });
    return commentId;
  },
});

export const startReview = mutationGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "assigned")
      stateError("Order", order?.status);
    requireAssignedAgent(actor, order);
    await transitionOrder(ctx, actor, order, "start_review", "in_review");
    return { status: "in_review" as const };
  },
});

export const beginItemReview = mutationGeneric({
  args: { itemId: v.id("orderItems") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (order.status !== "in_review" || item.status !== "requested")
      stateError("Item", item.status);
    await transitionItem(ctx, actor, item, "begin_review", "under_review");
    return { status: "under_review" as const };
  },
});

export const requestItemInformation = mutationGeneric({
  args: { itemId: v.id("orderItems"), question: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (order.status !== "in_review") stateError("Order", order.status);
    if (!["requested", "under_review"].includes(item.status))
      stateError("Item", item.status);
    const question = requiredText(args.question, "Information request", 1_000);
    await transitionItem(
      ctx,
      actor,
      item,
      "request_information",
      "information_needed",
      question,
    );
    if (order.status !== "waiting_for_requester") {
      await transitionOrder(
        ctx,
        actor,
        order,
        "request_information",
        "waiting_for_requester",
        question,
      );
    }
    await ctx.db.patch(order._id, { hasMissingInformation: true });
    await ctx.db.insert("orderComments", {
      orderId: order._id,
      authorUserId: actor._id,
      channel: "shared",
      body: question,
      createdAt: Date.now(),
    });
    return { status: "information_needed" as const };
  },
});

export const resumeItemReview = mutationGeneric({
  args: { itemId: v.id("orderItems") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (order.status !== "waiting_for_requester")
      stateError("Order", order.status);
    if (item.status !== "information_needed") stateError("Item", item.status);
    await transitionItem(ctx, actor, item, "resume_review", "under_review");
    const siblings = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (query: any) =>
        query.eq("orderId", order._id),
      )
      .collect();
    if (
      !siblings.some(
        (sibling: any) =>
          sibling._id !== item._id && sibling.status === "information_needed",
      )
    ) {
      await ctx.db.patch(order._id, { hasMissingInformation: false });
      if (order.status === "waiting_for_requester") {
        await transitionOrder(
          ctx,
          actor,
          order,
          "information_acknowledged",
          "in_review",
        );
      }
    }
    return { status: "under_review" as const };
  },
});

export const approveItem = mutationGeneric({
  args: { itemId: v.id("orderItems") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (order.status !== "in_review" || item.status !== "under_review")
      stateError("Item", item.status);
    await transitionItem(ctx, actor, item, "approve", "approved");
    return { status: "approved" as const };
  },
});

export const markUnavailable = mutationGeneric({
  args: { itemId: v.id("orderItems"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (order.status !== "in_review") stateError("Order", order.status);
    if (!["under_review", "approved"].includes(item.status))
      stateError("Item", item.status);
    const reason = requiredText(args.reason, "Unavailable reason", 1_000);
    await transitionItem(
      ctx,
      actor,
      item,
      "mark_unavailable",
      "unavailable",
      reason,
      {
        unavailableReason: reason,
      },
    );
    return { status: "unavailable" as const };
  },
});

export const recordSubstitution = mutationGeneric({
  args: {
    itemId: v.id("orderItems"),
    description: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (order.status !== "in_review") stateError("Order", order.status);
    if (!["under_review", "approved"].includes(item.status))
      stateError("Item", item.status);
    if (!item.substitutionAllowed && effectiveRole(actor) !== "overlord") {
      throw new ConvexError({
        code: "SUBSTITUTION_NOT_ALLOWED",
        message: "Requester did not allow substitutions",
      });
    }
    const description = requiredText(args.description, "Substitution", 1_000);
    const reason = requiredText(args.reason, "Substitution reason", 1_000);
    await transitionItem(
      ctx,
      actor,
      item,
      "substitute",
      "substituted",
      reason,
      {
        substitutionDescription: description,
      },
    );
    return { status: "substituted" as const };
  },
});

export const approveForPurchase = mutationGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "in_review")
      stateError("Order", order?.status);
    requireAssignedAgent(actor, order);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (query: any) =>
        query.eq("orderId", order._id),
      )
      .collect();
    if (
      !items.length ||
      items.some(
        (item: any) =>
          !["approved", "substituted", "unavailable"].includes(item.status),
      )
    ) {
      throw new ConvexError({
        code: "ITEM_REVIEW_INCOMPLETE",
        message: "Resolve every item before approving purchasing",
      });
    }
    await transitionOrder(
      ctx,
      actor,
      order,
      "approve_purchasing",
      "approved_to_purchase",
    );
    return { status: "approved_to_purchase" as const };
  },
});

export const beginPurchasing = mutationGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "approved_to_purchase")
      stateError("Order", order?.status);
    requireAssignedAgent(actor, order);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (query: any) =>
        query.eq("orderId", order._id),
      )
      .collect();
    for (const item of items) {
      if (item.status === "approved") {
        await transitionItem(ctx, actor, item, "order", "ordered");
      }
    }
    await transitionOrder(ctx, actor, order, "begin_purchase", "purchasing");
    const status = await derivePurchaseOrderStatus(ctx, actor, {
      ...order,
      status: "purchasing",
    });
    return { status };
  },
});

export const generateReceiptUploadUrl = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    requireRole(await requireActiveUser(ctx), [
      "purchasing_agent",
      "super_admin",
    ]);
    return ctx.storage.generateUploadUrl();
  },
});

export const recordPurchase = mutationGeneric({
  args: {
    orderId: v.id("orders"),
    vendor: v.string(),
    purchasedAt: v.number(),
    amountMinor: v.number(),
    currency: v.string(),
    receiptStorageId: v.optional(v.id("_storage")),
    receiptFileName: v.optional(v.string()),
    receiptNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    proofExceptionReason: v.optional(v.string()),
    allocations: v.array(
      v.object({
        itemId: v.id("orderItems"),
        quantity: v.number(),
        amountMinor: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || !["purchasing", "partially_fulfilled"].includes(order.status))
      stateError("Order", order?.status);
    const role = effectiveRole(actor);
    const exceptionReason = normalizeText(
      args.proofExceptionReason ?? "",
      1_000,
    );
    if (role === "super_admin") {
      if (!exceptionReason) {
        throw new ConvexError({
          code: "PROOF_REQUIRED",
          message: "A proof exception requires a reason",
        });
      }
    } else {
      requireAssignedAgent(actor, order);
    }
    const vendor = requiredText(args.vendor, "Vendor", 160);
    if (
      !Number.isFinite(args.purchasedAt) ||
      args.purchasedAt <= 0 ||
      args.purchasedAt > Date.now() + 300_000
    )
      throw new Error("Purchase date and time is invalid");
    if (!Number.isSafeInteger(args.amountMinor) || args.amountMinor < 0)
      throw new Error("Purchase amount is invalid");
    if (normalizeText(args.currency, 3).toUpperCase() !== order.currency)
      throw new Error("Purchase currency must match the order currency");
    if (!args.allocations.length)
      throw new Error("Allocate the purchase to at least one item");
    const allocationTotal = args.allocations.reduce((sum, allocation) => {
      if (
        !Number.isSafeInteger(allocation.amountMinor) ||
        allocation.amountMinor < 0 ||
        !Number.isFinite(allocation.quantity) ||
        allocation.quantity <= 0
      )
        throw new Error("Purchase allocation is invalid");
      return sum + allocation.amountMinor;
    }, 0);
    if (!Number.isSafeInteger(allocationTotal))
      throw new Error("Allocation total is too large");
    if (allocationTotal !== args.amountMinor)
      throw new Error("Allocation amounts must equal the transaction amount");

    const priorTransactions = await ctx.db
      .query("purchaseTransactions")
      .withIndex("by_order_purchased_at", (query: any) =>
        query.eq("orderId", order._id),
      )
      .collect();
    const resultingOrderTotal = priorTransactions.reduce(
      (sum: number, transaction: any) => sum + transaction.amountMinor,
      args.amountMinor,
    );
    if (!Number.isSafeInteger(resultingOrderTotal))
      throw new Error("Order purchase total is too large");

    let receiptMetadata: any = null;
    if (args.receiptStorageId) {
      const [existingReceipt, existingAttachment] = await Promise.all([
        ctx.db
          .query("purchaseTransactions")
          .withIndex("by_receipt_storage_id", (query: any) =>
            query.eq("receiptStorageId", args.receiptStorageId),
          )
          .unique(),
        ctx.db
          .query("attachments")
          .withIndex("by_storage_id", (query: any) =>
            query.eq("storageId", args.receiptStorageId),
          )
          .unique(),
      ]);
      if (existingReceipt || existingAttachment)
        throw new Error("Receipt upload has already been used");
      receiptMetadata = await ctx.db.system.get(args.receiptStorageId);
      if (!receiptMetadata) throw new Error("Receipt upload was not found");
      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];
      if (!allowed.includes(receiptMetadata.contentType ?? ""))
        throw new Error("Receipt must be a JPEG, PNG, WebP, or PDF file");
      if (receiptMetadata.size < 1 || receiptMetadata.size > 8 * 1024 * 1024)
        throw new Error("Receipt must be 8 MB or smaller");
    } else if (
      !exceptionReason ||
      !["super_admin", "overlord"].includes(role)
    ) {
      throw new ConvexError({
        code: "PROOF_REQUIRED",
        message: "Receipt proof is required to finalize a purchase",
      });
    }

    const itemUpdates: Array<{
      item: any;
      quantity: number;
      amountMinor: number;
    }> = [];
    const seen = new Set<string>();
    for (const allocation of args.allocations) {
      if (seen.has(allocation.itemId))
        throw new Error("An item may appear only once per transaction");
      seen.add(allocation.itemId);
      const item = await ctx.db.get(allocation.itemId);
      if (!item || item.orderId !== order._id)
        throw new Error("Purchase item does not belong to this order");
      if (!["ordered", "approved", "substituted"].includes(item.status))
        stateError("Item", item.status);
      const priorAllocations = await ctx.db
        .query("purchaseAllocations")
        .withIndex("by_item", (query: any) => query.eq("itemId", item._id))
        .collect();
      const priorQuantity = priorAllocations.reduce(
        (sum: number, prior: any) => sum + prior.quantity,
        0,
      );
      if (priorQuantity + allocation.quantity > item.quantity)
        throw new Error("Purchased quantity exceeds the requested quantity");
      itemUpdates.push({ item, ...allocation });
    }

    const now = Date.now();
    const transactionId = await ctx.db.insert("purchaseTransactions", {
      orderId: order._id,
      vendor,
      purchasedAt: args.purchasedAt,
      amountMinor: args.amountMinor,
      currency: order.currency,
      purchasingAgentId: actor._id,
      receiptStorageId: args.receiptStorageId,
      receiptFileName: args.receiptStorageId
        ? requiredText(
            args.receiptFileName ?? "receipt",
            "Receipt filename",
            240,
          )
        : undefined,
      receiptMediaType: receiptMetadata?.contentType,
      receiptByteSize: receiptMetadata?.size,
      receiptNumber: normalizeText(args.receiptNumber ?? "", 120) || undefined,
      notes: normalizeText(args.notes ?? "", 1_000) || undefined,
      proofExceptionReason: exceptionReason || undefined,
      status: "finalized",
      createdAt: now,
      updatedAt: now,
    });
    for (const update of itemUpdates) {
      await ctx.db.insert("purchaseAllocations", {
        transactionId,
        orderId: order._id,
        itemId: update.item._id,
        quantity: update.quantity,
        amountMinor: update.amountMinor,
        createdAt: now,
      });
      const purchasedQuantity =
        (update.item.purchasedQuantity ?? 0) + update.quantity;
      const actualAmountMinor =
        (update.item.actualAmountMinor ?? 0) + update.amountMinor;
      if (!Number.isSafeInteger(actualAmountMinor))
        throw new Error("Item purchase total is too large");
      const nextStatus =
        update.item.status === "substituted"
          ? "substituted"
          : purchasedQuantity >= update.item.quantity
            ? "purchased"
            : "ordered";
      await transitionItem(
        ctx,
        actor,
        update.item,
        "record_purchase",
        nextStatus,
        undefined,
        { purchasedQuantity, actualAmountMinor },
      );
    }
    await appendAuditEvent(ctx, actor, {
      action: exceptionReason
        ? "purchase.finalized_with_proof_exception"
        : "purchase.finalized",
      entityType: "purchase_transaction",
      entityId: transactionId,
      reason: exceptionReason || undefined,
      newValues: {
        orderId: order._id,
        amountMinor: args.amountMinor,
        currency: order.currency,
        allocationCount: args.allocations.length,
        hasReceipt: Boolean(args.receiptStorageId),
      },
    });
    const status = await derivePurchaseOrderStatus(ctx, actor, order);
    return { transactionId, status };
  },
});

export const dispatchItem = mutationGeneric({
  args: { itemId: v.id("orderItems") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const { order, item } = await getAssignedOrderAndItem(
      ctx,
      actor,
      args.itemId,
    );
    if (!["purchased", "partially_fulfilled"].includes(order.status))
      stateError("Order", order.status);
    if (
      !["purchased", "substituted"].includes(item.status) ||
      (item.purchasedQuantity ?? 0) <= 0
    )
      stateError("Item", item.status);
    await transitionItem(ctx, actor, item, "dispatch", "in_transit");
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (query: any) =>
        query.eq("orderId", order._id),
      )
      .collect();
    const allPurchasedItemsDispatched = items
      .filter((candidate: any) => (candidate.purchasedQuantity ?? 0) > 0)
      .every(
        (candidate: any) =>
          candidate._id === item._id || candidate.status === "in_transit",
      );
    if (order.status === "purchased" && allPurchasedItemsDispatched) {
      await transitionOrder(ctx, actor, order, "dispatch", "in_transit");
      return {
        itemStatus: "in_transit" as const,
        orderStatus: "in_transit" as const,
      };
    }
    return { itemStatus: "in_transit" as const, orderStatus: order.status };
  },
});

export const dispatchOrder = mutationGeneric({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "purchased")
      stateError("Order", order?.status);
    requireAssignedAgent(actor, order);
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order_display_order", (query: any) =>
        query.eq("orderId", order._id),
      )
      .collect();
    const purchasedItems = items.filter(
      (item: any) => (item.purchasedQuantity ?? 0) > 0,
    );
    if (
      !purchasedItems.length ||
      purchasedItems.some(
        (item: any) =>
          !["purchased", "substituted", "in_transit"].includes(item.status) ||
          (item.purchasedQuantity ?? 0) < item.quantity,
      )
    ) {
      throw new ConvexError({
        code: "PURCHASE_INCOMPLETE",
        message: "Every purchased item must be finalized before delivery",
      });
    }
    for (const item of purchasedItems) {
      if (item.status !== "in_transit") {
        await transitionItem(ctx, actor, item, "dispatch", "in_transit");
      }
    }
    await transitionOrder(ctx, actor, order, "dispatch", "in_transit");
    return { status: "in_transit" as const };
  },
});
