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

async function setup() {
  process.env.OVERLORD_CLERK_USER_ID = "owner";
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role, protectedPrincipal] of [
      ["owner", "super_admin", true],
      ["admin", "admin", false],
      ["super", "super_admin", false],
      ["new-user", "requester", false],
    ] as const)
      users[subject] = await ctx.db.insert("users", {
        clerkUserId: subject,
        displayName: subject,
        normalizedEmail: `${subject}@example.test`,
        role,
        isProtectedPrincipal: protectedPrincipal,
        isActive: true,
        timezone: "America/Panama",
        createdAt: now,
        updatedAt: now,
      });
    return users;
  });
  return { t, ids };
}

describe("visible user role management", () => {
  it("lets Admin assign operational roles and audits the change", async () => {
    const { t, ids } = await setup();
    const admin = t.withIdentity({ subject: "admin" });
    await admin.mutation(api.users.changeVisibleUserRole, {
      userId: ids["new-user"],
      role: "purchasing_agent",
      reason: "Assigned to the purchasing team",
    });
    const state = await t.run(async (ctx) => ({
      user: await ctx.db.get(ids["new-user"]),
      audits: await ctx.db.query("auditEvents").collect(),
    }));
    expect((state.user as any)?.role).toBe("purchasing_agent");
    expect(state.audits[0]).toMatchObject({
      action: "user.role_changed",
      reason: "Assigned to the purchasing team",
      priorValues: { role: "requester" },
      newValues: { role: "purchasing_agent" },
    });
  });

  it("prevents Admin promotion to administrative roles", async () => {
    const { t, ids } = await setup();
    await expect(
      t
        .withIdentity({ subject: "admin" })
        .mutation(api.users.changeVisibleUserRole, {
          userId: ids["new-user"],
          role: "super_admin",
          reason: "Unauthorized promotion",
        }),
    ).rejects.toThrow("Access denied");
  });

  it("conceals and rejects the protected account", async () => {
    const { t, ids } = await setup();
    const superAdmin = t.withIdentity({ subject: "super" });
    const result = await superAdmin.query(api.users.listVisibleUsers, {});
    expect(result.users.map((user) => user.id)).not.toContain(ids.owner);
    expect(JSON.stringify(result)).not.toContain("owner@example.test");
    await expect(
      superAdmin.mutation(api.users.changeVisibleUserRole, {
        userId: ids.owner,
        role: "requester",
        reason: "Attempt protected change",
      }),
    ).rejects.toThrow("User not found");
  });
});
