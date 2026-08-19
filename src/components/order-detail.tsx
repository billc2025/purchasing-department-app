"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";

export function OrderDetail({ orderId }: { orderId: string }) {
  const order = useQuery(api.orders.detail, { orderId: orderId as never });
  const cancelOrder = useMutation(api.orders.cancelByOverlord);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
            <dt className="text-muted-foreground">Requested for</dt>
            <dd>{order.requestedForName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created by</dt>
            <dd>{order.createdByName}</dd>
          </div>
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
              <dl className="text-sm sm:text-right">
                <dt className="text-xs text-muted-foreground">Quantity</dt>
                <dd className="font-medium">
                  {item.quantity} {item.unit}
                </dd>
              </dl>
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
        {order.permissions.canOverlordCancel && (
          <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="font-semibold text-red-900">Overlord controls</h3>
            <p className="mt-1 text-sm text-red-800">
              Cancellation preserves this order and its complete audit history.
            </p>
            {!showCancel ? (
              <Button
                className="mt-4"
                variant="destructive"
                onClick={() => setShowCancel(true)}
              >
                Cancel order
              </Button>
            ) : (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="min-w-64 flex-1 text-sm text-red-950">
                  Required cancellation reason
                  <input
                    className="mt-1 w-full rounded-md border bg-white px-3 py-2"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <Button
                  variant="destructive"
                  disabled={busy || reason.trim().length < 3}
                  onClick={async () => {
                    setBusy(true);
                    setMessage("");
                    try {
                      await cancelOrder({
                        orderId: orderId as never,
                        reason,
                      });
                      setMessage("Order cancelled. History was preserved.");
                      setShowCancel(false);
                      setReason("");
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Unable to cancel order",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Confirm cancellation
                </Button>
                <Button variant="ghost" onClick={() => setShowCancel(false)}>
                  Keep order
                </Button>
              </div>
            )}
            {message && (
              <p className="mt-3 text-sm text-red-900" role="status">
                {message}
              </p>
            )}
          </section>
        )}
      </div>
    </article>
  );
}
