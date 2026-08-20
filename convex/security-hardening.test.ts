import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const originalOverlord = process.env.OVERLORD_CLERK_USER_ID;

afterEach(() => {
  if (originalOverlord === undefined) delete process.env.OVERLORD_CLERK_USER_ID;
  else process.env.OVERLORD_CLERK_USER_ID = originalOverlord;
});

async function seedSecurity() {
  process.env.OVERLORD_CLERK_USER_ID = "owner";
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role, protectedPrincipal] of [
      ["owner", "super_admin", true],
      ["admin", "admin", false],
      ["agent", "purchasing_agent", false],
      ["requester", "requester", false],
    ] as const)
      users[subject] = await ctx.db.insert("users", {
        clerkUserId: subject,
        displayName: protectedPrincipal ? "Secret Owner Name" : subject,
        normalizedEmail: `${subject}@example.test`,
        role,
        isProtectedPrincipal: protectedPrincipal,
        isActive: true,
        timezone: "America/Panama",
        createdAt: now,
        updatedAt: now,
      });
    const categoryId = await ctx.db.insert("categories", {
      name: "Events",
      normalizedName: "events",
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
    const common = {
      billingResponsibility: "internal" as const,
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      locationId,
      requiredAt: now + 86_400_000,
      displayTimezone: "America/Panama",
      earliestCompliantAt: now,
      isLate: false,
      estimatedAmountMinor: 1000,
      currency: "USD",
      createdAt: now,
      updatedAt: now,
    };
    const protectedOrderId = await ctx.db.insert("orders", {
      ...common,
      orderNumber: "PH-SECRET",
      requesterUserId: users.owner,
      createdByUserId: users.owner,
      requestedForUserId: users.owner,
      purpose: "Protected order",
      status: "received",
      submittedAt: now,
      assignedAgentId: users.owner,
    });
    const ordinaryOrderId = await ctx.db.insert("orders", {
      ...common,
      orderNumber: "PH-ORDINARY",
      requesterUserId: users.requester,
      createdByUserId: users.requester,
      requestedForUserId: users.requester,
      purpose: "Ordinary draft",
      status: "draft",
    });
    const foreignItemId = await ctx.db.insert("orderItems", {
      orderId: protectedOrderId,
      name: "Foreign item",
      specification: "Test",
      quantity: 1,
      unit: "each",
      estimatedAmountMinor: 1000,
      substitutionAllowed: false,
      displayOrder: 0,
      status: "received",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("receiptConfirmations", {
      orderId: protectedOrderId,
      confirmerUserId: users.owner,
      outcome: "correct",
      isPrivilegedOverride: false,
      createdAt: now,
    });
    const storageId = await ctx.storage.store(
      new Blob(["image"], { type: "image/png" }),
    );
    return {
      users,
      protectedOrderId,
      ordinaryOrderId,
      foreignItemId,
      storageId,
    };
  });
  return { t, ...ids };
}

describe("Phase 8 authorization and concealment regressions", () => {
  it("conceals protected identity names and IDs from operational views", async () => {
    const { t, protectedOrderId } = await seedSecurity();
    const admin = t.withIdentity({ subject: "admin" });
    const detail = await admin.query(api.orders.detail, {
      orderId: protectedOrderId,
    });
    expect(detail.requestedForName).toBe("System Administrator");
    expect(detail.requestedForUserId).toBeUndefined();
    expect(detail.createdByUserId).toBeUndefined();
    const bucket = await admin.query(api.purchasing.listBucket, {
      filter: "all_active",
      offset: 0,
      limit: 25,
      todayStart: 0,
      todayEnd: Date.now() + 86_400_000,
    });
    expect(JSON.stringify(bucket)).not.toContain("Secret Owner Name");
    const lifecycle = await admin.query(api.lifecycle.workspace, {
      orderId: protectedOrderId,
    });
    expect(lifecycle.confirmations[0].confirmerUserId).toBeUndefined();
  });

  it("rejects guessed protected user IDs in configuration", async () => {
    const { t, users } = await seedSecurity();
    await expect(
      t
        .withIdentity({ subject: "admin" })
        .mutation(api.configuration.saveBudgetAllocation, {
          scopeType: "user",
          userId: users.owner,
          name: "Forbidden",
          amountMinor: 1000,
          currency: "USD",
        }),
    ).rejects.toThrow("User not found");
  });

  it("rejects an item ID belonging to another order during attachment", async () => {
    const { t, ordinaryOrderId, foreignItemId, storageId } =
      await seedSecurity();
    await expect(
      t
        .withIdentity({ subject: "requester" })
        .mutation(api.orders.attachReferenceImage, {
          orderId: ordinaryOrderId,
          itemId: foreignItemId,
          storageId,
          fileName: "test.png",
        }),
    ).rejects.toThrow("Order item not found");
  });
});
