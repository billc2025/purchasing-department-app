import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const visibleRoleValidator = v.union(
  v.literal("requester"),
  v.literal("receptionist"),
  v.literal("purchasing_agent"),
  v.literal("admin"),
  v.literal("super_admin"),
);

export const orderStatusValidator = v.union(
  v.literal("draft"),
  v.literal("pending_approval"),
  v.literal("unassigned"),
  v.literal("assigned"),
  v.literal("in_review"),
  v.literal("waiting_for_requester"),
  v.literal("approved_to_purchase"),
  v.literal("purchasing"),
  v.literal("partially_fulfilled"),
  v.literal("purchased"),
  v.literal("in_transit"),
  v.literal("received"),
  v.literal("ready_for_reception"),
  v.literal("completed"),
  v.literal("exception_pending"),
  v.literal("receipt_issue_reported"),
  v.literal("cancellation_requested"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

export const billingResponsibilityValidator = v.union(
  v.literal("client"),
  v.literal("internal"),
);

export const itemStatusValidator = v.union(
  v.literal("requested"),
  v.literal("under_review"),
  v.literal("information_needed"),
  v.literal("approved"),
  v.literal("ordered"),
  v.literal("purchased"),
  v.literal("substituted"),
  v.literal("in_transit"),
  v.literal("partially_fulfilled"),
  v.literal("received"),
  v.literal("unavailable"),
  v.literal("cancelled"),
  v.literal("returned"),
  v.literal("refunded"),
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    displayName: v.string(),
    normalizedEmail: v.string(),
    role: visibleRoleValidator,
    isProtectedPrincipal: v.boolean(),
    isActive: v.boolean(),
    departmentId: v.optional(v.id("departments")),
    locationId: v.optional(v.id("locations")),
    timezone: v.string(),
    preferredLanguage: v.optional(v.union(v.literal("en"), v.literal("es"))),
    deactivatedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_active_role", ["isActive", "role"])
    .index("by_department_active", ["departmentId", "isActive"])
    .index("by_normalized_email", ["normalizedEmail"]),

  departments: defineTable({
    name: v.string(),
    code: v.string(),
    costCenterReference: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active_name", ["isActive", "name"])
    .index("by_code", ["code"]),

  locations: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    instructions: v.optional(v.string()),
    timezone: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_active_name", ["isActive", "name"]),

  categories: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    normalizedName: v.string(),
    displayOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active_display_order", ["isActive", "displayOrder"])
    .index("by_normalized_name", ["normalizedName"]),

  categoryRules: defineTable({
    categoryId: v.id("categories"),
    version: v.number(),
    leadTimeValue: v.number(),
    leadTimeUnit: v.union(
      v.literal("minutes"),
      v.literal("hours"),
      v.literal("days"),
    ),
    normalizedLeadTimeMinutes: v.number(),
    effectiveFrom: v.number(),
    effectiveUntil: v.optional(v.number()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category_active", ["categoryId", "isActive"])
    .index("by_category_effective_from", ["categoryId", "effectiveFrom"]),

  orders: defineTable({
    orderNumber: v.string(),
    requesterUserId: v.id("users"),
    createdByUserId: v.id("users"),
    requestedForUserId: v.id("users"),
    departmentId: v.optional(v.id("departments")),
    costCenterSnapshot: v.optional(v.string()),
    billingResponsibility: billingResponsibilityValidator,
    clientBillingReference: v.optional(v.string()),
    billingNotes: v.optional(v.string()),
    categoryId: v.id("categories"),
    categoryRuleVersion: v.number(),
    leadTimeMinutesSnapshot: v.number(),
    purpose: v.string(),
    locationId: v.id("locations"),
    deliveryInstructions: v.optional(v.string()),
    requiredAt: v.number(),
    displayTimezone: v.string(),
    submittedAt: v.optional(v.number()),
    earliestCompliantAt: v.number(),
    isLate: v.boolean(),
    estimatedAmountMinor: v.number(),
    currency: v.string(),
    comments: v.optional(v.string()),
    assignedAgentId: v.optional(v.id("users")),
    assignedAt: v.optional(v.number()),
    hasMissingInformation: v.optional(v.boolean()),
    status: orderStatusValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_number", ["orderNumber"])
    .index("by_requester_created_at", ["requesterUserId", "createdAt"])
    .index("by_requested_for_created_at", ["requestedForUserId", "createdAt"])
    .index("by_status_required_at", ["status", "requiredAt"])
    .index("by_assignee_status_required_at", [
      "assignedAgentId",
      "status",
      "requiredAt",
    ])
    .index("by_required_at", ["requiredAt"]),

  assignmentEvents: defineTable({
    orderId: v.id("orders"),
    fromAgentId: v.optional(v.id("users")),
    toAgentId: v.optional(v.id("users")),
    action: v.union(
      v.literal("claimed"),
      v.literal("released"),
      v.literal("reassigned"),
      v.literal("cleared_on_cancel"),
    ),
    actorUserId: v.id("users"),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order_created_at", ["orderId", "createdAt"])
    .index("by_agent_created_at", ["toAgentId", "createdAt"]),

  orderApprovalDecisions: defineTable({
    orderId: v.id("orders"),
    reviewerUserId: v.id("users"),
    decision: v.union(
      v.literal("approved"),
      v.literal("returned"),
      v.literal("rejected"),
    ),
    reason: v.string(),
    wasLate: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_order_created_at", ["orderId", "createdAt"])
    .index("by_reviewer_created_at", ["reviewerUserId", "createdAt"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    name: v.string(),
    specification: v.string(),
    quantity: v.number(),
    unit: v.string(),
    preferredVendor: v.optional(v.string()),
    estimatedAmountMinor: v.number(),
    substitutionAllowed: v.boolean(),
    notes: v.optional(v.string()),
    displayOrder: v.number(),
    status: itemStatusValidator,
    purchasedQuantity: v.optional(v.number()),
    receivedQuantity: v.optional(v.number()),
    actualAmountMinor: v.optional(v.number()),
    substitutionDescription: v.optional(v.string()),
    unavailableReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_display_order", ["orderId", "displayOrder"])
    .index("by_order_status", ["orderId", "status"]),

  orderComments: defineTable({
    orderId: v.id("orders"),
    authorUserId: v.id("users"),
    channel: v.union(v.literal("shared"), v.literal("internal")),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_order_created_at", ["orderId", "createdAt"]),

  purchaseTransactions: defineTable({
    orderId: v.id("orders"),
    vendor: v.string(),
    purchasedAt: v.number(),
    amountMinor: v.number(),
    currency: v.string(),
    purchasingAgentId: v.id("users"),
    receiptStorageId: v.optional(v.id("_storage")),
    receiptFileName: v.optional(v.string()),
    receiptMediaType: v.optional(v.string()),
    receiptByteSize: v.optional(v.number()),
    receiptNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    proofExceptionReason: v.optional(v.string()),
    status: v.literal("finalized"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order_purchased_at", ["orderId", "purchasedAt"])
    .index("by_agent_purchased_at", ["purchasingAgentId", "purchasedAt"])
    .index("by_receipt_storage_id", ["receiptStorageId"]),

  purchaseAllocations: defineTable({
    transactionId: v.id("purchaseTransactions"),
    orderId: v.id("orders"),
    itemId: v.id("orderItems"),
    quantity: v.number(),
    amountMinor: v.number(),
    createdAt: v.number(),
  })
    .index("by_transaction", ["transactionId"])
    .index("by_item", ["itemId"])
    .index("by_order", ["orderId"]),

  receivingEvents: defineTable({
    orderId: v.id("orders"),
    itemId: v.id("orderItems"),
    receiverUserId: v.id("users"),
    receivedAt: v.number(),
    locationId: v.id("locations"),
    quantity: v.number(),
    notes: v.optional(v.string()),
    evidenceStorageId: v.optional(v.id("_storage")),
    evidenceFileName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order_received_at", ["orderId", "receivedAt"])
    .index("by_item_received_at", ["itemId", "receivedAt"])
    .index("by_receiver_received_at", ["receiverUserId", "receivedAt"]),

  receiptConfirmations: defineTable({
    orderId: v.id("orders"),
    confirmerUserId: v.id("users"),
    outcome: v.union(
      v.literal("correct"),
      v.literal("missing"),
      v.literal("incorrect"),
      v.literal("damaged"),
      v.literal("incomplete"),
    ),
    details: v.optional(v.string()),
    isPrivilegedOverride: v.boolean(),
    overrideReason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order_created_at", ["orderId", "createdAt"])
    .index("by_requester_created_at", ["confirmerUserId", "createdAt"])
    .index("by_outcome_created_at", ["outcome", "createdAt"]),

  changeRequests: defineTable({
    orderId: v.id("orders"),
    requesterUserId: v.id("users"),
    originalValues: v.any(),
    requestedValues: v.any(),
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    decisionMakerUserId: v.optional(v.id("users")),
    decisionReason: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_order_created_at", ["orderId", "createdAt"])
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_requester_created_at", ["requesterUserId", "createdAt"]),

  exceptionRequests: defineTable({
    orderId: v.id("orders"),
    type: v.union(v.literal("late"), v.literal("budget")),
    triggerSnapshot: v.any(),
    requesterUserId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    decisionMakerUserId: v.optional(v.id("users")),
    decisionReason: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_order_type", ["orderId", "type"])
    .index("by_decider_created_at", ["decisionMakerUserId", "createdAt"]),

  cancellationRequests: defineTable({
    orderId: v.id("orders"),
    requesterUserId: v.id("users"),
    priorStatus: orderStatusValidator,
    reason: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    decisionMakerUserId: v.optional(v.id("users")),
    decisionReason: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_order_created_at", ["orderId", "createdAt"])
    .index("by_status_created_at", ["status", "createdAt"])
    .index("by_requester_created_at", ["requesterUserId", "createdAt"]),

  cancellationItemOutcomes: defineTable({
    cancellationRequestId: v.id("cancellationRequests"),
    orderId: v.id("orders"),
    itemId: v.id("orderItems"),
    outcome: v.union(
      v.literal("returned"),
      v.literal("refunded"),
      v.literal("retained"),
      v.literal("non_refundable"),
    ),
    amountMinor: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_request", ["cancellationRequestId"])
    .index("by_order", ["orderId"])
    .index("by_item", ["itemId"]),

  notifications: defineTable({
    userId: v.id("users"),
    orderId: v.id("orders"),
    type: v.string(),
    message: v.string(),
    link: v.string(),
    dedupeKey: v.string(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user_created_at", ["userId", "createdAt"])
    .index("by_user_dedupe", ["userId", "dedupeKey"])
    .index("by_order_created_at", ["orderId", "createdAt"]),

  budgetAllocations: defineTable({
    scopeType: v.union(
      v.literal("department"),
      v.literal("user"),
      v.literal("event"),
      v.literal("general"),
    ),
    name: v.string(),
    departmentId: v.optional(v.id("departments")),
    userId: v.optional(v.id("users")),
    eventReference: v.optional(v.string()),
    amountMinor: v.number(),
    currency: v.string(),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
    enforcementActive: v.literal(false),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_active", ["scopeType", "isActive"])
    .index("by_department_active", ["departmentId", "isActive"])
    .index("by_user_active", ["userId", "isActive"]),

  statusEvents: defineTable({
    orderId: v.id("orders"),
    itemId: v.optional(v.id("orderItems")),
    actorUserId: v.id("users"),
    entityType: v.union(v.literal("order"), v.literal("order_item")),
    command: v.string(),
    fromStatus: v.string(),
    toStatus: v.string(),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order_created_at", ["orderId", "createdAt"])
    .index("by_item_created_at", ["itemId", "createdAt"]),

  attachments: defineTable({
    orderId: v.id("orders"),
    itemId: v.optional(v.id("orderItems")),
    uploaderUserId: v.id("users"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mediaType: v.string(),
    byteSize: v.number(),
    purpose: v.literal("reference_image"),
    status: v.union(v.literal("active"), v.literal("removed")),
    createdAt: v.number(),
    removedAt: v.optional(v.number()),
  })
    .index("by_order_status", ["orderId", "status"])
    .index("by_item_status", ["itemId", "status"])
    .index("by_storage_id", ["storageId"]),

  auditEvents: defineTable({
    actorUserId: v.id("users"),
    actorIsProtected: v.boolean(),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    reason: v.optional(v.string()),
    priorValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
    correlationId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_entity_created_at", ["entityType", "entityId", "createdAt"])
    .index("by_actor_created_at", ["actorUserId", "createdAt"])
    .index("by_action_created_at", ["action", "createdAt"])
    .index("by_created_at", ["createdAt"]),

  systemSettings: defineTable({
    key: v.string(),
    version: v.number(),
    value: v.any(),
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_key_version", ["key", "version"])
    .index("by_key_active", ["key", "isActive"]),
});
