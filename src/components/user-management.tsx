"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

const roleLabels: Record<string, { en: string; es: string }> = {
  requester: { en: "Requester", es: "Solicitante" },
  receptionist: { en: "Receptionist", es: "Recepción" },
  purchasing_agent: { en: "Purchasing agent", es: "Agente de compras" },
  admin: { en: "Admin", es: "Administrador" },
  super_admin: { en: "Super Admin", es: "Superadministrador" },
};

export function UserManagement() {
  const data = useQuery(api.users.listVisibleUsers);
  const changeRole = useMutation(api.users.changeVisibleUserRole);
  const { language } = useLanguage();
  const es = language === "es";
  const [drafts, setDrafts] = useState<
    Record<string, { role: string; reason: string }>
  >({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string>();
  return (
    <section
      className="rounded-xl border p-5"
      aria-labelledby="user-management-heading"
    >
      <h3 id="user-management-heading" className="font-semibold">
        {es ? "Usuarios y funciones" : "Users and roles"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {es
          ? "Primero invite al usuario desde Clerk. Cuando acepte la invitación, aparecerá aquí como Solicitante."
          : "First invite the user in Clerk. After they accept, they will appear here as a Requester."}{" "}
        <a
          className="font-medium underline"
          href="https://dashboard.clerk.com/"
          target="_blank"
          rel="noreferrer"
        >
          {es ? "Abrir Clerk" : "Open Clerk"}
        </a>
      </p>
      {message && (
        <p
          className="mt-3 rounded-md border bg-muted p-3 text-sm"
          role="status"
        >
          {message}
        </p>
      )}
      {data === undefined ? (
        <p className="mt-4 text-sm">
          {es ? "Cargando usuarios…" : "Loading users…"}
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {data.users.map((user) => {
            const draft = drafts[user.id] ?? { role: user.role, reason: "" };
            return (
              <form
                key={user.id}
                className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_auto] md:items-end"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setMessage("");
                  setBusyId(user.id);
                  try {
                    await changeRole({
                      userId: user.id as never,
                      role: draft.role as "requester",
                      reason: draft.reason,
                    });
                    setMessage(
                      es
                        ? `Función actualizada para ${user.displayName}.`
                        : `Role updated for ${user.displayName}.`,
                    );
                    setDrafts((current) => ({
                      ...current,
                      [user.id]: { role: draft.role, reason: "" },
                    }));
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : es
                          ? "No se pudo actualizar."
                          : "Unable to update role.",
                    );
                  } finally {
                    setBusyId(undefined);
                  }
                }}
              >
                <div>
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.email} ·{" "}
                    {user.isActive
                      ? es
                        ? "Activo"
                        : "Active"
                      : es
                        ? "Inactivo"
                        : "Inactive"}
                  </p>
                </div>
                <label className="text-sm">
                  {es ? "Función" : "Role"}
                  <select
                    className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                    value={draft.role}
                    disabled={!user.canManage || !user.isActive}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [user.id]: { ...draft, role: event.target.value },
                      }))
                    }
                  >
                    {data.assignableRoles.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]?.[language] ?? role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {es ? "Razón del cambio" : "Reason for change"}
                  <input
                    className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                    value={draft.reason}
                    disabled={!user.canManage || !user.isActive}
                    maxLength={500}
                    required
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [user.id]: { ...draft, reason: event.target.value },
                      }))
                    }
                  />
                </label>
                <Button
                  type="submit"
                  disabled={
                    !user.canManage ||
                    !user.isActive ||
                    busyId === user.id ||
                    draft.role === user.role
                  }
                >
                  {es ? "Guardar" : "Save role"}
                </Button>
              </form>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        {es
          ? "La cuenta protegida Overlord nunca aparece en esta lista. Todos los cambios quedan auditados."
          : "The protected Overlord account never appears in this list. Every change is audited."}
      </p>
    </section>
  );
}
