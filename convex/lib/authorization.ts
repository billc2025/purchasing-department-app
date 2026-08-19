import { ConvexError } from "convex/values";
import type { GenericQueryCtx, GenericMutationCtx } from "convex/server";

export const visibleRoles = [
  "requester",
  "receptionist",
  "purchasing_agent",
  "admin",
  "super_admin",
] as const;

export type VisibleRole = (typeof visibleRoles)[number];
export type EffectiveRole = VisibleRole | "overlord";

type AuthCtx = GenericQueryCtx<any> | GenericMutationCtx<any>;

export type AuthorizedUser = {
  _id: string;
  clerkUserId: string;
  displayName: string;
  normalizedEmail: string;
  role: VisibleRole;
  isActive: boolean;
  isProtectedPrincipal: boolean;
  timezone?: string;
  preferredLanguage?: "en" | "es";
};

export function assertProvisionedActiveUser(
  user: AuthorizedUser | null,
): asserts user is AuthorizedUser {
  if (!user || !user.isActive) {
    throw new ConvexError({
      code: user ? "ACCOUNT_INACTIVE" : "ACCOUNT_NOT_PROVISIONED",
      message: user ? "Account inactive" : "Account awaiting provisioning",
    });
  }
}

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in required",
    });
  }
  return identity;
}

export async function requireActiveUser(ctx: AuthCtx): Promise<AuthorizedUser> {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (query: any) =>
      query.eq("clerkUserId", identity.subject),
    )
    .unique();

  assertProvisionedActiveUser(user as AuthorizedUser | null);

  const configuredOverlordId = process.env.OVERLORD_CLERK_USER_ID;
  const isConfiguredOverlord = identity.subject === configuredOverlordId;
  if (user.isProtectedPrincipal !== isConfiguredOverlord) {
    throw new ConvexError({
      code: "PROTECTED_IDENTITY_MISMATCH",
      message: "Protected identity configuration requires reconciliation",
    });
  }
  return user as AuthorizedUser;
}

export function effectiveRole(user: AuthorizedUser): EffectiveRole {
  return user.isProtectedPrincipal ? "overlord" : user.role;
}

export function requireRole(
  user: AuthorizedUser,
  roles: readonly EffectiveRole[],
) {
  const role = effectiveRole(user);
  if (role !== "overlord" && !roles.includes(role)) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });
  }
  return user;
}

export function canManageVisibleUser(
  actor: AuthorizedUser,
  target: AuthorizedUser,
) {
  if (target.isProtectedPrincipal) return false;
  if (effectiveRole(actor) === "overlord") return true;
  if (actor.role === "super_admin") return true;
  return (
    actor.role === "admin" && !["admin", "super_admin"].includes(target.role)
  );
}

export function publicUserProjection(user: AuthorizedUser) {
  if (user.isProtectedPrincipal) return null;
  return {
    id: user._id,
    displayName: user.displayName,
    email: user.normalizedEmail,
    role: user.role,
    isActive: user.isActive,
  };
}
