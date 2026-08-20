"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

export function ApprovalQueue() {
  const orders = useQuery(api.approvals.pending);
  const decide = useMutation(api.approvals.decide);
  const { language, formatCurrency, formatDate } = useLanguage();
  const es = language === "es";
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState("");
  if (orders === undefined)
    return <p>{es ? "Cargando aprobaciones…" : "Loading approvals…"}</p>;
  return (
    <div>
      <h2 className="text-2xl font-semibold">
        {es ? "Aprobación de pedidos" : "Order approvals"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {es
          ? "Solo los pedidos aprobados pasan a la bandeja del equipo de compras."
          : "Only approved orders enter the purchasing team’s bucket."}
      </p>
      {message && (
        <p
          role="status"
          className="mt-4 rounded-lg border bg-muted p-3 text-sm"
        >
          {message}
        </p>
      )}
      {orders.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {es
            ? "No hay pedidos pendientes de aprobación."
            : "No orders are awaiting approval."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <Link
                    href={`/app/orders/${order.id}`}
                    className="font-semibold underline"
                  >
                    {order.orderNumber}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {order.purpose} · {order.requester} · {order.category}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p>
                    {formatCurrency(order.estimatedAmountMinor, order.currency)}
                  </p>
                  <p
                    className={
                      order.isLate
                        ? "font-medium text-red-700"
                        : "text-muted-foreground"
                    }
                  >
                    {es ? "Necesario" : "Needed"}:{" "}
                    {formatDate(order.requiredAt)}
                    {order.isLate ? ` · ${es ? "Tardío" : "Late"}` : ""}
                  </p>
                </div>
              </div>
              {order.canDecide ? (
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="text-sm">
                    {es ? "Razón obligatoria" : "Required decision reason"}
                    <input
                      className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                      value={reasons[order.id] ?? ""}
                      maxLength={500}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button
                      disabled={
                        busy === order.id ||
                        (reasons[order.id] ?? "").trim().length < 3
                      }
                      onClick={() => runDecision(order.id, "approved")}
                    >
                      {es ? "Aprobar" : "Approve"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        busy === order.id ||
                        (reasons[order.id] ?? "").trim().length < 3
                      }
                      onClick={() => runDecision(order.id, "returned")}
                    >
                      {es ? "Devolver para corregir" : "Return for corrections"}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={
                        busy === order.id ||
                        (reasons[order.id] ?? "").trim().length < 3
                      }
                      onClick={() => runDecision(order.id, "rejected")}
                    >
                      {es ? "Rechazar" : "Reject"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-md border bg-muted p-3 text-sm">
                  {es
                    ? "No puede aprobar un pedido creado para usted."
                    : "You cannot approve an order created for you."}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );

  async function runDecision(
    orderId: string,
    decision: "approved" | "returned" | "rejected",
  ) {
    setBusy(orderId);
    setMessage("");
    try {
      await decide({
        orderId: orderId as never,
        decision,
        reason: reasons[orderId] ?? "",
      });
      setReasons((current) => ({ ...current, [orderId]: "" }));
      setMessage(
        es
          ? "Decisión guardada y notificaciones enviadas."
          : "Decision saved and notifications sent.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : es
            ? "No se pudo guardar la decisión."
            : "Unable to save decision.",
      );
    } finally {
      setBusy(undefined);
    }
  }
}
