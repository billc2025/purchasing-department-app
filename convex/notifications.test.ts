import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { notifyUser } from "./lib/notifications";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role] of [
      ["requester", "requester"],
      ["other", "requester"],
      ["admin", "admin"],
      ["agent", "purchasing_agent"],
    ] as const)
      users[subject] = await ctx.db.insert("users", {
        clerkUserId: subject,
        displayName: subject,
        normalizedEmail: `${subject}@test.dev`,
        role,
        isProtectedPrincipal: false,
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
    const orderId = await ctx.db.insert("orders", {
      orderNumber: "PH-P7-1",
      requesterUserId: users.requester,
      createdByUserId: users.requester,
      requestedForUserId: users.requester,
      billingResponsibility: "internal",
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      purpose: "Deadline test",
      locationId,
      requiredAt: now - 1000,
      displayTimezone: "America/Panama",
      submittedAt: now,
      earliestCompliantAt: now,
      isLate: false,
      estimatedAmountMinor: 1000,
      currency: "USD",
      assignedAgentId: users.agent,
      status: "in_transit",
      createdAt: now,
      updatedAt: now,
    });
    return { users, orderId };
  });
  return { t, ...ids };
}

describe("Phase 7 notifications", () => {
  it("deduplicates alerts and refuses unauthorized recipients", async () => {
    const { t, users, orderId } = await seed();
    await t.run(async (ctx) => {
      const order = await ctx.db.get(orderId);
      await notifyUser(ctx, {
        userId: users.requester,
        order,
        type: "status_changed",
        message: "Changed",
        eventKey: "one",
      });
      await notifyUser(ctx, {
        userId: users.requester,
        order,
        type: "status_changed",
        message: "Changed",
        eventKey: "one",
      });
      await notifyUser(ctx, {
        userId: users.other,
        order,
        type: "status_changed",
        message: "Hidden",
        eventKey: "one",
      });
    });
    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toBe(`/app/orders/${orderId}`);
  });

  it("protects read actions and only returns authorized deep links", async () => {
    const { t, users, orderId } = await seed();
    const id = await t.run(async (ctx) =>
      notifyUser(ctx, {
        userId: users.requester,
        order: await ctx.db.get(orderId),
        type: "confirmation_required",
        message: "Confirm",
        eventKey: "receipt",
      }),
    );
    const requester = t.withIdentity({ subject: "requester" });
    expect(await requester.query(api.notifications.center, {})).toHaveLength(1);
    await expect(
      t
        .withIdentity({ subject: "other" })
        .mutation(api.notifications.markRead, { notificationId: id! }),
    ).rejects.toThrow("Notification not found");
    await requester.mutation(api.notifications.markRead, {
      notificationId: id!,
    });
    expect(await requester.query(api.notifications.center, {})).toHaveLength(0);
  });

  it("creates one approaching or overdue alert per eligible recipient", async () => {
    const { t } = await seed();
    await t.mutation(internal.notifications.generateDeadlineAlerts, {});
    await t.mutation(internal.notifications.generateDeadlineAlerts, {});
    const rows = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.type))).toEqual(
      new Set(["deadline_overdue"]),
    );
  });
});
