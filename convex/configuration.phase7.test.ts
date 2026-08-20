import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const [subject, role] of [
      ["requester", "requester"],
      ["admin", "admin"],
    ] as const)
      await ctx.db.insert("users", {
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
  });
  return t;
}

describe("Phase 7 configuration", () => {
  it("authorizes configuration, validates policy values, and audits versions", async () => {
    const t = await setup();
    await expect(
      t
        .withIdentity({ subject: "requester" })
        .query(api.configuration.adminWorkspace, {}),
    ).rejects.toThrow();
    const admin = t.withIdentity({ subject: "admin" });
    await expect(
      admin.mutation(api.configuration.savePolicies, {
        editCutoffMinutes: -1,
        receptionistStatuses: ["purchased"],
        cancellationOutcomes: ["returned"],
      }),
    ).rejects.toThrow("Edit cutoff");
    await admin.mutation(api.configuration.savePolicies, {
      editCutoffMinutes: 45,
      receptionistStatuses: ["purchased", "in_transit"],
      cancellationOutcomes: ["returned", "refunded"],
    });
    const state = await t.run(async (ctx) => ({
      settings: await ctx.db.query("systemSettings").collect(),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect(state.settings).toHaveLength(3);
    expect(
      state.audits.filter(
        (event) => event.action === "configuration.policy_updated",
      ),
    ).toHaveLength(3);
  });

  it("stores allocation planning with enforcement permanently inactive", async () => {
    const t = await setup();
    await t
      .withIdentity({ subject: "admin" })
      .mutation(api.configuration.saveBudgetAllocation, {
        scopeType: "general",
        name: "Annual planning",
        amountMinor: 250000,
        currency: "usd",
      });
    const allocation = await t.run(
      async (ctx) => (await ctx.db.query("budgetAllocations").unique())!,
    );
    expect(allocation.enforcementActive).toBe(false);
    expect(allocation.currency).toBe("USD");
  });
});
