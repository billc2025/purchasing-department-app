import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { normalizeText } from "./lib/orderValidation";
import { requireActiveUser, requireRole } from "./lib/authorization";

const receivingStatuses = [
  "purchasing",
  "purchased",
  "in_transit",
  "partially_fulfilled",
] as const;
const cancellationOutcomes = [
  "returned",
  "refunded",
  "retained",
  "non_refundable",
] as const;

async function activeSetting(ctx: any, key: string) {
  return ctx.db
    .query("systemSettings")
    .withIndex("by_key_active", (q: any) =>
      q.eq("key", key).eq("isActive", true),
    )
    .unique();
}

async function replaceSetting(ctx: any, actor: any, key: string, value: any) {
  const prior = await activeSetting(ctx, key);
  if (prior) await ctx.db.patch(prior._id, { isActive: false });
  const now = Date.now();
  const id = await ctx.db.insert("systemSettings", {
    key,
    version: (prior?.version ?? 0) + 1,
    value,
    isActive: true,
    createdBy: actor._id,
    createdAt: now,
  });
  await appendAuditEvent(ctx, actor, {
    action: "configuration.policy_updated",
    entityType: "system_setting",
    entityId: key,
    priorValues: prior?.value,
    newValues: value,
  });
  return id;
}

export const adminWorkspace = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = requireRole(await requireActiveUser(ctx), [
      "admin",
      "super_admin",
    ]);
    const [
      categories,
      rules,
      departments,
      locations,
      allocations,
      cutoff,
      statuses,
      outcomes,
    ] = await Promise.all([
      ctx.db.query("categories").take(200),
      ctx.db.query("categoryRules").take(300),
      ctx.db.query("departments").take(200),
      ctx.db.query("locations").take(200),
      ctx.db.query("budgetAllocations").take(200),
      activeSetting(ctx, "material_change_cutoff_minutes"),
      activeSetting(ctx, "receptionist_receiving_statuses"),
      activeSetting(ctx, "cancellation_outcomes"),
    ]);
    return {
      categories: categories.map((category: any) => ({
        ...category,
        rule: rules.find(
          (rule: any) => rule.categoryId === category._id && rule.isActive,
        ),
      })),
      departments,
      locations,
      policies: {
        editCutoffMinutes: cutoff?.value?.minutes ?? 30,
        receptionistStatuses: statuses?.value?.statuses ?? [
          ...receivingStatuses,
        ],
        cancellationOutcomes: outcomes?.value?.outcomes ?? [
          ...cancellationOutcomes,
        ],
      },
      budgetAllocations: allocations.map(
        ({ createdBy, userId, ...allocation }: any) => ({
          ...allocation,
          createdBy: actor.isProtectedPrincipal ? createdBy : undefined,
          userId: actor.isProtectedPrincipal ? userId : undefined,
        }),
      ),
      budgetEnforcementActive: false,
    };
  },
});

export const savePolicies = mutationGeneric({
  args: {
    editCutoffMinutes: v.number(),
    receptionistStatuses: v.array(v.string()),
    cancellationOutcomes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), [
      "admin",
      "super_admin",
    ]);
    if (
      !Number.isInteger(args.editCutoffMinutes) ||
      args.editCutoffMinutes < 0 ||
      args.editCutoffMinutes > 10080
    )
      throw new Error(
        "Edit cutoff must be a whole number from 0 to 10080 minutes",
      );
    if (
      !args.receptionistStatuses.length ||
      args.receptionistStatuses.some(
        (value) => !receivingStatuses.includes(value as any),
      )
    )
      throw new Error("Select at least one permitted receptionist status");
    if (
      !args.cancellationOutcomes.length ||
      args.cancellationOutcomes.some(
        (value) => !cancellationOutcomes.includes(value as any),
      )
    )
      throw new Error("Select at least one permitted cancellation outcome");
    await replaceSetting(ctx, actor, "material_change_cutoff_minutes", {
      minutes: args.editCutoffMinutes,
    });
    await replaceSetting(ctx, actor, "receptionist_receiving_statuses", {
      statuses: [...new Set(args.receptionistStatuses)],
    });
    await replaceSetting(ctx, actor, "cancellation_outcomes", {
      outcomes: [...new Set(args.cancellationOutcomes)],
    });
    return null;
  },
});

export const saveBudgetAllocation = mutationGeneric({
  args: {
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
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), [
      "admin",
      "super_admin",
    ]);
    const name = normalizeText(args.name, 120);
    if (!name) throw new Error("Allocation name is required");
    if (!Number.isInteger(args.amountMinor) || args.amountMinor < 0)
      throw new Error("Allocation amount is invalid");
    if (args.scopeType === "department" && !args.departmentId)
      throw new Error("A department is required");
    if (args.scopeType === "user" && !args.userId)
      throw new Error("A user is required");
    if (args.userId) {
      const target = await ctx.db.get(args.userId);
      if (
        !target ||
        !target.isActive ||
        (target.isProtectedPrincipal && !actor.isProtectedPrincipal)
      )
        throw new Error("User not found");
    }
    if (
      args.scopeType === "event" &&
      !normalizeText(args.eventReference ?? "", 120)
    )
      throw new Error("An event reference is required");
    const now = Date.now();
    const id = await ctx.db.insert("budgetAllocations", {
      ...args,
      name,
      eventReference:
        normalizeText(args.eventReference ?? "", 120) || undefined,
      notes: normalizeText(args.notes ?? "", 500) || undefined,
      currency: normalizeText(args.currency, 3).toUpperCase(),
      isActive: true,
      enforcementActive: false,
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "budget_allocation.created_inactive",
      entityType: "budget_allocation",
      entityId: String(id),
      newValues: {
        scopeType: args.scopeType,
        amountMinor: args.amountMinor,
        enforcementActive: false,
      },
    });
    return id;
  },
});

export const listOrderOptions = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    const [categories, departments, locations, rules] = await Promise.all([
      ctx.db
        .query("categories")
        .withIndex("by_active_display_order", (q: any) =>
          q.eq("isActive", true),
        )
        .take(100),
      ctx.db
        .query("departments")
        .withIndex("by_active_name", (q: any) => q.eq("isActive", true))
        .take(100),
      ctx.db
        .query("locations")
        .withIndex("by_active_name", (q: any) => q.eq("isActive", true))
        .take(100),
      ctx.db.query("categoryRules").take(200),
    ]);
    return {
      categories: categories
        .map((category) => {
          const rule = rules.find(
            (candidate) =>
              candidate.categoryId === category._id && candidate.isActive,
          );
          return {
            id: category._id,
            name: category.name,
            description: category.description,
            leadTimeValue: rule?.leadTimeValue,
            leadTimeUnit: rule?.leadTimeUnit,
            leadTimeMinutes: rule?.normalizedLeadTimeMinutes,
          };
        })
        .filter((category) => category.leadTimeMinutes !== undefined),
      departments: departments.map((department) => ({
        id: department._id,
        name: department.name,
        code: department.code,
        costCenterReference: department.costCenterReference,
      })),
      locations: locations.map((location) => ({
        id: location._id,
        name: location.name,
        timezone: location.timezone,
        instructions: location.instructions,
      })),
    };
  },
});

export const seedDevelopmentExamples = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveUser(ctx);
    requireRole(actor, ["admin", "super_admin"]);
    const now = Date.now();
    const examples = [
      {
        name: "Food Delivery",
        description: "Editable sample category",
        value: 1,
        unit: "hours" as const,
        minutes: 60,
      },
      {
        name: "Event Purchase",
        description: "Editable sample category",
        value: 3,
        unit: "days" as const,
        minutes: 4320,
      },
    ];
    for (const example of examples) {
      const normalizedName = example.name.toLowerCase();
      const category = await ctx.db
        .query("categories")
        .withIndex("by_normalized_name", (q: any) =>
          q.eq("normalizedName", normalizedName),
        )
        .unique();
      let categoryId = category?._id;
      if (!categoryId)
        categoryId = await ctx.db.insert("categories", {
          name: example.name,
          description: example.description,
          normalizedName,
          displayOrder: example.name === "Food Delivery" ? 10 : 20,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      const activeRule = await ctx.db
        .query("categoryRules")
        .withIndex("by_category_active", (q: any) =>
          q.eq("categoryId", categoryId).eq("isActive", true),
        )
        .unique();
      if (!activeRule)
        await ctx.db.insert("categoryRules", {
          categoryId,
          version: 1,
          leadTimeValue: example.value,
          leadTimeUnit: example.unit,
          normalizedLeadTimeMinutes: example.minutes,
          effectiveFrom: now,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
    }
    if (
      !(await ctx.db
        .query("departments")
        .withIndex("by_code", (q: any) => q.eq("code", "GENERAL"))
        .unique())
    )
      await ctx.db.insert("departments", {
        name: "General Operations",
        code: "GENERAL",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    if ((await ctx.db.query("locations").take(1)).length === 0)
      await ctx.db.insert("locations", {
        name: "Main Office",
        timezone: actor.timezone || "America/Panama",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    await appendAuditEvent(ctx, actor, {
      action: "configuration.samples_seeded",
      entityType: "configuration",
      entityId: "phase-2-samples",
      newValues: { samples: examples.map((example) => example.name) },
    });
    return null;
  },
});

export const resetDevelopmentOrders = mutationGeneric({
  args: { confirmation: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    if (!actor.isProtectedPrincipal) throw new Error("Access denied");
    if (process.env.ALLOW_DEVELOPMENT_RESET !== "true")
      throw new Error("Development reset is disabled for this deployment");
    if (args.confirmation !== "DELETE TEST ORDERS")
      throw new Error("Confirmation phrase does not match");

    const [attachments, transactions, receivingEvents] = await Promise.all([
      ctx.db.query("attachments").take(2_000),
      ctx.db.query("purchaseTransactions").take(2_000),
      ctx.db.query("receivingEvents").take(2_000),
    ]);
    const storageIds = new Set<string>();
    for (const attachment of attachments) storageIds.add(attachment.storageId);
    for (const transaction of transactions)
      if (transaction.receiptStorageId)
        storageIds.add(transaction.receiptStorageId);
    for (const event of receivingEvents)
      if (event.evidenceStorageId) storageIds.add(event.evidenceStorageId);
    for (const storageId of storageIds)
      await ctx.storage.delete(storageId as any);

    const operationalTables = [
      "cancellationItemOutcomes",
      "purchaseAllocations",
      "receiptConfirmations",
      "receivingEvents",
      "orderComments",
      "statusEvents",
      "assignmentEvents",
      "orderApprovalDecisions",
      "notifications",
      "changeRequests",
      "exceptionRequests",
      "cancellationRequests",
      "attachments",
      "purchaseTransactions",
      "orderItems",
      "orders",
      "auditEvents",
    ] as const;
    const deleted: Record<string, number> = {};
    for (const table of operationalTables) {
      const rows = await ctx.db.query(table).take(2_000);
      deleted[table] = rows.length;
      for (const row of rows) await ctx.db.delete(row._id);
    }
    return { deleted, deletedStorageObjects: storageIds.size };
  },
});

export const saveDepartment = mutationGeneric({
  args: {
    name: v.string(),
    code: v.string(),
    costCenterReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    requireRole(actor, ["admin", "super_admin"]);
    const now = Date.now();
    const id = await ctx.db.insert("departments", {
      name: normalizeText(args.name, 120),
      code: normalizeText(args.code, 30).toUpperCase(),
      costCenterReference:
        normalizeText(args.costCenterReference ?? "", 80) || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "department.created",
      entityType: "department",
      entityId: id,
    });
    return id;
  },
});

export const saveLocation = mutationGeneric({
  args: {
    name: v.string(),
    timezone: v.string(),
    address: v.optional(v.string()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    requireRole(actor, ["admin", "super_admin"]);
    const now = Date.now();
    const id = await ctx.db.insert("locations", {
      name: normalizeText(args.name, 120),
      timezone: normalizeText(args.timezone, 80),
      address: normalizeText(args.address ?? "", 300) || undefined,
      instructions: normalizeText(args.instructions ?? "", 500) || undefined,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "location.created",
      entityType: "location",
      entityId: id,
    });
    return id;
  },
});

export const saveCategory = mutationGeneric({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    leadTimeValue: v.number(),
    leadTimeUnit: v.union(
      v.literal("minutes"),
      v.literal("hours"),
      v.literal("days"),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    requireRole(actor, ["admin", "super_admin"]);
    if (!Number.isSafeInteger(args.leadTimeValue) || args.leadTimeValue < 0)
      throw new Error("Lead time must be a non-negative whole number");
    const multiplier =
      args.leadTimeUnit === "days"
        ? 1440
        : args.leadTimeUnit === "hours"
          ? 60
          : 1;
    const now = Date.now();
    const name = normalizeText(args.name, 120);
    const id = await ctx.db.insert("categories", {
      name,
      description: normalizeText(args.description ?? "", 500) || undefined,
      normalizedName: name.toLowerCase(),
      displayOrder: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("categoryRules", {
      categoryId: id,
      version: 1,
      leadTimeValue: args.leadTimeValue,
      leadTimeUnit: args.leadTimeUnit,
      normalizedLeadTimeMinutes: args.leadTimeValue * multiplier,
      effectiveFrom: now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "category.created",
      entityType: "category",
      entityId: id,
      newValues: {
        leadTimeValue: args.leadTimeValue,
        leadTimeUnit: args.leadTimeUnit,
      },
    });
    return id;
  },
});
