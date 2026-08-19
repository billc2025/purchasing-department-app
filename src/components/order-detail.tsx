"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OrderDetail({ orderId }: { orderId: string }) {
  const order = useQuery(api.orders.detail, { orderId: orderId as never });
  if (order === undefined) return <p>Loading order…</p>;
  return (
    <article className="mx-auto max-w-4xl">
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">{order.purpose}</h2>
          <span className="rounded-full bg-muted px-3 py-1 text-sm">
            {order.status.replaceAll("_", " ")}
          </span>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Required</dt>
            <dd>{new Date(order.requiredAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Billing</dt>
            <dd>
              {order.billingResponsibility === "client"
                ? `Client — ${order.clientBillingReference}`
                : "Internal cost"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estimate</dt>
            <dd>
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: order.currency,
              }).format(order.estimatedAmountMinor / 100)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Lead time</dt>
            <dd>
              {order.isLate ? "Late — exception review required" : "Compliant"}
            </dd>
          </div>
        </dl>
        <h3 className="mt-8 font-semibold">Items</h3>
        <div className="mt-3 divide-y rounded-xl border">
          {order.items.map((item: (typeof order.items)[number]) => (
            <div
              key={item._id}
              className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.specification}
                </p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Preferred vendor
                    </dt>
                    <dd>{item.preferredVendor || "No preference"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Estimated amount
                    </dt>
                    <dd>
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: order.currency,
                      }).format(item.estimatedAmountMinor / 100)}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-sm">
                {item.quantity} {item.unit}
              </p>
            </div>
          ))}
        </div>
        {order.comments && (
          <div className="mt-6">
            <h3 className="font-semibold">Comments</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {order.comments}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
