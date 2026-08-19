"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  unassigned: "Submitted",
  exception_pending: "Exception review",
  cancelled: "Cancelled",
};
export function MyOrders() {
  const orders = useQuery(api.orders.listMine);
  if (orders === undefined) return <p>Loading your orders…</p>;
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Purchasing activity</p>
          <h2 className="text-2xl font-semibold">My orders</h2>
        </div>
        <Link
          href="/app/orders/new"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          New order
        </Link>
      </div>
      {orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          You have not placed an order yet.
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/app/orders/${order.id}`}
              className="grid gap-3 rounded-xl border bg-card p-5 hover:border-foreground/30 sm:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-semibold">{order.orderNumber}</p>
                <p className="text-sm text-muted-foreground">{order.purpose}</p>
              </div>
              <div className="text-sm">
                <p>{statusLabels[order.status] ?? order.status}</p>
                <p className="text-muted-foreground">
                  {order.billingResponsibility === "client"
                    ? `Client: ${order.clientBillingReference}`
                    : "Internal cost"}
                </p>
              </div>
              <div className="text-sm sm:text-right">
                <p>
                  {new Intl.NumberFormat(undefined, {
                    style: "currency",
                    currency: order.currency,
                  }).format(order.estimatedAmountMinor / 100)}
                </p>
                <p className="text-muted-foreground">
                  Due {new Date(order.requiredAt).toLocaleString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
