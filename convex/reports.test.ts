import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { sanitizeCsvCell } from "./lib/reporting";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const priorOverlord = process.env.OVERLORD_CLERK_USER_ID;

afterEach(() => {
  if (priorOverlord === undefined) delete process.env.OVERLORD_CLERK_USER_ID;
  else process.env.OVERLORD_CLERK_USER_ID = priorOverlord;
});

const baseFilters = {
  dateType: "created" as const,
  assignment: "all" as const,
  exception: "all" as const,
  timeliness: "all" as const,
};

async function seedReports() {
  process.env.OVERLORD_CLERK_USER_ID = "overlord";
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const users: Record<string, any> = {};
    for (const [subject, role, protectedUser] of [
      ["requester", "requester", false],
      ["admin", "admin", false],
      ["super", "super_admin", false],
      ["agent", "purchasing_agent", false],
      ["overlord", "super_admin", true],
    ] as const) {
      users[subject] = await ctx.db.insert("users", {
        clerkUserId: subject,
        displayName: subject === "overlord" ? "Hidden Owner" : subject,
        normalizedEmail: `${subject}@example.test`,
        role,
        isProtectedPrincipal: protectedUser,
        isActive: true,
        timezone: "America/Panama",
        createdAt: now,
        updatedAt: now,
      });
    }
    const departmentId = await ctx.db.insert("departments", {
      name: "Operations",
      code: "OPS",
      costCenterReference: "CC-100",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const categoryId = await ctx.db.insert("categories", {
      name: "Events",
      normalizedName: "events",
      displayOrder: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const locationId = await ctx.db.insert("locations", {
      name: "Office",
      timezone: "America/Panama",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    const common = {
      requesterUserId: users.requester,
      createdByUserId: users.requester,
      requestedForUserId: users.requester,
      departmentId,
      costCenterSnapshot: "CC-100",
      billingResponsibility: "internal" as const,
      categoryId,
      categoryRuleVersion: 1,
      leadTimeMinutesSnapshot: 60,
      locationId,
      displayTimezone: "America/Panama",
      earliestCompliantAt: now - 10_000,
      currency: "USD",
    };
    const completedId = await ctx.db.insert("orders", {
      ...common,
      orderNumber: "PH-REPORT-1",
      purpose: '=HYPERLINK("bad")',
      requiredAt: now - 24 * 3_600_000,
      submittedAt: now - 10 * 24 * 3_600_000,
      assignedAgentId: users.agent,
      assignedAt: now - 9 * 24 * 3_600_000,
      isLate: false,
      estimatedAmountMinor: 10_000,
      status: "completed",
      createdAt: now - 10 * 24 * 3_600_000,
      updatedAt: now - 20 * 3_600_000,
    });
    const overdueId = await ctx.db.insert("orders", {
      ...common,
      orderNumber: "PH-REPORT-2",
      purpose: "Overdue order",
      requiredAt: now - 2 * 24 * 3_600_000,
      submittedAt: now - 5 * 24 * 3_600_000,
      assignedAgentId: users.overlord,
      assignedAt: now - 4 * 24 * 3_600_000,
      isLate: true,
      estimatedAmountMinor: 5_000,
      status: "in_transit",
      createdAt: now - 5 * 24 * 3_600_000,
      updatedAt: now,
    });
    const itemId = await ctx.db.insert("orderItems", {
      orderId: completedId,
      name: "Coffee",
      specification: "Test",
      quantity: 1,
      unit: "case",
      estimatedAmountMinor: 10_000,
      substitutionAllowed: true,
      displayOrder: 0,
      status: "received",
      purchasedQuantity: 1,
      receivedQuantity: 1,
      actualAmountMinor: 12_000,
      substitutionDescription: "Replacement coffee",
      createdAt: now,
      updatedAt: now,
    });
    const transactionId = await ctx.db.insert("purchaseTransactions", {
      orderId: completedId,
      vendor: "+Vendor Formula",
      purchasedAt: now - 3 * 24 * 3_600_000,
      amountMinor: 12_000,
      currency: "USD",
      purchasingAgentId: users.agent,
      receiptStorageId: undefined,
      proofExceptionReason: "Approved exception",
      status: "finalized",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("purchaseAllocations", {
      transactionId,
      orderId: completedId,
      itemId,
      quantity: 1,
      amountMinor: 12_000,
      createdAt: now,
    });
    await ctx.db.insert("receivingEvents", {
      orderId: completedId,
      itemId,
      receiverUserId: users.agent,
      receivedAt: now - 30 * 3_600_000,
      locationId,
      quantity: 1,
      createdAt: now,
    });
    await ctx.db.insert("receiptConfirmations", {
      orderId: completedId,
      confirmerUserId: users.requester,
      outcome: "correct",
      isPrivilegedOverride: false,
      createdAt: now - 24 * 3_600_000,
    });
    await ctx.db.insert("statusEvents", {
      orderId: completedId,
      actorUserId: users.requester,
      entityType: "order",
      command: "confirm_correct",
      fromStatus: "received",
      toStatus: "completed",
      createdAt: now - 24 * 3_600_000,
    });
    await ctx.db.insert("exceptionRequests", {
      orderId: overdueId,
      type: "late",
      triggerSnapshot: { isLate: true },
      requesterUserId: users.requester,
      status: "approved",
      decisionMakerUserId: users.super,
      decisionReason: "Approved",
      decidedAt: now,
      createdAt: now,
    });
    return {
      users,
      departmentId,
      categoryId,
      locationId,
      completedId,
      overdueId,
      now,
    };
  });
  return { t, ...ids };
}

describe("Phase 6 reports", () => {
  it("restricts reports to administrative roles", async () => {
    const { t } = await seedReports();
    await expect(
      t
        .withIdentity({ subject: "requester" })
        .query(api.reports.dashboard, baseFilters),
    ).rejects.toThrow(/Access denied/);
    expect(
      (
        await t
          .withIdentity({ subject: "admin" })
          .query(api.reports.dashboard, baseFilters)
      ).metrics.totalOrders,
    ).toBe(2);
  });

  it("reconciles costs and reports only defined duration denominators", async () => {
    const { t } = await seedReports();
    const report = await t
      .withIdentity({ subject: "admin" })
      .query(api.reports.dashboard, baseFilters);
    expect(report.metrics).toMatchObject({
      totalOrders: 2,
      estimatedTotalMinor: 15_000,
      actualTotalMinor: 12_000,
      varianceMinor: -3_000,
      overdueOrders: 1,
      exceptions: 1,
      substitutions: 1,
      receiptCompletenessPercentage: 0,
      receiptDenominator: 1,
    });
    expect(report.metrics.averageCompletionMs).not.toBeNull();
    expect(report.metrics.onTimeDenominator).toBe(1);
  });

  it("applies the selected operational date rather than conflating dates", async () => {
    const { t, now } = await seedReports();
    const admin = t.withIdentity({ subject: "admin" });
    const recentPurchases = await admin.query(api.reports.dashboard, {
      ...baseFilters,
      dateType: "purchased",
      from: now - 4 * 24 * 3_600_000,
      to: now,
    });
    expect(recentPurchases.rows.map((row: any) => row.orderNumber)).toEqual([
      "PH-REPORT-1",
    ]);
    const recentCompletions = await admin.query(api.reports.dashboard, {
      ...baseFilters,
      dateType: "completed",
      from: now - 2 * 24 * 3_600_000,
      to: now,
    });
    expect(recentCompletions.rows).toHaveLength(1);
    const costCenter = await admin.query(api.reports.dashboard, {
      ...baseFilters,
      costCenter: "100",
    });
    expect(costCenter.metrics.totalOrders).toBe(2);
    const highActual = await admin.query(api.reports.dashboard, {
      ...baseFilters,
      minActualMinor: 13_000,
    });
    expect(highActual.metrics.totalOrders).toBe(0);
  });

  it("conceals the protected principal from non-Overlord options and rows", async () => {
    const { t, users } = await seedReports();
    const admin = t.withIdentity({ subject: "admin" });
    const options = await admin.query(api.reports.options, {});
    expect(options.agents.map((row: any) => row.name)).not.toContain(
      "Hidden Owner",
    );
    expect(options.requesters.map((row: any) => row.name)).not.toContain(
      "Hidden Owner",
    );
    const report = await admin.query(api.reports.dashboard, baseFilters);
    expect(
      report.rows.find((row: any) => row.orderNumber === "PH-REPORT-2")?.agent,
    ).toBe("System Administrator");
    expect(JSON.stringify(report)).not.toContain("Hidden Owner");
    expect(JSON.stringify(report)).not.toContain("overlord@example.test");
    expect(JSON.stringify(report)).not.toContain(String(users.overlord));

    const protectedOptions = await t
      .withIdentity({ subject: "overlord" })
      .query(api.reports.options, {});
    expect(protectedOptions.agents.map((row: any) => row.name)).toContain(
      "My protected account",
    );
  });

  it("exports filtered rows, neutralizes formulas, and audits the export", async () => {
    const { t, completedId } = await seedReports();
    expect(sanitizeCsvCell("=1+1")).toBe('"\'=1+1"');
    expect(sanitizeCsvCell("+cmd")).toBe('"\'+cmd"');
    const result = await t
      .withIdentity({ subject: "admin" })
      .mutation(api.reports.exportCsv, {
        ...baseFilters,
        status: "completed",
        kind: "detail",
      });
    expect(result.rowCount).toBe(1);
    expect(result.csv).toContain("PH-REPORT-1");
    expect(result.csv).not.toContain("PH-REPORT-2");
    expect(result.csv).toContain("'=HYPERLINK");
    expect(result.csv).not.toContain("Hidden Owner");
    const summary = await t
      .withIdentity({ subject: "admin" })
      .mutation(api.reports.exportCsv, {
        ...baseFilters,
        status: "completed",
        kind: "summary",
      });
    expect(summary.csv).toContain('"Total orders","1"');
    expect(summary.csv).toContain('"Actual total (minor units)","12000"');
    const audits = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.at(-1)).toMatchObject({
      action: "report.csv_exported",
      actorIsProtected: false,
    });
    expect(completedId).toBeTruthy();
  });
});
