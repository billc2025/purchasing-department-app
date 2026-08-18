import { describe, expect, it } from "vitest";
import {
  assertProvisionedActiveUser,
  canManageVisibleUser,
  effectiveRole,
  publicUserProjection,
  requireRole,
  visibleRoles,
  type AuthorizedUser,
} from "./authorization";
import { auditActorLabel } from "./audit";

function user(overrides: Partial<AuthorizedUser> = {}): AuthorizedUser {
  return {
    _id: "user-1",
    clerkUserId: "clerk-1",
    displayName: "Pat Example",
    normalizedEmail: "pat@example.test",
    role: "requester",
    isActive: true,
    isProtectedPrincipal: false,
    ...overrides,
  };
}

describe("visible roles", () => {
  it("never publishes the hidden role", () => {
    expect(visibleRoles).not.toContain("overlord");
    expect(visibleRoles).toEqual([
      "requester",
      "receptionist",
      "purchasing_agent",
      "admin",
      "super_admin",
    ]);
  });
});

describe("account gates", () => {
  it("rejects identities that have not been provisioned", () => {
    expect(() => assertProvisionedActiveUser(null)).toThrowError();
  });

  it("rejects deactivated users while preserving their record", () => {
    const inactive = user({ isActive: false });
    expect(() => assertProvisionedActiveUser(inactive)).toThrowError();
    expect(inactive.normalizedEmail).toBe("pat@example.test");
  });
});

describe("server-controlled effective role", () => {
  it("derives Overlord only from the protected marker", () => {
    expect(
      effectiveRole(user({ role: "requester", isProtectedPrincipal: true })),
    ).toBe("overlord");
  });

  it("allows Overlord through every role gate without changing the stored visible role", () => {
    const owner = user({ isProtectedPrincipal: true });
    expect(requireRole(owner, ["super_admin"])).toBe(owner);
    expect(owner.role).toBe("requester");
  });

  it("rejects an ordinary user outside the allowed role set", () => {
    expect(() => requireRole(user(), ["admin"])).toThrowError();
  });

  it.each(visibleRoles)(
    "enforces the %s boundary from the stored record",
    (role) => {
      const actor = user({ role });
      expect(requireRole(actor, [role])).toBe(actor);
      const otherRole = visibleRoles.find((candidate) => candidate !== role)!;
      expect(() => requireRole(actor, [otherRole])).toThrowError();
    },
  );
});

describe("concealment", () => {
  it("removes a protected principal from ordinary user projections", () => {
    expect(
      publicUserProjection(user({ isProtectedPrincipal: true })),
    ).toBeNull();
  });

  it("redacts the protected audit actor for ordinary viewers", () => {
    const owner = user({
      displayName: "Private Owner",
      isProtectedPrincipal: true,
    });
    expect(auditActorLabel(owner, false)).toBe("System Administrator");
    expect(auditActorLabel(owner, true)).toBe("Private Owner");
  });
});

describe("ordinary user management", () => {
  it("prevents Admin from managing administrators or protected principals", () => {
    const admin = user({ role: "admin" });
    expect(canManageVisibleUser(admin, user({ role: "requester" }))).toBe(true);
    expect(canManageVisibleUser(admin, user({ role: "super_admin" }))).toBe(
      false,
    );
    expect(
      canManageVisibleUser(admin, user({ isProtectedPrincipal: true })),
    ).toBe(false);
  });

  it("allows Super Admin to manage visible users only", () => {
    const superAdmin = user({ role: "super_admin" });
    expect(canManageVisibleUser(superAdmin, user({ role: "admin" }))).toBe(
      true,
    );
    expect(
      canManageVisibleUser(superAdmin, user({ isProtectedPrincipal: true })),
    ).toBe(false);
  });
});
