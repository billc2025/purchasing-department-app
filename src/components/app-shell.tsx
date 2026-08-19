"use client";

import { UserButton } from "@clerk/nextjs";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { AccountAccessBoundary } from "@/components/access-boundary";
import { Button } from "@/components/ui/button";
import { MyOrders } from "@/components/my-orders";
import { OrderEntry } from "@/components/order-entry";
import { OrderDetail } from "@/components/order-detail";
import { PurchasingBucket } from "@/components/purchasing-bucket";

type View = "dashboard" | "new" | "mine" | "detail" | "purchasing";

function Workspace({ view, orderId }: { view: View; orderId?: string }) {
  const profile = useQuery(api.users.current);
  const seed = useMutation(api.configuration.seedDevelopmentExamples);
  if (profile === undefined)
    return <StateCard title="Loading your workspace…" />;
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <Link
            href="/app"
            className="text-sm font-semibold text-muted-foreground"
          >
            Purchasing Hub
          </Link>
          <h1 className="text-2xl font-semibold">
            Welcome, {profile.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <nav aria-label="Primary" className="flex gap-2 text-sm">
            {profile.canViewPurchasingBucket && (
              <Link
                className="rounded-md px-3 py-2 hover:bg-muted"
                href="/app/purchasing"
              >
                Purchasing bucket
              </Link>
            )}
            <Link
              className="rounded-md px-3 py-2 hover:bg-muted"
              href="/app/orders"
            >
              My orders
            </Link>
            <Link
              className="rounded-md bg-primary px-3 py-2 text-primary-foreground"
              href="/app/orders/new"
            >
              New order
            </Link>
          </nav>
          <UserButton />
        </div>
      </header>
      <section className="py-8">
        {view === "new" && <OrderEntry />}
        {view === "mine" && <MyOrders />}
        {view === "detail" && orderId && <OrderDetail orderId={orderId} />}
        {view === "purchasing" && <PurchasingBucket />}
        {view === "dashboard" && (
          <div className="grid gap-5 md:grid-cols-2">
            <Link
              href="/app/orders/new"
              className="rounded-2xl border bg-card p-7 hover:border-foreground/30"
            >
              <p className="text-sm text-muted-foreground">Start here</p>
              <h2 className="mt-1 text-xl font-semibold">Place a new order</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Save a draft, add several items, check the deadline, and submit.
              </p>
            </Link>
            <Link
              href="/app/orders"
              className="rounded-2xl border bg-card p-7 hover:border-foreground/30"
            >
              <p className="text-sm text-muted-foreground">Your activity</p>
              <h2 className="mt-1 text-xl font-semibold">Review my orders</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Track drafts, compliant requests, and requests awaiting
                exception review.
              </p>
            </Link>
            {profile.canAccessSystemControl && (
              <div className="rounded-2xl border border-dashed p-7">
                <h2 className="text-lg font-semibold">
                  Development sample data
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Adds editable Food Delivery (1 hour), Event Purchase (3 days),
                  General Operations, and Main Office examples.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => seed()}
                >
                  Add sample data
                </Button>
              </div>
            )}
            {profile.canViewPurchasingBucket && (
              <Link
                href="/app/purchasing"
                className="rounded-2xl border bg-card p-7 hover:border-foreground/30"
              >
                <p className="text-sm text-muted-foreground">Live operations</p>
                <h2 className="mt-1 text-xl font-semibold">
                  Purchasing bucket
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Claim and prioritize submitted purchasing work in real time.
                </p>
              </Link>
            )}
          </div>
        )}
      </section>
    </main>
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

export function AppShell({
  view = "dashboard",
  orderId,
}: {
  view?: View;
  orderId?: string;
}) {
  return (
    <>
      <AuthLoading>
        <StateCard title="Verifying access…" />
      </AuthLoading>
      <Authenticated>
        <AccountAccessBoundary>
          <Workspace view={view} orderId={orderId} />
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
