"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";

const filters = [
  "unassigned",
  "assigned_to_me",
  "all_active",
  "due_today",
  "upcoming",
  "waiting_for_requester",
  "exception_pending",
  "ready_for_reception",
  "partially_fulfilled",
  "overdue",
  "completed",
  "cancelled",
] as const;

type Filter = (typeof filters)[number];
type Row = {
  id: string;
  orderNumber: string;
  purpose: string;
  requiredAt: number;
  category: string;
  requester: string;
  location: string;
  assignee?: string;
  assignedAgentId?: string;
  status: string;
  isLate: boolean;
  hasMissingInformation: boolean;
};

const inputClass = "rounded-md border bg-background px-3 py-2 text-sm";

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { todayStart: start.getTime(), todayEnd: end.getTime() };
}

function timeRemaining(
  requiredAt: number,
  now: number,
  overdueLabel: string,
  remainingLabel: string,
) {
  const difference = requiredAt - now;
  const absoluteMinutes = Math.floor(Math.abs(difference) / 60_000);
  const days = Math.floor(absoluteMinutes / 1_440);
  const hours = Math.floor((absoluteMinutes % 1_440) / 60);
  const minutes = absoluteMinutes % 60;
  const value = days
    ? `${days}d ${hours}h`
    : hours
      ? `${hours}h ${minutes}m`
      : `${minutes}m`;
  return difference < 0
    ? `${value} ${overdueLabel}`
    : `${value} ${remainingLabel}`;
}

function StatusBadges({ row, now }: { row: Row; now: number }) {
  const { t, statusLabel } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
        {statusLabel(row.status)}
      </span>
      {(row.isLate || row.requiredAt < now) && (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
          {row.requiredAt < now ? t("overdue") : t("late")}
        </span>
      )}
      {row.hasMissingInformation && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
          {t("missingInformation")}
        </span>
      )}
    </div>
  );
}

export function PurchasingBucket() {
  const { t, formatDate } = useLanguage();
  const [filter, setFilter] = useState<Filter>("unassigned");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(0);
  const [actionOrderId, setActionOrderId] = useState<string>();
  const [action, setAction] = useState<"release" | "reassign">("release");
  const [reason, setReason] = useState("");
  const [targetAgentId, setTargetAgentId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [bounds] = useState(() => dayBounds());
  const filterLabels: Record<Filter, string> = {
    unassigned: t("unassigned"),
    assigned_to_me: t("assignedToMe"),
    all_active: t("allActive"),
    due_today: t("dueToday"),
    upcoming: t("upcoming"),
    waiting_for_requester: t("waitingRequester"),
    exception_pending: t("exceptionPending"),
    ready_for_reception: t("readyReception"),
    partially_fulfilled: t("partiallyFulfilled"),
    overdue: t("overdue"),
    completed: t("completed"),
    cancelled: t("cancelled"),
  };
  const result = useQuery(api.purchasing.listBucket, {
    filter,
    search: search || undefined,
    offset,
    limit: 25,
    ...bounds,
  });
  const agents = useQuery(
    api.purchasing.listAssignableAgents,
    result?.permissions.canReassign ? {} : "skip",
  );
  const claim = useMutation(api.purchasing.claim);
  const release = useMutation(api.purchasing.release);
  const reassign = useMutation(api.purchasing.reassign);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function resetPage(nextFilter?: Filter) {
    if (nextFilter) setFilter(nextFilter);
    setOffset(0);
    setMessage("");
  }

  async function claimOrder(orderId: string) {
    setBusy(true);
    setMessage("");
    try {
      await claim({ orderId: orderId as never });
      setMessage(t("claimedMessage"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("unableClaim"));
    } finally {
      setBusy(false);
    }
  }

  async function submitAction() {
    if (!actionOrderId) return;
    setBusy(true);
    setMessage("");
    try {
      if (action === "release") {
        await release({ orderId: actionOrderId as never, reason });
        setMessage(t("releasedMessage"));
      } else {
        await reassign({
          orderId: actionOrderId as never,
          targetAgentId: targetAgentId as never,
          reason,
        });
        setMessage(t("reassignedMessage"));
      }
      setActionOrderId(undefined);
      setReason("");
      setTargetAgentId("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t("unableAssignment"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (result === undefined)
    return <p aria-live="polite">{t("loadingBucket")}</p>;
  const displayNow = now || result.serverNow;

  const actionButtons = (row: Row) => (
    <div className="flex flex-wrap gap-2">
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={`/app/orders/${row.id}`}
      >
        {t("view")}
      </Link>
      {result.permissions.canClaim && row.status === "unassigned" && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void claimOrder(row.id)}
        >
          {t("claim")}
        </Button>
      )}
      {row.assignedAgentId === result.actorId && row.status === "assigned" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAction("release");
            setActionOrderId(row.id);
          }}
        >
          {t("release")}
        </Button>
      )}
      {result.permissions.canReassign && row.status === "assigned" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setAction("reassign");
            setActionOrderId(row.id);
          }}
        >
          {t("reassign")}
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t("liveOperations")}
          </p>
          <h2 className="text-2xl font-semibold">{t("bucketTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("bucketSubtitle")}
          </p>
        </div>
        <label className="w-full max-w-sm text-sm">
          {t("searchOrders")}
          <input
            type="search"
            className={`${inputClass} mt-1 w-full`}
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>

      <label className="mt-5 block text-sm md:hidden">
        {t("view")}
        <select
          className={`${inputClass} mt-1 w-full`}
          value={filter}
          onChange={(event) => resetPage(event.target.value as Filter)}
        >
          {filters.map((value) => (
            <option key={value} value={value}>
              {filterLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <div
        className="mt-5 hidden flex-wrap gap-2 md:flex"
        aria-label="Bucket views"
      >
        {filters.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => resetPage(value)}
          >
            {filterLabels[value]}
          </Button>
        ))}
      </div>

      {result.permissions.readOnly && (
        <p className="mt-4 rounded-md border bg-muted p-3 text-sm">
          {t("readOnly")}
        </p>
      )}
      {message && (
        <p className="mt-4 text-sm" role="status">
          {message}
        </p>
      )}

      {actionOrderId && (
        <section
          className="mt-5 rounded-xl border bg-card p-4"
          aria-label={`${action} order`}
        >
          <h3 className="font-semibold">
            {action === "release" ? t("releaseOrder") : t("reassignOrder")}
          </h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {action === "reassign" && (
              <label className="text-sm">
                {t("purchasingAgent")}
                <select
                  required
                  className={`${inputClass} mt-1 block min-w-52`}
                  value={targetAgentId}
                  onChange={(event) => setTargetAgentId(event.target.value)}
                >
                  <option value="">{t("selectAgent")}</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="min-w-64 flex-1 text-sm">
              {t("requiredReason")}
              <input
                required
                className={`${inputClass} mt-1 w-full`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button
              disabled={
                busy ||
                reason.trim().length < 3 ||
                (action === "reassign" && !targetAgentId)
              }
              onClick={() => void submitAction()}
            >
              {t("confirm")}{" "}
              {action === "release" ? t("release") : t("reassign")}
            </Button>
            <Button variant="ghost" onClick={() => setActionOrderId(undefined)}>
              {t("cancel")}
            </Button>
          </div>
        </section>
      )}

      {result.rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          {t("noBucketOrders")}
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("order")}</th>
                  <th className="px-4 py-3">{t("due")}</th>
                  <th className="px-4 py-3">{t("details")}</th>
                  <th className="px-4 py-3">{t("assignment")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-4 font-medium">
                      {row.orderNumber}
                      <span className="mt-1 block max-w-52 truncate text-xs font-normal text-muted-foreground">
                        {row.purpose}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={
                          row.requiredAt < displayNow
                            ? "font-semibold text-red-700"
                            : ""
                        }
                      >
                        {timeRemaining(
                          row.requiredAt,
                          displayNow,
                          t("overdue").toLocaleLowerCase(),
                          t("remaining"),
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDate(row.requiredAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block">{row.category}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.requester} · {row.location}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {row.assignee ?? t("unassigned")}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadges row={row} now={displayNow} />
                    </td>
                    <td className="px-4 py-4">{actionButtons(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-6 grid gap-4 md:hidden">
            {result.rows.map((row) => (
              <article key={row.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{row.orderNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      {row.purpose}
                    </p>
                  </div>
                  <StatusBadges row={row} now={displayNow} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("due")}
                    </dt>
                    <dd>
                      {timeRemaining(
                        row.requiredAt,
                        displayNow,
                        t("overdue").toLocaleLowerCase(),
                        t("remaining"),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("assignment")}
                    </dt>
                    <dd>{row.assignee ?? t("unassigned")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("category")}
                    </dt>
                    <dd>{row.category}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("requesterLocation")}
                    </dt>
                    <dd>
                      {row.requester} · {row.location}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4">{actionButtons(row)}</div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="mt-5 flex items-center justify-between text-sm">
        <span>
          {result.total
            ? `${offset + 1}–${Math.min(offset + 25, result.total)} of ${result.total}`
            : `0 ${t("orders")}`}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            {t("previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!result.hasMore}
            onClick={() => setOffset(offset + 25)}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
