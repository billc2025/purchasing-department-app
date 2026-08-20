"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { ProcessingWorkspace } from "@/components/processing-workspace";
import { LifecycleWorkspace } from "@/components/lifecycle-workspace";

export function OrderDetail({ orderId }: { orderId: string }) {
  const order = useQuery(api.orders.detail, { orderId: orderId as never });
  const cancelOrder = useMutation(api.orders.cancelByOverlord);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { t, formatCurrency, formatDate, statusLabel } = useLanguage();
  if (order === undefined) return <p>{t("loadingOrder")}</p>;
  return (
    <>
      <article className="mx-auto max-w-4xl">
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">{order.orderNumber}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">{order.purpose}</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-sm">
              {statusLabel(order.status)}
            </span>
          </div>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{t("requestedFor")}</dt>
              <dd>{order.requestedForName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("createdBy")}</dt>
              <dd>{order.createdByName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("neededBy")}</dt>
              <dd>{formatDate(order.requiredAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("billing")}</dt>
              <dd>
                {order.billingResponsibility === "client"
                  ? `${t("client")} — ${order.clientBillingReference}`
                  : t("internalCost")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("totalOrderBudget")}</dt>
              <dd>
                {formatCurrency(order.estimatedAmountMinor, order.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("leadTime")}</dt>
              <dd>{order.isLate ? t("lateReview") : t("compliant")}</dd>
            </div>
          </dl>
          <h3 className="mt-8 font-semibold">{t("items")}</h3>
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
                        {t("preferredVendor")}
                      </dt>
                      <dd>{item.preferredVendor || t("noPreference")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t("estimatedItemCost")}
                      </dt>
                      <dd>
                        {formatCurrency(
                          item.estimatedAmountMinor,
                          order.currency,
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
                <dl className="text-sm sm:text-right">
                  <dt className="text-xs text-muted-foreground">
                    {t("quantity")}
                  </dt>
                  <dd className="font-medium">
                    {item.quantity} {item.unit}
                  </dd>
                </dl>
              </div>
            ))}
          </div>
          {order.comments && (
            <div className="mt-6">
              <h3 className="font-semibold">{t("comments")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {order.comments}
              </p>
            </div>
          )}
          {order.permissions.canOverlordCancel && (
            <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4">
              <h3 className="font-semibold text-red-900">
                {t("overlordControls")}
              </h3>
              <p className="mt-1 text-sm text-red-800">
                {t("cancellationPreserves")}
              </p>
              {!showCancel ? (
                <Button
                  className="mt-4"
                  variant="destructive"
                  onClick={() => setShowCancel(true)}
                >
                  {t("cancelOrder")}
                </Button>
              ) : (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <label className="min-w-64 flex-1 text-sm text-red-950">
                    {t("cancellationReason")}
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
                        setMessage(t("cancelledPreserved"));
                        setShowCancel(false);
                        setReason("");
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : t("unableCancel"),
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("confirmCancellation")}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowCancel(false)}>
                    {t("keepOrder")}
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
      <LifecycleWorkspace orderId={orderId} />
      <ProcessingWorkspace orderId={orderId} />
    </>
  );
}
