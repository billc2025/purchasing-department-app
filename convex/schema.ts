import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const visibleRoleValidator = v.union(
  v.literal("requester"),
  v.literal("receptionist"),
  v.literal("purchasing_agent"),
  v.literal("admin"),
  v.literal("super_admin"),
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
