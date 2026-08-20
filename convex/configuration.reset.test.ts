import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const priorOverlord = process.env.OVERLORD_CLERK_USER_ID;
const priorReset = process.env.ALLOW_DEVELOPMENT_RESET;

afterEach(() => {
  if (priorOverlord === undefined) delete process.env.OVERLORD_CLERK_USER_ID;
  else process.env.OVERLORD_CLERK_USER_ID = priorOverlord;
  if (priorReset === undefined) delete process.env.ALLOW_DEVELOPMENT_RESET;
  else process.env.ALLOW_DEVELOPMENT_RESET = priorReset;
});

describe("development order reset", () => {
  it("requires the protected principal and phrase while preserving configuration", async () => {
    process.env.OVERLORD_CLERK_USER_ID = "overlord";
    process.env.ALLOW_DEVELOPMENT_RESET = "true";
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const now = Date.now();
      const overlordId = await ctx.db.insert("users", {
        clerkUserId: "overlord",
        displayName: "Protected owner",
        normalizedEmail: "owner@example.test",
        role: "super_admin",
        isProtectedPrincipal: true,
        isActive: true,
        timezone: "America/Panama",
        createdAt: now,
        updatedAt: now,
      });
      const requesterId = await ctx.db.insert("users", {
        clerkUserId: "requester",
        displayName: "Requester",
        normalizedEmail: "requester@example.test",
        role: "requester",
        isProtectedPrincipal: false,
        isActive: true,
        timezone: "America/Panama",
        createdAt: now,
        updatedAt: now,
      });
      const categoryId = await ctx.db.insert("categories", {
        name: "Test",
        normalizedName: "test",
        displayOrder: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const locationId = await ctx.db.insert("locations", {
        name: "Office",
        timezone: "America/Panama",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const orderId = await ctx.db.insert("orders", {
        orderNumber: "PH-RESET",
        requesterUserId: requesterId,
        createdByUserId: requesterId,
        requestedForUserId: requesterId,
        billingResponsibility: "internal",
        categoryId,
        categoryRuleVersion: 1,
        leadTimeMinutesSnapshot: 60,
        purpose: "Reset test",
        locationId,
        requiredAt: now + 60_000,
        displayTimezone: "America/Panama",
        earliestCompliantAt: now,
        isLate: false,
        estimatedAmountMinor: 100,
        currency: "USD",
        status: "unassigned",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("orderItems", {
        orderId,
        name: "Test item",
        specification: "Test",
        quantity: 1,
        unit: "each",
        estimatedAmountMinor: 100,
        substitutionAllowed: false,
        displayOrder: 0,
        status: "requested",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notifications", {
        userId: requesterId,
        orderId,
        type: "confirmation_required",
        message: "Test",
        createdAt: now,
      });
      await ctx.db.insert("auditEvents", {
        actorUserId: overlordId,
        actorIsProtected: true,
        action: "order.test",
        entityType: "order",
        entityId: orderId,
        createdAt: now,
      });
    });

    await expect(
      t
        .withIdentity({ subject: "requester" })
        .mutation(api.configuration.resetDevelopmentOrders, {
          confirmation: "DELETE TEST ORDERS",
        }),
    ).rejects.toThrow(/Access denied/);
    await expect(
      t
        .withIdentity({ subject: "overlord" })
        .mutation(api.configuration.resetDevelopmentOrders, {
          confirmation: "delete",
        }),
    ).rejects.toThrow(/does not match/);

    await t
      .withIdentity({ subject: "overlord" })
      .mutation(api.configuration.resetDevelopmentOrders, {
        confirmation: "DELETE TEST ORDERS",
      });
    const remaining = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      categories: await ctx.db.query("categories").collect(),
      locations: await ctx.db.query("locations").collect(),
      orders: await ctx.db.query("orders").collect(),
      items: await ctx.db.query("orderItems").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect(remaining.users).toHaveLength(2);
    expect(remaining.categories).toHaveLength(1);
    expect(remaining.locations).toHaveLength(1);
    expect(remaining.orders).toHaveLength(0);
    expect(remaining.items).toHaveLength(0);
    expect(remaining.notifications).toHaveLength(0);
    expect(remaining.audits).toHaveLength(0);
  });
});
