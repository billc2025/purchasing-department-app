import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("persists the authenticated user's language preference", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkUserId: "spanish-user",
      displayName: "Usuario",
      normalizedEmail: "usuario@example.test",
      role: "requester",
      isProtectedPrincipal: false,
      isActive: true,
      timezone: "America/Panama",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
  const user = t.withIdentity({ subject: "spanish-user" });
  await user.mutation(api.users.setPreferredLanguage, { language: "es" });
  expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
    preferredLanguage: "es",
  });
  expect(await user.query(api.users.current)).toMatchObject({
    preferredLanguage: "es",
  });
});
