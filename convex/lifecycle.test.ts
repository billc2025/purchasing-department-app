import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedLifecycle(status = "in_transit") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role] of [
      ["requester", "requester"],
      ["reception", "receptionist"],
      ["agent", "purchasing_agent"],
      ["other-agent", "purchasing_agent"],
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
      name: "Events",
      normalizedName: "events",
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const locationId = await ctx.db.insert("locations", {
      name: "Reception",
      timezone: "America/Panama",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "PH-2026-PHASE5",
      requesterUserId: users.requester,
      createdByUserId: users.requester,
      requestedForUserId: users.requester,
      billingResponsibility: "internal",
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      purpose: "Phase 5 test",
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
      status: status as any,
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
      status: "in_transit",
      purchasedQuantity: 2,
      actualAmountMinor: 6_000,
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
      status: "in_transit",
      purchasedQuantity: 1,
      actualAmountMinor: 4_000,
      createdAt: now,
      updatedAt: now,
    });
    return { users, orderId, itemA, itemB, locationId };
  });
  return { t, ...ids };
}

describe("Phase 5 receiving and lifecycle", () => {
  it("records partial receipt and derives received only after every item arrives", async () => {
    const { t, orderId, itemA, itemB, locationId } = await seedLifecycle();
    const reception = t.withIdentity({ subject: "reception" });
    const partial = await reception.mutation(api.lifecycle.recordReceipt, {
      orderId,
      itemId: itemA,
      quantity: 1,
      receivedAt: Date.now(),
      locationId,
    });
    expect(partial).toEqual({
      itemStatus: "partially_fulfilled",
      orderStatus: "partially_fulfilled",
    });
    await reception.mutation(api.lifecycle.recordReceipt, {
      orderId,
      itemId: itemA,
      quantity: 1,
      receivedAt: Date.now(),
      locationId,
      notes: "Second bag arrived",
    });
    const complete = await reception.mutation(api.lifecycle.recordReceipt, {
      orderId,
      itemId: itemB,
      quantity: 1,
      receivedAt: Date.now(),
      locationId,
    });
    expect(complete.orderStatus).toBe("received");
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      itemA: await ctx.db.get(itemA),
      events: await ctx.db.query("receivingEvents").collect(),
      notifications: await ctx.db.query("notifications").collect(),
    }));
    expect(state.order?.status).toBe("received");
    expect(state.itemA).toMatchObject({
      status: "received",
      receivedQuantity: 2,
    });
    expect(state.events).toHaveLength(3);
    expect(state.notifications).toHaveLength(1);
  });

  it("rejects excess receipt and unauthorized receiving", async () => {
    const { t, orderId, itemA, locationId } = await seedLifecycle();
    await expect(
      t
        .withIdentity({ subject: "requester" })
        .mutation(api.lifecycle.recordReceipt, {
          orderId,
          itemId: itemA,
          quantity: 1,
          receivedAt: Date.now(),
          locationId,
        }),
    ).rejects.toThrow(/Access denied/);
    await expect(
      t
        .withIdentity({ subject: "reception" })
        .mutation(api.lifecycle.recordReceipt, {
          orderId,
          itemId: itemA,
          quantity: 3,
          receivedAt: Date.now(),
          locationId,
        }),
    ).rejects.toThrow(/exceeds/);
  });

  it("requires requester confirmation for ordinary completion and keeps issues open", async () => {
    const { t, orderId } = await seedLifecycle("received");
    await expect(
      t
        .withIdentity({ subject: "reception" })
        .mutation(api.lifecycle.confirmReceipt, {
          orderId,
          outcome: "correct",
        }),
    ).rejects.toThrow(/requester/);
    await expect(
      t
        .withIdentity({ subject: "requester" })
        .mutation(api.lifecycle.confirmReceipt, {
          orderId,
          outcome: "damaged",
        }),
    ).rejects.toThrow(/details/);
    const result = await t
      .withIdentity({ subject: "requester" })
      .mutation(api.lifecycle.confirmReceipt, {
        orderId,
        outcome: "damaged",
        details: "Coffee bags were torn",
      });
    expect(result.status).toBe("receipt_issue_reported");
  });

  it("completes on requester confirmation and audits privileged override reasons", async () => {
    const normal = await seedLifecycle("received");
    await normal.t
      .withIdentity({ subject: "requester" })
      .mutation(api.lifecycle.confirmReceipt, {
        orderId: normal.orderId,
        outcome: "correct",
      });
    expect(
      (await normal.t.run((ctx) => ctx.db.get(normal.orderId)))?.status,
    ).toBe("completed");

    const privileged = await seedLifecycle("received");
    await expect(
      privileged.t
        .withIdentity({ subject: "super" })
        .mutation(api.lifecycle.confirmReceipt, {
          orderId: privileged.orderId,
          outcome: "correct",
        }),
    ).rejects.toThrow(/Override reason/);
    await privileged.t
      .withIdentity({ subject: "super" })
      .mutation(api.lifecycle.confirmReceipt, {
        orderId: privileged.orderId,
        outcome: "correct",
        overrideReason: "Requester confirmed by signed delivery form",
      });
    const confirmations = await privileged.t.run((ctx) =>
      ctx.db.query("receiptConfirmations").collect(),
    );
    expect(confirmations[0]).toMatchObject({ isPrivilegedOverride: true });
  });

  it("preserves original values in a decided material change request", async () => {
    const { t, orderId } = await seedLifecycle("assigned");
    const changeId = await t
      .withIdentity({ subject: "requester" })
      .mutation(api.lifecycle.requestChange, {
        orderId,
        purpose: "Updated event purpose",
        reason: "Client changed the event format",
      });
    await expect(
      t
        .withIdentity({ subject: "admin" })
        .mutation(api.lifecycle.decideChange, {
          changeRequestId: changeId,
          approve: true,
          reason: "Approved",
        }),
    ).rejects.toThrow(/Access denied/);
    await t
      .withIdentity({ subject: "super" })
      .mutation(api.lifecycle.decideChange, {
        changeRequestId: changeId,
        approve: true,
        reason: "Operationally feasible",
      });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      request: await ctx.db.get(changeId),
    }));
    expect(state.order?.purpose).toBe("Updated event purpose");
    expect(state.request?.originalValues).toMatchObject({
      purpose: "Phase 5 test",
    });
  });

  it("enforces the configured direct-edit cutoff", async () => {
    const { t, orderId, users } = await seedLifecycle("unassigned");
    await t.run(async (ctx) => {
      await ctx.db.patch(orderId, { requiredAt: Date.now() + 30 * 60_000 });
      await ctx.db.insert("systemSettings", {
        key: "material_change_cutoff_minutes",
        version: 1,
        value: { minutes: 60 },
        isActive: true,
        createdBy: users.super,
        createdAt: Date.now(),
      });
    });
    await expect(
      t
        .withIdentity({ subject: "requester" })
        .mutation(api.lifecycle.updateUnassignedOrder, {
          orderId,
          purpose: "Too-late change",
        }),
    ).rejects.toThrow(/configured direct-edit cutoff/);
  });

  it("restricts and records late-exception decisions", async () => {
    const { t, orderId } = await seedLifecycle("exception_pending");
    await t.run((ctx) =>
      ctx.db.patch(orderId, {
        isLate: true,
        earliestCompliantAt: Date.now() + 60_000,
      }),
    );
    await expect(
      t
        .withIdentity({ subject: "admin" })
        .mutation(api.lifecycle.decideLateException, {
          orderId,
          approve: true,
          reason: "Approve",
        }),
    ).rejects.toThrow(/Access denied/);
    const result = await t
      .withIdentity({ subject: "super" })
      .mutation(api.lifecycle.decideLateException, {
        orderId,
        approve: false,
        reason: "Insufficient operational notice",
      });
    expect(result.status).toBe("rejected");
  });

  it("routes a budget exception only from an actual recorded overage", async () => {
    const { t, orderId, users } = await seedLifecycle("purchased");
    await expect(
      t
        .withIdentity({ subject: "agent" })
        .mutation(api.lifecycle.routeBudgetException, {
          orderId,
          reason: "No overage yet",
        }),
    ).rejects.toThrow(/No existing budget overage/);
    await t.run((ctx) =>
      ctx.db.insert("purchaseTransactions", {
        orderId,
        vendor: "Vendor",
        purchasedAt: Date.now(),
        amountMinor: 12_000,
        currency: "USD",
        purchasingAgentId: users.agent,
        proofExceptionReason: "Test",
        status: "finalized",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const exceptionId = await t
      .withIdentity({ subject: "agent" })
      .mutation(api.lifecycle.routeBudgetException, {
        orderId,
        reason: "Recorded purchase exceeds approved budget",
      });
    await t
      .withIdentity({ subject: "super" })
      .mutation(api.lifecycle.decideBudgetException, {
        exceptionRequestId: exceptionId,
        approve: false,
        reason: "Use alternate vendor",
      });
    expect((await t.run((ctx) => ctx.db.get(exceptionId)))?.status).toBe(
      "rejected",
    );
  });

  it("requires a cancellation request after assignment and restores state on rejection", async () => {
    const { t, orderId } = await seedLifecycle("assigned");
    const request = await t
      .withIdentity({ subject: "requester" })
      .mutation(api.lifecycle.requestCancellation, {
        orderId,
        reason: "Event was postponed",
      });
    expect(request.status).toBe("cancellation_requested");
    await t
      .withIdentity({ subject: "super" })
      .mutation(api.lifecycle.decideCancellation, {
        cancellationRequestId: request.requestId!,
        approve: false,
        reason: "Event is still scheduled",
        outcomes: [],
      });
    expect((await t.run((ctx) => ctx.db.get(orderId)))?.status).toBe(
      "assigned",
    );
  });

  it("requires explicit outcomes for every purchased item before cancellation", async () => {
    const { t, orderId, itemA, itemB } = await seedLifecycle("in_transit");
    const request = await t
      .withIdentity({ subject: "requester" })
      .mutation(api.lifecycle.requestCancellation, {
        orderId,
        reason: "Event was cancelled",
      });
    const superAdmin = t.withIdentity({ subject: "super" });
    await expect(
      superAdmin.mutation(api.lifecycle.decideCancellation, {
        cancellationRequestId: request.requestId!,
        approve: true,
        reason: "Approved cancellation",
        outcomes: [{ itemId: itemA, outcome: "returned" }],
      }),
    ).rejects.toThrow(/Every purchased item/);
    await superAdmin.mutation(api.lifecycle.decideCancellation, {
      cancellationRequestId: request.requestId!,
      approve: true,
      reason: "Approved after vendor coordination",
      outcomes: [
        { itemId: itemA, outcome: "returned" },
        { itemId: itemB, outcome: "non_refundable" },
      ],
    });
    const outcomes = await t.run((ctx) =>
      ctx.db.query("cancellationItemOutcomes").collect(),
    );
    expect(outcomes).toHaveLength(2);
    expect((await t.run((ctx) => ctx.db.get(orderId)))?.status).toBe(
      "cancelled",
    );
  });
});
