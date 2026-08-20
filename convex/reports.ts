import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { appendAuditEvent } from "./lib/audit";
import { effectiveRole, requireActiveUser } from "./lib/authorization";
import {
  csvRow,
  reportDateTypes,
  safeAverage,
  withinRange,
  type ReportDateType,
} from "./lib/reporting";
import { orderStatusValidator } from "./schema";

const dateTypeValidator = v.union(
  ...reportDateTypes.map((dateType) => v.literal(dateType)),
);
const filterArgs = {
  from: v.optional(v.number()),
  to: v.optional(v.number()),
  dateType: dateTypeValidator,
  requesterId: v.optional(v.id("users")),
  departmentId: v.optional(v.id("departments")),
  costCenter: v.optional(v.string()),
  agentId: v.optional(v.id("users")),
  categoryId: v.optional(v.id("categories")),
  status: v.optional(orderStatusValidator),
  locationId: v.optional(v.id("locations")),
  assignment: v.union(
    v.literal("all"),
    v.literal("assigned"),
    v.literal("unassigned"),
  ),
  exception: v.union(
    v.literal("all"),
    v.literal("has_exception"),
    v.literal("none"),
  ),
  timeliness: v.union(
    v.literal("all"),
    v.literal("on_time"),
    v.literal("late"),
    v.literal("overdue"),
  ),
  minEstimatedMinor: v.optional(v.number()),
  maxEstimatedMinor: v.optional(v.number()),
  minActualMinor: v.optional(v.number()),
  maxActualMinor: v.optional(v.number()),
};

type Filters = {
  from?: number;
  to?: number;
  dateType: ReportDateType;
  requesterId?: string;
  departmentId?: string;
  costCenter?: string;
  agentId?: string;
  categoryId?: string;
  status?: string;
  locationId?: string;
  assignment: "all" | "assigned" | "unassigned";
  exception: "all" | "has_exception" | "none";
  timeliness: "all" | "on_time" | "late" | "overdue";
  minEstimatedMinor?: number;
  maxEstimatedMinor?: number;
  minActualMinor?: number;
  maxActualMinor?: number;
};

const terminalStatuses = new Set(["completed", "cancelled", "rejected"]);

function requireReporter(actor: any) {
  if (!["admin", "super_admin", "overlord"].includes(effectiveRole(actor)))
    throw new Error("Access denied");
  return actor;
}

function groupCount(rows: any[], key: (row: any) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort(
      (left, right) =>
        right.value - left.value || left.label.localeCompare(right.label),
    );
}

async function buildReport(ctx: any, actor: any, filters: Filters) {
  requireReporter(actor);
  const now = Date.now();
  const [
    orders,
    items,
    transactions,
    receiving,
    confirmations,
    statusEvents,
    exceptions,
    cancellationOutcomes,
    users,
    departments,
    categories,
    locations,
  ] = await Promise.all([
    ctx.db.query("orders").take(1_000),
    ctx.db.query("orderItems").take(3_000),
    ctx.db.query("purchaseTransactions").take(3_000),
    ctx.db.query("receivingEvents").take(6_000),
    ctx.db.query("receiptConfirmations").take(2_000),
    ctx.db.query("statusEvents").take(10_000),
    ctx.db.query("exceptionRequests").take(2_000),
    ctx.db.query("cancellationItemOutcomes").take(3_000),
    ctx.db.query("users").take(500),
    ctx.db.query("departments").take(500),
    ctx.db.query("categories").take(500),
    ctx.db.query("locations").take(500),
  ]);
  if (orders.length === 1_000)
    throw new Error(
      "Report safety limit reached; narrow the date range before continuing",
    );
  const isOverlord = effectiveRole(actor) === "overlord";
  const visibleName = (user: any) =>
    !user
      ? "Unavailable user"
      : user.isProtectedPrincipal && !isOverlord
        ? "System Administrator"
        : user.displayName;
  const userById = new Map<string, any>(
    users.map((user: any) => [user._id, user]),
  );
  const departmentById = new Map<string, any>(
    departments.map((row: any) => [row._id, row]),
  );
  const categoryById = new Map<string, any>(
    categories.map((row: any) => [row._id, row]),
  );
  const locationById = new Map<string, any>(
    locations.map((row: any) => [row._id, row]),
  );

  const transactionsByOrder = new Map<string, any[]>();
  for (const transaction of transactions) {
    const rows = transactionsByOrder.get(transaction.orderId) ?? [];
    rows.push(transaction);
    transactionsByOrder.set(transaction.orderId, rows);
  }
  const receiptsByOrder = new Map<string, any[]>();
  for (const event of receiving) {
    const rows = receiptsByOrder.get(event.orderId) ?? [];
    rows.push(event);
    receiptsByOrder.set(event.orderId, rows);
  }
  const confirmationsByOrder = new Map<string, any[]>();
  for (const confirmation of confirmations) {
    const rows = confirmationsByOrder.get(confirmation.orderId) ?? [];
    rows.push(confirmation);
    confirmationsByOrder.set(confirmation.orderId, rows);
  }
  const eventsByOrder = new Map<string, any[]>();
  for (const event of statusEvents) {
    const rows = eventsByOrder.get(event.orderId) ?? [];
    rows.push(event);
    eventsByOrder.set(event.orderId, rows);
  }
  const exceptionOrderIds = new Set(
    exceptions.map((request: any) => request.orderId),
  );

  const enriched = orders.map((order: any) => {
    const orderTransactions = transactionsByOrder.get(order._id) ?? [];
    const orderReceipts = receiptsByOrder.get(order._id) ?? [];
    const orderConfirmations = confirmationsByOrder.get(order._id) ?? [];
    const orderEvents = eventsByOrder.get(order._id) ?? [];
    const purchaseAt = orderTransactions.length
      ? Math.min(...orderTransactions.map((row: any) => row.purchasedAt))
      : undefined;
    const receivedAt = orderReceipts.length
      ? Math.max(...orderReceipts.map((row: any) => row.receivedAt))
      : undefined;
    const confirmedAt = orderConfirmations.length
      ? Math.max(...orderConfirmations.map((row: any) => row.createdAt))
      : undefined;
    const completionEvents = orderEvents.filter(
      (event: any) => event.toStatus === "completed",
    );
    const completedAt = completionEvents.length
      ? Math.max(...completionEvents.map((row: any) => row.createdAt))
      : undefined;
    const actualAmountMinor = orderTransactions.reduce(
      (sum: number, row: any) => sum + row.amountMinor,
      0,
    );
    const relevantDate = {
      created: order.createdAt,
      required: order.requiredAt,
      assigned: order.assignedAt,
      purchased: purchaseAt,
      received: receivedAt,
      confirmed: confirmedAt,
      completed: completedAt,
    }[filters.dateType];
    const department = order.departmentId
      ? departmentById.get(order.departmentId)
      : undefined;
    return {
      id: order._id,
      orderNumber: order.orderNumber,
      purpose: order.purpose,
      status: order.status,
      requesterId: order.requestedForUserId,
      requester: visibleName(userById.get(order.requestedForUserId)),
      departmentId: order.departmentId,
      department: department?.name ?? "No department",
      costCenter:
        order.costCenterSnapshot ?? department?.costCenterReference ?? "",
      agentId: order.assignedAgentId,
      agent: order.assignedAgentId
        ? visibleName(userById.get(order.assignedAgentId))
        : "Unassigned",
      categoryId: order.categoryId,
      category:
        categoryById.get(order.categoryId)?.name ?? "Unavailable category",
      locationId: order.locationId,
      location:
        locationById.get(order.locationId)?.name ?? "Unavailable location",
      createdAt: order.createdAt,
      requiredAt: order.requiredAt,
      assignedAt: order.assignedAt,
      purchaseAt,
      receivedAt,
      confirmedAt,
      completedAt,
      relevantDate,
      estimatedAmountMinor: order.estimatedAmountMinor,
      actualAmountMinor,
      currency: order.currency,
      isLate: order.isLate,
      isOverdue: !terminalStatuses.has(order.status) && order.requiredAt < now,
      hasException:
        exceptionOrderIds.has(order._id) ||
        order.status === "exception_pending",
      receiptCount: orderTransactions.length,
      receiptProofCount: orderTransactions.filter(
        (row: any) => row.receiptStorageId,
      ).length,
    };
  });

  const rows = enriched.filter((row: any) => {
    if (
      (filters.from !== undefined || filters.to !== undefined) &&
      !withinRange(row.relevantDate, filters.from, filters.to)
    )
      return false;
    if (filters.requesterId && row.requesterId !== filters.requesterId)
      return false;
    if (filters.departmentId && row.departmentId !== filters.departmentId)
      return false;
    if (
      filters.costCenter &&
      !row.costCenter
        .toLocaleLowerCase()
        .includes(filters.costCenter.trim().toLocaleLowerCase())
    )
      return false;
    if (filters.agentId && row.agentId !== filters.agentId) return false;
    if (filters.categoryId && row.categoryId !== filters.categoryId)
      return false;
    if (filters.status && row.status !== filters.status) return false;
    if (filters.locationId && row.locationId !== filters.locationId)
      return false;
    if (filters.assignment === "assigned" && !row.agentId) return false;
    if (filters.assignment === "unassigned" && row.agentId) return false;
    if (filters.exception === "has_exception" && !row.hasException)
      return false;
    if (filters.exception === "none" && row.hasException) return false;
    if (filters.timeliness === "on_time" && (row.isLate || row.isOverdue))
      return false;
    if (filters.timeliness === "late" && !row.isLate) return false;
    if (filters.timeliness === "overdue" && !row.isOverdue) return false;
    if (
      filters.minEstimatedMinor !== undefined &&
      row.estimatedAmountMinor < filters.minEstimatedMinor
    )
      return false;
    if (
      filters.maxEstimatedMinor !== undefined &&
      row.estimatedAmountMinor > filters.maxEstimatedMinor
    )
      return false;
    if (
      filters.minActualMinor !== undefined &&
      row.actualAmountMinor < filters.minActualMinor
    )
      return false;
    if (
      filters.maxActualMinor !== undefined &&
      row.actualAmountMinor > filters.maxActualMinor
    )
      return false;
    return true;
  });
  const filteredIds = new Set(rows.map((row: any) => row.id));
  const filteredItems = items.filter((item: any) =>
    filteredIds.has(item.orderId),
  );
  const filteredTransactions = transactions.filter((row: any) =>
    filteredIds.has(row.orderId),
  );
  const filteredOutcomes = cancellationOutcomes.filter((row: any) =>
    filteredIds.has(row.orderId),
  );
  const completedOrReceived = rows.filter(
    (row: any) => row.receivedAt !== undefined,
  );
  const onTimeReceived = completedOrReceived.filter(
    (row: any) => row.receivedAt <= row.requiredAt,
  );
  const assignmentDurations = rows
    .filter((row: any) => row.assignedAt !== undefined)
    .map((row: any) => row.assignedAt - row.createdAt);
  const processingDurations = rows
    .filter(
      (row: any) =>
        row.assignedAt !== undefined && row.purchaseAt !== undefined,
    )
    .map((row: any) => row.purchaseAt - row.assignedAt);
  const completionDurations = rows
    .filter((row: any) => row.completedAt !== undefined)
    .map((row: any) => row.completedAt - row.createdAt);
  const confirmationDurations = rows
    .filter(
      (row: any) =>
        row.receivedAt !== undefined && row.confirmedAt !== undefined,
    )
    .map((row: any) => row.confirmedAt - row.receivedAt);
  const estimatedTotalMinor = rows.reduce(
    (sum: number, row: any) => sum + row.estimatedAmountMinor,
    0,
  );
  const actualTotalMinor = rows.reduce(
    (sum: number, row: any) => sum + row.actualAmountMinor,
    0,
  );
  const receiptTransactionCount = filteredTransactions.length;
  const receiptProofCount = filteredTransactions.filter(
    (row: any) => row.receiptStorageId,
  ).length;
  const vendorSpend = new Map<string, number>();
  for (const transaction of filteredTransactions)
    vendorSpend.set(
      transaction.vendor,
      (vendorSpend.get(transaction.vendor) ?? 0) + transaction.amountMinor,
    );
  const cancellationCost = (outcome: string) =>
    filteredOutcomes
      .filter(
        (row: any) => row.outcome === outcome && row.amountMinor !== undefined,
      )
      .reduce((sum: number, row: any) => sum + row.amountMinor, 0);
  const publicRows = rows
    .sort(
      (left: any, right: any) =>
        (right.relevantDate ?? 0) - (left.relevantDate ?? 0),
    )
    .map((row: any) => {
      const { requesterId: _requesterId, agentId: _agentId, ...visible } = row;
      void _requesterId;
      void _agentId;
      return visible;
    });

  return {
    generatedAt: now,
    dateType: filters.dateType,
    rows: publicRows,
    metrics: {
      totalOrders: rows.length,
      estimatedTotalMinor,
      actualTotalMinor,
      varianceMinor: actualTotalMinor - estimatedTotalMinor,
      averageAssignmentMs: safeAverage(assignmentDurations),
      averageProcessingMs: safeAverage(processingDurations),
      averageCompletionMs: safeAverage(completionDurations),
      averageConfirmationMs: safeAverage(confirmationDurations),
      onTimePercentage: completedOrReceived.length
        ? Math.round(
            (onTimeReceived.length / completedOrReceived.length) * 10_000,
          ) / 100
        : null,
      onTimeDenominator: completedOrReceived.length,
      overdueOrders: rows.filter((row: any) => row.isOverdue).length,
      exceptions: rows.filter((row: any) => row.hasException).length,
      partialFulfillment: rows.filter(
        (row: any) => row.status === "partially_fulfilled",
      ).length,
      substitutions: filteredItems.filter(
        (item: any) =>
          item.substitutionDescription || item.status === "substituted",
      ).length,
      unavailableItems: filteredItems.filter(
        (item: any) => item.status === "unavailable",
      ).length,
      receiptCompletenessPercentage: receiptTransactionCount
        ? Math.round((receiptProofCount / receiptTransactionCount) * 10_000) /
          100
        : null,
      receiptDenominator: receiptTransactionCount,
      cancellations: rows.filter((row: any) => row.status === "cancelled")
        .length,
      refundedMinor: cancellationCost("refunded"),
      nonRefundableMinor: cancellationCost("non_refundable"),
    },
    breakdowns: {
      byCategory: groupCount(rows, (row) => row.category),
      byDepartment: groupCount(rows, (row) => row.department),
      byRequester: groupCount(rows, (row) => row.requester),
      agentWorkload: groupCount(
        rows.filter(
          (row: any) => row.agentId && !terminalStatuses.has(row.status),
        ),
        (row) => row.agent,
      ),
      vendorSpending: [...vendorSpend.entries()]
        .map(([label, valueMinor]) => ({ label, valueMinor }))
        .sort((left, right) => right.valueMinor - left.valueMinor),
    },
  };
}

export const options = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const actor = requireReporter(await requireActiveUser(ctx));
    const [users, departments, categories, locations] = await Promise.all([
      ctx.db.query("users").take(500),
      ctx.db.query("departments").take(500),
      ctx.db.query("categories").take(500),
      ctx.db.query("locations").take(500),
    ]);
    const isOverlord = effectiveRole(actor) === "overlord";
    const visibleUsers = users.filter(
      (user: any) =>
        user.isActive && (isOverlord || !user.isProtectedPrincipal),
    );
    return {
      requesters: visibleUsers.map((user: any) => ({
        id: user._id,
        name: user.isProtectedPrincipal
          ? "My protected account"
          : user.displayName,
      })),
      agents: visibleUsers
        .filter(
          (user: any) =>
            user.role === "purchasing_agent" || user.isProtectedPrincipal,
        )
        .map((user: any) => ({
          id: user._id,
          name: user.isProtectedPrincipal
            ? "My protected account"
            : user.displayName,
        })),
      departments: departments.map((row: any) => ({
        id: row._id,
        name: row.name,
      })),
      categories: categories.map((row: any) => ({
        id: row._id,
        name: row.name,
      })),
      locations: locations.map((row: any) => ({ id: row._id, name: row.name })),
    };
  },
});

export const dashboard = queryGeneric({
  args: filterArgs,
  handler: async (ctx, args) =>
    buildReport(ctx, await requireActiveUser(ctx), args as Filters),
});

export const exportCsv = mutationGeneric({
  args: {
    ...filterArgs,
    kind: v.union(v.literal("detail"), v.literal("summary")),
  },
  handler: async (ctx, args) => {
    const actor = await requireActiveUser(ctx);
    const report = await buildReport(ctx, actor, args as Filters);
    const lines: string[] = [];
    if (args.kind === "detail") {
      lines.push(
        csvRow([
          "Order number",
          "Purpose",
          "Status",
          "Requester",
          "Department",
          "Cost center",
          "Purchasing agent",
          "Category",
          "Location",
          "Created date",
          "Required-by date",
          "Assignment date",
          "Purchase date",
          "Receipt date",
          "Confirmation date",
          "Completion date",
          "Estimated amount",
          "Actual amount",
          "Currency",
          "Late",
          "Overdue",
          "Exception",
        ]),
      );
      for (const row of report.rows)
        lines.push(
          csvRow([
            row.orderNumber,
            row.purpose,
            row.status,
            row.requester,
            row.department,
            row.costCenter,
            row.agent,
            row.category,
            row.location,
            row.createdAt,
            row.requiredAt,
            row.assignedAt,
            row.purchaseAt,
            row.receivedAt,
            row.confirmedAt,
            row.completedAt,
            row.estimatedAmountMinor,
            row.actualAmountMinor,
            row.currency,
            row.isLate,
            row.isOverdue,
            row.hasException,
          ]),
        );
    } else {
      lines.push(csvRow(["Metric", "Value", "Denominator or note"]));
      const metrics = report.metrics;
      lines.push(
        csvRow(["Total orders", metrics.totalOrders, "Filtered orders"]),
      );
      lines.push(
        csvRow([
          "Estimated total (minor units)",
          metrics.estimatedTotalMinor,
          "Filtered orders",
        ]),
      );
      lines.push(
        csvRow([
          "Actual total (minor units)",
          metrics.actualTotalMinor,
          "Finalized purchases",
        ]),
      );
      lines.push(
        csvRow([
          "Variance (minor units)",
          metrics.varianceMinor,
          "Actual minus estimated",
        ]),
      );
      lines.push(
        csvRow([
          "Average assignment time (ms)",
          metrics.averageAssignmentMs,
          "Orders with assignment date",
        ]),
      );
      lines.push(
        csvRow([
          "Average processing time (ms)",
          metrics.averageProcessingMs,
          "Orders with assignment and purchase dates",
        ]),
      );
      lines.push(
        csvRow([
          "Average completion time (ms)",
          metrics.averageCompletionMs,
          "Completed orders with completion event",
        ]),
      );
      lines.push(
        csvRow([
          "On-time percentage",
          metrics.onTimePercentage,
          metrics.onTimeDenominator,
        ]),
      );
      lines.push(
        csvRow([
          "Receipt completeness percentage",
          metrics.receiptCompletenessPercentage,
          metrics.receiptDenominator,
        ]),
      );
      lines.push(
        csvRow([
          "Cancelled orders",
          metrics.cancellations,
          "Current status cancelled",
        ]),
      );
      lines.push(
        csvRow([
          "Refunded cost (minor units)",
          metrics.refundedMinor,
          "Recorded outcome amounts only",
        ]),
      );
      lines.push(
        csvRow([
          "Non-refundable cost (minor units)",
          metrics.nonRefundableMinor,
          "Recorded outcome amounts only",
        ]),
      );
    }
    await appendAuditEvent(ctx, actor, {
      action: "report.csv_exported",
      entityType: "report_export",
      entityId: `${args.kind}-${Date.now()}`,
      newValues: {
        kind: args.kind,
        filters: args,
        rowCount: report.rows.length,
      },
    });
    return {
      csv: `\uFEFF${lines.join("\r\n")}`,
      rowCount: report.rows.length,
      generatedAt: report.generatedAt,
    };
  },
});
