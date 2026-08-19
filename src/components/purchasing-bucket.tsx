"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";

const filters = [
  ["unassigned", "Unassigned"],
  ["assigned_to_me", "Assigned to Me"],
  ["all_active", "All Active"],
  ["due_today", "Due Today"],
  ["upcoming", "Upcoming"],
  ["waiting_for_requester", "Waiting for Requester"],
  ["exception_pending", "Exception Pending"],
  ["ready_for_reception", "Ready for Reception"],
  ["partially_fulfilled", "Partially Fulfilled"],
  ["overdue", "Overdue"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

type Filter = (typeof filters)[number][0];
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

function timeRemaining(requiredAt: number, now: number) {
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
  return difference < 0 ? `${value} overdue` : `${value} remaining`;
}

function StatusBadges({ row, now }: { row: Row; now: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
        {row.status.replaceAll("_", " ")}
      </span>
      {(row.isLate || row.requiredAt < now) && (
        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
          {row.requiredAt < now ? "Overdue" : "Late"}
        </span>
      )}
      {row.hasMissingInformation && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
          Missing information
        </span>
      )}
    </div>
  );
}

export function PurchasingBucket() {
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
      setMessage("Order claimed. The bucket updated for everyone.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to claim order",
      );
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
        setMessage("Order released to the unassigned bucket.");
      } else {
        await reassign({
          orderId: actionOrderId as never,
          targetAgentId: targetAgentId as never,
          reason,
        });
        setMessage("Order reassigned.");
      }
      setActionOrderId(undefined);
      setReason("");
      setTargetAgentId("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update assignment",
      );
    } finally {
      setBusy(false);
    }
  }

  if (result === undefined)
    return <p aria-live="polite">Loading purchasing bucket…</p>;
  const displayNow = now || result.serverNow;

  const actionButtons = (row: Row) => (
    <div className="flex flex-wrap gap-2">
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={`/app/orders/${row.id}`}
      >
        View
      </Link>
      {result.permissions.canClaim && row.status === "unassigned" && (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => void claimOrder(row.id)}
        >
          Claim
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
          Release
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
          Reassign
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Live operations
          </p>
          <h2 className="text-2xl font-semibold">Purchasing bucket</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioritized automatically and updated without refreshing.
          </p>
        </div>
        <label className="w-full max-w-sm text-sm">
          Search orders
          <input
            type="search"
            className={`${inputClass} mt-1 w-full`}
            placeholder="Order, requester, category, or location"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>

      <label className="mt-5 block text-sm md:hidden">
        View
        <select
          className={`${inputClass} mt-1 w-full`}
          value={filter}
          onChange={(event) => resetPage(event.target.value as Filter)}
        >
          {filters.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div
        className="mt-5 hidden flex-wrap gap-2 md:flex"
        aria-label="Bucket views"
      >
        {filters.map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => resetPage(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {result.permissions.readOnly && (
        <p className="mt-4 rounded-md border bg-muted p-3 text-sm">
          Read-only access: your role can monitor this bucket but cannot change
          assignments.
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
            {action === "release" ? "Release order" : "Reassign order"}
          </h3>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {action === "reassign" && (
              <label className="text-sm">
                Purchasing agent
                <select
                  required
                  className={`${inputClass} mt-1 block min-w-52`}
                  value={targetAgentId}
                  onChange={(event) => setTargetAgentId(event.target.value)}
                >
                  <option value="">Select agent</option>
                  {agents?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.displayName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="min-w-64 flex-1 text-sm">
              Required reason
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
              Confirm {action}
            </Button>
            <Button variant="ghost" onClick={() => setActionOrderId(undefined)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      {result.rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No orders match this view.
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Assignment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
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
                        {timeRemaining(row.requiredAt, displayNow)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {new Date(row.requiredAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="block">{row.category}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.requester} · {row.location}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {row.assignee ?? "Unassigned"}
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
                    <dt className="text-xs text-muted-foreground">Due</dt>
                    <dd>{timeRemaining(row.requiredAt, displayNow)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Assignment
                    </dt>
                    <dd>{row.assignee ?? "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Category</dt>
                    <dd>{row.category}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Requester / location
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
            : "0 orders"}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!result.hasMore}
            onClick={() => setOffset(offset + 25)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
