import {
  internalMutationGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import {
  canManageVisibleUser,
  effectiveRole,
  publicUserProjection,
  requireActiveUser,
  requireRole,
  visibleRoles,
} from "./lib/authorization";
import { visibleRoleValidator } from "./schema";

export const current = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    const role = effectiveRole(user);
    return {
      displayName: user.displayName,
      role: user.role,
      preferredLanguage: user.preferredLanguage ?? "en",
      canAccessSystemControl: user.isProtectedPrincipal,
      canViewPurchasingBucket: [
        "receptionist",
        "purchasing_agent",
        "admin",
        "super_admin",
        "overlord",
      ].includes(role),
      canViewReports: ["admin", "super_admin", "overlord"].includes(role),
      canManageConfiguration: ["admin", "super_admin", "overlord"].includes(
        role,
      ),
    };
  },
});

export const setPreferredLanguage = mutationGeneric({
  args: { language: v.union(v.literal("en"), v.literal("es")) },
  handler: async (ctx, args) => {
    const user = await requireActiveUser(ctx);
    await ctx.db.patch(user._id as any, {
      preferredLanguage: args.language,
      updatedAt: Date.now(),
    });
    return args.language;
  },
});

export const visibleRoleOptions = queryGeneric({
  args: {},
  handler: async (ctx) => {
    await requireActiveUser(ctx);
    return visibleRoles;
  },
});

export const listVisibleUsers = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = await requireActiveUser(ctx);
    requireRole(actor, ["admin", "super_admin"]);
    const users = await ctx.db.query("users").take(100);
    const actorRole = effectiveRole(actor);
    const assignableRoles =
      actorRole === "admin"
        ? visibleRoles.filter((role) =>
            ["requester", "receptionist", "purchasing_agent"].includes(role),
          )
        : visibleRoles;
    return {
      assignableRoles,
      users: users.flatMap((user) => {
        const projected = publicUserProjection(user as any);
        return projected
          ? [
              {
                ...projected,
                canManage:
                  user._id !== actor._id &&
                  canManageVisibleUser(actor, user as any),
              },
            ]
          : [];
      }),
    };
  },
});

export const changeVisibleUserRole = mutationGeneric({
  args: {
    userId: v.id("users"),
    role: visibleRoleValidator,
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = requireRole(await requireActiveUser(ctx), [
      "admin",
      "super_admin",
    ]);
    const target = await ctx.db.get(args.userId);
    if (
      !target ||
      !target.isActive ||
      target.isProtectedPrincipal ||
      target._id === actor._id ||
      !canManageVisibleUser(actor, target as any)
    )
      throw new Error("User not found");
    const actorRole = effectiveRole(actor);
    if (
      actorRole === "admin" &&
      !["requester", "receptionist", "purchasing_agent"].includes(args.role)
    )
      throw new Error("Access denied");
    const reason = args.reason.trim().replace(/\s+/g, " ").slice(0, 500);
    if (!reason) throw new Error("A reason is required");
    if (target.role === args.role)
      throw new Error("User already has this role");
    const now = Date.now();
    await ctx.db.patch(target._id, { role: args.role, updatedAt: now });
    await appendAuditEvent(ctx, actor, {
      action: "user.role_changed",
      entityType: "user",
      entityId: String(target._id),
      reason,
      priorValues: { role: target.role },
      newValues: { role: args.role },
    });
    return { role: args.role };
  },
});

export const syncLastSeen = mutationGeneric({
  args: {},
  handler: async (ctx) => {
    const user = await requireActiveUser(ctx);
    await ctx.db.patch(user._id as any, {
      lastSeenAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const upsertFromClerk = internalMutationGeneric({
  args: {
    clerkUserId: v.string(),
    displayName: v.string(),
    normalizedEmail: v.string(),
    role: visibleRoleValidator,
    isActive: v.boolean(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (query: any) =>
        query.eq("clerkUserId", args.clerkUserId),
      )
      .unique();
    const isProtectedPrincipal =
      args.clerkUserId === process.env.OVERLORD_CLERK_USER_ID;

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        normalizedEmail: args.normalizedEmail.toLowerCase(),
        isActive: args.isActive,
        timezone: args.timezone,
        isProtectedPrincipal,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("users", {
      ...args,
      normalizedEmail: args.normalizedEmail.toLowerCase(),
      isProtectedPrincipal,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const deactivateVisibleUser = mutationGeneric({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    requireRole(actor, ["admin", "super_admin"]);
    const target = await ctx.db.get(args.userId);
    if (!target || target.isProtectedPrincipal) {
      throw new Error("User not found");
    }
    if (!canManageVisibleUser(actor, target as any)) {
      throw new Error("User not found");
    }
    if (!args.reason.trim()) throw new Error("A reason is required");
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      isActive: false,
      deactivatedAt: now,
      updatedAt: now,
    });
    await appendAuditEvent(ctx, actor, {
      action: "user.deactivated",
      entityType: "user",
      entityId: args.userId,
      reason: args.reason.trim(),
      priorValues: { isActive: target.isActive },
      newValues: { isActive: false },
    });
    return null;
  },
});
