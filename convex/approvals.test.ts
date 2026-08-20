import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const priorOverlord = process.env.OVERLORD_CLERK_USER_ID;
afterEach(() => {
  if (priorOverlord === undefined) delete process.env.OVERLORD_CLERK_USER_ID;
  else process.env.OVERLORD_CLERK_USER_ID = priorOverlord;
});

async function setup({ late = false, self = false } = {}) {
  process.env.OVERLORD_CLERK_USER_ID = "owner";
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role, protectedPrincipal] of [
      ["requester", "requester", false],
      ["agent", "purchasing_agent", false],
      ["super", "super_admin", false],
      ["owner", "super_admin", true],
    ] as const)
      users[subject] = await ctx.db.insert("users", {
        clerkUserId: subject,
        displayName: subject,
        normalizedEmail: `${subject}@test.dev`,
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
    const requesterUserId = self ? users.super : users.requester;
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "PH-APPROVAL",
      requesterUserId,
      createdByUserId: requesterUserId,
      requestedForUserId: requesterUserId,
      billingResponsibility: "internal",
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      purpose: "Approval test",
      locationId,
      requiredAt: now + 86_400_000,
      displayTimezone: "America/Panama",
      submittedAt: now,
      earliestCompliantAt: now + 60_000,
      isLate: late,
      estimatedAmountMinor: 5000,
      currency: "USD",
      status: "pending_approval",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("orderItems", {
      orderId,
      name: "Coffee",
      specification: "Test",
      quantity: 1,
      unit: "case",
      estimatedAmountMinor: 5000,
      substitutionAllowed: false,
      displayOrder: 0,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
    return { users, orderId };
  });
  return { t, ...ids };
}

describe("mandatory director approval gate", () => {
  it("keeps pending orders out of purchasing and rejects claims", async () => {
    const { t, orderId } = await setup();
    const bucket = await t
      .withIdentity({ subject: "agent" })
      .query(api.purchasing.listBucket, {
        filter: "all_active",
        offset: 0,
        limit: 25,
        todayStart: 0,
        todayEnd: Date.now() + 172_800_000,
      });
    expect(bucket.rows).toHaveLength(0);
    await expect(
      t
        .withIdentity({ subject: "agent" })
        .mutation(api.purchasing.claim, { orderId }),
    ).rejects.toThrow();
  });

  it("allows Super Admin approval and records a late exception in the same decision", async () => {
    const { t, orderId } = await setup({ late: true });
    await t.withIdentity({ subject: "super" }).mutation(api.approvals.decide, {
      orderId,
      decision: "approved",
      reason: "Details and budget verified",
    });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      decisions: await ctx.db.query("orderApprovalDecisions").collect(),
      exceptions: await ctx.db.query("exceptionRequests").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect((state.order as any).status).toBe("unassigned");
    expect(state.decisions[0].decision).toBe("approved");
    expect(state.exceptions[0]).toMatchObject({
      type: "late",
      status: "approved",
    });
    expect(
      state.audits.some((event) => event.action === "order_approval.approved"),
    ).toBe(true);
  });

  it("returns an order to an editable draft and prevents self-approval", async () => {
    const returned = await setup();
    await returned.t
      .withIdentity({ subject: "super" })
      .mutation(api.approvals.decide, {
        orderId: returned.orderId,
        decision: "returned",
        reason: "Correct the quantities",
      });
    const draft = await returned.t
      .withIdentity({ subject: "requester" })
      .query(api.orders.editableDraft, { orderId: returned.orderId });
    expect(draft.items).toHaveLength(1);
    const own = await setup({ self: true });
    await expect(
      own.t.withIdentity({ subject: "super" }).mutation(api.approvals.decide, {
        orderId: own.orderId,
        decision: "approved",
        reason: "Self approval attempt",
      }),
    ).rejects.toThrow("cannot approve your own order");
  });

  it("rejects approval by Admin and purchasing roles", async () => {
    const { t, orderId } = await setup();
    for (const subject of ["requester", "agent"])
      await expect(
        t.withIdentity({ subject }).mutation(api.approvals.decide, {
          orderId,
          decision: "approved",
          reason: "Unauthorized",
        }),
      ).rejects.toThrow();
  });
});
