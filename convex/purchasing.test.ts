import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Role =
  "requester" | "receptionist" | "purchasing_agent" | "admin" | "super_admin";

async function seed(roleEntries: Array<[string, Role]>) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, string> = {};
    for (const [subject, role] of roleEntries) {
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
    const requesterUserId = users.requester ?? Object.values(users)[0];
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "PH-2026-TEST01",
      requesterUserId: requesterUserId as never,
      createdByUserId: requesterUserId as never,
      requestedForUserId: requesterUserId as never,
      billingResponsibility: "internal",
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      purpose: "Team lunch",
      locationId,
      requiredAt: now + 60_000,
      displayTimezone: "America/Panama",
      submittedAt: now,
      earliestCompliantAt: now,
      isLate: false,
      estimatedAmountMinor: 5_000,
      currency: "USD",
      status: "unassigned",
      createdAt: now,
      updatedAt: now,
    });
    return { users, orderId };
  });
  return { t, ...ids };
}

describe("purchasing assignment mutations", () => {
  it("allows exactly one concurrent self-claim and audits it", async () => {
    const { t, users, orderId } = await seed([
      ["requester", "requester"],
      ["agent-a", "purchasing_agent"],
      ["agent-b", "purchasing_agent"],
    ]);
    const results = await Promise.allSettled([
      t.withIdentity({ subject: "agent-a" }).mutation(api.purchasing.claim, {
        orderId,
      }),
      t.withIdentity({ subject: "agent-b" }).mutation(api.purchasing.claim, {
        orderId,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      assignments: await ctx.db.query("assignmentEvents").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect([users["agent-a"], users["agent-b"]]).toContain(
      state.order?.assignedAgentId,
    );
    expect(state.assignments).toHaveLength(1);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].action).toBe("order.claimed");
  });

  it("gives receptionists read-only bucket access", async () => {
    const { t, orderId } = await seed([
      ["requester", "requester"],
      ["reception", "receptionist"],
    ]);
    const reception = t.withIdentity({ subject: "reception" });
    const now = Date.now();
    const bucket = await reception.query(api.purchasing.listBucket, {
      filter: "unassigned",
      todayStart: now - 86_400_000,
      todayEnd: now + 86_400_000,
    });
    expect(bucket.permissions.readOnly).toBe(true);
    expect(bucket.rows).toHaveLength(1);
    await expect(
      reception.mutation(api.purchasing.claim, { orderId }),
    ).rejects.toThrow(/Access denied/);
  });

  it("requires a reason for release and records append-only history", async () => {
    const { t, orderId } = await seed([
      ["requester", "requester"],
      ["agent", "purchasing_agent"],
      ["other-agent", "purchasing_agent"],
    ]);
    const agent = t.withIdentity({ subject: "agent" });
    await agent.mutation(api.purchasing.claim, { orderId });
    await expect(
      t
        .withIdentity({ subject: "other-agent" })
        .mutation(api.purchasing.release, {
          orderId,
          reason: "Not my assignment",
        }),
    ).rejects.toThrow(/assigned agent/);
    const now = Date.now();
    const assignedView = await agent.query(api.purchasing.listBucket, {
      filter: "assigned_to_me",
      todayStart: now - 86_400_000,
      todayEnd: now + 86_400_000,
    });
    expect(assignedView.rows.map((row) => row.id)).toEqual([orderId]);
    await expect(
      agent.mutation(api.purchasing.release, { orderId, reason: " " }),
    ).rejects.toThrow(/reason/i);
    await agent.mutation(api.purchasing.release, {
      orderId,
      reason: "Workload balancing",
    });
    const state = await t.run(async (ctx) => ({
      order: await ctx.db.get(orderId),
      assignments: await ctx.db.query("assignmentEvents").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect(state.order).toMatchObject({ status: "unassigned" });
    expect(state.order?.assignedAgentId).toBeUndefined();
    expect(state.assignments.map((event) => event.action)).toEqual([
      "claimed",
      "released",
    ]);
    expect(state.audits.at(-1)).toMatchObject({
      action: "order.released",
      reason: "Workload balancing",
    });
    const unassignedView = await agent.query(api.purchasing.listBucket, {
      filter: "unassigned",
      todayStart: now - 86_400_000,
      todayEnd: now + 86_400_000,
    });
    expect(unassignedView.rows.map((row) => row.id)).toEqual([orderId]);
  });

  it("allows only super admins to reassign to an active purchasing agent", async () => {
    const { t, users, orderId } = await seed([
      ["requester", "requester"],
      ["agent-a", "purchasing_agent"],
      ["agent-b", "purchasing_agent"],
      ["reception", "receptionist"],
      ["super", "super_admin"],
    ]);
    await t
      .withIdentity({ subject: "agent-a" })
      .mutation(api.purchasing.claim, { orderId });
    await expect(
      t.withIdentity({ subject: "agent-a" }).mutation(api.purchasing.reassign, {
        orderId,
        targetAgentId: users["agent-b"] as never,
        reason: "Coverage",
      }),
    ).rejects.toThrow(/Access denied/);
    await t
      .withIdentity({ subject: "super" })
      .mutation(api.purchasing.reassign, {
        orderId,
        targetAgentId: users["agent-b"] as never,
        reason: "Shift coverage",
      });
    const order = await t.run((ctx) => ctx.db.get(orderId));
    expect(order?.assignedAgentId).toBe(users["agent-b"]);
    await expect(
      t.withIdentity({ subject: "super" }).mutation(api.purchasing.reassign, {
        orderId,
        targetAgentId: users.reception as never,
        reason: "Invalid target",
      }),
    ).rejects.toThrow(/active purchasing agent/);
  });
});
