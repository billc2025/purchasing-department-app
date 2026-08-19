import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { normalizeText } from "./lib/orderValidation";
import { requireActiveUser, requireRole } from "./lib/authorization";

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
