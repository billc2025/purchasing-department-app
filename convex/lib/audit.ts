import type { GenericMutationCtx } from "convex/server";
import type { AuthorizedUser } from "./authorization";

type AuditInput = {
  action: string;
  entityType: string;
  entityId: string;
  reason?: string;
  priorValues?: unknown;
  newValues?: unknown;
  correlationId?: string;
};

export async function appendAuditEvent(
  ctx: GenericMutationCtx<any>,
  actor: AuthorizedUser,
  event: AuditInput,
) {
  return ctx.db.insert("auditEvents", {
    actorUserId: actor._id,
    actorIsProtected: actor.isProtectedPrincipal,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    reason: event.reason,
    priorValues: event.priorValues,
    newValues: event.newValues,
    correlationId: event.correlationId,
    createdAt: Date.now(),
  });
}

export function auditActorLabel(
  actor: Pick<AuthorizedUser, "displayName" | "isProtectedPrincipal">,
  viewerIsOverlord: boolean,
) {
  return actor.isProtectedPrincipal && !viewerIsOverlord
    ? "System Administrator"
    : actor.displayName;
}
