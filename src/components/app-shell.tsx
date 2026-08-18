"use client";

import { UserButton } from "@clerk/nextjs";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";
import { AccountAccessBoundary } from "@/components/access-boundary";

const roleLabels: Record<string, string> = {
  requester: "Requester",
  receptionist: "Receptionist",
  purchasing_agent: "Purchasing Agent",
  admin: "Admin",
  super_admin: "Super Admin",
};

const roleNavigation: Record<string, string[]> = {
  requester: ["My requests", "New request"],
  receptionist: ["Operational orders", "Receiving"],
  purchasing_agent: ["Purchasing bucket", "Assigned to me"],
  admin: ["Administration", "Reports"],
  super_admin: ["Administration", "Reports", "Exception review"],
};

function Dashboard() {
  const profile = useQuery(api.users.current);
  if (profile === undefined)
    return <StateCard title="Loading your workspace…" />;

  const role = profile.canAccessSystemControl
    ? "System Owner"
    : roleLabels[profile.role];
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <header className="flex items-center justify-between border-b pb-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Purchasing Hub
          </p>
          <h1 className="text-2xl font-semibold">
            Welcome, {profile.displayName}
          </h1>
          <p className="text-sm text-muted-foreground">{role}</p>
        </div>
        <UserButton />
      </header>
      <section className="mt-10 rounded-xl border bg-card p-8">
        <h2 className="text-xl font-semibold">Your dashboard</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Authentication and server-authorized account access are ready.
          Purchasing workflows intentionally begin in Phase 2.
        </p>
        <nav
          aria-label="Primary"
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {profile.canAccessSystemControl && (
            <Placeholder label="System controls" />
          )}
          {(roleNavigation[profile.role] ?? []).map((label) => (
            <Placeholder key={label} label={label} />
          ))}
          <Placeholder label="My profile" />
        </nav>
      </section>
    </main>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border p-4 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function StateCard({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-md rounded-xl border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        {detail && (
          <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        )}
      </section>
    </main>
  );
}

export function AppShell() {
  return (
    <>
      <AuthLoading>
        <StateCard title="Verifying access…" />
      </AuthLoading>
      <Authenticated>
        <AccountAccessBoundary>
          <Dashboard />
        </AccountAccessBoundary>
      </Authenticated>
      <Unauthenticated>
        <StateCard
          title="Access denied"
          detail="Sign in with an invited account to continue."
        />
      </Unauthenticated>
    </>
  );
}
