import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedProcessing() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role] of [
      ["requester", "requester"],
      ["agent", "purchasing_agent"],
      ["other-agent", "purchasing_agent"],
      ["reception", "receptionist"],
      ["admin", "admin"],
      ["super", "super_admin"],
    ] as const) {
      users[subject] = await ctx.db.insert("users", {
        clerkUserId: subject,
        displayName: subject,
        normalizedEmail: `${subject}@example.test`,
        role,
        isProtectedPrincipal: false,
        isActive: true,
        timezone: "America/Panama",
        createdAt: now,
        updatedAt: now,
      });
    }
    const categoryId = await ctx.db.insert("categories", {
      name: "Food Delivery",
      normalizedName: "food delivery",
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const locationId = await ctx.db.insert("locations", {
      name: "Main Office",
      timezone: "America/Panama",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "PH-2026-PHASE4",
      requesterUserId: users.requester,
      createdByUserId: users.requester,
      requestedForUserId: users.requester,
      billingResponsibility: "client",
      clientBillingReference: "Client A",
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      purpose: "Phase 4 test",
      locationId,
      requiredAt: now + 86_400_000,
      displayTimezone: "America/Panama",
      submittedAt: now,
      earliestCompliantAt: now,
      isLate: false,
      estimatedAmountMinor: 10_000,
      currency: "USD",
      assignedAgentId: users.agent,
      assignedAt: now,
      status: "assigned",
      createdAt: now,
      updatedAt: now,
    });
    const itemA = await ctx.db.insert("orderItems", {
      orderId,
      name: "Coffee",
      specification: "Dark roast",
      quantity: 2,
      unit: "bags",
      estimatedAmountMinor: 6_000,
      substitutionAllowed: true,
      displayOrder: 0,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
    const itemB = await ctx.db.insert("orderItems", {
      orderId,
      name: "Cups",
      specification: "Compostable",
      quantity: 1,
      unit: "case",
      estimatedAmountMinor: 4_000,
      substitutionAllowed: false,
      displayOrder: 1,
      status: "requested",
      createdAt: now,
      updatedAt: now,
    });
    return { users, orderId, itemA, itemB };
  });
  return { t, ...ids };
}

async function preparePurchasing(t: any, orderId: any, itemIds: any[]) {
  const agent = t.withIdentity({ subject: "agent" });
  await agent.mutation(api.processing.startReview, { orderId });
  for (const itemId of itemIds) {
    await agent.mutation(api.processing.beginItemReview, { itemId });
    await agent.mutation(api.processing.approveItem, { itemId });
  }
  await agent.mutation(api.processing.approveForPurchase, { orderId });
  await agent.mutation(api.processing.beginPurchasing, { orderId });
  return agent;
}

describe("Phase 4 controlled processing", () => {
  it("enforces assigned-agent and listed transition boundaries with audit events", async () => {
    const { t, orderId, itemA } = await seedProcessing();
    await expect(
      t
        .withIdentity({ subject: "other-agent" })
        .mutation(api.processing.startReview, { orderId }),
    ).rejects.toThrow(/assigned purchasing agent/);
    const agent = t.withIdentity({ subject: "agent" });
    await agent.mutation(api.processing.startReview, { orderId });
    await expect(
      agent.mutation(api.processing.approveItem, { itemId: itemA }),
    ).rejects.toThrow(/currently requested/);
    await agent.mutation(api.processing.beginItemReview, { itemId: itemA });
    await agent.mutation(api.processing.approveItem, { itemId: itemA });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      item: await ctx.db.get(itemA),
      statuses: await ctx.db.query("statusEvents").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect(state.order?.status).toBe("in_review");
    expect(state.item?.status).toBe("approved");
    expect(state.statuses.map((event) => event.command)).toEqual([
      "start_review",
      "begin_review",
      "approve",
    ]);
    expect(state.audits).toHaveLength(3);
  });

  it("isolates internal notes while keeping shared comments visible", async () => {
    const { t, orderId } = await seedProcessing();
    const agent = t.withIdentity({ subject: "agent" });
    const requester = t.withIdentity({ subject: "requester" });
    await agent.mutation(api.processing.addComment, {
      orderId,
      channel: "shared",
      body: "Please confirm the color",
    });
    await agent.mutation(api.processing.addComment, {
      orderId,
      channel: "internal",
      body: "Vendor may be delayed",
    });
    await expect(
      requester.mutation(api.processing.addComment, {
        orderId,
        channel: "internal",
        body: "hidden attempt",
      }),
    ).rejects.toThrow(/Access denied/);
    const requesterView = await requester.query(api.processing.workspace, {
      orderId,
    });
    const adminView = await t
      .withIdentity({ subject: "admin" })
      .query(api.processing.workspace, { orderId });
    expect(requesterView.comments.map((comment) => comment.channel)).toEqual([
      "shared",
    ]);
    expect(adminView.comments.map((comment) => comment.channel)).toEqual([
      "shared",
      "internal",
    ]);
  });

  it("tracks information requests, substitutions, and unavailable outcomes independently", async () => {
    const { t, orderId, itemA, itemB } = await seedProcessing();
    const agent = t.withIdentity({ subject: "agent" });
    await agent.mutation(api.processing.startReview, { orderId });
    await agent.mutation(api.processing.beginItemReview, { itemId: itemA });
    await agent.mutation(api.processing.requestItemInformation, {
      itemId: itemA,
      question: "Which roast is acceptable?",
    });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      itemA: await ctx.db.get(itemA),
    }));
    expect(state.order).toMatchObject({
      status: "waiting_for_requester",
      hasMissingInformation: true,
    });
    expect(state.itemA?.status).toBe("information_needed");
    await t
      .withIdentity({ subject: "requester" })
      .mutation(api.processing.addComment, {
        orderId,
        channel: "shared",
        body: "Medium roast is acceptable.",
      });
    await agent.mutation(api.processing.resumeItemReview, { itemId: itemA });
    await agent.mutation(api.processing.recordSubstitution, {
      itemId: itemA,
      description: "Medium roast replacement",
      reason: "Requested roast is unavailable",
    });
    await agent.mutation(api.processing.beginItemReview, { itemId: itemB });
    await expect(
      agent.mutation(api.processing.recordSubstitution, {
        itemId: itemB,
        description: "Plastic cups",
        reason: "Compostable cups unavailable",
      }),
    ).rejects.toThrow(/did not allow substitutions/);
    await agent.mutation(api.processing.markUnavailable, {
      itemId: itemB,
      reason: "No approved vendor has this item",
    });
    const finalState = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      itemA: await ctx.db.get(itemA),
      itemB: await ctx.db.get(itemB),
    }));
    expect(finalState.order).toMatchObject({
      status: "in_review",
      hasMissingInformation: false,
    });
    expect(finalState.itemA).toMatchObject({
      status: "substituted",
      substitutionDescription: "Medium roast replacement",
    });
    expect(finalState.itemB).toMatchObject({
      status: "unavailable",
      unavailableReason: "No approved vendor has this item",
    });
  });

  it("requires proof, reconciles allocations, and derives partial then purchased", async () => {
    const { t, orderId, itemA, itemB } = await seedProcessing();
    const agent = await preparePurchasing(t, orderId, [itemA, itemB]);
    await expect(
      agent.mutation(api.processing.recordPurchase, {
        orderId,
        vendor: "Supply Co",
        purchasedAt: Date.now(),
        amountMinor: 3_000,
        currency: "USD",
        allocations: [{ itemId: itemA, quantity: 1, amountMinor: 3_000 }],
      }),
    ).rejects.toThrow(/Receipt proof is required/);
    const superAdmin = t.withIdentity({ subject: "super" });
    await expect(
      superAdmin.mutation(api.processing.recordPurchase, {
        orderId,
        vendor: "Supply Co",
        purchasedAt: Date.now(),
        amountMinor: 3_000,
        currency: "USD",
        proofExceptionReason: "Test-only proof exception",
        allocations: [{ itemId: itemA, quantity: 1, amountMinor: 2_999 }],
      }),
    ).rejects.toThrow(/equal the transaction amount/);
    const partial = await superAdmin.mutation(api.processing.recordPurchase, {
      orderId,
      vendor: "Supply Co",
      purchasedAt: Date.now(),
      amountMinor: 3_000,
      currency: "USD",
      proofExceptionReason: "Test-only proof exception",
      allocations: [{ itemId: itemA, quantity: 1, amountMinor: 3_000 }],
    });
    expect(partial.status).toBe("partially_fulfilled");
    await expect(
      agent.mutation(api.processing.dispatchOrder, { orderId }),
    ).rejects.toThrow(/partially fulfilled/);
    const complete = await superAdmin.mutation(api.processing.recordPurchase, {
      orderId,
      vendor: "Supply Co",
      purchasedAt: Date.now(),
      amountMinor: 6_500,
      currency: "USD",
      proofExceptionReason: "Test-only proof exception",
      allocations: [
        { itemId: itemA, quantity: 1, amountMinor: 3_500 },
        { itemId: itemB, quantity: 1, amountMinor: 3_000 },
      ],
    });
    expect(complete.status).toBe("purchased");
    const workspace = await agent.query(api.processing.workspace, { orderId });
    expect(workspace.transactions).toHaveLength(2);
    expect(workspace.summary).toEqual({
      estimatedAmountMinor: 10_000,
      actualAmountMinor: 9_500,
      varianceMinor: -500,
    });
    expect(workspace.transactions[1].allocations).toHaveLength(2);
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      itemA: await ctx.db.get(itemA),
      itemB: await ctx.db.get(itemB),
      allocations: await ctx.db.query("purchaseAllocations").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect(state.order?.status).toBe("purchased");
    expect(state.itemA).toMatchObject({
      status: "purchased",
      purchasedQuantity: 2,
      actualAmountMinor: 6_500,
    });
    expect(state.itemB).toMatchObject({
      status: "purchased",
      purchasedQuantity: 1,
      actualAmountMinor: 3_000,
    });
    expect(state.allocations).toHaveLength(3);
    expect(
      state.audits.some(
        (event) => event.action === "purchase.finalized_with_proof_exception",
      ),
    ).toBe(true);
    await agent.mutation(api.processing.dispatchOrder, { orderId });
    const dispatched = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      items: await ctx.db
        .query("orderItems")
        .withIndex("by_order_display_order", (query) =>
          query.eq("orderId", orderId),
        )
        .collect(),
    }));
    expect(dispatched.order?.status).toBe("in_transit");
    expect(dispatched.items.every((item) => item.status === "in_transit")).toBe(
      true,
    );
  });

  it("allows only privileged, reasoned receipt-proof exceptions", async () => {
    const { t, orderId, itemA, itemB } = await seedProcessing();
    await preparePurchasing(t, orderId, [itemA, itemB]);
    await expect(
      t
        .withIdentity({ subject: "other-agent" })
        .mutation(api.processing.recordPurchase, {
          orderId,
          vendor: "Unauthorized Vendor",
          purchasedAt: Date.now(),
          amountMinor: 1_000,
          currency: "USD",
          allocations: [{ itemId: itemA, quantity: 1, amountMinor: 1_000 }],
        }),
    ).rejects.toThrow(/assigned purchasing agent/);
    const superAdmin = t.withIdentity({ subject: "super" });
    await expect(
      superAdmin.mutation(api.processing.recordPurchase, {
        orderId,
        vendor: "Emergency Vendor",
        purchasedAt: Date.now(),
        amountMinor: 1_000,
        currency: "USD",
        allocations: [{ itemId: itemA, quantity: 1, amountMinor: 1_000 }],
      }),
    ).rejects.toThrow(/exception requires a reason/);
    await superAdmin.mutation(api.processing.recordPurchase, {
      orderId,
      vendor: "Emergency Vendor",
      purchasedAt: Date.now(),
      amountMinor: 1_000,
      currency: "USD",
      proofExceptionReason: "Vendor portal was unavailable; receipt requested",
      allocations: [{ itemId: itemA, quantity: 1, amountMinor: 1_000 }],
    });
    const audits = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.at(-2)?.action).toBe(
      "purchase.finalized_with_proof_exception",
    );
    expect(audits.at(-2)?.reason).toMatch(/portal/);
  });

  it("records multiple vendors and proofs against the same item", async () => {
    const { t, orderId, itemA, itemB } = await seedProcessing();
    await preparePurchasing(t, orderId, [itemA, itemB]);
    const superAdmin = t.withIdentity({ subject: "super" });
    for (const [vendor, amountMinor] of [
      ["Vendor One", 2_500],
      ["Vendor Two", 3_500],
    ] as const) {
      await superAdmin.mutation(api.processing.recordPurchase, {
        orderId,
        vendor,
        purchasedAt: Date.now(),
        amountMinor,
        currency: "USD",
        proofExceptionReason: `Test proof for ${vendor}`,
        allocations: [{ itemId: itemA, quantity: 1, amountMinor }],
      });
    }
    const workspace = await superAdmin.query(api.processing.workspace, {
      orderId,
    });
    const itemPurchases = workspace.transactions.filter((transaction) =>
      transaction.allocations.some((allocation) => allocation.itemId === itemA),
    );
    expect(itemPurchases.map((transaction) => transaction.vendor)).toEqual([
      "Vendor One",
      "Vendor Two",
    ]);
    expect(
      itemPurchases.every(
        (transaction) =>
          transaction.allocations.length === 1 &&
          transaction.allocations[0].itemId === itemA,
      ),
    ).toBe(true);
  });
});
