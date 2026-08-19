export const bucketFilters = [
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

export type BucketFilter = (typeof bucketFilters)[number];

export type BucketOrder = {
  id: string;
  orderNumber: string;
  status: string;
  requiredAt: number;
  isLate: boolean;
  assignedAgentId?: string;
};

const inactiveStatuses = new Set([
  "draft",
  "completed",
  "cancelled",
  "rejected",
]);

export function normalizeReason(reason: string) {
  const normalized = reason.trim().replace(/\s+/g, " ");
  if (normalized.length < 3)
    throw new Error("A reason of at least 3 characters is required");
  if (normalized.length > 500)
    throw new Error("Reason must be 500 characters or fewer");
  return normalized;
}

export function priorityGroup(order: BucketOrder, now: number) {
  if (!inactiveStatuses.has(order.status) && order.requiredAt < now) return 0;
  if (order.status === "exception_pending" || order.isLate) return 1;
  if (order.status === "unassigned" && !order.assignedAgentId) return 2;
  return 3;
}

export function compareBucketOrders(
  left: BucketOrder,
  right: BucketOrder,
  now: number,
) {
  return (
    priorityGroup(left, now) - priorityGroup(right, now) ||
    left.requiredAt - right.requiredAt ||
    left.orderNumber.localeCompare(right.orderNumber) ||
    left.id.localeCompare(right.id)
  );
}

export function matchesBucketFilter(
  order: BucketOrder,
  filter: BucketFilter,
  actorId: string,
  now: number,
  todayStart: number,
  todayEnd: number,
) {
  switch (filter) {
    case "unassigned":
      return order.status === "unassigned" && !order.assignedAgentId;
    case "assigned_to_me":
      return (
        order.assignedAgentId === actorId && !inactiveStatuses.has(order.status)
      );
    case "all_active":
      return !inactiveStatuses.has(order.status);
    case "due_today":
      return (
        !inactiveStatuses.has(order.status) &&
        order.requiredAt >= todayStart &&
        order.requiredAt < todayEnd
      );
    case "upcoming":
      return (
        !inactiveStatuses.has(order.status) && order.requiredAt >= todayEnd
      );
    case "waiting_for_requester":
      return order.status === "waiting_for_requester";
    case "exception_pending":
      return order.status === "exception_pending";
    case "ready_for_reception":
      return (
        order.status === "ready_for_reception" || order.status === "received"
      );
    case "partially_fulfilled":
      return order.status === "partially_fulfilled";
    case "overdue":
      return !inactiveStatuses.has(order.status) && order.requiredAt < now;
    case "completed":
      return order.status === "completed";
    case "cancelled":
      return order.status === "cancelled";
  }
}
