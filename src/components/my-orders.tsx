"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLanguage } from "@/components/language-provider";

export function MyOrders() {
  const orders = useQuery(api.orders.listMine);
  const { t, formatCurrency, formatDate, statusLabel } = useLanguage();
  if (orders === undefined) return <p>{t("loadingOrders")}</p>;
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {t("purchasingActivity")}
          </p>
          <h2 className="text-2xl font-semibold">{t("myOrders")}</h2>
        </div>
        <Link
          href="/app/orders/new"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {t("newOrder")}
        </Link>
      </div>
      {orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {t("noOrders")}
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
                <p>{statusLabel(order.status)}</p>
                <p className="text-muted-foreground">
                  {order.billingResponsibility === "client"
                    ? `${t("client")}: ${order.clientBillingReference}`
                    : t("internalCost")}
                </p>
              </div>
              <div className="text-sm sm:text-right">
                <p>
                  {formatCurrency(order.estimatedAmountMinor, order.currency)}
                </p>
                <p className="text-muted-foreground">
                  {t("due")} {formatDate(order.requiredAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
