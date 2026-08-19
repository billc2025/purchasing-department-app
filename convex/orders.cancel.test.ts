import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const originalOverlordId = process.env.OVERLORD_CLERK_USER_ID;

afterEach(() => {
  if (originalOverlordId === undefined)
    delete process.env.OVERLORD_CLERK_USER_ID;
  else process.env.OVERLORD_CLERK_USER_ID = originalOverlordId;
});

describe("Overlord order cancellation", () => {
  it("cancels an assigned order, clears assignment, and preserves an audit trail", async () => {
    process.env.OVERLORD_CLERK_USER_ID = "overlord";
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
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
      const agentId = await ctx.db.insert("users", {
        clerkUserId: "agent",
        displayName: "Agent",
        normalizedEmail: "agent@example.test",
        role: "purchasing_agent",
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
        orderNumber: "PH-TEST-CANCEL",
        requesterUserId: requesterId,
        createdByUserId: requesterId,
        requestedForUserId: requesterId,
        billingResponsibility: "internal",
        categoryId,
        categoryRuleVersion: 1,
        leadTimeMinutesSnapshot: 60,
        purpose: "Cancellation test",
        locationId,
        requiredAt: now + 60_000,
        displayTimezone: "America/Panama",
        submittedAt: now,
        earliestCompliantAt: now,
        isLate: false,
        estimatedAmountMinor: 100,
        currency: "USD",
        assignedAgentId: agentId,
        assignedAt: now,
        status: "assigned",
        createdAt: now,
        updatedAt: now,
      });
      return { overlordId, requesterId, agentId, orderId };
    });

    await expect(
      t
        .withIdentity({ subject: "requester" })
        .mutation(api.orders.cancelByOverlord, {
          orderId: ids.orderId,
          reason: "Testing cancellation",
        }),
    ).rejects.toThrow(/Access denied/);

    await t
      .withIdentity({ subject: "overlord" })
      .mutation(api.orders.cancelByOverlord, {
        orderId: ids.orderId,
        reason: "Pre-production testing",
      });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(ids.orderId),
      assignments: await ctx.db.query("assignmentEvents").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect(state.order).toMatchObject({ status: "cancelled" });
    expect(state.order?.assignedAgentId).toBeUndefined();
    expect(state.assignments).toHaveLength(1);
    expect(state.assignments[0]).toMatchObject({
      action: "cleared_on_cancel",
      fromAgentId: ids.agentId,
      reason: "Pre-production testing",
    });
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: "order.cancelled_by_overlord",
      reason: "Pre-production testing",
    });
  });
});
